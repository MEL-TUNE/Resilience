/* 毎フレームの描画：背景→演出→マスコット・立ち絵→場面の画像→文字→コメント→各ウインドウへ写す */

  let frameToken=0,
    lastFrameAt=0,
    tickWorker=null,
    pendingTick=null;

  function popupVisible(){
    try{
      return !!(outputWindow&&!outputWindow.closed&&!outputWindow.document.hidden)
    }catch(_){
      return false
    }
  }

  function ticker(){
    if(tickWorker===null){
      try{
        const u=URL.createObjectURL(new Blob(['let t=0;onmessage=e=>{clearInterval(t);t=0;if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}'],{type:'text/javascript'}));
        tickWorker=new Worker(u);
        URL.revokeObjectURL(u);
        tickWorker.onmessage=()=>{
          const f=pendingTick;
          pendingTick=null;
          if(f)f();else if(performance.now()-lastFrameAt>400)scheduleFrame()
        }
      }catch(_){
        tickWorker=false
      }
    }
    return tickWorker
  }

  function scheduleFrame(){
    const t=++frameToken,
      run=()=>{
      if(t===frameToken)frame()
    };
    pendingTick=null;
    if(!document.hidden){
      requestAnimationFrame(run);
      return
    }
    if(popupVisible()){
      try{
        outputWindow.requestAnimationFrame(run)
      }catch(_){}
    }else if(appWinOpen())try{if(!appWindow.document.hidden)appWindow.requestAnimationFrame(run)}catch(_){}
    if(ticker())pendingTick=run;else setTimeout(run,33)
  }

  document.addEventListener('visibilitychange',()=>{
    const w=ticker();
    if(w)w.postMessage(document.hidden?Math.max(33,Math.round(1000/(state.fps||30))):0);
    scheduleFrame()
  });

  setInterval(()=>{
    if(performance.now()-lastFrameAt>400)scheduleFrame()
  },1000);

  // 映像を見る人がいないとき（音声モードで、配信用ウインドウも収録も設定画面のプレビューもない）は描かない
  function renderNeeded(){
    if(outputWindow&&!outputWindow.closed)return true;
    if(appWinOpen())return true;
    if(studioCapturing||captureStarting)return true;
    const b=document.body.dataset;
    if(b.app!=='live')return false;
    return !document.hidden
  }

  let previous=0,
    uiTick=0;
  function flapLen(){
    const lo=state.flapMin,hi=Math.max(lo,state.flapMax);
    return lo+Math.random()*(hi-lo)
  }
  function frame(){
    const now=performance.now();
    lastFrameAt=now;
    if(previous&&now-previous<1000/(state.fps||30)-4){
      scheduleFrame();
      return
    }
    const dt=Math.min(.08,(now-previous)/1000||.016);
    previous=now;
    {
      const out=!!(outputWindow&&!outputWindow.closed);
      if(document.body.hasAttribute('data-outwin')!==out)document.body.toggleAttribute('data-outwin',out)
    }
    if(!renderNeeded()){
      setTimeout(scheduleFrame,250);
      return
    }
    let dbLevel=-99;
    if(ready&&ctx&&micLive()&&micAnalyser){
      micAnalyser.getFloatTimeDomainData(levelData);
      let sum=0;
      for(const s of levelData)sum+=s*s;
      dbLevel=20*Math.log10(Math.max(1e-8,Math.sqrt(sum/levelData.length)))
    }
    const testing=now<testUntil;
    talkEnv+=((micMuted||dbLevel<state.threshold?0:Math.min(1,(dbLevel-state.threshold)/22))-talkEnv)*Math.min(1,dt*5);
    const signal=testing?Math.sin(now/110)>-.1:!micMuted&&dbLevel>state.threshold+(talking?-3:0);
    if(signal)lastTalk=now;
    const was=talking;
    talking=(!micMuted||testing)&&(signal||now-lastTalk<state.hold);
    if(talking!==was)bridgeEmit('talk',{talking});
    if(talking&&!was){flapOpen=true;flapNext=now+flapLen()}
    else if(talking&&now>=flapNext){flapOpen=!flapOpen;flapNext=now+flapLen()}
    mouth=talking&&(state.mouthMode!=='flap'||flapOpen);
    if(now>nextBlink){
      blinkUntil=now+130;
      nextBlink=now+3000+Math.random()*3000
    }
    const blink=(state.blink&&now<blinkUntil)||(testing&&Math.sin(now/370)>.9);
    updateSeasonParticles(dt,now);
    background();
    effects(dt,now,'back');
    if(sceneAvatar()){
      drawMascots(now);
      // アプリ表示で「キャラクターだけ」を使うときは、立ち絵を透過のレイヤーに描いてから配信画面へ写す（同じ動きをアプリ表示にも使う）
      const av=drawAvatar(now,mouth&&selfSpeak(),blink);
      // アプリ表示の「キャラクターだけ」：同じ動きのまま、全身が入る大きさで透過のレイヤーにも描く
      const al=appCharLayer();
      if(al&&av)appLayerDraw(al,now,mouth&&selfSpeak(),blink,av)
    }else appLayerEmpty=true;
    drawSceneImage(now);
    effects(dt,now,'front');
    if(scene==='live'){caption();drawPlays(now);drawSetlist()}else sceneCaption();
    drawAudience(now);
    if(outputWindow&&!outputWindow.closed&&outContext){
      try{
        if(outContext.canvas.width!==W||outContext.canvas.height!==H){
          outContext.canvas.width=W;
          outContext.canvas.height=H
        }
        outContext.clearRect(0,0,W,H);
        outContext.drawImage(canvas,0,0)
      }catch{
        outContext=null
      }
    }
    previewMirror(now);
    appCopy(now);
    if(now-uiTick>120){
      uiTick=now;
      E('studioMeter').style.width=Math.max(0,Math.min(100,(dbLevel+70)/70*100))+'%';
      E('studioState').textContent=testing?'口パクをテスト中':!ready?'準備中':micLive()?(micMuted?(streamMode()?'口パク停止中':'ミュート中'):`${talking?'発話中':'待機中'} / ${dbLevel<-90?'−∞':dbLevel.toFixed(0)} dB`):'マイク未接続';
      E('studioMic').textContent=ready&&micLive()?'マイクを再接続':'マイクを接続';
      if(mediaRecorder&&mediaRecorder.state==='recording'&&!mediaRecorder.__ending)E('studioRecTime').textContent='● 収録中 '+Math.floor((now-recordStart)/60000)+':'+String(Math.floor((now-recordStart)/1000)%60).padStart(2,'0')
    }
    perfWatch(performance.now()-now);
    scheduleFrame()
  }

  // 描くのが追いつかない状態が数秒つづいたら、軽くする方法を一度だけ知らせる（勝手には変えない）
  let slowN=0,slowTold=false;
  function perfWatch(cost){
    if(slowTold||(state.light&&(state.fps||30)<=15))return;
    const fps=state.fps||30;
    slowN=cost>800/fps?slowN+1:Math.max(0,slowN-2);
    if(slowN<fps*6)return;
    slowTold=true;
    E('perfHint').hidden=false
  }
  E('perfHintNo').onclick=()=>{E('perfHint').hidden=true};
  E('perfHintGo').onclick=()=>{
    E('perfHint').hidden=true;
    state.light=true;
    // 収録中は、なめらかさ（fps）を変えない
    if(!studioCapturing&&!captureStarting&&(state.fps||30)>15)state.fps=15;
    applyPerf();save();
    toast('軽量モードにしました'+(state.fps===15?'（映像は15fps）':'')+'。「設定」の「映像のなめらかさ」「軽量モード」で戻せます',6000)
  };
