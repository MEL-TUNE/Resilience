/* 企画卓：HTMLアプリを開き、立ち絵と並べる */

  const APP_MAX=12;
  let appWindow=null,appContext=null,appMirrorAt=0,appBlobUrl='',appBlobFor='';
  const appList=()=>Array.isArray(state.apps)?state.apps:(state.apps=[]);
  const appCur=()=>appList().find(a=>a.id===state.appSel)||null;
  const appWinOpen=()=>!!(appWindow&&!appWindow.closed);

  async function appSrc(a){
    if(a.kind==='url')return a.url;
    if(appBlobFor===a.id&&appBlobUrl)return appBlobUrl;
    const b=await getAsset('app:'+a.id);
    if(!b)throw Error('このアプリのファイルが見つかりません。もう一度登録してください');
    if(appBlobUrl)URL.revokeObjectURL(appBlobUrl);
    appBlobUrl=URL.createObjectURL(b instanceof Blob?new Blob([b],{type:'text/html'}):new Blob([String(b)],{type:'text/html'}));
    appBlobFor=a.id;
    return appBlobUrl
  }
  // ファイルのアプリは、既定ではこのページと同じ保存領域・マイクを使える形で開く（自作アプリの保存が動くように）。
  // 切ると sandbox で隔離する（アプリの保存は使えなくなる）
  function appFrameAttrs(f,a){
    f.setAttribute('allow','microphone; camera; autoplay; clipboard-read; clipboard-write; fullscreen');
    if(a.kind==='file'&&!a.store)f.setAttribute('sandbox','allow-scripts allow-forms allow-popups allow-modals allow-downloads');
    else f.removeAttribute('sandbox')
  }
  async function appShow(){
    const a=appCur(),f=E('appFrame'),wrap=E('appStageWrap');
    renderApps();
    if(!a){f.removeAttribute('src');wrap.hidden=true;return}
    wrap.hidden=false;
    if(appWinOpen()){f.removeAttribute('src');E('appAway').hidden=false;return}
    E('appAway').hidden=true;
    try{
      const src=await appSrc(a);
      appFrameAttrs(f,a);
      if(f.getAttribute('src')!==src)f.src=src
    }catch(e){toast(e.message||'アプリを開けませんでした',5000)}
  }
  function renderApps(){
    const box=E('appChips'),a=appCur();
    box.replaceChildren(...appList().map(x=>{
      const b=document.createElement('button');
      b.type='button';b.textContent=(x.kind==='url'?'🔗 ':'📄 ')+x.name;
      b.className=x.id===state.appSel?'selected':'';
      b.setAttribute('aria-pressed',x.id===state.appSel);
      b.onclick=()=>{state.appSel=x.id===state.appSel?'':x.id;save();appShow()};
      return b
    }));
    if(!appList().length)box.append(Object.assign(document.createElement('span'),{className:'studio-mini',textContent:'まだ登録がありません'}));
    E('appEdit').hidden=!a;
    if(a){
      E('appName').value=a.name;
      E('appStore').checked=a.kind==='url'||a.store!==false;
      E('appStore').disabled=a.kind==='url';
      E('appWhere').textContent=a.kind==='url'?a.url:'ファイル：'+(a.file||'')
    }
    E('appLayout').value=state.appLayout;E('appPos').value=state.appPos;E('appSize').value=state.appSize;
    E('appSizeVal').textContent=state.appSize+'%';
    E('appPos').disabled=state.appLayout==='side'&&false;
    E('appBgNote').hidden=state.appLayout!=='overlay'||state.bg==='transparent';
    E('appWinBtn').textContent=appWinOpen()?'アプリと立ち絵のウインドウを前に出す':'アプリと立ち絵を別ウインドウで開く（OBS用）'
  }
  E('appAddFile').onclick=()=>E('appFile').click();
  E('appFile').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';
    if(!file)return;
    if(appList().length>=APP_MAX){toast('登録できるアプリは'+APP_MAX+'個までです');return}
    if(!/\.html?$/i.test(file.name)&&file.type!=='text/html'){toast('HTMLファイル（.html）を選んでください');return}
    if(file.size>40*1024*1024){toast('40MBを超えるファイルは登録できません');return}
    const id=Math.random().toString(36).slice(2,10);
    try{await putAsset('app:'+id,new Blob([await file.arrayBuffer()],{type:'text/html'}))}catch(_){toast('保存できませんでした',4000);return}
    appList().push({id,kind:'file',name:file.name.replace(/\.html?$/i,'').slice(0,40)||'アプリ',file:file.name.slice(0,120),store:true});
    state.appSel=id;save();appShow();
    toast('アプリを登録しました',2500)
  };
  E('appAddUrl').onclick=()=>{
    const u=E('appUrl').value.trim();
    let url;
    try{url=new URL(u)}catch(_){toast('https:// から始まるURLを入れてください');return}
    if(!/^https?:$/.test(url.protocol)){toast('https:// から始まるURLを入れてください');return}
    if(appList().length>=APP_MAX){toast('登録できるアプリは'+APP_MAX+'個までです');return}
    const id=Math.random().toString(36).slice(2,10);
    appList().push({id,kind:'url',name:(url.pathname.split('/').filter(Boolean).pop()||url.hostname).replace(/\.html?$/i,'').slice(0,40),url:url.href.slice(0,2000)});
    E('appUrl').value='';state.appSel=id;save();appShow();
    toast('URLを登録しました。表示されないときは、そのサイトが他のページの中での表示を許可していません',6000)
  };
  E('appName').oninput=e=>{const a=appCur();if(a){a.name=e.target.value.slice(0,40)||'アプリ';save();renderApps()}};
  E('appStore').onchange=e=>{const a=appCur();if(a&&a.kind==='file'){a.store=e.target.checked;save();E('appFrame').removeAttribute('src');appShow()}};
  E('appReload').onclick=()=>{const f=E('appFrame');const s=f.getAttribute('src');if(s){f.removeAttribute('src');setTimeout(()=>{f.src=s},30)}};
  E('appDel').onclick=e=>armed(e.currentTarget,'もう一度押すと登録を外す',async()=>{
    const a=appCur();if(!a)return;
    if(a.kind==='file')await deleteAsset('app:'+a.id);
    state.apps=appList().filter(x=>x!==a);state.appSel='';save();
    if(appBlobFor===a.id&&appBlobUrl){URL.revokeObjectURL(appBlobUrl);appBlobUrl='';appBlobFor=''}
    if(appWinOpen())appWindow.close();
    appShow()
  });
  for(const [id,key] of [['appLayout','appLayout'],['appPos','appPos']])E(id).onchange=e=>{state[key]=e.target.value;save();renderApps();appLayoutWin()};
  E('appSize').oninput=e=>{state.appSize=Math.max(15,Math.min(70,Number(e.target.value)||35));E('appSizeVal').textContent=state.appSize+'%';save();appLayoutWin()};

  // 別ウインドウ：アプリを全面に、立ち絵の映像（背景を含む配信画面と同じ絵）を重ねるか横に並べる
  function appLayoutWin(){
    if(!appWinOpen())return;
    const d=appWindow.document,c=d.getElementById('pt'),f=d.getElementById('app');
    if(!c||!f)return;
    const s=state.appSize,side=state.appLayout==='side',p=state.appPos;
    d.body.className=side?'side '+(p.endsWith('l')?'left':'right'):'overlay';
    c.style.width=s+'%';c.style.aspectRatio=W+' / '+H;
    c.style.left=c.style.right=c.style.top=c.style.bottom='';
    if(!side){c.style[p.endsWith('l')?'left':'right']='0';c.style[p.startsWith('t')?'top':'bottom']='0'}
  }
  E('appWinBtn').onclick=async()=>{
    if(appWinOpen()){appWindow.focus();return}
    const a=appCur();
    if(!a){toast('先にアプリを選んでください');return}
    let src;
    try{src=await appSrc(a)}catch(e){toast(e.message,5000);return}
    appWindow=window.open('','otonoha-app','popup=yes,width=1280,height=720');
    if(!appWindow){toast('別窓を開くにはポップアップを許可してください',5000);return}
    const d=appWindow.document;
    d.open();
    d.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>オトノハ｜アプリと立ち絵</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{border:0;display:block}body.overlay iframe{position:absolute;inset:0;width:100%;height:100%}body.overlay canvas{position:absolute;pointer-events:none}body.side{display:flex;align-items:center}body.side.left{flex-direction:row-reverse}body.side iframe{flex:1;height:100%}body.side canvas{flex:none;height:auto}canvas{display:block}</style></head><body><iframe id="app"></iframe><canvas id="pt"></canvas></body></html>');
    d.close();
    const f=d.getElementById('app');
    appFrameAttrs(f,a);
    f.src=src;
    appContext=d.getElementById('pt').getContext('2d');
    appLayoutWin();
    E('appFrame').removeAttribute('src');
    appWindow.addEventListener('pagehide',()=>setTimeout(()=>{if(!appWinOpen()){appContext=null;appShow()}},100));
    appShow()
  };
  setInterval(()=>{if(appWindow&&appWindow.closed){appWindow=null;appContext=null;appShow()}},1000);

  // 毎フレーム：別ウインドウへは配信画面と同じ絵を、ページ内の小窓へは約8fpsで写す
  function appCopy(now){
    if(appContext&&appWinOpen()){
      try{
        const c=appContext.canvas;
        if(c.width!==W||c.height!==H){c.width=W;c.height=H}
        appContext.clearRect(0,0,W,H);appContext.drawImage(canvas,0,0)
      }catch(_){appContext=null}
    }
    const m=E('appMirror');
    if(!m||E('appStageWrap').hidden||now-appMirrorAt<120)return;
    const r=m.getBoundingClientRect();
    if(!r.width||r.bottom<0||r.top>innerHeight)return;
    appMirrorAt=now;
    const pw=W>H?480:270,ph=W>H?270:480;
    if(m.width!==pw||m.height!==ph){m.width=pw;m.height=ph}
    const cx=m.getContext('2d');cx.clearRect(0,0,pw,ph);cx.drawImage(canvas,0,0,pw,ph)
  }
