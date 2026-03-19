import { NextResponse } from 'next/server';
import { getIntentAndReply } from '@/lib/intent';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const MAX_TRANSCRIPT_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;
const MAX_BODY_BYTES = 12 * 1024;

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s.length < 3 || s.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseRecipientEmail(body) {
  const raw = body?.emailTo;
  if (!isValidEmail(raw)) return undefined;
  return raw.trim();
}

function sanitizeTranscript(text) {
  if (typeof text !== 'string') return '';
  return text.slice(0, MAX_TRANSCRIPT_LENGTH).trim();
}

export async function POST(request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const transcript = sanitizeTranscript(body?.transcript);
  if (!transcript) {
    return NextResponse.json({ error: 'Missing or invalid transcript' }, { status: 400 });
  }

  const recipientEmail = parseRecipientEmail(body);
  if (!recipientEmail) {
    return NextResponse.json(
      {
        error:
          'A valid emailTo is required in the request body. The server does not use a default recipient for email.',
      },
      { status: 400 }
    );
  }

  const { intent, reply } = await getIntentAndReply(transcript);

  const shouldSendEmail = ['issue', 'booking'].includes(intent);
  let emailSent = false;

  if (shouldSendEmail) {
    const subject = intent === 'issue'
      ? '[Receptionist] Issue'
      : '[Receptionist] Booking';
    const emailBody = [
      `Intent: ${intent}`,
      '',
      'Transcript:',
      transcript,
    ].join('\n');

    const result = await sendEmail({ to: recipientEmail, subject, body: emailBody });
    emailSent = result.ok;
  }

  return NextResponse.json({
    reply,
    intent,
    emailSent: shouldSendEmail ? emailSent : null,
  });
}
