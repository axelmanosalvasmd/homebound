import {MAP,overEnemy,overSea,aisle} from './public/map.js';
export {aisle};
// Crew positions inside the B-17G (metres; z runs nose -11.3 to tail +11.3). Guns carry their field of fire:
// azimuth clockwise from the nose, elevation up from level, both in degrees.
export const STATIONS={
 bombardier:{x:0,z:-10.1,seat:'nose',name:'Norden bombsight'},
 chin:{x:0,z:-10.1,seat:'nose',name:'Chin turret',gun:{az:[-60,60],el:[-50,15],powered:true,at:[0,-.4,-11.6],barrels:2}},
 navigator:{x:-.45,z:-8.6,name:'Navigator\'s table'},
 pilot:{x:-.45,z:-6.3,name:'Pilot\'s seat'},
 top:{x:0,z:-4.7,name:'Top turret',gun:{az:null,el:[3,85],powered:true,at:[0,2.75,-5.3],barrels:2}},
 ball:{x:0,z:2.7,name:'Ball turret',gun:{az:null,el:[-85,-3],powered:true,at:[0,-.85,3.2],barrels:2}},
 waistL:{x:-.6,z:4.05,name:'Left waist gun',gun:{az:[200,340],el:[-45,50],at:[-1.6,1.6,4.05],barrels:1}},
 waistR:{x:.6,z:5.25,name:'Right waist gun',gun:{az:[20,160],el:[-45,50],at:[1.6,1.6,5.25],barrels:1}},
 tail:{x:0,z:10,name:'Tail guns',gun:{az:[140,220],el:[-40,35],at:[0,.75,12],barrels:2}},
};
// Ballistics for the .50 cal M2: muzzle velocity, dispersion, how long a round is tracked, and the target size.
// Fighters are about 10 m across; the hit radius is a little under half that because bullets have to find metal.
export const GUN={speed:850,spread:.3*Math.PI/180,life:2.4,hitRadius:3.6,gravity:9.81};
// Position in the bomber's frame (metres, nose -z, starboard +x) of something at bearing az, elevation el, range r.
export function posOf(az,el,r){const a=az*Math.PI/180,e=el*Math.PI/180;return [Math.sin(a)*Math.cos(e)*r,Math.sin(e)*r,-Math.cos(a)*Math.cos(e)*r];}
// Where a gunner at this station must aim to meet an approaching fighter: lead, closing speed, drop and the
// gun's offset from the aircraft's centre. Used by the bot crew; human gunners do this by eye.
export function aimAt(station,f){const at=STATIONS[station].gun.at;let t=0,v=[0,0,0];
 for(let i=0;i<4;i++){const p=posOf(f.az+f.curve*t,f.el,Math.max(0,f.dist-140*t));v=[p[0]-at[0],p[1]-at[1]+.5*GUN.gravity*t*t,p[2]-at[2]];t=Math.hypot(...v)/GUN.speed;}
 const r=Math.hypot(...v);return {az:((Math.atan2(v[0],-v[2])*180/Math.PI)+360)%360,el:Math.asin(v[1]/r)*180/Math.PI};}
