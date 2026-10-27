import './style.css';
import { initContactForm } from './contact-form.js';

(() => {
'use strict';
const $ = s => document.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';
const S = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

/* colours from the theme, for canvas */
let C = {};
function readColors(){ const cs = getComputedStyle(document.documentElement); for (const k of ['a1','a2','a3','ink','muted','line','bg','surface']) C[k] = cs.getPropertyValue('--' + k).trim(); }
const hex = h => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i, i + 2), 16)); };
function ramp(w){ // attention weight → indigo · magenta · amber
  const a = hex(C.a1), b = hex(C.a2), c = hex(C.a3);
  const t = Math.max(0, Math.min(1, w));
  const [x, y, f] = t < .5 ? [a, b, t * 2] : [b, c, (t - .5) * 2];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * f)).join(',')})`;
}
readColors();

/* ───────── 1 · the prompt ───────── */
const TOK = [['Hil',13291],[' Kal',35940],['ath',776],['iya',7745],[' builds',22107],[' agents',13307],[' that',430],[' show',1501],[' their',872],[' work',990],['.',13]];
const ATT = { // query → {key: weight}; hand-set to read like a real head
  0:{1:.46,2:.3,3:.24}, 1:{0:.72,2:.2,3:.08}, 2:{1:.58,0:.32,3:.1}, 3:{2:.5,1:.3,0:.2},
  4:{0:.44,5:.34,9:.12,3:.1}, 5:{4:.42,9:.26,7:.2,0:.12}, 6:{5:.74,4:.16,9:.1}, 7:{5:.38,9:.32,8:.18,6:.12},
  8:{5:.78,0:.14,7:.08}, 9:{7:.42,4:.3,5:.2,8:.08}, 10:{9:.5,0:.22,4:.16,5:.12},
};
const tokBox = $('#tokens'), arcs = $('#arcs');
const tokEls = TOK.map(([t, id], i) => {
  const el = document.createElement('span'); el.className = 'tok'; el.tabIndex = 0; el.dataset.i = i;
  el.innerHTML = `<b></b><i>${id}</i>`; el.querySelector('b').textContent = t;
  el.setAttribute('aria-label', `token “${t.trim()}”, id ${id}`);
  tokBox.append(el); return el;
});
let query = 5, userQuery = false;
function drawArcs(){
  const r = tokBox.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  arcs.width = r.width * dpr; arcs.height = r.height * dpr;
  const g = arcs.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const w = ATT[query] || {};
  tokEls.forEach((el, i) => { el.classList.toggle('q', i === query); el.classList.toggle('dim', i !== query && !(i in w)); });
  const pt = el => { const b = el.querySelector('b').getBoundingClientRect(); return [b.left - r.left + b.width / 2, b.top - r.top + 4]; };
  const [qx, qy] = pt(tokEls[query]);
  Object.entries(w).sort((a, b) => a[1] - b[1]).forEach(([k, v]) => {
    const [kx, ky] = pt(tokEls[k]);
    const lift = Math.min(r.height * .9, 30 + Math.abs(kx - qx) * .42 + Math.abs(ky - qy) * .3);
    const cy = Math.max(26, Math.min(qy, ky) - lift);
    g.beginPath(); g.moveTo(qx, qy); g.bezierCurveTo(qx, cy, kx, cy, kx, ky);
    g.lineWidth = 1.5 + v * 16; g.strokeStyle = ramp(v); g.globalAlpha = .35 + v * .65; g.lineCap = 'round'; g.stroke();
    g.globalAlpha = 1; g.fillStyle = ramp(v);
    g.font = '600 12px "JetBrains Mono", monospace';
    g.fillText(v.toFixed(2), (qx + kx) / 2 - 14, Math.max(14, cy + (Math.min(qy, ky) - cy) * .25 - 6));
  });
  g.globalAlpha = 1;
}
tokEls.forEach((el, i) => {
  const set = () => { userQuery = true; query = i; drawArcs(); };
  el.addEventListener('mouseenter', set); el.addEventListener('focus', set); el.addEventListener('click', set);
});
tokBox.addEventListener('mouseleave', () => { userQuery = false; });
// the head keeps reading on its own when nobody is pointing
setInterval(() => { if (userQuery || RM) return; query = (query + 1) % TOK.length; drawArcs(); }, 2200);

/* decoding a second sentence, token by token */
const STEPS = [
  [[' He',.54],[' His',.18],[' Every',.11],[' Each',.09],[' I',.05]],
  [[' ships',.47],[' builds',.21],[' designs',.14],[' is',.1],[' tests',.05]],
  [[' LangGraph',.38],[' RAG',.24],[' agentic',.2],[' ML',.1],[' tool',.05]],
  [[' agents',.52],[' systems',.3],[' pipelines',.1],[' graphs',.05],[' apps',.02], 1],
  [[' with',.44],[' that',.3],[' behind',.12],[' and',.09],[' under',.04]],
  [[' guardrails',.41],[' tests',.26],[' evals',.17],[' humans',.09],[' care',.04]],
  [['.',.71],[',',.18],[' and',.06],['!',.03],[' —',.01]],
];
const genline = $('#genline'), topk = $('#topk'), stepN = $('#stepN'), pickNote = $('#pickNote');
const caret = genline.querySelector('.caret');
function renderTopk(cands, pick){
  topk.innerHTML = cands.map(([t, p], i) => `<div class="krow${i === pick ? ' pick' : ''}"><span class="t"></span><span class="bar"><span style="width:${p * 100}%"></span></span><span class="p">${p.toFixed(2)}</span></div>`).join('');
  [...topk.querySelectorAll('.t')].forEach((el, i) => el.textContent = JSON.stringify(cands[i][0]));
}
async function decode(){
  const sleep = ms => new Promise(r => setTimeout(r, RM ? 0 : ms));
  for (let s = 0; s < STEPS.length; s++){
    const st = STEPS[s], cands = st.slice(0, 5), pick = typeof st[5] === 'number' ? st[5] : 0;
    stepN.textContent = 'step ' + (s + 1) + ' / ' + STEPS.length;
    renderTopk(cands, -1); pickNote.textContent = 'scoring candidates…';
    await sleep(650);
    renderTopk(cands, pick);
    pickNote.textContent = pick ? `sampled “${cands[pick][0].trim()}” at p = ${cands[pick][1]} — not the top choice` : `picked “${cands[pick][0].trim()}”`;
    genline.querySelectorAll('.gtok.new').forEach(x => x.classList.remove('new'));
    const el = document.createElement('span'); el.className = 'gtok new'; el.textContent = cands[pick][0].trim();
    genline.insertBefore(el, caret);
    await sleep(700);
  }
  genline.querySelectorAll('.gtok.new').forEach(x => x.classList.remove('new'));
  pickNote.textContent = 'done · 7 tokens · <eos> reached';
}

/* ───────── 2 · the sequence ───────── */
const EV = [
  { t:'git init', d:'JUL 2023', h:'B.Tech ICT at PDEU', p:'Information and Communication Technology at Pandit Deendayal Energy University, Gandhinagar. CGPA 8.55 / 10.', a:{} },
  { t:'ISRO-IIRS', d:'SEP 2024', h:'AI/ML for geodata', p:'A certificate in AI and ML for geodata analysis from the Indian Institute of Remote Sensing, ISRO.', a:{0:[.62,'coursework turned into a first ML certificate']} },
  { t:'SIH 2024', d:'2024', h:'Smart India Hackathon, top 25', p:'Among the top 25 teams in PDEU\'s internal round.', a:{0:[.4,'first time building under a deadline'],1:[.3,'ML ideas taken into a team build']} },
  { t:'IEEE AIMV', d:'2025', h:'Lead student volunteer', p:'Ran operations for 160+ researchers at IEEE AIMV 2025, hosted at PDEU.', a:{2:[.34,'running a team under pressure']} },
  { t:'SIH 2025', d:'2025', h:'Top 25 again', p:'A second top-25 finish in the PDEU round, a year later.', a:{2:[.72,'same bar, second attempt'],3:[.18,'better at coordinating people']} },
  { t:'NPTEL DL', d:'JUL–OCT 2025', h:'Deep Learning, IIT Ropar', p:'NPTEL Deep Learning from IIT Ropar, with an Elite certificate.', a:{1:[.52,'from classical ML to deep nets'],0:[.2,'theory from the degree']} },
  { t:'OpenEnv', d:'FEB–MAY 2026', h:'An LLM learns to clean data', p:'Co-built an RL environment where agents clean messy tables one action at a time, deployed on Hugging Face Spaces.', a:{5:[.5,'RL and deep nets in practice'],4:[.22,'hackathon teamwork']} },
  { t:'HNNOIX', d:'MAY–JUL 2026', h:'AI/ML intern, 5G/6G R&D', p:'Built an agentic RAG copilot over 5G measurement data, plus an anomaly detector and an RSRP forecaster.', a:{6:[.6,'agent loops and their guardrails'],5:[.22,'model choice for small data']} },
  { t:'HospitalOps', d:'JUN 2026 →', h:'Forecasting + planning', p:'Bed-demand forecasting with leakage-safe validation and an exact MILP planner. The agent layer is next.', a:{7:[.5,'LangGraph orchestration'],6:[.24,'honest evaluation, kept apart from scoring']} },
  { t:'CrohnSight', d:'2026 →', h:'Lesions in capsule endoscopy', p:'A 10-model EfficientNet ensemble that finds and grades Crohn\'s lesions, tested on datasets from two other countries.', a:{5:[.6,'CNNs and transfer learning'],1:[.2,'images as data']} },
  { t:'eCTD', d:'SEP 2026', h:'Audit platform design', p:'A design for drug-filing sections where every number traces to lab data, with a stress test of the scan-reading step.', a:{7:[.46,'tool calling that has to be audited'],8:[.3,'human approval gates']} },
  { t:'LOB contest', d:'OCT 2026 →', h:'Private forecasting contest', p:'A sequence-model entry in a limit-order-book forecasting challenge. Details stay private until 15 November.', a:{9:[.34,'ensembles over folds and seeds'],5:[.3,'sequence models']} },
  { t:'HEAD', d:'NOW', h:'Open to roles, 2026–27', p:'Looking for AI/ML engineering roles and internships. Everything before this position is what he brings.', a:{7:[.32,'shipped agent work'],8:[.3,'systems thinking'],10:[.26,'building for audits']} },
  { t:'graduate', d:'MAY 2027', h:'B.Tech ICT, PDEU', p:'The degree wraps up in May 2027.', a:{0:[.6,'where the sequence started'],12:[.3,'what comes next']} },
];
const seq = $('#seq'), track = $('#track'), rail = $('#rail'), sarcs = $('#seqArcs'), detail = $('#detail'), prog = $('#prog');
seq.style.setProperty('--n', EV.length);
const evEls = EV.map((e, i) => { const el = document.createElement('div'); el.className = 'ev'; el.innerHTML = `<b></b><i>${String(i).padStart(2, '0')} · ${e.d}</i>`; el.querySelector('b').textContent = e.t; track.append(el); return el; });
prog.innerHTML = EV.map(() => '<span></span>').join('');
let curEv = -1, evOffset = 0;
function seqFrame(){
  const r = seq.getBoundingClientRect(), H = innerHeight;
  const total = r.height - H;
  const p = Math.max(0, Math.min(.9999, -r.top / total));
  const f = p * EV.length, i = Math.floor(f);
  // slide the track so the current position sits about a third in
  const rr = rail.getBoundingClientRect();
  const anchor = rr.width * (innerWidth < 600 ? .08 : .32);
  const a = evEls[i], b = evEls[Math.min(EV.length - 1, i + 1)];
  const t = RM ? 0 : Math.max(0, (f - i - .55) / .45);
  const target = anchor - (a.offsetLeft + (b.offsetLeft - a.offsetLeft) * t * t * (3 - 2 * t));
  evOffset += (target - evOffset) * (RM ? 1 : .18);
  track.style.transform = `translateX(${evOffset}px)`;
  if (i !== curEv){ curEv = i; renderDetail(i); }
  drawSeqArcs(i);
}
function renderDetail(i){
  const e = EV[i];
  evEls.forEach((el, k) => { el.classList.toggle('cur', k === i); el.classList.toggle('src', k in e.a); });
  [...prog.children].forEach((s, k) => s.classList.toggle('on', k <= i));
  const att = Object.entries(e.a).sort((x, y) => y[1][0] - x[1][0]);
  detail.innerHTML = `<div><div class="lbl">position ${String(i).padStart(2, '0')} · ${e.d}</div><h3></h3><p></p></div>
    <div><div class="lbl" style="margin-bottom:10px">${att.length ? 'attends to' : 'first token · nothing before it'}</div><ul class="att">${att.map(([k, [w, why]]) => `<li><span class="nm"></span><span class="wv">${w.toFixed(2)}</span><span class="wb"><span style="width:${w * 100}%;background:${ramp(w)}"></span></span><span class="why"></span></li>`).join('')}</ul></div>`;
  detail.querySelector('h3').textContent = e.h; detail.querySelector('p').textContent = e.p;
  const lis = detail.querySelectorAll('.att li');
  att.forEach(([k, [w, why]], j) => { lis[j].querySelector('.nm').textContent = EV[k].t + ' · ' + EV[k].d.toLowerCase(); lis[j].querySelector('.why').textContent = why; });
}
function drawSeqArcs(i){
  const r = rail.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (sarcs.width !== Math.round(r.width * dpr) || sarcs.height !== Math.round(r.height * dpr)){ sarcs.width = r.width * dpr; sarcs.height = r.height * dpr; }
  const g = sarcs.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const top = el => { const b = el.querySelector('b').getBoundingClientRect(); return [b.left - r.left + Math.min(b.width / 2, 60), b.top - r.top - 6]; };
  const [qx, qy] = top(evEls[i]);
  Object.entries(EV[i].a).forEach(([k, [w]]) => {
    const [kx, ky] = top(evEls[k]);
    const lift = Math.min(qy - 8, 40 + Math.abs(qx - kx) * .35);
    g.beginPath(); g.moveTo(qx, qy); g.bezierCurveTo(qx, qy - lift, kx, ky - lift, kx, ky);
    g.lineWidth = 2 + w * 14; g.strokeStyle = ramp(w); g.globalAlpha = .4 + w * .6; g.lineCap = 'round'; g.stroke();
  });
  g.globalAlpha = 1;
}

/* ───────── 3 · five heads: real system designs ───────── */
const NODES = {};
const PROJ = [];
const ROW_Y = 0;
function sheet(id, ox, no, title, sub){
  const svg = S('svg', { viewBox:'0 140 1300 800', role:'img', 'aria-label':title + ' system design' });
  S('defs', {}, svg).innerHTML = `<marker id="ar-${id}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path class="arw" d="M0 0L12 6L0 12z"/></marker>`;
  const sc = { id, svg, ox:0, oy:0, edgesG:S('g', {}, svg), nodesG:S('g', {}, svg), topG:S('g', {}, svg), k:0 };
  PROJ.push(sc);
  return sc;
}
const rr = (x, y, w, h, r = 0) => r ? `M${x+r} ${y}H${x+w-r}A${r} ${r} 0 0 1 ${x+w} ${y+r}V${y+h-r}A${r} ${r} 0 0 1 ${x+w-r} ${y+h}H${x+r}A${r} ${r} 0 0 1 ${x} ${y+h-r}V${y+r}A${r} ${r} 0 0 1 ${x+r} ${y}Z` : `M${x} ${y}H${x+w}V${y+h}H${x}Z`;
function frame(sc, x, y, w, h, label){
  S('path', { d:rr(x, y, w, h, 18), class:'fr' }, sc.edgesG);
  if (label){ const t = S('text', { x:x + 16, y:y - 10, class:'t-frame' }, sc.edgesG); t.textContent = label; }
}
function node(sc, id, x, y, w, h, label, sub = [], o = {}){
  const g = S('g', { class:'n' + (o.planned ? ' planned' : '') + (o.heavy ? ' heavy' : ''), 'data-id':id, tabindex:'0', role:'button', 'aria-label':label }, sc.nodesG);
  let d;
  if (o.shape === 'pill') d = rr(x, y, w, h, h / 2);
  else if (o.shape === 'diamond') d = `M${x+w/2} ${y}L${x+w} ${y+h/2}L${x+w/2} ${y+h}L${x} ${y+h/2}Z`;
  else if (o.shape === 'cyl'){ const ry = 16; d = `M${x} ${y+ry}A${w/2} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${w/2} ${ry} 0 0 1 ${x} ${y+h-ry}ZM${x} ${y+ry}A${w/2} ${ry} 0 0 0 ${x+w} ${y+ry}`; }
  else d = rr(x, y, w, h, 14);
  S('path', { d, class:'n-bg' }, g);
  const centered = o.shape === 'pill' || o.shape === 'diamond';
  const tx = centered ? x + w / 2 : x + 18;
  const lab = S('text', { x:tx, y:centered ? y + h / 2 + 8 : y + (o.shape === 'cyl' ? 58 : 38), class:o.labCls || 't-lab' }, g);
  if (centered) lab.setAttribute('text-anchor', 'middle');
  lab.textContent = label;
  sub.forEach((s, i) => { const t = S('text', { x:tx, y:y + (o.shape === 'cyl' ? 84 : 66) + i * 24, class:'t-sub' }, g); if (centered) t.setAttribute('text-anchor', 'middle'); t.textContent = s; });
  NODES[id] = { label, file:o.file || '', info:o.info || '', g };
}
function edge(sc, pts, label, o = {}){
  const d = 'M' + pts.map(p => p.join(' ')).join('L');
  const p = S('path', { d, class:'e' + (o.cls ? ' ' + o.cls : '') + (o.dash ? ' planned' : '') }, sc.edgesG);
  if (!o.noArrow) p.setAttribute('marker-end', `url(#ar-${sc.id})`);
  if (label){
    let best = 0, bi = 1;
    for (let i = 1; i < pts.length; i++){ const l = Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); if (l > best){ best = l; bi = i; } }
    const lp = o.lp || [(pts[bi][0] + pts[bi-1][0]) / 2, (pts[bi][1] + pts[bi-1][1]) / 2 + 6];
    const t = S('text', { x:lp[0], y:lp[1], class:'t-elab', 'text-anchor':o.anchor || 'middle' }, sc.topG); t.textContent = label;
  }
  // a token travelling along the edge: the system at work
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
  if (!RM && !o.noArrow && L > 60){
    const word = (o.pk || (label && label.length <= 12 ? label : '')).trim();
    const w = word ? word.length * 7.4 + 14 : 14;
    const pk = S('g', { class:'pk p' + (1 + sc.k++ % 3) }, sc.topG);
    S('rect', { x:-w / 2, y:-10, width:w, height:20, rx:10 }, pk);
    if (word){ const t = S('text', { x:0, y:4, 'text-anchor':'middle' }, pk); t.textContent = word; }
    const dur = Math.max(1.6, L / 160);
    S('animateMotion', { path:d, dur:dur + 's', begin:(Math.random() * 2).toFixed(2) + 's', repeatCount:'indefinite', keyPoints:'0;1', keyTimes:'0;1', calcMode:'linear' }, pk);
  }
}
function stamp(sc, x, y, lines){
  const w = Math.max(...lines.map(l => l.length)) * 9.6 + 30, h = lines.length * 22 + 18;
  const g = S('g', { class:'badge' }, sc.topG);
  S('rect', { x, y, width:w, height:h, rx:12 }, g);
  lines.forEach((l, i) => { const t = S('text', { x:x + 15, y:y + 27 + i * 22 }, g); t.textContent = l; });
}
function text(sc, x, y, str, cls){ const t = S('text', { x, y, class:cls }, sc.edgesG); t.textContent = str; return t; }

