import { publicCached, invalidatePublic } from './public-cache.mjs';
import { handleCompetition, getCompetitionState } from './competition.mjs';
import { PHASES, audit, event, recordMetrics, supportSnapshot } from './competition-core.mjs';
import { ApiError, fail, json, clean, idOf, bodyOf } from './http.mjs';
import baseCatalog from '../src/lib/catalogue-2027.json' with { type: 'json' };
import { AdvancedVotingInputSchema, advancedVotingWithAutoCalculation } from '../src/ai/flows/advanced-voting-auto-calculation.ts';
import { equal, hashPassword, sha256, token, verifyPassword } from './crypto.mjs';

const COOKIE = '__Host-votacoac_session';
const SESSION_AGE = 30 * 24 * 60 * 60;
const categories = ['Coro', 'Comparsa', 'Chirigota', 'Cuarteto'];
const voteTypes = { advanced: 'Avanzado', apto: 'Apto/No Apto', aguja: 'Aguja de Oro' };
const limits = { Coro: 10, Comparsa: 20, Chirigota: 20, Cuarteto: 6 };
const cookie = (value, age = SESSION_AGE) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const publicUser = user => user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null;
const emailOf = value => {
  const email = clean(value, 254, 'el email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Introduce un email válido.');
  return email;
};
const passwordOf = value => {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) fail(400, 'La contraseña debe tener entre 10 y 128 caracteres.');
  return value;
};
function checkWrite(request) {
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin || request.headers.get('x-requested-with') !== 'VotaCOAC') fail(403, 'La petición debe proceder de esta web.', 'origin_rejected');
}
function dbOf(env) {
  if (!env.DB?.prepare) { console.error('VotaCOAC: DB binding unavailable'); fail(503, 'El servicio de datos no está disponible.', 'database_unavailable'); }
  return env.DB;
}
async function getUser(request, db) {
  const value = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  return db.prepare('SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1').bind(await sha256(value), Date.now()).first();
}
async function requireUser(request, db) {
  const user = await getUser(request, db) || fail(401, 'Inicia sesión para continuar.', 'authentication_required');
  if (!['GET','HEAD'].includes(request.method) && !(new URL(request.url).pathname === '/api/account' && request.method === 'DELETE')) {
    const moderation = await db.prepare('SELECT status FROM account_moderation WHERE user_id=?').bind(user.id).first();
    if (moderation?.status === 'suspended') fail(403, 'Tu cuenta está suspendida para participar. Contacta con administración.', 'account_suspended');
  }
  return user;
}
async function requireAdmin(request, db) {
  const user = await requireUser(request, db);
  if (user.role !== 'admin') fail(403, 'Esta sección es solo para el administrador.');
  return user;
}
async function issueSession(db, userId) {
  const session = token(); const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(now),
    db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await sha256(session), userId, now + SESSION_AGE * 1000, now),
  ]);
  return cookie(session);
}
async function throttle(db, request, scope, identity, maximum = 12, interval = 900000) {
  const now = Date.now();
  const key = await sha256(`${scope}|${identity}|${request.headers.get('cf-connecting-ip') || 'local'}`);
  const row = await db.prepare('INSERT INTO rate_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END,resets_at=CASE WHEN resets_at<=? THEN ? ELSE resets_at END RETURNING attempts').bind(key, now + interval, now, now, now + interval).first();
  if (row.attempts > maximum) fail(429, 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.', 'rate_limited');
}
async function loadCatalog(db) {
  const saved = await db.prepare("SELECT value FROM settings WHERE key='catalog'").first();
  const catalog = saved ? JSON.parse(saved.value) : structuredClone(baseCatalog);
  if (catalog.edition.id === baseCatalog.edition.id && catalog.edition.notice?.trim() === 'Participantes transcritos del listado facilitado por el propietario. Calendario y resultados oficiales pendientes.') catalog.edition.notice = '';
  return catalog;
}
const votesForClient = rows => rows.map(row => ({ id: row.id, groupId: row.group_id, groupName: row.group_name, category: row.category, votingType: row.voting_type, performanceId: row.performance_id, score: row.score, ...(row.apto !== null ? { apto: !!row.apto } : {}), createdAt: row.created_at, ...(row.details ? { details: JSON.parse(row.details) } : {}) }));
async function getState(request, db) {
  const [catalog, user] = await Promise.all([loadCatalog(db), getUser(request, db)]);
  const cached = await publicCached(db,'rankings:'+catalog.edition.id,async()=>{
    const aggregate = await db.prepare("SELECT v.group_id,v.group_name,v.category,v.voting_type,AVG(CASE WHEN v.voting_type='Apto/No Apto' THEN v.apto*100 ELSE v.score END) AS average_score,COUNT(*) AS vote_count FROM votes v LEFT JOIN account_moderation m ON m.user_id=v.user_id WHERE v.edition_id=? AND COALESCE(m.status,'active')<>'suspended' GROUP BY v.group_id,v.voting_type ORDER BY average_score DESC,v.group_name ASC").bind(catalog.edition.id).all();
    const counts = await db.prepare("SELECT COUNT(*) AS votes,COUNT(DISTINCT v.user_id) AS participants FROM votes v LEFT JOIN account_moderation m ON m.user_id=v.user_id WHERE v.edition_id=? AND COALESCE(m.status,'active')<>'suspended'").bind(catalog.edition.id).first();
    return {aggregate,counts};
  });
  const {aggregate,counts}=cached;
  const ranking = type => aggregate.results.filter(row => row.voting_type === type && catalog.groups.some(g => g.id === row.group_id)).map((row, i) => ({ position: i + 1, groupId: row.group_id, groupName: catalog.groups.find(g => g.id === row.group_id)?.name || row.group_name, category: row.category, averageScore: row.average_score, voteCount: row.vote_count }));

  let personal = { votes: [], favorites: [], prediction: { Coro: [], Comparsa: [], Chirigota: [], Cuarteto: [] } };
  if (user) {
    const [v, f, p] = await db.batch([
      db.prepare('SELECT * FROM votes WHERE user_id=? AND edition_id=? ORDER BY created_at DESC').bind(user.id, catalog.edition.id),
      db.prepare('SELECT group_id FROM favorites WHERE user_id=? AND edition_id=?').bind(user.id, catalog.edition.id),
      db.prepare('SELECT selection FROM predictions WHERE user_id=? AND edition_id=?').bind(user.id, catalog.edition.id),
    ]);
    personal = { votes: votesForClient(v.results), favorites: f.results.map(row => row.group_id), prediction: p.results[0] ? JSON.parse(p.results[0].selection) : personal.prediction };
  }
  return { competition: await getCompetitionState(db, catalog, user), catalog, user: publicUser(user), personal, rankings: { advanced: ranking('Avanzado'), apto: ranking('Apto/No Apto'), aguja: ranking('Aguja de Oro') }, counts, serverTime: Date.now() };
}
function validImage(value) { if (!value) return ''; if (typeof value !== 'string' || value.length > 1000) fail(400, 'URL de fotografía no válida.'); if (value.startsWith('/art/')) return value; let url; try { url = new URL(value); } catch { fail(400, 'URL de fotografía no válida.'); } if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'Usa una fotografía con URL HTTPS.'); return url.href; }
function validateCatalog(input) {
  const edition = { id: idOf(input.edition?.id), name: clean(input.edition?.name, 80, 'el nombre de edición'), demo: !!input.edition?.demo, votingOpen: input.edition?.votingOpen !== false, notice: clean(input.edition?.notice || '', 240, 'la descripción de edición', 0) };
  if (!Array.isArray(input.groups) || !input.groups.length || input.groups.length > 1000 || !Array.isArray(input.sessions) || input.sessions.length > 100) fail(400, 'La programación no es válida.');
  const groups = input.groups.map(g => {
    if (!categories.includes(g.category)) fail(400, 'Modalidad no válida.');
    return { id: idOf(g.id), name: clean(g.name, 140, 'el nombre de agrupación'), category: g.category, author: clean(g.author, 200, 'la autoría', 0), description: clean(g.description || '', 300, 'la descripción', 0), locality: clean(g.locality || '', 120, 'la localidad', 0), director: clean(g.director || '', 200, 'la dirección', 0), source: clean(g.source || '', 500, 'la fuente', 0), needsReview: !!g.needsReview, sourceLabel: clean(g.sourceLabel || g.name, 200, 'el nombre original', 0), imageUrl: validImage(g.imageUrl), imageHint: '' };
  });
  if (new Set(groups.map(g => g.id)).size !== groups.length) fail(400, 'Hay identificadores de agrupación duplicados.');
  const ids = new Set(groups.map(g => g.id)); const performanceIds = new Set();
  const sessions = input.sessions.map(s => ({
    phase: PHASES.includes(s.phase) ? s.phase : 'preliminares', id: idOf(s.id), name: clean(s.name, 100, 'el nombre de sesión'), location: clean(s.location, 140, 'el lugar'), date: clean(s.date, 100, 'la fecha'), time: clean(s.time, 40, 'la hora'),
    performances: (() => {
      if (!Array.isArray(s.performances) || s.performances.length > 50) fail(400, 'Actuaciones no válidas.');
      return s.performances.map(p => {
        const id = idOf(p.id); const groupId = idOf(p.groupId);
        if (!ids.has(groupId) || performanceIds.has(id) || !Number.isFinite(Date.parse(p.actTime))) fail(400, 'Revisa las actuaciones y sus fechas de apertura.');
        performanceIds.add(id); return { id, groupId, actTime: new Date(p.actTime).toISOString() };
      });
    })(),
  }));
  if (new Set(sessions.map(s => s.id)).size !== sessions.length) fail(400, 'Hay sesiones duplicadas.');
  return { edition, groups, sessions };
}

