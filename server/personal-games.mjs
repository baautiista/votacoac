import { fail, json, clean, bodyOf } from './http.mjs';
import { CATEGORIES, rows, getConfig, forecastWindow, windowState, cardForClient, audit } from './competition-core.mjs';

export async function topFiveOverview(db, catalog, config, user) {
  const editionId = catalog.edition.id;
  const votes = await rows(db.prepare(`SELECT category.key category,pick.value groupId,COUNT(*) votes
    FROM phase_forecasts f,json_each(f.selection) category,json_each(category.value) pick
    LEFT JOIN account_moderation m ON m.user_id=f.user_id
    WHERE f.edition_id=? AND f.phase='top5' AND COALESCE(m.status,'active')<>'suspended'
    GROUP BY category.key,pick.value ORDER BY votes DESC,pick.value ASC`).bind(editionId));
  const participants = await db.prepare(`SELECT COUNT(*) count FROM phase_forecasts f LEFT JOIN account_moderation m ON m.user_id=f.user_id WHERE f.edition_id=? AND f.phase='top5' AND COALESCE(m.status,'active')<>'suspended'`).bind(editionId).first();
  const official = await rows(db.prepare("SELECT r.category,r.group_id groupId,r.position,r.source FROM official_results r JOIN result_publications p ON p.edition_id=r.edition_id AND p.phase=r.phase AND p.category=r.category WHERE r.edition_id=? AND r.phase='top5' ORDER BY r.category,r.position").bind(editionId));
  const saved = user ? await db.prepare("SELECT selection,updated_at FROM phase_forecasts WHERE user_id=? AND edition_id=? AND phase='top5'").bind(user.id, editionId).first() : null;
  const selection = saved ? JSON.parse(saved.selection) : null;
  const categories = Object.fromEntries(CATEGORIES.map(category => {
    const results = official.filter(r => r.category === category);
    return [category, { leaders: votes.filter(v => v.category === category && catalog.groups.some(g => g.id === v.groupId && g.category === category)).slice(0, 5).map(v => ({ ...v, percentage: participants.count ? Math.round(v.votes / participants.count * 1000) / 10 : 0 })), results, checked: results.length === 5, hits: selection && results.length === 5 ? selection[category].filter(id => results.some(r => r.groupId === id)).length : null }];
  }));
  return { participants: participants.count, window: await forecastWindow(db, catalog, config, 'top5'), categories, selection, savedAt: saved?.updated_at ?? null, pointsPerHit: config.points.top5 };
}

function requireBingo(config) { if (!config.modules.bingo) fail(423, 'El bingo está desactivado por administración.'); }
function sessionOf(catalog, id) {
  const session = catalog.sessions.find(s => s.id === id);
  if (id !== 'libre' && !session) fail(404, 'Función no disponible.');
  return session;
}
function gameWindow(config, session) {
  const window = windowState(config.bingo);
  if (!window.open) return window;
  if (session?.performances.length && Date.now() < Math.min(...session.performances.map(p => Date.parse(p.actTime)))) return { open: false, reason: 'La función todavía no ha comenzado' };
  return window;
}
function personalCells(input) {
  if (!Array.isArray(input) || input.length !== 10) fail(400, 'Escribe exactamente diez casillas para tu cartón.');
  const texts = input.map(value => clean(typeof value === 'string' ? value : value?.text, 130, 'cada casilla del bingo', 3));
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  if (new Set(texts.map(normalize)).size !== 10) fail(400, 'Cada casilla debe tener una situación diferente.');
  return texts.map(text => ({ id: crypto.randomUUID(), text }));
}
async function confirmedEvents(db, editionId, sessionId) {
  return new Set((await rows(db.prepare('SELECT situation_id FROM bingo_events WHERE edition_id=? AND session_id=? AND occurred=1').bind(editionId, sessionId))).map(e => e.situation_id));
}
const timeGate = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)<? AND NOT EXISTS(SELECT 1 FROM module_settings WHERE edition_id=? AND revision<>?)";

