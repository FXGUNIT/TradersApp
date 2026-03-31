import { useCallback, useEffect, useState } from "react";

const MAINTENANCE_STORAGE_KEY = "TradersApp_MaintenanceMode";

function readMaintenanceCache() {
  try {
    const cached = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
    return cached === "true";
  } catch {
    return false;
  }
}

function writeMaintenanceCache(value) {
  try {
    localStorage.setItem(MAINTENANCE_STORAGE_KEY, String(Boolean(value)));
  } catch {
    // localStorage is a best-effort cache only.
  }
}

export function useMaintenanceMode({
  fetchMaintenanceState,
  toggleMaintenanceState,
  showToast,
}) {
  const [maintenanceModeActive, setMaintenanceModeActive] = useState(false);

  useEffect(() => {
    let active = true;

    const loadState = async () => {
      if (typeof fetchMaintenanceState === "function") {
        try {
          const response = await fetchMaintenanceState();
          if (!active) {
            return;
          }

          if (response?.success === false) {
            throw new Error(response.error || "Failed to load maintenance.");
          }

          if (typeof response?.maintenanceActive === "boolean") {
            setMaintenanceModeActive(response.maintenanceActive);
            return;
          }
        } catch (error) {
          console.warn("Maintenance state client load failed, falling back:", error);
        }
      }

      if (!active) {
        return;
      }
      setMaintenanceModeActive(readMaintenanceCache());
    };

    void loadState();
    return () => {
      active = false;
    };
  }, [fetchMaintenanceState]);

  const handleToggleMaintenanceMode = useCallback(async () => {
    const nextState = !maintenanceModeActive;

    if (typeof toggleMaintenanceState === "function") {
      try {
        const response = await toggleMaintenanceState(nextState);
        if (response?.success === false) {
          throw new Error(response.error || "Failed to update maintenance.");
        }

        const resolvedState =
          typeof response?.maintenanceActive === "boolean"
            ? response.maintenanceActive
            : nextState;
        setMaintenanceModeActive(resolvedState);
        writeMaintenanceCache(resolvedState);
        showToast(
          resolvedState
            ? 'Maintenance Mode ACTIVATED - Users see "Back Soon" screen'
            : "Maintenance Mode DEACTIVATED - Normal access restored",
          resolvedState ? "warning" : "success",
        );
        return;
      } catch (error) {
        console.warn("Maintenance toggle client update failed, falling back:", error);
      }
    }

    setMaintenanceModeActive(nextState);
    writeMaintenanceCache(nextState);
    showToast(
      nextState
        ? 'Maintenance Mode ACTIVATED - Users see "Back Soon" screen'
        : "Maintenance Mode DEACTIVATED - Normal access restored",
      nextState ? "warning" : "success",
    );
  }, [maintenanceModeActive, showToast, toggleMaintenanceState]);

  return {
    maintenanceModeActive,
    handleToggleMaintenanceMode,
    setMaintenanceModeActive,
  };
}

export default useMaintenanceMode;
