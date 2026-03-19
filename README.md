# AI Receptionist

Local AI receptionist: speak via your laptop mic, get a voice reply, and have issues and bookings sent by email. Built with **Next.js** (App Router), React, and the browser Web Speech API.

## What it does

- **Input**: Laptop microphone (browser Web Speech API).
- **Intents**: Classifies what the customer said as:
  - **Issue** – problem or complaint → sends email.
  - **Booking inquiry** – questions about availability or how to book.
  - **Booking** – concrete booking request → sends email.
- **Output**: Speaks a short reply (Text-to-Speech) and sends relevant emails (Resend). Everything is handled via email; no separate ticket system.

## Run locally

1. **Install dependencies**:

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
   - **Your email** on the page is sent as `emailTo` on each request; issues and bookings require a valid `emailTo` (the server does not use a hidden default recipient).

   Next.js loads `.env` automatically (no extra package).

3. **Development server**:

   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000).

5. **Enter your email** in the form (required before processing speech). **Allow microphone** when the browser asks. Click **Start listening**, speak (e.g. “I have an issue with my booking” or “I want to book a table for two at 7pm”), and the app will reply by voice and send an email to that address when the intent is issue or booking.

## Production build

```bash
npm run build
npm start
```

## Project structure

- `implementation-plan.md` – Implementation plan (architecture, intents, flow).
- `app/` – Next.js App Router: `page.jsx` (client UI), `api/process/route.js` (POST handler), `layout.jsx`, `globals.css`.
- `lib/` – Shared server logic: `intent.js`, `prompts.js`, `email.js` (used by the API route).

## Configuration

See `.env.example` for all options. Do not commit secrets; use `.env` (ignored by git).

## Troubleshooting: “Recognition error: network”

In **Chrome** and **Edge**, speech-to-text is handled by a **cloud service** (Google). The `network` error means the browser **could not reach that service** — it is not an error from this app’s API.

**Windows “Online speech recognition”** (Settings → Privacy → Speech) is **not the same** as Chrome talking to Google’s Web Speech backend. You can have it enabled and still see `network` if something on the path blocks **Google**.

Try:

1. Use **Or type your message** on the home page — same API, no Google STT.
2. Another network: **phone hotspot** vs Wi‑Fi often isolates router/firewall issues.
3. **VPN / corporate firewall / proxy** — try without VPN or on a non-managed network.
4. **DNS** — temporarily try Cloudflare (`1.1.1.1`) or Google (`8.8.8.8`) in system or router settings.
5. **Antivirus “HTTPS scanning” / SSL inspection** — can break some browser services; test with it off briefly.
6. **Extensions** — incognito with extensions disabled.
7. Use **Chrome or Edge** (Chromium).

For a fully voice-based fix without Google’s browser STT, you’d add **server-side transcription** (e.g. Whisper API) — not in this repo by default.

## Free tier limits

- **Groq / OpenAI**: rate and daily limits; keep usage moderate.
- **Resend**: 3,000 emails/month free.
- **Web Speech API**: works in Chrome/Edge; production may require HTTPS (localhost is fine without HTTPS).
