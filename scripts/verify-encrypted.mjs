import crypto from 'node:crypto';
import fs from 'node:fs';
import { createFileService, deriveFileKey } from '../src/files.mjs';

const key = process.env.TAPERELAY_KEY || '';
const password = process.env.DEWEB_SYNC_PASSWORD || '';
const address = process.env.DEWEB_ADDRESS || '';
if (!key.startsWith('trk1_')) {
  console.error('缺少 TAPERELAY_KEY；不要打印密钥。');
  process.exit(2);
}
if (password.length < 8) {
  console.error('缺少 DEWEB_SYNC_PASSWORD（至少 8 字符）；只用于本次本地测试。');
  process.exit(2);
}
if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error('缺少 DEWEB_ADDRESS（0x + 40 位十六进制，用于派生文件密钥）。');
  process.exit(2);
}
const secretKey = deriveFileKey(password, address);
const svc = createFileService({ developerKey: key });
const SIZE = Number(process.env.PILOT_BYTES || 1024 * 1024);
if (!Number.isFinite(SIZE) || SIZE < 1 || SIZE > 25 * 1024 * 1024) { console.error('PILOT_BYTES 必须在 1..25 MiB 之间'); process.exit(2); }
const payload = crypto.randomBytes(SIZE);
const localSha = crypto.createHash('sha256').update(payload).digest('hex');
const out = { ok: false, account: svc.account, servers: svc.servers, size: payload.length };
try {
  const t0 = Date.now();
  out.upload = await svc.uploadEncrypted(payload, {
    name: 'deweb-encrypted-pilot.bin',
    contentType: 'application/octet-stream',
    secretKey,
  });
  out.uploadMs = Date.now() - t0;
  const t1 = Date.now();
  out.read = await svc.readEncrypted(out.upload.envelope, secretKey);
  out.readMs = Date.now() - t1;
  out.hashMatch = crypto.createHash('sha256').update(out.read).digest('hex') === localSha;
  out.usage = await svc.usage();
  out.deleted = await svc.removeObjects(out.upload.objects);
  out.ok = out.hashMatch === true && out.deleted.every((x) => x.ok);
  fs.writeFileSync('verify-encrypted-result.json', JSON.stringify(out, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  console.log(JSON.stringify({ ok: out.ok, account: out.account, servers: out.servers, size: out.size, uploadMs: out.uploadMs, readMs: out.readMs, hashMatch: out.hashMatch, deleted: out.deleted, usage: out.usage }, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  if (!out.ok) process.exitCode = 3;
} catch (e) {
  delete out.read;
  out.error = { code: e?.code || 'error', message: String(e?.message || e) };
  console.log(JSON.stringify(out, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  process.exitCode = 1;
}
