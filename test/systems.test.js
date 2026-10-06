import {test} from 'node:test';import assert from 'node:assert/strict';import {createGame,join,act,tick} from '../game.js';
function setup(){const g=createGame();join(g,'a','Ace');act(g,'a',{type:'start'});return g;}
test('damage cascades; engineer extinguishes, repairs and seals with cooldown',()=>{
 const g=setup();g.fire=50;g.leak=2;const f=g.fuel;tick(g,1,()=>.99);assert.ok(g.hull<100);assert.ok(g.fuel<f);
 g.players.a.z=1;act(g,'a',{type:'station',station:'engineer'});
 assert.equal(act(g,'a',{type:'repair',system:'fire'}),true);assert.ok(g.fire<40);
 assert.equal(act(g,'a',{type:'repair',system:'fire'}),false);
 tick(g,4,()=>.99);assert.equal(act(g,'a',{type:'repair',system:'leak'}),true);assert.ok(g.leak<2);
});
test('controls require station, sanitize numbers, and movement cannot teleport',()=>{
 const g=setup();assert.equal(act(g,'a',{type:'control',bank:20}),false);
 g.players.a.z=-10;act(g,'a',{type:'station',station:'pilot'});
 assert.equal(act(g,'a',{type:'control',bank:999,pitch:NaN,throttle:2}),true);
 assert.equal(g.bank,30);assert.ok(Number.isFinite(g.pitch));assert.equal(g.throttle,1);
 act(g,'a',{type:'exit'});const z=g.players.a.z;
 act(g,'a',{type:'move',x:1,z:999});tick(g,.1,()=>.99);assert.ok(Math.abs(g.players.a.z-z)<1);
});
test('gunner has a fire cooldown and can eliminate approaching fighters',()=>{
 const g=setup();g.players.a.z=9;act(g,'a',{type:'station',station:'gunner'});g.threat=40;
 assert.equal(act(g,'a',{type:'shoot'}),true);assert.equal(act(g,'a',{type:'shoot'}),false);
 for(let i=0;i<3;i++){tick(g,1,()=>.99);act(g,'a',{type:'shoot'});}assert.equal(g.kills,1);
});
test('new sortie resets per-player cooldowns; unknown stations are rejected',()=>{
 const g=setup();g.time=120;g.players.a.z=1;act(g,'a',{type:'station',station:'engineer'});act(g,'a',{type:'repair',system:'fire'});g.phase='debrief';
 act(g,'a',{type:'start'});g.players.a.z=1;act(g,'a',{type:'station',station:'engineer'});
 assert.equal(act(g,'a',{type:'repair',system:'fire'}),true);
 act(g,'a',{type:'exit'});assert.equal(act(g,'a',{type:'station',station:'__proto__'}),false);
});
test('abort, bailout and fuel exhaustion produce different endings',()=>{
 const g=setup();g.players.a.z=-10;act(g,'a',{type:'station',station:'pilot'});
 assert.equal(act(g,'a',{type:'abort'}),true);assert.equal(g.phase,'return');
 assert.equal(act(g,'a',{type:'bail'}),true);assert.equal(g.outcome,'BAILED OUT');
 const h=setup();h.fuel=0;tick(h,1,()=>.99);assert.equal(h.outcome,'DITCHED');
});
