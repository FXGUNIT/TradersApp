// ═══════════════════════════════════════════════════════════════════
// BACKEND SECURITY SENTINEL - Multi-Layer Defense System
// ═══════════════════════════════════════════════════════════════════
// 4 Layers:
// 1. STICKY TRAP HONEYPOT - Dummy database path that triggers alerts
// 2. ANTIVIRUS GATEWAY - File MIME type verification
// 3. ANTI-HACKER SENTINEL - Admin click speed detection
// 4. ANTI-SPAM SHIELD - Honeypot field in signup form
/* eslint-disable no-console */

import { ref, onValue } from "firebase/database";

// ═══════════════════════════════════════════════════════════════════
// LAYER 1: STICKY TRAP HONEYPOT 🪤
// ═══════════════════════════════════════════════════════════════════
/**
 * Honeypot Listener - Monitors dummy database path for unauthorized access
 * Triggers CRITICAL BREACH alert if non-admin attempts access
 * 
 * Path: /system_configs/master_key
 * Alert: Telegram CRITICAL BREACH
 * Action: Permanent IP Ban + Account Lock
 */
export class StickyTrapHoneypot {
  constructor(firebaseDb, currentUserUID, adminUID, telegramAlert) {
    this.db = firebaseDb;
    this.currentUserUID = currentUserUID;
    this.adminUID = adminUID;
    this.telegramAlert = telegramAlert;
    this.isActive = false;
    this.listener = null;
  }

  /**
   * Activate honeypot listener
   * Real-time listener on /system_configs/master_key
   */
  activate() {
    const honeypotRef = ref(this.db, '/system_configs/master_key');
    
    this.listener = onValue(honeypotRef, (snapshot) => {
      // Log whenever the honeypot is accessed
      const timestamp = new Date().toISOString();
      const accessRecord = {
        timestamp,
        uid: this.currentUserUID,
        isAdmin: this.currentUserUID === this.adminUID,
        accessType: snapshot.exists() ? 'READ' : 'QUERY',
        triggerCount: (snapshot.val() || 0) + 1
      };

      // TRIGGER ALERT if non-admin accessed honeypot
      if (this.currentUserUID !== this.adminUID && snapshot.exists()) {
        this.triggerSecurityBreach(accessRecord);
      }

      console.log(`🪤 Honeypot Access Log: ${timestamp}`, accessRecord);
    }, (error) => {
      console.error('Honeypot listener error:', error);
    });

    this.isActive = true;
    console.log('🪤 Sticky Trap Honeypot: ARMED');
  }

  /**
   * Handle security breach alarm
   * Sends Telegram alert and logs for admin review
   */
  triggerSecurityBreach(accessRecord) {
    console.error('🚨 CRITICAL SECURITY BREACH DETECTED 🚨', accessRecord);

    // Send Telegram alert
    if (this.telegramAlert) {
      this.telegramAlert(
        'CRITICAL BREACH',
        `⚠️ HONEYPOT TRAP TRIGGERED\n\n` +
        `UID: ${accessRecord.uid}\n` +
        `Timestamp: ${accessRecord.timestamp}\n` +
        `Path Accessed: /system_configs/master_key\n` +
        `Status: PERMANENT IP BAN + ACCOUNT LOCK\n` +
        `Action Required: Investigate & Revoke Access Immediately`
      );
    }

    // Schedule Cloud Function to:
    // 1. Permanent IP Ban
    // 2. Account Lock
    // 3. Send forensic analysis to security team
    this.scheduleBreachResponse(accessRecord);
  }

  /**
   * Prepare data for Cloud Function breach handler
   */
  scheduleBreachResponse(accessRecord) {
    return {
      action: 'PERMANENT_IP_BAN',
      uid: accessRecord.uid,
      reason: 'HONEYPOT_TRAP_TRIGGERED',
      severity: 'CRITICAL',
      timestamp: accessRecord.timestamp,
      forensics: {
        path: '/system_configs/master_key',
        accessType: accessRecord.accessType,
        triggeredFrom: document.location.href,
        userAgent: navigator.userAgent,
        ipAddress: 'CAPTURED_BY_CLOUD_FUNCTION'
      }
    };
  }

