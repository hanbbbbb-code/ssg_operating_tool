import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Snapshot the existing app. Never recurse over the workspace or copy local secrets.
const app = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(app, '../results/vercel-upload');
const files = [
  '.env.example', '.gitignore', '.gitattributes', '.vercelignore',
  'README.md', 'DEPLOY.md', 'PUBLIC-DATA.md',
  'package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'vercel.json',
  'src/main.js', 'src/style.css', 'src/sales-data.js', 'src/operations.js',
  'api/weather.js', 'server/weather.js',
  'scripts/verify-deployment.mjs', 'scripts/prepare-vercel.mjs',
  'public/data/sales-store.xlsx', 'public/data/sales-online.xlsx',
  'public/data/sales-popup.xlsx', 'public/data/report-template.xlsx',
  'public/data/event-preparation.csv', 'public/data/weather-sample.json',
];
// Refuse stale output, so a newly added local file cannot hitchhike in a later upload.
await mkdir(output, { recursive: true });
await mkdir(path.join(output, 'dashboard'));
const manifest = [];
for (const file of files) {
  const bytes = await readFile(path.join(app, file));
  if (file === '.env.example' && bytes.toString().trim() !== 'OPENWEATHER_API_KEY=') {
    throw new Error('.env.example must contain an empty value only');
  }
  const target = path.join(output, 'dashboard', file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(app, file), target);
  manifest.push({ file: `dashboard/${file}`, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${files.length} allowlisted files: ${output}/dashboard`);
