import { createTapeStore } from '@tapestore/client';
const key=process.env.TAPERELAY_KEY||''; if(!key.startsWith('trk1_')) throw new Error('no key');
const s=createTapeStore({developerKey:key});
const items=[
 ['wall-desktop','9887d038ae882d8e78d3c738d55ccd79a273513771321b48f10b229c6f1a40b0',566934],
 ['wall-mobile','5df048fabdfedee0e010bb8660d5922edc39808ae7e9f78631ed6d675f275dbc',238231],
 ['profile','6657feda9708b4fb4130831a8fcbdfd1926bb11a6edfb2deefec6204676b84d0',1137],
];
for(const [name,m,want] of items){const b=await s.read(m);console.log(JSON.stringify({name,got:b.byteLength,want,ok:b.byteLength===want}));}
