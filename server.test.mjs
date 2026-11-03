import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './server.mjs';

async function request(url,{host='autoapp.example',method='GET'}={}){
 const result={};await handler({url,method,headers:{host}},{writeHead(status,headers){Object.assign(result,{status,headers});},end(body){result.body=body;}});return result;
}
test('Vercel entry points return JSON without listening or depending on local Host',async()=>{
 const before=process.env.VERCEL;process.env.VERCEL='1';
 try{
   for(const name of ['status','preset','places','routes','arrivals'])assert.equal(typeof (await import(`./api/${name}.js`)).default,'function');
   const status=await request('/api/status');assert.equal(status.status,200);assert.equal(typeof JSON.parse(status.body).kakao,'boolean');
   assert.deepEqual(JSON.parse((await request('/api/preset')).body),{name:'출근',origin:'',destination:''});
   assert.equal((await request('/api/status',{method:'POST'})).status,405);
   assert.equal((await request('/api/places?q=')).status,400);
   assert.equal((await request('/.env')).status,404);
   assert.equal((await request('/')).status,200);
 }finally{if(before===undefined)delete process.env.VERCEL;else process.env.VERCEL=before;}
});
test('local execution still rejects external Host and serves the page on loopback',async()=>{
 const before=process.env.VERCEL;delete process.env.VERCEL;
 try{assert.equal((await request('/api/status')).status,403);assert.equal((await request('/',{host:'127.0.0.1:4317'})).status,200);}
 finally{if(before!==undefined)process.env.VERCEL=before;}
});
test('route search and arrivals work across fresh server modules',async()=>{
 const names=['ODSAY_API_KEY','SEOUL_SUBWAY_API_KEY','ROUTE_TOKEN_SECRET'];const before=names.map(n=>process.env[n]);const originalFetch=globalThis.fetch;
 process.env.ODSAY_API_KEY='test-odsay';process.env.SEOUL_SUBWAY_API_KEY='test-subway';delete process.env.ROUTE_TOKEN_SECRET;
 globalThis.fetch=async input=>{
   const url=new URL(input);
   if(url.hostname==='api.odsay.com')return {ok:true,json:async()=>({result:{path:[{info:{totalTime:20},subPath:[{trafficType:1,startName:'시청',endName:'영등포',lane:[{subwayCode:1,subwayCityCode:1000}],passStopList:{stations:[{stationName:'시청'},{stationName:'서울역'}]}}]}]}})};
   if(url.hostname==='swopenapi.seoul.go.kr')return {ok:true,json:async()=>({realtimeArrivalList:[{subwayId:'1001',statnNm:'시청',trainLineNm:'인천행 - 서울방면',arvlCd:'99',arvlMsg2:'3분 후'}]})};
   throw Error('Unexpected upstream');
 };
 try{
   const first=await import('./server.mjs?instance=first');
   const routes=await first.api(new URL('http://localhost/api/routes?sx=126&sy=37&ex=127&ey=38'));
   const second=await import('./server.mjs?instance=second');
   const arrivals=await second.api(new URL('http://localhost/api/arrivals?'+new URLSearchParams({route:routes.routes[0].arrivalToken})));
   assert.equal(arrivals.groups[0].items[0].status,'ok');assert.equal(arrivals.groups[0].items[0].arrivals[0].message,'3분 후');
 }finally{globalThis.fetch=originalFetch;names.forEach((n,i)=>{if(before[i]===undefined)delete process.env[n];else process.env[n]=before[i];});}
});
