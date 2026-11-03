import {createTripRepository} from '/storage.js';
import {arrivalMessage} from '/arrival-display.js';
const repository=createTripRepository({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)});
let activeTripId=null;const searchVersions={origin:0,destination:0};
const $=id=>document.getElementById(id);
const state={origin:null,destination:null};let routeVersion=0;let liveVersion=0;let liveTimer=null;let resumeLive=null;
function duration(value){return typeof value==='number'&&value>=0?`${value}분`:'시간 정보 없음';}
function text(tag,value){const element=document.createElement(tag);element.textContent=value;return element;}
async function get(path){const response=await fetch(path);const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
function message(value){$('message').textContent=value;}
function stopLive(){resumeLive=null;liveVersion++;clearTimeout(liveTimer);liveTimer=null;}
function invalidate(){stopLive();routeVersion++;$('route-list').replaceChildren();$('detail').replaceChildren();$('routes').disabled=!(state.origin&&state.destination);}
function select(side,place){state[side]=place;$(side+'-selected').textContent=place?`${place.name} · ${place.address}`:'장소를 선택해주세요.';invalidate();}
$('swap-places').onclick=()=>{
  const before={};
  for(const side of ['origin','destination']){
    before[side]={value:$(side).value,kind:$(side+'-kind').value,place:state[side]};
    // Ignore pending search responses for the previous direction.
    searchVersions[side]++;
    $(side+'-results').replaceChildren();
  }
  for(const [side,other] of [['origin','destination'],['destination','origin']]){
    $(side).value=before[other].value;
    $(side+'-kind').value=before[other].kind;
    select(side,before[other].place);
  }
  message('출발지와 도착지를 바꿨습니다. '+(state.origin&&state.destination?'경로 찾기로 반대 방향을 조회하세요.':'장소를 검색해 선택해주세요.')+(activeTripId?' 저장한 이동에 반영하려면 변경 내용 저장을 눌러주세요.':''));
};
for(const side of ['origin','destination']){

  $(side).addEventListener('input',()=>{searchVersions[side]++;select(side,null);$(side+'-results').replaceChildren();});
  $(side+'-kind').addEventListener('change',()=>{searchVersions[side]++;select(side,null);$(side+'-results').replaceChildren();});
  $(side+'-form').addEventListener('submit',async event=>{
    event.preventDefault();const current=++searchVersions[side];const button=event.submitter;button.disabled=true;message('장소를 검색하고 있습니다.');$(side+'-results').replaceChildren();select(side,null);
    try{
      const data=await get('/api/places?'+new URLSearchParams({q:$(side).value,kind:$(side+'-kind').value}));
      if(current!==searchVersions[side])return;
      for(const place of data.places){const item=text('button',`${place.name} — ${place.address}`);item.className='result';item.onclick=()=>{select(side,place);$(side+'-results').replaceChildren();message('선택한 장소의 주소를 확인해주세요.');};$(side+'-results').append(item);}
      message(data.places.length?'검색 결과에서 정확한 장소를 선택하세요.':'검색 결과가 없습니다. 주소/장소 검색 유형이나 검색어를 바꿔보세요.');
    }catch(error){if(current===searchVersions[side])message(error.message);}finally{button.disabled=false;}
  });
}
function editorState(id){activeTripId=id;$('editor-title').textContent=id?'저장한 이동 수정':'새 이동';$('save').textContent=id?'변경 내용 저장':'새 이동 저장';$('save-copy').hidden=!id;}
function loadTrip(trip){
  editorState(trip.id);$('name').value=trip.name;
  for(const side of ['origin','destination']){searchVersions[side]++;$(side).value=trip[side].address;$(side+'-results').replaceChildren();select(side,trip[side]);}
}
function resetEditor(){editorState(null);$('name').value='';for(const side of ['origin','destination']){searchVersions[side]++;$(side).value='';$(side+'-results').replaceChildren();select(side,null);}}
async function renderSaved(){
  const items=await repository.list();$('saved-trips').replaceChildren();
  if(!items.length)$('saved-trips').append(text('p','아직 저장한 이동이 없습니다. 아래에서 장소를 검색해 저장하세요.'));
  for(const trip of items){
    const card=text('article','');card.className='saved-trip';card.append(text('strong',trip.name),text('p',trip.origin.address+' → '+trip.destination.address));
    const actions=text('div','');actions.className='actions';const load=text('button','불러오기');load.setAttribute('aria-label',trip.name+' 불러오기');
    load.onclick=async()=>{try{const latest=await repository.get(trip.id);if(!latest)throw new Error('이동 정보가 삭제되었습니다.');loadTrip(latest);message('이동 정보를 불러왔습니다. 경로 찾기로 최신 경로를 조회하세요.');}catch(e){message(e.message);}};
    const remove=text('button','삭제');remove.className='secondary';remove.setAttribute('aria-label',trip.name+' 삭제');
    remove.onclick=async()=>{if(!confirm('“'+trip.name+'” 이동 정보를 삭제할까요?'))return;try{await repository.remove(trip.id);if(activeTripId===trip.id)resetEditor();await renderSaved();message('저장한 이동을 삭제했습니다.');}catch{message('삭제하지 못했습니다. 브라우저 저장 설정을 확인하세요.');}};
    actions.append(load,remove);card.append(actions);$('saved-trips').append(card);
  }
}
async function saveTrip(asCopy=false){
  if(!state.origin||!state.destination)return message('출발지와 도착지를 검색해 선택한 후 저장하세요.');
  $('save').disabled=true;$('save-copy').disabled=true;
  try{const trip=await repository.save({id:asCopy?null:activeTripId,name:$('name').value,origin:state.origin,destination:state.destination});editorState(trip.id);await renderSaved();message('이동 정보를 저장했습니다. 위 목록에서 다시 불러올 수 있습니다.');}catch(e){message(e.message||'저장하지 못했습니다.');}finally{$('save').disabled=false;$('save-copy').disabled=false;}
}
$('save').onclick=()=>saveTrip();$('save-copy').onclick=()=>saveTrip(true);
$('new-trip').onclick=()=>{resetEditor();message('새 이동의 이름과 장소를 입력하세요.');$('name').focus();};
window.addEventListener('storage',()=>{renderSaved().catch(()=>message('저장 목록을 갱신하지 못했습니다.'));});
$('routes').onclick=async()=>{
  if(!state.origin||!state.destination)return;stopLive();const current=++routeVersion;$('routes').disabled=true;$('route-list').replaceChildren();$('detail').replaceChildren();message('대중교통 경로를 조회하고 있습니다.');
  try{
    const data=await get('/api/routes?'+new URLSearchParams({sx:state.origin.x,sy:state.origin.y,ex:state.destination.x,ey:state.destination.y}));if(current!==routeVersion)return;
    for(const route of data.routes){const card=text('article','');card.className='route';card.append(text('strong',(route.isOptimal?'최적 · ':'')+duration(route.minutes)),text('p',`버스 ${route.busCount}회 · 지하철 ${route.subwayCount}회 · 도보 ${duration(route.walkMinutes)}`),text('p',`예상 요금 ${route.fare??'—'}원`),text('p',route.segments.map(s=>s.type===3?'도보':s.lines.join(' / ')||'대중교통').join(' → ')));const button=text('button','이 경로 자세히 보기');button.onclick=()=>{
      stopLive();$('detail').replaceChildren(text('h2','선택한 경로'),text('p',`버스 ${route.busCount}회 · 지하철 ${route.subwayCount}회 · 총 도보 ${duration(route.walkMinutes)}`));const list=document.createElement('ol');for(const s of route.segments)list.append(text('li',s.type===3?`도보 ${duration(s.minutes)}`:`${s.lines.join(' / ')} · ${s.start} → ${s.end} · ${s.stops??'—'}개 구간 / ${duration(s.minutes)}`));$('detail').append(list);showArrivals(route);$('detail').scrollIntoView({behavior:'smooth'});
    };card.append(button);$('route-list').append(card);}
    message(data.routes.length?`${data.routes.length}개 경로 · 소요시간 → 환승 횟수 → 도보시간 순으로 추천합니다. ${new Date(data.fetchedAt).toLocaleTimeString('ko-KR')} 조회. 표시 시간은 경로 예상치이며 실시간 도착정보가 아닙니다.`:'조회 가능한 경로가 없습니다. 선택한 장소를 확인하세요.');
  }catch(error){if(current===routeVersion)message(error.message);}finally{if(current===routeVersion)$('routes').disabled=!(state.origin&&state.destination);}
};
function showArrivals(route){
  const panel=text('section','');panel.className='panel';panel.append(text('h2','승차 지점의 실시간 도착정보'),text('p','현재 시각 기준입니다. 환승 지점에 도착했을 때의 예측이나 탑승·하차 안내는 아닙니다.'));
  const refresh=text('button','도착정보 새로고침');const label=text('label','');const auto=document.createElement('input');auto.type='checkbox';auto.checked=true;auto.style.width='auto';label.append(auto,document.createTextNode(' 30초마다 자동 갱신 (화면을 보는 동안)'));
  const time=text('p','조회 중…');const results=text('div','');results.setAttribute('aria-live','polite');panel.append(refresh,label,time,results);$('detail').append(panel);
  const generation=liveVersion;let busy=false;
  async function update(){
    if(busy||generation!==liveVersion||document.hidden)return;busy=true;refresh.disabled=true;clearTimeout(liveTimer);results.replaceChildren(text('p','도착정보 조회 중…'));
    try{const data=await get('/api/arrivals?'+new URLSearchParams({route:route.arrivalToken}));if(generation!==liveVersion)return;results.replaceChildren();
      for(const group of data.groups){const section=text('section','');section.className='saved-trip';section.append(text('h3',group.start+' → '+group.end));
        if(!group.items.length)section.append(text('p','연결 가능한 노선 정보가 없습니다.'));
        for(const item of group.items){section.append(text('strong',item.label||'노선'));
          if(item.status!=='ok')section.append(text('p',item.message));
          for(const arrival of item.arrivals){section.append(text('p',arrivalMessage(arrival)));
            if(arrival.note)section.append(text('p',arrival.note));}
        }results.append(section);
      }
      time.textContent='최근 확인: '+new Date(data.checkedAt).toLocaleTimeString('ko-KR');
      if(data.groups.every(g=>g.items.every(i=>['needs_setup','unsupported'].includes(i.status)))){auto.checked=false;time.textContent+=' 연동 설정 후 수동으로 새로고침하세요.';}
    }catch(e){if(generation===liveVersion){results.replaceChildren(text('p',e.message));time.textContent='최신 도착정보를 확인하지 못했습니다.';}}
    finally{busy=false;if(generation===liveVersion){refresh.disabled=false;if(auto.checked&&!document.hidden)liveTimer=setTimeout(update,30000);}}
  }
  resumeLive=()=>{if(auto.checked)update();};
  refresh.onclick=update;auto.onchange=()=>{clearTimeout(liveTimer);if(auto.checked)update();};
  update();
}
document.addEventListener('visibilitychange',()=>{clearTimeout(liveTimer);if(!document.hidden)resumeLive?.();});
async function init(){
  try{const status=await get('/api/status');$('status').textContent=status.kakao&&status.odsay?'장소와 경로를 검색할 수 있습니다.':'검색 서비스 설정이 필요합니다.';}catch{$('status').textContent='개발 서버에 연결하지 못했습니다.';}
  try{await renderSaved();}catch(e){message('저장 목록을 읽지 못했습니다. '+e.message);}
  try{const preset=await get('/api/preset');$('name').value=preset.name; $('origin').value=preset.origin;$('destination').value=preset.destination;}catch{message('기본 장소를 불러오지 못했습니다. 직접 입력해주세요.');}
}
init();
