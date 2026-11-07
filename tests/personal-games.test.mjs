import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.mjs';
import catalog from '../src/lib/catalogue-2027.json' with { type: 'json' };
import { CATEGORIES, bingoLines } from '../server/competition-core.mjs';

const picks = () => Object.fromEntries(CATEGORIES.map(category => [category, catalog.groups.filter(g => g.category === category).slice(0, 5).map(g => g.id)]));
const cells = () => ['Cuplé a Andy y Lucas', ...Array.from({ length: 9 }, (_, i) => `Situación personal del Carnaval ${i + 2}`)];
const administrator = f => f.call('/api/auth/register', 'POST', { email: 'admin@example.test', name: 'Administrador', password: 'A-long-test-password-52' }, null, { 'oai-authenticated-user-email': 'owner@example.test' });
async function configure(f, cookie, change) {
  const { data } = await f.call('/api/admin/modules', 'GET', undefined, cookie);
  change(data.config);
  const result = await f.call('/api/admin/modules', 'PUT', { config: data.config, expectedRevision: data.revision, reason: 'Cambio de configuración para la prueba' }, cookie);
  assert.equal(result.status, 200, JSON.stringify(result.data));
}

test('one public quiniela saves exactly five per category, aggregates choices and protects personal results', async () => {
  const f = setup(catalog), a = await f.register(), b = await f.register('second@example.test'), selection = picks();
  assert.equal((await f.call('/api/competition/forecast', 'PUT', { phase: 'top5', selection })).status, 401);
  for (const invalid of [{ ...selection, Coro: [] }, { ...selection, Coro: [...selection.Coro.slice(0, 4), selection.Coro[0]] }, { ...selection, Coro: selection.Comparsa }]) {
    assert.equal((await f.call('/api/competition/forecast', 'PUT', { phase: 'top5', selection: invalid }, a.cookie)).status, 400);
  }
  for (const user of [a, b]) assert.equal((await f.call('/api/competition/forecast', 'PUT', { phase: 'top5', selection, points: 9000 }, user.cookie)).status, 200);
  const overview = await f.call('/api/competition/top-five');
  assert.equal(overview.status, 200); assert.equal(overview.data.participants, 2); assert.equal(overview.data.selection, null);
  for (const category of CATEGORIES) { assert.equal(overview.data.categories[category].leaders.length, 5); assert.equal(overview.data.categories[category].leaders[0].votes, 2); assert.equal(overview.data.categories[category].leaders[0].percentage, 100); assert.equal(overview.data.categories[category].hits, null); }
  assert(!JSON.stringify(overview.data).includes('second@example.test'));
  const personal = (await f.call('/api/competition/top-five', 'GET', undefined, a.cookie)).data;
  assert.deepEqual(personal.selection, selection);
  assert.equal((await f.call('/api/state', 'GET', undefined, a.cookie)).data.competition.personal.points, 0);
  const admin = await administrator(f);
  await configure(f, admin.cookie, config => { config.modules.predictions = false; });
  assert.equal((await f.call('/api/competition/top-five')).status, 423);
  assert.equal((await f.call('/api/competition/forecast', 'PUT', { phase: 'top5', selection }, a.cookie)).status, 423);
  f.DB.sqlite.close();
});

test('definitive five close predictions, score only verified hits and recalculate after corrections', async () => {
  const f = setup(catalog), owner = await administrator(f), a = await f.register(), selection = picks();
  await f.call('/api/competition/forecast', 'PUT', { phase: 'top5', selection }, a.cookie);
  const body = { phase: 'top5', category: 'Comparsa', source: 'Clasificación definitiva verificada por la organización', reason: 'Publicación del resultado final comprobado', confirmed: true, results: selection.Comparsa.map((groupId, i) => ({ groupId, position: i + 1 })) };
  assert.equal((await f.call('/api/admin/results', 'PUT', body, a.cookie)).status, 403);
  assert.equal((await f.call('/api/admin/results', 'PUT', { ...body, results: body.results.slice(0, 4) }, owner.cookie)).status, 400);
  assert.equal((await f.call('/api/admin/results', 'PUT', body, owner.cookie)).status, 200);
  assert.equal((await f.call('/api/competition/forecast', 'PUT', { phase: 'top5', selection }, a.cookie)).status, 423);
  let overview = (await f.call('/api/competition/top-five', 'GET', undefined, a.cookie)).data;
  assert.equal(overview.categories.Comparsa.hits, 5); assert.equal(overview.categories.Coro.checked, false);
  assert.equal((await f.call('/api/state', 'GET', undefined, a.cookie)).data.competition.personal.points, 5);
  const replacement = catalog.groups.filter(g => g.category === 'Comparsa')[5].id;
  body.results[4] = { groupId: replacement, position: 5 };
  assert.equal((await f.call('/api/admin/results', 'PUT', body, owner.cookie)).status, 200);
  overview = (await f.call('/api/competition/top-five', 'GET', undefined, a.cookie)).data;
  assert.equal(overview.categories.Comparsa.hits, 4);
  assert.equal((await f.call('/api/state', 'GET', undefined, a.cookie)).data.competition.personal.points, 4);
  assert.equal((await f.call('/api/competition/top-five')).data.categories.Comparsa.hits, null);
  f.DB.sqlite.close();
});

