import {api} from './server.mjs';
const call=(path,params={})=>api(new URL(path+'?'+new URLSearchParams(params),'http://localhost'));
try {
  const preset=await call('/api/preset');
  const origin=await call('/api/places',{q:preset.origin,kind:'address'});
  const destination=await call('/api/places',{q:preset.destination,kind:'keyword'});
  console.log(JSON.stringify({stage:'places',originCount:origin.places.length,destinationCandidates:destination.places.map(p=>({name:p.name,address:p.address}))}));
  const start=origin.places[0];
  const ends=destination.places.filter(p=>p.name==='한국금융연수원'&&p.address.includes('종로구'));
  if(origin.places.length!==1||ends.length!==1)throw new Error('주소 후보가 여러 개이거나 없습니다. 화면에서 정확한 장소를 선택해야 합니다.');
  const end=ends[0];
  const [from,to]=process.argv.includes('--reverse')?[end,start]:[start,end];
  const result=await call('/api/routes',{sx:from.x,sy:from.y,ex:to.x,ey:to.y});
  console.log(JSON.stringify({stage:'routes',count:result.routes.length,routes:result.routes.slice(0,3).map(r=>({minutes:r.minutes,fare:r.fare,walkMinutes:r.walkMinutes,segments:r.segments.map(s=>({type:s.type,lines:s.lines,start:s.start,end:s.end,stops:s.stops}))}))}));
  if(!result.routes.length)process.exitCode=1;
  for(const route of result.routes.slice(0,2)){
    const live=await call('/api/arrivals',{route:route.arrivalToken});
    console.log(JSON.stringify({stage:'arrivals',route:route.id,groups:live.groups.map(g=>({start:g.start,items:g.items.map(i=>({provider:i.provider,status:i.status,count:i.arrivals.length}))}))}));
  }
} catch(error) {
  // Never print request URLs or credential-bearing upstream error objects.
  console.error(error.status?error.message:'조회 검증을 완료하지 못했습니다. 주소 선택 및 네트워크 설정을 확인하세요.');
  process.exitCode=1;
}
