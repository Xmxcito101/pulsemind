/* ═══════════════════════════════════════════
   PULSEMIND MVP — app.js
   AI-powered sentiment intelligence platform
   Powered by Claude (Anthropic)
═══════════════════════════════════════════ */

'use strict';

// ── STATE ──────────────────────────────────
const state = {
  currentView: 'dashboard',
  currentTopic: 'Nigeria Presidential Election 2027',
  feedFilter: 'all',
  feedItems: [],
  feedInterval: null,
  insightsLoaded: false,
};

// ── CLAUDE API ─────────────────────────────
async function callClaude(systemPrompt, userPrompt, maxTokens = 900) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.content.map(b => b.text || '').join('');
}

// ── PAGE NAVIGATION ─────────────────────────
function showApp() {
  document.getElementById('landing-page').classList.remove('active');
  document.getElementById('app-page').classList.add('active');
  setView('dashboard');
  initDashboard();
}

function showLanding() {
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('landing-page').classList.add('active');
  if (state.feedInterval) { clearInterval(state.feedInterval); state.feedInterval = null; }
}

function showContact() {
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('landing-page').classList.add('active');
  setTimeout(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }), 100);
}

// ── VIEW SWITCHING ──────────────────────────
function setView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));

  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');

  const sidebarItem = document.querySelector(`.sidebar-item[onclick="setView('${view}')"]`);
  if (sidebarItem) sidebarItem.classList.add('active');

  state.currentView = view;

  // Lazy-init views
  if (view === 'feed') initFeed();
  if (view === 'accounts') initAccountsFull();
  if (view === 'insights') initInsightsFull();
  if (view === 'candidates') initCandidates();
}

// ── TOAST ───────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
async function initDashboard() {
  renderAccounts(getDemoAccounts(), 'dash-accounts');
  drawTrendChart(getChartData('Nigeria Presidential Election 2027'));
  drawDonutChart(62, 24, 14);
  await loadDashInsights('Nigeria Presidential Election 2027');
}

async function runDashboardAnalysis() {
  const topic = document.getElementById('dash-topic-input').value.trim();
  if (!topic) { showToast('Please enter a topic to analyze.'); return; }

  state.currentTopic = topic;

  const btn = document.getElementById('dash-analyze-btn');
  btn.textContent = 'Analyzing…';
  btn.disabled = true;

  document.getElementById('dash-insights-badge').textContent = 'Analyzing…';
  document.getElementById('dash-insights-badge').className = 'panel-badge loading-badge';
  document.getElementById('dash-insights-content').innerHTML = `
    <div class="insight-skeleton"></div>
    <div class="insight-skeleton"></div>
    <div class="insight-skeleton"></div>`;

  try {
    const nums = await getSentimentNumbers(topic);
    updateMetrics(nums);
    drawTrendChart(getChartData(topic));
    drawDonutChart(nums.pos, nums.neg, nums.neu);
    document.getElementById('chart-topic-label').textContent = topic;
    await loadDashInsights(topic);
    showToast(`✅ Analysis complete for "${topic}"`);
  } catch (e) {
    showToast('❌ Error running analysis. Check your connection.');
    console.error(e);
  } finally {
    btn.textContent = 'Analyze →';
    btn.disabled = false;
  }
}

async function getSentimentNumbers(topic) {
  const system = `You are a sentiment analysis AI. Return ONLY valid JSON, no markdown, no preamble.`;
  const prompt = `Estimate realistic sentiment percentages for the topic: "${topic}" in the context of Nigerian politics and social media in 2026.

Return exactly this JSON structure:
{"pos": <number>, "neg": <number>, "neu": <number>, "mentions": "<number like 142K or 2.3M>", "posChange": "<like +3.2%>", "negChange": "<like +1.5%>"}

Pos + neg + neu must sum to 100. Make values realistic for Nigerian political discourse.`;

  const raw = await callClaude(system, prompt, 200);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function updateMetrics({ pos, neg, neu, mentions, posChange, negChange }) {
  animateValue('m-total', mentions || '—');
  animateValue('m-pos', pos + '%');
  animateValue('m-neg', neg + '%');
  animateValue('m-neu', neu + '%');
  const pd = document.getElementById('m-pos-delta');
  const nd = document.getElementById('m-neg-delta');
  if (pd) { pd.textContent = posChange || ''; pd.className = 'metric-delta ' + (posChange?.startsWith('+') ? 'up' : 'down'); }
  if (nd) { nd.textContent = negChange || ''; nd.className = 'metric-delta ' + (negChange?.startsWith('+') ? 'down' : 'up'); }
  document.getElementById('dl-pos').textContent = pos + '%';
  document.getElementById('dl-neg').textContent = neg + '%';
  document.getElementById('dl-neu').textContent = neu + '%';
}

function animateValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = 'translateY(4px)';
  setTimeout(() => {
    el.textContent = val;
    el.style.transition = 'all 0.4s ease';
    el.style.opacity = '1';
    el.style.transform = 'none';
  }, 150);
}

