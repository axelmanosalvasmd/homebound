import * as THREE from '/three.js';
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let ws,id,room,g,stations={},walking=null,yaw=0,pitch=0,dragging=false,lastStation,modalPhase,noticeTimer;
const keys=new Set(),avatars=new Map();let audio,osc,gain,soundOn=false;
function toast(s){$('#toast').textContent=s;$('#toast').style.opacity=1;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#toast').style.opacity=0,3500);}
function send(a){if(ws?.readyState===1)ws.send(JSON.stringify(a));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const scene=new THREE.Scene();scene.background=new THREE.Color('#819394');scene.fog=new THREE.FogExp2('#859696',.0023);
const camera=new THREE.PerspectiveCamera(73,innerWidth/innerHeight,.05,2500);camera.rotation.order='YXZ';
let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('#world'),antialias:true});}catch(e){$('#lobbyError').textContent='This browser needs WebGL. Try Chrome or Firefox on a desktop.';throw e;}
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
scene.add(new THREE.HemisphereLight(0xe1eee9,0x30362d,2.3));const sun=new THREE.DirectionalLight(0xffd6a0,2.5);sun.position.set(-80,100,-160);scene.add(sun);
const plane=new THREE.Group();scene.add(plane);const world=new THREE.Group();scene.add(world);
const mat=(color,metalness=.2,roughness=.75)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const steel=mat('#333f3b'),dark=mat('#172223'),rim=mat('#788275',.6),floorMat=mat('#514e3f'),brass=mat('#b5a274',.6),rubber=mat('#17201d');
function box(w,h,d,x,y,z,m=steel,parent=plane){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;}
function cyl(r1,r2,h,x,y,z,m=steel,parent=plane){const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,16),m);o.position.set(x,y,z);parent.add(o);return o;}
function label(text,x,y,z,color='#d2bd8b',size=.65){const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#162023e8';ctx.fillRect(0,0,512,80);ctx.strokeStyle='#aa9d6755';ctx.strokeRect(2,2,508,76);ctx.font='bold 30px monospace';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,51);const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t}));s.scale.set(size*5,size*.78,1);s.position.set(x,y,z);plane.add(s);return s;}
// Riveted fuselage. The aisle is deliberately clear for four crew.
box(3.8,.15,24,0,-.08,0,floorMat);box(3.4,.12,24,0,3.25,0,steel);
for(let z=-11;z<=11;z+=2){
 const curve=new THREE.EllipseCurve(0,0,1.92,1.72,0,Math.PI*2,false,0);const pts=curve.getPoints(40).map(p=>new THREE.Vector3(p.x,p.y+1.5,z));
 const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),40,.045,5,true);plane.add(new THREE.Mesh(geometry,rim));
 for(const x of [-1.85,1.85]){box(.12,.9,2,x,.4,z,steel);box(.12,.6,2,x,2.9,z,steel);box(.13,1.9,.11,x,1.7,z,rim);box(.09,.08,2,x,.98,z,rim);box(.09,.08,2,x,2.6,z,rim);}
 for(const x of [-.7,.7])box(.025,.01,1.6,x,.012,z,brass);
}
// Back and front glazing frames, with sky visible through them.
for(const z of [-12,12]){box(3.8,.75,.12,0,.35,z,steel);box(.09,2.7,.09,0,1.7,z,rim);box(3.8,.09,.1,0,2.65,z,rim);}
for(const x of [-1,1]){box(.08,2,.1,x,1.7,-12,rim);}
// Wings, nacelles and spinning propellers.
box(26,.18,3.3,0,.2,-.6,steel);box(9,.13,2.1,0,1,10,steel);box(.15,3,2.2,0,2,10,steel);
const props=[];
for(const x of [-8,-4,4,8]){const engine=cyl(.56,.5,3,x,.3,-1.4,dark);engine.rotation.x=Math.PI/2;const p=new THREE.Group();p.position.set(x,.3,-3);plane.add(p);for(const angle of [0,Math.PI/2]){const blade=box(.12,2.3,.055,0,0,0,rubber,p);blade.rotation.z=angle;}props.push(p);}
// Instrument panels with drawn analog faces.
function instruments(x,y,z,w=2.8){box(w,.65,.3,x,y,z,dark);const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#172426';ctx.fillRect(0,0,1024,256);for(let i=0;i<6;i++){const cx=88+i*169;ctx.beginPath();ctx.arc(cx,113,67,0,Math.PI*2);ctx.fillStyle='#060e12';ctx.fill();ctx.strokeStyle='#9b9c84';ctx.lineWidth=4;ctx.stroke();for(let a=0;a<12;a++){const angle=a/12*Math.PI*2;ctx.beginPath();ctx.moveTo(cx+Math.cos(angle)*52,113+Math.sin(angle)*52);ctx.lineTo(cx+Math.cos(angle)*60,113+Math.sin(angle)*60);ctx.lineWidth=2;ctx.stroke();}ctx.beginPath();ctx.moveTo(cx,113);ctx.lineTo(cx+Math.cos(i*2)*46,113+Math.sin(i*2)*46);ctx.strokeStyle='#d3ba6d';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#adb9a5';ctx.font='17px monospace';ctx.textAlign='center';ctx.fillText(['ALT','SPEED','BANK','RPM','FUEL','OIL'][i],cx,210);}
 const texture=new THREE.CanvasTexture(c);const face=new THREE.Mesh(new THREE.PlaneGeometry(w,.64),new THREE.MeshBasicMaterial({map:texture}));face.position.set(x,y,z+.16);plane.add(face);}
