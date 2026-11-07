import {invalidatePublic} from './public-cache.mjs';
import { fail, json, clean, bodyOf, idOf } from './http.mjs';
import { sha256, token } from './crypto.mjs';
import { CATEGORIES, PHASES, FORECAST_PHASES, rows, getConfig, audit, event, ensureProfile, windowState, forecastWindow, validateConfig, scoreStatements, badges, ranking, performanceMetrics, trafficLight, recordMetrics, supportSnapshot } from './competition-core.mjs';
import reviewRows from '../src/lib/catalogue-review.json' with { type: 'json' };
import legacyCatalog from '../src/lib/demo-catalog.json' with { type: 'json' };
import { topFiveOverview, handlePersonalBingo, handleBingoReviews } from './personal-games.mjs';

export async function getCompetitionState(db, catalog, user) {
  const { config, revision } = await getConfig(db, catalog.edition.id);
  const [metrics, publications] = await Promise.all([performanceMetrics(db, catalog), rows(db.prepare('SELECT phase,category,source,published_at FROM result_publications WHERE edition_id=?').bind(catalog.edition.id))]);
  const windows = {};
  for (const phase of FORECAST_PHASES) windows[phase] = publications.some(p => p.phase === phase) ? { open: false, reason: 'Resultados publicados' } : windowState(config.forecasts[phase], Date.now(), phase !== 'top5');
  let personal = { forecasts: {}, support: {}, handle: null, points: 0, hits: 0, exactHits: 0, position: null, badges: [] };
  if (user) {
    const [forecasts, support, profiles, scores] = await db.batch([
      db.prepare('SELECT phase,selection,updated_at FROM phase_forecasts WHERE user_id=? AND edition_id=?').bind(user.id, catalog.edition.id),
      db.prepare('SELECT category,group_id FROM precontest_support WHERE user_id=? AND edition_id=?').bind(user.id, catalog.edition.id),
      db.prepare('SELECT handle FROM member_profiles WHERE user_id=?').bind(user.id),
      db.prepare('SELECT COALESCE(SUM(points),0) points,COALESCE(SUM(hits),0) hits,COALESCE(SUM(exact_hits),0) exact_hits,COUNT(*) participations FROM forecast_scores WHERE user_id=? AND edition_id=?').bind(user.id, catalog.edition.id),
    ]);
    const score = scores.results[0];
    const place = score.participations ? await db.prepare("SELECT position FROM (SELECT s.user_id,ROW_NUMBER() OVER(ORDER BY SUM(s.points) DESC,SUM(s.hits) DESC,SUM(s.exact_hits) DESC,p.handle ASC) position FROM forecast_scores s JOIN member_profiles p ON p.user_id=s.user_id LEFT JOIN account_moderation m ON m.user_id=s.user_id WHERE s.edition_id=? AND COALESCE(m.status,'active')<>'suspended' GROUP BY s.user_id) WHERE user_id=?").bind(catalog.edition.id,user.id).first() : null;
    personal = { forecasts: Object.fromEntries(forecasts.results.map(f => [f.phase, { selection: JSON.parse(f.selection), updatedAt: f.updated_at }])), support: Object.fromEntries(support.results.map(s => [s.category, s.group_id])), handle: profiles.results[0]?.handle || null, points: score.points, hits: score.hits, exactHits: score.exact_hits, position: place?.position ?? null, badges: badges(score.points, score.hits, score.exact_hits, score.participations) };
  }
  const traffic = Object.fromEntries(Object.entries(metrics).map(([id, metric]) => [id, trafficLight(metric, catalog.groups.find(g => g.id === metric.groupId)?.category, config.traffic)]));
  return { config, revision, windows, traffic, metrics, publications, personal };
}
function requireModule(config, module) { if (!config.modules[module]) fail(423, 'Este módulo está desactivado por administración.'); }
async function officialList(db, editionId) { return rows(db.prepare('SELECT phase,category,group_id AS groupId,position,source,updated_at AS updatedAt FROM official_results WHERE edition_id=? ORDER BY phase,category,position,group_id').bind(editionId)); }
async function historicalCatalog(db, editionId, current) {
  if (!editionId || editionId === current.edition.id) return current;
  if (editionId === legacyCatalog.edition.id) return legacyCatalog;
  const saved = await db.prepare('SELECT catalog FROM edition_catalogs WHERE id=?').bind(editionId).first(); if (!saved) fail(404, 'Edición no disponible.'); return JSON.parse(saved.catalog);
}
async function integration(request, env, ctx, catalog) {
  const { db } = ctx; const url = new URL(request.url);
  if (request.method !== 'GET') fail(405, 'La API de integración es de solo lectura.');
  const auth = request.headers.get('authorization') || ''; if (!auth.startsWith('Bearer ') || auth.length > 200) fail(401, 'Se requiere una clave de integración.');
  await ctx.throttle(db, request, 'integration', 'shared', 180, 60000);
  const key = await db.prepare('SELECT id,last_used_at FROM integration_keys WHERE token_hash=? AND revoked_at IS NULL').bind(await sha256(auth.slice(7))).first();
  if (!key) fail(401, 'Clave de integración no válida o revocada.');
  if (!key.last_used_at || Date.now() - key.last_used_at > 300000) await db.prepare('UPDATE integration_keys SET last_used_at=? WHERE id=?').bind(Date.now(), key.id).run();
  const base = '/api/integration/v1'; const { config } = await getConfig(db, catalog.edition.id);
  if (url.pathname === base + '/manifest') return json({ version: '1.0', provider: 'VotaCOAC', mode: 'read-only', edition: catalog.edition, identifiers: 'group.id and performance.id are stable within their source edition', endpoints: { snapshot: base + '/snapshot', changes: base + '/changes' }, privacy: 'Only contest data and aggregate popularity are exported. No individual votes, accounts or emails.', fantasy: { budget: config.fantasy.budget, roster: config.fantasy.roster, prices: config.fantasy.prices } });
  if (url.pathname === base + '/snapshot') {
    const high = await db.prepare('SELECT COALESCE(MAX(id),0) cursor FROM integration_events WHERE edition_id=?').bind(catalog.edition.id).first();
    const [official, metrics] = await Promise.all([officialList(db, catalog.edition.id), performanceMetrics(db, catalog)]);
    return json({ version: '1.0', cursor: high.cursor, generatedAt: new Date().toISOString(), edition: catalog.edition, groups: catalog.groups, sessions: catalog.sessions, phases: PHASES, officialResults: official, popular: metrics, fantasy: { budget: config.fantasy.budget, roster: config.fantasy.roster, prices: config.fantasy.prices } });
  }
  if (url.pathname === base + '/changes') {
    const after = Number(url.searchParams.get('after') || 0), limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit)) fail(400, 'Cursor o límite no válido.');
    const list = await rows(db.prepare('SELECT id,type,entity_id,payload,created_at FROM integration_events WHERE edition_id=? AND id>? ORDER BY id LIMIT ?').bind(catalog.edition.id, after, limit + 1));
    const page = list.slice(0, limit); return json({ version: '1.0', editionId: catalog.edition.id, events: page.map(e => ({ id: e.id, type: e.type, entityId: e.entity_id, data: JSON.parse(e.payload), occurredAt: e.created_at })), nextCursor: page.at(-1)?.id ?? after, hasMore: list.length > limit });
  }
  fail(404, 'Endpoint de integración desconocido.');
}

