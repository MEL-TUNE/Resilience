/* 0.9.8：①番組の切り替えと「番組の設定」を、配信・動画でも出す（0.5.0 から録音バーごと隠れていた）。0.9.9 から置き場所は音のお品書きの BGM 欄の1か所
   ②企画卓を見出しごとの色付きのまとまりに分ける ③上に固定の目次（移動ボタン）を付ける */

  // ---- ① 番組の行（#progChips・#progEdit）を、配信・動画では BGM 欄（#liveProgSlot）へ移す。要素ごと動かすので、ボタンの働きはそのまま
  const progRow=document.querySelector('.recbar .prog-row'),progHome=progRow&&progRow.parentNode,progAfter=progRow&&progRow.nextElementSibling;
  function progPlace(app){
    const slot=E('liveProgSlot');
    if(!progRow||!slot)return;
    if(app==='live'){
      if(progRow.parentNode!==slot)slot.appendChild(progRow);
      E('progEdit').hidden=false;
      E('progEdit').textContent='⚙ 番組の設定';
      E('progEdit').title='番組名・初期BGM・色・並び順など（フリーのときは選べません）'
    }else{
      if(progRow.parentNode!==progHome)progHome.insertBefore(progRow,progAfter);
      E('progEdit').hidden=true;
      E('progEdit').textContent='番組の設定'
    }
  }

  // ---- ② 企画卓を、見出しごとのまとまりに分ける（中身は移すだけで、消さない）
  function planGroup(nodes,title,id){
    if(!nodes.length)return null;
    const g=document.createElement('div');
    g.className='plan-group';
    if(id)g.id=id;
    nodes[0].parentNode.insertBefore(g,nodes[0]);
    if(title){const h=document.createElement('h3');h.textContent=title;g.appendChild(h)}
    for(const n of nodes)g.appendChild(n);
    return g
  }
  (function planWrap(){
    const sec=E('studioPlan');
    if(!sec||sec.dataset.grouped)return;
    sec.dataset.grouped='1';
    // 企画タイトル〜台本の注記まで → 「番組・企画の設定」
    const kids=[...sec.children],h2=sec.querySelector(':scope>h2'),firstDock=kids.find(n=>n.classList.contains('app-dock'));
    const head=[];
    for(let n=h2&&h2.nextElementSibling;n&&n!==firstDock;n=n.nextElementSibling)head.push(n);
    planGroup(head,'番組・企画の設定（企画タイトル・AIに渡す設定・台本）','planGroupProg');
    // セリフ帳・スロット・お題帳・ルーレット：h3 ごとに分ける
    const play=sec.querySelector('.play-dock');
    if(play){
      let cur=[];const groups=[];
      for(const n of [...play.children]){
        if(n.tagName==='H3'&&cur.length){groups.push(cur);cur=[]}
        cur.push(n)
      }
      if(cur.length)groups.push(cur);
      for(const g of groups)planGroup(g,'',null);
    }
    for(const d of sec.querySelectorAll(':scope>.app-dock:not(.play-dock)'))d.classList.add('plan-group');
    sec.classList.add('plan-grouped')
  })();

  // ---- ③ 目次：ステージ・音のお品書き・BGM と、いま開いている画面の見出しへ移動する
  const jump=document.createElement('nav');
  jump.className='jump-bar';jump.id='jumpBar';jump.setAttribute('aria-label','この画面の目次');
  document.querySelector('.studio-tabs')?.after(jump);
  const jumpTargets=[];
  function jumpShort(t){return t.replace(/\s+/g,' ').replace(/（.*$/,'').replace(/^[①-⑳]\s*/,'').trim().slice(0,14)}
  function renderJump(){
    const mode=document.body.dataset.studioMode||'live';
    jumpTargets.length=0;
    const add=(label,el,cls)=>{if(el)jumpTargets.push({label,el,cls:cls||''})};
    add('🎬 映像',document.querySelector('.stage-card'),'j-stage');
    add('🎲 企画',E('ponBar'),'j-stage');
    add('🔊 音のお品書き',E('boardShell'),'j-board');
    const bgm=[...document.querySelectorAll('#boardShell h2')].find(h=>/^BGM/.test(h.textContent.trim()));
    add('♪ BGM',bgm&&bgm.closest('section'),'j-board');
    const sec={plan:'studioPlan',songs:'studioSongs',aivoice:'studioAiVoice'}[mode];
    const box=sec&&E(sec);
    if(box)for(const h of box.querySelectorAll('h3')){
      if(!h.offsetParent&&!h.closest('.plan-group'))continue;
      if(h.closest('details:not([open])'))continue;
      const t=jumpShort(h.textContent);
      if(t)add(t,h.closest('.plan-group')||h)
    }
    jump.innerHTML=jumpTargets.map((x,i)=>`<button type="button" class="${x.cls}" data-jump="${i}">${esc(x.label)}</button>`).join('')
  }
  jump.onclick=e=>{
    const b=e.target.closest('[data-jump]');
    const x=b&&jumpTargets[+b.dataset.jump];
    if(!x)return;
    // scrollIntoView は横にも動かすことがあるので、縦だけ動かす（目次の高さぶん下げる）
    // 0.9.10：プレビューが上に残っているときは、その下に出るようにする（隠れないように）
    const pv=E('stagePreview');
    const pinned=pv&&x.el!==pv&&!pv.contains(x.el)&&getComputedStyle(pv).position==='sticky'&&pv.compareDocumentPosition(x.el)&Node.DOCUMENT_POSITION_FOLLOWING&&pv.closest('.stage-card').contains(x.el);
    const off=jump.getBoundingClientRect().height+(pinned?pv.getBoundingClientRect().height:0)+12;
    window.scrollTo({top:Math.max(0,x.el.getBoundingClientRect().top+scrollY-off),behavior:'smooth'})
  };
  document.querySelectorAll('.studio-tabs [data-mode]').forEach(b=>b.addEventListener('click',()=>setTimeout(renderJump,0)));

  // ---- 0.9.9：プレビューを上に固定（ステージの画面のとき）。手元の便利さだけなので、このブラウザに覚える
  const PV_PIN_KEY='otonoha-pv-pin';
  function pvPinSet(on){
    document.body.toggleAttribute('data-pv-pin',on);
    const b=E('pvPin');if(b){b.setAttribute('aria-pressed',on);b.textContent=on?'📌 上に固定：オン':'📌 上に固定：オフ'}
  }
  {let on=true;try{on=localStorage.getItem(PV_PIN_KEY)!=='0'}catch(_){}pvPinSet(on)}
  E('pvPin').onclick=()=>{const on=!document.body.hasAttribute('data-pv-pin');pvPinSet(on);try{localStorage.setItem(PV_PIN_KEY,on?'1':'0')}catch(_){}};
  const jumpH=()=>document.body.style.setProperty('--jump-h',(jump.offsetHeight||48)+'px');
  window.addEventListener('resize',jumpH);

  {
    const prev=window.__otonohaAppChanged;
    window.__otonohaAppChanged=app=>{
      prev(app);
      progPlace(app);
      renderJump();
      jumpH()
    }
  }
