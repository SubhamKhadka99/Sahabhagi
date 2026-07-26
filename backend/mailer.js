/**
 * mailer.js — sends the signup OTP via Resend (https://resend.com).
 *
 * If RESEND_API_KEY isn't set, this falls back to printing the OTP to the
 * server console instead of failing the whole signup flow — useful for
 * local development before you've set up an email provider. In production,
 * set RESEND_API_KEY (and verify your sending domain in Resend's dashboard)
 * so emails actually land in inboxes instead of the console.
 */
"use strict";

let resendClient = null;
if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = require("resend");
    resendClient = new Resend(process.env.RESEND_API_KEY);
  } catch (err) {
    console.warn("⚠️  'resend' package not installed — falling back to console OTP delivery:", err.message);
  }
} else {
  console.warn("⚠️  RESEND_API_KEY not set — OTP codes will be printed to the console instead of emailed.");
}

const FROM_ADDRESS = process.env.MAIL_FROM || "SahaBhagi <noreply@sahabhagi.org>";

async function sendOtpEmail(to, otp) {
  if (!resendClient) {
    console.log(`\n📧  [DEV MODE — no email provider configured] OTP for ${to}: ${otp}\n`);
    return;
  }
  await resendClient.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Your SahaBhagi verification code",
    html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes.</p>
           <p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

module.exports = { sendOtpEmail };
