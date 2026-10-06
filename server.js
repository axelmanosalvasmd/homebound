import http from 'node:http';import {readFile} from 'node:fs/promises';import {randomBytes,randomUUID} from 'node:crypto';import {WebSocketServer,WebSocket} from 'ws';import {createGame,join,leave,act,tick,STATIONS,HOTSPOTS} from './game.js';
const rooms=new Map(),clients=new Map();
const assets={'/':['public/index.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/style.css':['public/style.css','text/css'],'/map.js':['public/map.js','text/javascript'],'/three.js':['node_modules/three/build/three.module.js','text/javascript'],'/three.core.js':['node_modules/three/build/three.core.js','text/javascript']};
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return;}
 const asset=assets[path];if(!asset){res.writeHead(404);res.end('Not found');return;}
 try{const body=await readFile(new URL(asset[0],import.meta.url));res.writeHead(200,{'Content-Type':asset[1],'Cache-Control':'no-cache'});res.end(body);}catch{res.writeHead(503);res.end('Preview building');}
});
const wss=new WebSocketServer({server,maxPayload:2048});
function send(w,obj){if(w.readyState===WebSocket.OPEN&&w.bufferedAmount<200000)w.send(JSON.stringify(obj));}
wss.on('connection',(ws,req)=>{
 // Deny browser cross-origin sockets. Direct clients allowed for testing.
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){ws.close(1008,'Origin mismatch');return;}}catch{ws.close();return;}}
 if(wss.clients.size>160){ws.close(1013);return;}
 let count=0,windowStart=Date.now();ws.alive=true;ws.on('pong',()=>ws.alive=true);
 const joinTimer=setTimeout(()=>{if(!clients.has(ws))ws.close();},10000);
 ws.on('message',raw=>{
 if(Date.now()-windowStart>1000){count=0;windowStart=Date.now();}if(++count>45){ws.close(1008,'Rate limit');return;}
 let a;try{a=JSON.parse(raw);}catch{return;}if(!a||typeof a!=='object')return;
 if(a.type==='join'&&!clients.has(ws)){
 if(a.room!==undefined&&typeof a.room!=='string'){send(ws,{type:'error',message:'Invalid room code.'});ws.close();return;}let code=(a.room||'').toUpperCase().trim();let g;
 if(!code){if(rooms.size>=40){send(ws,{type:'error',message:'All hangars occupied.'});ws.close();return;}do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));g=createGame();rooms.set(code,g);}
 else{g=rooms.get(code);if(!g){send(ws,{type:'error',message:'Room not found. Ask your crew for a new invite.'});ws.close();return;}}
 const id=randomUUID();if(!join(g,id,a.name)){send(ws,{type:'error',message:'Crew full. Four seats only.'});ws.close();return;}
 clearTimeout(joinTimer);clients.set(ws,{code,id});send(ws,{type:'welcome',room:code,id,stations:STATIONS,hotspots:HOTSPOTS});send(ws,{type:'state',game:g});return;
 }
 const c=clients.get(ws);if(!c)return;const g=rooms.get(c.code);if(!g)return;
 if(!act(g,c.id,a)&&!['move','control','shoot','repair','mark'].includes(a.type))send(ws,{type:'notice',message:'Action unavailable. Check station, distance, or mission conditions.'});
 });
 ws.on('close',()=>{clearTimeout(joinTimer);const c=clients.get(ws);if(c){const g=rooms.get(c.code);if(g){leave(g,c.id);if(!Object.keys(g.players).length)rooms.delete(c.code);}clients.delete(ws);}});
 ws.on('error',()=>{});
});
setInterval(()=>{for(const g of rooms.values())tick(g,.1);for(const [w,c]of clients)send(w,{type:'state',game:rooms.get(c.code)});},100);
setInterval(()=>{for(const w of wss.clients){if(!w.alive){w.terminate();continue;}w.alive=false;w.ping();}},30000).unref();
server.listen(Number(process.env.PORT||8790),process.env.HOST||'127.0.0.1',()=>console.log(`HOMEBOUND listening on ${process.env.HOST||'127.0.0.1'}:${process.env.PORT||8790}`));
