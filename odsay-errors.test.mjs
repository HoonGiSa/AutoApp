import test from 'node:test';
import assert from 'node:assert/strict';
import {odsayError} from './odsay-errors.mjs';
test('array and object authentication errors yield the real code',()=>{
 const error={code:'500',message:'[ApiKeyAuthFailed] ApiKey authentication failed.'};
 for(const shape of [error,[error]]){const result=odsayError({error:shape});assert.equal(result.code,'500');assert.equal(result.reason,'AUTH_FAILED');assert.match(result.message,/서버 IP/);}
});
test('raw messages or malformed codes never expose upstream credentials',()=>{
 const result=odsayError({error:[{code:'secret-bearing-url',message:'https://api.example/?apiKey=secret'}]});
 assert.equal(result.code,'미상');assert.ok(!JSON.stringify(result).includes('secret'));
 assert.equal(odsayError({error:{code:-8}}).reason,'INVALID_INPUT');
 assert.equal(odsayError({error:[]}),null);assert.equal(odsayError({result:{path:[]}}),null);
});
