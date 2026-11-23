import crypto from 'node:crypto';
import { createTapeStore } from '@tapestore/client';
import {
  createClient,
  developerKeyAuth,
  planEncryptedFile,
  uploadToServers,
  readEncryptedFile,
  publicKeyOf,
} from '@taperelay/client';

const X25519_SALT = 'deweb-taperelay-x25519-v1';

/** Derive a deterministic X25519 file key from the existing cloud-sync password.
 *  The password is never stored or sent; the same password on another device
 *  derives the same key. */
export function deriveFileKey(password, address, { iterations = 310000 } = {}) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('云同步密码至少 8 个字符');
  }
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('address 必须是 0x + 40 位十六进制');
  }
  const salt = crypto.createHash('sha256')
    .update(X25519_SALT + '|' + address.toLowerCase())
    .digest();
  return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
}

export function createFileService({ developerKey, fetch } = {}) {
  if (!developerKey || !String(developerKey).startsWith('trk1_')) {
    throw new Error('缺少开发者密钥（TAPERELAY_KEY）');
  }
  const store = createTapeStore({ developerKey, ...(fetch ? { fetch } : {}) });
  const client = store.client ?? createClient();
  const auth = developerKeyAuth(developerKey);
  const servers = store.servers;

  async function uploadPublic(bytes, { name = 'file.bin', contentType = 'application/octet-stream' } = {}) {
    return store.upload(bytes, { name, contentType, allowSecrets: false });
  }

  async function readPublic(manifest) {
    return store.read(manifest);
  }

  async function removePublic(manifest, { keep = [] } = {}) {
    let last = null;
    for (let i = 0; i < 3; i++) {
      last = await store.remove(manifest, { keep });
      if (!last.failed || last.failed.length === 0) return last;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
    return last;
  }

  async function uploadEncrypted(bytes, { name = 'file.bin', contentType = 'application/octet-stream', secretKey } = {}) {
    if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
      throw new Error('secretKey 必须是 32 字节');
    }
    const plan = await planEncryptedFile(bytes, {
      name,
      contentType,
      from: store.account,
      selfKey: publicKeyOf(secretKey),
    });
    try {
      const up = await uploadToServers(client, servers, auth, bytes, { plan });
      const now = up.ok && up.ok.length ? up : await up.settled;
      const need = up.need ?? 2;
      if (!now.ok || now.ok.length < need) {
        const failed = (now.failed || []).map((x) => x.server + ':' + x.code).join(', ');
        throw new Error('加密文件只存好 ' + (now.ok ? now.ok.length : 0) + '/' + need + ' 台' + (failed ? '：' + failed : ''));
      }
      return {
        envelope: plan.envelope.sha256,
        objects: [...plan.chunkHashes, ...plan.indexObjects.map((o) => o.sha256), plan.envelope.sha256],
        stored: now.ok,
        pending: now.pending || [],
        failed: now.failed || [],
      };
    } finally {
      plan.dispose();
    }
  }

  async function readEncrypted(envelope, secretKey) {
    if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) {
      throw new Error('secretKey 必须是 32 字节');
    }
    const r = await readEncryptedFile(client, servers, envelope, [{
      secretKey,
      publicKey: publicKeyOf(secretKey),
    }]);
    return r.bytes;
  }

  async function removeObjects(objects, targetServers = servers, { keepObjects = [] } = {}) {
    const keep = new Set(keepObjects);
    const list = [...new Set(objects)].filter((h) => !keep.has(h));
    if (!list.length) return targetServers.map((server) => ({ server, ok: true, kept: true }));
    const out = [];
    for (const server of targetServers) {
      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await client.release(server, auth, list);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        }
      }
      out.push(lastErr ? { server, ok: false, code: lastErr?.code || 'error', message: String(lastErr?.message || lastErr) } : { server, ok: true });
    }
    return out;
  }

  async function usage() {
    return store.usage();
  }

  async function check(manifest) {
    return store.check(manifest);
  }

  return {
    account: store.account,
    client,
    servers,
    uploadPublic,
    readPublic,
    removePublic,
    uploadEncrypted,
    readEncrypted,
    removeObjects,
    usage,
    check,
  };
}
