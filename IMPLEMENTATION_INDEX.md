# Master Backend & State Routing Architecture - COMPLETE Implementation Index

## OVERVIEW

This document contains EVERY DETAIL from the Master Backend & State Routing Architecture. Each task, function, process, button, and flow is documented with:

- **WHAT** it does
- **HOW** it works
- **WHY** it's needed
- **WHERE** it should be placed

---

# PHASE 1: THE IDENTITY PIPELINE (Signup & Login)

## Scenario A: Manual Email/Password Signup

### Task 1.1: Frontend Validation Function

**File:** `src/services/authService.js` (CREATE NEW FILE)
**Function Name:** `validateSignupInput(email, password)`

#### WHAT:

- Validates user input before allowing signup
- Ensures password meets minimum security requirements
- Enforces Gmail-only signup (as per business rule)

#### HOW:

1. Receive email and password as parameters
2. Create empty errors array
3. Check if password exists AND is 8+ characters long
4. Check if email exists AND ends with @gmail.com (case insensitive)
5. Return object with `isValid` boolean and `errors` array

#### WHY:

- Prevents invalid data from hitting Firebase (saves API calls)
- Enforces business rule: only @gmail.com allowed
- Provides clear error messages to user

#### WHERE TO USE:

- In SignupScreen component before calling `createUserWithEmailAndPassword`
- Call validation first, only proceed if `isValid === true`

#### CODE STRUCTURE:

```javascript
// src/services/authService.js

/**
 * Validates signup input before Firebase authentication
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export function validateSignupInput(email, password) {
  const errors = [];

  // Validate password length - MUST be 8+ characters
  if (!password) {
    errors.push("Password is required");
  } else if (password.length < 8) {
    errors.push("Password must be 8+ characters");
  }

  // Validate email - MUST be @gmail.com
  if (!email) {
    errors.push("Email is required");
  } else if (!email.toLowerCase().endsWith("@gmail.com")) {
    errors.push("Only @gmail.com accounts are allowed");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

---

### Task 1.2: Firebase Authentication - Create User

**File:** `src/services/authService.js`
**Function Name:** `createEmailUser(email, password, userData)`

#### WHAT:

- Creates cryptographic identity in Firebase Authentication
- Returns Firebase user object with UID

#### HOW:

1. Call Firebase's `createUserWithEmailAndPassword(auth, email, password)`
2. Catch FirebaseAuthException errors (email already in use, weak password, etc.)
3. Return user object with UID on success
4. Throw descriptive error on failure

#### WHY:

- Firebase handles secure password hashing automatically
- Creates the authentication record needed for database linking

#### WHERE TO USE:

- In SignupScreen after validation passes
- Use UID from response to create database record

#### CODE STRUCTURE:

```javascript
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();

export async function createEmailUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    console.log("✅ Firebase user created:", user.uid);
    return {
      uid: user.uid,
      email: user.email,
      success: true,
    };
  } catch (error) {
    // Handle specific Firebase errors
    let errorMessage = "Signup failed. Please try again.";

    if (error.code === "auth/email-already-in-use") {
      errorMessage = "This email is already registered.";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "Password is too weak.";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email format.";
    }

    console.error("❌ Firebase signup error:", error.code, error.message);
    throw new Error(errorMessage);
  }
}
```

---

### Task 1.3: Database Provisioning (dbW)

**File:** `src/services/databaseService.js` (CREATE NEW FILE)
**Function Name:** `provisionUserRecord(uid, userData)`

#### WHAT:

- Creates the master user record in Firebase Realtime Database
- Sets critical initial state: `status: 'PENDING'`
- This is THE most important database operation

#### HOW:

1. Import Firebase database functions
2. Create reference to `users/{uid}`
3. Build user record object with ALL required fields
4. Use `set()` to write data (not update - fresh record)
5. Set `status: 'PENDING'` - this controls entire routing flow

#### WHY:

- Without this record, user cannot be routed properly
- `status: 'PENDING'` ensures user goes to WaitingRoom
- All other user data (role, failedAttempts, etc.) starts here

#### WHERE TO USE:

- IMMEDIATELY after `createEmailUser()` succeeds
- IMMEDIATELY after Google signup detects new user
- NEVER skip this step

#### DATABASE PATH:

- **Location:** `users/{uid}`
- **Critical Field:** `status: 'PENDING'`

#### CODE STRUCTURE:

```javascript
// src/services/databaseService.js

import { getDatabase, ref, set } from "firebase/database";

const db = getDatabase();

/**
 * Creates master user record in Firebase Database
 * THIS IS CRITICAL - Sets status to PENDING
 * @param {string} uid - Firebase Authentication UID
 * @param {object} userData - { email, fullName, ... }
 */
