const REDIRECT_PATH = '/oauth/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const FAMILY_CALENDARS = ['John', 'Amanda', 'Anthony', 'Family'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'family-dashboard', version: '2.3.3' });
    }

    if (url.pathname === '/oauth/start') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return text('Google OAuth is not configured.', 503);
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
      if (error) return text(`Google OAuth declined: ${error}`, 400);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookieState = getCookie(request.headers.get('cookie') || '', 'oauth_state');
      if (!code || !state || !cookieState || state !== cookieState) return text('OAuth validation failed.', 400);
      const redirectUri = `${url.origin}${REDIRECT_PATH}`;
      const body = new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' });
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) return json({ ok: false, step: 'token_exchange', error: tokenData }, 502);
      if (!tokenData.refresh_token) return text('Google did not return a refresh token.', 409);
      return html(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Family Dashboard OAuth</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.5}code{display:block;word-break:break-all;padding:16px;background:#f2f2f2;border-radius:10px}</style><h1>Authorization complete</h1><p>Save the value below as the <b>GOOGLE_REFRESH_TOKEN</b> Secret.</p><code>${escapeHtml(tokenData.refresh_token)}</code></html>`);
    }

    if (url.pathname === '/api/weather') {
      // Rio de Janeiro city-level coordinates. Open-Meteo requires no API key for non-commercial use.
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.searchParams.set('latitude', '-22.9068');
      weatherUrl.searchParams.set('longitude', '-43.1729');
      weatherUrl.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,is_day');
      weatherUrl.searchParams.set('temperature_unit', 'celsius');
      weatherUrl.searchParams.set('timezone', 'America/Sao_Paulo');
      const r = await fetch(weatherUrl.toString(), { cf: { cacheTtl: 600, cacheEverything: true } });
      const data = await r.json();
      if (!r.ok || !data.current) return json({ ok: false, step: 'weather', error: data }, 502);
      return json({
        ok: true,
        temperature: Math.round(data.current.temperature_2m),
        apparentTemperature: Math.round(data.current.apparent_temperature),
        weatherCode: data.current.weather_code,
        isDay: data.current.is_day === 1,
        source: 'Open-Meteo'
      });
    }

    if (url.pathname === '/api/grocery') {
      if (!env.DB) return json({ ok: false, configured: false, error: 'D1 binding DB is missing.' }, 503);
      await ensureGrocerySchema(env.DB);
      if (request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id, category, name, sort_order, needed, updated_at FROM grocery_items ORDER BY category_order, sort_order, name').all();
        return json({ ok: true, version: '2.3.3', items: rows.results || [] });
      }
      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Invalid JSON.' }, 400); }
        const id = Number(body && body.id);
        if (!id) return json({ ok: false, error: 'Item id is required.' }, 400);
        if (body.action === 'toggle') {
          await env.DB.prepare("UPDATE grocery_items SET needed = CASE WHEN needed = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?").bind(id).run();
        } else if (body.action === 'set') {
          const needed = body.needed ? 1 : 0;
          await env.DB.prepare("UPDATE grocery_items SET needed = ?, updated_at = datetime('now') WHERE id = ?").bind(needed, id).run();
        } else {
          return json({ ok: false, error: 'Unsupported action.' }, 400);
        }
        const item = await env.DB.prepare('SELECT id, category, name, sort_order, needed, updated_at FROM grocery_items WHERE id = ?').bind(id).first();
        return json({ ok: true, item: item });
      }
      return json({ ok: false, error: 'Method not allowed.' }, 405);
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
      let start = parseDateParam(url.searchParams.get('start')) || now;
      let end = parseDateParam(url.searchParams.get('end')) || new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
      const maxWindowMs = 93 * 24 * 60 * 60 * 1000;
      if (end <= start) end = new Date(start.getTime() + 45 * 24 * 60 * 60 * 1000);
      if (end.getTime() - start.getTime() > maxWindowMs) end = new Date(start.getTime() + maxWindowMs);
      const results = await Promise.all(calendars.map(async (cal) => {
        const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`);
        eventsUrl.searchParams.set('timeMin', start.toISOString());
        eventsUrl.searchParams.set('timeMax', end.toISOString());
        eventsUrl.searchParams.set('singleEvents', 'true');
        eventsUrl.searchParams.set('orderBy', 'startTime');
        eventsUrl.searchParams.set('maxResults', '50');
        const r = await fetch(eventsUrl.toString(), { headers });
        const data = await r.json();
        if (!r.ok) return [];
        return (data.items || []).map((e) => ({ id: e.id, title: e.summary || '(Untitled)', start: e.start && (e.start.dateTime || e.start.date), end: e.end && (e.end.dateTime || e.end.date), allDay: Boolean(e.start && e.start.date), calendar: cal.name }));
      }));

      const events = results.flat().sort((a, b) => String(a.start).localeCompare(String(b.start)));
      return json({ ok: true, configured: true, version: '2.3.3', rangeStart: start.toISOString(), rangeEnd: end.toISOString(), calendarsFound: calendars.map((c) => c.name), expectedCalendars: FAMILY_CALENDARS, events });
    }

    return env.ASSETS.fetch(request);
  }
};

async function ensureGrocerySchema(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS grocery_items (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, category_order INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL UNIQUE, sort_order INTEGER NOT NULL DEFAULT 0, needed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now'))) ").run();
  const count = await db.prepare('SELECT COUNT(*) AS count FROM grocery_items').first();
  if (count && Number(count.count) > 0) return;
  const seed = [
    ['DAIRY & EGGS',1,'Milk',1],['DAIRY & EGGS',1,'Eggs',2],['DAIRY & EGGS',1,'Butter',3],['DAIRY & EGGS',1,'Cheese',4],['DAIRY & EGGS',1,'Yogurt',5],
    ['FRUIT & VEGETABLES',2,'Bananas',1],['FRUIT & VEGETABLES',2,'Apples',2],['FRUIT & VEGETABLES',2,'Oranges',3],['FRUIT & VEGETABLES',2,'Tomatoes',4],['FRUIT & VEGETABLES',2,'Potatoes',5],['FRUIT & VEGETABLES',2,'Onions',6],['FRUIT & VEGETABLES',2,'Garlic',7],['FRUIT & VEGETABLES',2,'Lettuce',8],
    ['PANTRY',3,'Rice',1],['PANTRY',3,'Beans',2],['PANTRY',3,'Pasta',3],['PANTRY',3,'Bread',4],['PANTRY',3,'Coffee',5],['PANTRY',3,'Olive oil',6],['PANTRY',3,'Flour',7],['PANTRY',3,'Sugar',8],['PANTRY',3,'Salt',9],
    ['HOUSEHOLD',4,'Toilet paper',1],['HOUSEHOLD',4,'Paper towels',2],['HOUSEHOLD',4,'Dish soap',3],['HOUSEHOLD',4,'Dishwasher tablets',4],['HOUSEHOLD',4,'Trash bags',5],['HOUSEHOLD',4,'Laundry detergent',6]
  ];
  const statements = [];
  for (const row of seed) statements.push(db.prepare('INSERT OR IGNORE INTO grocery_items (category, category_order, name, sort_order) VALUES (?, ?, ?, ?)').bind(row[0], row[1], row[2], row[3]));
  await db.batch(statements);
}

async function getGoogleAccessToken(env) {
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await r.json();
  if (!r.ok) return { ok: false, step: 'refresh_token', error: data };
  return { ok: true, access_token: data.access_token };
}

function parseDateParam(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function normalizeName(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
function getCookie(header, name) { const parts = header.split(';'); for (const part of parts) { const i = part.indexOf('='); if (i >= 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim()); } return null; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function json(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function text(data, status) { return new Response(data, { status: status || 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } }); }
function html(data, status) { return new Response(data, { status: status || 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }); }
