# ✍️ Quillox — AI Writing Assistant   
 
> Powered by Groq · Built on LLaMA 3.3 · Zero API key exposure       [![Live Site](https://img.shields.io/badge/Live%20Site-cccccc?style=for-the-badge&logo=googlechrome)](https://quillox-ai-writing-assistant-with-tone.onrender.com/)
 
Quillox is a fast, secure AI writing assistant that runs in your browser. It generates professional content — emails, LinkedIn posts, reports, summaries, and more — in any tone, for any audience, at any length. Your Groq API key is stored securely on the server and never exposed to the browser.
 
---
 
## Features
 
- **8 tones** — Formal, Casual, Persuasive, Empathetic, Technical, Creative, Direct, Friendly
- **7 formats** — Paragraphs, Bullet points, Email, LinkedIn post, Report section, Executive summary, Social post
- **7 audiences** — General, Executives, Technical teams, Customers, Students, Investors, HR
- **3 length modes** — Short, Medium, Long
- **3 safety levels** — Standard, Strict, Professional
- **Input guard** — Blocks prompt injection, jailbreak attempts, CBRN, hate speech, self-harm, malware, and fraud requests before they reach the API
- **Output guard** — Screens model responses for restricted content before display
- **Abuse lockout** — 3 violations trigger a 10-minute lockout with a live countdown timer
- **Usage quotas** — Daily request (14,000) and token (500,000) tracking with visual progress bars; resets at midnight UTC
- **One-click copy** — Copy generated output to clipboard instantly
- **Retry button** — Re-run the last prompt without retyping
- **Keyboard shortcut** — `Ctrl+Enter` / `Cmd+Enter` to generate
- **Dark mode** — Automatically follows system preference
- **Output metadata** — Shows tone, audience, format, length, word count, and token usage after each generation
- **Secure by design** — API key lives in `.env`, never in the browser or network logs
---
 
## Quick Start (Local)
 
### Prerequisites
 
- [Node.js](https://nodejs.org) v18 or higher
- A free Groq API key from [console.groq.com](https://console.groq.com)
### 1. Add your API key
 
Open `.env` and paste your Groq key:
 
```
GROQ_API_KEY=gsk_your_actual_key_here
```
 
### 2. Install dependencies
 
```bash
npm install
```
 
### 3. Run Quillox
 
```bash
npm start
```
 
### 4. Open in browser
 
```
http://localhost:3000
```
 
No login. No API key prompt. Just open and write.
 
---
 
## Deployment on Render
 
Quillox is deployed and running on Render. To deploy your own instance:
 
### 1. Push to GitHub
 
Make sure your repository contains all project files. Confirm `.gitignore` excludes `.env` and `node_modules` — your API key must never be committed.
 
### 2. Create a new Web Service on Render
 
1. Go to [render.com](https://render.com) and sign in
2. Click **New → Web Service**
3. Connect your GitHub repository
4. Configure the service:
| Setting | Value |
|---|---|
| **Environment** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for always-on) |
 
### 3. Set your environment variable
 
In the Render dashboard, go to your service → **Environment** tab, and add:
 
```
GROQ_API_KEY = gsk_your_actual_key_here
```
 
Never hardcode the key in source files. Render injects it securely at runtime.
 
### 4. Deploy
 
Render will build and deploy automatically. Your public URL will be:
 
```
https://your-service-name.onrender.com
```
 
> **Note:** Free-tier Render services spin down after 15 minutes of inactivity and take ~30 seconds to cold-start on the next request. Upgrade to the Starter plan ($7/mo) for always-on uptime.
 
### Automatic Deploys
 
Once connected, every push to your main branch triggers a new deploy automatically.
 
---
 
## Other Deployment Options
 
| Platform | Cost | Notes |
|---|---|---|
| [Render](https://render.com) | Free tier / $7/mo | **Currently deployed here.** Free tier sleeps after 15 min idle |
| [Railway](https://railway.app) | Free tier | Easiest alternative — deploy from GitHub in minutes |
| DigitalOcean / Hetzner VPS | ~$4–6/mo | Full control; use `pm2` to keep it running |
 
---
 
## Launch Scripts (Local, Optional)
 
Skip typing commands — just double-click to launch.
 
**Mac / Linux** — save as `launch-quillox.sh`:
 
```bash
#!/bin/bash
cd ~/writing-assistant
npm start &
sleep 2
open http://localhost:3000
```
 
Make it executable once: `chmod +x launch-quillox.sh`
 
**Windows** — save as `launch-quillox.bat`:
 
```bat
cd /d %USERPROFILE%\writing-assistant
start npm start
timeout /t 2
start http://localhost:3000
```
 
---
 
## File Structure
 
```
quillox/
├── .env                ← your secret API key (never shared or committed)
├── .gitignore          ← excludes .env and node_modules
├── package.json        ← dependencies and scripts
├── server.js           ← Express proxy — injects API key server-side
├── README.md           ← this file
└── public/
    └── index.html      ← Quillox UI (served by the Express server)
```
 
---
 
## How Security Works
 
```
Browser → POST /api/generate (no key) → server.js → Groq API (key injected here)
```
 
- The API key is loaded from `.env` (locally) or from the Render environment variable (in production) at server startup
- The browser only ever calls `/api/generate` — the key never travels to the client
- No key appears in browser DevTools, network logs, or page source
- `.gitignore` ensures `.env` is never accidentally pushed to GitHub
- Server-side input validation rejects empty, oversized, or malformed requests before they reach Groq
- Groq error messages are sanitised before being forwarded to the client; auth details are never leaked
---
 
## Content Safety System
 
Quillox has a multi-layer safety system built entirely client-side (no external moderation API needed):
 
**Input screening** — before each request, the prompt is checked against a comprehensive set of regex rules covering:
 
- Prompt injection and jailbreak attempts (DAN mode, system prompt extraction, etc.)
- Chemical, biological, and nuclear weapons
- Self-harm and suicide content
- Child sexual abuse material (CSAM)
- Malware and exploit code
- Fraud, phishing, and social engineering
- Hate speech and targeted harassment
- Controlled substance synthesis
**Output screening** — the model's response is scanned before display; results containing instruction leakage or restricted patterns are blocked.
 
**Violation tracking** — each blocked request increments a violation counter (persisted in localStorage). After 3 violations, the interface locks for 10 minutes. Continued violations extend the lockout. All counters reset at midnight UTC.
 
**Safety level selector** — users can choose between Standard, Strict (no sensitive topics), and Professional (workplace content only) to further adjust the system prompt.
 
---
 
## Stopping the Server (Local)
 
In the terminal where Quillox is running, press:
 
```
Ctrl + C
```
 
---
 
## Tech Stack
 
### Core Stack
 
| Layer | Technology | Role |
|---|---|---|
| UI | Vanilla HTML / CSS / JS | Frontend interface — no framework, no build step |
| Icons | Tabler Icons (CDN) | UI icon library |
| Server | Node.js + Express.js | Backend API proxy server |
| AI Model | LLaMA 3.3 70B (via Groq) | Large Language Model for generation |
| Config | dotenv | Secure environment variable management |
| Hosting | Render | Cloud deployment platform |
 
---
 
## AI & ML Technologies Used
 
### Technical Skills
 
| Skill | How it's used in Quillox |
|---|---|
| **Large Language Model (LLM)** | Core engine — LLaMA 3.3 70B served via Groq's inference API |
| **Generative AI** | Every output is AI-generated content produced on demand |
| **Prompt Engineering** | System prompt is dynamically composed per tone, audience, format, length, and safety level on every request |
| **Natural Language Processing (NLP)** | Output is structured, fluent, context-aware natural language generation |
 
### Tools & Technologies
 
| Technology | How it's used in Quillox |
|---|---|
| **Groq API** | Direct LLM inference — Groq runs LLaMA 3.3 70B at ultra-low latency |
| **Node.js** | Server runtime — plays the same backend role as Python in most AI stacks |
| **Express.js** | REST API proxy — equivalent to FastAPI; handles the `/api/generate` route securely |
| **Render** | Cloud hosting — Quillox runs here with automatic deploys from GitHub |
 
---
 
## Why These Technologies?
 
| Decision | Reason |
|---|---|
| **Groq over OpenAI** | 10–20× faster inference on LLaMA 3.3 70B; generous free tier |
| **Node.js over Python** | Lightweight proxy — no ML computation needed server-side |
| **Express over FastAPI** | Same concept, JS ecosystem — keeps the entire project in one language |
| **LLaMA 3.3 70B** | Best open-weight model for instruction-following and writing tasks |
| **Vanilla JS over React** | Zero build step, instant load, no dependencies for the UI |
| **Render over Railway** | Simple GitHub integration, free SSL, easy environment variable management |
 
---
 
*Quillox — write more, think less.*
