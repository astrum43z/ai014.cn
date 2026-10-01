// The stepper and inspector share one B3/S23 rule and toroidal neighborhood.
export function lifeNeighborCount(cells,cols,rows,x,y){
 let count=0;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(dx||dy)count+=cells[((y+dy+rows)%rows)*cols+(x+dx+cols)%cols];
 }
 return count;
}
export function lifeNextState(alive,neighbors){return neighbors===3||(alive&&neighbors===2)?1:0;}
export function inspectLifeCell(cells,cols,rows,x,y){
 const alive=cells[y*cols+x],neighbors=lifeNeighborCount(cells,cols,rows,x,y);
 const next=lifeNextState(alive,neighbors),neighborhood=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  neighborhood.push(cells[((y+dy+rows)%rows)*cols+(x+dx+cols)%cols]);
 }
 const rule=alive?(next?'survive':neighbors<2?'lonely':'crowded'):(next?'born':'empty');
 return {alive,neighbors,next,rule,neighborhood};
}
export function lifeStep(cells,cols,rows){
 const next=new Uint8Array(cells.length);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const i=y*cols+x;
  next[i]=lifeNextState(cells[i],lifeNeighborCount(cells,cols,rows,x,y));
 }
 return next;
}
export function orbitStep(body,gravity,dt){const r=Math.hypot(body.x,body.y),d=Math.max(r,18);body.vx-=gravity*body.x/(d*d*d)*dt;body.vy-=gravity*body.y/(d*d*d)*dt;body.x+=body.vx*dt;body.y+=body.vy*dt;return body;}
export function waveValue(x,y,t,separation,wavelength){const a=Math.hypot(x-separation/2,y),b=Math.hypot(x+separation/2,y);return (Math.sin(a/wavelength*2*Math.PI-t)+Math.sin(b/wavelength*2*Math.PI-t))/2;}
export function parseSettings(search, configs){const params=new URLSearchParams(search);const mode=Object.hasOwn(configs,params.get('experiment'))?params.get('experiment'):'orbit';const values={};for(const [id,,min,max,initial] of configs[mode].sliders){const raw=params.get(id);const n=raw===null?initial:Number(raw);values[id]=Number.isFinite(n)?Math.round(Math.min(max,Math.max(min,n))):initial;}return {mode,values};}
export function serializeSettings(mode, values){const params=new URLSearchParams({experiment:mode});for(const [k,v] of Object.entries(values))params.set(k,String(v));return params.toString();}
export function population(cells){return cells.reduce((a,b)=>a+b,0);}
export function repeatPeriod(history,cells,generation){const key=Array.from(cells).join('');for(let i=history.length-1;i>=0;i--){if(history[i].generation<generation&&history[i].key===key)return generation-history[i].generation;}return null;}
export function wavePathDifference(x,y,separation,wavelength){const difference=Math.abs(Math.hypot(x-separation/2,y)-Math.hypot(x+separation/2,y));const cycles=difference/wavelength;const fraction=cycles-Math.floor(cycles);return {difference,cycles,envelope:Math.abs(Math.cos(Math.PI*cycles)),kind:Math.min(fraction,1-fraction)<.1?'constructive':Math.abs(fraction-.5)<.1?'destructive':'mixed'};}

// Unit-amplitude contributions at the probe. The field uses their average
// solely to keep the display range within [-1, 1], not to change superposition.
export function waveComponents(x,y,phase,separation,wavelength){
 const left=Math.sin(Math.hypot(x+separation/2,y)/wavelength*2*Math.PI-phase);
 const right=Math.sin(Math.hypot(x-separation/2,y)/wavelength*2*Math.PI-phase);
 return {left,right,combined:(left+right)/2,envelope:wavePathDifference(x,y,separation,wavelength).envelope};
}
