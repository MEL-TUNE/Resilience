/* 録音 */

const WORKLET=`class R extends AudioWorkletProcessor{constructor(){super();this.on=false;this.N=8192;this.b=[0,1,2,3,4].map(()=>new Float32Array(this.N));this.n=0;this.port.onmessage=e=>{const m=e.data;if(m==='start')this.on=true;else if(m==='pause'){this.on=false;this.flush()}else if(m==='stop'){this.on=false;this.flush();this.port.postMessage({done:true})}}}
flush(){if(!this.n)return;const ch=this.b.map(a=>a.slice(0,this.n));this.port.postMessage({frames:this.n,ch},ch.map(a=>a.buffer));this.n=0}
process(inputs){if(!this.on)return true;const inp=inputs[0]||[];const len=inp[0]?inp[0].length:128;if(this.n+len>this.N)this.flush();for(let c=0;c<5;c++){const src=inp[c],dst=this.b[c];if(src)dst.set(src,this.n);else dst.fill(0,this.n,this.n+len)}this.n+=len;return true}}
registerProcessor('kissa-rec',R);`;

const rec={
  state:'idle',
  take:null,
  node:null,
  mode:'',
  pending:{mix:[],voice:[],prog:[]},
  pendingFrames:0,
  idx:{mix:0,voice:0,prog:0},
  frames:0,
  flushChain:Promise.resolve(),
  stopResolve:null,
  retry:[],
  saveTrouble:false,
  saveErr:'',
  recovered:false
};

let rescue=null;

async function ensureRecorder(){
  if(rec.node)return;
  audioEngine();

  const sink=ctx.createGain();
  sink.gain.value=0;
  sink.connect(ctx.destination);

  if(ctx.audioWorklet&&window.AudioWorkletNode){
    try{
      let loaded=false;

      for(const url of [URL.createObjectURL(new Blob([WORKLET],{type:'text/javascript'})),'data:text/javascript;charset=utf-8,'+encodeURIComponent(WORKLET)]){
        try{
          await ctx.audioWorklet.addModule(url);
          loaded=true;
          break
        }catch(_){}finally{
          if(url.startsWith('blob:'))URL.revokeObjectURL(url)
        }
      }

      if(!loaded)throw Error('worklet module unavailable');

      const node=new AudioWorkletNode(ctx,'kissa-rec',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:5,channelCountMode:'explicit',channelInterpretation:'discrete'});

      node.port.onmessage=e=>{
        if(e.data.done){
          rec.stopResolve?.();
          rec.stopResolve=null
        }else onRecData(e.data)
      };

      merger.connect(node);
      node.connect(sink);
      rec.node=node;
      rec.mode='worklet';
      return;
    }catch(e){
      console.warn('AudioWorkletが使えないため代替方式で録音します',e)
    }
  }

  const sp=ctx.createScriptProcessor(4096,5,1);

  sp.onaudioprocess=e=>{
    if(rec.state!=='recording'&&rec.state!=='ending')return;
    const ch=[0,1,2,3,4].map(c=>e.inputBuffer.getChannelData(c).slice());
    onRecData({frames:ch[0].length,ch})
  };

  merger.connect(sp);
  sp.connect(sink);
  rec.node=sp;
  rec.mode='script';
}

const toI16=x=>{
  const s=x<-1?-1:x>1?1:x;
  return s<0?s*32768:s*32767
};

function onRecData({frames,ch}){
  const t=rec.take;
  if(!t)return;

  const mix=new Int16Array(frames*2);
  for(let i=0;i<frames;i++){
    mix[2*i]=toI16(ch[0][i]);
    mix[2*i+1]=toI16(ch[1][i])
  }
  rec.pending.mix.push(mix);

  if(t.tracks.includes('voice')){
    const v=new Int16Array(frames);
    for(let i=0;i<frames;i++)v[i]=toI16(ch[2][i]);
    rec.pending.voice.push(v)
  }

  if(t.tracks.includes('prog')){
    const p=new Int16Array(frames*2);
    for(let i=0;i<frames;i++){
      p[2*i]=toI16(ch[3][i]);
      p[2*i+1]=toI16(ch[4][i])
    }
    rec.pending.prog.push(p)
  }

  rec.frames+=frames;
  rec.pendingFrames+=frames;

  if(rec.pendingFrames>=t.sampleRate*3)flushChunks();
}

const chunkKey=(takeId,track,i)=>`${takeId}|${track}|${String(i).padStart(7,'0')}`;