export async function provisionUserRecord(uid, userData) {
  const userRef = ref(db, `users/${uid}`);

  const userRecord = {
    // Identity
    email: userData.email,
    fullName: userData.fullName || userData.email.split("@")[0],

    // CRITICAL: This controls routing
    status: "PENDING", // Options: 'PENDING', 'ACTIVE', 'BLOCKED'

    // Security
    role: "user", // 'user', 'admin', 'superadmin'
    isLocked: false, // true = account locked
    failedAttempts: 0, // Count of failed logins

    // Timestamps
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastLoginAt: null,
    approvedAt: null,
    approvedBy: null,

    // Profile defaults
    profilePicture: null,
    phoneNumber: userData.phoneNumber || null,

    // Trading defaults (empty until user adds data)
    accountBalance: 0,
    journal: {},
    tradesCount: 0,
    winRate: 0,

    // Compliance
    tncAccepted: false,
    tncAcceptedAt: null,
    privacyAccepted: false,
    privacyAcceptedAt: null,

    // Support
    supportChatInitialized: false,
  };

  try {
    await set(userRef, userRecord);
    console.log("✅ User record provisioned:", uid, "status: PENDING");
    return userRecord;
  } catch (error) {
    console.error("❌ Database provisioning failed:", error);
    throw new Error("Failed to create user record");
  }
}
```

---

### Task 1.4: Welcome Email Trigger (EmailJS)

**File:** `src/services/emailService.js` (CREATE NEW FILE)
**Function Name:** `sendWelcomeEmail(email, fullName)`

#### WHAT:

- Automatically fires "Welcome to the Regiment - Under Review" email
- Uses EmailJS to send templated email
- NOTIFIES USER their application is being reviewed

#### HOW:

1. Import EmailJS
2. Use service ID and template from .env (VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID)
3. Pass template variables: user_email, user_name
4. Handle success/failure

#### WHY:

- Confirms user their signup worked
- Sets expectations: application is "Under Review"
- Professional onboarding

#### EMAIL TEMPLATE:

- **Template ID:** template_ssd8w3g (from .env)
- **Subject:** "Welcome to the Regiment - Under Review"
- **Variables:** {{user_email}}, {{user_name}}

#### CODE STRUCTURE:

```javascript
// src/services/emailService.js

import emailjs from "@emailjs/browser";

// Get from .env
const EMAILJS_SERVICE_ID =
  import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_xxx";
const EMAILJS_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_xxx";
const EMAILJS_PUBLIC_KEY =
  import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "public_key";

/**
 * Sends "Welcome - Under Review" email
 * @param {string} email - User's email
 * @param {string} fullName - User's full name
 */
export async function sendWelcomeEmail(email, fullName) {
  const templateParams = {
    user_email: email,
    user_name: fullName || email.split("@")[0],
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY,
    );

    console.log("✅ Welcome email sent:", email, response.status);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Welcome email failed:", error);
    // Don't throw - email failure shouldn't block signup
    return { success: false, error };
  }
}
```

---

### Task 1.5: Route to OTPScreen

**File:** Existing routing in `src/App.jsx`
**Navigation:** After successful signup and database provisioning

#### WHAT:

- Forces user to OTPScreen after manual email/password signup
- Ensures user owns their email address

#### HOW:

1. In SignupScreen, after successful `createEmailUser()` AND `provisionUserRecord()`
2. Use React Router: `navigate('/otp', { state: { email, uid } })`
3. Or set parent state: `onSignupSuccess({ email, uid })`

#### WHY:

- Email verification is MANDATORY for manual signup
- Prevents fake email signups
- OTPScreen already exists in project

#### WHERE:

- In SignupScreen component's submit handler
- After email welcome email is sent

#### CODE FLOW:

```
User enters email/password
  → validateSignupInput() [Task 1.1]
  → createEmailUser() [Task 1.2]
  → provisionUserRecord() [Task 1.3]
  → sendWelcomeEmail() [Task 1.4]
  → navigate('/otp') [Task 1.5]
```

---

## Scenario B: Google OAuth Signup (The Bypass)

### Task 1.6: Google OAuth signInWithPopup

**File:** `src/services/authService.js`
**Function Name:** `handleGoogleSignup()`

#### WHAT:

- Handles Google OAuth flow using Firebase
- DIFFERENT from email signup: skips OTP (Google verified email)
- Checks if user is NEW or RETURNING

#### HOW:

1. Initialize GoogleAuthProvider
2. Call `signInWithPopup(auth, provider)`
3. Get user from response
4. Check if `users/{uid}` exists in database
5. Branch: NEW → provision & welcome email | RETURNING → security interceptor

#### WHY:

- Google already verified user's email
- NO OTP needed (that's the "bypass")
- Need to check DB to know if new or returning

#### CODE STRUCTURE:

```javascript
// src/services/authService.js

import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { checkUserExists } from "./databaseService.js";
import { provisionUserRecord } from "./databaseService.js";
import { sendWelcomeEmail } from "./emailService.js";

const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

/**
 * Handles Google OAuth Signup
 * DIFFERENCE: Skips OTP (Google verified email)
 * @returns {object} { route: 'WaitingRoom' | 'SecurityInterceptor', uid, isNewUser }
 */
