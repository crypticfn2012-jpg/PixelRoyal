/* PixelRoyal Season 1: Pulse — 35-second in-game cinematic.
   Uses the game's existing map, player/cosmetic renderer and logo assets. */
(function(){
'use strict';
let active=false,startAt=0,raf=0,lastScene=-1,impactPlayed=false;
let canvas=null,ctx=null,audio=null,audioNodes=[],audioMaster=null,previousOverflow='';
const DURATION=35,CUTS=[0,4,8,13,18,22,28,31,35];
const CRASH={x:1810,y:1505};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const easeOut=v=>1-Math.pow(1-clamp(v),3);

function watchPulseTrailer(){
 const wrap=document.getElementById('pulseTrailer');if(!wrap||active)return;
 if(typeof togglePulseNews==='function')togglePulseNews(false);
 canvas=document.getElementById('pulseTrailerCanvas');ctx=canvas.getContext('2d',{alpha:false});
 active=true;startAt=performance.now();lastScene=-1;impactPlayed=false;
 previousOverflow=document.body.style.overflow;
 wrap.classList.add('active');wrap.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 try{if(wrap.requestFullscreen){const p=wrap.requestFullscreen();if(p&&p.catch)p.catch(()=>{})}}catch(_){}
 startAudio();raf=requestAnimationFrame(frame);
}
function closePulseTrailer(){
 const wrap=document.getElementById('pulseTrailer');active=false;
 if(raf)cancelAnimationFrame(raf);raf=0;
 if(wrap){wrap.classList.remove('active');wrap.setAttribute('aria-hidden','true')}
 document.body.style.overflow=previousOverflow;stopAudio();
 try{if(document.fullscreenElement&&document.exitFullscreen){const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{})}}catch(_){}
}
document.addEventListener('keydown',function(e){
 if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePulseTrailer()}
},true);

