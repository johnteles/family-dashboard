export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Backend smoke test. No secrets are exposed here.
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'family-dashboard', version: '1.3' });
    }

    // Calendar endpoint scaffold. Google integration is enabled in the next step.
    if (url.pathname === '/api/calendar') {
      const configured = Boolean(
        env.GOOGLE_CLIENT_ID &&
        env.GOOGLE_CLIENT_SECRET &&
        env.GOOGLE_REFRESH_TOKEN
      );

      if (!configured) {
        return json({
          ok: false,
          configured: false,
          message: 'Google Calendar ainda nao configurado.'
        }, 503);
      }

      return json({
        ok: true,
        configured: true,
        events: [],
        message: 'Backend pronto. Consulta ao Google Calendar sera ativada na proxima etapa.'
      });
    }

    // Serve the existing dashboard and other static files.
    return env.ASSETS.fetch(request);
  }
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
