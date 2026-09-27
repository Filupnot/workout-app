import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore, openWorkoutDB } from '../src/lib/storage/database';
import { SyncEngine, HttpError } from '../src/lib/storage/sync';
import { newWorkout } from '../src/lib/domain/model';
import { startRest, remaining, tick, visibility } from '../src/lib/domain/timer';

test('lost acknowledgment retries same ID and leaves exactly one result',async()=>{
  const db=await openWorkoutDB(crypto.randomUUID());const store=new LocalStore(db,'a');await store.save([newWorkout()]);
  const applied=new Set();let calls=0;const states:string[]=[];
  const sync=new SyncEngine(store,async m=>{applied.add(m.id);if(calls++===0)throw new Error('lost response');return {revision:1};},s=>states.push(s),()=>true,async()=>{});
  await sync.flush();assert.equal(applied.size,1);assert.equal((await store.pending()).length,0);assert.equal(states.at(-1),'synced');db.close();
});
test('offline, expired auth, and conflict retain pending writes; explicit remote choice resolves',async()=>{
  const db=await openWorkoutDB(crypto.randomUUID());const store=new LocalStore(db,'a');const w=newWorkout();const m=await store.save([w]);let state='';
  await new SyncEngine(store,async()=>({revision:1}),s=>state=s,()=>false).flush();assert.equal(state,'local');
  await new SyncEngine(store,async()=>{throw new HttpError(401,'auth');},s=>state=s,()=>true).flush();assert.equal(state,'signin');
  await new SyncEngine(store,async()=>{throw new HttpError(409,'conflict');},s=>state=s,()=>true).flush();assert.equal(state,'conflict');assert.equal((await store.pending()).length,1);
  await store.resolve(m.aggregate,[{key:m.aggregate,value:{...w,notes:'Server version'},revision:2}],'server');assert.equal((await store.pending()).length,0);assert.equal((await store.records())[0].revision,2);db.close();
});
test('deadline survives reload and overtime; cues occur only once in foreground',()=>{
  const t=startRest(90,0);assert.equal(remaining(JSON.parse(JSON.stringify(t)),20000),70);assert.equal(remaining(t,115000),-25);
  const fired=tick(t,90000,true,true);assert.equal(fired.cue,true);assert.equal(tick(fired.timer,91000,true,true).cue,false);
  assert.equal(tick(t,90000,true,false).cue,false);
  const hidden=visibility(t,false,20000);assert.equal(tick(hidden,90000,false,true).cue,false);
  const restored=visibility(hidden,true,120000);assert.equal(tick(restored,120000,true,true).cue,false);
  const restarted=startRest(90,120000);assert.equal(remaining(restarted,120000),90);
});