test('closing the unified quiniela races safely with an already pending save', async () => {
  const f = setup(catalog), owner = await administrator(f), a = await f.register();
  const prepare = f.DB.prepare.bind(f.DB); let release, reached;
  const blocked = new Promise(resolve => { reached = resolve; }), gate = new Promise(resolve => { release = resolve; });
  f.DB.prepare = sql => { const statement = prepare(sql); if (sql.startsWith('INSERT INTO phase_forecasts')) { const run = statement.run.bind(statement); statement.run = async () => { reached(); await gate; return run(); }; } return statement; };
  const pending = f.call('/api/competition/forecast', 'PUT', { phase: 'top5', selection: picks() }, a.cookie);
  await blocked; await configure(f, owner.cookie, config => { config.forecasts.top5.enabled = false; }); release();
  assert.equal((await pending).status, 423); assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) count FROM phase_forecasts').get().count, 0);
  f.DB.sqlite.close();
});

test('personal bingo has ten unique editable texts, persists and prevents ownership or validation forgery', async () => {
  const f = setup(), a = await f.register(), b = await f.register('second@example.test');
  assert.equal((await f.call('/api/competition/bingo', 'POST', { sessionId: 'libre', cells: cells().slice(0, 9) }, a.cookie)).status, 400);
  assert.equal((await f.call('/api/competition/bingo', 'POST', { sessionId: 'libre', cells: Array(10).fill('La misma situación') }, a.cookie)).status, 400);
  const created = await f.call('/api/competition/bingo', 'POST', { sessionId: 'libre', cells: cells() }, a.cookie);
  assert.equal(created.status, 201); const card = created.data.card;
  assert.equal(card.cells.length, 10); assert.equal(card.cells[0].text, 'Cuplé a Andy y Lucas'); assert.equal(card.editable, true);
  assert.equal((await f.call('/api/competition/bingo', 'POST', { sessionId: 'libre', cells: cells() }, a.cookie)).data.card.id, card.id);
  assert.equal((await f.call('/api/competition/bingo', 'PUT', { cardId: card.id, marked: [0] }, b.cookie)).status, 404);
  assert.equal((await f.call('/api/competition/bingo', 'PATCH', { cardId: card.id, cells: cells() }, b.cookie)).status, 404);
  const edited = await f.call('/api/competition/bingo', 'PATCH', { cardId: card.id, cells: cells().map(t => t + ' editada'), expectedUpdatedAt: card.updatedAt }, a.cookie);
  assert.equal(edited.status, 200); assert.notEqual(edited.data.card.cells[0].id, card.cells[0].id);
  const marked = await f.call('/api/competition/bingo', 'PUT', { cardId: card.id, marked: [0], reviews: { [edited.data.card.cells[0].id]: { status: 'approved' } }, points: 999 }, a.cookie);
  assert.equal(marked.status, 200); assert.equal(marked.data.card.verified.marked.length, 0); assert.equal(marked.data.card.editable, false);
  await f.call('/api/competition/bingo', 'PUT', { cardId: card.id, marked: [] }, a.cookie);
  assert.equal((await f.call('/api/competition/bingo', 'PATCH', { cardId: card.id, cells: cells() }, a.cookie)).status, 423);
  assert.equal((await f.call('/api/competition/bingo', 'PUT', { cardId: card.id, marked: [10] }, a.cookie)).status, 400);
  assert.equal((await f.call('/api/admin/bingo-cards', 'GET', undefined, a.cookie)).status, 403);
  f.DB.sqlite.close();
});

