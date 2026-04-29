import { useEffect, useState } from "react";
import { createTheme } from "../../utils/uiUtils.js";
import { CSS_VARS } from "../../styles/cssVars.js";

export const APP_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";
export const APP_MONO_FAMILY =
  "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace";

export const OFFICERS_BRIEFING = [
  "Make your role so worthy in life that people applaud you even after the curtain falls.",
  "May the god show mercy on our enemies because we won't.",
  "An angry wife can be more frightening than an army of disgruntled soldiers.",
  "Individually, you are a warrior. Together, we are an army.",
  "It's not the years in your life that count. It's the life in your years.",
  "Life is what happens to us while we are making other plans.",
  "A goal without a plan is just a wish.",
  "Don't let yesterday take up too much of today.",
  "The best revenge is massive success.",
  "I am not a product of my circumstances. I am a product of my decisions.",
  "People who are crazy enough to think they can change the world, are the ones who do.",
  "In three words I can sum up everything I've learned about life: it goes on.",
  "Bravery is their routine, sacrifice their second nature.",
  "The only way to do great work is to love what you do.",
  "Believe you can and you're halfway there.",
  "It does not matter how slowly you go as long as you do not stop.",
  "You miss 100% of the shots you don't take.",
];

export const getRandomQuote = () =>
  OFFICERS_BRIEFING[Math.floor(Math.random() * OFFICERS_BRIEFING.length)];

export const SafeAreaWrapper = ({ children, style = {} }) => {
  return (
    <div
      style={{
        ...style,
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
      }}
    >
      {children}
    </div>
  );
};

export const compressIdentityProofImage = async (
  file,
  maxSize = 512000,
  maxWidth = 1920,
  quality = 0.75,
) => {
  return new Promise((resolve, reject) => {
    if (file.size <= maxSize) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob.size > maxSize && quality > 0.3) {
              compressIdentityProofImage(
                new File([blob], file.name, { type: "image/jpeg" }),
                maxSize,
                maxWidth,
                quality - 0.15,
              )
                .then(resolve)
                .catch(reject);
            } else {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: file.lastModified,
              });
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = () => {
        reject(new Error("Failed to load image for compression"));
      };
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file for compression"));
    };
  });
};

export const uploadIdentityDoc = async (file, uid, docType, deps = {}) => {
  const {
    firebaseStorage,
    storageRef,
    uploadBytes,
    getDownloadURL,
    AntivirusGateway = class AntivirusGateway {
      async verifyFileSignature() {
        return { valid: true, reason: "stub" };
      }
      async handleMaliciousFile() {}
    },
  } = deps;

  try {
    if (!file) throw new Error("No file selected");

    const antivirusGateway = new AntivirusGateway(
      deps.onSecurityToast || window.showToastNotification,
    );
    const verification = await antivirusGateway.verifyFileSignature(file);

    if (!verification.valid) {
      console.error("MALWARE DETECTED:", verification);
      if (window.showToastNotification) {
        window.showToastNotification(
          "MALICIOUS PAYLOAD DETECTED. REPORTING TO SECURITY.",
          "error",
          5000,
        );
      }

      await antivirusGateway.handleMaliciousFile(
        verification,
        uid,
        window.sendTelegramAlert,
      );

      throw new Error(`File verification failed: ${verification.reason}`);
    }

    const allowedTypes = [
      "image/jpeg",
      "application/pdf",
      "image/png",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only image and PDF files are allowed");
    }

    let uploadFile = file;
    if (file.type === "image/jpeg") {
      uploadFile = await compressIdentityProofImage(file);
    }

    const maxSize = 5 * 1024 * 1024;
    if (uploadFile.size > maxSize) {
      throw new Error("File size must be less than 5MB");
    }

    const timestamp = new Date().getTime();
    const fileName = `${docType}_${timestamp}_${file.name}`;
    const fileRef = storageRef(
      firebaseStorage,
      `verification_docs/${uid}/${fileName}`,
    );
    const snapshot = await uploadBytes(fileRef, uploadFile);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      fileName,
      url: downloadURL,
      type: docType,
      uploadedAt: new Date().toISOString(),
      size: uploadFile.size,
      mimeType: uploadFile.type,
      originalSize: file.size,
      compressionRatio:
        uploadFile.size > 0
          ? (((file.size - uploadFile.size) / file.size) * 100).toFixed(1) + "%"
          : "0%",
    };
  } catch (error) {
    console.error("Identity doc upload failed:", error);
    throw error;
  }
};

export const useSystemTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => setIsDarkMode(event.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDarkMode;
};

export const TIME_OPTIONS = (() => {
  const opts = [{ v: "", l: "— time IST —" }];
  for (let h = 10; h <= 17; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 17 && m > 0) continue;
      const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      opts.push({
        v: `${hh}:${String(m).padStart(2, "0")} ${ampm}`,
        l: `${hh}:${String(m).padStart(2, "0")} ${ampm} IST`,
      });
    }
  }
  return opts;
})();

// System prompts are defined in terminalHelperComponents.jsx (canonical source).
// Duplicates here are kept for backward compatibility only.


