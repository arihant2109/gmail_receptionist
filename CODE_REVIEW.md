# Code review notes — AI Receptionist (Next.js)

**Scope:** `app/`, `lib/`, `next.config.mjs`, `package.json`  
**Date:** 2026-03-19

---

## Summary

The app is small, readable, and keeps secrets on the server. The main gaps are **operational** (no rate limits, no tests), **UX** (status vs. TTS timing, concurrent requests), and **DRY** (duplicated validation). Safe for **local / trusted** use; **public deploy** needs hardening.

---

## Strengths

| Area | Notes |
|------|--------|
| **Architecture** | Clear split: client UI (`app/page.jsx`), API route (`app/api/process/route.js`), domain logic (`lib/`). |
| **Secrets** | `LLM_API_KEY`, `RESEND_API_KEY`, etc. only referenced from server-side code; not exposed to the client bundle. |
| **Input limits** | Transcript capped at 2000 chars; email length capped; JSON body size guarded via `Content-Length` (see caveats below). |
| **Intent safety** | `VALID_INTENTS` whitelist; invalid LLM output falls back to `booking_inquiry`. |
| **Email recipient** | Issue/booking mail uses only the validated `emailTo` from the request; no env fallback. |
| **Robustness** | LLM/Resend failures degrade to safe user-facing replies / `emailSent: false` without throwing out of the route handler. |
| **Runtime** | `export const runtime = 'nodejs'` on the API route is appropriate for `fetch` + env. |

---

## Security & abuse

1. **No authentication or rate limiting**  
   `POST /api/process` is open to the same origin (and to anyone who can hit your deployment). Attackers could exhaust **Groq/OpenAI** and **Resend** quotas or cost you money.  
   *Mitigation:* API keys in server env, proxy with rate limits, auth, or edge middleware; consider CAPTCHA only if exposed to browsers you don’t trust.

2. **`Content-Length` is not a hard ceiling**  
   Clients can omit or lie about `Content-Length`; chunked bodies may not be checked until `request.json()` runs. Very large JSON could still stress memory.  
   *Mitigation:* Next.js body size limits / streaming limits where applicable, or validate size after reading (trade-offs apply).

3. **“Open recipient” email design**  
   Any client can POST an arbitrary `emailTo` (if valid format). For a **public** site this behaves like sending mail **to addresses the caller chooses** (your Resend account sends). That may be acceptable for a “email me a copy” product but is **abuse-prone** without throttles and abuse monitoring.

4. **Prompt injection**  
   User transcript is embedded in the LLM user message. The system prompt asks for JSON-only output; intent is still **validated** server-side. Residual risk: weird replies or token waste, not arbitrary code execution.

5. **JSON extraction (`parseJsonResponse`)**  
   The regex grabs the first `{...}` block. If the model ever returned nested objects or extra braces in free text, parsing could fail or mis-parse. Low probability with a short JSON-only instruction; **structured output** APIs would be tighter.

---

## Correctness & UX

1. **Status vs. speech timing** (`app/page.jsx`)  
   After a successful response, the code sets “Speaking reply…”, calls `speak()`, then **immediately** sets “Reply delivered…”. `speechSynthesis.speak` is asynchronous, so the UI message can be **wrong** until you hook `utterance.onend` (or similar).

2. **Double submissions**  
   While `/api/process` is in flight, the user can trigger another recognition cycle or rapid repeats. There is no **global “processing” lock** on the button or recognition.  
   *Mitigation:* `processing` state; disable mic / ignore new results until the request completes.

3. **Speech `useEffect` dependencies**  
   The effect depends on `[log, processTranscript]`. Changing **email** changes `processTranscript`, which **rebuilds** `SpeechRecognition` and runs cleanup (`abort`). Usually fine; could surprise users mid-session.

4. **README vs. behavior**  
   README still suggests booking inquiry “can send email”; the API only sends for **`issue`** and **`booking`**. Align docs with code (or change code if product intent differs).

5. **Log list growth**  
   `logs` append forever → long sessions could grow memory. Optional cap (e.g. last 50 entries) or clear button.

---

## Maintainability

1. **Duplicated `isValidEmail`**  
   Same logic in `app/page.jsx` and `app/api/process/route.js`. Prefer one module, e.g. `lib/validation.js`, imported from both (client + server).

2. **Magic strings**  
   Intent strings and email subjects are repeated; a small constants map would help.

3. **No automated tests**  
   No unit tests for validation, `parseJsonResponse`, or route handler behavior. High value for **regressions** when changing prompts or API shape.

4. **`package.json` scripts**  
   Only `dev` / `build` / `start`. Adding `lint` (ESLint) is optional but improves consistency on teams.

---

## Performance & reliability

1. **No timeouts** on LLM or Resend `fetch` calls — slow or stuck upstream can hold the route open until the platform times out.

2. **LLM cost/latency**  
   Every valid transcript hits the LLM; no caching or deduplication (probably fine for this use case).

---

## Accessibility & polish

1. **`aria-live`** on both status and log can be noisy for screen readers when many log lines append. Consider **one** live region for critical status, or `aria-relevant="additions"` tuning.

2. **Layout metadata**  
   `app/layout.jsx` could add `viewport` / theme metadata for mobile (Next.js 15 `viewport` export).

---

## Dependencies

- **Lean stack** — Next + React only; no unnecessary packages. Good.
- Run **`npm audit`** periodically; address moderate/high issues without blind `--force`.

---

## Suggested priority order

1. **P0 (if public):** Rate limiting + abuse considerations for email recipient and LLM.  
2. **P1:** Fix TTS/status sync; optional **processing** lock to prevent overlapping requests.  
3. **P2:** Shared `isValidEmail`; cap log length; align README with email intents.  
4. **P3:** Tests for validation + API route; fetch timeouts; structured LLM output where supported.

---

## Conclusion

**Verdict:** Solid **MVP / internal / localhost** receptionist. Before **wide production**, add **rate limiting**, clarify **email abuse** model, and tighten **UX** around async speech and concurrent requests.
