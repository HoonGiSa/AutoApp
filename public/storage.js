// Replace this adapter with authenticated API calls when server storage is ready.
// Stored trips contain endpoints, never stale route or arrival results.
const KEY='commute-pilot-trips-v2';
const LEGACY='commute-pilot-v1';
function validPlace(p){return p&&typeof p.name==='string'&&typeof p.address==='string'&&p.x!==''&&p.y!==''&&p.x!=null&&p.y!=null&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))&&Math.abs(Number(p.x))<=180&&Math.abs(Number(p.y))<=90;}
function validTrip(t){return t&&typeof t.name==='string'&&t.name.trim().length>0&&t.name.length<=40&&validPlace(t.origin)&&validPlace(t.destination);}
export function createTripRepository(storage){
  function read(){
    const raw=storage.getItem(KEY);
    if(raw!==null){
      const items=JSON.parse(raw);
      if(!Array.isArray(items)||items.some(t=>!validTrip(t)||typeof t.id!=='string')||new Set(items.map(t=>t.id)).size!==items.length)throw new Error('저장 정보 형식을 확인할 수 없습니다. 기존 정보는 변경하지 않았습니다.');
      return items;
    }
    const legacyRaw=storage.getItem(LEGACY);
    if(!legacyRaw)return [];
    const legacy=JSON.parse(legacyRaw);
    if(!validTrip(legacy))throw new Error('이전 저장 정보를 읽을 수 없습니다. 기존 정보는 보존했습니다.');
    const items=[{id:crypto.randomUUID(),name:legacy.name.trim(),origin:legacy.origin,destination:legacy.destination,updatedAt:new Date().toISOString()}];
    storage.setItem(KEY,JSON.stringify(items));
    // Remove only after the new record is safely written, so deletion cannot resurrect it.
    storage.removeItem(LEGACY);
    return items;
  }
  return {
    async list(){return read();},
    async get(id){return read().find(t=>t.id===id)||null;},
    async save(input){
      if(!validTrip(input))throw new Error('이름과 선택한 출발지·도착지를 확인하세요.');
      const items=read();const index=items.findIndex(t=>t.id===input.id);
      if(input.id&&index<0)throw new Error('이동 정보가 다른 창에서 삭제되었습니다. 새 이동으로 저장하세요.');
      const name=input.name.trim();
      if(items.some(t=>t.name===name&&t.id!==input.id))throw new Error('같은 이름이 있습니다. 다른 이름을 입력하거나 기존 이동을 불러와 수정하세요.');
      const item={id:input.id||crypto.randomUUID(),name,origin:input.origin,destination:input.destination,updatedAt:new Date().toISOString()};
      if(index>=0)items[index]=item;else items.push(item);
      storage.setItem(KEY,JSON.stringify(items));return item;
    },
    async remove(id){storage.setItem(KEY,JSON.stringify(read().filter(t=>t.id!==id)));}
  };
}
