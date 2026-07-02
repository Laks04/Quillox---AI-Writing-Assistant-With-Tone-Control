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
  process.exit(1);
}
 
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
 
// ── Rate limiting (per IP) ───────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX       = 10;         // max 10 requests per minute per IP
 
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX;
}
 
// ── Security rules (moved from frontend) ────────────────────────
const SECURITY_RULES = [
  // Prompt injection / jailbreak
  { re: /ignore\s+(all\s+)?(previous|prior|above|system|your)\s+(instructions?|rules?|prompts?|guidelines?|constraints?)/i, cat: 'Prompt injection' },
  { re: /\b(jailbreak|DAN|do\s+anything\s+now|dan\s+mode|developer\s+mode|god\s+mode|unrestricted\s+mode)\b/i, cat: 'Jailbreak attempt' },
  { re: /forget\s+(you\s+are|your\s+role|your\s+instructions|everything)/i, cat: 'Prompt injection' },
  { re: /pretend\s+(you\s+have\s+no|you\s+are\s+not|there\s+are\s+no)\s+(rules?|restrictions?|filters?|limits?)/i, cat: 'Prompt injection' },
  { re: /act\s+as\s+(if\s+you\s+are\s+)?(an?\s+)?(unrestricted|unfiltered|evil|rogue|uncensored)\s+(AI|model|assistant)/i, cat: 'Jailbreak attempt' },
  { re: /system\s*prompt|<\s*system\s*>|<\/?inst\s*>/i, cat: 'Prompt injection' },
 
  // CBRN weapons
  { re: /\b(chemical\s+weapon|nerve\s+agent|sarin|vx\s+gas|novichok|mustard\s+gas|weaponize[sd]?\s+anthrax)\b/i, cat: 'Chemical/biological weapon' },
  { re: /\b(biological\s+weapon|weaponize[sd]?\s+(virus|bacteria|pathogen)|bioweapon)\b/i, cat: 'Biological weapon' },
  { re: /\b(nuclear\s+bomb|dirty\s+bomb|radiological\s+weapon|enrich\s+uranium|detonate\s+nuclear)\b/i, cat: 'Nuclear/radiological weapon' },
  { re: /\b(make|build|construct|synthesize|create).{0,40}(bomb|explosive|IED|grenade|landmine)\b/i, cat: 'Explosive device' },
  { re: /\b(how\s+to\s+make|instructions?\s+for|recipe\s+for|synthesis\s+of).{0,40}(poison|toxin|ricin|cyanide)\b/i, cat: 'Dangerous substance' },
 
  // Malware / cyberweapons
  { re: /\b(write|create|build|code|generate|develop).{0,30}(malware|ransomware|keylogger|rootkit|trojan|botnet|worm|spyware|virus)\b/i, cat: 'Malware creation' },
  { re: /\b(sql\s+injection|xss\s+payload|buffer\s+overflow\s+exploit|zero.day\s+exploit|reverse\s+shell\s+payload)\b/i, cat: 'Exploit code' },
  { re: /\b(hack\s+into|break\s+into|gain\s+(unauthorized|illegal)\s+access\s+to)\b/i, cat: 'Unauthorized access' },
  { re: /\b(phishing\s+(email|page|kit)|credential\s+harvest|spoofed?\s+(login|site))\b/i, cat: 'Phishing/fraud' },
 
  // Violence
  { re: /\b(how\s+to|instructions?\s+(to|for)).{0,50}(kill|murder|assassinate|shoot|stab)\s+(a\s+)?(person|people|human|someone|anybody)/i, cat: 'Violence facilitation' },
  { re: /\b(mass\s+(shooting|casualty|killing)|school\s+shooting|terror(ist)?\s+attack|plan\s+(an?\s+)?attack)\b/i, cat: 'Mass violence' },
  { re: /\b(torture|kidnap|traffick|enslave)\s+(a\s+)?(person|people|human|child|victim)/i, cat: 'Serious harm' },
 
  // Child safety
  { re: /\b(child|minor|underage|kid).{0,30}(sex|sexual|nude|naked|explicit|porn|erotic|grooming)/i, cat: 'Child safety violation' },
  { re: /\b(loli|shota|cp\b|csam)\b/i, cat: 'Child safety violation' },
 
  // Self-harm
  { re: /\b(how\s+to|best\s+way\s+to|methods?\s+(to|for)).{0,40}(commit\s+suicide|kill\s+myself|self.harm|end\s+my\s+life)\b/i, cat: 'Self-harm facilitation' },
  { re: /\b(most\s+lethal|most\s+effective|painless)\s+(method|way)\s+(to\s+die|of\s+suicide)\b/i, cat: 'Self-harm facilitation' },
 
  // Fraud
  { re: /\b(credit\s+card\s+fraud|carding|clone\s+(a\s+)?card|stolen\s+credit\s+card)\b/i, cat: 'Financial fraud' },
  { re: /\b(money\s+laundering|launder\s+money|wash\s+(dirty\s+)?money)\b/i, cat: 'Financial crime' },
 
  // Hate speech
  { re: /\b(write|generate|create).{0,30}(hate\s+speech|neo.nazi|white\s+supremac|ethnic\s+cleansing)\b/i, cat: 'Hate speech' },
 
  // Drug synthesis
  { re: /\b(how\s+to|instructions?\s+(to|for)|synthesis\s+of).{0,30}(methamphetamine|meth|heroin|fentanyl|crack\s+cocaine)\b/i, cat: 'Drug synthesis' },
 
  // Stalking
  { re: /\b(stalk|track|spy\s+on|surveil).{0,30}(without\s+(their\s+)?knowledge|secretly|covertly).{0,30}(person|someone|ex|partner)\b/i, cat: 'Stalking/surveillance' },
];
 
function serverSecurityCheck(messages) {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .join(' ');
 
  for (const rule of SECURITY_RULES) {
    if (rule.re.test(userMessages)) {
      return { blocked: true, cat: rule.cat };
    }
  }
  // Block if user tries to override system prompt via content
  if (/these\s+instructions|system\s+prompt|I\s+am\s+instructed/i.test(userMessages)) {
    return { blocked: true, cat: 'Prompt injection' };
  }
  return { blocked: false };
}
 
// ── Middleware ───────────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));
 
// ── Proxy route ──────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
 
  // Rate limit check
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
 
  // Server-side security check
  const security = serverSecurityCheck(messages);
  if (security.blocked) {
    console.warn(`[BLOCKED] IP: ${ip} | Category: ${security.cat}`);
    return res.status(403).json({ error: { message: `Request blocked: ${security.cat}. This assistant cannot help with this.` } });
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
    return res.status(502).json({ error: { message: 'Could not reach Groq API. Check your internet connection.' } });
  }
});
 
// ── Catch-all ────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Writing Assistant running at http://localhost:${PORT}`);
  console.log('    API key is secure — stored in .env, never sent to the browser.\n');
});