import * as THREE from '/three.js';
import {buildExterior,paintSkin} from '/b17-exterior.js';
import {makeCrewman,disposeCrewman} from '/crew.js';
import {MAP,aisle,drawChart,drawTerrain,chartToKm,kmToChart,scatter} from '/map.js';
const $=s=>document.querySelector(s);
let ws,id,room,g,stations={},hotspots={},yaw=0,pitch=0,lastStation,modalPhase,noticeTimer;
const keys=new Set(),avatars=new Map();
function toast(s){$('#toast').textContent=s;$('#toast').style.opacity=1;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#toast').style.opacity=0,3500);}
function send(a){if(ws?.readyState===1)ws.send(JSON.stringify(a));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const HORIZON='#c3c8b8';
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(HORIZON,.000045);
const camera=new THREE.PerspectiveCamera(73,innerWidth/innerHeight,.05,120000);camera.rotation.order='YXZ';scene.add(camera);
let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('#world'),antialias:true,logarithmicDepthBuffer:true});}catch(e){$('#lobbyError').textContent='This browser needs WebGL. Try Chrome or Firefox on a desktop.';throw e;}
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
scene.add(new THREE.HemisphereLight(0xdfe8e4,0x3a3a2c,2));const sun=new THREE.DirectionalLight(0xffd6a0,2.8);sun.position.set(-80,100,-160);scene.add(sun);
// The aircraft stays at the origin. The outside world rolls with bank (roll), turns with heading (yawGroup) and
// slides under the aircraft by its map position and altitude (world). Map km (x east, y north) -> world (x*1000, alt, -y*1000).
const plane=new THREE.Group();scene.add(plane);const roll=new THREE.Group();scene.add(roll);const yawGroup=new THREE.Group();roll.add(yawGroup);const world=new THREE.Group();yawGroup.add(world);
const KM=1000,toWorld=(x,y,alt=0)=>new THREE.Vector3(x*KM,alt,-y*KM);
const mat=(color,metalness=.2,roughness=.75)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
// Every procedural texture is drawn on a canvas; colour maps must be tagged sRGB or they wash out.
function tex(w,h,draw,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
const rand=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(7);
const steel=mat('#333f3b'),dark=mat('#172223'),rim=mat('#6f7868',.6),brass=mat('#b5a274',.6),rubber=mat('#17201d');
const drab=new THREE.MeshStandardMaterial({color:'#4a4e37',roughness:.8,metalness:.15,flatShading:true});
function box(w,h,d,x,y,z,m=steel,parent=plane){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;}
function cyl(r1,r2,h,x,y,z,m=steel,parent=plane){const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,16),m);o.position.set(x,y,z);parent.add(o);return o;}
function label(text,x,y,z,color='#d2bd8b',size=.65,parent=plane){const t=tex(512,80,ctx=>{ctx.fillStyle='#162023e8';ctx.fillRect(0,0,512,80);ctx.strokeStyle='#aa9d6788';ctx.lineWidth=3;ctx.strokeRect(3,3,506,74);ctx.font='bold 30px monospace';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,51);});const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,fog:false}));s.scale.set(size*5,size*.78,1);s.position.set(x,y,z);parent.add(s);return s;}
// A flat panel whose canvas is redrawn with live values (cockpit gauges, navigator's repeaters).
function livePanel(w,h,px,x,y,z,draw,rotY=0){const c=document.createElement('canvas');c.width=px;c.height=Math.round(px*h/w);const ctx=c.getContext('2d');const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:'#ffffff',emissiveIntensity:.45,roughness:.5}));m.position.set(x,y,z);m.rotation.y=rotY;plane.add(m);
 return {mesh:m,redraw:s=>{draw(ctx,c.width,c.height,s);t.needsUpdate=true;}};}
function dial(ctx,cx,cy,r,label,value,max,{ticks=10,text}={}){ctx.save();ctx.beginPath();ctx.arc(cx,cy,r+6,0,7);ctx.fillStyle='#8a7a4c';ctx.fill();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fillStyle='#0b0f0e';ctx.fill();ctx.strokeStyle='#d8d2b8';
 for(let i=0;i<ticks*5;i++){const a=-Math.PI*1.25+i/(ticks*5)*Math.PI*1.5*1.0,major=i%5===0;if(i/(ticks*5)>1)break;const aa=-Math.PI*1.25+(i/(ticks*5))*Math.PI*1.5;ctx.lineWidth=major?3:1.2;ctx.beginPath();ctx.moveTo(cx+Math.cos(aa)*r*(major?.78:.86),cy+Math.sin(aa)*r*(major?.78:.86));ctx.lineTo(cx+Math.cos(aa)*r*.95,cy+Math.sin(aa)*r*.95);ctx.stroke();}
 const a=-Math.PI*1.25+Math.max(0,Math.min(1,value/max))*Math.PI*1.5;ctx.strokeStyle='#f0d67e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx-Math.cos(a)*r*.15,cy-Math.sin(a)*r*.15);ctx.lineTo(cx+Math.cos(a)*r*.82,cy+Math.sin(a)*r*.82);ctx.stroke();
 ctx.beginPath();ctx.arc(cx,cy,7,0,7);ctx.fillStyle='#8a7a4c';ctx.fill();ctx.fillStyle='#c9c3a6';ctx.font=`bold ${Math.round(r*.2)}px monospace`;ctx.textAlign='center';ctx.fillText(label,cx,cy+r*.45);if(text){ctx.fillStyle='#f0d67e';ctx.fillText(text,cx,cy+r*.72);}ctx.restore();}
function compass(ctx,cx,cy,r,heading){ctx.save();ctx.beginPath();ctx.arc(cx,cy,r+6,0,7);ctx.fillStyle='#8a7a4c';ctx.fill();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fillStyle='#0b0f0e';ctx.fill();ctx.translate(cx,cy);ctx.rotate(-heading*Math.PI/180);
 ctx.fillStyle='#d8d2b8';ctx.strokeStyle='#d8d2b8';ctx.textAlign='center';ctx.font=`bold ${Math.round(r*.22)}px monospace`;for(let d=0;d<360;d+=10){ctx.save();ctx.rotate(d*Math.PI/180);ctx.lineWidth=d%30?1.2:3;ctx.beginPath();ctx.moveTo(0,-r*.95);ctx.lineTo(0,-r*(d%30?.86:.8));ctx.stroke();if(d%30===0)ctx.fillText({0:'N',90:'E',180:'S',270:'W'}[d]??String(d/10),0,-r*.56);ctx.restore();}
 ctx.restore();ctx.strokeStyle='#f0a050';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy-r*.6);ctx.stroke();ctx.fillStyle='#f0d67e';ctx.font=`bold ${Math.round(r*.24)}px monospace`;ctx.textAlign='center';ctx.fillText(String(Math.round(heading)%360).padStart(3,'0')+'°',cx,cy+r*.15);}
// Sky dome: zenith blue fading to a hazy horizon that matches the fog. It rolls with the outside world.
const sky=new THREE.Mesh(new THREE.SphereGeometry(100000,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,map:tex(4,512,(ctx,w,h)=>{const gr=ctx.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#46677e');gr.addColorStop(.32,'#89a3ae');gr.addColorStop(.49,HORIZON);gr.addColorStop(.53,'#9da592');gr.addColorStop(1,'#6f7a68');ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);})}));roll.add(sky);
// B-17G Flying Fortress, roughly 1:1. Scene z runs nose (-11.3) to tail (+11.3); fuselage ~2.5 m across.
// Front to back: glazed nose (bombardier/navigator), raised flight deck, top turret (engineer), bomb bay + catwalk,
// radio room, ball turret, waist guns at staggered windows, tail wheel well, kneeling tail gunner.
const NOSE=-9.3,TAIL=11;
const profile=[[-9.3,.95,-.15,1.3],[-7.8,1.15,-.35,1.5],[-6.6,1.22,-.4,2.45],[-4.2,1.24,-.45,2.25],[-1,1.24,-.45,2.1],[3,1.2,-.4,2.05],[7.5,1,-.15,1.95],[10,.6,.35,1.6],[11,.47,.5,1.45]];
function hull(z){let i=0;while(i<profile.length-2&&z>profile[i+1][0])i++;const [z0,...a]=profile[i],[z1,...b]=profile[i+1];const t=Math.max(0,Math.min(1,(z-z0)/(z1-z0))),s=t*t*(3-2*t);const [rx,lo,hi]=a.map((v,k)=>v+(b[k]-v)*s);return {rx,lo,hi,cy:(lo+hi)/2,ry:(hi-lo)/2};}
const CRAWL=[-7.9,-5.6],inCrawl=z=>z>CRAWL[0]&&z<CRAWL[1];
const floorY=z=>z<-5.6?0:z<-4.2?.45:z<-1?0:z<7.5?.1:.1+(Math.min(z,10.5)-7.5)*.08;
const eyeY=z=>inCrawl(z)?.36:Math.min(floorY(z)+1.62,hull(z).hi-.22);
// Window cut-outs as [u-centre, half-width in u, z from, z to]; u=0 is the roof, .25 starboard, .75 port.
const COCKPIT=[-7.8,-5.5];
const windows=[[0,.13,-7.78,-6.5],[.19,.07,-7.4,-5.55],[.81,.07,-7.4,-5.55],[0,.08,-5.1,-4.3],[.27,.05,-9.1,-8.3],[.73,.05,-9.1,-8.3],[0,.05,-.4,.7],[.25,.04,.1,.9],[.77,.07,3.5,4.6],[.23,.07,4.7,5.8],[.25,.03,10.1,10.7],[.75,.03,10.1,10.7]];
const windowMask=tex(512,1024,(ctx,w,h)=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#000';const y=z=>(z-NOSE)/(TAIL-NOSE)*h;for(const [u,du,z0,z1] of windows)for(const o of [-1,0,1]){ctx.beginPath();ctx.roundRect((u+o-du)*w,y(z0),du*2*w,y(z1)-y(z0),5);ctx.fill();}},false);
// Interior: bronze green nose and flight deck, bare aluminium from the bomb bay aft. Exterior: olive drab over neutral grey.
function panels(base,line,front,belly){return tex(1024,2048,(ctx,w,h)=>{ctx.fillStyle=base;ctx.fillRect(0,0,w,h);if(front){ctx.fillStyle=front;ctx.fillRect(0,0,w,(-4.2-NOSE)/(TAIL-NOSE)*h);}if(belly){ctx.fillStyle=belly;ctx.fillRect(.36*w,0,.28*w,h);}
 for(let x=0;x<16;x++)for(let y=0;y<32;y++){ctx.fillStyle=`rgba(${rand()<.5?'0,0,0':'255,255,255'},${rand()*.07})`;ctx.fillRect(x*64,y*64,64,64);}
 ctx.strokeStyle=line;ctx.fillStyle=line;ctx.lineWidth=2;for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*64,0);ctx.lineTo(i*64,h);ctx.stroke();for(let j=0;j<128;j++)ctx.fillRect(i*64+3,j*16+5,2.5,2.5);}for(let i=0;i<=32;i++){ctx.beginPath();ctx.moveTo(0,i*64);ctx.lineTo(w,i*64);ctx.stroke();for(let j=0;j<64;j++)ctx.fillRect(j*16+5,i*64+3,2.5,2.5);}});}
function hullGeometry(grow){const geo=new THREE.CylinderGeometry(1,1,TAIL-NOSE,64,90,true);geo.rotateX(-Math.PI/2);geo.translate(0,0,(NOSE+TAIL)/2);const p=geo.attributes.position;
 for(let i=0;i<p.count;i++){const h=hull(p.getZ(i));p.setXY(i,p.getX(i)*h.rx*grow,h.cy+p.getY(i)*h.ry*grow);}geo.computeVertexNormals();return geo;}
function skin(grow,map,side){plane.add(new THREE.Mesh(hullGeometry(grow),new THREE.MeshStandardMaterial({map,side,alphaMap:windowMask,alphaTest:.5,roughness:side===THREE.BackSide?.55:.85,metalness:side===THREE.BackSide?.45:.15})));}
skin(1,panels('#a3a7a0','#5d625c','#4b5642'),THREE.BackSide);skin(1.025,tex(1024,2048,paintSkin),THREE.FrontSide);
const glass=new THREE.MeshStandardMaterial({color:'#b9d0d4',transparent:true,opacity:.16,roughness:.05,metalness:.1,depthWrite:false});
// Framed plexiglass caps: nose cone, tail gunner's window, top turret.
function dome(x,y,z,sx,sy,sz,rx,meridians=8,rings=[.55,1.05]){const g=new THREE.Group();g.position.set(x,y,z);g.scale.set(sx,sy,sz);g.rotation.x=rx;plane.add(g);
 g.add(new THREE.Mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),glass));const frame=pts=>g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.012,4),rim));const at=(th,ph)=>new THREE.Vector3(Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th));
 for(let i=0;i<meridians;i++)frame([...Array(13)].map((_,k)=>at(i*Math.PI*2/meridians,k/12*Math.PI/2)));for(const ph of rings)frame([...Array(33)].map((_,k)=>at(k/32*Math.PI*2,ph)));return g;}
