function completeAdminUnlock({
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
}) {
  localStorage.setItem("isAdminAuthenticated", "true");

  setShowAdminPrompt(false);
  setTotpCode("");
  setAdminOtpsVerified(false);
  setAdminOtpStep(false);
  setAdminOtps({ otp1: "", otp2: "", otp3: "" });
  setAdminMasterEmail("");
  setAdminMasterEmailVerified(false);
  setAdminOtpChallengeId("");
  setIsAdminAuthenticated(true);
  setScreen("admin");
}

export const executeSendAdminOTPs = async ({
  adminMasterEmail,
  requestAdminEmailOtp,
  logSecurityAlert,
  setAdminMasterEmailVerified,
  setAdminOtpStep,
  setAdminOtpsVerified,
  setAdminOtpErr,
  setAdminOtpChallengeId,
}) => {
  try {
    const result = await requestAdminEmailOtp(adminMasterEmail);
    setAdminOtpChallengeId(result.challengeId || "");
    setAdminMasterEmailVerified(true);
    setAdminOtpStep(true);
    setAdminOtpsVerified(false);
    setAdminOtpErr(
      result.devCodes
        ? `Local dev codes: ${Object.values(result.devCodes).join(" / ")}`
        : "",
    );
  } catch (error) {
    await logSecurityAlert(
      "Master Email Verification Failed",
      adminMasterEmail,
      error.message || "Unauthorized admin identity",
    );
    setAdminOtpErr(error.message || "Failed to send verification codes.");
  }
};

export const executeHandleAdminAccess = async ({
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
}) => {
  try {
    await verifyAdminTotp(totpCode);
  } catch (error) {
    await logSecurityAlert(
      "Authenticator Verification Failed",
      adminMasterEmail,
      error.message || "Invalid authenticator code",
    );
    setTotpErr(error.message || "Invalid authenticator code.");
    showToast("Authenticator code rejected.", "error");
    return false;
  }

  setTotpErr("");
  completeAdminUnlock({
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
  });
  return true;
};

export const executeHandleAdminVerifyCodes = async ({
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
}) => {
  try {
    await verifyAdminEmailOtp({
      challengeId: adminOtpChallengeId,
      otps: adminOtps,
    });
  } catch (error) {
    setAdminOtpErr(error.message || "Invalid verification codes.");
    return false;
  }

  setAdminOtpErr("");
  completeAdminUnlock({
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
  });
  return true;
};
