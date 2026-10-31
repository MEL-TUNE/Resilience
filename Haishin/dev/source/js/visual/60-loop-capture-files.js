/* 描画ループ、映像の収録、スタジオ設定の読み込み */

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
        outputWindow.requestAnimationFrame(run);
        return
      }catch(_){}
    }
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

  let previous=0,
    uiTick=0;
  function frame(){
    const now=performance.now();
    lastFrameAt=now;
    if(previous&&now-previous<1000/(state.fps||30)-4){
      scheduleFrame();
      return
    }
    const dt=Math.min(.08,(now-previous)/1000||.016);
    previous=now;
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
    if(talking&&!was)talkStart=now;
    mouth=talking&&(state.mouthMode!=='flap'||Math.floor((now-talkStart)/state.flapMs)%2===0);
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
      drawAvatar(now,mouth&&selfSpeak(),blink)
    }
    drawSceneImage(now);
    effects(dt,now,'front');
    if(scene==='live')caption();else sceneCaption();
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
    if(now-uiTick>120){
      uiTick=now;
      E('studioMeter').style.width=Math.max(0,Math.min(100,(dbLevel+70)/70*100))+'%';
      E('studioState').textContent=testing?'口パクをテスト中':!ready?'準備中':micLive()?(micMuted?(streamMode()?'口パク停止中':'ミュート中'):`${talking?'発話中':'待機中'} / ${dbLevel<-90?'−∞':dbLevel.toFixed(0)} dB`):'マイク未接続';
      E('studioMic').textContent=ready&&micLive()?'マイクを再接続':'マイクを接続';
      if(mediaRecorder&&mediaRecorder.state==='recording'&&!mediaRecorder.__ending)E('studioRecTime').textContent='● 収録中 '+Math.floor((now-recordStart)/60000)+':'+String(Math.floor((now-recordStart)/1000)%60).padStart(2,'0')
    }
    scheduleFrame()
  }

  function cleanupCapture(){
    if(micGain)updateGains();
    captureStarting=false;
    mediaRecorder=null;
    E('studioAspect').disabled=false;
    E('studioFps').disabled=false;
    E('vidFormat').disabled=false;E('vidQuality').disabled=false;
    if(studioCapturing){
      studioCapturing=false;
      applyMonitor();
      setTimeout(releaseBoostHoldIfQuiet,0)
    }
    if(videoDest&&limOut)try{
      limOut.disconnect(videoDest)
    }catch(_){}
    videoStream?.getTracks().forEach(t=>t.stop());
    videoStream=null;
    videoDest=null;
    E('studioRec').disabled=false;
    E('studioStop').disabled=true;
    E('studioRec').classList.remove('recording');
    E('studioRecTime').textContent='未収録'
  }

  E('studioRec').onclick=async()=>{
    if(captureStarting||studioCapturing)return;
    if(!ready){
      toast('準備中です');
      return
    }
    captureStarting=true;studioCapturing=true;
    E('studioRec').disabled=true;
    try{
      if(!window.MediaRecorder||!canvas.captureStream)throw Error('このブラウザは動画収録に対応していません');
      await ensureRunning();
      if(!micLive())await enableMic();
      if(!micLive())throw Error('マイクが接続されていません');
      const MP4=['video/mp4;codecs="avc1.640028,mp4a.40.2"','video/mp4;codecs=avc1,mp4a.40.2','video/mp4'],WEBM=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
      const want=state.vidFormat==='webm'?[...WEBM,...MP4]:[...MP4,...WEBM];
      const type=want.find(t=>MediaRecorder.isTypeSupported(t));
      if(!type)throw Error('利用できる動画形式がありません');
      if(state.vidFormat==='mp4'&&!type.startsWith('video/mp4'))toast('このブラウザはMP4で収録できないため、WebMで収録します',5000);
      videoStream=canvas.captureStream(state.fps||30);
      videoDest=ctx.createMediaStreamDestination();
      limOut.connect(videoDest);
      videoDest.stream.getAudioTracks().forEach(t=>videoStream.addTrack(t));
      mediaRecorder=new MediaRecorder(videoStream,{mimeType:type,videoBitsPerSecond:Math.round((state.vidQuality||8)*1e6),audioBitsPerSecond:192000});
      const rec=mediaRecorder;
      recordChunks=[];
      let failed=false,finished=false;
      rec.ondataavailable=e=>{
        if(e.data&&e.data.size)recordChunks.push(e.data)
      };
      rec.onerror=e=>{
        failed=true;
        toast('収録エラー。取得できた部分を保存します：'+(e.error?.message||'不明'),6000);
        try{if(rec.state!=='inactive')rec.stop()}catch(_){finish()}
      };

      const finish=()=>{
        if(finished)return;
        finished=true;
        clearTimeout(stopWatch);
        const mime=(rec.mimeType||type).split(';')[0],
          blob=new Blob(recordChunks,{type:mime});
        recordChunks=[];
        const ext=mime==='video/mp4'?'mp4':'webm',
          name='otonoha_'+new Date().toISOString().replace(/[:.]/g,'-')+(failed?'_partial':'')+'.'+ext;
        cleanupCapture();
        if(blob.size)addVideoRow(blob,name);else toast('動画データを取得できませんでした',5000)
      };
      let stopWatch=0;
      rec.onstop=finish;
      rec.__finishSoon=()=>{stopWatch=setTimeout(finish,6000)};
      mediaRecorder.start(1000);
      captureStarting=false;
      {const pb=progBgm();if(curProgram()?.autoBgm&&pb&&!bgmPlaying&&!bgmLoadingId)playBgm(pb,{restart:true})}
      E('studioAspect').disabled=true;
      E('studioFps').disabled=true;
      E('vidFormat').disabled=true;E('vidQuality').disabled=true;
      studioCapturing=true;
      boostHold=true;
      applyMonitor();
      if(monitorMuted()&&!monitorManualOff)toast('収録中はモニター音を自動で消しています（設定「録音中のモニター音」で変更できます）。動画には効果音・BGMも入ります',6000);
      recordStart=performance.now();
      E('studioStop').disabled=false;
      E('studioRec').classList.add('recording');
      E('studioRecTime').textContent='● 収録中 0:00'
    }catch(err){
      cleanupCapture();
      toast(err.message||'動画収録を開始できませんでした',6000)
    }
  };

  E('studioStop').onclick=async()=>{
    const rec=mediaRecorder;
    if(!rec||rec.state==='inactive'||rec.__ending)return;
    rec.__ending=true;
    E('studioStop').disabled=true;

    const insts=[...active];
    if(bgmPlaying)insts.push(bgmPlaying);
    if(cfg.rec.fadeOnStop&&(insts.length||micLive())){
      const fs=Number(cfg.rec.fadeSec)||3;
      E('studioRecTime').textContent='フェードアウト中…（'+fs+'秒）';
      if(micGain){const t0=ctx.currentTime;micGain.gain.cancelScheduledValues(t0);micGain.gain.setValueAtTime(micGain.gain.value,t0);micGain.gain.linearRampToValueAtTime(0,t0+fs)}
      bgmSerial++;
      await Promise.all(insts.map(x=>fadeStop(x,fs)));
      await new Promise(r=>setTimeout(r,500))
    }
    E('studioRecTime').textContent='動画を保存中…';
    try{rec.requestData()}catch(_){}
    try{rec.stop()}catch(_){}
    rec.__finishSoon?.()
  };

  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function addVideoRow(blob,name){
    const url=URL.createObjectURL(blob);
    videoUrls.push(url);
    const row=document.createElement('div');
    row.className='studio-take';
    const span=document.createElement('span');
    span.textContent=name+' / '+(blob.size/1048576).toFixed(1)+' MB';
    const link=document.createElement('a');
    link.href=url;link.download=name;link.className='vbtn';link.textContent='ファイルに保存';
    row.append(span);
    const file=new File([blob],name,{type:blob.type});
    if(navigator.canShare?.({files:[file]})){
      const sh=document.createElement('button');
      sh.type='button';sh.className='vbtn primary';sh.textContent=isIOS?'写真に保存（共有）':'共有';
      sh.title='共有の画面で「ビデオを保存」を選ぶと、写真アプリに入ります';
      sh.onclick=async()=>{try{await navigator.share({files:[file]})}catch(e){if(e?.name!=='AbortError')toast('共有できませんでした。「ファイルに保存」をお使いください',5000)}};
      row.append(sh)
    }
    const remove=document.createElement('button');
    remove.type='button';remove.className='vbtn';remove.textContent='一覧から外す';
    remove.title='この画面で保持している動画を解放します。保存済みのファイルは消えません';
    remove.onclick=()=>{URL.revokeObjectURL(url);videoUrls=videoUrls.filter(u=>u!==url);row.remove()};
    row.append(link,remove);
    E('studioVideos').prepend(row);
    if(isIOS)toast('収録できました。「写真に保存（共有）」→「ビデオを保存」で写真アプリに入ります',7000);
    else{link.click();toast('動画を保存しました。もう一度保存するときは「ファイルに保存」を押します',6000)}
  }

  let vidProgSig='';
  function renderVidProg(){
    if(!cfg)return;
    const sel=E('vidProg'),pr=curProgram(),pb=progBgm();
    const sig=JSON.stringify([cfg.currentProgram,cfg.programs.map(p=>[p.name,p.bgmId,p.autoBgm]),pb?.name||'',studioCapturing]);
    if(sig===vidProgSig)return;
    vidProgSig=sig;
    sel.replaceChildren(new Option('フリー（初期BGMなし）','-1'),...cfg.programs.map((p,i)=>new Option(p.name,String(i))));
    sel.value=String(cfg.currentProgram);
    sel.disabled=studioCapturing||captureStarting||rec.state!=='idle';
    E('vidProgNote').textContent=!pr?'番組は「ラジオ」の番組ボタン（長押し・右クリックで編集）と共通です。':pb?(pr.autoBgm?'収録開始と同時に「'+pb.name+'」を頭から流します。':'初期BGM「'+pb.name+'」は、番組の設定で「録音開始と同時に初期BGMを頭から流す」をオンにすると収録開始と同時に流れます。'):'この番組には初期BGMが設定されていません（ラジオの番組ボタンを長押し・右クリックで設定）。'
  }
  E('vidProg').onchange=e=>{
    if(rec.state!=='idle'||studioCapturing)return;
    cfg.currentProgram=Number(e.target.value);
    persist();renderPrograms();preloadProgBgm();renderVidProg()
  };
  setInterval(renderVidProg,700);
  E('vidFormat').value=state.vidFormat;E('vidQuality').value=String(state.vidQuality);
  E('vidFormat').onchange=e=>{state.vidFormat=e.target.value==='webm'?'webm':'mp4';save()};
  E('vidQuality').onchange=e=>{state.vidQuality=Number(e.target.value)||8;save()};

  function blobData(blob){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result);
      r.onerror=reject;
      r.readAsDataURL(blob)
    })
  }

  E('studioExport').onclick=()=>exportLive();

  function studioAssetId(id){return ['png0','png1','png2','png3',...PARTICLE_IDS,'background'].includes(id)||/^ch-[a-z0-9]{1,24}-(?:[0-3]|bg|[xy][a-z0-9]{1,8})$/.test(id)||/^fxp-[a-z0-9]{1,24}-[0-5]$/.test(id)||/^scene-(?:standby|away|end)$/.test(id)||/^msc-[a-z0-9]{1,12}$/.test(id)}
  async function studioValidate(decoded){
    for(const[id,b]of Object.entries(decoded)){
      if(!studioAssetId(id))throw Error('未対応の画像データです');
      if(!/^image\/(png|webp|jpeg)$/.test(b.type))throw Error('未対応の画像形式です');
      if(b.size>25*1024*1024)throw Error('画像は1枚25MB以下です');
      const im=await decode(b);
      if(im.width>8192||im.height>8192)throw Error('画像が大きすぎます')
    }
  }
  async function studioApply(rawState,decoded){
      const clean=sanitize(rawState);
      const tx=db.transaction('assets','readwrite');
      for(const id of new Set(['png0','png1','png2','png3',...PARTICLE_IDS,'background',...Object.keys(assetBlobs),...Object.keys(charBlobs),...Object.keys(decoded)])){
        const s=tx.objectStore('assets');
        if(decoded[id])s.put(decoded[id],ASSET+id);else s.delete(ASSET+id)
      }
      await new Promise((res,rej)=>{
        tx.oncomplete=res;
        tx.onerror=tx.onabort=()=>rej(tx.error||Error('保存に失敗しました'))
      });
      for(let i=0;i<4;i++){
        const p=E('pngPreview'+i);
        if(p.dataset.url)URL.revokeObjectURL(p.dataset.url);
        p.removeAttribute('src');
        p.hidden=true;
        E('pngName'+i).textContent='未登録'
      }
      state=clean;
      images={};
      assetBlobs={};
      charBlobs={};
      charImgs={};
      renderAssetSlots();
      applyAspect();
      applyPerf();
      seasonLoad();
      renderEffectOptions();
      for(const[id,b]of Object.entries(decoded)){
        if(/^png[0-3]$|^ch-/.test(id))continue;
        await installAsset(id,b,state.assetNames[id],false)
      }
      ensureProfiles();
      await loadAllChars();
      activateChar(state.charId,true);
      renderMascotUI();
      renderExprUI();
      paragraph=0;
      renderValues();
      save();
  }
  function studioCollect(){syncChar();const assets={};for(const[id,b]of Object.entries(assetBlobs))if(!/^png[0-3]$/.test(id))assets[id]=b;for(const[id,b]of Object.entries(charBlobs))assets[id]=b;return {state:JSON.parse(JSON.stringify(state)),assets}}
  window.__otonohaVideoRec=()=>studioCapturing||captureStarting;
  window.__otonohaStudio={collect:studioCollect,validate:studioValidate,apply:async(s,d)=>{await studioApply(s,d);toast('立ち絵・映像設定も読み込みました')},busy:()=>studioCapturing||captureStarting};

  E('studioImport').onchange=async e=>{
    const f=e.target.files[0];
    if(!f)return;
    if(rec.state!=='idle'||videoJob||studioCapturing||captureStarting){
      e.target.value='';
      toast('収録・動画書き出しが終わってから読み込んでください');
      return
    }
    try{
      if(!ready)throw Error('準備中です');
      {
        const mg=String.fromCharCode(...new Uint8Array(await f.slice(0,8).arrayBuffer()));
        if(mg==='MTKSPACK'||mg==='OTNHLIVE'||/\.(kissa|live)$/i.test(f.name)){
          e.target.value='';
          const h=document.getElementById('importFile').onchange;
          if(h)await h({target:{files:[f],value:''}});
          return
        }
      }
      if(f.size>180*1024*1024)throw Error('設定ファイルが大きすぎます');
      const data=JSON.parse(await f.text());
      if(data.format!=='otonoha-visual-studio'||data.version!==1||!data.state||!data.assets)throw Error('対応するスタジオ設定ではありません');
      const decoded={};
      for(const[id,url]of Object.entries(data.assets)){
        if(typeof url!=='string'||!/^data:image\/(png|webp|jpeg);base64,/.test(url))throw Error('未対応の画像データです');
        decoded[id]=dataUrlToBlob(url)
      }
      await studioValidate(decoded);
      if(!await askConfirm('現在の立ち絵・名義・台本・映像設定を、読み込む内容で置き換えますか？\n効果音・BGMは変更しません。','置き換える','スタジオ設定の読み込み')){
        toast('読み込みを取り消しました');
        return
      }
      await studioApply(data.state,decoded);
      toast('スタジオ設定を読み込みました')
    }catch(err){
      toast('読み込めませんでした：'+err.message,6000)
    }finally{
      e.target.value=''
    }
  };

  window.addEventListener('beforeunload',e=>{
    if(studioCapturing||captureStarting){
      e.preventDefault();
      e.returnValue=''
    }
  });
  window.addEventListener('pagehide',()=>{
    closing=true;
    videoUrls.forEach(u=>URL.revokeObjectURL(u));
    try{
      outputWindow?.close()
    }catch{}
  });
