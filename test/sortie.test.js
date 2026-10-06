import {test} from 'node:test';import assert from 'node:assert/strict';import {createGame,join,act,tick,STATIONS,HOTSPOTS,impactPoint,aimAt} from '../game.js';import {MAP} from '../public/map.js';
// A competent bot crew flies the real mechanics: pilot steers a wind-corrected track, bombardier releases on the
// predicted impact, the tail gunner engages what it can see, the fourth crew member walks to damage and repairs it.
function headingFor(g,to){const dx=to.x-g.pos.x,dy=to.y-g.pos.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
 const along=g.wind.x*ux+g.wind.y*uy,cx=g.wind.x-along*ux,cy=g.wind.y-along*uy,a=Math.sqrt(Math.max(0,g.airspeed**2-cx*cx-cy*cy));
 return (Math.atan2(ux*a-cx,uy*a-cy)*180/Math.PI+360)%360;}
test('20 seeded sorties: a competent crew usually bombs the junction and lands',()=>{
 const results=[];
 for(let seed=1;seed<=20;seed++){
  let rng=seed;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const g=createGame();const crew={pilot:'pilot',bombardier:'bombardier',tail:'tail',fixer:null};
  for(const r of Object.keys(crew))join(g,r,r);act(g,'pilot',{type:'start'},random);let best=99;
  for(let n=0;n<12000&&g.phase!=='debrief';n++){
   for(const r of ['pilot','bombardier','tail']){const p=g.players[r],s=STATIONS[r];if(!p.station){if(Math.hypot(p.x-s.x,p.z-s.z)<.8)act(g,r,{type:'station',station:r});else act(g,r,{type:'move',x:Math.sign(s.x-p.x)*.3,z:Math.sign(s.z-p.z)});}}
   const to=g.bombs?(Math.hypot(g.pos.x-MAP.ip.x,g.pos.y-MAP.ip.y)>2&&g.pos.x<MAP.ip.x?MAP.ip:MAP.target):MAP.base,dHome=Math.hypot(g.pos.x,g.pos.y);
   const delta=((headingFor(g,to)-g.heading+540)%360)-180,lim=!g.bombs&&dHome<4?6:25;
   act(g,'pilot',{type:'control',bank:Math.max(-lim,Math.min(lim,delta*2)),pitch:!g.bombs&&dHome<16&&g.altitude>300?-5:0,throttle:!g.bombs&&dHome<5?.45:.8});
   if(!g.bombs&&dHome<7&&!g.gear&&g.players.pilot.station)act(g,'pilot',{type:'gear'});
   if(g.bombs){const v=impactPoint(g),e=Math.hypot(v.x-MAP.target.x,v.y-MAP.target.y);if(e<.15||(e>best&&best<.4))act(g,'bombardier',{type:'drop'});best=Math.min(best,e);}
   for(const f of g.fighters)if(f.state==='approach'&&act(g,'tail',{type:'shoot',...aimAt('tail',f)},random))break;
   const fx=g.players.fixer,job=g.engineFire.some(v=>v>0)?'enginefire':g.cabinFire>0?'cabinfire':g.leak>0?'leak':g.oxygen<80?'oxygen':g.electric<80?'electric':null;
   if(job){const spot=job==='cabinfire'?{x:0,z:g.cabinFireZ}:HOTSPOTS[job];if(Math.hypot(fx.x-spot.x,fx.z-spot.z)<1.2)act(g,'fixer',{type:'repair',system:job});else act(g,'fixer',{type:'move',x:Math.abs(fx.z-spot.z)<.5?Math.sign(spot.x-fx.x):0,z:Math.sign(spot.z-fx.z)});}
   tick(g,.1,random);
  }
  results.push({seed,outcome:g.outcome,min:Math.round(g.time/6)/10,hull:Math.round(g.hull),target:g.bombScore,kills:g.kills});
 }
 console.log('SIMULATED SORTIES:',JSON.stringify(results));
 const landed=results.filter(r=>r.outcome==='LANDED');
 assert.ok(landed.length>=14,`only ${landed.length}/20 landed`);assert.ok(results.filter(r=>r.target>=80).length>=16,'bomb runs on target');
 assert.ok(landed.every(r=>r.min>=6&&r.min<=20),'landed sortie length');
});
