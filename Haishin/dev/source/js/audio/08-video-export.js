/* ===================== サムネイルと動画書き出し ===================== */

const coverUrls=new Map();
let coverTarget=null;
// 表示用の画像は、小さく縮めてページ内に埋め込める形（data:）にする。
// プレビュー画面などでは、ブラウザ内の一時的な住所（blob:）の画像表示が禁止されていることがあるため

async function thumbUrl(blob,max=512){
 
  try{
    const bmp=await createImageBitmap(blob);
    const k=Math.min(1,max/Math.max(bmp.width,bmp.height)),
      w=Math.max(1,Math.round(bmp.width*k)),
      h=Math.max(1,Math.round(bmp.height*k));
  
    const c=document.createElement('canvas');
    c.width=w;
    c.height=h;
    c.getContext('2d').drawImage(bmp,0,0,w,h);
    bmp.close();
  
    return /png|webp|gif/.test(blob.type)?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.88)
  }
 catch(_){
    return await new Promise(res=>{
      const r=new FileReader();
      r.onload=()=>res(r.result);
      r.onerror=()=>res(null);
      r.readAsDataURL(blob)
    })
  }

}

async function coverUrl(key){
  if(coverUrls.has(key))return coverUrls.get(key);
  const blob=db?await idbGet('assets','cover:'+key):null;
  const url=blob?await thumbUrl(blob):null;
  coverUrls.set(key,url);
  return url
}

function coverStyle(t){
  const url=t.cover?coverUrls.get(t.id):(t.programId&&coverUrls.get(activeProgCoverKey(t.programId)))||coverUrls.get('default');
  return url?`background-image:url('${url}')`:''
}

async function renderCover(){
  const url=await coverUrl('default'),
    el=$('#coverPreview');
  el.style.backgroundImage=url?`url('${url}')`:'';
  el.style.backgroundSize=cfg.rec.coverFit==='contain'?'contain':'cover';
  el.classList.toggle('set',!!url);
  el.textContent=url?'':'画像なし';
  $('#coverClear').disabled=!url
}

async function setCover(key,file){
 
  if(coverUrls.get(key))URL.revokeObjectURL(coverUrls.get(key));
  coverUrls.delete(key);
 
  if(file)await idbPut('assets','cover:'+key,file);else await idbDel('assets','cover:'+key);
 
  if(key!=='default'){
    const t=await idbGet('takes',key);
    if(t){
      t.cover=!!file;
      await idbPut('takes',t.id,t);
      if(rec.take?.id===t.id)rec.take.cover=t.cover
    }
  }
 
  await renderCover();
  await renderTakes();
  toast(file?'動画用の画像を設定しました':'画像を外しました');

}

$('#coverPick').onclick=()=>$('#coverFile').click();

$('#coverClear').onclick=()=>setCover('default',null);

$('#coverFile').onchange=e=>{
  const f=e.target.files[0];
  if(f)setCover('default',f);
  e.target.value=''
};

$('#takeCoverFile').onchange=e=>{
  const f=e.target.files[0];
  if(f&&coverTarget)setCover(coverTarget,f);
  e.target.value='';
  coverTarget=null
};

async function drawCover(blob,size,fit){
 
  const bmp=await createImageBitmap(blob),
    c=document.createElement('canvas');
  c.width=c.height=size;
  const g=c.getContext('2d');
 
  const cover=Math.max(size/bmp.width,size/bmp.height),
    contain=Math.min(size/bmp.width,size/bmp.height);
 
  const draw=s=>{
    const w=bmp.width*s,
      h=bmp.height*s;
    g.drawImage(bmp,(size-w)/2,(size-h)/2,w,h)
  };
 
  g.fillStyle='#000';
  g.fillRect(0,0,size,size);
  g.imageSmoothingQuality='high';
 
  if(fit==='contain'){
    g.filter='blur(30px) brightness(.85)';
    draw(cover*1.15);
    g.filter='none';
    draw(contain)
  }else draw(cover);
 
  bmp.close();
  return c;

}

function drawPlainCover(size,title){
 
  const c=document.createElement('canvas');
  c.width=c.height=size;
  const g=c.getContext('2d');
 
  const gr=g.createLinearGradient(0,0,0,size);
  gr.addColorStop(0,look.paper);
  gr.addColorStop(1,look.bg);
  g.fillStyle=gr;
  g.fillRect(0,0,size,size);
 
  g.strokeStyle=look.decor;
  g.lineWidth=size*.03;
  g.strokeRect(size*.05,size*.05,size*.9,size*.9);
 
  g.fillStyle=lookInk(look.paper);
  g.textAlign='center';
  g.textBaseline='middle';
  let fs=size*.075;
  g.font=`700 ${fs}px "Hiragino Sans","Yu Gothic",sans-serif`;
 
  while(g.measureText(title).width>size*.8&&fs>size*.03){
    fs*=.92;
    g.font=`700 ${fs}px "Hiragino Sans","Yu Gothic",sans-serif`
  }
 
  g.fillText(title,size/2,size/2);
 
  if(look.subtitle){
    g.fillStyle=look.accent;
    let sf=size*.03;
    g.font=`${sf}px "Hiragino Mincho ProN","Yu Mincho",serif`;
    while(g.measureText(look.subtitle).width>size*.8&&sf>size*.015){
      sf*=.92;
      g.font=`${sf}px "Hiragino Mincho ProN","Yu Mincho",serif`
    }
    g.fillText(look.subtitle,size/2,size*.76)
  }
  return c;

}


const EFFECT_ASSET='video-falling-image';

let previewToken=0,
  previewRaf=0,
  previewImage=null,
  videoJob=null;