export async function handlePersonalBingo(request, ctx, catalog, config, revision) {
  requireBingo(config);
  const { db } = ctx, editionId = catalog.edition.id, url = new URL(request.url);
  if (url.pathname.endsWith('/ranking') && request.method === 'GET') {
    const sessionId = url.searchParams.get('session');
    if (!sessionId || sessionId === 'libre' || !config.bingo.competitive) return json({ ranking: [], practice: true });
    sessionOf(catalog, sessionId);
    const confirmed = await confirmedEvents(db, editionId, sessionId);
    const cards = await rows(db.prepare(`SELECT c.*,p.handle FROM bingo_cards c JOIN member_profiles p ON p.user_id=c.user_id LEFT JOIN account_moderation m ON m.user_id=c.user_id WHERE c.edition_id=? AND c.session_id=? AND COALESCE(m.status,'active')<>'suspended'`).bind(editionId, sessionId));
    const list = cards.map(c => { const checked = cardForClient(c, confirmed).verified; return { handle: c.handle, marks: checked.marked.length, lines: checked.lines.length, bingo: checked.bingo, points: checked.marked.length + checked.lines.length * 5 + (checked.bingo ? 50 : 0) }; }).filter(row => row.marks).sort((a, b) => b.points - a.points || a.handle.localeCompare(b.handle));
    return json({ ranking: list.slice(0, 200).map((r, i) => ({ ...r, position: i + 1 })), practice: false });
  }
  if (url.pathname !== '/api/competition/bingo') fail(404, 'Operación de bingo no disponible.');
  if (request.method === 'GET') {
    const readAt = Date.now(), sessionId = url.searchParams.get('session') || 'libre', session = sessionOf(catalog, sessionId);
    const confirmed = await confirmedEvents(db, editionId, sessionId), user = await ctx.getUser(request, db);
    const card = user ? await db.prepare('SELECT * FROM bingo_cards WHERE user_id=? AND edition_id=? AND session_id=?').bind(user.id, editionId, sessionId).first() : null;
    return json({ readAt, sessionId, practice: sessionId === 'libre', competitive: config.bingo.competitive && sessionId !== 'libre', window: gameWindow(config, session), confirmed: [...confirmed], card: card ? cardForClient(card, confirmed) : null });
  }
  const user = await ctx.requireUser(request, db);
  await ctx.throttle(db, request, 'personal-bingo', user.id, 90, 60000);
  const input = await bodyOf(request), now = Date.now(), cutoff = config.bingo.closesAt ? Date.parse(config.bingo.closesAt) : Number.MAX_SAFE_INTEGER;
  if (request.method === 'POST') {
    const sessionId = input.sessionId || 'libre'; sessionOf(catalog, sessionId);
    const window = windowState(config.bingo); if (!window.open) fail(423, window.reason);
    const existing = await db.prepare('SELECT * FROM bingo_cards WHERE user_id=? AND edition_id=? AND session_id=?').bind(user.id, editionId, sessionId).first();
    if (existing) return json({ card: cardForClient(existing, await confirmedEvents(db, editionId, sessionId)) });
    const cells = personalCells(input.cells);
    await db.prepare('INSERT OR IGNORE INTO member_profiles(user_id,handle,created_at) VALUES(?,?,?)').bind(user.id, 'aficion-' + user.id.replaceAll('-', '').slice(0, 12), now).run();
    const saved = await db.prepare(`INSERT OR IGNORE INTO bingo_cards(id,user_id,edition_id,session_id,cells,marked,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${timeGate}`).bind(crypto.randomUUID(), user.id, editionId, sessionId, JSON.stringify(cells), JSON.stringify({ claimed: [], validated: [], reviews: {} }), now, now, cutoff, editionId, revision).run();
    const card = await db.prepare('SELECT * FROM bingo_cards WHERE user_id=? AND edition_id=? AND session_id=?').bind(user.id, editionId, sessionId).first();
    if (!card) fail(423, 'El bingo se ha cerrado o ha cambiado su configuración.');
    return json({ card: cardForClient(card, new Set()) }, saved.meta?.changes ? 201 : 200);
  }
  const card = await db.prepare('SELECT * FROM bingo_cards WHERE id=? AND user_id=? AND edition_id=?').bind(String(input.cardId || ''), user.id, editionId).first();
  if (!card) fail(404, 'Cartón no disponible.');
  const session = sessionOf(catalog, card.session_id), window = windowState(config.bingo);
  if (!window.open) fail(423, window.reason);
  if (input.expectedUpdatedAt != null && input.expectedUpdatedAt !== card.updated_at) fail(409, 'El cartón ha cambiado. Recárgalo antes de continuar.');
  const current = cardForClient(card, new Set()), stored = JSON.parse(card.marked);
  let cells = card.cells, next;
  if (request.method === 'PATCH') {
    if (!current.editable) fail(423, 'El cartón queda cerrado para edición al marcar o revisar la primera casilla.');
    cells = JSON.stringify(personalCells(input.cells));
    next = { claimed: [], validated: [], reviews: {} };
  } else if (request.method === 'PUT') {
    const playWindow = gameWindow(config, session); if (!playWindow.open) fail(423, playWindow.reason);
    const marked = input.marked, size = current.cells.length;
    if (!Array.isArray(marked) || marked.length > size || new Set(marked).size !== marked.length || marked.some(i => !Number.isInteger(i) || i < 0 || i >= size)) fail(400, 'Casillas no válidas.');
    const confirmed = await confirmedEvents(db, editionId, card.session_id);
    const eligible = marked.filter(i => confirmed.has(current.cells[i].id) && (current.verified.marked.includes(i) || !current.marked.includes(i)));
    next = { ...(Array.isArray(stored) ? {} : stored), claimed: marked, validated: eligible, reviews: current.reviews, lockedAt: stored.lockedAt || (marked.length ? now : null) };
  } else fail(405, 'Método no disponible.');
  const result = await db.prepare(`UPDATE bingo_cards SET cells=?,marked=?,updated_at=? WHERE id=? AND user_id=? AND cells=? AND marked=? AND ${timeGate}`).bind(cells, JSON.stringify(next), now, card.id, user.id, card.cells, card.marked, cutoff, editionId, revision).run();
  if (!result.meta?.changes) {
    const currentRules = await getConfig(db, editionId);
    if (currentRules.revision !== revision || !windowState(currentRules.config.bingo).open) fail(423, 'El bingo se ha cerrado o ha cambiado su configuración.');
    fail(409, 'El cartón ha cambiado. Actualiza la página.');
  }
  return json({ card: cardForClient({ ...card, cells, marked: JSON.stringify(next), updated_at: now }, await confirmedEvents(db, editionId, card.session_id)) });
}

