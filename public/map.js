// Shared mission geography, used by the server simulation and by the client terrain and chart.
// Units are kilometres; x runs east, y runs north. The home airfield is the origin.
export const MAP={
 bounds:{x0:-15,x1:85,y0:-50,y1:50},
 base:{name:'Station 121 · Ashby Green',x:0,y:0},
 target:{name:'Hammfeld marshalling yard',x:72,y:10},
 ip:{name:'Weselburg (IP)',x:52.5,y:13.5},
 forecastWind:{from:290,kmh:55},
 englishCoast:[[9,-50],[10,-38],[8.5,-26],[11,-14],[10,-4],[12,2],[11,12],[9,22],[10.5,34],[9.5,50]],
 enemyCoast:[[25,-50],[23.5,-36],[25,-24],[22.5,-12],[24,-4],[23,6],[25.5,16],[24,24],[26,36],[25,50]],
 // The Reich border, drawn on the chart only. You cannot see it from the air.
 border:[[47,-50],[45,-36],[48,-22],[46.5,-10],[48.5,0],[46,12],[48,24],[45.5,36],[47,50]],
 rivers:[
  {name:'Rhein',width:.55,pts:[[85,-48],[78,-36],[71,-24],[65,-13],[60,-5],[56.5,2],[54,9],[52.5,13.5],[48,19],[41,22],[33,21],[27,19],[25,18]]},
  {name:'Lippa',width:.2,pts:[[85,12],[78,13],[72.5,11.2],[66,12.5],[60,14.5],[52.5,13.5]]},
  {name:'Emmer',width:.2,pts:[[85,-10],[77,-7],[70,-8.5],[64,-6],[60,-5]]},
  {name:'Schelde',width:.7,pts:[[23,-7],[27,-9],[31,-12],[35,-13],[40,-17]]},
  {name:'Wen',width:.15,pts:[[-15,6],[-10,4],[-4,2],[3,4],[9,6],[11,6.5]]},
 ],
 lakes:[{name:'Talsperre Arnstein',x:74,y:-28,rx:2.2,ry:.6,rot:-.3}],
 forests:[
  {name:'Sauerwald',pts:[[62,-46],[70,-48],[80,-44],[84,-34],[80,-22],[72,-20],[66,-30]]},
  {name:'Hohe Heide',pts:[[58,22],[64,20],[70,23],[69,30],[61,31],[57,27]]},
  {name:'Kempener Heide',pts:[[38,-30],[43,-31],[44,-25],[39,-23]]},
  {name:'Hatchley Wood',pts:[[-11,-14],[-6,-15],[-4,-11],[-8,-8],[-12,-10]]},
 ],
 towns:[
  {name:'Ashby Green',x:3,y:-3,r:.6},{name:'Norwell',x:-9,y:9,r:1.2},{name:'Saltmarsh',x:8,y:-14,r:.8},
  {name:'Vlissing',x:24.5,y:-5.5,r:1.3},{name:'Bergwijk',x:32,y:-2,r:.9},{name:'Rozendam',x:38,y:9,r:.9},{name:'Venhoven',x:44,y:-6,r:1},
  {name:'Essenburg',x:58,y:-3,r:2.4},{name:'Recklingen',x:63,y:3,r:1},{name:'Weselburg',x:53.5,y:12,r:1},{name:'Dorstheim',x:61,y:16,r:.8},
  {name:'Hammfeld',x:73.5,y:9.6,r:1.8},{name:'Lindenau',x:70,y:-9.5,r:1.3},{name:'Ahlenbeck',x:81,y:17,r:.8},{name:'Arnstein',x:77,y:-26.5,r:.6},
 ],
 // Hammfeld is the real target; Lindenau, 20 km south on the Emmer, is a similar yard that catches crews who drift.
 yards:[{x:72,y:10,ang:-.18,len:3,n:14},{x:70.4,y:-8.6,ang:.25,len:1.6,n:8}],
 rails:[
  [[72,10],[66,12.8],[60,14.8],[52.5,13.5],[45,16],[38,9]],[[72,10],[78,22],[85,30]],[[72,10],[85,8]],[[72,10],[66,3],[63,3],[58,-3]],
  [[70.4,-8.6],[64,-5],[58,-3]],[[70.4,-8.6],[78,-12],[85,-13]],[[70.4,-8.6],[76,-20],[85,-32]],
  [[58,-3],[50,-5],[44,-6],[32,-2],[24.5,-5.5]],[[38,9],[32,-2]],
  [[-15,-2],[3,-3],[10,-4]],
 ],
 roads:[[[52,-40],[60,-14],[66,-2],[72,4],[80,24],[85,34]],[[24.5,-5.5],[38,9],[53.5,12]],[[44,-6],[58,-3],[70,-9.5]],[[61,16],[73.5,9.6],[81,17]],[[-9,9],[3,-3],[8,-14]]],
 flak:[{name:'Hammfeld',x:72.5,y:10,r:5,strength:1},{name:'Essenburg',x:58,y:-3,r:6,strength:.9},{name:'Vlissing',x:24.5,y:-5.5,r:3,strength:.6},{name:'Lindenau',x:70.4,y:-8.6,r:3,strength:.5},{name:'Weselburg',x:53.5,y:12,r:2.2,strength:.4}],
};
// Linear interpolation of a north-south coastline at latitude y.
export function coastX(line,y){for(let i=0;i<line.length-1;i++){const [x0,y0]=line[i],[x1,y1]=line[i+1];if(y>=y0&&y<=y1)return x0+(x1-x0)*(y-y0)/(y1-y0);}return line[y<line[0][1]?0:line.length-1][0];}
export const overEnemy=(x,y)=>x>coastX(MAP.enemyCoast,y);
export const overSea=(x,y)=>x>coastX(MAP.englishCoast,y)&&!overEnemy(x,y);

