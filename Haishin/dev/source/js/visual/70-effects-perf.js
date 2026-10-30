/* 季節の演出・画像のプリセット、なめらかさ（fps）・軽量モード、設定画面のプレビュー */

 
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
