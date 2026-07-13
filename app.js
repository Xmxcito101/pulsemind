'use strict';
/* ═══════════════════════════════════════
   PULSEMIND V2 — app.js
   Multi-topic simultaneous tracking
   Powered by Claude AI (Anthropic)
═══════════════════════════════════════ */

// ── STATE ─────────────────────────────
const S = {
  topics: {},        // { id: { id, name, color, status, data } }
  activeId: null,
  view: 'empty',
  feedFilter: 'all',
  feedInterval: null,
  topicOrder: [],    // ordered list of ids
};

const COLORS = ['#FF3D5A','#6B4EFF','#00D4AA','#FFB020','#FF6B35','#00B4D8','#E040FB','#69F0AE','#FF80AB','#82B1FF'];
let colorIdx = 0;
function nextColor(){ return COLORS[colorIdx++ % COLORS.length]; }

// ── CLAUDE API ─────────────────────────
async function callClaude(system, user, maxTokens=1000){
  const res = await fetch('https://pulsemind-proxy.olusamson22.workers.dev',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:maxTokens, system, messages:[{role:'user',content:user}] })
  });
  if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.error?.message||`HTTP ${res.status}`); }
  const d = await res.json();
  return d.content.map(b=>b.text||'').join('');
}

function safeJSON(raw){
  const c = raw.replace(/```json|```/g,'').trim();
  const s = c.indexOf('[')!==-1 && (c.indexOf('{')===-1 || c.indexOf('[') < c.indexOf('{')) ? '[' : '{';
  const e = s==='[' ? ']' : '}';
  return JSON.parse(c.slice(c.indexOf(s), c.lastIndexOf(e)+1));
}

// ── TOAST ──────────────────────────────
function toast(msg, dur=3000){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t=setTimeout(()=>t.classList.add('hidden'),dur);
}

// ── SIDEBAR COLLAPSE ───────────────────
function toggleSidebar(){
  document.querySelector('.app').classList.toggle('collapsed');
}

// ── MAIN VIEW SWITCHING ────────────────
function setMainView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.sb-nav-item').forEach(el=>el.classList.remove('active'));
  S.view = v;

  // Show the right view, fall back to empty
  const viewEl = document.getElementById('view-'+v);
  if(viewEl) viewEl.classList.add('active');
  else document.getElementById('view-empty')?.classList.add('active');

  const navEl = document.getElementById('nav-'+v);
  if(navEl) navEl.classList.add('active');

  // Kill feed interval when leaving feed
  if(v !== 'feed' && S.feedInterval){ clearInterval(S.feedInterval); S.feedInterval = null; }

  // Lazy-render views
  if(v === 'feed') startFeed();
  if(v === 'compare') renderCompare();
  if(v === 'sources'   && S.activeId) renderSources();
  if(v === 'accounts'  && S.activeId) renderAccounts();
  if(v === 'locations' && S.activeId) renderLocations();
  if(v === 'insights'  && S.activeId) loadInsights();
  if(v === 'settings') renderSettings();
  if(v === 'overview'  && S.activeId && S.topics[S.activeId]?.status==='ready') renderOverview();
}

// ── TOPIC MANAGEMENT ──────────────────
function openAddTopic(){
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('new-topic-input').focus(),100);
}
function closeAddTopic(){
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('new-topic-input').value='';
}
function closeModal(e){
  if(e.target===document.getElementById('modal-overlay')) closeAddTopic();
}
function setModalTopic(t){ document.getElementById('new-topic-input').value=t; }

async function addTopic(){
  const name = document.getElementById('new-topic-input').value.trim();
  if(!name){ toast('Please enter a topic name.'); return; }

  // Check dupe
  const exists = Object.values(S.topics).find(t=>t.name.toLowerCase()===name.toLowerCase());
  if(exists){ toast('This topic is already being tracked.'); setActiveTopic(exists.id); closeAddTopic(); return; }

  const id = 'topic_'+Date.now();
  const color = nextColor();

  S.topics[id] = { id, name, color, status:'loading', data:null };
  S.topicOrder.push(id);
  closeAddTopic();
  renderTopicList();
  setActiveTopic(id);
  toast(`⏳ Tracking "${name}"…`);

  try {
    const data = await fetchTopicData(name);
    S.topics[id].data = data;
    S.topics[id].status = 'ready';
    renderTopicList();
    if(S.activeId===id) renderActiveTopicData();
    toast(`✅ "${name}" is now live`);
  } catch(err){
    S.topics[id].status = 'error';
    renderTopicList();
    toast(`❌ Failed to load "${name}". Check API key.`);
    console.error(err);
  }
}

async function quickAdd(name){
  document.getElementById('new-topic-input').value = name;
  await addTopic();
}

function removeTopic(id, e){
  e && e.stopPropagation();
  const name = S.topics[id]?.name;
  delete S.topics[id];
  S.topicOrder = S.topicOrder.filter(x=>x!==id);
  if(S.activeId===id){
    S.activeId=null;
    const next = S.topicOrder[0];
    if(next) setActiveTopic(next);
    else { setMainView('empty'); updateTopbar(); }
  }
  renderTopicList();
  if(S.view==='settings') renderSettings();
  if(S.view==='compare') renderCompare();
  toast(`Removed "${name}"`);
}