export async function handleGoogleSignup() {
  try {
    // 1. Trigger Google OAuth popup
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const uid = user.uid;
    const email = user.email;
    const fullName = user.displayName;

    console.log("✅ Google signin success:", email);

    // 2. Check if user exists in our database
    const existingUser = await checkUserExists(uid);

    if (!existingUser) {
      // === NEW USER ===
      console.log("🆕 New Google user - provisioning...");

      // Create database record
      await provisionUserRecord(uid, {
        email,
        fullName,
      });

      // Send welcome email
      await sendWelcomeEmail(email, fullName);

      // Route to WaitingRoom (skip OTP - Google verified)
      return {
        success: true,
        route: "WaitingRoom",
        uid,
        isNewUser: true,
      };
    } else {
      // === RETURNING USER ===
      console.log("🔄 Returning Google user - checking status...");

      // Pass to Security Interceptor (Domain 2)
      return {
        success: true,
        route: "SecurityInterceptor",
        uid,
        isNewUser: false,
      };
    }
  } catch (error) {
    console.error("❌ Google signup failed:", error);

    // Handle specific errors
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in cancelled");
    } else if (error.code === "auth/account-exists-with-different-credential") {
      throw new Error(
        "Email already registered with password. Use password login.",
      );
    }

    throw new Error("Google sign-in failed. Please try again.");
  }
}
```

---

### Task 1.7: Database Check (dbR) - Check if User Exists

**File:** `src/services/databaseService.js`
**Function Name:** `checkUserExists(uid)`

#### WHAT:

- Reads Firebase database to check if user record exists
- CRITICAL for determining NEW vs RETURNING Google user

#### HOW:

1. Create reference to `users/{uid}`
2. Use `get()` (not onValue - one-time read)
3. Return user data if exists, null if not

#### WHY:

- If user exists → returning → check security status
- If user doesn't exist → new → provision & welcome email

#### WHERE TO USE:

- In `handleGoogleSignup()` [Task 1.6]

#### CODE STRUCTURE:

```javascript
// src/services/databaseService.js

import { getDatabase, ref, get } from "firebase/database";

const db = getDatabase();

/**
 * Checks if user exists in database
 * @param {string} uid - Firebase UID
 * @returns {object|null} User data or null if doesn't exist
 */
export async function checkUserExists(uid) {
  try {
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      console.log("✅ User exists in DB:", uid);
      return snapshot.val();
    } else {
      console.log("ℹ️ User NOT found in DB:", uid);
      return null;
    }
  } catch (error) {
    console.error("❌ Database check failed:", error);
    // On error, assume user doesn't exist (safe default)
    return null;
  }
}
```

---

### Task 1.8: New Google User Flow

**Process:** Complete flow when Google user is NEW

#### WHAT HAPPENS (Step by Step):

1. User clicks "Sign in with Google"
2. Google popup appears → User selects Gmail account
3. Firebase returns user object with verified email
4. Code checks: `await checkUserExists(uid)`
5. Result: `null` (user doesn't exist)
6. Code runs: `await provisionUserRecord(uid, {...})`
   - Creates record with `status: 'PENDING'`
7. Code runs: `await sendWelcomeEmail(email, name)`
   - Sends "Under Review" email
8. **SKIP OTP** (Google already verified)
9. Route to: **WaitingRoom** (not OTPScreen)

#### WHY DIFFERENT FROM EMAIL SIGNUP:

- Email signup → MUST verify email → OTPScreen
- Google signup → Google already verified → WaitingRoom

---

### Task 1.9: Returning Google User Flow

**Process:** Complete flow when Google user is RETURNING

#### WHAT HAPPENS (Step by Step):

1. User clicks "Sign in with Google"
2. Google popup → User selects Gmail
3. Firebase returns user object
4. Code checks: `await checkUserExists(uid)`
5. Result: User object exists (status: 'ACTIVE' or other)
6. **Skip database provisioning**
7. Route to: **Security Interceptor** (Domain 2)

---

## Scenario C: Password Reset Edge Case

### Task 1.10: Google User Password Reset

**File:** `src/services/authService.js`
**Function Name:** `handleGoogleUserPasswordReset(email)`

#### WHAT:

- Handles the edge case: Google user wants a password
- User signed up with Google, now wants to login with password
- Solution: Firebase's built-in password reset flow

#### HOW:

1. User enters Gmail in "Forgot Password"
2. Call Firebase's `sendPasswordResetEmail(auth, email)`
3. Firebase emails secure reset link
4. User clicks link → Google's secure page
5. User types NEW password
6. Now account is "Linked" - can login Google OR password

#### WHY THIS IS IMPORTANT:

- Without this, Google-only users are stuck
- They CANNOT use "Forgot Password" normally
- This is a common frustration in SaaS apps

#### WHY NO CUSTOM UI NEEDED:

- Firebase handles the entire flow
- Don't build a "Set Password" page
- Just trigger `sendPasswordResetEmail`

#### CODE STRUCTURE:

```javascript
// src/services/authService.js