// Ribs every 0.6 m, longitudinal stringers.
for(let z=NOSE+.4;z<TAIL-.2;z+=.6){if(z>COCKPIT[0]&&z<COCKPIT[1])continue;const h=hull(z);plane.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(new THREE.EllipseCurve(0,h.cy,h.rx-.03,h.ry-.03).getPoints(40).map(p=>new THREE.Vector3(p.x,p.y,z)),true),40,.022,4,true),rim));}
for(const a of [.5,1,1.45,1.95])for(const s of [-1,1])for(const [z0,z1] of [[NOSE+.2,COCKPIT[0]],[COCKPIT[1],TAIL-.1]]){const pts=[];for(let z=z0;z<=z1+.01;z+=Math.min(.5,(z1-z0)/2)){const h=hull(z);pts.push(new THREE.Vector3(s*(h.rx-.04)*Math.sin(a),h.cy+(h.ry-.04)*Math.cos(a),z));}plane.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.018,4),rim));}
// Cockpit window frames: thin mullions along the hull surface (angle from the roof, radians) and cross members.
{const at=(a,z)=>{const h=hull(z);return new THREE.Vector3((h.rx-.035)*Math.sin(a),h.cy+(h.ry-.035)*Math.cos(a),z);};const bar=pts=>plane.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.014,4),dark));const span=(a0,a1,z)=>bar([...Array(9)].map((_,k)=>at(a0+(a1-a0)*k/8,z)));const along=(a,z0,z1)=>bar([...Array(9)].map((_,k)=>at(a,z0+(z1-z0)*k/8)));
 for(const a of [-.82,-.4,0,.4,.82])along(a,-7.8,-6.5);span(-.82,.82,-7.78);span(-.82,.82,-6.5);span(-.82,.82,-7.15);
 for(const s of [-1,1]){for(const a of [.75,1.2,1.62])along(s*a,-7.42,-5.53);for(const z of [-7.42,-6.48,-5.53])span(s*.75,s*1.62,z);}}
// Bulkheads with doorways: [z, door half-width, door bottom, door top].
const alu=mat('#9a9e98',.5,.5),bronze=mat('#46503d',.2,.7),wood=mat('#6b5638',0,.9),olive=mat('#4b5136',.1,.8),armor=mat('#2c302c',.6,.5);
for(const [z,dw,d0,d1,m,top=9] of [[-7.8,.42,0,1.25,bronze,1.55],[-4.2,.32,.25,1.9,bronze],[-1,.3,.15,1.9,alu],[1.7,.38,.1,1.95,alu],[7.6,.3,.25,1.45,alu]]){const h=hull(z),s=new THREE.Shape(new THREE.EllipseCurve(0,h.cy,h.rx-.02,h.ry-.02).getPoints(48).map(q=>new THREE.Vector2(q.x,Math.min(q.y,top))));const door=new THREE.Path();door.moveTo(-dw,d0);door.lineTo(dw,d0);door.lineTo(dw,d1-dw*.6);door.quadraticCurveTo(dw,d1,0,d1);door.quadraticCurveTo(-dw,d1,-dw,d1-dw*.6);door.lineTo(-dw,d0);s.holes.push(door);
 const b=new THREE.Mesh(new THREE.ShapeGeometry(s,16),m.clone());b.material.side=THREE.DoubleSide;b.position.z=z;plane.add(b);}
// Floors: nose deck, raised flight deck, 20 cm bomb-bay catwalk, plywood radio/waist floor, rising tail floor.
box(1.3,.06,1.5,0,-.03,-8.55,wood);box(1.1,.06,1.4,0,-.03,-10.05,wood);box(1.8,.08,1.4,0,.41,-4.9,bronze);for(const s of [-1,1]){box(.62,.08,2.2,s*.57,.41,-6.7,bronze);box(.04,.12,2.2,s*.26,.39,-6.7,dark);}box(.56,.12,.04,0,.39,-5.6,dark);box(.2,.05,3.2,0,-.02,-2.6,alu);box(1.9,.06,8.6,0,.07,3.25,wood);
for(let z=7.6;z<10.6;z+=.5)box(.7,.05,.5,0,floorY(z+.25)-.02,z+.25,wood);
for(const s of [-1,1]){const d=box(.8,.03,3.2,s*.42,-.3,-2.6,alu);d.rotation.z=s*.35;}
// Nose: Norden bombsight, bombardier seat, navigator's table on the port side, cheek guns.
cyl(.07,.1,.55,0,.28,-10.55,dark);box(.22,.2,.32,0,.66,-10.55,dark);cyl(.06,.06,.18,0,.85,-10.6,brass);box(.4,.08,.4,0,.42,-9.9,armor);box(.4,.4,.06,0,.65,-9.7,armor);
box(.92,.05,.95,-.5,.75,-8.6,wood);box(.06,.75,.06,-.55,.37,-8.3,alu);box(.3,.35,.3,.55,.9,-8.8,dark);
for(const s of [-1,1]){const g=cyl(.04,.05,1.1,s*.75,1,-8.7,dark);g.rotation.set(Math.PI/2,0,-s*.5);}
// Flight deck: armoured seats, control columns, throttle pedestal, main panel with real gauge faces.
box(1.4,.72,.3,0,.96,-7.45,dark);box(1.5,.06,.32,0,1.34,-7.4,bronze);
for(const x of [-.45,.45]){box(.5,.12,.5,x,.75,-6.1,olive);box(.5,.7,.08,x,1.1,-5.85,armor);cyl(.04,.04,.4,x,.66,-6.75,dark);const yoke=new THREE.Mesh(new THREE.TorusGeometry(.17,.022,6,16,Math.PI*1.3),dark);yoke.position.set(x,.88,-6.75);yoke.rotation.z=-Math.PI*.15;plane.add(yoke);}
box(.22,.2,.5,0,.72,-6.95,dark);for(let i=0;i<4;i++)box(.025,.14,.025,-.06+i*.04,.88,-6.85,brass);
// Top turret ring and twin .50s above the engineer.
{const t=hull(-4.7);const ring=new THREE.Mesh(new THREE.TorusGeometry(.6,.04,6,24),dark);ring.rotation.x=Math.PI/2;ring.position.set(0,t.hi-.08,-4.7);plane.add(ring);box(.7,.06,.7,0,.68,-4.7,alu);}
// Bomb bay: V-frames and vertical racks holding twelve 500 lb bombs. They disappear once released.
const bombs=new THREE.Group();plane.add(bombs);const bombMat=mat('#4c5236',.2,.6),band=mat('#c9a43a',.2,.6);
for(const s of [-1,1]){for(const z of [-4,-3.2,-2.4,-1.6])box(.05,1.9,.06,s*.32,1,z,alu);for(const y of [.3,.85,1.4,1.9])box(.04,.04,2.5,s*.32,y,-2.8,alu);for(const z of [-3.6,-1.6])box(.05,1.8,.05,s*.62,.95,z,alu);
 for(let r=0;r<3;r++)for(const z of [-3.3,-1.9]){const y=.35+r*.55;const b=cyl(.18,.18,1.05,s*.62,y,z,bombMat,bombs);b.rotation.x=Math.PI/2;const nose=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),bombMat);nose.position.set(s*.62,y,z-.52);bombs.add(nose);const tail=cyl(.18,.06,.35,s*.62,y,z+.7,bombMat,bombs);tail.rotation.x=-Math.PI/2;const ring=cyl(.185,.185,.05,s*.62,y,z-.3,band,bombs);ring.rotation.x=Math.PI/2;}}
