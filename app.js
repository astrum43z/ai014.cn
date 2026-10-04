import {fractalRegions} from './fractal-regions.js';
import {fieldNotesText,saveFieldNotes} from './field-notes.js';
import {missions,checkMission,centralGapCount} from './missions.js?v=discovery-passport-1';
import {createOrbitPreview} from './orbit-preview.js';
import {testStillLife} from './life-challenge.js';
import {createWaveFieldCache,waveFieldValue,WAVE_GRID_STEP} from './wave-field.js';
import {createWaveCycleCache,waveCyclePosition} from './wave-cycle.js';
import {orbitLaunchState,clampOrbitPoint,orbitRadialVelocity} from './orbit.js?v=radial-reading-1';
import {paintLifeLine} from './painting.js?v=edit-recovery-1';
import {canShareObservation,readObservation,writeObservation} from './observation.js';
import {createWalk,advanceWalk,walkStats,walkPathStats,walkOccupancy,WALK_COUNT,WALK_LIMIT} from './walk.js?v=occupancy-reading-1';
import {discoveries} from './journeys.js?v=random-walk-1';
import {createFractal,addFractalPoints,fractalVertices,FRACTAL_LIMIT} from './fractal.js?v=vertex-counts-1';
import {experimentGuides} from './guides.js?v=wave-paths-1';
import {createSnapshotSaver} from './snapshot.js?v=context-safe-save-1';
import {createAnimationLoop} from './animation.js';
import {lifeStep,inspectLifeCell,findLivingCell,orbitStep,waveComponents,population,repeatPeriod,wavePathDifference,parseSettings,serializeSettings} from './simulations.js?v=wave-paths-1&browse=living-cells-1';
const $=s=>document.querySelector(s), canvas=$('#canvas'),ctx=canvas.getContext('2d');
const getWaveField=createWaveFieldCache();
const getWaveCycle=createWaveCycleCache();
let renderedWaveCycle=null;
const getOrbitPreview=createOrbitPreview();
// The field, probe readings and manual quarter-cycle step share one clock.
const WAVE_ANGULAR_SPEED=3,WAVE_QUARTER_PERIOD=Math.PI/(2*WAVE_ANGULAR_SPEED);
const waveMeetingNames={constructive:'接近加强',destructive:'接近抵消',mixed:'部分叠加'};
const configs={orbit:{title:'引力游乐场',heading:'轻轻改变引力',description:'一颗恒星，几位旅行者。改变引力或发射速度，观察轨道如何弯曲。',sliders:[['gravity','引力强度',30,160,80,''],['speed','新行星速度',30,150,100,'%']],challenge:'把引力调小，再放入一颗行星。它还会留在这个世界吗？',explanation:'引力把行星拉向中心，而切向速度让它不断错过中心。两者的平衡，塑造出不同的轨道。试着在同一个位置，用不同速度发射行星。',note:'简化二维模型：固定中心天体，不计算行星间引力；近中心采用软化处理。新行星速度只影响下一次发射，不改变已有行星。',hint:'轻点发射 · 方向键选位 + Enter · Home 归位',learn:'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/'},life:{title:'生命的形状',heading:'规则简单，未来不简单',description:'每个小格子只有生与灭。邻居的数量，决定它在下一代的命运。',sliders:[['rate','演化速度',1,20,8,' 代/秒'],['density','随机初始密度',10,60,30,'%']],challenge:'暂停后点击格子画一个图案，再继续。它会消失、循环，还是移动？',explanation:'一个活格子有 2 或 3 个邻居就存活，否则消失；空格恰好有 3 个邻居就诞生。这是 Conway 的生命游戏。本实验边缘相连：从右侧离开，会回到左侧。',note:'密度只影响下一次“随机播种”。键盘聚焦画布后用方向键移动光标，Enter 或空格切换格子；操作会自动暂停。',hint:'轻点播种 · 拖动绘制 · 方向键 + Enter',learn:'https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life'},wave:{title:'波与波相遇',heading:'相遇，也是一种创造',description:'两个同频波源不断扩散。明暗纹路，是它们相互加强与抵消留下的足迹。',sliders:[['wavelength','波长',15,70,32,''],['separation','波源间距',20,180,100,'']],challenge:'增大两个波源之间的距离。中间的条纹会变得更密，还是更疏？',explanation:'两个波在同一点的位移直接相加。同相时振幅增强，反相时相互抵消。颜色表示此刻的正负位移，亮度表示位移的大小；它不是水面高度的真实三维图。',note:'理想二维同频点波源，忽略振幅随距离衰减与边界反射。轻点或聚焦后用方向键移动探针，均会暂停并读出测量值；Home 回中央。',hint:'轻点暂停测量 · 方向键移探针 · Home 回中央',learn:'https://openstax.org/books/university-physics-volume-1/pages/16-5-interference-of-waves'}};
configs.fractal={title:'随机长出秩序',heading:'每次只走一半',description:'随机选择三角形的一个顶点，向它走一段。重复这件小事，让空白慢慢长出结构。',sliders:[['jump','向顶点前进',35,70,50,'%'],['seed','随机种子',1,99,14,'']],explanation:'每一步随机选一个顶点，再按设定比例靠近它。前进 50% 时，三个缩小到一半的副本组成谢尔宾斯基三角形；理想无限图形的维数为 log(3) / log(2) ≈ 1.585。改变比例会改变图形，不再套用这个维数。',note:'有限点数与像素近似；最多 12,000 点后自动暂停。伪随机序列由种子决定。同参数、同点数可复现；更改参数会从 300 点重新开始。',hint:'方向键 ← 退一点 · → 添一点',learn:'https://mathworld.wolfram.com/ChaosGame.html'};
configs.walk={title:'漫步也会扩散',heading:'猜不出下一步，看得见一群人',description:'256 位漫步者从同一点出发，每一步独立选择方向。跟着一条轨迹，再看看整片点云。',sliders:[['bias','向右偏向',0,25,0,'%'],['seed','随机种子',1,99,14,'']],explanation:'每步长度为 1，没有偏向时，平均位移为零，但均方根距离随步数的平方根增长：16 步对应 4，64 步对应 8。加入偏向后，点云一边平移，一边扩散；“离起点更远”和“散得更开”是两件事。',note:'二维格点模型，无碰撞、无边界。每步水平或竖直的机会各半；水平时向右概率为 50% + 偏向。最多 512 步后暂停；改参数重回 16 步。方向键 → 前进 16 步，Home 回到 16 步，均会暂停。',hint:'方向键 → 前进 16 步 · Home 回到 16 步',learn:'https://ocw.mit.edu/courses/18-354j-nonlinear-dynamics-ii-continuum-systems-spring-2015/6fa55d6a1a061e30d32538d51803fbf1_MIT18_354JS15_Ch5.pdf'};
// Reading destinations stay native links; disclose the source before leaving.
const readingSources={
 orbit:{title:'NASA · 轨道与开普勒定律',format:'英文网页'},
 life:{title:'Wikipedia · 生命游戏',format:'英文网页'},
 wave:{title:'OpenStax · 波的干涉',format:'英文教材'},
 fractal:{title:'Wolfram MathWorld · 混沌游戏',format:'英文网页'},
 walk:{title:'MIT OCW · 随机漫步与扩散',format:'英文 PDF · 6 页'}
};
function renderReadingSource(){
 const source=readingSources[mode];
 $('#learn').href=configs[mode].learn;
 $('#learn').textContent=source.title+' ↗';
 $('#learn-note').textContent=source.format+' · 新标签页打开';
}
const presets={orbit:[['环形舞步','circular'],['椭圆旅行','elliptic'],['逃逸边界','escape']],life:[['滑翔机','glider'],['闪烁振子','blinker'],['脉冲星','pulsar'],['随机花园','random']],wave:[['交错条纹','ripple'],['宽波远行','wide'],['紧密双源','close']]};
presets.fractal=[['半程 · 三角形','half'],['慢一点 · 重叠','overlap'],['远一点 · 岛屿','islands']];
presets.walk=[['没有偏向 · 扩散','unbiased'],['轻轻向右 · 漂移','drift'],['换一群人 · 同规则','another']];
let fractal,walk;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let mode='orbit', values={},paused=reducedMotion.matches,t=0,acc=0,generation=0,bodies=[],cells=new Uint8Array(48*32),preset=0,focusCell={x:24,y:16},canvasFocused=false,width=600,height=414;
let lifeTrial=null,lifeCleared=null,lifeEdited=null;
// Page-only drawing tool, independent of simulation state and shared links.
let lifeErasing=false;
let lifeHistory=[],probe={x:0,y:0},waveView=null,orbitPoint={x:140,y:0},orbitView=null;
let animation, stageVisible=true, contextAvailable=true, addressObservation='',canvasDpr=1;
// One small page-only return recovery per world; seeded models replay on demand.
let observationRecovery=null;
// At most one bounded model per inactive experiment; no persistent storage.
const experimentSessions=new Map();
const missionRuns=new Map(),fieldNotes=new Map();
let orbitRevision=0;
// One page-only reference: recall the newest user launch without rewinding time.
let lastOrbitLaunch=null;
const palette=['#d3f35b','#f59c80','#e7eee1','#87c2b1','#c7b1e8'];
function announce(text){$('#announcement').textContent=text;}
// Continuous readings remain available in the document without becoming a
// stream of live messages. Explicit Pause and Step announce one current snapshot.
function observationReading(){
 const progress=mode==='life'?`第 ${generation} 代；`:mode==='walk'?`${walk.steps} 步；`:'';
 const readings=['a','b','c'].map(key=>$('#observation-'+key).textContent).join('；');
 const atLimit=(mode==='fractal'&&fractal.count>=FRACTAL_LIMIT)||(mode==='walk'&&walk.steps>=WALK_LIMIT);
 return progress+readings+(mode==='orbit'?'；'+$('#orbit-radial-reading').textContent+'；'+orbitLaunchReading():mode==='wave'?'；'+waveReading():mode==='life'?'；'+lifeReading()+($('#life-transition-legend').hidden?'':'；'+$('#life-transition-legend').textContent):mode==='fractal'?'；'+fractalReading():mode==='walk'?'；'+walkReading():'')+(atLimit?(mode==='walk'?'；已达到上限，可退回一步或重置后继续':'；已达到上限，请重置后继续'):'');
}

// Progress-limited worlds keep their primary controls focusable at the cap.
// Recompute from the current model after each draw so replay, resets and tab
// restoration cannot leave another experiment's availability behind.
function progressAtLimit(){return (mode==='fractal'&&fractal?.count>=FRACTAL_LIMIT)||(mode==='walk'&&walk?.steps>=WALK_LIMIT);}
function renderProgressControls(){
 const limited=progressAtLimit(),help=limited?(mode==='fractal'?'fractal-touch-reading':'walk-step-reading'):'';
 $('#pause').setAttribute('aria-disabled',String(limited));
 $('#step').setAttribute('aria-disabled',String(limited));
 $('#pause').setAttribute('aria-describedby',help);
 $('#step').setAttribute('aria-describedby',help||(mode==='wave'?'wave-step-help':''));
}

