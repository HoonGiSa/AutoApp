import {createHmac,timingSafeEqual} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';

// A signed, short-lived transit description works across separate function instances.
// Contains only transit stops/line IDs; no API keys or searched street addresses.
export function createRouteTokens({secret,now=()=>Date.now()}){
  if(!secret)throw new Error('Route token secret is missing');
  const sign=payload=>createHmac('sha256',secret).update('AutoApp-route-v1:'+payload).digest();
  return {
    issue(groups){
      const payload=deflateRawSync(Buffer.from(JSON.stringify({v:1,expires:now()+1800000,groups}))).toString('base64url');
      return payload+'.'+sign(payload).toString('base64url');
    },
    read(token){
      try{
        if(typeof token!=='string'||token.length>12000)return null;
        const parts=token.split('.');if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return null;
        const [payload,signature]=parts;const mac=Buffer.from(signature,'base64url');const expected=sign(payload);
        if(mac.length!==expected.length||!timingSafeEqual(mac,expected))return null;
        const data=JSON.parse(inflateRawSync(Buffer.from(payload,'base64url'),{maxOutputLength:65536}).toString());
        if(data.v!==1||!Number.isFinite(data.expires)||data.expires<=now()||!Array.isArray(data.groups))return null;
        return data.groups;
      }catch{return null;}
    }
  };
}