/* sheet 01 · MDT AI Copilot */
{
  const sc = sheet('mdt', 0, 'SHEET 01 / 05', 'MDT AI Copilot', 'agentic RAG over 5G measurement data · HNNOIX internship · github.com/HilKalathiya/MDT-AI-Copilot');
  frame(sc, 40, 170, 360, 690, 'pipeline/ + ml/');
  frame(sc, 440, 170, 830, 690, 'copilot/ · LangGraph ReAct loop');
  node(sc, 'mdt-logs', 70, 200, 300, 86, 'OAI 5G logs', ['OpenAirInterface MDT'], { file:'external · OpenAirInterface', info:'Raw minimisation-of-drive-test reports from the 5G stack. The project starts where these logs stop being exportable.' });
  node(sc, 'mdt-parse', 70, 326, 300, 86, 'parser + generator', ['regex · 7,200 samples'], { file:'pipeline/log_parser.py · pipeline/generator.py', info:'A regex log parser plus a synthetic generator: 7,200 samples across 10 UEs, so every model can be tested from a cold clone.' });
  node(sc, 'mdt-sql', 70, 446, 300, 104, 'SQLite', ['mdt_reports · ue_samples'], { file:'pipeline/db.py', info:'Two tables: what the tower decoded (mdt_reports) and the richer UE-side samples (ue_samples).', shape:'cyl' });
  node(sc, 'mdt-z', 70, 590, 300, 110, 'z-score detector', ['per-UE rolling window', 'recall ≥ 80%'], { file:'ml/anomaly.py', info:'Replaces fixed 3 dB / −100 dBm thresholds with a rolling z-score per UE. Recall above 80% on injected coverage holes, benchmarked against IsolationForest.' });
  node(sc, 'mdt-f', 70, 730, 300, 100, 'RSRP forecaster', ['lags + GradientBoosting'], { file:'ml/forecast.py', info:'Lag features and a GradientBoostingRegressor, chosen over an LSTM for small data. Beats the naive last-value MAE baseline on held-out data.' });
  edge(sc, [[220,286],[220,326]]); edge(sc, [[220,412],[220,446]]); edge(sc, [[220,550],[220,590]]);
  node(sc, 'mdt-start', 480, 200, 140, 56, 'START', [], { shape:'pill', labCls:'t-mono', info:'Every question enters the graph here.' });
  node(sc, 'mdt-agent', 480, 300, 300, 110, 'agent', ['create_react_agent', 'Cohere command-r+'], { file:'copilot/agent.py', heavy:true, info:'The LLM node. It reasons, picks a tool, reads the result and repeats until it can answer.' });
  node(sc, 'mdt-cond', 560, 450, 140, 110, 'tool?', [], { shape:'diamond', labCls:'t-mono', info:'Conditional edge: if the model asked for a tool, go to ToolNode. Otherwise finish.' });
  node(sc, 'mdt-end', 560, 610, 140, 56, 'END', [], { shape:'pill', labCls:'t-mono', info:'The answer streams back to the dashboard.' });
  node(sc, 'mdt-tools', 850, 280, 390, 390, 'ToolNode', ['copilot/tools.py'], { file:'copilot/tools.py', heavy:true, info:'Five LangChain tools. Each one truncates its output to 4,000 characters so a big query cannot flood the context.' });
  const tools = [['query_reports','Query MDT samples with filters for cell, UE and time window.'],['run_anomaly_scan','Runs the z-score detector over recent samples.'],['get_cell_summary','Average RSRP, sample count and anomaly count for a cell.'],['suggest_threshold','Suggests adaptive thresholds from each cell\'s noise profile.'],['retrieve_docs','Semantic search over 4 knowledge docs in Chroma.']];
  tools.forEach(([t, inf], i) => node(sc, 'mdt-t' + i, 870, 380 + i * 56, 350, 44, t, [], { labCls:'t-mono', file:'copilot/tools.py · ' + t + '()', info:inf, phase:2, agent:'draw' }));
  sc.nodesG.querySelectorAll('[data-id^="mdt-t"] text').forEach(t => t.setAttribute('y', +t.getAttribute('y') - 8));
  node(sc, 'mdt-chroma', 870, 712, 240, 120, 'Chroma', ['embed-v4.0'], { shape:'cyl', file:'copilot/build_index.py', info:'Local Chroma store built from 4 curated docs and the C source, chunked at 500 tokens with 50 overlap, embedded with Cohere embed-v4.0.' });
  node(sc, 'mdt-ui', 480, 760, 330, 86, 'FastAPI → Next.js', ['POST /api/chat streams'], { file:'dashboard/api.py', info:'A FastAPI backend and a Next.js + TypeScript dashboard with the copilot embedded. A Streamlit version exists too.' });
  edge(sc, [[550,256],[550,300]]);
  edge(sc, [[630,410],[630,450]]);
  edge(sc, [[700,505],[850,505]], 'yes', { lp:[775,494] });
  edge(sc, [[630,560],[630,610]], 'no', { lp:[652,592], anchor:'start' });
  edge(sc, [[1045,280],[1045,232],[740,232],[740,300]], 'observation · ≤ 4,000 chars', { lp:[892,226] });
  edge(sc, [[630,666],[630,760]]);
  edge(sc, [[990,670],[990,712]], '', { cls:'', dash:'6 6' });
  edge(sc, [[370,495],[415,495],[415,885],[1180,885],[1180,670]], 'rows · scans · forecasts', { lp:[800,880] });
  edge(sc, [[370,645],[415,645]], '', { noArrow:true }); edge(sc, [[370,780],[415,780]], '', { noArrow:true });
  stamp(sc, 1060, 168, ['MAX 8 TOOL CALLS', 'PER QUESTION'], { rot:3 });
  stamp(sc, 120, 880, ['RECALL ≥ 80%'], { rot:-2, phase:3 });
}