// The pause choice survives an unavailable bitmap; describe the actual stage
// separately without replacing action feedback or adding live announcements.
function renderCanvasAvailability(){
 setReadingText($('#status'),contextAvailable?(paused?'已暂停':'运行中'):'画布待恢复');
 setReadingText($('#hint'),contextAvailable?configs[mode].hint:'实验仍在本页，等待浏览器恢复画面；刷新会清空进度');
}
function updatePause(){animation?.sync();$('#pause').textContent=paused?'继续':'暂停';renderCanvasAvailability();$('#pause').setAttribute('aria-label',paused?'继续模拟':'暂停模拟');}
function reset(){observationRecovery=null;renderObservationRecovery();cancelPainting();choosePreset('');if(mode==='life'){lifeTrial=null;lifeCleared=null;lifeEdited=null;}t=0;generation=0;acc=0;lifeHistory=[];probe={x:0,y:0};waveView=null;if(mode==='orbit'){orbitRevision++;lastOrbitLaunch=null;orbitPoint={x:140,y:0};orbitView={...orbitPoint};bodies=[75,125,180].map((r,i)=>({x:r,y:0,vx:0,vy:Math.sqrt(values.gravity*1000/r)*(i===1?.86:1),trail:[],color:palette[i]}));}if(mode==='walk')walk=advanceWalk(createWalk(values.seed,values.bias),16);if(mode==='fractal')fractal=addFractalPoints(createFractal(values.seed,values.jump),300);if(mode==='life'){cells=new Uint8Array(48*32);[[0,1],[1,2],[2,0],[2,1],[2,2]].forEach(([y,x])=>cells[(y+14)*48+x+22]=1);[[0,1],[0,2],[1,0],[1,1],[2,1]].forEach(([y,x])=>cells[(y+6)*48+x+10]=1);}draw();announce('实验已重置');}
function rememberExperiment(){
 const state={values,paused,t,acc,preset,presetChoice:$('#preset-select').value,addressObservation,observationRecovery,shareVisible:!$('#share-link').hidden};
 if(mode==='orbit')Object.assign(state,{bodies,orbitPoint,orbitView,lastOrbitLaunch});
 if(mode==='life')Object.assign(state,{cells,generation,lifeHistory,focusCell,lifeTrial,lifeCleared,lifeEdited});
 if(mode==='wave')Object.assign(state,{probe,waveView});
 if(mode==='fractal')state.fractal=fractal;
 if(mode==='walk')state.walk=walk;
 experimentSessions.set(mode,state);
}
function restoreExperiment(state){
 ({values,paused,t,acc,preset,observationRecovery}=state);
 if(mode==='orbit'){({bodies,orbitPoint,orbitView,lastOrbitLaunch}=state);fitOrbitPoint();}
 if(mode==='life')({cells,generation,lifeHistory,focusCell,lifeTrial,lifeCleared,lifeEdited}=state);
 if(mode==='wave'){({probe,waveView}=state);fitWaveProbe();}
 if(mode==='fractal')fractal=state.fractal;
 if(mode==='walk')walk=state.walk;
}
// Describe delayed effects and progress replacement at the controls themselves.
// Shared quiet help avoids repeating the same warning under both seeded sliders.
const parameterEffects={
 orbit:{ids:['speed'],help:'新行星速度只影响下一次发射，不改变已有行星。',result:'；仅用于下一次发射'},
 life:{ids:['density'],help:'随机初始密度是每格变活的概率，只用于下一次“随机播种”，不改动当前图案。',result:'；仅用于下一次随机播种'},
 fractal:{ids:['jump','seed'],help:'改比例或种子后，会按新参数从 300 点重新开始；当前暂停或运行状态保持不变。',result:'；已按新参数重建到 300 点'},
 walk:{ids:['bias','seed'],help:'改偏向或种子后，会按新参数从 16 步重新开始；当前暂停或运行状态保持不变。',result:'；已按新参数重建到 16 步'}
};
// Ranges remain useful for broad changes; native buttons make an exact one-unit
// comparison possible without dragging to a tiny position on a touch screen.
function syncParameterControls(){
 for(const [id,,min,max,,unit] of configs[mode].sliders){
  $('#'+id).value=String(values[id]);
  if(unit)$('#'+id).setAttribute('aria-valuetext',unit===' 代/秒'?`每秒 ${values[id]} 代`:values[id]+unit);
  setReadingText($('#out-'+id),values[id]+unit);
  $('#decrease-'+id).setAttribute('aria-disabled',String(values[id]<=min));
  $('#increase-'+id).setAttribute('aria-disabled',String(values[id]>=max));
 }
}
function setParameter(id,next){
 const spec=configs[mode].sliders.find(([name])=>name===id);
 if(!spec||!Number.isFinite(Number(next)))return false;
 const [, ,min,max]=spec;next=Math.min(max,Math.max(min,Math.round(Number(next))));
 if(next===values[id])return false;
 // Preserve Life's completed fraction of a generation when its speed changes.
 if(mode==='life'&&id==='rate')acc*=values.rate/next;
 observationRecovery=null;renderObservationRecovery();
 values[id]=next;syncParameterControls();
 if(mode==='fractal'||mode==='walk')reset();else draw();updateAddress();
 return true;
}
function renderParameters(){
 const c=configs[mode],parameterMode=mode,effect=parameterEffects[mode];
 $('#sliders').innerHTML=c.sliders.map(([id,label,min,max,initial,unit])=>{
  const value=values[id],step=unit==='%'?'1 个百分点':'1'+unit;
  const help=effect?.ids.includes(id)?'parameter-effect':'';
  return `<div class="slider"><div class="parameter-heading"><label for="${id}">${label}</label><output aria-live="off" id="out-${id}" for="${id}">${value}${unit}</output></div><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" aria-label="${label}"${help?` aria-describedby="${help}"`:""}><div class="parameter-nudge"><button type="button" id="decrease-${id}" aria-label="${label}减少 ${step}" aria-controls="${id}" aria-describedby="out-${id}${help?" "+help:""}">−1</button><button type="button" id="increase-${id}" aria-label="${label}增加 ${step}" aria-controls="${id}" aria-describedby="out-${id}${help?" "+help:""}">+1</button></div></div>`;
 }).join('')+(effect?`<p id="parameter-effect" class="parameter-effect">${effect.help}</p>`:'');
 c.sliders.forEach(([id,label,,,,unit])=>{
  $('#'+id).addEventListener('input',event=>{if(mode===parameterMode)setParameter(id,event.target.value);});
  for(const [direction,delta] of [['decrease',-1],['increase',1]]){
   $('#'+direction+'-'+id).addEventListener('click',()=>{
    if(mode!==parameterMode||!setParameter(id,values[id]+delta))return;
    const result=effect?.ids.includes(id)?effect.result:'';
    announce(label+'：'+values[id]+unit+result);
   });
  }
 });
 syncParameterControls();
}
function changeMode(next,sharedValues=null,saved=null){
 // Stop a running frame chain before replacing the model. Returning later must
 // not include elapsed time from another experiment, even if both were running.
 const previousPause=paused;
 cancelPainting();
 if(next!==mode&&Object.keys(values).length)rememberExperiment();
 experimentSessions.delete(next);
 paused=true;animation?.sync();
 mode=next;paused=previousPause;
 renderDiscovery();preset=0;const c=configs[mode];values=sharedValues||Object.fromEntries(c.sliders.map(s=>[s[0],s[4]]));document.querySelectorAll('.tab').forEach(tab=>{const selected=tab.dataset.mode===mode;tab.classList.toggle('active',selected);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});$('#panel').setAttribute('aria-labelledby','tab-'+mode);$('#panel').setAttribute('data-experiment',mode);$('#stage-title').textContent=`0${Object.keys(configs).indexOf(mode)+1} — ${c.title}`;$('#control-title').textContent=c.heading;$('#description').textContent=c.description;$('#challenge').textContent=experimentGuides[mode].instructions;$('#guide-title').textContent=experimentGuides[mode].title;$('#explanation').textContent=c.explanation;$('#model-note').textContent=c.note;renderReadingSource();canvas.setAttribute('aria-label',c.title+'模拟；'+c.hint);canvas.setAttribute('aria-keyshortcuts','Escape'+(mode==='life'?' Home Control+z Meta+z':mode==='fractal'?' ArrowLeft ArrowRight':''));canvas.setAttribute('aria-describedby','canvas-pause-help'+(mode==='life'?' life-center-help life-edit-help':mode==='fractal'?' fractal-touch-help':''));$('#preset').textContent=mode==='life'?'随机播种 ↗':mode==='wave'?'换一组波源 ↗':'换一种初始状态 ↗';$('#preset-select').innerHTML='<option value="" disabled selected>先选择一个预设</option>'+presets[mode].map(([label,value])=>`<option value="${value}">${label}</option>`).join('');$('#step').textContent=mode==='life'?'下一代 +1':mode==='fractal'?'增加 100 点 +':mode==='walk'?'前进 16 步 +':mode==='wave'?'推进 ¼ 周期 +':'前进一步 +';$('#step').setAttribute('aria-label',mode==='wave'?'推进四分之一周期并暂停':$('#step').textContent);$('#step').setAttribute('aria-describedby',mode==='wave'?'wave-step-help':'');$('#wave-back').hidden=mode!=='wave';$('#wave-rewind-status').hidden=mode!=='wave';$('#life-back').hidden=mode!=='life';$('#life-rewind-status').hidden=mode!=='life';$('#clear').hidden=mode!=='life';$('#life-undo-clear').hidden=mode!=='life';$('#life-clear-status').hidden=mode!=='life';$('#walk-comparison').hidden=mode!=='walk';$('#walk-legend').hidden=mode!=='walk';$('#wave-key').hidden=mode!=='wave';$('#walk-distance').hidden=mode!=='walk';$('#wave-components').hidden=mode!=='wave';$('#life-inspector').hidden=mode!=='life';$('#life-transition-legend').hidden=true;$('#life-challenge').hidden=mode!=='life';$('#life-trial-result-link').hidden=mode!=='life'||!lifeTrial;$('#orbit-launch').hidden=mode!=='orbit';$('#fractal-jump').hidden=mode!=='fractal';$('#fractal-regions').hidden=mode!=='fractal';$('#share-link').hidden=true;renderSharing();renderParameters();
 if(saved){
  restoreExperiment(saved);
  choosePreset(saved.presetChoice||'');
  updatePause();draw();updateAddress(readObservation(saved.addressObservation,mode));
  $('#share-link').hidden=!saved.shareVisible;refreshShareLink();
  announce('已回到'+configs[mode].title+'，保留离开时的画布与参数；'+(paused?'已暂停':'继续运行'));
 }else{updatePause();reset();updateAddress();}
 renderMission();
}
function updateAddress(observation=null){
  clearShareStatus();
  addressObservation=writeObservation(mode,observation);
  history.replaceState(history.state,'','?'+serializeSettings(mode,values)+(addressObservation?'&'+addressObservation:'')+(['#home','#lab','#about','#canvas','#observation-title','#discovery-title','#mission','#control-title','#instruments','#field-notes','#life-test-result'].includes(location.hash)?location.hash:''));
  // A parameter edit starts a new exploration; don't leave an old observation
  // looking like a live link. Parameter-only links retain their existing behavior.
  refreshShareLink();
  if(canShareObservation(mode)&&!observation)$('#share-link').hidden=true;
  renderSavedObservation();
}
function refreshShareLink(){
 const input=$('#share-link');
 if(!input.hidden&&input.value!==location.href){clearShareStatus();input.value=location.href;}
}
let shareRequest=0;
function clearShareStatus(){
 shareRequest++;
 $('#share-status').hidden=true;$('#share-status').textContent='';
}
function showShareStatus(message){$('#share-status').textContent=message;$('#share-status').hidden=false;}
function renderSharing(){
  const supported=canShareObservation(mode);
  $('#share').textContent=supported?'暂停并分享此刻 ↗':'分享当前参数 ↗';
  $('#share-link').setAttribute('aria-label',supported?'可复制的观测链接':'可复制的实验参数链接');
  $('#share-note').textContent=supported?({wave:'保存波源参数、探针位置与时刻。',fractal:'保存种子、比例与当前点数。',walk:'保存种子、偏向与当前步数。'}[mode]+'打开链接会暂停复现；继续探索后，再次分享可更新。'):'链接只含实验和参数，不含画布图案、轨道或进度；图片保存画布。';
}
function currentObservation(){
  if(mode==='wave')return {x:probe.x,y:probe.y,time:t};
  if(mode==='fractal')return {count:fractal.count};
  if(mode==='walk')return {count:walk.steps};
  return null;
}
// Read the existing fixed URL checkpoint, rather than keeping another model
// snapshot. Parameter replacement already clears it; ordinary progress does not.
function renderSavedObservation(){
 const observation=readObservation(addressObservation,mode);
 renderObservationRecovery();
 $('#saved-observation').hidden=!observation;
 $('#saved-observation-reading').textContent=observation?'链接中的观测：'+observationSummary(observation):'';
}
function observationSummary(observation){
 // Identify the actual return/undo destination, including tiny coordinates or
 // times. Use the model's round-trip numbers, as the observation URL does.
 return mode==='wave'?`探针 x ${observation.x}，y ${observation.y} · t ${observation.time} s`:mode==='fractal'?`${observation.count} 点`:`${observation.count} 步`;
}
function renderObservationRecovery(){
 const available=Boolean(observationRecovery)&&canShareObservation(mode);
 $('#observation-undo').setAttribute('aria-disabled',String(!available));
 setReadingText($('#observation-undo-status'),available?'可撤销：返回前的'+observationSummary(observationRecovery.observation)+'。':'暂无可撤销的返回。');
}
function applyObservation(observation,recovery=null){
 paused=true;acc=recovery?.acc??0;
 if(recovery)t=recovery.time;
 if(mode==='wave'){probe={x:observation.x,y:observation.y};waveView=recovery?(recovery.waveView?{...recovery.waveView}:null):{...probe};t=observation.time;if(recovery&&(width!==recovery.width||height!==recovery.height))fitWaveProbe();}
 if(mode==='fractal')fractal=addFractalPoints(createFractal(values.seed,values.jump),observation.count);
 if(mode==='walk')walk=advanceWalk(createWalk(values.seed,values.bias),observation.count);
 updatePause();draw();
}
$('#observation-return').addEventListener('click',()=>{
 const observation=readObservation(addressObservation,mode);
 if(!observation)return;
 const current=currentObservation();
 // Repeated returns at the checkpoint must not erase a useful recovery.
 if(Object.keys(observation).some(key=>current[key]!==observation[key])||(mode==='wave'&&waveScale()!==waveScale(observation))){
  observationRecovery={observation:current,time:t,acc,width,height,waveView:waveView?{...waveView}:null};
 }
 clearShareStatus();
 applyObservation(observation);renderObservationRecovery();
 canvas.scrollIntoView?.({block:'center'});
 canvas.focus({preventScroll:true});
 announce('已回到链接中的观测并暂停；保留探索进度与本次发现；'+observationReading());
});
$('#observation-undo').addEventListener('click',()=>{
 if(!observationRecovery||!canShareObservation(mode))return;
 const recovery=observationRecovery;observationRecovery=null;
 clearShareStatus();applyObservation(recovery.observation,recovery);renderObservationRecovery();
 announce('已撤销返回，恢复返回前的观测并暂停；保留链接与本次发现；'+observationReading());
});
for(const id of ['observation-return','observation-undo']){
 $('#'+id).addEventListener('keydown',event=>{
  if(event.repeat&&event.key==='Enter')event.preventDefault();
 });
}
function addressSettings(){
  if(location.search)return {...parseSettings(location.search,configs),search:location.search};
  const next=Object.hasOwn(configs,location.hash.slice(1))?location.hash.slice(1):'orbit';
  return {...parseSettings('?experiment='+next,configs),search:''};
}
function loadAddress(shared){
  missionRuns.delete(shared.mode);
  const observation=readObservation(shared.search,shared.mode);
  changeMode(shared.mode,shared.values);
  if(!observation)return;
  applyObservation(observation);updateAddress(observation);
  announce('已暂停复现链接中的观测；可以单步比较或继续探索');
}
function restoreAddress(){
  const shared=addressSettings(),observation=writeObservation(shared.mode,readObservation(shared.search,shared.mode));
  // Anchor-only Back/Forward must not discard work done since a saved checkpoint.
  // A different checkpoint with the same sliders must still restore its content.
  if(mode===shared.mode&&Object.keys(shared.values).every(id=>values[id]===shared.values[id])&&observation===addressObservation){
    refreshShareLink();
    return;
  }
  loadAddress(shared);
  // A restored world can remove the focused control. Re-establish the named
  // section destination while leaving scroll restoration to the browser.
  if(['#home','#lab','#field-notes','#about'].includes(location.hash))$(location.hash).focus({preventScroll:true});
}
addEventListener('popstate',restoreAddress);
function fit(){const rect=canvas.getBoundingClientRect();if(rect.width!==width||rect.height!==height)interruptPainting();width=rect.width;height=rect.height;if(mode==='wave')fitWaveProbe();if(mode==='orbit')fitOrbitPoint();resizeCanvas();}
function resizeCanvas(){const dpr=Math.min(devicePixelRatio||1,2);canvasDpr=dpr;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
// Fit the current measurement after a resize or tab return, without moving it.
// Keep any wider shared view; normal probe movement must not continuously zoom.
function fitWaveProbe(){
 waveView={x:Math.max(Math.abs(waveView?.x||0),Math.abs(probe.x)),y:Math.max(Math.abs(waveView?.y||0),Math.abs(probe.y))};
}
// Resize the view, never the selected physical launch position or velocity.
// Retain its bounds while positioning so arrow presses do not keep zooming out.
function fitOrbitPoint(){
 orbitView={x:Math.max(Math.abs(orbitView?.x||0),Math.abs(orbitPoint.x)),y:Math.max(Math.abs(orbitView?.y||0),Math.abs(orbitPoint.y))};
}
function orbitScale(){return Math.min(Math.min(width,height)/450,(width/2-34)/Math.max(1,Math.abs(orbitView?.x||0)),(height/2-34)/Math.max(1,Math.abs(orbitView?.y||0)));}
function waveScale(view=waveView){return Math.min(Math.min(width,height)/280,(width/2-18)/Math.max(1,Math.abs(view?.x||0)),(height/2-18)/Math.max(1,Math.abs(view?.y||0)));}
function coordinates(event,scale){
 const r=canvas.getBoundingClientRect();
 // A delayed click can arrive during collapsed layout. Reject unusable input
 // before it can replace a good launch point or probe with NaN/Infinity.
 if(![event.clientX,event.clientY,r.left,r.top,r.width,r.height,width,height,scale].every(Number.isFinite)||r.width<=0||r.height<=0||width<=0||height<=0||scale<=0)return null;
 const x=((event.clientX-r.left)/r.width*width-width/2)/scale;
 const y=((event.clientY-r.top)/r.height*height-height/2)/scale;
 return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}
// Legacy MouseEvent clicks follow the latest accepted pointer sequence. Keyboard
// activation (detail 0) and unrelated pointer IDs never consume another guard.
canvas.addEventListener('click',e=>{if(e.detail!==0&&suppressedClickPointers.delete(e.pointerId??lastCanvasPointer))return;if(mode==='life'){const cell=lifeCell(e);if(!cell)return;const {x,y}=cell;interruptPainting();paused=true;updatePause();rememberLifeEdit();lifeTrial=null;lifeCleared=null;cells[y*48+x]^=1;lifeHistory=[];focusCell={x,y};draw();announce(lifeReading());return;}if(mode!=='wave'&&mode!=='orbit')return;const point=coordinates(e,mode==='wave'?waveScale():orbitScale());if(!point)return;if(mode==='wave'){paused=true;updatePause();probe=point;draw();announce('已暂停；测量探针已移动；'+waveReading());}else{orbitPoint=point;launchOrbit();}});
function orbitLaunchReading(){return $('#orbit-position').textContent+'；'+$('#orbit-speed').textContent+'；'+$('#orbit-escape-reading').textContent+($('#orbit-preview-reading').hidden?'':'；'+$('#orbit-preview-reading').textContent)+'；'+$('#orbit-launch-note').textContent;}
function renderOrbitLaunch(){
 const launch=orbitLaunchState(orbitPoint,values.gravity*1000,values.speed);
 setReadingText($('#orbit-position'),`发射位置 x ${orbitPoint.x.toFixed(1)}，y ${orbitPoint.y.toFixed(1)} · 距中心 ${launch.radius.toFixed(1)}`);
 setReadingText($('#orbit-speed'),launch.valid?`发射速率 ${launch.speed.toFixed(1)} · 同半径圆轨道 ${launch.circularSpeed.toFixed(1)} × ${values.speed}%`:'离中心太近，暂不能发射');
 // Valid launches are outside the softened core: the fixed-field escape
 // reference is sqrt(2) times the same-radius circular speed. It describes
 // the proposed launch, never the already moving measured first body.
 const escape=launch.circularSpeed*Math.SQRT2;
 setReadingText($('#orbit-escape-reading'),launch.valid?`下一次发射 · 逃逸参考 ${escape.toFixed(1)} 模型单位/秒 · 当前 ${values.speed}% ${launch.speed<escape?'低于':'高于'}参考`:'下一次发射 · 移到有效发射位置后显示逃逸参考');
 const prediction=orbitPrediction();
 $('#orbit-preview-reading').hidden=!prediction;
 setReadingText($('#orbit-preview-reading'),prediction?`预演 10 秒后：x ${prediction.end.x.toFixed(1)}，y ${prediction.end.y.toFixed(1)} · 距中心 ${Math.hypot(prediction.end.x,prediction.end.y).toFixed(1)}`:'');
 setReadingText($('#orbit-launch-note'),bodies.length>=24?'已达到 24 颗上限，可撤回最近发射或重置。':!launch.valid?'请将标记移到距中心至少 22 的位置。':paused?'虚线预演下一颗的 10 秒，方框是终点；假设引力不变，离开画面不代表逃逸。':'暂停可看下一颗的 10 秒虚线预演；改变发射速度，再比较弯曲的路径。');
 setReadingText($('#orbit-touch-reading'),$('#orbit-position').textContent+'；'+$('#orbit-speed').textContent);
 setReadingText($('#orbit-touch-status'),$('#orbit-launch-note').textContent);
 $('#orbit-fire').setAttribute('aria-disabled',String(!launch.valid||bodies.length>=24));
 const canRecall=orbitCanRecall();
 $('#orbit-recall').setAttribute('aria-disabled',String(!canRecall));
 setReadingText($('#orbit-recall-status'),canRecall?`可撤回最近发射的第 ${bodies.length} 颗行星。`:'没有可撤回的发射；初始行星不能逐颗撤回。');
}
function launchOrbit(){
 const launch=orbitLaunchState(orbitPoint,values.gravity*1000,values.speed);
 if(bodies.length>=24){draw();announce('最多放入 24 颗行星，可撤回最近发射或重置后重试');return;}
 if(!launch.valid){draw();announce('请在恒星外侧放入行星；'+orbitLaunchReading());return;}
 lastOrbitLaunch={...orbitPoint,vx:launch.vx,vy:launch.vy,trail:[],color:palette[bodies.length%palette.length]};
 bodies.push(lastOrbitLaunch);
 draw();announce(`已添加第 ${bodies.length} 颗行星；`+orbitLaunchReading());
}
function orbitCanRecall(){return Boolean(lastOrbitLaunch&&bodies.at(-1)===lastOrbitLaunch);}
$('#orbit-recall').addEventListener('click',()=>{
 // Unavailable actions leave motion and feedback untouched. Retaining the
 // actual object across tabs avoids mistaking an initial body for a launch.
 if(mode!=='orbit'||!orbitCanRecall())return;
 const number=bodies.length;
 bodies.pop();lastOrbitLaunch=null;paused=true;updatePause();draw();
 announce(`已撤回第 ${number} 颗行星并暂停；其余 ${bodies.length} 颗保留当前位置与轨迹，时间不回退`);
});
$('#orbit-recall').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
// Buttons and canvas keys share positioning, pause, bounds and launch semantics.
function orbitCommand(key){
 if(mode!=='orbit')return;
 const scale=orbitScale(),maxX=(width/2-34)/scale,maxY=(height/2-34)/scale;
 // Positioning needs valid visible bounds before changing the point or pause
 // choice. Home and launch act on model coordinates and remain available.
 if(key.startsWith('Arrow')&&(![width,height,scale,maxX,maxY].every(Number.isFinite)||width<=0||height<=0||scale<=0||maxX<0||maxY<0))return;
 paused=true;updatePause();
 if(key==='Enter'||key===' '){launchOrbit();return;}
 // Home is an exact model position. Fit a fresh view around it instead of
 // clamping the promised radius when a narrow, positive-scale view cannot fit.
 if(key==='Home'){orbitPoint={x:140,y:0};orbitView={...orbitPoint};}
 else{
  if(key==='ArrowLeft')orbitPoint.x-=5;
  if(key==='ArrowRight')orbitPoint.x+=5;
  if(key==='ArrowUp')orbitPoint.y-=5;
  if(key==='ArrowDown')orbitPoint.y+=5;
  orbitPoint=clampOrbitPoint(orbitPoint,width,height,orbitScale());
 }
 draw();announce('已暂停；'+orbitLaunchReading());
}
for(const [id,key] of [['orbit-left','ArrowLeft'],['orbit-up','ArrowUp'],['orbit-down','ArrowDown'],['orbit-right','ArrowRight'],['orbit-home','Home'],['orbit-fire','Enter']]){
 $('#'+id).addEventListener('click',()=>{
  // Unavailable precision buttons remain focusable; guard before pausing or
  // announcing. Direct canvas launches retain their existing guidance.
  if(id==='orbit-fire'&&(mode!=='orbit'||bodies.length>=24||!orbitLaunchState(orbitPoint,values.gravity*1000,values.speed).valid))return;
  orbitCommand(key);
 });
}
// Native buttons can repeat activation while Enter is held, just like canvas keys.
$('#orbit-fire').addEventListener('keydown',e=>{
 if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();
});
function orbitPrediction(){
 return paused&&bodies.length<24?getOrbitPreview(orbitPoint,values.gravity*1000,values.speed):null;
}
function drawOrbitPreview(scale){
 const prediction=orbitPrediction();if(!prediction)return;
 ctx.save();ctx.strokeStyle='#ffac86';ctx.lineWidth=1.5/scale;
 ctx.setLineDash([6/scale,5/scale]);ctx.beginPath();
 prediction.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
 ctx.setLineDash([]);const {x,y}=prediction.end;
 ctx.strokeRect(x-4/scale,y-4/scale,8/scale,8/scale);
 // Keep a legend in saved PNGs as well as the quiet HTML reading.
 const left=-width/(2*scale)+12/scale,top=-height/(2*scale)+12/scale;
 ctx.fillStyle='#122e29';ctx.fillRect(left-4/scale,top-3/scale,153/scale,23/scale);
 ctx.setLineDash([6/scale,5/scale]);ctx.beginPath();ctx.moveTo(left,top+8/scale);ctx.lineTo(left+24/scale,top+8/scale);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#ffac86';ctx.font=`${12/scale}px sans-serif`;ctx.fillText('下一颗 · 10 s 预演',left+31/scale,top+12/scale);ctx.restore();
}
// Keep the task's measured first planet identifiable without relying on color.
// This is a read-only overlay: the launch marker, view and model are unchanged.
function orbitMeasuredBodyVisible(scale=orbitScale()){
 const body=bodies[0];
 return Number.isFinite(scale)&&scale>0&&!!body&&Math.abs(body.x)*scale<=width/2&&Math.abs(body.y)*scale<=height/2;
}
function renderOrbitMeasurement(radius,speed){
 const visible=orbitMeasuredBodyVisible();
 setReadingText($('#orbit-measured-reading'),`首颗行星 · 距中心 ${radius.toFixed(1)} · 速率 ${speed.toFixed(1)}${visible?'':'（当前在画外）'}`);
 const radial=orbitRadialVelocity(bodies[0]);
 // Classify the displayed precision, avoiding a misleading -0.0 or a claim
 // that a rounded zero proves the body has stopped or follows a circle.
 const rounded=radial===null?null:Number(radial.toFixed(1));
 setReadingText($('#orbit-radial-reading'),rounded===null?'首颗行星 · 距离变化率暂不可定义（中心处没有径向方向）':`距离变化率 ${rounded>0?'+':''}${rounded.toFixed(1)} 模型单位/秒 · ${rounded>0?'此刻远离中心':rounded<0?'此刻靠近中心':'此刻径向变化接近 0'}`);
 setReadingText($('#orbit-measured-help'),`白色菱形标记首颗行星；${paused?'白色实线量到中心的距离；蓝色箭头表示首颗行星此刻的运动方向，长度不表示速率':'暂停可显示到中心的距离线与运动方向箭头'}。距离与速率使用模型单位；${visible?'橙色空心圆用于下一次发射':'画外仍继续计算，离开画面不代表逃逸'}。`);
}
function drawOrbitMeasurement(scale){
 if(!(scale>0))return;
 const {x,y}=bodies[0],r=Math.hypot(x,y),size=9/scale;
 ctx.save();ctx.setLineDash([]);ctx.strokeStyle='#e7eee1';ctx.lineWidth=1.5/scale;
 if(paused&&r>12+size){
  ctx.beginPath();ctx.moveTo(x/r*12,y/r*12);ctx.lineTo(x-x/r*size,y-y/r*size);ctx.stroke();
 }
 ctx.restore();
}
// A paused direction cue uses the current velocity, never the radial line,
// past trail or next launch. Its fixed CSS-pixel length does not encode speed.
function drawOrbitVelocity(scale){
 if(!paused||!(scale>0)||!orbitMeasuredBodyVisible(scale))return;
 const {x,y,vx,vy}=bodies[0],speed=Math.hypot(vx,vy);
 if(!Number.isFinite(speed)||speed===0)return;
 const dx=vx/speed,dy=vy/speed,endX=x+dx*34/scale,endY=y+dy*34/scale;
 ctx.save();ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(x+dx*12/scale,y+dy*12/scale);ctx.lineTo(endX,endY);
 ctx.lineTo(endX-(dx*7-dy*5)/scale,endY-(dy*7+dx*5)/scale);
 ctx.moveTo(endX,endY);ctx.lineTo(endX-(dx*7+dy*5)/scale,endY-(dy*7-dx*5)/scale);
 // A dark casing keeps the blue direction legible across bright planets,
 // the central glow, paths and the white distance line.
 ctx.strokeStyle='#122e29';ctx.lineWidth=5/scale;ctx.stroke();
 ctx.strokeStyle='#82d6dd';ctx.lineWidth=2/scale;ctx.stroke();ctx.restore();
}
// Keep the measured planet visible above the ruler, without redrawing its line
// across the ruler's label or changing either body's physical position.
function drawOrbitMeasuredMarker(scale){
 if(!(scale>0)||!orbitMeasuredBodyVisible(scale))return;
 const {x,y}=bodies[0],size=9/scale;
 ctx.save();ctx.setLineDash([]);ctx.strokeStyle='#e7eee1';ctx.lineWidth=1.5/scale;
 ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size,y);ctx.lineTo(x,y+size);ctx.lineTo(x-size,y);ctx.closePath();ctx.stroke();ctx.restore();
}
function drawOrbitMeasurementLegend(scale){
 if(!(scale>0))return;
 const visible=orbitMeasuredBodyVisible(scale),speed=Math.hypot(bodies[0].vx,bodies[0].vy);
 const showVelocity=paused&&visible&&Number.isFinite(speed)&&speed>0;
 ctx.save();ctx.setLineDash([]);ctx.strokeStyle='#e7eee1';ctx.lineWidth=1.5/scale;
 // Paint the legend last so a moving planet trail cannot cross its text.
 const left=-width/(2*scale)+12/scale,top=-height/(2*scale)+(paused&&orbitPrediction()?41:12)/scale;
 ctx.fillStyle='#122e29';ctx.fillRect(left-4/scale,top-3/scale,196/scale,23/scale);
 ctx.beginPath();ctx.moveTo(left+7/scale,top+2/scale);ctx.lineTo(left+13/scale,top+8/scale);ctx.lineTo(left+7/scale,top+14/scale);ctx.lineTo(left+1/scale,top+8/scale);ctx.closePath();ctx.stroke();
 ctx.fillStyle='#e7eee1';ctx.font=`${12/scale}px sans-serif`;
 ctx.fillText(visible?(showVelocity?'首颗 · 线量距，箭头仅方向':paused?'首颗行星 · 实线量距离':'首颗行星'):'首颗行星 · 当前在画外',left+22/scale,top+12/scale);
 ctx.restore();
}
// Label the actual model-to-screen scale even after fitting a distant launcher.
// Fixed screen-size ticks and a 1/2/5 interval remain legible as the view changes.
function drawOrbitScale(scale){
 if(!Number.isFinite(scale)||scale<=0){setReadingText($('#orbit-scale-reading'),'');return;}
 const capacity=80/scale,power=10**Math.floor(Math.log10(capacity));
 const units=Number(([5,2,1].map(n=>n*power).find(n=>n<=capacity)).toPrecision(6));
 const left=-width/(2*scale)+22/scale,bottom=height/(2*scale)-22/scale;
 ctx.save();ctx.setLineDash([]);ctx.fillStyle='#122e29';
 ctx.fillRect(left-6/scale,bottom-34/scale,132/scale,46/scale);
 ctx.strokeStyle='#a9bfab';ctx.fillStyle='#a9bfab';ctx.lineWidth=1/scale;
 ctx.font=`${11/scale}px sans-serif`;ctx.fillText(`${units} 模型单位`,left,bottom-11/scale);
 ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(left+units,bottom);
 ctx.moveTo(left,bottom-4/scale);ctx.lineTo(left,bottom+4/scale);
 ctx.moveTo(left+units,bottom-4/scale);ctx.lineTo(left+units,bottom+4/scale);ctx.stroke();ctx.restore();
 setReadingText($('#orbit-scale-reading'),`左下标尺：${units} 模型单位；同心圆半径为 50、100、150、200。视图缩放不改变实际距离。`);
}
function drawOrbitLauncher(scale){
 const {x,y}=orbitPoint,launch=orbitLaunchState(orbitPoint,values.gravity*1000,values.speed);
 ctx.save();ctx.strokeStyle='#ffac86';ctx.lineWidth=1.5/scale;
 ctx.beginPath();ctx.arc(x,y,8/scale,0,Math.PI*2);ctx.stroke();
 if(launch.valid){
  const dx=-y/launch.radius,dy=x/launch.radius,endX=x+dx*27/scale,endY=y+dy*27/scale;
  ctx.beginPath();ctx.moveTo(x+dx*11/scale,y+dy*11/scale);ctx.lineTo(endX,endY);
  ctx.lineTo(endX-(dx*6-dy*4)/scale,endY-(dy*6+dx*4)/scale);
  ctx.moveTo(endX,endY);ctx.lineTo(endX-(dx*6+dy*4)/scale,endY-(dy*6-dx*4)/scale);ctx.stroke();
 }else{ctx.beginPath();ctx.moveTo(x-5/scale,y-5/scale);ctx.lineTo(x+5/scale,y+5/scale);ctx.moveTo(x-5/scale,y+5/scale);ctx.lineTo(x+5/scale,y-5/scale);ctx.stroke();}
 ctx.restore();
}
canvas.addEventListener('focus',()=>{canvasFocused=true;draw();});canvas.addEventListener('blur',()=>{canvasFocused=false;draw();});canvas.addEventListener('keydown',e=>{
// Candidate-selection keys belong to the input method, not the experiment.
// 229 covers composition boundaries where isComposing can already be false.
if(e.isComposing||e.keyCode===229)return;
// Canvas-only, one-way pause: inspect the current moment without launching,
// editing, moving a probe or taking a replay step. Never consume IME/modifiers.
if(e.key==='Escape'&&!e.isComposing&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
 e.preventDefault();
 // A fresh paused press is quiet, unless it must finish an active Life stroke.
 if(e.repeat||(paused&&paintingPointer===null))return;
 interruptPainting();paused=true;updatePause();draw();announce('已暂停；'+observationReading());return;
}
if(mode==='orbit'){
 if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Enter',' '].includes(e.key))return;
 e.preventDefault();
 // A held launch key must not fill all remaining planet slots.
 if(e.repeat&&(e.key==='Enter'||e.key===' '))return;
 orbitCommand(e.key);return;
}
if(mode==='fractal'){
 if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;
 // Replay stays on the canvas; a held key still inspects just one jump.
 e.preventDefault();if(!e.repeat){if(e.key==='ArrowLeft')rewindFractalPoint();else stepFractalPoint();}return;
}
if(mode==='walk'){
 if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowRight','Home'].includes(e.key))return;
 e.preventDefault();paused=true;updatePause();
 if(e.key==='Home')setWalkCheckpoint(16);else{growWalk();draw();announceWalk();}
 return;
}
if(mode==='wave'){
  if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();moveWaveProbe(e.key);
  return;
}
if(mode!=='life')return;
// Select a predictable central cell without drawing or advancing a generation.
// Home belongs only to this canvas; leave modified and IME events to the browser.
if(e.key==='Home'&&!e.isComposing&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
 e.preventDefault();if(!e.repeat)centerLifeSelection();return;
}
// Undo belongs only to the focused drawing canvas. Do not intercept text fields,
// redo, AltGr or IME input; a held shortcut cannot consume a later edit.
if(!e.isComposing&&!e.altKey&&!e.shiftKey&&(e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){
 e.preventDefault();if(!e.repeat)undoLifeEdit();return;
}
// Shift+Space scrolls up in the browser; modified navigation must not paint,
// move selection, interrupt a stroke or replace the current recovery.
if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key)){
e.preventDefault();
// A held toggle key must not repeatedly erase and repaint the same cell.
// Arrow repeats remain useful for moving across the board.
if(e.repeat&&(e.key==='Enter'||e.key===' '))return;
interruptPainting();
paused=true;updatePause();if(e.key==='ArrowLeft')focusCell.x=(focusCell.x+47)%48;if(e.key==='ArrowRight')focusCell.x=(focusCell.x+1)%48;if(e.key==='ArrowUp')focusCell.y=(focusCell.y+31)%32;if(e.key==='ArrowDown')focusCell.y=(focusCell.y+1)%32;if(e.key==='Enter'||e.key===' '){rememberLifeEdit();lifeTrial=null;lifeCleared=null;cells[focusCell.y*48+focusCell.x]^=1;lifeHistory=[];}draw();announce('已暂停；'+lifeReading());}});