function setActiveTopic(id){
  if(!S.topics[id]) return;
  S.activeId = id;
  renderTopicList();
  updateTopbar();

  if(S.topics[id].status==='ready'){
    if(S.view==='empty' || !document.getElementById('view-'+S.view)) setMainView('overview');
    renderActiveTopicData();
  } else if(S.topics[id].status==='loading'){
    setMainView('overview');
    showLoadingState();
  } else {
    setMainView('overview');
    showErrorState();
  }
}

async function refreshActiveTopic(){
  if(!S.activeId) return;
  const t = S.topics[S.activeId];
  if(!t) return;
  t.status='loading';
  renderTopicList();
  showLoadingState();
  toast(`↺ Refreshing "${t.name}"…`);
  try {
    t.data = await fetchTopicData(t.name);
    t.status='ready';
    renderTopicList();
    renderActiveTopicData();
    toast(`✅ "${t.name}" refreshed`);
  } catch(err){
    t.status='error';
    renderTopicList();
    showErrorState();
    toast('❌ Refresh failed. Check API.');
  }
}

// ── FETCH ALL DATA FOR A TOPIC ────────
async function fetchTopicData(name){
  const system = `You are PulseMind's data engine — a senior Nigerian political intelligence analyst with 15 years experience. You understand Nigerian social media, politics, and public discourse deeply. Return ONLY valid JSON, no markdown, no preamble, no commentary.`;

  const prompt = `Generate comprehensive real-time sentiment intelligence data for the topic: "${name}" in Nigerian political/social context (2027 presidential election cycle).

Return this EXACT JSON structure:

{
  "sentiment": {
    "pos": <number 0-100>,
    "neg": <number 0-100>,
    "neu": <number 0-100>,
    "mentions": "<e.g. 284K or 1.2M>",
    "mentionsRaw": <number>,
    "posChange": "<e.g. +5.2%>",
    "negChange": "<e.g. +3.1%>",
    "trendDirection": "rising|falling|stable",
    "topPlatform": "<platform>",
    "dominantDemographic": "<e.g. Lagos youth, Northern voters>"
  },
  "summary": "<2-3 sentence expert summary of public sentiment, very specific to Nigeria>",
  "keyDrivers": {
    "positive": ["<driver>","<driver>","<driver>"],
    "negative": ["<driver>","<driver>","<driver>"]
  },
  "weekTrend": [
    {"day":"Mon","pos":<n>,"neg":<n>,"neu":<n>},
    {"day":"Tue","pos":<n>,"neg":<n>,"neu":<n>},
    {"day":"Wed","pos":<n>,"neg":<n>,"neu":<n>},
    {"day":"Thu","pos":<n>,"neg":<n>,"neu":<n>},
    {"day":"Fri","pos":<n>,"neg":<n>,"neu":<n>},
    {"day":"Sat","pos":<n>,"neg":<n>,"neu":<n>},
    {"day":"Sun","pos":<n>,"neg":<n>,"neu":<n>}
  ],
  "sources": [
    {
      "name": "X (Twitter)",
      "icon": "🐦",
      "color": "#1DA1F2",
      "bgColor": "#EFF8FF",
      "type": "Social Media",
      "mentions": "<number like 142K>",
      "posShare": <0-100>,
      "negShare": <0-100>,
      "neuShare": <0-100>,
      "topPost": "<realistic Nigerian tweet about this topic, max 140 chars>",
      "activeAccounts": "<number like 8.4K>",
      "reach": "<number like 12.4M>"
    },
    {
      "name": "Facebook",
      "icon": "📘",
      "color": "#1877F2",
      "bgColor": "#EEF3FF",
      "type": "Social Media",
      "mentions": "<number>",
      "posShare": <0-100>,
      "negShare": <0-100>,
      "neuShare": <0-100>,
      "topPost": "<realistic Nigerian Facebook post about this topic>",
      "activeAccounts": "<number>",
      "reach": "<number>"
    },
    {
      "name": "Reddit",
      "icon": "🔴",
      "color": "#FF4500",
      "bgColor": "#FFF2EE",
      "type": "Forum",
      "mentions": "<number>",
      "posShare": <0-100>,
      "negShare": <0-100>,
      "neuShare": <0-100>,
      "topPost": "<realistic Nigerian Reddit post about this topic>",
      "activeAccounts": "<number>",
      "reach": "<number>"
    },
    {
      "name": "Nigerian News Sites",
      "icon": "📰",
      "color": "#333333",
      "bgColor": "#F5F5F5",
      "type": "News Media",
      "mentions": "<number>",
      "posShare": <0-100>,
      "negShare": <0-100>,
      "neuShare": <0-100>,
      "topPost": "<realistic Nigerian news headline about this topic>",
      "activeAccounts": "<number like 47>",
      "reach": "<number>"
    },
    {
      "name": "YouTube",
      "icon": "▶️",
      "color": "#FF0000",
      "bgColor": "#FFF0F0",
      "type": "Video Platform",
      "mentions": "<number>",
      "posShare": <0-100>,
      "negShare": <0-100>,
      "neuShare": <0-100>,
      "topPost": "<realistic YouTube comment/title about this topic>",
      "activeAccounts": "<number>",
      "reach": "<number>"
    }
  ],
  "accounts": [
    {
      "rank": 1,
      "name": "<real or realistic Nigerian account name>",
      "handle": "@<handle>",
      "platform": "Twitter|Facebook|YouTube|Reddit",
      "followers": "<number like 1.8M>",
      "posts": <number>,
      "views": "<number like 4.2M>",
      "likes": "<number like 180K>",
      "comments": "<number like 22K>",
      "sentiment": "positive|negative|neutral",
      "initials": "<2 chars>",
      "avatarBg": "<hex color>",
      "avatarTc": "<hex color>"
    }
  ],
  "locations": [
    {"name":"Lagos","zone":"South West","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Abuja (FCT)","zone":"North Central","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Kano","zone":"North West","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Rivers (Port Harcourt)","zone":"South South","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Oyo (Ibadan)","zone":"South West","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Anambra","zone":"South East","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Kaduna","zone":"North West","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Delta","zone":"South South","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Enugu","zone":"South East","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>},
    {"name":"Borno","zone":"North East","mentions":<number>,"posShare":<0-100>,"negShare":<0-100>,"neuShare":<0-100>}
  ]
}

accounts array must have exactly 20 items. Make all data realistic for Nigerian political discourse in 2026. Pos+neg+neu must equal 100 for sentiment and each source/location.`;

  const raw = await callClaude(system, prompt, 3000);
  return safeJSON(raw);
}

