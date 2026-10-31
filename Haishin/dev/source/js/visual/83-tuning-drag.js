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
  const dragOn=()=>E('quickTune').open;
  const lockView=()=>canvas.classList.toggle('locked',!dragOn());
  E('quickTune').addEventListener('toggle',lockView);lockView();
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||!dragOn())return;
    const p=stagePoint(e);
    let target=null;
    for(const m of [...(state.mascots||[])].reverse())if(m._box&&p.x>=m._box.x&&p.x<=m._box.x+m._box.w&&p.y>=m._box.y&&p.y<=m._box.y+m._box.h){target=m;break}
    if(!target&&sceneAvatar()){const gg=avatarGeom();if(p.x>=gg.cx-gg.w/2&&p.x<=gg.cx+gg.w/2&&p.y>=gg.bottom-gg.h&&p.y<=gg.bottom)target='avatar'}
    if(!target)return;
    drag={target,p0:p,ox:target==='avatar'?state.x:target.x,oy:target==='avatar'?state.y:target.y};
    if(target!=='avatar'){mscSel=target.id;renderMascotUI()}
    canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');e.preventDefault()
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag)return;
    const p=stagePoint(e),dx=p.x-drag.p0.x,dy=p.y-drag.p0.y;
    if(drag.target==='avatar'){
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
  const endDrag=()=>{if(!drag)return;drag=null;canvas.classList.remove('dragging');save()};
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
  E('quickTune').addEventListener('toggle',()=>{if(!E('quickTune').open)endDrag()});