// Radio room: operator's desk and sets on the port side, ceiling hatch gun.
box(.55,.05,1,-.8,.82,.6,wood);box(.45,.45,.6,-.85,1.15,.45,mat('#2e3430',.4,.6));box(.4,.3,.5,-.88,1.55,.5,mat('#2e3430',.4,.6));box(.38,.4,.38,-.4,.35,.6,olive);
for(let i=0;i<5;i++)cyl(.025,.025,.02,-.6,1.2+(i%2)*.15,.25+i*.08,brass).rotation.z=Math.PI/2;
{const g=cyl(.035,.045,1.2,0,2.05,.6,dark);g.rotation.x=-1.1;}
// Ball turret: the top of the Sperry ball protrudes through the floor, hung from its yoke.
{const ball=new THREE.Mesh(new THREE.SphereGeometry(.62,20,14),mat('#3a3f37',.5,.45));ball.position.set(0,-.27,2.7);plane.add(ball);const yoke=new THREE.Mesh(new THREE.TorusGeometry(.72,.05,6,20,Math.PI),alu);yoke.position.set(0,.05,2.7);plane.add(yoke);for(const x of [-.72,.72])box(.08,1.95,.12,x,1,2.7,alu);}
// Waist: .50 cal guns on pintle mounts at the staggered windows, ammunition boxes, oxygen bottles.
const waistGuns={};for(const [s,z] of [[-1,4.05],[1,5.25]]){const h=hull(z);const x=s*(h.rx-.12);box(.08,.5,.08,x,1.3,z,dark);const g=cyl(.04,.055,1.6,x-s*.05,1.6,z,dark);waistGuns[s<0?'waistL':'waistR']=g;g.rotation.z=s*Math.PI/2;box(.2,.25,.35,x-s*.35,1.45,z,olive);box(.3,.35,.4,x-s*.15,.3,z-.6,olive);}
for(const z of [6.4,6.8])for(const s of [-1,1]){const h=hull(z);cyl(.11,.11,.55,s*(h.rx-.18),1,z,mat('#c6a83e',.3,.5));}
// Tail: wheel-well hump, kneeling pads, armour plate, twin guns out through the glazing.
box(.6,.3,1,0,.32,8.2,alu);box(.5,.12,.35,0,.5,10.35,olive);for(const x of [-.18,.18])box(.18,.08,.35,x,.38,9.95,olive);box(.7,.35,.05,0,.72,10.75,armor);
for(const x of [-.14,.14]){const g=cyl(.035,.045,1.2,x,1.05,11.3,dark);g.rotation.x=Math.PI/2;}
// ---------- Interior detail: the clutter that makes it a working aircraft ----------
{const tube=(pts,r,m)=>plane.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),Math.max(8,pts.length*6),r,6),m));
 const hose=mat('#2b2f2a',.1,.6),cable=mat('#1c1f1d',.1,.7),khaki=mat('#8a7d5a',0,.9),webbing=mat('#9a8a62',0,.95),red=mat('#8e2a1e',.3,.5),yellowGreen=mat('#8f9a3e',.2,.6),white=mat('#d8d4c4',0,.8),leather=mat('#4a3424',.1,.8),cushion=mat('#3b3328',0,.95);
 // Plywood floor planks with scuffs and grip strips, replacing the flat wood.
 const planks=tex(256,1024,(ctx,w,h)=>{for(let y=0;y<h;y+=64){ctx.fillStyle=`hsl(32,${28+rand()*10}%,${30+rand()*8}%)`;ctx.fillRect(0,y,w,64);ctx.fillStyle='#1d140c';ctx.fillRect(0,y,w,2);for(let k=0;k<30;k++){ctx.fillStyle=`rgba(0,0,0,${rand()*.12})`;ctx.fillRect(rand()*w,y+rand()*64,2+rand()*40,1+rand()*2);}}for(const x of [.2,.8]){ctx.fillStyle='rgba(30,30,28,.55)';ctx.fillRect(x*w-10,0,20,h);}});planks.wrapS=planks.wrapT=THREE.RepeatWrapping;planks.repeat.set(1,4);wood.map=planks;wood.color.set('#ffffff');wood.needsUpdate=true;
 // Wiring looms along the upper stringers, with clips at each rib.
 for(const s of [-1,1]){const pts=[];for(let z=-7.6;z<=9.5;z+=.6){const h=hull(z);pts.push([s*(h.rx-.12)*Math.sin(.75),h.cy+(h.ry-.12)*Math.cos(.75),z]);}tube(pts,.025,cable);tube(pts.map(([x,y,z])=>[x*.97,y-.05,z]),.015,cable);}
 // Oxygen lines run low along the starboard wall to a regulator at each crew position.
 {const pts=[];for(let z=-9;z<=10.2;z+=.6){const h=hull(z);pts.push([(h.rx-.1)*Math.sin(2.05),h.cy+(h.ry-.1)*Math.cos(2.05),z]);}tube(pts,.02,yellowGreen);
  for(const [x,y,z] of [[.55,.95,-9.4],[-.85,1.2,-8.2],[-.95,1.25,-6.1],[.95,1.25,-6.1],[.95,1.4,-4.9],[-1,1.3,.2],[-1.05,1.25,4.6],[1.05,1.25,5.8],[.45,.95,9.9]]){box(.06,.16,.12,x,y,z,yellowGreen);const sx=Math.sign(x)||1;tube([[x,y-.08,z],[x-sx*.08,y-.35,z+.05],[x-sx*.18,y-.5,z+.12]],.012,hose);}}
 // Ammunition: boxes on the floor with flexible feed chutes curving up to each waist gun and the tail guns.
 for(const [s,z] of [[-1,4.05],[1,5.25]]){const h=hull(z),gx=s*(h.rx-.12);box(.3,.38,.42,gx-s*.25,.29,z+.55,olive);tube([[gx-s*.25,.48,z+.5],[gx-s*.3,.85,z+.35],[gx-s*.22,1.25,z+.12],[gx-s*.1,1.5,z]],.045,cable);}
 for(const x of [-.32,.32]){box(.25,.3,.35,x,.55,9.3,olive);tube([[x,.7,9.35],[x*.8,.9,9.9],[x*.5,1,10.5],[x*.42,1.03,10.9]],.035,cable);}
 // Parachute chest packs and first-aid kits clipped to the walls; fire extinguishers at the nose, flight deck and waist.
 for(const [x,y,z] of [[-.95,1.1,-1.6],[.95,1.1,-1.6],[-1.05,1.6,2.2],[1.05,1.6,3],[-.95,1.5,7]]){const p=box(.12,.32,.42,x,y,z,khaki);box(.13,.05,.43,x,y+.08,z,webbing);box(.13,.05,.43,x,y-.08,z,webbing);}
 for(const [x,y,z] of [[.9,1.5,-2],[-1.05,1.75,5.2]]){box(.08,.22,.3,x,y,z,white);box(.09,.14,.04,x,y,z,red);box(.09,.04,.14,x,y,z,red);}
 for(const [x,y,z] of [[.6,.5,-8.9],[-.85,.85,-5],[1.02,.6,6.2]]){cyl(.07,.07,.42,x,y,z,red);cyl(.03,.03,.1,x,y+.26,z,rim);}
 // Flight deck: cushioned seats with lap belts and shoulder straps, rudder pedals, throttle levers with knobs, overhead switch panel.
 for(const x of [-.45,.45]){box(.46,.08,.44,x,.84,-6.1,cushion);box(.46,.5,.07,x,1.15,-5.82,cushion);for(const dx of [-.12,.12]){box(.04,.55,.02,x+dx,1.1,-5.86,webbing);}box(.44,.04,.03,x,.9,-6.3,webbing);
  for(const dx of [-.12,.12]){box(.1,.03,.2,x+dx,.55,-7.05,dark);box(.02,.15,.02,x+dx,.48,-7.1,rim);}}
 for(let i=0;i<4;i++){const l=box(.02,.16,.02,-.06+i*.04,.9,-6.9,rim);l.rotation.x=-.4;const k=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),red);k.position.set(-.06+i*.04,.97,-6.93);plane.add(k);}
 {const t=hull(-6.6);box(.6,.04,.35,0,t.hi-.12,-6.2,dark);for(let i=0;i<8;i++)box(.02,.02,.05,-.21+i*.06,t.hi-.15,-6.12,brass);}
 // Navigator: stool, a drift meter and astrocompass on the table, a pencil and dividers on the chart.
 cyl(.16,.18,.05,-.45,.48,-8.15,cushion);cyl(.03,.03,.46,-.45,.23,-8.15,rim);cyl(.06,.08,.12,-.85,.84,-8.95,dark);box(.18,.006,.006,-.35,.79,-8.45,mat('#c9a43a'));
 // Radio room: set faces with dials, a desk lamp, the operator's padded chair.
 const radioFace=tex(256,128,(ctx,w,h)=>{ctx.fillStyle='#2b302c';ctx.fillRect(0,0,w,h);for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(32+i*62,52,20,0,7);ctx.fillStyle='#0d0f0e';ctx.fill();ctx.strokeStyle='#bfb79a';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(32+i*62,52);ctx.lineTo(32+i*62+Math.cos(i)*16,52+Math.sin(i)*16);ctx.stroke();}ctx.fillStyle='#c9c3a6';ctx.font='bold 13px monospace';ctx.fillText('BC-348  RECEIVER',60,110);for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(24+i*42,92,5,0,7);ctx.fillStyle='#777';ctx.fill();}});
 for(const [y,z] of [[1.15,.45],[1.55,.5]]){const f=new THREE.Mesh(new THREE.PlaneGeometry(.55,.27),new THREE.MeshStandardMaterial({map:radioFace,roughness:.6}));f.position.set(-.6,y,z);f.rotation.y=Math.PI/2;plane.add(f);}
 cyl(.02,.02,.25,-.7,.97,.95,rim);const shade=new THREE.Mesh(new THREE.ConeGeometry(.07,.09,10,1,true),mat('#2f3a2c'));shade.position.set(-.66,1.1,.95);shade.rotation.z=.6;plane.add(shade);
 box(.38,.06,.36,-.4,.56,.6,cushion);box(.38,.4,.06,-.4,.78,.8,cushion);
 // Bomb bay: shackles on each bomb and the red arming-wire tags.
 for(const s of [-1,1])for(let r=0;r<3;r++)for(const z of [-3.3,-1.9]){box(.06,.08,.5,s*.5,.35+r*.55+.2,z,dark,bombs);box(.02,.06,.02,s*.62,.35+r*.55,z-.62,red,bombs);}
}
// Exterior: detailed B-17G airframe, turrets, markings and propellers (public/b17-exterior.js).
const exterior=buildExterior({hull,NOSE,TAIL});plane.add(exterior.group);const props=exterior.props;
const fireLight=new THREE.PointLight(0xff6325,0,8);fireLight.position.set(-.8,1.2,-3.2);plane.add(fireLight);
const cabinLights=[];for(const z of [-8.6,-6.2,-2.6,.6,4.2,6.6,9.4]){const h=hull(z);const l=new THREE.PointLight(0xffd59a,1.6,5,2);l.position.set(0,h.hi-.3,z);plane.add(l);cabinLights.push(l);cyl(.07,.09,.05,0,h.hi-.1,z,new THREE.MeshBasicMaterial({color:0xffdda2}));}
// ---------- Live instruments ----------
const cockpit=livePanel(1.32,.65,1024,0,.97,-7.29,(ctx,w,h,s)=>{ctx.fillStyle='#1b2421';ctx.fillRect(0,0,w,h);
 for(let i=0;i<40;i++){ctx.fillStyle='#55503a';ctx.beginPath();ctx.arc(14+i*25.5,12,3,0,7);ctx.arc(14+i*25.5,h-12,3,0,7);ctx.fill();}
 const r=78,y1=110;dial(ctx,95,y1,r,'AIRSPEED',s.airspeed*3600,1000,{text:Math.round(s.airspeed*3600)+' km/h'});
 dial(ctx,265,y1,r,'ALTITUDE',s.altitude%1000,1000,{text:Math.round(s.altitude)+' m'});compass(ctx,435,y1,r,s.heading);
 // Artificial horizon: the bar tilts against the bank.
 ctx.save();ctx.beginPath();ctx.arc(605,y1,r,0,7);ctx.clip();ctx.translate(605,y1);ctx.rotate(-s.bank*Math.PI/180);ctx.fillStyle='#5a7a92';ctx.fillRect(-r,-r,2*r,r+s.pitch*6);ctx.fillStyle='#5b4630';ctx.fillRect(-r,s.pitch*6,2*r,r);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r,s.pitch*6);ctx.lineTo(r,s.pitch*6);ctx.stroke();ctx.restore();
 ctx.strokeStyle='#f0d67e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(560,y1);ctx.lineTo(590,y1);ctx.moveTo(620,y1);ctx.lineTo(650,y1);ctx.stroke();ctx.fillStyle='#c9c3a6';ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillText('BANK '+Math.round(s.bank)+'°',605,y1+r+22);
 dial(ctx,775,y1,r,'FUEL',s.fuel,100,{text:Math.round(s.fuel)+'%'});dial(ctx,935,y1,r*.85,'CLIMB',s.pitch+5,10,{text:(s.pitch*20>0?'+':'')+Math.round(s.pitch*20)+' m/s'});
 for(let i=0;i<4;i++){const cx=130+i*170,cy=355;dial(ctx,cx,cy,58,'ENG '+(i+1),s.engines[i],100,{text:Math.round(s.engines[i]*s.throttle*27)+' rpm'});
  ctx.beginPath();ctx.arc(cx+62,cy-58,13,0,7);ctx.fillStyle=s.engineFire[i]>0?(performance.now()%600<300?'#ff3a1c':'#701810'):'#2a1210';ctx.fill();ctx.strokeStyle='#8a7a4c';ctx.lineWidth=3;ctx.stroke();}
 ctx.fillStyle='#c9c3a6';ctx.font='bold 16px monospace';ctx.textAlign='left';ctx.fillText('FIRE',778,300);ctx.fillText('GEAR',778,345);ctx.fillText('THROTTLE '+Math.round(s.throttle*100)+'%',778,400);
 ctx.beginPath();ctx.arc(870,340,13,0,7);ctx.fillStyle=s.gear?'#5cdc5c':'#1d2a1d';ctx.fill();ctx.beginPath();ctx.arc(870,295,13,0,7);ctx.fillStyle=s.engineFire.some(v=>v>0)||s.cabinFire>0?'#ff3a1c':'#2a1210';ctx.fill();});
