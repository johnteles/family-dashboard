const REDIRECT_PATH = '/oauth/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const FAMILY_CALENDARS = ['John', 'Amanda', 'Anthony', 'Family'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'family-dashboard', version: '2.7.1' });
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
        return json({ ok: true, version: '2.5', items: rows.results || [] });
      }
      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Invalid JSON.' }, 400); }
        const action = body && body.action;
        if (action === 'create') {
          const name = String(body.name || '').trim();
          const category = String(body.category || 'PANTRY').trim().toUpperCase();
          if (!name) return json({ ok: false, error: 'Item name is required.' }, 400);
          const duplicate = await env.DB.prepare('SELECT id, category, name FROM grocery_items WHERE lower(name) = lower(?)').bind(name).first();
          if (duplicate) return json({ ok: false, error: duplicate.name + ' is already in ' + duplicate.category + '.', duplicate: duplicate }, 409);
          const categoryOrder = categoryOrderFor(category);
          const maxRow = await env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) AS n FROM grocery_items WHERE category = ?').bind(category).first();
          await env.DB.prepare("INSERT INTO grocery_items (category, category_order, name, sort_order, needed, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(category, categoryOrder, name, Number(maxRow && maxRow.n || 0) + 1, body.needed === false ? 0 : 1).run();
          const item = await env.DB.prepare('SELECT id, category, name, sort_order, needed, updated_at FROM grocery_items WHERE lower(name) = lower(?)').bind(name).first();
          return json({ ok: true, item: item }, 201);
        }
        const id = Number(body && body.id);
        if (!id) return json({ ok: false, error: 'Item id is required.' }, 400);
        if (action === 'set') {
          const needed = body.needed ? 1 : 0;
          await env.DB.prepare("UPDATE grocery_items SET needed = ?, updated_at = datetime('now') WHERE id = ?").bind(needed, id).run();
        } else if (action === 'update') {
          const name = String(body.name || '').trim();
          const category = String(body.category || '').trim().toUpperCase();
          if (!name || !category) return json({ ok: false, error: 'Name and category are required.' }, 400);
          const duplicate = await env.DB.prepare('SELECT id, category, name FROM grocery_items WHERE lower(name) = lower(?) AND id <> ?').bind(name, id).first();
          if (duplicate) return json({ ok: false, error: duplicate.name + ' is already in ' + duplicate.category + '.', duplicate: duplicate }, 409);
          await env.DB.prepare("UPDATE grocery_items SET name = ?, category = ?, category_order = ?, updated_at = datetime('now') WHERE id = ?").bind(name, category, categoryOrderFor(category), id).run();
        } else if (action === 'delete') {
          await env.DB.prepare('DELETE FROM grocery_items WHERE id = ?').bind(id).run();
          return json({ ok: true, deleted: id });
        } else {
          return json({ ok: false, error: 'Unsupported action.' }, 400);
        }
        const item = await env.DB.prepare('SELECT id, category, name, sort_order, needed, updated_at FROM grocery_items WHERE id = ?').bind(id).first();
        return json({ ok: true, item: item });
      }
      return json({ ok: false, error: 'Method not allowed.' }, 405);
    }


    if (url.pathname.indexOf('/api/finance') === 0) {
      if (!env.DB) return json({ ok: false, configured: false, error: 'D1 binding DB is missing.' }, 503);
      await ensureFinanceSchema(env.DB);

      if (url.pathname === '/api/finance/summary' && request.method === 'GET') {
        const month = validMonth(url.searchParams.get('month')) || currentMonthKey();
        const start = month + '-01';
        const end = nextMonthKey(month) + '-01';
        const totals = await env.DB.prepare(`
          SELECT
            COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses
          FROM finance_transactions
          WHERE transaction_date >= ? AND transaction_date < ? AND excluded = 0
        `).bind(start,end).first();
        const cats = await env.DB.prepare(`
          SELECT COALESCE(c.name,'Uncategorized') AS category, SUM(t.amount) AS amount
          FROM finance_transactions t
          LEFT JOIN finance_categories c ON c.id=t.category_id
          WHERE t.transaction_date >= ? AND t.transaction_date < ? AND t.type='expense' AND t.excluded=0
          GROUP BY COALESCE(c.name,'Uncategorized') ORDER BY amount DESC
        `).bind(start,end).all();
        const budget = await env.DB.prepare("SELECT amount FROM finance_budgets WHERE month = ? AND category_id IS NULL").bind(month).first();
        const income = Number(totals && totals.income || 0), expenses = Number(totals && totals.expenses || 0);
        return json({ ok:true, version:'2.7.1', month, income, expenses, balance: income-expenses, budget: budget ? Number(budget.amount) : null, categories: cats.results || [] });
      }

      if (url.pathname === '/api/finance/transactions') {
        if (request.method === 'GET') {
          const from = validDate(url.searchParams.get('from')) || currentMonthKey()+'-01';
          const to = validDate(url.searchParams.get('to')) || nextMonthKey(currentMonthKey())+'-01';
          const rows = await env.DB.prepare(`
            SELECT t.id,t.transaction_date,t.description,t.amount,t.type,t.owner,t.source,t.external_id,t.notes,t.excluded,
                   t.original_description,t.provider_category,t.review_status,t.classification_source,t.subcategory,
                   c.name AS category,a.name AS account,a.institution
            FROM finance_transactions t
            LEFT JOIN finance_categories c ON c.id=t.category_id
            LEFT JOIN finance_accounts a ON a.id=t.account_id
            WHERE t.transaction_date >= ? AND t.transaction_date < ?
            ORDER BY t.transaction_date DESC,t.id DESC LIMIT 1000
          `).bind(from,to).all();
          return json({ok:true,version:'2.7.1',transactions:rows.results||[]});
        }
        if (request.method === 'POST') {
          let body; try { body=await request.json(); } catch(e){ return json({ok:false,error:'Invalid JSON.'},400); }
          const action=String(body.action||'create');
          if (action === 'delete') {
            const id=Number(body.id); if(!id) return json({ok:false,error:'Transaction id is required.'},400);
            await env.DB.prepare('DELETE FROM finance_transactions WHERE id=?').bind(id).run();
            return json({ok:true,deleted:id});
          }
          if (action === 'update') {
            const id=Number(body.id); if(!id) return json({ok:false,error:'Transaction id is required.'},400);
            const date=validDate(body.date), desc=String(body.description||'').trim(), amount=Number(body.amount), type=String(body.type||'').toLowerCase();
            if(!date||!desc||!Number.isFinite(amount)||amount<0||!['income','expense','transfer'].includes(type)) return json({ok:false,error:'date, description, non-negative amount and valid type are required.'},400);
            const categoryId=body.categoryId?Number(body.categoryId):null, accountId=body.accountId?Number(body.accountId):null;
            const notes=body.notes?String(body.notes):null;
            const reviewStatus=String(body.reviewStatus||'reviewed'), subcategory=body.subcategory?String(body.subcategory):null; await env.DB.prepare("UPDATE finance_transactions SET transaction_date=?,description=?,amount=?,type=?,category_id=?,account_id=?,notes=?,review_status=?,classification_source='manual',subcategory=?,updated_at=datetime('now') WHERE id=?").bind(date,desc,amount,type,categoryId,accountId,notes,reviewStatus,subcategory,id).run();
            return json({ok:true,id});
          }
          if (action === 'create') {
            const date=validDate(body.date), desc=String(body.description||'').trim(), amount=Number(body.amount), type=String(body.type||'').toLowerCase();
            if(!date||!desc||!Number.isFinite(amount)||amount<0||!['income','expense','transfer'].includes(type)) return json({ok:false,error:'date, description, non-negative amount and valid type are required.'},400);
            const categoryId=body.categoryId?Number(body.categoryId):null, accountId=body.accountId?Number(body.accountId):null;
            const owner=String(body.owner||'Family'), source=String(body.source||'manual'), externalId=body.externalId?String(body.externalId):null, notes=body.notes?String(body.notes):null;
            if(externalId){ const dup=await env.DB.prepare('SELECT id FROM finance_transactions WHERE source=? AND external_id=?').bind(source,externalId).first(); if(dup) return json({ok:false,error:'Duplicate transaction.',duplicateId:dup.id},409); }
            const r=await env.DB.prepare("INSERT INTO finance_transactions (transaction_date,description,amount,type,category_id,account_id,owner,source,external_id,notes,excluded,original_description,review_status,classification_source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,'reviewed','manual',datetime('now'),datetime('now'))").bind(date,desc,amount,type,categoryId,accountId,owner,source,externalId,notes,desc).run();
            return json({ok:true,id:r.meta && r.meta.last_row_id},201);
          }
          return json({ok:false,error:'Unsupported action.'},400);
        }
      }

      if (url.pathname === '/api/finance/categories') {
        if(request.method==='GET'){ const rows=await env.DB.prepare('SELECT id,name,type,sort_order,active FROM finance_categories WHERE active=1 ORDER BY sort_order,name').all(); return json({ok:true,categories:rows.results||[]}); }
        if(request.method==='POST'){ let body;try{body=await request.json()}catch(e){return json({ok:false,error:'Invalid JSON.'},400)} const name=String(body.name||'').trim(),type=String(body.type||'expense').toLowerCase(); if(!name||!['income','expense'].includes(type))return json({ok:false,error:'Valid name and type are required.'},400); const dup=await env.DB.prepare('SELECT id FROM finance_categories WHERE lower(name)=lower(?) AND type=?').bind(name,type).first(); if(dup)return json({ok:false,error:'Category already exists.',duplicateId:dup.id},409); const max=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM finance_categories WHERE type=?').bind(type).first(); const r=await env.DB.prepare("INSERT INTO finance_categories(name,type,sort_order,active) VALUES(?,?,?,1)").bind(name,type,Number(max&&max.n||0)+1).run(); return json({ok:true,id:r.meta&&r.meta.last_row_id},201); }
      }

      if (url.pathname === '/api/finance/accounts') {
        if(request.method==='GET'){ const rows=await env.DB.prepare('SELECT id,name,institution,kind,owner,active FROM finance_accounts WHERE active=1 ORDER BY institution,name').all(); return json({ok:true,accounts:rows.results||[]}); }
        if(request.method==='POST'){ let body;try{body=await request.json()}catch(e){return json({ok:false,error:'Invalid JSON.'},400)} const name=String(body.name||'').trim(),institution=String(body.institution||'').trim(),kind=String(body.kind||'checking').trim(),owner=String(body.owner||'Family').trim(); if(!name)return json({ok:false,error:'Account name is required.'},400); const r=await env.DB.prepare('INSERT INTO finance_accounts(name,institution,kind,owner,active) VALUES(?,?,?,?,1)').bind(name,institution,kind,owner).run(); return json({ok:true,id:r.meta&&r.meta.last_row_id},201); }
      }

      if (url.pathname === '/api/finance/budgets') {
        if(request.method==='GET'){ const month=validMonth(url.searchParams.get('month'))||currentMonthKey(); const rows=await env.DB.prepare('SELECT b.id,b.month,b.amount,b.category_id,c.name category FROM finance_budgets b LEFT JOIN finance_categories c ON c.id=b.category_id WHERE b.month=? ORDER BY c.name').bind(month).all(); return json({ok:true,month,budgets:rows.results||[]}); }
        if(request.method==='POST'){ let body;try{body=await request.json()}catch(e){return json({ok:false,error:'Invalid JSON.'},400)} const month=validMonth(body.month),amount=Number(body.amount),categoryId=body.categoryId?Number(body.categoryId):null; if(!month||!Number.isFinite(amount)||amount<0)return json({ok:false,error:'Valid month and amount are required.'},400); if(categoryId){await env.DB.prepare('INSERT INTO finance_budgets(month,category_id,amount) VALUES(?,?,?) ON CONFLICT(month,category_id) DO UPDATE SET amount=excluded.amount').bind(month,categoryId,amount).run()}else{await env.DB.prepare('DELETE FROM finance_budgets WHERE month=? AND category_id IS NULL').bind(month).run();await env.DB.prepare('INSERT INTO finance_budgets(month,category_id,amount) VALUES(?,NULL,?)').bind(month,amount).run()} return json({ok:true}); }
      }

      if (url.pathname === '/api/finance/bills') {
        if(request.method==='GET'){ const rows=await env.DB.prepare("SELECT b.id,b.name,b.amount,b.due_date,b.category_id,b.recurrence,b.status,b.notes,b.matched_transaction_id,c.name category FROM finance_bills b LEFT JOIN finance_categories c ON c.id=b.category_id ORDER BY CASE b.status WHEN 'overdue' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,b.due_date").all(); return json({ok:true,bills:rows.results||[]}); }
        if(request.method==='POST'){ let body;try{body=await request.json()}catch(e){return json({ok:false,error:'Invalid JSON.'},400)} const action=String(body.action||'create'); if(action==='delete'){const id=Number(body.id);if(!id)return json({ok:false,error:'Bill id is required.'},400);await env.DB.prepare('DELETE FROM finance_bills WHERE id=?').bind(id).run();return json({ok:true,deleted:id});} const name=String(body.name||'').trim(),amount=Number(body.amount),due=validDate(body.dueDate),categoryId=body.categoryId?Number(body.categoryId):null,recurrence=String(body.recurrence||'none'),status=String(body.status||'upcoming'),notes=body.notes?String(body.notes):null; if(!name||!Number.isFinite(amount)||amount<0||!due||!['none','monthly','yearly'].includes(recurrence)||!['upcoming','paid','overdue'].includes(status))return json({ok:false,error:'Valid bill data is required.'},400); if(action==='update'){const id=Number(body.id);if(!id)return json({ok:false,error:'Bill id is required.'},400);await env.DB.prepare("UPDATE finance_bills SET name=?,amount=?,due_date=?,category_id=?,recurrence=?,status=?,notes=?,updated_at=datetime('now') WHERE id=?").bind(name,amount,due,categoryId,recurrence,status,notes,id).run();return json({ok:true,id});} const r=await env.DB.prepare("INSERT INTO finance_bills(name,amount,due_date,category_id,recurrence,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,datetime('now'),datetime('now'))").bind(name,amount,due,categoryId,recurrence,status,notes).run();return json({ok:true,id:r.meta&&r.meta.last_row_id},201); }
      }

      if (url.pathname === '/api/finance/rules') {
        if(request.method==='GET'){const rows=await env.DB.prepare('SELECT r.id,r.match_type,r.pattern,r.category_id,r.priority,r.active,c.name category FROM finance_rules r LEFT JOIN finance_categories c ON c.id=r.category_id WHERE r.active=1 ORDER BY r.priority,r.id').all();return json({ok:true,rules:rows.results||[]});}
        if(request.method==='POST'){let body;try{body=await request.json()}catch(e){return json({ok:false,error:'Invalid JSON.'},400)} const pattern=String(body.pattern||'').trim(),categoryId=Number(body.categoryId),matchType=String(body.matchType||'contains');if(!pattern||!categoryId)return json({ok:false,error:'Pattern and category are required.'},400);const r=await env.DB.prepare('INSERT INTO finance_rules(match_type,pattern,category_id,priority,active) VALUES(?,?,?,100,1)').bind(matchType,pattern,categoryId).run();return json({ok:true,id:r.meta&&r.meta.last_row_id},201);}
      }

      if (url.pathname === '/api/finance/import' && request.method === 'POST') {
        let body;try{body=await request.json()}catch(e){return json({ok:false,error:'Invalid JSON.'},400)}
        const rows=Array.isArray(body.transactions)?body.transactions:[]; if(!rows.length)return json({ok:false,error:'transactions array is required.'},400);
        let imported=0,duplicates=0,rejected=0;
        for(const row of rows.slice(0,1000)){
          const date=validDate(row.date),desc=String(row.description||'').trim(),amount=Number(row.amount),type=String(row.type||'expense').toLowerCase(),source=String(row.source||body.source||'import'),externalId=row.externalId?String(row.externalId):null;
          if(!date||!desc||!Number.isFinite(amount)||amount<0||!['income','expense','transfer'].includes(type)){rejected++;continue}
          if(externalId){const dup=await env.DB.prepare('SELECT id FROM finance_transactions WHERE source=? AND external_id=?').bind(source,externalId).first();if(dup){duplicates++;continue}}
          const catName=row.category?String(row.category):null; let categoryId=null; if(catName){const cat=await env.DB.prepare('SELECT id FROM finance_categories WHERE lower(name)=lower(?) AND type=?').bind(catName,type==='income'?'income':'expense').first(); categoryId=cat?cat.id:null;} const reviewStatus=String(row.reviewStatus||'needs_review'), classSource=String(row.classificationSource||'import'); await env.DB.prepare("INSERT INTO finance_transactions(transaction_date,description,amount,type,category_id,owner,source,external_id,excluded,original_description,provider_category,review_status,classification_source,subcategory,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,datetime('now'),datetime('now'))").bind(date,desc,amount,type,categoryId,String(row.owner||'Family'),source,externalId,String(row.originalDescription||desc),row.providerCategory?String(row.providerCategory):null,reviewStatus,classSource,row.subcategory?String(row.subcategory):null,row.notes?String(row.notes):null).run();imported++;
        }
        return json({ok:true,imported,duplicates,rejected});
      }

      return json({ok:false,error:'Finance endpoint not found.'},404);
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
      return json({ ok: true, configured: true, version: '2.5', rangeStart: start.toISOString(), rangeEnd: end.toISOString(), calendarsFound: calendars.map((c) => c.name), expectedCalendars: FAMILY_CALENDARS, events });
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


async function ensureFinanceSchema(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS finance_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')), sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, UNIQUE(name,type))"),
    db.prepare("CREATE TABLE IF NOT EXISTS finance_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, institution TEXT, kind TEXT NOT NULL DEFAULT 'checking', owner TEXT NOT NULL DEFAULT 'Family', active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS finance_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_date TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')), category_id INTEGER, account_id INTEGER, owner TEXT NOT NULL DEFAULT 'Family', source TEXT NOT NULL DEFAULT 'manual', external_id TEXT, notes TEXT, excluded INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(category_id) REFERENCES finance_categories(id), FOREIGN KEY(account_id) REFERENCES finance_accounts(id))"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_external ON finance_transactions(source,external_id) WHERE external_id IS NOT NULL"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_transactions(transaction_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS finance_budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT NOT NULL, category_id INTEGER, amount REAL NOT NULL DEFAULT 0, FOREIGN KEY(category_id) REFERENCES finance_categories(id))"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_budget_category ON finance_budgets(month,category_id) WHERE category_id IS NOT NULL"),
    db.prepare("CREATE TABLE IF NOT EXISTS finance_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, match_type TEXT NOT NULL DEFAULT 'contains', pattern TEXT NOT NULL, category_id INTEGER NOT NULL, priority INTEGER NOT NULL DEFAULT 100, active INTEGER NOT NULL DEFAULT 1, FOREIGN KEY(category_id) REFERENCES finance_categories(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS finance_bills (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL, category_id INTEGER, recurrence TEXT NOT NULL DEFAULT 'none', status TEXT NOT NULL DEFAULT 'upcoming', notes TEXT, matched_transaction_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(category_id) REFERENCES finance_categories(id), FOREIGN KEY(matched_transaction_id) REFERENCES finance_transactions(id))")
  ]);
  const cols=await db.prepare('PRAGMA table_info(finance_transactions)').all();
  const have={}; for(const c of (cols.results||[])) have[c.name]=1;
  const alters=[];
  if(!have.original_description) alters.push("ALTER TABLE finance_transactions ADD COLUMN original_description TEXT");
  if(!have.provider_category) alters.push("ALTER TABLE finance_transactions ADD COLUMN provider_category TEXT");
  if(!have.review_status) alters.push("ALTER TABLE finance_transactions ADD COLUMN review_status TEXT NOT NULL DEFAULT 'needs_review'");
  if(!have.classification_source) alters.push("ALTER TABLE finance_transactions ADD COLUMN classification_source TEXT NOT NULL DEFAULT 'manual'");
  if(!have.subcategory) alters.push("ALTER TABLE finance_transactions ADD COLUMN subcategory TEXT");
  for(const sql of alters) await db.prepare(sql).run();
  const count=await db.prepare('SELECT COUNT(*) count FROM finance_categories').first();
  if(count && Number(count.count)>0)return;
  const expense=['Housing','Home','Utilities','Groceries','Restaurants','Kids','Transportation','Health','Personal Care','Education','Entertainment','Travel','Shopping','Subscriptions','Taxes & Fees','Other'];
  const income=['Salary','Bonus','Other Income'];
  const stmts=[]; let i=1;
  for(const name of expense)stmts.push(db.prepare("INSERT OR IGNORE INTO finance_categories(name,type,sort_order,active) VALUES(?,'expense',?,1)").bind(name,i++));
  i=1;for(const name of income)stmts.push(db.prepare("INSERT OR IGNORE INTO finance_categories(name,type,sort_order,active) VALUES(?,'income',?,1)").bind(name,i++));
  await db.batch(stmts);
}
function validDate(v){return /^\\d{4}-\\d{2}-\\d{2}$/.test(String(v||''))?String(v):null}
function validMonth(v){return /^\\d{4}-\\d{2}$/.test(String(v||''))?String(v):null}
function currentMonthKey(){const d=new Date();return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')}
function nextMonthKey(m){const p=m.split('-');const d=new Date(Date.UTC(Number(p[0]),Number(p[1]),1));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')}

async function getGoogleAccessToken(env) {
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await r.json();
  if (!r.ok) return { ok: false, step: 'refresh_token', error: data };
  return { ok: true, access_token: data.access_token };
}

function categoryOrderFor(category) {
  const order = { 'DAIRY & EGGS': 1, 'FRUIT & VEGETABLES': 2, 'PANTRY': 3, 'HOUSEHOLD': 4, 'MEAT & SEAFOOD': 5, 'DRINKS': 6, 'FROZEN': 7, 'PERSONAL CARE': 8, 'BABY & KIDS': 9 };
  return order[String(category || '').toUpperCase()] || 99;
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