const checkVideoJob=job=>{
  if(job?.cancelled)throw Object.assign(Error('動画の書き出しを中止しました'),{user:true})
};

function effectSettings(){
  const r=cfg.rec;
  return {
    mode:r.videoEffect,
    source:r.effectSource,
    count:+r.effectCount,
    speed:+r.effectSpeed,
    scale:+r.effectScale,
    opacity:+r.effectOpacity,
    fps:+r.videoFps
  }
}
// 季節の演出。time（秒）だけで位置が決まるので、プレビューと書き出しで同じ動きになる

const SEASON_FX={
 spring:{size:.06,img:.085,n:1},
 summer:{size:.032,img:.07,n:1},
 autumn:{size:.075,img:.1,n:.35},
 winter:{size:.042,img:.065,n:.8}
};
// Seasonal artwork: translucent botanical illustration and fine crystal filigree.
// Cache at high resolution; gradients and vein paths are painted once, not every frame.

const elegantFxCache=new Map();

function elegantSprite(kind,variant=0){
 
  const key=kind+':'+variant;
  if(elegantFxCache.has(key))return elegantFxCache.get(key);
 
  const c=document.createElement('canvas');
  c.width=c.height=256;
  const p=c.getContext('2d');
  p.translate(128,128);
  const R=78,
    T=Math.PI*2;
 
  const pathPetal=()=>{
    p.beginPath();
    p.moveTo(0,R*.96);
    p.bezierCurveTo(-R*.9,R*.22,-R*.67,-R*.7,-R*.19,-R*.9);
    p.quadraticCurveTo(-R*.07,-R*.9,0,-R*.7);
    p.quadraticCurveTo(R*.11,-R*.91,R*.22,-R*.85);
    p.bezierCurveTo(R*.76,-R*.52,R*.63,R*.55,0,R*.96);
    p.closePath()
  };
 
  function petal(){
    const f=p.createLinearGradient(-R*.5,-R*.8,R*.45,R);
    f.addColorStop(0,'#fff9fc');
    f.addColorStop(.28,'#fce5ee');
    f.addColorStop(.68,variant===1?'#efb3cc':'#f3c6d7');
    f.addColorStop(1,'#d984a7');
    pathPetal();
    p.fillStyle=f;
    p.fill();
    p.strokeStyle='#fff7fcaa';
    p.lineWidth=.9;
    p.stroke();
    p.save();
    pathPetal();
    p.clip();
    const glow=p.createRadialGradient(-R*.27,-R*.4,0,-R*.27,-R*.4,R*.85);
    glow.addColorStop(0,'#ffffffb0');
    glow.addColorStop(1,'#ffffff00');
    p.fillStyle=glow;
    p.fillRect(-R,-R,R*2,R*2);
    p.strokeStyle='#c77c9b40';
    p.lineWidth=.65;
    for(let k=-2;k<=2;k++){
      p.beginPath();
      p.moveTo(0,R*.84);
      p.bezierCurveTo(k*R*.09,R*.3,k*R*.15,-R*.2,k*R*.14,-R*.64);
      p.stroke()
    }
    p.restore()
  }
 
  if(kind==='petal')petal();
 else if(kind==='blossom'){
    for(let i=0;i<5;i++){
      p.save();
      p.rotate(i*T/5);
      p.translate(0,-R*.27);
      p.scale(.46,.64);
      petal();
      p.restore()
    }
    p.strokeStyle='#c4917eaa';
    p.lineWidth=.8;
    for(let i=0;i<13;i++){
      const a=i*T/13,
        x=Math.cos(a)*R*.2,
        y=Math.sin(a)*R*.2;
      p.beginPath();
      p.moveTo(0,0);
      p.lineTo(x,y);
      p.stroke();
      p.fillStyle='#f0d3a1';
      p.beginPath();
      p.arc(x,y,1.3,0,T);
      p.fill()
    }
  }
 else if(kind==='bubble'){
  
    const f=p.createRadialGradient(-R*.34,-R*.4,R*.02,0,0,R);
    f.addColorStop(0,'#ffffff03');
    f.addColorStop(.72,'#a9dce709');
    f.addColorStop(.91,'#e0c6ec20');
    f.addColorStop(1,'#bce7e940');
    p.fillStyle=f;
    p.beginPath();
    p.arc(0,0,R,0,T);
    p.fill();
  
    const edge=p.createLinearGradient(-R,-R,R,R);
    for(const [n,col]of [[0,'#fff8e9ee'],[.22,'#d1f9ffb0'],[.48,'#d8c1ea80'],[.7,'#efdbd380'],[1,'#aee8e9d0']])edge.addColorStop(n,col);
    p.strokeStyle=edge;
    p.lineWidth=1.55;
    p.stroke();
  
    p.lineCap='round';
    p.strokeStyle='#ffffffdd';
    p.lineWidth=2.4;
    p.beginPath();
    p.arc(0,0,R*.935,3.58,4.32);
    p.stroke();
    p.strokeStyle='#ffffff77';
    p.lineWidth=.8;
    p.beginPath();
    p.arc(0,0,R*.87,3.72,4.16);
    p.stroke();
    p.strokeStyle='#c2f5f5bb';
    p.lineWidth=1.1;
    p.beginPath();
    p.arc(0,0,R*.98,.45,1.18);
    p.stroke();
  
    const gl=p.createRadialGradient(-R*.53,-R*.61,0,-R*.53,-R*.61,R*.16);
    gl.addColorStop(0,'#ffffffb0');
    gl.addColorStop(1,'#ffffff00');
    p.fillStyle=gl;
    p.beginPath();
    p.arc(-R*.53,-R*.61,R*.16,0,T);
    p.fill();
 
  }
 else if(kind==='leaf'){
  
    p.save();
    p.scale(.86,1);
    const f=p.createLinearGradient(-R*.6,-R,R*.5,R);
    f.addColorStop(0,variant===1?'#f1d99b':'#efbf87');
    f.addColorStop(.42,variant===1?'#c79c54':'#c77a54');
    f.addColorStop(1,variant===1?'#967043':'#874b4a');
    p.beginPath();
  
    if(variant===1){
      p.moveTo(0,R*.8);
      p.bezierCurveTo(-R*.2,R*.15,-R*.85,-R*.05,-R*.84,-R*.6);
      p.bezierCurveTo(-R*.6,-R*.97,-R*.12,-R*.84,0,-R*.65);
      p.bezierCurveTo(R*.18,-R*.92,R*.58,-R*.93,R*.84,-R*.6);
      p.bezierCurveTo(R*.82,-R*.08,R*.2,R*.2,0,R*.8)
    }
  else{
      const points=[[0,.8],[-.16,.39],[-.59,.53],[-.46,.16],[-.91,-.03],[-.55,-.17],[-.64,-.65],[-.19,-.4],[0,-1],[.19,-.4],[.64,-.65],[.55,-.17],[.91,-.03],[.46,.16],[.59,.53],[.16,.39]];
      points.forEach(([x,y],i)=>i?p.lineTo(x*R,y*R):p.moveTo(x*R,y*R))
    }
    p.closePath();
    p.fillStyle=f;
    p.fill();
    p.strokeStyle='#f7d9a858';
    p.lineWidth=.7;
    p.stroke();
    p.save();
    p.clip();
    p.strokeStyle='#f9e5bf80';
    p.lineWidth=.85;
    p.beginPath();
    p.moveTo(0,R*.83);
    p.quadraticCurveTo(-R*.045,0,0,-R*.87);
    p.stroke();
    p.lineWidth=.65;
    for(let i=0;i<5;i++)for(const side of [-1,1]){
      p.beginPath();
      const y=R*(.47-i*.23);
      p.moveTo(0,y);
      p.quadraticCurveTo(side*R*.22,y-R*.16,side*R*(.47+(i===2?.23:0)),y-R*.34);
      p.stroke()
    }
    p.restore();
    p.strokeStyle='#ae855c';
    p.lineWidth=1.2;
    p.beginPath();
    p.moveTo(0,R*.73);
    p.quadraticCurveTo(R*.1,R*.97,R*.04,R*1.16);
    p.stroke();
    p.restore();
 
  }
 else if(kind==='snow'){
  
    const glow=p.createRadialGradient(0,0,0,0,0,R*1.25);
    glow.addColorStop(0,'#d6eaff30');
    glow.addColorStop(.4,'#e4eeff12');
    glow.addColorStop(1,'#eaf5ff00');
    p.fillStyle=glow;
    p.fillRect(-110,-110,220,220);
  
    p.strokeStyle=variant===1?'#f5f1ffe6':'#e6f4ffe6';
    p.lineWidth=1.1;
    p.lineCap='round';
    for(let k=0;k<6;k++){
      p.save();
      p.rotate(k*T/6);
      p.beginPath();
      p.moveTo(0,0);
      p.lineTo(0,-R);
      for(const[t,b]of [[.38,.2],[.62,.2],[.81,.12]])for(const sign of [-1,1]){
        p.moveTo(0,-R*t);
        p.lineTo(sign*R*b,-R*(t+b*.68))
      }
      p.stroke();
      p.restore()
    }
  
    p.strokeStyle='#ffffffc0';
    p.lineWidth=.75;
    p.beginPath();
    for(let k=0;k<=6;k++){
      const a=k*T/6;
      const x=Math.sin(a)*R*.25,
        y=-Math.cos(a)*R*.25;
      k?p.lineTo(x,y):p.moveTo(x,y)
    }
    p.stroke();
    p.fillStyle='#ffffff';
    p.beginPath();
    p.arc(0,0,1.65,0,T);
    p.fill();
    for(const k of [1,4]){
      p.save();
      p.rotate(k*T/6);
      p.translate(0,-R*.81);
      p.strokeStyle='#ffffffc0';
      p.lineWidth=.7;
      p.beginPath();
      p.moveTo(-4,0);
      p.lineTo(4,0);
      p.moveTo(0,-4);
      p.lineTo(0,4);
      p.stroke();
      p.restore()
    }
 
  }
 else if(kind==='acorn'){
  // v0.4.3 acorn: soft lacquered nut, fine scale texture on the cap, no heavy outline. variant 1 = slender konara shape.
  
    const sl=variant===1;
    p.save();
    p.translate(0,R*.1);
  
    const nw=sl?R*.5:R*.6,
      nh=sl?R*.82:R*.66;
  
    const body=()=>{
      p.beginPath();
      p.moveTo(-nw,-R*.12);
      p.bezierCurveTo(-nw*1.02,nh*.62,-nw*.42,nh*1.02,0,nh*1.06);
      p.bezierCurveTo(nw*.42,nh*1.02,nw*1.02,nh*.62,nw,-R*.12);
      p.closePath()
    };
  
    const f=p.createLinearGradient(-nw,-R*.1,nw*.8,nh);
    f.addColorStop(0,'#d9a46d');
    f.addColorStop(.45,'#b9783f');
    f.addColorStop(1,'#7a4a2a');
    body();
    p.fillStyle=f;
    p.fill();
  
    p.save();
    body();
    p.clip();
    const hl=p.createRadialGradient(-nw*.42,nh*.18,0,-nw*.42,nh*.18,nw*.9);
    hl.addColorStop(0,'#fff1d8a8');
    hl.addColorStop(1,'#fff1d800');
    p.fillStyle=hl;
    p.fillRect(-R,-R,R*2,R*2);
  
    p.strokeStyle='#f6dcb340';
    p.lineWidth=.7;
    for(const k of [-.45,0,.45]){
      p.beginPath();
      p.moveTo(nw*k,-R*.08);
      p.quadraticCurveTo(nw*k*1.15,nh*.5,nw*k*.4,nh*.98);
      p.stroke()
    }
    p.restore();
  
    p.strokeStyle='#f3d2a655';
    p.lineWidth=.8;
    body();
    p.stroke();
  
    p.fillStyle='#6f4527';
    p.beginPath();
    p.ellipse(0,nh*1.06,1.6,2.2,0,0,T);
    p.fill();
  
    const cw=nw*1.12,
      ch=sl?R*.36:R*.42;
    const cap=()=>{
      p.beginPath();
      p.moveTo(-cw,-R*.06);
      p.bezierCurveTo(-cw*1.02,-R*.06-ch*1.05,cw*1.02,-R*.06-ch*1.05,cw,-R*.06);
      p.quadraticCurveTo(0,R*.06,-cw,-R*.06);
      p.closePath()
    };
  
    const cf=p.createLinearGradient(0,-R*.06-ch,0,R*.04);
    cf.addColorStop(0,'#a07a52');
    cf.addColorStop(1,'#5f4029');
    cap();
    p.fillStyle=cf;
    p.fill();
  
    p.save();
    cap();
    p.clip();
    p.strokeStyle='#e8cfa266';
    p.lineWidth=.6;
    for(let row=0;row<5;row++){
      const y=-R*.04-row*ch*.2;
      for(let i=-6;i<=6;i++){
        const x=i*cw*.17+(row%2)*cw*.085;
        p.beginPath();
        p.arc(x,y,cw*.085,Math.PI*1.05,Math.PI*1.95);
        p.stroke()
      }
    }
    p.restore();
  
    p.strokeStyle='#f0d6ab4d';
    p.lineWidth=.7;
    cap();
    p.stroke();
  
    p.strokeStyle='#6a472c';
    p.lineWidth=2.2;
    p.lineCap='round';
    p.beginPath();
    p.moveTo(0,-R*.06-ch*.78);
    p.quadraticCurveTo(R*.03,-R*.06-ch*.78-R*.12,R*.09,-R*.06-ch*.78-R*.2);
    p.stroke();
  
    p.restore();
 
  }
 else if(kind==='mote'){
  
    const f=p.createRadialGradient(0,0,0,0,0,R);
    f.addColorStop(0,'#fffef2dd');
    f.addColorStop(.13,'#f7f5e4a0');
    f.addColorStop(.42,'#eff7f12a');
    f.addColorStop(1,'#eff7f100');
    p.fillStyle=f;
    p.fillRect(-R,-R,2*R,2*R);
 
  }
 
  elegantFxCache.set(key,c);
  return c;

}