instruments(0,.93,-11.35);for(const x of [-.9,.9]){box(.65,.18,.65,x,.5,-10.3,rubber);box(.65,.7,.15,x,.86,-9.99,rubber);cyl(.05,.05,.4,x,.68,-10.8,rim);const yoke=new THREE.Mesh(new THREE.TorusGeometry(.2,.025,6,16,Math.PI*1.6),rubber);yoke.position.set(x,1,-10.8);plane.add(yoke);}
box(1,.6,1.5,-1.1,.3,-6,dark);box(1.1,.08,1.8,-1.1,.65,-6,brass);box(.65,.01,1.2,-1.1,.7,-6,mat('#9b9e81'));cyl(.12,.17,.45,.9,.9,-6,dark);
box(.5,1.3,2.3,-1.45,.7,1,dark);instruments(-.8,1.15,.8,1.4);for(let i=0;i<4;i++){const pipe=cyl(.045,.045,2.6,1.7,1.3,i*.3,rim);}
const extinguisher=cyl(.14,.14,.65,1.5,.65,2,mat('#923e2c'));cyl(.055,.055,.16,1.5,1.05,2,rim);
box(1,.3,.8,0,.5,9,rubber);for(const x of [-.35,.35]){const gun=cyl(.055,.07,2,x,1.22,10.5,dark);gun.rotation.x=Math.PI/2;}
label('01 / FLIGHT DECK',0,2.6,-9.9);label('02 / NAVIGATION',0,2.6,-5.8);label('03 / ENGINEERING',0,2.6,1.2);label('04 / TAIL TURRET',0,2.6,9.3);
const fireLight=new THREE.PointLight(0xff6325,0,10);fireLight.position.set(-1,1.6,1);plane.add(fireLight);
for(const z of [-8,0,8]){const l=new THREE.PointLight(0xffd59a,5,10,2);l.position.set(0,2.9,z);plane.add(l);box(.35,.06,.2,0,3,z,new THREE.MeshBasicMaterial({color:0xffdda2}));}
// Low-poly countryside passing underneath; no downloaded model assets.
box(3500,2,3500,0,-185,0,mat('#66786d',0),world);
for(let i=0;i<95;i++){const x=Math.sin(i*41.2)*1200,z=Math.cos(i*17.7)*1200;const field=box(90+i%5*20,.2,75+i%7*10,x,-183.5,z,mat(['#7c8565','#6b785f','#899079','#526d66'][i%4],0),world);field.rotation.y=i*1.7;
 if(i%3===0)box(8,5,12,x,-181,z,mat('#65675b'),world);
}
for(let i=0;i<20;i++){const cloud=new THREE.Mesh(new THREE.IcosahedronGeometry(25+i%4*8,1),mat('#cad0c5',0,1));cloud.scale.set(2,.2,1);cloud.position.set(Math.sin(i*6.3)*700,25+i%5*12,Math.cos(i*5.4)*700);world.add(cloud);}
const target=box(28,4,50,0,-181,-240,mat('#443f36'),world);for(let i=0;i<5;i++)box(1,.3,100,i*4-8,-182,-240,brass,world);
const fighter=new THREE.Group();box(1,.4,4,0,0,0,dark,fighter);box(7,.15,1,0,0,0,dark,fighter);box(2,.1,.8,0,.2,1.4,dark,fighter);scene.add(fighter);fighter.visible=false;
const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,1.3,11),new THREE.Vector3(0,1.3,100)]),new THREE.LineBasicMaterial({color:0xffd76d}));scene.add(trace);trace.visible=false;let traceUntil=0;
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);
// Network and room lifecycle.
$('#room').value=new URLSearchParams(location.search).get('room')||'';
function joinLabel(){$('#joinButton').textContent=$('#room').value.trim()?'Join crew':'Create crew';}$('#room').oninput=joinLabel;joinLabel();
$('#joinForm').onsubmit=e=>{e.preventDefault();$('#joinButton').disabled=true;$('#lobbyError').textContent='Connecting to aircraft…';
 ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
 ws.onopen=()=>send({type:'join',room:$('#room').value,name:$('#name').value});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='welcome'){id=m.id;room=m.room;stations=m.stations;$('#lobby').hidden=true;$('#game').hidden=false;$('#roomCode').textContent=room;history.replaceState(null,'','?room='+room);yaw=0;pitch=0;}
 if(m.type==='state'){g=m.game;renderUI();}
 if(m.type==='notice')toast(m.message);
 if(m.type==='error'){$('#lobbyError').textContent=m.message;$('#joinButton').disabled=false;}
 };
 ws.onclose=()=>{if(id){$('#missionModal').hidden=false;$('#missionModal').innerHTML='<div><span class="eyebrow">CONNECTION LOST</span><h2>Intercom went silent.</h2><p>Your seat has been released. Rejoin with the crew code. Empty rooms are removed.</p><button onclick="location.reload()">Reconnect</button></div>';if(g)g.disconnected=true;}else{$('#joinButton').disabled=false;if($('#lobbyError').textContent==='Connecting to aircraft…')$('#lobbyError').textContent='Could not connect. Please retry.';}};
 ws.onerror=()=>{$('#lobbyError').textContent='Connection failed. Check your network.';$('#joinButton').disabled=false;};};
