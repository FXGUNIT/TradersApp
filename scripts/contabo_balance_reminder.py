"""
Contabo VPS Balance Reminder

Sends Telegram + Email reminder if balance < $15 before monthly billing (1st of month).
Runs via GitHub Actions cron: 28th, 29th, 30th each month.

Usage (local dev / manual trigger):
  python scripts/contabo_balance_reminder.py --check

Env vars required:
  TELEGRAM_BOT_TOKEN    — bot token for sendMessage API
  TELEGRAM_ADMIN_CHAT_IDS — comma-separated admin chat IDs (your TG chat ID)
  EMAILJS_SERVICE_ID    — EmailJS service ID
  EMAILJS_TEMPLATE_ID  — EmailJS template ID for balance reminder
  EMAILJS_PUBLIC_KEY    — EmailJS public key
  ADMIN_EMAIL          — destination email (gunitsingh1994@gmail.com)
  CONTABO_CUSTOMER_ID  — Contabo customer ID for API login
  CONTABO_API_PASSWORD — Contabo API password
  MINIMUM_BALANCE      — alert threshold (default: 15)
"""

import os
import sys
import argparse
import json
import urllib.request
import urllib.error
from datetime import datetime

# ─── Config ──────────────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_IDS = [
    cid.strip()
    for cid in os.getenv("TELEGRAM_ADMIN_CHAT_IDS", "").split(",")
    if cid.strip()
]
EMAILJS_SERVICE_ID = os.getenv("EMAILJS_SERVICE_ID", "")
EMAILJS_TEMPLATE_ID = os.getenv("EMAILJS_TEMPLATE_ID", "")
EMAILJS_PUBLIC_KEY = os.getenv("EMAILJS_PUBLIC_KEY", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", os.getenv("VITE_ADMIN_EMAIL", ""))
MINIMUM_BALANCE = float(os.getenv("MINIMUM_BALANCE", "15"))
CONTABO_CUSTOMER_ID = os.getenv("CONTABO_CUSTOMER_ID", "")
CONTABO_API_PASSWORD = os.getenv("CONTABO_API_PASSWORD", "")

CENTRAL_EUROPE_TZ = "Europe/Berlin"

TODAY = datetime.now()


# ─── Telegram ─────────────────────────────────────────────────────────────────


def send_telegram(message: str) -> bool:
    """Send a message directly to admin chat IDs via Bot API (no Telegram bridge needed)."""
    if not TELEGRAM_BOT_TOKEN or not ADMIN_CHAT_IDS:
        print("[Telegram] BOT_TOKEN or ADMIN_CHAT_IDS not set — skipping")
        return False

    for chat_id in ADMIN_CHAT_IDS:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = json.dumps(
            {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
        ).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read())
                if body.get("ok"):
                    print(f"[Telegram] Sent to {chat_id}")
                else:
                    print(f"[Telegram] Failed to {chat_id}: {body}")
        except Exception as e:
            print(f"[Telegram] Error sending to {chat_id}: {e}")
    return True


# ─── EmailJS ──────────────────────────────────────────────────────────────────


def send_email_emailjs(subject: str, body: str) -> bool:
    """Send via EmailJS (no SMTP server needed)."""
    if not all([EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, ADMIN_EMAIL]):
        print("[Email] EMAILJS_* vars or ADMIN_EMAIL not set — skipping")
        return False

    import urllib.request

    url = f"https://api.emailjs.com/api/v1.0/email/send"
    payload = {
        "service_id": EMAILJS_SERVICE_ID,
        "template_id": EMAILJS_TEMPLATE_ID,
        "user_id": EMAILJS_PUBLIC_KEY,
        "template_params": {
            "to_email": ADMIN_EMAIL,
            "subject": subject,
            "message": body,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[Email] Sent to {ADMIN_EMAIL} via EmailJS")
            return True
    except Exception as e:
        print(f"[Email] Failed: {e}")
        return False


# ─── Contabo API ────────────────────────────────────────────────────────────────


def get_contabo_balance() -> float | None:
    """Fetch current account balance via Contabo REST API."""
    if not CONTABO_CUSTOMER_ID or not CONTABO_API_PASSWORD:
        print("[Contabo] CONTABO_CUSTOMER_ID or CONTABO_API_PASSWORD not set — skipping API check")
        return None

    try:
        # Step 1: Login to get session cookie
        login_url = "https://api.contabo.com/auth/login"
        login_payload = json.dumps({
            "username": CONTABO_CUSTOMER_ID,
            "password": CONTABO_API_PASSWORD,
        }).encode("utf-8")
        login_req = urllib.request.Request(
            login_url,
            data=login_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(login_req, timeout=15) as resp:
            login_data = json.loads(resp.read())
        # Contabo API v1 uses Bearer token in login response
        token = login_data.get("token") or login_data.get("access_token") or ""
        if not token:
            # Try cookies approach
            import http.cookiejar
            cj = http.cookiejar.CookieJar()
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            opener.open(login_req)
            print("[Contabo] Using cookie-based auth (experimental)")
            return None

        # Step 2: Fetch account balance
        account_url = "https://api.contabo.com/v1/account"
        account_req = urllib.request.Request(
            account_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="GET",
        )
        with urllib.request.urlopen(account_req, timeout=15) as resp:
            account_data = json.loads(resp.read())
        # Balance is typically in account.items or a balance field
        items = account_data.get("data", []) if isinstance(account_data, dict) else []
        for item in items:
            if item.get("category") == "BALANCE" or "balance" in str(item).lower():
                return float(item.get("balance", 0))
        return None
    except Exception as e:
        print(f"[Contabo] API error: {e}")
        return None


# ─── Manual balance report ────────────────────────────────────────────────────


def manual_report():
    """
    For when Contabo API is unavailable (no credentials stored in GitHub secrets).
    Send a reminder asking the user to check their Contabo balance manually.
    """
    next_billing = "May 1st, 2026"
    message = f"""⚠️ <b>Contabo VPS Balance Reminder</b>

Hi! Monthly billing for TradersApp VPS (<code>173.249.18.14</code>) renews on <b>{next_billing}</b>.

<b>Monthly cost:</b> $10.40 (Cloud VPS 20 NVMe + Auto Backup)
<b>Payment date:</b> 1st of every month
<b>Current balance:</b> Please check manually at <a href="https://new.contabo.com/account/billing/payment-history">new.contabo.com</a>

<b>⚡ Action needed:</b>
• Log into https://new.contabo.com
• Check your balance under Account → Billing &amp; Payment
• Ensure balance ≥ $15 before {next_billing.split(',')[0]}

If balance is low → <b>Top Up Balance</b> now to avoid service interruption.
The VPS auto-renews via credit card (Visa ending 6497) on the 1st.
"""

    email_body = f"""Contabo VPS Balance Reminder

Monthly billing for TradersApp VPS (173.249.18.14) renews on {next_billing}.
Monthly cost: $10.40. Payment date: 1st of every month.

Action needed:
- Log into https://new.contabo.com
- Check your balance under Account → Billing & Payment
- Ensure balance >= $15 before {next_billing}

If balance is low → Top Up Balance now to avoid service interruption.
"""

    tg_sent = send_telegram(message)
    email_sent = send_email_emailjs(
        subject=f"⚠️ Contabo VPS Balance Reminder — renews {next_billing}",
        body=email_body,
    )
    print(f"[Done] TG={tg_sent}, Email={email_sent}")


# ─── Alert check ───────────────────────────────────────────────────────────────


def run_alert_check():
    """
    Check balance via API and send alerts if balance < MINIMUM_BALANCE.
    Falls back to manual reminder if API unavailable.
    """
    print(f"[{TODAY.isoformat()}] Contabo balance check starting...")
    balance = get_contabo_balance()

    if balance is None:
        # No API credentials — fallback to manual reminder
        print("[Contabo] No API credentials — sending manual reminder")
        manual_report()
        return

    print(f"[Contabo] Current balance: ${balance:.2f}")

    if balance < MINIMUM_BALANCE:
        next_billing = "May 1st, 2026"
        urgent = f"""🚨 <b>Contabo VPS — LOW BALANCE ALERT</b>

Your TradersApp VPS (173.249.18.14) balance is critically low:

<b>Current balance:</b> ${balance:.2f}
<b>Minimum safe:</b> ${MINIMUM_BALANCE:.2f}
<b>Monthly cost:</b> $10.40
<b>Next billing:</b> {next_billing}

⚠️ <b>Top up NOW at https://new.contabo.com/account/billing</b>
If balance hits $0 before the 1st, your VPS may be suspended.
"""
        send_telegram(urgent)
        send_email_emailjs(
            subject=f"🚨 Contabo LOW BALANCE — ${balance:.2f} — top up now!",
            body=urgent.replace("<b>", "").replace("</b>", "").replace("<code>", "").replace("</code>", "").replace("<a href=\"...>", "").replace("</a>", "").replace("⚠️", "[ACTION REQUIRED]"),
        )
    else:
        print(f"[Contabo] Balance OK (${balance:.2f} >= ${MINIMUM_BALANCE:.2f})")


# ─── CLI ──────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Contabo VPS balance reminder")
    parser.add_argument("--check", action="store_true", help="Run API balance check + send alerts if needed")
    parser.add_argument("--manual", action="store_true", help="Send manual reminder (no API check)")
    args = parser.parse_args()

    if args.check:
        run_alert_check()
    elif args.manual:
        manual_report()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
