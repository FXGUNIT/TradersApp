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
  adminOtpChallengeId,
  totpCode,
  requestAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
  hasEmailJsConfig,
  emailjs,
  serviceId,
  templateId,
  publicKey,
  showToast,
  setShowAdminPrompt,
  setAdminMasterEmail,
  setAdminMasterEmailVerified,
  setAdminOtpStep,
  setAdminOtpsVerified,
  setAdminOtps,
  setAdminOtpChallengeId,
  setTotpCode,
  setTotpErr,
  setAdminOtpErr,
  setIsAdminAuthenticated,
  setScreen,
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
        requestAdminEmailOtp,
        logSecurityAlert,
        setAdminMasterEmailVerified,
        setAdminOtpStep,
        setAdminOtpsVerified,
        setAdminOtpErr,
        setAdminOtpChallengeId,
      }),
    [
      adminMasterEmail,
      logSecurityAlert,
      requestAdminEmailOtp,
      setAdminMasterEmailVerified,
      setAdminOtpChallengeId,
      setAdminOtpErr,
      setAdminOtpStep,
      setAdminOtpsVerified,
    ],
  );

  const handleAdminAccess = useCallback(
    async () =>
      executeHandleAdminAccess({
        totpCode,
        verifyAdminTotp,
        logSecurityAlert,
        adminMasterEmail,
        showToast,
        setTotpErr,
        setShowAdminPrompt,
        setTotpCode,
        setAdminOtpsVerified,
        setAdminOtpStep,
        setAdminOtps,
        setAdminMasterEmail,
        setAdminMasterEmailVerified,
        setAdminOtpChallengeId,
        setIsAdminAuthenticated,
        setScreen,
      }),
    [
      adminMasterEmail,
      totpCode,
      logSecurityAlert,
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminOtpChallengeId,
      setAdminOtpStep,
      setAdminOtps,
      setAdminOtpsVerified,
      setTotpErr,
      setTotpCode,
      setIsAdminAuthenticated,
      setScreen,
      setShowAdminPrompt,
      showToast,
      verifyAdminTotp,
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
      setAdminOtpChallengeId("");
      setAdminOtpErr("");
      setTotpErr("");
      setTotpCode("");
    },
    [
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminOtpChallengeId,
      setAdminOtpErr,
      setAdminOtpStep,
      setAdminOtps,
      setAdminOtpsVerified,
      setTotpErr,
      setTotpCode,
      setShowAdminPrompt,
    ],
  );

  const handleAdminVerifyCodes = useCallback(
    async () =>
      executeHandleAdminVerifyCodes({
        adminOtps,
        adminOtpChallengeId,
        verifyAdminEmailOtp,
        setAdminOtpErr,
        setShowAdminPrompt,
        setTotpCode,
        setAdminOtpsVerified,
        setAdminOtpStep,
        setAdminOtps,
        setAdminMasterEmail,
        setAdminMasterEmailVerified,
        setAdminOtpChallengeId,
        setIsAdminAuthenticated,
        setScreen,
      }),
    [
      adminOtpChallengeId,
      adminOtps,
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminOtpChallengeId,
      setAdminOtpErr,
      setAdminOtpStep,
      setAdminOtps,
      setAdminOtpsVerified,
      setTotpCode,
      setIsAdminAuthenticated,
      setScreen,
      setShowAdminPrompt,
      verifyAdminEmailOtp,
    ],
  );

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
