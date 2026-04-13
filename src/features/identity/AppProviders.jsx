/**
 * AppProviders — mounts AuthStateContext + AdminAccessContext
 * Extracted from App.jsx (I07)
 *
 * Both contexts must be available before any child component renders,
 * so they are mounted together here. AdminAccessProvider receives
 * setScreen from AuthStateContext after AuthStateProvider mounts.
 */
import React from "react";
import { AuthStateProvider, useAuthState } from "./AuthStateContext.jsx";
import { AdminAccessProvider } from "../admin-security/AdminAccessContext.jsx";

function AdminAccessProviderWithScreen({ children }) {
  const { setScreen } = useAuthState();
  return (
    <AdminAccessProvider setScreen={setScreen}>
      {children}
    </AdminAccessProvider>
  );
}

export function AppProviders({ children }) {
  return (
    <AuthStateProvider>
      <AdminAccessProviderWithScreen>
        {children}
      </AdminAccessProviderWithScreen>
    </AuthStateProvider>
  );
}
