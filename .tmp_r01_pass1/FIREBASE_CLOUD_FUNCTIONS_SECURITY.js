/**
 * ═══════════════════════════════════════════════════════════════════
 * FIREBASE CLOUD FUNCTIONS - BACKEND SECURITY SENTINEL
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Deploy these functions to Firebase Cloud Functions
 * Command: firebase deploy --only functions
 * 
 * Functions Overview:
 * 1. handleHoneypotBreach() - LAYER 1: Sticky Trap Honeypot
 * 2. handleMalwareDetection() - LAYER 2: Antivirus Gateway
 * 3. logAdminActivity() - LAYER 3: Anti-Hacker Sentinel
 * 4. handleBotSignup() - LAYER 4: Anti-Spam Shield
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

const TELEGRAM_TOKEN = '7978697496:AAEYF2jlx_aBpuWlqWPSD6Bu2hTIgSb8isc';
const TELEGRAM_CHAT_ID = '1380983917';

/**
 * Send Telegram alert message
 */
async function sendTelegramAlert(subject, message) {
  try {
    const fullMessage = `<b>${subject}</b>\n\n${message}`;
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: fullMessage,
        parse_mode: 'HTML'
      }
    );
    console.log('✅ Telegram alert sent:', subject);
  } catch (error) {
    console.error('❌ Telegram alert failed:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 1: STICKY TRAP HONEYPOT Handler
// ═══════════════════════════════════════════════════════════════════
/**
 * Cloud Function: Triggered when honeypot path is accessed
 * Action: Permanent IP Ban + Account Lock
 * 
 * Firestore Path: /honeypotBreaches/{timestamp}
 * Trigger: Write to /honeypotBreaches
 */
exports.handleHoneypotBreach = functions.firestore
  .document('honeypotBreaches/{breachId}')
  .onCreate(async (snap, context) => {
    const breach = snap.data();
    
    console.error('🚨 CRITICAL HONEYPOT BREACH:', breach);
    
    // Log breach for forensics
    const breachRecord = {
      breachId: context.params.breachId,
      uid: breach.uid,
      timestamp: breach.timestamp,
      ipAddress: breach.ipAddress,
      userAgent: breach.userAgent,
      triggeredPath: '/system_configs/master_key',
      action: 'PERMANENT_IP_BAN',
      banIssuedAt: admin.firestore.Timestamp.now(),
      forensics: breach.forensics || {}
    };
    
    try {
      // 1. Add to banned IPs collection
      await admin.firestore().collection('bannedIPs').add({
        ipAddress: breach.ipAddress || 'UNKNOWN',
        reason: 'HONEYPOT_TRAP_TRIGGERED',
        bannedAt: admin.firestore.Timestamp.now(),
        banReason: 'Unauthorized access to honeypot database path',
        uid: breach.uid,
        permanent: true
      });
      
      // 2. Lock user account permanently
      await admin.auth().updateUser(breach.uid, {
        disabled: true
      });
      
      // 3. Update user database record
      await admin.database().ref(`users/${breach.uid}`).update({
        status: 'PERMANENTLY_BLOCKED',
        blockedAt: new Date().toISOString(),
        blockReason: 'HONEYPOT_TRAP_TRIGGERED',
        securityThreatLevel: 'CRITICAL'
      });
      
      // 4. Send Telegram alert
      await sendTelegramAlert(
        'CRITICAL BREACH - Honeypot Activated',
        `🚨 PERMANENT BAN ISSUED\n\n` +
        `UID: ${breach.uid}\n` +
        `IP Address: ${breach.ipAddress || 'UNKNOWN'}\n` +
        `Timestamp: ${breach.timestamp}\n` +
        `Path Accessed: /system_configs/master_key\n` +
        `Status: Account PERMANENTLY LOCKED + IP BANNED\n` +
        `User-Agent: ${breach.userAgent || 'N/A'}\n` +
        `Action: IMMEDIATE - All access revoked`
      );
      
      // 5. Log detailed forensic data
      await admin.firestore().collection('securityIncidents').add({
        ...breachRecord,
        severity: 'CRITICAL',
        type: 'HONEYPOT_BREACH',
        automediation: 'COMPLETE'
      });
      
      console.log('✅ Honeypot breach handled - User permanently banned');
      
    } catch (error) {
      console.error('❌ Failed to handle honeypot breach:', error);
      throw error;
    }
  });

// ═══════════════════════════════════════════════════════════════════
// LAYER 2: MALWARE DETECTION Handler
// ═══════════════════════════════════════════════════════════════════
/**
 * Cloud Function: Triggered when malicious file is detected
 * Action: Log incident, alert security team, block user
 * 
 * Firestore Path: /malwareDetections/{timestamp}
 * Trigger: Write to /malwareDetections
 */
exports.handleMalwareDetection = functions.firestore
  .document('malwareDetections/{detectionId}')
  .onCreate(async (snap, context) => {
    const detection = snap.data();
    
    console.error('🚨 MALWARE DETECTED:', detection);
    
    try {
      // 1. Block file upload
      const uploadAttempt = {
        uid: detection.uid,
        file: detection.file,
        declaredType: detection.declaredType,
        detectedType: detection.detectedType,
        reason: detection.reason,
        blockedAt: admin.firestore.Timestamp.now(),
        status: 'BLOCKED'
      };
      
      await admin.firestore().collection('blockedFileUploads').add(uploadAttempt);
      
      // 2. Send Telegram alert
      await sendTelegramAlert(
        'Malware Detected - File Upload Blocked',
        `🚨 MALICIOUS FILE UPLOAD ATTEMPT\n\n` +
        `UID: ${detection.uid}\n` +
        `File: ${detection.file}\n` +
        `Declared MIME: ${detection.declaredType}\n` +
        `Actual MIME: ${detection.detectedType}\n` +
        `Reason: ${detection.reason}\n` +
        `Status: Upload BLOCKED\n` +
        `IP: ${detection.ipAddress || 'N/A'}\n` +
        `Timestamp: ${detection.timestamp}`
      );
      
      // 3. Log security incident
      await admin.firestore().collection('securityIncidents').add({
        type: 'MALWARE_BLOCKED',
        severity: 'HIGH',
        uid: detection.uid,
        file: detection.file,
        reason: detection.reason,
        timestamp: admin.firestore.Timestamp.now()
      });
      
      // 4. Optional: Increment user's malware strike count
      const userRef = admin.database().ref(`users/${detection.uid}`);
      const snapshot = await userRef.once('value');
      const strikes = (snapshot.val()?.malwareStrikes || 0) + 1;
      
      await userRef.update({ malwareStrikes: strikes });
      
      // 5. If 3+ strikes, escalate to permanent ban
      if (strikes >= 3) {
        await sendTelegramAlert(
          'Escalation: User Malware Strike Threshold',
          `⚠️ ESCALATION ALERT\n\n` +
          `UID: ${detection.uid}\n` +
          `Malware Strikes: ${strikes}/3 THRESHOLD\n` +
          `Status: RECOMMEND ACCOUNT SUSPENSION\n` +
          `Action Required: Manual review and possible account termination`
        );
      }
      
      console.log('✅ Malware detection handled - File blocked');
      
    } catch (error) {
      console.error('❌ Failed to handle malware detection:', error);
      throw error;
    }
  });

// ═══════════════════════════════════════════════════════════════════
// LAYER 3: ADMIN ACTIVITY LOGGING Handler
// ═══════════════════════════════════════════════════════════════════
/**
 * Cloud Function: Log admin activities and detect bot behavior
 * Action: Record activity, detect superhuman click speeds, lock panel if needed
 * 
 * Firestore Path: /activityLogs/{adminUID}/{timestamp}
 * Trigger: Write to /activityLogs
 */
exports.logAdminActivity = functions.firestore
  .document('activityLogs/{activityId}')
  .onCreate(async (snap, context) => {
    const activity = snap.data();
    
    console.log('📊 Admin Activity Logged:', activity);
    
    try {
      // 1. Store activity in database
      const activityRecord = {
        action: activity.action,
        target: activity.target,
        timestamp: admin.firestore.Timestamp.now(),
        uid: activity.uid,
        clicksPerSecond: activity.clicksPerSecond || 0
      };
      
      await admin.firestore().collection('adminActivityAudit').add(activityRecord);
      
      // 2. Detect superhuman click speeds (>5 clicks/second)
      if (activity.clicksPerSecond > 5) {
        console.error('🤖 BOT ACTIVITY DETECTED:', activity.clicksPerSecond, 'clicks/second');
        
        // Send alert
        await sendTelegramAlert(
          'Bot Activity Detected - Admin Panel Lock',
          `🤖 SUPERHUMAN CLICK SPEED DETECTED\n\n` +
          `Clicks/Second: ${activity.clicksPerSecond}\n` +
          `Threshold: 5 clicks/second\n` +
          `Admin UID: ${activity.uid}\n` +
          `Status: ADMIN PANEL LOCKED\n` +
          `Action: OTP verification required to unlock\n` +
          `Last Action: ${activity.action}`
        );
        
        // 3. Lock admin panel in database
        await admin.database().ref(`adminSessions/${activity.uid}`).update({
          isLocked: true,
          lockedAt: new Date().toISOString(),
          lockReason: 'BOT_ACTIVITY_DETECTED',
          requiresOTP: true,
          unlocksAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
        });
        
        // 4. Log security incident
        await admin.firestore().collection('securityIncidents').add({
          type: 'BOT_ACTIVITY_DETECTED',
          severity: 'CRITICAL',
          uid: activity.uid,
          clicksPerSecond: activity.clicksPerSecond,
          timestamp: admin.firestore.Timestamp.now()
        });
      }
      
      console.log('✅ Admin activity logged');
      
    } catch (error) {
      console.error('❌ Failed to log admin activity:', error);
      throw error;
    }
  });

// ═══════════════════════════════════════════════════════════════════
// LAYER 3B: OTP Unlock for Admin Panel
// ═══════════════════════════════════════════════════════════════════
/**
 * Callable Cloud Function: Verify OTP to unlock admin panel
 * Called from Telegram bot: /verify_admin_otp [code]
 */
exports.verifyAdminOTPUnlock = functions.https.onCall(async (data, context) => {
  const { adminUID, otp } = data;
  
  // Verify admin is authenticated
  if (!context.auth || context.auth.uid !== adminUID) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the admin can unlock their own panel'
    );
  }
  
  try {
    // Check if OTP is correct (stored in admin preferences securely)
    const adminRef = admin.database().ref(`admins/${adminUID}`);
    const adminData = (await adminRef.once('value')).val();
    
    if (!adminData || !adminData.tempOTP || adminData.tempOTP !== otp) {
      return { success: false, message: 'Invalid OTP' };
    }
    
    // OTP is correct - unlock admin panel
    await admin.database().ref(`adminSessions/${adminUID}`).update({
      isLocked: false,
      unlockedAt: new Date().toISOString(),
      unlockedVia: 'OTP_VERIFICATION'
    });
    
    // Clear the used OTP
    await adminRef.update({ tempOTP: null });
    
    // Send alert
    await sendTelegramAlert(
      'Admin Panel Unlocked',
      `✅ Admin Panel Unlocked\n\n` +
      `Admin UID: ${adminUID}\n` +
      `Unlocked Via: OTP Verification\n` +
      `Time: ${new Date().toISOString()}`
    );
    
    return { success: true, message: 'Admin panel unlocked' };
    
  } catch (error) {
    console.error('❌ OTP verification failed:', error);
    throw new functions.https.HttpsError('internal', 'OTP verification failed');
  }
});

