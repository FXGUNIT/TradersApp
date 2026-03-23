// Email utilities for Invite + Welcome emails via EmailJS (front-end)
// This file uses environment variables to avoid leaking keys.
import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_INVITE = import.meta.env.VITE_EMAILJS_TEMPLATE_INVITE
const TEMPLATE_WELCOME = import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME
const USER_ID = import.meta.env.VITE_EMAILJS_USER_ID

export async function sendInviteEmail(email, name = '') {
  if (!SERVICE_ID || !TEMPLATE_INVITE) {
    console.warn('EmailJS not configured for invite emails');
    return { ok: true };
  }
  try {
    const tplParams = {
      to_email: email,
      to_name: name,
      subject: 'Traders Regiment Invite — You Are Invited',
    }
    await emailjs.send(SERVICE_ID, TEMPLATE_INVITE, tplParams, USER_ID);
    return { ok: true }
  } catch (err) {
    console.error('Invite email failed', err)
    return { ok: false, error: err?.message ?? 'unknown' }
  }
}

export async function sendWelcomeEmail(email, name = '') {
  if (!SERVICE_ID || !TEMPLATE_WELCOME) {
    console.warn('EmailJS not configured for welcome emails');
    return { ok: true };
  }
  try {
    const tplParams = {
      to_email: email,
      to_name: name,
      subject: 'Welcome to Traders Regiment',
    }
    await emailjs.send(SERVICE_ID, TEMPLATE_WELCOME, tplParams, USER_ID);
    return { ok: true }
  } catch (err) {
    console.error('Welcome email failed', err)
    return { ok: false, error: err?.message ?? 'unknown' }
  }
}

export default { sendInviteEmail, sendWelcomeEmail }
