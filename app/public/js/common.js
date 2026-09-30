// Shared helpers for every Gigbox page.

export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error?.message ?? `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body?.error?.code;
    throw err;
  }
  return body;
}

const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
export const formatMoney = (cents) => money.format(cents / 100);

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Copenhagen',
});
export const formatDate = (iso) => dateFmt.format(new Date(iso));

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Only allow redirects back into this site, never to another domain. */
export function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Redirects to the login page if there is no session. Returns the logged-in user. */
export async function requireLogin() {
  try {
    return await api('/me');
  } catch (err) {
    if (err.status === 401) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.replace(`/login?next=${next}`);
      return new Promise(() => {}); // the page is navigating away, stop here
    }
    throw err;
  }
}

export function renderHeader(user, current) {
  const link = (href, label, key) =>
    `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  document.getElementById('site-header').innerHTML = `
    <div class="inner">
      <a class="logo" href="/">gig<span>box</span></a>
      <nav class="site-nav" aria-label="Main">
        ${link('/', 'Events', 'events')}
        ${link('/orders', 'My orders', 'orders')}
      </nav>
      <div class="user-box">
        <span data-testid="user-name">${escapeHtml(user.name)}</span>
        <button class="link-button" id="logout">Log out</button>
      </div>
    </div>`;
  document.getElementById('logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    location.assign('/login');
  });
}
