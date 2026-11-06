import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { createApp } from '../server/app.mjs';
import demoCatalog from '../src/lib/demo-catalog.json' with {type:'json'};
export function makeD1() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
  return { sqlite, prepare(sql) { const statement = sqlite.prepare(sql); let values = []; const prepared = { bind(...args) { values = args; return prepared; }, async first() { return statement.get(...values) || null; }, async all() { return { success: true, results: statement.all(...values) }; }, async run() { const result = statement.run(...values); return { success: true, results: [], meta: { changes: Number(result.changes) } }; }, execute() { if (/^\s*(SELECT|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql)) return { success: true, results: statement.all(...values) }; const result = statement.run(...values); return { success: true, results: [], meta: { changes: Number(result.changes) } }; } }; return prepared; }, async batch(statements) { sqlite.exec('BEGIN'); try { const results = statements.map(s => s.execute()); sqlite.exec('COMMIT'); return results; } catch (err) { sqlite.exec('ROLLBACK'); throw err; } } };
}
export function setup(catalog = demoCatalog) {
  const DB = makeD1(); DB.sqlite.prepare("INSERT INTO settings(key,value,updated_at) VALUES('catalog',?,?)").run(JSON.stringify(catalog),Date.now()); const env = { DB, ADMIN_EMAIL: 'admin@example.test', BOOTSTRAP_OWNER_EMAIL: 'owner@example.test' }; const app = createApp({ '/index.html': { type: 'text/html', data: btoa('<h1>VotaCOAC</h1>') } });
  const call = async (path, method = 'GET', body, cookie, headers = {}) => {
    const request = new Request(`https://vota.example.test${path}`, { method, headers: { ...(method !== 'GET' ? { Origin: 'https://vota.example.test', 'Content-Type': 'application/json', 'X-Requested-With': 'VotaCOAC' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const response = await app.fetch(request, env); const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const register = (email = 'fan@example.test', extra = {}) => call('/api/auth/register', 'POST', { email, name: 'Afición de prueba', password: 'A-long-test-password-52', ...extra });
  return { DB, env, app, call, register };
}
