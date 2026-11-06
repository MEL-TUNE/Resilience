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
        outputWindow.requestAnimationFrame(run)
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

  // 映像を見る人がいないとき（音声モードで、配信用ウインドウも収録も設定画面のプレビューもない）は描かない
  function renderNeeded(){
    if(outputWindow&&!outputWindow.closed)return true;
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
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const VID_MAX=30,VMETA='vmeta:',VBLOB='video:';
  // 動画は設定（state）とは別に、IndexedDBの assets に「実体 video:ID」と「目録 vmeta:ID」を同じトランザクションで置く。
  const vids=[];
  let vidQ=Promise.resolve();
  function vidQueue(fn){const run=vidQ.then(()=>fn());vidQ=run.catch(()=>{});return run}
  const vidRange=p=>IDBKeyRange.bound(p,p+'￿');
  const vidPersistent=()=>!!(ready&&db&&!db.memory);
  const vidMetaOf=m=>({id:m.id,name:String(m.name||'otonoha.mp4').slice(0,120),size:Math.max(0,Number(m.size)||0),type:String(m.type||'').slice(0,40),at:m.at||new Date().toISOString(),v:1});
  const VST={saving:'保存処理中…',stored:'ブラウザ内に保存',temp:'一時保持のみ（この画面を閉じると消えます）',failed:'保存失敗・一時保持（この画面を閉じると消えます）',missing:'実体なし（この端末に動画データがありません）',orphan:'一覧から外れていた動画データ',unknown:'保存状態を確認できません'};
  function vidTx(work,mode='readwrite'){
    return new Promise((resolve,reject)=>{
      let t;
      try{t=db.transaction('assets',mode)}catch(e){reject(e);return}
      const out={};
      t.oncomplete=()=>resolve(out);
      t.onerror=()=>reject(t.error||Error('保存に失敗しました'));
      t.onabort=()=>reject(out.reason||t.error||Error('保存を中止しました'));
      try{work(t.objectStore('assets'),t,out)}catch(e){out.reason=e;try{t.abort()}catch(_){reject(e)}}
    })
  }
  function vidStore(m,blob){
    return vidQueue(()=>vidTx((s,t,out)=>{
      const r=s.getAllKeys(vidRange(VMETA));
      r.onsuccess=()=>{
        const keys=r.result||[];
        if(!keys.includes(VMETA+m.id)&&keys.length>=VID_MAX){out.reason=Object.assign(Error('full'),{full:true});t.abort();return}
        try{
          s.put(blob,VBLOB+m.id);
          s.put(vidMetaOf(m),VMETA+m.id)
        }catch(e){out.reason=e;t.abort()}
      }
    }))
  }
  function vidDelete(id){return vidQueue(()=>vidTx(s=>{s.delete(VBLOB+id);s.delete(VMETA+id)}))}
  function vidCatalog(){
    return vidTx((s,t,out)=>{
      const a=s.getAll(vidRange(VMETA)),k=s.getAllKeys(vidRange(VBLOB));
      a.onsuccess=()=>{out.metas=(a.result||[]).filter(x=>x&&typeof x.id==='string')};
      k.onsuccess=()=>{out.blobs=new Set(k.result||[])}
    },'readonly')
  }
  async function videoBlob(v){
    if(v.mem)return v.mem;
    if(!vidPersistent())throw Error('この動画のデータが見つかりません');
    const b=await getAsset(VBLOB+v.m.id);
    if(!b)throw Error('この動画のデータが見つかりません');
    return b
  }
  function vidDownload(v){
    return videoBlob(v).then(b=>{
      const u=URL.createObjectURL(b),a=document.createElement('a');
      a.href=u;a.download=v.m.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
      return true
    })
  }
  function vidButton(text,cls,title,fn){
    const b=document.createElement('button');
    b.type='button';b.className='vbtn'+(cls?' '+cls:'');b.textContent=text;if(title)b.title=title;b.onclick=fn;
    return b
  }
  function vidPaint(v){
    const row=v.el||(v.el=document.createElement('div'));
    row.className='studio-take vid-'+v.status;
    row.dataset.vid=v.m.id;
    const name=document.createElement('span');
    name.className='vname';
    name.textContent=v.m.name+(v.m.size?' / '+(v.m.size/1048576).toFixed(1)+' MB':'');
    if(v.m.at)name.title=new Date(v.m.at).toLocaleString('ja-JP');
    const st=document.createElement('span');
    st.className='vstate';
    st.textContent=VST[v.status]||'';
    const kids=[name,st];
    const has=v.mem||v.status==='stored'||v.status==='orphan';
    if(has){
      if(navigator.canShare)kids.push(vidButton(isIOS?'写真に保存（共有）':'共有','primary','共有の画面で「ビデオを保存」を選ぶと、写真アプリに入ります',async()=>{
        try{
          const b=await videoBlob(v),file=new File([b],v.m.name,{type:b.type||v.m.type});
          if(!navigator.canShare({files:[file]}))throw Error('この端末では共有できません。「ファイルに保存」をお使いください');
          await navigator.share({files:[file]})
        }catch(e){if(e?.name!=='AbortError')toast(e.message||'共有できませんでした。「ファイルに保存」をお使いください',5000)}
      }));
      kids.push(vidButton('ファイルに保存','vsave','',async()=>{
        try{await vidDownload(v);toast('ファイルのダウンロードを開始しました。完了はブラウザのダウンロード表示でご確認ください',5000)}
        catch(e){toast(e.message||'書き出せませんでした',5000)}
      }))
    }
    if((v.status==='temp'||v.status==='failed')&&v.mem&&vidPersistent())kids.push(vidButton('ブラウザ内に保存を再試行','','',()=>vidCommit(v,true)));
    if(v.status==='orphan')kids.push(vidButton('一覧に戻す','','この動画データを一覧に登録し直します（データは変わりません）',()=>vidRestore(v)));
    if(v.status==='stored'||v.status==='orphan')kids.push(vidButton('削除','','このブラウザ内に保存した動画を消します。書き出し済みのファイルは消えません',e=>armed(e.currentTarget,'もう一度押すと削除',()=>vidRemove(v))));
    else if(v.status==='missing'||v.status==='unknown')kids.push(vidButton('一覧から外す','','この行だけを外します。ほかの動画やファイルには触れません',e=>armed(e.currentTarget,'もう一度押すと外す',()=>{
      state.legacyVideos=(state.legacyVideos||[]).filter(x=>x.id!==v.m.id);save();vidDrop(v)
    })));
    else if(v.status!=='saving')kids.push(vidButton('一覧から消す','','一時保持している動画を手放します。書き出し済みのファイルは消えません',e=>armed(e.currentTarget,'もう一度押すと消す',()=>{v.mem=null;vidDrop(v)})));
    row.replaceChildren(...kids);
    return row
  }
  function vidDrop(v){const i=vids.indexOf(v);if(i>=0)vids.splice(i,1);v.el?.remove();renderVideoInfo()}
  async function vidRemove(v){
    try{await vidDelete(v.m.id)}
    catch(e){toast('削除できませんでした。動画は残っています。もう一度お試しください',6000);return}
    vidDrop(v);
    toast('動画を削除しました',2500)
  }
  async function vidRestore(v){
    try{
      const b=await getAsset(VBLOB+v.m.id);
      if(!b)throw Error('');
      const m={...v.m,name:v.m.name,size:b.size,type:b.type||'',at:v.m.at||new Date().toISOString()};
      await vidStore(m,b);
      v.m=m;v.status='stored';vidPaint(v);renderVideoInfo();
      toast('一覧に戻しました',2500)
    }catch(e){toast(e?.full?'ブラウザ内の動画が'+VID_MAX+'本あるため戻せません。古い動画を削除してからお試しください':'一覧に戻せませんでした',6000)}
  }
  // 戻り値：stored / full / temp / failed。結果は行の表示に残し、あとからの通知で上書きしない。
  async function vidCommit(v,retry){
    if(!v.mem)return v.status;
    if(!vidPersistent()){
      v.status='temp';vidPaint(v);renderVideoInfo();
      if(retry)toast('この画面ではブラウザ内に保存できません。「ファイルに保存」で書き出してください',6000);
      return ready&&db?'temp':'failed'
    }
    v.status='saving';vidPaint(v);
    let res;
    try{await vidStore(v.m,v.mem);v.status='stored';v.mem=null;res='stored'}
    catch(e){v.status=e?.full?'temp':'failed';res=e?.full?'full':'failed'}
    vidPaint(v);renderVideoInfo();
    if(retry)toast(res==='stored'?'ブラウザ内に保存しました':res==='full'?'ブラウザ内の動画が'+VID_MAX+'本あるため、まだ保存できません。古い動画を削除してから再試行してください':'ブラウザ内に保存できませんでした（空き容量をご確認ください）',6000);
    return res
  }
  async function renderVideoInfo(){
    const el=E('studioVideoInfo');
    if(!el)return;
    const n=vids.filter(v=>v.status==='stored').length,t=vids.filter(v=>v.mem).length,miss=vids.filter(v=>v.status==='missing'||v.status==='orphan').length;
    const parts=[];
    if(n)parts.push('ブラウザ内に保存した動画 '+n+'／'+VID_MAX+'本');
    if(t)parts.push('一時保持 '+t+'本（画面を閉じると消えます）');
    if(miss)parts.push('要確認 '+miss+'件');
    if(parts.length&&vidPersistent())try{const s=await navigator.storage?.estimate?.();if(s&&s.quota)parts.push('このサイトの保存容量 '+(s.usage/1048576).toFixed(0)+' MB／上限の目安 '+(s.quota/1073741824).toFixed(1)+' GB')}catch(_){}
    el.textContent=parts.length?parts.join('・')+'。ブラウザ内の保存は、サイトデータの削除などで消えることがあります。残したい動画はファイルに書き出してください':''
  }
  async function addVideoRow(blob,name){
    const v={m:{id:Math.random().toString(36).slice(2,10),name,size:blob.size,type:blob.type,at:new Date().toISOString()},mem:blob,status:'saving'};
    vids.unshift(v);
    E('studioVideos').prepend(vidPaint(v));
    let dl=false;
    if(!isIOS)try{dl=await vidDownload(v)}catch(_){}
    const res=await vidCommit(v,false);
    const tail=isIOS?'「写真に保存（共有）」→「ビデオを保存」で写真アプリに入ります':dl?'ファイルのダウンロードを開始しました（完了はブラウザの表示でご確認ください）':'「ファイルに保存」で書き出せます';
    if(res==='stored')toast('収録できました。ブラウザ内に保存し、'+tail,7000);
    else if(res==='full')toast('ブラウザ内の動画が'+VID_MAX+'本あるため、今回の動画は一時保持です（古い動画は自動では消しません）。古い動画を削除すると「ブラウザ内に保存を再試行」で保存できます。'+tail,11000);
    else if(res==='temp')toast('この画面ではブラウザ内に保存できないため、一時保持です。'+tail,9000);
    else toast('ブラウザ内に保存できませんでした（空き容量をご確認ください）。一時保持のまま残しています。'+tail,10000)
  }
  // 起動時：目録を読み、0.6.8までの設定内の動画一覧（legacyVideos）を実体と照合して移す。実体のないものは「実体なし」として残し、勝手に消さない。
  async function renderStoredVideos(){
    const box=E('studioVideos');
    const legacy=Array.isArray(state.legacyVideos)?state.legacyVideos:[];
    for(const v of vids.filter(v=>!v.mem))vidDrop(v);
    if(!vidPersistent()){
      for(const m of legacy)vids.push({m,mem:null,status:'unknown'});
      box.append(...vids.filter(v=>!v.mem).map(vidPaint));
      renderVideoInfo();
      return
    }
    let cat;
    try{cat=await vidCatalog()}catch(e){toast('保存した動画の一覧を読めませんでした',5000);return}
    if(legacy.length){
      const keep=[],have=new Set(cat.metas.map(x=>x.id));
      for(const m of legacy){
        if(have.has(m.id))continue;
        if(cat.blobs.has(VBLOB+m.id)){
          try{await vidQueue(()=>vidTx(s=>s.put(vidMetaOf(m),VMETA+m.id)));continue}catch(_){keep.push(m);continue}
        }
        keep.push({...m,missing:true})
      }
      if(keep.length!==legacy.length||keep.some((m,i)=>m.missing!==legacy[i].missing)){state.legacyVideos=keep;save()}
      try{cat=await vidCatalog()}catch(_){}
    }
    const metaIds=new Set(cat.metas.map(x=>x.id)),list=[];
    for(const m of cat.metas.sort((a,b)=>String(b.at).localeCompare(String(a.at))))list.push({m,mem:null,status:'stored'});
    for(const m of state.legacyVideos||[])if(!metaIds.has(m.id))list.push({m,mem:null,status:m.missing?'missing':'unknown'});
    for(const k of cat.blobs){
      const id=String(k).slice(VBLOB.length);
      if(metaIds.has(id)||list.some(v=>v.m.id===id))continue;
      list.push({m:{id,name:'動画データ（ID '+id+'）',size:0,type:'',at:''},mem:null,status:'orphan'})
    }
    vids.push(...list);
    box.append(...list.map(vidPaint));
    renderVideoInfo();
    // 一覧から外れていたデータの大きさは、1件ずつ取り出して確かめる（中身は読み込まない）
    for(const v of list.filter(v=>v.status==='orphan'))try{const b=await getAsset(VBLOB+v.m.id);if(b){v.m.size=b.size;v.m.type=b.type||'';vidPaint(v)}}catch(_){}
  }
  window.__otonohaVideos={list:()=>vids.map(v=>({id:v.m.id,status:v.status,mem:!!v.mem,name:v.m.name})),catalog:()=>vidCatalog(),reload:()=>renderStoredVideos()};

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
      clean.legacyVideos=state.legacyVideos||[];
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
  function studioCollect(){syncChar();const assets={};for(const[id,b]of Object.entries(assetBlobs))if(!/^png[0-3]$/.test(id))assets[id]=b;for(const[id,b]of Object.entries(charBlobs))assets[id]=b;const out=JSON.parse(JSON.stringify(state));delete out.legacyVideos;delete out.videos;return {state:out,assets}}
  window.__otonohaVideoRec=()=>studioCapturing||captureStarting;
  window.__otonohaStudio={collect:studioCollect,validate:studioValidate,apply:async(s,d)=>{await studioApply(s,d);toast('立ち絵・映像設定も読み込みました')},busy:()=>studioCapturing||captureStarting};

  window.__otonohaImportJson=async e=>{
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
