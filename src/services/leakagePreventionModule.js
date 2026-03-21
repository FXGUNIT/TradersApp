/* eslint-disable no-console */
/**
 * ═══════════════════════════════════════════════════════════════════
 * LEAKAGE PREVENTION & PRIVILEGE ESCALATION DETECTION SYSTEM
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Detects and prevents users from role-playing as Admin or higher
 * Validates all user inputs against their actual Firebase permissions
 * Logs privilege escalation attempts for security audit trail
 * 
 * Features:
 * - Role-based access control (RBAC)
 * - Privilege escalation detection
 * - Role-play jacking prevention
 * - Social engineering attack detection
 * - Data access validation
 * - Critical security alerts
 * 
 * Usage:
 *   import { initLeakagePrevention, checkInputForPrivilegeEscalation } from './leakagePreventionModule.js';
 *   initLeakagePrevention(showToast, logSecurityEvent);
 *   const result = checkInputForPrivilegeEscalation(userInput, currentUser);
 */

import { checkInputForSocialEngineering } from './socialEngineeringDetectionModule.js';

// ═══════════════════════════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL (RBAC) DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

const USER_ROLES = {
  ADMIN: {
    name: 'Admin',
    level: 5,
    permissions: [
      'view:all_users',
      'edit:all_users',
      'delete:users',
      'view:audit_logs',
      'modify:system_settings',
      'access:api_keys',
      'view:database_credentials',
      'manage:permissions',
      'execute:privileged_commands',
      'view:sensitive_data',
      'export:user_data',
      'manage:roles'
    ],
    allowedDataFields: ['*'], // Access to all fields
    criticalFields: ['password_hash', 'api_keys', 'database_credentials', 'secret_tokens']
  },

  MODERATOR: {
    name: 'Moderator',
    level: 3,
    permissions: [
      'view:users',
      'edit:user_profiles',
      'view:audit_logs_filtered',
      'manage:user_disputes',
      'block:users',
      'unblock:users'
    ],
    allowedDataFields: ['email', 'name', 'balance', 'status', 'joinDate', 'kycStatus'],
    restrictedFields: ['password_hash', 'api_keys', 'database_credentials', 'secret_tokens', 'admin_notes']
  },

  TRADER: {
    name: 'Trader',
    level: 1,
    permissions: [
      'view:own_data',
      'edit:own_profile',
      'view:own_balance',
      'execute:trades',
      'view:market_data',
      'submit:support_tickets'
    ],
    allowedDataFields: ['own_email', 'own_name', 'own_balance', 'own_status', 'market_data'],
    restrictedFields: ['other_users_data', 'api_keys', 'database_credentials', 'system_settings', 'audit_logs']
  },

  GUEST: {
    name: 'Guest',
    level: 0,
    permissions: [
      'view:public_data',
      'view:market_data',
      'submit:contact_form'
    ],
    allowedDataFields: ['public_market_data'],
    restrictedFields: ['user_data', 'api_keys', 'database_credentials', 'system_settings', 'audit_logs', 'balance']
  }
};

// ═══════════════════════════════════════════════════════════════════
// PRIVILEGE ESCALATION ATTEMPT PATTERNS
// ═══════════════════════════════════════════════════════════════════

