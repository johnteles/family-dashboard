const REDIRECT_PATH = '/oauth/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const FAMILY_CALENDARS = ['John', 'Amanda', 'Anthony', 'Família'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'family-dashboard', version: '1.4' });
    }

    if (url.pathname === '/oauth/start') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return text('Google OAuth nao configurado.', 503);
      const redirectUri = `${url.origin}${REDIRECT_PATH}`;
      const state = crypto.randomUUID();
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
      auth.searchParams.set('redirect_uri', redirectUri);
      auth.searchParams.set('response_type', 'code');
      auth.searchParams.set('scope', SCOPE);
      auth.searchParams.set('access_type', 'offline');
      auth.searchParams.set('prompt', 'consent');
      auth.searchParams.set('include_granted_scopes', 'true');
      auth.searchParams.set('state', state);
      return new Response(null, { status: 302, headers: { location: auth.toString(), 'set-cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`, 'cache-control': 'no-store' } });
    }

    if (url.pathname === REDIRECT_PATH) {
      const error = url.searchParams.get('error');
      if (error) return text(`Google OAuth recusado: ${error}`, 400);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookieState = getCookie(request.headers.get('cookie') || '', 'oauth_state');
      if (!code || !state || !cookieState || state !== cookieState) return text('Falha na validacao do OAuth.', 400);
      const redirectUri = `${url.origin}${REDIRECT_PATH}`;
      const body = new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' });
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) return json({ ok: false, step: 'token_exchange', error: tokenData }, 502);
      if (!tokenData.refresh_token) return text('Google nao retornou refresh_token.', 409);
      return html(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Family Dashboard OAuth</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.5}code{display:block;word-break:break-all;padding:16px;background:#f2f2f2;border-radius:10px}</style><h1>Autorizacao concluida</h1><p>Salve o valor abaixo como Secret <b>GOOGLE_REFRESH_TOKEN</b>.</p><code>${escapeHtml(tokenData.refresh_token)}</code></html>`);
    }

    if (url.pathname === '/api/calendar') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) return json({ ok: false, configured: false }, 503);
      const accessToken = await getGoogleAccessToken(env);
      if (!accessToken.ok) return json(accessToken, 502);

      const headers = { authorization: `Bearer ${accessToken.access_token}` };
      const listResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100', { headers });
      const listData = await listResponse.json();
      if (!listResponse.ok) return json({ ok: false, step: 'calendar_list', error: listData }, 502);

      const wanted = {};
      FAMILY_CALENDARS.forEach((name) => { wanted[normalizeName(name)] = name; });
      const calendars = (listData.items || []).filter((c) => wanted[normalizeName(c.summary)]).map((c) => ({ id: c.id, name: wanted[normalizeName(c.summary)] }));

      const now = new Date();
      const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const results = await Promise.all(calendars.map(async (cal) => {
        const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`);
        eventsUrl.searchParams.set('timeMin', now.toISOString());
        eventsUrl.searchParams.set('timeMax', end.toISOString());
        eventsUrl.searchParams.set('singleEvents', 'true');
        eventsUrl.searchParams.set('orderBy', 'startTime');
        eventsUrl.searchParams.set('maxResults', '50');
        const r = await fetch(eventsUrl.toString(), { headers });
        const data = await r.json();
        if (!r.ok) return [];
        return (data.items || []).map((e) => ({ id: e.id, title: e.summary || '(Sem titulo)', start: e.start && (e.start.dateTime || e.start.date), end: e.end && (e.end.dateTime || e.end.date), allDay: Boolean(e.start && e.start.date), calendar: cal.name }));
      }));

      const events = results.flat().sort((a, b) => String(a.start).localeCompare(String(b.start)));
      return json({ ok: true, configured: true, version: '1.4', rangeDays: 14, calendarsFound: calendars.map((c) => c.name), expectedCalendars: FAMILY_CALENDARS, events });
    }

    return env.ASSETS.fetch(request);
  }
};

async function getGoogleAccessToken(env) {
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await r.json();
  if (!r.ok) return { ok: false, step: 'refresh_token', error: data };
  return { ok: true, access_token: data.access_token };
}
function normalizeName(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
function getCookie(header, name) { const parts = header.split(';'); for (const part of parts) { const i = part.indexOf('='); if (i >= 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim()); } return null; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function json(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function text(data, status) { return new Response(data, { status: status || 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } }); }
function html(data, status) { return new Response(data, { status: status || 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }); }
