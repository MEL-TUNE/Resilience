/* v0.4.8 layout: 表情と演出 and 窓辺の映像演出 live in 設定; 音のお品書き sits beside the stage. */

(function(){
  const ws=document.querySelector('.studio-workspace'),
    aside=ws&&ws.querySelector(':scope>aside'),
    board=document.getElementById('boardShell'),
    setC=document.querySelector('#settingsShell .content'),
    film=document.querySelector('#takesShell .film-panel');
  if(!ws||!aside||!board||!setC)return;
 
  const sec=document.createElement('section');
  sec.className='panel studio-settings';
  sec.id='studioSettings';
  sec.setAttribute('aria-label','表情と演出');
 
  sec.innerHTML='<div class="ss-grid"><div class="ss-prev"><div class="ss-prev-box"><canvas id="settingsPreview" width="640" height="360" aria-label="映像のプレビュー"></canvas></div><p class="studio-note">配信画面と同じ映像です。右の設定を変えるとここに反映されます。</p></div></div>';
 
  sec.querySelector('.ss-grid').append(aside);
  const title=setC.querySelector(':scope>.section-title');
  if(title)title.after(sec);else setC.prepend(sec);
 
    {
      const grp=(id,title,sub)=>{const h=document.createElement('h2');h.className='set-group';h.id=id;h.innerHTML=title+(sub?'<small>'+sub+'</small>':'');return h};
      const panel=lbl=>setC.querySelector(':scope>section.panel[aria-labelledby="'+lbl+'"]');
      const gLive=grp('setLive','配信・録画（PNGTuber）の設定',''),gRadio=grp('setRadio','ラジオ（音声のみ）の設定',''),gCommon=grp('setCommon','共通の設定','配信・ラジオの両方で使います');
      sec.before(gLive);
      let last=sec;
      const mp=document.getElementById('mascotPanel');
      if(mp){last.after(mp);last=mp}
      const sd=document.getElementById('sceneSettings');
      if(sd){const w=document.createElement('section');w.className='studio-card scene-card';w.append(sd);last.after(w);last=w}
      last.after(gRadio);last=gRadio;
      const endP=panel('endTitle');if(endP){last.after(endP);last=endP}
      if(film){film.classList.add('film-in-settings');const n=document.createElement('p');n.className='note';n.textContent='収録したテイク（音声）を動画として書き出すときの演出です。';film.querySelector('h3')?.after(n);last.after(film);last=film}
      last.after(gCommon);last=gCommon;
      for(const l of ['lookTitle','mixTitle','duckTitle','micTitle','fileTitle']){const p=panel(l);if(p){last.after(p);last=p}}
    }
    if(false&&film){
    film.classList.add('film-in-settings');
    const n=document.createElement('p');
    n.className='note';
    n.textContent='収録したテイク（音声）を動画として書き出すときの演出です。';
    film.querySelector('h3')?.after(n);
    sec.after(film)
  }
 
  ws.append(board);
  board.classList.add('in-workspace');
  const rb=document.querySelector('.recbar');
  if(rb)ws.before(rb);
 
  const mb=document.getElementById('miniBar'),
    upd=()=>document.documentElement.style.setProperty('--mini-h',(mb&&!mb.hidden?mb.offsetHeight:0)+'px');
  if(mb){
    new MutationObserver(upd).observe(mb,{attributes:true,attributeFilter:['hidden']});
    if(window.ResizeObserver)new ResizeObserver(upd).observe(mb)
  }
  upd()
})();

/* Otonoha visual studio 0.4.3 — uses the original page's audio buses and asset DB.
   0.4.1: video capture shares the original monitor protection (studioCapturing), frames keep running while the tab is hidden (scheduleFrame), registered image types match the JSON importer. */

