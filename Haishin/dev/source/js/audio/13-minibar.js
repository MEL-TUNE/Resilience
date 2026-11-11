/* スクロール中の小さな録音欄・BGM欄への移動 */

let miniOn=false;

const MINI_LABEL={'● 録音開始':'● 録音','‖ 一時停止':'‖ 一時停止','● 再開':'● 再開','■ 停止・保存':'■ 停止','↺ 録り直し':'↺ 録り直し'};

function syncMini(){
  $('#miniTimer').textContent=$('#timer').textContent;
  $('#miniTimer').dataset.st=rec.state;

  for(const [m,o] of [['#miniRec','#recBtn'],['#miniStop','#stopRecBtn'],['#miniRetake','#retakeBtn']]){
    const a=$(m),
      b=$(o),
      txt=MINI_LABEL[b.textContent]||(b.classList.contains('armed')?'もう一度':b.textContent);
    if(a.textContent!==txt)a.textContent=txt;
    a.title=b.textContent;
    a.disabled=b.disabled;
    a.classList.toggle('on',b.classList.contains('on'));
    a.classList.toggle('armed',b.classList.contains('armed'))
  }

  const st=$('#bgmNow').dataset.state;
  $('#miniBgm').dataset.state=st;
  const nm=$('#bgmNowName').textContent;
  if($('#miniBgmName').textContent!==nm)$('#miniBgmName').textContent=nm;

  const bb=$('#bgmNowStop'),
    mb=$('#miniBgmBtn');
  if(mb.textContent!==bb.textContent)mb.textContent=bb.textContent;
  mb.disabled=bb.disabled;
}

let recbarSeen=false;
function setMini(on){
  const audio=rec.state!=='idle',
    video=!!window.__otonohaVideoRec?.();
  // 映像の収録中の小さな欄は、収録のボタンが上に残っていないときだけ出す（設定の画面・準備の画面・映像を上に残していないとき）
  const stripUp=document.body.dataset.page!=='settings'&&!!window.__otonohaDeck?.sideSticky();
  on=(audio&&!(recbarSeen&&document.body.dataset.page!=='settings'&&document.body.dataset.app==='radio'))||(video&&!stripUp);
  if(miniOn!==on){
    miniOn=on;
    $('#miniBar').hidden=!on
  }
  if(on){
    $('#miniAudioRow').hidden=!audio;
    $('#miniVideoRow').hidden=!video;
    syncMini()
  }
}

if('IntersectionObserver' in window){
  new IntersectionObserver(([e])=>{recbarSeen=e.isIntersecting||e.boundingClientRect.top>=0},{threshold:0}).observe(document.querySelector('.recbar'))
}
setInterval(()=>setMini(),300);

$('#miniRec').onclick=()=>$('#recBtn').click();
$('#miniStop').onclick=()=>$('#stopRecBtn').click();
$('#miniRetake').onclick=()=>$('#retakeBtn').click();
$('#miniBgmBtn').onclick=()=>$('#bgmNowStop').click();
$('#miniAllStop').onclick=()=>stopAll();
$('#miniVideoStop').onclick=()=>document.getElementById('studioStop')?.click();

function gotoBgm(){
  if(document.body.dataset.page==='settings'){
    clearPageHash();
    applyPage()
  }

  const sec=$('#bgmTabs').closest('.section');
  // 配信・動画では、BGM のタブを開いてから動かす
  if(document.body.dataset.app==='live'&&window.__otonohaDeck){window.__otonohaDeck.show('bgm',sec);return}
  const y=sec.getBoundingClientRect().top+scrollY;

  requestAnimationFrame(()=>{
    const bar=document.querySelector('.recbar');
    const stickyH=getComputedStyle(bar).position==='sticky'?bar.offsetHeight:($('#miniBar').offsetHeight||110);
    window.scrollTo({top:Math.max(0,y-stickyH-8),behavior:'smooth'})
  });
}