// Chart / terrain projection. u,v are 0..1 across the sheet, v=0 is the north edge.
const B=MAP.bounds,SPAN_X=B.x1-B.x0,SPAN_Y=B.y1-B.y0;
export const kmToChart=(x,y)=>[(x-B.x0)/SPAN_X,(B.y1-y)/SPAN_Y];
export const chartToKm=(u,v)=>[B.x0+u*SPAN_X,B.y1-v*SPAN_Y];
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// Midpoint displacement for natural coastlines, Chaikin smoothing for rivers. Both are deterministic.
function fractal(pts,depth,amp,r){let out=pts;for(let d=0;d<depth;d++){const next=[out[0]];for(let i=1;i<out.length;i++){const [ax,ay]=out[i-1],[bx,by]=out[i];const len=Math.hypot(bx-ax,by-ay)||1,k=(r()-.5)*amp*len;next.push([(ax+bx)/2+(ay-by)/len*k,(ay+by)/2+(bx-ax)/len*k],[bx,by]);}out=next;amp*=.62;}return out;}
function chaikin(pts,n){let out=pts;for(let k=0;k<n;k++){const next=[out[0]];for(let i=0;i<out.length-1;i++){const [ax,ay]=out[i],[bx,by]=out[i+1];next.push([ax*.75+bx*.25,ay*.75+by*.25],[ax*.25+bx*.75,ay*.25+by*.75]);}next.push(out[out.length-1]);out=next;}return out;}
let geoCache;
function geo(){if(geoCache)return geoCache;const r=rng(1944);
 const eng=fractal(MAP.englishCoast,6,.55,r),enemy=fractal(MAP.enemyCoast,6,.55,r);
 const rivers=MAP.rivers.map(v=>({...v,pts:chaikin(fractal(v.pts,2,.25,r),3)}));
 const forests=MAP.forests.map(f=>({...f,pts:chaikin(fractal([...f.pts,f.pts[0]],2,.35,r),2)}));
 return geoCache={eng,enemy,rivers,forests,sea:[...eng,...[...enemy].reverse()],
  england:[[B.x0,B.y0-1],...eng,[B.x0,B.y1+1]],continent:[[B.x1,B.y0-1],...enemy,[B.x1,B.y1+1]]};}
function inPoly(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
// Instancing points in km: 'house' clusters toward town centres, 'tree' fills forest polygons.
export function scatter(kind,count,seed=7){const r=rng(seed),out=[],g=geo();
 if(kind==='house'){const total=MAP.towns.reduce((s,t)=>s+t.r*t.r,0);for(let i=0;i<count;i++){let pick=r()*total,t=MAP.towns[0];for(const c of MAP.towns){pick-=c.r*c.r;if(pick<=0){t=c;break;}}const a=r()*Math.PI*2,d=t.r*Math.pow(r(),1.5);out.push([t.x+Math.cos(a)*d,t.y+Math.sin(a)*d]);}return out;}
 if(kind==='tree'){const boxes=g.forests.map(f=>{const xs=f.pts.map(p=>p[0]),ys=f.pts.map(p=>p[1]);return {f,x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};});const total=boxes.reduce((s,b)=>s+(b.x1-b.x0)*(b.y1-b.y0),0);
  for(let tries=0;out.length<count&&tries<count*20;tries++){let pick=r()*total,b=boxes[0];for(const c of boxes){pick-=(c.x1-c.x0)*(c.y1-c.y0);if(pick<=0){b=c;break;}}const x=b.x0+r()*(b.x1-b.x0),y=b.y0+r()*(b.y1-b.y0);if(inPoly(x,y,b.f.pts))out.push([x,y]);}}
 return out;}
const course=(a,b)=>(Math.atan2(b.x-a.x,b.y-a.y)*180/Math.PI+360)%360;
function painter(ctx,w,h){const s=w/SPAN_X;const X=x=>(x-B.x0)*s,Y=y=>(B.y1-y)*(h/SPAN_Y);
 const trace=pts=>pts.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));
 const path=(pts,close)=>{ctx.beginPath();trace(pts);if(close)ctx.closePath();};
 const clipLand=()=>{const g=geo();ctx.save();ctx.beginPath();trace(g.england);ctx.closePath();trace(g.continent);ctx.closePath();ctx.clip();};
 return {s,X,Y,path,clipLand};}

