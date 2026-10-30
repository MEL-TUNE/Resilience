/* 描画：立ち絵の位置と動き、降らせる演出、背景 */

// Canvas size follows state.aspect. Everything below draws in W×H pixels.

  let W=1280,
    H=720;

  function alphaBox(im){
    if(trimCache.has(im))return trimCache.get(im);
    let box={x:0,y:0,w:im.width,h:im.height};
    try{
      const k=Math.min(1,512/Math.max(im.width,im.height)),
        cw=Math.max(1,Math.round(im.width*k)),
        ch=Math.max(1,Math.round(im.height*k)),
        cv=document.createElement('canvas');
      cv.width=cw;
      cv.height=ch;
      const cg=cv.getContext('2d',{willReadFrequently:true});
      cg.drawImage(im,0,0,cw,ch);
      const d=cg.getImageData(0,0,cw,ch).data;
      let x0=cw,
        y0=ch,
        x1=-1,
        y1=-1;
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(d[(y*cw+x)*4+3]>8){
        if(x<x0)x0=x;
        if(x>x1)x1=x;
        if(y<y0)y0=y;
        if(y>y1)y1=y
      }
      if(x1>=0){
        const sx=im.width/cw,
          sy=im.height/ch;
        const bx=Math.max(0,Math.floor((x0-1)*sx)),
          by=Math.max(0,Math.floor((y0-1)*sy));
        box={x:bx,y:by,w:Math.min(im.width,Math.ceil((x1+2)*sx))-bx,h:Math.min(im.height,Math.ceil((y1+2)*sy))-by}
      }
    }catch(_){}
    trimCache.set(im,box);
    return box
  }

  function charRect(ref){
    const c=curChar();
    if(!ref||(c&&c.trim===false))return {x:0,y:0,w:ref?ref.width:0,h:ref?ref.height:0};
    const ims=(c&&c.mode==='single')?[images.png0]:[images.png0,images.png1,images.png2,images.png3];
    let x0=Infinity,
      y0=Infinity,
      x1=-Infinity,
      y1=-Infinity;
    for(const im of ims){
      if(!im||im.width!==ref.width||im.height!==ref.height)continue;
      const b=alphaBox(im);
      x0=Math.min(x0,b.x);
      y0=Math.min(y0,b.y);
      x1=Math.max(x1,b.x+b.w);
      y1=Math.max(y1,b.y+b.h)
    }
    if(!isFinite(x0))return {x:0,y:0,w:ref.width,h:ref.height};
    return {x:x0,y:y0,w:x1-x0,h:y1-y0}
  }

  function avatarGeom(){
    const ref=images.png0||images.png1||images.png2||images.png3;
    const ox=state.x*W/100,
      oy=state.y*H/100;
    if(ref){
      const r=charRect(ref),
        f=Math.min(W/r.w,H/r.h)*state.scale/100,
        w=r.w*f,
        h=r.h*f;
      return {cx:W/2+ox,bottom:H+oy,w,h,faceY:H+oy-h*.86}
    }
    const s=state.scale/85;
    return {cx:W/2+ox,bottom:H*.548+oy+243*s,w:216*s,h:450*s,faceY:H*.548+oy-43*s}
  }
// Avatar motion. 'still' = upright (default). Pivot is the avatar's feet so rotation reads as body sway.

  let motion='still',
    talkEnv=0;
  const MOTION_LABEL={still:'直立',sing:'歌うゆらぎ',hop:'ぴょんぴょん',shake:'ガタガタ'};

  const rnd=n=>{
    const v=Math.sin(n*127.1+311.7)*43758.5453;
    return v-Math.floor(v)
  };

  let poseLast=0,
    envS=0,
    popS=0,
    singPh=0,
    hopPh=0;
  const mw={sing:0,hop:0,shake:0};

  function vnoise(x,seed){
    const i=Math.floor(x),
      f=x-i,
      s=f*f*(3-2*f);
    return (rnd(i+seed)*(1-s)+rnd(i+1+seed)*s)*2-1
  }