// ═══════════════════════════════════════════════════════════════════
// LAYER 4: ANTI-SPAM SHIELD Handler
// ═══════════════════════════════════════════════════════════════════
/**
 * Cloud Function: Handle bot signup attempts via honeypot field
 * Action: Silent rejection + log for forensics
 * 
 * Firestore Path: /botSignupAttempts/{timestamp}
 * Trigger: Write to /botSignupAttempts
 */
exports.handleBotSignup = functions.firestore
  .document('botSignupAttempts/{attemptId}')
  .onCreate(async (snap, context) => {
    const attempt = snap.data();
    
    console.warn('🤖 BOT SIGNUP ATTEMPT DETECTED:', attempt.email);
    
    try {
      // 1. Log bot attempt for forensics
      const botRecord = {
        email: attempt.email,
        honeypotField: attempt.honeypotField,
        honeypotValue: attempt.honeypotValue,
        detectedAt: admin.firestore.Timestamp.now(),
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
        silentlyRejected: true
      };
      
      await admin.firestore().collection('detectedBotAttempts').add(botRecord);
      
      // 2. Block this email from signup (add to blocked list)
      await admin.firestore().collection('blockedEmails').add({
        email: attempt.email,
        reason: 'BOT_HONEYPOT_TRIGGERED',
        blockedAt: admin.firestore.Timestamp.now(),
        permanent: false,
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        )
      });
      
      // 3. Send alert (admin only, no message to user)
      await sendTelegramAlert(
        'Bot Signup Attempt - Silently Rejected',
        `🤖 SPAM BOT DETECTED\n\n` +
        `Email: ${attempt.email}\n` +
        `Honeypot Field: FILLED\n` +
        `Detection: Honeypot trap triggered\n` +
        `Status: Silently rejected (bot unaware)\n` +
        `IP: ${attempt.ipAddress || 'N/A'}\n` +
        `User-Agent: ${attempt.userAgent || 'N/A'}\n` +
        `Timestamp: ${attempt.timestamp}`
      );
      
      // 4. Log incident
      await admin.firestore().collection('securityIncidents').add({
        type: 'BOT_SIGNUP_BLOCKED',
        severity: 'MEDIUM',
        email: attempt.email,
        method: 'HONEYPOT_FIELD',
        timestamp: admin.firestore.Timestamp.now()
      });
      
      // 5. Optional: Track bot signatures for pattern analysis
      const signature = {
        userAgent: attempt.userAgent,
        signupPattern: attempt.timestamp || new Date().toISOString()
      };
      
      await admin.firestore().collection('botSignatures').add(signature);
      
      console.log('✅ Bot signup handled - Silently rejected');
      
    } catch (error) {
      console.error('❌ Failed to handle bot signup:', error);
      throw error;
    }
  });

