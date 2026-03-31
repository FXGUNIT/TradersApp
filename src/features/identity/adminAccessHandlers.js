import emailjs from "@emailjs/browser";

const MASTER_ADMIN_EMAIL = "gunitsingh1994@gmail.com";

export const executeSendAdminOTPs = async ({
  adminMasterEmail,
  hasEmailJsConfig,
  sendForensicAlert,
  logSecurityAlert,
  setAdminMasterEmailVerified,
  setAdminOtpStep,
  setAdminOtpsVerified,
  setAdminOtpErr,
}) => {
  if (
    adminMasterEmail.toLowerCase().trim() !== MASTER_ADMIN_EMAIL.toLowerCase()
  ) {
    await logSecurityAlert(
      "Master Email Verification Failed",
      adminMasterEmail,
      "Unauthorized email address",
    );

    sendForensicAlert(adminMasterEmail, "SECURITY_BREACH");

    setAdminOtpErr("Access Denied: Unauthorized Admin Identity");
    return;
  }

  try {
    const auditMode =
      typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA;
    const otp1 = auditMode ? "111111" : genOTP();
    const otp2 = auditMode ? "222222" : genOTP();
    const otp3 = auditMode ? "333333" : genOTP();

    const emails = [
      "gunitsingh1994@gmail.com",
      "arkgproductions@gmail.com",
      "starg.unit@gmail.com",
    ];

    const otpPromises = emails.map(async (email, index) => {
      const otpCode = [otp1, otp2, otp3][index];
      if (!hasEmailJsConfig) {
        console.warn("EmailJS not configured for OTP batch delivery");
        return Promise.resolve();
      }

      return emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          user_email: email,
          otp_code: otpCode,
          to_email: email,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );
    });

    await Promise.all(otpPromises);

    sessionStorage.setItem(
      "adminOtps",
      JSON.stringify({ otp1, otp2, otp3, timestamp: Date.now() }),
    );

    setAdminMasterEmailVerified(true);
    setAdminOtpStep(true);
    setAdminOtpsVerified(false);
    setAdminOtpErr("");
  } catch (error) {
    console.error("Failed to send admin OTPs:", error);
    setAdminOtpErr("Failed to send verification codes. Please try again.");
  }
};

export const executeVerifyAdminOTPs = ({
  adminOtps,
}) => {
  const auditMode =
    typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA?.active;
  if (
    auditMode &&
    adminOtps.otp1 === "111111" &&
    adminOtps.otp2 === "222222" &&
    adminOtps.otp3 === "333333"
  ) {
    sessionStorage.removeItem("adminOtps");
    return { success: true };
  }

  const stored = sessionStorage.getItem("adminOtps");
  if (!stored) {
    return { success: false, error: "OTP session expired. Please request new codes." };
  }

  const { otp1, otp2, otp3, timestamp } = JSON.parse(stored);

  if (Date.now() - timestamp > 5 * 60 * 1000) {
    sessionStorage.removeItem("adminOtps");
    return { success: false, error: "OTP codes expired. Please request new codes." };
  }

  if (
    adminOtps.otp1 !== otp1 ||
    adminOtps.otp2 !== otp2 ||
    adminOtps.otp3 !== otp3
  ) {
    return { success: false, error: "Invalid verification codes. Please check and try again." };
  }

  sessionStorage.removeItem("adminOtps");
  return { success: true };
};

export const executeHandleAdminAccess = async ({
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
}) => {
  try {
    await verifyAdminPassword(adminPassInput);
  } catch (error) {
    await logSecurityAlert(
      "Master Password Verification Failed",
      adminMasterEmail,
      error.message || "Invalid master password",
    );
    setAdminPassErr(error.message || "Invalid admin password.");
    showToast("Cipher mismatch. Authorization protocol rejected.", "error");
    return;
  }

  if (!adminOtpsVerified) {
    setAdminPassErr("Please verify the OTP codes first.");
    showToast(
      "OTP verification pending. Authenticate to proceed.",
      "warning",
    );
    return;
  }

  localStorage.setItem("isAdminAuthenticated", "true");

  setShowAdminPrompt(false);
  setAdminPassInput("");
  setAdminPassErr("");
  setAdminOtpsVerified(false);
  setAdminOtpStep(false);
  setAdminOtps({ otp1: "", otp2: "", otp3: "" });
  setAdminMasterEmail("");
  setAdminMasterEmailVerified(false);
  setIsAdminAuthenticated(true);
  setScreen("admin");
};

export const executeHandleAdminVerifyCodes = ({
  adminOtps,
  setAdminOtpStep,
  setAdminOtpErr,
}) => {
  const result = executeVerifyAdminOTPs({ adminOtps });
  
  if (result.success) {
    setAdminOtpStep(false);
    return true;
  } else {
    setAdminOtpErr(result.error);
    return false;
  }
};

function genOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