// v0.4.8: the illustration is only moved and tilted (never scaled per axis).
// Tilt is computed from a target head travel in screen pixels, around a pivot no lower than the bottom edge of the
// screen, so a large / lowered character does not swing wildly. Each motion fades in and out over ~0.3 s.

  function avatarPose(now,talking){
 
    const t=now/1000,
      u=H/720,
      TAU=Math.PI*2,
      geo=avatarGeom(),
      pv=Math.min(geo.bottom,H*1.04),
      arm=Math.max(H*.3,pv-geo.faceY);
 
    const dtp=poseLast?Math.min(.1,Math.max(0,(now-poseLast)/1000)):0;
    poseLast=now;
 
    const ease=(v,to,tc)=>v+(to-v)*(1-Math.exp(-dtp/tc));
 
    {const te=selfSpeak()?talkEnv:0;envS=ease(envS,te,te>envS?.16:.6)}
    popS=ease(popS,talking&&state.bounce?1:0,talking?.05:.12);
 
    {const em=effMotion();for(const m in mw)mw[m]=ease(mw[m],em===m?1:0,.28)}
 
    const k=state.motionAmt/100;
    let dx=0,
      dy=0,
      rot=0;
 
    dy-=popS*7*u;
 
    if(mw.sing>.001){
      const kS=state.motionSing/100*mw.sing,
        sp=state.motionSingSpeed/100;
      singPh+=dtp*TAU/5.6*sp*(.9+.25*envS);
  
      const lean=Math.sin(singPh)*.8+Math.sin(singPh*.47+1.9)*.2;
  
      const head=lean*11*u*(.75+.45*envS)+Math.sin(singPh*1.63+.6)*1.6*u;
  
      rot+=head/arm*kS;
      dx+=Math.sin(singPh-.5)*5*u*kS*(.8+.3*envS);
  
      dy-=((Math.cos(singPh*2)*.5+.5)*2.2*u+envS*4*u)*kS
    }
 
    if(mw.hop>.001){
      const kH=state.motionHop/100*mw.hop;
      hopPh+=dtp/.74;
      const ph=hopPh%1,
        J=Math.max(16*u,Math.min(64*u,geo.h*.055)),
        D=J*.2;
      let y=0;
      if(ph<.16)y=D*Math.sin(ph/.16*Math.PI);
      else if(ph<.66){const x=(ph-.16)/.5;y=-4*x*(1-x)*J}
      else if(ph<.82)y=D*1.15*Math.sin((ph-.66)/.16*Math.PI);
      dy+=y*kH
    }

    if(mw.shake>.001){
      const kX=state.motionShake/100*mw.shake,
        f=t*13;
      dx+=vnoise(f,.1)*6*u*kX;
      dy+=vnoise(f,.37)*2.6*u*kX;
      rot+=vnoise(f*.8,.71)*3*u/arm*kX
    }
 
    const c=curChar();
    if(c){
      if(c.breath)dy-=(Math.sin(t*TAU/3.8)*.5+.5)*3*u*k;
  
      if(c.mode==='single'){
        const a=Math.max(envS,popS*.5);
   
        if(c.talk==='hop')dy-=a*10*u*k+(Math.sin(t*TAU*2.3)*.5+.5)*a*6*u*k;
   else if(c.talk==='sway'){
          rot+=Math.sin(t*TAU*1.25)*a*9*u/arm*k;
          dx+=Math.sin(t*TAU*1.25-.4)*a*5*u*k
        }
      }
    }
 
    return {dx,dy,rot,sx:1,sy:1,pv};

  }
// Pre-scaled copy of each expression image at its on-screen size (same factor on both axes), so every frame is a
// plain copy instead of a high-quality resize of the original PNG. Very large results fall back to direct drawing.

  const avCache=new Map();

  function avSprite(im,r,f){
    const dw=r.w*f,
      dh=r.h*f,
      w=Math.ceil(dw),
      h=Math.ceil(dh);
    if(w*h>4200000||w>4096||h>4096)return null;
    const e=avCache.get(im);
    if(e&&e.f===f&&e.rx===r.x&&e.ry===r.y&&e.rw===r.w&&e.rh===r.h)return e;
    const c=e&&e.c.width===w&&e.c.height===h?e.c:document.createElement('canvas');
    c.width=w;
    c.height=h;
    const cg=c.getContext('2d');
    cg.clearRect(0,0,w,h);
    cg.imageSmoothingEnabled=true;
    cg.imageSmoothingQuality='high';
    cg.drawImage(im,r.x,r.y,r.w,r.h,0,0,dw,dh);
    const n={c,f,rx:r.x,ry:r.y,rw:r.w,rh:r.h,dw,dh};
    avCache.set(im,n);
    return n
  }
