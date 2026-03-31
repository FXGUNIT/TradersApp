import { useCallback } from "react";
import {
  executeSendAdminOTPs,
  executeHandleAdminAccess,
  executeHandleAdminVerifyCodes,
} from "../identity/adminAccessHandlers.js";
import { executeLogSecurityAlert } from "./securityForensicsHandlers.js";

export function useAdminAccessHandlers({
  adminMasterEmail,
  adminOtps,
  adminOtpsVerified,
  adminPassInput,
  hasEmailJsConfig,
  emailjs,
  serviceId,
  templateId,
  publicKey,
  sendForensicAlert,
  verifyAdminPassword,
  showToast,
  setShowAdminPrompt,
  setAdminMasterEmail,
  setAdminMasterEmailVerified,
  setAdminOtpStep,
  setAdminOtpsVerified,
  setAdminOtps,
  setAdminPassInput,
  setAdminPassErr,
  setAdminOtpErr,
  setIsAdminAuthenticated,
  setScreen,
  setShowAdminPwd,
}) {
  const logSecurityAlert = useCallback(
    async (attemptType, attemptedEmail, failureReason) => {
      await executeLogSecurityAlert({
        attemptType,
        attemptedEmail,
        failureReason,
        hasEmailJsConfig,
        emailjs,
        serviceId,
        templateId,
        publicKey,
      });
    },
    [emailjs, hasEmailJsConfig, publicKey, serviceId, templateId],
  );

  const sendAdminOTPs = useCallback(
    async () =>
      executeSendAdminOTPs({
        adminMasterEmail,
        hasEmailJsConfig,
        sendForensicAlert,
        logSecurityAlert,
        setAdminMasterEmailVerified,
        setAdminOtpStep,
        setAdminOtpsVerified,
        setAdminOtpErr,
      }),
    [
      adminMasterEmail,
      hasEmailJsConfig,
      logSecurityAlert,
      sendForensicAlert,
      setAdminMasterEmailVerified,
      setAdminOtpErr,
      setAdminOtpStep,
      setAdminOtpsVerified,
    ],
  );

  const handleAdminAccess = useCallback(
    async () =>
      executeHandleAdminAccess({
        adminPassInput,
        adminOtpsVerified,
        verifyAdminPassword,
        logSecurityAlert,
        adminMasterEmail,
        showToast,
        setAdminPassErr,
        setShowAdminPrompt,
        setAdminPassInput,
        setAdminOtpsVerified,
        setAdminOtpStep,
        setAdminOtps,
        setAdminMasterEmail,
        setAdminMasterEmailVerified,
        setIsAdminAuthenticated,
        setScreen,
      }),
    [
      adminMasterEmail,
      adminOtpsVerified,
      adminPassInput,
      logSecurityAlert,
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminOtpStep,
      setAdminOtps,
      setAdminOtpsVerified,
      setAdminPassErr,
      setAdminPassInput,
      setIsAdminAuthenticated,
      setScreen,
      setShowAdminPrompt,
      showToast,
      verifyAdminPassword,
    ],
  );

  const resetAdminPromptState = useCallback(
    ({ closePrompt = false } = {}) => {
      if (closePrompt) {
        setShowAdminPrompt(false);
      }
      setAdminMasterEmail("");
      setAdminMasterEmailVerified(false);
      setAdminOtpStep(false);
      setAdminOtpsVerified(false);
      setAdminOtps({ otp1: "", otp2: "", otp3: "" });
      setAdminOtpErr("");
      setAdminPassErr("");
      setAdminPassInput("");
      setShowAdminPwd(false);
      sessionStorage.removeItem("adminOtps");
    },
    [
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminOtpErr,
      setAdminOtpStep,
      setAdminOtps,
      setAdminOtpsVerified,
      setAdminPassErr,
      setAdminPassInput,
      setShowAdminPrompt,
      setShowAdminPwd,
    ],
  );

  const handleAdminVerifyCodes = useCallback(() => {
    const verified = executeHandleAdminVerifyCodes({
      adminOtps,
      setAdminOtpStep,
      setAdminOtpErr,
    });
    if (verified) {
      setAdminOtpsVerified(true);
      setAdminOtpErr("");
    }
    return verified;
  }, [adminOtps, setAdminOtpErr, setAdminOtpStep, setAdminOtpsVerified]);

  const handleAdminRequestNewCodes = useCallback(() => {
    resetAdminPromptState();
  }, [resetAdminPromptState]);

  return {
    sendAdminOTPs,
    handleAdminAccess,
    resetAdminPromptState,
    handleAdminVerifyCodes,
    handleAdminRequestNewCodes,
  };
}

export default useAdminAccessHandlers;