function drawElegantMotif(g,kind,r,variant=0){
  const c=elegantSprite(kind,variant);
  const span=r*256/78;
  g.drawImage(c,-span/2,-span/2,span,span)
}

function drawPetal(g,r){
  drawElegantMotif(g,'petal',r)
}

function drawBlossom(g,r){
  drawElegantMotif(g,'blossom',r)
}

function drawBubble(g,r){
  drawElegantMotif(g,'bubble',r)
}

function drawAcorn(g,r){
  drawElegantMotif(g,'leaf',r)
} // Retained caller name for older saved settings.

function drawSnow(g,r){
  drawElegantMotif(g,'snow',r)
}


function drawEffectFrame(canvas,base,time,settings,image){
 
  const g=canvas.getContext('2d'),
    S=canvas.width;
  g.clearRect(0,0,S,S);
  g.drawImage(base,0,0,S,S);
 
  const fx=SEASON_FX[settings.mode];
  if(!fx)return;
 
  const rand=n=>{
    const v=Math.sin(n*127.1+311.7)*43758.5453;
    return v-Math.floor(v)
  };
 
  const useImg=settings.source==='image'&&image,
    count=Math.max(1,Math.round(settings.count*fx.n)),
    sp=settings.speed/100,
    alpha=settings.opacity/100,
    TAU=Math.PI*2;
 
  let blossom=false;
  const put=(x,y,r,rot,sx,sy,wx,wy)=>{
    g.save();
    g.translate(x,y);
    if(wx)g.scale(wx,wy);
    g.rotate(rot);
    g.scale(sx,sy);
  
    if(useImg){
      const ratio=image.width/image.height,
        w=ratio>=1?r*2:r*2*ratio,
        h=ratio>=1?r*2/ratio:r*2;
      g.drawImage(image,-w/2,-h/2,w,h)
    }
  else if(settings.mode==='spring')(blossom?drawBlossom(g,r):drawPetal(g,r));else if(settings.mode==='summer')drawBubble(g,r);else if(settings.mode==='autumn')drawAcorn(g,r);else drawSnow(g,r);
  
    g.restore()
  };
 
  for(let i=0;i<count;i++){
  
    const a=k=>rand(i*13+k),
      depth=.45+a(1)*.55,
      r=(useImg?fx.img:fx.size)*S*(settings.scale/70)*depth*.5;
  
    g.globalAlpha=alpha*(.3+depth*.65);
  
    if(settings.mode==='winter'){
   // ゆったり降る雪：遅い落下と、大きくゆるやかな横揺れ
   
      const span=S+r*4,
        y=((a(2)*span+time*S*.06*sp*(.55+depth))%span)-r*2;
   
      const x=a(3)*S+Math.sin(time*.45*(.6+a(4))+a(5)*TAU)*S*.035;
   
      put(x,y,r,useImg?Math.sin(time*.3+a(6)*TAU)*.3:0,1,1);
  
    }else if(settings.mode==='spring'){
   // はらはらと散る花：斜めに流れ、ひらひら裏返りながら回る
   
      const span=S+r*6,
        prog=time*S*.11*sp*(.6+depth),
        y=((a(2)*span+prog)%span)-r*3;
   
      const x=((a(3)*S*1.4+prog*.45+Math.sin(time*1.3*(.7+a(4))+a(5)*TAU)*S*.05)%(S*1.4))-S*.2;
   
      const flip=Math.cos(time*.8*(.6+a(6))+a(7)*TAU);
      blossom=a(10)<.1;
   
      put(x,y,r,a(8)*TAU+time*(a(9)-.5)*.7,Math.max(.15,Math.abs(flip)),1);
  
    }else if(settings.mode==='summer'){
   // ぷくぷくソーダ：下から湧き出て、ゆらゆら揺れながら上へ（形と大きさは変えない）
   
      const span=S+r*6,
        rise=((a(2)*span+time*S*.15*sp*(.55+depth))%span),
        y=S+r*3-rise,
        pos=Math.min(1,Math.max(0,rise/S));
   
      const x=a(3)*S+Math.sin(time*2.6*(.6+a(4))+a(5)*TAU)*S*(.006+pos*.014);
   
      put(x,y,r*.8,0,1,1);
  
    }else{
   // Botanical leaves drift down with a slow turn; no bouncing or floor collision.
   
      const span=S+r*6,
        fall=time*S*.065*sp*(.5+depth),
        y=(a(2)*span+fall)%span-r*3;
   
      const x=((a(3)*S*1.25+fall*.18+Math.sin(time*.65+a(5)*TAU)*S*.045)%(S*1.25))-S*.125;
   
      put(x,y,r,a(6)*TAU+Math.sin(time*.45+a(7)*TAU)*.8, .45+.55*Math.abs(Math.cos(time*.7+a(8)*TAU)),1);
  
    }
 
  }
 
  g.globalAlpha=1;

}

