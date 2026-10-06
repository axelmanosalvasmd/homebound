import {test} from 'node:test';import assert from 'node:assert/strict';import * as game from '../game.js';
test('crew joins with a four-person cap and exclusive nearby stations',()=>{
 const g=game.createGame();for(let i=0;i<4;i++)assert.ok(game.join(g,'p'+i,'Crew '+i));assert.equal(game.join(g,'p4','Fifth'),false);
 for(const id of ['p0','p1'])Object.assign(g.players[id],{x:-.45,z:-6.3});
 assert.equal(game.act(g,'p0',{type:'station',station:'pilot'}),true);assert.equal(game.act(g,'p1',{type:'station',station:'pilot'}),false);
 assert.equal(game.act(g,'p2',{type:'station',station:'tail'}),false,'too far from the tail');
 for(const id of ['p2','p3'])Object.assign(g.players[id],{x:0,z:-10.1});assert.equal(game.act(g,'p2',{type:'station',station:'bombardier'}),true);
 assert.equal(game.act(g,'p3',{type:'station',station:'chin'}),false,'chin and bombsight share one seat');assert.equal(game.act(g,'p2',{type:'station',station:'chin'}),true,'bombardier swaps to the chin turret');
 game.leave(g,'p0');assert.equal(game.act(g,'p1',{type:'station',station:'pilot'}),true);
});
test('fighters attack from any side and come round again',()=>{
 const g=game.createGame();game.join(g,'a','A');game.act(g,'a',{type:'start'});g.pos={x:30,y:-6};g.nextFighter=0;
 let rng=3;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 const seen=new Set();for(let i=0;i<3000&&g.phase!=='debrief';i++){for(const f of g.fighters)seen.add(game.clock(f.az));g.hull=100;g.engineFire=[0,0,0,0];g.cabinFire=0;game.tick(g,.1,random);}
 assert.ok(seen.size>=5,'attacks from several clock positions: '+[...seen]);
});