(()=>{

  'use strict';

  const E=id=>document.getElementById(id),
    KEY_S=(typeof OTONOHA_NS==='string'&&OTONOHA_NS)?'haishin-visual-studio-v1':'otonoha-visual-studio-v1',
    ASSET='visual-studio:',
    slotNames=['目開き・口閉じ','目開き・口開き','目閉じ・口閉じ','目閉じ・口開き'],
    PARTICLE_IDS=['particle','particle1','particle2','particle3','particle4','particle5'];

  const defaults={
    threshold:-38,
    hold:140,
    blink:true,
    scale:85,
    x:0,
    y:0,
    bounce:true,
    effect:'none',
    count:35,
    speed:40,
    fxSize:100,
    fxOpacity:72,
    bg:'cafe',
    title:'',
    cue:'',
    prompt:'',
    script:'',
    show:false,
    songs:[],
    assetNames:{},
    scenes:{standby:{bgm:'keep',effect:'keep',avatar:true,text:''},away:{bgm:'keep',effect:'keep',avatar:false,text:''},end:{bgm:'keep',effect:'keep',avatar:false,text:'ご視聴ありがとうございました'}},
    mascots:[],
    speaker:'self',
    sceneBoost:6,
    restoreBgm:true,
    sinkId:'',
    aspect:'landscape',
    motionAmt:100,
    motionSing:100,
    motionSingSpeed:100,
    motionHop:100,
    motionShake:100,
    fxSeason:null,
    fxPresets:null,
fps:30,
    light:false,
    imageMotion:'flutter',
    karaChannels:null,
    karaOpen:'popup',
    karaVol:100,
    karaSuppress:true,
    karaAutoFade:true,
    karaFadeEnv:false,
    profiles:null,
    chars:null,
    profileId:'',
    charId:'',
    switchFx:'fade',
    padSize:'m'
  };

  let state={...defaults},
    images={},
    assetBlobs={},
    ready=false,
    outputWindow=null,
    outContext=null,
    mouth=false,
    lastTalk=0,
    testUntil=0,
    nextBlink=performance.now()+3200,
    blinkUntil=0,
    paragraph=0,
    mediaRecorder=null,
    videoStream=null,
    videoDest=null,
    recordStart=0,
    recordChunks=[],
    videoUrls=[],
    closing=false,
    captureStarting=false;

  var CHAR_KEYS=['threshold','hold','blink','bounce','scale','x','y','motionAmt','motionSing','motionSingSpeed','motionHop','motionShake'],
    CHAR_RANGES={
    threshold:[-65,-5],
    hold:[40,600],
    scale:[10,500],
    x:[-300,300],
    y:[-200,500],
    motionAmt:[0,200],
    motionSing:[0,200],
    motionSingSpeed:[40,200],
    motionHop:[0,200],
    motionShake:[0,200]
  };
  var charBlobs={},
    charImgs={},
    switchAt=-1e9,
    charUrls=[],
    trimCache=new WeakMap(); 
  try{
    const saved=JSON.parse(localStorage.getItem(KEY_S)||'null');
    if(saved&&typeof saved==='object')state={...defaults,...saved}
  }catch(_){}

  const canvas=E('studioCanvas'),
    g=canvas.getContext('2d'),
    levelData=new Float32Array(2048);

  function save(){
    try{
      syncChar()
    }catch(_){}
    try{
      localStorage.setItem(KEY_S,JSON.stringify(state))
    }catch(e){
      toast('スタジオ設定を保存できません。設定を書き出してください',5000)
    }
  }

  function sanitize(v){
    v=v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    const out={...defaults};
    for(const k of ['threshold','hold','scale','x','y','count','speed','fxSize','fxOpacity']){
      const ranges={threshold:[-65,-5],hold:[40,600],scale:[10,500],x:[-300,300],y:[-200,500],count:[5,100],speed:[10,150],fxSize:[35,200],fxOpacity:[10,100]};
      const n=Number(v[k]);
      if(Number.isFinite(n))out[k]=Math.max(ranges[k][0],Math.min(ranges[k][1],n))
    }
    for(const k of ['blink','bounce','show'])if(typeof v[k]==='boolean')out[k]=v[k];
    for(const k of ['title','cue','prompt','script'])if(typeof v[k]==='string')out[k]=v[k].slice(0,150000);
    {const ev=v.effect==='image'?'p:img':v.effect;if((['none','spring','summer','autumn','winter'].includes(ev)||/^p:[a-z0-9]{1,24}$/.test(ev)))out.effect=ev}
    if(['cafe','transparent','green','blue','black','image'].includes(v.bg))out.bg=v.bg;
    if(Array.isArray(v.songs))out.songs=v.songs.slice(0,300).filter(x=>x&&typeof x.title==='string').map(x=>({title:x.title.slice(0,200),artist:String(x.artist||'').slice(0,200)}));
    out.assetNames=v.assetNames&&typeof v.assetNames==='object'?v.assetNames:{};
    out.scenes={};
    for(const k of ['standby','away','end'])out.scenes[k]=sceneClean(k,v.scenes&&typeof v.scenes==='object'?v.scenes[k]:null);
    if(typeof v.restoreBgm==='boolean')out.restoreBgm=v.restoreBgm;
    if(typeof v.sinkId==='string')out.sinkId=v.sinkId.slice(0,300);
    if(['landscape','portrait'].includes(v.aspect))out.aspect=v.aspect;
    for(const k of ['motionAmt','motionSing','motionSingSpeed','motionHop','motionShake']){
      const n=Number(v[k]);
      if(Number.isFinite(n))out[k]=Math.max(CHAR_RANGES[k][0],Math.min(CHAR_RANGES[k][1],n))
    }
    if(['flutter','leaf','rise','snow','roll'].includes(v.imageMotion))out.imageMotion=v.imageMotion;
    if(Array.isArray(v.karaChannels))out.karaChannels=v.karaChannels.slice(0,60).filter(x=>x&&typeof x==='object').map(x=>({name:String(x.name||'').slice(0,80),url:String(x.url||'').slice(0,300),memo:String(x.memo||'').slice(0,300)}));
    if(['popup','tab'].includes(v.karaOpen))out.karaOpen=v.karaOpen;
    {
      const n=Number(v.karaVol);
      if(Number.isFinite(n))out.karaVol=Math.max(0,Math.min(150,n))
    }
    if(typeof v.karaSuppress==='boolean')out.karaSuppress=v.karaSuppress;
    if(typeof v.karaAutoFade==='boolean')out.karaAutoFade=v.karaAutoFade;
    if(typeof v.karaFadeEnv==='boolean')out.karaFadeEnv=v.karaFadeEnv;
    {
      const fs={},
        src=v.fxSeason&&typeof v.fxSeason==='object'?v.fxSeason:{},
        R={count:[5,100],speed:[10,150],fxSize:[35,200],fxOpacity:[10,100]};
      for(const e of ['spring','summer','autumn','winter']){
        const x=src[e]&&typeof src[e]==='object'?src[e]:{},
          o={};
        for(const k in R){
          const n=Number(x[k]);
          o[k]=Number.isFinite(n)?Math.max(R[k][0],Math.min(R[k][1],n)):out[k]
        }
        o.imageMotion=['flutter','leaf','rise','snow','roll'].includes(x.imageMotion)?x.imageMotion:out.imageMotion;
        fs[e]=o
      }
      out.fxSeason=fs;
      // v0.4.9: image presets (each has its own images and settings). The old single image set becomes preset 'img'.
      const MV=['flutter','leaf','rise','snow','roll'],mk=(x,id,name)=>{const o={id,name:String(name||'画像のプリセット').slice(0,30)};for(const k in R){const n=Number(x[k]);o[k]=Number.isFinite(n)?Math.max(R[k][0],Math.min(R[k][1],n)):out[k]}o.imageMotion=MV.includes(x.imageMotion)?x.imageMotion:'flutter';return o};
      out.fxPresets=[];
      if(Array.isArray(v.fxPresets)){const seenP=new Set();for(const x of v.fxPresets.slice(0,30)){if(!x||typeof x!=='object'||typeof x.id!=='string'||!/^[a-z0-9]{1,24}$/.test(x.id)||seenP.has(x.id))continue;seenP.add(x.id);out.fxPresets.push(mk(x,x.id,x.name))}}
      else{const x=src.image&&typeof src.image==='object'?src.image:{imageMotion:out.imageMotion};out.fxPresets.push(mk(x,'img','好きな画像'))}
      const okP=e=>!/^p:/.test(e)||out.fxPresets.some(p=>'p:'+p.id===e);
      if(!okP(out.effect))out.effect='none';
      for(const k of ['standby','away','end'])if(!okP(out.scenes[k].effect))out.scenes[k].effect='keep'
    }
out.fps=[10,15,30].includes(Number(v.fps))?Number(v.fps):30;
    out.light=v.light===true;
    {const MV=['float','sway','hop','shake','still'],num=(x,a,b,df)=>{const n=Number(x);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):df},seenM=new Set();out.mascots=[];
     if(Array.isArray(v.mascots))for(const m of v.mascots.slice(0,8)){if(!m||typeof m!=='object'||typeof m.id!=='string'||!/^[a-z0-9]{1,12}$/.test(m.id)||seenM.has(m.id))continue;seenM.add(m.id);out.mascots.push({id:m.id,name:String(m.name||'マスコット').slice(0,20),show:m.show!==false,talk:m.talk===true,motion:MV.includes(m.motion)?m.motion:'float',amp:num(m.amp,0,200,100),speed:num(m.speed,20,300,100),size:num(m.size,3,90,22),x:num(m.x,-100,100,60),y:num(m.y,-100,100,40)})}
     out.speaker=typeof v.speaker==='string'&&(v.speaker==='self'||out.mascots.some(m=>m.id===v.speaker))?v.speaker:'self';
     out.sceneBoost=num(v.sceneBoost,0,12,6)}
    if(Array.isArray(v.profiles))out.profiles=v.profiles.slice(0,20).filter(p=>p&&typeof p==='object'&&typeof p.id==='string'&&/^[a-z0-9]{1,24}$/.test(p.id)).map(p=>({
      id:p.id,
      name:String(p.name||'名義').slice(0,40),
      chars:Array.isArray(p.chars)?p.chars.filter(c=>typeof c==='string'&&/^[a-z0-9]{1,24}$/.test(c)).slice(0,60):[],
      cur:typeof p.cur==='string'?p.cur:'',
      snap:p.snap&&typeof p.snap==='object'?p.snap:{}
    }));
    if(v.chars&&typeof v.chars==='object'){
      out.chars={};
      for(const[id,c]of Object.entries(v.chars).slice(0,1200))if(/^[a-z0-9]{1,24}$/.test(id)&&c&&typeof c==='object')out.chars[id]=cleanChar(c)
    }
    if(typeof v.profileId==='string')out.profileId=v.profileId.slice(0,24);
    if(typeof v.charId==='string')out.charId=v.charId.slice(0,24);
    if(['fade','cut'].includes(v.switchFx))out.switchFx=v.switchFx;
    if(['s','m','l'].includes(v.padSize))out.padSize=v.padSize;
    return out
  }

  state=sanitize(state);

  function assetName(id){
    return ['png0','png1','png2','png3'].includes(id)?slotNames[+id.slice(-1)]:id.startsWith('particle')?'降らせる画像'+(id==='particle'?1:+id.slice(8)+1):id.startsWith('fxp-')?'降らせる画像'+(+id.slice(-1)+1):id.startsWith('scene-')?'画面の画像':id.startsWith('msc-')?'マスコットの画像':'背景画像'
  }

  E('studioSlots').innerHTML=slotNames.map((n,i)=>`<label class="png-slot">${i+1}. ${n}<img id="pngPreview${i}" alt="${n}" hidden><span id="pngName${i}" class="png-name">未登録</span><input type="file" id="pngFile${i}" accept="image/png" aria-label="${n}のPNG"></label>`).join('');

  async function decode(blob){
    const u=URL.createObjectURL(blob);
    try{
      return await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(Error('画像を読み込めません'));
        img.src=u
      })
    }finally{
      URL.revokeObjectURL(u)
    }
  }

  async function installAsset(id,blob,name,persist=true){
    if(persist&&!/^image\/(png|webp|jpeg)$/.test(blob.type))throw Error('PNG・WebP・JPEGの画像を選んでください（他の形式は設定の書き出し・読み込みに対応していません）');
    if(blob.size>25*1024*1024)throw Error('画像は1枚25MB以下にしてください');
    const im=await decode(blob);
    if(im.width>8192||im.height>8192)throw Error('画像は縦横8192px以下にしてください');
    if(persist)await putAsset(ASSET+id,blob);
    images[id]=im;
    assetBlobs[id]=blob;
    state.assetNames[id]=name||assetName(id);
    if(id.startsWith('png')){
      const i=+id.slice(-1),
        el=E('pngPreview'+i);
      if(el.dataset.url)URL.revokeObjectURL(el.dataset.url);
      el.src=el.dataset.url=URL.createObjectURL(blob);
      el.hidden=false;
      E('pngName'+i).textContent=state.assetNames[id]
    }else renderAssetSlots();
    if(persist)save()
  }

  function bindFile(input,id,after){
    E(input).onchange=async e=>{
      const f=e.target.files[0];
      if(!f)return;
      try{
        if(!ready)throw Error('保存領域の準備中です。少し待ってください');
        await installAsset(id,f,f.name);
        after?.();
        toast(assetName(id)+'を登録しました')
      }catch(err){
        toast(err.message,5000)
      }finally{
        e.target.value=''
      }
    }
  }

  for(let i=0;i<4;i++)E('pngFile'+i).onchange=e=>charUpload(e,i);
  E('particleSlots').innerHTML=PARTICLE_IDS.map((id,i)=>`<div class="png-slot fx-slot"><label>画像${i+1}<img id="fxPreview${i}" alt="降らせる画像${i+1}" hidden><span id="fxName${i}" class="png-name">未登録</span><input type="file" id="fxFile${i}" accept="image/png,image/webp,image/jpeg" aria-label="降らせる画像${i+1}"></label><button type="button" class="fx-remove" id="fxRemove${i}" hidden>外す</button></div>`).join('');

  PARTICLE_IDS.forEach((_,i)=>{
    E('fxFile'+i).onchange=async e=>{
      const f=e.target.files[0];
      if(!f)return;
      try{
        if(!ready)throw Error('保存領域の準備中です。少し待ってください');
        const p=presetOf(state.effect);
        if(!p)throw Error('先に画像のプリセットを選ぶか、作ってください');
        await installAsset(pimg(p.id,i),f,f.name);
        toast('「'+p.name+'」に画像を登録しました')
      }catch(err){
        toast(err.message,5000)
      }finally{
        e.target.value=''
      }
    };
    E('fxRemove'+i).onclick=()=>{
      const p=presetOf(state.effect);
      if(p)removeAsset(pimg(p.id,i))
    }
  });

  E('backgroundRemove').onclick=()=>removeAsset('background');

  function renderAssetSlots(){
    const fp=presetOf(state.effect);
    PARTICLE_IDS.forEach((_,i)=>{
      const id=fp?pimg(fp.id,i):'',
        im=E('fxPreview'+i),
        b=id?assetBlobs[id]:null;
      if(im.dataset.url){
        URL.revokeObjectURL(im.dataset.url);
        im.dataset.url=''
      }
      if(b){
        im.src=im.dataset.url=URL.createObjectURL(b);
        im.hidden=false
      }else{
        im.removeAttribute('src');
        im.hidden=true
      }
      E('fxName'+i).textContent=b?(state.assetNames[id]||assetName(id)):'未登録';
      E('fxRemove'+i).hidden=!b
    });
    for(const k of ['standby','away','end']){const n=E('scene_'+k+'_imgName');if(!n)continue;const id='scene-'+k;n.textContent=assetBlobs[id]?(state.assetNames[id]||'画像'):'未登録';E('scene_'+k+'_imgDel').hidden=!assetBlobs[id]}
    E('backgroundName').textContent=assetBlobs.background?(state.assetNames.background||'背景画像'):'未登録';
    E('backgroundRemove').hidden=!assetBlobs.background
  }

  async function removeAsset(id){
    try{
      await deleteAsset(ASSET+id);
      delete images[id];
      delete assetBlobs[id];
      delete state.assetNames[id];
      if(id==='background'&&state.bg==='image'){
        state.bg='cafe';
        E('studioBg').value='cafe'
      }
      save();
      renderAssetSlots();
      toast(assetName(id)+'を外しました')
    }catch(e){
      toast('外せませんでした：'+(e.message||e),5000)
    }
  }
  bindFile('studioBackground','background',()=>{
    state.bg='image';
    E('studioBg').value='image';
    save()
  });

  const bindings={
    studioThreshold:'threshold',
    studioHold:'hold',
    studioBlink:'blink',
    studioScale:'scale',
    studioX:'x',
    studioY:'y',
    studioBounce:'bounce',
    studioEffect:'effect',
    studioCount:'count',
    studioSpeed:'speed',
    studioFxSize:'fxSize',
    studioFxOpacity:'fxOpacity',
    studioBg:'bg',
    planTitle:'title',
    planCue:'cue',
    planPrompt:'prompt',
    planScript:'script',
    planShow:'show',
    studioMotionAmt:'motionAmt',
    studioMotionSing:'motionSing',
    studioMotionSingSpeed:'motionSingSpeed',
    studioMotionHop:'motionHop',
    studioMotionShake:'motionShake',
    studioImageMotion:'imageMotion'
  };

  function renderValues(){
    renderEffectOptions();
for(const [id,k]of Object.entries(bindings)){
      const el=E(id);
      if(el.type==='checkbox')el.checked=state[k];else el.value=state[k]
    }
    E('thresholdValue').textContent=state.threshold+' dB';
    E('holdValue').textContent=state.hold+' ms';
    {
      const sv=E('scaleVal');
      if(sv)sv.textContent=Math.round(state.scale)+'%';
      const yv=E('yVal');
      if(yv)yv.textContent=Math.round(state.y)+'%'
    }
    renderParagraph();
    renderSongs();
    renderKara();
    renderCharUI();
    renderSceneForm?.();
    renderMotionOut()
  }

  for(const[id,k]of Object.entries(bindings)){
    const el=E(id);
    el.addEventListener('input',()=>{
      state[k]=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;
      if(k==='script')paragraph=0;
      E('thresholdValue').textContent=state.threshold+' dB';
      E('holdValue').textContent=state.hold+' ms';
      if(k==='script')renderParagraph();
      save()
    })
  }

  function paragraphs(){
    return state.script.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean)
  }

  function renderParagraph(){
    const p=paragraphs();
    paragraph=Math.max(0,Math.min(paragraph,Math.max(0,p.length-1)));
    E('planCurrent').textContent=p.length?`${paragraph+1} / ${p.length}\n\n${p[paragraph]}`:'台本を入力すると、段落ごとに確認できます。';
    E('planNext').disabled=paragraph>=p.length-1
  }

  E('planNext').onclick=()=>{
    paragraph++;
    renderParagraph()
  };
  E('planReset').onclick=()=>{
    paragraph=0;
    renderParagraph()
  };

  async function copy(text){
    try{
      await navigator.clipboard.writeText(text);
      toast('コピーしました')
    }catch{
      const t=document.createElement('textarea');
      t.value=text;
      document.body.append(t);
      t.select();
      const ok=document.execCommand('copy');
      t.remove();
      toast(ok?'コピーしました':'コピーできませんでした。本文を選択してコピーしてください',4000)
    }
  }

  E('planCopy').onclick=()=>copy(`企画：${state.title||'未設定'}\n進行：${state.cue||'未設定'}\n\n${state.prompt}\n\n【台本・ここまでの内容】\n${state.script}\n\nこれは配信・収録用の企画です。上の指定に沿って、次の応答・進行案を作成してください。`);

  E('songAdd').onclick=()=>{
    const title=E('songTitle').value.trim(),
      artist=E('songArtist').value.trim();
    if(!title){
      toast('曲名を入力してください');
      return
    }
    state.songs.push({title,artist});
    save();
    renderSongs();
    E('songTitle').value='';
    E('songArtist').value=''
  };

  E('songSearch').onclick=()=>{
    const q=[E('songTitle').value.trim(),E('songArtist').value.trim(),'歌詞'].filter(Boolean).join(' ');
    if(!E('songTitle').value.trim()){
      toast('検索する曲名を入力してください');
      return
    }
    window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener')
  };

  const songText=()=>state.songs.map((s,i)=>`${i+1}. ${s.title}${s.artist?' / '+s.artist:''}`).join('\n');
  E('songCopy').onclick=()=>copy(songText());

  function renderSongs(){
    const list=E('songList');
    list.replaceChildren();
    state.songs.forEach((s,i)=>{
      const li=document.createElement('li'),
        text=document.createElement('span');
      text.textContent=s.title+(s.artist?' / '+s.artist:'');
      li.append(text);
      for(const[label,action]of [['↑',()=>{
            if(i>0)[state.songs[i-1],state.songs[i]]=[state.songs[i],state.songs[i-1]]
          }],['↓',()=>{
            if(i<state.songs.length-1)[state.songs[i+1],state.songs[i]]=[state.songs[i],state.songs[i+1]]
          }],['削除',()=>state.songs.splice(i,1)]]){
        const b=document.createElement('button');
        b.textContent=label;
        b.setAttribute('aria-label',s.title+' '+label);
        b.onclick=()=>{
          action();
          save();
          renderSongs()
        };
        li.append(b)
      }
      list.append(li)
    })
  } /* ===================== v0.4.4: カラオケ音源を探す・伴奏タブの音を取り込む ===================== */
 
  function karaDefaults(){
    return [
  
      {name:'Hiroのピアノ伴奏アレンジ',url:'https://www.youtube.com/channel/UCWX2b3xIeJHoiNOPd9nTuKA',memo:'YouTube 可／収益化 可／YouTube以外 可・クレジット「Hiro」'},
  
      {name:'OKE-sound',url:'https://www.youtube.com/@OKE-sound',memo:'YouTube 可／収益化 可／YouTube以外 可'},
  
      {name:'SELA',url:'https://www.youtube.com/@SELA_',memo:'YouTube 可／収益化 可／YouTube以外 不可'},
  
      {name:'かいちょ',url:'https://www.youtube.com/@kaicho_uk',memo:'YouTube 可／収益化 可／YouTube以外 可'},
  
      {name:'カラオケ歌っちゃ王',url:'https://www.youtube.com/@uta-cha-oh',memo:'YouTube 条件付き／収益化 不可／YouTube以外 不可'},
  
      {name:'桜音ふう',url:'https://www.youtube.com/@sakuranefu',memo:'YouTube 条件付き／収益化 条件付き／YouTube以外 条件付き'}
    ]
  }
 
  function karaList(){
    if(!Array.isArray(state.karaChannels))state.karaChannels=karaDefaults();
    return state.karaChannels
  }
 
  function karaBase(u){
    u=String(u||'').trim();
    if(/^@[^\s/?#]+$/.test(u))return 'https://www.youtube.com/'+u;
    const m=u.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(@[^\/?#\s]+|channel\/UC[\w-]{22}|c\/[^\/?#\s]+|user\/[^\/?#\s]+)/i);
    return m?'https://www.youtube.com/'+m[1]:''
  }
 
  function karaQueryText(){
    return E('karaQuery').value.trim()
  }
 
  function karaGo(url){
    const popup=state.karaOpen!=='tab';
    let w=null;
    try{
      w=popup?window.open(url,'otonohaKaraokeWin','popup=yes,width=1040,height=780'):window.open(url,'otonohaKaraokeTab')
    }catch(_){}
    if(!w){
      toast('ブラウザに新しい窓を止められました。アドレスバーの表示からポップアップを許可すると開けます',7000);
      return
    }
    try{
      w.focus()
    }catch(_){}
  }
 
  function karaSearch(ch){
    const q=karaQueryText();
    const base=karaBase(ch.url);
    if(!base){
      toast('「'+(ch.name||'このチャンネル')+'」のURLが読み取れません。チャンネルを編集から直せます',6000);
      return
    }
    karaGo(q?base+'/search?query='+encodeURIComponent(q):base+'/videos')
  }
 
  function renderKara(){
    const box=E('karaChannels');
    if(!box)return;
    const list=karaList();
    box.replaceChildren();
    list.forEach(ch=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='kara-ch';
      const n=document.createElement('span');
      n.textContent=ch.name||'（名前なし）';
      b.append(n);
      if(ch.memo){
        const s=document.createElement('small');
        s.textContent=ch.memo;
        b.append(s)
      }
      b.title=karaBase(ch.url)?(karaQueryText()?'このチャンネル内を検索':'このチャンネルの動画一覧を開く'):'URLが読み取れません';
      b.onclick=()=>karaSearch(ch);
      box.append(b)
    });
    if(!list.length){
      const p=document.createElement('p');
      p.className='studio-note';
      p.textContent='チャンネルが登録されていません。「チャンネルを編集」から追加できます。';
      box.append(p)
    }
  
    const ed=E('karaEdit');
    ed.replaceChildren();
    list.forEach((ch,i)=>{
      const row=document.createElement('div');
      row.className='kara-edit-row';
      const mk=(cls,key,ph,label)=>{
        const inp=document.createElement('input');
        inp.type='text';
        inp.className=cls;
        inp.value=ch[key]||'';
        inp.placeholder=ph;
        inp.setAttribute('aria-label',label);
        inp.onchange=()=>{
          ch[key]=inp.value.trim();
          save();
          renderKara()
        };
        return inp
      };
      const btns=document.createElement('div');
      btns.className='kara-btns';
      for(const[label,act]of [['↑',()=>{
            if(i>0)[list[i-1],list[i]]=[list[i],list[i-1]]
          }],['↓',()=>{
            if(i<list.length-1)[list[i+1],list[i]]=[list[i],list[i+1]]
          }],['削除',()=>list.splice(i,1)]]){
        const b=document.createElement('button');
        b.type='button';
        b.textContent=label;
        b.setAttribute('aria-label',(ch.name||'チャンネル')+' '+label);
        b.onclick=()=>{
          act();
          save();
          renderKara()
        };
        btns.append(b)
      }
      row.append(mk('kara-name','name','チャンネル名','チャンネル名'),mk('kara-url','url','https://www.youtube.com/@…','URL'),btns,mk('kara-memo','memo','メモ（使用条件など）','メモ'));
      ed.append(row)
    });
  
    E('karaOpen').value=state.karaOpen==='tab'?'tab':'popup';
    E('karaVol').value=state.karaVol;
    E('karaVolVal').textContent=Math.round(state.karaVol)+'%';
    E('karaSuppress').checked=state.karaSuppress!==false;
    E('karaAutoFade').checked=state.karaAutoFade!==false;
    E('karaFadeEnv').checked=state.karaFadeEnv===true
  }
 
  E('karaQuery').addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const list=karaList();
      if(list[0])karaSearch(list[0])
    }
  });
 
  E('karaQuery').addEventListener('input',()=>{
    clearTimeout(E('karaQuery')._t);
    E('karaQuery')._t=setTimeout(renderKara,250)
  });
 
  E('karaFromSong').onclick=()=>{
    const v=[E('songTitle').value.trim(),E('songArtist').value.trim()].filter(Boolean).join(' ');
    if(!v){
      toast('上の曲名欄が空です');
      return
    }
    E('karaQuery').value=v;
    renderKara()
  };
 
  E('karaAll').onclick=()=>{
    const q=karaQueryText();
    if(!q){
      toast('探す言葉を入力してください');
      return
    }
    karaGo('https://www.youtube.com/results?search_query='+encodeURIComponent(q+' カラオケ'))
  };
 
  E('karaOpen').onchange=e=>{
    state.karaOpen=e.target.value==='tab'?'tab':'popup';
    save()
  };
 
  E('karaAdd').onclick=()=>{
    karaList().push({name:'',url:'',memo:''});
    save();
    renderKara();
    const rows=E('karaEdit').querySelectorAll('.kara-name');
    rows[rows.length-1]?.focus()
  };
 
  E('karaReset').onclick=e=>{
    const b=e.currentTarget;
    if(b.dataset.armed!=='1'){
      b.dataset.armed='1';
      b.textContent='もう一度押すと初期の6件に戻します';
      clearTimeout(b._t);
      b._t=setTimeout(()=>{
        b.dataset.armed='';
        b.textContent='初期の6件に戻す'
      },4000);
      return
    }
    b.dataset.armed='';
    b.textContent='初期の6件に戻す';
    state.karaChannels=karaDefaults();
    save();
    renderKara();
    toast('チャンネルを初期の6件に戻しました')
  };
 
  let karaStream=null,
    karaSrc=null,
    karaGain=null;
 
  function karaSetInfo(text){
    const el=E('karaCapInfo');
    if(el)el.textContent=text
  }
 
  function karaStopCapture(byUser){
    if(karaSrc){
      try{
        karaSrc.disconnect()
      }catch(_){}
    }
    if(karaGain){
      try{
        karaGain.disconnect()
      }catch(_){}
    }
    if(karaStream)karaStream.getTracks().forEach(t=>{
      try{
        t.stop()
      }catch(_){}
    });
    const was=!!karaStream;
    karaStream=null;
    karaSrc=null;
    karaGain=null;
    E('karaStop').disabled=true;
    E('karaCapture').textContent='伴奏タブの音を取り込む';
    karaSetInfo('停止中');
    if(was&&!byUser)toast('伴奏タブの取り込みが終わりました（共有が止められたか、タブが閉じられました）',5000)
  }
 
  async function karaCapture(){
    if(!navigator.mediaDevices?.getDisplayMedia){
      toast('このブラウザでは別タブの音を取り込めません（パソコン版のChrome・Edgeで使えます）',7000);
      return
    }
  
    const btn=E('karaCapture');
    btn.disabled=true;
    try{
      await ensureRunning();
      const controller=('CaptureController' in window)?new CaptureController():null;
      const opts={
        video:{frameRate:{ideal:1,max:5},width:{max:640},height:{max:360}},
        audio:{suppressLocalAudioPlayback:state.karaSuppress!==false,echoCancellation:false,noiseSuppression:false,autoGainControl:false},
        preferCurrentTab:false,
        selfBrowserSurface:'exclude',
        surfaceSwitching:'include',
        systemAudio:'include',
        monitorTypeSurfaces:'exclude'
      };
      if(controller)opts.controller=controller;
   
      const st=await navigator.mediaDevices.getDisplayMedia(opts);
      try{
        controller?.setFocusBehavior?.('no-focus-change')
      }catch(_){}
   
      const at=st.getAudioTracks();
      if(!at.length){
        st.getTracks().forEach(t=>t.stop());
        toast('音声が取り込まれていません。選ぶ画面で「タブの音声も共有する」をオンにして、もう一度試してください',8000);
        return
      }
   
      karaStopCapture(true);
      karaStream=st;
      karaSrc=ctx.createMediaStreamSource(new MediaStream(at));
      karaGain=ctx.createGain();
      karaGain.channelCount=2;
      karaGain.channelCountMode='explicit';
      karaGain.channelInterpretation='speakers';
      karaGain.gain.value=state.karaVol/100;
      karaSrc.connect(karaGain);
      karaGain.connect(programBus);
   
      at[0].addEventListener('ended',()=>{
        if(karaStream===st)karaStopCapture(false)
      });
      st.getVideoTracks().forEach(v=>v.addEventListener('ended',()=>{
        if(karaStream===st&&st.getAudioTracks().every(a=>a.readyState==='ended'))karaStopCapture(false)
      }));
   
      const vt=st.getVideoTracks()[0],
        surface=vt?.getSettings?.().displaySurface;
      E('karaStop').disabled=false;
      btn.textContent='別のタブに切り替える';
      karaSetInfo('取り込み中：'+(surface==='browser'?'タブの音':surface==='window'?'ウィンドウの音':surface==='monitor'?'画面全体の音（パソコンの音すべて）':'選んだ画面の音')+'・再生と一時停止はそのタブで');
   
      if(surface==='monitor')toast('画面全体を選ぶと、パソコンで鳴っている音すべて（このアプリ自身の音も）が入ります。二重やハウリングに注意してください',8000);else toast('伴奏タブの音を取り込みました')
    }
  catch(e){
      if(e&&e.name==='NotAllowedError')toast('取り込みを取り消しました');else toast('取り込めませんでした：'+(e&&(e.message||e.name)||'不明'),7000)
    }finally{
      btn.disabled=false
    }
  }
 
  E('karaCapture').onclick=karaCapture;
  E('karaStop').onclick=()=>{
    karaStopCapture(true);
    toast('伴奏タブの取り込みをやめました')
  };
 
  E('karaVol').oninput=e=>{
    state.karaVol=Number(e.target.value);
    E('karaVolVal').textContent=Math.round(state.karaVol)+'%';
    if(karaGain&&ctx)karaGain.gain.setTargetAtTime(state.karaVol/100,ctx.currentTime,.03)
  };
  E('karaVol').onchange=()=>save();
 
  E('karaSuppress').onchange=e=>{
    state.karaSuppress=e.target.checked;
    save()
  };
 
  if(!navigator.mediaDevices?.getDisplayMedia){
    E('karaCapture').disabled=true;
    karaSetInfo('このブラウザでは使えません（パソコン版のChrome・Edgeで使えます）')
  }
 
  window.addEventListener('pagehide',()=>{
    if(karaStream)karaStream.getTracks().forEach(t=>{
      try{
        t.stop()
      }catch(_){}
    })
  });

 // v0.4.7: 歌い始めたらBGM・効果音をフェードアウト
 
  function singFade(reason){
    if(!ready||!cfg)return 0;
    const insts=[...active].filter(a=>{
      const s=cfg.sounds.find(x=>x.id===a.soundId);
      return !s||s.type!=='env'||state.karaFadeEnv===true
    });
    if(bgmPlaying)insts.push(bgmPlaying);
    bgmSerial++;
    bgmPendingId=null;
    bgmLoadingId=null;
    for(const s of cfg.sounds)if(s.type!=='env'||state.karaFadeEnv===true)soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
    pendingText.clear();
    insts.forEach(x=>fadeStop(x,1.2));
    if(insts.length)toast(reason+'：BGM・効果音をフェードアウトしました',3000);
    return insts.length
  }
 
  E('karaSingStart').onclick=()=>{
    if(!singFade('歌い始め'))toast('止める音は鳴っていません')
  };
 
  E('karaAutoFade').onchange=e=>{
    state.karaAutoFade=e.target.checked;
    save()
  };
  E('karaFadeEnv').onchange=e=>{
    state.karaFadeEnv=e.target.checked;
    save()
  };
 
  let karaAnal=null,
    karaBuf=null,
    karaQuietStart=0,
    karaOnsetGap=0,
    karaLoudSince=0,
    karaSinging=false;
 
  setInterval(()=>{
    if(!karaGain||!ctx){
      karaAnal=null;
      karaSinging=false;
      karaLoudSince=0;
      return
    }
    const now=performance.now();
    if(!karaAnal||karaAnal.__src!==karaGain){
      karaAnal=ctx.createAnalyser();
      karaAnal.fftSize=2048;
      karaAnal.__src=karaGain;
      karaGain.connect(karaAnal);
      karaBuf=new Float32Array(2048);
      karaQuietStart=now-2500;
      karaLoudSince=0;
      karaSinging=false
    }
    karaAnal.getFloatTimeDomainData(karaBuf);
    let s=0;
    for(const x of karaBuf)s+=x*x;
    const db=20*Math.log10(Math.max(1e-8,Math.sqrt(s/karaBuf.length)));
  
    if(db>-48){
      if(!karaLoudSince){
        karaLoudSince=now;
        karaOnsetGap=karaQuietStart?now-karaQuietStart:0;
        karaQuietStart=0
      }
      if(!karaSinging&&now-karaLoudSince>=300&&karaOnsetGap>=1800){
        karaSinging=true;
        if(state.karaAutoFade!==false)singFade('伴奏が始まりました')
      }
    }
  else{
      karaLoudSince=0;
      if(db<-60){
        if(!karaQuietStart)karaQuietStart=now;
        if(now-karaQuietStart>=1800)karaSinging=false
      }
    }
  },100);
 
  window.__otonohaSingFade=singFade;
 
  window.__otonohaKara={get stream(){
      return karaStream
    },get gain(){
      return karaGain
    }};

 /* ===================== v0.4.5: 名義・キャラクター ===================== */
 
  function cleanChar(c){
    const o={
      name:String(c.name||'キャラクター').slice(0,40),
      mode:c.mode==='single'?'single':'four',
      talk:['hop','sway','none'].includes(c.talk)?c.talk:'hop',
      breath:c.breath===true,
      bgMode:['inherit','own','cafe','transparent','green','blue','black'].includes(c.bgMode)?c.bgMode:'inherit',
      trim:c.trim!==false,
      exprs:Array.isArray(c.exprs)?c.exprs.filter(e=>e&&typeof e==='object'&&typeof e.id==='string'&&/^[a-z0-9]{1,8}$/.test(e.id)).slice(0,12).map(e=>({id:e.id,name:String(e.name||'表情').slice(0,20),motion:['none','shake','hop','sing'].includes(e.motion)?e.motion:'none'})):[]
    };
    for(const k of CHAR_KEYS){
      if(k==='blink'||k==='bounce'){
        o[k]=typeof c[k]==='boolean'?c[k]:defaults[k];
        continue
      }
      let n=Number(c[k]);
      if(!Number.isFinite(n)&&/^motion(Sing|Hop|Shake)$/.test(k))n=Number(c.motionAmt);
      o[k]=Number.isFinite(n)?Math.max(CHAR_RANGES[k][0],Math.min(CHAR_RANGES[k][1],n)):defaults[k]
    }
    return o
  }
 
  function newCharId(){
    return 'c'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36)
  }
 
  function newProfileId(){
    return 'p'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36)
  }
 
  function charKey(cid,slot){
    return cid==='c1'&&/^[0-3]$/.test(String(slot))?'png'+slot:'ch-'+cid+'-'+slot
  }
 
  function curChar(){
    return state.chars&&state.chars[state.charId]||null
  }
 
  function curProfile(){
    return Array.isArray(state.profiles)?state.profiles.find(p=>p.id===state.profileId)||null:null
  }
 
  function switchAlpha(now){
    return state.switchFx==='cut'?1:Math.max(0,Math.min(1,(now-switchAt)/250))
  }
 
  function pickValues(){
    const o={};
    for(const k of CHAR_KEYS)o[k]=state[k];
    return o
  }
 
  function profileSnap(){
    return {scenes:JSON.parse(JSON.stringify(state.scenes)),bg:state.bg}
  }
 
  function normScenes(x){
    const out={};
    for(const k of ['standby','away','end'])out[k]=sceneClean(k,x&&typeof x==='object'?x[k]:null);
    return out
  }
  function sceneClean(k,x){
    const d=defaults.scenes[k];
    x=x&&typeof x==='object'?x:{};
    const num=(v,a,b,df)=>{const n=Number(v);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):df},
      ef=x.effect==='image'?'p:img':x.effect;
    return {
      bgm:typeof x.bgm==='string'&&x.bgm?x.bgm.slice(0,100):d.bgm,
      effect:(ef==='keep'||['none','spring','summer','autumn','winter'].includes(ef)||/^p:[a-z0-9]{1,24}$/.test(ef||''))?ef:d.effect,
      avatar:typeof x.avatar==='boolean'?x.avatar:d.avatar,
      text:typeof x.text==='string'?x.text.slice(0,200):d.text,
      imgMotion:['float','sway','still'].includes(x.imgMotion)?x.imgMotion:'float',
      imgAmp:num(x.imgAmp,0,200,100),
      imgSize:num(x.imgSize,10,150,60),
      imgX:num(x.imgX,-100,100,0),
      imgY:num(x.imgY,-100,100,0)
    }
  }
 
  function ensureProfiles(){
  
    if(!state.chars||typeof state.chars!=='object'||Array.isArray(state.chars))state.chars={};
  
    for(const[id,c]of Object.entries(state.chars))state.chars[id]=cleanChar(c);
  
    if(!Array.isArray(state.profiles)||!state.profiles.length){
   // 初回：今の4枚と設定を「コウサカチヅル」の最初のキャラクターに引き継ぐ
   
      state.chars.c1=cleanChar({name:'キャラクター1',...pickValues()});
      const c2=newCharId();
      state.chars[c2]=cleanChar({name:'キャラクター1',...pickValues()});
   
      state.profiles=[{id:'p1',name:'コウサカチヅル',chars:['c1'],cur:'c1',snap:profileSnap()},{id:'p2',name:'雪見おと',chars:[c2],cur:c2,snap:profileSnap()}];
      state.profileId='p1';
      state.charId='c1'
    }
  
    const seen=new Set();
    for(const p of state.profiles){
      p.chars=p.chars.filter(c=>state.chars[c]&&!seen.has(c));
      p.chars.forEach(c=>seen.add(c));
      if(!p.chars.length){
        const id=newCharId();
        state.chars[id]=cleanChar({name:'キャラクター1',...pickValues()});
        p.chars.push(id);
        seen.add(id)
      }
      if(!p.chars.includes(p.cur))p.cur=p.chars[0];
      if(!p.snap||typeof p.snap!=='object')p.snap=profileSnap()
    }
  
    for(const id of Object.keys(state.chars))if(!seen.has(id))delete state.chars[id];
  
    let p=curProfile();
    if(!p){
      p=state.profiles[0];
      state.profileId=p.id
    }
  
    if(!p.chars.includes(state.charId))state.charId=p.cur
  }
 
  function syncChar(){
    if(!Array.isArray(CHAR_KEYS))return;
    const c=curChar();
    if(c)Object.assign(c,pickValues());
    const p=curProfile();
    if(p){
      p.snap=profileSnap();
      if(c)p.cur=state.charId
    }
  }
 
  async function loadChar(cid){
    for(const slot of charSlots(cid)){
      const key=charKey(cid,slot);
      if(charImgs[key])continue;
      try{
        const b=await getAsset(ASSET+key);
        if(b){
          charBlobs[key]=b;
          charImgs[key]=await decode(b)
        }
      }catch(_){
        toast((state.chars[cid]?.name||'キャラクター')+'の画像を読み込めませんでした',4000)
      }
    }
  }
 
  async function loadAllChars(){
    for(const cid of Object.keys(state.chars||{}))await loadChar(cid)
  }
 
  function applyCharImages(){
    for(let i=0;i<4;i++){
      const im=charImgs[charKey(state.charId,i)];
      if(im)images['png'+i]=im;else delete images['png'+i]
    }
  }
 
  function activateChar(cid,quiet){
    if(!state.chars||!state.chars[cid])return;
    if(!quiet&&cid!==state.charId)syncChar();
    state.charId=cid;
    const c=state.chars[cid];
    for(const k of CHAR_KEYS)state[k]=c[k];
    const p=curProfile();
    if(p)p.cur=cid;
    applyCharImages();
    if(!quiet)switchAt=performance.now();
    renderValues();
    save()
  }
 
  function activateProfile(pid){
    const p=state.profiles.find(x=>x.id===pid);
    if(!p||pid===state.profileId)return;
    syncChar();
    state.profileId=pid;
    const s=p.snap||{};
    state.scenes=normScenes(s.scenes);
    if(['cafe','transparent','green','blue','black','image'].includes(s.bg))state.bg=s.bg;
for(const q of particles)q.beh='';
    state.charId='';
    activateChar(p.cur,true);
    switchAt=performance.now();
    renderSceneForm();
    toast('名義「'+p.name+'」に切り替えました')
  }
 
  function charThumbUrl(cid){
    const b=charBlobs[charKey(cid,0)];
    if(!b)return '';
    const u=URL.createObjectURL(b);
    charUrls.push(u);
    return u
  }
 
  function charButton(cid,small){
    const c=state.chars[cid],
      b=document.createElement('button');
    b.type='button';
    b.classList.toggle('selected',cid===state.charId);
    b.setAttribute('aria-pressed',String(cid===state.charId));
    const u=small?'':charThumbUrl(cid);
    if(u){
      const im=document.createElement('img');
      im.className='char-thumb';
      im.alt='';
      im.src=u;
      b.append(im)
    }
    b.append(document.createTextNode(c.name||'キャラクター'));
    b.onclick=()=>{
      if(cid!==state.charId){
        activateChar(cid);
        toast('「'+(c.name||'キャラクター')+'」に切り替えました')
      }
    };
    return b
  }
 
  function renderCharUI(){
    if(!E('charList'))return;
    queueMicrotask(()=>{try{renderExprUI()}catch(_){}});
    ensureProfiles();
    charUrls.forEach(u=>URL.revokeObjectURL(u));
    charUrls=[];
    const p=curProfile(),
      c=curChar();
  
    for(const sel of [E('profileSel'),E('profileQuick')]){
      sel.replaceChildren();
      for(const q of state.profiles)sel.add(new Option(q.name||'名義',q.id));
      sel.value=state.profileId
    }
  
    if(document.activeElement!==E('profileName'))E('profileName').value=p?.name||'';
  
    E('charList').replaceChildren(...p.chars.map(id=>charButton(id,false)));
    E('charQuick').replaceChildren(...p.chars.map(id=>charButton(id,true)));
  
    if(!c)return;
    if(document.activeElement!==E('charName'))E('charName').value=c.name;
    E('charMode').value=c.mode;
    E('charTalk').value=c.talk;
    E('charBreath').checked=c.breath;
    E('charTrim').checked=c.trim!==false;
    E('charBg').value=c.bgMode;
    E('switchFx').value=state.switchFx==='cut'?'cut':'fade';
  
    const single=c.mode==='single';
    for(let i=0;i<4;i++){
      const slot=E('pngFile'+i).closest('.png-slot');
      slot.hidden=single&&i>0;
      const key=charKey(state.charId,i),
        b=charBlobs[key],
        im=E('pngPreview'+i);
      if(im.dataset.url){
        URL.revokeObjectURL(im.dataset.url);
        im.dataset.url=''
      }
      if(b){
        im.src=im.dataset.url=URL.createObjectURL(b);
        im.hidden=false
      }else{
        im.removeAttribute('src');
        im.hidden=true
      }
      E('pngName'+i).textContent=b?(state.assetNames[key]||'登録済み'):'未登録'
    }
  
    {
      const lab=E('pngFile0').closest('.png-slot');
      if(lab&&lab.firstChild&&lab.firstChild.nodeType===3)lab.firstChild.nodeValue=single?'立ち絵（1枚） ':'1. 目開き・口閉じ'
    }
    E('singleNote').hidden=!single;
    E('charTalkWrap').hidden=!single;
    E('studioBlink').disabled=single;
  
    const bgKey=charKey(state.charId,'bg');
    E('charBgName').textContent=charBlobs[bgKey]?(state.assetNames[bgKey]||'登録済み'):'未登録';
    E('charBgRemove').hidden=!charBlobs[bgKey];
  
    const mv=E('charMove');
    mv.replaceChildren(new Option('移さない',''));
    for(const q of state.profiles)if(q.id!==state.profileId)mv.add(new Option(q.name||'名義',q.id));
    mv.value='';
  
    E('charDel').disabled=p.chars.length<2;
    E('profileDel').disabled=state.profiles.length<2
  }
 
  async function storeCharImage(cid,slot,f){
    if(!/^image\/(png|webp|jpeg)$/.test(f.type))throw Error('PNG・WebP・JPEGの画像を選んでください');
    if(f.size>25*1024*1024)throw Error('画像は1枚25MB以下にしてください');
    const im=await decode(f);
    if(im.width>8192||im.height>8192)throw Error('画像は縦横8192px以下にしてください');
    const key=charKey(cid,slot);
    await putAsset(ASSET+key,f);
    charBlobs[key]=f;
    charImgs[key]=im;
    state.assetNames[key]=f.name||'画像'
  }
 
  async function charUpload(e,slot){
    const f=e.target.files[0];
    if(!f)return;
    try{
      if(!ready)throw Error('保存領域の準備中です。少し待ってください');
      await storeCharImage(state.charId,slot,f);
      applyCharImages();
      renderCharUI();
      save();
      toast((curChar()?.name||'キャラクター')+'の画像を登録しました')
    }catch(err){
      toast(err.message,5000)
    }finally{
      e.target.value=''
    }
  }
 
  E('charBgFile').onchange=async e=>{
    const f=e.target.files[0];
    if(!f)return;
    try{
      if(!ready)throw Error('保存領域の準備中です。少し待ってください');
      await storeCharImage(state.charId,'bg',f);
      curChar().bgMode='own';
      renderCharUI();
      save();
      toast('このキャラクターの背景画像を登録しました')
    }catch(err){
      toast(err.message,5000)
    }finally{
      e.target.value=''
    }
  };
 
  E('charBgRemove').onclick=async()=>{
    const key=charKey(state.charId,'bg');
    try{
      await deleteAsset(ASSET+key)
    }catch(_){}
    delete charBlobs[key];
    delete charImgs[key];
    delete state.assetNames[key];
    const c=curChar();
    if(c.bgMode==='own')c.bgMode='inherit';
    renderCharUI();
    save();
    toast('専用の背景画像を外しました')
  };
 
  function armed(btn,label,run){
    if(btn.dataset.armed!=='1'){
      btn.dataset.armed='1';
      const old=btn.textContent;
      btn.dataset.old=old;
      btn.textContent=label;
      clearTimeout(btn._t);
      btn._t=setTimeout(()=>{
        btn.dataset.armed='';
        btn.textContent=btn.dataset.old
      },4000);
      return
    }
    clearTimeout(btn._t);
    btn.dataset.armed='';
    btn.textContent=btn.dataset.old;
    run()
  }
 
  async function dropCharAssets(cid){
    for(const slot of charSlots(cid)){
      const key=charKey(cid,slot);
      try{
        await deleteAsset(ASSET+key)
      }catch(_){}
      delete charBlobs[key];
      delete charImgs[key];
      delete state.assetNames[key]
    }
  }
 
  E('profileSel').onchange=e=>activateProfile(e.target.value);
  E('profileQuick').onchange=e=>activateProfile(e.target.value);
 
  E('profileName').oninput=e=>{
    const p=curProfile();
    if(p){
      p.name=e.target.value.slice(0,40)||'名義';
      save();
      renderCharUI()
    }
  };
 
  E('profileAdd').onclick=()=>{
    if(state.profiles.length>=20){
      toast('登録できる名義は20件までです');
      return
    }
    syncChar();
    const pid=newProfileId(),
      cid=newCharId();
    state.chars[cid]=cleanChar({name:'キャラクター1',...pickValues()});
    state.profiles.push({id:pid,name:'新しい名義',chars:[cid],cur:cid,snap:profileSnap()});
    activateProfile(pid);
    E('profileName').focus();
    E('profileName').select()
  };
 
  E('profileDel').onclick=e=>{
    if(state.profiles.length<2)return;
    const p=curProfile();
    armed(e.currentTarget,'もう一度押すと「'+p.name+'」と中のキャラクターを削除',async()=>{
      const idx=state.profiles.indexOf(p),
        next=state.profiles[idx===0?1:idx-1];
      activateProfile(next.id);
      state.profiles=state.profiles.filter(x=>x!==p);
      for(const cid of p.chars){
        await dropCharAssets(cid);
        delete state.chars[cid]
      }
      renderCharUI();
      save();
      toast('名義を削除しました')
    })
  };
 
  E('charAdd').onclick=()=>{
    const p=curProfile();
    if(p.chars.length>=60){
      toast('1つの名義に登録できるのは60体までです');
      return
    }
    syncChar();
    const cid=newCharId();
    state.chars[cid]=cleanChar({name:'キャラクター'+(p.chars.length+1),...pickValues()});
    p.chars.push(cid);
    activateChar(cid);
    E('charName').focus();
    E('charName').select()
  };
 
  E('charDup').onclick=async()=>{
    const p=curProfile(),
      src=state.charId;
    if(p.chars.length>=60){
      toast('1つの名義に登録できるのは60体までです');
      return
    }
    syncChar();
    const cid=newCharId();
    state.chars[cid]=cleanChar({...state.chars[src],name:(state.chars[src].name||'キャラクター')+'（複製）'});
    try{
      for(const slot of charSlots(src)){
        const b=charBlobs[charKey(src,slot)];
        if(b){
          const key=charKey(cid,slot);
          await putAsset(ASSET+key,b);
          charBlobs[key]=b;
          charImgs[key]=charImgs[charKey(src,slot)];
          state.assetNames[key]=state.assetNames[charKey(src,slot)]
        }
      }
    }catch(err){
      toast('画像を複製できませんでした：'+(err.message||err),5000)
    }
    p.chars.splice(p.chars.indexOf(src)+1,0,cid);
    activateChar(cid);
    toast('複製しました')
  };
 
  E('charLeft').onclick=()=>{
    const p=curProfile(),
      i=p.chars.indexOf(state.charId);
    if(i>0){
      [p.chars[i-1],p.chars[i]]=[p.chars[i],p.chars[i-1]];
      save();
      renderCharUI()
    }
  };
 
  E('charRight').onclick=()=>{
    const p=curProfile(),
      i=p.chars.indexOf(state.charId);
    if(i>=0&&i<p.chars.length-1){
      [p.chars[i+1],p.chars[i]]=[p.chars[i],p.chars[i+1]];
      save();
      renderCharUI()
    }
  };
 
  E('charDel').onclick=e=>{
    const p=curProfile();
    if(p.chars.length<2)return;
    const cid=state.charId,
      c=curChar();
    armed(e.currentTarget,'もう一度押すと「'+c.name+'」を削除',async()=>{
      const i=p.chars.indexOf(cid);
      p.chars.splice(i,1);
      state.charId='';
      activateChar(p.chars[Math.max(0,i-1)],true);
      await dropCharAssets(cid);
      delete state.chars[cid];
      renderCharUI();
      save();
      toast('キャラクターを削除しました')
    })
  };
 
  E('charName').oninput=e=>{
    const c=curChar();
    if(c){
      c.name=e.target.value.slice(0,40)||'キャラクター';
      save();
      renderCharUI()
    }
  };
 
  E('charMode').onchange=e=>{
    curChar().mode=e.target.value==='single'?'single':'four';
    save();
    renderCharUI()
  };
 
  E('charTalk').onchange=e=>{
    curChar().talk=e.target.value;
    save()
  };
  E('charTrim').onchange=e=>{
    curChar().trim=e.target.checked;
    save()
  };
  E('charBreath').onchange=e=>{
    curChar().breath=e.target.checked;
    save()
  };
 
  E('charBg').onchange=e=>{
    const c=curChar();
    c.bgMode=e.target.value;
    if(c.bgMode==='own'&&!charBlobs[charKey(state.charId,'bg')])toast('専用の背景画像を下で登録すると表示されます',4000);
    save()
  };
 
  E('switchFx').onchange=e=>{
    state.switchFx=e.target.value==='cut'?'cut':'fade';
    save()
  };
 
  E('charMove').onchange=e=>{
    const to=state.profiles.find(q=>q.id===e.target.value),
      p=curProfile();
    if(!to)return;
    if(to.chars.length>=60){
      toast('移動先の名義には既に60体登録されています');
      e.target.value='';
      return;
    }
    if(p.chars.length<2){
      toast('名義の最後の1体は移せません。先に別のキャラクターを追加してください',5000);
      e.target.value='';
      return
    }
    const cid=state.charId,
      name=curChar().name;
    syncChar();
    p.chars=p.chars.filter(x=>x!==cid);
    to.chars.push(cid);
    state.charId='';
    p.cur=p.chars[0];
    activateChar(p.chars[0],true);
    toast('「'+name+'」を「'+to.name+'」へ移しました')
  };
 
  E('studioScale').addEventListener('input',()=>{
    E('scaleVal').textContent=Math.round(state.scale)+'%'
  });
  E('studioY').addEventListener('input',()=>{
    E('yVal').textContent=Math.round(state.y)+'%'
  });
 
  function applyPadSize(){
    document.body.dataset.pad=['s','m','l'].includes(state.padSize)?state.padSize:'m';
    const s=E('padSize');
    if(s)s.value=document.body.dataset.pad
  }
 
  E('padSize').onchange=e=>{
    state.padSize=e.target.value;
    applyPadSize();
    save()
  };
  applyPadSize();
 
  ensureProfiles();
  renderCharUI();
 
  window.__otonohaChars={get state(){
      return state
    },charKey,activateChar,activateProfile};


  let quickSignature='';



  function setMode(mode){
    document.body.dataset.studioMode=mode;
    studioLiveMode=mode==='live';
    applyMonitor();
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
    E('studioPlan').classList.toggle('on',mode==='plan');
    E('studioSongs').classList.toggle('on',mode==='songs');
    E('studioModeHelp').textContent=mode==='record'?'PNGTuber・演出・マイク・効果音をまとめて動画収録できます。音声だけの収録には下の録音欄を使ってください。':mode==='plan'?'企画文をAIへ渡し、返答を台本欄に貼り付けて進行できます。AIと自動通信する機能はありません。':'配信ソフトで「映像だけ別窓」を取り込み、音声はこのブラウザの音＋マイクを配信側で取り込みます。配信サービスへの直接送出機能はありません。'
  }

  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));

  E('studioMic').onclick=async()=>{
    if(!ready){
      toast('準備中です');
      return
    }
    await enableMic()
  };
  E('studioTest').onclick=()=>{
    testUntil=performance.now()+3000;
    toast('3秒間、口パクとまばたきをテストします')
  };
  E('studioFullscreen').onclick=async()=>{
    try{
      await E('studioStageWrap').requestFullscreen()
    }catch{
      toast('この環境では全画面表示を使えません')
    }
  };

  E('studioOutput').onclick=()=>{
    if(outputWindow&&!outputWindow.closed){
      outputWindow.focus();
      return
    }
    outputWindow=window.open('','otonoha-stage',W>H?'width=1280,height=720':'width=450,height=800');
    if(!outputWindow){
      toast('別窓を開くにはポップアップを許可してください',5000);
      return
    }
    outputWindow.document.open();
    outputWindow.document.write('<!doctype html><html lang="ja"><head><title>オトノハ｜映像出力</title><style>html,body{margin:0;background:transparent;width:100%;height:100%;overflow:hidden}canvas{width:100%;height:100%;object-fit:contain;display:block}</style></head><body><canvas width="'+W+'" height="'+H+'" aria-label="映像出力"></canvas><\/body></html>');
    outputWindow.document.close();
    outContext=outputWindow.document.querySelector('canvas').getContext('2d')
  };
