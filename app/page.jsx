'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_EMAIL_LENGTH = 254;

const MAX_TRANSCRIPT_INPUT = 2000;

/**
 * Web Speech API errors. "network" = browser could not reach the cloud STT (e.g. Google), not your Next.js server.
 * Windows "Online speech recognition" is separate and does not guarantee Chrome can reach Google's Web Speech backend.
 */
function getSpeechRecognitionMessages(code) {
  switch (code) {
    case 'network':
      return {
        status:
          "Can't reach the browser's speech servers. Try another network or use “Type instead” below.",
        log:
          'Chrome/Edge send your audio to Google’s cloud for transcription. That is different from Windows Settings → Privacy → Speech. If Speech is already on and you still see this: try a phone hotspot, turn off VPN, switch network or DNS (e.g. 1.1.1.1), or check firewall/antivirus HTTPS inspection — or type your message below.',
      };
    case 'not-allowed':
      return {
        status: 'Microphone blocked. Allow mic for this site in the address bar.',
      };
    case 'no-speech':
      return {
        status: 'No speech heard. Speak closer to the mic or use “Type instead” below.',
      };
    case 'audio-capture':
      return {
        status: 'No microphone found or it is in use by another app.',
      };
    case 'service-not-allowed':
      return {
        status: 'Speech recognition is disabled in browser or system settings.',
      };
    default:
      return { status: `Recognition error: ${code}` };
  }
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s.length < 3 || s.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function Home() {
  const [status, setStatus] = useState(
    'Stopped. Click "Start listening" and allow microphone when prompted.'
  );
  const [logs, setLogs] = useState([]);
  const [emailTo, setEmailTo] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [typedMessage, setTypedMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const logContainerRef = useRef(null);
  const processingRef = useRef(false);

  const log = useCallback((message, type) => {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, message, type: type || 'info' },
    ]);
  }, []);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const speak = useCallback((text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const processTranscript = useCallback(
    async (transcript) => {
      const trimmed = typeof transcript === 'string' ? transcript.trim() : '';
      if (!trimmed) {
        setStatus('Enter a message or use the microphone.');
        return;
      }

      const trimmedEmail = emailTo.trim();
      if (!isValidEmail(trimmedEmail)) {
        setStatus('Please enter a valid email address first.');
        log('Enter your email in the form above, then try again.', 'warn');
        return;
      }

      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);
      setStatus('Processing…');
      log(`You: ${trimmed}`, 'user');

      try {
        const res = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: trimmed, emailTo: trimmedEmail }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || res.statusText);
        }

        const data = await res.json();
        log(`Intent: ${data.intent}`, 'intent');
        log(`Reply: ${data.reply}`, 'reply');
        if (data.emailSent === true) {
          log('Email sent.', 'email');
        } else if (data.emailSent === false) {
          log('Email not sent (check server config).', 'warn');
        }

        setTypedMessage('');
        setStatus('Speaking reply…');
        speak(data.reply);
        setStatus('Reply delivered. You can speak or type again.');
      } catch (err) {
        log(`Error: ${err.message}`, 'error');
        setStatus(`Error: ${err.message}`);
        speak('Sorry, something went wrong. Please try again.');
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [emailTo, log, speak]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setStatus('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim();
      if (transcript) {
        processTranscript(transcript);
      } else {
        setStatus('No speech detected. Try again.');
      }
      listeningRef.current = false;
      setListening(false);
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      const msgs = getSpeechRecognitionMessages(event.error);
      log(msgs.log || msgs.status, 'error');
      setStatus(msgs.status);
      listeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        listeningRef.current = false;
        setListening(false);
        setStatus('Listening ended. Click "Start listening" to try again.');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [log, processTranscript]);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!speechSupported || !recognition || processing) return;

    if (listening) {
      recognition.abort();
      listeningRef.current = false;
      setListening(false);
      setStatus('Stopped.');
      log('Stopped.', 'info');
    } else {
      listeningRef.current = true;
      setListening(true);
      recognition.start();
      setStatus('Listening… speak now.');
      log('Listening…', 'info');
    }
  }

  return (
    <div className="container">
      <header>
        <h1>AI Receptionist</h1>
        <p className="subtitle">
          Say or type your issue, booking inquiry, or booking. Replies by voice; issues and bookings are
          sent by email.
        </p>
      </header>

      <main>
        <div className="email-form">
          <label htmlFor="emailTo">Your email</label>
          <p className="field-hint">Issue and booking summaries are sent to this address.</p>
          <input
            type="email"
            id="emailTo"
            name="emailTo"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            maxLength={MAX_EMAIL_LENGTH}
            aria-required="true"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
        </div>

        <div className="controls">
          <button
            type="button"
            className="btn-toggle"
            aria-label="Start or stop listening"
            disabled={!speechSupported || processing}
            onClick={toggleListening}
          >
            {listening ? 'Stop listening' : 'Start listening'}
          </button>
        </div>

        <div className="type-fallback">
          <label htmlFor="typedMessage">Or type your message</label>
          <p className="field-hint">
            Use this if voice shows a network error — same as speaking, no separate service.
          </p>
          <textarea
            id="typedMessage"
            name="typedMessage"
            rows={3}
            maxLength={MAX_TRANSCRIPT_INPUT}
            placeholder="e.g. I need to change my booking for Saturday…"
            value={typedMessage}
            disabled={processing}
            onChange={(e) => setTypedMessage(e.target.value)}
          />
          <button
            type="button"
            className="btn-send-typed"
            disabled={processing || !typedMessage.trim()}
            onClick={() => processTranscript(typedMessage)}
          >
            {processing ? 'Processing…' : 'Send typed message'}
          </button>
        </div>

        <div className="status" aria-live="polite">
          {status}
        </div>

        <div className="log" aria-live="polite">
          <div className="log-label">Activity</div>
          <ul className="log-list" ref={logContainerRef}>
            {logs.map((entry) => (
              <li key={entry.id} className={entry.type}>
                {entry.message}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
