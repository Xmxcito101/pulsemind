# 🔴 PulseMind MVP — Deployment Guide

> Nigeria 2027 Election Sentiment Intelligence Platform

---

## What's in this folder

```
pulsemind-mvp/
├── index.html          ← Main app (landing page + dashboard)
├── styles.css          ← All styling
├── app.js              ← All logic + Claude AI integration
├── netlify.toml        ← Netlify configuration
├── netlify/
│   └── functions/
│       └── claude-proxy.js  ← Serverless API proxy (optional but recommended)
└── README.md           ← This file
```

---

## STEP-BY-STEP DEPLOYMENT TO NETLIFY

### ── OPTION A: Drag & Drop (Fastest — 5 minutes) ──

**Step 1:** Go to https://netlify.com and sign up for a free account

**Step 2:** On your Netlify dashboard, look for the box that says:
> "Want to deploy a new site without connecting to Git? Drag and drop your site folder here."

**Step 3:** Drag the entire `pulsemind-mvp` folder into that box

**Step 4:** Wait ~30 seconds. Netlify gives you a live URL like:
> `https://jolly-rosalind-a3f9b2.netlify.app`

**Step 5:** Add your Claude API key (see API Key Setup below)

**Your site is live. ✅**

---

### ── OPTION B: GitHub + Netlify (Recommended for updates) ──

**Step 1:** Create a free GitHub account at github.com

**Step 2:** Create a new repository called `pulsemind-mvp`

**Step 3:** Upload all files from this folder to the repository

**Step 4:** Go to netlify.com → "Add new site" → "Import an existing project"

**Step 5:** Connect your GitHub account → Select `pulsemind-mvp` repository

**Step 6:** Build settings:
- Build command: (leave empty)
- Publish directory: `.` (a single dot)

**Step 7:** Click "Deploy site"

**Now every time you update files on GitHub, Netlify auto-deploys. ✅**

---

## API KEY SETUP (Required for AI features)

The AI-powered analysis requires a Claude API key from Anthropic.

### Get your API key:
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to "API Keys" → "Create Key"
4. Copy the key (starts with `sk-ant-...`)

### Add to Netlify:
1. In your Netlify dashboard → click your site
2. Go to **Site Configuration** → **Environment Variables**
3. Click **Add a variable**
4. Key: `ANTHROPIC_API_KEY`
5. Value: paste your `sk-ant-...` key
6. Click **Save**
7. Redeploy the site (Netlify > Deploys > Trigger deploy)

### Update app.js to use the proxy:
Once deployed, update the `callClaude` function in `app.js` to use your serverless function instead of calling the API directly:

```javascript
// Change this line in app.js:
const response = await fetch('https://api.anthropic.com/v1/messages', {
  headers: { 'Content-Type': 'application/json' },
  ...
});

// To this (uses your Netlify function):
const response = await fetch('/.netlify/functions/claude-proxy', {
  headers: { 'Content-Type': 'application/json' },
  ...
});
```

This keeps your API key hidden from users. ✅

---

## CUSTOM DOMAIN (Optional)

1. Buy `pulsemind.ng` from a Nigerian registrar (Qservers, NiRA, or GoDaddy)
   Cost: ~₦5,000–₦10,000/year

2. In Netlify: Site Configuration → Domain Management → Add custom domain

3. Follow the DNS instructions Netlify provides

4. SSL (HTTPS) is automatic and free via Netlify. ✅

---

## WHAT THE MVP INCLUDES

### Landing Page
- Full marketing page with hero, how-it-works, pricing
- Contact/early access form
- Nigeria 2027 election branding

### Dashboard App
- **Dashboard** — Live metrics, charts, AI insights, top accounts
- **Analyze Topic** — Type any candidate/topic → AI returns full sentiment report
- **Live Feed** — Simulated real-time social media stream
- **Top Accounts** — Ranked accounts by sentiment reach
- **AI Insights** — 6 deep strategic recommendations
- **Reports** — AI-generated PDF-ready intelligence reports
- **Candidates** — Sentiment tracker for 6 confirmed 2027 candidates
- **Alerts** — Configure sentiment threshold notifications

---

## WHAT'S SIMULATED (MVP) vs WHAT'S REAL

| Feature | MVP Status | Production Plan |
|---|---|---|
| AI sentiment analysis | ✅ REAL (Claude API) | Same |
| AI insights & reports | ✅ REAL (Claude API) | Same |
| Sentiment numbers | Simulated (AI-estimated) | Twitter API + NewsAPI |
| Live feed | Simulated (template-based) | Twitter/X API stream |
| Top accounts | Demo data | Twitter API + scraping |
| Charts | Demo data (topic-seeded) | Real API data |

---

## PRICING STRUCTURE (Already built in)

| Plan | Price | Target |
|---|---|---|
| Campaign Monitor | ₦250,000/month | State campaigns |
| War Room Pro | ₦750,000/month | Gubernatorial |
| Presidential Suite | ₦3,000,000/month | Presidential |

---

## ESTIMATED MONTHLY COSTS (at MVP stage)

| Item | Cost |
|---|---|
| Netlify hosting | FREE |
| Claude API (100 analyses/day) | ~$15–$30/month |
| Custom domain | ~₦8,000/year |
| **Total** | **~₦25,000/month** |

First client pays for 12 months of running costs. 💰

---

## NEXT STEPS AFTER LAUNCH

1. **Week 1:** Share live URL with 3 beta testers (journalist, campaign staffer, PR agency)
2. **Week 2:** Collect feedback, fix top 3 issues
3. **Week 3:** Record 3-minute demo video, post to LinkedIn + X
4. **Week 4:** First sales call with a campaign team
5. **Month 2:** Connect Twitter/X API for real data
6. **Month 3:** First paying client → reinvest in development

---

## SUPPORT

Built by PulseMind Intelligence
Email: hello@pulsemind.ng
Location: Lagos · Abuja · Remote

---

*Campaign season starts August 19, 2026. Election: January 16, 2027.*
*You have 7 months. Start today.*
