import { publicCached, invalidatePublic } from './public-cache.mjs';
import defaults from '../src/lib/competition-defaults.json' with { type: 'json' };
import { fail, clean, idOf } from './http.mjs';
export const CATEGORIES = ['Coro', 'Comparsa', 'Chirigota', 'Cuarteto'];
export const PHASES = ['preliminares', 'cuartos', 'semifinales', 'final'];
export const STAGES = ['antes', 'durante'];
export const FORECAST_PHASES = ['semifinales', 'final', 'ganador'];
export const rows = async statement => (await statement.all()).results;
export async function getConfig(db, editionId) {
  const saved = await db.prepare('SELECT config,revision FROM module_settings WHERE edition_id=?').bind(editionId).first();
  return { config: saved ? JSON.parse(saved.config) : structuredClone(defaults), revision: saved?.revision || 0 };
}
export function audit(db, actor, action, entity, before, after, reason) {
  return db.prepare('INSERT INTO admin_audit(id,actor_id,action,entity,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, action, entity, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), reason, Date.now());
}
export function event(db, editionId, type, entityId, payload) {
  return db.prepare('INSERT INTO integration_events(edition_id,type,entity_id,payload,created_at) VALUES(?,?,?,?,?)').bind(editionId, type, entityId, JSON.stringify(payload), Date.now());
}
export async function ensureProfile(db, user) {
  const handle = 'aficion-' + user.id.replaceAll('-', '').slice(0, 12);
  await db.prepare('INSERT OR IGNORE INTO member_profiles(user_id,handle,created_at) VALUES(?,?,?)').bind(user.id, handle, Date.now()).run();
  return db.prepare('SELECT handle FROM member_profiles WHERE user_id=?').bind(user.id).first();
}
export function windowState(window, now = Date.now(), requireClose = false) {
  if (window.open === false || window.enabled === false) return { open: false, reason: 'Cerrado por administración' };
  if (requireClose && !window.closesAt) return { open: false, reason: 'Pendiente de configurar la fecha de cierre' };
  if (window.opensAt && now < Date.parse(window.opensAt)) return { open: false, reason: 'La participación todavía no se ha abierto' };
  if (window.closesAt && now >= Date.parse(window.closesAt)) return { open: false, reason: 'El plazo ha terminado' };
  return { open: true, reason: '' };
}
export async function forecastWindow(db, catalog, config, phase) {
  const win = windowState(config.forecasts[phase], Date.now(), true);
  const resultPhase = phase === 'ganador' ? 'ganador' : phase;
  const published = await db.prepare('SELECT phase FROM result_publications WHERE edition_id=? AND phase=? LIMIT 1').bind(catalog.edition.id, resultPhase).first();
  if (published) return { open: false, reason: 'Los resultados de esta fase ya se han publicado' };
  return win;
}
export function validateConfig(input, catalog) {
  if (!input || typeof input !== 'object') fail(400, 'Configuración no válida.');
  const config = structuredClone(defaults);
  const boolean = (v, label) => { if (typeof v !== 'boolean') fail(400, `Revisa ${label}.`); return v; };
  const number = (v, min, max, label) => { if (!Number.isFinite(v) || v < min || v > max) fail(400, `Revisa ${label}.`); return v; };
  const date = value => { if (value == null || value === '') return null; if (!Number.isFinite(Date.parse(value))) fail(400, 'Fecha no válida.'); return new Date(value).toISOString(); };
  const dates = value => { const opensAt = date(value?.opensAt), closesAt = date(value?.closesAt); if (opensAt && closesAt && Date.parse(opensAt) >= Date.parse(closesAt)) fail(400, 'El cierre debe ser posterior a la apertura.'); return { opensAt, closesAt }; };
  if (input.stage != null && !STAGES.includes(input.stage)) fail(400, 'Etapa del concurso no válida.');
  config.stage = input.stage ?? defaults.stage;
  for (const key of Object.keys(config.modules)) config.modules[key] = boolean(input.modules?.[key], 'los módulos');
  for (const phase of FORECAST_PHASES) {
    const window = input.forecasts?.[phase]; const limits = {};
    for (const cat of CATEGORIES) limits[cat] = number(window?.limits?.[cat], 1, phase === 'ganador' ? 1 : 100, 'los límites de selección');
    config.forecasts[phase] = { enabled: boolean(window?.enabled, 'el estado del pronóstico'), ...dates(window), limits };
  }
  for (const key of Object.keys(config.points)) config.points[key] = Math.round(number(input.points?.[key], 0, 10000, 'los puntos por acierto'));
  config.support = { open: boolean(input.support?.open, 'el termómetro'), ...dates(input.support) };
  config.traffic = { minVotes: Math.round(number(input.traffic?.minVotes, 2, 10000, 'el mínimo de votos')), excellent: number(input.traffic?.excellent, 1, 100, 'el umbral excelente'), good: number(input.traffic?.good, 1, 100, 'el umbral bueno'), regular: number(input.traffic?.regular, 0, 100, 'el umbral regular') };
  if (config.traffic.excellent <= config.traffic.good || config.traffic.good <= config.traffic.regular) fail(400, 'Los umbrales deben ir de mayor a menor.');
  const situations = input.bingo?.situations;
  if (!Array.isArray(situations) || situations.length < 25 || situations.length > 200) fail(400, 'El bingo necesita entre 25 y 200 situaciones.');
  const checked = situations.map(s => ({ id: idOf(s.id), text: clean(s.text, 130, 'la situación del bingo', 3) }));
  if (new Set(checked.map(s => s.id)).size !== checked.length) fail(400, 'Hay situaciones del bingo duplicadas.');
  config.bingo = { open: boolean(input.bingo?.open, 'el bingo'), ...dates(input.bingo), competitive: boolean(input.bingo?.competitive, 'la validación competitiva'), situations: checked };
  let publicUrl = String(input.fantasy?.publicUrl || '').trim();
  if (publicUrl) { let parsed; try { parsed = new URL(publicUrl); } catch { fail(400, 'URL de Fantasy no válida.'); } if (parsed.protocol !== 'https:' || parsed.username || parsed.password || publicUrl.length > 500) fail(400, 'Usa una URL pública HTTPS.'); }
  config.fantasy = { enabled: boolean(input.fantasy?.enabled, 'el acceso a Fantasy'), publicUrl, budget: number(input.fantasy?.budget, 1, 10000, 'el presupuesto Fantasy'), roster: {}, prices: {} };
  if (config.fantasy.enabled && !publicUrl) fail(400, 'Añade la URL pública de Fantasy antes de activar su acceso.');
  for (const cat of CATEGORIES) config.fantasy.roster[cat] = Math.round(number(input.fantasy?.roster?.[cat], 0, 20, 'la plantilla Fantasy'));
  for (const [id, value] of Object.entries(input.fantasy?.prices || {})) { if (!catalog.groups.some(g => g.id === id)) fail(400, 'Precio de una agrupación desconocida.'); config.fantasy.prices[id] = number(value, 0, 1000, 'el precio Fantasy'); }
  return config;
}
export function scoreStatements(db, editionId, points, userId = '') {
  return [
    db.prepare("DELETE FROM forecast_scores WHERE edition_id=? AND (?='' OR user_id=?)").bind(editionId, userId, userId),
    db.prepare(`INSERT INTO forecast_scores(user_id,edition_id,phase,points,hits,exact_hits,updated_at)
      WITH picks AS (
        SELECT f.user_id,f.edition_id,f.phase,category.key category,pick.value group_id,CAST(pick.key AS INTEGER)+1 predicted_position
        FROM phase_forecasts f,json_each(f.selection) category,json_each(category.value) pick WHERE f.edition_id=?
      ), matched AS (
        SELECT p.*,r.group_id matched_id,r.position actual_position FROM picks p LEFT JOIN official_results r ON r.edition_id=p.edition_id AND r.category=p.category AND r.group_id=p.group_id AND r.phase=CASE WHEN p.phase='ganador' THEN 'final' ELSE p.phase END
      )
      SELECT f.user_id,f.edition_id,f.phase,
        COALESCE(SUM(CASE WHEN m.matched_id IS NOT NULL THEN CASE WHEN f.phase='semifinales' THEN ? WHEN f.phase='final' THEN ?+CASE WHEN m.actual_position=m.predicted_position THEN ? ELSE 0 END WHEN f.phase='ganador' AND m.actual_position=1 THEN ? ELSE 0 END ELSE 0 END),0),
        COALESCE(SUM(CASE WHEN m.matched_id IS NOT NULL AND (f.phase<>'ganador' OR m.actual_position=1) THEN 1 ELSE 0 END),0),
        COALESCE(SUM(CASE WHEN f.phase='final' AND m.matched_id IS NOT NULL AND m.actual_position=m.predicted_position THEN 1 ELSE 0 END),0),?
      FROM phase_forecasts f LEFT JOIN matched m ON m.user_id=f.user_id AND m.edition_id=f.edition_id AND m.phase=f.phase
      WHERE f.edition_id=? AND (?='' OR f.user_id=?) GROUP BY f.user_id,f.edition_id,f.phase`).bind(editionId, points.semifinales, points.final, points.exactPosition, points.ganador, Date.now(), editionId, userId, userId),
  ];
}
export function badges(points, hits, exactHits, participations) {
  const result = []; if (participations) result.push({ id: 'primer-pronostico', name: 'Primer pronóstico' }); if (hits) result.push({ id: 'buen-oido', name: 'Buen oído' }); if (exactHits) result.push({ id: 'al-puesto', name: 'Al puesto exacto' }); if (points >= 300) result.push({ id: 'jurado-popular', name: 'Jurado popular' }); return result;
}
export async function ranking(db, editionId, phase = '', leagueId = '', offset = 0) {
  const conditions = ['s.edition_id=?', "COALESCE(m.status,'active')<>'suspended'"]; const values = [editionId];
  if (phase) { conditions.push('s.phase=?'); values.push(phase); }
  if (leagueId) { conditions.push('EXISTS(SELECT 1 FROM league_members lm WHERE lm.league_id=? AND lm.user_id=s.user_id)'); values.push(leagueId); }
  const list = await rows(db.prepare(`SELECT s.user_id,p.handle,SUM(s.points) points,SUM(s.hits) hits,SUM(s.exact_hits) exact_hits,COUNT(*) participations FROM forecast_scores s JOIN member_profiles p ON p.user_id=s.user_id LEFT JOIN account_moderation m ON m.user_id=s.user_id WHERE ${conditions.join(' AND ')} GROUP BY s.user_id ORDER BY points DESC,hits DESC,exact_hits DESC,p.handle ASC LIMIT 201 OFFSET ?`).bind(...values, offset));
  return list.map((row, i) => ({ position: offset + i + 1, userId: row.user_id, handle: row.handle, points: row.points, hits: row.hits, exactHits: row.exact_hits, participations: row.participations, badges: badges(row.points, row.hits, row.exact_hits, row.participations) }));
}
export async function performanceMetrics(db, catalog, performanceId = '') {
  const read = async () => {
  const data = await rows(db.prepare(`SELECT v.performance_id,v.group_id,v.voting_type,AVG(CASE WHEN v.voting_type='Apto/No Apto' THEN v.apto*100 ELSE v.score END) average_score,COUNT(*) vote_count FROM votes v LEFT JOIN account_moderation m ON m.user_id=v.user_id WHERE v.edition_id=? AND COALESCE(m.status,'active')<>'suspended' ${performanceId ? 'AND v.performance_id=?' : ''} GROUP BY v.performance_id,v.voting_type`).bind(...(performanceId ? [catalog.edition.id,performanceId] : [catalog.edition.id])));
  const metrics = {};
  for (const row of data) { const name = row.voting_type === 'Avanzado' ? 'advanced' : row.voting_type === 'Apto/No Apto' ? 'apto' : 'aguja'; const group = catalog.groups.find(g => g.id === row.group_id); if (!group) continue; metrics[row.performance_id] ||= { groupId: row.group_id, advanced: null, apto: null, aguja: null }; metrics[row.performance_id][name] = { average: row.average_score, count: row.vote_count }; }
  return metrics; };
  return performanceId ? read() : publicCached(db,'metrics:'+catalog.edition.id,read);
}
export function trafficLight(metric, category, thresholds) {
  const source = (metric?.advanced?.count || 0) >= thresholds.minVotes ? 'advanced' : (metric?.apto?.count || 0) >= thresholds.minVotes ? 'apto' : null;
  const count = source ? metric[source].count : Math.max(metric?.advanced?.count || 0, metric?.apto?.count || 0);
  if (!source) return { level: 'insufficient', label: 'Muestra insuficiente', count, minimum: thresholds.minVotes, value: null };
  const value = source === 'apto' ? metric.apto.average : metric.advanced.average / (category === 'Cuarteto' ? 224 : 288) * 100;
  const level = value >= thresholds.excellent ? 'excellent' : value >= thresholds.good ? 'good' : value >= thresholds.regular ? 'regular' : 'bad';
  return { level, label: { excellent: 'Excelente', good: 'Buena', regular: 'Regular', bad: 'Mala' }[level], value: Math.round(value * 10) / 10, count, minimum: thresholds.minVotes, source };
}
export async function recordMetrics(db, catalog, performanceId, groupId) {
  invalidatePublic(db);
  const metrics = await performanceMetrics(db, catalog, performanceId); const metric = metrics[performanceId] || {groupId,advanced:null,apto:null,aguja:null};
  const phase = catalog.sessions.find(s => s.performances.some(p => p.id === performanceId))?.phase || 'preliminares';
  const group = catalog.groups.find(g => g.id === groupId); const groupAverages = await rows(db.prepare(`SELECT v.group_id,AVG(v.score) score FROM votes v LEFT JOIN account_moderation m ON m.user_id=v.user_id WHERE v.edition_id=? AND v.category=? AND v.voting_type='Avanzado' AND COALESCE(m.status,'active')<>'suspended' GROUP BY v.group_id ORDER BY score DESC,v.group_id ASC`).bind(catalog.edition.id, group?.category || ''));
  const position = groupAverages.filter(row => catalog.groups.some(g => g.id === row.group_id)).findIndex(row => row.group_id === groupId) + 1;
  const snapshot = { ...metric, position: position || null };
  await db.batch([db.prepare('INSERT INTO metric_snapshots(edition_id,performance_id,group_id,phase,metrics,created_at) VALUES(?,?,?,?,?,?)').bind(catalog.edition.id, performanceId, groupId, phase, JSON.stringify(snapshot), Date.now()), event(db, catalog.edition.id, 'popular.updated', groupId, { performanceId, phase, ...snapshot })]);
}
export async function supportSnapshot(db, catalog, category) {
  const values = await rows(db.prepare(`SELECT s.group_id groupId,COUNT(*) votes FROM precontest_support s LEFT JOIN account_moderation m ON m.user_id=s.user_id WHERE s.edition_id=? AND s.category=? AND COALESCE(m.status,'active')<>'suspended' GROUP BY s.group_id ORDER BY votes DESC,s.group_id ASC`).bind(catalog.edition.id, category));
  await db.batch([db.prepare('INSERT INTO support_history(edition_id,category,snapshot,created_at) VALUES(?,?,?,?)').bind(catalog.edition.id, category, JSON.stringify(values), Date.now()),event(db,catalog.edition.id,'support.updated',category,{category,votes:values})]);
}
export function bingoLines(marked) {
  const set = new Set(marked); const lines = [];
  for (let i = 0; i < 5; i++) { if (Array.from({ length: 5 }, (_, j) => i * 5 + j).every(v => set.has(v))) lines.push('fila-' + (i + 1)); if (Array.from({ length: 5 }, (_, j) => j * 5 + i).every(v => set.has(v))) lines.push('columna-' + (i + 1)); }
  if ([0, 6, 12, 18, 24].every(v => set.has(v))) lines.push('diagonal-1'); if ([4, 8, 12, 16, 20].every(v => set.has(v))) lines.push('diagonal-2');
  return { lines, bingo: set.size === 25 };
}
export function randomCells(situations) {
  const copy = [...situations];
  for (let i = copy.length - 1; i > 0; i--) { const range = i + 1; const maximum = Math.floor(4294967296 / range) * range; let number; do { number = crypto.getRandomValues(new Uint32Array(1))[0]; } while (number >= maximum); const j = number % range; [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, 25);
}
export function cardForClient(card, confirmedIds) {
  const cells = JSON.parse(card.cells), stored = JSON.parse(card.marked); const marked = Array.isArray(stored) ? stored : stored.claimed; const validated = Array.isArray(stored) ? [] : stored.validated; const valid = marked.filter(index => validated.includes(index) && confirmedIds.has(cells[index]?.id));
  return { id: card.id, sessionId: card.session_id, cells, marked, ...bingoLines(marked), verified: { marked: valid, ...bingoLines(valid) }, updatedAt: card.updated_at };
}
