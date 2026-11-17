/* 漫符と、草・ハート（0.10.12）
   漫符：立ち絵の頭の上（avHead）を元に出す。顔には被せない。表情に付けておく（80-expressions.js）か、本番の「👗 表情」タブのボタンで出す。
   草・ハート：本番の「🔊 効果音」タブのテロップの欄の「リアクション」。押すたびに決めた数だけ出す。
   初めの絵は、八頭身の立ち絵に添える前提の、細い線と淡いグラデーションの絵（ここで描く）。どれも PNG に差し替えられる（images['deco-…']、.live にも入る）。
   動きは、移動・回転・縦横同じ倍率の拡大縮小・フェードだけ。表情の切り替え・歌い始め・「テロップ・演出を消す」で止まる */

  const MANPU={sweat:{name:'汗',img:'deco-sweat'},spark:{name:'きらめき（笑い）',img:'deco-spark'},heart:{name:'ハート',img:'deco-mheart'}};
  const DECO_IMG_IDS=['deco-sweat','deco-spark','deco-mheart','deco-grass','deco-heart'];
  const DECO_IMG_NAME={'deco-sweat':'汗','deco-spark':'きらめき（笑い）','deco-mheart':'漫符のハート','deco-grass':'草（ころころ）','deco-heart':'ハート（ふわふわ）'};
  const decoCfg=()=>state.deco||(state.deco={n:5,sec:5,sing:true});
  // 漫符の大きさ・量・位置：いまのキャラクターの、その漫符の値（まだ決めていなければ、前の版の共通の値）
  function mpCfg(kind){
    const m=curChar()?.mp?.[kind];if(m)return m;
    const d=decoCfg();return {s:d.msize||100,a:d.mamt||'mid',x:d.mx||0,y:d.my||0}
  }
  function mpSet(kind,patch){
    const c=curChar();if(!c)return;
    c.mp=c.mp||{};c.mp[kind]=Object.assign({},mpCfg(kind),patch)
  }
  // 草・ハート：それぞれの数・大きさ・秒数
  function rcCfg(kind){
    const d=decoCfg();d.r=d.r||{};
    return d.r[kind]||(d.r[kind]={n:d.n||5,s:d.rsize||100,sec:kind==='heart'?(d.sec||5):5})
  }

  // ---- 初めの絵（中心が 0,0、大きさ 1 くらいで描く。呼ぶ側で縦横同じ倍率に拡大する）
  function artDrop(c){
    // しずく：とがった先が上。淡い水色のグラデーション、細いふち、白い光
    const gr=c.createLinearGradient(0,-.5,0,.5);gr.addColorStop(0,'rgba(236,248,255,.95)');gr.addColorStop(1,'rgba(150,205,236,.95)');
    c.beginPath();c.moveTo(0,-.5);c.bezierCurveTo(.08,-.28,.3,-.05,.3,.17);c.arc(0,.17,.3,0,Math.PI);c.bezierCurveTo(-.3,-.05,-.08,-.28,0,-.5);c.closePath();
    c.fillStyle=gr;c.fill();c.lineWidth=.035;c.strokeStyle='rgba(84,140,178,.8)';c.stroke();
    c.beginPath();c.moveTo(-.14,.05);c.quadraticCurveTo(-.17,.2,-.08,.3);c.lineWidth=.05;c.lineCap='round';c.strokeStyle='rgba(255,255,255,.9)';c.stroke()
  }
  function artStar(c){
    // 4つの先を持つ細い星：金から白へ
    const gr=c.createRadialGradient(0,0,0,0,0,.5);gr.addColorStop(0,'rgba(255,255,250,1)');gr.addColorStop(.45,'rgba(255,236,170,.95)');gr.addColorStop(1,'rgba(232,186,96,.0)');
    c.beginPath();
    for(let i=0;i<4;i++){const a=i*Math.PI/2;c.lineTo(Math.cos(a)*.5,Math.sin(a)*.5);c.quadraticCurveTo(0,0,Math.cos(a+Math.PI/4)*.07,Math.sin(a+Math.PI/4)*.07)}
    c.closePath();c.fillStyle=gr;c.fill();
    c.lineWidth=.02;c.strokeStyle='rgba(214,170,80,.7)';c.stroke()
  }
  function artHeart(c,light){
    // ハート：ばら色のグラデーション、細いふち、白い光の筋
    const gr=c.createLinearGradient(-.4,-.4,.4,.45);gr.addColorStop(0,light?'rgba(255,228,238,.97)':'rgba(255,214,228,.97)');gr.addColorStop(1,light?'rgba(244,140,178,.95)':'rgba(226,92,140,.95)');
    c.beginPath();c.moveTo(0,.42);c.bezierCurveTo(-.12,.3,-.5,.08,-.48,-.14);c.bezierCurveTo(-.46,-.38,-.16,-.46,0,-.24);c.bezierCurveTo(.16,-.46,.46,-.38,.48,-.14);c.bezierCurveTo(.5,.08,.12,.3,0,.42);c.closePath();
    c.fillStyle=gr;c.fill();c.lineWidth=.03;c.strokeStyle='rgba(176,64,110,.55)';c.stroke();
    c.beginPath();c.moveTo(-.3,-.2);c.quadraticCurveTo(-.3,-.32,-.18,-.33);c.lineWidth=.045;c.lineCap='round';c.strokeStyle='rgba(255,255,255,.85)';c.stroke()
  }
  function artGrass(c){
    // ハーブの小枝：細い茎と、葉脈の入った細長い葉
    c.lineCap='round';
    c.beginPath();c.moveTo(0,.48);c.bezierCurveTo(.02,.2,-.03,-.1,.02,-.46);c.lineWidth=.035;c.strokeStyle='rgba(92,136,82,.9)';c.stroke();
    const leaves=[[.3,-1,.36],[.12,1,.4],[-.08,-1,.42],[-.26,1,.38],[-.42,-1,.3]];
    for(const [y,sd,len] of leaves){
      c.save();c.translate(0,y);c.rotate(sd*.95);
      const gr=c.createLinearGradient(0,0,0,-len);gr.addColorStop(0,'rgba(108,168,96,.95)');gr.addColorStop(1,'rgba(196,232,168,.95)');
      c.beginPath();c.moveTo(0,0);c.bezierCurveTo(.1,-len*.25,.08,-len*.75,0,-len);c.bezierCurveTo(-.08,-len*.75,-.1,-len*.25,0,0);c.closePath();
      c.fillStyle=gr;c.fill();c.lineWidth=.016;c.strokeStyle='rgba(76,120,70,.7)';c.stroke();
      c.beginPath();c.moveTo(0,-len*.08);c.lineTo(0,-len*.85);c.lineWidth=.012;c.strokeStyle='rgba(236,250,224,.75)';c.stroke();
      c.restore()
    }
  }
  // 画像に差し替えてあれば画像（縦横の比はそのまま。長いほうの辺を size に合わせる）、なければ初めの絵
  function decoPaint(id,art,size,extra){
    const im=images[id];
    if(im&&im.width&&im.height){const f=size/Math.max(im.width,im.height);g.drawImage(im,-im.width*f/2,-im.height*f/2,im.width*f,im.height*f);return}
    // 初めの絵は、一度だけ小さなキャンバスに描いておき、毎コマはそれを貼るだけにする（グラデーションや曲線を毎コマ描き直さない）
    if(size<=ART_PX*1.25){const sp=artSprite(art,extra),d=size*ART_BOX/ART_PX;g.drawImage(sp,-d/2,-d/2,d,d);return}
    g.save();g.scale(size,size);art(g,extra);g.restore()
  }
  const ART_PX=144,ART_BOX=160,artSprites=new Map();
  function artSprite(art,extra){
    const key=art.name+(extra?'+':'');let c=artSprites.get(key);
    if(!c){c=document.createElement('canvas');c.width=c.height=ART_BOX;const x=c.getContext('2d');x.translate(ART_BOX/2,ART_BOX/2);x.scale(ART_PX,ART_PX);art(x,extra);artSprites.set(key,c)}
    return c
  }

  // ---- 漫符
  const manpuOn=new Map();   // id → {start, until(0＝止めるまで), next}
  let manpuParts=[];
  function manpuStart(id,ms){
    if(!MANPU[id])return;
    const now=performance.now();
    manpuOn.set(id,{start:now,until:ms?now+ms:0,next:now});
    renderManpuBar()
  }
  function manpuStop(id){
    if(id){manpuOn.delete(id);manpuParts=manpuParts.filter(p=>p.kind!==id)}
    else{manpuOn.clear();manpuParts=[]}
    renderManpuBar()
  }
  // 漫符の量：少なめ（2〜3コ）／ふつう／多め（とても焦る様子）
  const MANPU_AMT={few:{sweat:3,spark:3,heart:2},mid:{sweat:5,spark:5,heart:3},many:{sweat:8,spark:7,heart:5}};
  function manpuEmit(id,now){
    const mc=mpCfg(id),amt=MANPU_AMT[mc.a]||MANPU_AMT.mid,n=Math.max(1,Math.round(amt[id]*(state.light?.6:1)));
    if(id==='sweat'){
      // 汗：頭のまわり（顔の外）に、上半分の弧に沿って並べる。しずくの先はキャラクター（頭の中心）へ向ける。ぴ・ぴ・ぴと順に出る
      const few=mc.a==='few';
      const a0=few?-62:-168,a1=few?-14:-12;
      for(let i=0;i<n;i++){
        const t=n===1?.5:i/(n-1),a=(a0+(a1-a0)*t+(Math.random()-.5)*8)*Math.PI/180;
        manpuParts.push({kind:id,at:now+i*70,life:850,a,r:1.02+Math.random()*.1,sz:.3+Math.random()*.06})
      }
      return 1050
    }
    if(id==='spark'){
      // きらめき：頭の上で、細い光の線と星がはじける
      manpuParts.push({kind:id,at:now,life:1100,ray:1,sz:.75});
      for(let i=0;i<n;i++){const a=(-160+140*(n===1?.5:i/(n-1))+(Math.random()-.5)*10)*Math.PI/180;manpuParts.push({kind:id,at:now+60+i*50,life:1000,a,r:1.0+Math.random()*.25,sz:.22+Math.random()*.1,rot:Math.random()*.6,out:.2})}
      return 1500
    }
    // ハート：頭の上の幅いっぱいから、まんべんなく上へ
    for(let i=0;i<n;i++){const t=n===1?.5:i/(n-1);manpuParts.push({kind:id,at:now+i*160+Math.random()*80,life:1600,hx:(t-.5)*1.3+(Math.random()-.5)*.15,up:1,sz:.24+Math.random()*.06})}
    return 1200
  }
  function drawManpu(now){
    if(!manpuOn.size&&!manpuParts.length)return;
    for(const [id,m] of manpuOn){
      if(m.until&&now>m.until){manpuOn.delete(id);renderManpuBar();continue}
      if(now>=m.next)m.next=now+manpuEmit(id,now)
    }
    manpuParts=manpuParts.filter(p=>now-p.at<p.life);
    if(!avHead)return;
    const cos=Math.cos(avHead.rot),sin=Math.sin(avHead.rot);
    const at=(dx,dy)=>({x:avHead.x+dx*cos-dy*sin,y:avHead.y+dx*sin+dy*cos});
    // 漫符ごとに、大きさ・位置を決める（このキャラクターの、その漫符の設定）
    const lay={};
    for(const kind of ['sweat','spark','heart']){
      const mc=mpCfg(kind);
      // 頭の大きさのめやす：八頭身なら立ち絵の高さの 1/8 くらい。「大きさ」で拡大・縮小する
      const hu=avHead.h/7.5*mc.s/100;
      // 頭の中心（てっぺんから少し下）。「位置」で上下・左右にずらす（頭の大きさに対する％）
      // 0.11.2：画面の端で内側へ寄せる・押し下げる処理はやめた（端でつっかえたように見えるため）。決めた位置にそのまま出す
      const cx0=mc.x/100*hu,cy0=hu*.55+mc.y/100*hu;
      lay[kind]={hu,cx0,cy0}
    }
    for(const p of manpuParts){
      const e=now-p.at;if(e<0)continue;
      const {hu,cx0,cy0}=lay[p.kind];
      const t=e/p.life,fade=Math.min(1,(p.life-e)/280);
      g.save();g.globalAlpha=Math.min(1,e/120,fade);
      let lx,ly,rot=0;
      if(p.up){lx=cx0+p.hx*hu*.5+Math.sin(e/260+p.hx*3)*hu*.06;ly=cy0-hu*.75-easeOut(Math.min(1,t*1.2))*hu*.9}
      else if(p.ray){lx=cx0;ly=cy0-hu*.95}
      else{
        // 頭の中心から、顔の外（頭の大きさの 0.75 倍くらい）へ。出るときに少し外へ動く
        const r=hu*(.12+.62*(p.r+(p.out||0)*easeOut(Math.min(1,t*1.5))+.06*easeOut(Math.min(1,e/220))));
        lx=cx0+Math.cos(p.a)*r;ly=cy0+Math.sin(p.a)*r;
        rot=p.a-Math.PI/2   // しずくの先（絵の上）を、頭の中心へ向ける
      }
      const c=at(lx,ly);
      const size=Math.max(8,p.sz*hu)*(e<200?.4+.6*backOut(e/200):1);
      g.translate(c.x,c.y);g.rotate(avHead.rot);
      if(p.ray){
        const r0=hu*.18,r1=r0+p.sz*hu*easeOut(Math.min(1,t*1.6));
        // 9本の光の線を、1つのグラデーション・1回の線描きで（内側は透明、外側が金色）
        const gr=g.createRadialGradient(0,0,r0,0,0,r1);gr.addColorStop(0,'rgba(255,246,214,0)');gr.addColorStop(1,'rgba(255,232,170,.9)');
        g.lineCap='round';g.lineWidth=Math.max(1,hu*.02);g.strokeStyle=gr;g.beginPath();
        for(let i=0;i<9;i++){const a=-Math.PI+i*Math.PI/8,ca=Math.cos(a),sa=Math.sin(a);g.moveTo(ca*r0,sa*r0);g.lineTo(ca*r1,sa*r1)}
        g.stroke()
      }else{
        g.rotate(p.kind==='sweat'?rot:(p.rot||0));
        if(p.kind==='sweat')decoPaint('deco-sweat',artDrop,size);
        else if(p.kind==='spark')decoPaint('deco-spark',artStar,size);
        else decoPaint('deco-mheart',artHeart,size,1)
      }
      g.restore()
    }
  }

  // ---- 草・ハート（画面の上に出す）
  let decos=[];
  // 25-telop.js が先に読まれて呼ぶので、var（読み込む前は undefined）で準備ができたかを見る
  var decoReady;
  function decoBusy(){return !!decoReady&&(decos.length>0||manpuOn.size>0)}
  function decoClear(){decos=[];if(typeof renderTelopNow==='function')renderTelopNow()}
  function decoSpawn(kind){
    const rc=rcCfg(kind),now=performance.now(),k=Math.min(W,H)/720,n=Math.min(rc.n,state.light?5:12),rs=rc.s/100;
    for(let i=0;i<n;i++){
      if(kind==='grass'){
        // 秒数：画面の端から端まで跳ねていくのにかかる時間（1つずつ少しずつ違う）
        const fromL=Math.random()<.5,sz=(46+Math.random()*26)*k*rs;
        decos.push({kind,at:now+i*180,fromL,sz,y:H-sz*.6-Math.random()*60*k,v:(W+sz*2)/(rc.sec*(.85+Math.random()*.3)),T:.34+Math.random()*.08,hh:.5+Math.random()*.25})
      }else{
        const sz=(34+Math.random()*30)*k*rs;
        decos.push({kind,at:now+i*140,sz,x:W*(.12+Math.random()*.76),y0:H+sz,v:(70+Math.random()*50)*k,life:rc.sec*1000,ph:Math.random()*Math.PI*2})
      }
    }
    if(decos.length>80)decos=decos.slice(-80);
    if(typeof renderTelopNow==='function')renderTelopNow()
  }
  function drawDeco(now){
    if(!decos.length)return;
    const before=decos.length;
    decos=decos.filter(d=>{
      const e=(now-d.at)/1000;
      if(d.kind==='grass')return e<0||e*d.v<W+d.sz*2;
      return e<0||e*1000<d.life
    });
    if(decos.length!==before&&!decos.length&&typeof renderTelopNow==='function')renderTelopNow();
    for(const d of decos){
      const e=(now-d.at)/1000;if(e<0)continue;
      g.save();
      if(d.kind==='grass'){
        // ぴょんぴょん：テンポよく跳ねながら横へ進む。1回跳ぶごとに、くるっと4分の1回る
        const dist=e*d.v,x=d.fromL?-d.sz+dist:W+d.sz-dist,ph=e/d.T,hop=Math.floor(ph),f=ph-hop;
        const y=d.y-4*f*(1-f)*d.sz*d.hh;
        g.globalAlpha=Math.min(1,e*5);
        g.translate(x,y);g.rotate((d.fromL?1:-1)*(hop+(f<.5?2*f*f:1-2*(1-f)*(1-f)))*Math.PI/2);
        decoPaint('deco-grass',artGrass,d.sz)
      }else{
        // ふわふわ：ゆっくり上がりながら左右にゆれ、決めた秒数で消える
        const life=d.life/1000;
        g.globalAlpha=Math.min(1,e*3,Math.max(0,(life-e)/.8));
        g.translate(d.x+Math.sin(e*1.8+d.ph)*d.sz*.5,d.y0-e*d.v);g.rotate(Math.sin(e*1.6+d.ph)*.18);
        decoPaint('deco-heart',artHeart,d.sz)
      }
      g.restore()
    }
  }

  // ---- 画面
  function renderManpuBar(){
    const bar=E('manpuBar');
    for(const b of bar.querySelectorAll('[data-manpu]'))b.setAttribute('aria-pressed',String(manpuOn.has(b.dataset.manpu)));
    E('manpuStop').disabled=!manpuOn.size;
    if(decoReady)renderTelopNow()
  }
  {
    const bar=E('manpuBar');
    bar.replaceChildren(Object.assign(document.createElement('span'),{className:'studio-mini',textContent:'漫符'}),
      ...Object.entries(MANPU).map(([id,m])=>{const b=document.createElement('button');b.type='button';b.dataset.manpu=id;b.textContent=m.name;b.title='押すと出し続けます。もう一度押すと止まります（表情を切り替えても止まります）';b.setAttribute('aria-pressed','false');b.onclick=()=>{manpuOn.has(id)?manpuStop(id):manpuStart(id,0)};return b}),
      Object.assign(document.createElement('button'),{type:'button',id:'manpuStop',textContent:'漫符を止める',onclick:()=>manpuStop()}));
    renderManpuBar()
  }
  // ---- 設定（設定の画面の「表情と演出」）：漫符はこのキャラクターの漫符ごと、草・ハートはそれぞれ
  function renderManpuOpts(){
    const kind=E('mpKind').value||'sweat',m=mpCfg(kind);
    E('mpWho').textContent=curChar()?.name||'';
    E('manpuSize').value=m.s;E('manpuSizeOut').textContent=m.s+'%';
    E('manpuAmt').value=m.a;
    E('manpuY').value=m.y;E('manpuYOut').textContent=(m.y>0?'下へ ':m.y<0?'上へ ':'')+Math.abs(m.y)+'%';
    E('manpuX').value=m.x;E('manpuXOut').textContent=(m.x>0?'右へ ':m.x<0?'左へ ':'')+Math.abs(m.x)+'%'
  }
  E('mpKind').onchange=renderManpuOpts;
  for(const [id,k] of [['manpuSize','s'],['manpuY','y'],['manpuX','x']])E(id).oninput=e=>{mpSet(E('mpKind').value,{[k]:Number(e.target.value)||(k==='s'?100:0)});renderManpuOpts();save()};
  E('manpuAmt').onchange=e=>{mpSet(E('mpKind').value,{a:e.target.value});save()};
  E('manpuTry').onclick=()=>manpuStart(E('mpKind').value,3200);
  E('manpuReset').onclick=()=>{mpSet(E('mpKind').value,{s:100,a:'mid',x:0,y:0});renderManpuOpts();save()};
  renderManpuOpts();
  function renderRcOpts(){
    const kind=E('rcKind').value||'grass',r=rcCfg(kind);
    E('decoN').value=String(r.n);E('decoSize').value=String(r.s);E('decoSec').value=String(r.sec);
    E('decoSecLab').firstChild.textContent=kind==='grass'?'画面を横切る秒数':'消えるまでの秒数'
  }
  E('rcKind').onchange=renderRcOpts;
  for(const [id,k] of [['decoN','n'],['decoSize','s'],['decoSec','sec']])E(id).onchange=e=>{rcCfg(E('rcKind').value)[k]=Number(e.target.value);save()};
  E('rcTry').onclick=()=>decoSpawn(E('rcKind').value);
  renderRcOpts();
  E('decoGrass').onclick=()=>decoSpawn('grass');
  E('decoHeart').onclick=()=>decoSpawn('heart');
  E('decoSing').checked=decoCfg().sing!==false;E('decoSing').onchange=e=>{decoCfg().sing=e.target.checked;save()};
  // 自分の画像に差し替える欄（設定の画面）
  function renderDecoImgs(){
    for(const box of document.querySelectorAll('[data-deco-imgs]')){
      box.replaceChildren(...box.dataset.decoImgs.split(',').map(id=>{
        const row=document.createElement('div');row.className='deco-img-row';
        const nm=document.createElement('span');nm.className='deco-img-name';nm.textContent=DECO_IMG_NAME[id]+'：'+(assetBlobs[id]?(state.assetNames[id]||'自分の画像'):'初めの絵');
        const lb=document.createElement('label');lb.className='btn';lb.textContent='画像を選ぶ';
        const inp=document.createElement('input');inp.type='file';inp.accept='image/png,image/webp';inp.hidden=true;inp.dataset.decoFile=id;lb.append(inp);
        inp.onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(!ready)throw Error('保存領域の準備中です。少し待ってください');await installAsset(id,f,f.name);renderDecoImgs();toast(DECO_IMG_NAME[id]+'を自分の画像にしました')}catch(err){toast(err.message,5000)}finally{e.target.value=''}};
        row.append(nm,lb);
        if(assetBlobs[id]){const del=document.createElement('button');del.type='button';del.className='btn';del.textContent='初めの絵に戻す';del.onclick=async()=>{try{await deleteAsset(ASSET+id)}catch(_){}delete images[id];delete assetBlobs[id];delete state.assetNames[id];save();renderDecoImgs()};row.append(del)}
        return row}))
    }
  }
  renderDecoImgs();
  decoReady=true;renderTelopNow();
  window.__otonohaDeco={mp:k=>mpCfg(k),rc:k=>rcCfg(k),manpu:()=>[...manpuOn.keys()],parts:()=>manpuParts.length,decos:()=>decos.map(d=>d.kind),head:()=>avHead&&{x:Math.round(avHead.x),y:Math.round(avHead.y),h:Math.round(avHead.h)},renderImgs:renderDecoImgs};