// ── RENDER TOPIC LIST ─────────────────
function renderTopicList(){
  const container = document.getElementById('topic-list');
  if(!container) return;

  if(!S.topicOrder.length){
    container.innerHTML = '<div style="padding:8px 14px;font-size:.78rem;color:rgba(255,255,255,.25);font-style:italic">No topics yet</div>';
    return;
  }

  container.innerHTML = S.topicOrder.map(id=>{
    const t = S.topics[id];
    if(!t) return '';
    const isActive = id===S.activeId;
    const statusCls = t.status==='loading'?'loading':t.status==='error'?'error':'ready';
    const meta = t.status==='loading'?'Analyzing…':t.status==='error'?'Error — retry':
      t.data?`${t.data.sentiment?.mentions||'—'} mentions`:'Ready';

    return `<div class="topic-item ${isActive?'active':''}" onclick="setActiveTopic('${id}')">
      <div class="topic-dot" style="background:${t.color}"></div>
      <div class="topic-info">
        <div class="topic-name">${t.name}</div>
        <div class="topic-meta">${meta}</div>
      </div>
      <div class="topic-status ${statusCls}"></div>
      <button class="topic-remove" onclick="removeTopic('${id}',event)" title="Remove">✕</button>
    </div>`;
  }).join('');
}

// ── UPDATE TOPBAR ─────────────────────
function updateTopbar(){
  const t = S.activeId ? S.topics[S.activeId] : null;
  document.getElementById('active-topic-name').textContent = t ? t.name : 'Select a topic';

  const statsEl = document.getElementById('topbar-stats');
  if(t?.data?.sentiment){
    const s = t.data.sentiment;
    statsEl.innerHTML = `
      <div class="ts-item pos"><span class="ts-val">${s.pos}%</span><span class="ts-lbl">Positive</span></div>
      <div class="ts-item neg"><span class="ts-val">${s.neg}%</span><span class="ts-lbl">Negative</span></div>
      <div class="ts-item"><span class="ts-val" style="color:var(--mid)">${s.mentions}</span><span class="ts-lbl">Mentions</span></div>`;
  } else {
    statsEl.innerHTML = '';
  }
}

// ── RENDER ACTIVE TOPIC DATA ──────────
function renderActiveTopicData(){
  const t = S.topics[S.activeId];
  if(!t?.data) return;

  updateTopbar();

  const v = S.view;
  if(v==='overview'||v==='empty') renderOverview();
  if(v==='feed') startFeed();
  if(v==='sources') renderSources();
  if(v==='accounts') renderAccounts();
  if(v==='locations') renderLocations();
  if(v==='insights') loadInsights();
  if(v==='compare') renderCompare();

  if(S.view==='empty') setMainView('overview');
}

function showLoadingState(){
  const fields = ['ov-mentions','ov-pos','ov-neg','ov-neu','ov-summary'];
  fields.forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent='Loading…'; });
  const badge=document.getElementById('summary-badge');
  if(badge){ badge.textContent='Analyzing…'; badge.className='badge loading-badge'; }
  document.getElementById('ov-drivers').innerHTML='<div class="skeleton-block"></div><div class="skeleton-block"></div>';
}

function showErrorState(){
  document.getElementById('ov-summary').textContent = '❌ Could not load analysis. Check your API key in Vercel settings, then click Refresh.';
  const badge=document.getElementById('summary-badge');
  if(badge){ badge.textContent='Error'; badge.className='badge error-badge'; }
}

