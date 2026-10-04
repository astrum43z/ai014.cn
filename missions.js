import {testStillLife} from './life-challenge.js';

// Small, explicit experiments. Completion is checked against the running model,
// never elapsed wall time, button counts, or a visitor's claimed answer.
export const missions={
 orbit:{title:'松开引力，行星会去哪里？',duration:'约 2 分钟',steps:['记录起点','只改引力','检查距离'],intro:'先记录首颗行星的距离；保持原速度，把引力减半，再看它走到哪里。',first:'起点已经暂停。点“检查并记录”，记下首颗行星的距离 75。',second:'把“引力强度”从 80 调到 40，继续运行几秒，再检查。目标：首颗行星离中心超过 100。',finding:'相同的初速度，换一个引力，轨道就会改变。'},
 life:{title:'只用 4 格，让变化停下来',duration:'约 3 分钟',steps:['从空白开始','画出 4 格','检验下一代'],intro:'点亮 4 个格子，让下一代没有格子诞生，也没有格子消失。',first:'画布已清空。点亮 4 格，再点“检查并记录”。不确定时，展开下方观测仪器，看看每格有几个邻居。',finding:'数量一样还不够；每个位置都不变，才是静止图案。'},
 wave:{title:'暗下来，真的代表没有波吗？',duration:'约 2 分钟',steps:['记录静区','移回中央','比较整周期'],intro:'比较两个位置的完整周期最大幅度，区分持续抵消与一瞬间的暗色。',first:'探针已放在 x = 8 的静区。先点“检查并记录”，记录完整周期的最大幅度。',second:'点画布下的“探针回中央”，再检查。试着前进一步：加强的位置，也会有一瞬间变暗。',finding:'静区有波到达，只是位移相消；某一刻的暗色不等于持续抵消。'},
 fractal:{title:'换一种随机，还会长成三角形吗？',duration:'约 2 分钟',steps:['长到 1,000 点','换一个种子','比较同样点数'],intro:'用两组随机落点做一次公平比较：相同规则、相同点数，只有种子不同。',first:'先点画布下的“比较 1,000 点”，再检查种子 14 留下的中央空隙。',second:'把“随机种子”改为 15，再点“比较 1,000 点”，检查中央的空三角形。前进比例保持 50%。',finding:'种子改变落点顺序，“每次走一半”的规则却保留了中央空隙。'},
 walk:{title:'走四倍的步数，会散开四倍吗？',duration:'约 2 分钟',steps:['记录 16 步','比较 64 步','读出变化'],intro:'用同一群漫步者比较两个时刻，看看点云散开的程度。',first:'现在是 16 步。先点“检查并记录”，留下理论与实测散开程度。',second:'点“比较 64 步”，再检查。步数变为四倍，散开程度会怎样？保持偏向 0%、种子 14。',finding:'无偏向时，理论散开程度随步数的平方根增长。'}
};
const wait=message=>({kind:'wait',message});
const advance=(message,evidence)=>({kind:'advance',message,evidence});
const complete=(message,note)=>({kind:'complete',message,note});
const f=value=>Number(value).toFixed(2);
export function centralGapCount(fractal){return countCentralGapFrom(fractal,0);}
function countCentralGapFrom(fractal,start){
 // The central open triangle has corners (±sqrt(3)/4,-.25),(0,.5).
 // A small tolerance avoids classifying Float32 boundary points as interior.
 let count=0;const h=Math.sqrt(3)/4,epsilon=1e-6;
 for(let i=start;i<fractal.count;i++){
  const x=fractal.points[i*2],y=fractal.points[i*2+1];
  if(y>-.25+epsilon&&y<.5-epsilon&&Math.abs(x)<h*(.5-y)/.75-epsilon)count++;
 }
 return count;
}
// Model points are append-only; replay and parameter changes create a new model.
// Keep derived counts out of the simulation and do not retain discarded models.
export function createCentralGapCounter(){
 const counts=new WeakMap();
 return fractal=>{
  let cached=counts.get(fractal);
  if(!cached||cached.points!==fractal.points||cached.count>fractal.count)
   cached={points:fractal.points,count:0,total:0};
  cached.total+=countCentralGapFrom(fractal,cached.count);
  cached.count=fractal.count;counts.set(fractal,cached);
  return cached.total;
 };
}
export function checkMission(mode,phase,current,baseline){
 const v=current.values;
 if(mode==='life'){
  const r=testStillLife(current.cells,48,32);
  if(r.beforeCount!==4)return wait(`现在有 ${r.beforeCount} 个活格子。先调整到 4 格，再检查；画布不会被这次检查改变。`);
  if(!r.solved)return wait(`4 格已就位，但下一代会新生 ${r.born} 格、消失 ${r.died} 格。再调整位置；提示：斜角也算邻居。`);
  return complete('找到了！4 个活格子，下一代新生 0 格、消失 0 格。每个位置都保持不变。','4 个活格子 → 下一代仍是同样的 4 格；新生 0、消失 0。');
 }
 if(mode==='orbit'){
  if(current.revision!==baseline.revision)return wait('这次起点已被重置或换成预设。请重新开始探索，再从同一起点比较。');
  if(phase===0){
   if(v.gravity!==80||v.speed!==100||current.time>.001)return wait('先从暂停的原始起点记录距离。请点“重新开始”，再检查并记录。');
   return advance('起点已记录：首颗行星距中心 75.0。现在只把引力改成 40，继续运行几秒。',{radius:current.radius});
  }
  if(v.gravity!==40||v.speed!==100)return wait('这次只比较引力变化：请将引力设为 40，新行星速度保持 100%。');
  if(current.radius<=100)return wait(`当前距离 ${current.radius.toFixed(1)}，起点为 75.0。再继续运行一会儿，超过 100 后检查。`);
  return complete(`距离从 75.0 变成 ${current.radius.toFixed(1)}。原来的速度不再对应原来的圆轨道，行星走向了更外侧。`,`引力 80 → 40；首颗行星距中心 75.0 → ${current.radius.toFixed(1)}（模型单位）。`);
 }
 if(mode==='wave'){
  if(v.wavelength!==32||v.separation!==100)return wait('为只比较探针位置，请保持波长 32、波源间距 100，或重新开始探索。');
  if(phase===0){
   if(current.envelope>.01||Math.abs(current.x-8)>.01||Math.abs(current.y)>.01)return wait('先记录起点 x = 8、y = 0 的静区。请重新开始探索，保留这一对照。');
   return advance('静区已记录：完整周期最大幅度为 0.00。两波都到了这里，但合成始终接近 0。',{envelope:current.envelope});
  }
  if(Math.abs(current.x)>.01||Math.abs(current.y)>.01)return wait('点“探针回中央”，把探针放回 x = 0、y = 0，再比较同一组波源。');
  return complete(`静区的最大幅度 ${f(baseline.evidence.envelope)}，中央为 ${f(current.envelope)}。区别来自两条传播路径，不是有没有波到达。`,`同一组波源：静区完整周期最大幅度 ${f(baseline.evidence.envelope)}；中央 ${f(current.envelope)}。`);
 }
 if(mode==='fractal'){
  if(v.jump!==50)return wait('把“向顶点前进”保持在 50%。这次只换种子，才能公平比较。');
  const seed=phase===0?14:15;
  if(v.seed!==seed)return wait(`这一步需要种子 ${seed}。调整后，点“比较 1,000 点”重建同样点数。`);
  if(current.count!==1000)return wait(`当前是 ${current.count.toLocaleString('zh-CN')} 点。请点“比较 1,000 点”，让两个样本点数相同。`);
  if(phase===0)return advance(`种子 14 已记录：1,000 点，中央空三角形内部 ${current.gapCount} 点。换成种子 15，做第二次比较。`,{gapCount:current.gapCount});
  if(baseline.evidence.gapCount!==0||current.gapCount!==0)return wait(`中央内部落点分别为 ${baseline.evidence.gapCount} / ${current.gapCount}，与这次对照的空隙条件不符。请重新开始探索后再检查。`);
  return complete(`两个种子各 1,000 点，中央内部落点分别为 ${baseline.evidence.gapCount} 和 ${current.gapCount}。随机顺序变了，中央空隙还在。`,`前进 50%、各 1,000 点：种子 14 / 15 的中央空三角形内部落点为 ${baseline.evidence.gapCount} / ${current.gapCount}。`);
 }
 if(mode==='walk'){
  if(v.bias!==0||v.seed!==14)return wait('请保持偏向 0%、种子 14，比较同一规则下的同一组漫步者。');
  const steps=phase===0?16:64;
  if(current.steps!==steps)return wait(`请点“比较 ${steps} 步”，暂停在这次需要的时刻。当前是 ${current.steps} 步。`);
  if(phase===0)return advance(`16 步已记录：理论散开程度 ${f(current.expectedSpread)}，实测 ${f(current.spread)}。接下来比较 64 步。`,{spread:current.spread,expectedSpread:current.expectedSpread});
  return complete(`步数 ×4，理论散开程度 4.00 → 8.00，只变为 2 倍。你这群点的实测值是 ${f(baseline.evidence.spread)} → ${f(current.spread)}。`,`16 → 64 步：理论散开程度 4.00 → 8.00；实测 ${f(baseline.evidence.spread)} → ${f(current.spread)}。`);
 }
 return wait('请先选择一个实验。');
}