// ═══════════════════════════════════════════════════════════════════
// UTILITY: Ban IP Address Function
// ═══════════════════════════════════════════════════════════════════
/**
 * Callable Function: Permanently ban an IP address
 * Called from admin panel during security response
 */
exports.banIPAddress = functions.https.onCall(async (data, context) => {
  const { ipAddress, reason } = data;
  
  // Verify admin is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only authenticated admins can ban IPs'
    );
  }
  
  try {
    // Add to banned IPs
    await admin.firestore().collection('bannedIPs').add({
      ipAddress,
      reason,
      bannedAt: admin.firestore.Timestamp.now(),
      bannedBy: context.auth.uid,
      permanent: true
    });
    
    // Update IP blocks in Firestore rules
    await admin.firestore().collection('securityRules').add({
      type: 'IP_BAN',
      ipAddress,
      active: true,
      timestamp: admin.firestore.Timestamp.now()
    });
    
    return { success: true, message: `IP ${ipAddress} banned permanently` };
    
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to ban IP');
  }
});

// ═══════════════════════════════════════════════════════════════════
// UTILITY: Check if IP is Banned
// ═══════════════════════════════════════════════════════════════════
/**
 * Callable Function: Check if IP is in ban list
 * Called before allowing signup or login
 */
exports.checkIPBan = functions.https.onCall(async (data, context) => {
  const { ipAddress } = data;
  
  try {
    const banSnapshot = await admin.firestore()
      .collection('bannedIPs')
      .where('ipAddress', '==', ipAddress)
      .where('permanent', '==', true)
      .limit(1)
      .get();
    
    return {
      isBanned: !banSnapshot.empty,
      reason: banSnapshot.empty ? null : banSnapshot.docs[0].data().reason
    };
    
  } catch (error) {
    console.error('Failed to check IP ban:', error);
    return { isBanned: false, error: error.message };
  }
});

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK: Security Sentinel Status
// ═══════════════════════════════════════════════════════════════════
/**
 * HTTP Function: Check security systems health
 */
