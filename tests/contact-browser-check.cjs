const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8140';
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(base).origin});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base);await page.locator('#copy-wechat').waitFor({state:'visible'});
  assert.equal(await page.locator('[role="tab"]').count(),5);
  const button=page.getByRole('button',{name:'复制微信号',exact:true});
  await page.getByRole('tab',{name:/漫步也会扩散/}).click();await page.locator('#step').click();
  const metrics=await page.locator('#metrics').textContent();const url=page.url();
  await button.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#contact-status').textContent==='微信号已复制');
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'goodmorning2you');
  assert.equal(await page.locator('#metrics').textContent(),metrics);assert.equal(page.url(),url);
  assert.equal(await button.evaluate(el=>document.activeElement===el),true);
  await page.keyboard.press('Space');await page.waitForFunction(()=>!document.querySelector('#copy-wechat').disabled);
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'goodmorning2you');
  await page.screenshot({path:'/tmp/cn-contact-desktop.png',fullPage:true});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await button.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const box=await button.boundingBox();assert.ok(box.height>=44&&box.width>=44);
    assert.equal(await page.locator('#wechat-handle').inputValue(),'goodmorning2you');
    await page.screenshot({path:`/tmp/cn-contact-mobile-${width}.png`,fullPage:true});
  }
  // A denied clipboard leaves a fully selected, visible fallback and permits retry.
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
  await button.click();await page.waitForFunction(()=>document.querySelector('#contact-status').textContent.includes('手动复制'));
  assert.deepEqual(await page.locator('#wechat-handle').evaluate(el=>[document.activeElement===el,el.selectionStart,el.selectionEnd]),[true,0,15]);
  assert.equal(await button.isEnabled(),true);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await button.click();assert.match(await page.locator('#contact-status').textContent(),/手动复制/);
  assert.equal(await button.isEnabled(),true);assert.deepEqual(errors,[]);
  await context.close();
  const noScript=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:844}});
  const plain=await noScript.newPage();await plain.goto(base);
  assert.equal(await plain.locator('#wechat-handle').inputValue(),'goodmorning2you');
  assert.equal(await plain.locator('#copy-wechat').isVisible(),false);
  await noScript.close();await browser.close();
  console.log('Contact browser QA passed: real clipboard, keyboard repeat, no simulation reset, 1440/390/320 layouts, 44px target, denied/missing API fallback, and no-JS contact');
})().catch(e=>{console.error(e);process.exitCode=1;});