/* sheet 02 · OpenEnv */
{
  const sc = sheet('openenv', 1450, 'SHEET 02 / 05', 'OpenEnv data-cleaning agent', 'team project · an RL environment where an agent cleans messy tables · on Hugging Face Spaces');
  node(sc, 'oe-agent', 50, 300, 330, 136, 'agent', ['rule-based · random', 'PPO · Llama 3.1 8B'], { heavy:true, file:'agents/', info:'Five agents share one interface: do-nothing, random, rule-based, a PPO policy with pure-NumPy inference, and a zero-shot Llama 3.1 8B.' });
  node(sc, 'oe-ep', 50, 520, 330, 136, 'episode', ['reset(task_id, seed)', 'step(action) × N', 'finish'], { file:'server/env.py', info:'An episode resets on a task and seed, steps one action at a time, and ends on finish or when the step budget runs out.' });
  frame(sc, 450, 180, 810, 560, 'env server · FastAPI + Pydantic · Docker');
  node(sc, 'oe-val', 490, 220, 330, 90, 'validation', ['actions.py · Pydantic'], { file:'server/actions.py', info:'Invalid actions (unknown column, mean on text) are not applied. They cost reward instead of crashing the run.' });
  node(sc, 'oe-ops', 490, 380, 330, 90, 'pandas operations', ['operations.py'], { file:'server/operations.py', info:'fill-missing, drop rows, dedupe, strip whitespace, fix dates, standardise categories and more.' });
  node(sc, 'oe-q', 490, 540, 330, 90, 'quality score Q', ['0 … 1 per table'], { file:'server/quality.py', info:'One number for how clean the table is. Reward is built from its change, so it cannot be gamed by looping.' });
  node(sc, 'oe-obs', 900, 220, 330, 110, 'observation', ['counts + first 5 rows', 'steps_remaining …'], { file:'server/models.py', info:'A compact schema (missing and duplicate counts plus a 5-row sample) keeps the LLM context small.' });
  node(sc, 'oe-r', 900, 520, 330, 134, 'reward', ['10 · ΔQ', '− 0.02 per step', '− 0.10 if invalid'], { file:'server/reward.py', info:'Potential-based shaping: progress terms sum to 10·(Q_end − Q_start), so going in circles earns nothing. There is a test for it.' });
  node(sc, 'oe-grade', 900, 810, 330, 100, 'grader', ['separate from reward'], { file:'server/grader.py', info:'The final score is computed apart from the training reward, so the benchmark cannot reward shaping tricks.' });
  edge(sc, [[380,340],[425,340],[425,265],[490,265]], 'action JSON', { lp:[425,250] });
  edge(sc, [[655,310],[655,380]]); edge(sc, [[655,470],[655,540]]); edge(sc, [[820,585],[900,585]]);
  edge(sc, [[820,290],[860,290],[860,560],[900,560]], 'invalid · not applied', { dash:'7 6', lp:[862,430], anchor:'middle' });
  edge(sc, [[1065,520],[1065,330]]);
  edge(sc, [[1065,220],[1065,150],[215,150],[215,300]], 'observation + reward', { lp:[640,145] });
  edge(sc, [[655,630],[655,860],[900,860]], 'after finish', { dash:'7 6', lp:[760,855] });
  edge(sc, [[215,436],[215,520]], '', { noArrow:true, dash:'4 6' });
  stamp(sc, 60, 730, ['PPO 0.960 · MEDIUM', 'LLAMA 0.838 · HARD'], { rot:-3 });
}