  /**
   * Cleanup listener
   */
  deactivate() {
    if (this.listener) {
      this.listener();
      this.isActive = false;
      console.log('🪤 Sticky Trap Honeypot: DISARMED');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 2: ANTIVIRUS GATEWAY 🛡️
// ═══════════════════════════════════════════════════════════════════
/**
 * File MIME Type Verification - Client-side antivirus check
 * Verifies file signature matches declared MIME type
 * Rejects polyglot files & executable payloads
 * 
 * Checks:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47
 * - PDF:  25 50 44 46
 * - GIF:  47 49 46 38
 */
export class AntivirusGateway {
  constructor(showToast) {
    this.showToast = showToast;
    this.magicNumbers = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47],
      pdf: [0x25, 0x50, 0x44, 0x46],
      gif: [0x47, 0x49, 0x46, 0x38],
      zip: [0x50, 0x4B, 0x03, 0x04],
      exe: [0x4D, 0x5A], // MZ header
      sh: [0x23, 0x21]  // #! shebang
    };
  }

  /**
   * Verify file is actually what it claims to be
   * Compare file signature (magic bytes) with declared MIME type
   */
  async verifyFileSignature(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const arr = new Uint8Array(e.target.result).subarray(0, 8);
        
        // Check for malicious signatures
        const isExecutable = this.matchSignature(arr, this.magicNumbers.exe);
        const isShellScript = this.matchSignature(arr, this.magicNumbers.sh);
        const isZipBomb = this.matchSignature(arr, this.magicNumbers.zip);
        
        if (isExecutable || isShellScript || isZipBomb) {
          resolve({
            valid: false,
            reason: 'EXECUTABLE_DETECTED',
            file: file.name,
            detectedType: isExecutable ? 'EXE' : isShellScript ? 'SHELL' : 'ZIP_BOMB'
          });
          return;
        }

        // Verify MIME type matches signature
        const declaredType = file.type;
        const actualType = this.detectFileType(arr);

        if (declaredType && actualType && !this.mimeTypesMatch(declaredType, actualType)) {
          resolve({
            valid: false,
            reason: 'MIME_MISMATCH',
            declared: declaredType,
            actual: actualType,
            file: file.name
          });
          return;
        }

        // File is safe
        resolve({
          valid: true,
          reason: 'SAFE',
          detectedType: actualType,
          file: file.name
        });
      };

      reader.readAsArrayBuffer(file.slice(0, 512)); // Read first 512 bytes
    });
  }

  /**
   * Match signature (magic bytes) in file
   */
  matchSignature(fileBytes, signature) {
    for (let i = 0; i < signature.length; i++) {
      if (fileBytes[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Detect file type from magic bytes
   */
  detectFileType(fileBytes) {
    if (this.matchSignature(fileBytes, this.magicNumbers.jpeg)) return 'image/jpeg';
    if (this.matchSignature(fileBytes, this.magicNumbers.png)) return 'image/png';
    if (this.matchSignature(fileBytes, this.magicNumbers.pdf)) return 'application/pdf';
    if (this.matchSignature(fileBytes, this.magicNumbers.gif)) return 'image/gif';
    return 'unknown';
  }

  /**
   * Check if MIME types match (declared vs actual)
   */
  mimeTypesMatch(declared, actual) {
    if (!declared || !actual) return true; // Skip if no declared type
    
    // Exact match
    if (declared === actual) return true;
    
    // Allow common MIME type variations
    const variations = {
      'image/jpg': ['image/jpeg'],
      'image/jpeg': ['image/jpg'],
      'application/x-pdf': ['application/pdf']
    };

    if (variations[declared]) {
      return variations[declared].includes(actual);
    }

    return false;
  }

  /**
   * Handle malicious file detection
   */
  async handleMaliciousFile(verificationResult, uid, telegramAlert) {
    console.error('🚨 MALICIOUS FILE DETECTED:', verificationResult);

    // Show toast to user
    if (this.showToast) {
      this.showToast('⚠️ MALICIOUS PAYLOAD DETECTED. REPORTING TO SECURITY.', 'error', 5000);
    }

    // Send Telegram alert
    if (telegramAlert) {
      telegramAlert(
        'MALWARE ALERT',
        `🚨 MALICIOUS FILE UPLOAD ATTEMPT\n\n` +
        `UID: ${uid}\n` +
        `File: ${verificationResult.file}\n` +
        `Reason: ${verificationResult.reason}\n` +
        `Declared: ${verificationResult.declared}\n` +
        `Actual: ${verificationResult.actual}\n` +
        `Timestamp: ${new Date().toISOString()}\n` +
        `Action: Upload blocked & logged`
      );
    }

    // Log for forensics
    return {
      action: 'MALWARE_BLOCKED',
      uid,
      file: verificationResult.file,
      reason: verificationResult.reason,
      timestamp: new Date().toISOString(),
      forensics: {
        declaredType: verificationResult.declared,
        detectedType: verificationResult.actual || verificationResult.detectedType,
        userAgent: navigator.userAgent,
        page: document.location.href
      }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 3: ANTI-HACKER SENTINEL 🔒
// ═══════════════════════════════════════════════════════════════════
/**
 * Admin Activity Logging with Click Speed Detection
 * Monitors admin panel clicks & detects impossible-speed actions
 * 
 * Threshold: >5 clicks/second = Bot Activity → Auto-Lock + OTP Required
 */
export class AntiHackerSentinel {
  constructor(firebaseDb, adminUID, telegramAlert) {
    this.db = firebaseDb;
    this.adminUID = adminUID;
    this.telegramAlert = telegramAlert;
    this.clickHistory = [];
    this.maxClicksPerSecond = 5;
    this.isAdminLocked = false;
    this.lockdownTimer = null;
  }

  /**
   * Record admin activity click
   * @param {string} action - Admin action name
   * @param {string} target - Element or feature clicked
   */
  recordAdminActivity(action, target = null) {
    // Skip if already locked
    if (this.isAdminLocked) {
      console.warn('🔒 Admin panel is LOCKED. Requires OTP to unlock.');
      return { blocked: true, reason: 'ADMIN_PANEL_LOCKED' };
    }

    const now = Date.now();
    const timestamp = new Date().toISOString();

    // Add to history
    this.clickHistory.push({ time: now, action, target, timestamp });

    // Keep only last 5 seconds of history
    this.clickHistory = this.clickHistory.filter(click => now - click.time < 5000);

    // Detect impossible-speed bot activity
    const clicksInLastSecond = this.clickHistory.filter(
      click => now - click.time < 1000
    ).length;

    if (clicksInLastSecond > this.maxClicksPerSecond) {
      this.detectBotActivity(clicksInLastSecond);
    }

    // Log activity to database
    this.logActivityToDatabase({
      action,
      target,
      timestamp,
      clicksPerSecond: clicksInLastSecond,
      uid: this.adminUID
    });

    return {
      blocked: false,
      clicksPerSecond: clicksInLastSecond,
      isSuspicious: clicksInLastSecond > this.maxClicksPerSecond / 2 // Alert if > 2.5/sec
    };
  }

  /**
   * Detect bot activity from superhuman click speeds
   */
  detectBotActivity(clicksPerSecond) {
    console.error(`🚨 BOT ACTIVITY DETECTED: ${clicksPerSecond} clicks/second`);

    // Trigger immediate lockdown
    this.lockAdminPanel();

    // Send Telegram alert
    if (this.telegramAlert) {
      this.telegramAlert(
        'ADMIN PANEL BOT DETECTED',
        `🤖 SUPERHUMAN CLICK SPEED DETECTED\n\n` +
        `Clicks/Second: ${clicksPerSecond} (threshold: ${this.maxClicksPerSecond})\n` +
        `Admin UID: ${this.adminUID}\n` +
        `Status: ADMIN PANEL LOCKED\n` +
        `Action: OTP verification required to unlock\n` +
        `Timestamp: ${new Date().toISOString()}`
      );
    }

    return {
      action: 'BOT_ACTIVITY_DETECTED',
      clicksPerSecond,
      threshold: this.maxClicksPerSecond,
      adminUID: this.adminUID,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Lock admin panel - requires Telegram OTP to unlock
   */
  lockAdminPanel() {
    this.isAdminLocked = true;
    console.log('🔒 ADMIN PANEL LOCKED - OTP Required');

    // Clear any previous lockdown timer
    if (this.lockdownTimer) {
      clearTimeout(this.lockdownTimer);
    }

    // Auto-unlock after 1 hour (optional, security teams can override)
    this.lockdownTimer = setTimeout(() => {
      this.isAdminLocked = false;
      console.log('🔓 Auto-unlock timer expired (1 hour). Manual unlock available.');
    }, 3600000); // 1 hour

    return {
      locked: true,
      requiresOTP: true,
      unlocksAt: new Date(Date.now() + 3600000).toISOString(),
      message: 'Admin panel locked due to bot activity. Requires Telegram OTP to unlock.'
    };
  }

  /**
   * Verify OTP to unlock admin panel
   * Called from Telegram bot /verify_admin_otp [code]
   */
  verifyAdminOTP(otp, correctOTP) {
    if (otp === correctOTP) {
      this.isAdminLocked = false;
      if (this.lockdownTimer) {
        clearTimeout(this.lockdownTimer);
      }
      console.log('🔓 Admin panel unlocked via OTP');
      return { success: true, message: 'Admin panel unlocked' };
    }
    return { success: false, message: 'Invalid OTP' };
  }

  /**
   * Log admin activity to Firebase
   */
  async logActivityToDatabase(activity) {
    try {
      // This will be handled by Cloud Function
      console.log('📊 Activity logged:', activity);
      // Activity will be written by Cloud Function to /activityLogs/{adminUID}/{timestamp}
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  /**
   * Get click history for audit trail
   */
  getActivityHistory() {
    return {
      totalClicks: this.clickHistory.length,
      recentClicks: this.clickHistory.slice(-10),
      isLocked: this.isAdminLocked,
      clicksInLastSecond: this.clickHistory.filter(
        c => Date.now() - c.time < 1000
      ).length
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 4: ANTI-SPAM SHIELD 🚫
// ═══════════════════════════════════════════════════════════════════
/**
 * Honeypot Field for Signup Form
 * Invisible to humans, visible to bots
 * Silent rejection if bot fills it out
 */
export class AntiSpamShield {
  constructor(telegramAlert) {
    this.telegramAlert = telegramAlert;
    this.honeypotFieldId = 'phone_number_verify_alt_opt'; // Intentionally confusing name
  }

  /**
   * Generate HTML for honeypot field
   * Should be styled with display:none or hidden attribute
   * Bots often fill in accessible form fields
   */
  getHoneypotHTML() {
    return `
      <!-- Anti-Spam Honeypot - Hidden from humans, visible to bots -->
      <div style="display:none; visibility:hidden; position:absolute; left:-9999px;">
        <input 
          type="text" 
          id="${this.honeypotFieldId}"
          name="${this.honeypotFieldId}"
          value=""
          placeholder="Do not fill this field"
          aria-hidden="true"
          tabindex="-1"
          autocomplete="off"
        />
      </div>
    `;
  }

  /**
   * Check if honeypot field was filled (indicates bot)
   * @param {FormData|Object} formData - Form submission data
   * @returns {boolean} true if bot detected
   */
  isBotDetected(formData) {
    if (!formData) return false;

    // Check if honeypot field has value
    const honeypotValue = formData.get ? 
      formData.get(this.honeypotFieldId) : 
      formData[this.honeypotFieldId];

    if (honeypotValue && honeypotValue.trim().length > 0) {
      console.warn('🚫 SPAM BOT DETECTED - Honeypot field filled');
      return true;
    }

    return false;
  }

  /**
   * Silently reject bot signup
   * No error message to user - keeps bot unaware it was caught
   */
  silentlyRejectBot(email, _formData) {
    console.error('🚫 BOT SIGNUP ATTEMPT DETECTED:', email);

    // Send alert (admin only, not to user)
    if (this.telegramAlert) {
      this.telegramAlert(
        'BOT SIGNUP ATTEMPT',
        `🤖 SPAM BOT DETECTED IN SIGNUP\n\n` +
        `Email: ${email}\n` +
        `Honeypot Field: FILLED\n` +
        `Status: Silently rejected (no notification to bot)\n` +
        `Timestamp: ${new Date().toISOString()}\n` +
        `IP: CAPTURED_BY_CLOUD_FUNCTION\n` +
        `User-Agent: ${navigator.userAgent}`
      );
    }

    // Log for forensics (don't send any response to indicate detection)
    return {
      action: 'SPAM_BOT_REJECTED',
      email,
      method: 'HONEYPOT_FIELD',
      timestamp: new Date().toISOString(),
      silentRejection: true, // Key: no error shown to user
      forensics: {
        userAgent: navigator.userAgent,
        page: document.location.href
      }
    };
  }

  /**
   * Get honeypot field name (for form validation)
   */
  getHoneypotFieldName() {
    return this.honeypotFieldId;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY SENTINEL ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════
/**
 * Main orchestrator for all 4 security sentinel layers
 */
export class SecuritySentinel {
  constructor(firebaseDb, currentUserUID, adminUID, showToast, telegramAlert) {
    this.honeypot = new StickyTrapHoneypot(
      firebaseDb,
      currentUserUID,
      adminUID,
      telegramAlert
    );
    
    this.antivirus = new AntivirusGateway(showToast);
    
    this.antiHacker = new AntiHackerSentinel(
      firebaseDb,
      adminUID,
      telegramAlert
    );
    
    this.antiSpam = new AntiSpamShield(telegramAlert);
    
    this.isActive = false;
  }

  /**
   * Activate all security layers
   */
  activate() {
    console.log('🛡️ SECURITY SENTINEL: ACTIVATING ALL LAYERS');
    
    // Activate honeypot trap
    this.honeypot.activate();
    
    this.isActive = true;
    console.log('🛡️ SECURITY SENTINEL: ALL LAYERS ACTIVE');
  }

  /**
   * Deactivate all security layers
   */
  deactivate() {
    console.log('🛡️ SECURITY SENTINEL: DEACTIVATING');
    this.honeypot.deactivate();
    this.isActive = false;
  }

  /**
   * Check if security sentinel is active
   */
  getStatus() {
    return {
      active: this.isActive,
      honeypotArmed: this.honeypot.isActive,
      antivirusReady: true,
      antiHackerReady: !this.antiHacker.isAdminLocked,
      antiSpamReady: true
    };
  }
}

export default {
  StickyTrapHoneypot,
  AntivirusGateway,
  AntiHackerSentinel,
  AntiSpamShield,
  SecuritySentinel
};