test('administrator validates each custom cell and corrections immediately change bingo points', async () => {
  const f = setup(), owner = await administrator(f), a = await f.register();
  let card = (await f.call('/api/competition/bingo', 'POST', { sessionId: 'demo-sesion-1', cells: cells() }, a.cookie)).data.card;
  card = (await f.call('/api/competition/bingo', 'PUT', { cardId: card.id, marked: Array.from({ length: 10 }, (_, i) => i) }, a.cookie)).data.card;
  assert.equal(card.verified.bingo, false);
  const review = async (index, status) => {
    const result = await f.call('/api/admin/bingo-cards', 'PUT', { cardId: card.id, cellId: card.cells[index].id, expectedText: card.cells[index].text, expectedUpdatedAt: card.updatedAt, status, reason: 'Situación comprobada durante la actuación' }, owner.cookie);
    assert.equal(result.status, 200, JSON.stringify(result.data)); card = result.data.card;
  };
  const forged = await f.call('/api/admin/bingo-cards', 'PUT', { cardId: card.id, cellId: card.cells[0].id, expectedText: 'Un texto diferente', expectedUpdatedAt: card.updatedAt, status: 'approved', reason: 'Revisión de un texto que ya cambió' }, owner.cookie);
  assert.equal(forged.status, 409);
  for (let i = 0; i < 10; i++) await review(i, 'approved');
  assert.equal(card.verified.bingo, true); assert.equal(card.verified.lines.length, 2);
  let ranking = (await f.call('/api/competition/bingo/ranking?session=demo-sesion-1')).data.ranking;
  assert.equal(ranking[0].points, 70);
  await review(0, 'rejected'); ranking = (await f.call('/api/competition/bingo/ranking?session=demo-sesion-1')).data.ranking;
  assert.equal(ranking[0].points, 14); assert.equal(ranking[0].bingo, false);
  await review(1, 'pending'); assert.equal(card.reviews[card.cells[1].id], undefined);
  const queue = (await f.call('/api/admin/bingo-cards?session=demo-sesion-1', 'GET', undefined, owner.cookie)).data;
  assert.equal(queue.cards[0].cells.length, 10); assert(!JSON.stringify(queue).includes('fan@example.test'));
  assert.equal((await f.call('/api/admin/audit', 'GET', undefined, owner.cookie)).data.entries.filter(e => e.action === 'bingo.cell.review').length, 12);
  assert.equal(bingoLines(Array.from({ length: 10 }, (_, i) => i), 10).bingo, true);
  f.DB.sqlite.close();
});

test('a mark racing with an administrator review cannot overwrite the review', async () => {
  const f = setup(), owner = await administrator(f), a = await f.register();
  const card = (await f.call('/api/competition/bingo', 'POST', { sessionId: 'libre', cells: cells() }, a.cookie)).data.card;
  const prepare = f.DB.prepare.bind(f.DB); let release, reached;
  const blocked = new Promise(resolve => { reached = resolve; }), gate = new Promise(resolve => { release = resolve; });
  f.DB.prepare = sql => { const statement = prepare(sql); if (sql.startsWith('UPDATE bingo_cards SET cells=')) { const run = statement.run.bind(statement); statement.run = async () => { reached(); await gate; return run(); }; } return statement; };
  const pending = f.call('/api/competition/bingo', 'PUT', { cardId: card.id, marked: [0] }, a.cookie);
  await blocked;
  const reviewed = await f.call('/api/admin/bingo-cards', 'PUT', { cardId: card.id, cellId: card.cells[0].id, expectedText: card.cells[0].text, expectedUpdatedAt: card.updatedAt, status: 'approved', reason: 'Situación verificada por administración' }, owner.cookie);
  assert.equal(reviewed.status, 200); release(); assert.equal((await pending).status, 409);
  const current = (await f.call('/api/competition/bingo?session=libre', 'GET', undefined, a.cookie)).data.card;
  assert.equal(current.reviews[card.cells[0].id].status, 'approved'); assert.equal(current.marked.length, 0);
  assert.equal(current.editable, false); f.DB.sqlite.close();
});
