import {createArrivalService} from './arrivals.mjs';
const service=createArrivalService({fetchJson:async url=>{
  const host=url.hostname;
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
    const body=await r.text();let data;try{data=JSON.parse(body);}catch{}
    console.log(JSON.stringify({host,status:r.status,format:data?'json':body.trim().startsWith('<')?'xml/html':'other',code:data?.errorMessage?.code||data?.RESULT?.CODE||data?.msgHeader?.headerCd||data?.response?.msgHeader?.resultCode,rows:data?.realtimeArrivalList?.length,xmlCode:body.match(/<(?:returnReasonCode|headerCd|resultCode)>([^<]{1,20})</)?.[1]}));
    if(!data)throw new Error('format');return data;
  }catch(e){console.log(JSON.stringify({host,networkCode:e.cause?.code||e.name}));throw new Error('diagnostic failed');}
}});
for(const target of [
 {provider:'subway',station:'철산',lineId:'1007',nextStation:'가산디지털단지'},
 {provider:'seoulBus',station:'시청역1호선.서울시청',routeId:'100900007',arsId:'02507'},
 {provider:'gyeonggiBus',station:'광덕초등학교',routeId:'213000002',stationId:'213000167'}
]){const result=await service.get(target);console.log(JSON.stringify({provider:target.provider,status:result.status,arrivals:result.arrivals}));}
