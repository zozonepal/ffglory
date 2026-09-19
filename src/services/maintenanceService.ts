import { MaintenanceConfig } from "../types";
import { resilientGet, resilientSet, resilientOnValue, getLocalData, setLocalData } from "./resilientDb";

export const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  enabled: true, // Default to true as user requested to close website for updates
  headline: "System Update in Progress",
  message: "ffglorynepal is currently undergoing scheduled platform upgrades and major structural improvements. The website is temporarily closed to visitors while our engineering team completes new feature rollouts.",
  estimatedReturn: "Upgrades Underway • Scheduled Reopening Soon",
  allowAdminBypass: true,
  contactEmail: "support@ffglorynepal.com",
  whatsappContact: "+977 9800000000",
  telegramChannel: "https://t.me/ffglorynepal",
  updatedAt: Date.now(),
};

const DB_PATH = "system_settings/maintenance";

/**
 * Get cached maintenance configuration instantly
 */
export const getCachedMaintenanceConfig = (): MaintenanceConfig => {
  try {
    const local = getLocalData(DB_PATH, null);
    if (local && typeof local.enabled === "boolean") {
      return { ...DEFAULT_MAINTENANCE_CONFIG, ...local };
    }
    // Also check direct local storage fallback
    const direct = localStorage.getItem("ffglory_maintenance_config");
    if (direct) {
      const parsed = JSON.parse(direct);
      if (typeof parsed.enabled === "boolean") {
        return { ...DEFAULT_MAINTENANCE_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.warn("Could not parse cached maintenance config:", err);
  }
  return DEFAULT_MAINTENANCE_CONFIG;
};

/**
 * Subscribe to real-time maintenance updates from RTDB / resilient cache
 */
export const subscribeMaintenanceConfig = (
  callback: (config: MaintenanceConfig) => void
): (() => void) => {
  // Immediately invoke with cached value
  callback(getCachedMaintenanceConfig());

  return resilientOnValue(DB_PATH, (data) => {
    if (data && typeof data.enabled === "boolean") {
      const merged: MaintenanceConfig = { ...DEFAULT_MAINTENANCE_CONFIG, ...data };
      try {
        localStorage.setItem("ffglory_maintenance_config", JSON.stringify(merged));
      } catch {
        // ignore
      }
      callback(merged);
    } else {
      callback(DEFAULT_MAINTENANCE_CONFIG);
    }
  });
};

/**
 * Update maintenance configuration in RTDB and local storage
 */
export const updateMaintenanceConfig = async (
  partial: Partial<MaintenanceConfig>
): Promise<MaintenanceConfig> => {
  const current = getCachedMaintenanceConfig();
  const next: MaintenanceConfig = {
    ...current,
    ...partial,
    updatedAt: Date.now(),
  };

  setLocalData(DB_PATH, next);
  try {
    localStorage.setItem("ffglory_maintenance_config", JSON.stringify(next));
  } catch {
    // ignore
  }

  try {
    await resilientSet(DB_PATH, next);
  } catch (err) {
    console.warn("Error updating maintenance settings in RTDB (using local fallback):", err);
  }

  return next;
};

/**
 * Check if the current browser session has activated the Admin Bypass
 */
export const getIsAdminBypassActive = (): boolean => {
  try {
    return sessionStorage.getItem("ffglory_admin_bypass_active") === "true";
  } catch {
    return false;
  }
};

/**
 * Set the admin bypass state in current session
 */
export const setAdminBypassActive = (active: boolean) => {
  try {
    if (active) {
      sessionStorage.setItem("ffglory_admin_bypass_active", "true");
    } else {
      sessionStorage.removeItem("ffglory_admin_bypass_active");
    }
  } catch {
    // ignore
  }
};