const navRepeater=livePanel(.62,.3,512,-.5,1.02,-9.05,(ctx,w,h,s)=>{ctx.fillStyle='#1b2421';ctx.fillRect(0,0,w,h);compass(ctx,95,h/2,82,s.heading);
 ctx.fillStyle='#c9c3a6';ctx.font='bold 22px monospace';ctx.textAlign='left';const t=Math.floor(s.time);
 [['AIRSPEED',Math.round(s.airspeed*3600)+' km/h'],['ALTITUDE',Math.round(s.altitude)+' m'],['CLOCK','00:'+String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')]].forEach(([k,v],i)=>{ctx.fillStyle='#8f8a72';ctx.fillText(k,210,52+i*70);ctx.fillStyle='#f0d67e';ctx.fillText(v,210,80+i*70);});});
// The navigator's chart: drawn once, pencil marks overlaid when the crew changes them.
const chartBase=document.createElement('canvas');chartBase.width=chartBase.height=2048;drawChart(chartBase.getContext('2d'),2048,2048);
const chartTex=tex(2048,2048,ctx=>ctx.drawImage(chartBase,0,0));
const chart=new THREE.Mesh(new THREE.PlaneGeometry(.86,.86),new THREE.MeshStandardMaterial({map:chartTex,roughness:.9,emissiveMap:chartTex,emissive:'#ffffff',emissiveIntensity:.25}));chart.rotation.x=-Math.PI/2;chart.position.set(-.5,.785,-8.6);plane.add(chart);
let marksDrawn='';
function drawMarks(){const key=JSON.stringify(g?.marks||[]);if(key===marksDrawn)return;marksDrawn=key;const ctx=chartTex.image.getContext('2d');ctx.drawImage(chartBase,0,0);const P=([u,v])=>[u*2048,v*2048];
 ctx.strokeStyle='#2b2b30';ctx.fillStyle='#2b2b30';ctx.lineWidth=3;ctx.font='italic 26px Georgia,serif';const ms=g?.marks||[];
 ms.forEach((m,i)=>{const [x,y]=P(kmToChart(m.x,m.y));if(i){const [px,py]=P(kmToChart(ms[i-1].x,ms[i-1].y));ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);}
  ctx.beginPath();ctx.moveTo(x-12,y-12);ctx.lineTo(x+12,y+12);ctx.moveTo(x+12,y-12);ctx.lineTo(x-12,y+12);ctx.stroke();ctx.beginPath();ctx.arc(x,y,18,0,7);ctx.stroke();ctx.fillText(`${String(Math.floor(m.t/60)).padStart(2,'0')}:${String(m.t%60).padStart(2,'0')}`,x+22,y-14);});
 chartTex.needsUpdate=true;}
// ---------- Repair points: glow when they need hands ----------
const hotspotMeshes={};{const red=mat('#8e2a1e',.3,.5),grey=mat('#59605a',.5,.5);
 const ef=new THREE.Group();ef.position.set(.98,1.3,-5.2);plane.add(ef);box(.05,.4,.55,0,0,0,red,ef);for(let i=0;i<4;i++){box(.08,.04,.04,-.06,.08,-.18+i*.12,brass,ef);box(.04,.1,.04,-.1,.08,-.18+i*.12,brass,ef);}hotspotMeshes.enginefire=ef;
 const lk=new THREE.Group();lk.position.set(-.25,1,-1.05);plane.add(lk);const wheel=new THREE.Mesh(new THREE.TorusGeometry(.12,.02,6,16),red);lk.add(wheel);box(.3,.3,.06,0,-.25,0,grey,lk);hotspotMeshes.leak=lk;
 const el=new THREE.Group();el.position.set(-1.05,1.5,1.2);plane.add(el);box(.08,.4,.32,0,0,0,grey,el);box(.09,.05,.32,0,.1,0,mat('#c9a43a'),el);hotspotMeshes.electric=el;
 const ox=new THREE.Group();ox.position.set(1.02,1.25,6.6);plane.add(ox);box(.07,.3,.25,0,0,0,mat('#6a7a50'),ox);cyl(.06,.06,.03,-.05,.05,0,mat('#c6a83e'),ox).rotation.z=Math.PI/2;hotspotMeshes.oxygen=ox;}
const glow=new THREE.PointLight(0xffa040,0,2.2);plane.add(glow);
// ---------- Fire and smoke ----------
const smokeTex=tex(64,64,(ctx,w)=>{const gr=ctx.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,w,w);});
const flameMat=new THREE.MeshBasicMaterial({color:0xff7a2a,transparent:true,opacity:.85,fog:false});
const ENGINE_X=[-7.4,-3.6,3.6,7.4];const flames=ENGINE_X.map(x=>{const f=new THREE.Mesh(new THREE.ConeGeometry(.45,2.6,8,1,true),flameMat);f.rotation.x=Math.PI/2;f.position.set(x,.1,-1.2);f.visible=false;plane.add(f);return f;});
const cabinFlame=new THREE.Mesh(new THREE.ConeGeometry(.35,.9,8,1,true),flameMat);cabinFlame.visible=false;plane.add(cabinFlame);
const puffs=[...Array(90)].map(()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,color:'#3a3a38',transparent:true,depthWrite:false}));s.visible=false;s.userData={age:9,life:2,vz:0,grow:1};scene.add(s);return s;});
let puffI=0;function puff(pos,{color='#3a3a38',life=2,vz=80,size=2,grow=4}={}){const s=puffs[puffI++%puffs.length];s.position.copy(pos);s.material.color.set(color);Object.assign(s.userData,{age:0,life,vz,size,grow});s.visible=true;}
// ---------- World: terrain, towns, forests, clouds ----------
const B=MAP.bounds;
{const ground=new THREE.Mesh(new THREE.PlaneGeometry((B.x1-B.x0)*KM,(B.y1-B.y0)*KM),new THREE.MeshStandardMaterial({map:tex(4096,4096,(ctx,w,h)=>drawTerrain(ctx,w,h)),roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.copy(toWorld((B.x0+B.x1)/2,(B.y0+B.y1)/2));world.add(ground);
 const outer=new THREE.Mesh(new THREE.PlaneGeometry(500*KM,500*KM),mat('#5f6d55',0,1));outer.rotation.x=-Math.PI/2;outer.position.copy(toWorld((B.x0+B.x1)/2,(B.y0+B.y1)/2,-8));world.add(outer);
 const inst=(geo,material,pts,place)=>{const m=new THREE.InstancedMesh(geo,material,pts.length),o=new THREE.Object3D(),c=new THREE.Color();pts.forEach((p,i)=>{place(o,p,c);o.updateMatrix();m.setMatrixAt(i,o.matrix);m.setColorAt(i,c);});world.add(m);return m;};
 inst(new THREE.BoxGeometry(1,1,1),mat('#ffffff',0,.9),scatter('house',2600,11),(o,[x,y],c)=>{const w=8+rand()*10;o.position.copy(toWorld(x,y,3));o.scale.set(w,5+rand()*5,w*(1+rand()));o.rotation.y=rand()*3;c.set(rand()<.6?'#8c4a3a':'#9a9488');});
 inst(new THREE.ConeGeometry(1,1,6),mat('#ffffff',0,1),scatter('tree',6000,12),(o,[x,y],c)=>{const s=7+rand()*7;o.position.copy(toWorld(x,y,s*1.1));o.scale.set(s,s*2.4,s);o.rotation.set(0,0,0);c.set(rand()<.5?'#2f4a2c':'#3a5531');});
 // Marshalling yards: rows of wagons along the sidings.
 for(const Y of MAP.yards){const T=Y;inst(new THREE.BoxGeometry(1,1,1),mat('#ffffff',.2,.8),[...Array(360)].map((_,i)=>[i%12,Math.floor(i/12)]),(o,[k,row],c)=>{const a=-Y.ang,along=(row-15)*.028*Y.len/3,across=(k-6)*.012*Y.n/14;o.position.copy(toWorld(T.x+Math.cos(a)*along-Math.sin(a)*across,T.y+Math.sin(a)*along+Math.cos(a)*across,2));o.rotation.y=-a;o.scale.set(12,3.6,3.2);c.set(['#4a3a30','#5a4a3a','#3d3a36'][row%3]);});}
 const cloudMat=new THREE.MeshStandardMaterial({color:'#f4f3ee',roughness:1,flatShading:true,emissive:'#646c70',emissiveIntensity:.55});const cloudPts=[];
 for(let i=0;i<170;i++){const cx=B.x0+rand()*(B.x1-B.x0),cy=B.y0+rand()*(B.y1-B.y0),alt=rand()<.8?1500+rand()*800:3900+rand()*700,n=4+Math.floor(rand()*6),size=.6+rand()*1.2;for(let j=0;j<n;j++)cloudPts.push([cx+(j-n/2)*.16*size,cy+(rand()-.5)*.2*size,alt+rand()*70,(110+rand()*130)*size]);}
 inst(new THREE.IcosahedronGeometry(1,1),cloudMat,cloudPts,(o,[x,y,alt,r],c)=>{o.position.copy(toWorld(x,y,alt));o.scale.set(r,r*.55,r);c.set('#ffffff');});}
// Flak and bomb bursts live in world space so they stay where they burst.
const flak=[...Array(18)].map(()=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:'#2a2826',transparent:true,flatShading:true,roughness:1,emissive:'#ff8a30',emissiveIntensity:0}));m.userData.age=9;world.add(m);return m;});
let flakI=0;function burst(pos,scale=1){const f=flak[flakI++%flak.length];f.position.copy(pos);flakSound(pos);f.userData={age:0,scale};}
const blasts=[...Array(30)].map(()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshStandardMaterial({color:'#3b3631',transparent:true,roughness:1,emissive:'#ff9a40',emissiveIntensity:2}));m.visible=false;m.userData.age=99;world.add(m);return m;});
// Bomb run: a stick of twelve falls in world space, then per bomb a flash, fireball, shock ring and a lingering smoke column.
const fallBombs=[...Array(12)].map(()=>{const m=new THREE.Group();cyl(.25,.25,1.5,0,0,0,bombMat,m);const nose=new THREE.Mesh(new THREE.ConeGeometry(.25,.5,8),bombMat);nose.position.y=-1;nose.rotation.x=Math.PI;m.add(nose);m.scale.setScalar(2);m.visible=false;world.add(m);return m;});
const addMat=color=>new THREE.SpriteMaterial({map:smokeTex,color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
const pool=(n,make)=>{const a=[...Array(n)].map(()=>{const o=make();o.visible=false;world.add(o);return o;});a.i=0;return a;};
const flashes=pool(12,()=>new THREE.Sprite(addMat('#ffdca0'))),rings=pool(12,()=>{const r=new THREE.Mesh(new THREE.RingGeometry(.85,1,40),new THREE.MeshBasicMaterial({color:'#f2e6cc',transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false}));r.rotation.x=-Math.PI/2;return r;});
const smokes=pool(72,()=>new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,color:'#2b2724',transparent:true,depthWrite:false})));
blasts.i=0;const gfx=[];// live ground effects
function spawn(arr,life,step){const o=arr[arr.i++%arr.length],k=gfx.findIndex(e=>e.o===o);if(k>=0)gfx.splice(k,1);o.visible=true;gfx.push({o,age:0,life,step});return o;}
function explode(p){
 spawn(flashes,.6,(o,k)=>{o.scale.setScalar(320*(.6+k));o.material.opacity=1-k;}).position.copy(p).setY(40);
 spawn(blasts,2.4,(o,k)=>{o.scale.set(35+k*80,25+k*110,35+k*80);o.material.emissiveIntensity=4*(1-k)**2;o.material.opacity=1-k;}).position.copy(p).setY(12);
 spawn(rings,1.6,(o,k)=>{o.scale.setScalar(20+k*420);o.material.opacity=.75*(1-k);}).position.copy(p).setY(5);
 for(let i=0;i<5;i++){const vy=10+Math.random()*12,size=45+Math.random()*45,drift=(Math.random()-.5)*6;
  const s=spawn(smokes,40+Math.random()*25,(o,k,dt)=>{o.position.y+=vy*dt*(1-k);o.position.x+=drift*dt;o.scale.setScalar(size*(1+k*5));o.material.opacity=Math.min(1,k*30)*.85*(1-k);});
  s.position.copy(p).add(new THREE.Vector3((Math.random()-.5)*70,15+i*12,(Math.random()-.5)*70));s.material.color.set(i<3?'#2b2724':'#6a6258');s.scale.setScalar(.01);}
 // The boom arrives at the speed of sound; close ones shake the airframe.
 const dist=world.localToWorld(p.clone()).length();setTimeout(()=>{shake=Math.max(shake,THREE.MathUtils.clamp(1800/dist,.15,1));if(sfx.on){sfx.ground.pa.position.copy(p);thump(sfx.ground.bus,{freq:70,q:.5,gain:9,decay:2.2,type:'lowpass'});thump(sfx.ground.bus,{freq:400,q:.6,gain:3,decay:.6});}},dist/343*1000);}
let bombRun=null;
function releaseFx(){shake=Math.max(shake,.7);jolt+=.03;toast('Bombs away!');if(!sfx.on)return;sfx.cabin.pa.position.set(0,.8,-2.6);
 for(let i=0;i<12;i++)setTimeout(()=>thump(sfx.cabin.bus,{freq:170,q:1.2,gain:2.4,decay:.2,type:'lowpass'}),i*100);thump(sfx.cabin.bus,{freq:500,q:.4,gain:1.6,decay:3});}