// ── OVERVIEW ─────────────────────────
function renderOverview(){
  const t = S.topics[S.activeId];
  if(!t?.data) return;
  const d = t.data;
  const s = d.sentiment;

  document.getElementById('ov-title').textContent = t.name;
  document.getElementById('ov-sub').textContent = `Real-time sentiment · ${s.mentions} mentions · ${s.trendDirection} trend`;
  document.getElementById('chart-label').textContent = t.name;

  // Metrics
  setMetric('ov-mentions', s.mentions, '');
  setMetric('ov-pos', s.pos+'%', s.posChange||'', true);
  setMetric('ov-neg', s.neg+'%', s.negChange||'', false);
  setMetric('ov-neu', s.neu+'%', 'Stable', null);

  // Donut
  document.getElementById('dl-pos').textContent = s.pos+'%';
  document.getElementById('dl-neg').textContent = s.neg+'%';
  document.getElementById('dl-neu').textContent = s.neu+'%';
  drawDonut(s.pos, s.neg, s.neu);

  // Trend chart
  if(d.weekTrend) drawTrend(d.weekTrend);

  // Summary
  document.getElementById('ov-summary').textContent = d.summary||'';
  const badge=document.getElementById('summary-badge');
  if(badge){ badge.textContent='AI Analysis'; badge.className='badge done-badge'; }

  const meta=document.getElementById('ov-meta');
  if(meta){
    meta.innerHTML = [
      s.topPlatform?`<span class="summary-tag">📱 ${s.topPlatform}</span>`:'',
      s.dominantDemographic?`<span class="summary-tag">👥 ${s.dominantDemographic}</span>`:'',
      `<span class="summary-tag">${s.trendDirection==='rising'?'↗':s.trendDirection==='falling'?'↘':'→'} ${s.trendDirection}</span>`,
    ].join('');
  }

  // Drivers
  const driversEl = document.getElementById('ov-drivers');
  if(driversEl && d.keyDrivers){
    driversEl.innerHTML = `
      <div class="driver-col pos">
        <h4>Positive Drivers</h4>
        ${(d.keyDrivers.positive||[]).map(dr=>`<div class="driver-item">${dr}</div>`).join('')}
      </div>
      <div class="driver-col neg">
        <h4>Negative Drivers</h4>
        ${(d.keyDrivers.negative||[]).map(dr=>`<div class="driver-item">${dr}</div>`).join('')}
      </div>`;
  }
}

function setMetric(id, val, delta, isUp){
  const el=document.getElementById(id);
  if(el){ el.style.opacity='0'; setTimeout(()=>{ el.textContent=val; el.style.transition='all .4s'; el.style.opacity='1'; },120); }
  const did = id+'-delta';
  const del=document.getElementById(did);
  if(del && delta){
    del.textContent=delta;
    del.className='mc-delta'+(isUp===true?' up':isUp===false?' down':'');
  }
}

// ── CHARTS ────────────────────────────
function drawTrend(data){
  const canvas=document.getElementById('trend-chart');
  if(!canvas) return;
  const W=canvas.offsetWidth||600, H=150;
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  const pad={t:10,r:12,b:24,l:28};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const maxVal=Math.max(...data.map(d=>d.pos+d.neg+d.neu))*1.2||100;

  // Grid
  [.25,.5,.75,1].forEach(r=>{
    const y=pad.t+cH-cH*r;
    ctx.strokeStyle='#EEEEF5'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
    ctx.fillStyle='#BBBBC8'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(Math.round(maxVal*r),pad.l-3,y+3);
  });

  const bw=(cW/data.length)*0.68;
  const gap=(cW/data.length)*0.32/2;
  const ew=bw/3;

  data.forEach((d,i)=>{
    const x=pad.l+(cW/data.length)*i+gap;
    [['pos','#00D4AA'],['neg','#FF3D5A'],['neu','#FFB020']].forEach(([k,c],j)=>{
      const bh=(d[k]/maxVal)*cH;
      ctx.fillStyle=c;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x+ew*j,pad.t+cH-bh,ew-1.5,bh,[2,2,0,0]);
      else ctx.rect(x+ew*j,pad.t+cH-bh,ew-1.5,bh);
      ctx.fill();
    });
    ctx.fillStyle='#BBBBC8'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(d.day,x+bw/2,H-6);
  });
}