const chunkRange=(takeId,track)=>IDBKeyRange.bound(`${takeId}|${track}|`,`${takeId}|${track}|￿`);

function flushChunks(){
  const t=rec.take;
  if(!t)return rec.flushChain;

  const jobs=[];
  for(const k of t.tracks){
    if(rec.pending[k].length){
      jobs.push([chunkKey(t.id,k,rec.idx[k]++),new Blob(rec.pending[k])]);
      rec.pending[k]=[]
    }
  }

  const frames=rec.frames;
  rec.pendingFrames=0;

  rec.flushChain=rec.flushChain.then(async()=>{
    const all=[...rec.retry,...jobs];
    rec.retry=[];

    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['chunks','takes'],'readwrite');

        try{
          for(const [key,blob] of all)tx.objectStore('chunks').put(blob,key);
          t.frames=frames;
          tx.objectStore('takes').put({...t},t.id)
        }catch(e){
          try{
            tx.abort()
          }catch(_){}
          reject(e);
          return
        }

        tx.oncomplete=resolve;
        tx.onerror=tx.onabort=()=>reject(tx.error||Error('保存が中断されました'))
      });

      if(rec.saveTrouble){
        rec.saveTrouble=false;
        rec.recovered=true;
        renderSaveWarn()
      }
    }catch(e){
      console.error(e);
      rec.retry=all;
      rec.saveTrouble=true;
      rec.saveErr=errText(e);
      renderSaveWarn()
    }
  });

  return rec.flushChain;
}

const unsavedSec=(jobs,sr)=>jobs.filter(([k])=>k.includes('|mix|')).reduce((n,[,b])=>n+b.size,0)/4/sr;

function renderSaveWarn(){
  const el=$('#saveWarn');
  if(!el)return;

  if(rec.saveTrouble&&rec.take){
    el.hidden=false;
    el.innerHTML=`ブラウザへの保存に失敗しています（${esc(rec.saveErr)}）。録音は続いていて、保存できなかった約${Math.ceil(unsavedSec(rec.retry,rec.take.sampleRate))}秒分はメモリに持ったまま、保存をやり直しています。`;
    return
  }

  if(rescue){
    const sec=Math.ceil(unsavedSec(rescue.jobs,rescue.take.sampleRate));
    el.hidden=false;

    el.innerHTML=(sec>0?`「${esc(rescue.take.name)}」の一部（約${sec}秒分）をブラウザに保存できませんでした（${esc(rescue.err)}）。この画面を閉じる前に、どちらかを押すと録音を残せます。`:`「${esc(rescue.take.name)}」の音声は保存できていますが、仕上げの保存に失敗しました（${esc(rescue.err)}）。「もう一度保存する」で完了できます。WAVで書き出して残すこともできます。`)+`<div class="warn-actions"><button class="btn" type="button" id="rescueRetry">もう一度保存する</button><button class="btn gold" type="button" id="rescueWav">この録音をWAVで書き出す</button><button class="btn" type="button" id="rescueClose">閉じる</button></div>`;

    $('#rescueRetry').onclick=rescueRetry;
    $('#rescueWav').onclick=rescueWav;
    $('#rescueClose').onclick=e=>{
      if(armButton(e.currentTarget,'もう一度押すと閉じる（未保存分は失われます）')){
        rescue=null;
        renderSaveWarn()
      }
    };
    return
  }

  el.hidden=true;
  el.innerHTML='';
}

async function rescueRetry(){
  if(!rescue)return;
  const {take,jobs}=rescue;

  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['chunks','takes'],'readwrite');
      try{
        for(const [key,blob] of jobs)tx.objectStore('chunks').put(blob,key);
        tx.objectStore('takes').put({...take,status:'done',missingSec:0},take.id)
      }catch(e){
        try{
          tx.abort()
        }catch(_){}
        reject(e);
        return
      }
      tx.oncomplete=resolve;
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('保存が中断されました'))
    });

    rescue=null;
    renderSaveWarn();
    await renderTakes();
    updateStorage();
    toast(`「${take.name}」を最後まで保存できました`,4000)
  }
 catch(e){
    console.error(e);
    rescue.err=errText(e);
    renderSaveWarn();
    toast('まだ保存できません（'+errText(e)+'）。WAVで書き出すと録音を残せます',6000)
  }
}