const lifeOutcomes={
 born:['诞生','空格恰有 3 个活邻居，下一代变活'],
 survive:['存活','活格有 2 或 3 个活邻居，下一代仍活'],
 lonely:['消失','活格少于 2 个活邻居，下一代变空'],
 crowded:['消失','活格超过 3 个活邻居，下一代变空'],
 empty:['仍空','空格的活邻居不等于 3，下一代仍空']
};
function renderLifeInspector(){
 renderLifeDragTool();renderLifeEdit();
 const hasLiving=cells.some(Boolean);
 for(const id of ['life-previous-live','life-next-live'])$('#'+id).setAttribute('aria-disabled',String(!hasLiving));
 setReadingText($('#life-find-help'),hasLiving?'按行寻找并暂停：从左到右、从上到下，越过首尾循环；只移动橙框，不改图案。':'当前没有活格；可先绘制或载入图案。寻找按钮只移动橙框，不改图案。');
 const cell=inspectLifeCell(cells,48,32,focusCell.x,focusCell.y),[outcome,reason]=lifeOutcomes[cell.rule];
 // Generations, focus and bitmap recovery often leave this local reading
 // unchanged. Preserve readable text nodes and the mini-grid's attributes.
 setReadingText($('#life-cell-position'),`第 ${focusCell.x+1} 列，第 ${focusCell.y+1} 行`);
 setReadingText($('#life-cell-state'),`当前：${cell.alive?'活格':'空格'} · 活邻居 ${cell.neighbors} / 8`);
 setReadingText($('#life-cell-next'),`下一代：${outcome}`);
 setReadingText($('#life-cell-reason'),reason+'。');
 // Keep precise editing readable without opening the detailed instruments.
 setReadingText($('#life-selection'),`第 ${focusCell.x+1} 列，第 ${focusCell.y+1} 行 · ${cell.alive?'活格':'空格'} · ${cell.neighbors} 个活邻居`);
 setReadingText($('#life-next-reading'),`下一代：${outcome}。${reason}。`);
 setReadingText($('#life-neighbor-help'),`${paused?'虚线框标出':'暂停可显示'} 8 个邻居（含斜角），不含橙色实框本格；边缘相连，邻居可能在画面对侧。所有格子同时更新。`);
 setReadingText($('#life-toggle'),cell.alive?'熄灭所选格':'点亮所选格');
 cell.neighborhood.forEach((alive,i)=>{
  const element=$('#life-neighbor-'+i),value=String(alive);
  if(element.getAttribute?.('data-alive')!==value)element.setAttribute('data-alive',value);
 });
}
// Optional construction challenge. One bounded trial snapshot survives tab
// switches, but a new edit or model advance discards the old comparison.
function renderLifeChallenge(){
 $('#life-test').disabled=Boolean(lifeTrial);
 $('#life-return').hidden=!lifeTrial;
 $('#life-return-help').hidden=!lifeTrial;
 // Native reading routes preserve the comparison instead of returning its board.
 $('#life-trial-view').hidden=!lifeTrial;
 $('#life-trial-result-link').hidden=!lifeTrial;
 $('#life-trial-legend').hidden=!lifeTrial||lifeTrial.report.changed===0;
 const count=population(cells);
 const result=$('#life-test-result');
 if(!lifeTrial){
  result.textContent=`当前 ${count} 个活格 · 目标 4 个。画好后，检验它能否保持原样。`;
  result.setAttribute('data-solved','false');
  return;
 }
 const r=lifeTrial.report;
 const evidence=`${r.beforeCount} → ${r.afterCount} 个活格；${r.born} 格诞生，${r.died} 格消失。`;
 result.setAttribute('data-solved',String(r.solved));
 result.textContent=r.solved?'找到静止结构了！'+evidence+'位置完全相同；只要不编辑，以后每一代也都相同。':
  evidence+(r.beforeCount!==4?'这次起点不是 4 格。返回修改，再试一次。':r.beforeCount===r.afterCount?'数量没变，位置却变了。返回修改，试着让每一格都留在原处。':'还没留住原来的形状。返回修改，用下方邻居读数找找原因。');
}
// Show the same eight toroidal neighbors counted by the rule inspector.
// Hollow dashed frames preserve alive/dead fills and remain distinct from
// the selected cell's solid frame and the comparison's solid birth markers.
function drawLifeNeighbors(cw,ch){
 if(!paused)return;
 ctx.save();ctx.lineWidth=1;ctx.setLineDash([2,2]);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!dx&&!dy)continue;
  const x=(focusCell.x+dx+48)%48,y=(focusCell.y+dy+32)%32;
  // Use a dark line over live fills and a light line over empty cells.
  ctx.strokeStyle=cells[y*48+x]?'#122e29':'#c7d9eb';
  ctx.strokeRect(x*cw+1.5,y*ch+1.5,Math.max(1,cw-3),Math.max(1,ch-3));
 }
 ctx.restore();
}
// The orange cursor needs a dark edge over bright living cells. Keep the same
// hollow geometry above both neighbor and trial markings, without hiding state.
function drawLifeSelection(cw,ch){
 const x=focusCell.x*cw+1,y=focusCell.y*ch+1,w=Math.max(1,cw-2),h=Math.max(1,ch-2);
 // Narrow cells still need a visible live/dead interior between both edges.
 const edge=Math.min(4,Math.max(2,Math.min(cw,ch)-3));
 ctx.save();ctx.setLineDash([]);
 ctx.strokeStyle='#122e29';ctx.lineWidth=edge;ctx.strokeRect(x,y,w,h);
 ctx.strokeStyle='#ffac86';ctx.lineWidth=Math.min(2,edge-1);ctx.strokeRect(x,y,w,h);
 ctx.restore();
}
// Rendering happens before the current board is recorded by observe(). On the
// first draw of a generation its predecessor is last; on redraw it is second-last.
// Never compare across an edit boundary or synthesize an earlier Life board.
function lifeTransitionBefore(){
 if(lifeTrial)return {cells:lifeTrial.cells,generation:lifeTrial.generation};
 const last=lifeHistory.at(-1),previous=last?.generation===generation?lifeHistory.at(-2):last;
 return previous?.generation===generation-1?{cells:previous.key,generation:previous.generation}:null;
}
function drawLifeTransition(cw,ch){
 const previous=paused?lifeTransitionBefore():null,legend=$('#life-transition-legend');
 legend.hidden=!previous||Boolean(lifeTrial);
 if(!previous)return;
 const before=previous.cells;let born=0,died=0;
 ctx.save();ctx.setLineDash([]);
 for(let i=0;i<cells.length;i++){
  if(Number(before[i])===cells[i])continue;
  const x=(i%48)*cw,y=Math.floor(i/48)*ch;
  if(cells[i]){
   born++;
   // The dark casing keeps a cyan birth frame readable over a bright live fill.
   const rect=[x+.7,y+.7,Math.max(1,cw-1.4),Math.max(1,ch-1.4)];
   ctx.strokeStyle='#122e29';ctx.lineWidth=3;ctx.strokeRect(...rect);
   ctx.strokeStyle='#82d6dd';ctx.lineWidth=1.5;ctx.strokeRect(...rect);
  }else{
   died++;ctx.lineWidth=1.5;
   ctx.strokeStyle='#ffac86';ctx.beginPath();ctx.moveTo(x+2,y+2);ctx.lineTo(x+cw-2,y+ch-2);ctx.moveTo(x+cw-2,y+2);ctx.lineTo(x+2,y+ch-2);ctx.stroke();
  }
 }
 ctx.restore();
 if(!lifeTrial)setReadingText(legend,`暂停对比 · 第 ${previous.generation} → ${generation} 代：`+(born+died?`蓝框新生 ${born} 格，橙 × 消失 ${died} 格；黄绿填色才是当前活格。`:'没有格子新生或消失，图案保持不变。'));
}
function testLifeDrawing(){
 if(mode!=='life'||lifeTrial)return;
 cancelPainting();paused=true;acc=0;updatePause();
 lifeCleared=null;lifeEdited=null;
 const report=testStillLife(cells,48,32);
 lifeTrial={cells:cells.slice(),generation,lifeHistory:lifeHistory.slice(),focusCell:{...focusCell},report};
 cells=report.next;generation++;draw();
 $('#life-return').focus({preventScroll:true});
 announce('已暂停，检验后一代；'+$('#life-test-result').textContent);
}
function returnLifeDrawing(){
 if(mode!=='life'||!lifeTrial)return;
 cancelPainting();paused=true;acc=0;updatePause();
 ({cells,generation,lifeHistory,focusCell}=lifeTrial);lifeTrial=null;lifeEdited=null;draw();
 canvas.scrollIntoView?.({block:'center'});canvas.focus({preventScroll:true});
 announce('已回到检验前的图案，可以修改；'+$('#life-test-result').textContent);
}
$('#life-test').addEventListener('click',testLifeDrawing);
$('#life-return').addEventListener('click',returnLifeDrawing);
// Compare moves focus here during Enter's keydown. Do not let repeats from
// that same held key immediately return and hide the result it just produced.
$('#life-return').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
$('#life-challenge-start').addEventListener('click',()=>{
 if(mode!=='life')return;
 cancelPainting();paused=true;acc=0;updatePause();
 cells=new Uint8Array(48*32);generation=0;lifeHistory=[];lifeTrial=null;lifeCleared=null;lifeEdited=null;focusCell={x:23,y:15};
 draw();canvas.scrollIntoView?.({block:'center'});canvas.focus({preventScroll:true});
 announce('已清空并暂停。挑战：点亮 4 格，让下一代位置完全不变。方向键选格，Enter 切换生灭。');
});

