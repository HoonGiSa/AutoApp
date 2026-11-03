import {api} from './server.mjs';
import {arrivalTargets,parseSubway} from './arrivals.mjs';
const call=(path,params={})=>api(new URL(path+'?'+new URLSearchParams(params),'http://localhost'));
try{
 const p=await call('/api/preset');
 const a=(await call('/api/places',{q:p.origin,kind:'address'})).places[0];
 const b=(await call('/api/places',{q:p.destination,kind:'keyword'})).places.find(x=>x.name==='한국금융연수원'&&x.address.includes('종로구'));
 const [start,end]=process.argv.includes('--reverse')?[b,a]:[a,b];
 const url=new URL('https://api.odsay.com/v1/api/searchPubTransPathT');url.search=new URLSearchParams({SX:start.x,SY:start.y,EX:end.x,EY:end.y,apiKey:process.env.ODSAY_API_KEY});
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});const data=await response.json();
 const seen=new Set();
 for(const path of (data.result?.path||[]))for(const segment of path.subPath.filter(s=>s.trafficType===1))for(const target of arrivalTargets(segment)){
   const id=JSON.stringify(target);if(seen.has(id))continue;seen.add(id);
   const endpoint=new URL(`http://swopenapi.seoul.go.kr/api/subway/${encodeURIComponent(process.env.SEOUL_SUBWAY_API_KEY)}/json/realtimeStationArrival/0/100/${encodeURIComponent(target.station)}`);
   const subway=await (await fetch(endpoint,{signal:AbortSignal.timeout(15000)})).json();
   console.log(JSON.stringify({target,stations:segment.passStopList?.stations?.slice(0,3),matched:parseSubway(subway,target).length,rows:subway.realtimeArrivalList?.map(r=>({subwayId:r.subwayId,statnNm:r.statnNm,trainLineNm:r.trainLineNm,updnLine:r.updnLine,arvlCd:r.arvlCd,arvlMsg2:r.arvlMsg2}))}));
 }
}catch{console.error('연동 데이터 확인 실패 (비밀 값은 출력하지 않음)');process.exitCode=1;}