function renderEffectControls(){
 
  if(!cfg)return;
 
  for(const key of ['videoEffect','effectSource','videoFps','effectCount','effectSpeed','effectScale','effectOpacity'])$('#'+key).value=cfg.rec[key];
 
  for(const key of ['effectCount','effectSpeed','effectScale','effectOpacity'])$('#'+key+'Val').textContent=cfg.rec[key]+(key==='effectCount'?'個':'%');

}

async function renderEffectAsset(){
  const b=await getAsset(EFFECT_ASSET);
  $('#effectImageName').textContent=b?(b.name||'登録済みの画像'):'未登録（透過PNGも使えます）';
  $('#effectImageClear').disabled=!b
}

function stopFilmPreview(){
  previewToken++;
  cancelAnimationFrame(previewRaf);
  previewImage?.close();
  previewImage=null;
  $('#filmPreview').hidden=true;
  $('#filmPreviewBtn').textContent='▶ 演出をプレビュー';
  $('#filmPreviewBtn').setAttribute('aria-pressed','false')
}

async function startFilmPreview(){
 
  stopFilmPreview();
  const token=previewToken;
  let image;
 
  try{
  
    const settings=effectSettings(),
      blob=await idbGet('assets','cover:default'),
      size=480;
  
    const base=blob?await drawCover(blob,size,cfg.rec.coverFit):drawPlainCover(size,look.title);
  
    if(settings.mode!=='none'&&settings.source==='image'){
      const b=await getAsset(EFFECT_ASSET);
      if(!b)throw Error('動かす画像を選んでください');
      image=await createImageBitmap(b)
    }
  
    if(token!==previewToken){
      image?.close();
      return
    }
  
    previewImage=image;
    const c=$('#filmPreview');
    c.hidden=false;
    $('#filmPreviewBtn').textContent='■ プレビューを止める';
    $('#filmPreviewBtn').setAttribute('aria-pressed','true');
    $('#filmStatus').textContent='共通サムネイルのプレビュー';
  
    let started;
    const tick=now=>{
      if(token!==previewToken)return;
      started??=now;
      drawEffectFrame(c,base,matchMedia('(prefers-reduced-motion: reduce)').matches?0:(now-started)/1000,settings,image);
      previewRaf=requestAnimationFrame(tick)
    };
  
    previewRaf=requestAnimationFrame(tick);
 
  }catch(e){
    image?.close();
    if(token===previewToken){
      stopFilmPreview();
      $('#filmStatus').textContent=e.message
    }
  }

}

