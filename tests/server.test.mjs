import {setup} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createApp } from '../server/app.mjs';
import demoCatalog from '../src/lib/demo-catalog.json' with {type:'json'};
import { advancedVotingWithAutoCalculation } from '../src/ai/flows/advanced-voting-auto-calculation.ts';

const details = { presentation: 9, pasodobles1: 8, pasodobles2: 7, cuples1: 6, cuples2: 5, estribillos1: 4, estribillos2: 3, popurri: 9, tipo: 7, impresionGeneral: 3 };

test('public catalog, immutable assets, missing API and method handling', async () => {
  const f = setup(); const health = await f.call('/api/health'); assert.equal(health.status, 200); assert.equal(health.data.storage, 'D1');
  const result = await f.call('/api/state'); assert.equal(result.status, 200); assert.equal(result.data.user, null); assert.equal(result.data.catalog.edition.name, 'COAC 2027'); assert.equal(result.data.catalog.groups.length, 8); assert.equal(result.data.catalog.edition.demo, true); assert.equal(result.data.counts.votes, 0); assert.match(result.headers.get('cache-control'), /no-store/);
  assert.equal((await f.call('/')).data, '<h1>VotaCOAC</h1>'); assert.equal((await f.call('/api/unknown')).status, 404); assert.equal((await f.call('/api/auth/register')).status, 404);
  f.DB.sqlite.close();
});
test('registration, password hashing, cookie flags, login, logout and invalid credentials', async () => {
  const f = setup(); const registered = await f.register('  Fan@Example.Test '); assert.equal(registered.status, 201); assert.equal(registered.data.user.email, 'fan@example.test'); assert.equal(registered.data.user.role, 'user'); assert.ok(registered.data.recoveryCode.length >= 32);
  const cookie = registered.headers.get('set-cookie'); for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(flag));
  const row = f.DB.sqlite.prepare('SELECT * FROM users').get(); assert.notEqual(row.password_hash, 'A-long-test-password-52'); assert.match(row.password_hash, /^pbkdf2-sha256\$100000\$/); assert.equal(row.recovery_hash.includes(registered.data.recoveryCode), false);
  assert.equal((await f.call('/api/state', 'GET', undefined, registered.cookie)).data.user.id, registered.data.user.id);
  assert.equal((await f.register('fan@example.test')).status, 409);
  assert.equal((await f.call('/api/auth/login', 'POST', { email: 'fan@example.test', password: 'wrong' })).status, 401);
  const login = await f.call('/api/auth/login', 'POST', { email: 'fan@example.test', password: 'A-long-test-password-52' }); assert.equal(login.status, 200);
  assert.equal((await f.call('/api/auth/logout', 'POST', {}, login.cookie)).status, 200); assert.equal((await f.call('/api/state', 'GET', undefined, login.cookie)).data.user, null);
  assert.equal((await f.call('/api/votes', 'POST', {})).status, 401); f.DB.sqlite.close();
});
test('cross-origin and headerless writes are rejected; invalid input never registers', async () => {
  const f = setup(); const input = { email: 'fan@example.test', name: 'Fan', password: 'A-long-test-password-52' };
  assert.equal((await f.call('/api/auth/register', 'POST', input, null, { Origin: 'https://evil.example.test' })).status, 403);
  assert.equal((await f.call('/api/auth/register', 'POST', input, null, { 'X-Requested-With': '' })).status, 403);
  assert.equal((await f.register('bad')).status, 400); assert.equal((await f.register('fan@example.test', { password: 'short' })).status, 400); assert.equal((await f.register('fan@example.test', { name: 'A' })).status, 400); assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) count FROM users').get().count, 0); f.DB.sqlite.close();
});
test('votes are authoritative, unique under concurrency, private per user and aggregated publicly', async () => {
  const f = setup(); const a = await f.register(); const b = await f.register('other@example.test');
  const vote = await f.call('/api/votes', 'POST', { performanceId: 'demo-p2', type: 'advanced', score: 9999999, details: { ...details, groupType: 'Cuarteto' } }, a.cookie);
  assert.equal(vote.status, 201); const expected = await advancedVotingWithAutoCalculation({ ...details, groupType: 'Comparsa' }); assert.equal(vote.data.score, expected.finalScore);
  assert.equal((await f.call('/api/votes', 'POST', { performanceId: 'demo-p3', type: 'advanced', details: {} }, a.cookie)).status, 400);
  const results = await Promise.all([1, 2].map(() => f.call('/api/votes', 'POST', { performanceId: 'demo-p2', type: 'apto', score: 1 }, a.cookie))); assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal((await f.call('/api/votes', 'POST', { performanceId: 'demo-p2', type: 'apto', score: 0 }, b.cookie)).status, 201);
  assert.equal((await f.call('/api/votes', 'POST', { performanceId: 'aguja_demo-brujula', type: 'aguja', score: 8 }, a.cookie)).status, 201);
  assert.equal((await f.call('/api/votes', 'POST', { performanceId: 'aguja_demo-cola', type: 'aguja', score: 8.5 }, a.cookie)).status, 400);
  assert.equal((await f.call('/api/votes', 'POST', { performanceId: 'missing-performance', type: 'apto', score: 1 }, a.cookie)).status, 404);
  const publicState = (await f.call('/api/state')).data; assert.equal(publicState.counts.votes, 4); assert.equal(publicState.counts.participants, 2); assert.equal(publicState.rankings.apto[0].averageScore, 50); assert.equal(publicState.personal.votes.length, 0); assert.equal(JSON.stringify(publicState).includes('fan@example.test'), false); assert.equal(JSON.stringify(publicState).includes('password_hash'), false);
  assert.equal((await f.call('/api/state', 'GET', undefined, a.cookie)).data.personal.votes.length, 3); assert.equal((await f.call('/api/state', 'GET', undefined, b.cookie)).data.personal.votes.length, 1); f.DB.sqlite.close();
});
test('favorites and ordered predictions persist and remain isolated', async () => {
  const f = setup(); const a = await f.register(); const b = await f.register('other@example.test');
  assert.equal((await f.call('/api/favorites', 'PUT', { groupId: 'demo-brujula', favorite: true }, a.cookie)).status, 200);
  const selection = { Coro: [], Comparsa: ['demo-papel', 'demo-brujula'], Chirigota: [], Cuarteto: [] };
  assert.equal((await f.call('/api/prediction', 'PUT', { selection }, a.cookie)).status, 200);
  const saved = (await f.call('/api/state', 'GET', undefined, a.cookie)).data.personal; assert.deepEqual(saved.favorites, ['demo-brujula']); assert.deepEqual(saved.prediction, selection);
  const other = (await f.call('/api/state', 'GET', undefined, b.cookie)).data.personal; assert.deepEqual(other.favorites, []); assert.deepEqual(other.prediction.Comparsa, []);
  assert.equal((await f.call('/api/prediction', 'PUT', { selection: { ...selection, Coro: ['demo-brujula'] } }, a.cookie)).status, 400);
  assert.equal((await f.call('/api/prediction', 'PUT', { selection: { ...selection, Comparsa: ['demo-brujula', 'demo-brujula'] } }, a.cookie)).status, 400);
  assert.equal((await f.call('/api/favorites', 'PUT', { groupId: 'missing', favorite: true }, a.cookie)).status, 400);
  assert.equal((await f.call('/api/favorites', 'PUT', { groupId: 'demo-brujula', favorite: false }, a.cookie)).status, 200); assert.deepEqual((await f.call('/api/state', 'GET', undefined, a.cookie)).data.personal.favorites, []); f.DB.sqlite.close();
});
test('administrator activation requires the platform owner; regular accounts cannot edit; voting gates enforced', async () => {
  const f = setup(); const denied = await f.register('admin@example.test'); assert.equal(denied.status, 403); assert.equal(denied.data.code, 'admin_owner_verification');
  const owner = await f.call('/api/auth/register', 'POST', { email: 'admin@example.test', name: 'Administrator', password: 'A-long-test-password-52' }, null, { 'oai-authenticated-user-email': 'owner@example.test' }); assert.equal(owner.status, 201); assert.equal(owner.data.user.role, 'admin');
  const regular = await f.register(); assert.equal((await f.call('/api/admin/overview', 'GET', undefined, regular.cookie)).status, 403);
  const catalog = (await f.call('/api/state')).data.catalog; catalog.edition.votingOpen = false;
  assert.equal((await f.call('/api/admin/catalog', 'PUT', { catalog }, regular.cookie)).status, 403); assert.equal((await f.call('/api/admin/catalog', 'PUT', { catalog }, owner.cookie)).status, 200);
  assert.equal((await f.call('/api/votes', 'POST', { performanceId: 'demo-p2', type: 'apto', score: 1 }, regular.cookie)).status, 423);
  catalog.edition.votingOpen = true; catalog.sessions[0].performances[1].actTime = '2099-01-01T12:00:00.000Z'; await f.call('/api/admin/catalog', 'PUT', { catalog }, owner.cookie);
  assert.equal((await f.call('/api/votes', 'POST', { performanceId: 'demo-p2', type: 'apto', score: 1 }, regular.cookie)).status, 423);
  const overview = await f.call('/api/admin/overview', 'GET', undefined, owner.cookie); assert.equal(overview.status, 200); assert.equal(overview.data.users, 2); f.DB.sqlite.close();
});
test('recovery and password change revoke old sessions; replacement code is required', async () => {
  const f = setup(); const registered = await f.register(); const login = await f.call('/api/auth/login', 'POST', { email: 'fan@example.test', password: 'A-long-test-password-52' });
  assert.equal((await f.call('/api/auth/recover', 'POST', { email: 'fan@example.test', code: 'wrong-code', password: 'Replacement-password-42' })).status, 401);
  const recovered = await f.call('/api/auth/recover', 'POST', { email: 'fan@example.test', code: registered.data.recoveryCode, password: 'Replacement-password-42' }); assert.equal(recovered.status, 200); assert.notEqual(recovered.data.recoveryCode, registered.data.recoveryCode);
  assert.equal((await f.call('/api/state', 'GET', undefined, registered.cookie)).data.user, null); assert.equal((await f.call('/api/state', 'GET', undefined, login.cookie)).data.user, null);
  assert.equal((await f.call('/api/auth/recover', 'POST', { email: 'fan@example.test', code: registered.data.recoveryCode, password: 'Another-password-42' })).status, 401);
  assert.equal((await f.call('/api/auth/login', 'POST', { email: 'fan@example.test', password: 'A-long-test-password-52' })).status, 401);
  const changed = await f.call('/api/account/password', 'POST', { currentPassword: 'Replacement-password-42', password: 'Another-password-42' }, recovered.cookie); assert.equal(changed.status, 200); assert.equal((await f.call('/api/state', 'GET', undefined, recovered.cookie)).data.user, null); assert.ok((await f.call('/api/state', 'GET', undefined, changed.cookie)).data.user);
  assert.equal((await f.call('/api/account', 'PATCH', { name: 'Nombre nuevo' }, changed.cookie)).status, 200); assert.equal((await f.call('/api/state', 'GET', undefined, changed.cookie)).data.user.name, 'Nombre nuevo'); f.DB.sqlite.close();
});
test('deleting an account removes its private records and contributions', async () => {
  const f = setup(); const user = await f.register(); await f.call('/api/votes', 'POST', { performanceId: 'demo-p2', type: 'apto', score: 1 }, user.cookie); await f.call('/api/favorites', 'PUT', { groupId: 'demo-brujula', favorite: true }, user.cookie);
  assert.equal((await f.call('/api/account', 'DELETE', { password: 'wrong' }, user.cookie)).status, 401);
  assert.equal((await f.call('/api/account', 'DELETE', { password: 'A-long-test-password-52' }, user.cookie)).status, 200);
  for (const table of ['users', 'auth_sessions', 'votes', 'favorites']) assert.equal(f.DB.sqlite.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count, 0);
  assert.equal((await f.call('/api/state')).data.counts.votes, 0); f.DB.sqlite.close();
});
test('repeated bad login attempts are throttled', async () => {
  const f = setup(); for (let i = 0; i < 12; i++) assert.equal((await f.call('/api/auth/login', 'POST', { email: 'missing@example.test', password: 'wrong' })).status, 401);
  assert.equal((await f.call('/api/auth/login', 'POST', { email: 'missing@example.test', password: 'wrong' })).status, 429); f.DB.sqlite.close();
});
