/* モニター音（ヘッドホン・スピーカー） */

let monitorManualOff=false,
  outputLabel='',
  outputKind='unknown';

const HEAD_RE=/head|ヘッド|イヤ|ear|airpods|buds|bluetooth|hands-?free|headset/i,
  SPK_RE=/speaker|スピーカー|内蔵|built-?in|internal|macbook|display audio|hdmi/i;

async function detectOutput(){
  try{
    const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput');
    const d=ds.find(x=>x.deviceId==='default')||ds[0];
    outputLabel=d?.label||'';

    outputKind=!outputLabel?'unknown':HEAD_RE.test(outputLabel)?'headphones':SPK_RE.test(outputLabel)?'speaker':'unknown'
  }catch(_){
    outputKind='unknown';
    outputLabel=''
  }

  applyMonitor();
}

let boostHold=false,
  retaking=false;

let studioCapturing=false;

let micMuted=false,
  studioLiveMode=false;

function releaseBoostHoldIfQuiet(){
  if(boostHold&&!retaking&&!studioCapturing&&rec.state==='idle'&&!bgmPlaying&&!bgmFading&&!bgmLoadingId&&active.size===0){
    boostHold=false;
    applyMonitor()
  }
}

function previewBoost(){
  if(!cfg.rec.previewFull||boostHold||retaking||studioCapturing||studioLiveMode)return 1;
  if(rec.state!=='idle'&&rec.state!=='paused')return 1;

  const top=Math.max(dbGain(cfg.seDb),dbGain(cfg.bgmDb),dbGain(cfg.voDb),0.001);
  return Math.min(20,1/top);
}

function monitorMuted(){
  if(monitorManualOff)return true;
  const active=rec.state==='recording'||rec.state==='ending'||studioCapturing;
  if(!active)return false;

  const m=cfg.rec.monitorMode;
  if(m==='always')return false;
  if(m==='muteRec')return true;
  return outputKind!=='headphones';
}

function applyMonitor(){
  if(ctx&&masterBus){
    const t=ctx.currentTime;
    monProg.gain.cancelScheduledValues(t);
    monProg.gain.setTargetAtTime(previewBoost(),t,.05);
    masterBus.gain.cancelScheduledValues(t);
    masterBus.gain.setTargetAtTime(monitorMuted()?0:cfg.master/100,t,.02)
  }
  renderMonitor()
}

function renderMonitor(){
  const btn=document.getElementById('monBtn');
  if(!btn||!cfg)return;
  const muted=monitorMuted();

  btn.classList.toggle('off',muted);
  btn.textContent=muted?(monitorManualOff?'モニター音：オフ':'モニター音：オフ（自動）'):'モニター音：オン';

  const kind={headphones:'イヤホン・ヘッドホンと判定',speaker:'スピーカーと判定',unknown:'判定できないため、スピーカーとして扱います'}[outputKind];

  const pi=document.getElementById('previewInfo');
  if(pi){
    const k=previewBoost(),
      top=Math.max(cfg.seDb,cfg.bgmDb,cfg.voDb);
    pi.textContent=!cfg.rec.previewFull?'効果音・BGMは、録音されるのと同じ音量で聞こえます。':(k>1?`今は効果音・BGM・ボイスを約${k.toFixed(1)}倍にして鳴らしています（大きい方の${fmtDb(top)}を0dBとして、比率はそのまま）。録音中は録音と同じ音量に戻ります。録音される音量は変わりません。`:'録音中は、録音されるのと同じ音量で聞こえます。')
  }

  const info=document.getElementById('outputInfo');
  if(info)info.textContent=`出力先：${outputLabel||'（ブラウザから名前を取得できません）'} → ${kind}。モニター音を消しても、BGM・効果音は録音に入ります。`;
}

$('#monBtn').onclick=()=>{
  if(monitorMuted()&&!monitorManualOff){
    toast('録音中のため自動で消しています。設定欄の「録音中のモニター音」で変えられます',5000);
    return
  }

  monitorManualOff=!monitorManualOff;
  applyMonitor();
};

$('#monitorMode').onchange=e=>{
  cfg.rec.monitorMode=e.target.value;
  persist();
  applyMonitor()
};

$('#previewFull').onchange=e=>{
  cfg.rec.previewFull=e.target.checked;
  persist();
  applyMonitor()
};

let silentSince=0;

function checkVoice(){
  const el=$('#voiceWarn');
  let msg='';

  if(rec.state==='recording'){
    const tr=micStream?.getAudioTracks?.()[0];

    if(!tr)msg='マイクがつながっていません。声は録音されていません';
  else if(tr.readyState!=='live')msg='マイクが止まりました。声は録音されていません（設定欄の「接続し直す」で戻せます）';
  else if(tr.muted)msg='マイクがパソコン側で一時停止されています。声は録音されていません';
  else if(micMuted)msg='マイクはミュート中です。声は録音されていません';
  else{
      const db=peakHold.mic.v;
      const now=performance.now();
      if(db>-55)silentSince=0;else if(!silentSince)silentSince=now;
      if(silentSince&&now-silentSince>6000)msg='6秒以上マイクに音が入っていません。マイクのミュートや接続先を確かめてください'
    }
  }else silentSince=0;

  if(el.textContent!==msg){
    el.textContent=msg;
    el.hidden=!msg
  }
}

function renderDuck(){
  const el=$('#duckState');
  el.textContent=!cfg.rec.duck?'オフ':ducked?'BGMを下げています':'待機';
  el.classList.toggle('on',ducked&&cfg.rec.duck)
}