document.addEventListener('visibilitychange',()=>{
  if(document.hidden)stopFilmPreview()
});

$('#filmPreviewBtn').onclick=()=>$('#filmPreview').hidden?startFilmPreview():stopFilmPreview();

for(const key of ['videoEffect','effectSource','videoFps','effectCount','effectSpeed','effectScale','effectOpacity'])$('#'+key).oninput=()=>{
  cfg.rec[key]=key==='videoEffect'||key==='effectSource'?$('#'+key).value:+$('#'+key).value;
  persist();
  renderEffectControls();
  if(!$('#filmPreview').hidden)startFilmPreview()
};

$('#effectImagePick').onclick=()=>$('#effectImageFile').click();

$('#effectImageFile').onchange=async e=>{
  const f=e.target.files[0];
  e.target.value='';
  if(!f)return;
  try{
    if(f.size>20*1048576)throw Error('画像は20MB以内で選んでください');
    const bmp=await createImageBitmap(f);
    if(bmp.width*bmp.height>40000000){
      bmp.close();
      throw Error('画像が大きすぎます。縮小してお試しください')
    }
    bmp.close();
    await putAsset(EFFECT_ASSET,f);
    cfg.rec.effectSource='image';
    if(cfg.rec.videoEffect==='none')cfg.rec.videoEffect='winter';
    persist();
    renderEffectControls();
    await renderEffectAsset();
    if(!$('#filmPreview').hidden)startFilmPreview();
    toast('動かす画像を登録しました')
  }catch(e){
    toast('画像を登録できませんでした：'+e.message,5000)
  }
};

