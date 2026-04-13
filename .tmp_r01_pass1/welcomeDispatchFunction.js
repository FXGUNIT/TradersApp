/**
 * ═══════════════════════════════════════════════════════════════════
 * WELCOME DISPATCH - Firebase Cloud Function
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Triggered: functions.auth.user().onCreate
 * Purpose: Send Welcome Email to new users upon registration
 * 
 * Deploy with: firebase deploy --only functions
 * ═══════════════════════════════════════════════════════════════════
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

/**
 * Configure your email transporter here
 * Options:
 * 1. Gmail (requires App Password)
 * 2. SendGrid API
 * 3. Mailgun API
 * 4. Custom SMTP server
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.REGIMENT_EMAIL || 'your-email@gmail.com',
    pass: process.env.REGIMENT_EMAIL_PASSWORD || 'your-app-password'
  }
});

/**
 * WELCOME DISPATCH - Send welcome email on user creation
 */
exports.welcomeDispatch = functions.auth.user().onCreate(async (user) => {
  const email = user.email;
  const displayName = user.displayName || 'Officer';

  console.log(`🎖️ Welcome Dispatch triggered for: ${email}`);

  const mailOptions = {
    from: process.env.REGIMENT_EMAIL || 'noreply@tradersregiment.com',
    to: email,
    subject: 'CLASSIFIED: Welcome to the Regiment, Officer.',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #FFFFFF; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; border-left: 4px solid #1e40af; padding-left: 20px;">
            
            <p style="font-size: 14px; color: #64748B;">Officer,</p>
            
            <p style="font-size: 14px; color: #111827; margin-bottom: 20px;">
              Your credentials have been verified and your clearance is granted.
            </p>
            
            <p style="font-size: 14px; color: #111827; margin-bottom: 20px;">
              You are now standing inside the <strong>Department of Institutional Artillery</strong>. This Command Terminal is equipped with hydrogen-powered encryption and nuclear-grade perimeter defense. We do not tolerate failure, and we do not accept fear.
            </p>
            
            <p style="font-size: 13px; color: #64748B; font-style: italic; margin-bottom: 20px; padding: 15px; background-color: #F9FAFB; border-radius: 6px;">
              "If a man says he is not afraid of losing, he is either lying or he is a Traders Regiment Officer."
            </p>
            
            <p style="font-size: 14px; color: #111827; margin-bottom: 20px;">
              Initialize your deployment and trust your equipment.
            </p>
            
            <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 12px; color: #111827; margin: 5px 0;">
                <strong>Gunit Singh</strong>
              </p>
              <p style="font-size: 12px; color: #64748B; margin: 0;">
                Commander-in-Chief, Traders Regiment
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin-top: 30px;" />
            
            <p style="font-size: 11px; color: #94A3B8; text-align: center; margin-top: 20px;">
              WELCOME TO THE REGIMENT
            </p>
            
          </div>
        </body>
      </html>
    `,
    text: `Officer,

Your credentials have been verified and your clearance is granted.

You are now standing inside the Department of Institutional Artillery. This Command Terminal is equipped with hydrogen-powered encryption and nuclear-grade perimeter defense. We do not tolerate failure, and we do not accept fear.

"If a man says he is not afraid of losing, he is either lying or he is a Traders Regiment Officer."

Initialize your deployment and trust your equipment.

Gunit Singh
Commander-in-Chief, Traders Regiment

WELCOME TO THE REGIMENT`
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome Dispatch email sent to ${email}`);

    // Log registration in Realtime Database
    await db.ref(`users/${user.uid}`).update({
      email: email,
      createdAt: admin.database.ServerValue.TIMESTAMP,
      welcomeEmailSent: true
    });

    return { success: true, message: `Welcome email sent to ${email}` };
  } catch (error) {
    console.error(`❌ Welcome Dispatch failed for ${email}:`, error);
    
    // Log error but don't fail the function
    await db.ref(`users/${user.uid}/emailError`).set({
      error: error.message,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });

    return { success: false, error: error.message };
  }
});

/**
 * OPTIONAL: Send welcome email via HTTP trigger (fallback)
 * Endpoint: POST /sendWelcomeEmail
 * Body: { email, displayName }
 */
exports.sendWelcomeEmailHTTP = functions.https.onCall(async (data, context) => {
  const { email, displayName } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required');
  }

  const mailOptions = {
    from: process.env.REGIMENT_EMAIL || 'noreply@tradersregiment.com',
    to: email,
    subject: 'CLASSIFIED: Welcome to the Regiment, Officer.',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #FFFFFF; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; border-left: 4px solid #1e40af; padding-left: 20px;">
            
            <p style="font-size: 14px; color: #64748B;">Officer,</p>
            
            <p style="font-size: 14px; color: #111827; margin-bottom: 20px;">
              Your credentials have been verified and your clearance is granted.
            </p>
            
            <p style="font-size: 14px; color: #111827; margin-bottom: 20px;">
              You are now standing inside the <strong>Department of Institutional Artillery</strong>. This Command Terminal is equipped with hydrogen-powered encryption and nuclear-grade perimeter defense. We do not tolerate failure, and we do not accept fear.
            </p>
            
            <p style="font-size: 13px; color: #64748B; font-style: italic; margin-bottom: 20px; padding: 15px; background-color: #F9FAFB; border-radius: 6px;">
              "If a man says he is not afraid of losing, he is either lying or he is a Traders Regiment Officer."
            </p>
            
            <p style="font-size: 14px; color: #111827; margin-bottom: 20px;">
              Initialize your deployment and trust your equipment.
            </p>
            
            <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 12px; color: #111827; margin: 5px 0;">
                <strong>Gunit Singh</strong>
              </p>
              <p style="font-size: 12px; color: #64748B; margin: 0;">
                Commander-in-Chief, Traders Regiment
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin-top: 30px;" />
            
            <p style="font-size: 11px; color: #94A3B8; text-align: center; margin-top: 20px;">
              WELCOME TO THE REGIMENT
            </p>
            
          </div>
        </body>
      </html>
    `,
    text: `Officer,

Your credentials have been verified and your clearance is granted.

You are now standing inside the Department of Institutional Artillery. This Command Terminal is equipped with hydrogen-powered encryption and nuclear-grade perimeter defense. We do not tolerate failure, and we do not accept fear.

"If a man says he is not afraid of losing, he is either lying or he is a Traders Regiment Officer."

Initialize your deployment and trust your equipment.

Gunit Singh
Commander-in-Chief, Traders Regiment

WELCOME TO THE REGIMENT`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return { success: true, message: `Welcome email sent to ${email}` };
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});