function lifeReading(){
 return $('#life-cell-position').textContent+'；'+$('#life-cell-state').textContent+'；'+$('#life-cell-next').textContent+'；'+$('#life-cell-reason').textContent;
}

// Avoid replacing unchanged text nodes on every animation frame. Read the DOM
// rather than keeping a second cache so tab changes always refresh correctly.
function setReadingText(element,text){if(element.textContent!==text)element.textContent=text;}
// The HTML figure owns visibility: SVG elements do not reflect .hidden.
// The quiet caption exposes the same bounded history as the scaled plot.
function renderLifeHistory(){
 const first=lifeHistory[0],last=lifeHistory.at(-1),counts=lifeHistory.map(point=>point.count);
 const low=Math.min(...counts),high=Math.max(...counts),scaleMax=Math.max(1,high);
 const span=Math.max(1,last.generation-first.generation);
 const points=lifeHistory.map(point=>({x:(point.generation-first.generation)/span*600,y:64-point.count/scaleMax*56}));
 $('#history-line').setAttribute('points',points.map(point=>`${point.x},${point.y}`).join(' '));
 $('#history-current').setAttribute('cx',points.at(-1).x);
 $('#history-current').setAttribute('cy',points.at(-1).y);
 setReadingText($('#history-caption'),`活格记录 · 第 ${first.generation} → ${last.generation} 代；起点 ${first.count} → 当前 ${last.count} 格；最少 ${low}，最多 ${high} 格。`);
 setReadingText($('#history-maximum'),scaleMax+' 格');
 setReadingText($('#history-start'),'第 '+first.generation+' 代');
 setReadingText($('#history-end'),'第 '+last.generation+' 代');
 renderLifeRewind();
 renderLifeTurnover();
}
// A flat population can hide changed cells. Compare only two consecutive
// recorded boards, never a manual edit or an invented intermediate generation.
function renderLifeTurnover(){
 const previous=previousLifeGeneration(),last=lifeHistory.at(-1);
 if(!previous){
  setReadingText($('#life-turnover'),'本段还没有相邻两代记录；前进一代后可比较新生、消失与存活。');
  return;
 }
 let born=0,died=0,survived=0;
 for(let i=0;i<last.key.length;i++){
  if(last.key[i]==='1'){if(previous.key[i]==='1')survived++;else born++;}
  else if(previous.key[i]==='1')died++;
 }
 const outcome=born+died===0?(last.count?'图案保持不变。':'空棋盘保持不变。'):previous.count===last.count?`总数仍为 ${last.count} 格，但位置已改变。`:`总数 ${previous.count} → ${last.count} 格。`;
 setReadingText($('#life-turnover'),`第 ${previous.generation} → ${last.generation} 代 · 新生 ${born}，消失 ${died}，存活 ${survived} 格。${outcome}`);
}
// Reuse the recorded boards; rewinding follows actual observations, never an
// invented inverse of Life's many-to-one rule. New edits start a new history.
function previousLifeGeneration(){
 const previous=lifeHistory.at(-2);
 return previous?.generation===generation-1?previous:null;
}
function renderLifeRewind(){
 const previous=previousLifeGeneration();
 $('#life-back').setAttribute('aria-disabled',String(!previous));
 setReadingText($('#life-rewind-status'),previous?`可退回第 ${previous.generation} 代；本段记录最早为第 ${lifeHistory[0].generation} 代。退回后暂停，再前进会重现相同图案。`:'暂无上一代记录；先前进一代即可退回。绘制或载入图案后，从当前代重新记录。');
}
$('#life-back').addEventListener('click',()=>{
 if(mode!=='life')return;
 const previous=previousLifeGeneration();if(!previous)return;
 cancelPainting();paused=true;acc=0;updatePause();
 lifeTrial=null;lifeCleared=null;lifeEdited=null;
 lifeHistory.pop();cells=Uint8Array.from(previous.key,Number);generation=previous.generation;
 draw();announce('已暂停并退回一代；'+observationReading());
});
$('#life-back').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
function observe(){renderProgressControls();const a=$('#observation-a'),b=$('#observation-b'),c=$('#observation-c'),detail=$('#observation-detail');$('#history-plot').hidden=mode!=='life';if(mode==='orbit'){renderOrbitLaunch();const body=bodies[0],r=Math.hypot(body.x,body.y),v=Math.hypot(body.vx,body.vy);renderOrbitMeasurement(r,v);setReadingText(a,'首颗行星距离 · '+r.toFixed(1));setReadingText(b,'首颗行星速率 · '+v.toFixed(1));setReadingText(c,'活跃天体 · '+bodies.length);setReadingText(detail,'距离和速率使用模型单位。调弱引力后，比较同一颗行星的距离变化；想公平比较，请先重置，再只改一个参数。');}if(mode==='life'){renderLifeClear();renderLifeInspector();renderLifeChallenge();if(lifeHistory.at(-1)?.generation===generation)lifeHistory.pop();const count=population(cells),period=repeatPeriod(lifeHistory,cells,generation);lifeHistory.push({generation,key:Array.from(cells).join(''),count});if(lifeHistory.length>120)lifeHistory.shift();setReadingText(a,'活细胞 · '+count);setReadingText(b,'占用率 · '+(count/cells.length*100).toFixed(1)+'%');setReadingText(c,count===0?'状态 · 全部消失':period===1?'状态 · 静止图案':period?'重复周期 · '+period+' 代':'状态 · 尚未发现重复');renderLifeHistory();setReadingText(detail,'折线保留最近 120 次观测，横轴为代数，纵轴从 0 到这段记录的最大数量（全空时为 1 格），会自动缩放；实点是当前值。数量相同不代表图案相同。周期判断比较完全相同的棋盘，不把平移后的滑翔机算作重复；只检查最近 120 次观测，未发现重复不代表永不重复；编辑画布会重新开始记录。');}if(mode==='fractal'){renderFractalJump();setReadingText(a,'已留下 · '+fractal.count+' / '+FRACTAL_LIMIT+' 点');setReadingText(b,'每次前进 · '+values.jump+'%');setReadingText(c,'随机种子 · '+values.seed);setReadingText(detail,values.jump===50?'50%：观察中央的空三角形，再找角落里的更小空三角形。换一个种子，比较相同点数：落点顺序改变，整体结构仍相似。颜色仅用于显示点，不表示概率或维数。':'当前不是 50%：比较空隙和重叠怎样变化。维数 1.585 只对应 50% 的理想谢尔宾斯基三角形，不适用于当前比例。');}if(mode==='walk'){renderWalkDistance();const stats=walkStats(walk);setReadingText($('#walk-spread-reading'),`整群散开 · 第 ${walk.steps} 步：实测 ${stats.spread.toFixed(2)} / 理论 ${stats.expectedSpread.toFixed(2)} 步长`);setReadingText(a,'实测散开程度 · '+stats.spread.toFixed(2));setReadingText(b,'理论散开程度 · '+stats.expectedSpread.toFixed(2));setReadingText(c,'点云中心 x · '+stats.meanX.toFixed(2));setReadingText(detail,`当前 ${walk.steps} 步；散开程度 = 到点云中心距离的均方根，单位为步长。理论中心 x = ${stats.expectedX.toFixed(2)}；实测离起点的均方根距离 = ${stats.rmsDistance.toFixed(2)}。有限的 256 个样本会有波动，实测不必等于理论。虚线圈是理论散开尺度，不是边界或等概率线；视图可能缩放，请看标尺与读数。`);}if(mode==='wave'){renderWaveRewind();renderWaveComponents();const d=wavePathDifference(probe.x,probe.y,values.separation,values.wavelength);setReadingText(a,'波程差 Δr · '+d.difference.toFixed(1));setReadingText(b,'Δr / λ · '+d.cycles.toFixed(2));setReadingText(c,'相遇方式 · '+waveMeetingNames[d.kind]);setReadingText(detail,'数值使用模型单位。轻点画布或聚焦后用方向键移动白色探针，Home 回中央。两条路径相差整数个波长时加强，相差半整数个波长时抵消。“接近”指与上述位置相差不到 0.1 个波长；它描述振幅包络，不是这一瞬间的位移。');}}
// Tiny or temporarily collapsed layouts can have nonpositive plot scales.
// Skip only their bitmap geometry: negative arc radii throw in real Canvas,
// which would otherwise terminate the next running animation frame.
function draw(){ctx.clearRect(0,0,width,height);ctx.fillStyle='#122e29';ctx.fillRect(0,0,width,height);if(mode==='orbit'){const scale=orbitScale();if(Number.isFinite(scale)&&scale>0){ctx.save();ctx.translate(width/2,height/2);ctx.scale(scale,scale);ctx.strokeStyle='#29443a';ctx.lineWidth=1/scale;[50,100,150,200].forEach(r=>{ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();});ctx.strokeStyle='#385046';ctx.beginPath();ctx.moveTo(-width/scale/2,0);ctx.lineTo(width/scale/2,0);ctx.moveTo(0,-height/scale/2);ctx.lineTo(0,height/scale/2);ctx.stroke();const glow=ctx.createRadialGradient(0,0,3,0,0,38);glow.addColorStop(0,'#d3f35b88');glow.addColorStop(1,'#d3f35b00');ctx.fillStyle=glow;ctx.fillRect(-38,-38,76,76);ctx.fillStyle='#d3f35b';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();drawOrbitPreview(scale);drawOrbitMeasurement(scale);bodies.forEach(b=>{ctx.strokeStyle=b.color+'75';ctx.lineWidth=1.3/scale;ctx.beginPath();b.trail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();});drawOrbitScale(scale);bodies.forEach(b=>{ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,4.5/scale,0,Math.PI*2);ctx.fill();});drawOrbitVelocity(scale);drawOrbitMeasuredMarker(scale);drawOrbitLauncher(scale);drawOrbitMeasurementLegend(scale);ctx.restore();}else drawOrbitScale(scale);setReadingText($('#metrics'),`${bodies.length} 颗行星 · t + ${t.toFixed(1)} s`);}else if(mode==='life'){const cw=width/48,ch=height/32;ctx.fillStyle='#d3f35b';cells.forEach((v,i)=>{if(v)ctx.fillRect((i%48)*cw+.6,Math.floor(i/48)*ch+.6,Math.max(1,cw-1.2),Math.max(1,ch-1.2));});ctx.strokeStyle='#26443a';ctx.lineWidth=.5;for(let x=0;x<=48;x++){ctx.beginPath();ctx.moveTo(x*cw,0);ctx.lineTo(x*cw,height);ctx.stroke();}for(let y=0;y<=32;y++){ctx.beginPath();ctx.moveTo(0,y*ch);ctx.lineTo(width,y*ch);ctx.stroke();}drawLifeNeighbors(cw,ch);drawLifeTransition(cw,ch);drawLifeSelection(cw,ch);setReadingText($('#metrics'),`第 ${generation} 代 · ${cells.reduce((a,b)=>a+b,0)} 个活格子`);}else if(mode==='fractal'){drawFractal();}else if(mode==='walk'){drawWalk();}else{const scale=waveScale(),step=WAVE_GRID_STEP,field=getWaveField(width,height,scale,values.separation,values.wavelength);let sample=0;for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){const v=waveFieldValue(field,sample++,t*WAVE_ANGULAR_SPEED),a=Math.abs(v);ctx.fillStyle=v>0?`rgb(${18+a*175},${46+a*177},${41+a*55})`:`rgb(${18+a*56},${46+a*107},${41+a*112})`;ctx.fillRect(x,y,step,step);}drawWavePaths(scale);drawWaveScale(scale);drawWaveMarkers(scale);setReadingText($('#metrics'),`2 个同频波源 · 波长 ${values.wavelength} · t + ${t.toFixed(1)} s`);}observe();}
function advance(dt){t+=dt;if(mode==='walk'){acc+=dt;if(acc<.1)return;acc%=.1;growWalk(4);draw();return;}if(mode==='fractal'){acc+=dt;if(acc<.1)return;acc%=.1;growFractal();draw();return;}if(mode==='orbit'){bodies.forEach(b=>{for(let i=0;i<4;i++)orbitStep(b,values.gravity*1000,dt/4);b.trail.push([b.x,b.y]);if(b.trail.length>220)b.trail.shift();});}if(mode==='life'){acc+=dt;let changed=false;while(acc>=1/values.rate){lifeTrial=null;lifeEdited=null;cells=lifeStep(cells,48,32);generation++;acc-=1/values.rate;changed=true;}if(!changed)return;}draw();}
// A held Enter must not repeatedly undo Pause or Continue. Leave the first
// activation and Space's native keyup behavior intact, without held-key state.
$('#pause').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
$('#pause').addEventListener('click',()=>{if(mode==='walk'&&walk.steps>=WALK_LIMIT){announce('已达到 512 步；可退回一步、重置或改参数后继续');return;}if(mode==='fractal'&&fractal.count>=FRACTAL_LIMIT){announce('已达到 12,000 点；可退回一点、重置或改变参数后继续');return;}interruptPainting();paused=!paused;if(mode==='life'&&!paused){lifeTrial=null;lifeCleared=null;lifeEdited=null;}updatePause();draw();announce(paused?'模拟已暂停；'+observationReading():'模拟已继续');});$('#reset').addEventListener('click',reset);function applyPreset(name){const next=presets[mode].findIndex(([,value])=>value===name);if(next<0)return;preset=next;if(mode==='walk'){values.bias=name==='drift'?25:0;if(name==='another')values.seed=values.seed%99+1;for(const id of ['bias','seed']){$('#'+id).value=values[id];$('#out-'+id).textContent=values[id]+(id==='bias'?'%':'');}}if(mode==='fractal'){values.jump={half:50,overlap:38,islands:65}[name];$('#jump').value=values.jump;$('#out-jump').textContent=values.jump+'%';}reset();if(mode==='orbit'){bodies.forEach(b=>{b.vy*=name==='elliptic'?.65:name==='escape'?1.45:1;});}if(mode==='life'){cells=new Uint8Array(48*32);if(name==='random'){cells=Uint8Array.from({length:48*32},()=>Math.random()<values.density/100?1:0);}else{let points=name==='blinker'?[[0,0],[1,0],[2,0]]:name==='pulsar'?[]:[[1,0],[2,1],[0,2],[1,2],[2,2]];if(name==='pulsar'){for(const a of [2,3,4,8,9,10])for(const b of [0,5,7,12]){points.push([a,b],[b,a]);}}const ox=name==='pulsar'?17:22,oy=name==='pulsar'?9:14;points.forEach(([x,y])=>cells[(oy+y)*48+ox+x]=1);focusCell={x:ox+points[0][0],y:oy+points[0][1]};}}if(mode==='wave'){const options={ripple:[32,100],wide:[65,150],close:[28,35]};[values.wavelength,values.separation]=options[name];for(const id of ['wavelength','separation']){$('#'+id).value=values[id];$('#out-'+id).textContent=values[id];}}choosePreset(name);syncParameterControls();draw();updateAddress();announce('已载入预设：'+presets[mode].find(p=>p[1]===name)[0]);}
// Guided starts are explicit, repeatable resets; they never begin animation.
function startGuide(next=mode){
  if(next!==mode)changeMode(next);
  const guide=experimentGuides[mode];
  paused=true;
  changeMode(mode,{...guide.values});
  preset=presets[mode].findIndex(([,name])=>name===guide.preset);
  $('#preset-select').value=guide.preset;
  applyPreset(guide.preset);
  if(guide.probe)probe={...guide.probe};
  draw();
  announce('已载入并暂停：'+guide.title+'。'+guide.instructions);
}
$('#guide-start').addEventListener('click',()=>enterDiscovery(mode));
function enterDiscovery(next){startGuide(next);$('#panel').scrollIntoView?.({block:'start'});canvas.focus({preventScroll:true});}
$('#journey-start').addEventListener('click',()=>openMission('fractal'));
$('#discovery-next').addEventListener('click',()=>enterDiscovery(discoveries[mode].next));
function renderDiscovery(){
 const d=discoveries[mode];
 for(const key of ['question','invitation','notice','idea','boundary'])$('#discovery-'+key).textContent=d[key];
 $('#next-question').textContent=d.nextQuestion;
 $('#next-connection').textContent=d.connection;
 $('#discovery-next').textContent='去看看 · '+configs[d.next].title+' ↗';
}