/* sheet 03 · HospitalOps */
{
  const sc = sheet('hospital', 2900, 'SHEET 03 / 05', 'HospitalOps AI', 'bed-demand forecasting and resource planning · in progress');
  node(sc, 'ho-src', 40, 200, 250, 110, 'hospital data', ['Hero DMC · NHSN', 'MIMIC-IV'], { file:'ingest/', info:'Real-world hospital datasets, merged without duplicates.' });
  node(sc, 'ho-etl', 340, 200, 260, 110, 'idempotent ETL', ['SHA-256 file hash', 'row-level upserts'], { file:'ingest/etl.py', info:'Hashes each file and upserts rows, so re-running the merge never duplicates data.' });
  node(sc, 'ho-db', 650, 200, 220, 110, 'MongoDB', ['RBAC · 159 tests'], { shape:'cyl', file:'backend/db/', info:'Persistence with role-based access. All 159 backend tests pass.' });
  node(sc, 'ho-fc', 920, 200, 340, 110, 'forecasting', ['naive · seasonal · SARIMAX', 'Prophet · LSTM'], { file:'ml/models/', info:'From naive baselines to SARIMAX, Prophet and an LSTM, all compared on the same windows.' });
  node(sc, 'ho-eval', 920, 380, 340, 90, 'walk-forward eval', ['chronological splits'], { file:'ml/evaluate.py', info:'True walk-forward cross-validation with chronological splits and train-only scaling, so nothing leaks from the future.' });
  node(sc, 'ho-ml', 650, 380, 220, 90, 'MLflow', ['runs · registry'], { file:'ml/tracking.py', info:'Every run is tracked and the selected model is registered.' });
  node(sc, 'ho-sim', 340, 380, 260, 90, 'what-if simulation', ['auditable scenarios'], { file:'sim/', info:'Scenario planning that never mutates live operational state.' });
  node(sc, 'ho-milp', 40, 380, 250, 110, 'MILP optimizer', ['HiGHS · surge beds', '+ equipment'], { file:'optimize/milp.py', info:'Exact mixed-integer planning over a multi-period horizon. Every constraint is re-validated and compared with a baseline.' });
  node(sc, 'ho-rev', 40, 560, 250, 90, 'plan review', ['a person approves'], { file:'frontend/plan-review', info:'Consequential recommendations are reviewed by a person before anyone acts on them.' });
  edge(sc, [[290,255],[340,255]]); edge(sc, [[600,255],[650,255]]); edge(sc, [[870,255],[920,255]]);
  edge(sc, [[1090,310],[1090,380]]); edge(sc, [[920,425],[870,425]], 'best', { lp:[895,414] });
  edge(sc, [[650,425],[600,425]]); edge(sc, [[340,425],[290,425]]); edge(sc, [[165,490],[165,560]]);
  frame(sc, 340, 560, 920, 330, 'planned · step 4.1 · the agentic layer');
  node(sc, 'ho-orch', 380, 600, 320, 96, 'LangGraph orchestrator', ['routes the agents'], { planned:true, info:'Planned: a LangGraph orchestrator over forecasting, simulation and optimisation agents.' });
  node(sc, 'ho-ag', 750, 600, 230, 96, '3 agents', ['forecast · simulate', 'optimise'], { planned:true, info:'Planned: one agent per engine, each calling the code that is already built and tested.' });
  node(sc, 'ho-rag', 1020, 600, 210, 96, 'RAG', ['hospital policies'], { planned:true, info:'Planned: retrieval over hospital policy documents so recommendations cite the rule they follow.' });
  node(sc, 'ho-gate', 380, 760, 320, 90, 'approval gate', ['human-in-the-loop'], { planned:true, info:'Planned: nothing the agents propose is applied until a person approves it.' });
  edge(sc, [[700,648],[750,648]], '', { cls:'planned', dash:'8 7' }); edge(sc, [[980,648],[1020,648]], '', { cls:'planned', dash:'8 7' });
  edge(sc, [[540,696],[540,760]], '', { cls:'planned', dash:'8 7' });
  edge(sc, [[380,805],[320,805],[320,605],[290,605]], '', { cls:'gate', dash:'8 7' });
  stamp(sc, 50, 700, ['1-DAY MAE 3.57', 'NAIVE 6.22'], { rot:-4 });
}