export async function handleCompetition(request, env, ctx) {
  const url = new URL(request.url), path = url.pathname, method = request.method; const { db } = ctx;
  const catalog = await ctx.loadCatalog(db); const editionId = catalog.edition.id;
  if (path.startsWith('/api/integration/v1/')) return integration(request, env, ctx, catalog);
  const { config, revision } = await getConfig(db, editionId);
  const userWrite = async (scope = 'competition', maximum = 60) => { const user = await ctx.requireUser(request, db); await ctx.throttle(db, request, scope, user.id, maximum, 60000); return user; };
  if (path === '/api/competition/overview' && method === 'GET') return json(await getCompetitionState(db, catalog, await ctx.getUser(request, db)));
  if (path === '/api/competition/top-five' && method === 'GET') {
    requireModule(config, 'predictions');
    return json(await topFiveOverview(db, catalog, config, await ctx.getUser(request, db)));
  }
  if (path === '/api/competition/forecast' && method === 'PUT') {
    requireModule(config, 'predictions'); const user = await userWrite('forecast', 30); const input = await bodyOf(request); const phase = input.phase;
    if (!FORECAST_PHASES.includes(phase)) fail(400, 'Fase de pronóstico no válida.');
    const window = await forecastWindow(db, catalog, config, phase); if (!window.open) fail(423, window.reason, 'forecast_closed');
    const selection = {};
    for (const cat of CATEGORIES) { const list = input.selection?.[cat]; if (!Array.isArray(list) || list.length > config.forecasts[phase].limits[cat] || new Set(list).size !== list.length || list.some(id => !catalog.groups.some(g => g.id === id && g.category === cat))) fail(400, 'Revisa la selección y el límite por modalidad.'); selection[cat] = list; }
    if (phase === 'top5' && CATEGORIES.some(cat => selection[cat].length !== 5)) fail(400, 'Elige exactamente cinco agrupaciones de cada modalidad.');
    await ensureProfile(db, user); const now = Date.now(); const deadline = config.forecasts[phase].closesAt ? Date.parse(config.forecasts[phase].closesAt) : Number.MAX_SAFE_INTEGER;
    const gate = `NOT EXISTS(SELECT 1 FROM result_publications WHERE edition_id=? AND phase=?) AND CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)<? AND NOT EXISTS(SELECT 1 FROM module_settings WHERE edition_id=? AND revision<>?)`;
    const result = await db.prepare(`INSERT INTO phase_forecasts(id,user_id,edition_id,phase,selection,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(user_id,edition_id,phase) DO UPDATE SET selection=excluded.selection,updated_at=excluded.updated_at WHERE ${gate}`).bind(crypto.randomUUID(), user.id, editionId, phase, JSON.stringify(selection), now, now, editionId, phase, deadline, editionId, revision, editionId, phase, deadline, editionId, revision).run();
    if (!result.meta?.changes) fail(423, 'El plazo ha terminado o la configuración ha cambiado. Actualiza la página.');
    await db.batch(scoreStatements(db, editionId, config.points, user.id));
    return json({ ok: true, savedAt: now, selection });
  }
  if (path === '/api/competition/support' && method === 'PUT') {
    requireModule(config, 'support'); const user = await userWrite('support', 12); const input = await bodyOf(request); const group = catalog.groups.find(g => g.id === input.groupId);
    if (!group) fail(400, 'Agrupación no válida.'); const window = windowState(config.support); if (!window.open) fail(423, window.reason);
    const first = catalog.sessions.flatMap(s => s.performances).map(p => Date.parse(p.actTime)).filter(Number.isFinite).sort((a, b) => a - b)[0];
    if (first && Date.now() >= first) fail(423, 'El termómetro previo se cierra al comenzar el concurso.');
    const cutoff = Math.min(config.support.closesAt ? Date.parse(config.support.closesAt) : Number.MAX_SAFE_INTEGER, first || Number.MAX_SAFE_INTEGER);
    const gate = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)<? AND NOT EXISTS(SELECT 1 FROM module_settings WHERE edition_id=? AND revision<>?)";
    const saved = await db.prepare(`INSERT INTO precontest_support(user_id,edition_id,category,group_id,updated_at) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(user_id,edition_id,category) DO UPDATE SET group_id=excluded.group_id,updated_at=excluded.updated_at WHERE ${gate}`).bind(user.id, editionId, group.category, group.id, Date.now(), cutoff, editionId, revision, cutoff, editionId, revision).run();
    if (!saved.meta?.changes) fail(423, 'El termómetro se ha cerrado o ha cambiado su configuración.');
    await supportSnapshot(db, catalog, group.category); return json({ ok: true });
  }
  if (path === '/api/competition/support' && method === 'GET') {
    requireModule(config, 'support');
    const votes = await rows(db.prepare(`SELECT s.category,s.group_id groupId,COUNT(*) votes FROM precontest_support s LEFT JOIN account_moderation m ON m.user_id=s.user_id WHERE s.edition_id=? AND COALESCE(m.status,'active')<>'suspended' GROUP BY s.category,s.group_id ORDER BY votes DESC,s.group_id ASC`).bind(editionId));
    const totals = Object.fromEntries(CATEGORIES.map(cat => [cat, votes.filter(v => v.category === cat).reduce((sum, v) => sum + v.votes, 0)]));
    const participants = await db.prepare(`SELECT COUNT(DISTINCT s.user_id) count FROM precontest_support s LEFT JOIN account_moderation m ON m.user_id=s.user_id WHERE s.edition_id=? AND COALESCE(m.status,'active')<>'suspended'`).bind(editionId).first();
    const history = await rows(db.prepare('SELECT category,snapshot,created_at FROM support_history WHERE edition_id=? AND id IN(SELECT MAX(id) FROM support_history WHERE edition_id=? GROUP BY category,CAST(created_at/3600000 AS INTEGER)) ORDER BY created_at DESC LIMIT 240').bind(editionId, editionId));
    const first = catalog.sessions.flatMap(s => s.performances).map(p => Date.parse(p.actTime)).filter(Number.isFinite).sort((a, b) => a - b)[0];
    return json({ votes: votes.filter(v => catalog.groups.some(g => g.id === v.groupId)).map(v => ({ ...v, percentage: totals[v.category] ? Math.round(v.votes / totals[v.category] * 1000) / 10 : 0 })), totals, participants: participants.count, window: first && Date.now() >= first ? { open: false, reason: 'El concurso ya ha comenzado' } : windowState(config.support), history: history.reverse().map(h => ({ category: h.category, at: h.created_at, snapshot: JSON.parse(h.snapshot) })) });
  }
  if (path === '/api/competition/profile' && method === 'PUT') {
    const user = await userWrite('profile', 10); const input = await bodyOf(request); const handle = clean(input.handle, 24, 'el alias', 3).toLowerCase();
    if (handle.startsWith('aficion-')) fail(400, 'El prefijo aficion- está reservado para alias automáticos. Usa un alias distinto.');
    if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(handle)) fail(400, 'El alias admite letras sin tildes, números, guion y guion bajo.');
    try { await db.prepare('INSERT INTO member_profiles(user_id,handle,created_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle').bind(user.id, handle, Date.now()).run(); } catch (error) { if (/unique/i.test(String(error))) fail(409, 'Ese alias ya está en uso.'); throw error; }
    return json({ ok: true, handle });
  }
  if (path === '/api/competition/league' && method === 'GET') {
    requireModule(config, 'league'); const selected = await historicalCatalog(db, url.searchParams.get('edition'), catalog); const phase = url.searchParams.get('phase') || '';
    if (phase && ![...FORECAST_PHASES, ...PHASES].includes(phase)) fail(400, 'Fase no válida.');
    const offset = Number(url.searchParams.get('offset') || 0); if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) fail(400, 'Página no válida.');
    const list = await ranking(db, selected.edition.id, phase, '', offset); const editions = await rows(db.prepare('SELECT id,name FROM edition_catalogs ORDER BY updated_at DESC LIMIT 30'));
    if (!editions.some(e => e.id === catalog.edition.id)) editions.unshift({ id: catalog.edition.id, name: catalog.edition.name });
    return json({ ranking: list.slice(0,200), nextOffset: list.length > 200 ? offset + 200 : null, edition: selected.edition, editions, scoring: config.points, officialResults: await officialList(db, selected.edition.id) });
  }
  if (path === '/api/competition/history' && method === 'GET') {
    const user = await ctx.requireUser(request, db);
    const forecasts = await rows(db.prepare('SELECT f.phase,f.edition_id,s.points,s.hits,s.exact_hits,f.selection,f.updated_at FROM phase_forecasts f LEFT JOIN forecast_scores s ON s.user_id=f.user_id AND s.edition_id=f.edition_id AND s.phase=f.phase WHERE f.user_id=? ORDER BY f.updated_at DESC LIMIT 100').bind(user.id));
    const votes = await rows(db.prepare('SELECT edition_id,group_name,category,voting_type,score,apto,created_at FROM votes WHERE user_id=? ORDER BY created_at DESC LIMIT 300').bind(user.id));
    return json({ forecasts: forecasts.map(f => ({ ...f, selection: JSON.parse(f.selection) })), votes });
  }
  if (path === '/api/competition/leagues' && method === 'GET') {
    requireModule(config, 'league'); const user = await ctx.requireUser(request, db);
    const leagues = await rows(db.prepare('SELECT l.id,l.name,l.edition_id,l.owner_id,COUNT(allm.user_id) members FROM private_leagues l JOIN league_members mine ON mine.league_id=l.id AND mine.user_id=? JOIN league_members allm ON allm.league_id=l.id WHERE l.edition_id=? GROUP BY l.id ORDER BY l.created_at DESC LIMIT 50').bind(user.id, editionId));
    return json({ leagues: leagues.map(l => ({ id: l.id, name: l.name, editionId: l.edition_id, members: l.members, owner: l.owner_id === user.id })) });
  }
  if (path === '/api/competition/leagues' && method === 'POST') {
    requireModule(config, 'league'); const user = await userWrite('league-create', 5); const input = await bodyOf(request); const name = clean(input.name, 60, 'el nombre de liga', 3);
    const count = await db.prepare('SELECT COUNT(*) count FROM private_leagues WHERE owner_id=? AND edition_id=?').bind(user.id, editionId).first(); if (count.count >= 10) fail(409, 'Puedes crear hasta diez ligas por edición.');
    const id = crypto.randomUUID(), code = 'VC-' + token(12); await ensureProfile(db, user);
    await db.batch([db.prepare('INSERT INTO private_leagues(id,edition_id,name,code_hash,owner_id,created_at) VALUES(?,?,?,?,?,?)').bind(id, editionId, name, await sha256(code), user.id, Date.now()), db.prepare('INSERT INTO league_members(league_id,user_id,joined_at) VALUES(?,?,?)').bind(id, user.id, Date.now())]);
    return json({ id, name, inviteCode: code }, 201);
  }
  if (path === '/api/competition/leagues/join' && method === 'POST') {
    requireModule(config, 'league'); const user = await userWrite('league-join', 8); const input = await bodyOf(request); const code = clean(input.code, 80, 'el código de invitación');
    const league = await db.prepare('SELECT id,name FROM private_leagues WHERE code_hash=? AND edition_id=?').bind(await sha256(code), editionId).first(); if (!league) fail(404, 'Código de liga no válido.'); const memberCount = await db.prepare('SELECT COUNT(*) count FROM league_members WHERE league_id=?').bind(league.id).first(); if(memberCount.count>=200) fail(409,'Esta liga ha alcanzado los 200 participantes.'); await ensureProfile(db, user);
    await db.prepare('INSERT OR IGNORE INTO league_members(league_id,user_id,joined_at) VALUES(?,?,?)').bind(league.id, user.id, Date.now()).run(); return json({ ok: true, league });
  }
  const leagueRoute = /^\/api\/competition\/leagues\/([a-z0-9-]+)(\/invite)?$/.exec(path);
  if (leagueRoute) {
    requireModule(config, 'league'); const user = await ctx.requireUser(request, db); const league = await db.prepare('SELECT l.* FROM private_leagues l JOIN league_members m ON m.league_id=l.id AND m.user_id=? WHERE l.id=?').bind(user.id, leagueRoute[1]).first(); if (!league) fail(404, 'Liga no disponible.');
    if (method === 'GET' && !leagueRoute[2]) return json({ league: { id: league.id, name: league.name, owner: league.owner_id === user.id }, ranking: await ranking(db, league.edition_id, '', league.id), members: await rows(db.prepare('SELECT p.handle FROM league_members lm JOIN member_profiles p ON p.user_id=lm.user_id WHERE lm.league_id=? ORDER BY p.handle').bind(league.id)) });
    if (method === 'POST' && leagueRoute[2]) { if (league.owner_id !== user.id) fail(403, 'Solo el creador puede renovar la invitación.'); const code = 'VC-' + token(12); await db.prepare('UPDATE private_leagues SET code_hash=? WHERE id=?').bind(await sha256(code), league.id).run(); return json({ inviteCode: code }); }
    if (method === 'DELETE' && !leagueRoute[2]) { if (league.owner_id === user.id) await db.prepare('DELETE FROM private_leagues WHERE id=?').bind(league.id).run(); else await db.prepare('DELETE FROM league_members WHERE league_id=? AND user_id=?').bind(league.id, user.id).run(); return json({ ok: true }); }
    fail(405, 'Operación no permitida.');
  }
  if (path === '/api/competition/bingo' || path === '/api/competition/bingo/ranking') return handlePersonalBingo(request, ctx, catalog, config, revision);
  if (path === '/api/admin/bingo-cards') return handleBingoReviews(request, ctx, catalog);
  if (path === '/api/competition/insights' && method === 'GET') {
    if (!config.modules.comparison && !config.modules.evolution && !config.modules.traffic) fail(423, 'Las estadísticas están desactivadas.');
    const ids = [...new Set((url.searchParams.get('groups') || '').split(',').filter(Boolean))]; if (!ids.length || ids.length > 2 || ids.some(id => !catalog.groups.some(g => g.id === id))) fail(400, 'Selecciona una o dos agrupaciones válidas.');
    const allMetrics = await performanceMetrics(db, catalog); const official = await officialList(db, editionId); const publications = await rows(db.prepare('SELECT phase,category,source,published_at FROM result_publications WHERE edition_id=?').bind(editionId));
    const advanced = await rows(db.prepare(`SELECT v.group_id,AVG(v.score) average,COUNT(*) count FROM votes v LEFT JOIN account_moderation m ON m.user_id=v.user_id WHERE v.edition_id=? AND v.voting_type='Avanzado' AND COALESCE(m.status,'active')<>'suspended' GROUP BY v.group_id ORDER BY average DESC,v.group_id ASC`).bind(editionId));
    const output = [];
    for (const id of ids) {
      const group = catalog.groups.find(g => g.id === id); const categoryRank = advanced.filter(a => catalog.groups.find(g => g.id === a.group_id)?.category === group.category); const aggregate = advanced.find(a => a.group_id === id);
      const performances = catalog.sessions.flatMap(s => s.performances.filter(p => p.groupId === id).map(p => ({ id: p.id, actTime: p.actTime, sessionId: s.id, sessionName: s.name, phase: s.phase || 'preliminares', metrics: allMetrics[p.id] || { groupId: id, advanced: null, apto: null, aguja: null }, traffic: trafficLight(allMetrics[p.id], group.category, config.traffic) })));
      const history = await rows(db.prepare('SELECT performance_id,phase,metrics,created_at FROM metric_snapshots WHERE edition_id=? AND group_id=? AND id IN(SELECT MAX(id) FROM metric_snapshots WHERE edition_id=? AND group_id=? GROUP BY performance_id,CAST(created_at/3600000 AS INTEGER)) ORDER BY created_at DESC LIMIT 200').bind(editionId, id, editionId, id));
      const phases = PHASES.map(phase => {
        const acts = performances.filter(p => p.phase === phase); const result = official.find(r => r.groupId === id && r.phase === phase); const published = publications.some(p => p.phase === phase && p.category === group.category);
        const count = acts.reduce((sum, p) => sum + (p.metrics.advanced?.count || 0), 0); const average = count ? acts.reduce((sum, p) => sum + (p.metrics.advanced?.average || 0) * (p.metrics.advanced?.count || 0), 0) / count : null;
        return { phase, status: acts.length || result ? 'participates' : published ? 'not_participating' : 'unknown', average, count, officialPosition: result?.position ?? null, officialSource: result?.source || null };
      });
      output.push({ group, average: aggregate?.average ?? null, count: aggregate?.count || 0, position: aggregate ? categoryRank.findIndex(a => a.group_id === id) + 1 : null, performances, phases, history: history.reverse().map(h => ({ performanceId: h.performance_id, phase: h.phase, at: h.created_at, ...JSON.parse(h.metrics) })) });
    }
    const headToHead = output.length === 2 && output[0].group.category === output[1].group.category ? PHASES.flatMap(phase => { const a = output[0].phases.find(p => p.phase === phase), b = output[1].phases.find(p => p.phase === phase); return a.average !== null && b.average !== null ? [{ phase, a: a.average, b: b.average, winner: a.average === b.average ? null : a.average > b.average ? output[0].group.id : output[1].group.id }] : []; }) : [];
    return json({ groups: output, headToHead, officialResults: official.filter(r => ids.includes(r.groupId)), thresholds: config.traffic });
  }
  if (path.startsWith('/api/admin/')) {
    const admin = await ctx.requireAdmin(request, db);
    if (method !== 'GET') await ctx.throttle(db, request, 'admin-actions', admin.id, 90, 60000);
    if (path === '/api/admin/modules' && method === 'GET') return json({ config, revision, review: reviewRows.filter(row => catalog.groups.some(g => g.id === row.groupId)), officialResults: await officialList(db, editionId), publications: await rows(db.prepare('SELECT phase,category,source,published_at FROM result_publications WHERE edition_id=?').bind(editionId)), audit: await rows(db.prepare('SELECT id,action,entity,reason,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 50')), integrationKeys: await rows(db.prepare('SELECT id,label,created_at,last_used_at,revoked_at FROM integration_keys ORDER BY created_at DESC LIMIT 30')) });
    if (path === '/api/admin/modules' && method === 'PUT') {
      const input = await bodyOf(request); const next = validateConfig(input.config, catalog); const reason = clean(input.reason, 240, 'el motivo del cambio', 5); if (input.expectedRevision !== revision) fail(409, 'La configuración ha cambiado en otra sesión. Recarga antes de guardar.');
      const statements = [db.prepare('INSERT INTO module_settings(edition_id,config,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(edition_id) DO UPDATE SET config=excluded.config,revision=module_settings.revision+1,updated_at=excluded.updated_at').bind(editionId, JSON.stringify(next), Date.now()), audit(db, admin, 'modules.update', editionId, config, next, reason), event(db, editionId, 'rules.updated', editionId, { points: next.points, fantasy: { budget: next.fantasy.budget, roster: next.fantasy.roster, prices: next.fantasy.prices }, forecasts: next.forecasts })];
      if (JSON.stringify(config.points) !== JSON.stringify(next.points)) statements.push(...scoreStatements(db, editionId, next.points));
      await db.batch(statements); return json({ ok: true, revision: revision + 1, config: next });
    }
    if (path === '/api/admin/results' && method === 'PUT') {
      const input = await bodyOf(request); const phase = input.phase, category = input.category; if (![...PHASES, 'top5'].includes(phase) || !CATEGORIES.includes(category) || input.confirmed !== true) fail(400, 'Confirma la fase, modalidad y verificación de los resultados.');
      const source = clean(input.source, 500, 'la fuente de los resultados', 5), reason = clean(input.reason, 240, 'el motivo', 5); if (!Array.isArray(input.results) || input.results.length > 100) fail(400, 'Resultados no válidos.');
      const results = input.results.map(r => { if (!catalog.groups.some(g => g.id === r.groupId && g.category === category) || (r.position !== null && (!Number.isInteger(r.position) || r.position < 1 || r.position > 100))) fail(400, 'Agrupación o puesto no válido.'); return { groupId: r.groupId, position: r.position }; });
      if (new Set(results.map(r => r.groupId)).size !== results.length || new Set(results.filter(r => r.position !== null).map(r => r.position)).size !== results.filter(r => r.position !== null).length) fail(400, 'Hay agrupaciones o puestos duplicados.');
      if (phase === 'top5' && (results.length !== 5 || results.some(r => r.position == null || r.position > 5))) fail(400, 'Publica las cinco agrupaciones que más lejos llegaron, con puestos del 1 al 5.');
      const before = await rows(db.prepare('SELECT group_id,position,source FROM official_results WHERE edition_id=? AND phase=? AND category=?').bind(editionId, phase, category)); const now = Date.now();
      const statements = [db.prepare('DELETE FROM official_results WHERE edition_id=? AND phase=? AND category=?').bind(editionId, phase, category), ...results.map(r => db.prepare('INSERT INTO official_results(id,edition_id,phase,category,group_id,position,source,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), editionId, phase, category, r.groupId, r.position, source, now)), db.prepare('INSERT INTO result_publications(edition_id,phase,category,source,published_at) VALUES(?,?,?,?,?) ON CONFLICT(edition_id,phase,category) DO UPDATE SET source=excluded.source').bind(editionId, phase, category, source, now), audit(db, admin, 'results.publish', `${editionId}:${phase}:${category}`, before, {results,source,phase,category}, reason), event(db, editionId, 'results.updated', `${phase}:${category}`, { phase, category, source, results })];
      if (phase === 'final' && results.some(r => r.position === 1)) statements.push(db.prepare('INSERT INTO result_publications(edition_id,phase,category,source,published_at) VALUES(?,?,?,?,?) ON CONFLICT(edition_id,phase,category) DO UPDATE SET source=excluded.source').bind(editionId, 'ganador', category, source, now));
      statements.push(...scoreStatements(db, editionId, config.points)); await db.batch(statements); return json({ ok: true, recalculated: true });
    }
    if (path === '/api/admin/recalculate' && method === 'POST') { const input = await bodyOf(request); const reason = clean(input.reason, 240, 'el motivo', 5); await db.batch([...scoreStatements(db, editionId, config.points), audit(db, admin, 'scores.recalculate', editionId, null, { scoring: config.points }, reason)]); return json({ ok: true }); }
    if (path === '/api/admin/bingo-events' && method === 'GET') { const sessionId = url.searchParams.get('session') || ''; return json({ events: await rows(db.prepare('SELECT situation_id,occurred,updated_at FROM bingo_events WHERE edition_id=? AND session_id=?').bind(editionId, sessionId)) }); }
    if (path === '/api/admin/bingo-events' && method === 'PUT') {
      const input = await bodyOf(request); if (!catalog.sessions.some(s => s.id === input.sessionId) || !config.bingo.situations.some(s => s.id === input.situationId) || typeof input.occurred !== 'boolean') fail(400, 'Función o situación no válida.'); const reason = clean(input.reason, 240, 'el motivo', 5);
      const before = await db.prepare('SELECT occurred FROM bingo_events WHERE edition_id=? AND session_id=? AND situation_id=?').bind(editionId, input.sessionId, input.situationId).first();
      await db.batch([db.prepare('INSERT INTO bingo_events(edition_id,session_id,situation_id,occurred,confirmed_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(edition_id,session_id,situation_id) DO UPDATE SET occurred=excluded.occurred,confirmed_by=excluded.confirmed_by,updated_at=excluded.updated_at').bind(editionId, input.sessionId, input.situationId, input.occurred ? 1 : 0, admin.id, Date.now()), audit(db, admin, 'bingo.confirm', `${input.sessionId}:${input.situationId}`, before, { occurred: input.occurred }, reason)]); return json({ ok: true });
    }
    if (path === '/api/admin/moderation' && method === 'GET') {
      return json({ accounts: await rows(db.prepare(`SELECT u.id,u.name,u.email,u.role,COALESCE(m.status,'active') status,m.reason,(SELECT COUNT(*) FROM votes v WHERE v.user_id=u.id) vote_count FROM users u LEFT JOIN account_moderation m ON m.user_id=u.id ORDER BY u.created_at DESC LIMIT 200`)) });
    }
    if (path === '/api/admin/moderation' && method === 'PUT') {
      const input = await bodyOf(request); const target = await db.prepare('SELECT id,role FROM users WHERE id=?').bind(String(input.userId || '')).first(); if (!target || target.role === 'admin' || target.id === admin.id || !['active', 'suspended'].includes(input.status)) fail(400, 'Cuenta o estado no válido.'); const reason = clean(input.reason, 240, 'el motivo', 5);
      const before = await db.prepare('SELECT status,reason FROM account_moderation WHERE user_id=?').bind(target.id).first();
      await db.batch([db.prepare('INSERT INTO account_moderation(user_id,status,reason,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at').bind(target.id, input.status, reason, Date.now()), audit(db, admin, 'account.moderate', target.id, before, { status: input.status }, reason)]);
      invalidatePublic(db);
      for (const cat of CATEGORIES) await supportSnapshot(db, catalog, cat);
      const affected = await rows(db.prepare('SELECT DISTINCT performance_id,group_id FROM votes WHERE user_id=? AND edition_id=?').bind(target.id,editionId));
      for (const vote of affected) await recordMetrics(db,catalog,vote.performance_id,vote.group_id);
      return json({ ok: true });
    }
    if (path === '/api/admin/integration-keys' && method === 'POST') {
      const input = await bodyOf(request); const label = clean(input.label, 60, 'el nombre de la clave', 3); const secret = 'vcoac_' + token(32), id = crypto.randomUUID();
      await db.batch([db.prepare('INSERT INTO integration_keys(id,label,token_hash,created_by,created_at) VALUES(?,?,?,?,?)').bind(id, label, await sha256(secret), admin.id, Date.now()), audit(db, admin, 'integration.key.create', id, null, { label }, 'Crear clave de solo lectura')]); return json({ id, token: secret, shownOnce: true }, 201);
    }
    if (path === '/api/admin/integration-keys' && method === 'DELETE') { const input = await bodyOf(request); const id = clean(input.id, 80, 'la clave'); await db.batch([db.prepare('UPDATE integration_keys SET revoked_at=? WHERE id=?').bind(Date.now(), id), audit(db, admin, 'integration.key.revoke', id, null, { revoked: true }, 'Revocar clave de integración')]); return json({ ok: true }); }
    if (path === '/api/admin/audit' && method === 'GET') {
      const offset = Number(url.searchParams.get('offset') || 0); if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) fail(400, 'Página no válida.');
      const list = await rows(db.prepare('SELECT id,action,entity,before_data,after_data,reason,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 51 OFFSET ?').bind(offset)); return json({ entries: list.slice(0, 50).map(r => ({ ...r, before: r.before_data ? JSON.parse(r.before_data) : null, after: r.after_data ? JSON.parse(r.after_data) : null, before_data: undefined, after_data: undefined })), nextOffset: list.length > 50 ? offset + 50 : null });
    }
    if (path === '/api/admin/review' && method === 'GET') return json({ review: reviewRows.filter(r => catalog.groups.some(g => g.id === r.groupId)) });
  }
  fail(404, 'No se ha encontrado esta operación.');
}