function missionSnapshot(){
 const snapshot={values:{...values}};
 if(mode==='orbit')Object.assign(snapshot,{revision:orbitRevision,time:t,radius:Math.hypot(bodies[0].x,bodies[0].y)});
 if(mode==='life')snapshot.cells=cells;
 if(mode==='wave')Object.assign(snapshot,{...probe,envelope:waveComponents(probe.x,probe.y,t*WAVE_ANGULAR_SPEED,values.separation,values.wavelength).envelope});
 if(mode==='fractal')Object.assign(snapshot,{count:fractal.count,gapCount:centralGapCount(fractal)});
 if(mode==='walk')Object.assign(snapshot,{steps:walk.steps,...walkStats(walk)});
 return snapshot;
}
function startMission(next=mode){
 startGuide(next);
 if(mode==='life'){
  cancelPainting();cells=new Uint8Array(48*32);generation=0;acc=0;lifeHistory=[];lifeTrial=null;lifeCleared=null;lifeEdited=null;focusCell={x:23,y:15};draw();
 }
 const initial=missionSnapshot();
 missionRuns.set(mode,{phase:0,status:'active',baseline:{revision:initial.revision},feedback:''});
 renderMission();
 $('#mission').scrollIntoView?.({block:'start'});$('#mission-title').focus({preventScroll:true});
 announce('已开始并暂停：'+missions[mode].title+'。'+missions[mode].first);
}
// Entry shortcuts return to an existing exploration instead of resetting it.
// Explicit restart stays available; historical notes alone are not a session.
function openMission(next){
 const run=missionRuns.get(next);
 if(!run){startMission(next);return;}
 selectTab(next);
 const complete=run.status==='complete',target=$(complete?'#mission-result':'#mission-title');
 (complete?target:$('#mission')).scrollIntoView?.({block:complete?'center':'start'});
 target.focus({preventScroll:true});
 announce('已回到'+configs[mode].title+'；保留当前画布、参数与探索记录；'+(paused?'已暂停':'继续运行')+'。'+$('#mission-instruction').textContent);
}
function missionEntryHelp(next){
 const run=missionRuns.get(next);
 if(!run)return '载入'+configs[next].title+'的探索起点并暂停，会替换该实验的画布与参数。';
 return (run.status==='complete'?'回看已完成的发现':'接着上次的探索')+'；保留当前画布、参数与探索记录，运行或暂停状态保持不变。';
}
function renderMissionEntries(){
 const first=missionRuns.get('fractal'),next=discoveries[mode].next,following=missionRuns.get(next);
 $('#journey-start').innerHTML=(first?(first.status==='complete'?'回看发现':'继续探索'):'先试一个')+'：随机长出秩序 <span aria-hidden="true">↗</span>';
 $('#journey-replaces').textContent=(first?'':'约 2 分钟 · ')+missionEntryHelp('fractal');
 $('#mission-next').textContent=(following?(following.status==='complete'?'回看发现':'继续探索'):'下一个发现')+' · '+configs[next].title+' ↗';
 $('#mission-next-help').textContent=missionEntryHelp(next);
 $('#mission-next-help').hidden=missionRuns.get(mode)?.status!=='complete';
}
function renderMission(){
 const activity=missions[mode],run=missionRuns.get(mode),complete=run?.status==='complete';
 $('#mission-title').textContent=activity.title;$('#mission-duration').textContent=activity.duration;
 $('#mission').setAttribute('data-state',run?.status||'idle');
 $('#mission-state').textContent=complete?'已留下发现':run?'探索中':'可选探索';
 $('#mission-instruction').textContent=complete?activity.finding:run?(run.phase===0?activity.first:activity.second):activity.intro;
 for(let i=0;i<3;i++){
  const step=$('#mission-step-'+i);
  const currentStep=mode==='life'?1:run?.phase||0;
  const current=Boolean(run)&&!complete&&i===currentStep;
  const done=complete||(Boolean(run)&&i<currentStep);
  // State stays readable without relying on weight, color or generated symbols.
  // These are checked milestones, not guesses based on the live canvas.
  step.textContent=activity.steps[i]+(done?' · 已完成':current?' · 当前步骤':'');
  step.setAttribute('aria-current',current?'step':'false');
  step.setAttribute('data-current',String(current));
  step.setAttribute('data-done',String(done));
 }
 $('#mission-start').textContent=run?'重新开始 ↺':'开始这次探索 ↗';
 $('#mission-start').setAttribute('data-restart',String(Boolean(run)));
 $('#mission-check').hidden=!run||complete;$('#mission-check-inline').hidden=!run||complete;
 $('#mission-check-help').hidden=!run||complete;$('#mission-check-inline-help').hidden=!run||complete;
 $('#mission-next').hidden=!complete;
 // A completed result leads straight to the existing session notebook.
 $('#mission-notes').hidden=!complete;
 renderMissionEntries();
 $('#mission-result').hidden=!run?.feedback;$('#mission-result').textContent=run?.feedback||'';
 $('#orbit-measurement').hidden=mode!=='orbit';$('#orbit-touch').hidden=mode!=='orbit';$('#wave-home').hidden=mode!=='wave';$('#wave-touch').hidden=mode!=='wave';$('#fractal-1000').hidden=mode!=='fractal';$('#fractal-checkpoint-note').hidden=mode!=='fractal';$('#fractal-gap').hidden=mode!=='fractal';$('#fractal-touch').hidden=mode!=='fractal';$('#life-touch').hidden=mode!=='life';
 $('#instrument-summary').textContent={orbit:'发射位置与 10 秒轨道预演',life:'逐格规则、下一代对比',wave:'分解两个波、比较传播路径',fractal:'拆开随机落点，理解空隙',walk:'每步方向概率与一位漫步者的路程'}[mode];
 renderFieldNotes();
}
function inspectMission(fromCanvas=false){
 const run=missionRuns.get(mode);if(!run||run.status==='complete')return;
 cancelPainting();paused=true;acc=0;updatePause();draw();
 const report=checkMission(mode,run.phase,missionSnapshot(),run.baseline);
 run.feedback=report.message;
 if(report.kind==='advance'){run.phase=1;run.baseline.evidence=report.evidence;}
 if(report.kind==='complete'){
  run.status='complete';fieldNotes.set(mode,report.note);
  $('#notes-save-status').hidden=true;$('#notes-save-status').textContent='';
 }
 renderMission();
 announce(report.message);
 if(fromCanvas||report.kind==='complete'){
  // At narrow widths the instructions can be taller than the viewport.
  // Reveal the same result that receives focus, after its content is rendered.
  const result=$('#mission-result');
  result.scrollIntoView?.({block:'center'});
  result.focus({preventScroll:true});
 }
}
function recordedNotes(){
 return [...fieldNotes].map(([name,note])=>({title:configs[name].title,finding:missions[name].finding,note}));
}
function renderFieldNotes(){
 const count=fieldNotes.size;
 $('#notes-actions').hidden=count===0;
 $('#notes-preview').hidden=count===0;
 const text=fieldNotesText(recordedNotes()),preview=$('#notes-text');
 // Preserve native text selection and scroll when an unchanged note re-renders.
 if(preview.value!==text)preview.value=text;
 $('#passport-count').textContent='本次发现 '+count+' / 5';$('#notes-count').textContent=count+' / 5';$('#notes-empty').hidden=count>0;
 $('#field-notes-list').innerHTML=[...fieldNotes].map(([name,note])=>`<li><span>✓ ${configs[name].title}</span><h3>${missions[name].finding}</h3><p>${note}</p><button data-return-world="${name}" aria-label="回到这个世界：${configs[name].title}，保留当前进度" aria-describedby="notes-return-help">回到这个世界 ↑</button></li>`).join('');
 for(const name of Object.keys(configs)){
  const discovered=fieldNotes.has(name),tab=$('#tab-'+name);
  $('#seal-'+name).hidden=!discovered;tab.setAttribute('data-discovered',String(discovered));
  // The fixed tab name excludes its descendants. Describe the earned badge
  // explicitly, including when the compact layout hides its long label.
  tab.setAttribute('aria-describedby',discovered?'seal-'+name:'');
 }
}
// Notes describe past findings; returning opens the current in-memory world,
// never a replacement guide or a replay of the historical observation.
$('#notes-save').addEventListener('click',()=>{
 saveFieldNotes(recordedNotes(),{document,report:message=>{
  $('#notes-save-status').textContent=message;$('#notes-save-status').hidden=false;announce(message);
 }});
});
// One held Enter should not start a stream of identical downloads.
$('#notes-save').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
$('#notes-select').addEventListener('click',()=>{
 if(!fieldNotes.size)return;
 const preview=$('#notes-text');preview.focus();preview.select();
 announce('已选中全部发现文字；请用复制快捷键，或长按文字选择复制');
});
$('#field-notes-list').addEventListener('click',event=>{
 const button=event.target.closest?.('[data-return-world]');
 const next=button?.dataset.returnWorld;
 if(!fieldNotes.has(next))return;
 selectTab(next);
 $('#panel').scrollIntoView?.({block:'start'});
 canvas.focus({preventScroll:true});
 announce('已回到'+configs[mode].title+'；保留当前画布与参数，发现笔记仍是完成时的记录；'+(paused?'已暂停':'继续运行'));
});
$('#mission-start').addEventListener('click',()=>startMission());
$('#mission-check').addEventListener('click',()=>inspectMission());
$('#mission-check-inline').addEventListener('click',()=>inspectMission(true));
// A held Enter must not recheck the next phase and overwrite this result.
// Keep fresh Enter, native Space keyup and pointer/assistive clicks unchanged.
for(const id of ['mission-check','mission-check-inline']){
 $('#'+id).addEventListener('keydown',event=>{
  if(event.repeat&&event.key==='Enter')event.preventDefault();
 });
}
$('#mission-next').addEventListener('click',()=>openMission(discoveries[mode].next));
// Touch buttons and canvas keys share model-unit steps, pause and viewport bounds.
function moveWaveProbe(key){
 if(mode!=='wave')return;
 const scale=waveScale(),maxX=width/(2*scale),maxY=height/(2*scale);
 // Directional bounds only exist in a usable view. A late key/button command
 // during layout collapse must not clamp a good probe into inverted bounds.
 // Home is an explicit model-space reset and needs no viewport conversion.
 if(key!=='Home'&&(![width,height,scale,maxX,maxY].every(Number.isFinite)||width<=0||height<=0||scale<=0))return;
 paused=true;updatePause();
 if(key==='Home'){probe={x:0,y:0};waveView=null;}
 else{
  if(key==='ArrowLeft')probe.x-=2;
  if(key==='ArrowRight')probe.x+=2;
  if(key==='ArrowUp')probe.y-=2;
  if(key==='ArrowDown')probe.y+=2;
  probe.x=Math.max(-maxX,Math.min(maxX,probe.x));
  probe.y=Math.max(-maxY,Math.min(maxY,probe.y));
 }
 draw();
 announce(`已暂停；探针 x ${probe.x.toFixed(1)}，y ${probe.y.toFixed(1)}；${$('#observation-b').textContent}；${$('#observation-c').textContent}；${waveReading()}`);
}
$('#wave-home').addEventListener('click',()=>moveWaveProbe('Home'));
for(const direction of ['left','up','down','right'])$('#wave-'+direction).addEventListener('click',()=>moveWaveProbe('Arrow'+direction[0].toUpperCase()+direction.slice(1)));
// Chinese input methods and copied readings can use these equivalent glyphs.
// Normalize only numeric full-width forms and mathematical minus at submission;
// do not use NFKC, accept grouped numbers or rewrite a composing visitor draft.
function normalizeTargetNumber(raw){
 return raw.trim().replace(/[０-９＋－．Ｅｅ−]/g,char=>char==='−'?'-':String.fromCharCode(char.charCodeAt(0)-0xFEE0));
}
// Targets are visitor drafts, separate from the live measurement. Validate both
// coordinates before changing either axis, time, motion or the fixed checkpoint.
// Accept the same scientific notation used by exact readings and shared links.
// Never turn a nonzero target into zero when it is too small for Number.
function readWaveTarget(raw){
 raw=normalizeTargetNumber(raw);
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw))return NaN;
 const number=Number(raw);
 if(!Number.isFinite(number)||(number===0&&/[1-9]/.test(raw.split(/[eE]/)[0])))return NaN;
 return number;
}
function positionWaveProbe(){
 if(mode!=='wave')return;
 const inputs=['x','y'].map(axis=>$('#wave-target-'+axis));
 const numbers=inputs.map(input=>readWaveTarget(input.value));
 const invalid=numbers.map(number=>!Number.isFinite(number)||Math.abs(number)>10000);
 inputs.forEach((input,i)=>input.setAttribute('aria-invalid',String(invalid[i])));
 if(invalid.some(Boolean)){
  const message='请输入 −10000 到 10000 之间的两个坐标，可含小数或科学记数法（如 1e-7）；非零数不能过小而被舍入为 0。';
  setReadingText($('#wave-position-error'),message);$('#wave-position-error').hidden=false;
  inputs[invalid.indexOf(true)].focus();announce(message);return;
 }
 $('#wave-position-error').hidden=true;setReadingText($('#wave-position-error'),'');
 // Preserve a tiny target’s entered notation; ordinary values stay normalized.
 inputs.forEach((input,i)=>input.value=String(numbers[i]).includes('e')?normalizeTargetNumber(input.value):String(numbers[i]));
 paused=true;updatePause();probe={x:numbers[0],y:numbers[1]};fitWaveProbe();draw();
 announce(`已暂停并定位探针：x ${numbers[0]}，y ${numbers[1]}；保留参数与时刻；`+waveReading());
}
$('#wave-position').addEventListener('click',positionWaveProbe);
$('#wave-position').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
for(const axis of ['x','y']){
 const input=$('#wave-target-'+axis);
 input.addEventListener('input',()=>{
  input.setAttribute('aria-invalid','false');
  if(['x','y'].every(name=>$('#wave-target-'+name).getAttribute('aria-invalid')!=='true')){
   $('#wave-position-error').hidden=true;setReadingText($('#wave-position-error'),'');
  }
 });
 input.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  event.preventDefault();if(!event.repeat)positionWaveProbe();
 });
}
// A direct model-clock destination complements coarse quarter-cycle review.
// This is a visitor draft, not a history record or a live animation field.
function clearWaveTimeError(){
 $('#wave-time').setAttribute('aria-invalid','false');
 $('#wave-time-error').hidden=true;setReadingText($('#wave-time-error'),'');
}
function seekWaveTime(){
 if(mode!=='wave')return;
 const input=$('#wave-time'),raw=normalizeTargetNumber(input.value),time=readWaveTarget(raw);
 if(raw.startsWith('-')||!Number.isFinite(time)||time<0||time>1e9){
  const message='请输入 0 到 1000000000 之间的模型秒数，可含小数或科学记数法（如 1e-7）；非零数不能过小而被舍入为 0。';
  input.setAttribute('aria-invalid','true');
  setReadingText($('#wave-time-error'),message);$('#wave-time-error').hidden=false;
  input.focus();announce(message);return;
 }
 clearWaveTimeError();
 // Preserve a tiny target’s entered notation; ordinary values stay normalized.
 input.value=String(time).includes('e')?raw:String(time);
 paused=true;updatePause();t=time;draw();
 announce(`已暂停并回到 t = ${t} 模型秒；保留当前参数与探针；`+waveReading());
}
$('#wave-time-seek').addEventListener('click',seekWaveTime);
$('#wave-time-seek').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
$('#wave-time').addEventListener('input',clearWaveTimeError);
$('#wave-time').addEventListener('keydown',event=>{
 if(event.key!=='Enter'||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
 event.preventDefault();if(!event.repeat)seekWaveTime();
});
$('#fractal-1000').addEventListener('click',()=>{
 if(mode!=='fractal')return;
 // Comparing the same seeded sequence changes the live canvas, not a saved
 // observation. As with single-point replay, only Share records a new moment.
 paused=true;acc=0;updatePause();fractal=addFractalPoints(createFractal(values.seed,values.jump),1000);draw();
 announce(`已暂停，按当前种子 ${values.seed} 与前进比例 ${values.jump}% 重建到 1,000 点。`);
});
function touchLife(dx,dy,toggle=false){
 if(mode!=='life')return;
 cancelPainting();paused=true;updatePause();
 focusCell={x:(focusCell.x+48+dx)%48,y:(focusCell.y+32+dy)%32};
 if(toggle){rememberLifeEdit();lifeTrial=null;lifeCleared=null;cells[focusCell.y*48+focusCell.x]^=1;lifeHistory=[];}
 draw();announce('已暂停；'+lifeReading());
}
// Sparse or moving patterns should not require searching 1,536 empty squares.
// Reuse the quiet cell inspector and existing action announcement.
function selectLivingCell(direction){
 if(mode!=='life')return;
 const current=focusCell.y*48+focusCell.x,next=findLivingCell(cells,current,direction);
 if(next<0)return;
 interruptPainting();paused=true;updatePause();
 focusCell={x:next%48,y:Math.floor(next/48)};
 draw();announce('已暂停，'+(next===current?'只有这一个活格；':'已找到'+(direction>0?'下':'上')+'一个活格；')+lifeReading());
}
for(const [id,direction] of [['life-previous-live',-1],['life-next-live',1]]){
 $('#'+id).addEventListener('click',()=>selectLivingCell(direction));
 $('#'+id).addEventListener('keydown',event=>{
  if(event.repeat&&event.key==='Enter')event.preventDefault();
 });
}
function centerLifeSelection(){
 if(mode!=='life')return;
 // Finish an old stroke, retaining its edits and undo; its release cannot paint.
 interruptPainting();paused=true;updatePause();focusCell={x:24,y:16};
 draw();announce('已暂停，框选回到中央，未改动图案；'+lifeReading());
}
$('#life-center').addEventListener('click',centerLifeSelection);
$('#life-center').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
function renderLifeDragTool(){
 $('#life-erase').setAttribute('aria-pressed',String(lifeErasing));
 setReadingText($('#life-drag-status'),'当前拖动：'+(lifeErasing?'擦除':'点亮'));
}
$('#life-erase').addEventListener('click',()=>{
 if(mode!=='life')return;
 // Switching tools ends the old gesture; a delayed release cannot use the new one.
 cancelPainting();lifeErasing=!lifeErasing;renderLifeDragTool();
 announce($('#life-drag-status').textContent+'；轻点、Enter 与逐格按钮仍切换生灭。');
});
$('#life-erase').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
for(const [id,dx,dy] of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]])$('#life-'+id).addEventListener('click',()=>touchLife(dx,dy));
$('#life-toggle').addEventListener('click',()=>touchLife(0,0,true));
// Native Enter repeats would undo the cell just painted. Keep the initial
// click and Space's native keyup activation, with no separate held-key state.
$('#life-toggle').addEventListener('keydown',e=>{
 if(e.repeat&&e.key==='Enter')e.preventDefault();
});

