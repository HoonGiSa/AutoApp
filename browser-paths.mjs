const text=v=>typeof v==='string'?v.slice(0,160):undefined;
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
const id=v=>typeof v==='string'||typeof v==='number'?String(v).slice(0,32):undefined;
export function validateBrowserPaths(body){
  if(!body||!Array.isArray(body.paths)||body.paths.length>40)throw new Error('Invalid paths');
  return body.paths.map(path=>{
    if(!path||!Array.isArray(path.subPath)||!path.subPath.length||path.subPath.length>24)throw new Error('Invalid segments');
    return {info:{totalTime:number(path.info?.totalTime),payment:number(path.info?.payment),totalWalkTime:number(path.info?.totalWalkTime)},subPath:path.subPath.map(s=>{
      if(!s||![1,2,3].includes(s.trafficType)||!Array.isArray(s.lane??[])||(s.lane?.length||0)>6||!Array.isArray(s.passStopList?.stations??[])||(s.passStopList?.stations?.length||0)>300)throw new Error('Invalid segment');
      return {trafficType:s.trafficType,sectionTime:number(s.sectionTime),startName:text(s.startName),endName:text(s.endName),stationCount:number(s.stationCount),wayCode:number(s.wayCode),startLocalStationID:id(s.startLocalStationID),startArsID:id(s.startArsID),
        lane:(s.lane||[]).map(l=>{if(!l||typeof l!=='object')throw new Error('Invalid lane');return {name:text(l.name),busNo:text(l.busNo),subwayCode:id(l.subwayCode),subwayCityCode:id(l.subwayCityCode),busProviderCode:id(l.busProviderCode),busLocalBlID:id(l.busLocalBlID)};}),
        passStopList:{stations:(s.passStopList?.stations||[]).map(t=>{if(!t||typeof t!=='object')throw new Error('Invalid station');return {stationName:text(t.stationName)};})}};
    })};
  });
}
