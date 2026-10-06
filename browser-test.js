import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.URL||'http://127.0.0.1:8790');
 await page.getByLabel('Callsign').fill('Axel');await page.getByRole('button',{name:'Create crew'}).click();
 await page.locator('#roomCode').waitFor();assert.equal(await page.getByRole('button',{name:'Copy crew invite'}).isVisible(),true); const code=await page.locator('#roomCode').textContent();assert.match(code,/^[A-F0-9]{6}$/);
 const second=await browser.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto((process.env.URL||'http://127.0.0.1:8790')+'/?room='+code);
 await second.getByLabel('Callsign').fill('Emily');await second.getByRole('button',{name:'Join crew'}).click();await second.locator('#roomCode').waitFor();
 await page.getByRole('button',{name:'Begin mission'}).click();await page.getByText('OUTBOUND',{exact:true}).waitFor();await second.getByText('OUTBOUND',{exact:true}).waitFor();
 await page.locator('[data-walk="pilot"]').click();await page.getByRole('button',{name:'Use Flight deck'}).click({timeout:15000});
 await page.locator('#pilotControls').waitFor();assert.equal(await page.locator('#crewList').getByText('Emily',{exact:false}).count(),1);
 await page.locator('#throttle').fill('0.8');await page.locator('#throttle').dispatchEvent('input');
 await page.screenshot({path:'artifacts/cockpit.png'});
 await page.getByRole('button',{name:'Leave station'}).click();await page.locator('[data-walk="engineer"]').click();await page.getByRole('button',{name:'Use Engineering'}).click({timeout:15000});await page.getByRole('button',{name:'Extinguish fire'}).click();
 await page.screenshot({path:'artifacts/engineering.png'});
 await page.getByRole('button',{name:'Leave station'}).click();await page.locator('[data-walk="pilot"]').click();await page.getByRole('button',{name:'Use Flight deck'}).click({timeout:15000});
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Bail out',exact:true}).click();await page.getByRole('heading',{name:'BAILED OUT',exact:true}).waitFor();
 await page.getByRole('button',{name:'Fly another sortie'}).click();await second.getByText('OUTBOUND',{exact:true}).waitFor();
 await page.locator('[data-walk="navigator"]').click();await page.getByRole('button',{name:'Use Navigation / bombsight'}).click({timeout:15000});await page.locator('#map').waitFor();assert.equal(await page.locator('#drop').isDisabled(),true);
 await page.getByRole('button',{name:'Leave station'}).click();await page.locator('[data-walk="gunner"]').click();await page.getByRole('button',{name:'Use Tail turret'}).click({timeout:15000});await page.getByRole('button',{name:'Fire burst [SPACE]',exact:true}).click();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(process.env.URL||'http://127.0.0.1:8790');await mobile.getByRole('button',{name:'Create crew'}).click();await mobile.locator('#roomCode').waitFor();await mobile.getByRole('button',{name:'Begin mission'}).click();await mobile.getByText('OUTBOUND',{exact:true}).waitFor();await mobile.screenshot({path:'artifacts/mobile.png'});
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no mobile overflow');
 assert.deepEqual(errors,[]);console.log('PASS: two browser crew members synchronized, walk/use pilot + engineer, touch viewport, zero JS errors.');
 await second.close();await mobile.close();
}catch(e){console.error('BROWSER ERRORS',errors);console.error('STATE',await page.evaluate(()=>({body:document.body.innerText,exit:document.querySelector('#exit')?.getBoundingClientRect().toJSON()})).catch(()=>null));await page.screenshot({path:'artifacts/failure.png',timeout:5000}).catch(()=>{});throw e;}finally{await browser.close();}