// Keep one edit, never a stack of earlier recoveries. A drag shares one snapshot
// across all its samples; selection and the drawing tool are not edits.
function lifeDrawingSnapshot(){
 return {cells:cells.slice(),generation,lifeHistory:lifeHistory.slice(),focusCell:{...focusCell},lifeTrial,fraction:acc*values.rate};
}
function rememberLifeEdit(){lifeEdited=lifeDrawingSnapshot();}
function renderLifeEdit(){
 $('#life-undo-edit').setAttribute('aria-disabled',String(!lifeEdited));
 setReadingText($('#life-edit-status'),lifeEdited?'可撤销上一笔：恢复本次轻点、逐格切换或整段拖动前的图案。':'暂无可撤销的绘制。');
}
function undoLifeEdit(){
 if(mode!=='life'||!lifeEdited)return;
 cancelPainting();paused=true;updatePause();
 ({cells,generation,lifeHistory,focusCell,lifeTrial}=lifeEdited);acc=lifeEdited.fraction/values.rate;lifeEdited=null;lifeCleared=null;
 draw();announce('已撤销上一笔并暂停；'+observationReading());
}
$('#life-undo-edit').addEventListener('click',undoLifeEdit);

// Selecting is reversible and never replaces an experiment. Load is explicit,
// so native keyboard browsing and reloading the same choice are both safe.
function choosePreset(name){
 const choice=presets[mode].some(([,value])=>value===name)?name:'';
 $('#preset-select').value=choice;
 $('#load-preset').setAttribute('aria-disabled',String(!choice));
}
$('#preset-select').addEventListener('change',e=>choosePreset(e.target.value));
$('#load-preset').addEventListener('click',()=>applyPreset($('#preset-select').value));
// Both replacement controls act once per Enter press. Keep the first random
// board or preset instead of replacing it on native held-key repeats.
for(const id of ['load-preset','preset']){
 $('#'+id).addEventListener('keydown',e=>{if(e.repeat&&e.key==='Enter')e.preventDefault();});
}
$('#preset').addEventListener('click',()=>{
 // Life's button promises a fresh random sow at the selected density.
 // Named patterns remain available in the select; other worlds keep cycling.
 const next=mode==='life'?'random':presets[mode][(preset+1)%presets[mode].length][1];
 applyPreset(next);
});
$('#step').addEventListener('click',()=>{if(progressAtLimit()){announce('已暂停；'+observationReading());return;}interruptPainting();paused=true;updatePause();if(mode==='life'){lifeTrial=null;lifeCleared=null;lifeEdited=null;cells=lifeStep(cells,48,32);generation++;}else if(mode==='fractal'){growFractal();}else if(mode==='walk'){growWalk();}else{t+=mode==='wave'?WAVE_QUARTER_PERIOD:.1;if(mode==='orbit')bodies.forEach(b=>{for(let i=0;i<10;i++)orbitStep(b,values.gravity*1000,.01);b.trail.push([b.x,b.y]);if(b.trail.length>220)b.trail.shift();});}draw();announce((mode==='wave'?'已暂停，推进四分之一周期；':'已暂停；')+observationReading());});
// Keep one Life generation or Wave quarter-cycle per Enter press. Repeated
// phases can return to the same-looking field and hide the intended comparison.
// Orbit and the two batch-growth controls retain their repeat behavior.
$('#step').addEventListener('keydown',event=>{
 if((mode==='life'||mode==='wave')&&event.repeat&&event.key==='Enter')event.preventDefault();
});
// Wave displacement is evaluated from time, so revisiting an earlier phase
// needs no history or inverse simulation. Keep saved links and return recovery.
function renderWaveRewind(){
 const unavailable=t<=0,button=$('#wave-back');
 if(button.getAttribute?.('aria-disabled')!==String(unavailable))button.setAttribute('aria-disabled',String(unavailable));
 setReadingText($('#wave-rewind-status'),unavailable?'已在 t = 0 起点；先推进或继续，才能退回。':t<WAVE_QUARTER_PERIOD?'距起点不足 ¼ 周期；退回会停在 t = 0，不进入负时间。':'可退回 ¼ 周期并暂停；保留当前参数与探针位置，最早到 t = 0。');
}
$('#wave-back').addEventListener('click',()=>{
 // Unavailable controls remain focusable and are quiet, including while a
 // running model has not yet advanced from its initial frame.
 if(mode!=='wave'||t<=0)return;
 const partial=t<WAVE_QUARTER_PERIOD;
 // Repeated floating-point steps can leave a sub-picosecond residue at zero.
 const previous=t-WAVE_QUARTER_PERIOD;t=previous<=1e-12?0:previous;
 paused=true;updatePause();draw();
 announce((partial?'已暂停，回到 t = 0 起点（不足四分之一周期）；':'已暂停，退回四分之一周期；')+observationReading());
});
$('#wave-back').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
// One bounded recovery for an explicit Clear; fresh work cannot be overwritten.
function renderLifeClear(){
 $('#life-undo-clear').setAttribute('aria-disabled',String(!lifeCleared));
 setReadingText($('#life-clear-status'),lifeCleared?`可撤销清空：恢复第 ${lifeCleared.generation} 代的 ${lifeCleared.count} 个活格。重新绘制、推进或载入图案后失效。`:'清空后可撤销一次；重新绘制、推进或载入图案后失效。仅保留在本页。');
}
$('#clear').addEventListener('click',()=>{
 if(mode!=='life')return;
 cancelPainting();paused=true;updatePause();
 // A second clear of the untouched blank board must not erase its recovery.
 const count=population(cells);
 if(count||generation||lifeTrial)lifeCleared={cells:cells.slice(),generation,lifeHistory:lifeHistory.slice(),focusCell:{...focusCell},lifeTrial,fraction:acc*values.rate,count};
 cells=new Uint8Array(48*32);generation=0;acc=0;lifeHistory=[];lifeTrial=null;lifeEdited=null;draw();
 announce('画布已清空，可以播种'+(lifeCleared?'；可用“撤销清空”恢复原图案':''));
});
$('#life-undo-clear').addEventListener('click',()=>{
 if(mode!=='life'||!lifeCleared)return;
 cancelPainting();paused=true;updatePause();
 ({cells,generation,lifeHistory,focusCell,lifeTrial}=lifeCleared);acc=lifeCleared.fraction/values.rate;lifeCleared=null;lifeEdited=null;
 draw();announce('已撤销清空，恢复原图案并暂停；'+observationReading());
});
// Explicitly visiting the readonly URL is the manual recovery path, even if
// an automatic copy reported success. Selection never reads the clipboard or
// changes the fixed link, current experiment, feedback or pending request.
for(const event of ['focus','click'])$('#share-link').addEventListener(event,()=>$('#share-link').select());
// Both copy actions share request ownership; delayed clipboard feedback must
// never replace a newer copy, return, parameter change or another world's UI.
async function copyExperimentLink(description,saved=false){
 const sharedMode=mode,input=$('#share-link');input.hidden=false;input.value=location.href;
 // Copying an existing checkpoint does not move focus away from its control.
 // The visible readonly field remains available if clipboard access fails.
 if(!saved){input.focus();input.select();}
 const request=++shareRequest,url=input.value;
 showShareStatus(saved?'正在复制链接中的观测；也可手动复制上方链接。':'正在复制'+(canShareObservation(mode)?'观测':'参数')+'链接；也可手动复制下方链接。');
 const finish=message=>{
  if(request!==shareRequest||mode!==sharedMode||input.hidden||input.value!==url)return;
  showShareStatus(message);announce(message);
 };
 try{await navigator.clipboard.writeText(url);finish('已复制'+description);}
 catch{finish(saved?'自动复制未完成，请手动复制上方观测链接；当前实验未改变。':'自动复制未完成，请复制下方'+description);}
}
$('#observation-copy').addEventListener('click',()=>{
 // Read the fixed checkpoint, even if the current model moved outside the
 // shareable range. Do not capture, pause, redraw or consume return recovery.
 if(!readObservation(addressObservation,mode))return;
 return copyExperimentLink('链接中的观测；当前实验未改变。',true);
});
$('#observation-copy').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
$('#share').addEventListener('click',async()=>{
 const observation=currentObservation();
 // A valid imported checkpoint can move beyond the bounded URL format. Do not
 // replace its saved observation with a parameter-only link and promise replay.
 if(observation&&!writeObservation(mode,observation)){
  clearShareStatus();
  const message='当前观测超出链接可保存的范围，未生成或复制新链接。可保存图片，或重置后再分享。';
  showShareStatus(message);announce(message);return;
 }
 observationRecovery=null;
 if(observation){paused=true;updatePause();draw();}
 updateAddress(observation);
 return copyExperimentLink(observation?'观测链接；打开后暂停复现这一刻':'参数链接；不包含画布图案、轨道或运行进度');
});
const saveSnapshot=createSnapshotSaver({canvas,button:$('#save'),status:$('#save-status'),announce,document,canCapture:()=>contextAvailable});
$('#save').addEventListener('click',()=>saveSnapshot(`small-worlds-${mode}.png`,configs[mode].title));
// Encoding can finish before Enter repeats. One physical press saves once,
// while fresh Enter, native Space keyup and pointer activation stay available.
$('#save').addEventListener('keydown',event=>{
 if(event.repeat&&event.key==='Enter')event.preventDefault();
});
// A stroke belongs to one pointer and cannot survive interrupted capture.
let paintingPointer=null,lastCanvasPointer=null,lastPaint=null,paintingBounds=null,paintingBefore=null,wasDragging=false;
const suppressedClickPointers=new Set();
function suppressPaintingClick(id){
  suppressedClickPointers.delete(id);suppressedClickPointers.add(id);
  // Cancelled touches may never produce a click; retain only recent sequences.
  if(suppressedClickPointers.size>16)suppressedClickPointers.delete(suppressedClickPointers.values().next().value);
}
function cancelPainting(){
  const id=paintingPointer;
  if(id!==null)suppressPaintingClick(id);
  paintingPointer=null;lastPaint=null;paintingBounds=null;paintingBefore=null;wasDragging=false;
  if(id!==null&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
}
// A lost window/tab or missed release ends only an active gesture. Completed
// drag clicks belong to their pointer even after another command or world opens.
function interruptPainting(){if(paintingPointer!==null)cancelPainting();}
addEventListener('blur',interruptPainting);
function endPainting(e){
  if(paintingPointer===null||e.pointerId!==paintingPointer)return;
  if(e.type==='pointerup'){
    paintTo(e);
    if(paintingPointer===null)return;
    if(wasDragging){suppressPaintingClick(e.pointerId);announce('已暂停；'+(lifeErasing?'擦除完成':'绘制完成')+'；'+observationReading());}
  }else suppressPaintingClick(e.pointerId);
  paintingPointer=null;lastPaint=null;paintingBounds=null;paintingBefore=null;wasDragging=false;
}
canvas.addEventListener('pointerdown',e=>{
  if(paintingPointer!==null||e.isPrimary===false||e.button!==0){
    // Ignoring a press must also ignore its later click, even after the owning
    // stroke ends or another world opens. Never suppress the owner's own tap.
    if(e.pointerId!==paintingPointer)suppressPaintingClick(e.pointerId);
    return;
  }
  // A genuine new interaction supersedes only this pointer's unconsumed click.
  suppressedClickPointers.delete(e.pointerId);lastCanvasPointer=e.pointerId;
  if(mode!=='life')return;
  const wasRunning=!paused;
  paintingPointer=e.pointerId;paintingBounds=canvas.getBoundingClientRect();wasDragging=false;paused=true;updatePause();lastPaint=lifeCell(e,paintingBounds);paintingBefore=lifeDrawingSnapshot();
  if(wasRunning)draw();
  canvas.setPointerCapture(e.pointerId);
});
function lifeCell(event,rect=canvas.getBoundingClientRect()){
  if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||width<=0||height<=0||rect.width<=0||rect.height<=0)return null;
  const x=(event.clientX-rect.left)/rect.width*48,y=(event.clientY-rect.top)/rect.height*32;
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return {x:Math.min(47,Math.max(0,Math.floor(x))),y:Math.min(31,Math.max(0,Math.floor(y)))};
}
function paintTo(event){
  // A stroke belongs to one canvas rectangle. Catch layout/scroll changes even
  // before ResizeObserver runs, rather than joining unrelated grid positions.
  const rect=canvas.getBoundingClientRect();
  if(paintingBounds&&['width','height','left','top'].some(key=>rect[key]!==paintingBounds[key])){interruptPainting();return;}
  const next=lifeCell(event,rect);
  // A little movement inside the same cell is still a tap. Once the pointer
  // crosses a cell boundary, join samples so fast mouse/touch strokes stay solid.
  if(!next||!lastPaint||(next.x===lastPaint.x&&next.y===lastPaint.y))return;
  const changed=paintLifeLine(cells,48,lastPaint,next,lifeErasing?0:1);
  if(changed){
    if(paintingBefore){lifeEdited=paintingBefore;paintingBefore=null;}
    lifeTrial=null;lifeCleared=null;lifeHistory=[];
  }
  wasDragging=true;lastPaint=next;focusCell={...next};draw();
}
canvas.addEventListener('pointermove',e=>{
  if(paintingPointer===null||e.pointerId!==paintingPointer||mode!=='life')return;
  // A hover, or releasing the primary button while another stays held, must
  // not extend an old stroke when pointerup was not delivered.
  if(typeof e.buttons==='number'&&(e.buttons&1)===0){interruptPainting();return;}
  paintTo(e);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,endPainting);
// Re-selecting the active tab must not discard a drawing or simulation progress.
function selectTab(next){if(next===mode)return;const saved=experimentSessions.get(next);changeMode(next,saved?.values||null,saved);}
document.querySelectorAll('.tab').forEach(tab=>{tab.addEventListener('click',()=>selectTab(tab.dataset.mode));tab.addEventListener('keydown',e=>{if(e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;const modes=Object.keys(configs),i=modes.indexOf(mode);let n;if(e.key==='ArrowRight')n=(i+1)%modes.length;if(e.key==='ArrowLeft')n=(i+modes.length-1)%modes.length;if(e.key==='Home')n=0;if(e.key==='End')n=modes.length-1;if(n!==undefined){e.preventDefault();selectTab(modes[n]);$('#tab-'+modes[n]).focus();}});});const shared=addressSettings();loadAddress(shared);new ResizeObserver(fit).observe(canvas);
animation=createAnimationLoop({request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id),update:advance,canRun:()=>contextAvailable&&!paused&&!document.hidden&&stageVisible});
document.addEventListener('visibilitychange',()=>{if(document.hidden)interruptPainting();animation.sync();});
if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{stageVisible=entries[0].isIntersecting;animation.sync();}).observe(canvas);
animation.sync();

