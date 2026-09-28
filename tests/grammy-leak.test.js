import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createRawApi } = require('../node_modules/grammy/out/core/client.js');
const { AbortController } = require('../node_modules/abort-controller');
function trackedSignal() {
 const ctrl=new AbortController();let added=0,removed=0;
 const add=ctrl.signal.addEventListener.bind(ctrl.signal),remove=ctrl.signal.removeEventListener.bind(ctrl.signal);
 ctrl.signal.addEventListener=(type,fn,...args)=>{if(type==='abort')added++;return add(type,fn,...args)};
 ctrl.signal.removeEventListener=(type,fn,...args)=>{if(type==='abort')removed++;return remove(type,fn,...args)};
 return {ctrl,count:()=>added-removed};
}
test('real grammY does not retain polling signal listeners after 5000 successful requests',async()=>{
 const s=trackedSignal();let calls=0;
 const {raw}=createRawApi('SYNTHETIC',{fetch:async()=>{calls++;return {json:async()=>({ok:true,result:[]})}}});
 for(let i=0;i<5000;i++){assert.deepEqual(await raw.getUpdates({offset:i,timeout:30},s.ctrl.signal),[]);assert.equal(s.count(),0)}
 assert.equal(calls,5000);
});
test('real grammY unregisters polling signals on transport and Bot API errors',async()=>{
 for(const fetch of [async()=>{throw Error('offline')},async()=>({json:async()=>({ok:false,error_code:429,description:'fixture'})})]){
  const s=trackedSignal();const {raw}=createRawApi('SYNTHETIC',{fetch});
  await assert.rejects(raw.getUpdates({},s.ctrl.signal));assert.equal(s.count(),0);
 }
});