$('#effectImageClear').onclick=async()=>{
  try{
    await deleteAsset(EFFECT_ASSET);
    if(cfg.rec.effectSource==='image')cfg.rec.effectSource='default';
    persist();
    renderEffectControls();
    await renderEffectAsset();
    stopFilmPreview()
  }catch(e){
    toast(errText(e))
  }
};

$('#cancelVideoBtn').onclick=()=>{
  if(videoJob){
    videoJob.cancelled=true;
    $('#filmStatus').textContent='中止しています…'
  }
};


const toU8=d=>!d?null:d instanceof ArrayBuffer?new Uint8Array(d.slice(0)):new Uint8Array(d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength));

async function pickVideoFormat(size,sr,forceWebm=false,fps=1){
 
  const ok=async(E,c)=>{
    try{
      return (await E.isConfigSupported(c)).supported
    }catch(_){
      return false
    }
  };
 
  const vbase={width:size,height:size,bitrate:size>=1080?2000000:1200000,framerate:fps};
 
  const aac={codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:2,bitrate:192000};
 
  if(window.VideoEncoder&&window.AudioEncoder){
  
    if(!forceWebm&&await ok(AudioEncoder,aac))for(const codec of ['avc1.640028','avc1.4d0028','avc1.420028']){
      const v={...vbase,codec,latencyMode:'realtime',avc:{format:'avc'}};
      if(await ok(VideoEncoder,v))return {kind:'mp4',v,a:aac}
    }
  
    const opus={codec:'opus',sampleRate:sr,numberOfChannels:2,bitrate:160000};
  
    if(await ok(AudioEncoder,opus))for(const [codec,name] of [['vp09.00.40.08','V_VP9'],['vp8','V_VP8']]){
      const v={...vbase,codec};
      if(await ok(VideoEncoder,v))return {kind:'webm',v,a:opus,vcodec:name}
    }
 
  }
 
  return null;

}