/* sheet 04 · CrohnSight */
{
  const sc = sheet('crohn', 4350, 'SHEET 04 / 05', 'CrohnSight', 'Crohn\'s lesions in capsule endoscopy · PDEU minor project, team of two · research prototype');
  node(sc, 'cr-in', 40, 230, 250, 110, 'capsule frame', ['320 px · image', 'or video'], { file:'data/', info:'Small-bowel capsule-endoscopy frames at their native 320 px.' });
  node(sc, 'cr-ens', 350, 190, 390, 190, 'ensemble', ['10 × EfficientNet-B2', '5 folds × 2 seeds', '40 epochs · RTX 3050'], { heavy:true, file:'train/', info:'Ten EfficientNet-B2 models (5 folds × 2 seeds) trained on a laptop GPU, then averaged.' });
  node(sc, 'cr-onnx', 800, 230, 200, 110, 'ONNX', ['offline · CPU'], { file:'export/', info:'Exported to ONNX so it runs offline on an ordinary CPU.' });
  const outs = [['lesion?', 'Lesion vs normal: AUROC 0.992 out-of-fold.'], ['7 classes', '7-class accuracy 91.1% (balanced 84.0%).'], ['severity 1–4', 'Quadratic weighted kappa 0.94, 97.7% within one tier.'], ['heat-map', 'Shows where the lesion is. Hits the expert\'s box 69% of the time on Kvasir (chance 4%).']];
  outs.forEach(([o, inf], i) => node(sc, 'cr-o' + i, 1060, 170 + i * 80, 200, 60, o, [], { labCls:'t-mono', info:inf, phase:2, agent:'draw' }));
  sc.nodesG.querySelectorAll('[data-id^="cr-o"] text').forEach(t => t.setAttribute('y', +t.getAttribute('y') - 2));
  edge(sc, [[290,285],[350,285]]); edge(sc, [[740,285],[800,285]]);
  outs.forEach((_, i) => edge(sc, [[1000,285],[1030,285],[1030,200 + i * 80],[1060,200 + i * 80]], ''));
  frame(sc, 40, 560, 720, 300, 'external tests · no retraining');
  node(sc, 'cr-kv', 80, 610, 310, 110, 'Kvasir-Capsule', ['Norway · 47,238 frames', 'AUROC 0.944'], { file:'eval/kvasir', info:'An unseen dataset from another country and capsule brand. Inflammatory vs normal AUROC 0.944.' });
  node(sc, 'cr-see', 420, 610, 310, 110, 'SEE-AI', ['Japan', 'stenosis 0.916'], { file:'eval/see_ai', info:'Erosion 0.897, stenosis 0.916, erythema 0.897, with cut-offs fixed before the test.' });
  edge(sc, [[900,340],[900,500],[400,500],[400,560]], 'same model, new hospitals', { dash:'7 6', lp:[650,494] });
  node(sc, 'cr-add', 800, 560, 460, 110, 'add-ons', ['UC Mayo grader (colonoscopy)', 'flare-risk forecaster'], { info:'Two extras cover the rest of IBD: a Mayo grader for ulcerative colitis and a flare-risk model from visit data.' });
  stamp(sc, 820, 720, ['AUROC 0.992', 'KAPPA 0.94'], { rot:-3 });
  text(sc, sc.ox + 82, ROW_Y + 800, 'limits reported openly: whole-video study AUROC 0.57', 't-sub', 3, 'check');
}