// The browser may reclaim the 2D backing store. Leave its default recovery
// enabled, stop unseen animation and finish any interrupted drawing gesture.
canvas.addEventListener('contextlost',()=>{
 contextAvailable=false;interruptPainting();animation.sync();renderCanvasAvailability();
});
canvas.addEventListener('contextrestored',()=>{
 contextAvailable=true;renderCanvasAvailability();
 const rect=canvas.getBoundingClientRect();
 // Restoration resets the drawing state, including its density transform.
 // A same-size repaint must not expand an unchanged edge probe's fitted view.
 if(rect.width!==width||rect.height!==height)fit();else resizeCanvas();
 animation.sync();
});

// Display density can change without a CSS-size change. Re-arm against the raw
// ratio, but redraw only when the capped backing-store ratio needs updating.
// Keep one listener and no polling; fit preserves the current model and clock.
let densityQuery;
function watchPixelDensity(){
 densityQuery?.removeEventListener?.('change',watchPixelDensity);
 const dpr=devicePixelRatio||1;
 densityQuery=matchMedia(`(resolution: ${dpr}dppx)`);
 densityQuery.addEventListener?.('change',watchPixelDensity);
 if(Math.min(dpr,2)!==canvasDpr){
  const rect=canvas.getBoundingClientRect();
  // A density-only refresh must not expand an edge probe's fitted view.
  if(rect.width!==width||rect.height!==height)fit();else resizeCanvas();
 }
}
watchPixelDensity();

// A newly enabled motion preference pauses immediately; disabling it never
// overrides an intentional pause. The Continue button remains an explicit opt-in.
reducedMotion.addEventListener?.('change',event=>{
  if(!event.matches)return;
  for(const state of experimentSessions.values())state.paused=true;
  paused=true;
  updatePause();
  draw();
  announce('已按减少动态效果偏好暂停；可以手动继续或前进一步');
});

function growFractal(amount=100){
 addFractalPoints(fractal,amount);
 if(fractal.count>=FRACTAL_LIMIT){paused=true;updatePause();announce('已达到 12,000 点并自动暂停；可保存图片、退回一点，或重置后再探索');}
}
function fractalReading(){
 const vertex='ABC'[fractal.lastVertex];
 return `第 ${fractal.count} 点，抽中顶点 ${vertex}；向它前进 ${values.jump}%，余下 ${100-values.jump}%`;
}
// Images of the whole outer triangle under one jump, not point samples or
// the final attractor. Seed and count never affect this first-level geometry.
function renderFractalRegions(){
 const regions=fractalRegions(values.jump);
 regions.forEach((vertices,index)=>{
  const element=$('#fractal-region-'+index);
  const points=vertices.map(([x,y])=>`${160+x*140},${166+y*140}`).join(' ');
  if(element.getAttribute?.('points')!==points)element.setAttribute('points',points);
 });
 const relation=values.jump<50?'三块范围部分重叠；重叠处不一定被实际落点填满。':values.jump===50?'三块只在外框的边中点相接，中央留空。':'三块范围彼此分离，中间留有空隙。';
 setReadingText($('#fractal-regions-reading'),`前进 ${values.jump}% → 每块边长为外框的 ${100-values.jump}%。${relation}`);
}
function renderFractalJump(){
 setReadingText($('#fractal-seek-current'),`当前观测 · ${fractal.count} 点`);
 renderFractalRegions();
 const counts=fractal.vertexCounts;
 setReadingText($('#fractal-choice-reading'),`当前序列前 ${fractal.count} 次 · A ${counts[0]} 次，B ${counts[1]} 次，C ${counts[2]} 次`);
 $('#fractal-jump-reading').textContent=fractalReading();
 $('#fractal-touch-reading').textContent=fractalReading()+(fractal.count>=FRACTAL_LIMIT?'；已达 12,000 点上限，可退回一点或重置。':fractal.count<=300?'；已回到 300 点起点。':'。');
 // Native disabled would discard focus on the key press that reaches a limit.
 // Keep each button discoverable; the handlers below enforce the same bounds.
 $('#fractal-back').setAttribute('aria-disabled',String(fractal.count<=300));
 $('#fractal-forward').setAttribute('aria-disabled',String(fractal.count>=FRACTAL_LIMIT));
 $('#fractal-step').setAttribute('aria-disabled',String(fractal.count>=FRACTAL_LIMIT));
 $('#fractal-jump-note').textContent=paused?'空心圈是出发点，橙色实心点是新落点；橙线是本次前进，虚线指向选中的顶点。':'运行中暂隐连线；暂停或只走一步，即可拆开看最后一次跳跃。';
}
function stepFractalPoint(){
 if(mode!=='fractal'||fractal.count>=FRACTAL_LIMIT)return;
 paused=true;acc=0;updatePause();growFractal(1);draw();
 announce('已暂停；'+observationReading());
}
$('#fractal-step').addEventListener('click',stepFractalPoint);
$('#fractal-forward').addEventListener('click',stepFractalPoint);
function rewindFractalPoint(){
 if(mode!=='fractal'||fractal.count<=300)return;
 paused=true;acc=0;updatePause();
 fractal=addFractalPoints(createFractal(values.seed,values.jump),fractal.count-1);draw();
 announce('已暂停并退回一点；'+observationReading());
}
$('#fractal-back').addEventListener('click',rewindFractalPoint);
// A destination is visitor input, not a live reading: redraws must never replace
// a partly typed count. Replaying is bounded by the existing observation range.
function clearFractalSeekError(){
 $('#fractal-count').setAttribute('aria-invalid','false');
 $('#fractal-seek-error').hidden=true;
 setReadingText($('#fractal-seek-error'),'');
}
function seekFractalCount(){
 if(mode!=='fractal')return;
 const input=$('#fractal-count'),raw=normalizeTargetNumber(input.value),count=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(count)||count<300||count>FRACTAL_LIMIT){
  const message='请输入 300 到 12000 之间的整数点数。';
  input.setAttribute('aria-invalid','true');
  setReadingText($('#fractal-seek-error'),message);$('#fractal-seek-error').hidden=false;
  input.focus();announce(message);return;
 }
 clearFractalSeekError();input.value=String(count);
 // Even the current destination is an explicit request to pause and inspect.
 paused=true;acc=0;updatePause();
 if(fractal.count!==count)fractal=addFractalPoints(createFractal(values.seed,values.jump),count);
 draw();announce('已暂停并定位到 '+count+' 点；'+observationReading());
}
$('#fractal-seek').addEventListener('click',seekFractalCount);
$('#fractal-count').addEventListener('input',clearFractalSeekError);
$('#fractal-count').addEventListener('keydown',event=>{
 if(event.key!=='Enter'||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
 event.preventDefault();if(!event.repeat)seekFractalCount();
});

function drawFractal(){
 const scale=Math.min(width/2.1,height/1.85),cx=width/2,cy=height/2+scale*.25;
 ctx.strokeStyle='#385046';ctx.lineWidth=1;ctx.beginPath();
 fractalVertices.forEach(([x,y],i)=>i?ctx.lineTo(cx+x*scale,cy+y*scale):ctx.moveTo(cx+x*scale,cy+y*scale));
 ctx.closePath();ctx.stroke();ctx.fillStyle='#d3f35b';ctx.beginPath();
 for(let i=0;i<fractal.count;i++)ctx.rect(cx+fractal.points[i*2]*scale,cy+fractal.points[i*2+1]*scale,1.3,1.3);
 ctx.fill();
 // Keep the comparison region fixed at the outer triangle's side midpoints.
 // This is the same open central triangle counted by discovery checks, even
 // when another jump percentage puts points inside it. It consumes no RNG.
 ctx.save();ctx.setLineDash([3,5]);ctx.beginPath();
 fractalVertices.forEach(([x,y],i)=>{
  const next=fractalVertices[(i+1)%3],px=cx+(x+next[0])*scale/2,py=cy+(y+next[1])*scale/2;
  if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
 });
 ctx.closePath();
 // A narrow opaque edge preserves the dashed reference over dense samples.
 ctx.strokeStyle='#122e29';ctx.lineWidth=3;ctx.stroke();
 ctx.strokeStyle='#8bbaca';ctx.lineWidth=1;ctx.stroke();ctx.restore();
 setReadingText($('#fractal-gap-reading'),`中央参考区 · 内部 ${centralGapCount(fractal)} / ${fractal.count} 点`);
 // Only the final jump is highlighted, and only while paused. Seed replay
 // reconstructs its endpoints exactly; this overlay never consumes randomness.
 if(paused){
  const fromX=cx+fractal.previousX*scale,fromY=cy+fractal.previousY*scale;
  const toX=cx+fractal.x*scale,toY=cy+fractal.y*scale;
  const [vx,vy]=fractalVertices[fractal.lastVertex];
  ctx.save();ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(fromX,fromY);ctx.lineTo(cx+vx*scale,cy+vy*scale);
  ctx.strokeStyle='#122e29';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#d9e4cf';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(fromX,fromY);ctx.lineTo(toX,toY);
  ctx.strokeStyle='#122e29';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#ffac86';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#122e29';ctx.strokeStyle='#e7eee1';ctx.beginPath();ctx.arc(fromX,fromY,5,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(toX,toY,4,0,Math.PI*2);ctx.strokeStyle='#122e29';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#ffac86';ctx.fill();
  ctx.beginPath();ctx.arc(cx+vx*scale,cy+vy*scale,8,0,Math.PI*2);
  ctx.strokeStyle='#122e29';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#ffac86';ctx.lineWidth=2;ctx.stroke();ctx.restore();
 }
 ctx.font='12px ui-monospace,monospace';
 fractalVertices.forEach(([x,y],i)=>{
  const px=cx+x*scale,py=cy+y*scale;
  ctx.fillStyle=palette[i];ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e7eee1';ctx.fillText('ABC'[i],px+(i===0?-4:i===1?-14:9),py+(i===0?-13:15));
 });
 setReadingText($('#metrics'),`${fractal.count} 个点 · 前进 ${values.jump}% · 种子 ${values.seed}`);
}

// Checkpoints regenerate the same seeded sequence, without changing parameters.
function setWalkCheckpoint(steps){
 if(mode!=='walk')return;
 paused=true;acc=0;updatePause();
 walk=advanceWalk(createWalk(values.seed,values.bias),steps);draw();announceWalk();
}
$('#walk-16').addEventListener('click',()=>setWalkCheckpoint(16));
$('#walk-64').addEventListener('click',()=>setWalkCheckpoint(64));
// Keep a typed destination separate from live progress and fixed shared links.
function clearWalkSeekError(){
 $('#walk-count').setAttribute('aria-invalid','false');
 $('#walk-seek-error').hidden=true;setReadingText($('#walk-seek-error'),'');
}
function seekWalkCount(){
 if(mode!=='walk')return;
 const input=$('#walk-count'),raw=normalizeTargetNumber(input.value),steps=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(steps)||steps<16||steps>WALK_LIMIT){
  const message='请输入 16 到 512 之间的整数步数。';
  input.setAttribute('aria-invalid','true');
  setReadingText($('#walk-seek-error'),message);$('#walk-seek-error').hidden=false;
  input.focus();announce(message);return;
 }
 clearWalkSeekError();input.value=String(steps);
 // The current count is also a valid request to pause and inspect.
 setWalkCheckpoint(steps);
}
$('#walk-seek').addEventListener('click',seekWalkCount);
$('#walk-count').addEventListener('input',clearWalkSeekError);
$('#walk-count').addEventListener('keydown',event=>{
 if(event.key!=='Enter'||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
 event.preventDefault();if(!event.repeat)seekWalkCount();
});
$('#walk-back').addEventListener('click',()=>{
 // Replaying the seed restores every walker and the next random draw exactly.
 // Keep the shared-observation lower bound and do nothing when unavailable.
 if(mode!=='walk'||walk.steps<=16)return;
 setWalkCheckpoint(walk.steps-1);
});
$('#walk-step-one').addEventListener('click',()=>{
 if(mode!=='walk'||walk.steps>=WALK_LIMIT)return;
 paused=true;acc=0;updatePause();advanceWalk(walk,1);draw();announceWalk();
});
// Explicit replay is one destination per press, like the fractal canvas key.
// Keep native Space keyup and fresh presses; only cancel held Enter repeats.
for(const id of ['fractal-back','fractal-forward','fractal-step','fractal-seek','walk-back','walk-step-one','walk-seek']){
 $('#'+id).addEventListener('keydown',event=>{
  if(event.repeat&&event.key==='Enter')event.preventDefault();
 });
}
function announceWalk(){const stats=walkStats(walk);announce(`已暂停；${walk.steps} 步；实测散开程度 ${stats.spread.toFixed(2)}，理论 ${stats.expectedSpread.toFixed(2)}；点云中心 x ${stats.meanX.toFixed(2)}；${walkReading()}${walk.steps>=WALK_LIMIT?'；已达到上限，可退回一步或重置后继续':''}`);}
function growWalk(amount=16){
 advanceWalk(walk,amount);
 if(walk.steps>=WALK_LIMIT){paused=true;updatePause();announce('已达到 512 步并暂停；可退回一步、保存图片，或重置后探索');}
}
function drawWalk(){
 const stats=walkStats(walk),center=stats.expectedX/2;
 // Fixed minimum vertical range preserves the 16-vs-64 comparison. Expand only
 // to contain drift or outliers; all coordinates remain unbounded model values.
 let extentX=Math.max(30,Math.abs(center)+30),extentY=30;
 for(let i=0;i<walk.positions.length;i+=2){extentX=Math.max(extentX,Math.abs(walk.positions[i]-center)+6);extentY=Math.max(extentY,Math.abs(walk.positions[i+1])+6);}
 for(let i=0;i<=walk.steps;i++){extentX=Math.max(extentX,Math.abs(walk.path[i*2]-center)+6);extentY=Math.max(extentY,Math.abs(walk.path[i*2+1])+6);}
 const scale=Math.min((width-48)/(extentX*2),(height-76)/(extentY*2));
 // Quiet model readings stay current even when there is no drawable plot.
 setReadingText($('#metrics'),`${WALK_COUNT} 位漫步者 · ${walk.steps} 步 · 偏向 ${values.bias}%`);
 if(!Number.isFinite(scale)||scale<=0){drawWalkScale(scale);return;}
 const px=x=>width/2+(x-center)*scale,py=y=>height/2-y*scale;
 ctx.strokeStyle='#29483e';ctx.lineWidth=1;ctx.beginPath();
 ctx.moveTo(20,py(0));ctx.lineTo(width-20,py(0));ctx.moveTo(px(0),36);ctx.lineTo(px(0),height-35);ctx.stroke();
 ctx.strokeStyle='#c7b1e8';ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(px(stats.expectedX),py(0),stats.expectedSpread*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='#e7eee177';ctx.lineWidth=1.2;ctx.beginPath();
 for(let i=0;i<=walk.steps;i++)i?ctx.lineTo(px(walk.path[i*2]),py(walk.path[i*2+1])):ctx.moveTo(px(walk.path[0]),py(walk.path[1]));
 ctx.stroke();
 if(paused){
  ctx.strokeStyle='#82d6dd';ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.beginPath();
  ctx.moveTo(px(0),py(0));ctx.lineTo(px(walk.positions[0]),py(walk.positions[1]));ctx.stroke();ctx.setLineDash([]);
 }
 ctx.fillStyle='#d3f35ba6';ctx.beginPath();
 for(let i=0;i<WALK_COUNT;i++){ctx.moveTo(px(walk.positions[i*2])+2.1,py(walk.positions[i*2+1]));ctx.arc(px(walk.positions[i*2]),py(walk.positions[i*2+1]),2.1,0,Math.PI*2);}ctx.fill();
 drawWalkMarkers(px,py,stats);
 ctx.font='11px sans-serif';
 drawWalkScale(scale);
 ctx.fillStyle='#d9e4cf';ctx.fillText(`${walk.steps} 步 / ${WALK_LIMIT}`,22,25);
}

// Measurements must stay identifiable inside a crowded ensemble. Keep the
// origin hollow and the centroid/representative geometry unchanged, but paint
// their opaque dark edges above the points and path. Exact overlaps stay exact.
function drawWalkMarkers(px,py,stats){
 ctx.save();ctx.setLineDash([]);ctx.lineJoin='round';
 // Labels can intersect a walker in a fitted view; measurement shapes win.
 ctx.font='11px sans-serif';ctx.strokeStyle='#122e29';ctx.lineWidth=3;ctx.strokeText('起点',px(0)+6,py(0)+17);
 ctx.fillStyle='#a9bfab';ctx.fillText('起点',px(0)+6,py(0)+17);
 if(paused){
  ctx.beginPath();ctx.arc(px(0),py(0),6,0,Math.PI*2);
  ctx.strokeStyle='#122e29';ctx.lineWidth=4.5;ctx.stroke();
  ctx.strokeStyle='#e7eee1';ctx.lineWidth=1.5;ctx.stroke();
 }
 const mx=px(stats.meanX),my=py(stats.meanY);
 ctx.beginPath();ctx.moveTo(mx-7,my);ctx.lineTo(mx+7,my);ctx.moveTo(mx,my-7);ctx.lineTo(mx,my+7);
 ctx.strokeStyle='#122e29';ctx.lineWidth=5;ctx.stroke();
 ctx.strokeStyle='#f59c80';ctx.lineWidth=2;ctx.stroke();
 ctx.beginPath();ctx.arc(px(walk.positions[0]),py(walk.positions[1]),4,0,Math.PI*2);
 ctx.strokeStyle='#122e29';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#e7eee1';ctx.fill();
 ctx.restore();
}

// Drift and outliers can zoom the view out. Keep a useful ruler length while
// preserving the exact model-to-screen scale used by every walker and path.
function drawWalkScale(scale){
 if(!Number.isFinite(scale)||scale<=0){setReadingText($('#walk-scale-reading'),'');return;}
 const capacity=80/scale,power=10**Math.floor(Math.log10(capacity));
 const units=Number(([5,2,1].map(n=>n*power).find(n=>n<=capacity)).toPrecision(6));
 const x=22,y=height-23,length=units*scale;
 ctx.save();ctx.strokeStyle='#a9bfab';ctx.fillStyle='#a9bfab';ctx.lineWidth=1;ctx.setLineDash([]);
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+length,y);
 ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.moveTo(x+length,y-4);ctx.lineTo(x+length,y+4);ctx.stroke();
 ctx.font='11px sans-serif';ctx.fillText(`${units} 步长`,x,height-32);ctx.restore();
 setReadingText($('#walk-scale-reading'),`左下标尺：${units} 步长；1 步长是每次移动的长度。视图缩放不改变实际位置。`);
}

// The ruler uses the exact same CSS-pixel scale as the field and probe.
// Choose a readable 1/2/5 length; fitting a distant checkpoint changes only
// the view, not wavelengths, source separation or measurement coordinates.
// Keep its label above the measuring paths; sources and probe remain on top.
function drawWaveScale(scale){
 if(!Number.isFinite(scale)||scale<=0){setReadingText($('#wave-scale-reading'),'');return;}
 const capacity=80/scale,power=10**Math.floor(Math.log10(capacity));
 const units=Number(([5,2,1].map(n=>n*power).find(n=>n<=capacity)).toPrecision(6));
 const length=units*scale,x=24,y=height-21;
 ctx.save();
 ctx.fillStyle='#122e29e6';ctx.fillRect(16,height-56,132,46);
 ctx.fillStyle='#e7eee1';ctx.font='11px sans-serif';ctx.fillText(`${units} 模型单位`,x,y-12);
 ctx.strokeStyle='#e7eee1';ctx.lineWidth=1.5;ctx.setLineDash([]);ctx.beginPath();
 ctx.moveTo(x,y);ctx.lineTo(x+length,y);
 ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.moveTo(x+length,y-4);ctx.lineTo(x+length,y+4);ctx.stroke();ctx.restore();
 setReadingText($('#wave-scale-reading'),`左下标尺：${units} 模型单位；视图缩放不改变实验参数与探针位置。`);
}

// Dual-tone markers remain visible across bright peaks and dark zero crossings.
// Keep their model positions, screen-size geometry and label anchors unchanged.
// Paint above paths and ruler; keep the probe unfilled.
function drawWaveMarkers(scale){
 ctx.save();ctx.setLineDash([]);ctx.lineJoin='round';
 for(const sign of [-1,1]){
  const x=width/2+sign*values.separation/2*scale,y=height/2,label=sign<0?'A':'B';
  ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);
  ctx.strokeStyle='#122e29';ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle='#f4f5eb';ctx.fill();
  ctx.font='11px sans-serif';ctx.strokeText(label,x-4,y-12);ctx.fillText(label,x-4,y-12);
 }
 const px=width/2+probe.x*scale,py=height/2+probe.y*scale;
 ctx.beginPath();ctx.arc(px,py,9,0,Math.PI*2);
 ctx.moveTo(px-14,py);ctx.lineTo(px+14,py);ctx.moveTo(px,py-14);ctx.lineTo(px,py+14);
 ctx.strokeStyle='#122e29';ctx.lineWidth=5;ctx.stroke();
 ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();
}

