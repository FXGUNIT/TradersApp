═══════════════════════════════════════════════════════════════════════════════════════════════
                     WELCOME DISPATCH - DEPLOYMENT GUIDE
                      Firebase Cloud Functions Setup
═══════════════════════════════════════════════════════════════════════════════════════════════

OVERVIEW:
The Welcome Dispatch is a Firebase Cloud Function that automatically sends a classified welcome 
email to every new user upon registration (Google OAuth or Email).

Trigger: functions.auth.user().onCreate
Purpose: Send institutional welcome email with military branding
Status: Backend routing LIVE | Email trigger READY

═══════════════════════════════════════════════════════════════════════════════════════════════

DEPLOYMENT REQUIREMENTS:

1. Firebase Project Setup
   - Ensure you have a Firebase project created at https://console.firebase.google.com
   - Note your Project ID

2. Firebase CLI Installation
   npm install -g firebase-tools
   firebase login

3. Email Service Configuration
   Option A: Gmail (Recommended for development)
   - Enable 2-Factor Authentication on your Gmail account
   - Generate an App Password: https://myaccount.google.com/apppasswords
   - Keep the 16-character password safe

   Option B: SendGrid API
   - Create account at sendgrid.com
   - Generate API key from Settings → API Keys
   - Set SENDGRID_API_KEY environment variable

   Option C: Mailgun API
   - Create account at mailgun.com
   - Get API key from your domain settings
   - Set MAILGUN_* environment variables

4. Node.js Dependencies for Cloud Functions
   If deploying to Firebase Cloud Functions, ensure functions have:
   - firebase-functions (^7.x)
   - firebase-admin (^9.x)
   - nodemailer (^6.x)

═══════════════════════════════════════════════════════════════════════════════════════════════

STEP-BY-STEP DEPLOYMENT:

Step 1: Initialize Firebase Functions (if not already done)
────────────────────────────────────────────────────────────
1a. In your project root, run:
    firebase init functions

1b. Choose:
    - Use an existing Firebase project
    - Select your project
    - Choose JavaScript
    - Install dependencies with npm (yes)

Step 2: Deploy the Welcome Dispatch Function
────────────────────────────────────────────────────────────
2a. Navigate to the functions directory:
    cd functions

2b. Copy the welcomeDispatchFunction.js code into functions/index.js
    (or append the welcomeDispatch and sendWelcomeEmailHTTP exports)

2c. Set environment variables for email:
    firebase functions:config:set regiment.email="your-email@gmail.com" regiment.password="xxxx-xxxx-xxxx-xxxx"

    For SendGrid:
    firebase functions:config:set sendgrid.api_key="SG.xxxxxxxxxxxx"

2d. Deploy only the functions:
    firebase deploy --only functions

    Or include all:
    firebase deploy

Step 3: Configure Firestore/Realtime Database
────────────────────────────────────────────────────────────
3a. In Firebase Console, enable:
   - Realtime Database (or Firestore)
   - Authentication (Email/Password + Google OAuth)

3b. Set database security rules (Realtime Database):
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}

Step 4: Test the Function
────────────────────────────────────────────────────────────
4a. Create a new user in Firebase Console:
    Authentication → Users → Add User

4b. Verify:
    - Check Cloud Functions logs in Firebase Console
    - Check email inbox for welcome email
    - Verify database entry in Realtime Database

═══════════════════════════════════════════════════════════════════════════════════════════════

EMAIL CONFIGURATION DETAILS:

Gmail Setup (Recommended):
──────────────────────────
1. Enable 2-Factor Authentication (https://myaccount.google.com/security)
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer" (or your device)
4. Copy the 16-character password
5. Set in Cloud Functions:
   firebase functions:config:set regiment.email="your-email@gmail.com" \
                                 regiment.password="xxxx-xxxx-xxxx-xxxx"

SendGrid Setup:
───────────────
1. Create account at https://sendgrid.com
2. Go to Settings → API Keys → Create API Key
3. Name it "TradersRegiment" (or similar)
4. Copy the key
5. Set in Cloud Functions:
   firebase functions:config:set sendgrid.api_key="SG.xxxxx_xxxxx_xxxxx"

Update the transporter in welcomeDispatchFunction.js:
   const transporter = nodemailer.createTransport(sgTransport({
     auth: { api_key: process.env.SENDGRID_API_KEY }
   }));

═══════════════════════════════════════════════════════════════════════════════════════════════

MONITORING & LOGGING:

View Cloud Functions logs:
──────────────────────────
firebase functions:log

Or in Firebase Console:
  Functions → Logs → welcomeDispatch

Expected log output on successful email send:
✅ Welcome Dispatch triggered for: officer@example.com
✅ Welcome Dispatch email sent to officer@example.com

═══════════════════════════════════════════════════════════════════════════════════════════════

TESTING WITHOUT FIREBASE DEPLOYMENT:

For local testing with emulator:
──────────────────────────────────
1. Install Firebase Emulator Suite:
   firebase init emulators

2. Run emulator:
   firebase emulators:start

3. Create test user through emulator UI

4. Check logs in emulator console

═══════════════════════════════════════════════════════════════════════════════════════════════

TROUBLESHOOTING:

Issue: Email not sending
✗ Check Cloud Functions logs for error messages
✗ Verify email service credentials are correct
✗ Ensure nodemailer is installed: npm install nodemailer
✗ Check email service isn't blocking the request (check spam mail rules)

Issue: auth.onCreate not triggering
✗ Verify Authentication is enabled in Firebase Console
✗ Check function was deployed successfully
✗ Create a new user (not existing users) to trigger the function
✗ Check Cloud Functions status shows ACTIVE

Issue: User database not being updated
✗ Verify Realtime Database is enabled
✗ Check database security rules allow writes from function
✗ Verify uid exists before trying to update

═══════════════════════════════════════════════════════════════════════════════════════════════

SECURITY NOTES:

✓ Email credentials stored in Cloud Functions config (encrypted at rest)
✓ Function only runs on user.onCreate (no manual triggers on existing users)
✓ Email subject includes "CLASSIFIED" for branding
✓ HTML email includes military institutional styling (#1e40af blue border)
✓ Fails gracefully if email service unavailable (doesn't break user creation)
✓ All errors logged to Cloud Function logs (not exposed to client)

═══════════════════════════════════════════════════════════════════════════════════════════════

NEXT STEPS:

1. Initialize Firebase Functions in your project
2. Configure your email service (Gmail recommended for quick setup)
3. Deploy with: firebase deploy --only functions
4. Create a test user and verify welcome email arrives
5. Monitor Cloud Functions logs for any errors

═══════════════════════════════════════════════════════════════════════════════════════════════

Email Template Specification:

Subject: CLASSIFIED: Welcome to the Regiment, Officer.

Body (Text):
Officer,

Your credentials have been verified and your clearance is granted.

You are now standing inside the Department of Institutional Artillery. This Command Terminal is 
equipped with hydrogen-powered encryption and nuclear-grade perimeter defense. We do not tolerate 
failure, and we do not accept fear.

"If a man says he is not afraid of losing, he is either lying or he is a Traders Regiment Officer."

Initialize your deployment and trust your equipment.

Gunit Singh
Commander-in-Chief, Traders Regiment

WELCOME TO THE REGIMENT

═══════════════════════════════════════════════════════════════════════════════════════════════

Status: ✅ BACKEND ROUTING LIVE | ✅ EMAIL TRIGGER READY FOR DEPLOYMENT

═══════════════════════════════════════════════════════════════════════════════════════════════