// ---------- v0.4.3 drawing: aspect, avatar motion, seasonal motion ----------
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
  
      const alpha=(S.fxOpacity/100)*(.35+p.depth*.65)*(layer==='front'?1-faceMask*.65:1);
  
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

/* ---------- v0.4.3: aspect, avatar motion buttons, image prompt helper ---------- */

  function applyAspect(){
    const v=state.aspect==='portrait';
    W=v?720:1280;
    H=v?1280:720;
    if(canvas.width!==W||canvas.height!==H){
      canvas.width=W;
      canvas.height=H;
      for(const p of particles)p.beh=''
    }
    document.body.dataset.studioAspect=state.aspect;
    E('studioAspect').value=state.aspect;
    applyPerfLabel()
  }

  E('studioAspect').onchange=e=>{
    if(mediaRecorder&&mediaRecorder.state!=='inactive'){
      e.target.value=state.aspect;
      toast('収録中は映像の向きを変えられません');
      return
    }
    state.aspect=e.target.value==='portrait'?'portrait':'landscape';
    save();
    applyAspect();
    if(outputWindow&&!outputWindow.closed)try{
      outputWindow.resizeTo(W>H?1280:450,W>H?760:840)
    }catch(_){}
    toast(W>H?'横向き（1280×720）にしました':'縦向き（720×1280）にしました')
  };

  function setMotion(m){
    motion=MOTION_LABEL[m]?m:'still';
    document.querySelectorAll('[data-motion]').forEach(b=>{
      const on=b.dataset.motion===motion;
      b.classList.toggle('selected',on);
      b.setAttribute('aria-pressed',String(on))
    })
  }

  document.querySelectorAll('[data-motion]').forEach(b=>b.onclick=()=>setMotion(b.dataset.motion));

  const PROMPT_GUIDE={
    flutter:'薄く平たい形。真上からやや斜め上に見た向き。回転したり裏返ったりしても不自然に見えない、左右対称に近い輪郭。',
    leaf:'葉や花びらのように平たい形。柄や茎を下側に短く残す。左右に揺れながら落ちても自然な向き。',
    rise:'丸みのある形。真正面から見た向き。回転しても見た目がほぼ変わらない形。',
    snow:'小さく軽そうな形。中心から放射状、または中心対称に近い輪郭。',
    roll:'真横から見た向き。重心が画像のちょうど中心に来るよう配置し、転がって回転しても不自然に見えない丸みのある輪郭。'
  };

  function imagePrompt(){
    const motif=E('promptMotif').value.trim()||'（モチーフ名）',
      mv=E('promptMotion').value,
      color=E('promptColor').value.trim();
    return `配信画面の演出で、画面上を舞わせる「${motif}」の素材画像を1枚作ってください。

【必須条件】
・背景は完全な透過（透過PNG）。白い背景や市松模様を描き込まない
・${motif}を1つだけ、画像の中央に配置し、上下左右に約10％の余白を残して全体を収める
・正方形、1024×1024
・文字、ロゴ、枠線、署名、地面の影、背景の小物は入れない

【画風】
・大人向けアニメイラストの繊細な立ち絵と並べても浮かない、上品で洗練された描写
・細い線、またはごく淡い輪郭。太い黒の縁取り、原色のベタ塗り、幼児向けクリップアート調にはしない
・淡い陰影、柔らかな反射光、ほんのりとした透明感
・画面では直径20〜80ピクセルほどの小ささで表示されるため、縮小してもシルエットが判別できる形にする

【形と向き】
${PROMPT_GUIDE[mv]||PROMPT_GUIDE.flutter}

【色】
${color||'モチーフ本来の色を、彩度をやや抑えて上品に'}

色や形の違うバリエーションが欲しいときは、1枚の画像に並べず、別々の画像として1枚ずつ作ってください。`
  }

  E('promptMotion').value='flutter';
  E('promptCopy').onclick=()=>copy(imagePrompt());
  E('promptPreview').onclick=()=>{
    E('promptOut').textContent=imagePrompt();
    E('promptOut').hidden=false
  };