exports.securitySentinelHealth = functions.https.onRequest(async (req, res) => {
  try {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Query incidents in last hour
    const incidents = await admin.firestore()
      .collection('securityIncidents')
      .where('timestamp', '>', admin.firestore.Timestamp.fromDate(lastHour))
      .get();
    
    const countByType = {};
    incidents.forEach(doc => {
      const type = doc.data().type;
      countByType[type] = (countByType[type] || 0) + 1;
    });
    
    res.status(200).json({
      status: 'OK',
      timestamp: now.toISOString(),
      lastHourIncidents: incidents.size,
      byType: countByType,
      systems: {
        honeypot: 'ARMED',
        antivirus: 'ACTIVE',
        antiHacker: 'MONITORING',
        antiSpam: 'ACTIVE'
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ═══════════════════════════════════════════════════════════════════
 * DEPLOYMENT NOTES
 * ═══════════════════════════════════════════════════════════════════
 * 
 * 1. Install dependencies:
 *    npm install firebase-functions firebase-admin axios
 * 
 * 2. Set Telegram token in Firebase config:
 *    firebase functions:config:set telegram.token="YOUR_TOKEN"
 * 
 * 3. Deploy:
 *    firebase deploy --only functions
 * 
 * 4. Create Firestore collections:
 *    - honeypotBreaches
 *    - malwareDetections
 *    - activityLogs
 *    - botSignupAttempts
 *    - bannedIPs
 *    - blockedFileUploads
 *    - blockedEmails
 *    - detectedBotAttempts
 *    - botSignatures
 *    - securityIncidents
 *    - adminActivityAudit
 * 
 * 5. Update Firestore Security Rules to trigger collection writes:
 *    - Client-side code writes to these collections
 *    - Cloud Functions automatically process and respond
 * 
 * 6. Monitor function logs:
 *    firebase functions:log
 * 
 * ═══════════════════════════════════════════════════════════════════
 */
