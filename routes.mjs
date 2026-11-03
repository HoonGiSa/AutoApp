const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export function summarizeRoutes(paths,tokens){
  const routes=paths.map((p,index)=>{
    const segments=(p.subPath||[]).map(s=>({type:s.trafficType,minutes:nonnegative(s.sectionTime),start:s.startName,end:s.endName,stops:s.stationCount,lines:(s.lane||[]).map(l=>l.name||l.busNo).filter(Boolean),stations:s.passStopList?.stations||[]}));
    const walks=segments.filter(s=>s.type===3);
    // Sum every walking leg, including the first/last leg and transfers.
    // If a leg is missing its duration, use a valid route total rather than a partial sum.
    const walkMinutes=walks.every(s=>s.minutes!==null)?walks.reduce((sum,s)=>sum+s.minutes,0):nonnegative(p.info?.totalWalkTime);
    const busCount=segments.filter(s=>s.type===2).length;
    const subwayCount=segments.filter(s=>s.type===1).length;
    return {id:index,arrivalToken:tokens[index],minutes:nonnegative(p.info?.totalTime),fare:nonnegative(p.info?.payment),walkMinutes,busCount,subwayCount,transfers:Math.max(0,busCount+subwayCount-1),segments};
  });
  const rank=value=>value===null?Infinity:value;
  routes.sort((a,b)=>(rank(a.minutes)-rank(b.minutes))||(a.transfers-b.transfers)||(rank(a.walkMinutes)-rank(b.walkMinutes))||(a.id-b.id));
  return routes.map((route,index)=>({...route,isOptimal:index===0&&route.minutes!==null}));
}