/* ---------- v0.4.2: mute, standby / away scenes, broadcast output ---------- */

  let scene='live',
    muteBefore=null,
    bgmBefore=null,
    sceneBgmId=null;

  const SCENE_LABEL={live:'配信中',standby:'準備中',away:'離席中',end:'配信終了'};

  function curEffect(){
    if(scene!=='live'){
      const e=state.scenes[scene].effect;
      if(e!=='keep')return e
    }
    return state.effect
  }

  function sceneAvatar(){
    return scene==='live'||state.scenes[scene].avatar
  }

  function setMute(on){
    micMuted=!!on;
    updateGains();
    const b=E('studioMute');
    b.setAttribute('aria-pressed',String(micMuted));
    b.textContent=micMuted?'マイク：ミュート中':'マイク：オン'
  }

  E('studioMute').onclick=()=>{
    setMute(!micMuted);
    toast(micMuted?'マイクをミュートしました':'マイクのミュートを解除しました')
  };

  function bgmById(id){
    return cfg?.bgms.find(b=>b.id===id&&b.assetId)||null
  }

  function switchBgm(b){
    if(!b||bgmPlaying?.trackId===b.id||bgmPendingId===b.id)return;
    playBgm(b)
  }

  function renderScene(){
    document.querySelectorAll('[data-scene]').forEach(x=>{
      const on=x.dataset.scene===scene;
      x.classList.toggle('selected',on);
      x.setAttribute('aria-pressed',String(on))
    });
    E('studioSceneState').textContent=SCENE_LABEL[scene]+(scene!=='live'?'（マイクはミュート）':'')
  }

  function enterScene(name){
 
    if(!SCENE_LABEL[name]||name===scene)return;
 
    if(scene==='live'){
      muteBefore=micMuted;
      bgmBefore=bgmPlaying?.trackId||null
    }
 
    scene=name;
 
    if(name==='live'){
  
      setMute(!!muteBefore);
  
      if(state.restoreBgm&&ready&&cfg){
        const cur=bgmPlaying?.trackId||null;
        if(bgmBefore&&cur!==bgmBefore)switchBgm(bgmById(bgmBefore));else if(!bgmBefore&&cur&&cur===sceneBgmId)fadeStop(bgmPlaying)
      }
  
      sceneBgmId=null;
      muteBefore=null;
      bgmBefore=null;
 
    }else{
  
      setMute(true);
      const c=state.scenes[name];
  
      if(ready&&cfg){
        if(c.bgm==='stop'){
          if(bgmPlaying)fadeStop(bgmPlaying);
          sceneBgmId=null
        }else if(c.bgm!=='keep'){
          const b=bgmById(c.bgm);
          if(b){
            switchBgm(b);
            sceneBgmId=b.id
          }else toast('指定のBGMが見つかりません。設定を選び直してください',4000)
        }
      }
 
    }
 
    window.__sceneBgmBoost=name==='live'?0:(state.sceneBoost||0);
    updateGains();
    renderScene();
    toast(SCENE_LABEL[name]+'に切り替えました');

  }

  document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>enterScene(b.dataset.scene));
