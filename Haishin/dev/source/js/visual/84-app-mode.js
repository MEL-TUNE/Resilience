/* 配信・録画／ラジオの切り替え */

  window.__otonohaAppChanged=app=>{
    if(app==='radio'){studioLiveMode=false;applyMonitor()}
    else setMode(document.body.dataset.studioMode||'live')
  };
