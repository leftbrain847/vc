#!/usr/bin/env node
// Inline the game's modules into one self-contained page: dist/index.html.
// One file keeps the sprint snapshot, Pages and offline play simple. No dependencies.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MODULES = ['src/config.mjs', 'src/world.mjs', 'src/game.mjs', 'src/ui.js'];

// Drop import lines and `export` keywords; every module shares one scope in the page.
export function stripModule(src) {
  return src
    .split('\n')
    .filter((l) => !/^\s*import\s.+from\s+['"].+['"];?\s*$/.test(l) && !/^\s*export\s*\{[^}]*\};?\s*$/.test(l))
    .map((l) => l.replace(/^export\s+(const|function|let|class)\s/, '$1 '))
    .join('\n');
}

export function build(root) {
  const code = MODULES.map((m) => `// ---- ${m}\n${stripModule(readFileSync(join(root, m), 'utf8'))}`).join('\n');
  const page = readFileSync(join(root, 'src/index.html'), 'utf8');
  if (!page.includes('/*APP*/')) throw new Error('src/index.html is missing the /*APP*/ marker');
  const html = page.replace('/*APP*/', () => `{\n${code}\n}`);
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist/index.html'), html);
  return html;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  build(root);
  console.log('built dist/index.html');
}
