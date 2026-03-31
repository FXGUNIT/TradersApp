export const executeLogSecurityAlert = async ({
  attemptType,
  attemptedEmail,
  failureReason,
  hasEmailJsConfig,
  emailjs,
  serviceId,
  templateId,
  publicKey,
  adminAlertEmail = "gunitsingh1994@gmail.com",
}) => {
  try {
    const ipResponse = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipResponse.json();
    const ipAddress = ipData.ip || "Unknown";
    const userAgent = navigator.userAgent;
    const timestamp = new Date().toISOString();

    if (hasEmailJsConfig) {
      await emailjs.send(
        serviceId,
        templateId,
        {
          user_email: adminAlertEmail,
          to_email: adminAlertEmail,
          otp_code: `SECURITY ALERT: Unauthorized God Mode Access Attempt\n\nAttempt Type: ${attemptType}\nAttempted Email: ${attemptedEmail}\nFailure Reason: ${failureReason}\nIP Address: ${ipAddress}\nDevice Info: ${userAgent}\nTimestamp: ${timestamp}`,
        },
        publicKey,
      );
    } else {
      console.warn("EmailJS not configured for forensic alerts");
    }

    console.warn(
      `[IDS ALERT] ${attemptType} from IP ${ipAddress} at ${timestamp}`,
    );
  } catch (error) {
    console.error("Failed to log security alert:", error);
  }
};

export default {
  executeLogSecurityAlert,
};
