import { createTapeStore } from '@tapestore/client';
const key = process.env.TAPERELAY_KEY || '';
if (!key.startsWith('trk1_')) { console.error('no TAPERELAY_KEY'); process.exit(2); }
const s = createTapeStore({ developerKey: key });
console.log(JSON.stringify({ account: s.account, servers: s.servers }, null, 2));
