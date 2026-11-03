// ODsay returns errors both as an object and as an array. Never echo raw
// upstream messages: they can contain request details or credentials.
export function odsayError(data){
  const errors=Array.isArray(data?.error)?data.error:data?.error?[data.error]:[];
  if(!errors.length)return null;
  const codes=errors.map(e=>String(e?.code??''));
  const code=codes.find(c=>/^-?\d{1,6}$/.test(c))??'미상';
  const descriptions=errors.map(e=>String(e?.message??e?.msg??''));
  if(descriptions.some(s=>/ApiKeyAuthFailed/i.test(s)))return {code,reason:'AUTH_FAILED',message:`경로 검색 인증에 실패했습니다 (코드 ${code}). 서버용 API 키와 허용 서버 IP 설정을 확인하세요.`};
  if(code==='-8'||code==='-9')return {code,reason:'INVALID_INPUT',message:`경로 검색의 위치 정보가 올바르지 않습니다 (코드 ${code}). 출발지와 도착지를 다시 검색해 선택하세요.`};
  return {code,reason:'UPSTREAM_ERROR',message:`경로를 가져오지 못했습니다 (코드 ${code}). API 이용 상태·호출 한도·서비스 설정을 확인하세요.`};
}
