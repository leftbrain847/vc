// End to end: build the single-file page from a clean tree and check its script compiles.
import { test } from 'node:test';
import assert from 'node:assert';
import { Script } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, stripModule } from '../scripts/build.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('stripModule removes imports and export keywords only', () => {
  const out = stripModule("import { A } from './a.mjs';\nexport const x = 1;\nexport function f() {}\nexport { a, b };\nconst y = 'export const';");
  assert.equal(out, "const x = 1;\nfunction f() {}\nconst y = 'export const';");
});

test('build makes one self-contained page whose script compiles', () => {
  const html = build(root);
  const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.doesNotMatch(js, /^\s*(import|export)\s/m);
  assert.doesNotThrow(() => new Script(js));
  assert.match(html, /<title>Cap Table<\/title>/);
});