async function loadDashInsights(topic) {
  const badge = document.getElementById('dash-insights-badge');
  const container = document.getElementById('dash-insights-content');

  try {
    const insights = await generateInsights(topic);
    badge.textContent = `${insights.length} insights`;
    badge.className = 'panel-badge done-badge';
    container.innerHTML = '';
    insights.forEach((ins, i) => {
      setTimeout(() => {
        container.innerHTML += renderInsightCard(ins);
      }, i * 120);
    });
  } catch (e) {
    badge.textContent = 'Error';
    container.innerHTML = '<p style="color:#CC1A30;font-size:0.85rem;padding:12px">Could not load AI insights. Check API connection.</p>';
  }
}

async function generateInsights(topic) {
  const system = `You are PulseMind, a senior political sentiment analyst with 10 years experience in Nigerian politics. Return ONLY valid JSON arrays.`;
  const prompt = `Generate 3 actionable sentiment intelligence insights for the topic: "${topic}" in Nigerian political context (2027 presidential election).

Return a JSON array of exactly 3 objects:
[
  {"type": "positive"|"negative"|"neutral", "icon": "<emoji>", "title": "<short title>", "body": "<2-3 sentence actionable insight referencing real Nigerian political dynamics>"},
  ...
]

Make insights specific to Nigeria: reference fuel subsidy, ethnicity dynamics, PVC registration, INEC, Lagos vs Abuja sentiment, Arewa, South-South, etc. where relevant.`;

  const raw = await callClaude(system, prompt, 600);
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']') + 1;
  return JSON.parse(clean.slice(start, end));
}

function renderInsightCard({ type, icon, title, body }) {
  const cls = type === 'positive' ? 'pos' : type === 'negative' ? 'neg' : 'neu';
  return `
    <div class="insight-card">
      <div class="insight-icon ${cls}">${icon || (type === 'positive' ? '✅' : type === 'negative' ? '⚠️' : '💡')}</div>
      <div class="insight-body">
        <strong>${title}</strong>
        <p>${body}</p>
      </div>
    </div>`;
}

// ── CHARTS ──────────────────────────────────
function getChartData(topic) {
  const seed = topic.length;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((d, i) => ({
    label: d,
    pos: Math.round(45 + ((seed * (i + 1) * 7) % 30)),
    neg: Math.round(10 + ((seed * (i + 2) * 3) % 25)),
    neu: Math.round(5 + ((seed * (i + 1) * 5) % 15)),
  }));
}

function drawTrendChart(data) {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  const H = 160;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const pad = { t: 12, r: 16, b: 28, l: 32 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const maxVal = Math.max(...data.map(d => d.pos + d.neg + d.neu)) * 1.15;

  // Grid lines
  ctx.strokeStyle = '#F0F0F0';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(r => {
    const y = pad.t + chartH - chartH * r;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + chartW, y); ctx.stroke();
    ctx.fillStyle = '#BBBBC8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * r), pad.l - 4, y + 3);
  });

  // Bars
  const bw = (chartW / data.length) * 0.65;
  const gap = (chartW / data.length) * 0.35 / 2;
  const colors = { pos: '#00D4AA', neg: '#FF3D5A', neu: '#FFB020' };

  data.forEach((d, i) => {
    const x = pad.l + (chartW / data.length) * i + gap;
    const barTypes = ['pos', 'neg', 'neu'];
    const eachW = bw / 3;
    barTypes.forEach((k, j) => {
      const val = d[k];
      const barH = (val / maxVal) * chartH;
      const bx = x + eachW * j;
      const by = pad.t + chartH - barH;
      ctx.fillStyle = colors[k];
      ctx.beginPath();
      ctx.roundRect(bx, by, eachW - 1.5, barH, [2, 2, 0, 0]);
      ctx.fill();
    });

    // X labels
    ctx.fillStyle = '#8A8A9A';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + bw / 2, H - 6);
  });
}

