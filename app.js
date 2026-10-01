import {createFractal,addFractalPoints,fractalVertices,FRACTAL_LIMIT} from './fractal.js';
import {experimentGuides} from './guides.js';
import {createSnapshotSaver} from './snapshot.js';
import {createAnimationLoop} from './animation.js';
import {lifeStep,orbitStep,waveValue,population,repeatPeriod,wavePathDifference,parseSettings,serializeSettings} from './simulations.js';
const $=s=>document.querySelector(s), canvas=$('#canvas'),ctx=canvas.getContext('2d');
const configs={orbit:{title:'引力游乐场',heading:'轻轻改变引力',description:'一颗恒星，几位旅行者。改变引力或发射速度，观察轨道如何弯曲。',sliders:[['gravity','引力强度',30,160,80,''],['speed','新行星速度',30,150,100,'%']],challenge:'把引力调小，再放入一颗行星。它还会留在这个世界吗？',explanation:'引力把行星拉向中心，而切向速度让它不断错过中心。两者的平衡，塑造出不同的轨道。试着在同一个位置，用不同速度发射行星。',note:'简化二维模型：固定中心天体，不计算行星间引力；近中心采用软化处理。',hint:'点击画布，放入一颗行星',learn:'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/'},life:{title:'生命的形状',heading:'规则简单，未来不简单',description:'每个小格子只有生与灭。邻居的数量，决定它在下一代的命运。',sliders:[['rate','演化速度',1,20,8,' 代/秒'],['density','随机初始密度',10,60,30,'%']],challenge:'暂停后点击格子画一个图案，再继续。它会消失、循环，还是移动？',explanation:'一个活格子有 2 或 3 个邻居就存活，否则消失；空格恰好有 3 个邻居就诞生。这是 Conway 的生命游戏。本实验边缘相连：从右侧离开，会回到左侧。',note:'密度只影响下一次“随机播种”。键盘聚焦画布后用方向键移动光标，Enter 或空格切换格子；操作会自动暂停。',hint:'轻点播种 · 拖动绘制 · 方向键 + Enter',learn:'https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life'},wave:{title:'波与波相遇',heading:'相遇，也是一种创造',description:'两个同频波源不断扩散。明暗纹路，是它们相互加强与抵消留下的足迹。',sliders:[['wavelength','波长',15,70,32,''],['separation','波源间距',20,180,100,'']],challenge:'增大两个波源之间的距离。中间的条纹会变得更密，还是更疏？',explanation:'两个波在同一点的位移直接相加。同相时振幅增强，反相时相互抵消。颜色表示此刻的正负位移，亮度表示位移的大小；它不是水面高度的真实三维图。',note:'理想二维同频点波源，忽略振幅随距离衰减与边界反射。',hint:'轻点画布放置探针，测量波程差',learn:'https://openstax.org/books/university-physics-volume-1/pages/16-5-interference-of-waves'}};
configs.fractal={title:'随机长出秩序',heading:'每次只走一半',description:'随机选择三角形的一个顶点，向它走一段。重复这件小事，让空白慢慢长出结构。',sliders:[['jump','向顶点前进',35,70,50,'%'],['seed','随机种子',1,99,14,'']],explanation:'每一步随机选一个顶点，再按设定比例靠近它。前进 50% 时，三个缩小到一半的副本组成谢尔宾斯基三角形；理想无限图形的维数为 log(3) / log(2) ≈ 1.585。改变比例会改变图形，不再套用这个维数。',note:'有限点数与像素近似；最多 12,000 点后自动暂停。伪随机序列由种子决定。同参数、同点数可复现；更改参数会从 300 点重新开始。',hint:'随机选顶点 → 靠近 → 留下一个点',learn:'https://mathworld.wolfram.com/ChaosGame.html'};
const presets={orbit:[['环形舞步','circular'],['椭圆旅行','elliptic'],['逃逸边界','escape']],life:[['滑翔机','glider'],['闪烁振子','blinker'],['脉冲星','pulsar'],['随机花园','random']],wave:[['交错条纹','ripple'],['宽波远行','wide'],['紧密双源','close']]};
presets.fractal=[['半程 · 三角形','half'],['慢一点 · 重叠','overlap'],['远一点 · 岛屿','islands']];
let fractal;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let mode='orbit', values={},paused=reducedMotion.matches,t=0,acc=0,generation=0,bodies=[],cells=new Uint8Array(48*32),preset=0,focusCell={x:24,y:16},canvasFocused=false,width=600,height=414;
let lifeHistory=[],probe={x:0,y:0};
let animation, stageVisible=true;
const palette=['#d3f35b','#f59c80','#e7eee1','#87c2b1','#c7b1e8'];
function announce(text){$('#announcement').textContent=text;}
function updatePause(){animation?.sync();$('#pause').textContent=paused?'继续':'暂停';$('#status').textContent=paused?'已暂停':'运行中';$('#pause').setAttribute('aria-label',paused?'继续模拟':'暂停模拟');}
function reset(){cancelPainting();t=0;generation=0;acc=0;lifeHistory=[];probe={x:0,y:0};if(mode==='orbit'){bodies=[75,125,180].map((r,i)=>({x:r,y:0,vx:0,vy:Math.sqrt(values.gravity*1000/r)*(i===1?.86:1),trail:[],color:palette[i]}));}if(mode==='fractal')fractal=addFractalPoints(createFractal(values.seed,values.jump),300);if(mode==='life'){cells=new Uint8Array(48*32);[[0,1],[1,2],[2,0],[2,1],[2,2]].forEach(([y,x])=>cells[(y+14)*48+x+22]=1);[[0,1],[0,2],[1,0],[1,1],[2,1]].forEach(([y,x])=>cells[(y+6)*48+x+10]=1);}draw();announce('实验已重置');}
function changeMode(next,sharedValues=null){mode=next;preset=0;const c=configs[mode];values=sharedValues||Object.fromEntries(c.sliders.map(s=>[s[0],s[4]]));document.querySelectorAll('.tab').forEach(tab=>{const selected=tab.dataset.mode===mode;tab.classList.toggle('active',selected);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});$('#panel').setAttribute('aria-labelledby','tab-'+mode);$('#stage-title').textContent=`0${Object.keys(configs).indexOf(mode)+1} — ${c.title}`;$('#control-title').textContent=c.heading;$('#description').textContent=c.description;$('#challenge').textContent=experimentGuides[mode].instructions;$('#guide-title').textContent=experimentGuides[mode].title;$('#explanation').textContent=c.explanation;$('#model-note').textContent=c.note;$('#hint').textContent=c.hint;$('#learn').href=c.learn;canvas.setAttribute('aria-label',c.title+'模拟；'+c.hint);$('#preset').textContent=mode==='life'?'随机播种 ↗':mode==='wave'?'换一组波源 ↗':'换一种初始状态 ↗';$('#preset-select').innerHTML=presets[mode].map(([label,value])=>`<option value="${value}">${label}</option>`).join('');$('#step').textContent=mode==='life'?'下一代 +1':mode==='fractal'?'增加 100 点 +':'前进一步 +';$('#clear').hidden=mode!=='life';$('#share-link').hidden=true;$('#sliders').innerHTML=c.sliders.map(([id,label,min,max,initial,unit])=>{const value=values[id];return `<label class="slider"><span>${label}<output id="out-${id}" for="${id}">${value}${unit}</output></span><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" aria-label="${label}"></label>`;}).join('');c.sliders.forEach(([id,,min,max,v,unit])=>$('#'+id).addEventListener('input',e=>{values[id]=+e.target.value;$('#out-'+id).textContent=values[id]+unit;if(mode==='fractal')reset();else draw();updateAddress();}));updatePause();reset();updateAddress();}
function updateAddress(){
  history.replaceState(history.state,'','?'+serializeSettings(mode,values)+(location.hash==='#lab'?'#lab':''));
  refreshShareLink();
}
function refreshShareLink(){const input=$('#share-link');if(!input.hidden)input.value=location.href;}
function addressSettings(){
  if(location.search)return parseSettings(location.search,configs);
  const next=Object.hasOwn(configs,location.hash.slice(1))?location.hash.slice(1):'orbit';
  return parseSettings('?experiment='+next,configs);
}
function restoreAddress(){
  const shared=addressSettings();
  // Anchor-only Back/Forward must not discard a drawing or simulation progress.
  if(mode===shared.mode&&Object.keys(shared.values).every(id=>values[id]===shared.values[id])){
    refreshShareLink();
    return;
  }
  changeMode(shared.mode,shared.values);
}
addEventListener('popstate',restoreAddress);
function fit(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
function coordinates(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)/r.width*width,y:(event.clientY-r.top)/r.height*height};}
canvas.addEventListener('click',e=>{if(cancelledClickPointer!==null&&(e.pointerId===undefined||e.pointerId===cancelledClickPointer)){cancelledClickPointer=null;wasDragging=false;return;}if(mode==='life'&&wasDragging){wasDragging=false;return;}const p=coordinates(e);if(mode==='life'){const x=Math.min(47,Math.floor(p.x/width*48)),y=Math.min(31,Math.floor(p.y/height*32));cells[y*48+x]^=1;lifeHistory=[];focusCell={x,y};draw();announce(`第 ${x+1} 列，第 ${y+1} 行：${cells[y*48+x]?'生':'灭'}`);}if(mode==='wave'){const scale=Math.min(width,height)/280;probe={x:(p.x-width/2)/scale,y:(p.y-height/2)/scale};draw();announce('测量探针已移动');}if(mode==='orbit'){if(bodies.length>=24){announce('最多放入 24 颗行星，请重置后重试');return;}const scale=Math.min(width,height)/450,x=(p.x-width/2)/scale,y=(p.y-height/2)/scale,r=Math.hypot(x,y);if(r<22){announce('请在恒星外侧放入行星');return;}const speed=Math.sqrt(values.gravity*1000/r)*values.speed/100;bodies.push({x,y,vx:-y/r*speed,vy:x/r*speed,trail:[],color:palette[bodies.length%palette.length]});draw();announce('已添加行星');}});
canvas.addEventListener('focus',()=>{canvasFocused=true;draw();});canvas.addEventListener('blur',()=>{canvasFocused=false;draw();});canvas.addEventListener('keydown',e=>{if(mode!=='life')return;if(e.altKey||e.ctrlKey||e.metaKey)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key)){e.preventDefault();paused=true;updatePause();if(e.key==='ArrowLeft')focusCell.x=(focusCell.x+47)%48;if(e.key==='ArrowRight')focusCell.x=(focusCell.x+1)%48;if(e.key==='ArrowUp')focusCell.y=(focusCell.y+31)%32;if(e.key==='ArrowDown')focusCell.y=(focusCell.y+1)%32;if(e.key==='Enter'||e.key===' '){cells[focusCell.y*48+focusCell.x]^=1;lifeHistory=[];}draw();announce(`已暂停；第 ${focusCell.x+1} 列，第 ${focusCell.y+1} 行：${cells[focusCell.y*48+focusCell.x]?'生':'灭'}`);}});
function observe(){const a=$('#observation-a'),b=$('#observation-b'),c=$('#observation-c'),detail=$('#observation-detail');$('#history-plot').hidden=mode!=='life';if(mode==='orbit'){const body=bodies[0],r=Math.hypot(body.x,body.y),v=Math.hypot(body.vx,body.vy);a.textContent='首颗行星距离 · '+r.toFixed(1);b.textContent='首颗行星速率 · '+v.toFixed(1);c.textContent='活跃天体 · '+bodies.length;detail.textContent='距离和速率使用模型单位。调弱引力后，比较同一颗行星的距离变化；想公平比较，请先重置，再只改一个参数。';}if(mode==='life'){if(lifeHistory.at(-1)?.generation===generation)lifeHistory.pop();const count=population(cells),period=repeatPeriod(lifeHistory,cells,generation);lifeHistory.push({generation,key:Array.from(cells).join(''),count});if(lifeHistory.length>120)lifeHistory.shift();a.textContent='活细胞 · '+count;b.textContent='占用率 · '+(count/cells.length*100).toFixed(1)+'%';c.textContent=count===0?'状态 · 全部消失':period===1?'状态 · 静止图案':period?'重复周期 · '+period+' 代':'状态 · 尚未发现重复';const max=Math.max(1,...lifeHistory.map(p=>p.count));$('#history-line').setAttribute('points',lifeHistory.map((p,i)=>`${i/Math.max(1,lifeHistory.length-1)*600},${64-p.count/max*56}`).join(' '));$('#history-plot').setAttribute('aria-label',`最近 ${lifeHistory.length} 次观测的活细胞数量，当前 ${count}`);detail.textContent='折线记录最近 120 次观测的数量，纵轴自动缩放。周期判断比较完全相同的棋盘，不把平移后的滑翔机算作重复；只检查最近 120 次观测，未发现重复不代表永不重复；编辑画布会重新开始记录。';}if(mode==='fractal'){a.textContent='已留下 · '+fractal.count+' / '+FRACTAL_LIMIT+' 点';b.textContent='每次前进 · '+values.jump+'%';c.textContent='随机种子 · '+values.seed;detail.textContent=values.jump===50?'50%：观察中央的空三角形，再找角落里的更小空三角形。换一个种子，比较相同点数：落点顺序改变，整体结构仍相似。颜色仅用于显示点，不表示概率或维数。':'当前不是 50%：比较空隙和重叠怎样变化。维数 1.585 只对应 50% 的理想谢尔宾斯基三角形，不适用于当前比例。';}if(mode==='wave'){const d=wavePathDifference(probe.x,probe.y,values.separation,values.wavelength);a.textContent='波程差 Δr · '+d.difference.toFixed(1);b.textContent='Δr / λ · '+d.cycles.toFixed(2);c.textContent='相遇方式 · '+({constructive:'接近加强',destructive:'接近抵消',mixed:'部分叠加'}[d.kind]);detail.textContent='数值使用模型单位。轻点画布移动白色探针。两条路径相差整数个波长时加强，相差半整数个波长时抵消。“接近”指与上述位置相差不到 0.1 个波长；它描述振幅包络，不是这一瞬间的位移。';}}
function draw(){ctx.clearRect(0,0,width,height);ctx.fillStyle='#122e29';ctx.fillRect(0,0,width,height);if(mode==='orbit'){const scale=Math.min(width,height)/450;ctx.save();ctx.translate(width/2,height/2);ctx.scale(scale,scale);ctx.strokeStyle='#29443a';ctx.lineWidth=1/scale;[50,100,150,200].forEach(r=>{ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();});ctx.strokeStyle='#385046';ctx.beginPath();ctx.moveTo(-width/scale/2,0);ctx.lineTo(width/scale/2,0);ctx.moveTo(0,-height/scale/2);ctx.lineTo(0,height/scale/2);ctx.stroke();const glow=ctx.createRadialGradient(0,0,3,0,0,38);glow.addColorStop(0,'#d3f35b88');glow.addColorStop(1,'#d3f35b00');ctx.fillStyle=glow;ctx.fillRect(-38,-38,76,76);ctx.fillStyle='#d3f35b';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();bodies.forEach(b=>{ctx.strokeStyle=b.color+'75';ctx.lineWidth=1.3/scale;ctx.beginPath();b.trail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,4.5/scale,0,Math.PI*2);ctx.fill();});ctx.restore();$('#metrics').textContent=`${bodies.length} 颗行星 · t + ${t.toFixed(1)} s`;}else if(mode==='life'){const cw=width/48,ch=height/32;ctx.fillStyle='#d3f35b';cells.forEach((v,i)=>{if(v)ctx.fillRect((i%48)*cw+.6,Math.floor(i/48)*ch+.6,Math.max(1,cw-1.2),Math.max(1,ch-1.2));});ctx.strokeStyle='#26443a';ctx.lineWidth=.5;for(let x=0;x<=48;x++){ctx.beginPath();ctx.moveTo(x*cw,0);ctx.lineTo(x*cw,height);ctx.stroke();}for(let y=0;y<=32;y++){ctx.beginPath();ctx.moveTo(0,y*ch);ctx.lineTo(width,y*ch);ctx.stroke();}if(canvasFocused){ctx.strokeStyle='#ffac86';ctx.lineWidth=2;ctx.strokeRect(focusCell.x*cw,focusCell.y*ch,cw,ch);}$('#metrics').textContent=`第 ${generation} 代 · ${cells.reduce((a,b)=>a+b,0)} 个活格子`;}else if(mode==='fractal'){drawFractal();}else{const scale=Math.min(width,height)/280,step=5;for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){const v=waveValue((x-width/2)/scale,(y-height/2)/scale,t*3,values.separation,values.wavelength),a=Math.abs(v);ctx.fillStyle=v>0?`rgb(${18+a*175},${46+a*177},${41+a*55})`:`rgb(${18+a*56},${46+a*107},${41+a*112})`;ctx.fillRect(x,y,step,step);}for(const sign of [-1,1]){ctx.fillStyle='#f4f5eb';ctx.beginPath();ctx.arc(width/2+sign*values.separation/2*scale,height/2,4,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#fff';ctx.lineWidth=1;const px=width/2+probe.x*scale,py=height/2+probe.y*scale;ctx.beginPath();ctx.arc(px,py,9,0,Math.PI*2);ctx.moveTo(px-14,py);ctx.lineTo(px+14,py);ctx.moveTo(px,py-14);ctx.lineTo(px,py+14);ctx.stroke();$('#metrics').textContent=`2 个同频波源 · 波长 ${values.wavelength} · t + ${t.toFixed(1)} s`;}observe();}
function advance(dt){t+=dt;if(mode==='fractal'){acc+=dt;if(acc<.1)return;acc%=.1;growFractal();draw();return;}if(mode==='orbit'){bodies.forEach(b=>{for(let i=0;i<4;i++)orbitStep(b,values.gravity*1000,dt/4);b.trail.push([b.x,b.y]);if(b.trail.length>220)b.trail.shift();});}if(mode==='life'){acc+=dt;let changed=false;while(acc>=1/values.rate){cells=lifeStep(cells,48,32);generation++;acc-=1/values.rate;changed=true;}if(!changed)return;}draw();}
$('#pause').addEventListener('click',()=>{if(mode==='fractal'&&fractal.count>=FRACTAL_LIMIT){announce('已达到 12,000 点；请重置或改变参数后继续');return;}paused=!paused;updatePause();announce(paused?'模拟已暂停':'模拟已继续');});$('#reset').addEventListener('click',reset);function applyPreset(name){if(mode==='fractal'){values.jump={half:50,overlap:38,islands:65}[name];$('#jump').value=values.jump;$('#out-jump').textContent=values.jump+'%';}reset();if(mode==='orbit'){bodies.forEach(b=>{b.vy*=name==='elliptic'?.65:name==='escape'?1.45:1;});}if(mode==='life'){cells=new Uint8Array(48*32);if(name==='random'){cells=Uint8Array.from({length:48*32},()=>Math.random()<values.density/100?1:0);}else{let points=name==='blinker'?[[0,0],[1,0],[2,0]]:name==='pulsar'?[]:[[1,0],[2,1],[0,2],[1,2],[2,2]];if(name==='pulsar'){for(const a of [2,3,4,8,9,10])for(const b of [0,5,7,12]){points.push([a,b],[b,a]);}}const ox=name==='pulsar'?17:22,oy=name==='pulsar'?9:14;points.forEach(([x,y])=>cells[(oy+y)*48+ox+x]=1);}}if(mode==='wave'){const options={ripple:[32,100],wide:[65,150],close:[28,35]};[values.wavelength,values.separation]=options[name];for(const id of ['wavelength','separation']){$('#'+id).value=values[id];$('#out-'+id).textContent=values[id];}}draw();updateAddress();announce('已载入预设：'+presets[mode].find(p=>p[1]===name)[0]);}
// Guided starts are explicit, repeatable resets; they never begin animation.
$('#guide-start').addEventListener('click',()=>{
  const guide=experimentGuides[mode];
  paused=true;
  changeMode(mode,{...guide.values});
  preset=presets[mode].findIndex(([,name])=>name===guide.preset);
  $('#preset-select').value=guide.preset;
  applyPreset(guide.preset);
  if(guide.probe)probe={...guide.probe};
  draw();
  announce('已载入并暂停：'+guide.title+'。'+guide.instructions);
});
$('#preset-select').addEventListener('change',e=>applyPreset(e.target.value));
$('#preset').addEventListener('click',()=>{preset=(preset+1)%presets[mode].length;$('#preset-select').value=presets[mode][preset][1];applyPreset(presets[mode][preset][1]);});
$('#step').addEventListener('click',()=>{paused=true;updatePause();if(mode==='life'){cells=lifeStep(cells,48,32);generation++;}else if(mode==='fractal'){growFractal();}else{t+=.1;if(mode==='orbit')bodies.forEach(b=>{for(let i=0;i<10;i++)orbitStep(b,values.gravity*1000,.01);b.trail.push([b.x,b.y]);if(b.trail.length>220)b.trail.shift();});}draw();announce(mode==='life'?`第 ${generation} 代`:'模拟前进一步');});
$('#clear').addEventListener('click',()=>{cancelPainting();paused=true;updatePause();cells=new Uint8Array(48*32);generation=0;lifeHistory=[];draw();announce('画布已清空，可以播种');});
$('#share').addEventListener('click',async()=>{updateAddress();const input=$('#share-link');input.hidden=false;input.value=location.href;input.focus();input.select();try{await navigator.clipboard.writeText(input.value);announce('参数链接已复制；分享当前实验与参数，不包含画布图案或运行进度');}catch{announce('请复制下方参数链接；不包含画布图案或运行进度');}});
const saveSnapshot=createSnapshotSaver({canvas,button:$('#save'),announce,document});
$('#save').addEventListener('click',()=>saveSnapshot(`small-worlds-${mode}.png`));
// A stroke belongs to one pointer and cannot survive interrupted capture.
let paintingPointer=null,cancelledClickPointer=null,lastPaint=-1,wasDragging=false;
function cancelPainting(){
  const id=paintingPointer;
  if(id!==null)cancelledClickPointer=id;
  paintingPointer=null;lastPaint=-1;wasDragging=false;
  if(id!==null&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
}
function endPainting(e){
  if(paintingPointer===null||e.pointerId!==paintingPointer)return;
  if(e.type==='pointercancel'||e.type==='lostpointercapture')cancelledClickPointer=e.pointerId;
  paintingPointer=null;lastPaint=-1;
  // Preserve click suppression after a normal drag and its implicit capture loss.
}
canvas.addEventListener('pointerdown',e=>{
  if(paintingPointer!==null||e.isPrimary===false||e.button!==0)return;
  cancelledClickPointer=null;
  if(mode!=='life')return;
  paintingPointer=e.pointerId;wasDragging=false;paused=true;updatePause();lastPaint=-1;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(paintingPointer===null||e.pointerId!==paintingPointer||mode!=='life')return;
  const p=coordinates(e);
  const x=Math.min(47,Math.max(0,Math.floor(p.x/width*48))),y=Math.min(31,Math.max(0,Math.floor(p.y/height*32))),i=y*48+x;
  if(i!==lastPaint){wasDragging=true;lifeHistory=[];cells[i]=1;lastPaint=i;draw();}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,endPainting);
document.querySelectorAll('.tab').forEach(tab=>{tab.addEventListener('click',()=>changeMode(tab.dataset.mode));tab.addEventListener('keydown',e=>{const modes=Object.keys(configs),i=modes.indexOf(mode);let n;if(e.key==='ArrowRight')n=(i+1)%modes.length;if(e.key==='ArrowLeft')n=(i+modes.length-1)%modes.length;if(e.key==='Home')n=0;if(e.key==='End')n=modes.length-1;if(n!==undefined){e.preventDefault();changeMode(modes[n]);$('#tab-'+modes[n]).focus();}});});const shared=addressSettings();changeMode(shared.mode,shared.values);new ResizeObserver(fit).observe(canvas);
animation=createAnimationLoop({request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id),update:advance,canRun:()=>!paused&&!document.hidden&&stageVisible});
document.addEventListener('visibilitychange',()=>animation.sync());
if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{stageVisible=entries[0].isIntersecting;animation.sync();}).observe(canvas);
animation.sync();

// A newly enabled motion preference pauses immediately; disabling it never
// overrides an intentional pause. The Continue button remains an explicit opt-in.
reducedMotion.addEventListener?.('change',event=>{
  if(!event.matches)return;
  paused=true;
  updatePause();
  announce('已按减少动态效果偏好暂停；可以手动继续或前进一步');
});

function growFractal(){
 addFractalPoints(fractal,100);
 if(fractal.count>=FRACTAL_LIMIT){paused=true;updatePause();announce('已达到 12,000 点并自动暂停；可保存图片，或重置后再探索');}
}
function drawFractal(){
 const scale=Math.min(width/2.1,height/1.85),cx=width/2,cy=height/2+scale*.25;
 ctx.strokeStyle='#385046';ctx.lineWidth=1;ctx.beginPath();
 fractalVertices.forEach(([x,y],i)=>i?ctx.lineTo(cx+x*scale,cy+y*scale):ctx.moveTo(cx+x*scale,cy+y*scale));
 ctx.closePath();ctx.stroke();ctx.fillStyle='#d3f35b';ctx.beginPath();
 for(let i=0;i<fractal.count;i++)ctx.rect(cx+fractal.points[i*2]*scale,cy+fractal.points[i*2+1]*scale,1.3,1.3);
 ctx.fill();
 fractalVertices.forEach(([x,y],i)=>{ctx.fillStyle=palette[i];ctx.beginPath();ctx.arc(cx+x*scale,cy+y*scale,4,0,Math.PI*2);ctx.fill();});
 $('#metrics').textContent=`${fractal.count} 个点 · 前进 ${values.jump}% · 种子 ${values.seed}`;
}