function drawDonut(pos,neg,neu){
  const canvas=document.getElementById('donut-chart');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const sz=150, cx=sz/2, cy=sz/2, r=56, ri=36;
  canvas.width=sz; canvas.height=sz;
  ctx.clearRect(0,0,sz,sz);

  let start=-Math.PI/2;
  [[pos,'#00D4AA'],[neg,'#FF3D5A'],[neu,'#FFB020']].forEach(([v,c])=>{
    const angle=(v/100)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+angle); ctx.closePath();
    ctx.fillStyle=c; ctx.fill();
    start+=angle;
  });

  ctx.beginPath(); ctx.arc(cx,cy,ri,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill();

  ctx.fillStyle='#08080D'; ctx.font=`bold 18px 'DM Serif Display',serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(pos+'%',cx,cy-5);
  ctx.fillStyle='#8888A0'; ctx.font=`10px 'Space Grotesk',sans-serif`;
  ctx.fillText('Positive',cx,cy+10);
}

// ── DATA SOURCES ──────────────────────
function renderSources(){
  const t=S.topics[S.activeId];
  if(!t?.data?.sources) return;

  document.getElementById('sources-sub').textContent=`Tracking "${t.name}" across ${t.data.sources.length} platforms`;

  document.getElementById('sources-content').innerHTML = t.data.sources.map(src=>`
    <div class="source-card">
      <div class="sc-header">
        <div class="sc-icon" style="background:${src.bgColor}">${src.icon}</div>
        <div>
          <div class="sc-name">${src.name}</div>
          <div class="sc-type">${src.type}</div>
        </div>
      </div>
      <div class="sc-stats">
        <div class="sc-stat"><div class="sc-stat-val">${src.mentions}</div><div class="sc-stat-lbl">Mentions</div></div>
        <div class="sc-stat"><div class="sc-stat-val">${src.reach}</div><div class="sc-stat-lbl">Est. Reach</div></div>
        <div class="sc-stat"><div class="sc-stat-val">${src.activeAccounts}</div><div class="sc-stat-lbl">Accounts</div></div>
        <div class="sc-stat"><div class="sc-stat-val" style="color:var(--pos-t)">${src.posShare}%</div><div class="sc-stat-lbl">Positive</div></div>
      </div>
      <div class="sc-sentiment-bar">
        <div class="sc-bar-seg" style="width:${src.posShare}%;background:#00D4AA"></div>
        <div class="sc-bar-seg" style="width:${src.negShare}%;background:#FF3D5A"></div>
        <div class="sc-bar-seg" style="width:${src.neuShare}%;background:#FFB020"></div>
      </div>
      <div class="sc-sentiment-labels">
        <span>+${src.posShare}% positive</span>
        <span>${src.negShare}% negative</span>
        <span>${src.neuShare}% neutral</span>
      </div>
      <div class="sc-top-post" style="margin-top:12px">
        <div class="sc-top-post-label">Top Post</div>
        ${src.topPost||'—'}
      </div>
    </div>`).join('');
}

// ── TOP ACCOUNTS ─────────────────────
function renderAccounts(){
  const t=S.topics[S.activeId];
  if(!t?.data?.accounts) return;
  document.getElementById('accounts-sub').textContent=`Top 20 accounts discussing "${t.name}"`;

  document.getElementById('accounts-table-body').innerHTML = t.data.accounts.map((a,i)=>`
    <div class="account-row">
      <span class="ar-rank">${i+1}</span>
      <div class="ar-info">
        <div class="ar-avatar" style="background:${a.avatarBg||'#E0D4FF'};color:${a.avatarTc||'#5B3FCC'}">${a.initials||a.name?.slice(0,2)||'??'}</div>
        <div>
          <div class="ar-name">${a.name}</div>
          <div class="ar-handle">${a.handle}</div>
        </div>
      </div>
      <span class="ar-platform">${a.platform}</span>
      <span class="ar-num">${typeof a.posts==='number'?a.posts.toLocaleString():a.posts}</span>
      <span class="ar-num">${a.views}</span>
      <span class="ar-num">${a.likes}</span>
      <span class="ar-num">${a.comments}</span>
      <span class="sp-pill sp-${a.sentiment==='positive'?'pos':a.sentiment==='negative'?'neg':'neu'}">${a.sentiment}</span>
    </div>`).join('');
}

// ── LOCATIONS ────────────────────────
function renderLocations(){
  const t=S.topics[S.activeId];
  if(!t?.data?.locations) return;
  document.getElementById('locations-sub').textContent=`Where "${t.name}" is being discussed`;

  const locs=t.data.locations;
  const maxM=Math.max(...locs.map(l=>l.mentions))||1;

  document.getElementById('locations-list').innerHTML = locs.map((l,i)=>`
    <div class="location-item">
      <span class="loc-rank">${i+1}</span>
      <span class="loc-name">${l.name}</span>
      <div class="loc-bar-wrap"><div class="loc-bar-fill" style="width:${Math.round((l.mentions/maxM)*100)}%"></div></div>
      <span class="loc-count">${l.mentions?.toLocaleString()||'—'}</span>
      <div class="loc-sentiment">
        <div class="loc-seg" style="background:#00D4AA;width:${Math.round(l.posShare*20/100)}px"></div>
        <div class="loc-seg" style="background:#FF3D5A;width:${Math.round(l.negShare*20/100)}px"></div>
      </div>
    </div>`).join('');

  // Zones
  const zones = {};
  locs.forEach(l=>{
    if(!zones[l.zone]) zones[l.zone]={name:l.zone,pos:0,neg:0,neu:0,total:0};
    zones[l.zone].total+=l.mentions;
    zones[l.zone].pos+=l.posShare*l.mentions/100;
    zones[l.zone].neg+=l.negShare*l.mentions/100;
    zones[l.zone].neu+=l.neuShare*l.mentions/100;
  });

  document.getElementById('zones-list').innerHTML = Object.values(zones).sort((a,b)=>b.total-a.total).map(z=>{
    const totalM=Math.max(z.total,1);
    const posP=Math.round(z.pos/totalM*100), negP=Math.round(z.neg/totalM*100), neuP=100-posP-negP;
    return `<div class="zone-item">
      <div class="zone-name">${z.name}</div>
      <div class="zone-bar">
        <div style="width:${posP}%;background:#00D4AA;height:100%"></div>
        <div style="width:${negP}%;background:#FF3D5A;height:100%"></div>
        <div style="width:${Math.max(0,neuP)}%;background:#FFB020;height:100%"></div>
      </div>
      <div class="zone-stats"><span>+${posP}% pos</span><span>${negP}% neg</span><span>${z.total.toLocaleString()} mentions</span></div>
    </div>`;
  }).join('');
}

// ── AI INSIGHTS ──────────────────────
async function loadInsights(){
  const t=S.topics[S.activeId];
  if(!t) return;
  const container=document.getElementById('insights-content');
  container.innerHTML=`<div class="insights-loading"><div class="loading-ring"></div><p>Generating strategic insights for "${t.name}"…</p></div>`;

  try {
    const raw = await callClaude(
      `You are PulseMind's chief strategist. 15 years of Nigerian political intelligence. Return ONLY valid JSON arrays.`,
      `Generate 6 deep strategic insights for "${t.name}" in Nigerian 2027 election context.
Return JSON array of exactly 6 objects:
[{"type":"positive|negative|opportunity","icon":"<emoji>","title":"<title>","body":"<2-3 sentences with specific Nigerian political context — mention states, parties, demographics, current issues>","actions":["<action 1>","<action 2>","<action 3>"]}]
Cover: voter demographics by geopolitical zone, social media strategy, opposition analysis, opportunity windows, crisis prevention, diaspora sentiment.`,
      1400
    );
    const insights = safeJSON(raw);
    container.innerHTML = '';
    insights.forEach((ins,i)=>{
      const tc=ins.type==='positive'?'pos':ins.type==='negative'?'neg':'opp';
      const tl=ins.type==='positive'?'Positive Signal':ins.type==='negative'?'Negative Risk':'Opportunity';
      setTimeout(()=>{
        const el=document.createElement('div');
        el.className='insight-full';
        el.innerHTML=`
          <div class="ifc-type ${tc}">// ${tl}</div>
          <div class="ifc-title">${ins.icon} ${ins.title}</div>
          <div class="ifc-body">${ins.body}</div>
          ${ins.actions?`<div class="ifc-actions">${ins.actions.map(a=>`<span class="action-tag">→ ${a}</span>`).join('')}</div>`:''}`;
        container.appendChild(el);
      },i*140);
    });
  } catch(err){
    container.innerHTML=`<div class="insight-full"><p style="color:#CC1A30;font-size:.88rem">❌ Could not load insights. Check your API key in Vercel settings → Environment Variables → ANTHROPIC_API_KEY.</p></div>`;
    console.error(err);
  }
}

