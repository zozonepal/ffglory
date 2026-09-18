import { ref, get, set, update, remove, push, onValue, Unsubscribe } from "firebase/database";
import { db } from "../firebase";

// Local storage prefix
const LS_PREFIX = "ffg_rtdb_";

// Memory cache for active session
const memoryStore: Record<string, any> = {};

// Subscriber registry for real-time local updates
type ListenerCallback = (data: any) => void;
const subscribers: Record<string, Set<ListenerCallback>> = {};

// Track permission denied status
let isPermissionDeniedState = false;
const statusListeners = new Set<(denied: boolean) => void>();

export const getIsRtdbPermissionDenied = () => isPermissionDeniedState;

export const onRtdbPermissionStatusChange = (callback: (denied: boolean) => void) => {
  statusListeners.add(callback);
  callback(isPermissionDeniedState);
  return () => {
    statusListeners.delete(callback);
  };
};

const notifyStatusChange = (denied: boolean) => {
  if (isPermissionDeniedState !== denied) {
    isPermissionDeniedState = denied;
    statusListeners.forEach((cb) => cb(denied));
  }
};

/**
 * Check if an error is a Firebase Permission Denied error
 */
export const isPermissionError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err.message || err.code || String(err)).toLowerCase();
  return (
    msg.includes("permission_denied") ||
    msg.includes("permission denied") ||
    msg.includes("client doesn't have permission")
  );
};

/**
 * Helper to get local data by path
 */
export const getLocalData = (path: string, fallback: any = null) => {
  try {
    if (path in memoryStore) {
      return memoryStore[path];
    }
    const raw = localStorage.getItem(LS_PREFIX + path);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      memoryStore[path] = parsed;
      return parsed;
    }
  } catch (e) {
    console.warn("Error reading local data for", path, e);
  }
  return fallback;
};

/**
 * Helper to set local data by path and notify listeners
 */
export const setLocalData = (path: string, data: any) => {
  try {
    memoryStore[path] = data;
    localStorage.setItem(LS_PREFIX + path, JSON.stringify(data));
  } catch (e) {
    console.warn("Error writing local data for", path, e);
  }
  notifySubscribers(path, data);
};

/**
 * Notify subscribers of path or parent collection
 */
const notifySubscribers = (path: string, data: any) => {
  // Direct path subscribers
  if (subscribers[path]) {
    subscribers[path].forEach((cb) => cb(data));
  }

  // If path is a child, e.g. "users/123/credits" or "coupons/XYZ"
  const parts = path.split("/");
  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join("/");
    const childKey = parts[parts.length - 1];

    if (subscribers[parentPath]) {
      const parentData = getLocalData(parentPath, {});
      const updatedParent = { ...parentData, [childKey]: data };
      memoryStore[parentPath] = updatedParent;
      localStorage.setItem(LS_PREFIX + parentPath, JSON.stringify(updatedParent));
      subscribers[parentPath].forEach((cb) => cb(updatedParent));
    }
  }
};

/**
 * Resilient GET: Attempts RTDB first, gracefully falls back to local data on permission error
 */
export const resilientGet = async (path: string, fallback: any = null): Promise<any> => {
  try {
    const dbRef = ref(db, path);
    // 2-second timeout guard to prevent hanging on slow network or restricted RTDB
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("RTDB timeout")), 2000)
    );
    const snapshot = (await Promise.race([get(dbRef), timeoutPromise])) as any;
    if (snapshot && typeof snapshot.exists === "function" && snapshot.exists()) {
      const val = snapshot.val();
      setLocalData(path, val);
      return val;
    }
    return getLocalData(path, fallback);
  } catch (err: any) {
    if (isPermissionError(err)) {
      notifyStatusChange(true);
      return getLocalData(path, fallback);
    }
    console.warn("RTDB GET fallback for", path, err?.message);
    return getLocalData(path, fallback);
  }
};

/**
 * Resilient SET: Attempts RTDB first, falls back to local data
 */
export const resilientSet = async (path: string, data: any): Promise<void> => {
  // Always update local storage first so UI is immediately responsive
  setLocalData(path, data);

  try {
    const dbRef = ref(db, path);
    await set(dbRef, data);
  } catch (err: any) {
    if (isPermissionError(err)) {
      notifyStatusChange(true);
      // Suppress unhandled error, local data is already set
      return;
    }
    console.warn("RTDB SET warning for", path, err?.message);
  }
};

