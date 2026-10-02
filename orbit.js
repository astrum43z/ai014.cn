// Launches use the same inverse-square field as orbitStep outside its softened
// core. The cursor stays at least 22 model units from the center before launch.
export const ORBIT_LAUNCH_MIN=22;
export function orbitLaunchState({x,y},gravity,speedPercent){
 const radius=Math.hypot(x,y);
 const valid=Number.isFinite(radius)&&radius>=ORBIT_LAUNCH_MIN;
 if(!valid)return {radius,valid:false,circularSpeed:null,speed:null,vx:0,vy:0};
 const circularSpeed=Math.sqrt(gravity/radius),speed=circularSpeed*speedPercent/100;
 return {radius,valid:true,circularSpeed,speed,vx:-y/radius*speed,vy:x/radius*speed};
}

// Keep the keyboard marker and its fixed-length direction arrow on screen.
// This only limits placement; existing planets remain free to leave the view.
// A fitted view may use a wider scale after a responsive resize.
export function clampOrbitPoint(point,width,height,scale=Math.min(width,height)/450){
 if(!(scale>0))return {...point};
 const maxX=Math.max(0,(width/2-34)/scale),maxY=Math.max(0,(height/2-34)/scale);
 return {x:Math.max(-maxX,Math.min(maxX,point.x)),y:Math.max(-maxY,Math.min(maxY,point.y))};
}
