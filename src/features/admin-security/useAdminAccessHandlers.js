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
  adminMfaChallengeId,
  adminOtpChallengeId,
  totpCode,
  requestAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminPasskey,
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
  setAdminMfaChallengeId,
  setAdminOtpChallengeId,
  setAdminOtpRecipients,
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
        adminMfaChallengeId,
        requestAdminEmailOtp,
        logSecurityAlert,
        setAdminMasterEmailVerified,
        setAdminOtpStep,
        setAdminOtpsVerified,
        setAdminOtpErr,
        setAdminOtpChallengeId,
        setAdminOtpRecipients,
      }),
    [
      adminMfaChallengeId,
      logSecurityAlert,
      requestAdminEmailOtp,
      setAdminMasterEmailVerified,
      setAdminOtpChallengeId,
      setAdminOtpErr,
      setAdminOtpRecipients,
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
        setAdminMfaChallengeId,
        setAdminOtpChallengeId,
        setAdminOtpRecipients,
        setIsAdminAuthenticated,
        setScreen,
        gateLabel: "Passkey",
        successMessage: "Passkey verified. Send the three email codes.",
      }),
    [
      adminMasterEmail,
      totpCode,
      logSecurityAlert,
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminMfaChallengeId,
      setAdminOtpChallengeId,
      setAdminOtpRecipients,
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

  const handleAdminPasskeyAccess = useCallback(
    async () =>
      executeHandleAdminAccess({
        totpCode: "",
        verifyAdminTotp: verifyAdminPasskey,
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
        setAdminMfaChallengeId,
        setAdminOtpChallengeId,
        setAdminOtpRecipients,
        setIsAdminAuthenticated,
        setScreen,
      }),
    [
      adminMasterEmail,
      logSecurityAlert,
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminMfaChallengeId,
      setAdminOtpChallengeId,
      setAdminOtpRecipients,
      setAdminOtpStep,
      setAdminOtps,
      setAdminOtpsVerified,
      setTotpErr,
      setTotpCode,
      setIsAdminAuthenticated,
      setScreen,
      setShowAdminPrompt,
      showToast,
      verifyAdminPasskey,
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
      setAdminMfaChallengeId("");
      setAdminOtpChallengeId("");
      setAdminOtpRecipients([]);
      setAdminOtpErr("");
      setTotpErr("");
      setTotpCode("");
    },
    [
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminMfaChallengeId,
      setAdminOtpChallengeId,
      setAdminOtpRecipients,
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
        adminMfaChallengeId,
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
        setAdminMfaChallengeId,
        setAdminOtpChallengeId,
        setAdminOtpRecipients,
        setIsAdminAuthenticated,
        setScreen,
      }),
    [
      adminMfaChallengeId,
      adminOtpChallengeId,
      adminOtps,
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setAdminMfaChallengeId,
      setAdminOtpChallengeId,
      setAdminOtpRecipients,
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

  const handleAdminRequestNewCodes = useCallback(async () => {
    if (!adminMfaChallengeId) {
      resetAdminPromptState();
      return;
    }
    setAdminOtps({ otp1: "", otp2: "", otp3: "" });
    await sendAdminOTPs();
  }, [adminMfaChallengeId, resetAdminPromptState, sendAdminOTPs, setAdminOtps]);

  return {
    sendAdminOTPs,
    handleAdminAccess,
    handleAdminPasskeyAccess,
    resetAdminPromptState,
    handleAdminVerifyCodes,
    handleAdminRequestNewCodes,
  };
}

export default useAdminAccessHandlers;