// ── COMPARE TOPICS ───────────────────
function renderCompare(){
  const container=document.getElementById('compare-content');
  const ready=S.topicOrder.filter(id=>S.topics[id]?.status==='ready');

  if(ready.length<2){
    container.innerHTML=`<div class="compare-empty">Track at least 2 topics to compare them side by side.<br><br><button class="btn-primary" onclick="openAddTopic()">+ Add Another Topic</button></div>`;
    return;
  }

  container.innerHTML=ready.map(id=>{
    const t=S.topics[id];
    const s=t.data?.sentiment||{};
    return `<div class="compare-card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="width:10px;height:10px;border-radius:50%;background:${t.color};flex-shrink:0"></div>
        <div class="cc-name">${t.name}</div>
      </div>
      <div class="cc-meta">${s.mentions||'—'} mentions · ${s.trendDirection||'—'}</div>
      <div class="cc-bars">
        <div class="cc-bar-row">
          <span class="cc-bar-label">Positive</span>
          <div class="cc-bar-track"><div class="cc-bar-fill" style="width:${s.pos||0}%;background:#00D4AA"></div></div>
          <span class="cc-bar-val">${s.pos||0}%</span>
        </div>
        <div class="cc-bar-row">
          <span class="cc-bar-label">Negative</span>
          <div class="cc-bar-track"><div class="cc-bar-fill" style="width:${s.neg||0}%;background:#FF3D5A"></div></div>
          <span class="cc-bar-val">${s.neg||0}%</span>
        </div>
        <div class="cc-bar-row">
          <span class="cc-bar-label">Neutral</span>
          <div class="cc-bar-track"><div class="cc-bar-fill" style="width:${s.neu||0}%;background:#FFB020"></div></div>
          <span class="cc-bar-val">${s.neu||0}%</span>
        </div>
      </div>
      <div style="margin-top:12px;font-size:.75rem;color:#888;line-height:1.5">${t.data?.summary?.slice(0,120)||''}…</div>
      <button class="btn-outline sm" style="width:100%;margin-top:12px" onclick="setActiveTopic('${id}');setMainView('overview')">View Full Analysis →</button>
    </div>`;
  }).join('');
}

