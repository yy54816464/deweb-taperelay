import crypto from 'node:crypto';
import { createFileService, deriveFileKey } from '../src/files.mjs';
import { readEncryptedParallel } from '../src/parallel.mjs';

const key = process.env.TAPERELAY_KEY || '';
const password = process.env.DEWEB_SYNC_PASSWORD || '';
const address = process.env.DEWEB_ADDRESS || '';
if (!key.startsWith('trk1_')) { console.error('missing TAPERELAY_KEY'); process.exit(2); }
if (password.length < 8 || !/^0x[0-9a-fA-F]{40}$/.test(address)) { console.error('missing test password/address'); process.exit(2); }
const size = Number(process.env.PILOT_BYTES || 1024 * 1024);
if (!Number.isFinite(size) || size < 1 || size > 25 * 1024 * 1024) { console.error('PILOT_BYTES 1..25 MiB'); process.exit(2); }
const secretKey = deriveFileKey(password, address);
const svc = createFileService({ developerKey: key });
const payload = crypto.randomBytes(size);
const localSha = crypto.createHash('sha256').update(payload).digest('hex');
const out = { ok: false, account: svc.account, size };
try {
  const t0 = Date.now();
  out.upload = await svc.uploadEncrypted(payload, { name: 'deweb-encrypted-parallel.bin', contentType: 'application/octet-stream', secretKey });
  out.uploadMs = Date.now() - t0;
  const t1 = Date.now();
  out.read = await readEncryptedParallel(svc.client, svc.servers, out.upload.envelope, secretKey, { concurrency: Number(process.env.READ_CONCURRENCY || 6) });
  out.readMs = Date.now() - t1;
  out.hashMatch = crypto.createHash('sha256').update(out.read.bytes).digest('hex') === localSha;
  out.deleted = await svc.removeObjects(out.upload.objects, out.upload.stored);
  out.ok = out.hashMatch === true && out.deleted.every((x) => x.ok);
  console.log(JSON.stringify({ ok: out.ok, account: out.account, size, uploadMs: out.uploadMs, readMs: out.readMs, hashMatch: out.hashMatch, deleted: out.deleted }, null, 2));
  if (!out.ok) process.exitCode = 3;
} catch (e) {
  delete out.read;
  console.log(JSON.stringify({ ...out, error: { code: e?.code || 'error', message: String(e?.message || e) } }, null, 2));
  process.exitCode = 1;
}