function startAudio(){
 stopAudio();
 if(!S.settings.sound||!sndOn)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  audio=new AC();audioMaster=audio.createGain();audioMaster.gain.value=.1*clamp((S.settings.volume||0)/100);audioMaster.connect(audio.destination);
  [[55,'sine',.28],[82.41,'triangle',.11],[110,'sine',.07]].forEach(q=>{const o=audio.createOscillator(),g=audio.createGain();o.type=q[1];o.frequency.value=q[0];g.gain.value=q[2];o.connect(g);g.connect(audioMaster);o.start();audioNodes.push(o,g)});
  const lfo=audio.createOscillator(),lg=audio.createGain();lfo.frequency.value=.16;lg.gain.value=.015;lfo.connect(lg);lg.connect(audioMaster.gain);lfo.start();audioNodes.push(lfo,lg);
  const p=audio.resume();if(p&&p.catch)p.catch(()=>{});
 }catch(_){}
}
function stopAudio(){
 audioNodes.forEach(n=>{try{if(n.stop)n.stop()}catch(_){}try{n.disconnect()}catch(_){}});audioNodes=[];
 try{if(audio){const p=audio.close();if(p&&p.catch)p.catch(()=>{})}}catch(_){}
 audio=null;audioMaster=null;
}
function cue(scene,impact){
 if(!audio||audio.state!=='running')return;
 try{
  const now=audio.currentTime,f=impact?38:([82,110,146.8,58,65.4,43.65,98,55][scene]||82);
  const o=audio.createOscillator(),g=audio.createGain();o.type=impact?'sawtooth':'triangle';o.frequency.setValueAtTime(f,now);
  if(impact)o.frequency.exponentialRampToValueAtTime(24,now+.55);
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(impact?.22:.065,now+.035);g.gain.exponentialRampToValueAtTime(.0001,now+(impact?.72:.42));
  o.connect(g);g.connect(audioMaster||audio.destination);o.start(now);o.stop(now+(impact?.75:.45));audioNodes.push(o,g);
 }catch(_){}
}
function text(ctx,str,x,y,size,alpha,color,tracking){
 ctx.save();ctx.globalAlpha=clamp(alpha);ctx.font='1000 '+size+'px "Arial Black",Impact,"Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=Math.max(2,size*.055);ctx.strokeStyle='rgba(1,5,16,.92)';ctx.shadowColor=color||'#53edff';ctx.shadowBlur=Math.min(38,size*.5);
 if(tracking){let width=0;for(const ch of str)width+=ctx.measureText(ch).width+tracking;width-=tracking;let px=x-width/2;for(const ch of str){const cw=ctx.measureText(ch).width;ctx.strokeText(ch,px+cw/2,y);ctx.fillStyle=color||'#eafaff';ctx.fillText(ch,px+cw/2,y);px+=cw+tracking}}
 else{ctx.strokeText(str,x,y);const g=ctx.createLinearGradient(x-size*4,y-size/2,x+size*4,y+size/2);g.addColorStop(0,color||'#eafaff');g.addColorStop(.54,'#f8fbff');g.addColorStop(1,'#ff62d8');ctx.fillStyle=g;ctx.fillText(str,x,y)}
 ctx.restore();
}
function flyText(ctx,str,x,y,size,elapsed){
 const chars=[...str];ctx.save();ctx.font='1000 '+size+'px "Arial Black",Impact,"Segoe UI",sans-serif';ctx.textBaseline='middle';
 const widths=chars.map(c=>ctx.measureText(c).width+size*.025),sum=widths.reduce((a,b)=>a+b,0)-size*.025;let px=x-sum/2;
 chars.forEach((ch,i)=>{const local=Math.max(0,elapsed-i*.055),p=clamp(local/.76),e=easeOut(p),off=(i%2?1:-1)*(1-e)*Math.max(ctx.canvas.width*.7,500),lift=(1-e)*(i%3-1)*100;ctx.save();ctx.globalAlpha=clamp(p*2.8);ctx.translate(px+widths[i]*.5+off,y+lift);ctx.rotate((1-e)*(i%2?-.24:.24));ctx.scale(.72+.28*e,.72+.28*e);ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#07101e';ctx.shadowColor=i%3===0?'#ff56d4':'#45ecff';ctx.shadowBlur=18;ctx.strokeText(ch,0,0);ctx.fillStyle=i%3===0?'#ff82e2':'#edfcff';ctx.fillText(ch,0,0);ctx.restore();px+=widths[i]});
 ctx.restore();
}
function drawMap(w,h,sec,zoom,cxw,cyw,rot){
 const base=Math.min(w/W,h/W)*zoom,g=ctx.createRadialGradient(w*.5,h*.52,20,w*.5,h*.52,Math.max(w,h)*.8);g.addColorStop(0,'#152d4a');g.addColorStop(.55,'#080f21');g.addColorStop(1,'#02040b');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(w/2,h/2);ctx.rotate(rot||0);ctx.scale(base,base);ctx.translate(-cxw,-cyw);
 if(MAP)ctx.drawImage(MAP,0,0);else{ctx.fillStyle='#254c71';ctx.fillRect(0,0,W,W)}ctx.restore();
 const atm=ctx.createRadialGradient(w*.5,h*.48,Math.min(w,h)*.05,w*.5,h*.48,Math.max(w,h)*.75);atm.addColorStop(0,'rgba(44,185,255,.02)');atm.addColorStop(.55,'rgba(10,14,35,.04)');atm.addColorStop(1,'rgba(1,3,10,.7)');ctx.fillStyle=atm;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle='#6cefff';ctx.lineWidth=1;for(let i=0;i<9;i++){const yy=(h*.12+i*h*.096+sec*8)%(h*.92);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w*.14,yy);ctx.moveTo(w*.86,yy);ctx.lineTo(w,yy);ctx.stroke()}ctx.restore();
}
function drawPlayer(x,y,angle,color,hat,gun,walk,scale){
 const old=cx;try{cx=ctx;ctx.save();ctx.translate(x+Math.sin(walk*8)*1.1,y+Math.cos(walk*7)*1.4);ctx.scale(scale||1,scale||1);body(color,hat,angle,gun,0,0);ctx.restore()}catch(_){}finally{cx=old}
}
function drawCapsule(x,y,angle,broken,scale,sec){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);ctx.scale(scale||1,scale||1);
 ctx.shadowColor='#4ceaff';ctx.shadowBlur=18;ctx.fillStyle='rgba(51,229,255,.13)';ctx.beginPath();ctx.ellipse(0,0,94,45,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 ctx.save();ctx.rotate(-.12);ctx.fillStyle='#090f20';ctx.strokeStyle='#90f7ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-92,-27);ctx.lineTo(-62,-41);ctx.lineTo(44,-39);ctx.lineTo(83,-17);ctx.lineTo(91,14);ctx.lineTo(58,38);ctx.lineTo(-53,38);ctx.lineTo(-91,16);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#172f4b';ctx.beginPath();ctx.moveTo(-66,-28);ctx.lineTo(37,-27);ctx.lineTo(68,-10);ctx.lineTo(68,10);ctx.lineTo(40,27);ctx.lineTo(-53,27);ctx.lineTo(-75,12);ctx.closePath();ctx.fill();ctx.strokeStyle='#4deaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-68,0);ctx.lineTo(68,0);ctx.stroke();
 ctx.fillStyle='#f1fbff';ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(8,0,15,9,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#ff55d8';ctx.fillRect(-54,-3,22,6);ctx.fillRect(39,-3,20,6);
 for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#3b7c99':'#1b4665';ctx.fillRect(-62+i*31,-35,17,6);ctx.fillRect(-62+i*31,29,17,6)}ctx.restore();
 if(broken){ctx.strokeStyle='#ff57dc';ctx.lineWidth=3;ctx.shadowColor='#ff57dc';ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(-22,-29);ctx.lineTo(-9,-7);ctx.lineTo(-19,3);ctx.lineTo(0,19);ctx.lineTo(7,35);ctx.stroke();ctx.shadowBlur=0;
  ctx.save();ctx.translate(-63,-42);ctx.rotate(-.38-Math.sin(sec*4)*.04);ctx.fillStyle='#0b1427';ctx.strokeStyle='#ff63db';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,-12);ctx.lineTo(20,-8);ctx.lineTo(29,11);ctx.lineTo(0,15);ctx.lineTo(-20,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.save();ctx.translate(60,33);ctx.rotate(.4+Math.sin(sec*3)*.06);ctx.fillStyle='#10213a';ctx.strokeStyle='#52efff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-7,-12);ctx.lineTo(25,-4);ctx.lineTo(18,16);ctx.lineTo(-13,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}ctx.restore();
}
function drawBoss(x,y,type,scale,sec){
 ctx.save();ctx.translate(x,y);ctx.scale(scale||1,scale||1);const color=['#42efff','#ff4bc8','#9d8cff'][type%3];ctx.shadowColor=color;ctx.shadowBlur=18;ctx.fillStyle='#070d1a';ctx.strokeStyle=color;ctx.lineWidth=3;
 if(type===0){ctx.beginPath();ctx.roundRect(-31,-26,62,52,9);ctx.fill();ctx.stroke();ctx.fillStyle='#17354b';ctx.fillRect(-22,-17,44,8);ctx.fillStyle=color;ctx.fillRect(-18,-5,36,7);ctx.fillStyle='#e8fdff';ctx.fillRect(12,6,8,8);ctx.fillStyle='#172638';ctx.fillRect(-37,14,14,25);ctx.fillRect(23,14,14,25)}
 else if(type===1){ctx.beginPath();ctx.moveTo(-30,-18);ctx.lineTo(-8,-30);ctx.lineTo(25,-23);ctx.lineTo(34,-4);ctx.lineTo(22,24);ctx.lineTo(-10,28);ctx.lineTo(-35,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#3b163c';ctx.fillRect(-22,-13,45,6);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-24,3);ctx.lineTo(25,-5);ctx.lineTo(16,7);ctx.lineTo(-18,14);ctx.closePath();ctx.fill();ctx.fillStyle='#f6ebff';ctx.fillRect(12,-1,9,9);ctx.fillStyle='#152034';ctx.fillRect(-32,13,15,26);ctx.fillRect(15,11,15,26)}
 else{ctx.beginPath();ctx.moveTo(0,-35);ctx.lineTo(28,-13);ctx.lineTo(25,16);ctx.lineTo(0,31);ctx.lineTo(-25,16);ctx.lineTo(-28,-13);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#bdb2ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,39,39,sec*.4,0,Math.PI*2);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(15,0);ctx.lineTo(0,15);ctx.lineTo(-15,0);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-3,-4,6,8);ctx.fillStyle='#15172a';ctx.fillRect(-16,22,12,19);ctx.fillRect(4,22,12,19)}ctx.shadowBlur=0;ctx.restore();
}
function drawCore(w,h,sec){
 ctx.fillStyle='#02040b';ctx.fillRect(0,0,w,h);const cave=ctx.createRadialGradient(w*.5,h*.48,20,w*.5,h*.48,Math.max(w,h)*.74);cave.addColorStop(0,'#112743');cave.addColorStop(.38,'#081427');cave.addColorStop(1,'#010208');ctx.fillStyle=cave;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.globalAlpha=.65;ctx.strokeStyle='#233c60';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,h*.16);ctx.lineTo(w*.13,h*.24);ctx.lineTo(w*.21,h*.17);ctx.lineTo(w*.32,h*.22);ctx.lineTo(w*.43,h*.11);ctx.lineTo(w*.5,h*.16);ctx.lineTo(w*.63,h*.1);ctx.lineTo(w*.74,h*.2);ctx.lineTo(w*.86,h*.14);ctx.lineTo(w,h*.24);ctx.stroke();ctx.beginPath();ctx.moveTo(0,h*.87);ctx.lineTo(w*.16,h*.77);ctx.lineTo(w*.27,h*.88);ctx.lineTo(w*.43,h*.82);ctx.lineTo(w*.56,h*.91);ctx.lineTo(w*.71,h*.81);ctx.lineTo(w*.84,h*.87);ctx.lineTo(w,h*.8);ctx.stroke();
 for(let i=0;i<18;i++){const x=i*173%Math.max(1,w),top=i%2===0;ctx.fillStyle=i%3?'#101d35':'#18304b';ctx.beginPath();if(top){ctx.moveTo(x-32,0);ctx.lineTo(x+30,0);ctx.lineTo(x+Math.sin(i)*12,h*(.08+(i%5)*.025));ctx.lineTo(x-3,h*(.09+(i%4)*.02))}else{ctx.moveTo(x-42,h);ctx.lineTo(x+35,h);ctx.lineTo(x+Math.cos(i)*12,h*(.86-(i%5)*.025));ctx.lineTo(x-9,h*(.87-(i%4)*.02))}ctx.closePath();ctx.fill()}ctx.restore();
 const ox=w*.5,oy=h*.44,beat=1+Math.sin(sec*3)*.035;ctx.save();ctx.translate(ox,oy);ctx.scale(beat,beat);
 for(let i=0;i<3;i++){ctx.save();ctx.rotate(sec*(i%2?-.12:.08)+i*.8);ctx.strokeStyle=i===1?'rgba(255,75,213,.8)':'rgba(69,234,255,.7)';ctx.lineWidth=i===1?2:4;ctx.setLineDash(i===1?[11,12]:[38,15]);ctx.beginPath();ctx.ellipse(0,0,172-i*24,92+i*14,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
 const glow=ctx.createRadialGradient(0,0,6,0,0,155);glow.addColorStop(0,'rgba(227,255,255,.98)');glow.addColorStop(.18,'rgba(72,241,255,.8)');glow.addColorStop(.52,'rgba(63,116,255,.24)');glow.addColorStop(1,'rgba(169,59,255,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,155,0,Math.PI*2);ctx.fill();ctx.shadowColor='#43efff';ctx.shadowBlur=36;ctx.fillStyle='#101b35';ctx.strokeStyle='#67f7ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-70);ctx.lineTo(62,-25);ctx.lineTo(48,51);ctx.lineTo(0,77);ctx.lineTo(-48,51);ctx.lineTo(-62,-25);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#d7feff';ctx.beginPath();ctx.arc(0,0,20+Math.sin(sec*7)*3,0,Math.PI*2);ctx.fill();ctx.restore();
 const minerals=[[w*.22,h*.48],[w*.78,h*.45],[w*.3,h*.72],[w*.7,h*.72]];
 minerals.forEach((m,i)=>{ctx.save();ctx.translate(m[0],m[1]);ctx.rotate(sec*.15+i);ctx.shadowColor=i%2?'#ff4fda':'#51edff';ctx.shadowBlur=17;ctx.fillStyle=i%2?'#9f43da':'#2dc8e8';ctx.strokeStyle='#d2fbff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(16,-5);ctx.lineTo(10,24);ctx.lineTo(-8,30);ctx.lineTo(-16,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()});
 for(let i=0;i<3;i++){const bx=[w*.17,w*.5,w*.83][i],by=h*.71,tx=minerals[i][0],ty=minerals[i][1];ctx.save();ctx.globalAlpha=.35+.23*Math.sin(sec*5+i);ctx.strokeStyle=['#42efff','#ff4bc8','#9d8cff'][i];ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=16;ctx.lineWidth=4;ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(bx,by-15);ctx.lineTo(tx,ty);ctx.lineTo(ox,oy);ctx.stroke();ctx.setLineDash([]);ctx.restore();drawBoss(bx,by,i,1.1,sec)}
 ctx.save();ctx.textAlign='center';ctx.fillStyle='#7fdfff';ctx.font='800 11px Inter,"Segoe UI",sans-serif';ctx.fillText('EXPERIMENTAL SITE // CORE CHAMBER',w*.5,h*.94);ctx.restore();
}
function frame(now){
 if(!active)return;const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight),dpr=Math.min(1.5,window.devicePixelRatio||1);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px'}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const elapsed=Math.max(0,(now-startAt)/1000),ended=elapsed>=DURATION,t=Math.min(DURATION,elapsed);let scene=7;for(let i=0;i<CUTS.length-1;i++)if(t>=CUTS[i]&&t<CUTS[i+1]){scene=i;break}
 const beginning=CUTS[scene],end=CUTS[scene+1],local=t-beginning,duration=end-beginning,mid=w*.5;
 if(scene!==lastScene){lastScene=scene;cue(scene)}if(scene===3&&local>2.15&&!impactPlayed){impactPlayed=true;cue(scene,true)}
 if(scene===5)drawCore(w,h,local);
 else{
  let camera={x:C,y:C,zoom:1.1,rot:Math.sin(t*.18)*.012};
  if(scene===0)camera={x:C+Math.sin(local*.4)*26,y:C+Math.cos(local*.35)*20,zoom:1.04+local*.045,rot:Math.sin(local*.3)*.018};
  if(scene===1)camera={x:C,y:C,zoom:1.18+Math.sin(local*.65)*.035,rot:.01*Math.sin(local)};
  if(scene===2)camera={x:1670+Math.sin(local*.35)*45,y:1600+Math.cos(local*.3)*28,zoom:2.25+Math.sin(local*.6)*.1,rot:Math.sin(local*.35)*.02};
  if(scene===3||scene===4)camera={x:1810+Math.sin(local*.26)*25,y:1505+Math.cos(local*.25)*18,zoom:2.62+Math.sin(local*.28)*.07,rot:-.012+Math.sin(local*.2)*.018};
  if(scene===6)camera={x:C,y:C,zoom:1.12+Math.sin(local*.5)*.04,rot:-.018};
  if(scene===7)camera={x:C,y:C,zoom:1.05,rot:0};
  drawMap(w,h,t,camera.zoom,camera.x,camera.y,camera.rot);
  if(scene===2){
   const paths=[[-285,45,1,'#e74c3c',0,17],[-155,112,2,'#3498db',3,15],[-40,-36,7,'#9b59b6',4,14],[112,75,0,'#1abc9c',7,18],[260,-20,10,'#f1c40f',9,16]];
   paths.forEach((p,i)=>{const x=1680+p[0]+local*(i%2?18:-14),y=1600+p[1]+Math.sin(local*2+i)*17;drawPlayer(x,y,Math.sin(local*1.7+i)*.3,p[3],p[4],p[5],local+i*.3,1.3)});
   ctx.save();ctx.globalAlpha=.6+.2*Math.sin(local*3);ctx.strokeStyle='#52eaff';ctx.lineWidth=1.5;ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(mid,h*.52,Math.min(w,h)*.22,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
   text(ctx,'THE ISLAND IS CHANGING',mid,h*.13,Math.min(24,w*.023),Math.min(1,local*1.3),'#c8f8ff',2.2);
  }
  if(scene===3||scene===4){
   const ix=CRASH.x,iy=CRASH.y;
   for(let i=0;i<16;i++){const p=(local*.23+i/16)%1,xx=ix+(i%4-1.5)*100+Math.sin(t*2+i)*9,yy=iy+p*175;ctx.save();ctx.globalAlpha=(1-p)*.35;ctx.fillStyle=i%3?'#8c9bae':'#d2e5f2';ctx.beginPath();ctx.arc(xx,yy,8+p*20,0,Math.PI*2);ctx.fill();ctx.restore()}
   if(scene===3){
    const p=clamp(local/2.7),x=ix+470*(1-p),y=iy-400*(1-p);drawCapsule(x,y,-.6*(1-p),p>.94,1.12,t);
    if(local>2.4){const k=clamp((local-2.4)/.5);ctx.save();ctx.globalAlpha=(1-k)*.8;const g=ctx.createRadialGradient(mid,h*.48,1,mid,h*.48,h*.7);g.addColorStop(0,'#f1fdff');g.addColorStop(.25,'rgba(68,237,255,.65)');g.addColorStop(1,'rgba(255,72,210,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore()}
    text(ctx,'UNIDENTIFIED OBJECT',mid,h*.14,Math.min(20,w*.019),Math.min(1,local*.8),'#ccefff',3);
   }else{
    drawCapsule(ix,iy,0,true,1.12,t);const emerge=clamp(local/.95);
    drawBoss(ix-118,iy+65-emerge*55,0,1.18,t);drawBoss(ix,iy+60-emerge*49,1,1.18,t);drawBoss(ix+118,iy+66-emerge*53,2,1.18,t);
    if(local>1.05)text(ctx,'THEY HAVE ARRIVED',mid,h*.14,Math.min(28,w*.027),clamp((local-1.05)*1.8),'#ff8ce7',2.2);
    ctx.save();ctx.globalAlpha=.48+.24*Math.sin(t*4);ctx.strokeStyle='#ff4ecb';ctx.shadowColor='#ff4ecb';ctx.shadowBlur=20;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(mid,h*.57,Math.min(w,h)*.2,Math.min(w,h)*.07,0,0,Math.PI*2);ctx.stroke();ctx.restore();
   }
  }
  if(scene===0)text(ctx,'A NEW SIGNAL HAS AWAKENED',mid,h*.82,Math.min(21,w*.021),Math.min(1,local*.7),'#c1e9ff',3);
  if(scene===1){const intro=clamp(local/.6),outro=clamp((duration-local)/.42);flyText(ctx,'PIXELROYAL',mid,h*.44,Math.min(86,w*.09),local);text(ctx,'SEASON 1',mid,h*.55,Math.min(32,w*.033),intro*outro,'#58edff',8);ctx.save();ctx.globalAlpha=intro*outro*.75;ctx.fillStyle='#ff4ecb';ctx.fillRect(w*.36,h*.61,w*.28,2);ctx.restore()}
  if(scene===6){const a=clamp((local-.2)/.8),out=clamp((duration-local)/.45);text(ctx,'FIGHT FOR YOUR ISLAND',mid,h*.5,Math.min(48,w*.045),a*out,'#eafcff',3)}
  if(scene===7){
   const p=clamp(local/1.2),out=ended?1:clamp((duration-local)/.3);ctx.save();ctx.globalAlpha=.76;ctx.fillStyle='#02040b';ctx.fillRect(0,0,w,h);ctx.restore();
   const logo=document.getElementById('gameLogo');if(logo&&logo.complete&&logo.naturalWidth){const lw=Math.min(w*.42,450),lh=lw*(logo.naturalHeight/logo.naturalWidth);ctx.save();ctx.globalAlpha=p*out;ctx.shadowColor='#48edff';ctx.shadowBlur=23;ctx.drawImage(logo,mid-lw/2,h*.30-lh/2,lw,lh);ctx.restore()}
   text(ctx,'PIXELROYAL:',mid,h*.57,Math.min(31,w*.033),p*out,'#eafcff',3);text(ctx,'PULSE',mid,h*.68,Math.min(92,w*.1),p*out,'#50edff',15);
   ctx.save();ctx.globalAlpha=(.3+.3*Math.sin(t*3))*p;ctx.fillStyle='#ff51d8';ctx.fillRect(w*.35,h*.77,w*.3,2);ctx.restore();
  }
 }
 const fadeIn=clamp(local/.48),fadeOut=(scene===7&&ended)?1:clamp((end-t)/.42),opacity=Math.min(fadeIn,fadeOut);if(opacity<1){ctx.fillStyle='rgba(0,0,0,'+(1-opacity)+')';ctx.fillRect(0,0,w,h)}
 ctx.save();ctx.globalAlpha=.11;for(let i=0;i<90;i++){const x=((i*197+Math.sin(t*1.8+i)*38)%w+w)%w,y=((i*113+Math.cos(t*1.25+i)*24)%h+h)%h;ctx.fillStyle=i%3?'#9beaff':'#ffb9e9';ctx.fillRect(x,y,1.2,1.2)}ctx.restore();
 const progress=document.querySelector('#pulseTrailerProgress i');if(progress)progress.style.width=(clamp(t/DURATION)*100)+'%';raf=requestAnimationFrame(frame);
}
window.watchPulseTrailer=watchPulseTrailer;window.closePulseTrailer=closePulseTrailer;
})();