// Same normalized image rectangle for every expression avoids PNG dimension jitter.

  function drawAvatar(now,talking,blink){
 
    const __c=curChar(),
      __single=!!(__c&&__c.mode==='single'),
      idx=__single?0:(blink?2:0)+(talking?1:0),
      im=exprImage(talking)||(__single?images.png0:images['png'+idx]||images['png'+(talking?1:0)]||images.png0),
      pose=avatarPose(now,talking),
      geo=avatarGeom();
 
    g.save();
    {
      const __a=switchAlpha(now);
      if(__a<1)g.globalAlpha=__a
    }
    g.translate(geo.cx+pose.dx,pose.pv+pose.dy);
    g.rotate(pose.rot);
    g.translate(0,geo.bottom-pose.pv);
    g.imageSmoothingEnabled=true;
    g.imageSmoothingQuality=state.light?'medium':'high';
 
    if(im){
      const ref=images.png0||im;
      if(im.width===ref.width&&im.height===ref.height){
        const r=charRect(ref),
          f=Math.min(W/r.w,H/r.h)*state.scale/100;
        const sp=avSprite(im,r,f);
        if(sp)g.drawImage(sp.c,-sp.dw/2,-sp.dh);else g.drawImage(im,r.x,r.y,r.w,r.h,-r.w*f/2,-r.h*f,r.w*f,r.h*f)
      }else{
        const factor=Math.min(W/ref.width,H/ref.height)*state.scale/100;
        const w=im.width*factor,
          h=im.height*factor;
        g.drawImage(im,-w/2,-h,w,h)
      }
      g.restore();
      return
    }
 
    const s=state.scale/85;
    g.scale(s,s);
    g.translate(0,-243);
    g.fillStyle='#6b8b79';
    g.beginPath();
    g.roundRect(-108,38,216,205,[60,60,18,18]);
    g.fill();
    g.fillStyle='#f9f1df';
    g.beginPath();
    g.ellipse(0,-43,91,103,0,0,Math.PI*2);
    g.fill();
    g.strokeStyle='#385748';
    g.lineWidth=6;
    for(const ex of [-32,32]){
      g.beginPath();
      if(blink){
        g.moveTo(ex-12,-55);
        g.lineTo(ex+12,-55)
      }else g.ellipse(ex,-55,5,10,0,0,Math.PI*2);
      g.stroke()
    }
    g.beginPath();
    if(talking){
      g.ellipse(0,-5,14,20,0,0,Math.PI*2);
      g.fillStyle='#c47977';
      g.fill()
    }else{
      g.moveTo(-14,-6);
      g.quadraticCurveTo(0,5,14,-6);
      g.stroke()
    }
    g.restore();
 
    g.fillStyle=state.bg==='green'||state.bg==='blue'?'#111':'#6b7a6d';
    g.textAlign='center';
    g.font='18px sans-serif';
    g.fillText('動作確認用 / 4枚のPNGを登録してください',W/2,H-40)

  }