/* sheet 05 · eCTD */
{
  const sc = sheet('ectd', 5800, 'SHEET 05 / 05', 'eCTD audit platform', 'every number in a drug filing traced to lab data · design + stress test');
  node(sc, 'ec-sys', 40, 200, 240, 110, 'lab systems', ['LIMS · Empower · SAP', 'CMO scans'], { info:'Where the raw numbers live today.' });
  node(sc, 'ec-mcp', 330, 200, 230, 110, 'MCP connectors', ['one per system'], { info:'One MCP server per enterprise system. MCP standardises the plug, not the glue code.' });
  node(sc, 'ec-ocr', 610, 200, 300, 110, 'OCR + VLM', ['blind cross-check', 'position from table grid'], { info:'Layout-aware OCR and a vision model read each scan blind, and disagreements go to a person.' });
  node(sc, 'ec-facts', 960, 200, 300, 110, 'fact store', ['Postgres + pgvector', 'value · unit · source'], { shape:'cyl', info:'Each fact keeps its value, unit, batch, test, timepoint and an exact pointer back to its source cell.' });
  node(sc, 'ec-stats', 960, 400, 300, 110, 'statistics library', ['ICH Q1E · Decimal', 'called by fact ID'], { info:'Validated shelf-life regression, OOT tests and regulatory rounding. The model calls functions, it never does the math.' });
  node(sc, 'ec-writer', 610, 400, 300, 110, 'writer model', ['fact-ID placeholders', 'never types a digit'], { heavy:true, info:'Drafts prose with placeholders like {fact:123}. Numbers are filled from the store, so the model cannot mistype one.' });
  node(sc, 'ec-val', 330, 400, 230, 110, 'validator', ['checks every claim'], { info:'Every number and claim is checked against the fact store before a person sees the draft.' });
  node(sc, 'ec-human', 40, 400, 240, 110, 'a person signs', ['21 CFR Part 11'], { info:'Nothing is filed without a human signature.' });
  node(sc, 'ec-veeva', 40, 590, 240, 90, 'Veeva Vault RIM', ['publishing + filing'], { info:'Signed sections are handed to Veeva for publishing. The system drafts, it does not file.' });
  node(sc, 'ec-ledger', 330, 590, 580, 90, 'audit ledger', ['append-only · SHA-256 chain · WORM'], { shape:'cyl', info:'Hash-chained, write-once entries signed with KMS keys, for 21 CFR Part 11.' });
  edge(sc, [[280,255],[330,255]]); edge(sc, [[560,255],[610,255]]); edge(sc, [[910,255],[960,255]]);
  edge(sc, [[1110,310],[1110,400]]); edge(sc, [[960,455],[910,455]]); edge(sc, [[610,455],[560,455]]); edge(sc, [[330,455],[280,455]]);
  edge(sc, [[160,510],[160,590]]); edge(sc, [[280,610],[330,610]], 'signature', { cls:'gate', lp:[305,598] });
  text(sc, sc.ox + 42, ROW_Y + 760, 'orchestration: LangGraph 1.0 as a mostly fixed, auditable state machine', 't-sub', 2, 'plan');
  stamp(sc, 840, 720, ['0 WRONG VALUES', 'OF 9,600 · 194 TO A PERSON'], { rot:-3 });
}



