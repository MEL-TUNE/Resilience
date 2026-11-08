/* キャラクター・名義の編集画面：画像の登録、追加・複製・並べ替え・削除 */

  async function storeCharImage(cid,slot,f){
    if(!/^image\/(png|webp|jpeg)$/.test(f.type))throw Error('PNG・WebP・JPEGの画像を選んでください');
    if(f.size>25*1024*1024)throw Error('画像は1枚25MB以下にしてください');
    const im=await decode(f);
    if(im.width>8192||im.height>8192)throw Error('画像は縦横8192px以下にしてください');
    const key=charKey(cid,slot);
    await putAsset(ASSET+key,f);
    charBlobs[key]=f;
    charImgs[key]=im;
    state.assetNames[key]=f.name||'画像'
  }

  async function charUpload(e,slot){
    const f=e.target.files[0];
    if(!f)return;
    try{
      if(!ready)throw Error('保存領域の準備中です。少し待ってください');
      await storeCharImage(state.charId,slot,f);
      applyCharImages();
      renderCharUI();
      save();
      toast((curChar()?.name||'キャラクター')+'の画像を登録しました')
    }catch(err){
      toast(err.message,5000)
    }finally{
      e.target.value=''
    }
  }

  E('charBgFile').onchange=async e=>{
    const f=e.target.files[0];
    if(!f)return;
    try{
      if(!ready)throw Error('保存領域の準備中です。少し待ってください');
      await storeCharImage(state.charId,'bg',f);
      curChar().bgMode='own';
      renderCharUI();
      save();
      toast('このキャラクターの背景画像を登録しました')
    }catch(err){
      toast(err.message,5000)
    }finally{
      e.target.value=''
    }
  };

  E('charBgRemove').onclick=async()=>{
    const key=charKey(state.charId,'bg');
    try{
      await deleteAsset(ASSET+key)
    }catch(_){}
    delete charBlobs[key];
    delete charImgs[key];
    delete state.assetNames[key];
    const c=curChar();
    if(c.bgMode==='own')c.bgMode='inherit';
    renderCharUI();
    save();
    toast('専用の背景画像を外しました')
  };

  function armed(btn,label,run){
    if(btn.dataset.armed!=='1'){
      btn.dataset.armed='1';
      const old=btn.textContent;
      btn.dataset.old=old;
      btn.textContent=label;
      clearTimeout(btn._t);
      btn._t=setTimeout(()=>{
        btn.dataset.armed='';
        btn.textContent=btn.dataset.old
      },4000);
      return
    }
    clearTimeout(btn._t);
    btn.dataset.armed='';
    btn.textContent=btn.dataset.old;
    run()
  }

  async function dropCharAssets(cid){
    for(const slot of charSlots(cid)){
      const key=charKey(cid,slot);
      try{
        await deleteAsset(ASSET+key)
      }catch(_){}
      delete charBlobs[key];
      delete charImgs[key];
      delete state.assetNames[key]
    }
  }

  E('profileSel').onchange=e=>activateProfile(e.target.value);

  E('profileName').oninput=e=>{
    const p=curProfile();
    if(p){
      p.name=e.target.value.slice(0,40)||'名義';
      save();
      renderCharUI()
    }
  };

  E('profileAdd').onclick=()=>{
    if(state.profiles.length>=20){
      toast('登録できる名義は20件までです');
      return
    }
    syncChar();
    const pid=newProfileId(),
      cid=newCharId();
    state.chars[cid]=cleanChar({name:'キャラクター1',...pickValues()});
    state.profiles.push({id:pid,name:'新しい名義',chars:[cid],cur:cid,snap:profileSnap(),mscShow:[]});
    activateProfile(pid);
    E('profileName').focus();
    E('profileName').select()
  };

  E('profileDel').onclick=e=>{
    if(state.profiles.length<2)return;
    const p=curProfile();
    armed(e.currentTarget,'もう一度押すと「'+p.name+'」と中のキャラクターを削除',async()=>{
      const idx=state.profiles.indexOf(p),
        next=state.profiles[idx===0?1:idx-1];
      activateProfile(next.id);
      state.profiles=state.profiles.filter(x=>x!==p);
      for(const cid of p.chars){
        await dropCharAssets(cid);
        delete state.chars[cid]
      }
      renderCharUI();
      save();
      toast('名義を削除しました')
    })
  };

  E('charAdd').onclick=()=>{
    const p=curProfile();
    if(p.chars.length>=60){
      toast('1つの名義に登録できるのは60体までです');
      return
    }
    syncChar();
    const cid=newCharId();
    state.chars[cid]=cleanChar({name:'キャラクター'+(p.chars.length+1),...pickValues()});
    p.chars.push(cid);
    activateChar(cid);
    E('charName').focus();
    E('charName').select()
  };

  E('charDup').onclick=async()=>{
    const p=curProfile(),
      src=state.charId;
    if(p.chars.length>=60){
      toast('1つの名義に登録できるのは60体までです');
      return
    }
    syncChar();
    const cid=newCharId();
    state.chars[cid]=cleanChar({...state.chars[src],name:(state.chars[src].name||'キャラクター')+'（複製）'});
    try{
      for(const slot of charSlots(src)){
        const b=charBlobs[charKey(src,slot)];
        if(b){
          const key=charKey(cid,slot);
          await putAsset(ASSET+key,b);
          charBlobs[key]=b;
          charImgs[key]=charImgs[charKey(src,slot)];
          state.assetNames[key]=state.assetNames[charKey(src,slot)]
        }
      }
    }catch(err){
      toast('画像を複製できませんでした：'+(err.message||err),5000)
    }
    p.chars.splice(p.chars.indexOf(src)+1,0,cid);
    activateChar(cid);
    toast('複製しました')
  };

  E('charLeft').onclick=()=>{
    const p=curProfile(),
      i=p.chars.indexOf(state.charId);
    if(i>0){
      [p.chars[i-1],p.chars[i]]=[p.chars[i],p.chars[i-1]];
      save();
      renderCharUI()
    }
  };

  E('charRight').onclick=()=>{
    const p=curProfile(),
      i=p.chars.indexOf(state.charId);
    if(i>=0&&i<p.chars.length-1){
      [p.chars[i+1],p.chars[i]]=[p.chars[i],p.chars[i+1]];
      save();
      renderCharUI()
    }
  };

  E('charDel').onclick=e=>{
    const p=curProfile();
    if(p.chars.length<2)return;
    const cid=state.charId,
      c=curChar();
    armed(e.currentTarget,'もう一度押すと「'+c.name+'」を削除',async()=>{
      const i=p.chars.indexOf(cid);
      p.chars.splice(i,1);
      state.charId='';
      activateChar(p.chars[Math.max(0,i-1)],true);
      await dropCharAssets(cid);
      delete state.chars[cid];
      renderCharUI();
      save();
      toast('キャラクターを削除しました')
    })
  };

  E('charName').oninput=e=>{
    const c=curChar();
    if(c){
      c.name=e.target.value.slice(0,40)||'キャラクター';
      save();
      renderCharUI()
    }
  };

  E('charMode').onchange=e=>{
    curChar().mode=e.target.value==='single'?'single':'four';
    save();
    renderCharUI()
  };

  E('charTalk').onchange=e=>{
    curChar().talk=e.target.value;
    save()
  };
  E('charTrim').onchange=e=>{
    curChar().trim=e.target.checked;
    save()
  };
  E('charBreath').onchange=e=>{
    curChar().breath=e.target.checked;
    save()
  };

  E('charBg').onchange=e=>{
    const c=curChar();
    c.bgMode=e.target.value;
    if(c.bgMode==='own'&&!charBlobs[charKey(state.charId,'bg')])toast('専用の背景画像を下で登録すると表示されます',4000);
    save()
  };

  E('switchFx').onchange=e=>{
    state.switchFx=e.target.value==='cut'?'cut':'fade';
    save()
  };

  E('charMove').onchange=e=>{
    const to=state.profiles.find(q=>q.id===e.target.value),
      p=curProfile();
    if(!to)return;
    if(to.chars.length>=60){
      toast('移動先の名義には既に60体登録されています');
      e.target.value='';
      return;
    }
    if(p.chars.length<2){
      toast('名義の最後の1体は移せません。先に別のキャラクターを追加してください',5000);
      e.target.value='';
      return
    }
    const cid=state.charId,
      name=curChar().name;
    syncChar();
    p.chars=p.chars.filter(x=>x!==cid);
    to.chars.push(cid);
    state.charId='';
    p.cur=p.chars[0];
    activateChar(p.chars[0],true);
    toast('「'+name+'」を「'+to.name+'」へ移しました')
  };

  E('studioScale').addEventListener('input',()=>{
    E('scaleVal').textContent=Math.round(state.scale)+'%'
  });
  E('studioY').addEventListener('input',()=>{
    E('yVal').textContent=Math.round(state.y)+'%'
  });

  function applyPadSize(){
    document.body.dataset.pad=['s','m','l'].includes(state.padSize)?state.padSize:'m';
    const s=E('padSize');
    if(s)s.value=document.body.dataset.pad
  }

  E('padSize').onchange=e=>{
    state.padSize=e.target.value;
    applyPadSize();
    save()
  };
  applyPadSize();

  ensureProfiles();
  renderCharUI();

  window.__otonohaChars={get state(){
      return state
    },get mouth(){
      return mouth
    },charKey,activateChar,activateProfile};