function updateBombRun(now){const r=bombRun;if(!r)return;const t0=(now-r.t0)/1000;
 fallBombs.forEach((m,i)=>{const t=t0-i*.1,k=t/r.ft;if(r.done[i]||t<0){m.visible=false;return;}
  const sx=r.x+r.v.x*i*.1,sy=r.y+r.v.y*i*.1,lx=r.ix+r.v.x*i*.1+r.jit[i][0],ly=r.iy+r.v.y*i*.1+r.jit[i][1];
  if(k>=1){r.done[i]=true;m.visible=false;explode(toWorld(lx,ly,0));return;}
  m.visible=true;m.position.copy(toWorld(sx+(lx-sx)*k,sy+(ly-sy)*k,r.alt*(1-k*k)-3));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),new THREE.Vector3(r.v.x*KM,-9.81*t,-r.v.y*KM).normalize());});}
// ---------- Fighters ----------
function makeFighter(){const fighter=new THREE.Group(),model=new THREE.Group();model.rotation.y=Math.PI;model.scale.setScalar(1.4);fighter.add(model);const fGrey=new THREE.MeshStandardMaterial({color:'#5b6260',roughness:.6,metalness:.3,flatShading:true});
 const body=cyl(.45,.22,4.2,0,0,0,fGrey,model);body.rotation.x=Math.PI/2;const nose=new THREE.Mesh(new THREE.ConeGeometry(.45,.6,12),mat('#c9a43a'));nose.rotation.x=-Math.PI/2;nose.position.z=-2.4;model.add(nose);
 box(7,.12,1.1,0,-.15,-.5,fGrey,model);box(2.4,.08,.6,0,.1,1.8,fGrey,model);box(.08,.8,.7,0,.45,1.9,fGrey,model);
 const canopy=new THREE.Mesh(new THREE.SphereGeometry(.3,10,6,0,Math.PI*2,0,Math.PI/2),glass);canopy.scale.z=2;canopy.position.set(0,.3,-.4);model.add(canopy);
 for(const x of [-2.2,2.2]){box(.6,.02,.6,x,-.08,-.5,mat('#e9e6dc'),model);box(.4,.03,.12,x,-.07,-.5,dark,model);box(.12,.03,.4,x,-.07,-.5,dark,model);}
 const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,color:'#ffd27a',transparent:true,fog:false}));flash.scale.setScalar(2.5);flash.position.z=-3.2;model.add(flash);fighter.userData.flash=flash;scene.add(fighter);return fighter;}
const fighters=new Map();
const dirOf=(az,el)=>{const a=az*Math.PI/180,e=el*Math.PI/180;return new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e));};
// ---------- Guns: view model, tracers, field-of-fire clamps ----------
const GUN_CAM={chin:[0,-.36,-11.4],top:[0,2.6,-4.7],ball:[0,-.72,2.7],waistL:[-1.08,1.55,4.05],waistR:[1.08,1.55,5.25],tail:[0,1.02,11.15]};
const gunModel=new THREE.Group();camera.add(gunModel);gunModel.visible=false;const barrels=[-.09,.09].map(x=>{const b=cyl(.022,.03,1.3,x,-.2,-.85,dark,gunModel);b.rotation.x=Math.PI/2;return b;});
const ringSight=new THREE.Mesh(new THREE.TorusGeometry(.05,.003,6,24),mat('#222')),bead=new THREE.Mesh(new THREE.SphereGeometry(.006,6,4),mat('#222'));ringSight.position.set(0,0,-.45);bead.position.set(0,0,-.9);gunModel.add(ringSight,bead);
const tracers=[...Array(40)].map(()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,7),new THREE.MeshBasicMaterial({color:0xffc35a,fog:false}));m.visible=false;m.userData={age:9,v:new THREE.Vector3()};scene.add(m);return m;});
let tracerI=0;function tracer(from,dir,speed=850){const t=tracers[tracerI++%tracers.length];t.position.copy(from);t.lookAt(from.clone().add(dir));t.userData={age:0,v:dir.clone().multiplyScalar(speed)};t.visible=true;}
const wrapPi=a=>Math.atan2(Math.sin(a),Math.cos(a));
function clampAim(s){const gun=stations[s]?.gun;if(!gun)return;pitch=THREE.MathUtils.clamp(pitch,gun.el[0]*Math.PI/180,gun.el[1]*Math.PI/180);
 if(gun.az){const c=-(gun.az[0]+gun.az[1])/2*Math.PI/180,half=(gun.az[1]-gun.az[0])/2*Math.PI/180;yaw=c+THREE.MathUtils.clamp(wrapPi(yaw-c),-half,half);}}
const aimAz=()=>((-yaw*180/Math.PI)%360+360)%360,aimEl=()=>pitch*180/Math.PI;
// ---------- 3D sound: every source is an HRTF emitter placed in the scene, so it is heard from where it is ----------
// All sounds are synthesised; nothing is downloaded. Emitters are buses (GainNodes) that one-shots plug into.
const sfx={on:false};
function startAudio(){if(sfx.ctx){sfx.ctx.resume();return;}
 const listener=new THREE.AudioListener();camera.add(listener);const ctx=listener.context;Object.assign(sfx,{listener,ctx});
 const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;sfx.noise=buf;
 sfx.emitter=(parent,pos,ref=4,gainValue=1)=>{const bus=ctx.createGain();bus.gain.value=gainValue;const pa=new THREE.PositionalAudio(listener);pa.setRefDistance(ref);pa.setRolloffFactor(1);pa.setDistanceModel('inverse');pa.setNodeSource(bus);if(pos)pa.position.copy(pos);parent.add(pa);return {pa,bus};};
 const loopNoise=(dest,type,freq,q,gain)=>{const n=ctx.createBufferSource();n.buffer=buf;n.loop=true;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const gn=ctx.createGain();gn.gain.value=gain;n.connect(f).connect(gn).connect(dest);n.start(0,Math.random()*2);return {f,gn};};
 // Four radial engines, each from its own nacelle: two detuned oscillators and exhaust noise, low-passed by the fuselage.
 sfx.engines=ENGINE_X.map((x,i)=>{const e=sfx.emitter(plane,new THREE.Vector3(x,0,-3),5);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=520;lp.connect(e.bus);
  const oscs=[['sawtooth',1],['square',.5]].map(([type,m])=>{const o=ctx.createOscillator();o.type=type;const gn=ctx.createGain();gn.gain.value=type==='square'?.08:.14;o.connect(gn).connect(lp);o.start();return {o,m};});
  const rumble=loopNoise(lp,'bandpass',140,.7,.5);return {e,oscs,rumble,detune:1+(i-1.5)*.012};});
 sfx.wind=loopNoise(listener.getInput(),'bandpass',650,.5,.05);
 sfx.guns=Object.fromEntries(Object.entries(GUN_CAM).map(([k,p])=>[k,sfx.emitter(plane,new THREE.Vector3(...p),3)]));
 sfx.flak=[...Array(4)].map(()=>sfx.emitter(world,null,120));sfx.flakI=0;sfx.ground=sfx.emitter(world,null,400);
 sfx.cabin=sfx.emitter(plane,new THREE.Vector3(0,1,0),2);sfx.fire=sfx.emitter(plane,new THREE.Vector3(0,.6,0),2);sfx.fireNoise=loopNoise(sfx.fire.bus,'highpass',900,.5,0);
}
// A filtered noise hit with an exponential tail, sent to an emitter bus.
function thump(dest,{freq=900,q=1,gain=1,decay=.12,type='bandpass',pitch=0}={}){if(!sfx.on||!dest)return;const ctx=sfx.ctx,t=ctx.currentTime,n=ctx.createBufferSource();n.buffer=sfx.noise;n.playbackRate.value=1+pitch;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const gn=ctx.createGain();gn.gain.setValueAtTime(gain,t);gn.gain.exponentialRampToValueAtTime(.001,t+decay);n.connect(f).connect(gn).connect(dest);n.start(t,Math.random()*1.5,decay+.05);}
function flakSound(pos){if(!sfx.on)return;const e=sfx.flak[sfx.flakI++%sfx.flak.length];e.pa.position.copy(pos);setTimeout(()=>{thump(e.bus,{freq:120,q:.6,gain:3,decay:1.1,type:'lowpass'});thump(e.bus,{freq:2500,q:.5,gain:.6,decay:.25});},30);}
// Fighters carry their own engine whine; pitch rises as they close (a cheap Doppler).
function fighterVoice(m){if(!sfx.on||m.userData.voice)return;const e=sfx.emitter(m,null,60);const o=sfx.ctx.createOscillator();o.type='sawtooth';o.frequency.value=110;const f=sfx.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;const gn=sfx.ctx.createGain();gn.gain.value=.5;o.connect(f).connect(gn).connect(e.bus);o.start();m.userData.voice={e,o,last:m.position.length()};}
function updateAudio(dt){if(!sfx.on||!g?.engines)return;const t=sfx.ctx.currentTime;
 sfx.engines.forEach((en,i)=>{const alive=g.engines[i]>0,base=(24+g.throttle*26)*(.75+.25*g.engines[i]/100)*en.detune;en.oscs.forEach(({o,m})=>o.frequency.setTargetAtTime(base*m,t,.3));const rough=alive&&g.engines[i]<50;en.e.bus.gain.setTargetAtTime(alive?(.55+g.throttle*.45)*(rough&&Math.random()<.25?.25:1):0,t,rough?.05:.4);});
 sfx.wind.gn.gain.setTargetAtTime(.03+g.airspeed*.2+Math.min(.12,(g.hits?.length||0)*.0015),t,.5);
 const fire=g.cabinFire>0;sfx.fire.pa.position.set(0,.6,g.cabinFireZ||0);sfx.fireNoise.gn.gain.setTargetAtTime(fire?.25+Math.random()*.25:0,t,.05);
 for(const m of fighters.values()){fighterVoice(m);const v=m.userData.voice;if(!v)continue;const r=m.position.length(),closing=(v.last-r)/Math.max(dt,.001);v.last=r;v.o.frequency.setTargetAtTime(110*(1+THREE.MathUtils.clamp(closing,-200,200)/900),t,.1);}}
