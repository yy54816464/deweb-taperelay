import crypto from 'node:crypto';
import fs from 'node:fs';
import { createFileService } from '../src/files.mjs';

const key = process.env.TAPERELAY_KEY || '';
if (!key.startsWith('trk1_')) {
  console.error('缺少 TAPERELAY_KEY：把 taperelay.env 放在参数里，或设置环境变量；不要打印密钥。');
  process.exit(2);
}

const svc = createFileService({ developerKey: key });
const payload = new TextEncoder().encode(
  'DeWEB TapeRelay public-file pilot\n' + 'x'.repeat(64 * 1024)
);
const localSha = crypto.createHash('sha256').update(payload).digest('hex');
const out = { ok: false, account: svc.account, servers: svc.servers };
try {
  const t0 = Date.now();
  out.upload = await svc.uploadPublic(payload, { name: 'deweb-public-pilot.txt', contentType: 'text/plain' });
  out.uploadMs = Date.now() - t0;
  const t1 = Date.now();
  out.read = await svc.readPublic(out.upload.manifest);
  out.readMs = Date.now() - t1;
  const readSha = crypto.createHash('sha256').update(out.read).digest('hex');
  out.hashMatch = readSha === localSha;
  out.check = await svc.check(out.upload.manifest);
  out.usage = await svc.usage();
  const del = await svc.removePublic(out.upload.manifest, { keep: [] });
  out.deleted = { objects: del.objects, kept: del.kept, released: del.released, failed: del.failed };
  out.ok = out.hashMatch === true && (del.failed || []).length === 0;
  fs.writeFileSync('verify-files-result.json', JSON.stringify(out, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  console.log(JSON.stringify({ ok: out.ok, account: out.account, servers: out.servers, uploadMs: out.uploadMs, readMs: out.readMs, hashMatch: out.hashMatch, deleted: out.deleted, usage: out.usage }, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  if (!out.ok) process.exitCode = 3;
} catch (e) {
  delete out.read;
  out.error = { code: e?.code || 'error', message: String(e?.message || e) };
  console.log(JSON.stringify(out, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  process.exitCode = 1;
}