// Particles. Behaviour per season follows the original 純喫茶オトノハ motions:
// flutter = diagonal drift with flipping (spring), rise = soda bubbles wobbling more as they climb (summer),
// leaf = pendulum fall (autumn leaves), roll = nuts rolling and hopping along the floor (autumn), snow = slow fall with wide sway (winter).

  const particles=Array.from({length:100},(_,i)=>({
    i,
    beh:'',
    x:0,
    y:0,
    bx:0,
    r:0,
    size:8+rnd(i+.1)*12,
    drift:rnd(i+.2)*1.6-.8,
    vel:.4+rnd(i+.3),
    depth:.25+rnd(i+.4)*.75,
    phase:rnd(i+.5)*Math.PI*2,
    variant:i%3,
    dir:1,
    dist:0
  }));

  function behaviourOf(p,fx){
    if(fx==='spring')return 'flutter';
    if(fx==='summer')return 'rise';
    if(fx==='winter')return 'snow';
    if(fx==='autumn')return p.i%5===0?'roll':'leaf';
    if(isP(fx))return fxSet().imageMotion;
    return 'flutter'
  }

  function respawn(p,anywhere){
    const m=70*H/720;
    p.dist=0;
    p.r=rnd(p.i+performance.now())*Math.PI*2;
 
    if(p.beh==='roll'){
      p.dir=rnd(p.i*3.1+performance.now())<.5?1:-1;
      p.x=anywhere?Math.random()*W:(p.dir>0?-m:W+m);
      p.y=0;
      return
    }
 
    p.bx=p.x=Math.random()*W;
    if(p.beh==='rise')p.y=anywhere?Math.random()*(H+2*m)-m:H+m;else p.y=anywhere?Math.random()*(H+2*m)-m:-m
  }

  function updateSeasonParticles(dt,now){
    const fx=curEffect();
    if(fx==='none')return;
    const S=fxSet(),
      N=state.light?Math.min(S.count,40):S.count;
    const t=now/1000,
      u=H/720,
      m=70*u,
      TAU=Math.PI*2;
 
    for(let i=0;i<N;i++){
      const p=particles[i],
        beh=behaviourOf(p,fx);
      if(p.beh!==beh){
        p.beh=beh;
        respawn(p,true)
      }
  
      const v=S.speed*(.38+p.depth*.62)*p.vel*u;
  
      if(beh==='flutter'){
        p.y+=dt*v*.6;
        p.x+=dt*(v*.3+Math.sin(t*1.3*(.7+p.vel*.3)+p.phase)*16*u);
        p.r+=dt*p.drift*1.2
      }
  else if(beh==='rise'){
        p.y-=dt*v*.75;
        const pos=Math.min(1,Math.max(0,1-p.y/H));
        p.x=p.bx+Math.sin(t*2.6*(.6+p.vel*.4)+p.phase)*(5+pos*16)*u
      }
  else if(beh==='leaf'){
        const sw=Math.sin(t*1.5*(.7+p.vel*.3)+p.phase);
        p.y+=dt*v*.5*(.55+.9*Math.abs(Math.cos(t*1.5*(.7+p.vel*.3)+p.phase)));
        p.bx+=dt*p.drift*6*u;
        p.x=p.bx+sw*30*u;
        p.r=sw*.65+p.drift*.4
      }
  else if(beh==='snow'){
        p.y+=dt*v*.38;
        p.bx+=dt*p.drift*3*u;
        p.x=p.bx+Math.sin(t*.45*(.6+p.vel*.4)+p.phase)*28*u;
        p.r+=dt*p.drift*.06
      }
  else if(beh==='roll'){
        p.dist+=dt*v*1.7;
        p.x+=p.dir*dt*v*1.7;
        if(p.x<-m*1.5||p.x>W+m*1.5)respawn(p,false)
      }
  
      if(beh!=='roll'){
        const out=beh==='rise'?p.y<-m:p.y>H+m;
        if(out||p.x<-m*2||p.x>W+m*2)respawn(p,false)
      }
    }
  }

  function particleImages(){
    const p=presetOf(curEffect());
    if(!p)return [];
    const a=[];
    for(let n=0;n<6;n++){const im=images[pimg(p.id,n)];if(im)a.push(im)}
    return a
}

  function effects(dt,now,layer='front'){
 
    const fx=curEffect();
    if(fx==='none')return;
    const S=fxSet(),
      N=state.light?Math.min(S.count,40):S.count;
    const t=now/1000,
      geo=avatarGeom(),
      faceR=Math.max(.6,Math.min(1.6,geo.h/612)),
      pics=isP(fx)?particleImages():null;
 
    for(let i=0;i<N;i++){
  
      const p=particles[i];
      if(!p.beh||(p.depth<.58?'back':'front')!==layer)continue;
      const beh=p.beh;
  
      let size=p.size*(.5+p.depth*.9)*S.fxSize/100*(H>W?1.1:1),
        x=p.x,
        y=p.y,
        rot=p.r,
        flip=1;
  
      if(beh==='roll'){
        const step=size*(4.4+rnd(p.i+.6)*2.2),
          hop=(p.dist/step+rnd(p.i+.7))%1;
        y=H*(.885+p.depth*.08)-size*.9-size*(.5+rnd(p.i+.8)*.7)*4*hop*(1-hop);
        rot=p.dir*p.dist/(size*.95)
      }
  
      if(beh==='flutter')flip=Math.max(.14,Math.abs(Math.cos(t*2.2*(.6+p.depth*.4)+p.phase)));else if(beh==='leaf')flip=.45+.55*Math.abs(Math.cos(t*1.1+p.phase));
  
      const faceMask=Math.exp(-(((x-geo.cx)/(185*faceR))**2+((y-geo.faceY)/(170*faceR))**2));
  
      const op=S.fxOpacity/100,
        alpha=isP(fx)?(op>=1?1:op*(.55+p.depth*.45)):op*(.35+p.depth*.65)*(layer==='front'?1-faceMask*.65:1); // 画像のプリセットは「濃さ」最大で不透明
  
      let kind=fx==='spring'?(p.variant===2&&i%9===2?'blossom':'petal'):fx==='summer'?'bubble':fx==='autumn'?(beh==='roll'?'acorn':'leaf'):fx==='winter'?'snow':'image';
  
      if(fx==='winter'&&i%3!==0){
        kind='mote';
        size*=.53
      }
      if(fx==='summer'&&i%4===0){
        kind='mote';
        size*=.55
      }
      if(kind==='acorn')size*=.95;
  
      g.save();
      g.translate(x,y);
      g.rotate(rot+(beh==='flutter'?Math.sin(t/4.2+p.phase)*.22:0));
      g.globalAlpha=alpha;
      if(flip!==1)g.scale(flip,1);
  
      if(kind==='image'){
        if(pics.length){
          const im=pics[p.i%pics.length],
            fit=size*3.4/Math.max(im.width,im.height);
          g.drawImage(im,-im.width*fit/2,-im.height*fit/2,im.width*fit,im.height*fit)
        }
      }
  else drawElegantMotif(g,kind,size,p.variant===1?1:0);
  
      g.restore();
 
    }

  }


  let bgC=null,
    bgKey='',
    imgSeq=0;
  const imgIds=new WeakMap();
  const imgId=im=>{
    if(!imgIds.has(im))imgIds.set(im,++imgSeq);
    return imgIds.get(im)
  };

  function bgCached(key,paint){
    if(bgKey!==key||!bgC){
      bgC=bgC||document.createElement('canvas');
      bgC.width=W;
      bgC.height=H;
      const cg=bgC.getContext('2d');
      cg.clearRect(0,0,W,H);
      paint(cg);
      bgKey=key
    }
    g.clearRect(0,0,W,H);
    g.drawImage(bgC,0,0)
  }

  function coverImg(cg,im){
    const f=Math.max(W/im.width,H/im.height);
    cg.imageSmoothingEnabled=true;
    cg.imageSmoothingQuality='high';
    cg.drawImage(im,(W-im.width*f)/2,(H-im.height*f)/2,im.width*f,im.height*f)
  }

  function backgroundFill(bk){
    if(bk==='transparent'){
      g.clearRect(0,0,W,H);
      return
    }
    if(bk==='cafe'){
      bgCached('cafe'+W+'x'+H,cg=>{
        const grad=cg.createLinearGradient(0,0,W,H);
        grad.addColorStop(0,'#ecf0df');
        grad.addColorStop(.5,'#d2dfce');
        grad.addColorStop(1,'#a9c7b5');
        cg.fillStyle=grad;
        cg.fillRect(0,0,W,H);
        cg.strokeStyle='#ffffff65';
        cg.lineWidth=1;
        cg.strokeRect(32,32,W-64,H-64)
      });
      return
    }
    if(bk==='image'&&images.background){
      const im=images.background;
      bgCached('img'+imgId(im)+'_'+W+'x'+H,cg=>coverImg(cg,im));
      return
    }
    g.clearRect(0,0,W,H);
    g.fillStyle=({green:'#00ff00',blue:'#0000ff',black:'#000000',image:'#19241e'})[bk]||'#000';
    g.fillRect(0,0,W,H)
  }

  function background(){
    const c=curChar();
    if(c&&c.bgMode==='own'){
      const im=charImgs[charKey(state.charId,'bg')];
      if(im){
        bgCached('own'+imgId(im)+'_'+W+'x'+H,cg=>coverImg(cg,im));
        return
      }
    }
    backgroundFill(c&&c.bgMode&&c.bgMode!=='inherit'&&c.bgMode!=='own'?c.bgMode:state.bg)
  }

  function caption(){
    if(!state.show)return;
    const text=paragraphs()[paragraph];
    if(!text)return;
    g.font='26px sans-serif';
    const chars=[...text],
      lines=[];
    let line='';
    for(const c of chars){
      if(c==='\n'||g.measureText(line+c).width>W-190){
        lines.push(line);
        line=c==='\n'?'':c
      }else line+=c
    }
    if(line)lines.push(line);
    const visible=lines.slice(0,5),
      h=visible.length*38+30;
    g.fillStyle='#15231ddd';
    g.fillRect(60,H-60-h,W-120,h);
    g.fillStyle='white';
    g.textAlign='left';
    visible.forEach((s,i)=>g.fillText(s+(i===4&&lines.length>5?'…':''),85,H-60-h+42+i*38))
  }
