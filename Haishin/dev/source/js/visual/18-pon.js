/* 企画のポン出し：セリフ帳・スロット・ルーレット・サイコロ・登録アプリを、ステージから一押しで出す */

  const ponCfg=()=>state.pon||(state.pon={hide:[],app:'window',serif:'all'});
  const ponBags={};
  // 並べるもの（シチュエーションは、セリフのあるものだけ）
  function ponItems(){
    const out=[];
    for(const s of serifList())if(serifLines(s).length)out.push({id:'s:'+s.id,kind:'serif',label:'💬 '+s.title,s});
    if(serifList().some(s=>serifLines(s).length))out.push({id:'slot',kind:'slot',label:'🎰 スロット'});
    out.push({id:'wheel',kind:'wheel',label:'🎡 ルーレット'},{id:'dice',kind:'dice',label:'🎲 サイコロ'});
    {const d=topicDeck();if(d&&d.items.length)out.push({id:'topic',kind:'topic',label:'📌 '+d.name+'：次へ',d})}
    for(const a of appList())out.push({id:'a:'+a.id,kind:'app',label:(a.kind==='url'?'🔗 ':'📄 ')+a.name,a});
    return out
  }
  function ponSerif(s){
    const lines=serifLines(s);
    if(!lines.length)return;
    let bag=ponBags[s.id];
    if(!bag?.length||bag.some(i=>i>=lines.length))bag=ponBags[s.id]=slotShuffle(lines.map((_,i)=>i));
    play.slot=null;
    serifShow(s,lines[bag.pop()])
  }
  async function ponApp(a){
    state.appSel=a.id;save();
    if(ponCfg().app==='page'){
      document.querySelector('.studio-tabs [data-mode="plan"]')?.click();
      await appShow();
      E('appStageWrap')?.scrollIntoView({block:'start',behavior:'smooth'});
      return
    }
    if(appWinOpen()){
      try{
        const src=await appSrc(a),f=appWindow.document.getElementById('app');
        appFrameAttrs(f,a);if(f.getAttribute('src')!==src)f.src=src;appWindow.focus()
      }catch(e){toast(e.message||'アプリを開けませんでした',5000)}
      renderApps();return
    }
    E('appWinBtn').click()
  }
  function ponRun(it){
    if(it.kind==='serif')ponSerif(it.s);
    else if(it.kind==='slot')slotSpin('all');
    else if(it.kind==='wheel')E('wheelSpin').click();
    else if(it.kind==='dice')E('diceRoll').click();
    else if(it.kind==='app')ponApp(it.a);
    else if(it.kind==='topic')topicNext(topicDeck(),1,true);
    ponState()
  }
  // 画面に出ているもの・開いているアプリのボタンを点灯させる（作り直さずに、印だけ変える）
  function ponOn(it){
    if(it.kind==='serif')return !!play.serif&&play.serif.title===it.s.title&&!play.slot;
    if(it.kind==='slot')return !!play.slot;
    if(it.kind==='topic')return !!play.topic;
    if(it.kind==='wheel')return !!play.wheel;
    if(it.kind==='dice')return !!play.dice;
    if(it.kind==='app')return state.appSel===it.a.id&&(appWinOpen()||!!E('appFrame').getAttribute('src'));
    return false
  }
  let ponSig='',ponNodes=[];
  function renderPon(){
    const c=ponCfg(),all=ponItems(),sv=c.serif||'all';
    // シチュエーションは、ドロップダウンで選んだもの（すべて／1つ／使わない）。ほかはチェックボックス
    const shown=all.filter(it=>it.kind==='serif'?(sv==='all'||sv==='s:'+it.s.id):!c.hide.includes(it.id));
    const sig=JSON.stringify([shown.map(it=>it.id+it.label),all.map(it=>it.id+it.label),c.app,sv]);
    if(sig!==ponSig){
      ponSig=sig;
      ponNodes=shown.map(it=>{
        const b=document.createElement('button');b.type='button';b.className='pon-btn pon-'+it.kind;b.textContent=it.label;
        b.title=it.kind==='serif'?'押すたびに、このシチュエーションのセリフを1つ出します（全部出し終えるまで同じセリフは出ません）':it.kind==='app'?(c.app==='page'?'企画卓の中で開きます':'アプリと立ち絵のウインドウで開きます'):'';
        b.onclick=()=>ponRun(it);
        return {it,b}
      });
      E('ponGrid').replaceChildren(...ponNodes.map(n=>n.b));
      E('ponEmpty').hidden=shown.length>0;
      // 並べるものの選択
      const sel=E('ponSerif'),ser=all.filter(it=>it.kind==='serif');
      sel.replaceChildren(...[['none','今回は使用しない'],['all','すべて並べる（'+ser.length+'個）'],...ser.map(it=>['s:'+it.s.id,it.label.replace(/^💬 /,'')])].map(([v,t])=>Object.assign(document.createElement('option'),{value:v,textContent:t})));
      sel.value=sv==='all'||sv==='none'||ser.some(it=>'s:'+it.s.id===sv)?sv:'all';
      E('ponPick').replaceChildren(...all.filter(it=>it.kind!=='serif').map(it=>{
        const l=document.createElement('label');l.className='pon-pick';
        const cb=document.createElement('input');cb.type='checkbox';cb.checked=!c.hide.includes(it.id);
        cb.onchange=()=>{c.hide=cb.checked?c.hide.filter(x=>x!==it.id):[...c.hide,it.id].slice(-300);save();renderPon()};
        l.append(cb,' '+it.label);return l
      }));
      E('ponApp').value=c.app
    }
    ponState()
  }
  function ponState(){
    for(const {it,b} of ponNodes){const on=ponOn(it);if(b.classList.contains('on')!==on){b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)}}
    const sl=play.slot;
    E('ponSlotRe').hidden=E('ponSlotRb').hidden=!(sl&&sl.done);
    const now=sl?(sl.done?'スロット：'+sl.role+'「'+sl.line+'」':'スロット：抽選中…'):play.serif?'セリフ：'+play.serif.text:'';
    const tp=play.topic&&topicCfg().decks.find(d=>d.id===play.topic.deck),ti=tp&&tp.items.find(x=>x.id===play.topic.item);
    const tpt=ti?'お題：'+tHead(tp,ti):'';
    const extra=[play.dice?.done?'サイコロ：'+play.dice.vals.join('・'):'',play.wheel?.done?'ルーレット：'+play.wheel.items[play.wheel.pick]:''].filter(Boolean).join('　');
    const t=[tpt,now,extra].filter(Boolean).join('　')||'画面には何も出していません';
    if(E('ponNow').textContent!==t)E('ponNow').textContent=t
  }
  E('ponSlotRe').onclick=()=>{slotSpin('a');ponState()};
  E('ponSlotRb').onclick=()=>{slotSpin('b');ponState()};
  E('ponClear').onclick=()=>{play.serif=null;play.slot=null;play.dice=null;play.wheel=null;play.topic=null;renderPlays();ponState()};
  E('ponApp').onchange=e=>{ponCfg().app=e.target.value==='page'?'page':'window';save();renderPon()};
  E('ponAll').onclick=()=>{ponCfg().hide=[];ponCfg().serif='all';save();renderPon()};
  E('ponSerif').onchange=e=>{ponCfg().serif=e.target.value;save();renderPon()};
  setInterval(()=>{if(ponNodes.length||play.serif||play.slot)ponState()},400);
