/* 起動処理 */

  applyPerf();
  renderMotionOut();
  renderMascotUI();
  renderExprUI();
  if(document.body.dataset.app==='radio')window.__otonohaAppChanged('radio');

  renderValues();
  applyAspect();
  setMotion('still');
  renderAssetSlots();
  renderSceneForm();
  renderScene();
  listSinks();
  setMode('live');
  scheduleFrame();

  (async()=>{
    for(let i=0;i<100&&!db;i++)await new Promise(r=>setTimeout(r,50));
    if(!db){
      toast('保存領域が利用できませんでした',5000);
      return
    }
    ready=true;
    for(const id of new Set([...PARTICLE_IDS,'background',...presetImageIds(),'scene-standby','scene-away','scene-end',...(state.mascots||[]).map(m=>'msc-'+m.id)]))try{
      const b=await getAsset(ASSET+id);
      if(b)await installAsset(id,b,state.assetNames[id],false)
    }catch(err){
      toast(assetName(id)+'を復元できませんでした',4000)
    }
    ensureProfiles();
    await loadAllChars();
    activateChar(state.charId,true);
    renderMascotUI();
    renderExprUI();
    renderAssetSlots()
  })();
