/* マイクのミュート、準備中・離席中・配信終了の画面、配信用の出力先 */


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