const PINFO = {
  mdt:{ name:'MDT AI Copilot', tag:'HNNOIX internship · 2026', p:'A LangGraph ReAct agent that routes between four live data tools and a Chroma retriever over the project\'s own docs and C source. Guardrails cap it at 8 tool calls and 4,000 characters per tool result.',
    m:[['≥ 80%','recall on injected coverage holes'],['8','tool calls max per question']], l:[['https://github.com/HilKalathiya/MDT-AI-Copilot','Code on GitHub ↗']] },
  openenv:{ name:'OpenEnv', tag:'team project · 2026', p:'An RL environment where an agent cleans messy tables one action at a time. Reward is potential-based, so going in circles earns nothing, and the grader is kept apart from the reward.',
    m:[['0.960','PPO on medium-clean'],['0.838','Llama 3.1 8B zero-shot on hard-clean']], l:[['https://github.com/HilKalathiya/open-env-nuclei','Code ↗'],['https://chetangadhiya017-data-cleaning-env.hf.space','Live demo ↗']] },
  hospital:{ name:'HospitalOps AI', tag:'in progress · 2026', p:'Forecasts hospital bed demand with leakage-safe walk-forward validation, then plans surge beds and equipment with an exact MILP solver. The agent layer comes next, behind a human approval gate.',
    m:[['3.57','1-day admissions MAE, vs 6.22 naive'],['159','backend tests passing']], l:[['https://github.com/HilKalathiya/HospitalOps-AI','Code on GitHub ↗']] },
  crohn:{ name:'CrohnSight', tag:'PDEU minor project · team of two', p:'Finds Crohn\'s lesions in capsule-endoscopy frames, grades severity and shows where with a heat-map. It runs offline on a CPU. A research prototype, not a medical device.',
    m:[['0.992','AUROC, lesion vs normal'],['0.944','on an unseen Norwegian dataset']], l:[['https://github.com/HilKalathiya/Crohn-Disease-Early-Prediction','Code on GitHub ↗']] },
  ectd:{ name:'eCTD audit platform', tag:'design + stress test · 2026', p:'Assembles the manufacturing section of a drug filing so every number traces to raw lab data, is computed by validated code and is signed by a person. The writer model never types a digit.',
    m:[['0 / 9,600','wrong values stored in the scan stress test'],['194','values routed to a person']], l:[] },
};
const projBox = $('#projects'), headCards = $('#headCards');
const HM = {}; // a tiny attention map per head, seeded per project
PROJ.forEach((sc, idx) => {
  const P = PINFO[sc.id];
  const sec = document.createElement('article'); sec.className = 'proj'; sec.id = 'p-' + sc.id;
  sec.innerHTML = `<div class="phead"><div><div class="lbl">head ${idx + 1} / 5 · ${P.tag}</div><h3></h3></div><canvas class="hm" width="128" height="128" aria-hidden="true"></canvas></div>
    <div class="pbody"><div><p></p><ul class="metrics">${P.m.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('')}</ul><div class="links">${P.l.map(([u, t]) => `<a class="ib" style="text-decoration:none" href="${u}" target="_blank" rel="noopener">${t}</a>`).join('')}</div></div>
    <div class="diagram"><div class="dlbl"><span class="lbl">system design · click a box</span><span class="lbl">tokens = live traffic</span></div></div></div>`;
  sec.querySelector('h3').textContent = P.name; sec.querySelector('.pbody p').textContent = P.p;
  sec.querySelector('.diagram').append(sc.svg);
  projBox.append(sec);
  const card = document.createElement('a'); card.className = 'hcard'; card.href = '#p-' + sc.id;
  card.innerHTML = `<canvas width="160" height="160" aria-hidden="true"></canvas><span class="lbl">head ${idx + 1}</span><strong></strong>`;
  card.querySelector('strong').textContent = P.name;
  headCards.append(card);
  HM[sc.id] = [card.querySelector('canvas'), sec.querySelector('.hm'), idx];
});
function drawHeatmaps(){
  for (const id in HM){
    const [a, b, seed] = HM[id];
    for (const cv of [a, b]){
      const g = cv.getContext('2d'), n = 8, s = cv.width / n;
      g.fillStyle = C.surface; g.fillRect(0, 0, cv.width, cv.height);
      for (let q = 0; q < n; q++){
        // causal mask: each row only looks left; each head has its own pattern
        let row = []; for (let k = 0; k <= q; k++){
          let v = seed === 0 ? (k === q - 1 ? 3 : 1) : seed === 1 ? (k === 0 ? 3 : 1) : seed === 2 ? (k === q ? 3 : 1) : seed === 3 ? ((q - k) % 2 ? .6 : 2) : (k >= q - 2 ? 2.4 : .7);
          v *= 1 + .35 * Math.sin(q * 3.1 + k * 1.7 + seed); row.push(v);
        }
        const sum = row.reduce((x, y) => x + y, 0);
        row.forEach((v, k) => { const w = v / sum; g.globalAlpha = .15 + Math.min(1, w * 1.6) * .85; g.fillStyle = ramp(Math.min(1, w * 1.4)); g.fillRect(k * s + 1, q * s + 1, s - 2, s - 2); });
      }
      g.globalAlpha = 1;
    }
  }
}

