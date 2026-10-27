// Hil's private inbox. Talks to Supabase over plain fetch: Auth for sign-in, REST for messages.
// Everything a visitor wrote is rendered with textContent, never as HTML.

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const cfg = window.HIL_INBOX_CONFIG || {};
const BASE = (cfg.supabaseUrl || env.VITE_SUPABASE_URL || (env.VITE_CONTACT_ENDPOINT || '').replace(/\/rest\/v1\/.*$/, '')).replace(/\/+$/, '');
const KEY = cfg.anonKey || env.VITE_CONTACT_KEY || env.VITE_SUPABASE_ANON_KEY || '';
const STORE = 'hil-inbox-session';
const COLS = 'id,created_at,name,email,message,page,user_agent,is_read,archived';

const $ = s => document.querySelector(s);
let session = null;
let messages = [];
let tab = 'inbox';
let openIds = new Set();

/* ── session ── */
function saveSession(s){
  session = s;
  try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); } catch (e) {}
}
function loadSession(){
  try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.access_token) session = s; } catch (e) {}
}
function asSession(r){
  return { access_token: r.access_token, refresh_token: r.refresh_token, email: r.user && r.user.email,
           expires_at: Date.now() + (r.expires_in || 3600) * 1000 };
}

async function auth(path, body){
  const res = await fetch(`${BASE}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || `Sign-in failed (${res.status})`);
  return data;
}

async function freshToken(){
  if (!session) throw new Error('signed out');
  if (Date.now() > session.expires_at - 60_000){
    try { saveSession(asSession(await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token }))); }
    catch (e){ signOut(true); throw e; }
  }
  return session.access_token;
}

async function api(path, opts = {}){
  const token = await freshToken();
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (res.status === 401){ signOut(true); throw new Error('Your session ended. Please sign in again.'); }
  if (!res.ok){ const d = await res.json().catch(() => ({})); throw new Error(d.message || `Request failed (${res.status})`); }
  return res.status === 204 ? null : res.json();
}

/* ── views ── */
function show(view){
  for (const id of ['signin', 'setup', 'box']) $('#' + id).hidden = id !== view;
  $('#outBtn').hidden = view !== 'box';
}

function toast(text){
  const t = $('#toast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200);
}

function ago(iso){
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function gmailReply(m){
  const quoted = m.message.split('\n').map(l => '> ' + l).join('\n');
  const q = new URLSearchParams({ view: 'cm', fs: '1', to: m.email, su: 'Re: your message on my portfolio',
    body: `Hi ${m.name.split(' ')[0]},\n\n\n\nOn ${new Date(m.created_at).toLocaleString()}, you wrote:\n${quoted}` });
  return `https://mail.google.com/mail/?${q}`;
}

function el(tag, cls, text){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(label, cls, onClick){
  const b = el('button', 'ib ' + (cls || ''), label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function render(){
  const unread = messages.filter(m => !m.archived && !m.is_read).length;
  $('#unread').textContent = unread ? ` ${unread}` : '';
  document.title = `${unread ? `(${unread}) ` : ''}Inbox · hil.agent`;
  $('#sub').textContent = session && session.email ? `Signed in as ${session.email}. Only you can see these messages.` : 'Messages people sent from the contact form. Only you can see them.';

  const q = $('#q').value.trim().toLowerCase();
  const rows = messages.filter(m => (tab === 'archived') === m.archived)
    .filter(m => !q || `${m.name} ${m.email} ${m.message}`.toLowerCase().includes(q));

  const list = $('#list');
  list.replaceChildren();
  if (!rows.length){
    const e = el('div', 'empty');
    e.append(el('b', 'grad', '<eos>'), el('span', '', q ? 'Nothing matches that search.' : tab === 'archived' ? 'Nothing archived yet.' : 'No messages yet. They will show up here.'));
    list.append(e);
    return;
  }

  for (const m of rows){
    const card = el('article', 'msg' + (m.is_read ? '' : ' unread') + (openIds.has(m.id) ? ' open' : ''));
    const head = el('div', 'mh');
    const from = el('a', 'from', m.email);
    from.href = gmailReply(m); from.target = '_blank'; from.rel = 'noopener';
    const when = el('time', 'when', ago(m.created_at));
    when.dateTime = m.created_at; when.title = new Date(m.created_at).toLocaleString();
    head.append(el('h2', 'who', m.name), from, when);

    const body = el('p', 'body', m.message);
    card.append(head, body);
    if (m.message.length > 280 || m.message.split('\n').length > 4){
      const more = btn(openIds.has(m.id) ? 'Show less' : 'Show all', '', () => {
        openIds.has(m.id) ? openIds.delete(m.id) : openIds.add(m.id);
        if (!m.is_read) setFlag(m, { is_read: true }, true); else render();
      });
      more.className = 'more';
      card.append(more);
    }

    const acts = el('div', 'acts');
    const reply = el('a', 'ib solid', 'Reply in Gmail ↗');
    reply.href = gmailReply(m); reply.target = '_blank'; reply.rel = 'noopener';
    reply.addEventListener('click', () => { if (!m.is_read) setFlag(m, { is_read: true }, true); });
    acts.append(
      reply,
      btn(m.is_read ? 'Mark unread' : 'Mark read', 'quiet', () => setFlag(m, { is_read: !m.is_read })),
      btn(m.archived ? 'Move to inbox' : 'Archive', 'quiet', () => setFlag(m, { archived: !m.archived, is_read: true })),
      btn('Copy email', 'quiet', async () => {
        try { await navigator.clipboard.writeText(m.email); toast('Email copied'); } catch (e) { toast(m.email); }
      }),
      btn('Delete', 'quiet danger', () => remove(m)),
    );
    card.append(acts);
    if (m.page || m.user_agent) card.append(el('div', 'meta', [m.page && `sent from ${m.page}`, m.user_agent].filter(Boolean).join(' · ')));
    list.append(card);
  }
}

/* ── data ── */
async function load(quiet){
  try {
    messages = await api(`contact_messages?select=${COLS}&order=created_at.desc&limit=1000`);
    render();
    if (!quiet) toast(`${messages.length} message${messages.length === 1 ? '' : 's'}`);
  } catch (e){
    if (session) toast(e.message);
  }
}

async function setFlag(m, patch, silent){
  const before = { ...m };
  Object.assign(m, patch);
  render();
  try {
    await api(`contact_messages?id=eq.${encodeURIComponent(m.id)}`, { method: 'PATCH', body: JSON.stringify(patch), headers: { Prefer: 'return=minimal' } });
    if (!silent && 'archived' in patch) toast(patch.archived ? 'Archived' : 'Moved to inbox');
  } catch (e){
    Object.assign(m, before); render(); toast(e.message);
  }
}

async function remove(m){
  if (!confirm(`Delete the message from ${m.name}? This cannot be undone.`)) return;
  try {
    await api(`contact_messages?id=eq.${encodeURIComponent(m.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    messages = messages.filter(x => x.id !== m.id);
    render(); toast('Deleted');
  } catch (e){ toast(e.message); }
}

function signOut(expired){
  const token = session && session.access_token;
  saveSession(null);
  messages = [];
  if (token && !expired) fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${token}` } }).catch(() => {});
  show('signin');
  $('#inNote').className = 'note' + (expired ? ' err' : '');
  $('#inNote').textContent = expired ? 'Your session ended. Please sign in again.' : 'Signed out.';
}

/* ── wiring ── */
$('#signinForm').addEventListener('submit', async e => {
  e.preventDefault();
  const note = $('#inNote');
  $('#inBtn').disabled = true; note.className = 'note'; note.textContent = 'Signing in…';
  try {
    saveSession(asSession(await auth('token?grant_type=password', { email: $('#em').value.trim(), password: $('#pw').value })));
    $('#pw').value = ''; note.textContent = '';
    show('box'); await load(true);
  } catch (err){
    note.className = 'note err';
    note.textContent = /invalid/i.test(err.message) ? 'That email and password do not match.' : err.message;
  } finally { $('#inBtn').disabled = false; }
});
$('#outBtn').addEventListener('click', () => signOut(false));
$('#refreshBtn').addEventListener('click', () => load(false));
$('#q').addEventListener('input', render);
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
}));
$('#themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('hk-theme', root.dataset.theme); } catch (e) {}
});
// New messages show up without a reload.
setInterval(() => { if (session && !document.hidden) load(true); }, 60_000);
document.addEventListener('visibilitychange', () => { if (session && !document.hidden) load(true); });

if (!BASE || !KEY) show('setup');
else {
  loadSession();
  if (session){ show('box'); load(true); }
  else show('signin');
}
