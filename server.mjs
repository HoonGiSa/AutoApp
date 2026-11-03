import {arrivalTargets,createArrivalService} from './arrivals.mjs';
import {summarizeRoutes} from './routes.mjs';
import {createRouteTokens} from './route-token.mjs';
import {odsayError} from './odsay-errors.mjs';
import {validateBrowserPaths} from './browser-paths.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const arrivals=createArrivalService({fetchJson:upstream});
const root = new URL('./', import.meta.url);
const files = {'/':['public/index.html','text/html'], '/app.js':['public/app.js','text/javascript'], '/arrival-display.js':['public/arrival-display.js','text/javascript'], '/storage.js':['public/storage.js','text/javascript'], '/style.css':['public/style.css','text/css']};
files['/route-search.js']=['public/route-search.js','text/javascript'];
class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
async function upstream(url,headers={}) {
  let response;
  try { response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)}); }
  catch { throw new ApiError(502,'외부 서비스에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'); }
  if(!response.ok) throw new ApiError(502,`외부 API 요청이 거절되었습니다 (${response.status}). 키·권한·허용 IP·호출 한도를 확인하세요.`);
  return response.json();
}
function key(name){const value=process.env[name]?.trim();if(!value)throw new ApiError(503,`${name} 설정이 필요합니다. 서버 환경변수를 확인하고 다시 실행 또는 배포하세요.`);return value;}
function coord(value,min,max){const number=Number(value);if(value===null||value.trim()===''||!Number.isFinite(number)||number<min||number>max)throw new ApiError(400,'선택한 장소의 좌표가 올바르지 않습니다.');return number;}
function routeTokens(){return createRouteTokens({secret:process.env.ROUTE_TOKEN_SECRET||key('ODSAY_API_KEY')});}
function routeResult(paths){
  const codec=routeTokens();
  const tokens=paths.map(p=>codec.issue((p.subPath||[]).map((s,index)=>({index,start:s.startName,end:s.endName,type:s.trafficType,items:arrivalTargets(s)})).filter(g=>g.type!==3)));
  return {routes:summarizeRoutes(paths,tokens),fetchedAt:new Date().toISOString()};
}
export async function api(url,{method='GET',body}={}){
  if(url.pathname==='/api/status')return {kakao:!!process.env.KAKAO_REST_API_KEY,odsay:!!(process.env.ODSAY_WEB_API_KEY||process.env.ODSAY_API_KEY)};
  if(url.pathname==='/api/route-config'){
    const webKey=process.env.ODSAY_WEB_API_KEY?.trim();
    // Never fall back to returning the server key. Only URI/browser keys belong here.
    if(webKey&&webKey===process.env.ODSAY_API_KEY?.trim())throw new ApiError(503,'웹 키와 서버 키가 같게 설정돼 있습니다. 별도로 발급된 URI용 키를 설정하세요.');
    return webKey?{mode:'web',webKey}:{mode:'server'};
  }
  if(url.pathname==='/api/arrivals'){
    const targets=routeTokens().read(url.searchParams.get('route'));
    if(!targets)throw new ApiError(410,'경로 조회가 만료되었거나 유효하지 않습니다. 경로 찾기를 다시 눌러주세요.');
    const groups=await Promise.all(targets.map(async g=>({...g,items:await Promise.all(g.items.map(t=>arrivals.get(t)))})));
    return {groups,checkedAt:new Date().toISOString()};
  }
  if(url.pathname==='/api/preset'){
    if(process.env.VERCEL)return {name:'출근',origin:'',destination:''};
    try{return JSON.parse(await readFile(new URL('local-settings.json',root),'utf8'));}
    catch{return {name:'출근',origin:'',destination:''};}
  }
  if(url.pathname==='/api/places'){
    const query=url.searchParams.get('q')?.trim();
    if(!query||query.length>150)throw new ApiError(400,'주소 또는 장소명을 150자 이내로 입력하세요.');
    const kind=url.searchParams.get('kind')==='address'?'address':'keyword';
    const endpoint=new URL(`https://dapi.kakao.com/v2/local/search/${kind}.json`);
    endpoint.search=new URLSearchParams({query,size:'10'}).toString();
    const data=await upstream(endpoint,{Authorization:`KakaoAK ${key('KAKAO_REST_API_KEY')}`});
    return {places:(data.documents||[]).map(d=>({name:d.place_name||d.road_address?.building_name||d.address_name,address:d.road_address_name||d.road_address?.address_name||d.address_name,x:d.x,y:d.y}))};
  }
  if(url.pathname==='/api/routes'){
    if(method==='POST'){
      if(!process.env.ODSAY_WEB_API_KEY?.trim())throw new ApiError(503,'웹 경로 검색 설정이 필요합니다.');
      let paths;try{paths=validateBrowserPaths(body);}catch{throw new ApiError(400,'경로 응답이 올바르지 않거나 허용 크기를 초과했습니다.');}
      return routeResult(paths);
    }
    const params={SX:coord(url.searchParams.get('sx'),-180,180),SY:coord(url.searchParams.get('sy'),-90,90),EX:coord(url.searchParams.get('ex'),-180,180),EY:coord(url.searchParams.get('ey'),-90,90),apiKey:key('ODSAY_API_KEY')};
    const endpoint=new URL('https://api.odsay.com/v1/api/searchPubTransPathT');endpoint.search=new URLSearchParams(params).toString();
    const data=await upstream(endpoint);
    const failure=odsayError(data);
    if(failure){console.warn('Route provider rejected request',JSON.stringify({code:failure.code,reason:failure.reason}));throw new ApiError(502,failure.message);}
    return routeResult(data.result?.path||[]);
  }
  throw new ApiError(404,'요청한 기능을 찾지 못했습니다.');
}
export default async function handler(req,res){
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  if(!process.env.VERCEL&&req.headers.host!=='127.0.0.1:4317'&&req.headers.host!=='localhost:4317')return send(403,{error:'로컬 개발 주소로 접속하세요.'});
  const url=new URL(req.url,'http://localhost:4317');
  if(req.method!=='GET'&&!(req.method==='POST'&&url.pathname==='/api/routes'))return send(405,{error:'지원하지 않는 요청입니다.'});
  try{
    let body;
    if(req.method==='POST'){
      if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'같은 사이트에서 요청하세요.'});
      if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))return send(415,{error:'JSON 요청이 필요합니다.'});
      const limit=1024*1024;
      if(Number(req.headers['content-length'])>limit)return send(413,{error:'경로 데이터가 너무 큽니다.'});
      if(req.body!==undefined){const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(raw)>limit)return send(413,{error:'경로 데이터가 너무 큽니다.'});try{body=JSON.parse(raw);}catch{return send(400,{error:'JSON 형식이 올바르지 않습니다.'});}}
      else{const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>limit)return send(413,{error:'경로 데이터가 너무 큽니다.'});chunks.push(Buffer.from(chunk));}try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'JSON 형식이 올바르지 않습니다.'});}}
    }
    if(url.pathname.startsWith('/api/'))return send(200,await api(url,{method:req.method,body}));
    if(!files[url.pathname])return send(404,{error:'페이지를 찾지 못했습니다.'});
    const [file,type]=files[url.pathname];
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.odsay.com; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});
    res.end(await readFile(new URL(file,root)));
  }catch(error){send(error.status||500,{error:error.status?error.message:'처리 중 오류가 발생했습니다. 설정과 외부 서비스 상태를 확인하세요.'});}
}
export function startServer(){return http.createServer(handler).listen(4317,'127.0.0.1',()=>console.log('개발 화면: http://127.0.0.1:4317'));}
if(!process.env.VERCEL&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startServer();
