/* その場で調整（設定画面の項目と連動）、プレビュー上のドラッグ */

  const QT=[['studioThreshold','口が開く音量',' dB'],['studioMouthMode','口の動き',''],['studioFlapMin','パクパク最短',' ms'],['studioFlapMax','パクパク最長',' ms'],['studioScale','大きさ','%'],['studioX','左右',''],['studioY','上下',''],['studioMotionSing','歌うゆらぎの大きさ','%'],['studioMotionSingSpeed','歌うゆらぎの速さ','%'],['studioMotionHop','ぴょんぴょんの大きさ','%'],['studioMotionShake','ガタガタの大きさ','%'],['studioMotionAmt','呼吸・話すときの動き','%'],['studioEffect','季節の演出・画像のプリセット',''],['studioCount','演出の量',''],['studioSpeed','演出の速さ',''],['studioFxSize','演出の大きさ',''],['studioFxOpacity','演出の濃さ','']];
  (function buildQuickTune(){
    const box=E('quickTuneBody');
    for(const [id,label] of QT){
      const src=E(id);if(!src)continue;
      const lab=document.createElement('label'),cl=src.cloneNode(true),out=document.createElement('output');
      cl.id='qt_'+id;cl.removeAttribute('aria-label');out.id='qto_'+id;
      lab.append(document.createTextNode(label+' '),out,cl);box.append(lab);
      cl.addEventListener('input',()=>{src.value=cl.value;src.dispatchEvent(new Event('input',{bubbles:true}))});
      cl.addEventListener('change',()=>{if(src.tagName==='SELECT')src.dispatchEvent(new Event('change',{bubbles:true}))})
    }
  })();
  function syncQuickTune(){
    if(!E('quickTune').open)return;
    for(const [id,,unit] of QT){
      const s=E(id),c=E('qt_'+id),o=E('qto_'+id);if(!s||!c)continue;
      if(s.tagName==='SELECT'&&c.innerHTML!==s.innerHTML)c.innerHTML=s.innerHTML;
      if(document.activeElement!==c)c.value=s.value;
      if(o)o.textContent=s.tagName==='SELECT'?'':s.value+unit
    }
  }
  setInterval(syncQuickTune,250);
  E('quickTune').addEventListener('toggle',syncQuickTune);

  let drag=null;
  function stagePoint(e){
    const r=canvas.getBoundingClientRect(),s=Math.min(r.width/W,r.height/H),ox=(r.width-W*s)/2,oy=(r.height-H*s)/2;
    return {x:(e.clientX-r.left-ox)/s,y:(e.clientY-r.top-oy)/s}
  }
  // 「✋ ドラッグで動かす」がオンのとき、または「その場で調整」を開いているときだけ動かせる（配信中にうっかり動かさないため）
  let dragFree=false;
  const dragOn=()=>dragFree||E('quickTune').open;
  const lockView=()=>{
    canvas.classList.toggle('locked',!dragOn());
    const b=E('dragFree');b.setAttribute('aria-pressed',String(dragFree));b.textContent='✋ ドラッグで動かす：'+(dragFree?'オン':'オフ');b.classList.toggle('on',dragFree)
  };
  E('quickTune').addEventListener('toggle',lockView);
  E('dragFree').onclick=()=>{dragFree=!dragFree;lockView();if(!dragFree)endDrag()};
  lockView();
  canvas.addEventListener('pointerdown',e=>{
    // 0.9.5-gpt1（ChatGPT）：始めたポインター（指）だけがドラッグを持つ。ほかの指では始めない
    // 終わりの知らせを取りこぼして、つかんだままになっていたら外す
    if(drag&&!canvas.hasPointerCapture(drag.pointerId))drag=null;
    if(e.button!==0||!dragOn()||drag)return;
    const p=stagePoint(e);
    let target=null;
    // 手前に描くものから：スロット・ルーレット・サイコロ → マスコット → 立ち絵
    for(const kind of ['slot','wheel','dice']){
      const on=kind==='slot'?play.slot&&slotCfg().look!=='bubble':play[kind],b=playBoxes[kind];
      if(on&&b&&p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h){
        const L=playLayGet(kind)||{x:(b.x+b.w/2)/W*100,y:(b.y+b.h/2)/H*100,s:100};
        drag={pointerId:e.pointerId,target:{play:kind},p0:p,ox:L.x,oy:L.y,s:L.s};
        canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');e.preventDefault();return
      }
    }
    for(const m of [...myMascots()].reverse())if(m._box&&p.x>=m._box.x&&p.x<=m._box.x+m._box.w&&p.y>=m._box.y&&p.y<=m._box.y+m._box.h){target=m;break}
    if(!target&&sceneAvatar()){const gg=avatarGeom();if(p.x>=gg.cx-gg.w/2&&p.x<=gg.cx+gg.w/2&&p.y>=gg.bottom-gg.h&&p.y<=gg.bottom)target='avatar'}
    if(!target)return;
    drag={pointerId:e.pointerId,target,p0:p,ox:target==='avatar'?state.x:target.x,oy:target==='avatar'?state.y:target.y};
    if(target!=='avatar'){mscSel=target.id;renderMascotUI()}
    canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');e.preventDefault()
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const p=stagePoint(e),dx=p.x-drag.p0.x,dy=p.y-drag.p0.y;
    if(drag.target.play){
      playLaySet(drag.target.play,{x:drag.ox+dx/W*100,y:drag.oy+dy/H*100,s:drag.s});
      if(E('layKind').value===drag.target.play)renderLay()
    }else if(drag.target==='avatar'){
      state.x=Math.max(-300,Math.min(300,Math.round(drag.ox+dx/W*100)));
      state.y=Math.max(-200,Math.min(500,Math.round(drag.oy+dy/H*100)));
      E('studioX').value=state.x;E('studioY').value=state.y;E('yVal').textContent=Math.round(state.y)+'%'
    }else{
      drag.target.x=Math.max(-100,Math.min(100,Math.round(drag.ox+dx/W*200)));
      drag.target.y=Math.max(-100,Math.min(100,Math.round(drag.oy+dy/H*200)));
      const r=mscRun[drag.target.id];if(r){r.x=W/2+drag.target.x*W/200;r.y=H/2+drag.target.y*H/200}
      E('mscX').value=drag.target.x;E('mscY').value=drag.target.y
    }
  });
  // 0.9.5-gpt1（ChatGPT）：ほかの指が離れても終わらない。ボタンなどで終えるとき（引数なし）も、つかみを放す
  const endDrag=e=>{if(!drag||(e&&e.pointerId!==drag.pointerId))return;const id=drag.pointerId;drag=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);canvas.classList.remove('dragging');save()};
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
  E('quickTune').addEventListener('toggle',()=>{if(!E('quickTune').open)endDrag()});
