// Only geometry is cached. Keep the original sine evaluation each frame so
// even long-running/saved phases produce exactly the same field values.
export const WAVE_GRID_STEP=5;
export function createWaveFieldCache(){
 let field=null;
 return function getField(width,height,scale,separation,wavelength){
  if(field&&field.width===width&&field.height===height&&field.scale===scale&&field.separation===separation&&field.wavelength===wavelength)return field;
  const columns=Math.ceil(width/WAVE_GRID_STEP),rows=Math.ceil(height/WAVE_GRID_STEP);
  const phases=new Float64Array(columns*rows*2);
  let i=0;
  for(let y=0;y<height;y+=WAVE_GRID_STEP)for(let x=0;x<width;x+=WAVE_GRID_STEP){
   const modelX=(x-width/2)/scale,modelY=(y-height/2)/scale;
   phases[i++]=Math.hypot(modelX-separation/2,modelY)/wavelength*2*Math.PI;
   phases[i++]=Math.hypot(modelX+separation/2,modelY)/wavelength*2*Math.PI;
  }
  // Replace, rather than accumulate, grids on resize or parameter changes.
  field={width,height,scale,separation,wavelength,columns,rows,phases};
  return field;
 };
}
export function waveFieldValue(field,index,phase){
 const offset=index*2;
 return (Math.sin(field.phases[offset]-phase)+Math.sin(field.phases[offset+1]-phase))/2;
}
