import {test} from 'node:test';import assert from 'node:assert/strict';import {createGame,join,act} from '../game.js';
test('malformed JSON field types cannot crash the simulation',()=>{
 const g=createGame();assert.doesNotThrow(()=>join(g,'x',{toString:null}));
 for(const a of [{type:'station',station:{toString:null}},{type:'move',x:{toString:null},z:0},{type:'move',x:0,z:{toString:null}}])assert.doesNotThrow(()=>act(g,'x',a));
});
