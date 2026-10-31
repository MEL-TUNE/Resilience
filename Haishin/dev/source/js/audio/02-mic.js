/* マイク・メーター・ダッキング */

let micStream=null,
  micSource=null,
  ducked=false,
  forceDuck=false,
  lastVoiceAt=0;

const micBuf=new Float32Array(2048),
  mixBuf=new Float32Array(2048);

const peakHold={mic:{v:-99,t:0},mix:{v:-99,t:0}};
let clipUntil=0;

async function enableMic(auto=false){
  try{
    audioEngine();
    if(auto)ctx.resume().catch(()=>{});else await ctx.resume();

    if(micStream)micStream.getTracks().forEach(t=>t.stop());
    if(micSource)micSource.disconnect();

    const r=cfg.rec;

    micStream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:r.micId?{exact:r.micId}:undefined,echoCancellation:r.ec,noiseSuppression:r.ns,autoGainControl:r.agc,channelCount:{ideal:1}}});

    micSource=ctx.createMediaStreamSource(micStream);

    if(!micGain){
      micGain=ctx.createGain();
      micGain.connect(voiceBus)
    }

    micSource.connect(micGain);
    updateGains();

    const track=micStream.getAudioTracks()[0];
    track.addEventListener('ended',()=>{
      toast('マイクが切断されました。つなぎ直しています…',4000);
      setTimeout(()=>{
        if(!micLive())enableMic(true)
      },600);
      renderRecState()
    });

    await listMics();
    detectOutput();
    $('#micInfo').textContent=(track.label||'マイク')+' · '+ctx.sampleRate/1000+'kHz';

    $('#micBtn').textContent='接続し直す';
    renderRecState();
    toast('マイクを有効にしました');
  }catch(e){
    console.error(e);

    if(e.name==='OverconstrainedError'&&cfg.rec.micId){
      cfg.rec.micId='';
      persist();
      return enableMic()
    }

    toast(e.name==='NotAllowedError'?'マイクの使用が許可されませんでした。アドレスバーの設定から許可できます':'マイクを開けませんでした',4000)
  }
}

async function listMics(){
  try{
    const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');

    const sel=$('#micSelect');
    sel.innerHTML='<option value="">既定のマイク</option>'+list.filter(d=>d.deviceId&&d.deviceId!=='default').map((d,i)=>`<option value="${esc(d.deviceId)}">${esc(d.label||'マイク '+(i+1))}</option>`).join('');

    sel.value=list.some(d=>d.deviceId===cfg.rec.micId)?cfg.rec.micId:'';
  }catch(e){
    console.error(e)
  }
}

function peakDb(an,buf){
  an.getFloatTimeDomainData(buf);
  let p=0;
  for(let i=0;i<buf.length;i++){
    const a=Math.abs(buf[i]);
    if(a>p)p=a
  }
  return p>0?20*Math.log10(p):-99
}

function rmsDb(an,buf){
  let s=0;
  for(let i=0;i<buf.length;i++)s+=buf[i]*buf[i];
  const r=Math.sqrt(s/buf.length);
  return r>0?20*Math.log10(r):-99
}

function drawMeter(name,db){
  const now=performance.now(),
    h=peakHold[name];
  if(db>=h.v||now-h.t>1200){
    h.v=db;
    h.t=now
  }

  const pct=v=>Math.max(0,Math.min(100,(v+60)/60*100));

  $('#'+name+'Meter').style.clipPath=`inset(0 ${100-pct(db)}% 0 0)`;
  $('#'+name+'Peak').style.left=`calc(${pct(h.v)}% - 2px)`;

  const out=$('#'+name+'Db');
  if(name==='mix'&&db>-0.5)clipUntil=now+1500;

  const clip=name==='mix'&&now<clipUntil;
  out.classList.toggle('clip',clip);
  out.textContent=clip?'過大':(h.v<=-60?'-∞ dB':h.v.toFixed(1)+' dB');
}

function meterLoop(){
  if(ctx){
    drawMeter('mic',micStream?peakDb(micAnalyser,micBuf):-99);
    drawMeter('mix',peakDb(mixAnalyser,mixBuf))
  }

  if(rec.state!=='idle')renderTimer();

  if(miniOn)syncMini();

  tickBgmNow();
  checkVoice();

  if(window.__otoLight)setTimeout(()=>requestAnimationFrame(meterLoop),70);else requestAnimationFrame(meterLoop);
}

function duckLoop(){
  if(!ctx||!cfg.rec.duck||rec.state==='ending')return;
  const now=performance.now();

  if(micStream){
    micAnalyser.getFloatTimeDomainData(micBuf);
    const level=rmsDb(micAnalyser,micBuf);
    if(level>cfg.rec.duckThresh)lastVoiceAt=now
  }

  for(const a of active)if(a.soundType==='voice'&&!a.fading){
    lastVoiceAt=now;
    break
  }

  const want=now-lastVoiceAt<500;

  if(want!==ducked||forceDuck){
    ducked=want;
    forceDuck=false;
    const t=ctx.currentTime;
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setTargetAtTime(want?Math.pow(10,-cfg.rec.duckDepth/20):1,t,want?.06:.35);
    renderDuck()
  }
}
