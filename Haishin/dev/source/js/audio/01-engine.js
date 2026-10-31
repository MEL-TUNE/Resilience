/* 音声エンジン */

function stereoGain(){
  const g=ctx.createGain();
  g.channelCount=2;
  g.channelCountMode='explicit';
  g.channelInterpretation='speakers';
  return g
}

function audioEngine(){
  if(ctx)return;
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)throw Error('Web Audio非対応');

  ctx=new C({latencyHint:'interactive'});

  masterBus=ctx.createGain();
  voBus=ctx.createGain();
  seBus=ctx.createGain();
  envBus=ctx.createGain();
  bgmBus=ctx.createGain();
  duckGain=ctx.createGain();
  programBus=stereoGain();

  voiceBus=ctx.createGain();
  selfMon=ctx.createGain();
  recMix=stereoGain();
  limiter=ctx.createDynamicsCompressor();
  limOut=stereoGain();

  bgmTrim=ctx.createGain();
  seBus.connect(programBus);
  envBus.connect(programBus);
  voBus.connect(programBus);
  bgmBus.connect(bgmTrim);
  bgmTrim.connect(duckGain);
  duckGain.connect(programBus);

  monProg=ctx.createGain();
  programBus.connect(monProg);
  monProg.connect(masterBus);
  voiceBus.connect(selfMon);
  selfMon.connect(masterBus);
  masterBus.connect(ctx.destination);

  programBus.connect(recMix);
  voiceOut=ctx.createGain();
  voiceBus.connect(voiceOut);
  voiceOut.connect(recMix);
  recMix.connect(limiter);
  limiter.connect(limOut);

  micAnalyser=ctx.createAnalyser();
  micAnalyser.fftSize=2048;
  voiceBus.connect(micAnalyser);

  mixAnalyser=ctx.createAnalyser();
  mixAnalyser.fftSize=2048;
  limOut.connect(mixAnalyser);

  merger=ctx.createChannelMerger(5);

  const s1=ctx.createChannelSplitter(2);
  limOut.connect(s1);
  s1.connect(merger,0,0);
  s1.connect(merger,1,1);

  voiceBus.connect(merger,0,2);

  const s2=ctx.createChannelSplitter(2);
  programBus.connect(s2);
  s2.connect(merger,0,3);
  s2.connect(merger,1,4);

  updateGains();
  requestAnimationFrame(meterLoop);
  setInterval(duckLoop,40);
}

function updateGains(){
  if(!ctx)return;
  const r=cfg.rec;

  masterBus.gain.value=monitorMuted()?0:cfg.master/100;
  monProg.gain.value=previewBoost();
  seBus.gain.value=dbGain(cfg.seDb);
  envBus.gain.value=dbGain(cfg.envDb);
  bgmBus.gain.value=dbGain(cfg.bgmDb+(window.__sceneBgmBoost||0));
  voBus.gain.value=dbGain(cfg.voDb);

  if(micGain)micGain.gain.value=micMuted?0:r.micVolume/100;
  selfMon.gain.value=r.monitor&&!streamMode()?1:0;
  voiceOut.gain.value=streamMode()?0:1;

  if(r.limiter){
    limiter.threshold.value=-2;
    limiter.knee.value=0;
    limiter.ratio.value=20;
    limiter.attack.value=.002;
    limiter.release.value=.15
  }
 else{
    limiter.threshold.value=0;
    limiter.knee.value=0;
    limiter.ratio.value=1
  }

  if(!r.duck){
    duckGain.gain.cancelScheduledValues(ctx.currentTime);
    duckGain.gain.setTargetAtTime(1,ctx.currentTime,.1);
    ducked=false;
    renderDuck()
  }
}

const bufCache=new Map(),
  bgmLru=[],
  bgmLoud=new Map();

function measureRms(buf){
  let sum=0,
    n=0;
  const step=8;
  for(let c=0;c<buf.numberOfChannels;c++){
    const d=buf.getChannelData(c);
    for(let i=0;i<d.length;i+=step){
      sum+=d[i]*d[i];
      n++
    }
  }
  const rms=Math.sqrt(sum/Math.max(1,n));
  return rms>0?20*Math.log10(rms):-90
}

function bgmItemGain(assetId,volume){
  let g=volume/100;
  if(cfg.rec.bgmLevel!==false&&bgmLoud.has(assetId)){
    const adj=Math.max(-12,Math.min(12,-20-bgmLoud.get(assetId)));
    g*=Math.pow(10,adj/20)
  }
  return g
}

