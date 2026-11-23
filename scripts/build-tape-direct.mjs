#!/usr/bin/env node
/**
 * Reproducible build for the in-page TapeRelay uploader.
 *
 * Repro command (esbuild 0.25.12):
 *   esbuild tape-direct-src.js --bundle --format=iife --minify \
 *     --platform=browser --external:node:* --target=es2020 \
 *     --outfile=../deweb-desktop-public/web/tape-direct.bundle.js
 *
 * The expected SHA-256 is the bundle that is inlined by
 * deweb-desktop-public/scripts/build-onchain.mjs and verified on-chain.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'tape-direct-src.js');
const EXPECTED = 'ce07ab2ba13852fd6ec5befd83ceabb9b0dbc1b9a88990c0d880d20fa6d37d4e';
const win = process.platform === 'win32';
const binName = win ? 'esbuild.cmd' : 'esbuild';

const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 && process.argv[outIdx + 1]
  ? path.resolve(process.argv[outIdx + 1])
  : path.join(ROOT, '..', 'deweb-desktop-public', 'web', 'tape-direct.bundle.js');

const candidates = [
  path.join(ROOT, 'node_modules', '.bin', binName),
  path.join(ROOT, '..', 'upload-page', 'node_modules', '.bin', binName),
  path.join(ROOT, '..', 'deweb-cloud-worker', 'node_modules', '.bin', binName)
];
const bin = candidates.find(p => fs.existsSync(p));
if (!bin) {
  console.error('ERROR esbuild not found. Run: npm install --save-dev esbuild@0.25.12');
  process.exit(1);
}

function run(args, opts = {}) {
  if (win) return spawnSync('cmd.exe', ['/c', bin, ...args], opts);
  return spawnSync(bin, args, opts);
}

const ver = run(['--version'], { encoding: 'utf8' });
const version = String(ver.stdout || '').trim();
console.log('esbuild ' + version + ' ' + bin);
if (version !== '0.25.12' && version !== '0.28.2') {
  console.error('ERROR expected esbuild 0.25.12 (or verified 0.28.2), got ' + version);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const args = [
  SRC,
  '--bundle',
  '--format=iife',
  '--minify',
  '--platform=browser',
  '--external:node:*',
  '--target=es2020',
  '--outfile=' + OUT
];
const r = run(args, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);

const bytes = fs.readFileSync(OUT);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
console.log('WROTE  ' + OUT);
console.log('BYTES  ' + bytes.length);
console.log('SHA256 ' + sha);
if (sha !== EXPECTED) {
  console.error('ERROR bundle hash mismatch; expected ' + EXPECTED);
  process.exit(1);
}
console.log('MATCH  ' + EXPECTED);