// Places in the cabin where damage is dealt with by hand. Anyone can repair; walk there and hold E.
export const HOTSPOTS={
 enginefire:{x:.75,y:1.3,z:-5.2,name:'engine fire bottles'},
 leak:{x:-.25,y:1,z:-1.25,name:'fuel transfer valves'},
 electric:{x:-.95,y:1.5,z:1.2,name:'radio room junction box'},
 oxygen:{x:1,y:1,z:6.6,name:'oxygen regulators'},
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>((a%360)+360)%360;
// Bomb fall time from altitude (vacuum approximation) and the impact point the Norden sight predicts.
export const fallTime=alt=>Math.sqrt(2*alt/9.81);
export function groundVelocity(g){const h=g.heading*Math.PI/180;return {x:Math.sin(h)*g.airspeed+g.wind.x,y:Math.cos(h)*g.airspeed+g.wind.y};}
export function impactPoint(g){const v=groundVelocity(g),t=fallTime(g.altitude);return {x:g.pos.x+v.x*t,y:g.pos.y+v.y*t};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const clock=az=>(Math.round(wrap(az)/30)%12)||12;
function inArc(gun,az,el){if(el<gun.el[0]-2||el>gun.el[1]+2)return false;if(!gun.az)return true;let [a0,a1]=gun.az;let a=wrap(az);if(a0<0){a0+=360;return a>=a0-2||a<=a1+2;}return a>=a0-2&&a<=a1+2;}
// Bullets are tracked server-side but kept out of the state sent to clients (non-enumerable).
const bulletsOf=g=>{if(!Object.hasOwn(g,'bullets'))Object.defineProperty(g,'bullets',{value:[],writable:true,enumerable:false});return g.bullets;};
// Bullet and flak holes in the skin, shared so every crew member sees the same damage: z along the hull, a = angle round it (0 roof, + starboard).
function holes(g,n,[z0,z1],[a0,a1],kind,random){for(let i=0;i<n;i++)g.hits.push({id:++g.hitId,z:z0+random()*(z1-z0),a:a0+random()*(a1-a0),kind,t:Math.round(g.time*10)/10});g.hits=g.hits.slice(-90);}

export function createGame(){return {players:{},phase:'briefing',time:0,log:[],host:null,marks:[]};}
export function join(g,id,name){if(Object.keys(g.players).length>=4)return false;g.players[id]={id,name:(typeof name==='string'&&name.trim()?name:'Crew').slice(0,20),x:0,z:5,station:null,hp:100};g.host??=id;return true;}
export function leave(g,id){delete g.players[id];if(g.host===id)g.host=Object.keys(g.players)[0]||null;}
export function start(g,random=Math.random){
 const from=MAP.forecastWind.from+(random()-.5)*40,kmh=MAP.forecastWind.kmh+(random()-.5)*30,to=(from+180)*Math.PI/180;
 Object.assign(g,{phase:'outbound',time:0,pos:{x:2,y:-1},altitude:3000,heading:80,bank:0,pitch:0,throttle:.7,gear:false,airspeed:.2,
  wind:{x:Math.sin(to)*kmh/3600,y:Math.cos(to)*kmh/3600},fuel:100,hull:100,engines:[100,100,100,100],engineFire:[0,0,0,0],wingBurn:[0,0,0,0],
  leak:0,electric:100,oxygen:100,cabinFire:0,cabinFireZ:5,bombs:true,bombScore:0,impact:null,kills:0,repairs:0,
  ammo:Object.fromEntries(Object.entries(STATIONS).filter(([,s])=>s.gun).map(([k])=>[k,k==='tail'||k==='chin'?300:250])),
  fighters:[],nextFighter:20,fighterId:0,hits:[],hitId:0,flakIn:3,inFlak:0,faultIn:70+random()*40,outcome:null,log:[],marks:[]});
 for(const q of Object.values(g.players)){q.hp=100;q.station=null;q.move=null;q.repairAt=0;q.shotAt=0;q.callAt=0;q.x=0;q.z=5;}
 log(g,'Operation Night Lantern. Find the Hammfeld marshalling yard, bomb it, bring her home.');
}
export function act(g,id,a,random=Math.random){const p=g.players[id];if(!p||!a||typeof a!=='object')return false;
 if(a.type==='move'&&!p.station){p.move={x:Number.isFinite(a.x)?clamp(a.x,-1,1):0,z:Number.isFinite(a.z)?clamp(a.z,-1,1):0};p.moveUntil=g.time+.3;return true;}
 if(a.type==='station'){if(typeof a.station!=='string'||!Object.hasOwn(STATIONS,a.station))return false;const s=STATIONS[a.station];if(Math.hypot(p.x-s.x,p.z-s.z)>1.4||Object.values(g.players).some(q=>q.id!==id&&(q.station===a.station||s.seat&&STATIONS[q.station]?.seat===s.seat)))return false;p.station=a.station;p.x=s.x;p.z=s.z;return true;}
 if(a.type==='exit'){p.station=null;return true;}
 if(a.type==='look'&&Number.isFinite(a.yaw)&&Number.isFinite(a.pitch)){p.yaw=clamp(a.yaw,-100,100);p.pitch=clamp(a.pitch,-1.6,1.6);return true;}
 if(a.type==='start'&&g.host===id&&['briefing','debrief'].includes(g.phase)){start(g,random);return true;}
 if(a.type==='call'&&typeof a.text==='string'){if(g.time<(p.callAt||0))return false;p.callAt=g.time+1.5;log(g,`${p.name}: ${a.text.slice(0,90)}`);return true;}
 if(['briefing','debrief'].includes(g.phase))return false;
 if(a.type==='control'&&(p.station==='pilot'||p.station==='bombardier')){
  // The pilot has the full aircraft; on the bomb run the bombardier steers small corrections through the autopilot link.
  const lim=p.station==='pilot'?[['bank',-30,30],['pitch',-5,5],['throttle',.1,1]]:[['bank',-10,10]];
  for(const [k,min,max] of lim)if(Number.isFinite(a[k]))g[k]=clamp(a[k],min,max);return true;}
 if(a.type==='gear'&&p.station==='pilot'){g.gear=!g.gear;log(g,g.gear?'Gear down.':'Gear up.');return true;}
 if(a.type==='bail'&&p.station==='pilot'){g.phase='debrief';g.outcome=g.altitude>=500?'BAILED OUT':'DITCHED';return true;}
 if(a.type==='drop'&&p.station==='bombardier'&&g.bombs){
  const hit=impactPoint(g),err=dist(hit,MAP.target);g.bombs=false;g.phase='return';
  g.bombScore=err<.15?100:Math.max(0,Math.round(100*(1-(err-.15)/.85)));g.impact={...hit,at:g.time+fallTime(g.altitude),reported:false,err};
  log(g,'Bombs away. Bomb doors closing. Turn for home.');return true;}
 if(a.type==='mark'&&p.station==='navigator'&&Number.isFinite(a.x)&&Number.isFinite(a.y)){const b=MAP.bounds;g.marks.push({x:clamp(a.x,b.x0,b.x1),y:clamp(a.y,b.y0,b.y1),t:Math.round(g.time)});g.marks=g.marks.slice(-12);return true;}
 if(a.type==='clearMarks'&&p.station==='navigator'){g.marks=[];return true;}
 if(a.type==='repair'&&!p.station&&g.time>=(p.repairAt||0)){
  const k=a.system;if(typeof k!=='string'||!(Object.hasOwn(HOTSPOTS,k)||k==='cabinfire'))return false;
  const spot=k==='cabinfire'?(g.cabinFire>0?{x:0,z:g.cabinFireZ}:null):HOTSPOTS[k];if(!spot||Math.hypot(p.x-spot.x,p.z-spot.z)>1.6)return false;
  if(k==='enginefire'){const i=g.engineFire.indexOf(Math.max(...g.engineFire));if(g.engineFire[i]<=0)return false;g.engineFire[i]=Math.max(0,g.engineFire[i]-14);if(!g.engineFire[i])log(g,`Engine ${i+1} fire is out.`);}
  else if(k==='cabinfire'){g.cabinFire=Math.max(0,g.cabinFire-15);if(!g.cabinFire)log(g,'Cabin fire out.');}
  else if(k==='leak'){if(g.leak<=0)return false;g.leak=Math.max(0,g.leak-.6);if(!g.leak)log(g,'Fuel leak sealed.');}
  else{if(g[k]>=100)return false;g[k]=Math.min(100,g[k]+10);}
  p.repairAt=g.time+.45;g.repairs++;return true;}
 if(a.type==='shoot'){const s=STATIONS[p.station];if(!s?.gun||!Number.isFinite(a.az)||!Number.isFinite(a.el)||g.time<(p.shotAt||0)||g.ammo[p.station]<=0)return false;
  if(s.gun.powered&&g.electric<25)return false;if(!inArc(s.gun,a.az,a.el))return false;
  // One burst puts a round down each barrel; the rounds then fly and hit (or miss) in tick().
  p.shotAt=g.time+.12;p.firedAt=g.time;g.ammo[p.station]--;
  for(let b=0;b<s.gun.barrels;b++){const az=a.az+(random()-.5)*2*GUN.spread*180/Math.PI,el=a.el+(random()-.5)*2*GUN.spread*180/Math.PI,d=posOf(az,el,GUN.speed);
   bulletsOf(g).push({p:[s.gun.at[0]+(b-(s.gun.barrels-1)/2)*.18,s.gun.at[1],s.gun.at[2]],v:d,age:0,by:p.name,gun:s.name.toLowerCase()});}
  return true;}
 return false;
}
function log(g,text){g.log.unshift({t:Math.round(g.time),text});g.log=g.log.slice(0,8);}
function damage(g,{hull=0,engine=null,fire=0,leak=0,cabin=0,oxygen=0,electric=0},random){
 g.hull-=hull;if(engine!==null){g.engines[engine]=Math.max(0,g.engines[engine]-20);if(random()<fire&&g.engines[engine]>0){g.engineFire[engine]=Math.max(g.engineFire[engine],30);log(g,`Engine ${engine+1} on fire!`);}}
 if(random()<leak){g.leak=Math.min(5,g.leak+1.2);log(g,'Fuel leak in the bomb bay tanks.');}
 if(random()<cabin&&!g.cabinFire){g.cabinFire=30;g.cabinFireZ=[0.5,3.6,5.8,8][Math.floor(random()*4)];log(g,'Fire in the fuselage!');}
 if(random()<oxygen){g.oxygen=Math.max(0,g.oxygen-30);log(g,'Oxygen system hit.');}
 if(random()<electric){g.electric=Math.max(0,g.electric-35);log(g,'Electrical bus hit. Powered turrets failing.');}
}
function spawnFighter(g,random){const az=Math.floor(random()*12)*30+(random()-.5)*14,el=-30+random()*65,hp=10+Math.floor(random()*5);
 g.fighters.push({id:++g.fighterId,az,el,dist:2300,hp,maxHp:hp,hits:0,state:'approach',curve:(random()-.5)*7,passes:0,t:0});
 log(g,`Fighter, ${clock(az)} o'clock ${el>12?'high':el<-12?'low':'level'}!`);}
function fighterPass(g,f,random){
 // Damage depends on the side the attack came from; damaged fighters shoot less accurately.
 const a=wrap(f.az),k=(f.hp>=f.maxHp*.5?1:.6)*.8,n=Math.round((6+random()*7)*k);
 if(a<45||a>315){damage(g,{hull:4*k,engine:random()<.5?1:2,fire:.35*k,oxygen:.2},random);holes(g,n,[-10.6,-4.5],[-2.6,2.6],'bullet',random);}
 else if(a>=135&&a<=225){damage(g,{hull:7*k,cabin:.3*k,oxygen:.25,electric:.2},random);holes(g,n,[5,10.8],[-3,3],'bullet',random);}
 else{const port=a>180;damage(g,{hull:5*k,engine:port?(random()<.5?0:1):(random()<.5?2:3),fire:.3*k,leak:.3,cabin:.15*k},random);holes(g,n,[-3,8.5],port?[-2.3,-.5]:[.5,2.3],'bullet',random);}
}
export function tick(g,dt,random=Math.random){
 for(const p of Object.values(g.players))if(!p.station&&p.move&&g.time<(p.moveUntil||0)){
  const n=Math.max(1,Math.hypot(p.move.x,p.move.z));p.z=clamp(p.z+p.move.z/n*4*dt,-10.7,10.2);const w=aisle(p.z);p.x=clamp(p.x+p.move.x/n*4*dt,-w,w);}
 if(['briefing','debrief'].includes(g.phase))return;
 g.time+=dt;
 // Flight: bank turns, pitch climbs, power from four engines, wind drifts the ground track.
 const power=g.engines.reduce((s,e)=>s+e,0)/400;
 g.airspeed=(.12+.14*g.throttle)*(.3+.7*power)*(g.gear?.85:1);
 if(g.electric<30)g.bank=clamp(g.bank+Math.sin(g.time)*.3*dt,-30,30);
 g.heading=wrap(g.heading+g.bank*.16*dt);g.altitude=clamp(g.altitude+g.pitch*20*dt,80,6000);
 const v=groundVelocity(g);g.pos.x+=v.x*dt;g.pos.y+=v.y*dt;
 g.fuel=Math.max(0,g.fuel-(.1*g.throttle+g.leak*.06)*dt);
 for(let i=0;i<4;i++)if(g.engineFire[i]>0){g.engineFire[i]=Math.min(100,g.engineFire[i]+.6*dt);g.engines[i]=Math.max(0,g.engines[i]-g.engineFire[i]*.012*dt);g.hull-=g.engineFire[i]*.0012*dt;g.wingBurn[i]=g.engineFire[i]>=100?g.wingBurn[i]+dt:0;}
 if(g.cabinFire>0){g.cabinFire=Math.min(100,g.cabinFire+.8*dt);g.hull-=g.cabinFire*.004*dt;}
 if(g.altitude>3500&&g.oxygen<50)for(const p of Object.values(g.players))p.hp=Math.max(10,p.hp-.2*dt);
 // Flak over defended areas: lower and straighter is easier to hit.
 const zone=MAP.flak.find(z=>dist(g.pos,z)<z.r);g.inFlak=zone?zone.strength:0;
 if(zone&&(g.flakIn-=dt)<=0){g.flakIn=(3+random()*4)/zone.strength;const p=zone.strength*clamp(1.3-g.altitude/6000,.3,1)*(Math.abs(g.bank)>10?.6:1);
  if(random()<p*.6){damage(g,{hull:2+random()*5,engine:random()<.5?Math.floor(random()*4):null,fire:.3,leak:.25,oxygen:.1,electric:.1},random);const z=-9+random()*19;holes(g,1+Math.floor(random()*3),[z-1.5,z+1.5],[-3.1,3.1],'flak',random);holes(g,4+Math.floor(random()*6),[z-2.5,z+2.5],[-3.1,3.1],'bullet',random);log(g,'Flak hit!');}}
 // Mechanical faults are rare; most trouble comes from the enemy.
 if((g.faultIn-=dt)<=0){g.faultIn=80+random()*60;damage(g,random()<.5?{leak:1}:{electric:1},random);}
 // Fighters patrol enemy territory and attack from any clock position, high or low.
 const enemy=overEnemy(g.pos.x,g.pos.y),near=dist(g.pos,MAP.target)<10;
 if(enemy&&(g.nextFighter-=dt)<=0){g.nextFighter=near?18+random()*14:36+random()*26;if(g.fighters.filter(f=>f.state!=='down').length<(near?3:2))spawnFighter(g,random);}
 for(const f of g.fighters){f.t+=dt;f.prev=posOf(f.az,f.el,f.dist);
  // Closing in, the fighter is already firing: rounds stitch the fuselage before the pass (the structural damage comes with the pass itself).
  if(f.state==='approach'&&f.dist<650&&random()<dt*2.5){const a=wrap(f.az),port=a>180&&a<315,stbd=a>45&&a<180;holes(g,1,a<45||a>315?[-10.6,-4.5]:a>=135&&a<=225?[5,10.8]:[-3,8.5],port?[-2.3,-.5]:stbd?[.5,2.3]:[-3,3],'bullet',random);}
  if(f.state==='approach'){f.dist-=140*dt;f.az=wrap(f.az+f.curve*dt);f.el=clamp(f.el+(f.dist>900?Math.sin(f.t*.8)*2.5:0)*dt,-60,70);if(f.dist<=220){fighterPass(g,f,random);f.state='breakaway';f.passes++;}}
  else if(f.state==='breakaway'){f.dist+=170*dt;f.el=clamp(f.el-14*dt,-70,70);f.az=wrap(f.az+f.curve*4*dt);if(f.dist>=2300){if(f.passes<2&&enemy&&f.hp>f.maxHp*.35){f.state='approach';f.az=Math.floor(random()*12)*30;f.el=-30+random()*65;f.curve=(random()-.5)*7;log(g,`Fighter coming round again, ${clock(f.az)} o'clock!`);}else f.state='gone';}}
  else if(f.state==='down'){f.el-=10*dt;f.dist+=60*dt;if(f.t>8)f.state='gone';}}
 g.fighters=g.fighters.filter(f=>f.state!=='gone');
 // Bullets fly in the bomber's frame (they keep the bomber's speed) with gravity drop. A hit is the closest approach
 // between the round's path and the fighter's path during this tick, so crossing targets need lead.
 const bullets=bulletsOf(g);
 for(const b of bullets){const p0=b.p,p1=[p0[0]+b.v[0]*dt,p0[1]+b.v[1]*dt-.5*GUN.gravity*dt*dt,p0[2]+b.v[2]*dt];b.v[1]-=GUN.gravity*dt;b.p=p1;b.age+=dt;
  for(const f of g.fighters){if(f.state==='down'||!f.prev)continue;const f1=posOf(f.az,f.el,f.dist);
   const d0=[p0[0]-f.prev[0],p0[1]-f.prev[1],p0[2]-f.prev[2]],dd=[p1[0]-f1[0]-d0[0],p1[1]-f1[1]-d0[1],p1[2]-f1[2]-d0[2]];
   const len=dd[0]**2+dd[1]**2+dd[2]**2,t=len?clamp(-(d0[0]*dd[0]+d0[1]*dd[1]+d0[2]*dd[2])/len,0,1):0;
   if(Math.hypot(d0[0]+dd[0]*t,d0[1]+dd[1]*t,d0[2]+dd[2]*t)<GUN.hitRadius){b.age=99;f.hp--;f.hits++;f.hitAt=Math.round(g.time*10)/10;
    if(f.hp<=0){f.state='down';f.t=0;g.kills++;log(g,`Fighter down! ${b.by}, ${b.gun}.`);}
    else if(f.hp<=f.maxHp*.35&&f.state==='approach'){f.state='breakaway';log(g,'Fighter hit and smoking, breaking off!');}break;}}}
 g.bullets=bullets.filter(b=>b.age<GUN.life);
 if(g.impact&&!g.impact.reported&&g.time>=g.impact.at){g.impact.reported=true;const decoy=MAP.yards[1];
  log(g,dist(g.impact,decoy)<1.2?'Strike report: bombs fell on Lindenau. Wrong yard.':g.bombScore>0?`Strike report: Hammfeld yard hit, ${g.bombScore}% effective.`:`Strike report: bombs missed by ${g.impact.err.toFixed(1)} km.`);}
 // Landing: gear down, slow and level, low over the home airfield.
 if(g.gear&&dist(g.pos,MAP.base)<=2&&g.altitude<=400&&g.throttle<=.5&&Math.abs(g.bank)<8&&g.time>60){g.phase='debrief';g.outcome='LANDED';log(g,'Wheels down. Welcome home.');return;}
 if(g.hull<=0||g.wingBurn.some(t=>t>20)){g.phase='debrief';g.outcome='AIRCRAFT LOST';return;}
 if(g.fuel<=0||g.engines.every(e=>e<=0)){g.phase='debrief';g.outcome=overSea(g.pos.x,g.pos.y)?'DITCHED':'CRASH-LANDED';}
}