import { getAuth, sendPasswordResetEmail } from "firebase/auth";

const auth = getAuth();

/**
 * Sends password reset email for Google users
 * Uses Firebase's built-in flow - NO CUSTOM UI NEEDED
 * @param {string} email - User's Gmail address
 */
export async function handleGoogleUserPasswordReset(email) {
  try {
    // Firebase handles entire reset flow
    await sendPasswordResetEmail(auth, email);

    console.log("✅ Password reset email sent:", email);
    return {
      success: true,
      message: "Check your email for reset instructions",
    };
  } catch (error) {
    console.error("❌ Password reset failed:", error);

    let errorMessage = "Failed to send reset email";

    if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address";
    } else if (error.code === "auth/user-not-found") {
      errorMessage = "No account with this email";
    } else if (error.code === "auth/too-many-requests") {
      errorMessage = "Too many attempts. Try again later";
    }

    throw new Error(errorMessage);
  }
}
```

---

# PHASE 2: THE SECURITY INTERCEPTOR (Login Routing)

## Overview

**Function:** `checkUserStatus(uid)`
**Purpose:** Acts as a "bouncer" - reads database, strictly routes based on status
**Called:** Every time user logs in OR refreshes the page

---

### Task 2.1: checkUserStatus Function

**File:** `src/services/authService.js`
**Function Name:** `checkUserStatus(uid)`

#### WHAT:

- Fetches user record from database
- Analyzes security status
- Returns routing decision

#### HOW:

1. Read from `users/{uid}`
2. Check `isLocked` field
3. Check `status` field ('PENDING', 'ACTIVE', 'BLOCKED')
4. Return routing instructions

#### WHERE TO USE:

- After successful login (email OR Google)
- In `onAuthStateChanged` listener when page loads
- Before routing to any protected page

#### CODE STRUCTURE:

```javascript
// src/services/authService.js

import { getDatabase, ref, get } from "firebase/database";
import { getAuth, signOut } from "firebase/auth";

const db = getDatabase();
const auth = getAuth();

/**
 * SECURITY INTERCEPTOR - Acts as bouncer
 * Checks user status and returns routing decision
 * @param {string} uid - Firebase UID
 * @returns {object} { action, status, shouldLogout, message }
 */
export async function checkUserStatus(uid) {
  try {
    // 1. Fetch user record
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      // No record = shouldn't happen, but handle it
      console.warn("⚠️ No user record found for UID:", uid);
      return {
        action: "error",
        status: "NO_RECORD",
        shouldLogout: true,
        message: "User record not found",
      };
    }

    const user = snapshot.val();

    // 2. Check isLocked first (highest priority)
    if (user.isLocked === true) {
      console.warn("🔒 Account LOCKED:", uid);
      return {
        action: "LOCKED",
        status: user.status,
        shouldLogout: true,
        message: "Account locked. Contact Master Admin.",
        telegramAlert: true,
        alertType: "ACCOUNT_LOCKED",
      };
    }

    // 3. Check status field
    switch (user.status) {
      case "BLOCKED":
        console.warn("🚫 Account BLOCKED:", uid);
        return {
          action: "BLOCKED",
          status: "BLOCKED",
          shouldLogout: true,
          message: "Access revoked. Contact support.",
          telegramAlert: true,
          alertType: "ACCOUNT_BLOCKED",
        };

      case "PENDING":
        console.log("⏳ Account PENDING:", uid);
        return {
          action: "PENDING",
          status: "PENDING",
          shouldLogout: false,
          message: "Application under review",
        };

      case "ACTIVE":
        console.log("✅ Account ACTIVE:", uid);
        return {
          action: "ACTIVE",
          status: "ACTIVE",
          shouldLogout: false,
          message: "Login successful",
        };

      default:
        // Unknown status - default to PENDING (safe)
        console.warn("⚠️ Unknown status:", user.status);
        return {
          action: "PENDING",
          status: "PENDING",
          shouldLogout: false,
          message: "Status pending review",
        };
    }
  } catch (error) {
    console.error("❌ checkUserStatus failed:", error);
    return {
      action: "error",
      status: "ERROR",
      shouldLogout: true,
      message: "Failed to verify account status",
    };
  }
}
```

---

### Task 2.2: isLocked Handler

**File:** `src/services/routingService.js` (CREATE NEW FILE)
**Function Name:** `handleLockedAccount(userData)`

#### WHAT:

- Routes locked account users
- Signs them out immediately
- Shows error message

#### HOW:

1. Receive user data
2. Sign out from Firebase
3. Show red error toast
4. Fire Telegram alert to admin

#### UI MESSAGE:

**"Account locked. Contact Master Admin."**

#### CODE STRUCTURE:

```javascript
// src/services/routingService.js

import { getAuth, signOut } from "firebase/auth";
import { sendSecurityAlert } from "./telegramService.js";

const auth = getAuth();