/* inspector */
const insp = $('#insp'); let selNode = null;
function openInsp(id, sx, sy){
  const n = NODES[id]; if (!n) return;
  selNode?.classList.remove('sel'); selNode = n.g; selNode.classList.add('sel');
  insp.querySelector('h4').textContent = n.label;
  const f = insp.querySelector('.f'); f.textContent = n.file; f.hidden = !n.file;
  insp.querySelector('p').textContent = n.info || 'Part of the system.';
  insp.hidden = false;
  if (innerWidth > 560){
    const w = insp.offsetWidth, h = insp.offsetHeight;
    insp.style.left = Math.max(16, Math.min(innerWidth - w - 16, sx + 16)) + 'px';
    insp.style.top = Math.max(70, Math.min(innerHeight - h - 16, sy - h / 2)) + 'px';
  }
}
function closeInsp(){ insp.hidden = true; selNode?.classList.remove('sel'); selNode = null; }
document.addEventListener('click', e => {
  const n = e.target.closest('.n');
  if (n) return openInsp(n.dataset.id, e.clientX, e.clientY);
  if (!e.target.closest('#insp')) closeInsp();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeInsp();
  const n = e.target.closest && e.target.closest('.n');
  if (n && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); const r = n.getBoundingClientRect(); openInsp(n.dataset.id, r.right, r.top + r.height / 2); }
});
insp.querySelector('.x').addEventListener('click', closeInsp);
addEventListener('scroll', () => { if (!insp.hidden && innerWidth > 560) closeInsp(); }, { passive:true });

/* résumé download: plain <a download>, the browser handles it */
$('#copyMail').addEventListener('click', async e => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText('hilkalathiya59@gmail.com'); b.textContent = 'Copied'; }
  catch (err){ const r = document.createRange(); r.selectNodeContents($('#mail')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected'; }
  setTimeout(() => b.textContent = 'Copy email', 1600);
});

/* theme */
function redraw(){ readColors(); drawArcs(); drawHeatmaps(); curEv = -1; }
try { const t = localStorage.getItem('hil-attn-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
$('#themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('hil-attn-theme', next); } catch (e) {}
  redraw();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);

/* nav highlight */
const navA = [...document.querySelectorAll('.nav a')];
function navFrame(){
  let on = 0; navA.forEach((a, i) => { const s = document.querySelector(a.getAttribute('href')); if (s.getBoundingClientRect().top < innerHeight * .4) on = i; });
  navA.forEach((a, i) => a.classList.toggle('on', i === on));
}

function loop(){ seqFrame(); navFrame(); requestAnimationFrame(loop); }
addEventListener('resize', () => { drawArcs(); });
redraw();
document.fonts?.ready.then(() => drawArcs());
requestAnimationFrame(loop);
decode();
})();

initContactForm();
