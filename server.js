'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Validate key on startup ──────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_') || GROQ_API_KEY === 'gsk_PASTE_YOUR_KEY_HERE') {
  console.error('\n❌  GROQ_API_KEY is missing or not set in your .env file.');
  console.error('    Open .env and replace gsk_PASTE_YOUR_KEY_HERE with your real key.\n');
  process.exit(1);
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '64kb' }));

// Serve the frontend (public/ folder)
app.use(express.static(path.join(__dirname, 'public')));

// ── Proxy route — the browser NEVER sees the key ────────────────
app.post('/api/generate', async (req, res) => {
  const { model, max_tokens, temperature, messages } = req.body;

  // Basic validation
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Missing or invalid messages array.' } });
  }
  if (messages.length > 10) {
    return res.status(400).json({ error: { message: 'Too many messages.' } });
  }

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,   // key stays on the server
      },
      body: JSON.stringify({
        model:       model       || 'llama-3.3-70b-versatile',
        max_tokens:  max_tokens  || 1024,
        temperature: temperature ?? 0.7,
        messages,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      // Forward Groq's error status but scrub auth details
      const safeMsg = data.error?.message || `Groq API error ${groqRes.status}`;
      return res.status(groqRes.status).json({ error: { message: safeMsg } });
    }

    return res.json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(502).json({ error: { message: 'Could not reach Groq API. Check your internet connection.' } });
  }
});

// ── Catch-all: serve index.html for any unmatched route ─────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Writing Assistant running at http://localhost:${PORT}`);
  console.log('    API key is secure — stored in .env, never sent to the browser.\n');
});