function stopAudio(){if(sfx.ctx)sfx.ctx.suspend();}
// ---------- Combat feel: .50 cal recoil, flash and brass; damage you can see ----------
const glowMat=color=>new THREE.SpriteMaterial({map:smokeTex,color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
const muzzles=barrels.map(b=>{const s=new THREE.Sprite(glowMat('#ffcf8a'));s.position.set(b.position.x,-.2,-1.55);s.visible=false;gunModel.add(s);return s;});
const gunLight=new THREE.PointLight(0xffb060,0,7);gunModel.add(gunLight);gunLight.position.set(0,-.1,-1.3);
let recoil=0,flashUntil=0;
// Sparks: short-lived glowing points with velocity and gravity.
const sparks=[...Array(220)].map(()=>{const s=new THREE.Sprite(glowMat('#ffcf70'));s.visible=false;s.userData={age:9,life:.4,v:new THREE.Vector3()};scene.add(s);return s;});
let sparkI=0;function sparkBurst(pos,n,speed,{color='#ffcf70',size=.05,life=.35,dir=null}={}){for(let i=0;i<n;i++){const s=sparks[sparkI++%sparks.length];s.position.copy(pos);s.material.color.set(color);s.scale.setScalar(size*(.6+Math.random()*.8));
 const v=new THREE.Vector3(Math.random()-.5,Math.random()-.3,Math.random()-.5).normalize();if(dir)v.addScaledVector(dir,1.5).normalize();s.userData={age:0,life:life*(.5+Math.random()),v:v.multiplyScalar(speed*(.3+Math.random()))};s.visible=true;}}
// Spent brass tumbling out of the gun.
const brassGeo=new THREE.CylinderGeometry(.007,.007,.06,6),brassMat=mat('#c9a43a',.85,.3);
const casings=[...Array(60)].map(()=>{const m=new THREE.Mesh(brassGeo,brassMat);m.visible=false;m.userData={age:9,v:new THREE.Vector3(),w:new THREE.Vector3()};scene.add(m);return m;});
let caseI=0;function eject(from,side){const c=casings[caseI++%casings.length];c.position.copy(from);c.userData={age:0,v:side.clone().multiplyScalar(1.5+Math.random()).add(new THREE.Vector3(0,.8+Math.random(),(Math.random()-.5))),w:new THREE.Vector3(Math.random()*25,Math.random()*25,Math.random()*25)};c.visible=true;}
// One round: a deep thump, the supersonic crack and the bolt clatter, plus the flash, brass and kick.
function heavyShot(bus){thump(bus,{freq:95,q:.7,gain:3.2,decay:.22,type:'lowpass'});thump(bus,{freq:2600,q:.7,gain:1.3,decay:.05});thump(bus,{freq:750,q:4,gain:.7,decay:.035});}
function fireRound(s,withTracer){const d=new THREE.Vector3();camera.getWorldDirection(d);const right=new THREE.Vector3().crossVectors(d,camera.up).normalize();
 heavyShot(sfx.guns?.[s]?.bus);recoil=1;flashUntil=performance.now()+45;shake=Math.max(shake,.28);
 pitch+=.0018+Math.random()*.0012;yaw+=(Math.random()-.5)*.0018;clampAim(s);
 barrels.forEach((b,i)=>{if(!b.visible)return;b.getWorldPosition(tmp);const tip=tmp.clone().addScaledVector(d,.75);if(withTracer)tracer(tip,d);
  eject(tmp.clone().addScaledVector(d,-.3),right.clone().multiplyScalar(i?1:-1));if(Math.random()<.5)puff(tip,{color:'#bdb8ad',life:.9,vz:30,size:.15,grow:1.2});});}
// Bullet and flak holes: daylight through the skin inside, torn dark metal outside. Shared by the server so everyone sees the same ones.
const holeIn=new THREE.MeshBasicMaterial({color:'#f4f1e4',fog:false,side:THREE.DoubleSide}),holeOut=new THREE.MeshStandardMaterial({color:'#15130f',roughness:1,side:THREE.DoubleSide});
const holeGeo={bullet:new THREE.CircleGeometry(.045,7),flak:new THREE.CircleGeometry(.2,11)},rimGeo={bullet:new THREE.RingGeometry(.04,.075,9),flak:new THREE.RingGeometry(.17,.28,13)},rimMat=new THREE.MeshStandardMaterial({color:'#c9ccc6',metalness:.8,roughness:.35,side:THREE.DoubleSide}),leakMat=glowMat('#fff6dc');leakMat.opacity=.35;
for(const geo of [holeGeo.flak,rimGeo.flak,rimGeo.bullet]){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const k=.65+Math.random()*.6;p.setXY(i,p.getX(i)*k,p.getY(i)*k);}}
const holeMeshes=new Map();
function hullPoint(z,a,k){const h=hull(z);return new THREE.Vector3(Math.sin(a)*h.rx*k,h.cy+Math.cos(a)*h.ry*k,z);}
function showHole(hit,fresh){const n=new THREE.Vector3(Math.sin(hit.a)/hull(hit.z).rx,Math.cos(hit.a)/hull(hit.z).ry,0).normalize();
 const inside=new THREE.Mesh(holeGeo[hit.kind],holeIn),outside=new THREE.Mesh(holeGeo[hit.kind],holeOut);
 inside.position.copy(hullPoint(hit.z,hit.a,.985));inside.lookAt(inside.position.clone().sub(n));outside.position.copy(hullPoint(hit.z,hit.a,1.03));outside.lookAt(outside.position.clone().add(n));outside.scale.setScalar(1.5);
 const rim=new THREE.Mesh(rimGeo[hit.kind],rimMat);rim.position.copy(inside.position).addScaledVector(n,-.002);rim.quaternion.copy(inside.quaternion);
 const leak=new THREE.Sprite(leakMat);leak.position.copy(inside.position).addScaledVector(n,-.06);leak.scale.setScalar(hit.kind==='flak'?.9:.28);
 plane.add(inside,outside,rim,leak);holeMeshes.set(hit.id,[inside,outside,rim,leak]);
 if(fresh){const into=n.clone().negate();sparkBurst(inside.position,hit.kind==='flak'?26:8,hit.kind==='flak'?5:3.5,{dir:into});sparkBurst(inside.position,hit.kind==='flak'?10:3,1.5,{color:'#3a3632',size:.03,life:.9,dir:into});
  puff(inside.position,{color:'#8d877c',life:1.2,vz:6,size:.15,grow:hit.kind==='flak'?1.5:.6});
  if(sfx.on){sfx.cabin.pa.position.copy(inside.position);thump(sfx.cabin.bus,{freq:hit.kind==='flak'?260:1900,q:hit.kind==='flak'?1.5:3,gain:hit.kind==='flak'?3:1.6,decay:hit.kind==='flak'?.45:.08});}
  const me_=me();if(me_&&Math.hypot(me_.x-inside.position.x,me_.z-inside.position.z)<3)shake=Math.max(shake,hit.kind==='flak'?1:.45);}}
function syncHoles(){const live=new Set((g.hits||[]).map(h=>h.id));for(const [k,ms] of holeMeshes)if(!live.has(k)){plane.remove(...ms);holeMeshes.delete(k);}
 for(const h of g.hits||[])if(!holeMeshes.has(h.id))showHole(h,g.time-h.t<1.5);}
function updateCombatFx(dt,now){recoil*=Math.exp(-dt*22);gunModel.position.z=recoil*.06;gunModel.rotation.x=recoil*.025;
 const flash=now<flashUntil;muzzles.forEach((m,i)=>{m.visible=flash&&barrels[i].visible;m.scale.setScalar(.35+Math.random()*.35);m.material.rotation=Math.random()*6;});gunLight.intensity=flash?9:0;
 for(const s of sparks)if(s.visible){const u=s.userData;u.age+=dt;u.v.y-=9.81*dt;s.position.addScaledVector(u.v,dt);s.material.opacity=Math.max(0,1-u.age/u.life);s.visible=u.age<u.life;}
 for(const c of casings)if(c.visible){const u=c.userData;u.age+=dt;u.v.y-=9.81*dt;c.position.addScaledVector(u.v,dt);c.rotation.x+=u.w.x*dt;c.rotation.y+=u.w.y*dt;c.visible=u.age<.9;}}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);
// ---------- Network and room lifecycle ----------
$('#room').value=new URLSearchParams(location.search).get('room')||'';
function joinLabel(){$('#joinButton').textContent=$('#room').value.trim()?'Join crew':'Create crew';}$('#room').oninput=joinLabel;joinLabel();
let srvAt=0;const view={x:2,y:-1,alt:3000,heading:80,bank:0};
$('#joinForm').onsubmit=e=>{e.preventDefault();setSound(true);$('#joinButton').disabled=true;$('#lobbyError').textContent='Connecting to aircraft…';
 ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
 ws.onopen=()=>send({type:'join',room:$('#room').value,name:$('#name').value});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='welcome'){id=m.id;room=m.room;stations=m.stations;hotspots=m.hotspots;$('#lobby').hidden=true;$('#game').hidden=false;$('#roomCode').textContent=room;history.replaceState(null,'','?room='+room);yaw=0;pitch=0;}
  if(m.type==='state'){const first=!g?.pos;g=m.game;srvAt=performance.now();if(first&&g.pos)Object.assign(view,{x:g.pos.x,y:g.pos.y,alt:g.altitude,heading:g.heading});renderUI();}
  if(m.type==='notice')toast(m.message);if(m.type==='error'){$('#lobbyError').textContent=m.message;$('#joinButton').disabled=false;}};
 ws.onclose=()=>{if(id){document.exitPointerLock?.();$('#missionModal').hidden=false;$('#missionModal').innerHTML='<div><span class="eyebrow">CONNECTION LOST</span><h2>Intercom went silent.</h2><p>Your seat has been released. Rejoin with the crew code. Empty rooms are removed.</p><button onclick="location.reload()">Reconnect</button></div>';if(g)g.disconnected=true;}else{$('#joinButton').disabled=false;if($('#lobbyError').textContent==='Connecting to aircraft…')$('#lobbyError').textContent='Could not connect. Please retry.';}};
 ws.onerror=()=>{$('#lobbyError').textContent='Connection failed. Check your network.';$('#joinButton').disabled=false;};};
$('#invite').onclick=async()=>{const url=location.origin+'/?room='+room;try{await navigator.clipboard.writeText(url);toast('Crew invite copied. Share with up to three friends.');}catch{prompt('Copy this crew invite:',url);}};
function setSound(on){sfx.on=on;if(on)startAudio();else stopAudio();$('#sound').textContent=on?'Sound on':'Sound off';}
$('#sound').onclick=()=>setSound(!sfx.on);
// ---------- Input: pointer-lock mouse look, station keys, hold E to repair ----------
const me=()=>g?.players?.[id],myStation=()=>me()?.station;
const flying=()=>g&&!['briefing','debrief'].includes(g.phase)&&!g.disconnected;
let lookTick=0,firing=false,zoom=false,repairing=false,nextShot=0,nextRepair=0,bailHeld=0,nearestStation=null,activeHotspot=null;
const look=(dx,dy)=>{if(myStation()==='bombardier')return;const k=zoom?.4:1;yaw-=dx*.0022*k;pitch=THREE.MathUtils.clamp(pitch-dy*.0022*k,-1.5,1.5);clampAim(myStation());};
$('#world').addEventListener('mousedown',e=>{if(!id)return;if(document.pointerLockElement!==$('#world')){$('#world').requestPointerLock?.();return;}
 if(e.button===2){zoom=true;return;}if(e.button!==0||!flying())return;const s=myStation();
 if(stations[s]?.gun)firing=true;else if(s==='navigator'){const hit=chartPoint();if(hit)send({type:'mark',x:hit[0],y:hit[1]});}else if(s==='bombardier')dropBombs();});
addEventListener('mouseup',e=>{if(e.button===0)firing=false;if(e.button===2)zoom=false;});
$('#world').addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{if(id&&document.pointerLockElement===$('#world'))look(e.movementX,e.movementY);});
const ray=new THREE.Raycaster();
function chartPoint(){ray.setFromCamera({x:0,y:0},camera);const hit=ray.intersectObject(chart)[0];return hit?chartToKm(hit.uv.x,1-hit.uv.y):null;}
function dropBombs(){if(g?.bombs)send({type:'drop'});}
const CALLS={Digit1:'Fighters! Watch your sectors.',Digit2:'Fire aboard, need hands!',Digit3:'Navigator, where are we?',Digit4:'Pilot, hold her steady.'};
addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;keys.add(e.code);if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();if(e.repeat||!flying()&&e.code!=='KeyE')return;const s=myStation();
 if(e.code==='KeyE'){if(s)send({type:'exit'});else if(activeHotspot)repairing=true;else if(nearestStation)send({type:'station',station:nearestStation});}
 if(CALLS[e.code])send({type:'call',text:CALLS[e.code]});
 if(s==='pilot'){if(e.code==='KeyG')send({type:'gear'});if(e.code==='Space')send({type:'control',bank:0,pitch:0});}
 if(s==='bombardier'&&e.code==='Space')dropBombs();
 if((s==='bombardier'||s==='chin')&&e.code==='KeyF')send({type:'station',station:s==='chin'?'bombardier':'chin'});
 if(s==='navigator'){if(e.code==='KeyX')send({type:'clearMarks'});if(e.code==='KeyC'){const last=g.marks.at(-1),to=chartPoint();if(!last||!to){toast('Mark your position on the chart first, then look at where you want to go and press C.');return;}
  const dx=to[0]-last.x,dy=to[1]-last.y,d=Math.hypot(dx,dy),crs=(Math.atan2(dx,dy)*180/Math.PI+360)%360,mins=d/(g.airspeed*60);send({type:'call',text:`Steer ${String(Math.round(crs)).padStart(3,'0')}°, ${d.toFixed(1)} km, about ${mins<1?'under a minute':Math.round(mins)+' min'}.`});}}});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyE')repairing=false;if(e.code==='KeyB')bailHeld=0;});