async function rescueWav(){
  if(!rescue)return;
  const {take,jobs}=rescue;

  try{
    let stored=[];
    try{
      for(const k of await trackKeys(take,'mix')){
        const b=await idbGet('chunks',k);
        if(b)stored.push([k,b])
      }
    }catch(_){}

    const all=[...stored,...jobs.filter(([k])=>k.includes('|mix|'))].sort((a,b)=>a[0]<b[0]?-1:1);

    const bytes=all.reduce((n,[,b])=>n+b.size,0);

    download(new Blob([wavHeader(2,take.sampleRate,bytes),...all.map(([,b])=>b)],{type:'audio/wav'}),`${safeName(take.name)}_mix.wav`);
    toast('録音をWAVで書き出しました',4000)
  }
 catch(e){
    console.error(e);
    toast('書き出しに失敗しました（'+errText(e)+'）',6000)
  }
}

function stamp(d=new Date()){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

let lastTakeId=null;

function micLive(){
  const tr=micStream?.getAudioTracks?.()[0];
  return !!(tr&&tr.readyState==='live')
}

async function discardRec(){
  const t=rec.take;
  boostHold=true;
  rec.state='stopping';
  renderRecState();

  if(rec.mode==='worklet'){
    await new Promise(resolve=>{
      rec.stopResolve=resolve;
      rec.node.port.postMessage('stop');
      setTimeout(resolve,1500)
    })
  }

  rec.pending={mix:[],voice:[],prog:[]};
  rec.pendingFrames=0;
  await rec.flushChain;
  rec.retry=[];
  rec.saveTrouble=false;
  rec.recovered=false;
  renderSaveWarn();

  rec.take=null;
  rec.state='idle';
  if(t)await deleteTakeData(t.id).catch(e=>console.error(e));
}

async function discardTake(btn){
  if(!(rec.state==='recording'||rec.state==='paused'))return;

  if(!armButton(btn,'もう一度押すと破棄'))return;

  boostHold=true;
  await discardRec();

  if(bgmLow){
    bgmLow=false;
    bgmTrim.gain.cancelScheduledValues(ctx.currentTime);
    bgmTrim.gain.setTargetAtTime(1,ctx.currentTime,.05);
    renderBgmLow()
  }

  if(bgmPlaying){
    bgmSerial++;
    fadeStop(bgmPlaying,.5)
  }

  renderRecState();
  await renderTakes();
  updateStorage();
  setTimeout(releaseBoostHoldIfQuiet,700);

  toast('録音を止めて破棄しました（保存していません）',3500);
}

async function retake(btn){
  if(retaking||rec.state==='stopping'||rec.state==='ending')return;

  const live=rec.state==='recording'||rec.state==='paused';

  if(!live&&!armButton(btn,'もう一度押すと録り直し'))return;
  boostHold=true;
  retaking=true;
  applyMonitor();

  try{
    await retakeInner()
  }finally{
    retaking=false;
    releaseBoostHoldIfQuiet()
  }
}

async function retakeInner(){
  let startBgmId=null;

  if(rec.state==='recording'||rec.state==='paused'){
    startBgmId=rec.take.startBgmId;
    await discardRec()
  }
 else if(rec.state==='idle'&&lastTakeId){
    const t=await idbGet('takes',lastTakeId);
    startBgmId=t?.startBgmId||null;
    if(t)await deleteTakeData(t.id).catch(e=>console.error(e));
    lastTakeId=null
  }
 else return;

  if(bgmLow){
    bgmLow=false;
    bgmTrim.gain.cancelScheduledValues(ctx.currentTime);
    bgmTrim.gain.setValueAtTime(1,ctx.currentTime);
    renderBgmLow()
  }

  if(bgmPlaying){
    bgmSerial++;
    await fadeStop(bgmPlaying,.12)
  }

  await renderTakes();
  renderRecState();

  const b=startBgmId&&cfg.bgms.find(x=>x.id===startBgmId&&x.assetId);

  if(b)await decodeAsset(b.assetId,true).catch(()=>{});

  await startRec({noAutoBgm:true});

  if(rec.state==='recording'){
    rec.take.startBgmId=b?b.id:null;
    idbPut('takes',rec.take.id,{...rec.take}).catch(()=>{});
    if(b)await playBgm(b,{restart:true});
    toast(b?`録り直し中（BGM「${b.name}」を頭から）`:'録り直し中',3500)
  }
}

async function startRec(opts={}){
  if(rec.state!=='idle')return;

  rec.state='starting';
  renderRecState();

  try{
    audioEngine();
    await ctx.resume();
    await ensureRecorder();

    if(!micLive())await enableMic();

    if(!micLive()){
      rec.state='idle';
      renderRecState();
      toast('マイクがつながっていないため、録音を始めませんでした。マイクの許可や接続を確かめてから、もう一度「録音開始」を押してください',7000);
      return
    }

    navigator.storage?.persist?.().catch(()=>{});

    try{
      const est=await navigator.storage?.estimate?.();
      if(est&&est.quota&&est.quota-est.usage<150*1048576)toast(`ブラウザの空き容量が少なくなっています（残り約${Math.max(0,Math.round((est.quota-est.usage)/1048576))}MB）。長い録音は途中で保存できなくなる可能性があります`,7000)
    }catch(_){}

    const tracks=['mix'];
    if(cfg.rec.keepVoice)tracks.push('voice');
    if(cfg.rec.keepProg)tracks.push('prog');

    rec.take={
      id:id(),
      name:(curProgram()?.name||'フリー')+' '+stamp(),
      programId:curProgram()?.id||null,
      created:Date.now(),
      sampleRate:ctx.sampleRate,
      frames:0,
      tracks,
      markers:[],
      status:'recording',
      startBgmId:bgmPlaying?.trackId||bgmLoadingId||null
    };

    rec.pending={mix:[],voice:[],prog:[]};
    rec.pendingFrames=0;
    rec.idx={mix:0,voice:0,prog:0};
    rec.frames=0;
    rec.retry=[];
    rec.saveTrouble=false;
    rec.recovered=false;

    await idbPut('takes',rec.take.id,{...rec.take});

    rec.state='recording';
    if(rec.mode==='worklet')rec.node.port.postMessage('start');

    if(bgmPlaying){
      const b=cfg.bgms.find(x=>x.id===bgmPlaying.trackId);
      if(b)addMarker('BGM再生中：'+b.name,true)
    }

    renderRecState();
    renderTakes();

    if(!opts.noAutoBgm){
      const pb=progBgm();
      if(curProgram()?.autoBgm&&pb&&!bgmPlaying&&!bgmLoadingId){
        rec.take.startBgmId=pb.id;
        idbPut('takes',rec.take.id,{...rec.take}).catch(()=>{});
        playBgm(pb,{restart:true})
      }
    }
  }catch(e){
    console.error(e);
    rec.state='idle';
    rec.take=null;
    renderRecState();
    toast('録音を開始できませんでした')
  }
}

function pauseRec(){
  if(rec.state!=='recording')return;
  rec.state='paused';
  if(rec.mode==='worklet')rec.node.port.postMessage('pause');
  addMarker('一時停止',true);
  renderRecState()
}

function resumeRec(){
  if(rec.state!=='paused')return;
  rec.state='recording';
  if(rec.mode==='worklet')rec.node.port.postMessage('start');
  addMarker('再開',true);
  renderRecState()
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function stopRec(){
  if(rec.state==='idle'||rec.state==='starting'||rec.state==='stopping'||rec.state==='ending')return;

  if(cfg.rec.fadeOnStop&&bgmPlaying&&rec.state==='recording'){
    rec.state='ending';
    renderRecState();
    if(micGain){
      const t0=ctx.currentTime;
      micGain.gain.cancelScheduledValues(t0);
      micGain.gain.setValueAtTime(micGain.gain.value,t0);
      micGain.gain.linearRampToValueAtTime(0,t0+.12)
    }
    const b=cfg.bgms.find(x=>x.id===bgmPlaying.trackId);
    addMarker('BGMフェードアウト：'+(b?.name||''),true);

    bgmSerial++;
    await fadeStop(bgmPlaying,cfg.rec.fadeSec);
    await sleep(500);
  }

  rec.state='stopping';
  renderRecState();

  const t=rec.take;
  let ok=true,
    err='';

  try{
    if(rec.mode==='worklet'){
      await new Promise(resolve=>{
        rec.stopResolve=resolve;
        rec.node.port.postMessage('stop');
        setTimeout(resolve,1500)
      })
    }

    await flushChunks();

    for(let i=0;i<3&&rec.retry.length;i++){
      await sleep(500);
      await flushChunks()
    }

    ok=!rec.retry.length;
    if(!ok)err=rec.saveErr;

    t.frames=rec.frames;
    t.status=ok?'done':'partial';
    t.missingSec=ok?0:Math.ceil(unsavedSec(rec.retry,t.sampleRate));
    if(rec.recovered)t.retried=true;

    try{
      await idbPut('takes',t.id,{...t})
    }catch(e){
      console.error(e);
      ok=false;
      err=errText(e)
    }
  }catch(e){
    console.error(e);
    ok=false;
    err=err||errText(e)
  }
 finally{
    if(!ok)rescue={take:{...t},jobs:rec.retry.slice(),err:err||'原因不明'};

    rec.retry=[];
    rec.saveTrouble=false;

    lastTakeId=t.id;
    rec.take=null;
    rec.state='idle';
    if(micGain){
      micGain.gain.cancelScheduledValues(ctx.currentTime);
      micGain.gain.setValueAtTime(micMuted?0:cfg.rec.micVolume/100,ctx.currentTime)
    }
    if(bgmLow&&!bgmPlaying){
      bgmLow=false;
      bgmTrim.gain.setTargetAtTime(1,ctx.currentTime,.05);
      renderBgmLow()
    }

    renderRecState();
    renderSaveWarn();
    try{
      await renderTakes()
    }catch(_){}
    updateStorage();
  }

  if(ok)toast(rec.recovered?`「${t.name}」を保存しました（${fmtTime(t.frames/t.sampleRate)}）。途中で保存できない時間がありましたが、すべて保存し直しました`:`「${t.name}」を保存しました（${fmtTime(t.frames/t.sampleRate)}）`,rec.recovered?6000:3500);
 else toast('録音の一部を保存できませんでした。録音欄の案内から残せます',6000);

  rec.recovered=false;
  releaseBoostHoldIfQuiet();
}

function addMarker(label,auto=false){
  const t=rec.take;
  if(!t||rec.state==='idle'||rec.state==='stopping')return;

  const n=t.markers.filter(m=>!m.auto).length+1;
  t.markers.push({t:rec.frames/t.sampleRate,label:label||('マーカー'+n),auto});

  if(!auto)toast('マーカー'+n+'：'+fmtTime(rec.frames/t.sampleRate));
  renderLiveMarkers();
}

function fmtTime(sec,tenths=false){
  sec=Math.max(0,sec);
  const h=Math.floor(sec/3600),
    m=Math.floor(sec/60)%60,
    s=Math.floor(sec)%60,
    p=n=>String(n).padStart(2,'0');
  return (h?h+':'+p(m):p(m))+':'+p(s)+(tenths?'.'+Math.floor(sec*10)%10:'')
}

function renderTimer(){
  const t=rec.take,
    sec=t?rec.frames/t.sampleRate:0,
    str=fmtTime(sec,true),
    i=str.lastIndexOf('.');
  $('#timer').innerHTML=esc(str.slice(0,i))+'<small>'+esc(str.slice(i))+'</small>'
}

function renderRecState(){
  if(rec.state!=='idle'&&rec.state!=='paused')boostHold=true;
  applyMonitor();
  if(cfg?.programs)renderPrograms();

  const lamp=$('#recLamp'),
    txt=$('#recLampText'),
    st=rec.state;

  lamp.className='lamp '+(st==='recording'||st==='ending'?'rec':st==='paused'?'pause':micLive()?'ready':'');

  txt.textContent=st==='starting'?'マイク・録音の準備中…':st==='ending'?'BGMフェードアウト中…':st==='recording'?'録音中':st==='paused'?'一時停止中':st==='stopping'?'保存中…':micLive()?'待機中':'マイク未接続';

  const rb=$('#recBtn');
  rb.textContent=st==='recording'?'‖ 一時停止':st==='paused'?'● 再開':'● 録音開始';
  rb.classList.toggle('on',st==='recording');
  rb.disabled=st==='starting'||st==='stopping'||st==='ending';

  $('#stopRecBtn').disabled=!(st==='recording'||st==='paused');
  const rb2=$('#retakeBtn');
  rb2.disabled=!(st==='recording'||st==='paused'||(st==='idle'&&lastTakeId));
  if(rb2.dataset.armed!=='1')rb2.textContent='↺ 録り直し';
  const db2=$('#discardBtn');
  db2.disabled=!(st==='recording'||st==='paused');
  if(db2.dataset.armed!=='1')db2.textContent='✕ 停止して破棄';

  const busy=st!=='idle';
  for(const s of ['#micSelect','#optEc','#optNs','#optAgc','#micBtn','#importBtn','#keepVoice','#keepProg'])$(s).disabled=busy;

  if(st==='idle')$('#timer').innerHTML='00:00<small>.0</small>';
}

function renderLiveMarkers(){
  const el=document.getElementById('liveMarkers');
  if(el&&rec.take)el.innerHTML=markerList(rec.take.markers)
}

function markerList(ms){
  return ms.length?ms.map(m=>`<li><time>${fmtTime(m.t,true)}</time><span>${esc(m.label)}</span></li>`).join(''):'<li>なし</li>'
}
