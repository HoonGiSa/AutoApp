export function arrivalMessage(arrival){
  return arrival.message+(arrival.kind?' · '+arrival.kind:'')+(arrival.destination?' · '+arrival.destination+' 방면':'');
}
