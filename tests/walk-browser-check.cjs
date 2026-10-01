const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8154';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1440,height:1100},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]){
   const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base+'/?experiment=walk');await page.locator('#walk-64').waitFor();
   assert.equal(await page.locator('#status').textContent(),'已暂停');
   assert.equal(await page.locator('[role=tab]').count(),5);
   await page.locator('#walk-64').click();assert.match(await page.locator('#metrics').textContent(),/64 步/);assert.match(await page.locator('#observation-b').textContent(),/8.00/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+viewport.width);
   await page.locator('#panel').screenshot({path:'/tmp/ai014-cn-walk-'+viewport.width+'.png'});
   await page.getByRole('slider',{name:'向右偏向'}).fill('25');await page.locator('#walk-64').click();assert.match(await page.locator('#observation-detail').textContent(),/理论中心 x = 16.00/);
   await page.locator('#canvas').focus();await page.keyboard.press('ArrowRight');assert.match(await page.locator('#metrics').textContent(),/80 步/);await page.keyboard.press('Home');assert.match(await page.locator('#metrics').textContent(),/16 步/);
   await page.locator('#share').click();assert.match(await page.locator('#share-link').inputValue(),/experiment=walk&bias=25&seed=14/);
   const downloading=page.waitForEvent('download');await page.locator('#save').click();const download=await downloading;assert.equal(download.suggestedFilename(),'small-worlds-walk.png');
   await page.locator('#tab-walk').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-orbit').getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.locator('#tab-walk').getAttribute('aria-selected'),'true');
   await page.locator('#walk-64').click();await page.locator('.reading-nav a[href="#discovery-title"]').click();await page.goBack();assert.match(await page.locator('#metrics').textContent(),/64 步/);
   await page.locator('#discovery-next').click();assert.equal(await page.locator('#tab-orbit').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#status').textContent(),'已暂停');
   assert.deepEqual(errors,[]);console.log('Walk browser checks passed at viewport '+viewport.width+'×'+viewport.height);await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
