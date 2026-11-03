import test from 'node:test';
import assert from 'node:assert/strict';
import {arrivalMessage} from './public/arrival-display.js';
test('valid arrivals remain visible regardless of provider age',()=>{
  const now=Date.parse('2026-10-07T12:00:00+09:00');
  const row={message:'2분 후',sourceTime:'2026-10-07 11:57:59',kind:'일반'};
  assert.equal(arrivalMessage({...row,stale:true}),'2분 후 · 일반');
  assert.equal(arrivalMessage({...row,sourceTime:'2026-10-07 11:59:30'},new Date(now).toISOString(),now),'2분 후 · 일반');
});
test('elapsed time does not replace bus arrival messages',()=>{
  const at='2026-10-07T03:00:00Z';const now=Date.parse(at);
  assert.equal(arrivalMessage({message:'5분 후'},at,now),'5분 후');
  assert.equal(arrivalMessage({message:'5분 후'},at,now+120001),'5분 후');
  assert.equal(arrivalMessage({message:'5분 후',stale:true},at,now),'5분 후');
});
