function completeAdminUnlock({
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
}) {
  localStorage.setItem("isAdminAuthenticated", "true");

  setShowAdminPrompt(false);
  setTotpCode("");
  setAdminOtpsVerified(false);
  setAdminOtpStep(false);
  setAdminOtps({ otp1: "", otp2: "", otp3: "" });
  setAdminMasterEmail("");
  setAdminMasterEmailVerified(false);
  setAdminMfaChallengeId("");
  setAdminOtpChallengeId("");
  setAdminOtpRecipients([]);
  setIsAdminAuthenticated(true);
  setScreen("admin");
}

export const executeSendAdminOTPs = async ({
  adminMfaChallengeId,
  requestAdminEmailOtp,
  logSecurityAlert,
  setAdminMasterEmailVerified,
  setAdminOtpStep,
  setAdminOtpsVerified,
  setAdminOtpErr,
  setAdminOtpChallengeId,
  setAdminOtpRecipients,
}) => {
  try {
    const result = await requestAdminEmailOtp({
      mfaChallengeId: adminMfaChallengeId,
    });
    setAdminOtpChallengeId(result.challengeId || "");
    setAdminOtpRecipients(result.recipients || []);
    setAdminMasterEmailVerified(true);
    setAdminOtpStep(true);
    setAdminOtpsVerified(false);
    setAdminOtpErr("");
  } catch (error) {
    await logSecurityAlert(
      "Admin Email OTP Request Failed",
      "backend-configured-admin-recipients",
      error.message || "Email OTP request failed",
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
  setAdminOtpsVerified,
  setAdminOtpStep,
  setAdminOtps,
  setAdminMasterEmail,
  setAdminMasterEmailVerified,
  setAdminMfaChallengeId,
  setAdminOtpChallengeId,
  setAdminOtpRecipients,
}) => {
  let result;
  try {
    result = await verifyAdminTotp(totpCode);
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
  setAdminMfaChallengeId(result?.mfaChallengeId || "");
  setAdminOtpRecipients(result?.recipients || []);
  setAdminMasterEmailVerified(true);
  setAdminOtpStep(false);
  setAdminOtpChallengeId("");
  setAdminOtpsVerified(false);
  setAdminOtps({ otp1: "", otp2: "", otp3: "" });
  setAdminMasterEmail("");
  showToast("Authenticator verified. Send the three email codes.", "success");
  return true;
};

export const executeHandleAdminVerifyCodes = async ({
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
}) => {
  try {
    await verifyAdminEmailOtp({
      mfaChallengeId: adminMfaChallengeId,
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
    setAdminMfaChallengeId,
    setAdminOtpChallengeId,
    setAdminOtpRecipients,
    setIsAdminAuthenticated,
    setScreen,
  });
  return true;
};
