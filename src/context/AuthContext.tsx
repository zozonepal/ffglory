import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { UserProfile, UserRole } from "../types";
import {
  resilientGet,
  resilientSet,
  resilientUpdate,
  resilientOnValue,
  getLocalData,
  onRtdbPermissionStatusChange,
} from "../services/resilientDb";

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  rtdbPermissionDenied: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, username?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setUserRole: (newRole: UserRole) => Promise<void>;
  updateUserCredits: (newTotal: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Super admin email from metadata
const SUPER_ADMIN_EMAIL = "tiktokhorizon9@gmail.com";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rtdbPermissionDenied, setRtdbPermissionDenied] = useState<boolean>(false);

  useEffect(() => {
    const unsubStatus = onRtdbPermissionStatusChange((denied) => {
      setRtdbPermissionDenied(denied);
    });
    return () => unsubStatus();
  }, []);

  // Sync profile when auth state changes
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

        // 1. Preload from local cache to eliminate race conditions
        const localCached = getLocalData(`users/${user.uid}`, null);
        let profileState: UserProfile = localCached || {
          uid: user.uid,
          email: user.email || "",
          username: user.displayName || user.email?.split("@")[0] || "User",
          role: isSuperAdmin ? "admin" : "user",
          credits: 0,
          createdAt: Date.now(),
        };

        if (isSuperAdmin) {
          profileState.role = "admin";
        }

        // Set state immediately so UI has user profile
        setUserProfile(profileState);

        // 2. Resiliently fetch or initialize in RTDB
        try {
          const rtdbData = await resilientGet(`users/${user.uid}`, null);
          if (rtdbData) {
            profileState = {
              uid: user.uid,
              email: rtdbData.email || user.email || "",
              username: rtdbData.username || user.displayName || user.email?.split("@")[0] || "User",
              role: isSuperAdmin ? "admin" : (rtdbData.role || profileState.role || "user"),
              credits: typeof rtdbData.credits === "number" ? rtdbData.credits : profileState.credits,
              createdAt: rtdbData.createdAt || profileState.createdAt,
            };
            setUserProfile(profileState);
          } else {
            await resilientSet(`users/${user.uid}`, profileState);
          }
        } catch {
          // resilientGet catches permission denied and uses local cache
        }

        // 3. Realtime reactive listener for credits and role
        unsubscribeProfile = resilientOnValue(
          `users/${user.uid}`,
          (val) => {
            if (val) {
              setUserProfile({
                uid: user.uid,
                email: val.email || user.email || "",
                username: val.username || user.displayName || user.email?.split("@")[0] || "User",
                role: isSuperAdmin ? "admin" : (val.role || "user"),
                credits: typeof val.credits === "number" ? val.credits : 0,
                createdAt: val.createdAt || Date.now(),
              });
            }
          },
          profileState
        );
      } else {
        setUserProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUpWithEmail = async (email: string, pass: string, username?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const user = cred.user;
    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || "",
      username: username || user.email?.split("@")[0] || "User",
      role: isSuperAdmin ? "admin" : "user",
      credits: 0,
      createdAt: Date.now(),
    };
    await resilientSet(`users/${user.uid}`, newProfile);
    setUserProfile(newProfile);
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    const existing = await resilientGet(`users/${user.uid}`, null);
    if (!existing) {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || "",
        username: user.displayName || user.email?.split("@")[0] || "User",
        role: isSuperAdmin ? "admin" : "user",
        credits: 0,
        createdAt: Date.now(),
      };
      await resilientSet(`users/${user.uid}`, newProfile);
      setUserProfile(newProfile);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  const setUserRole = async (newRole: UserRole) => {
    if (!currentUser) return;
    await resilientUpdate(`users/${currentUser.uid}`, { role: newRole });
    setUserProfile((prev) => (prev ? { ...prev, role: newRole } : null));
  };

  const updateUserCredits = async (newTotal: number) => {
    if (!currentUser) return;
    await resilientUpdate(`users/${currentUser.uid}`, { credits: newTotal });
    setUserProfile((prev) => (prev ? { ...prev, credits: newTotal } : null));
  };

  const isAdmin = Boolean(
    userProfile?.role === "admin" ||
    currentUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isAdmin,
        rtdbPermissionDenied,
        signInWithEmail,
        signUpWithEmail,
        loginWithGoogle,
        logout,
        setUserRole,
        updateUserCredits,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