function decodeAsset(assetId,isBgm){
  if(bufCache.has(assetId)){
    if(isBgm){
      const i=bgmLru.indexOf(assetId);
      if(i>=0)bgmLru.splice(i,1);
      bgmLru.push(assetId)
    }
    return bufCache.get(assetId)
  }

  const pr=(async()=>{
    const blob=await getAsset(assetId);
    if(!blob)throw Object.assign(Error('missing'),{userMessage:'保存音源が見つかりません。再登録してください'});

    const data=await blob.arrayBuffer();
    audioEngine();

    try{
      const buf=await new Promise((res,rej)=>{
        const r=ctx.decodeAudioData(data,res,rej);
        if(r&&r.then)r.then(res,rej)
      });
      if(isBgm)bgmLoud.set(assetId,measureRms(buf));
      return buf
    }
  catch(e){
      throw Object.assign(Error('decode'),{userMessage:'この音源の形式を読み込めませんでした（'+(blob.type||'形式不明')+'）。mp3かwavで登録し直すと鳴る可能性があります'})
    }
  })();

  bufCache.set(assetId,pr);
  pr.catch(()=>bufCache.delete(assetId));

  if(isBgm){
    bgmLru.push(assetId);
    while(bgmLru.length>3){
      const old=bgmLru.shift();
      if(old!==bgmPlaying?.assetId)bufCache.delete(old)
    }
  }

  return pr;
}

function release(inst){
  if(!inst||inst.released)return;
  setTimeout(releaseBoostHoldIfQuiet,0);
  inst.released=true;
  active.delete(inst);
  if(bgmPlaying===inst)bgmPlaying=null;
  try{
    inst.source.onended=null;
    inst.source.stop()
  }catch(_){}
  try{
    inst.source.disconnect();
    inst.gain.disconnect()
  }catch(_){}
  render();
  renderBgmNow()
}

function fadeStop(inst,duration=.34){
  if(!inst||inst.released||inst.fading)return Promise.resolve();
  inst.fading=true;
  active.delete(inst);
  if(bgmPlaying===inst){
    bgmPlaying=null;
    bgmFading=inst
  }
  render();
  renderBgmNow();
  return new Promise(resolve=>{
    if(!ctx||ctx.state!=='running'){
      release(inst);
      if(bgmFading===inst)bgmFading=null;
      resolve();
      return
    }
    const now=ctx.currentTime;
    inst.gain.gain.cancelScheduledValues(now);
    inst.gain.gain.setValueAtTime(inst.gain.gain.value,now);
    inst.gain.gain.linearRampToValueAtTime(0,now+duration);
    setTimeout(()=>{
      release(inst);
      if(bgmFading===inst)bgmFading=null;
      renderBgmNow();
      resolve()
    },duration*1000+35)
  })
}

function startBuffer(buffer,volume,bus,meta,{loop=false,offset=0}={}){
  const source=ctx.createBufferSource(),
    gain=ctx.createGain();
  source.buffer=buffer;
  source.loop=loop;
  gain.gain.value=volume/100;
  source.connect(gain);
  gain.connect(bus);

  const inst={source,gain,buffer,...meta,released:false,fading:false,startedAt:ctx.currentTime-offset};

  source.onended=()=>release(inst);
  source.start(0,offset%buffer.duration);
  return inst;
}

async function ensureRunning(){
  audioEngine();
  if(ctx.state!=='running'){
    try{
      await Promise.race([ctx.resume(),sleep(1500)])
    }catch(_){}
  }
}

async function playSound(s){
  if(!s.assetId){
    toast('このボタンの音源を長押しして登録してください');
    return
  }

  if(s.type!=='emoji'){
    const playingNow=[...active].filter(a=>a.soundId===s.id);

    if(playingNow.length){
      soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
      playingNow.forEach(a=>fadeStop(a));
      return
    }

    if(pendingText.has(s.id)){
      soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
      pendingText.delete(s.id);
      return
    }

    pendingText.add(s.id);
  }

  const serial=(soundSerial.get(s.id)||0)+1;
  soundSerial.set(s.id,serial);

  try{
    await ensureRunning();

    if(s.type==='emoji'&&cfg.playMode==='restart')[...active].filter(a=>a.soundId===s.id).forEach(a=>release(a));

    const buf=await decodeAsset(s.assetId,false);
    if(serial!==soundSerial.get(s.id)&&(s.type!=='emoji'||cfg.playMode==='restart'))return;

    const inst=startBuffer(buf,s.volume,s.type==='voice'?voBus:s.type==='env'?envBus:seBus,{soundId:s.id,soundType:s.type},{loop:s.type==='env'});
    active.add(inst);
    render();
  }catch(e){
    console.error(e);
    toast(e.userMessage||'効果音を再生できませんでした',5000)
  }
 finally{
    if(s.type!=='emoji'&&serial===soundSerial.get(s.id))pendingText.delete(s.id)
  }
}

