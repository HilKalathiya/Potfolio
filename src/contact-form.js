/* Contact form. Posts JSON to VITE_CONTACT_ENDPOINT (a Supabase RPC, see README).
   With no endpoint configured it falls back to Gmail compose. */
const ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || '';
const KEY = import.meta.env.VITE_CONTACT_KEY || '';
const EMAIL = 'hilkalathiya59@gmail.com';

export function gmailLink({ subject = 'Hello Hil', body = '' } = {}) {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to: EMAIL, su: subject });
  if (body) q.set('body', body);
  return 'https://mail.google.com/mail/?' + q.toString();
}

export function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const note = document.getElementById('formNote');
  const count = document.getElementById('tokCount');
  const btn = form.querySelector('button[type=submit]');
  const shownAt = performance.now();

  // a rough "token" count, about 4 characters each, to keep the attention theme
  const msg = form.elements.message;
  msg.addEventListener('input', () => {
    const n = Math.ceil(msg.value.trim().length / 4);
    count.textContent = n + (n === 1 ? ' token' : ' tokens');
  });

  const say = (html, ok) => { note.innerHTML = html; note.className = 'full note' + (ok ? ' ok' : ''); };
  const fallback = data => `<a href="${gmailLink({ subject: 'Hello Hil, from ' + (data.name || 'your site'), body: data.message })}" target="_blank" rel="noopener">send it with Gmail instead ↗</a>`;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    for (const k of ['name', 'email', 'message']) data[k] = (data[k] || '').trim();
    if (!data.name || !data.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      say('Please add your name, a valid email and a message.');
      (!data.name ? form.elements.name : !data.message ? msg : form.elements.email).focus();
      return;
    }
    if (!ENDPOINT) {
      window.open(gmailLink({ subject: 'Hello Hil, from ' + data.name, body: data.message + '\n\n' + data.name + ' · ' + data.email }), '_blank', 'noopener');
      say('Opened Gmail with your message filled in.', true);
      return;
    }
    btn.disabled = true; btn.textContent = 'sending…';
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (KEY) headers.apikey = KEY;
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers,
        body: JSON.stringify({ ...data, elapsed_ms: Math.round(performance.now() - shownAt), page: location.pathname }),
      });
      if (res.ok) {
        form.reset(); count.textContent = '0 tokens';
        say('✓ Sent. Hil will get back to you at the email you gave. <span class="grad">&lt;eos&gt;</span>', true);
      } else {
        let m = ''; try { m = (await res.json()).message || ''; } catch (_) {}
        const esc = t => t.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
        const lead = res.status === 429 ? 'Too many messages for now. '
          : res.status === 400 && m ? esc(m) + ' '
          : 'That did not go through. ';
        say(lead + fallback(data));
      }
    } catch (_) {
      say('Could not reach the inbox. ' + fallback(data));
    } finally {
      btn.disabled = false; btn.textContent = 'send ↵';
    }
  });
}
