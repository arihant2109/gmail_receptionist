/**
 * Call LLM (Groq or OpenAI-compatible) to get intent and reply from user transcript.
 * Returns { intent, reply } with validated intent; fallback on parse/API failure.
 */

import { SYSTEM_PROMPT, getIntentPrompt, VALID_INTENTS } from './prompts.js';

const DEFAULT_REPLY = "I didn't quite catch that. Could you please repeat or say whether you have an issue, need help booking, or want to make a booking?";
const DEFAULT_INTENT = 'booking_inquiry';

async function getIntentAndReply(transcript) {
  const apiKey = process.env.LLM_API_KEY;
  const provider = (process.env.LLM_PROVIDER || 'groq').toLowerCase();

  if (!apiKey) {
    return { intent: DEFAULT_INTENT, reply: "Our reception service is currently offline. Please send an email with your issue or booking request and we'll get back to you." };
  }

  const userMessage = getIntentPrompt(transcript);
  let body;
  let url;

  if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    body = {
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 256,
      temperature: 0.3,
    };
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    body = {
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 256,
      temperature: 0.3,
    };
  } else {
    return { intent: DEFAULT_INTENT, reply: DEFAULT_REPLY };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('LLM API error:', res.status, errText);
      return { intent: DEFAULT_INTENT, reply: DEFAULT_REPLY };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { intent: DEFAULT_INTENT, reply: DEFAULT_REPLY };

    const parsed = parseJsonResponse(content);
    if (!parsed) return { intent: DEFAULT_INTENT, reply: DEFAULT_REPLY };

    const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : DEFAULT_INTENT;
    const reply = typeof parsed.reply === 'string' && parsed.reply.length > 0
      ? parsed.reply
      : DEFAULT_REPLY;

    return { intent, reply };
  } catch (err) {
    console.error('Intent LLM error:', err.message);
    return { intent: DEFAULT_INTENT, reply: DEFAULT_REPLY };
  }
}

function parseJsonResponse(content) {
  const stripped = content.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1');
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

export { getIntentAndReply, VALID_INTENTS };
