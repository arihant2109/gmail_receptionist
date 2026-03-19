# AI Receptionist

Local AI receptionist: speak via your laptop mic, get a voice reply, and have issues and bookings sent by email. Uses free resources and JavaScript (Node.js + browser).

## What it does

- **Input**: Laptop microphone (browser Web Speech API).
- **Intents**: Classifies what the customer said as:
  - **Issue** – problem or complaint → sends email.
  - **Booking inquiry** – questions about availability or how to book → can send email.
  - **Booking** – concrete booking request → sends email.
- **Output**: Speaks a short reply (Text-to-Speech) and sends relevant emails (Resend). Everything is handled via email; no separate ticket system.

## Run locally

1. **Clone or open the project**, then install dependencies:

   ```bash
   npm install
   ```

2. **Configure environment** (required for LLM and email):

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least:

   - `LLM_API_KEY` – from [Groq](https://console.groq.com) (free) or OpenAI.
   - `LLM_PROVIDER` – `groq` or `openai`.
   - `RESEND_API_KEY` – from [Resend](https://resend.com) (free tier).
   - `EMAIL_TO` – address where issues and bookings are sent.

3. **Start the server**:

   ```bash
   npm run dev
   ```

4. **Open in browser**: go to [http://localhost:3000](http://localhost:3000).

5. **Allow microphone** when the browser asks. Click **Start listening**, speak (e.g. “I have an issue with my booking” or “I want to book a table for two at 7pm”), and the app will reply by voice and send an email when the intent is issue or booking.

## Project structure

- `implementation-plan.md` – Implementation plan (architecture, intents, flow, stack).
- `server/` – Express backend: `/api/process`, intent + reply via LLM, email sending.
- `public/` – Static frontend: mic (STT), TTS, activity log.

## Configuration

See `.env.example` for all options. No secrets should be committed; use `.env` (ignored by git) for real values.

## Free tier limits

- **Groq / OpenAI**: rate and daily limits; keep usage moderate.
- **Resend**: 3,000 emails/month free.
- **Web Speech API**: works in Chrome/Edge; may require HTTPS in production (localhost is fine without HTTPS).
