/* 準備中・離席中・配信終了の画像とBGMの大きさ */

  for(const k of ['standby','away','end']){
    E('scene_'+k+'_imgFile').onchange=async e=>{
      const f=e.target.files[0];if(!f)return;
      try{if(!ready)throw Error('保存領域の準備中です');await installAsset('scene-'+k,f,f.name);toast(SCENE_LABEL[k]+'の画像を登録しました')}catch(err){toast(err.message,5000)}finally{e.target.value=''}
    };
    E('scene_'+k+'_imgDel').onclick=()=>removeAsset('scene-'+k)
  }
  E('sceneBoost').addEventListener('input',e=>{
    state.sceneBoost=Number(e.target.value);E('sceneBoostVal').textContent='+'+state.sceneBoost+' dB';
    if(scene!=='live'){window.__sceneBgmBoost=state.sceneBoost;updateGains()}
    save()
  });
