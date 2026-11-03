/* 配信・録画／ラジオの切り替え */

  E('gotoFilm').onclick=()=>{E('navSettings').click();setTimeout(()=>E('filmTitle')?.scrollIntoView({block:'start'}),60)};
  window.__otonohaAppChanged=app=>{
    if(app==='radio'){studioLiveMode=false;applyMonitor()}
    else setMode(document.body.dataset.studioMode||'live');
    E('studioOutput').textContent=streamMode()?'配信用の映像ウインドウを開く':'映像だけ別窓';
    setMute(micMuted);
    renderScene()
  };

  E('pvToggle').onclick=()=>{const on=!document.body.hasAttribute('data-pv-on');document.body.toggleAttribute('data-pv-on',on);E('pvToggle').textContent=on?'プレビューを隠す':'プレビューも表示する'};
