/* 画像の登録と表示：立ち絵の4枚・降らせる画像・場面の画像・以前の背景画像 */

  function assetName(id){
    return ['png0','png1','png2','png3'].includes(id)?slotNames[+id.slice(-1)]:id.startsWith('particle')?'降らせる画像'+(id==='particle'?1:+id.slice(8)+1):id.startsWith('fxp-')?'降らせる画像'+(+id.slice(-1)+1):id.startsWith('scene-')?'画面の画像':id.startsWith('msc-')?'マスコットの画像':'背景画像'
  }

  E('studioSlots').innerHTML=slotNames.map((n,i)=>`<label class="png-slot">${i+1}. ${n}<img id="pngPreview${i}" alt="${n}" hidden><span id="pngName${i}" class="png-name">未登録</span><input type="file" id="pngFile${i}" accept="image/png" aria-label="${n}のPNG"></label>`).join('');

  async function decode(blob){
    const u=URL.createObjectURL(blob);
    try{
      return await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(Error('画像を読み込めません'));
        img.src=u
      })
    }finally{
      URL.revokeObjectURL(u)
    }
  }

  async function installAsset(id,blob,name,persist=true){
    if(persist&&!/^image\/(png|webp|jpeg)$/.test(blob.type))throw Error('PNG・WebP・JPEGの画像を選んでください（他の形式は設定の書き出し・読み込みに対応していません）');
    if(blob.size>25*1024*1024)throw Error('画像は1枚25MB以下にしてください');
    const im=await decode(blob);
    if(im.width>8192||im.height>8192)throw Error('画像は縦横8192px以下にしてください');
    if(persist)await putAsset(ASSET+id,blob);
    images[id]=im;
    assetBlobs[id]=blob;
    state.assetNames[id]=name||assetName(id);
    if(id.startsWith('png')){
      const i=+id.slice(-1),
        el=E('pngPreview'+i);
      if(el.dataset.url)URL.revokeObjectURL(el.dataset.url);
      el.src=el.dataset.url=URL.createObjectURL(blob);
      el.hidden=false;
      E('pngName'+i).textContent=state.assetNames[id]
    }else renderAssetSlots();
    if(persist)save()
  }

  function bindFile(input,id,after){
    E(input).onchange=async e=>{
      const f=e.target.files[0];
      if(!f)return;
      try{
        if(!ready)throw Error('保存領域の準備中です。少し待ってください');
        await installAsset(id,f,f.name);
        after?.();
        toast(assetName(id)+'を登録しました')
      }catch(err){
        toast(err.message,5000)
      }finally{
        e.target.value=''
      }
    }
  }

  for(let i=0;i<4;i++)E('pngFile'+i).onchange=e=>charUpload(e,i);
  E('particleSlots').innerHTML=PARTICLE_IDS.map((id,i)=>`<div class="png-slot fx-slot"><label>画像${i+1}<img id="fxPreview${i}" alt="降らせる画像${i+1}" hidden><span id="fxName${i}" class="png-name">未登録</span><input type="file" id="fxFile${i}" accept="image/png,image/webp,image/jpeg" aria-label="降らせる画像${i+1}"></label><button type="button" class="fx-remove" id="fxRemove${i}" hidden>外す</button></div>`).join('');

  PARTICLE_IDS.forEach((_,i)=>{
    E('fxFile'+i).onchange=async e=>{
      const f=e.target.files[0];
      if(!f)return;
      try{
        if(!ready)throw Error('保存領域の準備中です。少し待ってください');
        const p=presetOf(state.effect);
        if(!p)throw Error('先に画像のプリセットを選ぶか、作ってください');
        await installAsset(pimg(p.id,i),f,f.name);
        toast('「'+p.name+'」に画像を登録しました')
      }catch(err){
        toast(err.message,5000)
      }finally{
        e.target.value=''
      }
    };
    E('fxRemove'+i).onclick=()=>{
      const p=presetOf(state.effect);
      if(p)removeAsset(pimg(p.id,i))
    }
  });

  E('backgroundRemove').onclick=()=>removeAsset('background');

  function renderAssetSlots(){
    const fp=presetOf(state.effect);
    PARTICLE_IDS.forEach((_,i)=>{
      const id=fp?pimg(fp.id,i):'',
        im=E('fxPreview'+i),
        b=id?assetBlobs[id]:null;
      if(im.dataset.url){
        URL.revokeObjectURL(im.dataset.url);
        im.dataset.url=''
      }
      if(b){
        im.src=im.dataset.url=URL.createObjectURL(b);
        im.hidden=false
      }else{
        im.removeAttribute('src');
        im.hidden=true
      }
      E('fxName'+i).textContent=b?(state.assetNames[id]||assetName(id)):'未登録';
      E('fxRemove'+i).hidden=!b
    });
    for(const k of ['standby','away','end']){const n=E('scene_'+k+'_imgName');if(!n)continue;const id='scene-'+k;n.textContent=assetBlobs[id]?(state.assetNames[id]||'画像'):'未登録';E('scene_'+k+'_imgDel').hidden=!assetBlobs[id]}
    E('backgroundName').textContent=assetBlobs.background?(state.assetNames.background||'背景画像'):'未登録';
    E('backgroundRemove').hidden=!assetBlobs.background;
    {const lg=E('bgLegacy');if(lg)lg.hidden=!assetBlobs.background}
  }

  async function removeAsset(id){
    try{
      await deleteAsset(ASSET+id);
      delete images[id];
      delete assetBlobs[id];
      delete state.assetNames[id];
      if(id==='background'&&state.bg==='image'){
        state.bg='cafe';
        E('studioBg').value='cafe'
      }
      save();
      renderAssetSlots();
      toast(assetName(id)+'を外しました')
    }catch(e){
      toast('外せませんでした：'+(e.message||e),5000)
    }
  }
  bindFile('studioBackground','background',()=>{
    state.bg='image';
    E('studioBg').value='image';
    save()
  });