export function drawChart(ctx,w,h){const {s,X,Y,path,clipLand}=painter(ctx,w,h),g=geo(),r=rng(7),f=w/2048;
 const label=(text,x,y,font,color,align='center',angle=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.font=font;ctx.textAlign=align;ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=5*f;ctx.strokeStyle='rgba(240,229,200,.9)';ctx.strokeText(text,0,0);ctx.fillStyle=color;ctx.fillText(text,0,0);ctx.restore();};
 const serif=(px,style='')=>`${style} ${px*f}px Georgia,'Times New Roman',serif`,mono=px=>`${px*f}px 'Courier New',monospace`;
 ctx.lineCap=ctx.lineJoin='round';
 // Sea with waterlining parallel to both coasts, then buff land on top.
 ctx.fillStyle='#c6d8d3';ctx.fillRect(0,0,w,h);
 for(let i=14;i>=1;i--)for(const line of [g.eng,g.enemy]){path(line);ctx.lineWidth=i*9*f;ctx.strokeStyle=`rgba(62,104,120,${.42-i*.024})`;ctx.stroke();ctx.lineWidth=i*9*f-1.4*f;ctx.strokeStyle='#c6d8d3';ctx.stroke();}
 for(const land of [g.england,g.continent]){path(land,true);ctx.fillStyle='#ecdfba';ctx.fill();}
 for(const line of [g.eng,g.enemy]){path(line);ctx.lineWidth=2.2*f;ctx.strokeStyle='#355e6c';ctx.stroke();}
 // Form lines suggesting relief.
 for(const [cx,cy,rx,ry] of [[74,-36,8,6],[65,26,5,3.5],[-8,28,5,3.5],[82,-14,3,4.5]])for(let k=1;k<=4;k++){ctx.beginPath();for(let a=0;a<=64;a++){const t=a/64*Math.PI*2,wob=1+Math.sin(t*3+k)*.08+Math.sin(t*5)*.05;const px=cx+Math.cos(t)*rx*k/4*wob,py=cy+Math.sin(t)*ry*k/4*wob;a?ctx.lineTo(X(px),Y(py)):ctx.moveTo(X(px),Y(py));}ctx.strokeStyle='rgba(150,105,60,.32)';ctx.lineWidth=1.2*f;ctx.stroke();}
 // Forests: pale green wash with stippled tree symbols.
 for(const fo of g.forests){ctx.save();path(fo.pts,true);ctx.fillStyle='rgba(150,175,120,.55)';ctx.fill();ctx.clip();ctx.fillStyle='rgba(70,100,55,.75)';ctx.beginPath();const xs=fo.pts.map(p=>p[0]),ys=fo.pts.map(p=>p[1]);for(let x=Math.min(...xs);x<Math.max(...xs);x+=.32)for(let y=Math.min(...ys);y<Math.max(...ys);y+=.32){const px=X(x+(r()-.5)*.2),py=Y(y+(r()-.5)*.2);ctx.moveTo(px+2.2*f,py);ctx.arc(px,py,2.2*f,0,7);}ctx.fill();ctx.restore();
  const cx=fo.pts.reduce((a,p)=>a+p[0],0)/fo.pts.length,cy=fo.pts.reduce((a,p)=>a+p[1],0)/fo.pts.length;label(fo.name,X(cx),Y(cy),serif(17,'italic'),'#3e5a32');}
 for(const l of MAP.lakes){ctx.save();ctx.translate(X(l.x),Y(l.y));ctx.rotate(-l.rot);for(let k=4;k>=0;k--){ctx.beginPath();ctx.ellipse(0,0,l.rx*s+k*5*f,l.ry*s+k*5*f,0,0,7);ctx.fillStyle=k?`rgba(62,104,120,${.25-k*.05})`:'#b4cfd0';ctx.fill();}ctx.strokeStyle='#355e6c';ctx.lineWidth=1.8*f;ctx.stroke();ctx.restore();label(l.name,X(l.x),Y(l.y-l.ry-1),serif(18,'italic'),'#2f5a6e');}
 for(const v of g.rivers){path(v.pts);ctx.strokeStyle='#3f7590';ctx.lineWidth=Math.max(2.4,v.width*s*.5)*f+1;ctx.stroke();
  const i=Math.floor(v.pts.length*({Lanne:.8,Morelle:.62,Wen:.3}[v.name]??.5)),[ax,ay]=v.pts[i],[bx,by]=v.pts[i+6]||v.pts[i+1];let ang=Math.atan2(Y(by)-Y(ay),X(bx)-X(ax));if(Math.abs(ang)>Math.PI/2)ang+=Math.PI;label(`R. ${v.name}`,X(ax),Y(ay)-14*f,serif(19,'italic'),'#2f5a6e','center',ang);}
 for(const road of MAP.roads){path(road);ctx.strokeStyle='#a0703f';ctx.lineWidth=2*f;ctx.stroke();}
 // Reich border: dash-dot boundary with a lettered band, as on period charts.
 path(MAP.border);ctx.setLineDash([18*f,6*f,3*f,6*f]);ctx.strokeStyle='rgba(120,40,90,.75)';ctx.lineWidth=3*f;ctx.stroke();ctx.setLineDash([]);
 {const [bx,by]=MAP.border[Math.floor(MAP.border.length/2)];label('DEUTSCHES REICH',X(bx+1.2),Y(by-9),serif(22,'bold'),'rgba(120,40,90,.85)','left',-Math.PI/2.15);label('NETHERLANDS (occupied)',X(bx-1.2),Y(by-9),serif(18,'italic'),'rgba(120,40,90,.7)','right',-Math.PI/2.15);}
 clipLand();for(const rail of MAP.rails){path(rail);ctx.strokeStyle='#1d1b17';ctx.lineWidth=6*f;ctx.stroke();ctx.strokeStyle='#f3ead0';ctx.lineWidth=3.4*f;ctx.stroke();ctx.setLineDash([11*f,11*f]);ctx.strokeStyle='#1d1b17';ctx.stroke();ctx.setLineDash([]);}ctx.restore();
 for(const t of MAP.towns){const n=Math.round(6+t.r*t.r*10);for(let i=0;i<n;i++){const a=r()*Math.PI*2,d=t.r*.75*Math.sqrt(r());const px=X(t.x+Math.cos(a)*d),py=Y(t.y+Math.sin(a)*d),bw=(5+r()*9)*f,bh=(4+r()*7)*f;ctx.fillStyle='#9b2f22';ctx.fillRect(px-bw/2,py-bh/2,bw,bh);ctx.strokeStyle='#2a1a14';ctx.lineWidth=f;ctx.strokeRect(px-bw/2,py-bh/2,bw,bh);}
  label(t.name,X(t.x+t.r+.4),Y(t.y),serif(t.r>1.2?24:19),'#1f1a14','left');}
 // Home airfield: three runways in the standard A pattern.
 {const bx=X(MAP.base.x),by=Y(MAP.base.y),L=1.1*s;ctx.strokeStyle='#5a2a5e';ctx.lineWidth=4*f;for(const a of [0,Math.PI/3,-Math.PI/3]){ctx.beginPath();ctx.moveTo(bx-Math.sin(a)*L,by-Math.cos(a)*L);ctx.lineTo(bx+Math.sin(a)*L,by+Math.cos(a)*L);ctx.stroke();}ctx.beginPath();ctx.arc(bx,by,L*1.25,0,7);ctx.lineWidth=1.6*f;ctx.stroke();label('STATION 121',bx,by+L*1.25+16*f,serif(17,'bold'),'#5a2a5e');label('Ashby Green A/F',bx,by+L*1.25+36*f,serif(15,'italic'),'#5a2a5e');}
 for(const z of MAP.flak){ctx.beginPath();ctx.arc(X(z.x),Y(z.y),z.r*s,0,7);ctx.fillStyle='rgba(190,40,30,.07)';ctx.fill();ctx.setLineDash([14*f,9*f]);ctx.strokeStyle='rgba(175,35,25,.85)';ctx.lineWidth=2.6*f;ctx.stroke();ctx.setLineDash([]);label('FLAK',X(z.x),Y(z.y+z.r)-12*f,serif(18,'bold'),'#a82a1e');}
 // 10 km grid with lettered columns and numbered rows.
 ctx.strokeStyle='rgba(40,60,90,.28)';ctx.lineWidth=1.2*f;for(let x=B.x0+10;x<B.x1;x+=10){ctx.beginPath();ctx.moveTo(X(x),0);ctx.lineTo(X(x),h);ctx.stroke();}for(let y=B.y0+10;y<B.y1;y+=10){ctx.beginPath();ctx.moveTo(0,Y(y));ctx.lineTo(w,Y(y));ctx.stroke();}
 for(let i=0;i<SPAN_X/10;i++)for(const y of [26*f,h-26*f])label('ABCDEFGHJK'[i],X(B.x0+i*10+5),y,serif(20,'bold'),'#2c3a52');
 for(let i=0;i<SPAN_Y/10;i++)for(const x of [26*f,w-26*f])label(String(i+1),x,Y(B.y1-i*10-5),serif(20,'bold'),'#2c3a52');
 // Briefed route in pencil: base, IP, target, with true course and distance on each leg.
 const legs=[MAP.base,MAP.ip,MAP.target];ctx.setLineDash([16*f,10*f]);ctx.strokeStyle='rgba(60,60,64,.8)';ctx.lineWidth=2.6*f;path(legs.map(p=>[p.x,p.y]));ctx.stroke();ctx.setLineDash([]);
 for(let i=0;i<legs.length-1;i++){const a=legs[i],b=legs[i+1];let ang=Math.atan2(Y(b.y)-Y(a.y),X(b.x)-X(a.x));if(Math.abs(ang)>Math.PI/2)ang+=Math.PI;label(`${String(Math.round(course(a,b))).padStart(3,'0')}°T · ${Math.hypot(b.x-a.x,b.y-a.y).toFixed(1)} km`,X((a.x+b.x)/2),Y((a.y+b.y)/2)-18*f,mono(19),'#3a3a3e','center',ang);}
 {const p=MAP.ip;ctx.beginPath();ctx.arc(X(p.x),Y(p.y),12*f,0,7);ctx.strokeStyle='#3a3a3e';ctx.lineWidth=2*f;ctx.stroke();label('IP',X(p.x)-30*f,Y(p.y)-6*f,serif(20,'bold'),'#3a3a3e');}
 {const t=MAP.target,tx=X(t.x),ty=Y(t.y);ctx.strokeStyle='#b8261b';ctx.lineWidth=3.4*f;for(const rad of [22,32]){ctx.beginPath();ctx.arc(tx,ty,rad*f,0,7);ctx.stroke();}ctx.beginPath();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ctx.moveTo(tx+dx*36*f,ty+dy*36*f);ctx.lineTo(tx+dx*50*f,ty+dy*50*f);}ctx.stroke();label('TARGET',tx,ty-64*f,serif(24,'bold'),'#b8261b');label(t.name,tx,ty-88*f,serif(16,'italic'),'#b8261b');}
 // Compass rose with magnetic variation.
 {const cx=X(-10),cy=Y(-28),R=4.6*s;ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='#2c3a52';ctx.fillStyle='#2c3a52';for(const rr of [R,R*.93,R*.62]){ctx.beginPath();ctx.arc(0,0,rr,0,7);ctx.lineWidth=(rr===R?1.8:1)*f;ctx.stroke();}
  for(let d=0;d<360;d+=5){const t=d*Math.PI/180,l=d%30?R*.04:R*.08;ctx.beginPath();ctx.moveTo(Math.sin(t)*R,-Math.cos(t)*R);ctx.lineTo(Math.sin(t)*(R-l),-Math.cos(t)*(R-l));ctx.lineWidth=f;ctx.stroke();if(!(d%30)&&d){ctx.save();ctx.rotate(t);ctx.font=mono(15);ctx.textAlign='center';ctx.fillStyle='#2c3a52';ctx.fillText(String(d).padStart(3,'0'),0,-R*.84);ctx.restore();}}
  for(let i=0;i<8;i++){const t=i*Math.PI/4,len=i%2?R*.42:R*.78;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.sin(t)*len,-Math.cos(t)*len);ctx.lineTo(Math.sin(t+side*.16)*R*.14,-Math.cos(t+side*.16)*R*.14);ctx.closePath();ctx.fillStyle=side<0?'#2c3a52':'#efe3c4';ctx.fill();ctx.lineWidth=f;ctx.stroke();}}
  ctx.font=serif(26,'bold');ctx.textAlign='center';ctx.fillStyle='#2c3a52';ctx.fillText('N',0,-R*1.08);
  ctx.rotate(-10*Math.PI/180);ctx.strokeStyle='#7a2a20';ctx.lineWidth=2*f;ctx.beginPath();ctx.moveTo(0,R*.2);ctx.lineTo(0,-R*1.22);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-R*1.22);ctx.lineTo(-9*f,-R*1.1);ctx.lineTo(0,-R*1.14);ctx.closePath();ctx.fillStyle='#7a2a20';ctx.fill();ctx.restore();
  label('MAG',cx+Math.sin(-.17)*R*1.3,cy-Math.cos(-.17)*R*1.3,serif(14,'bold'),'#7a2a20');label('VAR. 10° W (1944)',cx,cy+R+22*f,serif(15,'italic'),'#7a2a20');}
 // Title cartouche.
 {const x0=X(-18.5),y0=Y(38.8),cw=X(5)-x0,chh=Y(31.6)-y0;ctx.fillStyle='rgba(246,238,214,.95)';ctx.fillRect(x0,y0,cw,chh);ctx.strokeStyle='#2a2620';ctx.lineWidth=3*f;ctx.strokeRect(x0,y0,cw,chh);ctx.lineWidth=f;ctx.strokeRect(x0+7*f,y0+7*f,cw-14*f,chh-14*f);
  ctx.fillStyle='#2a2620';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=serif(34,'bold');ctx.fillText('OPERATION NIGHT LANTERN',x0+cw/2,y0+chh*.3);ctx.font=serif(20);ctx.fillText('TARGET CHART  ·  SHEET 7',x0+cw/2,y0+chh*.56);ctx.font=serif(13,'italic');ctx.fillText('Kilometre grid · True courses · Restricted: do not carry over enemy territory',x0+cw/2,y0+chh*.78);}
 // Scale bar and forecast wind.
 {const x0=X(37),y0=Y(-35.5);for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#f3ead0':'#2a2620';ctx.fillRect(x0+i*5*s,y0,5*s,8*f);}ctx.strokeStyle='#2a2620';ctx.lineWidth=f;ctx.strokeRect(x0,y0,20*s,8*f);for(let i=0;i<=4;i++)label(String(i*5),x0+i*5*s,y0+22*f,mono(15),'#2a2620');label('KILOMETRES',x0+10*s,y0+42*f,serif(14,'bold'),'#2a2620');}
 {const wd=MAP.forecastWind,cx=X(49.5),cy=Y(-29);label('FORECAST WIND 10,000 FT',cx,cy-30*f,serif(15,'bold'),'#2a2620');label(`${String(wd.from).padStart(3,'0')}° / ${wd.kmh} km/h`,cx,cy-8*f,mono(18),'#2a2620');
  const t=(wd.from+180)*Math.PI/180,L=40*f,tx=Math.sin(t)*L,ty=-Math.cos(t)*L;ctx.save();ctx.translate(cx,cy+40*f);ctx.strokeStyle='#2a2620';ctx.lineWidth=2.4*f;ctx.beginPath();ctx.moveTo(-tx,-ty);ctx.lineTo(tx,ty);ctx.stroke();ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx+Math.sin(t+2.7)*14*f,ty-Math.cos(t+2.7)*14*f);ctx.lineTo(tx+Math.sin(t-2.7)*14*f,ty-Math.cos(t-2.7)*14*f);ctx.closePath();ctx.fillStyle='#2a2620';ctx.fill();ctx.restore();}
 // Frame, then age the paper: stains, folds, grain, darkened edges.
 ctx.strokeStyle='#2a2620';ctx.lineWidth=4*f;ctx.strokeRect(6*f,6*f,w-12*f,h-12*f);ctx.lineWidth=1.2*f;ctx.strokeRect(46*f,46*f,w-92*f,h-92*f);
 for(let i=0;i<9;i++){const x=r()*w,y=r()*h,rad=(90+r()*260)*f,gr=ctx.createRadialGradient(x,y,rad*.2,x,y,rad);gr.addColorStop(0,'rgba(150,105,45,.07)');gr.addColorStop(.85,'rgba(150,105,45,.05)');gr.addColorStop(1,'rgba(120,80,30,0)');ctx.fillStyle=gr;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);}
 for(const vertical of [true,false])for(const [o,c] of [[-1.5,'rgba(255,250,235,.35)'],[1.5,'rgba(90,70,40,.18)']]){ctx.beginPath();if(vertical){ctx.moveTo(w/2+o*f,0);ctx.lineTo(w/2+o*f,h);}else{ctx.moveTo(0,h/2+o*f);ctx.lineTo(w,h/2+o*f);}ctx.strokeStyle=c;ctx.lineWidth=2*f;ctx.stroke();}
 for(const [c,n] of [['rgba(80,60,30,.10)',60000],['rgba(255,250,235,.10)',40000]]){ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<n;i++)ctx.rect(r()*w,r()*h,1.3*f,1.3*f);ctx.fill();}
 {const gr=ctx.createRadialGradient(w/2,h/2,w*.35,w/2,h/2,w*.75);gr.addColorStop(0,'rgba(120,85,40,0)');gr.addColorStop(1,'rgba(120,85,40,.28)');ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);}
}

