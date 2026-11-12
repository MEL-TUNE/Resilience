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
    return !s||s==='self'||!myMascots().some(m=>m.id===s&&m.talk&&m.show)
  }
  function setExpr(id){
    curExpr=id||'';
    switchAt=performance.now();
    renderExprBar();
    // 表情の設定の「この表情を試す」の表示も合わせる
    for(const b of document.querySelectorAll('#exprList [data-a=try]')){const on=b.closest('.expr-row')?.dataset.id===curExpr&&!!curExpr;b.setAttribute('aria-pressed',String(on));b.textContent=on?'試すのをやめる（通常に戻す）':'この表情を試す'}
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
  const EXPR_MOTION=[['none','動かさない（そのままの動き）'],['shake','ガタガタ'],['hop','ぴょんぴょん'],['sing','歌うゆらぎ'],['wander','右往左往'],['iya','いやいや']];
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
      const row=document.createElement('div');row.className='expr-row';row.dataset.id=e.id;
      const u1=exprThumb(state.charId,'x'+e.id),u2=exprThumb(state.charId,'y'+e.id);
      row.innerHTML=`<div class="studio-inline"><label class="studio-field">表情の名前<input type="text" maxlength="20" data-k="name"></label><label class="studio-field">連動する動き<select data-k="motion">${EXPR_MOTION.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div>`
        +`<div class="expr-motion"><div class="studio-inline"><label class="studio-field"><span data-l="amt">動きの大きさ</span> <output data-o="amt"></output><input type="range" min="0" max="200" step="5" data-k="amt"></label><label class="studio-field">動きの速さ <output data-o="spd"></output><input type="range" min="40" max="200" step="5" data-k="spd"></label></div>`
        +`<div class="studio-row"><button type="button" data-a="try" aria-pressed="false">この表情を試す</button><button type="button" data-a="base">キャラの設定の値を写す</button></div><p class="studio-mini">この表情のときだけ使う値です（100％＝ふつう）。「試す」を押すと、プレビューでこの表情に切り替わり、動かしながら調整できます。</p></div>`
        +`<div class="expr-imgs"><label>表情の画像 ${u1?`<img src="${u1}" alt="">`:'（未登録）'}<input type="file" accept="image/png,image/webp,image/jpeg" data-f="x"></label><label>口を開いた画像（任意） ${u2?`<img src="${u2}" alt="">`:'（なし）'}<input type="file" accept="image/png,image/webp,image/jpeg" data-f="y"></label></div>`
        +`<div class="studio-row"><button type="button" data-a="del">この表情を削除</button>${u2?'<button type="button" data-a="dely">口を開いた画像を外す</button>':''}</div>`;
      row.querySelector('[data-k=name]').value=e.name;
      row.querySelector('[data-k=motion]').value=e.motion;
      row.querySelector('[data-k=name]').oninput=ev=>{e.name=ev.target.value.slice(0,20)||'表情';save();renderExprBar()};
      const mbox=row.querySelector('.expr-motion'),
        AMT_L={shake:'ガタガタの大きさ',hop:'ぴょんぴょんの高さ',sing:'歌うゆらぎの大きさ',wander:'右往左往の歩く幅',iya:'いやいやの大きさ'},
        KEY={shake:'Shake',hop:'Hop',sing:'Sing',wander:'Wander',iya:'Iya'};
      if(!Number.isFinite(e.amt))e.amt=100;
      if(!Number.isFinite(e.spd))e.spd=100;
      const drawM=()=>{
        mbox.hidden=e.motion==='none';
        mbox.querySelector('[data-l=amt]').textContent=AMT_L[e.motion]||'動きの大きさ';
        for(const k of ['amt','spd']){mbox.querySelector('[data-k='+k+']').value=e[k];mbox.querySelector('[data-o='+k+']').textContent=e[k]+'%'}
        const tb=mbox.querySelector('[data-a=try]');tb.setAttribute('aria-pressed',String(curExpr===e.id));tb.textContent=curExpr===e.id?'試すのをやめる（通常に戻す）':'この表情を試す'
      };
      drawM();
      row.querySelector('[data-k=motion]').onchange=ev=>{e.motion=ev.target.value;save();drawM()};
      for(const k of ['amt','spd'])mbox.querySelector('[data-k='+k+']').oninput=ev=>{e[k]=Number(ev.target.value);mbox.querySelector('[data-o='+k+']').textContent=e[k]+'%';save()};
      mbox.querySelector('[data-a=try]').onclick=()=>setExpr(curExpr===e.id?'':e.id);
      mbox.querySelector('[data-a=base]').onclick=()=>{
        const K=KEY[e.motion];if(!K)return;
        e.amt=Math.round(state['motion'+K]??100);e.spd=Math.round(state['motion'+K+'Speed']??100);save();drawM()
      };
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
