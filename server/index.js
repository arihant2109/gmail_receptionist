/**
 * AI Receptionist backend: Express server, /api/process (intent + reply + email), static frontend.
 * CORS limited to localhost; transcript length validated.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIntentAndReply } from './intent.js';
import { sendEmail } from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_TRANSCRIPT_LENGTH = 2000;

app.use(cors({ origin: ['http://localhost:' + PORT, 'http://127.0.0.1:' + PORT] }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function sanitizeTranscript(text) {
  if (typeof text !== 'string') return '';
  return text.slice(0, MAX_TRANSCRIPT_LENGTH).trim();
}

app.post('/api/process', async (req, res) => {
  const raw = req.body?.transcript;
  const transcript = sanitizeTranscript(raw);

  if (!transcript) {
    return res.status(400).json({ error: 'Missing or invalid transcript' });
  }

  const { intent, reply } = await getIntentAndReply(transcript);

  const shouldSendEmail = ['issue', 'booking'].includes(intent);
  let emailSent = false;

  if (shouldSendEmail) {
    const subject = intent === 'issue'
      ? '[Receptionist] Issue'
      : '[Receptionist] Booking';
    const body = [
      `Intent: ${intent}`,
      '',
      'Transcript:',
      transcript,
    ].join('\n');

    const result = await sendEmail({ subject, body });
    emailSent = result.ok;
  }

  res.json({
    reply,
    intent,
    emailSent: shouldSendEmail ? emailSent : null,
  });
});

app.listen(PORT, () => {
  console.log(`AI Receptionist running at http://localhost:${PORT}`);
});