addEventListener('blur',()=>{keys.clear();firing=false;repairing=false;send({type:'move',x:0,z:0});});
// 10 Hz: walking, pilot/bombardier controls, held repairs.
setInterval(()=>{const p=me();if(!p||!flying())return;if(++lookTick%2===0)send({type:'look',yaw:+yaw.toFixed(3),pitch:+pitch.toFixed(3)});
 if(!p.station){const f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));send({type:'move',x:-Math.sin(yaw)*f+Math.cos(yaw)*side,z:-Math.cos(yaw)*f-Math.sin(yaw)*side});
  if(repairing&&activeHotspot&&performance.now()>nextRepair){nextRepair=performance.now()+460;send({type:'repair',system:activeHotspot});}return;}
 const k=c=>Number(keys.has(c));
 if(p.station==='pilot'){const bank=THREE.MathUtils.clamp(g.bank+(k('KeyD')-k('KeyA'))*2.5,-30,30),pt=THREE.MathUtils.clamp(g.pitch+(k('KeyS')-k('KeyW'))*.4,-5,5),thr=THREE.MathUtils.clamp(g.throttle+(k('ShiftLeft')-k('ControlLeft'))*.04,.1,1);
  if(bank!==g.bank||pt!==g.pitch||thr!==g.throttle)send({type:'control',bank,pitch:pt,throttle:thr});
  if(keys.has('KeyB')){bailHeld+=.1;if(bailHeld>=1.5){bailHeld=0;send({type:'bail'});}}}
 if(p.station==='bombardier'&&(k('KeyA')||k('KeyD')))send({type:'control',bank:THREE.MathUtils.clamp(g.bank+(k('KeyD')-k('KeyA'))*1.5,-10,10)});
 if(p.station==='bombardier'&&!k('KeyA')&&!k('KeyD')&&g.bank!==0&&Math.abs(g.bank)<=10)send({type:'control',bank:g.bank*.6});
},100);
// ---------- HUD (kept minimal: intercom, prompts, key help) ----------
const KEYS={walk:'WASD walk · Mouse look · E use / hold E repair · 1-4 intercom',pilot:'A/D bank · W/S nose down/up · Shift/Ctrl throttle · Space level · G gear · hold B bail out · E leave',
 bombardier:'A/D steer on the autopilot · Space or click: release bombs · F chin turret · E leave',navigator:'Click: mark position · look at a destination + C: call course · X: clear marks · Right mouse: zoom · E leave',gun:'Mouse aim · hold click: fire · Right mouse: zoom · E leave'};
function renderUI(){if(!g||g.disconnected)return;const p=me();if(!p)return;
 $('#phase').textContent=g.phase.toUpperCase();
 const obj={briefing:['Assemble your crew','Up to four crew. Nine positions. Choose well.'],outbound:['Find the Hammfeld marshalling yard',`Chart on the navigator's table · forecast wind ${MAP.forecastWind.from}° ${MAP.forecastWind.kmh} km/h`],return:['Bring her home','Gear down over Ashby Green, below 400 m, throttle 50% or less'],debrief:['Mission debrief','Every return is a story.']}[g.phase];
 if($('#objective').textContent!==obj[0])$('.mission').animate([{background:'#d1b777aa'},{}],{duration:1800});$('#objective').textContent=obj[0];$('#objectiveSub').textContent=obj[1];
 const logHtml=(g.log||[]).slice(0,5).map(l=>`<p><time>${String(Math.floor(l.t/60)).padStart(2,'0')}:${String(l.t%60).padStart(2,'0')}</time>${esc(l.text)}</p>`).join('');if(logHtml!==$('#radioLog').dataset.html){$('#radioLog').dataset.html=logHtml;$('#radioLog').innerHTML=logHtml;}
 const s=p.station;
 if(s!==lastStation){lastStation=s;zoom=false;firing=false;if(s){const gun=stations[s].gun;yaw={waistL:Math.PI/2,waistR:-Math.PI/2,tail:Math.PI}[s]??0;pitch=s==='navigator'?-1:s==='ball'?-.5:s==='top'?.25:0;clampAim(s);}document.body.dataset.station=s||'';}
 nearestStation=null;activeHotspot=null;let best=1.2;
 if(!s){for(const [k,st] of Object.entries(stations)){const d=Math.hypot(p.x-st.x,p.z-st.z);if(d<best&&!Object.values(g.players).some(q=>q.id!==id&&q.station===k)){best=d;nearestStation=k;}}
  const needs={enginefire:g.engineFire?.some(v=>v>0),leak:g.leak>0,electric:g.electric<100,oxygen:g.oxygen<100};
  let hb=1.5;for(const [k,h] of Object.entries(hotspots)){const d=Math.hypot(p.x-h.x,p.z-h.z);if(needs[k]&&d<hb){hb=d;activeHotspot=k;}}
  if(g.cabinFire>0&&Math.abs(p.z-g.cabinFireZ)<1.5)activeHotspot='cabinfire';}
 const hotLabel={enginefire:`pull fire bottle, engine ${(g.engineFire?.indexOf(Math.max(...(g.engineFire||[0])))??0)+1}`,leak:'work the fuel transfer valves',electric:'reset the breakers',oxygen:'patch the oxygen regulators',cabinfire:'beat out the fire'}[activeHotspot];
 $('#prompt').textContent=!flying()?'':s?'':activeHotspot?`Hold E · ${hotLabel}`:nearestStation?`E · ${stations[nearestStation].name}`+(nearestStation==='bombardier'?' (F inside: chin turret)':''):'';
 $('#keys').textContent=!flying()?'':!s?KEYS.walk:stations[s].gun?`${KEYS.gun}${s==='chin'?' · F bombsight':''} · ${g.ammo[s]} bursts left${stations[s].gun.powered&&g.electric<25?' · NO POWER':''}`:s==='bombardier'?`${KEYS.bombardier} · ${g.bombs?'BOMBS ARMED':'BOMBS GONE'}`:KEYS[s];
 if(g.phase!==modalPhase){modalPhase=g.phase;renderModal();}
 else if(g.phase==='debrief'||g.phase==='briefing'){const b=$('#begin');if(b){b.disabled=id!==g.host;b.textContent=id===g.host?(g.phase==='debrief'?'Fly another sortie':'Begin mission'):'Waiting for crew leader';}}
}
function renderModal(){const m=$('#missionModal');m.hidden=!['briefing','debrief'].includes(g.phase);if(m.hidden){return;}document.exitPointerLock?.();
 const leader=g.host===id,btn=`<button id="begin" class="primary" ${leader?'':'disabled'}>${leader?(g.phase==='debrief'?'Fly another sortie':'Begin mission'):'Waiting for crew leader'}</button>`;
 if(g.phase==='briefing')m.innerHTML=`<div><span class="eyebrow">OPERATION NIGHT LANTERN / CREW ${room}</span><h2>Bring her home.</h2><p>B-17G "Lucky Strike", airborne over Ashby Green. Target: the marshalling yard at Hammfeld, across the Channel, the Dutch coast and the Rhine. There is no map marker. The navigator's chart, the compass and the ground below are all you have. Expect wind drift, flak over towns and fighters from any direction.</p><div class="steps">Nose: bombardier (Norden sight) · chin turret · navigator's chart<br>Flight deck: pilot · top turret behind<br>Bomb bay catwalk · radio room · ball turret · waist guns · tail guns<br>Damage is fixed by hand: walk to it and hold E.</div><p>Desktop with mouse and keyboard. Click the view to capture the mouse, Esc to free it. Use a voice call with your crew.</p>${btn}</div>`;
 else{const text={LANDED:g.bombScore>50?'Target hit. Aircraft recovered. The crew made it home.':'You brought the crew home. The junction will have to wait.','BAILED OUT':'The aircraft is gone. The crew escaped by parachute.',DITCHED:'She went into the Channel. The crew took to the dinghies.','CRASH-LANDED':'Out of fuel or engines. She came down hard in a field.','AIRCRAFT LOST':'The aircraft did not survive. Fires and fighters first, next time.'}[g.outcome]||'';
  m.innerHTML=`<div><span class="eyebrow">MISSION DEBRIEF / LUCKY STRIKE</span><h2>${esc(g.outcome)}</h2><p>${text}</p><div class="kpis"><div><b>${g.bombScore}%</b><small>TARGET DAMAGE</small></div><div><b>${g.kills}</b><small>FIGHTERS DOWN</small></div><div><b>${g.repairs}</b><small>REPAIRS</small></div><div><b>${Math.floor(g.time/60)}:${String(Math.floor(g.time%60)).padStart(2,'0')}</b><small>FLIGHT TIME</small></div></div><p>Aircraft condition: ${Math.max(0,Math.round(g.hull))}%.</p>${btn}</div>`;}
 $('#begin').onclick=()=>send({type:'start'});}
