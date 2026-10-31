/* 画面の切り替え（収録画面／音量・マイクの設定） */

function clearPageHash(){
  if(location.hash!=='#settings')return;

  try{
    history.replaceState(null,'',location.href.split('#')[0]);
    return
  }catch(_){}

  try{
    history.replaceState(null,'','#');
    return
  }catch(_){}

  pageOverride='main';
}

let pageOverride=null;

function applyPage(){
  const pg=pageOverride||(location.hash==='#settings'?'settings':'main');
  pageOverride=null;
  if(pg==='settings')stopFilmPreview();
  document.body.dataset.page=pg;
  document.querySelectorAll('[data-app]').forEach(b=>b.classList.toggle('on',pg==='main'&&b.dataset.app===document.body.dataset.app&&(!b.dataset.kind||b.dataset.kind===document.body.dataset.kind)));
  $('#navSettings').classList.toggle('on',pg==='settings');
  window.scrollTo(0,0)
}

const APP_KEY=(typeof OTONOHA_NS==='string'?OTONOHA_NS:'')+'otonoha_app';
function setApp(app,kind){
  if(app==='live'&&kind!=='stream'&&kind!=='video')kind=document.body.dataset.kind||'stream';
  app=app==='radio'?'radio':'live';
  document.body.dataset.app=app;
  if(app==='live')document.body.dataset.kind=kind;
  try{localStorage.setItem(APP_KEY,app==='radio'?'radio':kind)}catch(_){}
  if(ctx)updateGains();
  window.__otonohaAppChanged?.(app)
}
function savedApp(){
  let v='';
  try{v=localStorage.getItem(APP_KEY)||''}catch(_){}
  if(v==='radio')return ['radio'];
  if(v==='stream'||v==='video')return ['live',v];
  return ['live',matchMedia('(pointer:coarse)').matches?'video':'stream']
}
document.body.dataset.kind=savedApp()[1]||'stream';
setApp(...savedApp());
document.addEventListener('click',e=>{
  const ab=e.target.closest('[data-app]');
  if(ab)setApp(ab.dataset.app,ab.dataset.kind);
  const b=e.target.closest('[data-goto]');
  if(!b)return;
  const pg=b.dataset.goto;
  if(pg==='settings'){
    if(location.hash!=='#settings')location.hash='settings'
  }else{
    if(location.hash==='#settings')clearPageHash();
    applyPage()
  }
});

window.addEventListener('hashchange',applyPage);
applyPage();

$('#trySe').onclick=()=>{
  const s=cfg.sounds.find(x=>x.type==='emoji'&&x.assetId&&x.tabIndex===emojiTab)||cfg.sounds.find(x=>x.type!=='voice'&&x.assetId);
  if(s)playSound(s);else toast('登録済みの効果音がありません')
};

$('#tryVo').onclick=()=>{
  const s=cfg.sounds.find(x=>x.type==='voice'&&x.assetId);
  if(s)playSound(s);else toast('登録済みのボイスがありません')
};

$('#tryBgm').onclick=()=>{
  if(bgmPlaying||bgmLoadingId){
    bgmSerial++;
    bgmPendingId=null;
    bgmLoadingId=null;
    if(bgmPlaying)fadeStop(bgmPlaying,.4);
    renderBgmNow();
    return
  }
  const b=progBgm()||cfg.bgms.find(x=>x.assetId);
  if(b)playBgm(b);else toast('登録済みのBGMがありません')
};