export async function handleBingoReviews(request, ctx, catalog) {
  const { db } = ctx, admin = await ctx.requireAdmin(request, db), editionId = catalog.edition.id, url = new URL(request.url);
  if (request.method === 'GET') {
    const offset = Number(url.searchParams.get('offset') || 0), sessionId = url.searchParams.get('session') || '';
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail(400, 'Página no válida.');
    if (sessionId) sessionOf(catalog, sessionId);
    const cards = await rows(db.prepare(`SELECT c.*,COALESCE(p.handle,u.name) handle FROM bingo_cards c JOIN users u ON u.id=c.user_id LEFT JOIN member_profiles p ON p.user_id=c.user_id WHERE c.edition_id=? AND (?='' OR c.session_id=?) ORDER BY c.updated_at DESC,c.id LIMIT 26 OFFSET ?`).bind(editionId, sessionId, sessionId, offset));
    return json({ cards: cards.slice(0, 25).map(c => ({ ...cardForClient(c, new Set()), handle: c.handle })), nextOffset: cards.length > 25 ? offset + 25 : null });
  }
  if (request.method !== 'PUT') fail(405, 'Método no disponible.');
  await ctx.throttle(db, request, 'bingo-review', admin.id, 90, 60000);
  const input = await bodyOf(request);
  if (!['approved', 'rejected', 'pending'].includes(input.status)) fail(400, 'Validación no válida.');
  const reason = clean(input.reason, 240, 'el motivo de la validación', 5);
  const card = await db.prepare('SELECT * FROM bingo_cards WHERE id=? AND edition_id=?').bind(String(input.cardId || ''), editionId).first();
  if (!card) fail(404, 'Cartón no disponible.');
  const cells = JSON.parse(card.cells), cell = cells.find(c => c.id === input.cellId);
  if (cells.length !== 10 || !cell || cell.text !== input.expectedText) fail(409, 'La casilla ha cambiado. Recarga antes de validarla.');
  if (input.expectedUpdatedAt !== card.updated_at) fail(409, 'El cartón ha cambiado. Recarga antes de validarlo.');
  const stored = JSON.parse(card.marked), before = stored.reviews?.[cell.id] || null, now = Date.now();
  const reviews = { ...stored.reviews };
  if (input.status === 'pending') delete reviews[cell.id]; else reviews[cell.id] = { status: input.status, reason, reviewedAt: now };
  const next = { ...stored, reviews, lockedAt: stored.lockedAt || now };
  const result = await db.prepare('UPDATE bingo_cards SET marked=?,updated_at=? WHERE id=? AND cells=? AND marked=?').bind(JSON.stringify(next), now, card.id, card.cells, card.marked).run();
  if (!result.meta?.changes) fail(409, 'El cartón ha cambiado mientras lo revisabas. Actualiza la página.');
  await audit(db, admin, 'bingo.cell.review', `${card.id}:${cell.id}`, before, { text: cell.text, status: input.status }, reason).run();
  return json({ ok: true, card: cardForClient({ ...card, marked: JSON.stringify(next), updated_at: now }, new Set()) });
}