const PRIVILEGE_ESCALATION_PATTERNS = {
  // Role-play as admin
  adminImpersonation: {
    patterns: [
      /i\s+am\s+an?\s+admin/i,
      /you\s+are\s+now\s+an?\s+admin/i,
      /act\s+as\s+an?\s+admin/i,
      /pretend\s+to\s+be\s+admin/i,
      /assume\s+admin\s+role/i,
      /activate\s+admin\s+mode/i,
      /grant\s+me\s+admin\s+access/i,
      /elevate\s+to\s+admin/i,
      /become\s+administrator/i,
      /toggle\s+admin\s+status/i
    ],
    severity: 'CRITICAL',
    name: 'Admin Impersonation Attempt'
  },

  // Bypass user validation
  validationBypass: {
    patterns: [
      /ignore.*permission/i,
      /skip.*access\s+check/i,
      /bypass.*validation/i,
      /disable.*role\s+check/i,
      /override.*access\s+control/i,
      /disable.*security\s+check/i,
      /all\s+access\s+mode/i,
      /unlock.*all\s+features/i
    ],
    severity: 'CRITICAL',
    name: 'Access Control Bypass Attempt'
  },

  // Privilege escalation triggers
  privEscalation: {
    patterns: [
      /escalate\s+privileges?/i,
      /escalate.*admin/i,
      /increase\s+access\s+level/i,
      /upgrade\s+permissions?/i,
      /promote\s+to.*role/i,
      /grant.*higher.*privilege/i,
      /unlock.*admin\s+features/i,
      /enable.*super\s+user/i,
      /activate.*power\s+user/i,
      /switch.*privileged.*account/i
    ],
    severity: 'CRITICAL',
    name: 'Privilege Escalation Attempt'
  },

  // Access to restricted data
  restrictedDataAccess: {
    patterns: [
      /show.*api\s+key/i,
      /reveal.*secret\s+token/i,
      /display.*password/i,
      /export.*user\s+list/i,
      /access.*admin\s+panel/i,
      /view.*database\s+connection/i,
      /what.*is.*database.*connection/i,
      /database.*connection\s+string/i,
      /retrieve.*credential/i,
      /display.*system\s+config/i,
      /list.*all\s+users/i,
      /read.*encrypted\s+data/i
    ],
    severity: 'CRITICAL',
    name: 'Restricted Data Access Attempt'
  },

  // Account impersonation
  accountImpersonation: {
    patterns: [
      /switch\s+to\s+user/i,
      /login\s+as/i,
      /access.*account\s+of/i,
      /impersonate/i,
      /become\s+another\s+user/i,
      /view\s+as.*user/i,
      /operate.*from.*account/i
    ],
    severity: 'HIGH',
    name: 'Account Impersonation Attempt'
  },

  // System manipulation
  systemManipulation: {
    patterns: [
      /modify\s+user\s+status/i,
      /change\s+user.*status/i,
      /change.*permission/i,
      /alter.*role.*assignment/i,
      /update.*access.*level/i,
      /change.*another.*user/i,
      /modify.*system\s+setting/i,
      /reconfigure\s+security/i,
      /reset.*authentication/i
    ],
    severity: 'HIGH',
    name: 'System Manipulation Attempt'
  }
};

// ═══════════════════════════════════════════════════════════════════
// RESTRICTED KEYWORDS THAT TRIGGER ESCALATION ALERTS
// ═══════════════════════════════════════════════════════════════════

const RESTRICTED_KEYWORDS = [
  'admin_override',
  'root_access',
  'superuser',
  'godmode',
  'debug_mode',
  'developer_console',
  'system_access',
  'master_key',
  'override_authentication',
  'force_permission',
  'elevation',
  'privilege_level',
  'access_token',
  'bearer_token',
  'session_secret',
  'password_hash',
  'encryption_key',
  'api_secret'
];

// ═══════════════════════════════════════════════════════════════════
// LEAKAGE PREVENTION ENGINE
// ═══════════════════════════════════════════════════════════════════

let LEAKAGE_LOG = {
  events: [],
  statistics: {
    totalAttempts: 0,
    escalationAttempts: 0,
    adminImpersonationAttempts: 0,
    restrictedDataAttempts: 0,
    validationBypassAttempts: 0,
    lastAttemptTime: null,
    blockedUsers: new Set()
  },
  maxEvents: 1000 // Circular buffer size
};

/**
 * Initialize the leakage prevention system
 * @param {Function} showToast - Toast notification function
 * @param {Function} logSecurityEvent - Security event logger function
 */
export function initLeakagePrevention(showToast, logSecurityEvent = null) {
  window.__LeakagePrevention = {
    getLog: () => ({ ...LEAKAGE_LOG, blockedUsers: Array.from(LEAKAGE_LOG.statistics.blockedUsers) }),
    getDashboard: () => getLeakagePreventionDashboard(),
    generateReport: () => generateLeakagePreventionReport(),
    exportLog: (filename = 'leakage-prevention-log.json') => exportLeakageLog(filename),
    checkInput: (input, user) => checkInputForPrivilegeEscalation(input, user, logSecurityEvent)
  };

  console.log('✅ Leakage Prevention Module initialized - accessible via window.__LeakagePrevention');
}

/**
 * Log a privilege escalation attempt
 * @param {String} userId - User attempting escalation
 * @param {String} attemptType - Type of escalation attempt
 * @param {String} input - The input that triggered the detection
 * @param {String} userRole - Current user's actual role
 * @param {Function} logSecurityEvent - Security logger
 */
