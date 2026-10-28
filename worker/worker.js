/**
 * Полная замена скрипта воркера lanyard-proxy.lopgg96.workers.dev
 *
 * Один файл делает две вещи:
 *   /v1/users/:id  — прокси Lanyard (как у тебя сейчас)
 *   /lastfm        — прокси last.fm (прячет api_key, добавляет CORS)
 *
 * Как задеплоить (2 минуты):
 *   1. Cloudflare → Workers & Pages → твой воркер → Edit code
 *   2. Выделить всё (Ctrl+A) и вставить этот файл вместо старого
 *   3. Deploy
 *   4. Settings → Variables and Secrets → Add → Secret
 *      Name:  LASTFM_API_KEY
 *      Value: ключ с https://www.last.fm/api/account/create
 *
 * Проверка после деплоя:
 *   https://lanyard-proxy.lopgg96.workers.dev/v1/users/912747427465928754
 *   https://lanyard-proxy.lopgg96.workers.dev/lastfm?method=user.getrecenttracks&user=Japansxow&limit=1
 *
 * Если ключ ещё не создан — /lastfm вернёт {"error":"LASTFM_API_KEY is not set"}.
 * Остальной сайт (presence) при этом продолжит работать.
 */

const LANYARD = 'https://api.lanyard.rest/v1/users/';

const ALLOWED = ['method', 'user', 'limit', 'period', 'from', 'to', 'extended'];
const LASTFM_METHODS = new Set(['user.getrecenttracks', 'user.gettopartists']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

async function handleLanyard(id) {
  const res = await fetch(LANYARD + id, { cf: { cacheTtl: 10 } });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=10' },
  });
}

async function handleLastfm(request, env) {
  const url = new URL(request.url);

  if (!env.LASTFM_API_KEY) return json({ error: 'LASTFM_API_KEY is not set' }, 500);

  const method = url.searchParams.get('method');
  if (!method) return json({ error: 'method is required' }, 400);
  if (!LASTFM_METHODS.has(method)) return json({ error: 'method not allowed' }, 400);

  const user = url.searchParams.get('user') || '';
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(user)) return json({ error: 'invalid user' }, 400);

  const limit = url.searchParams.get('limit');
  if (limit !== null && (!/^[0-9]{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 50)) {
    return json({ error: 'invalid limit' }, 400);
  }

  const target = new URL('https://ws.audioscrobbler.com/2.0/');
  for (const key of ALLOWED) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== '') target.searchParams.set(key, value);
  }
  target.searchParams.set('api_key', env.LASTFM_API_KEY);
  target.searchParams.set('format', 'json');

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'shiokaze-bio/1.2 (+https://shiokazee.github.io/bio/)' },
      cf: { cacheTtl: 20, cacheEverything: true },
    });
  } catch (error) {
    return json({ error: 'upstream unreachable' }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, { Allow: 'GET, OPTIONS' });

    try {
      if (url.pathname.startsWith('/v1/users/')) {
        const id = url.pathname.split('/').filter(Boolean).pop();
        if (!/^\d{5,25}$/.test(id)) return json({ error: 'bad user id' }, 400);
        return await handleLanyard(id);
      }

      if (url.pathname === '/lastfm' || url.pathname.startsWith('/lastfm/')) {
        return await handleLastfm(request, env);
      }

      if (url.pathname === '/' || url.pathname === '') {
        return json({ ok: true, routes: ['/v1/users/:id', '/lastfm'] });
      }

      return json({ error: { code: 'not_found', message: 'Route does not exist' }, success: false }, 404);
    } catch (error) {
      return json({ error: 'worker crash' }, 500);
    }
  },
};
