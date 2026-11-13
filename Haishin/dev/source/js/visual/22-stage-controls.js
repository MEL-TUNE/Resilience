/* ステージの操作：表示モード、マイク、口パクのテスト、全画面、配信用ウインドウ */

  function setMode(mode){
    document.body.dataset.studioMode=mode;
    studioLiveMode=mode==='live';
    applyMonitor();
    E('studioPlan').classList.toggle('on',mode==='plan');
    E('studioSongs').classList.toggle('on',mode==='songs');
    E('studioAiVoice').classList.toggle('on',mode==='aivoice');
  }

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
    const dpr=window.devicePixelRatio||1,k0=Math.min(1,((screen.availWidth||1280)-24)/(W/dpr),((screen.availHeight||720)-96)/(H/dpr)),cw=Math.round(W/dpr*k0),ch=Math.round(H/dpr*k0);
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
  // 配信用ウインドウ（0.10.5）：中身（映像の部分）が映像と同じ比率（16:9・9:16・3:4）になる大きさに合わせる。
  // 画面に入りきらないときは、比率を保ったまま縮める。端をつまんで大きさを変えたら、幅に合わせて高さを直す
  function outLimit(w){
    const sc=w.screen||screen,chW=Math.max(0,w.outerWidth-w.innerWidth),chH=Math.max(0,w.outerHeight-w.innerHeight);
    return [Math.max(160,(sc.availWidth||1280)-chW-8),Math.max(160,(sc.availHeight||720)-chH-8)]
  }
  function outSize(w,width){
    const dpr=w.devicePixelRatio||1,[mw,mh]=outLimit(w);
    let iw=width||W/dpr,ih=iw*H/W;
    const k=Math.min(1,mw/iw,mh/ih);
    return [Math.round(iw*k),Math.round(ih*k)]
  }
  function outResize(w,cw,ch){
    if(Math.abs(w.innerWidth-cw)<=1&&Math.abs(w.innerHeight-ch)<=1)return true;
    w.__fitting=performance.now();
    try{w.resizeBy(cw-w.innerWidth,ch-w.innerHeight)}catch{}
    return false
  }
  function fitOutputWindow(){
    const w=outputWindow;
    if(!w||w.closed)return;
    const [cw,ch]=outSize(w);
    w.__fitDone=outResize(w,cw,ch);
    if(!w.__fitWatch){
      w.__fitWatch=true;
      let tm=0;
      w.addEventListener('resize',()=>{
        clearTimeout(tm);
        tm=setTimeout(()=>{
          if(w.closed||performance.now()-(w.__fitting||0)<700)return;
          const [cw2,ch2]=outSize(w,w.innerWidth);
          if(Math.abs(w.innerHeight-ch2)>2||Math.abs(w.innerWidth-cw2)>2)outResize(w,cw2,ch2)
        },350)
      })
    }
  }
  setInterval(()=>{if(outputWindow&&!outputWindow.closed&&!outputWindow.__fitDone)fitOutputWindow()},500);
