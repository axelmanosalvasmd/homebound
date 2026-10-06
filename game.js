export const STATIONS={pilot:{x:0,z:-10,name:'Flight deck'},navigator:{x:0,z:-6,name:'Navigation / bombsight'},engineer:{x:0,z:1,name:'Engineering'},gunner:{x:0,z:9,name:'Tail turret'}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createGame(){return {players:{},phase:'briefing',time:0,log:[],host:null};}
export function join(g,id,name){if(Object.keys(g.players).length>=4)return false;g.players[id]={id,name:(typeof name==='string'&&name.trim()?name:'Crew').slice(0,20),x:0,z:5,station:null,hp:100};g.host??=id;return true;}
export function leave(g,id){delete g.players[id];if(g.host===id)g.host=Object.keys(g.players)[0]||null;}
export function act(g,id,a){const p=g.players[id];if(!p)return false;
 if(a.type==='move'&&!p.station){p.move={x:Number.isFinite(a.x)?clamp(a.x,-1,1):0,z:Number.isFinite(a.z)?clamp(a.z,-1,1):0};p.moveUntil=g.time+.3;return true;}
 if(a.type==='station'){if(typeof a.station!=='string')return false;const s=STATIONS[a.station];if(!Object.hasOwn(STATIONS,a.station)||!s||Math.hypot(p.x-s.x,p.z-s.z)>2.5||Object.values(g.players).some(q=>q.id!==id&&q.station===a.station))return false;p.station=a.station;return true;}
 if(a.type==='exit'){p.station=null;return true;}
 if(a.type==='start'&&g.host===id&&['briefing','debrief'].includes(g.phase)){
 Object.assign(g,{phase:'outbound',time:0,distance:12,altitude:3000,heading:90,targetHeading:90,bank:0,pitch:0,throttle:.7,fuel:100,hull:100,engines:[100,100],fire:0,leak:0,electric:100,oxygen:100,lock:0,bombs:true,bombScore:0,kills:0,ammo:160,threat:0,attackTime:0,repairs:0,eventIn:24,outcome:null,log:[]});
 for(const q of Object.values(g.players)){q.hp=100;q.station=null;q.move=null;q.repairAt=0;q.shotAt=0;q.callAt=0;}
 log(g,'Operation Night Lantern. Rail junction ahead. Bring her home.');return true;}
 if(['briefing','debrief'].includes(g.phase))return false;
 if(a.type==='control'&&p.station==='pilot'){
 for(const [k,min,max] of [['bank',-30,30],['pitch',-5,5],['throttle',.1,1]])if(Number.isFinite(a[k]))g[k]=clamp(a[k],min,max);return true;}
 if(a.type==='abort'&&p.station==='pilot'&&g.phase!=='return'){home(g);log(g,'Pilot has aborted the mission. Save the crew.');return true;}
 if(a.type==='bail'&&p.station==='pilot'){g.phase='debrief';g.outcome=g.altitude>=500?'BAILED OUT':'DITCHED';return true;}
 if(a.type==='repair'&&p.station==='engineer'&&g.time>=(p.repairAt||0)){
 const k=a.system;
 if(!['fire','leak','engine0','engine1','electric','oxygen'].includes(k))return false;
 if(k==='fire')g.fire=Math.max(0,g.fire-28);
 else if(k==='leak')g.leak=Math.max(0,g.leak-1.5);
 else if(k.startsWith('engine'))g.engines[+k.slice(-1)]=Math.min(85,g.engines[+k.slice(-1)]+18);
 else g[k]=Math.min(100,g[k]+25);
 p.repairAt=g.time+3;g.repairs++;return true;}
 if(a.type==='shoot'&&p.station==='gunner'&&g.time>=(p.shotAt||0)&&g.ammo>0){
 p.shotAt=g.time+.35;g.ammo--;if(g.threat>0){g.threat=Math.max(0,g.threat-14);if(!g.threat){g.kills++;log(g,'Fighter driven off. Clear six.');}}return true;}
 if(a.type==='call'&&typeof a.text==='string'){if(g.time<(p.callAt||0))return false;p.callAt=g.time+2;log(g,`${p.name}: ${a.text.slice(0,80)}`);return true;}
 if(a.type==='drop'&&p.station==='navigator'&&g.phase==='attack'&&g.bombs){g.bombScore=Math.round(clamp(g.lock/12,0,1)*100);g.bombs=false;home(g);log(g,`Bombs away. Target damage ${g.bombScore}%.`);return true;}
 if(a.type==='land'&&p.station==='pilot'&&g.phase==='return'&&g.distance<=.5&&g.altitude<=400&&g.throttle<=.5&&Math.abs(g.bank)<8){g.phase='debrief';g.outcome='LANDED';log(g,'Wheels down. Welcome home.');return true;}
 return false;
}
function log(g,text){g.log.unshift({t:Math.round(g.time),text});g.log=g.log.slice(0,8);}
function home(g){g.phase='return';g.distance=10;g.targetHeading=270;g.lock=0;}
export function tick(g,dt,random=Math.random){
 for(const p of Object.values(g.players))if(!p.station&&p.move&&g.time<(p.moveUntil||0)){
 const n=Math.max(1,Math.hypot(p.move.x,p.move.z));p.x=clamp(p.x+p.move.x/n*4*dt,-1.25,1.25);p.z=clamp(p.z+p.move.z/n*4*dt,-10.7,10);}
 if(['briefing','debrief'].includes(g.phase))return;
 g.time+=dt;
 g.fuel=Math.max(0,g.fuel-(.075*g.throttle+g.leak*.06)*dt);
 if(g.fire>0){g.hull-=g.fire*.003*dt;g.engines[0]=Math.max(0,g.engines[0]-g.fire*.006*dt);g.fire=Math.min(100,g.fire+.22*dt);}
 if(g.altitude>3500&&g.oxygen<50)for(const p of Object.values(g.players))p.hp=Math.max(10,p.hp-.2*dt);
 if(g.electric<30)g.bank=clamp(g.bank+Math.sin(g.time)*.15*dt,-30,30);
 g.eventIn-=dt;
 if(g.eventIn<=0){
 g.eventIn=28+random()*18;
 const event=Math.floor(random()*5);
 if(event===0){g.fire=Math.min(100,g.fire+28);g.engines[0]=Math.max(0,g.engines[0]-15);log(g,'Flak hit. Port engine burning!');}
 if(event===1){g.leak=Math.min(5,g.leak+1.5);log(g,'Fuel line punctured. Engineer, seal the leak.');}
 if(event===2){g.threat=100;g.threatTime=18;log(g,'Fighter closing from six o’clock. Tail gunner!');}
 if(event===3){g.electric=Math.max(0,g.electric-35);g.oxygen=Math.max(0,g.oxygen-25);log(g,'Bus fault. Electrical and oxygen systems damaged.');}
 if(event===4){const dmg=Math.abs(g.bank)>12?2:7;g.hull-=dmg;log(g,`Flak burst. Hull damage ${dmg}%. Banking reduces exposure.`);}
 }
 if(g.threat>0){g.threatTime-=dt;if(g.threatTime<=0){g.hull-=12;g.fire=Math.min(100,g.fire+16);g.threat=0;log(g,'Fighter strafed the fuselage. Fire aboard.');}}
 if(g.hull<=0||g.fuel<=0||g.engines.every(v=>v<=0)){g.phase='debrief';g.outcome=g.hull<=0?'AIRCRAFT LOST':'DITCHED';return;}
 g.heading=(g.heading+g.bank*.12*dt+360)%360;
 g.altitude=clamp(g.altitude+g.pitch*20*dt,80,6000);
 const error=Math.abs(((g.heading-g.targetHeading+540)%360)-180);
 const speed=(.04+g.throttle*.08)*(g.engines[0]+g.engines[1])/200;
 if(g.phase==='outbound'||g.phase==='return')g.distance=Math.max(0,g.distance-speed*Math.max(.12,Math.cos(error*Math.PI/180))*dt);
 if(g.phase==='outbound'&&g.distance<=1){g.phase='attack';log(g,'Target in sight. Hold heading 090, altitude 2500–3500.');}
 if(g.phase==='attack'){
 g.attackTime+=dt;
 const stable=error<8&&Math.abs(g.bank)<5&&g.altitude>2500&&g.altitude<3500;
 g.lock=clamp(g.lock+(stable?dt:-dt*2),0,12);
 if(g.attackTime>65){home(g);log(g,'Target passed. Bomb run missed. Return to base.');}
 }
}
