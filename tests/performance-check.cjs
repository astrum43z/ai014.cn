const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      window.work={frames:0,draws:0};
      const request=window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame=callback=>request(time=>{window.work.frames++;callback(time)});
      const clear=CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect=function(...args){window.work.draws++;return clear.apply(this,args)};
    });
    await page.goto('http://127.0.0.1:8140/?mode=life&rate=1&density=30');
    await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
    const work=()=>page.evaluate(()=>({...window.work}));
    let before=await work();await page.waitForTimeout(1200);let after=await work();
    assert.ok(after.draws-before.draws>=1 && after.draws-before.draws<=2,'Life only redraws on generations');
    console.log('Mobile Life at 1 generation/s:',after.frames-before.frames,'frames,',after.draws-before.draws,'draws in 1.2s');
    await page.locator('#pause').click();await page.waitForTimeout(100);before=await work();await page.waitForTimeout(300);after=await work();
    assert.deepEqual(after,before,'pause must stop frame callbacks and redraws');
    await page.locator('#step').click();assert.ok((await work()).draws>after.draws,'paused single-step still redraws');
    await page.locator('#pause').click();await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
    before=await work();await page.waitForTimeout(300);assert.deepEqual(await work(),before,'hidden tab must stop');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
    await page.waitForTimeout(150);assert.ok((await work()).frames>before.frames,'visible tab resumes');
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(150);
    before=await work();await page.waitForTimeout(300);assert.deepEqual(await work(),before,'offscreen canvas must stop');
    await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(150);assert.ok((await work()).frames>before.frames,'onscreen canvas resumes');
    await page.locator('#tab-wave').click();await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
    before=await work();await page.waitForTimeout(200);assert.ok((await work()).draws>before.draws,'wave keeps animating');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/tmp/ai014-cn-mobile-performance.png',fullPage:true});
    await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
    assert.equal(await page.locator('#status').textContent(),'已暂停');before=await work();await page.waitForTimeout(200);assert.deepEqual(await work(),before,'reduced motion starts idle');
    console.log('Passed: mobile, pause/step/resume, hidden/visible, offscreen/onscreen, wave animation, reduced motion, no overflow or page errors');
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