$('#invite').onclick=async()=>{const url=location.origin+'/?room='+room;try{await navigator.clipboard.writeText(url);toast('Crew invite copied. Share with up to three friends.');}catch{prompt('Copy this crew invite:',url);}};
$('#sound').onclick=()=>{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();osc=audio.createOscillator();gain=audio.createGain();osc.type='sawtooth';osc.frequency.value=55;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=180;osc.connect(filter);filter.connect(gain);gain.connect(audio.destination);osc.start();}soundOn=!soundOn;audio.resume();gain.gain.value=soundOn?.035:0;$('#sound').textContent=soundOn?'Sound on':'Sound off';};
for(const b of $$('[data-walk]'))b.onclick=()=>{if(!g||g.disconnected)return;if(g.players[id]?.station)send({type:'exit'});walking=b.dataset.walk;const s=stations[walking];yaw=s.z<g.players[id].z?0:Math.PI;pitch=0;toast('Walking to '+s.name+'. Press E or Use when you arrive.');};
for(const b of $$('[data-call]'))b.onclick=()=>send({type:'call',text:b.dataset.call});
let nearest=null;$('#useStation').onclick=()=>{if(nearest){send({type:'station',station:nearest});walking=null;}};
// First-person input: drag works over HTTP as well as HTTPS, no pointer-lock dependency.
$('#world').addEventListener('pointerdown',e=>{dragging=true;$('#world').setPointerCapture(e.pointerId);});
$('#world').addEventListener('pointermove',e=>{if(dragging&&id){yaw-=e.movementX*.004;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.003,-1.1,1.1);}});
$('#world').addEventListener('pointerup',()=>dragging=false);
addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;keys.add(e.code);if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code))walking=null;if(e.code==='KeyE'&&!e.repeat){if(g?.players[id]?.station)send({type:'exit'});else $('#useStation').click();}if(e.code==='Space'&&g?.players[id]?.station==='gunner'){send({type:'shoot'});traceUntil=performance.now()+100;}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();dragging=false;walking=null;send({type:'move',x:0,z:0});});
setInterval(()=>{const p=g?.players[id];if(!p||g.disconnected)return;if(p.station)return;let x=0,z=0;
 if(walking){const s=stations[walking];const dz=s.z-p.z,dx=s.x-p.x;if(Math.hypot(dx,dz)<.35){walking=null;}else{x=dx;z=dz;const n=Math.max(1,Math.hypot(x,z));x/=n;z/=n;}}
 else{const f=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));const side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));x=-Math.sin(yaw)*f+Math.cos(yaw)*side;z=-Math.cos(yaw)*f-Math.sin(yaw)*side;}
 send({type:'move',x,z});
},100);
function stat(label,value,max=100,bad=false){const pc=Math.max(0,Math.min(100,value/max*100));return `<div class="stat"><div class="line"><span>${label}</span><span>${Math.round(value)}${max===100?'%':''}</span></div><div class="track"><div class="fill ${bad?'bad':pc<35?'bad':pc<65?'warn':''}" style="width:${pc}%"></div></div></div>`;}
function readout(a,b,c){return `<div class="readout">${[a,b,c].map(([v,l])=>`<div><b>${v}</b><small>${l}</small></div>`).join('')}</div>`;}
function renderUI(){if(!g||g.disconnected)return;const p=g.players[id];if(!p)return;
 $('#phase').textContent=g.phase.toUpperCase();
 const objectives={briefing:['Assemble your crew','Stations are shared. Jobs are not permanent.'],outbound:['Reach the rail junction',`Course ${String(g.targetHeading).padStart(3,'0')}° · ${g.distance?.toFixed(1)} km to target`],attack:['Hold steady. Bombardier, your aircraft.',`Heading 090° · 2500–3500 m · ${Math.max(0,Math.ceil(65-g.attackTime))}s bombing window`],return:['Bring Lucky Strike home',`Course 270° · ${g.distance?.toFixed(1)} km · Land below 400 m, throttle ≤50%, bank <8°`],debrief:['Mission debrief','Every return is a story.']};
 const obj=objectives[g.phase];$('#objective').textContent=obj[0];$('#objectiveSub').textContent=obj[1];
 $('#systems').innerHTML=stat('AIRFRAME',g.hull??100)+stat('FUEL',g.fuel??100)+stat('PORT ENGINE',g.engines?.[0]??100)+stat('STBD ENGINE',g.engines?.[1]??100)+(g.fire?stat('FIRE',g.fire,100,true):'');
 $('#crewList').innerHTML=Object.values(g.players).map(q=>`<div class="crew"><span>${esc(q.name)}${q.id===id?' •':''}</span><small>${q.station||'moving'}</small></div>`).join('');
 $('#radioLog').innerHTML=(g.log||[]).slice(0,4).map(l=>`<p><time>${String(Math.floor(l.t/60)).padStart(2,'0')}:${String(l.t%60).padStart(2,'0')}</time>${esc(l.text)}</p>`).join('')||'<p>All stations, check in. Use a voice call for live crew communication.</p>';
 nearest=null;for(const [k,s] of Object.entries(stations))if(Math.hypot(p.x-s.x,p.z-s.z)<2.5&&!Object.values(g.players).some(q=>q.id!==id&&q.station===k))nearest=k;
 $('#useStation').hidden=!!p.station||!nearest||['briefing','debrief'].includes(g.phase);if(nearest)$('#useStation').textContent='Use '+stations[nearest].name;
 $('#walkHint').hidden=!!p.station;$('#walkHint').textContent=walking?'Walking…':matchMedia('(pointer:coarse)').matches?'Drag to look · Tap a station below':'Drag to look · WASD to walk · E to use';
 for(const b of $$('[data-walk]'))b.classList.toggle('active',p.station===b.dataset.walk||walking===b.dataset.walk);
 document.body.classList.toggle('at-station',!!p.station);$('#panel').hidden=!p.station;
 if(p.station!==lastStation){lastStation=p.station;buildPanel(p.station);if(p.station){yaw=p.station==='gunner'?Math.PI:0;pitch=0;}}
 updatePanel(p.station);
 if(g.phase!==modalPhase){modalPhase=g.phase;renderModal();}
 else if(g.phase==='debrief'){const b=$('#again');if(b){b.disabled=id!==g.host;b.textContent=id===g.host?'Fly another sortie':'Waiting for crew leader';}}
 else if(g.phase==='briefing'){const b=$('#begin');if(b){b.disabled=id!==g.host;b.textContent=id===g.host?'Begin mission':'Waiting for crew leader';}}
}
function buildPanel(s){if(!s)return;let content='';
 if(s==='pilot')content=`<div id="pilotControls"><div id="flightReadout"></div><label>Bank <span id="bankValue"></span></label><input aria-label="Bank" id="bank" type="range" min="-30" max="30" step="1"><label>Climb / descend <span id="pitchValue"></span></label><input aria-label="Climb or descend" id="pitch" type="range" min="-5" max="5" step="0.25"><label>Throttle <span id="throttleValue"></span></label><input aria-label="Throttle" id="throttle" type="range" min="0.1" max="1" step="0.05"><div class="row"><button id="level">Level wings</button><button id="land" class="primary">Land aircraft</button></div><p id="landingHint"></p><div class="row"><button id="abort">Abort / RTB</button><button id="bail" class="danger">Bail out</button></div></div>`;
 if(s==='navigator')content=`<svg id="map" viewBox="0 0 600 220" role="img" aria-label="Navigation route"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#43584a"/></pattern></defs><rect width="600" height="220" fill="url(#grid)"/><path d="M60 110H540" stroke="#c5b57c" stroke-dasharray="6 6"/><g fill="none" stroke="#bfc6ac"><rect x="50" y="100" width="20" height="20"/><rect x="530" y="100" width="20" height="20"/></g><g fill="#bfc6ac" font-size="18" font-family="monospace"><text x="28" y="177">BASE</text><text x="490" y="177">TARGET</text></g><path id="mapPlane" d="M15 0L-10 -9L-4 0L-10 9Z" fill="#ddc180"/></svg><div id="navReadout"></div><div id="lockMeter"></div><p id="navHint"></p><div class="row"><button id="course">Call heading</button><button id="drop" class="primary">Release bombs</button></div>`;
 if(s==='engineer')content=`<div id="engineeringReadout"></div><p>Field repairs take 3 seconds between actions. Patched engines recover to 85%, not factory condition.</p><div class="repair-grid"><button data-repair="fire">Extinguish fire</button><button data-repair="leak">Seal fuel leak</button><button data-repair="engine0">Patch port engine</button><button data-repair="engine1">Patch starboard</button><button data-repair="electric">Restore power</button><button data-repair="oxygen">Patch oxygen</button></div><p id="repairHint"></p>`;
 if(s==='gunner')content=`<div id="gunReadout"></div><div id="threatMeter"></div><p>Watch your six. Each burst pushes the approaching fighter back. Stop it before it strafes the fuselage.</p><div class="row"><button id="shoot" class="primary">Fire burst [SPACE]</button><button id="contact">Call contact</button></div><p class="muted">MVP: assisted aim. Ammunition is limited.</p>`;
 $('#panel').innerHTML=`<span class="eyebrow">CREW STATION / ${s.toUpperCase()}</span><h3>${stations[s].name}</h3>${content}<button class="exit" id="exit">Leave station</button>`;
 $('#exit').onclick=()=>send({type:'exit'});
 if(s==='pilot'){
 for(const k of ['bank','pitch','throttle']){$('#'+k).value=g[k];$('#'+k).oninput=e=>send({type:'control',[k]:Number(e.target.value)});}
 $('#level').onclick=()=>{send({type:'control',bank:0,pitch:0});$('#bank').value=0;$('#pitch').value=0;};$('#abort').onclick=()=>{if(confirm('Abort bombing and return home?'))send({type:'abort'});};$('#bail').onclick=()=>{if(confirm('Abandon the aircraft? This ends the mission for the entire crew.'))send({type:'bail'});};$('#land').onclick=()=>send({type:'land'});
 }
 if(s==='navigator'){$('#drop').onclick=()=>send({type:'drop'});$('#course').onclick=()=>send({type:'call',text:`Fly heading ${g.targetHeading}°. ${g.phase==='return'?'Homebound.':'Hold 2500–3500 m for bombing.'}`});}
 if(s==='engineer')for(const b of $$('[data-repair]'))b.onclick=()=>send({type:'repair',system:b.dataset.repair});
 if(s==='gunner'){$('#shoot').onclick=()=>{send({type:'shoot'});traceUntil=performance.now()+130;};$('#contact').onclick=()=>send({type:'call',text:'Fighter at six o’clock! Taking the shot.'});}
}
function updatePanel(s){if(!s)return;
 if(s==='pilot'){$('#flightReadout').innerHTML=readout([String(Math.round(g.heading)).padStart(3,'0')+'°','HEADING'],[Math.round(g.altitude),'ALT / METRES'],[g.distance.toFixed(1),'KM TO '+(g.phase==='return'?'HOME':'TARGET')]);for(const k of ['bank','pitch','throttle']){$('#'+k+'Value').textContent=k==='throttle'?Math.round(g[k]*100)+'%':g[k].toFixed(1)+'°';if(document.activeElement!==$('#'+k))$('#'+k).value=g[k];}$('#land').disabled=!(g.phase==='return'&&g.distance<=.5&&g.altitude<=400&&g.throttle<=.5&&Math.abs(g.bank)<8);$('#landingHint').textContent=g.phase==='return'?'Landing: ≤0.5 km · ≤400 m · ≤50% throttle · bank <8°':'Controls hold when you leave. Bank changes heading; level wings to hold course.';$('#abort').disabled=g.phase==='return';}
 if(s==='navigator'){$('#navReadout').innerHTML=readout([g.targetHeading+'°','REQUIRED COURSE'],[Math.round(g.heading)+'°','ACTUAL COURSE'],[g.distance.toFixed(1),'KM REMAINING']);$('#lockMeter').innerHTML=stat('BOMBSIGHT SOLUTION',g.lock/12*100);$('#drop').disabled=g.phase!=='attack'||!g.bombs;$('#navHint').textContent=g.phase==='attack'?`Hold heading 090°, bank under 5°, altitude 2500–3500 m. ${Math.ceil(65-g.attackTime)}s left.`:g.phase==='return'?'Bombing run complete. Guide your pilot west toward base.':'Solution builds over 12 stable seconds once the target is in range.';
 const progress=g.phase==='return'?g.distance/10:1-g.distance/12;const x=60+480*Math.max(0,Math.min(1,progress));$('#mapPlane').setAttribute('transform',`translate(${x} 110) rotate(${g.heading-90})`);}

 if(s==='engineer'){$('#engineeringReadout').innerHTML=readout([Math.round(g.fire)+'%','FIRE'],[g.leak.toFixed(1),'FUEL LEAK'],[Math.round(g.electric)+'%','POWER'])+readout([Math.round(g.engines[0])+'%','PORT ENGINE'],[Math.round(g.engines[1])+'%','STBD ENGINE'],[Math.round(g.oxygen)+'%','OXYGEN']);const remaining=Math.max(0,(g.players[id].repairAt||0)-g.time);$('#repairHint').textContent=remaining>0?`Working… tools ready in ${remaining.toFixed(1)}s`:'Tools ready. Hull damage cannot be repaired in flight.';for(const b of $$('[data-repair]'))b.disabled=remaining>0;}
 if(s==='gunner'){$('#gunReadout').innerHTML=readout([g.ammo,'BURSTS'],[g.kills,'DRIVEN OFF'],[g.threat?Math.ceil(g.threatTime)+'s':'CLEAR','TIME TO IMPACT']);$('#threatMeter').innerHTML=stat('FIGHTER THREAT',g.threat,100,true);$('#shoot').disabled=!g.ammo;}
}
function renderModal(){const m=$('#missionModal');m.hidden=!['briefing','debrief'].includes(g.phase);if(m.hidden)return;
 if(g.phase==='briefing'){m.innerHTML=`<div><span class="eyebrow">OPERATION NIGHT LANTERN / CREW ${room}</span><h2>Bring her home.</h2><p>You start airborne. Strike the rail junction, then return west. The aircraft holds its last flight inputs when the pilot leaves.</p><div class="steps">01 / Flight deck: bank to turn, level to hold heading.<br>02 / Navigation: stabilize the bombsight, release.<br>03 / Engineering: fight fires and patch systems.<br>04 / Tail turret: drive off incoming fighters.</div><p>Solo is supported. Walk between stations using the bottom buttons. Invite friends before starting, or let them join in flight.</p><button id="begin" class="primary" ${g.host!==id?'disabled':''}>${g.host===id?'Begin mission':'Waiting for crew leader'}</button></div>`;$('#begin').onclick=()=>send({type:'start'});const invite=document.createElement('button');invite.textContent='Copy crew invite';invite.style.marginTop='10px';invite.onclick=()=>$('#invite').click();$('#begin').after(invite);}
 else{const text=g.outcome==='LANDED'?(g.bombScore>50?'Target hit. Aircraft recovered. The crew made it home.':'You brought the crew home. The target will have to wait.'):g.outcome==='BAILED OUT'?'The aircraft is gone. The crew escaped by parachute.':g.outcome==='DITCHED'?'You could not keep her airborne. The crew made an emergency ditching.':'The aircraft did not survive. Next time, prioritize the fire.';m.innerHTML=`<div><span class="eyebrow">MISSION DEBRIEF / LUCKY STRIKE</span><h2>${esc(g.outcome)}</h2><p>${text}</p><div class="kpis"><div><b>${g.bombScore}%</b><small>TARGET DAMAGE</small></div><div><b>${g.kills}</b><small>FIGHTERS DRIVEN OFF</small></div><div><b>${g.repairs}</b><small>FIELD REPAIRS</small></div></div><p>Aircraft condition: ${Math.max(0,Math.round(g.hull))}%. This MVP resets the aircraft each sortie. Campaign scars and upgrades are not implemented yet.</p><button id="again" class="primary" ${g.host!==id?'disabled':''}>${g.host===id?'Fly another sortie':'Waiting for crew leader'}</button></div>`;$('#again').onclick=()=>{walking=null;send({type:'start'});};}
}
let previous=performance.now();const camPos=new THREE.Vector3();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-previous)/1000);previous=now;
 for(const p of props)p.rotation.z+=dt*(g?.throttle??.7)*38;
 const me=g?.players[id];
 if(!me){const t=now*.000025;camera.position.set(25*Math.cos(t),10,27*Math.sin(t));camera.lookAt(0,1,0);}
 else{
 let px=me.x,pz=me.z;const station=me.station;if(station){px=station==='pilot'?0:me.x;pz=stations[station].z;}
 camPos.set(px,1.63,pz);camera.position.lerp(camPos,1-Math.exp(-dt*14));camera.rotation.set(pitch+(g.pitch||0)*.003,yaw,-(g.bank||0)*.003+Math.sin(now*.009)*.0015);
 world.rotation.y=-(g.heading-90||0)*Math.PI/180;
 world.position.z=((g.time||0)*6)%350;
 fireLight.intensity=(g.fire||0)*.12*(.8+Math.sin(now*.025)*.2);
 fighter.visible=!!g.threat;fighter.position.set(Math.sin(now*.001)*4,2+Math.sin(now*.0015),25+(g.threatTime||0)*4);fighter.rotation.z=Math.sin(now*.002)*.25;
 if(osc)osc.frequency.value=40+(g.throttle||.5)*28;
 for(const q of Object.values(g.players))if(q.id!==id){let a=avatars.get(q.id);if(!a){a=new THREE.Group();const body=cyl(.26,.3,.8,0,.8,0,mat('#7e8260'),a);const head=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),mat('#b1a68b'));head.position.y=1.42;a.add(head);box(.4,.25,.3,0,1.52,0,mat('#514c35'),a);plane.add(a);avatars.set(q.id,a);}a.position.lerp(new THREE.Vector3(q.x,0,q.z),1-Math.exp(-dt*12));}
 for(const [key,a]of avatars)if(!g.players[key]){plane.remove(a);a.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});avatars.delete(key);}
 }
 trace.visible=now<traceUntil;renderer.render(scene,camera);
}requestAnimationFrame(frame);
