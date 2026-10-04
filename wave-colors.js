import {waveFieldValue} from './wave-field.js';

// One borrowed, read-only color array for the current geometry and phase.
// A new phase overwrites the same slots; new geometry replaces the whole array.
// The original sine expression and color arithmetic are kept exactly, including
// long-running/saved phases. Probe, focus and density-only redraws can reuse it.
export function createWaveColorCache(){
 let previousField=null,previousPhase=null,colors=[];
 return function getColors(field,phase){
  if(field===previousField&&Object.is(phase,previousPhase))return colors;
  if(field!==previousField)colors=new Array(field.phases.length/2);
  for(let i=0;i<colors.length;i++){
   const v=waveFieldValue(field,i,phase),a=Math.abs(v);
   colors[i]=v>0?`rgb(${18+a*175},${46+a*177},${41+a*55})`:`rgb(${18+a*56},${46+a*107},${41+a*112})`;
  }
  previousField=field;previousPhase=phase;
  return colors;
 };
}
