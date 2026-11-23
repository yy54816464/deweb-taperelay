import {
  createClient,
  planPublicFile,
  planEncryptedFile,
  readEncryptedFile,
  publicKeyOf,
  uploadToServers,
  remoteAuth,
} from '@taperelay/client';

// Pinned: a page global must not be able to redirect uploads/signing.
const API = 'https://api.dewebdesk.link';
const client = createClient();
const includeFetch = (url, opts) => fetch(url, Object.assign({}, opts || {}, { credentials:'include' }));
const authHeaders = (token) => (token && token !== 'cookie') ? { Authorization:'Bearer ' + token } : {};
let configCache = null;
let configAt = 0;

async function cfg(token){
  if (configCache && Date.now() - configAt < 60000) return configCache;
  const r = await fetch(API + '/api/tape/config', { credentials:'include', headers:authHeaders(token), cache:'no-store' });
  if (r.status === 401) { const e = new Error('云同步登录已过期'); e.status = 401; throw e; }
  const j = await r.json().catch(()=>null);
  if (!r.ok || !j || !j.enabled) throw new Error((j && j.error) || 'TapeRelay 未启用');
  configCache = j; configAt = Date.now();
  return j;
}

function keyPairOf(secretKey){
  const secret = secretKey instanceof Uint8Array ? secretKey : new Uint8Array(secretKey);
  return { secretKey: secret, publicKey: publicKeyOf(secret) };
}
function keyPairsOf(secrets){
  return (Array.isArray(secrets) ? secrets : [secrets]).filter(Boolean).map(keyPairOf);
}
function objectsOf(plan){
  return [...new Set([
    ...plan.chunkHashes,
    ...plan.indexObjects.map(o => o.sha256),
    ...(plan.extraObjects || []).map(o => o.sha256),
  ])];
}

async function post(token, path, body){
  const r = await fetch(API + path, {
    method:'POST', credentials:'include',
    headers:Object.assign({ 'Content-Type':'application/json' }, authHeaders(token)),
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(()=>null);
  if (!r.ok) {
    const e = new Error((j && (j.message || j.error)) || ('HTTP ' + r.status));
    e.status = r.status; e.payload = j;
    throw e;
  }
  return j;
}

async function uploadProfile(encrypted, revision, token, secretKey, owner){
  const c = await cfg(token);
  const bytes = new TextEncoder().encode(JSON.stringify(encrypted));
  const kp = keyPairOf(secretKey);
  const plan = await planEncryptedFile(bytes, { name:'deweb-profile.json', contentType:'application/json', from:c.account, selfKey:kp.publicKey });
  const objects = objectsOf(plan);
  await post(token, '/api/tape/register', { kind:'profile', size:bytes.length, objects, revision, owner: owner || '' });
  const auth = remoteAuth({ account:c.account, endpoint:API + '/api/tape/sign', headers:authHeaders(token), fetch:includeFetch });
  const up = await uploadToServers(client, c.servers, auth, null, { plan, claim:false });
  const now = up.ok && up.ok.length ? up : await up.settled;
  if (!now.ok || !now.ok.length) {
    const why = (now.failed || []).map(x => x.server + ':' + x.code).join(', ');
    throw new Error('TapeRelay 直传失败' + (why ? '：' + why : ''));
  }
  const manifest = plan.envelope.sha256;
  const out = await post(token, '/api/tape/finish', { manifest, kdf: { salt: encrypted.salt, iterations: encrypted.iterations } });
  plan.dispose();
  return out;
}

async function uploadWallpaper(ct, mode, meta, token, masterSecret){
  const c = await cfg(token);
  const bytes = new Uint8Array(ct);
  const kp = keyPairOf(masterSecret);
  const plan = await planEncryptedFile(bytes, { name:'deweb-wallpaper-' + mode + '.bin', contentType:'application/octet-stream', from:c.account, selfKey:kp.publicKey });
  const objects = objectsOf(plan);
  await post(token, '/api/tape/register', { kind:'wallpaper', mode, size:bytes.length, objects, mime:meta.mime, iv:meta.iv, aad:meta.aad || '' });
  const auth = remoteAuth({ account:c.account, endpoint:API + '/api/tape/sign', headers:authHeaders(token), fetch:includeFetch });
  const up = await uploadToServers(client, c.servers, auth, null, { plan, claim:false });
  const now = up.ok && up.ok.length ? up : await up.settled;
  if (!now.ok || !now.ok.length) {
    const why = (now.failed || []).map(x => x.server + ':' + x.code).join(', ');
    throw new Error('TapeRelay 壁纸直传失败' + (why ? '：' + why : ''));
  }
  const out = await post(token, '/api/tape/finish', { manifest:plan.envelope.sha256 });
  plan.dispose();
  return out;
}
async function readWallpaper(mode, token, secretKeys){
  const r = await fetch(API + '/api/tape/wallpaper?mode=' + encodeURIComponent(mode), { credentials:'include', headers:authHeaders(token), cache:'no-store' });
  if (r.status === 401) { const e = new Error('云同步登录已过期'); e.status = 401; throw e; }
  if (r.status === 404) return null;
  const ptr = await r.json().catch(()=>null);
  if (!r.ok || !ptr || !ptr.manifest) throw new Error((ptr && ptr.error) || ('HTTP ' + r.status));
  const c = await cfg(token);
  const kps = keyPairsOf(secretKeys);
  const e = await readEncryptedFile(client, c.servers, ptr.manifest, kps);
  return { bytes: e.bytes, meta: ptr.meta || {} };
}
async function readProfile(manifest, token, secretKey){
  const c = await cfg(token);
  if (!secretKey) throw new Error('encrypted profile key missing');
  const kp = keyPairOf(secretKey);
  const r = await readEncryptedFile(client, c.servers, manifest, [kp]);
  return JSON.parse(new TextDecoder().decode(r.bytes));
}

window.DeWEBTapeDirect = { uploadProfile, readProfile, uploadWallpaper, readWallpaper };
