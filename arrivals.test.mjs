import test from 'node:test';
import assert from 'node:assert/strict';
import {arrivalTargets,parseSubway,parseSeoulBus,parseGyeonggiBus,createArrivalService} from './arrivals.mjs';
const target={provider:'subway',station:'가산디지털단지',lineId:'1001',nextStation:'구로'};
test('City Hall southbound matches Seoul alias without admitting northbound or other lines',()=>{
 const t={provider:'subway',station:'시청',lineId:'1001',nextStation:'서울역'};
 const row={subwayId:'1001',statnNm:'시청',trainLineNm:'서동탄행 - 서울방면',arvlCd:'3',arvlMsg2:'전역 출발'};
 const rows=[row,{...row,trainLineNm:'구로행-서울역방면 (급행)'},{...row,trainLineNm:'청량리행 - 종각방면'},{...row,subwayId:'1002'},{...row,arvlCd:'2'}];
 assert.deepEqual(parseSubway({realtimeArrivalList:rows},t).map(r=>r.message),['전역 출발','전역 출발']);
 assert.equal(parseSubway({realtimeArrivalList:[{...row,statnNm:'서울',trainLineNm:'서동탄행 - 남영방면'}]},{...t,station:'서울역',nextStation:'남영'}).length,1);
 assert.equal(parseSubway({realtimeArrivalList:[{...row,trainLineNm:'서동탄행 - 역삼방면'}]},{...t,nextStation:'삼'}).length,0);
});
test('subway rejects opposite direction, other lines, departed trains; zero is unknown',()=>{
 const row={subwayId:'1001',statnNm:'가산디지털단지',trainLineNm:'소요산행 - 구로방면',barvlDt:'120',arvlMsg2:'2분 후',arvlCd:'99'};
 const result=parseSubway({realtimeArrivalList:[row,{...row,subwayId:'1007'},{...row,trainLineNm:'신창행 - 독산방면'},{...row,arvlCd:'2'},{...row,barvlDt:'0',arvlMsg2:'진입'}]},target);
 assert.equal(result.length,2);assert.equal(result[0].seconds,120);assert.equal(result[1].seconds,null);
 assert.throws(()=>parseSubway({errorMessage:{code:'INFO-100'}},target));
});
test('bus matching uses local IDs and rejects ambiguous direction',()=>{
 const t={routeId:'100900007',arsId:'02507'};const r={busRouteId:t.routeId,arsId:t.arsId,arrmsg1:'5분 후',arrmsg2:'운행종료'};
 assert.equal(parseSeoulBus({msgHeader:{headerCd:'0'},msgBody:{itemList:[r,{...r,busRouteId:'other'}]}},t).length,2);
 assert.throws(()=>parseSeoulBus({msgHeader:{headerCd:0},msgBody:{itemList:[r,r]}},t));
 const g={routeId:'213000002',stationId:'213000167'};const item={...g,flag:'RUN',predictTimeSec1:90,predictTime1:2,predictTime2:-1,locationNo1:3};
 const response={response:{msgHeader:{resultCode:0},msgBody:{busArrivalList:[item]}}};
 assert.equal(parseGyeonggiBus(response,g)[0].seconds,90);assert.equal(parseGyeonggiBus(response,g).length,1);
 assert.deepEqual(parseGyeonggiBus({response:{msgHeader:{resultCode:4}}},g),[]);
 response.response.msgBody.busArrivalList.push({...item,staOrder:40});assert.throws(()=>parseGyeonggiBus(response,g));
});
test('missing keys do not call APIs; repeated requests are coalesced and expire',async()=>{
 let calls=0,clock=Date.now();const fetchJson=async()=>{calls++;return {realtimeArrivalList:[]};};
 const disabled=createArrivalService({env:{},fetchJson});assert.equal((await disabled.get(target)).status,'needs_setup');assert.equal(calls,0);
 const service=createArrivalService({env:{SEOUL_SUBWAY_API_KEY:'test-only'},fetchJson,now:()=>clock});
 await Promise.all([service.get(target),service.get(target)]);assert.equal(calls,1);clock+=30001;await service.get(target);assert.equal(calls,2);
});
test('provider selection follows bus data provider, not station city; API errors are sanitized',async()=>{
 const [t]=arrivalTargets({trafficType:2,startStationCityCode:1000,startLocalStationID:'117000315',lane:[{busNo:'21',busProviderCode:2,busLocalBlID:'213000002'}]});
 assert.equal(t.provider,'gyeonggiBus');assert.equal(t.stationId,'117000315');
 const service=createArrivalService({env:{GYEONGGI_BUS_API_KEY:'secret'},fetchJson:async()=>{throw new Error('secret-bearing URL');}});
 const result=await service.get(t);assert.equal(result.status,'error');assert.ok(!JSON.stringify(result).includes('secret'));
});
