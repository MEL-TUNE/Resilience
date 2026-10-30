/* 名義とキャラクター */
/* ===================== 名義・キャラクター ===================== */
 
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
    renderMascotUI();
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
  
    for(const sel of [E('profileSel')].filter(Boolean)){
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
    state.profiles.push({id:pid,name:'新しい名義',chars:[cid],cur:cid,snap:profileSnap(),mscShow:[]});
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
    if(E('studioModeHelp'))E('studioModeHelp').textContent=mode==='plan'?'企画文をAIへ渡し、返答を台本欄に貼り付けて進行できます。AIと自動通信する機能はありません。':'配信ソフトで「映像だけ別窓」を取り込み、音声はこのブラウザの音＋マイクを配信側で取り込みます。配信サービスへの直接送出機能はありません。'
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
