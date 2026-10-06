import {test} from 'node:test';import assert from 'node:assert/strict';import {createGame,join,act,tick,HOTSPOTS,STATIONS,impactPoint,GUN,aimAt} from '../game.js';import {MAP} from '../public/map.js';
const calm=()=>.99;
function setup(){const g=createGame();join(g,'a','Ace');act(g,'a',{type:'start'},calm);return g;}
const at=(g,x,z)=>{g.players.a.x=x;g.players.a.z=z;};
test('fires and leaks are fixed by hand at their location, with a cooldown',()=>{
 const g=setup();g.engineFire[1]=50;g.leak=2;const f=g.fuel;tick(g,1,calm);assert.ok(g.hull<100);assert.ok(g.fuel<f);
 at(g,0,5);assert.equal(act(g,'a',{type:'repair',system:'enginefire'}),false,'too far away');
 at(g,HOTSPOTS.enginefire.x,HOTSPOTS.enginefire.z);assert.equal(act(g,'a',{type:'repair',system:'enginefire'}),true);assert.ok(g.engineFire[1]<45);
 assert.equal(act(g,'a',{type:'repair',system:'enginefire'}),false,'cooldown');
 tick(g,.5,calm);at(g,HOTSPOTS.leak.x,HOTSPOTS.leak.z);assert.equal(act(g,'a',{type:'repair',system:'leak'}),true);assert.ok(g.leak<2);
 for(const bad of ['__proto__','constructor',{toString:null},'hull'])assert.equal(act(g,'a',{type:'repair',system:bad}),false);
});
test('pilot controls are clamped; bombardier only gets small corrections; movement cannot teleport',()=>{
 const g=setup();assert.equal(act(g,'a',{type:'control',bank:20}),false);
 at(g,STATIONS.pilot.x,STATIONS.pilot.z);act(g,'a',{type:'station',station:'pilot'});
 assert.equal(act(g,'a',{type:'control',bank:999,pitch:NaN,throttle:2}),true);assert.equal(g.bank,30);assert.ok(Number.isFinite(g.pitch));assert.equal(g.throttle,1);
 act(g,'a',{type:'exit'});at(g,0,-10);act(g,'a',{type:'station',station:'bombardier'});act(g,'a',{type:'control',bank:-25,throttle:.1});assert.equal(g.bank,-10);assert.equal(g.throttle,1);
 act(g,'a',{type:'exit'});const z=g.players.a.z;act(g,'a',{type:'move',x:1,z:999});tick(g,.1,calm);assert.ok(Math.abs(g.players.a.z-z)<1);
});
test('guns only fire inside their arc and can shoot down a fighter',()=>{
 const g=setup();at(g,0,10);act(g,'a',{type:'station',station:'tail'});
 g.fighters.push({id:1,az:180,el:5,dist:900,hp:2,maxHp:2,hits:0,state:'approach',curve:0,passes:0,t:0});
 assert.equal(act(g,'a',{type:'shoot',az:0,el:0}),false,'tail cannot fire forward');
 assert.equal(act(g,'a',{type:'shoot',az:180,el:5},()=>.5),true);assert.equal(act(g,'a',{type:'shoot',az:180,el:5},()=>.5),false,'cooldown');
 assert.equal(g.fighters[0].hits,0,'rounds take time to arrive');
 // Rounds that meet the attacker bring it down.
 for(let i=0;i<40&&!g.kills;i++){tick(g,.125,calm);const f=g.fighters[0];if(f&&f.state!=='down')act(g,'a',{type:'shoot',...aimAt('tail',f)},()=>.5);}
 assert.equal(g.kills,1);
 const h=setup();h.electric=10;h.players.a.z=-4.7;act(h,'a',{type:'station',station:'top'});assert.equal(act(h,'a',{type:'shoot',az:90,el:30}),false,'powered turret dead without electrics');
});
test('a healthy fighter takes many hits and breaks off when badly damaged',()=>{
 const g=setup();at(g,0,10);act(g,'a',{type:'station',station:'tail'});
 g.fighters.push({id:1,az:180,el:5,dist:900,hp:12,maxHp:12,hits:0,state:'approach',curve:0,passes:0,t:0});
 for(let i=0;i<40;i++){tick(g,.125,calm);const f=g.fighters[0];if(f?.state==='approach')act(g,'a',{type:'shoot',...aimAt('tail',f)},()=>.5);}
 const f=g.fighters[0];assert.ok(f.hits>=8,'hits '+f.hits);assert.notEqual(f.state,'approach');
});
test('bullets are simulated: a crossing fighter is missed when aimed at directly and hit with lead',()=>{
 const run=lead=>{const g=setup();at(g,.6,5.25);act(g,'a',{type:'station',station:'waistR'});
  g.fighters.push({id:1,az:70,el:0,dist:1000,hp:99,maxHp:99,hits:0,state:'approach',curve:6,passes:0,t:0});
  for(let i=0;i<24;i++){const f=g.fighters[0];act(g,'a',{type:'shoot',...(lead?aimAt('waistR',f):{az:f.az,el:f.el})},()=>.5);tick(g,.125,calm);}
  for(let i=0;i<20;i++)tick(g,.125,calm);return g.fighters[0].hits;};
 assert.equal(run(false),0,'aiming straight at a crossing target misses');
 assert.ok(run(true)>=10,'leading the target hits');
});
test('bomb impact follows the predicted point; accuracy scores the strike',()=>{
 const g=setup();at(g,0,-10);act(g,'a',{type:'station',station:'bombardier'});
 const v=impactPoint(g);g.pos.x+=MAP.target.x-v.x;g.pos.y+=MAP.target.y-v.y;
 assert.equal(act(g,'a',{type:'drop'}),true);assert.equal(g.bombScore,100);assert.equal(g.phase,'return');assert.equal(act(g,'a',{type:'drop'}),false);
 const h=setup();h.players.a.z=-10;act(h,'a',{type:'station',station:'bombardier'});act(h,'a',{type:'drop'});assert.equal(h.bombScore,0,'far from the target');
});
test('landing needs gear, the home field, low and slow; bailout and fuel endings differ',()=>{
 const g=setup();at(g,STATIONS.pilot.x,STATIONS.pilot.z);act(g,'a',{type:'station',station:'pilot'});
 Object.assign(g,{time:100,pos:{x:.5,y:.5},altitude:300,throttle:.4,bank:0});tick(g,.1,calm);assert.equal(g.phase,'outbound','gear still up');
 act(g,'a',{type:'gear'});tick(g,.1,calm);assert.equal(g.outcome,'LANDED');
 const b=setup();b.players.a.z=-6.3;b.players.a.x=-.45;act(b,'a',{type:'station',station:'pilot'});assert.equal(act(b,'a',{type:'bail'}),true);assert.equal(b.outcome,'BAILED OUT');
 const s=setup();s.pos={x:14,y:0};s.fuel=0;tick(s,1,calm);assert.equal(s.outcome,'DITCHED');
});
test('walkable width follows the fuselage: bomb-bay catwalk is narrow',()=>{
 const g=setup();const p=g.players.a;p.z=-2.5;p.x=0;act(g,'a',{type:'move',x:1,z:0});tick(g,.5,calm);assert.ok(p.x<=.1);
 p.z=4;act(g,'a',{type:'move',x:1,z:0});tick(g,.5,calm);assert.ok(p.x>.5);
});
test('navigator marks the chart; unknown stations are rejected',()=>{
 const g=setup();at(g,-.45,-8.6);assert.equal(act(g,'a',{type:'station',station:'navigator'}),true);
 for(let i=0;i<15;i++)act(g,'a',{type:'mark',x:i,y:999});assert.equal(g.marks.length,12);assert.equal(g.marks[0].y,MAP.bounds.y1);
 act(g,'a',{type:'exit'});assert.equal(act(g,'a',{type:'station',station:'__proto__'}),false);
});
