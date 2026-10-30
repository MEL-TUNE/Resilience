/* マスコット */

  let mscSel='',mscLast=0;const mscEnv={};
  function mscCur(){return (state.mascots||[]).find(m=>m.id===mscSel)||null}
  function drawMascots(now){
    const list=state.mascots||[];
    const dtp=mscLast?Math.min(.1,(now-mscLast)/1000):0;mscLast=now;
    if(!list.length)return;
    const u=H/720,t=now/1000,TAU=Math.PI*2,deg=Math.PI/180;
    for(const m of list){
      m._box=null;
      if(!m.show)continue;
      const im=images['msc-'+m.id];
      if(!im)continue;
      const seed=(m.id.charCodeAt(0)+m.id.charCodeAt(m.id.length-1))*.173,a=m.amp/100,sp=m.speed/100,
        h=H*m.size/100,f=h/im.height,w=im.width*f,x=W/2+m.x*W/200,y=H/2+m.y*H/200;
      let dx=0,dy=0,rot=0;
      if(m.motion==='float'){dy=Math.sin(t*TAU*.3*sp+seed)*12*u*a;dx=Math.sin(t*TAU*.17*sp+seed*2)*6*u*a;rot=Math.sin(t*TAU*.23*sp+seed)*3*deg*a}
      else if(m.motion==='sway'){const s=Math.sin(t*TAU*.45*sp+seed);rot=s*6*deg*a;dy=-Math.abs(s)*3*u*a}
      else if(m.motion==='hop'){const ph=(t*1.5*sp+seed)%1;dy=-4*ph*(1-ph)*18*u*a}
      else if(m.motion==='shake'){const s=Math.floor(t*11*sp);dx=(rnd(s+seed)-.5)*10*u*a;dy=(rnd(s+seed+.31)-.5)*6*u*a;rot=(rnd(s+seed+.67)-.5)*8*deg*a}
      const on=state.speaker===m.id&&m.talk,target=on?Math.max(talkEnv,mouth?.6:0):0,e0=mscEnv[m.id]||0,e1=e0+(target-e0)*Math.min(1,dtp*(target>e0?14:5));
      mscEnv[m.id]=e1;
      if(e1>.01){dy-=e1*(5+Math.abs(Math.sin(t*TAU*4.2))*10)*u;rot+=Math.sin(t*TAU*4.2)*e1*3*deg}
      const spc=avSprite(im,{x:0,y:0,w:im.width,h:im.height},f);
      g.save();g.translate(x+dx,y+dy);g.rotate(rot);g.imageSmoothingEnabled=true;g.imageSmoothingQuality=state.light?'medium':'high';
      if(spc)g.drawImage(spc.c,-spc.dw/2,-spc.dh/2);else g.drawImage(im,-w/2,-h/2,w,h);
      g.restore();
      m._box={x:x-w/2,y:y-h/2,w,h}
    }
  }
  function drawSceneImage(now){
    if(scene==='live')return;
    const c=state.scenes[scene],im=images['scene-'+scene];
    if(!c||!im)return;
    const u=H/720,t=now/1000,TAU=Math.PI*2,a=c.imgAmp/100,h=H*c.imgSize/100,f=h/im.height,w=im.width*f,x=W/2+c.imgX*W/200,y=H/2+c.imgY*H/200;
    let dx=0,dy=0,rot=0;
    if(c.imgMotion==='float'){dy=Math.sin(t*TAU/3.2)*12*u*a;dx=Math.sin(t*TAU/5.1+1)*5*u*a;rot=Math.sin(t*TAU/4.3+.4)*1.6*Math.PI/180*a}
    else if(c.imgMotion==='sway')rot=Math.sin(t*TAU/2.6)*4*Math.PI/180*a;
    const spc=avSprite(im,{x:0,y:0,w:im.width,h:im.height},f);
    g.save();g.translate(x+dx,y+dy);g.rotate(rot);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    if(spc)g.drawImage(spc.c,-spc.dw/2,-spc.dh/2);else g.drawImage(im,-w/2,-h/2,w,h);
    g.restore()
  }
  function renderSpeakerBar(){
    const bar=E('speakerBar'),list=(state.mascots||[]).filter(m=>m.talk&&m.show);
    if(state.speaker!=='self'&&!list.some(m=>m.id===state.speaker))state.speaker='self';
    bar.hidden=!list.length;bar.replaceChildren();
    if(!list.length)return;
    const lab=document.createElement('span');lab.className='studio-mini';lab.textContent='話者';bar.append(lab);
    for(const [id,name] of [['self','本人（立ち絵）'],...list.map(m=>[m.id,m.name])]){
      const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(state.speaker===id));
      b.onclick=()=>{state.speaker=id;save();renderSpeakerBar()};bar.append(b)
    }
  }
  function renderMascotUI(){
    const list=state.mascots||[];
    if(!list.some(m=>m.id===mscSel))mscSel=list[0]?.id||'';
    const chips=E('mascotChips');chips.replaceChildren();
    for(const m of list){const b=document.createElement('button');b.type='button';b.textContent=m.name+(images['msc-'+m.id]?'':'（画像なし）');b.classList.toggle('selected',m.id===mscSel);b.onclick=()=>{mscSel=m.id;renderMascotUI()};chips.append(b)}
    const m=mscCur();
    E('mascotEdit').hidden=!m;E('mascotDel').disabled=!m;
    if(m){
      if(document.activeElement!==E('mscName'))E('mscName').value=m.name;
      E('mscShow').checked=m.show;E('mscTalk').checked=m.talk;E('mscMotion').value=m.motion;
      for(const [id,k] of [['mscAmp','amp'],['mscSpeed','speed'],['mscSize','size'],['mscX','x'],['mscY','y']])if(document.activeElement!==E(id))E(id).value=m[k];
      E('mscAmpVal').textContent=m.amp+'%';E('mscSpeedVal').textContent=m.speed+'%';E('mscSizeVal').textContent=m.size+'%';
      E('mscFileName').textContent=assetBlobs['msc-'+m.id]?(state.assetNames['msc-'+m.id]||'画像'):'未登録'
    }
    renderSpeakerBar()
  }
  E('mascotAdd').onclick=()=>{
    state.mascots=state.mascots||[];
    if(state.mascots.length>=8){toast('マスコットは8体までです');return}
    let id;do id=Math.random().toString(36).slice(2,8);while(state.mascots.some(m=>m.id===id));
    const n=state.mascots.length;
    state.mascots.push({id,name:'マスコット'+(n+1),show:true,talk:false,motion:'float',amp:100,speed:100,size:22,x:60-n*25,y:40});
    mscSel=id;save();renderMascotUI();toast('マスコットを追加しました。画像を登録してください')
  };
  E('mascotDel').onclick=e=>{
    const m=mscCur();if(!m)return;
    armed(e.currentTarget,'もう一度押すと「'+m.name+'」を削除',async()=>{
      const id='msc-'+m.id;try{await deleteAsset(ASSET+id)}catch(_){}delete images[id];delete assetBlobs[id];delete state.assetNames[id];
      state.mascots=state.mascots.filter(x=>x!==m);save();renderMascotUI()
    })
  };
  E('mscFile').onchange=async e=>{
    const f=e.target.files[0],m=mscCur();if(!f||!m)return;
    try{if(!ready)throw Error('保存領域の準備中です');await installAsset('msc-'+m.id,f,f.name);renderMascotUI();toast('「'+m.name+'」の画像を登録しました')}catch(err){toast(err.message,5000)}finally{e.target.value=''}
  };
  E('mscName').oninput=e=>{const m=mscCur();if(m){m.name=e.target.value.slice(0,20)||'マスコット';save();renderMascotUI()}};
  E('mscShow').onchange=e=>{const m=mscCur();if(m){m.show=e.target.checked;save();renderMascotUI()}};
  E('mscTalk').onchange=e=>{const m=mscCur();if(m){m.talk=e.target.checked;save();renderMascotUI()}};
  E('mscMotion').onchange=e=>{const m=mscCur();if(m){m.motion=e.target.value;save()}};
  for(const [id,k] of [['mscAmp','amp'],['mscSpeed','speed'],['mscSize','size'],['mscX','x'],['mscY','y']])E(id).addEventListener('input',e=>{const m=mscCur();if(m){m[k]=Number(e.target.value);save();renderMascotUI()}});
