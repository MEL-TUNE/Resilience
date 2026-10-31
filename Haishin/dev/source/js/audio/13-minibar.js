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
  on=(audio&&!(recbarSeen&&document.body.dataset.page!=='settings'&&document.body.dataset.app==='radio'))||video;
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
