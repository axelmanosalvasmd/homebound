import {test} from 'node:test';import assert from 'node:assert/strict';import {WebSocket} from 'ws';import {spawn} from 'node:child_process';
const port=18790;let proc;
async function connect(room){const w=new WebSocket(`ws://127.0.0.1:${port}`);await new Promise((r,j)=>{w.once('open',r);w.once('error',j)});w.send(JSON.stringify({type:'join',room,name:'Test'}));const m=await new Promise(r=>w.once('message',x=>r(JSON.parse(x))));return {w,m};}
test('server hosts only public assets and synchronizes isolated four-player rooms',async()=>{
 proc=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'pipe'});
 const ready=await new Promise(r=>{proc.stdout.once('data',()=>r(true));proc.once('exit',()=>r(false));setTimeout(()=>r(false),4000).unref()});assert.equal(ready,true,'server is ready');
 const peers=[];try{
 assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status,200);
 assert.equal((await fetch(`http://127.0.0.1:${port}/game.js`)).status,404);
 for(let i=0;i<4;i++){const c=await connect(i===0?'':peers[0].m.room);peers.push(c);assert.equal(c.m.type,'welcome');}
 const full=await connect(peers[0].m.room);peers.push(full);assert.equal(full.m.type,'error');
 const other=await connect('');peers.push(other);assert.notEqual(other.m.room,peers[0].m.room);
 peers[0].w.send(JSON.stringify({type:'start'}));
 const state=await new Promise(r=>{peers[1].w.on('message',raw=>{const x=JSON.parse(raw);if(x.type==='state'&&x.game.phase==='outbound')r(x)});setTimeout(()=>r(null),3000).unref()});
 assert.ok(state);assert.equal(Object.keys(state.game.players).length,4);
 assert.equal((await connect('NOPE12')).m.type,'error');
 assert.equal((await connect({toString:null})).m.type,'error');
 peers[0].w.send(JSON.stringify({type:'station',station:{toString:null}}));
 peers[0].w.send(JSON.stringify({type:'move',x:{toString:null},z:0}));
 await new Promise(r=>setTimeout(r,150));assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status,200);
 }finally{for(const p of peers)p.w.close();proc.kill();}
});
