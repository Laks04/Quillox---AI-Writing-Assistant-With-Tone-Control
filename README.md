# AI Writing Assistant — Secure Backend Setup

Your Groq API key lives **only** in `.env` on your machine.  
The browser never sees it — all calls go through the local Express proxy.

---

## Quick Start

### 1. Add your Groq API key
Open `.env` and replace the placeholder:
```
GROQ_API_KEY=gsk_PASTE_YOUR_KEY_HERE
```
→ paste your real key from https://console.groq.com

### 2. Install dependencies
```bash
npm install
```

### 3. Start the server
```bash
npm start
```

### 4. Open the app
Visit **http://localhost:3000** in your browser.  
No API key prompt — it just works.

---

## File structure
```
writing-assistant/
├── .env              ← your secret key (never commit this)
├── .gitignore        ← .env & node_modules excluded
├── package.json
├── server.js         ← Express proxy server
└── public/
    └── index.html    ← the Writing Assistant UI
```

## For development (auto-restart on file changes)
```bash
npm run dev
```
Requires `nodemon` (installed automatically via `npm install`).

---

## Security notes
- `.env` is listed in `.gitignore` — it will never be accidentally committed.
- The `/api/generate` endpoint forwards requests to Groq with your key injected server-side.
- The browser only ever talks to `localhost` — your key is never in any network request it makes.
