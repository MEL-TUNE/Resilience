/* 表情差分 */

  let curExpr='';
  function charSlots(cid){
    const c=state.chars&&state.chars[cid];
    return [0,1,2,3,'bg',...((c&&c.exprs)||[]).flatMap(e=>['x'+e.id,'y'+e.id])]
  }
  function curExprObj(){
    const c=curChar();
    return curExpr&&c&&c.exprs?c.exprs.find(e=>e.id===curExpr)||null:null
  }
  function exprImage(talking){
    const e=curExprObj();
    if(!e)return null;
    const im=charImgs[charKey(state.charId,'x'+e.id)];
    if(!im)return null;
    const mo=charImgs[charKey(state.charId,'y'+e.id)];
    return talking&&mo?mo:im
  }
  function effMotion(){
    const e=curExprObj();
    return e&&e.motion!=='none'?e.motion:motion
  }
  function selfSpeak(){
    const s=state.speaker;
    return !s||s==='self'||!(state.mascots||[]).some(m=>m.id===s&&m.talk&&m.show)
  }
  function setExpr(id){
    curExpr=id||'';
    switchAt=performance.now();
    renderExprBar()
  }
  function renderExprBar(){
    const bar=E('exprBar'),c=curChar(),list=(c&&c.exprs)||[];
    if(curExpr&&!list.some(e=>e.id===curExpr))curExpr='';
    bar.hidden=!list.length;
    bar.replaceChildren();
    if(!list.length)return;
    const lab=document.createElement('span');lab.className='studio-mini';lab.textContent='表情';bar.append(lab);
    for(const [id,name] of [['','通常'],...list.map(e=>[e.id,e.name])]){
      const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(curExpr===id));
      b.onclick=()=>setExpr(id);bar.append(b)
    }
  }
  const EXPR_MOTION=[['none','動かさない（そのままの動き）'],['shake','ガタガタ'],['hop','ぴょんぴょん'],['sing','歌うゆらぎ']];
  function exprThumb(cid,slot){
    const b=charBlobs[charKey(cid,slot)];
    if(!b)return '';
    const u=URL.createObjectURL(b);charUrls.push(u);return u
  }
  function renderExprUI(){
    renderExprBar();
    const box=E('exprList'),c=curChar();
    if(!box)return;
    box.replaceChildren();
    if(!c)return;
    c.exprs=c.exprs||[];
    c.exprs.forEach((e,i)=>{
      const row=document.createElement('div');row.className='expr-row';
      const u1=exprThumb(state.charId,'x'+e.id),u2=exprThumb(state.charId,'y'+e.id);
      row.innerHTML=`<div class="studio-inline"><label class="studio-field">表情の名前<input type="text" maxlength="20" data-k="name"></label><label class="studio-field">連動する動き<select data-k="motion">${EXPR_MOTION.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div>`
        +`<div class="expr-imgs"><label>表情の画像 ${u1?`<img src="${u1}" alt="">`:'（未登録）'}<input type="file" accept="image/png,image/webp,image/jpeg" data-f="x"></label><label>口を開いた画像（任意） ${u2?`<img src="${u2}" alt="">`:'（なし）'}<input type="file" accept="image/png,image/webp,image/jpeg" data-f="y"></label></div>`
        +`<div class="studio-row"><button type="button" data-a="del">この表情を削除</button>${u2?'<button type="button" data-a="dely">口を開いた画像を外す</button>':''}</div>`;
      row.querySelector('[data-k=name]').value=e.name;
      row.querySelector('[data-k=motion]').value=e.motion;
      row.querySelector('[data-k=name]').oninput=ev=>{e.name=ev.target.value.slice(0,20)||'表情';save();renderExprBar()};
      row.querySelector('[data-k=motion]').onchange=ev=>{e.motion=ev.target.value;save()};
      row.querySelectorAll('input[type=file]').forEach(inp=>inp.onchange=async ev=>{
        const f=ev.target.files[0];if(!f)return;
        try{if(!ready)throw Error('保存領域の準備中です');await storeCharImage(state.charId,inp.dataset.f+e.id,f);save();renderExprUI();toast('「'+e.name+'」の画像を登録しました')}catch(err){toast(err.message,5000)}finally{ev.target.value=''}
      });
      row.querySelector('[data-a=del]').onclick=ev=>armed(ev.currentTarget,'もう一度押すと「'+e.name+'」を削除',async()=>{
        for(const s of ['x'+e.id,'y'+e.id]){const key=charKey(state.charId,s);try{await deleteAsset(ASSET+key)}catch(_){}delete charBlobs[key];delete charImgs[key];delete state.assetNames[key]}
        c.exprs=c.exprs.filter(x=>x!==e);if(curExpr===e.id)curExpr='';save();renderExprUI()
      });
      const dy=row.querySelector('[data-a=dely]');
      if(dy)dy.onclick=async()=>{const key=charKey(state.charId,'y'+e.id);try{await deleteAsset(ASSET+key)}catch(_){}delete charBlobs[key];delete charImgs[key];save();renderExprUI()};
      box.append(row)
    })
  }
  E('exprAdd').onclick=()=>{
    const c=curChar();if(!c)return;
    c.exprs=c.exprs||[];
    if(c.exprs.length>=12){toast('表情差分は1体につき12個までです');return}
    let id;do id=Math.random().toString(36).slice(2,7);while(c.exprs.some(e=>e.id===id));
    c.exprs.push({id,name:['青ざめ','驚き','赤面','怒り'][c.exprs.length]||('表情'+(c.exprs.length+1)),motion:c.exprs.length===0?'shake':'none'});
    save();renderExprUI()
  };