let bgmLoadingId=null,
  bgmError='',
  bgmFading=null;

async function playBgm(b,{restart=false,quiet=false}={}){
  if(!restart&&bgmPlaying?.trackId===b.id){
    bgmSerial++;
    addMarker('BGM停止：'+b.name,true);
    fadeStop(bgmPlaying);
    return
  }

  if(!restart&&bgmPendingId===b.id){
    bgmSerial++;
    bgmPendingId=null;
    bgmLoadingId=null;
    renderBgmNow();
    return
  }

  if(!b.assetId){
    toast('「設定」からBGM音源を登録してください');
    return
  }

  const serial=++bgmSerial,
    previous=bgmPlaying;
  bgmPendingId=b.id;
  bgmLoadingId=b.id;
  bgmError='';
  render();
  renderBgmNow();

  try{
    await ensureRunning();

    const bufP=decodeAsset(b.assetId,true);

    if(previous)await fadeStop(previous,restart?.12:.38);

    const buf=await bufP;
    if(serial!==bgmSerial)return;

    const inst=startBuffer(buf,100,bgmBus,{trackId:b.id,assetId:b.assetId,name:b.name},{loop:true});
    inst.gain.gain.value=bgmItemGain(b.assetId,b.volume);

    bgmPlaying=inst;
    addMarker('BGM開始：'+b.name,true);
    render();
  }catch(e){
    console.error(e);
    if(serial===bgmSerial){
      bgmError=(b.name||'BGM')+'：'+(e.userMessage||'再生できませんでした');
      if(!quiet)toast(bgmError,6000)
    }
  }
 finally{
    if(serial===bgmSerial){
      bgmPendingId=null;
      bgmLoadingId=null
    }
    renderBgmNow()
  }
}

function stopAll(){
  bgmSerial++;
  bgmPendingId=null;
  bgmLoadingId=null;
  for(const s of cfg.sounds)soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
  pendingText.clear();
  const sounds=[...active];
  if(bgmPlaying)sounds.push(bgmPlaying);
  sounds.forEach(x=>fadeStop(x,.42));
  toast('すべての音をフェードアウトしました')
}


function renderBgmNow(){
  const el=document.getElementById('bgmNow');
  if(!el)return;

  const name=$('#bgmNowName'),
    stopBtn=$('#bgmNowStop');
  let state='idle',
    label='BGM：なし';

  if(bgmLoadingId){
    const b=cfg.bgms.find(x=>x.id===bgmLoadingId);
    state='loading';
    label='読み込み中：'+(b?.name||'')
  }
 else if(bgmPlaying){
    state=bgmLow?'low':'playing';
    label=(bgmLow?'小さく再生中：':'再生中：')+bgmPlaying.name
  }
 else if(bgmFading){
    state='fading';
    label='フェードアウト中：'+bgmFading.name
  }
 else if(bgmError){
    state='error';
    label=bgmError
  }

  const pb=progBgm();

  if((state==='idle'||state==='error')&&pb){
    if(state==='idle')label='待機中｜初期BGM：'+pb.name;
    stopBtn.textContent='▶ 初期BGM';
    stopBtn.disabled=false;
    stopBtn.dataset.mode='play'
  }
 else{
    stopBtn.textContent='■ BGM停止';
    stopBtn.disabled=!(bgmPlaying||bgmLoadingId);
    stopBtn.dataset.mode='stop'
  }

  el.dataset.state=state;
  name.textContent=label;

  if(state!=='playing'&&state!=='low'){
    $('#bgmNowTime').textContent='';
    $('#bgmNowBar').style.width='0%'
  }
}

function tickBgmNow(){
  if(!bgmPlaying||!ctx)return;
  const d=bgmPlaying.buffer.duration,
    t=((ctx.currentTime-bgmPlaying.startedAt)%d+d)%d;

  $('#bgmNowTime').textContent=fmtTime(t)+' / '+fmtTime(d);
  $('#bgmNowBar').style.width=(t/d*100).toFixed(2)+'%';
}