// Paused measuring lines link the geometry to the probe reading. A is solid,
// B is dashed; matching colors are secondary cues and overlaps retain A in gaps.
function drawWavePaths(scale){
 if(!paused)return;
 const px=width/2+probe.x*scale,py=height/2+probe.y*scale;
 ctx.save();
 for(const [sign,color,dash] of [[-1,'#c7b1e8',[]],[1,'#f59c80',[7,5]]]){
  ctx.setLineDash(dash);ctx.beginPath();
  ctx.moveTo(width/2+sign*values.separation/2*scale,height/2);ctx.lineTo(px,py);
  ctx.strokeStyle='#122e29';ctx.lineWidth=5;ctx.stroke();
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
 }
 ctx.setLineDash([]);ctx.restore();
}

function waveNumber(value){const rounded=Math.abs(value)<.005?0:value;return (rounded>0?'+':'')+rounded.toFixed(2);}
function setWaveCycleAttribute(id,name,value){
 const element=$('#'+id),text=String(value);
 if(element.getAttribute?.(name)!==text)element.setAttribute(name,text);
}
function renderWaveCycle(paths,parts){
 const cycle=getWaveCycle(paths.leftDistance,paths.rightDistance,values.wavelength);
 const x=waveCyclePosition(t*WAVE_ANGULAR_SPEED);
 for(const name of ['left','right','combined']){
  if(cycle!==renderedWaveCycle)$('#wave-cycle-'+name).setAttribute('points',cycle[name]);
  setWaveCycleAttribute('wave-cycle-cursor-'+name,'transform',`translate(${x} 0)`);
  setWaveCycleAttribute('wave-cycle-dot-'+name,'cx',x);
  setWaveCycleAttribute('wave-cycle-dot-'+name,'cy',28-parts[name]*24);
 }
 renderedWaveCycle=cycle;
 setReadingText($('#wave-cycle-period'),`一周期 T ≈ ${(2*Math.PI/WAVE_ANGULAR_SPEED).toFixed(3)} 模型秒 · 当前周期位置约 ${(x/6).toFixed(1)}%。`);
}
function renderWaveComponents(){
 setReadingText($('#wave-time-current'),`当前时刻 · t ${t} 模型秒`);
 // Keep exact model coordinates beside the visitor's draft; the overview is rounded.
 setReadingText($('#wave-position-current'),`当前探针 · x ${probe.x}，y ${probe.y}`);
 const paths=wavePathDifference(probe.x,probe.y,values.separation,values.wavelength);
 setReadingText($('#wave-distances'),`A 路程 ${paths.leftDistance.toFixed(2)} · B 路程 ${paths.rightDistance.toFixed(2)}`);
 setReadingText($('#wave-difference'),`两条路相差 ${paths.difference.toFixed(2)} ÷ 波长 ${values.wavelength} ≈ ${paths.cycles.toFixed(2)} 个波长`);
 setReadingText($('#wave-path-note'),paused?'实线 A、虚线 B 连接波源与白色探针；长度用模型单位，不是波的位移。':'轻点画布即可暂停测量，显示 A、B 到探针的两条路。');
 const parts=waveComponents(probe.x,probe.y,t*WAVE_ANGULAR_SPEED,values.separation,values.wavelength);
 for(const key of ['left','right','combined']){
  const value=parts[key];
  setReadingText($('#wave-value-'+key),waveNumber(value));
  $('#wave-bar-'+key).setAttribute('x',String(100+Math.min(0,value)*100));
  $('#wave-bar-'+key).setAttribute('width',String(Math.abs(value)*100));
 }
 setReadingText($('#wave-probe-reading'),`探针 x ${probe.x.toFixed(1)}，y ${probe.y.toFixed(1)} · 整周期最大幅度 ${parts.envelope.toFixed(2)}`);
 // Keep the path comparison beside the controls that move its probe.
 // Classification uses unrounded geometry, matching the observation panel.
 setReadingText($('#wave-path-context'),`波程差 ${paths.difference.toFixed(2)} ÷ 波长 ${values.wavelength} ≈ ${paths.cycles.toFixed(2)} 个波长 · ${waveMeetingNames[paths.kind]}`);
 setReadingText($('#wave-instant-reading'),'探针此刻 (A+B)/2 · '+waveNumber(parts.combined));
 setReadingText($('#wave-envelope'),'完整周期最大 |(A+B)/2| · '+parts.envelope.toFixed(2));
 renderWaveCycle(paths,parts);
}

function waveReading(){return $('#wave-distances').textContent+'；'+$('#wave-difference').textContent+'；左源 A '+$('#wave-value-left').textContent+'，右源 B '+$('#wave-value-right').textContent+'，画面合成 '+$('#wave-value-combined').textContent+'；'+$('#wave-envelope').textContent;}

// Explain the existing branch widths, not frequencies sampled from the path.
// Reading this rule never advances the ensemble or consumes a random draw.
function renderWalkChoices(){
 const percentages={right:25+walk.bias/2,left:25-walk.bias/2,up:25,down:25};
 for(const [direction,percent] of Object.entries(percentages)){
  setReadingText($('#walk-chance-'+direction+'-value'),percent.toFixed(1)+'%');
  const bar=$('#walk-chance-'+direction),width=`width:${percent}%`;
  if(bar.getAttribute?.('style')!==width)bar.setAttribute('style',width);
 }
 setReadingText($('#walk-choice-reading'),`偏向 ${walk.bias}%：在水平步中，向右机会从 50% 提高到 ${50+walk.bias}%；每一步都有 50% 的机会走水平方向。`);
}
function renderWalkDistance(){
 setReadingText($('#walk-seek-current'),`当前观测 · ${walk.steps} 步`);
 renderWalkChoices();
 const occupancy=walkOccupancy(walk);
 setReadingText($('#walk-occupancy-reading'),`${WALK_COUNT} 位漫步者 · 占据 ${occupancy.sites} 个格点 · 单格最多 ${occupancy.maximum} 位。多个漫步者可重合；按模型位置计数，不是屏幕上可分辨的点数。`);
 const path=walkPathStats(walk);
 const previous=Math.max(0,walk.steps-1),dx=path.x-walk.path[previous*2],dy=path.y-walk.path[previous*2+1];
 const direction=dx>0?'向右':dx<0?'向左':dy>0?'向上':dy<0?'向下':'尚未迈步';
 $('#walk-step-reading').textContent=`白色漫步者 · 第 ${walk.steps} 步${walk.steps?' '+direction:''}；累计走过 ${path.length}，离起点 ${path.distance.toFixed(2)} 步长${walk.steps>=WALK_LIMIT?'；已达 512 步上限，可退回一步、重置或比较 16 / 64 步':walk.steps<=16?'；已回到 16 步起点':''}。`;
 $('#walk-back').setAttribute('aria-disabled',String(walk.steps<=16));
 $('#walk-step-one').setAttribute('aria-disabled',String(walk.steps>=WALK_LIMIT));
 $('#walk-length').textContent=path.length+' 步长';
 $('#walk-displacement').textContent=path.distance.toFixed(2)+' 步长';
 const horizontal=path.x===0?'左右抵消':`净向${path.x>0?'右':'左'} ${Math.abs(path.x)} 步`;
 const vertical=path.y===0?'上下抵消':`净向${path.y>0?'上':'下'} ${Math.abs(path.y)} 步`;
 $('#walk-cancellation').textContent=`右 ${path.right} 步、左 ${path.left} 步 → ${horizontal}；上 ${path.up} 步、下 ${path.down} 步 → ${vertical}。`;
 $('#walk-distance-note').textContent=path.distance===0?'这位漫步者回到了起点，直线距离为 0；走过的路仍然算数。':paused?'空心圈是起点，白点是当前位置；蓝色虚线直接连接两点，白色实线保留折返。':'运行中暂隐蓝色直线，暂停即可比较它与白色路径。';
}
function walkReading(){return '白色漫步者：走过 '+$('#walk-length').textContent+'，离起点 '+$('#walk-displacement').textContent+'；'+$('#walk-cancellation').textContent;}
