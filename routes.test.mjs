import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRoutes} from './routes.mjs';
const path=(totalTime,types,walk=5)=>({info:{totalTime,totalWalkTime:-1},subPath:types.map(trafficType=>({trafficType,sectionTime:trafficType===3?walk:10,lane:[{name:'A'},{name:'B'}]}))});
test('rank by time, transfers, walking; route tokens stay attached after sorting',()=>{
 const paths=[path(60,[2,1,3]),path(50,[2,1,3]),path(50,[1,3],7),path(50,[2,3],4),path(null,[1,3])];
 const routes=summarizeRoutes(paths,['a','b','c','d','e']);
 assert.deepEqual(routes.map(r=>r.arrivalToken),['d','c','b','a','e']);
 assert.deepEqual(routes.map(r=>r.id),[3,2,1,0,4]);
 assert.equal(routes.filter(r=>r.isOptimal).length,1);assert.equal(routes[0].isOptimal,true);
 assert.equal(summarizeRoutes([path(null,[1])],['x'])[0].isOptimal,false);
 assert.deepEqual(summarizeRoutes([],[]),[]);
});
test('sum all walking legs and count boardings rather than alternative lanes',()=>{
 const [route]=summarizeRoutes([path(60,[3,2,3,1,3,1,3],3)],['x']);
 assert.equal(route.walkMinutes,12);assert.equal(route.busCount,1);assert.equal(route.subwayCount,2);assert.equal(route.transfers,2);
 const incomplete=path(60,[3,1]);incomplete.subPath[0].sectionTime=-1;
 assert.equal(summarizeRoutes([incomplete],['x'])[0].walkMinutes,null);
 incomplete.info.totalWalkTime=9;
 assert.equal(summarizeRoutes([incomplete],['x'])[0].walkMinutes,9);
 assert.equal(summarizeRoutes([path(60,[1])],['x'])[0].walkMinutes,0);
});