/**
 * Handles locked account - IMMEDIATE LOGOUT
 * @param {object} userData - User data from database
 */
export async function handleLockedAccount(userData) {
  // 1. Sign out immediately
  await signOut(auth);
  console.log("🔒 User signed out - account locked");

  // 2. Show error toast
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast(
      "Account locked. Contact Master Admin.",
      "error",
      10000, // 10 seconds
    );
  }

  // 3. Fire Telegram alert
  try {
    await sendSecurityAlert("ACCOUNT_LOCKED", {
      uid: userData.uid,
      email: userData.email,
      failedAttempts: userData.failedAttempts,
    });
  } catch (e) {
    console.error("Telegram alert failed:", e);
  }

  // 4. Return for routing
  return {
    redirectTo: "login",
    showError: true,
    errorMessage: "Account locked. Contact Master Admin.",
  };
}
```

---

### Task 2.3: BLOCKED Status Handler

**File:** `src/services/routingService.js`
**Function Name:** `handleBlockedAccount(userData)`

#### WHAT:

- Routes BLOCKED account users
- Signs them out
- Shows access revoked message

#### UI MESSAGE:

**"Access revoked. Contact support."**

#### CODE STRUCTURE:

```javascript
/**
 * Handles BLOCKED status - SIGN OUT
 * @param {object} userData - User data from database
 */
export async function handleBlockedAccount(userData) {
  // Sign out
  await signOut(auth);
  console.log("🚫 User signed out - account blocked");

  // Show error
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast("Access revoked. Contact support.", "error", 10000);
  }

  // Telegram alert
  await sendSecurityAlert("ACCOUNT_BLOCKED", {
    uid: userData.uid,
    email: userData.email,
  });

  return {
    redirectTo: "login",
    showError: true,
    errorMessage: "Access revoked. Contact support.",
  };
}
```

---

### Task 2.4: PENDING Status Handler

**File:** `src/services/routingService.js`
**Function Name:** `handlePendingAccount()`

#### WHAT:

- Routes PENDING users to WaitingRoom
- No logout needed
- User sees WaitingRoom

#### CODE STRUCTURE:

```javascript
/**
 * Handles PENDING status - ROUTE TO WAITING ROOM
 */
export function handlePendingAccount() {
  console.log("⏳ Routing to WaitingRoom...");

  return {
    redirectTo: "WaitingRoom",
    showError: false,
  };
}
```

---

### Task 2.5: ACTIVE Status Handler

**File:** `src/services/routingService.js`
**Function Name:** `handleActiveAccount(userData)`

#### WHAT:

- Routes ACTIVE users to MainTerminal
- Optionally check if OTP verification required
- Grant access

#### LOGIC:

- If OTP required → route to OTPScreen
- If OTP not required → route to MainTerminal

#### CODE STRUCTURE:

```javascript
/**
 * Handles ACTIVE status - GRANT ACCESS
 * @param {object} userData - User data from database
 * @param {boolean} otpRequired - Is OTP verification needed
 */
export function handleActiveAccount(userData, otpRequired = false) {
  console.log("✅ User ACTIVE - granting access...");

  // Check if OTP is required
  if (otpRequired) {
    return {
      redirectTo: "OTPScreen",
      showError: false,
    };
  }

  // Direct to terminal
  return {
    redirectTo: "MainTerminal",
    showError: false,
  };
}
```

---

### Task 2.6: Telegram Alert Integration

**File:** `src/services/telegramService.js`
**Function Name:** `sendSecurityAlert(alertType, userData)`

#### WHAT:

- Sends security alerts to admin via Telegram
- Uses existing Telegram bot

#### ALERT TYPES:

1. `ACCOUNT_LOCKED` - Too many failed login attempts
2. `ACCOUNT_BLOCKED` - Admin manually blocked
3. `LOGIN_FAILED_EXCESSIVE` - Brute force attempt
4. `SUSPICIOUS_ACTIVITY` - Unusual patterns detected

#### HOW:

- POST to existing `/telegram/notify` endpoint
- Include user data and alert type

#### CODE STRUCTURE:

```javascript
// src/services/telegramService.js

const TELEGRAM_API = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

/**
 * Sends security alert to admin via Telegram
 * @param {string} alertType - Type of alert
 * @param {object} userData - User information
 */
