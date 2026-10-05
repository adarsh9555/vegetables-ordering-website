// ====== EDIT YOUR SUPPORT DETAILS HERE ======
const SUPPORT = {
  phone: '9555762023',
  whatsapp: '919555762023', // country code + number, no + sign or spaces
  email: 'support@freshsabji.com',
  hours: 'Daily, 7 AM to 9 PM'
};
// ============================================

const Auth = {
  get token() { return localStorage.getItem('token'); },
  get user() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
  set(token, user) { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('token'); localStorage.removeItem('user'); }
};

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(Auth.token ? { Authorization: 'Bearer ' + Auth.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && Auth.token) { Auth.clear(); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._t); t._t = setTimeout(() => (t.style.display = 'none'), 2600);
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n).toFixed(0);
const fmtDate = s => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function cartCount() {
  try { return Object.keys(JSON.parse(localStorage.getItem('cart') || '{}')).length; } catch { return 0; }
}

function refreshCartBadge(bump) {
  const el = document.getElementById('cartBadge');
  if (!el) return;
  const n = cartCount();
  el.textContent = n;
  el.style.display = n ? 'inline-flex' : 'none';
  if (bump && n) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}

function renderNav(cfg) {
  const u = Auth.user;
  const admin = location.pathname.includes('admin');
  const q = new URLSearchParams(location.search).get('q') || '';

  const search = admin ? '' : `
    <form class="nav-search" id="navSearchForm" role="search">
      <input id="navSearch" type="search" placeholder="Search vegetables or fruits" value="${esc(q)}" aria-label="Search products" autocomplete="off">
      <button type="submit">Search</button>
    </form>`;

  const links = admin
    ? `<a class="nav-link" href="/">View shop</a>`
    : `<a class="nav-link hide-m" href="/#help">Help</a>${u ? '<a class="nav-link hide-m" href="/orders.html">My orders</a>' : ''}`;

  const cart = admin ? '' : `<button class="cart-btn" id="navCart" aria-label="Open cart">Cart <span class="cart-badge" id="cartBadge"></span></button>`;

  const acct = u
    ? `<div class="acct" id="acct">
         <button class="btn ghost small" id="acctBtn" aria-haspopup="true" aria-expanded="false">${esc(u.name.split(' ')[0])} &#9662;</button>
         <div class="menu">
           ${u.role === 'admin' ? '<a href="/admin.html">Admin panel</a>' : ''}
           <a href="/orders.html">My orders</a>
           <a href="#" id="logoutBtn">Log out</a>
         </div>
       </div>`
    : `<a class="btn small" href="/login.html">Log in</a>`;

  document.getElementById('nav').innerHTML = `
    <div class="container navwrap">
      <a class="logo" href="/"><i aria-hidden="true"></i>${esc(cfg.store)}</a>
      ${search}
      <div class="nav-actions">${links}${cart}${acct}</div>
    </div>`;

  const form = document.getElementById('navSearchForm');
  if (form) {
    const inp = document.getElementById('navSearch');
    inp.addEventListener('input', () => window.onShopSearch && window.onShopSearch(inp.value, false));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (window.onShopSearch) window.onShopSearch(inp.value, true);
      else location.href = '/?q=' + encodeURIComponent(inp.value.trim());
    });
  }
  const cb = document.getElementById('navCart');
  if (cb) cb.onclick = () => { if (window.openCart) window.openCart(true); else location.href = '/?cart=1'; };

  const acctEl = document.getElementById('acct');
  if (acctEl) {
    const btn = document.getElementById('acctBtn');
    btn.onclick = e => { e.stopPropagation(); const o = acctEl.classList.toggle('open'); btn.setAttribute('aria-expanded', o); };
    document.addEventListener('click', () => { acctEl.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    document.getElementById('logoutBtn').onclick = e => { e.preventDefault(); Auth.clear(); location.href = '/'; };
  }
  refreshCartBadge(false);
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

function renderFab() {
  if (location.pathname.includes('admin')) return;
  const a = document.createElement('a');
  a.className = 'wa-fab';
  a.target = '_blank'; a.rel = 'noopener';
  a.href = `https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent('Hello, I need help.')}`;
  a.setAttribute('aria-label', 'Get help on WhatsApp');
  a.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-3.9-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.3.4-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1 1 2 1.3 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4Z"/></svg><span>WhatsApp</span>';
  document.body.appendChild(a);
}

async function initPage(requireLogin = false, requireAdmin = false) {
  const cfg = await api('/config');
  document.title = cfg.store + ' - Fresh vegetables, delivered home';
  if (requireLogin && !Auth.token) { location.href = '/login.html'; return null; }
  if (requireAdmin && (!Auth.user || Auth.user.role !== 'admin')) { location.href = '/login.html'; return null; }
  renderNav(cfg);
  renderFab();
  return cfg;
}
