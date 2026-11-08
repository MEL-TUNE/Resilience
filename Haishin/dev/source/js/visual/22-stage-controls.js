/* ステージの操作：表示モード、マイク、口パクのテスト、全画面、配信用ウインドウ */

  function setMode(mode){
    document.body.dataset.studioMode=mode;
    studioLiveMode=mode==='live';
    applyMonitor();
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
    E('studioPlan').classList.toggle('on',mode==='plan');
    E('studioSongs').classList.toggle('on',mode==='songs');
    E('studioAiVoice').classList.toggle('on',mode==='aivoice');
    if(E('studioModeHelp'))E('studioModeHelp').textContent=mode==='plan'?'企画文をAIへ渡し、返答を台本欄に貼り付けて進行できます。AIと自動通信する機能はありません。':'配信ソフトで「映像だけ別窓」を取り込み、音声はこのブラウザの音＋マイクを配信側で取り込みます。配信サービスへの直接送出機能はありません。'
  }

  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));

  E('studioMic').onclick=async()=>{
    if(!ready){
      toast('準備中です');
      return
    }
    await enableMic()
  };
  E('studioTest').onclick=()=>{
    testUntil=performance.now()+3000;
    toast('3秒間、口パクとまばたきをテストします')
  };
  E('studioFullscreen').onclick=async()=>{
    try{
      await E('studioStageWrap').requestFullscreen()
    }catch{
      toast('この環境では全画面表示を使えません')
    }
  };

  E('studioOutput').onclick=()=>{
    if(outputWindow&&!outputWindow.closed){
      outputWindow.focus();
      return
    }
    const dpr=window.devicePixelRatio||1,cw=Math.round(W/dpr),ch=Math.round(H/dpr);
    outputWindow=window.open('','otonoha-stage',`popup=yes,width=${cw},height=${ch}`);
    if(!outputWindow){
      toast('別窓を開くにはポップアップを許可してください',5000);
      return
    }
    outputWindow.document.open();
    outputWindow.document.write('<!doctype html><html lang="ja"><head><title>オトノハ｜映像出力</title><style>html,body{margin:0;background:#000;width:100%;height:100%;overflow:hidden}canvas{width:100%;height:100%;object-fit:contain;display:block}</style></head><body><canvas width="'+W+'" height="'+H+'" aria-label="映像出力"></canvas><\/body></html>');
    outputWindow.document.close();
    outContext=outputWindow.document.querySelector('canvas').getContext('2d');
    fitOutputWindow()
  };
  function fitOutputWindow(){
    const w=outputWindow;
    if(!w||w.closed)return;
    const dpr=w.devicePixelRatio||1,cw=Math.round(W/dpr),ch=Math.round(H/dpr);
    try{if(w.innerWidth!==cw||w.innerHeight!==ch)w.resizeBy(cw-w.innerWidth,ch-w.innerHeight)}catch{}
  }
  setInterval(()=>{if(outputWindow&&!outputWindow.closed&&!outputWindow.__fitDone){fitOutputWindow();outputWindow.__fitDone=outputWindow.innerWidth===Math.round(W/(outputWindow.devicePixelRatio||1))}},500);