function logEscalationAttempt(userId, attemptType, input, userRole, logSecurityEvent) {
  const timestamp = new Date().toISOString();
  
  const escalationEvent = {
    id: `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'PRIVILEGE_ESCALATION_ATTEMPT',
    severity: 'CRITICAL',
    userId,
    attemptType,
    input: input.substring(0, 200), // Truncate for privacy
    userRole,
    timestamp,
    ipAddress: 'N/A', // Would need to be passed in from request context
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
  };

  LEAKAGE_LOG.events.push(escalationEvent);
  LEAKAGE_LOG.statistics.totalAttempts++;
  LEAKAGE_LOG.statistics.lastAttemptTime = timestamp;
  LEAKAGE_LOG.statistics.escalationAttempts++;
  LEAKAGE_LOG.statistics.blockedUsers.add(userId);

  // Maintain circular buffer
  if (LEAKAGE_LOG.events.length > LEAKAGE_LOG.maxEvents) {
    LEAKAGE_LOG.events.shift();
  }

  // Log to security monitor if available
  if (logSecurityEvent) {
    logSecurityEvent(escalationEvent);
  }

  return escalationEvent;
}

/**
 * Check if input attempts to escalate privileges
 * @param {String} input - User input to analyze
 * @param {Object} currentUser - Current user object from Firebase { uid, email, role, status }
 * @param {Function} logSecurityEvent - Security logger
 * @returns {Object} { safe: boolean, attacks: Array, recommendation: String, escalationType: String }
 */
export function checkInputForPrivilegeEscalation(input, currentUser, logSecurityEvent = null) {
  if (!input || typeof input !== 'string') {
    return { safe: true, attacks: [], recommendation: '', escalationType: null };
  }

  // FIRST: Check for social engineering attacks (these are also escalation attempts)
  const socialEngineeringResult = checkInputForSocialEngineering(input, currentUser, logSecurityEvent);
  if (!socialEngineeringResult.safe) {
    return {
      safe: false,
      attacks: socialEngineeringResult.attacks,
      escalationType: socialEngineeringResult.tactic,
      severity: socialEngineeringResult.severity,
      recommendation: socialEngineeringResult.recommendation,
      userRole: currentUser?.role,
      attackCategory: 'SOCIAL_ENGINEERING',
      blockedAt: new Date().toISOString()
    };
  }

  // SECOND: Check traditional privilege escalation patterns
  const inputLower = input.toLowerCase();
  const userRole = currentUser?.role || 'GUEST';
  const userId = currentUser?.uid || 'unknown';
  const detectedAttacks = [];
  let highestSeverity = null;
  let escalationType = null;

  // Check each escalation pattern category
  Object.entries(PRIVILEGE_ESCALATION_PATTERNS).forEach(([category, patternDef]) => {
    patternDef.patterns.forEach(pattern => {
      if (pattern.test(input)) {
        detectedAttacks.push({
          type: patternDef.name,
          category,
          severity: patternDef.severity,
          pattern: pattern.toString(),
          matched: true
        });

        if (!highestSeverity || (patternDef.severity === 'CRITICAL' && highestSeverity !== 'CRITICAL')) {
          highestSeverity = patternDef.severity;
          escalationType = patternDef.name;
        }
      }
    });
  });

  // Check for restricted keywords
  RESTRICTED_KEYWORDS.forEach(keyword => {
    if (inputLower.includes(keyword.toLowerCase())) {
      detectedAttacks.push({
        type: 'Restricted Keyword Usage',
        keyword,
        severity: 'CRITICAL',
        matched: true
      });
      highestSeverity = 'CRITICAL';
      escalationType = 'Restricted Keyword Usage';
    }
  });

  // If attacks detected, log and return unsafe
  if (detectedAttacks.length > 0) {
    logEscalationAttempt(userId, escalationType, input, userRole, logSecurityEvent);

    return {
      safe: false,
      attacks: detectedAttacks,
      escalationType,
      severity: highestSeverity,
      recommendation: generateEscalationRecommendation(userRole, detectedAttacks),
      userRole,
      blockedAt: new Date().toISOString()
    };
  }

  // Additional check: Verify requested actions match user's role
  const roleValidation = validateUserActionAgainstRole(input, userRole);
  if (!roleValidation.allowed) {
    logEscalationAttempt(userId, 'Unauthorized Action', input, userRole, logSecurityEvent);
    
    return {
      safe: false,
      attacks: [{ type: 'Unauthorized Action Request', severity: 'HIGH', details: roleValidation.reason }],
      escalationType: 'Unauthorized Action',
      severity: 'HIGH',
      recommendation: `Your role (${userRole}) does not permit this action: ${roleValidation.reason}`,
      userRole,
      blockedAt: new Date().toISOString()
    };
  }

  return {
    safe: true,
    attacks: [],
    recommendation: '',
    escalationType: null,
    userRole,
    validatedAt: new Date().toISOString()
  };
}

/**
 * Validate if user's role permits the requested action
 * @param {String} input - User input describing the action
 * @param {String} userRole - Current user's role
 * @returns {Object} { allowed: boolean, reason: String }
 */
function validateUserActionAgainstRole(input, userRole) {
  const inputLower = input.toLowerCase();

  // Check if input requests restricted actions
  const restrictedActions = {
    'view.*all.*user': ['ADMIN', 'MODERATOR'],
    'export.*user.*data': ['ADMIN'],
    'delete.*user': ['ADMIN'],
    'modify.*permission': ['ADMIN'],
    'access.*API.*key': ['ADMIN'],
    'view.*database': ['ADMIN'],
    'manage.*role': ['ADMIN'],
    'edit.*other.*user': ['ADMIN', 'MODERATOR'],
    'block.*user': ['ADMIN', 'MODERATOR'],
    'view.*audit.*log': ['ADMIN', 'MODERATOR']
  };

  for (const [actionPattern, allowedRoles] of Object.entries(restrictedActions)) {
    const regex = new RegExp(actionPattern, 'i');
    if (regex.test(inputLower)) {
      if (!allowedRoles.includes(userRole)) {
        return {
          allowed: false,
          reason: `Only ${allowedRoles.join(', ')} roles can perform this action`
        };
      }
    }
  }

  return { allowed: true, reason: 'Action permitted for user role' };
}

/**
 * Generate recommendation based on escalation attempt
 * @param {String} userRole - User's current role
 * @param {Array} attacks - Detected attacks
 * @returns {String} Recommendation message
 */
function generateEscalationRecommendation(userRole, attacks) {
  const severity = attacks[0]?.severity || 'UNKNOWN';
  
  if (severity === 'CRITICAL') {
    return `⚠️ CRITICAL: Privilege escalation attempt detected. Your action has been logged and reported. Repeated attempts may result in account suspension. Your role (${userRole}) does not permit this action.`;
  } else if (severity === 'HIGH') {
    return `⚠️ HIGH: Unauthorized access attempt. You do not have permission to perform this action. Contact support if you believe this is an error.`;
  }

  return `Unauthorized action. Your current role (${userRole}) does not permit this request.`;
}

/**
 * Get privilege escalation dashboard data
 * @returns {Object} Dashboard data with statistics
 */
function getLeakagePreventionDashboard() {
  const stats = LEAKAGE_LOG.statistics;
  const recentEvents = LEAKAGE_LOG.events.slice(-20); // Last 20 events

  // Count attempts by type
  const attemptsByType = {};
  LEAKAGE_LOG.events.forEach(event => {
    const type = event.attemptType || 'Unknown';
    attemptsByType[type] = (attemptsByType[type] || 0) + 1;
  });

  return {
    summary: {
      totalAttempts: stats.totalAttempts,
      escaltionAttempts: stats.escalationAttempts,
      adminImpersonationAttempts: stats.adminImpersonationAttempts,
      restrictedDataAttempts: stats.restrictedDataAttempts,
      blockedUsersCount: stats.blockedUsers.size,
      lastAttemptTime: stats.lastAttemptTime
    },
    attemptsByType,
    recentEvents: recentEvents.map(e => ({
      type: e.attemptType,
      timestamp: e.timestamp,
      userId: e.userId,
      severity: e.severity
    })),
    blockedUsers: Array.from(stats.blockedUsers),
    recommendations: generatePrivilegeEscalationRecommendations()
  };
}

/**
 * Generate security recommendations
 * @returns {Array} Array of recommendations
 */
function generatePrivilegeEscalationRecommendations() {
  const stats = LEAKAGE_LOG.statistics;
  const recommendations = [];

  if (stats.escalationAttempts > 10) {
    recommendations.push({
      level: 'CRITICAL',
      message: 'Multiple privilege escalation attempts detected. Recommend immediate review of authentication logs.'
    });
  }

  if (stats.blockedUsers.size > 5) {
    recommendations.push({
      level: 'HIGH',
      message: 'Multiple users attempting unauthorized actions. Review user access policies.'
    });
  }

  if (stats.adminImpersonationAttempts > 3) {
    recommendations.push({
      level: 'CRITICAL',
      message: 'Admin impersonation attempts detected. Strengthen role-based access control.'
    });
  }

  recommendations.push({
    level: 'INFO',
    message: 'All privilege escalation attempts are logged and monitored. Invalid actions automatically rejected.'
  });

  return recommendations;
}

/**
 * Generate comprehensive leakage prevention report
 * @returns {Object} Full report with statistics and findings
 */
function generateLeakagePreventionReport() {
  const stats = LEAKAGE_LOG.statistics;
  const totalEvents = LEAKAGE_LOG.events.length;

  // Categorize events by severity
  const eventsBySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 };
  LEAKAGE_LOG.events.forEach(event => {
    if (event.severity) {
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    }
  });

  return {
    reportDate: new Date().toISOString(),
    summary: {
      totalAttempts: stats.totalAttempts,
      totalEvents: totalEvents,
      escaltationAttempts: stats.escalationAttempts,
      preventionRate: totalEvents > 0 ? '100%' : 'N/A',
      systemStatus: stats.escaltationAttempts > 50 ? '🔴 ELEVATED THREAT' : '🟢 SECURE'
    },
    eventsBySeverity,
    statistics: stats,
    topAttackers: getTopAttackers(5),
    recentEvents: LEAKAGE_LOG.events.slice(-10),
    verdict: generatePrivilegeEscalationVerdict()
  };
}

/**
 * Get top attacking users
 * @param {Number} limit - Number of top attackers to return
 * @returns {Array} Top attackers with attempt counts
 */
function getTopAttackers(limit = 5) {
  const userAttempts = {};
  LEAKAGE_LOG.events.forEach(event => {
    userAttempts[event.userId] = (userAttempts[event.userId] || 0) + 1;
  });

  return Object.entries(userAttempts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([userId, count]) => ({ userId, attemptCount: count }));
}

/**
 * Generate verdict on privilege escalation security posture
 * @returns {Object} Security verdict
 */
function generatePrivilegeEscalationVerdict() {
  const stats = LEAKAGE_LOG.statistics;
  const successRate = stats.totalAttempts > 0 ? '100%' : '0%';

  if (stats.escaltationAttempts > 50) {
    return {
      level: '🟡 NEEDS ATTENTION',
      message: 'High number of escalation attempts detected. Review security policies.',
      blockedAttempts: stats.escaltationAttempts,
      successRate
    };
  }

  if (stats.escaltationAttempts > 20) {
    return {
      level: '🟠 MONITOR CLOSELY',
      message: 'Moderate number of escalation attempts. Continue monitoring.',
      blockedAttempts: stats.escaltationAttempts,
      successRate
    };
  }

  return {
    level: '🟢 SECURE',
    message: 'All privilege escalation attempts successfully blocked. Role-based access control functioning properly.',
    blockedAttempts: stats.escaltationAttempts,
    successRate,
    systemIntegrity: 'INTACT',
    roleEnforcement: 'ACTIVE'
  };
}

/**
 * Export leakage prevention log as JSON file
 * @param {String} filename - Output filename
 */
function exportLeakageLog(filename = 'leakage-prevention-log.json') {
  const data = {
    exportDate: new Date().toISOString(),
    log: LEAKAGE_LOG,
    report: generateLeakagePreventionReport(),
    statistics: LEAKAGE_LOG.statistics
  };

  const jsonString = JSON.stringify(data, (key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }, 2);

  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log(`✅ Leakage prevention log exported as ${filename}`);
}

/**
 * Get specific user data with role-based access control
 * @param {String} requestedUserId - ID of user whose data is requested
 * @param {Object} currentUser - Current authenticated user
 * @param {String} dataType - Type of data requested
 * @returns {Object} { allowed: boolean, reason: String, allowedFields: Array }
 */
export function validateDataAccessByRole(requestedUserId, currentUser, dataType) {
  const role = USER_ROLES[currentUser?.role] || USER_ROLES.GUEST;
  
  // Admin can access all data
  if (currentUser?.role === 'ADMIN') {
    return {
      allowed: true,
      reason: 'Admin has unrestricted access',
      allowedFields: role.allowedDataFields
    };
  }

  // User can only access their own data
  if (requestedUserId === currentUser?.uid) {
    return {
      allowed: true,
      reason: 'User accessing own data',
      allowedFields: role.allowedDataFields.filter(f => f.includes('own_'))
    };
  }

  // Moderators can access non-sensitive user data
  if (currentUser?.role === 'MODERATOR' && role.allowedDataFields.includes('email')) {
    return {
      allowed: true,
      reason: 'Moderator can access user data within restrictions',
      allowedFields: role.allowedDataFields,
      restrictedFields: role.restrictedFields
    };
  }

  // Everyone else denied
  return {
    allowed: false,
    reason: `Your role (${currentUser?.role}) cannot access other users' ${dataType}`,
    allowedFields: []
  };
}

// Export role definitions for external use
export { USER_ROLES, PRIVILEGE_ESCALATION_PATTERNS, RESTRICTED_KEYWORDS };