async function buildVideo(t,progress,forceWebm=false,options=null,job=null){
 
  checkVideoJob(job);
  options??={...effectSettings(),size:cfg.rec.videoSize,fit:cfg.rec.coverFit};
 
  const fps=options.mode==='none'?1:options.fps;
 
  const pk=t.programId&&activeProgCoverKey(t.programId);
 
  const blob=(t.cover&&await idbGet('assets','cover:'+t.id))||(pk&&await idbGet('assets','cover:'+pk))||await idbGet('assets','cover:default');

 
  const size=+options.size||1080,
    sr=t.sampleRate,
    fmt=await pickVideoFormat(size,sr,forceWebm,fps);
 
  if(!fmt)throw Object.assign(Error('このブラウザは動画の書き出しに対応していません。最新のChromeかEdgeでお試しください'),{user:true});
 
  progress('画像を準備中…');
  let canvas;
  try{
    canvas=blob?await drawCover(blob,size,options.fit):drawPlainCover(size,t.name)
  }catch(e){
    throw Object.assign(Error('画像を読み込めませんでした。別の画像でお試しください'),{user:true})
  }
 
  const g=await normGain(t,'mix',p=>progress('音量を解析中 '+Math.round(p*100)+'%'));
 
  const base=canvas;
  let effectImage=null;
 
  if(options.mode!=='none'&&options.source==='image'){
    const b=await getAsset(EFFECT_ASSET);
    if(!b)throw Object.assign(Error('動かす画像を選んでください'),{user:true});
    try{
      effectImage=await createImageBitmap(b)
    }catch(_){
      throw Object.assign(Error('動かす画像を読み込めませんでした'),{user:true})
    }
  }
 
  canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
 
  const vChunks=[],
    aChunks=[];
  let vDesc=null,
    aDesc=null,
    err=null;
 
  const grab=(list,c,extra)=>{
    const d=new Uint8Array(c.byteLength);
    c.copyTo(d);
    list.push({ts:c.timestamp,data:d,...extra})
  };
 
  let srcPeak=0,
    ae,
    ve;
 
  try{
 
    ae=new AudioEncoder({output:(c,m)=>{
        if(m?.decoderConfig?.description)aDesc=toU8(m.decoderConfig.description);
        grab(aChunks,c);
        if(fmt.kind==='mp4'){
          const last=aChunks[aChunks.length-1];
          last.data=Mux.stripAdts(last.data)
        }
      },error:e=>err=e});
    ae.configure(fmt.a);
 
    ve=new VideoEncoder({output:(c,m)=>{
        if(m?.decoderConfig?.description)vDesc=toU8(m.decoderConfig.description);
        grab(vChunks,c,{key:c.type==='key'})
      },error:e=>err=e});
    ve.configure(fmt.v);
  
    const keys=await trackKeys(t,'mix');
    let pos=0,
      done=0;
  
    for await(const raw of readChunks(t,'mix')){
   
      checkVideoJob(job);
      if(err)throw err;
      const a=scaleI16(raw,g),
        n=a.length/2,
        pl=new Float32Array(n*2);
   
      for(let i=0;i<n;i++){
        pl[i]=a[2*i]/32768;
        pl[n+i]=a[2*i+1]/32768
      }
   
      if(pos<sr*4)for(let i=0;i<Math.min(n,sr*4-pos);i++){
        const v=Math.abs(pl[i])+Math.abs(pl[n+i]);
        if(v>srcPeak)srcPeak=v
      }
   
      const ad=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(pos*1e6/sr),data:pl});
      ae.encode(ad);
      ad.close();
      pos+=n;
   
      while(ae.encodeQueueSize>6){
        checkVideoJob(job);
        if(err)throw err;
        await sleep(4)
      }
      progress('音声を変換中 '+Math.round(++done/keys.length*100)+'%');
  
    }
  
    await ae.flush();
    if(err)throw err;
  
    if(!pos)throw Object.assign(Error('このテイクに書き出せる音声がありません'),{user:true});
  
    const frames=Math.max(1,Math.ceil(pos/sr*fps));
  
    for(let i=0;i<frames;i++){
   
      checkVideoJob(job);
      if(err)throw err;
      drawEffectFrame(canvas,base,i/fps,options,effectImage);
      const ts=Math.round(i*1e6/fps),
        end=Math.min(Math.round((i+1)*1e6/fps),Math.round(pos*1e6/sr));
      const f=new VideoFrame(canvas,{timestamp:ts,duration:Math.max(1,end-ts)});
      ve.encode(f,{keyFrame:i%(fps*2)===0});
      f.close();
   
      while(ve.encodeQueueSize>3){
        checkVideoJob(job);
        if(err)throw err;
        await sleep(4)
      }
      if(i%15===0){
        progress('映像を作成中 '+Math.round(i/frames*100)+'%');
        await sleep(0)
      }
  
    }
  
    await ve.flush();
    if(err)throw err;
  
    progress('ファイルにまとめています…');
  
    const durationMs=Math.round(pos/sr*1000);
  
    const parts=fmt.kind==='mp4'
   ?Mux.mp4({
      durationMs,
      video:{width:size,height:size,description:vDesc,chunks:vChunks},
      audio:{sampleRate:sr,channels:2,description:aDesc,bitrate:192000,chunks:aChunks}
    })
   :Mux.webm({
      durationMs,
      video:{codec:fmt.vcodec,width:size,height:size,chunks:vChunks},
      audio:{sampleRate:sr,channels:2,description:aDesc,chunks:aChunks}
    });
  
    if(fmt.kind==='mp4'){
   
      progress('音声が入っているか確認中…');
   
      const ok=await verifyMp4Audio(vChunks,aChunks,{size,sr,vDesc,srcPeak});
   
      if(!ok){
        try{
          ae.close()
        }catch(_){}
        try{
          ve.close()
        }catch(_){}
        toast('MP4の音声を確認できなかったため、WebM形式で作り直します',5000);
        const v=await buildVideo(t,progress,true,options,job);
        v.fallback=true;
        return v
      }
  
    }
  
    return {blob:new Blob(parts,{type:fmt.kind==='mp4'?'video/mp4':'video/webm'}),ext:fmt.kind};
 
  }finally{
    effectImage?.close();
    try{
      ae.close()
    }catch(_){}
    try{
      ve.close()
    }catch(_){}
  }

}

async function verifyMp4Audio(vChunks,aChunks,{size,sr,vDesc,srcPeak}){
 // 冒頭約4秒だけの小さなMP4を作り、ブラウザ自身に音声を読ませて確かめる
 
  try{
  
    const lim=4e6,
      v=vChunks.filter(c=>c.ts<lim),
      a=aChunks.filter(c=>c.ts<lim);
    if(!a.length)return false;
  
    const parts=Mux.mp4({
      durationMs:4000,
      video:{width:size,height:size,description:vDesc,chunks:v.length?v:vChunks.slice(0,1)},
      audio:{sampleRate:sr,channels:2,chunks:a}
    });
  
    const buf=await new Blob(parts).arrayBuffer();
  
    const oc=new OfflineAudioContext(2,sr,sr);
    const decoded=await oc.decodeAudioData(buf);
  
    if(decoded.duration<=0)return false;
  
    if(srcPeak<0.01)return true;
  
    let peak=0;
    for(let c=0;c<decoded.numberOfChannels;c++){
      const d=decoded.getChannelData(c);
      for(let i=0;i<d.length;i++){
        const x=Math.abs(d[i]);
        if(x>peak)peak=x
      }
    }
  
    return peak>srcPeak*0.05;
 
  }catch(e){
    console.warn('MP4音声の確認に失敗',e);
    return false
  }

}