export const createShellChrome = (theme = createTheme(false, "BLUE")) => ({
  authCard: {
    background: CSS_VARS.surfaceElevated,
    backgroundImage:
      `linear-gradient(var(--surface-overlay, rgba(255,255,255,0.97)), var(--surface-overlay, rgba(255,255,255,0.97))), url('/wallpaper.png')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundBlendMode: "lighten",
    backgroundAttachment: "fixed",
    border: "none",
    borderRadius: 24,
    padding: "clamp(24px, 6vw, 56px)",
    width: "100%",
    maxWidth: 680,
    margin: "0 auto",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxSizing: "border-box",
    overflowX: "hidden",
    overflowY: "visible",
    boxShadow:
      "var(--shadow-card, 0 20px 25px -5px rgba(0, 0, 0, 0.05)), var(--shadow-card-soft, 0 10px 10px -5px rgba(0, 0, 0, 0.04))",
    position: "relative",
  },
  authInp: {
    background: CSS_VARS.surfaceElevated,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    borderRadius: 6,
    padding: "12px 40px 12px 40px",
    color: CSS_VARS.textPrimary,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "all 0.2s ease",
    marginBottom: 16,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    height: 44,
  },
  authBtn: (color, disabled) => ({
    background: disabled
      ? "var(--surface-overlay, rgba(0,0,0,0.3))"
      : CSS_VARS.accentPrimary,
    border: `none`,
    borderRadius: 6,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--text-tertiary, rgba(255,255,255,0.6))" : "var(--accent-text, #FFFFFF)",
    fontFamily: APP_FONT_FAMILY,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.05em",
    width: "100%",
    transition: "all 0.2s ease",
    opacity: disabled ? 0.6 : 1,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    boxShadow: disabled ? "none" : "var(--shadow-card, 0 4px 6px -1px rgba(0, 0, 0, 0.1))",
  }),
  lbl: {
    color: CSS_VARS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
    display: "block",
    textTransform: "uppercase",
    fontWeight: 600,
    fontFamily: APP_FONT_FAMILY,
  },
  inp: {
    background: CSS_VARS.surfaceElevated,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    borderRadius: 8,
    padding: "12px 14px",
    color: theme.text,
    fontFamily: APP_MONO_FAMILY,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "all 0.2s ease",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  },
  cardS: (e = {}) => ({
    background: CSS_VARS.surfaceElevated,
    border: "none",
    borderRadius: 12,
    padding: "24px 32px",
    marginBottom: 16,
    boxShadow:
      "var(--shadow-card, 0 4px 6px -1px rgba(0, 0, 0, 0.05)), var(--shadow-card-soft, 0 2px 4px -1px rgba(0, 0, 0, 0.03))",
    ...e,
  }),
  glowBtn: (color, disabled) => ({
    background: disabled ? "var(--surface-ghost, rgba(0,0,0,0.05))" : `${color}08`,
    border: `1px solid ${disabled ? "var(--border-subtle, rgba(0,0,0,0.1))" : `${color}30`}`,
    borderRadius: 8,
    padding: "14px 28px",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? CSS_VARS.textTertiary : color,
    fontFamily: APP_FONT_FAMILY,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 1.5,
    transition: "all 0.2s ease",
    opacity: disabled ? 0.6 : 1,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  }),
  AMD_PHASES: {
    ACCUMULATION: {
      color: theme.amdA,
      icon: "●",
      label: "Accumulation (Mean Reversion)",
      desc: "Smart money building long positions",
    },
    MANIPULATION: {
      color: theme.amdM,
      icon: "⚡¡",
      label: "Manipulation (Reversal)",
      desc: "Stop hunt / false breakout",
    },
    DISTRIBUTION: {
      color: theme.amdD,
      icon: "◉",
      label: "Distribution (Trend)",
      desc: "Smart money offloading into strength",
    },
    TRANSITION: {
      color: theme.amdT,
      icon: "⊙",
      label: "Transition (No Trade)",
      desc: "Phase shifting — stay flat",
    },
    UNCLEAR: {
      color: theme.muted,
      icon: "?",
      label: "Phase Unclear",
      desc: "No clear institutional signature",
    },
  },
  LED: function LED({ color, size = 10, pulse = true }) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${size}px ${color},0 0 ${size * 2}px ${color}60`,
          animation: pulse ? `led-pulse 1.8s ease-in-out infinite` : "none",
          flexShrink: 0,
        }}
      />
    );
  },
  SHead: function SHead({ icon, title, color, sub, right }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          paddingBottom: 12,
          borderBottom: `1px solid ${color}20`,
        }}
      >
        <span style={{ color, fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              color,
              fontSize: 13,
              letterSpacing: 1.5,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          {sub && (
            <div
              style={{
                color: theme.muted,
                fontSize: 11,
                marginTop: 4,
                fontWeight: 400,
              }}
            >
              {sub}
            </div>
          )}
        </div>
        {right}
      </div>
    );
  },
  TableSkeletonLoader: function TableSkeletonLoader() {
    const skeletonRows = Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${CSS_VARS.borderStrong}`,
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1.5fr 1.2fr 1fr",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              height: 12,
              background: "var(--surface-ghost, rgba(255,255,255,0.06))",
              borderRadius: 4,
              marginBottom: 6,
              animation: "pulse 1.5s ease-in-out infinite",
              width: "70%",
            }}
          />
          <div
            style={{
              height: 10,
              background: "var(--surface-ghost, rgba(255,255,255,0.04))",
              borderRadius: 4,
              width: "50%",
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: "0.1s",
            }}
          />
        </div>
        <div
          style={{
            height: 11,
            background: "var(--surface-ghost, rgba(255,255,255,0.06))",
            borderRadius: 4,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.2s",
            width: "80%",
          }}
        />
        <div
          style={{
            height: 11,
            background: "var(--surface-ghost, rgba(255,255,255,0.06))",
            borderRadius: 4,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.3s",
            width: "60%",
          }}
        />
        <div
          style={{
            height: 24,
            background: "var(--surface-ghost, rgba(255,255,255,0.06))",
            borderRadius: 20,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.4s",
            width: "80px",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              height: 24,
              width: 70,
              background: "var(--surface-ghost, rgba(255,255,255,0.06))",
              borderRadius: 4,
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: "0.5s",
            }}
          />
        </div>
      </div>
    ));

    return <div>{skeletonRows}</div>;
  },
});

export default createShellChrome;
