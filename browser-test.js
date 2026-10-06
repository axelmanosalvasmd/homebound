import {chromium} from 'playwright';import assert from 'node:assert/strict';
// Two independent crew members in one room. Software rendering is slow, so waits are generous.
const URL=process.env.URL||'http://127.0.0.1:8790',T={timeout:120000};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];const open=async()=>{const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errors.push(e.message));await p.goto(URL,T);return p;};
// Walk with a key until the on-screen prompt offers the named station, then press E to take it.
async function take(p,key,name){await p.keyboard.down(key);for(let i=0;i<300&&!(await p.locator('#prompt').textContent()).includes(name);i++)await p.waitForTimeout(50);await p.keyboard.up(key);await p.waitForTimeout(300);await p.keyboard.press('KeyE');}
try{
 const a=await open();await a.getByLabel('Callsign').fill('Axel',T);await a.getByRole('button',{name:'Create crew'}).click(T);
 await a.locator('#roomCode').waitFor(T);const code=await a.locator('#roomCode').textContent();assert.match(code,/^[A-F0-9]{6}$/);
 const b=await open();await b.goto(URL+'/?room='+code,T);await b.getByLabel('Callsign').fill('Emily',T);await b.getByRole('button',{name:'Join crew'}).click(T);await b.locator('#roomCode').waitFor(T);
 await a.getByRole('button',{name:'Begin mission'}).click(T);await a.getByText('OUTBOUND',{exact:true}).waitFor(T);await b.getByText('OUTBOUND',{exact:true}).waitFor(T);
 await take(a,'KeyW','Navigator');await a.getByText('Click: mark position',{exact:false}).waitFor(T);
 await b.getByText('Right waist gun',{exact:false}).waitFor(T);await b.keyboard.press('KeyE');await b.getByText('bursts left',{exact:false}).waitFor(T);
 await a.screenshot({path:'artifacts/navigator.png',...T});await b.screenshot({path:'artifacts/waist-gun.png',...T});
 assert.deepEqual(errors,[]);console.log('PASS: two crew synchronized, walked to and took the navigator table and a waist gun, zero JS errors.');
}finally{await browser.close();}