// Scene settings form

  const SCENE_FIELDS=['bgm','effect','avatar','text','imgMotion','imgAmp','imgSize','imgX','imgY'];

  function renderSceneBgmOptions(){
    if(!cfg)return;
    for(const k of ['standby','away','end']){
      const sel=E(`scene_${k}_bgm`),
        bgms=cfg.bgms.filter(b=>b.assetId),
        sig=JSON.stringify(bgms.map(b=>[b.id,b.name]));
      if(sel.dataset.sig===sig&&sel.value===state.scenes[k].bgm)continue;
      sel.dataset.sig=sig;
      sel.replaceChildren(new Option('変えない（流れているBGMのまま）','keep'),new Option('止める','stop'));
      for(const b of bgms)sel.add(new Option(b.name||'BGM',b.id));
      const v=state.scenes[k].bgm;
      if(v!=='keep'&&v!=='stop'&&!bgms.some(b=>b.id===v))sel.add(new Option('（登録が見つからないBGM）',v));
      sel.value=v
    }
  }

  function renderSceneForm(){
    renderEffectOptions();
for(const k of ['standby','away','end'])for(const f of SCENE_FIELDS){
      const el=E(`scene_${k}_${f}`);
      if(f==='bgm')continue;
      if(el.type==='checkbox')el.checked=state.scenes[k][f];else if(document.activeElement!==el)el.value=state.scenes[k][f]
    }
    E('sceneRestoreBgm').checked=state.restoreBgm;
    E('sceneBoost').value=state.sceneBoost;
    E('sceneBoostVal').textContent='+'+state.sceneBoost+' dB';
    renderSceneBgmOptions()
  }

  for(const k of ['standby','away','end'])for(const f of SCENE_FIELDS){
    const el=E(`scene_${k}_${f}`);
    el.addEventListener(el.tagName==='SELECT'||el.type==='checkbox'?'change':'input',()=>{
      state.scenes[k][f]=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value.slice(0,200);
      save();
      if(f==='bgm'&&scene===k&&ready){
        if(el.value==='stop'){
          if(bgmPlaying)fadeStop(bgmPlaying)
        }else if(el.value!=='keep'){
          const b=bgmById(el.value);
          if(b){
            switchBgm(b);
            sceneBgmId=b.id
          }
        }
      }
    })
  }

  E('sceneRestoreBgm').onchange=e=>{
    state.restoreBgm=e.target.checked;
    save()
  };

  setInterval(renderSceneBgmOptions,1500);
// Scene caption: a soft frosted panel low on the stage; only drawn when text is set.

  function sceneCaption(){
    const text=(state.scenes[scene]?.text||'').trim();
    if(!text)return;
    g.save();
    g.font='500 34px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    const lines=[];
    for(const para of text.split('\n')){
      let line='';
      for(const c of [...para]){
        if(g.measureText(line+c).width>Math.min(960,W-180)){
          lines.push(line);
          line=c
        }else line+=c
      }
      lines.push(line)
    }
    const vis=lines.slice(0,4),
      lh=50,
      h=vis.length*lh+44,
      w=Math.min(W-80,Math.max(...vis.map(l=>g.measureText(l).width))+120),
      x=(W-w)/2,
      y=sceneAvatar()||images['scene-'+scene]?H-80-h:(H-h)/2;
    g.fillStyle='rgba(22,34,29,.62)';
    g.beginPath();
    g.roundRect(x,y,w,h,18);
    g.fill();
    g.strokeStyle='rgba(255,248,232,.35)';
    g.lineWidth=1;
    g.beginPath();
    g.roundRect(x+6,y+6,w-12,h-12,13);
    g.stroke();
    g.fillStyle='#fbf5e9';
    g.textAlign='center';
    g.textBaseline='middle';
    vis.forEach((l,i)=>g.fillText(l,W/2,y+22+lh/2+i*lh));
    g.restore()
  }
