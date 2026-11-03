import test from 'node:test';
import assert from 'node:assert/strict';
import {searchRoutes} from './public/route-search.js';
import {validateBrowserPaths} from './browser-paths.mjs';
import {api} from './server.mjs';
const path={info:{totalTime:20,payment:1500},subPath:[{trafficType:1,startName:'시청',endName:'영등포',sectionTime:15,lane:[{name:'1호선',subwayCode:1,subwayCityCode:1000}],passStopList:{stations:[{stationName:'시청'},{stationName:'서울역'}]}},{trafficType:3,sectionTime:5}]};
const reply=data=>({ok:true,json:async()=>data});
test('browser calls provider with web key then submits paths for existing summaries and arrival tokens',async()=>{
 const calls=[];
 const result=await searchRoutes({sx:'126',sy:'37',ex:'127',ey:'38'},async(url,options)=>{
   calls.push({url:String(url),options});
   if(calls.length===1)return reply({mode:'web',webKey:'test-web+key'});
   if(calls.length===2){assert.equal(new URL(url).searchParams.get('apiKey'),'test-web+key');return reply({result:{path:[path]}});}
   assert.equal(url,'/api/routes');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{paths:[path]});return reply({routes:[{id:0}],fetchedAt:'now'});
 });
 assert.equal(result.routes.length,1);assert.equal(calls.length,3);
});
test('server mode never calls provider from browser and provider failures do not register paths',async()=>{
 let calls=0;await searchRoutes({sx:1},async()=>++calls===1?reply({mode:'server'}):reply({routes:[]}));assert.equal(calls,2);
 calls=0;await assert.rejects(searchRoutes({},async()=>++calls===1?reply({mode:'web',webKey:'test-only'}):reply({error:[{code:500,message:'[ApiKeyAuthFailed] secret-bearing-message'}]})),/URI용 키/);assert.equal(calls,2);
});
test('untrusted path fields are projected out and oversized or malformed structures rejected',()=>{
 const paths=validateBrowserPaths({paths:[{...path,secret:'ignore',subPath:path.subPath.map(s=>({...s,url:'https://evil.invalid'}))}]});
 assert.equal(paths[0].secret,undefined);assert.equal(paths[0].subPath[0].url,undefined);
 assert.throws(()=>validateBrowserPaths({paths:Array(41).fill(path)}));
 assert.throws(()=>validateBrowserPaths({paths:[{subPath:[{trafficType:99}]}]}));
 assert.throws(()=>validateBrowserPaths({paths:[{subPath:[{trafficType:1,lane:[null]}]}]}));
});
test('web configuration exposes only the dedicated key and browser routes keep sorting and arrivals',async()=>{
 const keys=['ODSAY_API_KEY','ODSAY_WEB_API_KEY','SEOUL_SUBWAY_API_KEY'];const old=keys.map(k=>process.env[k]);
 process.env.ODSAY_API_KEY='server-secret';process.env.ODSAY_WEB_API_KEY='browser-key';delete process.env.SEOUL_SUBWAY_API_KEY;
 try{
   assert.deepEqual(await api(new URL('http://localhost/api/route-config')),{mode:'web',webKey:'browser-key'});
   const result=await api(new URL('http://localhost/api/routes'),{method:'POST',body:{paths:[path]}});
   assert.equal(result.routes[0].subwayCount,1);assert.equal(result.routes[0].walkMinutes,5);
   const live=await api(new URL('http://localhost/api/arrivals?'+new URLSearchParams({route:result.routes[0].arrivalToken})));
   assert.equal(live.groups[0].items[0].station,'시청');assert.equal(live.groups[0].items[0].status,'needs_setup');
   process.env.ODSAY_WEB_API_KEY='server-secret';await assert.rejects(api(new URL('http://localhost/api/route-config')),/웹 키와 서버 키/);
   delete process.env.ODSAY_WEB_API_KEY;assert.deepEqual(await api(new URL('http://localhost/api/route-config')),{mode:'server'});
 }finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
});