export async function sendSecurityAlert(alertType, userData) {
  const alertMessages = {
    ACCOUNT_LOCKED: `🔒 <b>ACCOUNT LOCKED</b>\n\nUser: ${userData.email}\nUID: ${userData.uid}\nFailed Attempts: ${userData.failedAttempts || "N/A"}`,

    ACCOUNT_BLOCKED: `🚫 <b>ACCOUNT BLOCKED</b>\n\nUser: ${userData.email}\nUID: ${userData.uid}\nBlocked by: ${userData.blockedBy || "System"}`,

    LOGIN_FAILED_EXCESSIVE: `⚠️ <b>EXCESSIVE LOGIN FAILURES</b>\n\nUser: ${userData.email}\nUID: ${userData.uid}\nAttempts: ${userData.failedAttempts}`,

    SUSPICIOUS_ACTIVITY: `🚨 <b>SUSPICIOUS ACTIVITY</b>\n\nUser: ${userData.email}\nUID: ${userData.uid}\nDetails: ${userData.details || "See logs"}`,
  };

  const message = alertMessages[alertType] || `⚠️ Security Alert: ${alertType}`;

  try {
    // Use existing Telegram bot endpoint
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_API}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      },
    );

    console.log("✅ Telegram alert sent:", alertType);
    return { success: true };
  } catch (error) {
    console.error("❌ Telegram alert failed:", error);
    return { success: false, error };
  }
}
```

---

# PHASE 3: THE WAITING ROOM & ADMIN APPROVAL

## Overview

**Component:** WaitingRoom
**Purpose:** Live component that waits for admin approval
**Key Feature:** Auto-updates when status changes

---

### Task 3.1: WaitingRoom Component

**File:** `src/pages/WaitingRoom.jsx` (CREATE NEW FILE)
**Component Name:** WaitingRoom

#### WHAT:

- Displays "Application under review" message
- Shows spinning logo animation
- Includes live status listener

#### HOW:

1. Show spinning/loading animation
2. Display message: "Your application is under review."
3. Set up Firebase listener for status
4. When status → ACTIVE → trigger confetti → route to terminal

#### UI ELEMENTS:

- Spinning logo (CSS animation)
- Message: "Your application is under review."
- Optional: Estimated wait time

#### WHERE TO USE:

- Route here when status === 'PENDING'
- From Security Interceptor

#### CODE STRUCTURE:

```jsx
// src/pages/WaitingRoom.jsx

import React, { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getAuth } from "firebase/auth";
import ConfettiCelebration from "../components/ConfettiCelebration.jsx";