// ── LIVE FEED ────────────────────────
const FEED_TPLS = {
  positive:[
    "I'm fully behind {t} after seeing what they've achieved. The youth of Lagos are ready. #Nigeria2027 🇳🇬",
    "Finally someone speaking our language. {t} understands the suffering of ordinary Nigerians. PVC ready! ✅",
    "The rally in Abuja today for {t} was massive! Energy was unreal. This is a movement, not just a campaign.",
    "My people in Anambra are galvanised. {t} offers real hope for the South East. We will vote!",
    "After much research, {t} has the most credible economic plan for Nigeria. The numbers actually add up."
  ],
  negative:[
    "How can anyone trust {t} after everything we've been through? Empty promises again. Nigeria deserves better.",
    "Fuel is still ₦1,200/litre, dollar at ₦1,600, and {t} is talking about 2027? Fix Nigeria first!",
    "{t} has no plan for the North-East security crisis. Thousands are displaced and we hear nothing. Shameful.",
    "Same recycled politicians backing {t}. Until we have new blood, nothing will change in Nigeria. #JapaBetter",
    "The hypocrisy of {t}'s supporters is unbelievable. Where were they when Nigerians were suffering?"
  ],
  neutral:[
    "Still undecided on {t}. Need to see more specific policies on education and healthcare before deciding.",
    "Watching the debate on {t}. Interesting points on both sides. Lagos voters need to think carefully. 🤔",
    "Has anyone done a proper policy comparison between the candidates? {t} vs the others — real talk only.",
  ]
};
const NG_PEOPLE=[
  {n:'Chukwuemeka Okafor',h:'@chuks_lag',i:'CO',bg:'#E0D4FF',tc:'#5B3FCC'},
  {n:'Fatima Al-Hassan',h:'@fatima_kano',i:'FA',bg:'#D4F5EC',tc:'#007A62'},
  {n:'Babatunde Adeyemi',h:'@babs_ibadan',i:'BA',bg:'#FFD4DC',tc:'#CC1A30'},
  {n:'Ngozi Eze',h:'@ngozi_abj',i:'NE',bg:'#D4E8FF',tc:'#0055CC'},
  {n:'Ibrahim Musa',h:'@ibro_kd',i:'IM',bg:'#FFE8B3',tc:'#8B5000'},
  {n:'Adaeze Okonkwo',h:'@ada_enugu',i:'AO',bg:'#F4D4FF',tc:'#6B00AA'},
  {n:'Yusuf Garba',h:'@yusuf_sk',i:'YG',bg:'#D4FFE8',tc:'#007A40'},
  {n:'Tolu Balogun',h:'@tolu_ph',i:'TB',bg:'#FFD4F0',tc:'#AA0066'},
  {n:'Emeka Nwosu',h:'@emeka_owerri',i:'EN',bg:'#D4F0FF',tc:'#0066AA'},
  {n:'Hauwa Shehu',h:'@hauwa_maid',i:'HS',bg:'#FFF4D4',tc:'#AA6600'},
];
const PLATFORMS=['X (Twitter)','Facebook','Reddit','Nairaland','WhatsApp Channel'];

function genFeedItem(topic, filter){
  const types=['positive','negative','neutral'];
  const weights=[.58,.3,.12];
  let type = filter && filter!=='all' ? filter : (() => {
    const r=Math.random();
    return r<weights[0]?'positive':r<weights[0]+weights[1]?'negative':'neutral';
  })();
  const tpls=FEED_TPLS[type];
  const tpl=tpls[Math.floor(Math.random()*tpls.length)];
  const person=NG_PEOPLE[Math.floor(Math.random()*NG_PEOPLE.length)];
  const short=topic.split(' ').slice(0,3).join(' ');
  const text=tpl.replace(/{t}/g,short);
  const platform=PLATFORMS[Math.floor(Math.random()*PLATFORMS.length)];
  const mins=Math.floor(Math.random()*12)+1;
  const views=Math.floor(Math.random()*50+1)+'K';
  const likes=Math.floor(Math.random()*5000+100).toLocaleString();
  const comments=Math.floor(Math.random()*500+10).toLocaleString();

  return `<div class="feed-item ${type}">
    <div class="feed-avatar" style="background:${person.bg};color:${person.tc}">${person.i}</div>
    <div class="feed-body">
      <div class="feed-meta">
        <span class="feed-name">${person.n}</span>
        <span class="feed-handle">${person.h}</span>
        <span class="sp-pill sp-${type==='positive'?'pos':type==='negative'?'neg':'neu'}">${type==='positive'?'😊':type==='negative'?'😡':'😐'} ${type}</span>
        <span class="feed-time">${mins}m ago</span>
      </div>
      <div class="feed-text">${text}</div>
      <div class="feed-footer">
        <span class="feed-platform">📍 ${platform}</span>
        <div class="feed-stats">
          <span class="feed-stat">👁 ${views}</span>
          <span class="feed-stat">❤️ ${likes}</span>
          <span class="feed-stat">💬 ${comments}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function startFeed(){
  if(S.feedInterval){ clearInterval(S.feedInterval); S.feedInterval=null; }
  const t=S.topics[S.activeId];
  const topic=t?.name||'Nigeria 2027';
  const container=document.getElementById('feed-list');
  document.getElementById('feed-sub').textContent=`Live mentions for "${topic}"`;
  container.innerHTML='';
  for(let i=0;i<10;i++) container.innerHTML+=genFeedItem(topic,S.feedFilter!=='all'?S.feedFilter:null);

  S.feedInterval=setInterval(()=>{
    if(S.view!=='feed') return;
    const item=document.createElement('div');
    item.innerHTML=genFeedItem(topic,S.feedFilter!=='all'?S.feedFilter:null);
    container.insertBefore(item.firstElementChild,container.firstChild);
    while(container.children.length>40) container.removeChild(container.lastChild);
  },3500);
}

function setFeedFilter(el,f){
  document.querySelectorAll('.ff').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  S.feedFilter=f;
  if(S.feedInterval){clearInterval(S.feedInterval);S.feedInterval=null;}
  startFeed();
}

// ── REPORTS ──────────────────────────
async function generateReport(type){
  const t=S.topics[S.activeId];
  if(!t?.data){ toast('Select and load a topic first.'); return; }
  const output=document.getElementById('report-output');
  output.classList.remove('hidden');
  output.textContent='⏳ Generating AI report…';

  const prompts={
    full:`Write a comprehensive intelligence report for "${t.name}" including: Executive Summary, Sentiment Overview (${t.data.sentiment.pos}% positive, ${t.data.sentiment.neg}% negative, ${t.data.sentiment.neu}% neutral, ${t.data.sentiment.mentions} mentions), Platform Breakdown, Top Locations, Key Drivers, and Strategic Recommendations. Nigerian political context, 2027 election cycle.`,
    strategy:`Write a Campaign Strategy Report for "${t.name}". Include: Current Position, 5 Strategic Recommendations, Message Framework, Risk Mitigation Plan, and 30-day Action Plan. Positive: ${t.data.sentiment.pos}%, Negative: ${t.data.sentiment.neg}%. Nigerian political context.`,
    crisis:`Write a Crisis Intelligence Report for "${t.name}". Include: Threat Level Assessment, Negative Sentiment Triggers, Affected Regions, Affected Demographics, Immediate Response Playbook (next 48hrs), and Long-term Reputation Recovery Plan. Negative: ${t.data.sentiment.neg}%.`,
    influencer:`Write an Influencer Intelligence Report for "${t.name}". Include top account analysis, engagement patterns, sentiment direction by account, and recommended engagement strategy. Reference real Nigerian media and political influencers.`
  };

  try {
    const text=await callClaude(
      `You are PulseMind's intelligence report writer. 15 years of Nigerian political consulting. Write professional, specific, actionable reports for Nigerian campaigns and brands.`,
      prompts[type], 1200
    );
    const date=new Date().toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'});
    output.textContent=`PULSEMIND INTELLIGENCE REPORT\n${'─'.repeat(44)}\nTopic: ${t.name}\nReport: ${type.toUpperCase()}\nDate: ${date}\nGenerated by: PulseMind AI v2.0\n${'─'.repeat(44)}\n\n${text}\n\n${'─'.repeat(44)}\nPulseMind Intelligence · Nigeria 2027\nConfidential — For authorised use only`;
    toast('✅ Report ready — scroll down to read');
  } catch(err){
    output.textContent='❌ Report generation failed. Check API key.';
    console.error(err);
  }
}

