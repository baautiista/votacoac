import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const mime = { '.md': 'text/markdown; charset=utf-8', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const assets = {};
async function collect(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await collect(file);
    else {
      if (file.endsWith('.map')) continue;
      assets['/' + path.relative('out', file).replaceAll(path.sep, '/')] = { type: mime[path.extname(file)] || 'application/octet-stream', data: (await fs.readFile(file)).toString('base64') };
    }
  }
}
await collect('out');
await fs.rm('dist', { recursive: true, force: true });
await fs.mkdir('dist/server', { recursive: true });
await fs.mkdir('dist/.openai', { recursive: true });
await build({ stdin: { contents: `import {createApp} from './server/app.mjs'; export default createApp(${JSON.stringify(assets)});`, resolveDir: process.cwd(), sourcefile: 'worker-entry.mjs' }, outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'inline' });
await fs.copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await fs.cp('drizzle', 'dist/server/drizzle', { recursive: true });
console.log(`Built Worker with ${Object.keys(assets).length} embedded static assets.`);
