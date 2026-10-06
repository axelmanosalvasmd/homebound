import {test} from 'node:test';import assert from 'node:assert/strict';import {createGame,join,act,tick,STATIONS} from '../game.js';
test('20 seeded complete sorties reach target, release bombs and land without state shortcuts',()=>{
 const results=[];
 for(let seed=1;seed<=20;seed++){
 let rng=seed;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 const g=createGame();const roles=Object.keys(STATIONS);for(const r of roles)join(g,r,r);act(g,'pilot',{type:'start'});
 for(let n=0;n<8000&&g.phase!=='debrief';n++){
 for(const r of roles){const p=g.players[r],s=STATIONS[r];if(!p.station){if(Math.abs(p.z-s.z)<.3)act(g,r,{type:'station',station:r});else act(g,r,{type:'move',x:0,z:Math.sign(s.z-p.z)});}}
 const delta=((g.targetHeading-g.heading+540)%360)-180;
 act(g,'pilot',{type:'control',bank:Math.max(-30,Math.min(30,delta*3)),pitch:g.phase==='return'&&g.altitude>250?-3:0,throttle:g.phase==='return'&&g.distance<.5?.4:.85});
 if(g.phase==='attack'&&g.lock>=11.9)act(g,'navigator',{type:'drop'});
 let system=g.fire>0?'fire':g.leak>0?'leak':g.engines[0]<80?'engine0':g.electric<85?'electric':g.oxygen<85?'oxygen':null;
 if(system)act(g,'engineer',{type:'repair',system});if(g.threat>0)act(g,'gunner',{type:'shoot'});
 if(g.phase==='return'&&g.distance<=.5)act(g,'pilot',{type:'land'});
 tick(g,.1,random);
 }
 assert.equal(g.outcome,'LANDED',`seed ${seed}, phase ${g.phase}, hull ${g.hull}`);assert.ok(g.bombScore>=99);
 results.push({seed,seconds:Math.round(g.time),hull:Math.round(g.hull),target:g.bombScore});
 }
 console.log('SIMULATED SORTIES:',JSON.stringify(results));
});