// ---------- Frame ----------
const heardShot=new Map(),walker={x:0,z:5};let frameAvg=.016,dprAt=0;let previous=performance.now(),panelAt=0,flakAt=0,lastHull=100,shake=0,jolt=0,hurt=0,buffet=0,creakAt=0,hurtShown=-1;const camPos=new THREE.Vector3(),tmp=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-previous)/1000);previous=now;const fly=flying()&&g.pos;if(!fly&&hurtShown){hurtShown=0;buffet=0;$('#hurt').style.opacity=0;}
 // Smooth the 10 Hz server state: extrapolate along the ground track and ease toward the latest fix.
 if(fly){const h=view.heading*Math.PI/180;view.x+=(Math.sin(h)*g.airspeed+g.wind.x)*dt;view.y+=(Math.cos(h)*g.airspeed+g.wind.y)*dt;view.alt+=g.pitch*20*dt;view.heading=(view.heading+view.bank*.16*dt+360)%360;view.bank+=(g.bank-view.bank)*(1-Math.exp(-dt*4));
  const age=(now-srvAt)/1000,hs=g.heading*Math.PI/180,sx=g.pos.x+(Math.sin(hs)*g.airspeed+g.wind.x)*age,sy=g.pos.y+(Math.cos(hs)*g.airspeed+g.wind.y)*age,sa=g.altitude+g.pitch*20*age,sh=g.heading+g.bank*.16*age;
  if(Math.hypot(sx-view.x,sy-view.y)>.3)Object.assign(view,{x:sx,y:sy,alt:sa,heading:sh});else{const c=1-Math.exp(-dt*1.5);view.x+=(sx-view.x)*c;view.y+=(sy-view.y)*c;view.alt+=(sa-view.alt)*c;view.heading+=wrapPi((sh-view.heading)*Math.PI/180)*180/Math.PI*c;}}
 yawGroup.rotation.y=view.heading*Math.PI/180;world.position.set(-view.x*KM,-view.alt,view.y*KM);jolt*=Math.exp(-dt*3);roll.rotation.z=view.bank*Math.PI/180*.7+jolt+Math.sin(now*.0021)*Math.sin(now*.0007)*buffet*.05;roll.updateMatrixWorld(true);
 props.forEach((p,i)=>p.rotation.z+=dt*(g?.engines?(g.engines[i]>0?g.throttle*40:0):28));
 const p=me(),s=p?.station;
 if(!p){const t=now*.00004;camera.position.set(34*Math.cos(t),6,36*Math.sin(t));camera.lookAt(0,1,-1);camera.fov=50;}
 else{let fov=73;gunModel.visible=!!stations[s]?.gun;for(const [k,gm] of Object.entries(waistGuns))gm.visible=s!==k;const single=s==='waistL'||s==='waistR';barrels[0].position.x=single?0:-.09;barrels[1].visible=!single;
  if(s==='bombardier'){// Norden sight: gyro-stabilised, looking at the predicted point of impact.
   const t=Math.sqrt(2*view.alt/9.81),h=g.heading*Math.PI/180,vx=Math.sin(h)*g.airspeed+g.wind.x,vy=Math.cos(h)*g.airspeed+g.wind.y,fwd=(vx*Math.sin(h)+vy*Math.cos(h))*t*KM,right=(vx*Math.cos(h)-vy*Math.sin(h))*t*KM;
   camera.position.set(0,.15,-10.95);if(bombRun&&(now-bombRun.t0)/1000<bombRun.ft+12)camera.lookAt(world.localToWorld(toWorld(bombRun.ix,bombRun.iy,0)));else camera.lookAt(tmp.set(right,-view.alt,-fwd).applyAxisAngle(new THREE.Vector3(0,0,1),view.bank*Math.PI/180*.7));fov=bombRun&&(now-bombRun.t0)/1000<bombRun.ft+12?18:13;}
  else{if(s&&GUN_CAM[s])camPos.set(...GUN_CAM[s]);else if(s==='pilot')camPos.set(-.45,1.62,-6.2);else if(s==='navigator')camPos.set(-.5,1.2,-8.15);else{if(fly){const f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),side=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),mx=-Math.sin(yaw)*f+Math.cos(yaw)*side,mz=-Math.cos(yaw)*f-Math.sin(yaw)*side,n=Math.max(1,Math.hypot(mx,mz));
    walker.z=THREE.MathUtils.clamp(walker.z+mz/n*4*dt,-10.7,10.2);const w=aisle(walker.z);walker.x=THREE.MathUtils.clamp(walker.x+mx/n*4*dt,-w,w);
    const err=Math.hypot(walker.x-p.x,walker.z-p.z);if(err>1.5||(!f&&!side)){const c=err>1.5?1:1-Math.exp(-dt*3);walker.x+=(p.x-walker.x)*c;walker.z+=(p.z-walker.z)*c;}}
   camPos.set(walker.x,eyeY(walker.z),walker.z);}
   if(s){camera.position.copy(camPos);walker.x=p.x;walker.z=p.z;}else{camera.position.x=camPos.x;camera.position.z=camPos.z;camera.position.y+=(camPos.y-camera.position.y)*(1-Math.exp(-dt*10));}
   camera.rotation.set(pitch,yaw,0);fov=s==='navigator'?(zoom?20:50):stations[s]?.gun?(zoom?32:62):73;}
  camera.fov=fov;
  if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.06;camera.position.y+=(Math.random()-.5)*shake*.06;shake=Math.max(0,shake-dt*2);}
  if(fly){// Live instruments at 5 Hz, chart marks when they change.
   if(now>panelAt){panelAt=now+200;const st={...g,heading:view.heading,altitude:view.alt};cockpit.redraw(st);navRepeater.redraw(st);drawMarks();}
   if(g.hull<lastHull-1){shake=1;hurt=1;jolt+=(Math.random()-.5)*.08;thump(sfx.cabin?.bus,{freq:300,q:2,gain:2.5,decay:.5});thump(sfx.cabin?.bus,{freq:3000,q:1,gain:.8,decay:.3});}lastHull=g.hull;
   // Firing: tracers from the gun, rate-limited like the server.
   if(firing&&stations[s]?.gun&&now>nextShot&&g.ammo[s]>0){nextShot=now+125;send({type:'shoot',az:aimAz(),el:aimEl()});fireRound(s,true);setTimeout(()=>{if(firing&&myStation()===s)fireRound(s,false);},62);}
   bombs.visible=!!g.bombs;
   g.engineFire.forEach((f,i)=>{flames[i].visible=f>0;flames[i].scale.set(1,.4+f/70+Math.random()*.3,1);if((f>0||g.engines[i]<45)&&Math.random()<dt*14)puff(tmp.set(ENGINE_X[i],.2,-.6),{color:f>0?'#2a2826':'#6b6b66',life:2.4,vz:90,size:1.5,grow:5});});
   cabinFlame.visible=g.cabinFire>0;cabinFlame.position.set(0,.55,g.cabinFireZ);cabinFlame.scale.setScalar(.5+g.cabinFire/90+Math.random()*.15);
   const fires=g.engineFire.some(v=>v>0)||g.cabinFire>0;fireLight.intensity=fires?6*(.8+Math.sin(now*.03)*.2):0;fireLight.position.set(g.cabinFire>0?0:-.8,1.2,g.cabinFire>0?g.cabinFireZ:-3.2);
   for(const [k,m] of Object.entries(hotspotMeshes))m.scale.setScalar(1);const hot=activeHotspot&&activeHotspot!=='cabinfire'?hotspotMeshes[activeHotspot]:null;glow.intensity=hot?1.5+Math.sin(now*.008):0;if(hot)glow.position.copy(hot.position);
   // Flak bursts around the aircraft while over a defended area.
   if(g.inFlak&&now>flakAt){flakAt=now+(500+Math.random()*900)/g.inFlak;const a=Math.random()*Math.PI*2,r=.12+Math.random()*.45;burst(toWorld(view.x+Math.cos(a)*r,view.y+Math.sin(a)*r,view.alt+(Math.random()-.4)*250),1);}
   if(g.impact&&bombRun?.at!==g.impact.at){const ft=g.impact.at-g.time,h=view.heading*Math.PI/180;bombRun={at:g.impact.at,t0:now,ft:Math.max(.5,ft),alt:view.alt,x:view.x,y:view.y,ix:g.impact.x,iy:g.impact.y,v:{x:Math.sin(h)*g.airspeed+g.wind.x,y:Math.cos(h)*g.airspeed+g.wind.y},jit:fallBombs.map(()=>[(Math.random()-.5)*.04,(Math.random()-.5)*.04]),done:fallBombs.map(()=>ft<0)};if(ft>0)releaseFx();}
   updateBombRun(now);
   // Damage you feel: buffet and wobble grow as the airframe and engines go, a red edge on every hit, creaks, smoke seeping through holes.
   const dmg=Math.max(0,1-g.hull/100);buffet=dmg*dmg*.6+g.engines.filter(e=>e<=0).length*.1;shake=Math.max(shake,buffet*.5);hurt*=Math.exp(-dt*2.5);
   const ho=Math.max(hurt*.9,dmg*.55);if(Math.abs(ho-hurtShown)>.01){hurtShown=ho;$('#hurt').style.opacity=ho.toFixed(2);}
   if(dmg>.3&&now>creakAt){creakAt=now+1500+Math.random()*5000/dmg;thump(sfx.cabin?.bus,{freq:60+Math.random()*90,q:14,gain:2.5*dmg,decay:1.3,pitch:-.5});}
   if(dmg>.35&&holeMeshes.size&&Math.random()<dt*dmg*5){const hs=[...holeMeshes.values()],[inside]=hs[Math.floor(Math.random()*hs.length)];puff(inside.position,{color:'#6d6862',life:3,vz:1.5,size:.2,grow:.7});}
   for(const q of Object.values(g.players))if(q.firedAt!==undefined&&q.firedAt!==heardShot.get(q.id)){if(heardShot.has(q.id)&&q.id!==id&&stations[q.station]?.gun){heavyShot(sfx.guns?.[q.station]?.bus);const at=new THREE.Vector3(...stations[q.station].gun.at),cy=Math.cos(q.pitch||0),d=new THREE.Vector3(-Math.sin(q.yaw||0)*cy,Math.sin(q.pitch||0),-Math.cos(q.yaw||0)*cy);tracer(at,d);sparkBurst(at,3,1,{color:'#ffd28a',size:.12,life:.06});}heardShot.set(q.id,q.firedAt);}
   for(const l of cabinLights)l.intensity=g.electric<25?0:g.electric<60&&Math.random()<.08?.2:1.6;
   syncHoles();updateAudio(dt);}
  updateCombatFx(dt,now);
  // Other crew members, seated at their station when they hold one, hidden inside powered turrets.
  for(const q of Object.values(g.players))if(q.id!==id){let a=avatars.get(q.id);if(!a){a=makeCrewman([...q.id].reduce((h,c)=>h*31+c.charCodeAt(0)|0,7),q.name);a.userData.prev=new THREE.Vector3(q.x,0,q.z);plane.add(a);avatars.set(q.id,a);}
   const st=q.station,inTurret=['top','ball','chin'].includes(st);a.visible=!inTurret;if(inTurret)continue;
   const seatAt=st?stations[st]:null,tx=seatAt?seatAt.x:q.x,tz=seatAt?seatAt.z:q.z;a.position.x+=(tx-a.position.x)*(1-Math.exp(-dt*12));a.position.z+=(tz-a.position.z)*(1-Math.exp(-dt*12));
   const ty=st==='pilot'?.45:st?floorY(tz):inCrawl(a.position.z)?0:floorY(a.position.z);a.position.y+=(ty-a.position.y)*(1-Math.exp(-dt*10));
   const speed=a.position.distanceTo(a.userData.prev)/Math.max(dt,.001);a.userData.prev.copy(a.position);
   const pose=st==='tail'?'kneel':st==='waistL'||st==='waistR'?'gunner':st?'seated':inCrawl(a.position.z)?'crouch':'walk';
   a.userData.update(dt,{pose,speed:st?0:Math.min(speed,5),lookYaw:q.yaw??0,lookPitch:q.pitch??0});}
  for(const [key,a]of avatars)if(!g.players[key]){plane.remove(a);disposeCrewman(a);avatars.delete(key);}}
 // Fighters: placed by bearing, elevation and range relative to the bomber; nose on during attacks.
 const seen=new Set();for(const f of (fly?g.fighters:[])){seen.add(f.id);let m=fighters.get(f.id);if(!m){m=makeFighter();m.position.copy(dirOf(f.az,f.el).multiplyScalar(f.dist));fighters.set(f.id,m);}
  m.position.lerp(dirOf(f.az,f.el).multiplyScalar(f.dist),1-Math.exp(-dt*6));m.lookAt(f.state==='approach'?tmp.set(0,0,0):tmp.copy(m.position).multiplyScalar(2).add(UP.clone().multiplyScalar(f.state==='down'?-400:0)));
  m.rotateZ(Math.sin(now*.002+f.id)*.4);
  if((f.hits||0)>(m.userData.hits||0)){const n=f.hits-(m.userData.hits||0);m.userData.hits=f.hits;sparkBurst(m.position,6*n,25,{size:1.2,life:.25});sparkBurst(m.position,3*n,12,{color:'#2a2622',size:.6,life:.8});if(m.userData.voice)thump(m.userData.voice.e.bus,{freq:2400,q:3,gain:2,decay:.06});}
  if(f.state!=='down'&&f.maxHp&&f.hp<f.maxHp*.6&&Math.random()<dt*(f.hp<f.maxHp*.35?30:12))puff(m.position,{color:f.hp<f.maxHp*.35?'#1d1c1b':'#7a7770',life:2.5,vz:70,size:3,grow:8});const attacking=f.state==='approach'&&f.dist<900;m.userData.flash.visible=attacking&&Math.random()<.5;
  if(attacking&&Math.random()<dt*6&&m.userData.voice)thump(m.userData.voice.e.bus,{freq:1100,q:.8,gain:2.5,decay:.07});if(attacking&&Math.random()<dt*6)tracer(m.position.clone(),tmp.copy(m.position).negate().normalize().add(new THREE.Vector3((Math.random()-.5)*.04,(Math.random()-.5)*.04,0)).normalize(),700);
  if(f.state==='down'&&Math.random()<dt*25)puff(m.position,{color:'#1d1c1b',life:3,vz:60,size:4,grow:10});}
 for(const [k,m] of fighters)if(!seen.has(k)){m.userData.voice?.o.stop();scene.remove(m);fighters.delete(k);}
 for(const t of tracers)if(t.visible){t.userData.age+=dt;t.userData.v.y-=9.81*dt;t.position.addScaledVector(t.userData.v,dt);t.visible=t.userData.age<1.4;}
 for(const s of puffs)if(s.visible){const u=s.userData;u.age+=dt;s.position.z+=u.vz*dt;s.scale.setScalar(u.size+u.age*u.grow);s.material.opacity=Math.max(0,.75*(1-u.age/u.life));s.visible=u.age<u.life;}
 for(const f of flak){const u=f.userData;u.age+=dt;f.visible=u.age<5;if(!f.visible)continue;f.scale.setScalar((6+u.age*14)*u.scale);f.material.opacity=Math.max(0,.9-u.age*.18);f.material.emissiveIntensity=u.age<.15?3:0;}
 for(let i=gfx.length;i--;){const e=gfx[i];e.age+=dt;if(e.age>=e.life){e.o.visible=false;gfx.splice(i,1);}else e.step(e.o,e.age/e.life,dt);}
 camera.updateProjectionMatrix();renderer.render(scene,camera);
 frameAvg=frameAvg*.95+dt*.05;if(now>dprAt){dprAt=now+2000;const cur=renderer.getPixelRatio(),max=Math.min(devicePixelRatio,1.5);const next=frameAvg>.021?Math.max(.75,cur-.25):frameAvg<.012?Math.min(max,cur+.25):cur;if(next!==cur)renderer.setPixelRatio(next);}
}requestAnimationFrame(frame);
