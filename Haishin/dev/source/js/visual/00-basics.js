/* 基本：状態の読み込み・保存・検証、画像の登録 */

  {
    const mb=document.getElementById('miniBar'),
      upd=()=>document.documentElement.style.setProperty('--mini-h',(mb&&!mb.hidden?mb.offsetHeight:0)+'px');
    if(mb){
      new MutationObserver(upd).observe(mb,{attributes:true,attributeFilter:['hidden']});
      if(window.ResizeObserver)new ResizeObserver(upd).observe(mb)
    }
    upd()
  }

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
    sceneFont:'hachimaru',
    mouthMode:'hold',
    flapMs:120,
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
    vidFormat:'mp4',
    vidQuality:8,
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
    talking=false,
    talkStart=0,
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
    if(typeof v.sceneFont==='string'&&/^[a-z]{1,16}$/.test(v.sceneFont))out.sceneFont=v.sceneFont;
    if(['hold','flap'].includes(v.mouthMode))out.mouthMode=v.mouthMode;
    if(Number.isFinite(Number(v.flapMs)))out.flapMs=Math.max(60,Math.min(400,Math.round(Number(v.flapMs))));
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
    out.vidFormat=v.vidFormat==='webm'?'webm':'mp4';
    out.vidQuality=[4.5,8,16].includes(Number(v.vidQuality))?Number(v.vidQuality):8;
    {const MV=['float','sway','hop','run','shake','still'],num=(x,a,b,df)=>{const n=Number(x);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):df},seenM=new Set();out.mascots=[];
     if(Array.isArray(v.mascots))for(const m of v.mascots.slice(0,10)){if(!m||typeof m!=='object'||typeof m.id!=='string'||!/^[a-z0-9]{1,12}$/.test(m.id)||seenM.has(m.id))continue;seenM.add(m.id);out.mascots.push({id:m.id,name:String(m.name||'マスコット').slice(0,20),show:m.show!==false,talk:m.talk===true,motion:MV.includes(m.motion)?m.motion:'float',amp:num(m.amp,0,200,100),speed:num(m.speed,20,300,100),size:num(m.size,3,90,22),x:num(m.x,-100,100,60),y:num(m.y,-100,100,40),face:['none','right','left'].includes(m.face)?m.face:'none'})}
     {let shown=0;for(const m of out.mascots)if(m.show&&++shown>2)m.show=false}
     out.speaker=typeof v.speaker==='string'&&(v.speaker==='self'||out.mascots.some(m=>m.id===v.speaker))?v.speaker:'self';
     out.sceneBoost=num(v.sceneBoost,0,12,6)}
    if(Array.isArray(v.profiles))out.profiles=v.profiles.slice(0,20).filter(p=>p&&typeof p==='object'&&typeof p.id==='string'&&/^[a-z0-9]{1,24}$/.test(p.id)).map(p=>({
      id:p.id,
      name:String(p.name||'名義').slice(0,40),
      chars:Array.isArray(p.chars)?p.chars.filter(c=>typeof c==='string'&&/^[a-z0-9]{1,24}$/.test(c)).slice(0,60):[],
      cur:typeof p.cur==='string'?p.cur:'',
      snap:p.snap&&typeof p.snap==='object'?p.snap:{},
      mscShow:Array.isArray(p.mscShow)?p.mscShow.filter(x=>typeof x==='string'&&/^[a-z0-9]{1,12}$/.test(x)).slice(0,2):null
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
    studioMouthMode:'mouthMode',
    studioFlap:'flapMs',
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
    E('flapValue').textContent=state.flapMs+' ms';
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
      E('flapValue').textContent=state.flapMs+' ms';
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
  }