export function drawTerrain(ctx,w,h){const {s,X,Y,path,clipLand}=painter(ctx,w,h),g=geo(),r=rng(31),px=w/4096;
 ctx.lineCap=ctx.lineJoin='round';
 // Patchwork farmland: rotated farm blocks split recursively into fields with hedgerows.
 const stripe=document.createElement('canvas');stripe.width=stripe.height=6;{const c=stripe.getContext('2d');c.strokeStyle='rgba(40,30,15,.5)';c.lineWidth=1.3;c.beginPath();c.moveTo(0,3);c.lineTo(6,3);c.stroke();}const stripes=ctx.createPattern(stripe,'repeat');
 const palette=['#6d8748','#7b9250','#8e9e58','#a79a5c','#b6a468','#8a7650','#667a42','#97a766','#7d6b4a','#5f7a45','#a3a46a'];
 ctx.fillStyle='#6d8046';ctx.fillRect(0,0,w,h);
 const field=(x,y,fw,fh,d)=>{if(d>3||fw*fh<900*px*px||r()<.12*d){ctx.fillStyle=palette[Math.floor(r()*palette.length)];ctx.fillRect(x,y,fw,fh);ctx.fillStyle=`rgba(${r()<.5?'0,0,0':'255,255,240'},${r()*.08})`;ctx.fillRect(x,y,fw,fh);if(r()<.45){ctx.fillStyle=stripes;ctx.globalAlpha=.35;ctx.fillRect(x,y,fw,fh);ctx.globalAlpha=1;}ctx.strokeStyle='rgba(38,52,28,.75)';ctx.lineWidth=1.4*px;ctx.strokeRect(x,y,fw,fh);return;}
  const t=.3+r()*.4;if(fw>fh){field(x,y,fw*t,fh,d+1);field(x+fw*t,y,fw*(1-t),fh,d+1);}else{field(x,y,fw,fh*t,d+1);field(x,y+fh*t,fw,fh*(1-t),d+1);}};
 const block=2.5*s;for(let by=-block;by<h+block;by+=block)for(let bx=-block;bx<w+block;bx+=block){ctx.save();ctx.translate(bx+block/2,by+block/2);ctx.rotate((r()-.5)*.9);const side=block*1.45;for(let j=0;j<2;j++)for(let i=0;i<2;i++)field(-side/2+i*side/2,-side/2+j*side/2,side/2,side/2,0);ctx.restore();}
 // Sea, shallows, surf and beach, all clipped to open water.
 ctx.save();path(g.sea,true);ctx.fillStyle='#2b4f55';ctx.fill();ctx.clip();
 for(let i=6;i>=1;i--)for(const line of [g.eng,g.enemy]){path(line);ctx.lineWidth=i*.28*s;ctx.strokeStyle='rgba(90,140,135,.22)';ctx.stroke();}
 for(const line of [g.eng,g.enemy]){path(line);ctx.lineWidth=.16*s;ctx.strokeStyle='rgba(235,240,230,.55)';ctx.setLineDash([18*px,7*px]);ctx.stroke();ctx.setLineDash([]);path(line);ctx.lineWidth=.09*s;ctx.strokeStyle='#cdbf92';ctx.stroke();}
 ctx.restore();
 for(const fo of g.forests){ctx.save();path(fo.pts,true);ctx.fillStyle='#2d4127';ctx.fill();ctx.clip();const xs=fo.pts.map(p=>p[0]),ys=fo.pts.map(p=>p[1]);for(const [c,rad] of [['#22331f',3.4],['#3d5532',2.6],['#4a6339',1.6]]){ctx.fillStyle=c;ctx.beginPath();for(let x=Math.min(...xs);x<Math.max(...xs);x+=.09)for(let y=Math.min(...ys);y<Math.max(...ys);y+=.09){const qx=X(x+(r()-.5)*.09),qy=Y(y+(r()-.5)*.09),rr=rad*(.6+r()*.6)*px;ctx.moveTo(qx+rr,qy);ctx.arc(qx,qy,rr,0,7);}ctx.fill();}ctx.restore();}
 for(const v of g.rivers){path(v.pts);ctx.strokeStyle='#3d5130';ctx.lineWidth=v.width*s+5*px;ctx.stroke();ctx.strokeStyle='#2c4f53';ctx.lineWidth=v.width*s;ctx.stroke();ctx.strokeStyle='rgba(120,160,155,.35)';ctx.lineWidth=v.width*s*.3;ctx.stroke();}
 for(const l of MAP.lakes){ctx.save();ctx.translate(X(l.x),Y(l.y));ctx.rotate(-l.rot);ctx.beginPath();ctx.ellipse(0,0,l.rx*s+5*px,l.ry*s+5*px,0,0,7);ctx.fillStyle='#3d5130';ctx.fill();ctx.beginPath();ctx.ellipse(0,0,l.rx*s,l.ry*s,0,0,7);const gr=ctx.createRadialGradient(0,0,0,0,0,l.rx*s);gr.addColorStop(0,'#24464c');gr.addColorStop(1,'#3a6564');ctx.fillStyle=gr;ctx.fill();ctx.restore();}
 for(const road of MAP.roads){path(road);ctx.strokeStyle='#cbc2a2';ctx.lineWidth=.05*s;ctx.stroke();}
 // Marshalling yards make both junctions readable from altitude; Varenne is the larger one.
 const yard=(x,y,ang,len,n)=>{ctx.save();ctx.translate(X(x),Y(y));ctx.rotate(ang);ctx.fillStyle='#8e8a7c';ctx.fillRect(-len*s/2,-n*.022*s,len*s,n*.044*s);ctx.strokeStyle='#2f2b25';ctx.lineWidth=1.2*px;for(let i=0;i<n;i++){const o=(i-(n-1)/2)*.04*s;ctx.beginPath();ctx.moveTo(-len*s/2,o);ctx.lineTo(len*s/2,o);ctx.stroke();}ctx.restore();};
 for(const y of MAP.yards)yard(y.x,y.y,y.ang,y.len,y.n);
 clipLand();for(const rail of MAP.rails){path(rail);ctx.strokeStyle='#aaa493';ctx.lineWidth=.085*s;ctx.stroke();ctx.strokeStyle='#2f2b25';ctx.lineWidth=.028*s;ctx.stroke();}ctx.restore();
 for(const t of MAP.towns){const R=t.r*s,cell=.09*s;{const gr=ctx.createRadialGradient(X(t.x),Y(t.y),0,X(t.x),Y(t.y),R*1.15);gr.addColorStop(0,'rgba(128,120,104,.95)');gr.addColorStop(.7,'rgba(128,120,104,.7)');gr.addColorStop(1,'rgba(128,120,104,0)');ctx.fillStyle=gr;ctx.fillRect(X(t.x)-R*1.2,Y(t.y)-R*1.2,R*2.4,R*2.4);}ctx.save();ctx.beginPath();ctx.arc(X(t.x),Y(t.y),R*1.1,0,7);ctx.clip();ctx.translate(X(t.x),Y(t.y));ctx.rotate(r()*.6);
  for(let y=-R;y<R;y+=cell)for(let x=-R;x<R;x+=cell){const d=Math.hypot(x,y)/R;if(r()>1.05-d*d*.9)continue;ctx.fillStyle='#9a9180';ctx.fillRect(x,y,cell*.86,cell*.86);for(let k=0;k<3;k++){ctx.fillStyle=r()<.6?'#94503c':'#6e6a62';ctx.fillRect(x+r()*cell*.5,y+r()*cell*.5,cell*(.25+r()*.25),cell*(.2+r()*.2));}}
  ctx.fillStyle='#d4cdb4';ctx.fillRect(-cell,-cell,cell*2.2,cell*1.4);ctx.restore();}
 // Airfield: grass, perimeter track, three concrete runways in A pattern, hardstands.
 {const bx=X(MAP.base.x),by=Y(MAP.base.y),L=1.1*s;ctx.beginPath();ctx.arc(bx,by,L*1.35,0,7);ctx.fillStyle='#7f9455';ctx.fill();ctx.beginPath();ctx.arc(bx,by,L*1.15,0,7);ctx.strokeStyle='#b5af9f';ctx.lineWidth=.035*s;ctx.stroke();
  for(let i=0;i<30;i++){const a=i/30*Math.PI*2;ctx.beginPath();ctx.arc(bx+Math.cos(a)*L*1.22,by+Math.sin(a)*L*1.22,.035*s,0,7);ctx.fillStyle='#b5af9f';ctx.fill();}
  ctx.strokeStyle='#c4bfb1';ctx.lineWidth=.07*s;ctx.lineCap='butt';for(const a of [0,Math.PI/3,-Math.PI/3]){const ox=Math.cos(a)*L*.18,oy=-Math.sin(a)*L*.18;ctx.beginPath();ctx.moveTo(bx-Math.sin(a)*L+ox,by-Math.cos(a)*L+oy);ctx.lineTo(bx+Math.sin(a)*L+ox,by+Math.cos(a)*L+oy);ctx.stroke();}ctx.lineCap='round';
  ctx.fillStyle='#6d6a62';ctx.fillRect(bx+L*.9,by-L*.6,.18*s,.08*s);ctx.fillRect(bx+L*.9,by-L*.35,.18*s,.08*s);}
 // Fine grain so it reads as a photograph rather than flat vector art.
 for(const [c,n] of [['rgba(0,0,0,.08)',90000],['rgba(255,255,230,.06)',60000]]){ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<n;i++)ctx.rect(r()*w,r()*h,2*px,2*px);ctx.fill();}
}