// Broadcast output: a second copy of limOut sent to a chosen audio device (e.g. a virtual cable read by the streaming software).

  let sinkAudio=null,
    sinkDest=null;

  async function listSinks(){
    const sel=E('studioSinkSel');
    try{
      const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput'&&d.deviceId&&d.deviceId!=='default'&&d.deviceId!=='communications');
      const keep=state.sinkId;
      sel.replaceChildren(new Option('使わない',''));
      ds.forEach((d,i)=>sel.add(new Option(d.label||('出力機器 '+(i+1)),d.deviceId)));
      if(keep&&!ds.some(d=>d.deviceId===keep))sel.add(new Option('（前回の出力先：今は見つかりません）',keep));
      sel.value=keep;
      if(!ds.length)E('studioSinkInfo').textContent='出力機器の一覧を取得できませんでした（マイクを接続すると名前が表示される場合があります）'
    }catch(e){
      E('studioSinkInfo').textContent='この環境では出力機器の一覧を取得できません'
    }
  }

  function stopSink(){
    if(sinkAudio){
      try{
        sinkAudio.pause();
        sinkAudio.srcObject=null
      }catch(_){}
    }
    if(sinkDest&&limOut)try{
      limOut.disconnect(sinkDest)
    }catch(_){}
    sinkAudio=null;
    sinkDest=null;
    E('studioSinkToggle').textContent='送出を開始';
    E('studioSinkInfo').textContent='停止中'
  }

  async function startSink(){
    const id=E('studioSinkSel').value;
    if(!id){
      toast('配信用の出力先を選んでください');
      return
    }
    if(!('setSinkId' in HTMLMediaElement.prototype)){
      E('studioSinkInfo').textContent='このブラウザは出力先の指定（setSinkId）に対応していません';
      toast('このブラウザでは配信用の出力先を指定できません',5000);
      return
    }
    stopSink();
    try{
      await ensureRunning();
      sinkDest=ctx.createMediaStreamDestination();
      limOut.connect(sinkDest);
      sinkAudio=new Audio();
      sinkAudio.srcObject=sinkDest.stream;
      await sinkAudio.setSinkId(id);
      await sinkAudio.play();
      state.sinkId=id;
      save();
      const label=E('studioSinkSel').selectedOptions[0]?.textContent||'';
      E('studioSinkToggle').textContent='送出を停止';
      E('studioSinkInfo').textContent='送出中：'+label;
      toast('配信用の出力を開始しました')
    }catch(e){
      stopSink();
      E('studioSinkInfo').textContent='開始できませんでした：'+(e.message||e.name||'不明');
      toast('配信用の出力を開始できませんでした',5000)
    }
  }

  E('studioSinkToggle').onclick=()=>{
    if(sinkAudio)stopSink();else startSink()
  };
  E('studioSinkList').onclick=listSinks;

  E('studioSinkSel').onchange=e=>{
    state.sinkId=e.target.value;
    save();
    if(sinkAudio){
      if(e.target.value)startSink();else stopSink()
    }
  };

  navigator.mediaDevices?.addEventListener?.('devicechange',listSinks);

