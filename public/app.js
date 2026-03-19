/**
 * AI Receptionist frontend: Web Speech API (STT + TTS), call /api/process, show intent and email status.
 */

(function () {
  const btnToggle = document.getElementById('btnToggle');
  const statusEl = document.getElementById('status');
  const logList = document.getElementById('logList');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SpeechSynthesis = window.speechSynthesis;

  if (!SpeechRecognition) {
    statusEl.textContent = 'Speech recognition is not supported in this browser. Use Chrome or Edge.';
    btnToggle.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let isListening = false;

  function log(message, type) {
    const li = document.createElement('li');
    li.className = type || 'info';
    li.textContent = message;
    logList.appendChild(li);
    logList.scrollTop = logList.scrollHeight;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function speak(text) {
    if (!text || !SpeechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  async function processTranscript(transcript) {
    setStatus('Processing…');
    log('You: ' + transcript, 'user');

    try {
      const base = window.location.origin;
      const res = await fetch(base + '/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }

      const data = await res.json();
      log('Intent: ' + data.intent, 'intent');
      log('Reply: ' + data.reply, 'reply');
      if (data.emailSent === true) {
        log('Email sent.', 'email');
      } else if (data.emailSent === false) {
        log('Email not sent (check server config).', 'warn');
      }

      setStatus('Speaking reply…');
      speak(data.reply);
      setStatus('Reply delivered. You can speak again or stop.');
    } catch (err) {
      log('Error: ' + err.message, 'error');
      setStatus('Error: ' + err.message);
      speak("Sorry, something went wrong. Please try again.");
    }
  }

  function startListening() {
    recognition.start();
    isListening = true;
    btnToggle.textContent = 'Stop listening';
    setStatus('Listening… speak now.');
    log('Listening…', 'info');
  }

  function stopListening() {
    recognition.abort();
    isListening = false;
    btnToggle.textContent = 'Start listening';
    setStatus('Stopped.');
    log('Stopped.', 'info');
  }

  recognition.onresult = function (event) {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.trim();
    if (transcript) {
      processTranscript(transcript);
    } else {
      setStatus('No speech detected. Try again.');
    }
    btnToggle.textContent = 'Start listening';
    isListening = false;
  };

  recognition.onerror = function (event) {
    if (event.error === 'aborted') return;
    log('Recognition error: ' + event.error, 'error');
    setStatus('Error: ' + event.error);
    isListening = false;
    btnToggle.textContent = 'Start listening';
  };

  recognition.onend = function () {
    if (isListening) {
      btnToggle.textContent = 'Start listening';
      isListening = false;
      setStatus('Listening ended. Click "Start listening" to try again.');
    }
  };

  btnToggle.addEventListener('click', function () {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
})();