// ── SETTINGS ─────────────────────────
function renderSettings(){
  const container=document.getElementById('settings-topics-list');
  if(!S.topicOrder.length){
    container.innerHTML='<p style="color:#888;font-size:.85rem">No topics tracked yet.</p>';
    return;
  }
  container.innerHTML=S.topicOrder.map(id=>{
    const t=S.topics[id];
    if(!t) return '';
    return `<div class="settings-topic-row">
      <div class="str-dot" style="background:${t.color}"></div>
      <span class="str-name">${t.name}</span>
      <span class="str-status">${t.status}</span>
      <button class="str-remove" onclick="removeTopic('${id}')">Remove</button>
    </div>`;
  }).join('');
}

// ── KEYBOARD SHORTCUTS ────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeAddTopic();
  if((e.ctrlKey||e.metaKey) && e.key==='k'){ e.preventDefault(); openAddTopic(); }
});
document.getElementById('new-topic-input')?.addEventListener('keydown',e=>{
  if(e.key==='Enter') addTopic();
});

// ── RESIZE ────────────────────────────
let resizeT;
window.addEventListener('resize',()=>{
  clearTimeout(resizeT);
  resizeT=setTimeout(()=>{
    const t=S.topics[S.activeId];
    if(t?.data?.weekTrend) drawTrend(t.data.weekTrend);
  },200);
});

// ── INIT ──────────────────────────────
// init handled below by landing page loader

/* ═══════════════════════════════════════
   LANDING PAGE FUNCTIONS
═══════════════════════════════════════ */

function enterDashboard(){
  const landing = document.getElementById('landing');
  const app = document.getElementById('dashboard-app');
  if(landing) landing.style.display = 'none';
  if(app) app.style.display = 'block';
  // Ensure body doesn't overflow
  document.body.style.overflow = 'hidden';
}

function showLanding(){
  const landing = document.getElementById('landing');
  const app = document.getElementById('dashboard-app');
  if(landing) landing.style.display = 'block';
  if(app) app.style.display = 'none';
  document.body.style.overflow = 'auto';
}

function scrollToContact(){
  document.getElementById('contact')?.scrollIntoView({ behavior:'smooth' });
}

function submitContact(){
  const name  = document.getElementById('c-name')?.value.trim();
  const email = document.getElementById('c-email')?.value.trim();
  if(!name || !email){ toast('Please enter your name and email.'); return; }
  // In production, POST to a form handler (Netlify Forms, Formspree, etc.)
  alert(`✅ Thank you ${name}!\n\nWe've received your request and will contact you within 24 hours.\n\nYou can also try the dashboard right now — no sign-up needed.`);
  // Clear form
  ['c-name','c-org','c-email','c-phone','c-plan'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
}

// Override DOMContentLoaded to show landing first
document.addEventListener('DOMContentLoaded', ()=>{
  // Show landing page, hide dashboard
  const landing = document.getElementById('landing');
  const app = document.getElementById('dashboard-app');
  if(landing) landing.style.display = 'block';
  if(app) app.style.display = 'none';
  document.body.style.overflow = 'auto';

  // Init sidebar back-to-home button in dashboard
  const sbLogo = document.querySelector('.sb-logo');
  if(sbLogo){
    sbLogo.style.cursor = 'pointer';
    sbLogo.title = 'Back to home';
    sbLogo.addEventListener('click', showLanding);
  }

  renderTopicList();
});
