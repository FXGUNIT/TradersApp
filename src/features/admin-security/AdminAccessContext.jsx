/**
 * AdminAccessContext — owns all admin gate state
 * Extracted from App.jsx (I07)
 *
 * State: admin MFA flow, verified status, error messages.
 * Consumed by: AppScreenRegistry, AdminUnlockModal, DebugOverlay
 */
import React, { createContext, useContext, useState } from "react";
import emailjs from "@emailjs/browser";
import { useAdminAccessHandlers } from "./useAdminAccessHandlers.js";
import {
  requestAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
} from "../../services/adminAuthService.js";
import { useToastNotifications } from "../shell/useToastNotifications.js";

export const AdminAccessContext = createContext(null);

const EMAILJS_CONFIG = Boolean(
  import.meta.env.VITE_EMAILJS_SERVICE_ID &&
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID &&
  import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
);

export function AdminAccessProvider({ children, setScreen }) {
  const { showToast } = useToastNotifications();

  // ── Admin access state ──────────────────────────────────────────────────
  const [adminPassInput, setAdminPassInput] = useState("");
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminMasterEmail, setAdminMasterEmail] = useState("");
  const [adminMasterEmailVerified, setAdminMasterEmailVerified] = useState(false);
  const [adminOtpStep, setAdminOtpStep] = useState(false);
  const [adminOtpsVerified, setAdminOtpsVerified] = useState(false);
  const [adminOtps, setAdminOtps] = useState({ otp1: "", otp2: "", otp3: "" });
  const [adminOtpChallengeId, setAdminOtpChallengeId] = useState("");
  const [adminOtpErr, setAdminOtpErr] = useState("");
  const [adminPassErr, setAdminPassErr] = useState("");
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // ── Handler bridge ────────────────────────────────────────────────────────
  const {
    sendAdminOTPs,
    handleAdminAccess,
    resetAdminPromptState,
    handleAdminVerifyCodes,
    handleAdminRequestNewCodes,
  } = useAdminAccessHandlers({
    adminMasterEmail,
    adminOtps,
    adminOtpChallengeId,
    adminPassInput,
    requestAdminEmailOtp,
    verifyAdminEmailOtp,
    verifyAdminTotp,
    hasEmailJsConfig: EMAILJS_CONFIG,
    emailjs,
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
    sendForensicAlert: null, // wired via securityForensicsHandlers
    showToast,
    setShowAdminPrompt,
    setAdminMasterEmail,
    setAdminMasterEmailVerified,
    setAdminOtpStep,
    setAdminOtpsVerified,
    setAdminOtps,
    setAdminOtpChallengeId,
    setAdminPassInput,
    setAdminPassErr,
    setAdminOtpErr,
    setIsAdminAuthenticated,
    setScreen,
    setShowAdminPwd,
  });

  const value = {
    // State
    adminPassInput,
    showAdminPrompt,
    adminMasterEmail,
    adminMasterEmailVerified,
    adminOtpStep,
    adminOtpsVerified,
    adminOtps,
    adminOtpChallengeId,
    adminOtpErr,
    adminPassErr,
    showAdminPwd,
    isAdminAuthenticated,
    // Setters
    setAdminPassInput,
    setShowAdminPrompt,
    setAdminMasterEmail,
    setAdminMasterEmailVerified,
    setAdminOtpStep,
    setAdminOtpsVerified,
    setAdminOtps,
    setAdminOtpChallengeId,
    setAdminOtpErr,
    setAdminPassErr,
    setShowAdminPwd,
    setIsAdminAuthenticated,
    // Handlers
    sendAdminOTPs,
    handleAdminAccess,
    resetAdminPromptState,
    handleAdminVerifyCodes,
    handleAdminRequestNewCodes,
  };

  return (
    <AdminAccessContext.Provider value={value}>
      {children}
    </AdminAccessContext.Provider>
  );
}

/** Hook to consume admin access state — throws if outside provider */
export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) throw new Error("useAdminAccess must be used within AdminAccessProvider");
  return ctx;
}