for(const el of [$('#bgmNowMain'),$('#miniBgmName')]){
  el.onclick=gotoBgm;
  el.onkeydown=e=>{
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      gotoBgm()
    }
  }
}

(async()=>{
  try{
    db=await openDB();
    let stored=null;
    try{
      stored=localStorage.getItem(KEY)
    }catch(_){}
    cfg=normalize(stored?JSON.parse(stored):null);
    persist()
  }
 catch(err){
    console.warn('保存領域を使えないため一時保存で動作します',err);
    db=memoryDB();
    cfg=normalize(null);
    try{
      const st=localStorage.getItem(KEY);
      if(st)cfg=normalize(JSON.parse(st))
    }catch(_){}

    $('.footer').textContent='この画面ではブラウザに保存できないため、お試し表示で動いています。登録した音源や録音は、画面を閉じると消えます。';
    $('.footer').classList.add('temp-note');
    toast('お試し表示で動いています（保存はされません）',6000)
  }

  renderVolumes();
  render();
  renderRecState();
  renderEffectControls();
  if(db){
    renderCover();
    renderEffectAsset()
  }

  if(db){
    const takes=await loadTakes();
    for(const t of takes)if(t.status==='recording'){
      t.status='recovered';
      await idbPut('takes',t.id,t)
    }
    await renderTakes();

    if(takes.some(t=>t.status==='recovered'))toast('前回途中で終了した録音を復旧しました',4000)
  }

  updateStorage();

  if(!navigator.mediaDevices?.getUserMedia){
    $('#micBtn').disabled=true;
    $('#micInfo').textContent='このブラウザではマイクを使えません'
  }
 else{
    try{
      let st=null;
      try{st=await navigator.permissions?.query?.({name:'microphone'})}catch(_){}
      if(st?.state!=='denied')enableMic(true);else $('#micInfo').textContent='マイクがブロックされています（アドレスバーのサイト設定で許可できます）'
    }catch(_){}
  }

  document.addEventListener('pointerdown',()=>{
    if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{})
  });

  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{
    listMics();
    if(micStream&&!micLive())enableMic(true)
  });

  setTimeout(preloadProgBgm,1500);
  renderBgmNow();
  if(db)await migrateProgCovers().catch(e=>console.error(e));
  renderPrograms();
  detectOutput();
  navigator.mediaDevices?.addEventListener?.('devicechange',detectOutput);
})();

// 配信・動画の BGM 欄の上の行：いま流れている曲と、番組の初期BGMを流す・止めるボタン
const consoleBgm=()=>progBgm()||null;
function syncConsole(){
  if(!cfg)return;
  const nm=$('#bgmNowName').textContent,c=$('#consoleBgmName');
  if(c.textContent!==nm)c.textContent=nm;
  const btn=$('#consoleBgmStop'),on=!!(bgmPlaying||bgmLoadingId),txt=on?'■ BGMを止める':'▶ 初期BGM';
  if(btn.textContent!==txt)btn.textContent=txt;
  btn.classList.toggle('playing',on);
  btn.disabled=!on&&!consoleBgm();
  // BGM が流れているあいだ、BGM のタブに印を付ける
  const tab=document.querySelector('#deckNav [data-deck="bgm"]');
  if(tab&&tab.classList.contains('playing')!==on)tab.classList.toggle('playing',on)
}
setInterval(syncConsole,300);
$('#consoleBgmStop').onclick=()=>{
  if(bgmLoadingId){
    bgmSerial++;
    bgmPendingId=null;
    bgmLoadingId=null;
    renderBgmNow();
    return
  }
  if(bgmPlaying){
    bgmSerial++;
    addMarker('BGM停止：'+bgmPlaying.name,true);
    fadeStop(bgmPlaying,.6);
    return
  }
  const b=consoleBgm();
  if(b){ensureRunning();playBgm(b,{restart:true})}
};
$('#consoleAllStop').onclick=()=>stopAll();