/**
 * Resilient UPDATE: Attempts RTDB update, falls back to local update
 */
export const resilientUpdate = async (path: string, updates: Record<string, any>): Promise<void> => {
  const current = getLocalData(path, {}) || {};
  const merged = typeof current === "object" && !Array.isArray(current)
    ? { ...current, ...updates }
    : updates;
  setLocalData(path, merged);

  try {
    const dbRef = ref(db, path);
    await update(dbRef, updates);
  } catch (err: any) {
    if (isPermissionError(err)) {
      notifyStatusChange(true);
      return;
    }
    console.warn("RTDB UPDATE warning for", path, err?.message);
  }
};

/**
 * Resilient REMOVE: Attempts RTDB remove, falls back to local delete
 */
export const resilientRemove = async (path: string): Promise<void> => {
  delete memoryStore[path];
  localStorage.removeItem(LS_PREFIX + path);
  notifySubscribers(path, null);

  // If child in collection
  const parts = path.split("/");
  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join("/");
    const childKey = parts[parts.length - 1];
    const parentData = getLocalData(parentPath, {});
    if (parentData && childKey in parentData) {
      delete parentData[childKey];
      setLocalData(parentPath, { ...parentData });
    }
  }

  try {
    const dbRef = ref(db, path);
    await remove(dbRef);
  } catch (err: any) {
    if (isPermissionError(err)) {
      notifyStatusChange(true);
      return;
    }
    console.warn("RTDB REMOVE warning for", path, err?.message);
  }
};

/**
 * Resilient PUSH: Appends item under path
 */
export const resilientPush = async (path: string, item: any): Promise<string> => {
  const generatedId = "local_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const childPath = `${path}/${generatedId}`;
  setLocalData(childPath, item);

  // Update parent collection
  const parentData = getLocalData(path, {}) || {};
  setLocalData(path, { ...parentData, [generatedId]: item });

  try {
    const dbRef = ref(db, path);
    const newRef = push(dbRef);
    const realId = newRef.key || generatedId;
    await set(newRef, item);
    return realId;
  } catch (err: any) {
    if (isPermissionError(err)) {
      notifyStatusChange(true);
      return generatedId;
    }
    console.warn("RTDB PUSH warning for", path, err?.message);
    return generatedId;
  }
};

/**
 * Resilient ON_VALUE: Listens to RTDB updates with error catcher,
 * and maintains local reactive subscriptions so UI never fails.
 */
export const resilientOnValue = (
  path: string,
  onData: (data: any) => void,
  fallbackInitial: any = null
): (() => void) => {
  // 1. Initial fire with local cache if available
  const initialLocal = getLocalData(path, fallbackInitial);
  if (initialLocal !== null && initialLocal !== undefined) {
    onData(initialLocal);
  }

  // 2. Register local subscriber
  if (!subscribers[path]) {
    subscribers[path] = new Set();
  }
  const localCb: ListenerCallback = (data) => {
    onData(data);
  };
  subscribers[path].add(localCb);

  // 3. Connect RTDB listener with mandatory error handler to prevent unhandled Permission Denied
  let rtdbUnsub: Unsubscribe | null = null;
  try {
    const dbRef = ref(db, path);
    rtdbUnsub = onValue(
      dbRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          setLocalData(path, val);
          onData(val);
        } else {
          // If RTDB has empty node, use local data if we have any
          const localVal = getLocalData(path, null);
          if (localVal !== null) {
            onData(localVal);
          } else {
            onData(null);
          }
        }
      },
      (error) => {
        if (isPermissionError(error)) {
          notifyStatusChange(true);
          // Fall back gracefully to local store
          const currentLocal = getLocalData(path, fallbackInitial);
          onData(currentLocal);
        } else {
          console.warn("RTDB listener notice for", path, error?.message);
        }
      }
    );
  } catch (err: any) {
    if (isPermissionError(err)) {
      notifyStatusChange(true);
    }
  }

  // Return cleanup function
  return () => {
    if (subscribers[path]) {
      subscribers[path].delete(localCb);
    }
    if (rtdbUnsub) {
      try {
        rtdbUnsub();
      } catch {
        // ignore
      }
    }
  };
};
