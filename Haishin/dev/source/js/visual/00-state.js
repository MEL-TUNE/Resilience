/* 設定の初期値・読み込み・保存（save／saveNow）と、共通の小さな道具（E・toast など） */

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
    repertoire:[],
    fmt:2,
    legacyVideos:[],
    singLog:[],
    singSess:null,
    sessInfo:{},
    repSort:'recent',
    descHead:'♪ セットリスト',
    descEmpty:'blank',
    setlistShow:'off',
    setlistPos:'tl',
    setlistTime:0,
    setlistSize:100,
    setlistHide:'',
    apps:[],
    aud:null,
    slot:null,
    pon:null,
    vr:null,
    serifs:[],
    serifSel:'',
    serifPos:'bottom',
    serifName:true,
    diceN:1,
    diceF:6,
    wheelItems:'',
    playPos:'center',
    playLay:{},
    topics:null,
    appSel:'',
    appLayout:'overlay',
    appPos:'br',
    appSize:35,
    appView:'char',
    appMsc:true,
    appCX:100,
    appCY:100,
    appCSize:42,
    assetNames:{},
    scenes:{standby:{bgm:'keep',effect:'keep',avatar:true,text:''},away:{bgm:'keep',effect:'keep',avatar:false,text:''},end:{bgm:'keep',effect:'keep',avatar:false,text:'ご視聴ありがとうございました'}},
    mascots:[],
    speaker:'self',
    sceneBoost:6,
    restoreBgm:true,
    sceneFont:'hachimaru',
    mouthMode:'hold',
    flapMin:80,
    flapMax:220,
    sinkId:'',
    aspect:'landscape',
    motionAmt:100,
    motionSing:100,
    motionSingSpeed:100,
    motionHop:100,
    motionShake:100,
    motionWander:100,
    motionIya:100,
    motionHopSpeed:100,
    motionShakeSpeed:100,
    motionWanderSpeed:100,
    motionIyaSpeed:100,
    fxSeason:null,
    fxPresets:null,
fps:30,
    light:false,
    motion:'still',
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
    flapOpen=false,
    flapNext=0,
    lastTalk=0,
    testUntil=0,
    nextBlink=performance.now()+3200,
    blinkUntil=0,
    paragraph=0,
    mediaRecorder=null,
    videoStream=null,
    videoDest=null,
    recordStart=0,
    videoUrls=[],
    closing=false,
    captureStarting=false;

  var CHAR_KEYS=['threshold','hold','blink','bounce','scale','x','y','motionAmt','motionSing','motionSingSpeed','motionHop','motionShake','motionWander','motionIya','motionHopSpeed','motionShakeSpeed','motionWanderSpeed','motionIyaSpeed'],
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
    motionShake:[0,200],
    motionWander:[0,200],
    motionIya:[0,200],
    motionHopSpeed:[40,200],
    motionShakeSpeed:[40,200],
    motionWanderSpeed:[40,200],
    motionIyaSpeed:[40,200]
  };
  var charBlobs={},
    charImgs={},
    switchAt=-1e9,
    charUrls=[],
    trimCache=new WeakMap();
  // 保存形式の版。1＝0.6.8まで（動画一覧を設定内に保持）、2＝動画の目録を設定から分離。
  const STATE_FMT=2;
  let stateRawBackup=null,stateRawFmt=0;
  function migrateState(s){
    if(!s||typeof s!=='object'||Array.isArray(s))return s;
    const f=Number(s.fmt)||1;
    if(f<2){
      const old=Array.isArray(s.legacyVideos)?s.legacyVideos:[],seen=new Set(old.map(x=>x&&x.id));
      s.legacyVideos=[...old,...(Array.isArray(s.videos)?s.videos:[]).filter(x=>x&&!seen.has(x.id))];
      delete s.videos;
      s.fmt=2
    }
    return s
  }
  try{
    const raw=localStorage.getItem(KEY_S),saved=JSON.parse(raw||'null');
    if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
      const f=Number(saved.fmt)||1;
      if(f!==STATE_FMT){stateRawBackup=raw;stateRawFmt=f}
      state={...defaults,...migrateState(saved)}
    }
  }catch(_){}

  const canvas=E('studioCanvas'),
    g=canvas.getContext('2d'),
    levelData=new Float32Array(2048);

  // 保存は、操作が止まってから約0.4秒後（続けて操作していても2秒以内）にまとめて書く。
  // 名義の切替などで画面の値を設定へ移す処理（syncChar）は、呼ばれたその場で行う。
  let saveTm=0,saveFirst=0,saveSt='saved',saveBig=false;
  function saveWrite(){
    clearTimeout(saveTm);saveTm=0;saveFirst=0;
    try{
      const json=JSON.stringify(state);
      localStorage.setItem(KEY_S,json);
      saveSt='saved';
      if(json.length>3500000&&!saveBig){saveBig=true;toast('映像設定と歌枠ノートの記録が大きくなっています（約'+(json.length/1048576).toFixed(1)+'MB）。設定ファイル（.live）への書き出しをおすすめします',9000)}
    }catch(e){
      if(saveSt!=='failed')toast('スタジオ設定を保存できません。端末の空き容量をご確認のうえ、設定を書き出してください',8000);
      saveSt='failed'
    }
    saveBadge?.();
    return saveSt==='saved'
  }
  function save(){
    try{syncChar()}catch(_){}
    const now=Date.now();
    if(!saveFirst)saveFirst=now;
    if(saveSt!=='failed')saveSt='pending';
    clearTimeout(saveTm);
    saveTm=setTimeout(saveWrite,Math.max(0,Math.min(400,saveFirst+2000-now)));
    saveBadge?.()
  }
  function saveNow(){
    try{syncChar()}catch(_){}
    return saveWrite()
  }
  window.__otonohaSaveState=()=>saveSt;
  window.__otonohaSaveFlush=()=>saveTm?saveWrite():saveSt!=='failed';