async function api(request, env) {
  const db = dbOf(env); const url = new URL(request.url); const path = url.pathname; const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') checkWrite(request);
  if (path.startsWith('/api/competition/') || path.startsWith('/api/integration/v1/') || /^\/api\/admin\/(modules|results|recalculate|bingo-events|bingo-cards|moderation|integration-keys|audit|review)$/.test(path)) return handleCompetition(request, env, { db, requireUser, requireAdmin, getUser, throttle, loadCatalog });
  if (path === '/api/health' && method === 'GET') {
    await db.prepare('SELECT key FROM settings LIMIT 1').first();
    return json({ ok: true, storage: 'D1', authentication: 'email-password', schema: 2 });
  }
  if (path === '/api/state' && method === 'GET') return json(await getState(request, db));
  if (path === '/api/auth/register' && method === 'POST') {
    const input = await bodyOf(request); const email = emailOf(input.email); const password = passwordOf(input.password); const name = clean(input.name, 60, 'tu nombre', 2);
    await throttle(db, request, 'register', 'all', 10, 3600000);
    const existing = await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
    if (existing) fail(409, 'Ya existe una cuenta con ese email. Inicia sesión.');
    const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
    let role = 'user';
    if (email === adminEmail) {
      const trustedOwner = String(request.headers.get('oai-authenticated-user-email') || '').trim().toLowerCase();
      if (!env.BOOTSTRAP_OWNER_EMAIL || trustedOwner !== String(env.BOOTSTRAP_OWNER_EMAIL).toLowerCase()) fail(403, 'Verifica primero que eres el propietario del sitio para activar la cuenta administradora.', 'admin_owner_verification');
      role = 'admin';
    }
    const id = crypto.randomUUID(); const recoveryCode = token(24); const now = Date.now();
    try { await db.prepare('INSERT INTO users(id,email,name,password_hash,recovery_hash,role,created_at) VALUES(?,?,?,?,?,?,?)').bind(id, email, name, await hashPassword(password), await sha256(id + ':' + recoveryCode), role, now).run(); }
    catch (error) { if (/UNIQUE/i.test(String(error))) fail(409, 'Ya existe una cuenta con ese email. Inicia sesión.'); throw error; }
    return json({ user: { id, email, name, role }, recoveryCode }, 201, { 'Set-Cookie': await issueSession(db, id) });
  }
  if (path === '/api/auth/login' && method === 'POST') {
    const input = await bodyOf(request); const email = emailOf(input.email); const password = typeof input.password === 'string' && input.password.length <= 128 ? input.password : '';
    await throttle(db, request, 'login', email);
    const user = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    const valid = await verifyPassword(password, user?.password_hash);
    if (!user || !valid) fail(401, 'El email o la contraseña no son correctos.', 'invalid_credentials');
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': await issueSession(db, user.id) });
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    const session = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (session) await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await sha256(session)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  if (path === '/api/auth/recover' && method === 'POST') {
    const input = await bodyOf(request); const email = emailOf(input.email); const code = clean(input.code, 80, 'el código de recuperación'); const password = passwordOf(input.password);
    await throttle(db, request, 'recover', email, 6);
    const user = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if (!user || !equal(await sha256(user.id + ':' + code), user.recovery_hash)) fail(401, 'El email o el código de recuperación no son correctos.');
    const recoveryCode = token(24);
    await db.batch([
      db.prepare('UPDATE users SET password_hash=?,recovery_hash=? WHERE id=?').bind(await hashPassword(password), await sha256(user.id + ':' + recoveryCode), user.id),
      db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id),
    ]);
    return json({ user: publicUser(user), recoveryCode }, 200, { 'Set-Cookie': await issueSession(db, user.id) });
  }
  if (path === '/api/account' && method === 'PATCH') {
    const user = await requireUser(request, db); const input = await bodyOf(request); const name = clean(input.name, 60, 'tu nombre', 2);
    await db.prepare('UPDATE users SET name=? WHERE id=?').bind(name, user.id).run();
    return json({ user: { ...publicUser(user), name } });
  }
  if (path === '/api/account/password' && method === 'POST') {
    const user = await requireUser(request, db); const input = await bodyOf(request);
    await throttle(db, request, 'password', user.id, 8);
    if (!await verifyPassword(String(input.currentPassword || ''), user.password_hash)) fail(401, 'La contraseña actual no es correcta.');
    const password = passwordOf(input.password);
    await db.batch([db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(password), user.id), db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id)]);
    return json({ ok: true }, 200, { 'Set-Cookie': await issueSession(db, user.id) });
  }
  if (path === '/api/account/recovery-code' && method === 'POST') {
    const user = await requireUser(request, db); const input = await bodyOf(request);
    await throttle(db, request, 'password', user.id, 8);
    if (!await verifyPassword(String(input.password || ''), user.password_hash)) fail(401, 'La contraseña no es correcta.');
    const recoveryCode = token(24);
    await db.prepare('UPDATE users SET recovery_hash=? WHERE id=?').bind(await sha256(user.id + ':' + recoveryCode), user.id).run();
    return json({ recoveryCode });
  }
  if (path === '/api/account' && method === 'DELETE') {
    const user = await requireUser(request, db); const input = await bodyOf(request);
    if (!await verifyPassword(String(input.password || ''), user.password_hash)) fail(401, 'La contraseña no es correcta.');
    const catalog = await loadCatalog(db);
    const affected = (await db.prepare('SELECT DISTINCT performance_id,group_id FROM votes WHERE user_id=? AND edition_id=?').bind(user.id,catalog.edition.id).all()).results;
    await db.prepare('DELETE FROM users WHERE id=?').bind(user.id).run();
    invalidatePublic(db);
    for (const vote of affected) await recordMetrics(db,catalog,vote.performance_id,vote.group_id);
    for (const category of categories) await supportSnapshot(db,catalog,category);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  if (path === '/api/votes' && method === 'POST') {
    const user = await requireUser(request, db); const input = await bodyOf(request); const catalog = await loadCatalog(db);
    if (catalog.edition.votingOpen === false) fail(423, 'La votación está cerrada.');
    await throttle(db, request, 'vote', user.id, 120, 60000);
    if (!Object.hasOwn(voteTypes, input.type)) fail(400, 'Tipo de voto no válido.');
    let group; let performanceId; let actTime;
    if (input.type === 'aguja') {
      group = catalog.groups.find(g => 'aguja_' + g.id === input.performanceId);
      performanceId = group ? 'aguja_' + group.id : null;
      actTime = group ? catalog.sessions.flatMap(s => s.performances).find(p => p.groupId === group.id)?.actTime : null;
    } else {
      const performance = catalog.sessions.flatMap(s => s.performances).find(p => p.id === input.performanceId);
      group = performance ? catalog.groups.find(g => g.id === performance.groupId) : null;
      performanceId = performance?.id; actTime = performance?.actTime;
    }
    if (!group || !performanceId || !actTime) fail(404, 'No se ha encontrado esa actuación.');
    if (Date.now() < Date.parse(actTime)) fail(423, 'La votación todavía no se ha abierto.');
    let score; let apto = null; let details = null;
    if (input.type === 'advanced') {
      const parsed = AdvancedVotingInputSchema.safeParse({ ...input.details, groupType: group.category });
      if (!parsed.success) fail(400, 'Completa las puntuaciones de todos los apartados.');
      score = (await advancedVotingWithAutoCalculation(parsed.data)).finalScore; details = JSON.stringify(parsed.data);
    } else if (input.type === 'apto') {
      if (input.score !== 0 && input.score !== 1) fail(400, 'Selecciona Apto o No apto.');
      score = 0; apto = input.score;
    } else {
      if (!Number.isInteger(input.score) || input.score < 1 || input.score > 10) fail(400, 'La puntuación debe estar entre 1 y 10.');
      score = input.score;
    }
    try { await db.prepare('INSERT INTO votes(id,user_id,edition_id,performance_id,group_id,group_name,category,voting_type,score,apto,details,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), user.id, catalog.edition.id, performanceId, group.id, group.name, group.category, voteTypes[input.type], score, apto, details, Date.now()).run(); }
    catch (error) { if (/UNIQUE/i.test(String(error))) fail(409, 'Ya has emitido este tipo de voto para esta actuación.', 'already_voted'); throw error; }
    await recordMetrics(db, catalog, performanceId, group.id);
    return json({ ok: true, score }, 201);
  }
  if (path === '/api/favorites' && method === 'PUT') {
    const user = await requireUser(request, db); const input = await bodyOf(request); const catalog = await loadCatalog(db);
    if (!catalog.groups.some(g => g.id === input.groupId) || typeof input.favorite !== 'boolean') fail(400, 'Agrupación no válida.');
    if (input.favorite) await db.prepare('INSERT OR IGNORE INTO favorites(user_id,group_id,edition_id) VALUES(?,?,?)').bind(user.id, input.groupId, catalog.edition.id).run();
    else await db.prepare('DELETE FROM favorites WHERE user_id=? AND group_id=? AND edition_id=?').bind(user.id, input.groupId, catalog.edition.id).run();
    return json({ ok: true });
  }
  if (path === '/api/prediction' && method === 'PUT') {
    const user = await requireUser(request, db); const input = await bodyOf(request); const catalog = await loadCatalog(db); const selection = {};
    for (const category of categories) {
      const list = input.selection?.[category];
      if (!Array.isArray(list) || list.length > limits[category] || new Set(list).size !== list.length || list.some(id => !catalog.groups.some(g => g.id === id && g.category === category))) fail(400, 'Revisa las agrupaciones de tu quiniela.');
      selection[category] = list;
    }
    await db.prepare('INSERT INTO predictions(id,user_id,edition_id,selection,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,edition_id) DO UPDATE SET selection=excluded.selection,updated_at=excluded.updated_at').bind(crypto.randomUUID(), user.id, catalog.edition.id, JSON.stringify(selection), Date.now()).run();
    return json({ ok: true });
  }
  if (path === '/api/admin/overview' && method === 'GET') {
    await requireAdmin(request, db);
    const [users, votes, latest] = await db.batch([db.prepare('SELECT COUNT(*) AS count FROM users'), db.prepare('SELECT COUNT(*) AS count FROM votes'), db.prepare('SELECT name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 20')]);
    return json({ users: users.results[0].count, votes: votes.results[0].count, latestUsers: latest.results });
  }
  if (path === '/api/admin/catalog' && method === 'PUT') {
    const admin = await requireAdmin(request, db); const input = await bodyOf(request); const catalog = validateCatalog(input.catalog); const old = await loadCatalog(db);
    for (const group of catalog.groups) {
      const previous = old.groups.find(g => g.id === group.id);
      if (previous && previous.category !== group.category) {
        const count = await db.prepare('SELECT COUNT(*) AS count FROM votes WHERE edition_id=? AND group_id=?').bind(old.edition.id, group.id).first();
        if (count.count) fail(409, `No se puede cambiar la modalidad de «${group.name}» porque ya tiene votos.`);
      }
    }
    await db.batch([
      db.prepare("INSERT INTO settings(key,value,updated_at) VALUES('catalog',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(catalog), Date.now()),
      db.prepare('INSERT INTO edition_catalogs(id,name,catalog,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,catalog=excluded.catalog,updated_at=excluded.updated_at').bind(old.edition.id, old.edition.name, JSON.stringify(old), Date.now()),
      db.prepare('INSERT INTO edition_catalogs(id,name,catalog,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,catalog=excluded.catalog,updated_at=excluded.updated_at').bind(catalog.edition.id, catalog.edition.name, JSON.stringify(catalog), Date.now()),
      audit(db, admin, 'catalog.update', catalog.edition.id, old, catalog, typeof input.reason === 'string' ? input.reason.slice(0,240) : 'Actualizar catálogo desde administración'),
      event(db, catalog.edition.id, 'catalog.updated', catalog.edition.id, { edition: catalog.edition, groups: catalog.groups, sessions: catalog.sessions }),
    ]);
    invalidatePublic(db);
    return json({ ok: true, catalog });
  }
  fail(404, 'No se ha encontrado esta operación.');
}

export function createApp(assets = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        try { return await api(request, env); }
        catch (error) {
          if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status);
          const detail = /no such table:\s*[a-z_]+/i.exec(String(error?.message || error))?.[0] || 'internal_error';
          console.error('VotaCOAC API failure', url.pathname, detail);
          return json({ error: 'No se ha podido completar la operación. Vuelve a intentarlo.', code: 'server_error' }, 500);
        }
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
      let path; try { path = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
      const asset = assets[path === '/' ? '/index.html' : path] || (!path.split('/').pop()?.includes('.') ? assets['/index.html'] : null);
      if (!asset) return new Response('Not found', { status: 404 });
      const headers = { 'Content-Type': asset.type, 'Cache-Control': path.startsWith('/_next/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options': 'nosniff' };
      if (request.method === 'HEAD') return new Response(null, { headers });
      const binary = atob(asset.data); const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Response(bytes, { headers });
    },
  };
}
