import React, { createContext, useContext, useMemo } from "react";

const AppShellContext = createContext(null);

export function AppShellProvider({ children, value }) {
  const shellValue = useMemo(
    () => ({
      ...value,
      navigateToScreen: value.navigateToScreen ?? value.setScreen,
    }),
    [value],
  );

  return (
    <AppShellContext.Provider value={shellValue}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return context;
}

export default AppShellContext;