function safeName(s){
  return String(s).replace(/[\\/:*?"<>|]/g,'_').trim()||'recording'
}

function download(blob,name){
  const url=URL.createObjectURL(blob),
    a=document.createElement('a');
  a.href=url;
  a.download=name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000)
}

async function exportTake(takeId,track,kind){
 
  if(busyTakes.has(takeId)){
    toast('このテイクは書き出し中です');
    return
  }
 
  if(kind==='video'&&videoJob){
    toast('別の動画を書き出し中です');
    return
  }
 
  const t=await idbGet('takes',takeId);
  if(!t)return;
 
  if(busyTakes.has(takeId)||(kind==='video'&&videoJob)){
    toast('書き出し中です');
    return
  }
 
  let job=null;
  if(kind==='video'){
    job={cancelled:false};
    videoJob=job;
    $('#cancelVideoBtn').hidden=false;
    stopFilmPreview()
  }
 
  const el=()=>document.querySelector(`[data-progress="${CSS.escape(takeId)}"]`);
 
  const progress=msg=>{
    busyTakes.set(takeId,msg);
    const e=el();
    if(e)e.textContent=msg;
    if(job)$('#filmStatus').textContent=msg
  };
 
  try{
    progress(kind==='mp3'?'MP3変換の準備中…':'WAVを作成中…');
  
    if(kind==='video'){
      const v=await buildVideo(t,progress,false,null,job);
      checkVideoJob(job);
      download(v.blob,`${safeName(t.name)}.${v.ext}`);
      toast(`動画を書き出しました（${v.ext.toUpperCase()}・${(v.blob.size/1048576).toFixed(1)}MB）${v.fallback?'。MP4で音声を確認できなかったためWebMにしました':''}`,6000);
      return
    }
  
    const blob=kind==='mp3'?await buildMp3(t,track,progress):await buildWav(t,track,progress);
  
    download(blob,`${safeName(t.name)}_${({mix:'mix',voice:'voice',prog:'bgm-sfx'})[track]||track}.${kind}`);
    toast('書き出しました（'+(blob.size/1048576).toFixed(1)+'MB）');
 
  }catch(e){
    console.error(e);
    toast(e.user?e.message:'書き出しに失敗しました',4500)
  }
 finally{
    busyTakes.delete(takeId);
    const e=el();
    if(e)e.textContent='';
    if(job){
      videoJob=null;
      $('#cancelVideoBtn').hidden=true;
      $('#filmStatus').textContent=job.cancelled?'動画の書き出しを中止しました':''
    }
  }

}

async function listenTake(takeId,btn){
 
  const t=await idbGet('takes',takeId);
  if(!t)return;
  btn.disabled=true;
  btn.textContent='準備中…';
 
  try{
    const blob=await buildWav(t,'mix');
    const audio=document.createElement('audio');
    audio.controls=true;
    audio.dataset.take=takeId;
    audio.src=URL.createObjectURL(blob);
    btn.parentElement.replaceChildren(audio);
    audio.play().catch(()=>{})
  }
 catch(e){
    console.error(e);
    btn.disabled=false;
    btn.textContent='▶ 試聴する';
    toast('試聴を準備できませんでした')
  }

}

async function deleteTakeData(takeId){
 
  if(busyTakes.has(takeId))throw Object.assign(Error('書き出し中のテイクは削除できません'),{user:true});
 
  for(const k of ['mix','voice','prog'])await idbDelStrict('chunks',chunkRange(takeId,k));
 
  await idbDelStrict('takes',takeId);
  await idbDel('assets','cover:'+takeId);
  if(lastTakeId===takeId)lastTakeId=null;

}

async function deleteTake(takeId,btn){
 
  if(rec.take?.id===takeId){
    toast('録音中のテイクは削除できません');
    return
  }
 
  if(btn){
    btn.disabled=true;
    btn.textContent='削除中…'
  }
 
  try{
  
    await deleteTakeData(takeId);
  
    if(await idbGet('takes',takeId))throw Error('削除後もデータが残っています');
  
    const a=document.querySelector(`audio[data-take="${CSS.escape(takeId)}"]`);
    if(a){
      a.pause();
      URL.revokeObjectURL(a.src)
    }
  
    document.querySelector(`.take[data-id="${CSS.escape(takeId)}"]`)?.remove();
  
    if(coverUrls.get(takeId))URL.revokeObjectURL(coverUrls.get(takeId));
    coverUrls.delete(takeId);
  
    await renderTakes();
    updateStorage();
    toast('テイクを削除しました');
 
  }catch(e){
    console.error(e);
    toast('削除できませんでした（'+(e?.name&&e.name!=='Error'?e.name+'：':'')+(e?.message||e)+'）',6000);
    if(btn){
      btn.disabled=false;
      btn.textContent='削除'
    }
  }

}

$('#takes').addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b)return;
 
  if(b.dataset.takeCover){
    coverTarget=b.dataset.takeCover;
    $('#takeCoverFile').click();
    return
  }
 
  if(b.dataset.uncover){
    setCover(b.dataset.uncover,null);
    return
  }
 
  if(b.dataset.del&&busyTakes.has(b.dataset.del)){
    toast('書き出し中のテイクは削除できません');
    return
  }
 
  if(b.dataset.video){
    exportTake(b.dataset.video,'mix','video');
    return
  }
 
  if(b.dataset.listen)listenTake(b.dataset.listen,b);else if(b.dataset.wav)exportTake(b.dataset.wav,b.dataset.track,'wav');else if(b.dataset.mp3)exportTake(b.dataset.mp3,b.dataset.track,'mp3');else if(b.dataset.del){
    if(armButton(b))deleteTake(b.dataset.del,b)
  }
 else if(b.dataset.copy){
    idbGet('takes',b.dataset.copy).then(t=>{
      const text=(t.markers||[]).map(m=>fmtTime(m.t,true)+'\t'+m.label).join('\n');
      copyText(text)
    })
  }
});

$('#takes').addEventListener('change',async e=>{
  const inp=e.target.closest('[data-rename]');
  if(!inp)return;
  const name=inp.value.trim()||'収録';
 
  if(rec.take?.id===inp.dataset.rename){
    rec.take.name=name;
    return
  }
  const t=await idbGet('takes',inp.dataset.rename);
  if(t){
    t.name=name;
    await idbPut('takes',t.id,t);
    toast('テイク名を変更しました')
  }
});

async function updateStorage(){
  try{
    const est=await navigator.storage?.estimate?.();
    if(!est)return;
    const mb=x=>x>1073741824?(x/1073741824).toFixed(1)+'GB':Math.round(x/1048576)+'MB';
    $('#storageInfo').textContent=`保存 ${mb(est.usage)}／空き 約${mb(est.quota-est.usage)}`
  }catch(_){}
}
