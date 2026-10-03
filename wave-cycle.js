// One fixed probe over phase 0..2π. This is a model curve, not stored history.
// Cache only the current geometry; phase animation needs no new samples.
const TAU=2*Math.PI;
export function createWaveCycleCache(){
 let key='',cached;
 return (leftDistance,rightDistance,wavelength)=>{
  const next=[leftDistance,rightDistance,wavelength].join(',');
  if(next===key)return cached;
  key=next;
  const leftPhase=leftDistance/wavelength*TAU,rightPhase=rightDistance/wavelength*TAU;
  const points={left:[],right:[],combined:[]};
  for(let i=0;i<=64;i++){
   const phase=i/64*TAU,left=Math.sin(leftPhase-phase),right=Math.sin(rightPhase-phase);
   const values={left,right,combined:(left+right)/2};
   for(const name of Object.keys(points))points[name].push(`${i/64*600},${28-values[name]*24}`);
  }
  cached=Object.fromEntries(Object.entries(points).map(([name,values])=>[name,values.join(' ')]));
  return cached;
 };
}
export function waveCyclePosition(phase){
 const fraction=((phase%TAU)+TAU)%TAU/TAU;
 // Exact quarter-cycle stepping can accumulate tiny boundary roundoff.
 return (fraction<1e-10||1-fraction<1e-10?0:fraction)*600;
}