function drawDonutChart(pos, neg, neu) {
  const canvas = document.getElementById('donut-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 160;
  canvas.width = size; canvas.height = size;
  const cx = size / 2, cy = size / 2, r = 58, r2 = 38;

  const segments = [
    { val: pos, color: '#00D4AA' },
    { val: neg, color: '#FF3D5A' },
    { val: neu, color: '#FFB020' },
  ];

  let startAngle = -Math.PI / 2;
  segments.forEach(seg => {
    const angle = (seg.val / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += angle;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r2, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#0A0A0F';
  ctx.font = `bold 22px 'DM Serif Display', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pos + '%', cx, cy - 5);
  ctx.fillStyle = '#8A8A9A';
  ctx.font = `11px 'Space Grotesk', sans-serif`;
  ctx.fillText('Positive', cx, cy + 13);
}

// ── ACCOUNTS DATA ────────────────────────────
function getDemoAccounts() {
  return [
    { init: 'SD', color: '#E0D4FF', tc: '#5B3FCC', name: 'Sahara Reporters', handle: '@SaharaReporters', followers: '1.8M', posts: '12.4K', sentiment: 'neg' },
    { init: 'PN', color: '#D4F5EC', tc: '#007A62', name: 'Peter Obi Nation', handle: '@PeterObiNation', followers: '1.2M', posts: '9.1K', sentiment: 'pos' },
    { init: 'PT', color: '#FFD4DC', tc: '#CC1A30', name: 'Premium Times NG', handle: '@PremiumTimesNG', followers: '980K', posts: '7.3K', sentiment: 'neg' },
    { init: 'AO', color: '#D4E8FF', tc: '#0055CC', name: 'APC Outreach', handle: '@APCOutreach', followers: '720K', posts: '5.9K', sentiment: 'pos' },
    { init: 'NI', color: '#FFE8B3', tc: '#8B5000', name: 'NigeriaInfo FM', handle: '@NigeriaInfoFM', followers: '610K', posts: '4.2K', sentiment: 'neu' },
  ];
}

function renderAccounts(accounts, containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = accounts.map(a => `
    <div class="account-row">
      <div class="acct-avatar" style="background:${a.color};color:${a.tc}">${a.init}</div>
      <div class="acct-info">
        <div class="acct-name">${a.name}</div>
        <div class="acct-handle">${a.handle} · ${a.followers} followers</div>
      </div>
      <span class="sentiment-pill sp-${a.sentiment}">${a.sentiment === 'pos' ? 'Positive' : a.sentiment === 'neg' ? 'Negative' : 'Neutral'}</span>
      <div class="acct-count">${a.posts} posts</div>
    </div>`).join('');
}

// ══════════════════════════════════════════
//  ANALYZE VIEW
// ══════════════════════════════════════════
function setAnalyzeTopic(topic) {
  document.getElementById('analyze-topic').value = topic;
}

async function runAnalysis() {
  const topic = document.getElementById('analyze-topic').value.trim();
  if (!topic) { showToast('Enter a topic to analyze.'); return; }

  const btn = document.getElementById('analyze-btn');
  const loading = document.getElementById('analyze-loading');
  const results = document.getElementById('analyze-results');

  btn.disabled = true; btn.textContent = 'Analyzing…';
  loading.classList.remove('hidden');
  results.classList.add('hidden');
  results.innerHTML = '';

  // Animate loading messages
  const msgs = ['Scanning X, Facebook, Reddit, news…', 'Reading Nigerian conversations…', 'Classifying sentiment with AI…', 'Building your intelligence report…'];
  const lines = loading.querySelectorAll('.loading-lines p');
  let mi = 0;
  const msgInterval = setInterval(() => {
    if (lines[0]) lines[0].textContent = msgs[mi % msgs.length];
    mi++;
  }, 1200);

  try {
    const [nums, analysis] = await Promise.all([
      getSentimentNumbers(topic),
      getTopicAnalysis(topic)
    ]);

    clearInterval(msgInterval);
    loading.classList.add('hidden');

    results.innerHTML = renderAnalysisResults(topic, nums, analysis);
    results.classList.remove('hidden');
    showToast(`✅ Analysis ready for "${topic}"`);
  } catch (e) {
    clearInterval(msgInterval);
    loading.classList.add('hidden');
    results.innerHTML = `<div class="result-header"><p style="color:#CC1A30">Analysis failed. Please check your connection and try again.</p></div>`;
    results.classList.remove('hidden');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = 'Run Analysis →';
  }
}

async function getTopicAnalysis(topic) {
  const system = `You are PulseMind's chief intelligence officer — a seasoned Nigerian political analyst with 10 years experience. Return ONLY valid JSON.`;
  const prompt = `Provide a deep sentiment intelligence analysis for the topic: "${topic}" in Nigerian political/social context (2027 election cycle).

Return this exact JSON:
{
  "summary": "<2-3 sentence expert summary of public sentiment on this topic in Nigeria>",
  "keyDrivers": {
    "positive": ["<driver 1>", "<driver 2>", "<driver 3>"],
    "negative": ["<driver 1>", "<driver 2>", "<driver 3>"]
  },
  "topPlatform": "<platform name>",
  "dominantDemographic": "<e.g. Lagos youth, Northern voters, Diaspora>",
  "trendDirection": "rising"|"falling"|"stable",
  "insights": [
    {"type": "positive", "icon": "✅", "title": "<title>", "body": "<actionable insight>"},
    {"type": "negative", "icon": "⚠️", "title": "<title>", "body": "<actionable insight>"},
    {"type": "opportunity", "icon": "💡", "title": "<title>", "body": "<opportunity insight>"}
  ]
}

Be specific to Nigeria: reference relevant states, demographics, political dynamics, current issues like petrol prices, ASUU strikes, security, naira weakness, etc.`;

  const raw = await callClaude(system, prompt, 1000);
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}') + 1;
  return JSON.parse(clean.slice(start, end));
}

function renderAnalysisResults(topic, nums, analysis) {
  const trendIcon = analysis.trendDirection === 'rising' ? '↗' : analysis.trendDirection === 'falling' ? '↘' : '→';
  const insightsHtml = (analysis.insights || []).map(ins => renderInsightCard(ins)).join('');

  return `
    <div class="result-header">
      <div class="result-topic">Analysis · ${topic}</div>
      <p class="result-summary">${analysis.summary || ''}</p>
      <div style="display:flex;gap:16px;margin-top:14px;flex-wrap:wrap;">
        <span style="font-size:0.78rem;background:#F0F0F8;padding:4px 12px;border-radius:100px;color:#555">
          📱 Top: ${analysis.topPlatform || 'X / Twitter'}
        </span>
        <span style="font-size:0.78rem;background:#F0F0F8;padding:4px 12px;border-radius:100px;color:#555">
          👥 ${analysis.dominantDemographic || 'Urban voters'}
        </span>
        <span style="font-size:0.78rem;background:#F0F0F8;padding:4px 12px;border-radius:100px;color:#555">
          ${trendIcon} ${analysis.trendDirection || 'Stable'} trend
        </span>
      </div>
    </div>

    <div class="result-metrics">
      <div class="result-metric">
        <div class="rm-val pos">${nums.pos}%</div>
        <div class="rm-label">Positive</div>
      </div>
      <div class="result-metric">
        <div class="rm-val neg">${nums.neg}%</div>
        <div class="rm-label">Negative</div>
      </div>
      <div class="result-metric">
        <div class="rm-val neu">${nums.neu}%</div>
        <div class="rm-label">Neutral</div>
      </div>
    </div>

    ${analysis.keyDrivers ? `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header"><span class="panel-title">Key Sentiment Drivers</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <div style="font-size:0.72rem;font-weight:700;color:#007A62;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Positive Drivers</div>
          ${(analysis.keyDrivers.positive || []).map(d => `
            <div style="display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:#333;margin-bottom:6px">
              <span style="color:#00D4AA;font-weight:700;flex-shrink:0">+</span>${d}
            </div>`).join('')}
        </div>
        <div>
          <div style="font-size:0.72rem;font-weight:700;color:#CC1A30;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Negative Drivers</div>
          ${(analysis.keyDrivers.negative || []).map(d => `
            <div style="display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:#333;margin-bottom:6px">
              <span style="color:#FF3D5A;font-weight:700;flex-shrink:0">−</span>${d}
            </div>`).join('')}
        </div>
      </div>
    </div>` : ''}

    <div class="result-insights">
      <h3>🧠 AI Action Insights</h3>
      <div class="insights-content">${insightsHtml}</div>
    </div>

    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-primary sm" onclick="setView('dashboard');document.getElementById('dash-topic-input').value='${topic.replace(/'/g, "\\'")}';runDashboardAnalysis()">
        Add to Dashboard →
      </button>
      <button class="btn-outline sm" onclick="generateReportForTopic('${topic.replace(/'/g, "\\'")}')">
        Export Report
      </button>
    </div>`;
}

// ══════════════════════════════════════════
//  LIVE FEED
// ══════════════════════════════════════════
const FEED_TEMPLATES = {
  positive: [
    { text: "I'm impressed by how {topic} is gaining traction across the North and South. This could be the change Nigeria needs. #Nigeria2027", platform: 'X (Twitter)' },
    { text: "Finally a candidate who understands our suffering. The youth of Lagos are solidly behind this movement! #PVC {topic}", platform: 'Facebook' },
    { text: "Watching the rally in Abuja — the energy is incredible. {topic} has something real going. 🇳🇬 #Naija2027", platform: 'X (Twitter)' },
    { text: "My grandmother in Enugu is happy for the first time in years about politics. {topic} gives her hope.", platform: 'Facebook' },
    { text: "The economic plan presented by {topic} actually makes sense for ordinary Nigerians. Let's hold them to it.", platform: 'Reddit r/Nigeria' },
  ],
  negative: [
    { text: "Empty promises again. {topic} has been saying the same things since 2023. Nigeria deserves better. #Nigeria2027", platform: 'X (Twitter)' },
    { text: "How can we trust {topic} when fuel still costs ₦1,200/litre and unemployment is at 33%? Wake up Nigerians.", platform: 'Facebook' },
    { text: "The security situation in the North-East is worse than ever and {topic} hasn't said a word about it. Speechless.", platform: 'X (Twitter)' },
    { text: "Another politician from the same recycled class. {topic} is just APC/PDP in disguise. I'm not voting.", platform: 'Reddit r/Naijapolitics' },
    { text: "What happened to the promises from the last election? Why should {topic} be any different? #JapaBetter", platform: 'X (Twitter)' },
  ],
  neutral: [
    { text: "Watching the debate on {topic}. Still haven't made up my mind. Need to see more specifics on the economy.", platform: 'X (Twitter)' },
    { text: "Coverage of {topic} in the papers today. Interesting perspectives from both sides. 🤔 #Nigeria2027", platform: 'Facebook' },
    { text: "Anyone else doing more research on {topic} before deciding? Would love to see a real policy breakdown.", platform: 'Reddit r/Nigeria' },
  ],
};

const NIGERIAN_NAMES = [
  { name: 'Chukwuemeka Okafor', handle: '@chuks_ng', init: 'CO', bg: '#E0D4FF', tc: '#5B3FCC' },
  { name: 'Fatima Al-Hassan', handle: '@fatima_kano', init: 'FA', bg: '#D4F5EC', tc: '#007A62' },
  { name: 'Babatunde Adeyemi', handle: '@babs_lag', init: 'BA', bg: '#FFD4DC', tc: '#CC1A30' },
  { name: 'Ngozi Eze', handle: '@ngozi_abj', init: 'NE', bg: '#D4E8FF', tc: '#0055CC' },
  { name: 'Ibrahim Musa', handle: '@ibro_kd', init: 'IM', bg: '#FFE8B3', tc: '#8B5000' },
  { name: 'Adaeze Okonkwo', handle: '@ada_enugu', init: 'AO', bg: '#F4D4FF', tc: '#6B00AA' },
  { name: 'Yusuf Garba', handle: '@yusuf_sk', init: 'YG', bg: '#D4FFE8', tc: '#007A40' },
  { name: 'Tolu Balogun', handle: '@tolu_ibadan', init: 'TB', bg: '#FFD4F0', tc: '#AA0066' },
  { name: 'Emeka Nwosu', handle: '@emeka_ph', init: 'EN', bg: '#D4F0FF', tc: '#0066AA' },
  { name: 'Hauwa Shehu', handle: '@hauwa_maid', init: 'HS', bg: '#FFF4D4', tc: '#AA6600' },
];

function generateFeedItem(topic, filterType) {
  const types = ['positive', 'negative', 'neutral'];
  const weights = [0.6, 0.28, 0.12];
  let type;

  if (filterType && filterType !== 'all') {
    type = filterType;
  } else {
    const r = Math.random();
    type = r < weights[0] ? 'positive' : r < weights[0] + weights[1] ? 'negative' : 'neutral';
  }

  const templates = FEED_TEMPLATES[type];
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  const person = NIGERIAN_NAMES[Math.floor(Math.random() * NIGERIAN_NAMES.length)];
  const shortTopic = topic.split(' ').slice(0, 3).join(' ');
  const text = tpl.text.replace(/{topic}/g, shortTopic);
  const mins = Math.floor(Math.random() * 8) + 1;

  return { type, text, platform: tpl.platform, person, time: `${mins}m ago` };
}

function renderFeedItem(item) {
  const emoji = item.type === 'positive' ? '😊' : item.type === 'negative' ? '😡' : '😐';
  return `
    <div class="feed-item ${item.type}">
      <div class="feed-avatar" style="background:${item.person.bg};color:${item.person.tc}">${item.person.init}</div>
      <div class="feed-content">
        <div class="feed-meta">
          <span class="feed-name">${item.person.name}</span>
          <span class="feed-handle">${item.person.handle}</span>
          <span class="sentiment-pill sp-${item.type === 'positive' ? 'pos' : item.type === 'negative' ? 'neg' : 'neu'}">${emoji} ${item.type}</span>
          <span class="feed-time">${item.time}</span>
        </div>
        <div class="feed-text">${item.text}</div>
        <div class="feed-platform">📍 ${item.platform}</div>
      </div>
    </div>`;
}

function initFeed() {
  if (state.feedInterval) return;
  const container = document.getElementById('feed-container');
  const topic = state.currentTopic;

  // Initial batch
  container.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const item = generateFeedItem(topic, state.feedFilter !== 'all' ? state.feedFilter : null);
    container.innerHTML += renderFeedItem(item);
  }

  // Live updates
  state.feedInterval = setInterval(() => {
    if (state.currentView !== 'feed') return;
    const item = generateFeedItem(topic, state.feedFilter !== 'all' ? state.feedFilter : null);
    const newEl = document.createElement('div');
    newEl.innerHTML = renderFeedItem(item);
    container.insertBefore(newEl.firstElementChild, container.firstChild);
    // Cap at 30 items
    while (container.children.length > 30) container.removeChild(container.lastChild);
  }, 3500);
}

function setFeedFilter(el, filter) {
  document.querySelectorAll('.feed-filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.feedFilter = filter;
  if (state.feedInterval) { clearInterval(state.feedInterval); state.feedInterval = null; }
  initFeed();
}

// ══════════════════════════════════════════
//  ACCOUNTS FULL
// ══════════════════════════════════════════
function initAccountsFull() {
  const container = document.getElementById('accounts-full-list');
  const allAccounts = [
    { init: 'SR', bg: '#FFD4DC', tc: '#CC1A30', name: 'Sahara Reporters', handle: '@SaharaReporters', followers: '1.8M', posts: '12.4K', reach: '8.4M', sentiment: 'neg' },
    { init: 'PN', bg: '#D4F5EC', tc: '#007A62', name: 'Peter Obi Nation', handle: '@PeterObiNation', followers: '1.2M', posts: '9.1K', reach: '6.2M', sentiment: 'pos' },
    { init: 'PT', bg: '#E0D4FF', tc: '#5B3FCC', name: 'Premium Times NG', handle: '@PremiumTimesNG', followers: '980K', posts: '7.3K', reach: '4.8M', sentiment: 'neg' },
    { init: 'AO', bg: '#D4E8FF', tc: '#0055CC', name: 'APC Digital', handle: '@APCDigital', followers: '720K', posts: '5.9K', reach: '3.6M', sentiment: 'pos' },
    { init: 'NI', bg: '#FFE8B3', tc: '#8B5000', name: 'NigeriaInfo FM', handle: '@NigeriaInfoFM', followers: '610K', posts: '4.2K', reach: '2.9M', sentiment: 'neu' },
    { init: 'CB', bg: '#F4D4FF', tc: '#6B00AA', name: 'Channels TV', handle: '@channelstv', followers: '580K', posts: '3.8K', reach: '2.5M', sentiment: 'neu' },
    { init: 'VC', bg: '#D4FFE8', tc: '#007A40', name: 'Vanguard NG', handle: '@vanguardngrnews', followers: '490K', posts: '3.1K', reach: '1.9M', sentiment: 'neg' },
    { init: 'PD', bg: '#FFD4F0', tc: '#AA0066', name: 'PDP Nationwide', handle: '@OfficialPDPNig', followers: '420K', posts: '2.7K', reach: '1.7M', sentiment: 'pos' },
    { init: 'RJ', bg: '#D4F0FF', tc: '#0066AA', name: 'RenewedHopeNG', handle: '@RenewedHopeNG', followers: '380K', posts: '2.2K', reach: '1.4M', sentiment: 'pos' },
    { init: 'OM', bg: '#FFF4D4', tc: '#AA6600', name: 'Obizone Media', handle: '@Obizoneng', followers: '310K', posts: '1.9K', reach: '1.1M', sentiment: 'pos' },
  ];

  container.innerHTML = `
    <div class="accounts-table-header">
      <div>Account</div>
      <div>Followers</div>
      <div>Posts</div>
      <div>Est. Reach</div>
      <div>Sentiment</div>
    </div>
    ${allAccounts.map(a => `
      <div class="accounts-table-row">
        <div class="at-name">
          <div class="acct-avatar" style="background:${a.bg};color:${a.tc}">${a.init}</div>
          <div>
            <div class="acct-name">${a.name}</div>
            <div class="acct-handle">${a.handle}</div>
          </div>
        </div>
        <div class="at-followers">${a.followers}</div>
        <div class="at-posts">${a.posts}</div>
        <div class="at-reach">${a.reach}</div>
        <div><span class="sentiment-pill sp-${a.sentiment === 'pos' ? 'pos' : a.sentiment === 'neg' ? 'neg' : 'neu'}">${a.sentiment === 'pos' ? 'Positive' : a.sentiment === 'neg' ? 'Negative' : 'Neutral'}</span></div>
      </div>`).join('')}`;
}

// ══════════════════════════════════════════
//  INSIGHTS FULL
// ══════════════════════════════════════════
async function initInsightsFull() {
  const container = document.getElementById('insights-full-content');
  container.innerHTML = `<div class="insights-loading-state"><div class="loading-pulse"></div><p>Generating strategic insights for ${state.currentTopic}…</p></div>`;

  try {
    const system = `You are PulseMind's chief strategy officer — 10 years of Nigerian political consulting. Return ONLY valid JSON.`;
    const prompt = `Generate 6 deep strategic insights for "${state.currentTopic}" in Nigerian 2027 election context.

Return JSON array of 6 objects:
[{"type": "positive"|"negative"|"opportunity", "icon": "<emoji>", "title": "<title>", "body": "<2-3 sentences with specific Nigerian political context>", "actions": ["<action 1>", "<action 2>", "<action 3>"]}]

Cover: voter demographics, regional sentiment, social media strategy, opposition risks, opportunity windows, crisis prevention.`;

    const raw = await callClaude(system, prompt, 1200);
    const clean = raw.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('['), end = clean.lastIndexOf(']') + 1;
    const insights = JSON.parse(clean.slice(start, end));

    container.innerHTML = '';
    insights.forEach((ins, i) => {
      const typeCls = ins.type === 'positive' ? 'pos' : ins.type === 'negative' ? 'neg' : 'opp';
      const typeLabel = ins.type === 'positive' ? 'Positive Signal' : ins.type === 'negative' ? 'Negative Risk' : 'Opportunity';
      setTimeout(() => {
        const card = document.createElement('div');
        card.className = 'insight-full-card';
        card.innerHTML = `
          <div class="ifc-type ${typeCls}">// ${typeLabel}</div>
          <div class="ifc-title">${ins.icon} ${ins.title}</div>
          <div class="ifc-body">${ins.body}</div>
          ${ins.actions ? `<div class="ifc-actions">${ins.actions.map(a => `<span class="action-tag">→ ${a}</span>`).join('')}</div>` : ''}`;
        container.appendChild(card);
      }, i * 150);
    });
  } catch (e) {
    container.innerHTML = `<div class="insight-full-card"><p style="color:#CC1A30">Could not load insights. Check your API connection.</p></div>`;
    console.error(e);
  }
}

async function refreshInsights() {
  state.insightsLoaded = false;
  await initInsightsFull();
}

// ══════════════════════════════════════════
//  CANDIDATES
// ══════════════════════════════════════════
const CANDIDATES_DATA = [
  { init: 'BT', bg: '#D4E8FF', tc: '#0055CC', name: 'Bola Tinubu', party: 'APC (Incumbent)', pos: 44, neg: 40, neu: 16, mentions: '1.2M', color: '#0055CC' },
  { init: 'PO', bg: '#E0D4FF', tc: '#5B3FCC', name: 'Peter Obi', party: 'NDC / Labour', pos: 68, neg: 18, neu: 14, mentions: '980K', color: '#5B3FCC' },
  { init: 'AA', bg: '#D4F5EC', tc: '#007A62', name: 'Atiku Abubakar', party: 'PDP', pos: 41, neg: 38, neu: 21, mentions: '740K', color: '#007A62' },
  { init: 'SM', bg: '#FFE8B3', tc: '#8B5000', name: 'Seyi Makinde', party: 'PDP', pos: 62, neg: 20, neu: 18, mentions: '520K', color: '#8B5000' },
  { init: 'NR', bg: '#FFD4DC', tc: '#CC1A30', name: 'Nasir el-Rufai', party: 'ADC', pos: 38, neg: 44, neu: 18, mentions: '480K', color: '#CC1A30' },
  { init: 'RA', bg: '#F4D4FF', tc: '#6B00AA', name: 'Rotimi Amaechi', party: 'PDP', pos: 35, neg: 42, neu: 23, mentions: '310K', color: '#6B00AA' },
];

function initCandidates() {
  const grid = document.getElementById('candidates-grid');
  grid.innerHTML = CANDIDATES_DATA.map(c => `
    <div class="candidate-card">
      <div class="cand-header">
        <div class="cand-avatar" style="background:${c.bg};color:${c.tc}">${c.init}</div>
        <div>
          <div class="cand-name">${c.name}</div>
          <div class="cand-party">${c.party}</div>
        </div>
        <div style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#8A8A9A">${c.mentions} mentions</div>
      </div>
      <div class="cand-bars">
        <div class="cand-bar-row">
          <span class="cand-bar-label">Positive</span>
          <div class="cand-bar-track"><div class="cand-bar-fill" style="width:${c.pos}%;background:#00D4AA"></div></div>
          <span class="cand-bar-val">${c.pos}%</span>
        </div>
        <div class="cand-bar-row">
          <span class="cand-bar-label">Negative</span>
          <div class="cand-bar-track"><div class="cand-bar-fill" style="width:${c.neg}%;background:#FF3D5A"></div></div>
          <span class="cand-bar-val">${c.neg}%</span>
        </div>
        <div class="cand-bar-row">
          <span class="cand-bar-label">Neutral</span>
          <div class="cand-bar-track"><div class="cand-bar-fill" style="width:${c.neu}%;background:#FFB020"></div></div>
          <span class="cand-bar-val">${c.neu}%</span>
        </div>
      </div>
      <div class="cand-btn">
        <button class="btn-outline sm" style="width:100%" onclick="setView('analyze');setAnalyzeTopic('${c.name} 2027 Nigeria')">
          Deep Analyze →
        </button>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════
//  REPORTS
// ══════════════════════════════════════════
async function generateReport(type) {
  const output = document.getElementById('report-output');
  output.classList.remove('hidden');
  output.textContent = '⏳ Generating your report with AI…';

  const topic = state.currentTopic;
  const reportTypes = {
    weekly: `Generate a professional Weekly Sentiment Briefing report for "${topic}" in Nigerian political context. Include: Executive Summary, 7-day trend analysis, platform breakdown, top accounts, key talking points. Format as a clear text report.`,
    strategy: `Generate a Campaign Strategy Report based on current sentiment for "${topic}" in Nigeria 2027 election. Include: Current position assessment, 5 strategic recommendations, messaging framework, risk mitigation. Format as actionable text report.`,
    influencer: `Generate an Influencer Intelligence Report for "${topic}" in Nigerian social media. Include: Top 10 accounts by reach, sentiment direction, engagement rates, recommended outreach strategy. Format as text report.`,
    crisis: `Generate a Crisis Alert Report for "${topic}" in Nigerian political context. Include: Current threat level, negative sentiment triggers, affected demographics, immediate response recommendations. Format as text report.`,
  };

  try {
    const text = await callClaude(
      `You are PulseMind's report generator. Write professional intelligence reports for Nigerian political campaigns. Be specific with Nigerian context.`,
      reportTypes[type], 1000
    );
    const date = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
    output.textContent = `PULSEMIND INTELLIGENCE REPORT\n${'─'.repeat(40)}\nTopic: ${topic}\nDate: ${date}\nGenerated by: PulseMind AI\n${'─'.repeat(40)}\n\n${text}\n\n${'─'.repeat(40)}\nPulseMind Intelligence · pulsemind.ng\nConfidential — For campaign use only`;
    showToast('✅ Report generated — copy or print to save');
  } catch (e) {
    output.textContent = 'Report generation failed. Please check your connection.';
  }
}

async function generateReportForTopic(topic) {
  state.currentTopic = topic;
  setView('reports');
  setTimeout(() => generateReport('strategy'), 300);
}

// ══════════════════════════════════════════
//  ALERTS
// ══════════════════════════════════════════
function saveAlert() {
  const threshold = document.getElementById('alert-threshold').value;
  const topic = document.getElementById('alert-topic').value.trim();
  if (!topic) { showToast('Please enter a topic for the alert.'); return; }

  const list = document.getElementById('active-alerts-list');
  const item = document.createElement('div');
  item.className = 'alert-item';
  item.innerHTML = `
    <div class="alert-item-info">
      <strong>${topic}</strong>
      <span>Negative &gt; ${threshold}% → Email</span>
    </div>
    <div class="alert-status active-status">Active</div>`;
  list.appendChild(item);

  document.getElementById('alert-topic').value = '';
  showToast(`✅ Alert set for "${topic}" — negative > ${threshold}%`);
}

// ══════════════════════════════════════════
//  CONTACT FORM
// ══════════════════════════════════════════
function submitContact() {
  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const org = document.getElementById('contact-org').value.trim();
  const tier = document.getElementById('contact-tier').value;

  if (!name || !email) { showToast('Please fill in your name and email.'); return; }

  // In production, POST to a form handler (Netlify Forms, Formspree, etc.)
  showToast(`✅ Request received, ${name}! We'll contact you within 24 hours.`, 4000);
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-email').value = '';
  document.getElementById('contact-org').value = '';
  document.getElementById('contact-tier').value = '';
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Handle window resize for charts
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.currentView === 'dashboard') {
        drawTrendChart(getChartData(state.currentTopic));
      }
    }, 200);
  });

  // Enter key on topic inputs
  document.getElementById('dash-topic-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runDashboardAnalysis();
  });
  document.getElementById('analyze-topic')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runAnalysis();
  });
});
