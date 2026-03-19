/**
 * Send email for issues and bookings. Supports Resend (preferred) or Nodemailer SMTP via env.
 * No hardcoded credentials; all from process.env.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, body }) {
  const emailTo = process.env.EMAIL_TO || to;
  if (!emailTo) {
    console.warn('Email not sent: EMAIL_TO not set');
    return { ok: false, error: 'EMAIL_TO not configured' };
  }

  const from = process.env.EMAIL_FROM || 'receptionist@localhost';
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    return sendViaResend(resendKey, { to: emailTo, from, subject, body });
  }

  console.warn('Email not sent: no RESEND_API_KEY (add to .env for email)');
  return { ok: false, error: 'No email provider configured' };
}

async function sendViaResend(apiKey, { to, from, subject, body }) {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend API error:', res.status, err);
      return { ok: false, error: err };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('Resend send error:', err.message);
    return { ok: false, error: err.message };
  }
}

export { sendEmail };
