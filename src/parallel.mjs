import { readEncryptedFile, publicKeyOf } from '@taperelay/client';

/** Parallel chunk reader for encrypted TapeRelay files.
 * Uses only the public @taperelay/client API; each range is independently
 * verified by the client library, then assembled in order.
 */
export async function readEncryptedParallel(client, servers, envelope, secretKey, { concurrency = 6 } = {}) {
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) throw new Error('secretKey 必须是 32 字节');
  const keyPairs = [{ secretKey, publicKey: publicKeyOf(secretKey) }];
  const first = await readEncryptedFile(client, servers, envelope, keyPairs, { start: 0, end: 1 });
  const manifest = first.manifest;
  const size = manifest.size;
  const chunkSize = manifest.chunkSize;
  if (!Number.isSafeInteger(size) || !Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('清单大小不合法');
  }
  const out = new Uint8Array(size);
  const starts = [];
  for (let s = 0; s < size; s += chunkSize) starts.push(s);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= starts.length) return;
      const start = starts[i];
      const end = Math.min(size, start + chunkSize);
      const r = await readEncryptedFile(client, servers, envelope, keyPairs, { start, end });
      out.set(r.bytes, start);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), starts.length || 1) }, worker));
  return { bytes: out, manifest };
}