// Frame scheduling (0.4.1). A hidden tab stops requestAnimationFrame and throttles timers to ~1/s, which froze
// the separate output window and the video capture. While hidden, drive frames from the visible output window's
// rAF, otherwise from a Worker timer (Worker timers are not subject to the same background-tab throttling).
// Only one pending callback is valid at a time (frameToken); a watchdog restarts the chain if it stalls.

  let frameToken=0,
    lastFrameAt=0,
    tickWorker=null,
    pendingTick=null;

  function popupVisible(){
    try{
      return !!(outputWindow&&!outputWindow.closed&&!outputWindow.document.hidden)
    }catch(_){
      return false
    }
  }

  function ticker(){
    if(tickWorker===null){
      try{
        const u=URL.createObjectURL(new Blob(['let t=0;onmessage=e=>{clearInterval(t);t=0;if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}'],{type:'text/javascript'}));
        tickWorker=new Worker(u);
        URL.revokeObjectURL(u);
        tickWorker.onmessage=()=>{
          const f=pendingTick;
          pendingTick=null;
          if(f)f();else if(performance.now()-lastFrameAt>400)scheduleFrame()
        }
      }catch(_){
        tickWorker=false
      }
    }
    return tickWorker
  }

  function scheduleFrame(){
    const t=++frameToken,
      run=()=>{
      if(t===frameToken)frame()
    };
    pendingTick=null;
    if(!document.hidden){
      requestAnimationFrame(run);
      return
    }
    if(popupVisible()){
      try{
        outputWindow.requestAnimationFrame(run);
        return
      }catch(_){}
    }
    if(ticker())pendingTick=run;else setTimeout(run,33)
  }

  document.addEventListener('visibilitychange',()=>{
    const w=ticker();
    if(w)w.postMessage(document.hidden?Math.max(33,Math.round(1000/(state.fps||30))):0);
    scheduleFrame()
  });

  setInterval(()=>{
    if(performance.now()-lastFrameAt>400)scheduleFrame()
  },1000);

  let previous=0,
    uiTick=0;
  function frame(){
    const now=performance.now();
    lastFrameAt=now;
    if(previous&&now-previous<1000/(state.fps||30)-4){
      scheduleFrame();
      return
    }
    const dt=Math.min(.08,(now-previous)/1000||.016);
    previous=now;
    let dbLevel=-99;
    if(ready&&ctx&&micLive()&&micAnalyser){
      micAnalyser.getFloatTimeDomainData(levelData);
      let sum=0;
      for(const s of levelData)sum+=s*s;
      dbLevel=20*Math.log10(Math.max(1e-8,Math.sqrt(sum/levelData.length)))
    }
    const testing=now<testUntil;
    talkEnv+=((micMuted||dbLevel<state.threshold?0:Math.min(1,(dbLevel-state.threshold)/22))-talkEnv)*Math.min(1,dt*5);
    const signal=testing?Math.sin(now/110)>-.1:!micMuted&&dbLevel>state.threshold+(mouth?-3:0);
    if(signal)lastTalk=now;
    mouth=(!micMuted||testing)&&(signal||now-lastTalk<state.hold);
    if(now>nextBlink){
      blinkUntil=now+130;
      nextBlink=now+3000+Math.random()*3000
    }
    const blink=(state.blink&&now<blinkUntil)||(testing&&Math.sin(now/370)>.9);
    updateSeasonParticles(dt,now);
    background();
    effects(dt,now,'back');
    if(sceneAvatar()){
      drawAvatar(now,mouth&&selfSpeak(),blink);
      drawMascots(now,dt)
    }
    drawSceneImage(now);
    effects(dt,now,'front');
    if(scene==='live')caption();else sceneCaption();
    if(outputWindow&&!outputWindow.closed&&outContext){
      try{
        if(outContext.canvas.width!==W||outContext.canvas.height!==H){
          outContext.canvas.width=W;
          outContext.canvas.height=H
        }
        outContext.clearRect(0,0,W,H);
        outContext.drawImage(canvas,0,0)
      }catch{
        outContext=null
      }
    }
    previewMirror(now);
    if(now-uiTick>120){
      uiTick=now;
      E('studioMeter').style.width=Math.max(0,Math.min(100,(dbLevel+70)/70*100))+'%';
      E('studioState').textContent=testing?'口パクをテスト中':!ready?'準備中':micLive()?(micMuted?'ミュート中':`${mouth?'発話中':'待機中'} / ${dbLevel<-90?'−∞':dbLevel.toFixed(0)} dB`):'マイク未接続';
      E('studioMic').textContent=ready&&micLive()?'マイクを再接続':'マイクを接続';
      if(mediaRecorder&&mediaRecorder.state==='recording')E('studioRecTime').textContent='収録中 '+Math.floor((now-recordStart)/60000)+':'+String(Math.floor((now-recordStart)/1000)%60).padStart(2,'0')
    }
    scheduleFrame()
  }

  function cleanupCapture(){
    captureStarting=false;
    mediaRecorder=null;
    E('studioAspect').disabled=false;
    E('studioFps').disabled=false;
    if(studioCapturing){
      studioCapturing=false;
      applyMonitor();
      setTimeout(releaseBoostHoldIfQuiet,0)
    }
    if(videoDest&&limOut)try{
      limOut.disconnect(videoDest)
    }catch(_){}
    videoStream?.getTracks().forEach(t=>t.stop());
    videoStream=null;
    videoDest=null;
    E('studioRec').disabled=false;
    E('studioStop').disabled=true;
    E('studioRec').classList.remove('recording');
    E('studioRecTime').textContent='未収録'
  }

  E('studioRec').onclick=async()=>{
    if(captureStarting||studioCapturing)return;
    if(!ready){
      toast('準備中です');
      return
    }
    captureStarting=true;studioCapturing=true;
    E('studioRec').disabled=true;
    try{
      if(!window.MediaRecorder||!canvas.captureStream)throw Error('このブラウザは動画収録に対応していません');
      await ensureRunning();
      if(!micLive())await enableMic();
      if(!micLive())throw Error('マイクが接続されていません');
      const type=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      if(!type)throw Error('利用できる動画形式がありません');
      videoStream=canvas.captureStream(state.fps||30);
      videoDest=ctx.createMediaStreamDestination();
      limOut.connect(videoDest);
      videoDest.stream.getAudioTracks().forEach(t=>videoStream.addTrack(t));
      mediaRecorder=new MediaRecorder(videoStream,{mimeType:type,videoBitsPerSecond:4500000});
      recordChunks=[];
      let failed=false;
      mediaRecorder.ondataavailable=e=>{
        if(e.data.size)recordChunks.push(e.data)
      };
      mediaRecorder.onerror=e=>{
        failed=true;
        toast('収録エラー。取得できた部分を保存します：'+(e.error?.message||'不明'),6000);
        if(mediaRecorder.state!=='inactive')mediaRecorder.stop()
      };
      mediaRecorder.onstop=()=>{
        const blob=new Blob(recordChunks,{type:mediaRecorder.mimeType});
        recordChunks=[];
        const ext=type.startsWith('video/mp4')?'mp4':'webm',
          name='otonoha_'+new Date().toISOString().replace(/[:.]/g,'-')+(failed?'_partial':'')+'.'+ext;
        cleanupCapture();
        if(blob.size){
          const url=URL.createObjectURL(blob);
          videoUrls.push(url);
          const row=document.createElement('div');
          row.className='studio-take';
          const span=document.createElement('span');
          span.textContent=name+' / '+(blob.size/1048576).toFixed(1)+' MB';
          const link=document.createElement('a');
          link.href=url;
          link.download=name;
          link.textContent='保存';
          const remove=document.createElement('button'); remove.type='button'; remove.textContent='一覧から外す'; remove.title='この画面で保持している動画を解放します。ダウンロード済みファイルは削除しません'; remove.onclick=()=>{URL.revokeObjectURL(url);videoUrls=videoUrls.filter(u=>u!==url);row.remove()}; row.append(span,link,remove);
          E('studioVideos').prepend(row);
          link.click();
          toast('動画を作成しました。必要なら「保存」から再ダウンロードできます',6000)
        }else toast('動画データを取得できませんでした',5000)
      };
      mediaRecorder.start(1000);
      captureStarting=false;
      E('studioAspect').disabled=true;
      E('studioFps').disabled=true;
      studioCapturing=true;
      boostHold=true;
      applyMonitor();
      if(monitorMuted()&&!monitorManualOff)toast('収録中はモニター音を自動で消しています（設定「録音中のモニター音」で変更できます）。動画には効果音・BGMも入ります',6000);
      recordStart=performance.now();
      E('studioStop').disabled=false;
      E('studioRec').classList.add('recording');
      E('studioRecTime').textContent='収録中 0:00'
    }catch(err){
      cleanupCapture();
      toast(err.message||'動画収録を開始できませんでした',6000)
    }
  };

  E('studioStop').onclick=()=>{
    if(mediaRecorder?.state==='recording'){
      E('studioStop').disabled=true;
      E('studioRecTime').textContent='動画を保存中';
      mediaRecorder.stop()
    }
  };

  function blobData(blob){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result);
      r.onerror=reject;
      r.readAsDataURL(blob)
    })
  }

  E('studioExport').onclick=()=>exportLive();

  function studioAssetId(id){return ['png0','png1','png2','png3',...PARTICLE_IDS,'background'].includes(id)||/^ch-[a-z0-9]{1,24}-(?:[0-3]|bg|[xy][a-z0-9]{1,8})$/.test(id)||/^fxp-[a-z0-9]{1,24}-[0-5]$/.test(id)||/^scene-(?:standby|away|end)$/.test(id)||/^msc-[a-z0-9]{1,12}$/.test(id)}
  async function studioValidate(decoded){
    for(const[id,b]of Object.entries(decoded)){
      if(!studioAssetId(id))throw Error('未対応の画像データです');
      if(!/^image\/(png|webp|jpeg)$/.test(b.type))throw Error('未対応の画像形式です');
      if(b.size>25*1024*1024)throw Error('画像は1枚25MB以下です');
      const im=await decode(b);
      if(im.width>8192||im.height>8192)throw Error('画像が大きすぎます')
    }
  }
  async function studioApply(rawState,decoded){
      const clean=sanitize(rawState);
      const tx=db.transaction('assets','readwrite');
      for(const id of new Set(['png0','png1','png2','png3',...PARTICLE_IDS,'background',...Object.keys(assetBlobs),...Object.keys(charBlobs),...Object.keys(decoded)])){
        const s=tx.objectStore('assets');
        if(decoded[id])s.put(decoded[id],ASSET+id);else s.delete(ASSET+id)
      }
      await new Promise((res,rej)=>{
        tx.oncomplete=res;
        tx.onerror=tx.onabort=()=>rej(tx.error||Error('保存に失敗しました'))
      });
      for(let i=0;i<4;i++){
        const p=E('pngPreview'+i);
        if(p.dataset.url)URL.revokeObjectURL(p.dataset.url);
        p.removeAttribute('src');
        p.hidden=true;
        E('pngName'+i).textContent='未登録'
      }
      state=clean;
      images={};
      assetBlobs={};
      charBlobs={};
      charImgs={};
      renderAssetSlots();
      applyAspect();
      applyPerf();
      seasonLoad();
      renderEffectOptions();
      for(const[id,b]of Object.entries(decoded)){
        if(/^png[0-3]$|^ch-/.test(id))continue;
        await installAsset(id,b,state.assetNames[id],false)
      }
      ensureProfiles();
      await loadAllChars();
      activateChar(state.charId,true);
      renderMascotUI();
      renderExprUI();
      paragraph=0;
      renderValues();
      save();
  }
  function studioCollect(){syncChar();const assets={};for(const[id,b]of Object.entries(assetBlobs))if(!/^png[0-3]$/.test(id))assets[id]=b;for(const[id,b]of Object.entries(charBlobs))assets[id]=b;return {state:JSON.parse(JSON.stringify(state)),assets}}
  window.__otonohaVideoRec=()=>studioCapturing||captureStarting;
  window.__otonohaStudio={collect:studioCollect,validate:studioValidate,apply:async(s,d)=>{await studioApply(s,d);toast('立ち絵・映像設定も読み込みました')},busy:()=>studioCapturing||captureStarting};

  E('studioImport').onchange=async e=>{
    const f=e.target.files[0];
    if(!f)return;
    if(rec.state!=='idle'||videoJob||studioCapturing||captureStarting){
      e.target.value='';
      toast('収録・動画書き出しが終わってから読み込んでください');
      return
    }
    try{
      if(!ready)throw Error('準備中です');
      {
        const mg=String.fromCharCode(...new Uint8Array(await f.slice(0,8).arrayBuffer()));
        if(mg==='MTKSPACK'||mg==='OTNHLIVE'||/\.(kissa|live)$/i.test(f.name)){
          e.target.value='';
          const h=document.getElementById('importFile').onchange;
          if(h)await h({target:{files:[f],value:''}});
          return
        }
      }
      if(f.size>180*1024*1024)throw Error('設定ファイルが大きすぎます');
      const data=JSON.parse(await f.text());
      if(data.format!=='otonoha-visual-studio'||data.version!==1||!data.state||!data.assets)throw Error('対応するスタジオ設定ではありません');
      const decoded={};
      for(const[id,url]of Object.entries(data.assets)){
        if(typeof url!=='string'||!/^data:image\/(png|webp|jpeg);base64,/.test(url))throw Error('未対応の画像データです');
        decoded[id]=dataUrlToBlob(url)
      }
      await studioValidate(decoded);
      if(!await askConfirm('現在の立ち絵・名義・台本・映像設定を、読み込む内容で置き換えますか？\n効果音・BGMは変更しません。','置き換える','スタジオ設定の読み込み')){
        toast('読み込みを取り消しました');
        return
      }
      await studioApply(data.state,decoded);
      toast('スタジオ設定を読み込みました')
    }catch(err){
      toast('読み込めませんでした：'+err.message,6000)
    }finally{
      e.target.value=''
    }
  };

  window.addEventListener('beforeunload',e=>{
    if(studioCapturing||captureStarting){
      e.preventDefault();
      e.returnValue=''
    }
  });
  window.addEventListener('pagehide',()=>{
    closing=true;
    videoUrls.forEach(u=>URL.revokeObjectURL(u));
    try{
      outputWindow?.close()
    }catch{}
  });

 // ---------- v0.4.8 ----------
 
  const FXK=['count','speed','fxSize','fxOpacity','imageMotion'],
    FXI={count:'studioCount',speed:'studioSpeed',fxSize:'studioFxSize',fxOpacity:'studioFxOpacity',imageMotion:'studioImageMotion'};
 
  function isP(e){return typeof e==='string'&&e.startsWith('p:')}
  function presetOf(e){if(!isP(e))return null;const id=e.slice(2);return (state.fxPresets||[]).find(p=>p.id===id)||null}
  function pimg(pid,n){return pid==='img'?PARTICLE_IDS[n]:'fxp-'+pid+'-'+n}
  function presetImageIds(){return (state.fxPresets||[]).flatMap(p=>[0,1,2,3,4,5].map(n=>pimg(p.id,n)))}
  function fxTarget(e){return presetOf(e)||(state.fxSeason&&state.fxSeason[e])||null}
  function fxSet(){return fxTarget(curEffect())||state}

  function seasonPut(){
    const s=fxTarget(state.effect);
    if(s)for(const k of FXK)s[k]=state[k]
  }

  function seasonLoad(){
    const s=fxTarget(state.effect);
    if(s)for(const k of FXK){
      state[k]=s[k];
      const el=E(FXI[k]);
      if(el)el.value=s[k]
    }
    renderPresetUI()
  }

  function renderEffectOptions(){
    const seasons=[['none','なし'],['spring','春 / 薄絹の桜'],['summer','夏 / 虹彩の泡'],['autumn','秋 / 琥珀の紅葉'],['winter','冬 / 銀雪の結晶']],
      pres=(state.fxPresets||[]).map(p=>['p:'+p.id,'画像 / '+p.name]);
    const fill=(sel,extra,val)=>{
      if(!sel)return;
      sel.replaceChildren(...[...extra,...seasons,...pres].map(([v,l])=>new Option(l,v)));
      sel.value=val;
      if(sel.value!==val)sel.value=extra.length?extra[0][0]:'none'
    };
    fill(E('studioEffect'),[],state.effect);
    if(state.scenes)for(const k of ['standby','away','end'])fill(E('scene_'+k+'_effect'),[['keep','配信中と同じ']],state.scenes[k]?.effect||'keep');
    document.body.toggleAttribute('data-fxp',isP(state.effect))
  }

  function renderPresetUI(){
    const p=presetOf(state.effect);
    document.body.toggleAttribute('data-fxp',!!p);
    const n=E('fxPresetName');
    if(n&&document.activeElement!==n)n.value=p?p.name:'';
    renderAssetSlots()
  }

  function selectEffect(v){
    state.effect=v;
    for(const q of particles)q.beh='';
    renderEffectOptions();
    seasonLoad();
    save()
  }

  function newPresetId(){
    let id;
    do id=Math.random().toString(36).slice(2,8);while(id==='img'||(state.fxPresets||[]).some(p=>p.id===id));
    return id
  }

  E('fxPresetNew').onclick=()=>{
    const list=state.fxPresets||(state.fxPresets=[]);
    if(list.length>=30){toast('画像のプリセットは30件までです');return}
    const base=fxSet(),id=newPresetId();
    list.push({id,name:'画像のプリセット'+(list.length+1),count:base.count,speed:base.speed,fxSize:base.fxSize,fxOpacity:base.fxOpacity,imageMotion:'flutter'});
    selectEffect('p:'+id);
    toast('プリセットを作りました。名前を付けて、降らせる画像を登録してください',5000);
    E('fxPresetName')?.focus()
  };

  E('fxPresetDup').onclick=async()=>{
    const src=presetOf(state.effect),list=state.fxPresets;
    if(!src)return;
    if(list.length>=30){toast('画像のプリセットは30件までです');return}
    const id=newPresetId();
    list.splice(list.indexOf(src)+1,0,{...src,id,name:(src.name+'（複製）').slice(0,30)});
    try{
      for(let n=0;n<6;n++){const b=assetBlobs[pimg(src.id,n)];if(b)await installAsset(pimg(id,n),b,state.assetNames[pimg(src.id,n)],true)}
    }catch(err){toast('画像を複製できませんでした：'+(err.message||err),5000)}
    selectEffect('p:'+id);
    toast('複製しました')
  };

  E('fxPresetDel').onclick=e=>{
    const p=presetOf(state.effect);
    if(!p)return;
    armed(e.currentTarget,'もう一度押すと「'+p.name+'」と画像を削除',async()=>{
      for(let n=0;n<6;n++){const id=pimg(p.id,n);try{await deleteAsset(ASSET+id)}catch(_){}delete images[id];delete assetBlobs[id];delete state.assetNames[id]}
      state.fxPresets=state.fxPresets.filter(x=>x!==p);
      for(const k of ['standby','away','end'])if(state.scenes[k].effect==='p:'+p.id)state.scenes[k].effect='keep';
      selectEffect('none');
      renderSceneForm();
      toast('プリセットを削除しました')
    })
  };

  E('fxPresetName').oninput=e=>{
    const p=presetOf(state.effect);
    if(!p)return;
    p.name=e.target.value.slice(0,30)||'画像のプリセット';
    renderEffectOptions();
    save()
  };

  for(const k of FXK){
    const el=E(FXI[k]);
    el.addEventListener('input',()=>{
      state[k]=el.type==='range'?Number(el.value):el.value;
      seasonPut();
      save()
    })
  }
 
  E('studioEffect').addEventListener('input',e=>{
    state.effect=e.target.value;
    renderEffectOptions();
    seasonLoad();
    save()
  });
 
  function renderMotionOut(){
    document.querySelectorAll('output[data-out]').forEach(o=>{
      const el=E(o.dataset.out);
      if(el)o.textContent=el.value+'%'
    })
  }
 
  document.querySelectorAll('output[data-out]').forEach(o=>{
    const el=E(o.dataset.out);
    if(el)el.addEventListener('input',renderMotionOut)
  });
 
  function applyPerfLabel(){
    E('studioSizeLabel').textContent=`${W} × ${H} / ${state.fps||30}fps`+(state.light?' / 軽量モード':'')
  }
 
  function applyPerf(){
    document.body.toggleAttribute('data-light',!!state.light);
    window.__otoLight=!!state.light;
    E('studioFps').value=String(state.fps||30);
    E('studioLight').checked=!!state.light;
    applyPerfLabel();
    const w=tickWorker;
    if(w&&document.hidden)w.postMessage(Math.max(33,Math.round(1000/(state.fps||30))))
  }
 
  E('studioFps').onchange=e=>{
    const v=Number(e.target.value);
    state.fps=[10,15,30].includes(v)?v:30;
    applyPerf();
    save();
    if(mediaRecorder&&mediaRecorder.state==='recording')toast('収録中の動画には、次の収録から反映されます',4000)
  };
 
  E('studioLight').onchange=e=>{
    state.light=e.target.checked;
    applyPerf();
    save()
  };
 
  let pvCtx=null,
    pvAt=0;
  function previewMirror(now){
    if(document.body.dataset.page!=='settings')return;
    if(now-pvAt<(state.light?95:30))return;
    pvAt=now;
    const c=E('settingsPreview');
    if(!c)return;
    const pw=W>H?640:360,
      ph=W>H?360:640;
    if(c.width!==pw||c.height!==ph){
      c.width=pw;
      c.height=ph
    }
    pvCtx=pvCtx||c.getContext('2d');
    pvCtx.clearRect(0,0,pw,ph);
    pvCtx.drawImage(canvas,0,0,pw,ph)
  }
 
  E('gotoLook').onclick=()=>{
    E('navSettings').click();
    setTimeout(()=>E('studioSettings')?.scrollIntoView({block:'start'}),60)
  };
 
  if(!state.fxSeason||typeof state.fxSeason!=='object'){
    state.fxSeason={};
    for(const e of ['spring','summer','autumn','winter']){
      const o={};
      for(const k of FXK)o[k]=state[k];
      state.fxSeason[e]=o
    }
  }
  if(!Array.isArray(state.fxPresets)){
    state.fxPresets=[{id:'img',name:'好きな画像',count:state.count,speed:state.speed,fxSize:state.fxSize,fxOpacity:state.fxOpacity,imageMotion:state.imageMotion||'flutter'}];
    if(state.effect==='image')state.effect='p:img'
  }
  renderEffectOptions();
  seasonLoad();


 // ---------- v0.5.0: expressions, mascots, scene images, quick tuning, drag ----------
  let curExpr='';
  function charSlots(cid){
    const c=state.chars&&state.chars[cid];
    return [0,1,2,3,'bg',...((c&&c.exprs)||[]).flatMap(e=>['x'+e.id,'y'+e.id])]
  }
  function curExprObj(){
    const c=curChar();
    return curExpr&&c&&c.exprs?c.exprs.find(e=>e.id===curExpr)||null:null
  }
  function exprImage(talking){
    const e=curExprObj();
    if(!e)return null;
    const im=charImgs[charKey(state.charId,'x'+e.id)];
    if(!im)return null;
    const mo=charImgs[charKey(state.charId,'y'+e.id)];
    return talking&&mo?mo:im
  }
  function effMotion(){
    const e=curExprObj();
    return e&&e.motion!=='none'?e.motion:motion
  }
  function selfSpeak(){
    const s=state.speaker;
    return !s||s==='self'||!(state.mascots||[]).some(m=>m.id===s&&m.talk&&m.show)
  }
  function setExpr(id){
    curExpr=id||'';
    switchAt=performance.now();
    renderExprBar()
  }
  function renderExprBar(){
    const bar=E('exprBar'),c=curChar(),list=(c&&c.exprs)||[];
    if(curExpr&&!list.some(e=>e.id===curExpr))curExpr='';
    bar.hidden=!list.length;
    bar.replaceChildren();
    if(!list.length)return;
    const lab=document.createElement('span');lab.className='studio-mini';lab.textContent='表情';bar.append(lab);
    for(const [id,name] of [['','通常'],...list.map(e=>[e.id,e.name])]){
      const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(curExpr===id));
      b.onclick=()=>setExpr(id);bar.append(b)
    }
  }
  const EXPR_MOTION=[['none','動かさない（そのままの動き）'],['shake','ガタガタ'],['hop','ぴょんぴょん'],['sing','歌うゆらぎ']];
  function exprThumb(cid,slot){
    const b=charBlobs[charKey(cid,slot)];
    if(!b)return '';
    const u=URL.createObjectURL(b);charUrls.push(u);return u
  }
  function renderExprUI(){
    renderExprBar();
    const box=E('exprList'),c=curChar();
    if(!box)return;
    box.replaceChildren();
    if(!c)return;
    c.exprs=c.exprs||[];
    c.exprs.forEach((e,i)=>{
      const row=document.createElement('div');row.className='expr-row';
      const u1=exprThumb(state.charId,'x'+e.id),u2=exprThumb(state.charId,'y'+e.id);
      row.innerHTML=`<div class="studio-inline"><label class="studio-field">表情の名前<input type="text" maxlength="20" data-k="name"></label><label class="studio-field">連動する動き<select data-k="motion">${EXPR_MOTION.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div>`
        +`<div class="expr-imgs"><label>表情の画像 ${u1?`<img src="${u1}" alt="">`:'（未登録）'}<input type="file" accept="image/png,image/webp,image/jpeg" data-f="x"></label><label>口を開いた画像（任意） ${u2?`<img src="${u2}" alt="">`:'（なし）'}<input type="file" accept="image/png,image/webp,image/jpeg" data-f="y"></label></div>`
        +`<div class="studio-row"><button type="button" data-a="del">この表情を削除</button>${u2?'<button type="button" data-a="dely">口を開いた画像を外す</button>':''}</div>`;
      row.querySelector('[data-k=name]').value=e.name;
      row.querySelector('[data-k=motion]').value=e.motion;
      row.querySelector('[data-k=name]').oninput=ev=>{e.name=ev.target.value.slice(0,20)||'表情';save();renderExprBar()};
      row.querySelector('[data-k=motion]').onchange=ev=>{e.motion=ev.target.value;save()};
      row.querySelectorAll('input[type=file]').forEach(inp=>inp.onchange=async ev=>{
        const f=ev.target.files[0];if(!f)return;
        try{if(!ready)throw Error('保存領域の準備中です');await storeCharImage(state.charId,inp.dataset.f+e.id,f);save();renderExprUI();toast('「'+e.name+'」の画像を登録しました')}catch(err){toast(err.message,5000)}finally{ev.target.value=''}
      });
      row.querySelector('[data-a=del]').onclick=ev=>armed(ev.currentTarget,'もう一度押すと「'+e.name+'」を削除',async()=>{
        for(const s of ['x'+e.id,'y'+e.id]){const key=charKey(state.charId,s);try{await deleteAsset(ASSET+key)}catch(_){}delete charBlobs[key];delete charImgs[key];delete state.assetNames[key]}
        c.exprs=c.exprs.filter(x=>x!==e);if(curExpr===e.id)curExpr='';save();renderExprUI()
      });
      const dy=row.querySelector('[data-a=dely]');
      if(dy)dy.onclick=async()=>{const key=charKey(state.charId,'y'+e.id);try{await deleteAsset(ASSET+key)}catch(_){}delete charBlobs[key];delete charImgs[key];save();renderExprUI()};
      box.append(row)
    })
  }
  E('exprAdd').onclick=()=>{
    const c=curChar();if(!c)return;
    c.exprs=c.exprs||[];
    if(c.exprs.length>=12){toast('表情差分は1体につき12個までです');return}
    let id;do id=Math.random().toString(36).slice(2,7);while(c.exprs.some(e=>e.id===id));
    c.exprs.push({id,name:['青ざめ','驚き','赤面','怒り'][c.exprs.length]||('表情'+(c.exprs.length+1)),motion:c.exprs.length===0?'shake':'none'});
    save();renderExprUI()
  };

  // ----- mascots -----
  let mscSel='',mscLast=0;const mscEnv={};
  function mscCur(){return (state.mascots||[]).find(m=>m.id===mscSel)||null}
  function drawMascots(now){
    const list=state.mascots||[];
    const dtp=mscLast?Math.min(.1,(now-mscLast)/1000):0;mscLast=now;
    if(!list.length)return;
    const u=H/720,t=now/1000,TAU=Math.PI*2,deg=Math.PI/180;
    for(const m of list){
      m._box=null;
      if(!m.show)continue;
      const im=images['msc-'+m.id];
      if(!im)continue;
      const seed=(m.id.charCodeAt(0)+m.id.charCodeAt(m.id.length-1))*.173,a=m.amp/100,sp=m.speed/100,
        h=H*m.size/100,f=h/im.height,w=im.width*f,x=W/2+m.x*W/200,y=H/2+m.y*H/200;
      let dx=0,dy=0,rot=0;
      if(m.motion==='float'){dy=Math.sin(t*TAU*.3*sp+seed)*12*u*a;dx=Math.sin(t*TAU*.17*sp+seed*2)*6*u*a;rot=Math.sin(t*TAU*.23*sp+seed)*3*deg*a}
      else if(m.motion==='sway'){const s=Math.sin(t*TAU*.45*sp+seed);rot=s*6*deg*a;dy=-Math.abs(s)*3*u*a}
      else if(m.motion==='hop'){const ph=(t*1.5*sp+seed)%1;dy=-4*ph*(1-ph)*18*u*a}
      else if(m.motion==='shake'){const s=Math.floor(t*11*sp);dx=(rnd(s+seed)-.5)*10*u*a;dy=(rnd(s+seed+.31)-.5)*6*u*a;rot=(rnd(s+seed+.67)-.5)*8*deg*a}
      const on=state.speaker===m.id&&m.talk,target=on?Math.max(talkEnv,mouth?.6:0):0,e0=mscEnv[m.id]||0,e1=e0+(target-e0)*Math.min(1,dtp*(target>e0?14:5));
      mscEnv[m.id]=e1;
      if(e1>.01){dy-=e1*(5+Math.abs(Math.sin(t*TAU*4.2))*10)*u;rot+=Math.sin(t*TAU*4.2)*e1*3*deg}
      const spc=avSprite(im,{x:0,y:0,w:im.width,h:im.height},f);
      g.save();g.translate(x+dx,y+dy);g.rotate(rot);g.imageSmoothingEnabled=true;g.imageSmoothingQuality=state.light?'medium':'high';
      if(spc)g.drawImage(spc.c,-spc.dw/2,-spc.dh/2);else g.drawImage(im,-w/2,-h/2,w,h);
      g.restore();
      m._box={x:x-w/2,y:y-h/2,w,h}
    }
  }
  function drawSceneImage(now){
    if(scene==='live')return;
    const c=state.scenes[scene],im=images['scene-'+scene];
    if(!c||!im)return;
    const u=H/720,t=now/1000,TAU=Math.PI*2,a=c.imgAmp/100,h=H*c.imgSize/100,f=h/im.height,w=im.width*f,x=W/2+c.imgX*W/200,y=H/2+c.imgY*H/200;
    let dx=0,dy=0,rot=0;
    if(c.imgMotion==='float'){dy=Math.sin(t*TAU/3.2)*12*u*a;dx=Math.sin(t*TAU/5.1+1)*5*u*a;rot=Math.sin(t*TAU/4.3+.4)*1.6*Math.PI/180*a}
    else if(c.imgMotion==='sway')rot=Math.sin(t*TAU/2.6)*4*Math.PI/180*a;
    const spc=avSprite(im,{x:0,y:0,w:im.width,h:im.height},f);
    g.save();g.translate(x+dx,y+dy);g.rotate(rot);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    if(spc)g.drawImage(spc.c,-spc.dw/2,-spc.dh/2);else g.drawImage(im,-w/2,-h/2,w,h);
    g.restore()
  }
  function renderSpeakerBar(){
    const bar=E('speakerBar'),list=(state.mascots||[]).filter(m=>m.talk&&m.show);
    if(state.speaker!=='self'&&!list.some(m=>m.id===state.speaker))state.speaker='self';
    bar.hidden=!list.length;bar.replaceChildren();
    if(!list.length)return;
    const lab=document.createElement('span');lab.className='studio-mini';lab.textContent='話者';bar.append(lab);
    for(const [id,name] of [['self','本人（立ち絵）'],...list.map(m=>[m.id,m.name])]){
      const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(state.speaker===id));
      b.onclick=()=>{state.speaker=id;save();renderSpeakerBar()};bar.append(b)
    }
  }
  function renderMascotUI(){
    const list=state.mascots||[];
    if(!list.some(m=>m.id===mscSel))mscSel=list[0]?.id||'';
    const chips=E('mascotChips');chips.replaceChildren();
    for(const m of list){const b=document.createElement('button');b.type='button';b.textContent=m.name+(images['msc-'+m.id]?'':'（画像なし）');b.classList.toggle('selected',m.id===mscSel);b.onclick=()=>{mscSel=m.id;renderMascotUI()};chips.append(b)}
    const m=mscCur();
    E('mascotEdit').hidden=!m;E('mascotDel').disabled=!m;
    if(m){
      if(document.activeElement!==E('mscName'))E('mscName').value=m.name;
      E('mscShow').checked=m.show;E('mscTalk').checked=m.talk;E('mscMotion').value=m.motion;
      for(const [id,k] of [['mscAmp','amp'],['mscSpeed','speed'],['mscSize','size'],['mscX','x'],['mscY','y']])if(document.activeElement!==E(id))E(id).value=m[k];
      E('mscAmpVal').textContent=m.amp+'%';E('mscSpeedVal').textContent=m.speed+'%';E('mscSizeVal').textContent=m.size+'%';
      E('mscFileName').textContent=assetBlobs['msc-'+m.id]?(state.assetNames['msc-'+m.id]||'画像'):'未登録'
    }
    renderSpeakerBar()
  }
  E('mascotAdd').onclick=()=>{
    state.mascots=state.mascots||[];
    if(state.mascots.length>=8){toast('マスコットは8体までです');return}
    let id;do id=Math.random().toString(36).slice(2,8);while(state.mascots.some(m=>m.id===id));
    const n=state.mascots.length;
    state.mascots.push({id,name:'マスコット'+(n+1),show:true,talk:false,motion:'float',amp:100,speed:100,size:22,x:60-n*25,y:40});
    mscSel=id;save();renderMascotUI();toast('マスコットを追加しました。画像を登録してください')
  };
  E('mascotDel').onclick=e=>{
    const m=mscCur();if(!m)return;
    armed(e.currentTarget,'もう一度押すと「'+m.name+'」を削除',async()=>{
      const id='msc-'+m.id;try{await deleteAsset(ASSET+id)}catch(_){}delete images[id];delete assetBlobs[id];delete state.assetNames[id];
      state.mascots=state.mascots.filter(x=>x!==m);save();renderMascotUI()
    })
  };
  E('mscFile').onchange=async e=>{
    const f=e.target.files[0],m=mscCur();if(!f||!m)return;
    try{if(!ready)throw Error('保存領域の準備中です');await installAsset('msc-'+m.id,f,f.name);renderMascotUI();toast('「'+m.name+'」の画像を登録しました')}catch(err){toast(err.message,5000)}finally{e.target.value=''}
  };
  E('mscName').oninput=e=>{const m=mscCur();if(m){m.name=e.target.value.slice(0,20)||'マスコット';save();renderMascotUI()}};
  E('mscShow').onchange=e=>{const m=mscCur();if(m){m.show=e.target.checked;save();renderMascotUI()}};
  E('mscTalk').onchange=e=>{const m=mscCur();if(m){m.talk=e.target.checked;save();renderMascotUI()}};
  E('mscMotion').onchange=e=>{const m=mscCur();if(m){m.motion=e.target.value;save()}};
  for(const [id,k] of [['mscAmp','amp'],['mscSpeed','speed'],['mscSize','size'],['mscX','x'],['mscY','y']])E(id).addEventListener('input',e=>{const m=mscCur();if(m){m[k]=Number(e.target.value);save();renderMascotUI()}});

  // ----- scene images / BGM boost -----
  for(const k of ['standby','away','end']){
    E('scene_'+k+'_imgFile').onchange=async e=>{
      const f=e.target.files[0];if(!f)return;
      try{if(!ready)throw Error('保存領域の準備中です');await installAsset('scene-'+k,f,f.name);toast(SCENE_LABEL[k]+'の画像を登録しました')}catch(err){toast(err.message,5000)}finally{e.target.value=''}
    };
    E('scene_'+k+'_imgDel').onclick=()=>removeAsset('scene-'+k)
  }
  E('sceneBoost').addEventListener('input',e=>{
    state.sceneBoost=Number(e.target.value);E('sceneBoostVal').textContent='+'+state.sceneBoost+' dB';
    if(scene!=='live'){window.__sceneBgmBoost=state.sceneBoost;updateGains()}
    save()
  });

  // ----- quick tuning on the stage (mirrors the controls in 設定) -----
  const QT=[['studioScale','大きさ','%'],['studioX','左右',''],['studioY','上下',''],['studioMotionSing','歌うゆらぎの大きさ','%'],['studioMotionSingSpeed','歌うゆらぎの速さ','%'],['studioMotionHop','ぴょんぴょんの大きさ','%'],['studioMotionShake','ガタガタの大きさ','%'],['studioMotionAmt','呼吸・話すときの動き','%'],['studioEffect','季節の演出・画像のプリセット',''],['studioCount','演出の量',''],['studioSpeed','演出の速さ',''],['studioFxSize','演出の大きさ',''],['studioFxOpacity','演出の濃さ','']];
  (function buildQuickTune(){
    const box=E('quickTuneBody');
    for(const [id,label] of QT){
      const src=E(id);if(!src)continue;
      const lab=document.createElement('label'),cl=src.cloneNode(true),out=document.createElement('output');
      cl.id='qt_'+id;cl.removeAttribute('aria-label');out.id='qto_'+id;
      lab.append(document.createTextNode(label+' '),out,cl);box.append(lab);
      cl.addEventListener('input',()=>{src.value=cl.value;src.dispatchEvent(new Event('input',{bubbles:true}))});
      cl.addEventListener('change',()=>{if(src.tagName==='SELECT')src.dispatchEvent(new Event('change',{bubbles:true}))})
    }
  })();
  function syncQuickTune(){
    if(!E('quickTune').open)return;
    for(const [id,,unit] of QT){
      const s=E(id),c=E('qt_'+id),o=E('qto_'+id);if(!s||!c)continue;
      if(s.tagName==='SELECT'&&c.innerHTML!==s.innerHTML)c.innerHTML=s.innerHTML;
      if(document.activeElement!==c)c.value=s.value;
      if(o)o.textContent=s.tagName==='SELECT'?'':s.value+unit
    }
  }
  setInterval(syncQuickTune,250);
  E('quickTune').addEventListener('toggle',syncQuickTune);

  // ----- drag the avatar / a mascot on the stage -----
  let drag=null;
  function stagePoint(e){
    const r=canvas.getBoundingClientRect(),s=Math.min(r.width/W,r.height/H),ox=(r.width-W*s)/2,oy=(r.height-H*s)/2;
    return {x:(e.clientX-r.left-ox)/s,y:(e.clientY-r.top-oy)/s}
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const p=stagePoint(e);
    let target=null;
    for(const m of [...(state.mascots||[])].reverse())if(m._box&&p.x>=m._box.x&&p.x<=m._box.x+m._box.w&&p.y>=m._box.y&&p.y<=m._box.y+m._box.h){target=m;break}
    if(!target&&sceneAvatar()){const gg=avatarGeom();if(p.x>=gg.cx-gg.w/2&&p.x<=gg.cx+gg.w/2&&p.y>=gg.bottom-gg.h&&p.y<=gg.bottom)target='avatar'}
    if(!target)return;
    drag={target,p0:p,ox:target==='avatar'?state.x:target.x,oy:target==='avatar'?state.y:target.y};
    if(target!=='avatar'){mscSel=target.id;renderMascotUI()}
    canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');e.preventDefault()
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag)return;
    const p=stagePoint(e),dx=p.x-drag.p0.x,dy=p.y-drag.p0.y;
    if(drag.target==='avatar'){
      state.x=Math.max(-300,Math.min(300,Math.round(drag.ox+dx/W*100)));
      state.y=Math.max(-200,Math.min(500,Math.round(drag.oy+dy/H*100)));
      E('studioX').value=state.x;E('studioY').value=state.y;E('yVal').textContent=Math.round(state.y)+'%'
    }else{
      drag.target.x=Math.max(-100,Math.min(100,Math.round(drag.ox+dx/W*200)));
      drag.target.y=Math.max(-100,Math.min(100,Math.round(drag.oy+dy/H*200)));
      E('mscX').value=drag.target.x;E('mscY').value=drag.target.y
    }
  });
  const endDrag=()=>{if(!drag)return;drag=null;canvas.classList.remove('dragging');save()};
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);

  // ----- app mode -----
  window.__otonohaAppChanged=app=>{
    if(app==='radio'){studioLiveMode=false;applyMonitor()}
    else setMode(document.body.dataset.studioMode||'live')
  };

  applyPerf();
  renderMotionOut();
  renderMascotUI();
  renderExprUI();
  if(document.body.dataset.app==='radio')window.__otonohaAppChanged('radio');

  renderValues();
  applyAspect();
  setMotion('still');
  renderAssetSlots();
  renderSceneForm();
  renderScene();
  listSinks();
  setMode('live');
  scheduleFrame();

  (async()=>{
    for(let i=0;i<100&&!db;i++)await new Promise(r=>setTimeout(r,50));
    if(!db){
      toast('保存領域が利用できませんでした',5000);
      return
    }
    ready=true;
    for(const id of new Set([...PARTICLE_IDS,'background',...presetImageIds(),'scene-standby','scene-away','scene-end',...(state.mascots||[]).map(m=>'msc-'+m.id)]))try{
      const b=await getAsset(ASSET+id);
      if(b)await installAsset(id,b,state.assetNames[id],false)
    }catch(err){
      toast(assetName(id)+'を復元できませんでした',4000)
    }
    ensureProfiles();
    await loadAllChars();
    activateChar(state.charId,true);
    renderMascotUI();
    renderExprUI();
    renderAssetSlots()
  })();

})();
