import test from 'node:test';
import assert from 'node:assert/strict';
import {createTripRepository} from './public/storage.js';
const place={name:'시험 장소',address:'시험 주소',x:'127',y:'37'};
const trip=name=>({name,origin:place,destination:place});
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('multiple trips survive reload, update by ID, reject duplicates, delete independently',async()=>{
 const storage=memory();const repo=createTripRepository(storage);const a=await repo.save(trip('출근'));const b=await repo.save(trip('퇴근'));
 const reloaded=createTripRepository(storage);assert.equal((await reloaded.list()).length,2);assert.equal((await reloaded.get(a.id)).name,'출근');
 await reloaded.save({...a,name:'삼청동 출근'});assert.equal((await reloaded.get(a.id)).name,'삼청동 출근');
 await assert.rejects(reloaded.save(trip('퇴근')));await reloaded.remove(a.id);assert.equal(await reloaded.get(a.id),null);assert.equal((await reloaded.get(b.id)).name,'퇴근');
 await assert.rejects(reloaded.save({...a,name:'삭제된 항목'}));
});
test('legacy record migrates once and does not reappear after deletion',async()=>{
 const storage=memory();storage.setItem('commute-pilot-v1',JSON.stringify(trip('출근')));const repo=createTripRepository(storage);
 const [item]=await repo.list();assert.equal(item.name,'출근');assert.equal((await repo.list()).length,1);await repo.remove(item.id);assert.deepEqual(await repo.list(),[]);
});
test('failed migration preserves legacy data; corrupt records are not overwritten',async()=>{
 const storage=memory();const legacy=JSON.stringify(trip('출근'));storage.setItem('commute-pilot-v1',legacy);
 const blocked=createTripRepository({...storage,setItem(){throw new Error('quota');}});await assert.rejects(blocked.list());assert.equal(storage.getItem('commute-pilot-v1'),legacy);
 storage.setItem('commute-pilot-trips-v2','broken');await assert.rejects(createTripRepository(storage).save(trip('퇴근')));assert.equal(storage.getItem('commute-pilot-trips-v2'),'broken');
});
