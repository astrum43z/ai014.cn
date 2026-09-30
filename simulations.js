export function lifeStep(cells, cols, rows) {
 const next = new Uint8Array(cells.length);
 for (let y=0;y<rows;y++) for(let x=0;x<cols;x++) {let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)n+=cells[((y+dy+rows)%rows)*cols+(x+dx+cols)%cols];const i=y*cols+x;next[i]=n===3||(cells[i]&&n===2)?1:0;}return next;
}
export function orbitStep(body,gravity,dt){const r=Math.hypot(body.x,body.y),d=Math.max(r,18);body.vx-=gravity*body.x/(d*d*d)*dt;body.vy-=gravity*body.y/(d*d*d)*dt;body.x+=body.vx*dt;body.y+=body.vy*dt;return body;}
export function waveValue(x,y,t,separation,wavelength){const a=Math.hypot(x-separation/2,y),b=Math.hypot(x+separation/2,y);return (Math.sin(a/wavelength*2*Math.PI-t)+Math.sin(b/wavelength*2*Math.PI-t))/2;}
