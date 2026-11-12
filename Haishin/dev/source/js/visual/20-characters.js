/* 名義とキャラクター：データの形、切り替え（activateChar／activateProfile）、画面との同期（syncChar） */

  function cleanChar(c){
    const o={
      name:String(c.name||'キャラクター').slice(0,40),
      mode:c.mode==='single'?'single':'four',
      talk:['hop','sway','none'].includes(c.talk)?c.talk:'hop',
      breath:c.breath===true,
      bgMode:['inherit','own','cafe','transparent','green','blue','black'].includes(c.bgMode)?c.bgMode:'inherit',
      trim:c.trim!==false,
      pos:aspectPosClean(c.pos,'char'),
      exprs:Array.isArray(c.exprs)?c.exprs.filter(e=>e&&typeof e==='object'&&typeof e.id==='string'&&/^[a-z0-9]{1,8}$/.test(e.id)).slice(0,12).map(e=>({id:e.id,name:String(e.name||'表情').slice(0,20),motion:['none','shake','hop','sing','wander','iya'].includes(e.motion)?e.motion:'none',amt:Number.isFinite(Number(e.amt))?Math.max(0,Math.min(200,Math.round(Number(e.amt)))):100,spd:Number.isFinite(Number(e.spd))?Math.max(40,Math.min(200,Math.round(Number(e.spd)))):100})):[]
    };
    for(const k of CHAR_KEYS){
      if(k==='blink'||k==='bounce'){
        o[k]=typeof c[k]==='boolean'?c[k]:defaults[k];
        continue
      }
      let n=Number(c[k]);
      if(!Number.isFinite(n)&&/^motion(Sing|Hop|Shake|Wander|Iya)$/.test(k))n=Number(c.motionAmt);
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
    return {scenes:JSON.parse(JSON.stringify(state.scenes)),bg:state.bg,sceneFont:state.sceneFont}
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
      imgY:num(x.imgY,-100,100,0),
      // 映像の向きごとの、画像の大きさと位置の控え（41-aspect-memory.js）
      pos:(()=>{
        const out={};
        for(const asp of ['landscape','portrait','x34']){
          const q=x.pos&&typeof x.pos==='object'?x.pos[asp]:null;
          if(q&&typeof q==='object'&&['imgSize','imgX','imgY'].every(f=>Number.isFinite(Number(q[f]))))out[asp]={imgSize:num(q.imgSize,10,150,60),imgX:num(q.imgX,-100,100,0),imgY:num(q.imgY,-100,100,0)}
        }
        return out
      })()
    }
  }

  function ensureProfiles(){
    if(!state.chars||typeof state.chars!=='object'||Array.isArray(state.chars))state.chars={};

    for(const[id,c]of Object.entries(state.chars))state.chars[id]=cleanChar(c);

    if(!Array.isArray(state.profiles)||!state.profiles.length){
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
    if(c){Object.assign(c,pickValues());charPosKeep(c)}
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
    charPosApply(c);
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
    if(typeof s.sceneFont==='string'&&s.sceneFont in SCENE_FONTS)state.sceneFont=s.sceneFont;
    syncSceneFontUI();
for(const q of particles)q.beh='';
    state.charId='';
    activateChar(p.cur,true);
    switchAt=performance.now();
    renderSceneForm();
    renderMascotUI();
    syncBgmProfiles(true);
    renderBgList();
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

  let bgmProfSig='';
  function syncBgmProfiles(follow){
    const list=(state.profiles||[]).map(p=>({id:p.id,name:p.name})),
      sig=JSON.stringify(list);
    if(!follow&&sig===bgmProfSig)return;
    bgmProfSig=sig;
    window.__otonohaBgmProfiles?.(list,state.profileId,follow)
  }
  function renderCharUI(){
    syncBgmProfiles(false);
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
