/* すべての書き出し・読み込み（.live）のうち、映像側（立ち絵・背景・アプリなど）の受け渡し */

  function studioAssetId(id){return ['png0','png1','png2','png3',...PARTICLE_IDS,'background'].includes(id)||/^ch-[a-z0-9]{1,24}-(?:[0-3]|bg|[xy][a-z0-9]{1,8})$/.test(id)||/^fxp-[a-z0-9]{1,24}-[0-5]$/.test(id)||/^scene-(?:standby|away|end)$/.test(id)||/^msc-[a-z0-9]{1,12}$/.test(id)||/^bgi-[a-z0-9]{1,16}$/.test(id)}
  async function studioValidate(decoded){
    for(const[id,b]of Object.entries(decoded)){
      if(/^app-[a-z0-9]{1,16}$/.test(id)){
        if(b.type!=='text/html')throw Error('アプリのファイルの形式が正しくありません');
        if(b.size>40*1024*1024)throw Error('アプリのファイルは1つ40MB以下です');
        continue
      }
      if(!studioAssetId(id))throw Error('未対応の画像データです');
      if(!/^image\/(png|webp|jpeg)$/.test(b.type))throw Error('未対応の画像形式です');
      if(b.size>25*1024*1024)throw Error('画像は1枚25MB以下です');
      const im=await decode(b);
      if(im.width>8192||im.height>8192)throw Error('画像が大きすぎます')
    }
  }
  async function studioApply(rawState,decoded){
      const clean=sanitize(rawState);
      stateLoadBroken='';
      clean.legacyVideos=state.legacyVideos||[];
      // アプリのファイル：今のものを外し、読み込むファイルに置き換える
      {const appIds=Object.keys(decoded).filter(id=>id.startsWith('app-'));
       for(const a of (state.apps||[]))if(a.kind==='file')await deleteAsset('app:'+a.id);
       for(const id of appIds){await putAsset('app:'+id.slice(4),decoded[id]);delete decoded[id]}
       if(appBlobUrl)URL.revokeObjectURL(appBlobUrl);appBlobUrl='';appBlobFor='';
       if(appWinOpen())appWindow.close()}
      // 背景画像（読み込んでいないものも）を、読み込む内容に置き換える
      for(const p of state.profiles||[])for(const a of ['landscape','portrait','x34'])for(const b of (p.bgs?.[a]||[]))if(!decoded['bgi-'+b.id])try{await deleteAsset(ASSET+'bgi-'+b.id)}catch(_){}
      for(const u of bgThumbs.values())URL.revokeObjectURL(u);bgThumbs.clear();
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
        if(/^png[0-3]$|^ch-|^bgi-/.test(id))continue;
        await installAsset(id,b,state.assetNames[id],false)
      }
      ensureProfiles();
      await loadAllChars();
      activateChar(state.charId,true);
      renderMascotUI();
      renderExprUI();
      paragraph=0;
      renderValues();
      saveNow();
  }
  function studioCollect(){syncChar();const assets={};for(const[id,b]of Object.entries(assetBlobs))if(!/^png[0-3]$/.test(id))assets[id]=b;for(const[id,b]of Object.entries(charBlobs))assets[id]=b;const out=JSON.parse(JSON.stringify(state));delete out.legacyVideos;delete out.videos;return {state:out,assets}}
  window.__otonohaVideoRec=()=>studioCapturing||captureStarting;
  window.__otonohaStudio={collect:studioCollect,extra:bgAllBlobs,validate:studioValidate,apply:async(s,d)=>{await studioApply(s,d);toast('立ち絵・映像設定も読み込みました')},busy:()=>studioCapturing||captureStarting};

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
