async function json(response){
  let data;try{data=await response.json();}catch{throw new Error('경로 응답을 읽지 못했습니다. 잠시 후 다시 시도하세요.');}
  if(!response.ok)throw new Error(data.error||'경로 조회에 실패했습니다.');return data;
}
export async function searchRoutes(coords,fetcher=fetch){
  const config=await json(await fetcher('/api/route-config'));
  if(config.mode!=='web')return json(await fetcher('/api/routes?'+new URLSearchParams(coords)));
  const url=new URL('https://api.odsay.com/v1/api/searchPubTransPathT');
  url.search=new URLSearchParams({SX:coords.sx,SY:coords.sy,EX:coords.ex,EY:coords.ey,apiKey:config.webKey});
  let response;
  try{response=await fetcher(url,{signal:AbortSignal.timeout(20000),credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});}
  catch{throw new Error('경로 서비스에 연결하지 못했습니다. 등록한 운영 주소로 접속했는지 확인하고 다시 시도하세요.');}
  if(!response.ok)throw new Error(`경로 서비스 요청에 실패했습니다 (${response.status}).`);
  let data;try{data=await response.json();}catch{throw new Error('경로 서비스의 응답 형식이 올바르지 않습니다.');}
  if(data.error&&(Array.isArray(data.error)?data.error.length:true)){
    const errors=Array.isArray(data.error)?data.error:[data.error];
    if(errors.some(e=>/ApiKeyAuthFailed/i.test(e.message||e.msg||'')))throw new Error('웹 경로 검색 인증에 실패했습니다. URI용 키와 등록한 사이트 주소가 일치하는지 확인하세요.');
    const code=errors.map(e=>String(e.code)).find(c=>/^-?\d{1,6}$/.test(c))||'미상';
    throw new Error(`경로를 조회하지 못했습니다 (코드 ${code}). 위치와 서비스 이용 상태를 확인하세요.`);
  }
  if(!Array.isArray(data.result?.path))throw new Error('경로 응답 형식이 올바르지 않습니다.');
  // The server validates and projects this untrusted browser data before signing.
  return json(await fetcher('/api/routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:data.result.path})}));
}
