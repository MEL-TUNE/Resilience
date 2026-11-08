/* 動画の収録（MediaRecorder）の開始・終了・後片付け */

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
    for(const id of ['studioRetake','studioDiscard']){const b=E(id);b.disabled=true;b.dataset.armed='';b.classList.remove('armed');if(b.dataset.orig)b.textContent=b.dataset.orig}
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
        if(rec.__discard){
          recordChunks=[];
          cleanupCapture();
          rec.__after?.();
          return
        }
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
      E('studioRetake').disabled=false;
      E('studioDiscard').disabled=false;
      rec.__bgm=bgmPlaying?.trackId||bgmPendingId||null;
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

  function dropCapture(after){
    const rec=mediaRecorder;
    if(!rec||rec.state==='inactive'||rec.__ending)return false;
    rec.__ending=true;
    rec.__discard=true;
    rec.__after=after;
    E('studioStop').disabled=true;
    E('studioRecTime').textContent='止めています…';
    try{rec.stop()}catch(_){}
    rec.__finishSoon?.();
    return true
  }
  E('studioDiscard').onclick=e=>{
    if(!mediaRecorder||mediaRecorder.__ending)return;
    if(!armButton(e.currentTarget,'もう一度押すと破棄'))return;
    const insts=[...active];
    if(bgmPlaying)insts.push(bgmPlaying);
    bgmSerial++;
    insts.forEach(x=>fadeStop(x,.5));
    if(dropCapture(()=>toast('収録を止めて破棄しました（保存していません）',3500)))return
  };
  E('studioRetake').onclick=e=>{
    const rec=mediaRecorder;
    if(!rec||rec.__ending)return;
    if(!armButton(e.currentTarget,'もう一度押すと録り直し'))return;
    const again=cfg.bgms.find(b=>b.id===rec.__bgm&&b.assetId)||null;
    const insts=[...active];
    if(bgmPlaying)insts.push(bgmPlaying);
    bgmSerial++;
    insts.forEach(x=>fadeStop(x,.25));
    dropCapture(()=>setTimeout(async()=>{
      await E('studioRec').onclick();
      if(again&&!bgmPlaying&&!bgmLoadingId&&studioCapturing)playBgm(again,{restart:true});
      toast('録り直しを始めました',2500)
    },350))
  };