export default function WaitingRoom({ onApproved }) {
  const [status, setStatus] = useState("PENDING");
  const [showConfetti, setShowConfetti] = useState(false);

  const db = getDatabase();
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;

    // === LIVE LISTENER ===
    const statusRef = ref(db, `users/${uid}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const newStatus = snapshot.val();
      console.log("📡 Status changed:", newStatus);

      setStatus(newStatus);

      // === MAGIC HANDSHAKE ===
      if (newStatus === "ACTIVE") {
        console.log("🎉 Application APPROVED!");

        // Trigger confetti
        setShowConfetti(true);

        // Wait briefly then route
        setTimeout(() => {
          if (onApproved) {
            onApproved(); // Notify parent to route
          }
        }, 2000); // 2 second celebration
      }
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [uid]);

  return (
    <div style={styles.container}>
      {showConfetti && <ConfettiCelebration />}

      {/* Spinning Logo */}
      <div style={styles.logoContainer}>
        <div style={styles.spinner}></div>
      </div>

      {/* Message */}
      <h1 style={styles.title}>Your application is under review</h1>

      <p style={styles.subtitle}>
        The Chief will verify your identity within 48 hours.
      </p>

      {/* Status indicator */}
      <div style={styles.statusBadge}>Status: {status}</div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "#0b1220",
    color: "#fff",
  },
  logoContainer: {
    marginBottom: "24px",
  },
  spinner: {
    width: "80px",
    height: "80px",
    border: "4px solid rgba(255,255,255,0.1)",
    borderTopColor: "#30D158",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    marginBottom: "12px",
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: "14px",
  },
  statusBadge: {
    marginTop: "24px",
    padding: "8px 16px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#FFD60A",
  },
};
```

---

### Task 3.2: Firebase onValue Listener Setup

**Part of:** Task 3.1 (WaitingRoom Component)

#### WHAT:

- Sets up real-time listener to user's status field
- Listens to: `users/{uid}/status`
- Fires callback when value changes

#### HOW:

1. Create reference: `ref(db, 'users/{uid}/status')`
2. Use `onValue()` (not `get()`)
3. In callback: check if value === 'ACTIVE'
4. Return unsubscribe function for cleanup

---

### Task 3.3: approveUser Function

**File:** `src/services/adminService.js` (CREATE NEW FILE)
**Function Name:** `approveUser(uid, adminUid)`

#### WHAT:

- Admin clicks APPROVE button
- Function updates status to 'ACTIVE'
- Triggers welcome email

#### HOW:

1. Update `users/{uid}/status` to 'ACTIVE'
2. Set `approvedAt` timestamp
3. Set `approvedBy` admin UID
4. Trigger approval email

#### DATABASE CHANGE:

```javascript
{
  status: 'ACTIVE',
  approvedAt: Date.now(),
  approvedBy: 'admin-uid-here'
}
```

#### CODE STRUCTURE:

```javascript
// src/services/adminService.js

import { getDatabase, ref, update } from "firebase/database";

const db = getDatabase();

/**
 * Approves a user application
 * @param {string} uid - UID of user to approve
 * @param {string} adminUid - UID of admin performing approval
 */
export async function approveUser(uid, adminUid) {
  const updates = {
    status: "ACTIVE",
    approvedAt: Date.now(),
    approvedBy: adminUid,
    updatedAt: Date.now(),
  };

  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, updates);

    console.log("✅ User approved:", uid);
    return { success: true };
  } catch (error) {
    console.error("❌ Approval failed:", error);
    throw error;
  }
}
```

---

### Task 3.4: Green "✓ APPROVE" Button

**File:** `src/components/AdminUserActions.jsx` (CREATE NEW FILE)
**Component:** AdminUserActions

#### WHAT:

- Green button in Admin Dashboard
- Shows next to pending users
- Calls `approveUser()` on click

#### HOW:

1. Receive user data as props
2. Show green "✓ APPROVE" button
3. On click: call `approveUser(uid, adminUid)`
4. Show success toast

#### BUTTON TEXT:

**"✓ APPROVE"**

#### BUTTON STYLE:

- Background: green (#30D158)
- Text: white
- Border-radius: 8px
- Padding: 8px 16px

---

### Task 3.5: Approval Welcome Email

**File:** `src/services/emailService.js`
**Function Name:** `sendApprovalConfirmationEmail(email, fullName)`

#### WHAT:

- Sends "You're Approved!" email
- Different from welcome email (under review)
- Message: "Welcome to the Regiment. Your terminal is unlocked."

#### EMAIL TEMPLATE:

- Use same EmailJS service
- Different template OR use template variables to change message

#### CODE STRUCTURE:

```javascript
/**
 * Sends approval confirmation email
 * @param {string} email - User's email
 * @param {string} fullName - User's full name
 */
export async function sendApprovalConfirmationEmail(email, fullName) {
  const templateParams = {
    user_email: email,
    user_name: fullName,
  };

  // Use same service, different template or dynamic content
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID_APPROVED, // New template for approved
      templateParams,
      EMAILJS_PUBLIC_KEY,
    );
    console.log("✅ Approval email sent:", email);
  } catch (error) {
    console.error("❌ Approval email failed:", error);
  }
}
```

---

### Task 3.6: Magic Handshake

**Part of:** WaitingRoom Component

#### WHAT:

- The "magic" is automatic detection
- When admin clicks approve → DB updates
- WaitingRoom listener detects → triggers confetti → routes

#### FLOW:

```
Admin clicks "✓ APPROVE"
  → approveUser() runs
  → DB status → 'ACTIVE'
  → WaitingRoom listener fires
  → if (status === 'ACTIVE')
     → trigger confetti
     → navigate('/terminal')
```

---

### Task 3.7: Confetti Animation

**File:** `src/components/ConfettiCelebration.jsx` (CREATE NEW FILE)

#### WHAT:

- Canvas-based confetti explosion
- Triggers on approval

#### HOW:

1. Use canvas-confetti npm package
2. Create component
3. `useEffect` triggers on mount

#### NPM PACKAGE:

```bash
npm install canvas-confetti
```

---

### Task 3.8: Auto-Route to MainTerminal

**Part of:** WaitingRoom Component

#### WHAT:

- After confetti, automatically route to MainTerminal
- User doesn't need to refresh

#### HOW:

```javascript
// In WaitingRoom
if (newStatus === "ACTIVE") {
  setShowConfetti(true);

  setTimeout(() => {
    // Route to terminal
    navigate("/terminal");
    // OR call parent handler
    onApproved();
  }, 2000);
}
```

---

# PHASE 4: GLOBAL TELEGRAM SUPPORT CHAT

## Overview

**Component:** FloatingChatWidget
**Purpose:** Bottom-right chat for user support
**Database:** support_chats/{uid}

---

### Task 4.1: FloatingChatWidget Component

**File:** `src/components/FloatingChatWidget.jsx` (CREATE NEW FILE)

#### WHAT:

- Floating button at bottom-right of screen
- Opens chat window when clicked
- Persists across all pages (global)

#### HOW:

1. Fixed position: bottom: 20px, right: 20px
2. Icon button (MessageCircle)
3. Click toggles chat window
4. Positioned OUTSIDE router in App.jsx

#### PLACEMENT:

```jsx
// In App.jsx, outside <Routes>
<div className="app">
  <Routes>{/* All pages */}</Routes>

  {/* Global - shows on all pages */}
  <FloatingChatWidget />
</div>
```

#### UI ELEMENTS:

- MessageCircle icon (24px)
- Badge for unread count
- Chat window (350px wide, 500px tall)
- Close button

---

### Task 4.2: Chat Database Structure

**Location:** Firebase Realtime Database
**Path:** `support_chats/{uid}`

#### STRUCTURE:

```json
{
  "support_chats": {
    "USER_UID_123": {
      "messages": [
        {
          "sender": "admin",
          "text": "Welcome to the Regiment support channel...",
          "timestamp": 1700000000000
        }
      ],
      "lastUpdated": 1700000000000
    }
  }
}
```

---

### Task 4.3: Automated Welcome Message

**File:** `src/components/FloatingChatWidget.jsx`
**Function:** Initialize chat on first open

#### WHAT:

- On first open, check if messages exist
- If empty, inject admin welcome message

#### MESSAGE TEXT:

**"Welcome to the Regiment support channel. How can I assist your deployment today?"**

#### HOW:

```javascript
// On component mount or first open
const messagesRef = ref(db, `support_chats/${uid}/messages`);
const snapshot = await get(messagesRef);

if (!snapshot.exists() || snapshot.val() === null) {
  // First time - inject welcome
  await set(messagesRef, [
    {
      sender: "admin",
      text: "Welcome to the Regiment support channel. How can I assist your deployment today?",
      timestamp: Date.now(),
    },
  ]);
}
```

---

### Task 4.4: handleUserMessage Function

**File:** `src/components/FloatingChatWidget.jsx`
**Function Name:** `handleSendMessage(text)`

#### WHAT:

- User types message and hits send
- Message appended to Firebase
- Triggers Telegram notification

#### HOW:

1. Get message text
2. Append to `support_chats/{uid}/messages`
3. Include sender: 'user', timestamp
4. Call Telegram notification

#### DATABASE UPDATE:

```javascript
{
  sender: 'user',
  text: messageText,
  timestamp: Date.now()
}
```

---

### Task 4.5: Telegram Notification Bridge

**File:** `src/services/telegramService.js`
**Function Name:** `notifyAdminOfSupportRequest(userEmail, message)`

#### WHAT:

- When user sends message, alert admin on Telegram
- Format: "🚨 Support Request from [Email]: [message]"

#### MESSAGE FORMAT:

```
🚨 Support Request from user@gmail.com:
Can I get approved?
```

#### CODE STRUCTURE:

```javascript
/**
 * Notifies admin of new support message
 * @param {string} userEmail - User's email
 * @param {string} message - User's message
 */
export async function notifyAdminOfSupportRequest(userEmail, message) {
  const text = `🚨 Support Request from ${userEmail}:\n${message}`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
      }),
    });
    console.log("✅ Support notification sent");
  } catch (error) {
    console.error("❌ Notification failed:", error);
  }
}
```

---

### Task 4.6: Admin Reply Option A (In App)

**File:** `src/components/AdminMessagePanel.jsx` (CREATE NEW FILE)
**Component:** AdminMessagePanel

#### WHAT:

- In Admin Dashboard, add "💬 MSG" button to user profile
- Opens reply interface
- Admin types reply → writes to Firebase

#### BUTTON:

**"💬 MSG"**

#### HOW:

1. Admin clicks "MSG" on user profile
2. Opens message input panel
3. Admin types reply
4. Clicks "Send"
5. Message written to Firebase `support_chats/{uid}/messages`
6. sender: 'admin'

#### WHERE IN ADMIN:

- In user profile card/row
- Next to other action buttons (Approve, Block)

---

### Task 4.7: Admin Reply Option B (Telegram Webhook)

**File:** `telegram-bridge/index.js` (EXTEND)
**Endpoint:** POST `/telegram/webhook`

#### WHAT (ADVANCED):

- Admin replies directly in Telegram app
- Webhook listens for Telegram replies
- Pushes reply to Firebase

#### NOTE:

- Start with Option A (in-app) for stability
- Option B is advanced feature

---

# FILE CREATION ORDER

## Phase 1 Files (Create First)

1. `src/services/authService.js` - Tasks 1.1, 1.2, 1.6, 1.10, 2.1
2. `src/services/databaseService.js` - Tasks 1.3, 1.7
3. `src/services/emailService.js` - Tasks 1.4, 3.5
4. `src/services/routingService.js` - Tasks 2.2-2.5

## Phase 2 Files

5. `src/services/telegramService.js` - Tasks 2.6, 4.5, 4.7
6. `src/services/adminService.js` - Task 3.3

## Phase 3 Files

7. `src/pages/WaitingRoom.jsx` - Tasks 3.1, 3.2, 3.6, 3.8
8. `src/components/AdminUserActions.jsx` - Task 3.4
9. `src/components/ConfettiCelebration.jsx` - Task 3.7

## Phase 4 Files

10. `src/components/FloatingChatWidget.jsx` - Tasks 4.1-4.4
11. `src/components/AdminMessagePanel.jsx` - Task 4.6

---

# IMPLEMENTATION APPROVAL REQUEST

I have now documented EVERY DETAIL including:

- ✅ Exact function names
- ✅ Exact file locations
- ✅ Exact code structures
- ✅ Exact UI messages
- ✅ Exact database paths
- ✅ HOW/WHY/WHAT for each function
- ✅ Step-by-step flows
- ✅ Edge cases

**Commander, please give me manual permission to start with Task 1.1** - creating `src/services/authService.js` with the `validateSignupInput(email, password)` function.

Do you approve starting Task 1.1?
