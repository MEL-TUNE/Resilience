/* 操作盤（デッキ）：配信・動画の画面を「本番」と「準備」に分け、タブで1枚ずつ見せる。
   - 本番：🎲 企画／🔊 効果音／🎵 BGM／👗 表情／🎛 収録・接続／☰ 全部。映像と「いつも使う操作」の帯は上に残す
   - 準備：📝 企画の準備／🎤 歌枠ノート／🎧 AIキャラ・声
   見せる・隠すは CSS（css/deck.css）が body の data-level・data-deck を見て決める。ここでは値を変えるだけで、要素は作らない。
   要素を動かすのは2つだけ：番組の行（ラジオは録音バー、配信・動画は BGM の欄）と、場面のボタン（配信は帯、動画は「収録・接続」） */

  const DECK_KEY='otonoha-deck',PV_PIN_KEY='otonoha-pv-pin',PLAN_KEY='otonoha-plan-open';
  const DECK_LIVE=['kikaku','se','bgm','chara','tools','all'],DECK_PREP=['plan','songs','aivoice'];
  const lsGet=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
  const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}};
  const deck={level:'live',live:'kikaku',prep:'plan'};
  {
    let s={};
    try{s=JSON.parse(lsGet(DECK_KEY)||'{}')||{}}catch(_){}
    // 広い画面は「全部」、狭い画面は「企画」から始める（選んだあとは、選んだものを覚える）
    deck.live=DECK_LIVE.includes(s.live)?s.live:matchMedia('(min-width:1100px)').matches?'all':'kikaku';
    deck.prep=DECK_PREP.includes(s.prep)?s.prep:'plan'
  }
  const deckCur=()=>deck.level==='prep'?deck.prep:deck.live;

  // ---- 上に残す部分の高さ（タブの位置と、移動先の計算に使う）
  const deckSideEl=E('deckSide'),deckNavEl=E('deckNav');
  const sideSticky=()=>getComputedStyle(deckSideEl).position==='sticky'&&matchMedia('(max-width:1099px)').matches;
  function deckMeasure(){
    document.body.style.setProperty('--side-h',(sideSticky()?deckSideEl.offsetHeight:0)+'px')
  }
  if('ResizeObserver' in window)new ResizeObserver(deckMeasure).observe(deckSideEl);
  window.addEventListener('resize',deckMeasure);
  // 上に残っているもの（録音中の小さな欄・映像と帯・タブ）の下端
  function deckStickyBottom(){
    const mini=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mini-h'))||0;
    return mini+(sideSticky()?deckSideEl.offsetHeight:0)+(getComputedStyle(deckNavEl).position==='sticky'?deckNavEl.offsetHeight:0)+8
  }
  function deckScrollTo(el){
    // 縦だけ動かす（scrollIntoView は横にも動かすことがある）
    window.scrollTo({top:Math.max(0,el.getBoundingClientRect().top+scrollY-deckStickyBottom()),behavior:'smooth'})
  }

  function deckApply(){
    const cur=deckCur(),b=document.body;
    b.dataset.level=deck.level;
    b.dataset.deck=cur;
    for(const x of deckNavEl.querySelectorAll('[data-deck]')){const on=x.dataset.deck===cur;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on))}
    for(const x of E('deckLevel').querySelectorAll('[data-level]')){const on=x.dataset.level===deck.level;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on))}
    if(cur==='tools'||cur==='all')deckMark('tools',false);
    lockView();
    deckMeasure()
  }
  // name のタブを開く。target があれば、その場所まで動かす（閉じた見出しの中なら開く）
  function deckShow(name,target){
    if(DECK_PREP.includes(name)){deck.level='prep';deck.prep=name}
    else if(DECK_LIVE.includes(name)){deck.level='live';if(deck.live!=='all'||name==='all'||!target)deck.live=name}
    else return;
    lsSet(DECK_KEY,JSON.stringify({live:deck.live,prep:deck.prep}));
    setMode(deck.level==='prep'?deck.prep:'live');
    deckApply();
    requestAnimationFrame(()=>{
      if(target){
        for(let d=target.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;
        deckScrollTo(target)
      }else{
        // タブを替えたとき、中身の先頭が上に隠れていたら、先頭が見える位置まで戻す
        const p=E('deckPanels');
        if(p.getBoundingClientRect().top<deckStickyBottom()-8)deckScrollTo(p)
      }
    })
  }
  // タブに「見てほしい」印を付ける（取り戻した動画があるとき など）
  function deckMark(name,on){deckNavEl.querySelector('[data-deck="'+name+'"]')?.classList.toggle('marked',!!on)}
  window.__otonohaDeck={show:deckShow,mark:deckMark,cur:deckCur,sideSticky};

  deckNavEl.addEventListener('click',e=>{const b=e.target.closest('[data-deck]');if(b)deckShow(b.dataset.deck)});
  E('deckLevel').addEventListener('click',e=>{
    const b=e.target.closest('[data-level]');
    if(b)deckShow(b.dataset.level==='prep'?deck.prep:deck.live)
  });

  // ---- 映像を上に残す（狭い画面の「本番」のとき）。手元の便利さだけなので、このブラウザに覚える
  function pvPinSet(on){
    document.body.toggleAttribute('data-pv-pin',on);
    const b=E('pvPin');
    b.setAttribute('aria-pressed',String(on));
    b.textContent=on?'📌 映像を上に残す：オン':'📌 映像を上に残す：オフ';
    deckMeasure()
  }
  pvPinSet(lsGet(PV_PIN_KEY)!=='0');
  E('pvPin').onclick=()=>{const on=!document.body.hasAttribute('data-pv-pin');pvPinSet(on);lsSet(PV_PIN_KEY,on?'1':'0')};

  // ---- 企画の準備：見出しの開け閉めを覚える（'*' はすべて開く）
  {
    let open=[];
    const raw=lsGet(PLAN_KEY);
    try{open=raw==='*'?'*':JSON.parse(raw||'[]')||[]}catch(_){}
    const groups=[...document.querySelectorAll('#studioPlan details.plan-group')];
    for(const d of groups){
      d.open=open==='*'||(Array.isArray(open)&&open.includes(d.dataset.pg));
      d.addEventListener('toggle',()=>{if(lsGet(PLAN_KEY)!=='*')lsSet(PLAN_KEY,JSON.stringify(groups.filter(x=>x.open).map(x=>x.dataset.pg)))})
    }
  }

  // ---- 置き場所が画面の種類で変わるもの
  const progRow=document.querySelector('.recbar .prog-row'),progHome=progRow.parentNode,progAfter=progRow.nextElementSibling;
  function deckPlace(app){
    // 番組の行：ラジオは録音バー、配信・動画は BGM の欄
    const slot=E('liveProgSlot'),edit=E('progEdit');
    if(app==='live'){
      if(progRow.parentNode!==slot)slot.appendChild(progRow);
      edit.hidden=false;edit.textContent='⚙ 番組の設定';
      edit.title='番組名・初期BGM・色・並び順など（フリーのときは選べません）'
    }else{
      if(progRow.parentNode!==progHome)progHome.insertBefore(progRow,progAfter);
      edit.hidden=true;edit.textContent='番組の設定'
    }
    // 場面のボタン：配信は帯（いつでも押せる）、動画は「収録・接続」
    const sw=document.querySelector('.scene-switch'),to=E(app==='live'&&streamMode()?'sceneSlotStrip':'sceneSlotPanel');
    if(sw.parentNode!==to)to.appendChild(sw)
  }
  {
    const prev=window.__otonohaAppChanged;
    window.__otonohaAppChanged=app=>{
      prev(app);
      deckPlace(app);
      deckApply()
    }
  }
