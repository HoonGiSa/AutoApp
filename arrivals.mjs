const array=v=>v==null?[]:Array.isArray(v)?v:[v];
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const normalize=v=>String(v||'').replace(/\([^)]*\)/g,'').replace(/\s/g,'');
// Explicit provider alias: do not strip '역' from every station name.
const stationName=v=>{const name=normalize(v);return name==='서울역'?'서울':name;};
const nextStationName=v=>stationName(normalize(String(v||'').split(/\s*-\s*/).at(-1)).replace(/방면$/,''));
export function arrivalTargets(segment){
  return (segment.lane||[]).map(lane=>{
    const common={label:lane.name||lane.busNo,station:segment.startName,destination:segment.endName};
    if(segment.trafficType===1){
      const code=Number(lane.subwayCode);
      return {...common,provider:'subway',lineId:code>=1&&code<=9&&Number(lane.subwayCityCode)===1000?String(1000+code):null,direction:Number(segment.wayCode),nextStation:segment.passStopList?.stations?.[1]?.stationName};
    }
    return {...common,provider:Number(lane.busProviderCode)===10?'seoulBus':Number(lane.busProviderCode)===2?'gyeonggiBus':'unsupported',routeId:String(lane.busLocalBlID||''),stationId:String(segment.startLocalStationID||''),arsId:String(segment.startArsID||'').replace(/-/g,'')};
  });
}
export function parseSubway(data,target){
  const code=data.errorMessage?.code||data.RESULT?.CODE;
  if(code==='INFO-200')return [];
  if(code&&code!=='INFO-000')throw new Error('지하철 서비스 인증·호출 한도 또는 응답 오류를 확인하세요.');
  if(!Array.isArray(data.realtimeArrivalList))throw new Error('지하철 응답 형식을 확인하지 못했습니다.');
  // Match the line and the next station, not just a same-name station or up/down label.
  // Branch destinations and express stopping patterns remain a boarding-time check.
  return data.realtimeArrivalList.filter(r=>String(r.subwayId)===target.lineId&&stationName(r.statnNm)===stationName(target.station)&&target.nextStation&&nextStationName(r.trainLineNm)===stationName(target.nextStation)&&String(r.arvlCd)!=='2').map(r=>({
    message:r.arvlMsg2||'도착시간 정보 없음',seconds:number(r.barvlDt)>0?number(r.barvlDt):null,
    destination:r.bstatnNm||r.trainLineNm,kind:r.btrainSttus||'열차',sourceTime:r.recptnDt||null,
    note:'같은 진행 방향의 열차입니다. 종착역·급행 정차 여부는 탑승 전 확인하세요.'
  }));
}
export function parseSeoulBus(data,target){
  if(String(data.msgHeader?.headerCd)!=='0')throw new Error('서울 버스 서비스 인증·호출 한도 또는 응답 오류를 확인하세요.');
  const matches=array(data.msgBody?.itemList).filter(r=>String(r.busRouteId)===target.routeId&&String(r.arsId).replace(/-/g,'')===target.arsId);
  if(matches.length>1)throw new Error('같은 정류장의 운행 방향을 확정할 수 없습니다.');
  return matches.flatMap(r=>[r.arrmsg1,r.arrmsg2].filter(Boolean).map(message=>({message,seconds:null,destination:r.adirection||'',sourceTime:null})));
}
export function parseGyeonggiBus(data,target){
  const root=data.response||data;
  if(String(root.msgHeader?.resultCode)==='4')return [];
  if(String(root.msgHeader?.resultCode)!=='0')throw new Error('경기 버스 서비스 인증·호출 한도 또는 응답 오류를 확인하세요.');
  const matches=array(root.msgBody?.busArrivalList).filter(r=>String(r.routeId)===target.routeId&&String(r.stationId)===target.stationId);
  if(matches.length>1)throw new Error('동일 정류장에 양방향 차량이 있어 정류소 순번 확인이 필요합니다.');
  return matches.flatMap(r=>{
    if(r.flag==='STOP'||r.flag==='WAIT')return [{message:r.flag==='STOP'?'운행 종료':'회차지 대기',seconds:null,destination:r.routeDestName||'',sourceTime:root.msgHeader?.queryTime||null}];
    return [1,2].flatMap(i=>{
      const sec=number(r['predictTimeSec'+i]);const min=number(r['predictTime'+i]);const seconds=sec>0?sec:min>0?min*60:null;
      if(seconds===null)return [];
      const stops=number(r['locationNo'+i]);return [{message:`약 ${Math.ceil(seconds/60)}분 후${stops!==null?' · '+stops+'정류장 전':''}`,seconds,destination:r.routeDestName||'',sourceTime:root.msgHeader?.queryTime||null}];
    });
  });
}
export function createArrivalService({env=process.env,fetchJson,now=()=>Date.now()}){
  const cache=new Map();
  async function get(target){
    const names={subway:'SEOUL_SUBWAY_API_KEY',seoulBus:'SEOUL_BUS_API_KEY',gyeonggiBus:'GYEONGGI_BUS_API_KEY'};
    const base={...target,arrivals:[],queriedAt:null};const keyName=names[target.provider];
    if(!keyName)return {...base,status:'unsupported',message:'이 지역의 실시간 서비스는 아직 연결하지 않았습니다.'};
    if(!env[keyName])return {...base,status:'needs_setup',message:`${keyName} 설정이 필요합니다.`};
    if(target.provider==='subway'&&(!target.lineId||!target.nextStation))return {...base,status:'unsupported',message:'이 노선의 실시간 방향 매칭은 아직 지원하지 않습니다.'};
    if(target.provider!=='subway'&&(!/^\d+$/.test(target.routeId)||!(target.provider==='seoulBus'?/^\d{5}$/.test(target.arsId):/^\d+$/.test(target.stationId))))return {...base,status:'unsupported',message:'실시간 조회용 정류장·노선 식별자가 없습니다.'};
    const id=JSON.stringify(target);const previous=cache.get(id);if(previous&&now()-previous.time<30000)return previous.promise;
    const promise=(async()=>{
      try{
        let url,parse;let secret=env[keyName];try{secret=decodeURIComponent(secret);}catch{}
        if(target.provider==='subway'){
          url=new URL(`http://swopenapi.seoul.go.kr/api/subway/${encodeURIComponent(secret)}/json/realtimeStationArrival/0/100/${encodeURIComponent(target.station)}`);parse=parseSubway;
        }else if(target.provider==='seoulBus'){
          url=new URL('http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid');url.search=new URLSearchParams({serviceKey:secret,arsId:target.arsId,resultType:'json'});parse=parseSeoulBus;
        }else{
          url=new URL('https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2');url.search=new URLSearchParams({serviceKey:secret,stationId:target.stationId,format:'json'});parse=parseGyeonggiBus;
        }
        const data=await fetchJson(url);const arrivals=parse(data,target);const queriedAt=new Date(now()).toISOString();
        // Old provider records are retained as explicitly stale, never presented as fresh.
        for(const arrival of arrivals){const t=arrival.sourceTime?Date.parse(arrival.sourceTime.replace(' ','T')+(/[Z+]|\+\d\d:\d\d$/.test(arrival.sourceTime)?'':'+09:00')):NaN;arrival.stale=Number.isFinite(t)&&now()-t>120000;}
        return {...base,status:arrivals.length?'ok':'empty',queriedAt,arrivals,message:arrivals.length?'':'해당 노선·방향의 도착정보가 없습니다. 운행 종료 여부는 확인되지 않았습니다.'};
      }catch{return {...base,status:'error',message:'조회 실패: 서비스 승인·인증키·호출 한도·통신 상태를 확인하세요. 이전 도착시간은 표시하지 않습니다.'};}
    })();
    if(cache.size>=300)cache.delete(cache.keys().next().value);
    cache.set(id,{time:now(),promise});return promise;
  }
  return {get};
}
