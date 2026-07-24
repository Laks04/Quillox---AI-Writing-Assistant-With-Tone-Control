'use strict';
 
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
// ── Validate keys on startup ─────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_') || GROQ_API_KEY === 'gsk_PASTE_YOUR_KEY_HERE') {
  console.error('\n❌  GROQ_API_KEY is missing or not set in your .env file.');
  process.exit(1);
}
 
// Client token — frontend must send this in every request header
// Set CLIENT_TOKEN in .env to any random string e.g. "quillox-secret-2024"
const CLIENT_TOKEN = process.env.CLIENT_TOKEN || null;
 
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
 
// ── Rate limiting (per IP, in-memory) ───────────────────────────
const rateLimitMap = new Map();
const RATE_WINDOW_MS  = 60 * 1000; // 1 minute window
const RATE_MAX        = 10;         // max requests per window per IP
 
function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_MAX;
}
 
// Clean up stale IPs every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_WINDOW_MS * 2) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);
 
// ── Server-side safety rules ─────────────────────────────────────
const SECURITY_RULES = [
  { re: /ignore\s+(all\s+)?(previous|prior|above|system|your)\s+(instructions?|rules?|prompts?|guidelines?|constraints?)/i, cat: 'Prompt injection' },
  { re: /\b(jailbreak|DAN|do\s+anything\s+now|dan\s+mode|developer\s+mode|god\s+mode|unrestricted\s+mode)\b/i, cat: 'Jailbreak attempt' },
  { re: /forget\s+(you\s+are|your\s+role|your\s+instructions|everything)/i, cat: 'Prompt injection' },
  { re: /pretend\s+(you\s+have\s+no|you\s+are\s+not|there\s+are\s+no)\s+(rules?|restrictions?|filters?|limits?)/i, cat: 'Prompt injection' },
  { re: /act\s+as\s+(if\s+you\s+are\s+)?(an?\s+)?(unrestricted|unfiltered|evil|rogue|uncensored)\s+(AI|model|assistant)/i, cat: 'Jailbreak attempt' },
  { re: /system\s*prompt|<\s*system\s*>|<\/?inst\s*>/i, cat: 'Prompt injection' },
  { re: /\b(chemical\s+weapon|nerve\s+agent|sarin|vx\s+gas|novichok|mustard\s+gas)\b/i, cat: 'Chemical weapon' },
  { re: /\b(biological\s+weapon|weaponize[sd]?\s+(virus|bacteria|pathogen)|bioweapon)\b/i, cat: 'Biological weapon' },
  { re: /\b(nuclear\s+bomb|dirty\s+bomb|radiological\s+weapon|enrich\s+uranium)\b/i, cat: 'Nuclear weapon' },
  { re: /\b(make|build|construct|synthesize|create).{0,40}(bomb|explosive|IED|grenade)\b/i, cat: 'Explosive device' },
  { re: /\b(write|create|build|code|generate).{0,30}(malware|ransomware|keylogger|rootkit|trojan|botnet)\b/i, cat: 'Malware creation' },
  { re: /\b(sql\s+injection|xss\s+payload|reverse\s+shell\s+payload|zero.day\s+exploit)\b/i, cat: 'Exploit code' },
  { re: /\b(hack\s+into|break\s+into|gain\s+(unauthorized|illegal)\s+access\s+to)\b/i, cat: 'Unauthorized access' },
  { re: /\b(phishing\s+(email|page|kit)|credential\s+harvest)\b/i, cat: 'Phishing' },
  { re: /\b(how\s+to|instructions?\s+(to|for)).{0,50}(kill|murder|assassinate)\s+(a\s+)?(person|people|someone)/i, cat: 'Violence' },
  { re: /\b(child|minor|underage|kid).{0,30}(sex|sexual|nude|naked|explicit|porn|grooming)/i, cat: 'Child safety' },
  { re: /\b(loli|shota|cp\b|csam)\b/i, cat: 'Child safety' },
  { re: /\b(how\s+to|best\s+way\s+to).{0,40}(commit\s+suicide|kill\s+myself|self.harm)\b/i, cat: 'Self-harm' },
  { re: /\b(credit\s+card\s+fraud|carding|clone\s+(a\s+)?card)\b/i, cat: 'Financial fraud' },
  { re: /\b(write|generate|create).{0,30}(hate\s+speech|neo.nazi|white\s+supremac)\b/i, cat: 'Hate speech' },
  { re: /\b(synthesis\s+of|how\s+to\s+make).{0,30}(methamphetamine|meth|heroin|fentanyl)\b/i, cat: 'Drug synthesis' },
];
 
function serverSecurityCheck(messages) {
  const userText = messages
    .filter(m => m.role === 'user')
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .join(' ');
 
  for (const rule of SECURITY_RULES) {
    if (rule.re.test(userText)) return { blocked: true, cat: rule.cat };
  }
  return { blocked: false };
}
 
// ── Middleware ───────────────────────────────────────────────────
// Restrict CORS to your own frontend origin
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-client-token'],
}));
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));
 
// ── Auth middleware — validates client token ─────────────────────
function requireClientToken(req, res, next) {
  // If no CLIENT_TOKEN is set in env, skip this check (dev mode)
  if (!CLIENT_TOKEN) return next();
 
  const token = req.headers['x-client-token'];
  if (!token || token !== CLIENT_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized.' } });
  }
  next();
}
 
// ── Proxy route ──────────────────────────────────────────────────
app.post('/api/generate', requireClientToken, async (req, res) => {
  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (checkRateLimit(ip)) {
    return res.status(429).json({ error: { message: 'Too many requests. Please wait a moment and try again.' } });
  }
 
  const { model, max_tokens, temperature, messages } = req.body;
 
  // Input validation
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Missing or invalid messages array.' } });
  }
  if (messages.length > 10) {
    return res.status(400).json({ error: { message: 'Too many messages.' } });
  }
 
  // Server-side safety check
  const safety = serverSecurityCheck(messages);
  if (safety.blocked) {
    console.warn(`[BLOCKED] IP: ${ip} | Category: ${safety.cat}`);
    return res.status(403).json({ error: { message: `Request blocked: ${safety.cat}.` } });
  }
 
  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
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
      const safeMsg = data.error?.message || `Groq API error ${groqRes.status}`;
      return res.status(groqRes.status).json({ error: { message: safeMsg } });
    }
 
    return res.json(data);
 
  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(502).json({ error: { message: 'Could not reach Groq API.' } });
  }
});
 
// ── Catch-all ────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Writing Assistant running at http://localhost:${PORT}`);
  console.log(`    CORS origin: ${allowedOrigin}`);
  console.log(`    Client token auth: ${CLIENT_TOKEN ? 'enabled' : 'disabled (set CLIENT_TOKEN in .env to enable)'}\n`);
});