import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteTokens} from './route-token.mjs';
test('routes survive a different instance and expire after 30 minutes',()=>{
 let now=1000000;const secret='test-only-secret';
 const first=createRouteTokens({secret,now:()=>now});
 const groups=[{start:'시청',end:'영등포',type:1,items:[{provider:'subway',lineId:'1001',nextStation:'서울역'}]}];
 const token=first.issue(groups);
 const second=createRouteTokens({secret,now:()=>now});
 assert.deepEqual(second.read(token),groups);
 now+=1800000;assert.equal(second.read(token),null);
});
test('tampered tokens, wrong keys, malformed and oversized inputs are rejected',()=>{
 const codec=createRouteTokens({secret:'test-only-secret'});const token=codec.issue([]);
 assert.equal(createRouteTokens({secret:'another-secret'}).read(token),null);
 const [payload,sig]=token.split('.');
 assert.equal(codec.read(payload+'.'+(sig[0]==='a'?'b':'a')+sig.slice(1)),null);
 for(const value of [null,'bad','x.y.z','x'.repeat(12001)])assert.equal(codec.read(value),null);
});
