/* ===================== 番組プリセット ===================== */

const curProgram=()=>cfg.currentProgram>=0?cfg.programs?.[cfg.currentProgram]:null;

const isFree=()=>cfg.currentProgram<0;

function preloadProgBgm(){
  const pb=progBgm();
  if(pb&&db)setTimeout(()=>decodeAsset(pb.assetId,true).catch(()=>{}),300)
}

function progBgm(){
  const pr=curProgram();
  return pr?.bgmId?cfg.bgms.find(b=>b.id===pr.bgmId&&b.assetId):null
}

function renderPrograms(){
 
  const busy=rec.state!=='idle';
 
  $('#progEdit').disabled=isFree();
 
  $('#progChips').innerHTML=`<button class="prog-chip free ${isFree()?'active':''}" role="tab" aria-selected="${isFree()}" data-prog="-1" title="番組を使わずに録る（初期BGM・番組の画像なし）" ${busy&&!isFree()?'disabled':''}>フリー</button>`+cfg.programs.map((pr,i)=>`<button${progColorStyle(pr.color)} class="prog-chip ${progColorKey(pr.color)?'pc':''} ${i===cfg.currentProgram?'active':''}" role="tab" aria-selected="${i===cfg.currentProgram}" data-prog="${i}" ${busy&&i!==cfg.currentProgram?'disabled':''}>${esc(pr.name)}</button>`).join('');
 
  {
    const act=$('#progChips .prog-chip.active');
    if(act){
      const c=$('#progChips');
      const l=act.offsetLeft-c.offsetLeft,
        rgt=l+act.offsetWidth;
      if(l<c.scrollLeft||rgt>c.scrollLeft+c.clientWidth)c.scrollLeft=Math.max(0,l-8)
    }
  }
 
  const pb=progBgm(),
    box=$('#progBgm');
 
  box.innerHTML=pb?`<p class="prog-bgm-label">「${esc(curProgram().name)}」の初期BGM</p><div class="bgm-card ${bgmPlaying?.trackId===pb.id||bgmLoadingId===pb.id?'active':''}"><div class="bgm-row" style="grid-template-columns:minmax(0,1fr)"><button class="bgm-play" data-play-bgm="${esc(pb.id)}"><span class="bgm-icon">${bgmPlaying?.trackId===pb.id?'■':bgmLoadingId===pb.id?'…':'▶'}</span><span class="bgm-name">${esc(pb.name)}</span></button></div></div>`
  :isFree()?`<div class="empty">フリー収録中です。初期BGMと番組の画像は使いません。BGMを流すときは下の一覧から選べます。</div>`:`<div class="empty">「${esc(curProgram()?.name||'')}」の初期BGMは未設定です。番組ボタンを長押し（パソコンでは右クリック）すると選べます。</div>`;
 
  renderBgmNow();

}

$('#progChips').onclick=e=>{
  const c=e.target.closest('[data-prog]');
  if(!c||rec.state!=='idle')return;
  cfg.currentProgram=+c.dataset.prog;
  persist();
  renderPrograms();
  preloadProgBgm();
  toast(isFree()?'フリー収録に切り替えました（初期BGM・番組の画像なし）':'番組を「'+curProgram().name+'」に切り替えました')
};
// 番組ボタンの長押し・右クリックで、その番組の設定を開く（効果音ボタンと同じ操作）

{
  const box=$('#progChips');
  let lp=null,
    skip=false;
 
  const editProg=c=>{
    const i=+c.dataset.prog;
    if(i<0)return;
    if(i!==cfg.currentProgram){
      if(rec.state!=='idle')return;
      cfg.currentProgram=i;
      persist();
      renderPrograms();
      preloadProgBgm()
    }
    $('#progEdit').onclick()
  };
 
  box.addEventListener('contextmenu',e=>{
    const c=e.target.closest('[data-prog]');
    if(!c)return;
    e.preventDefault();
    editProg(c)
  });
 
  box.addEventListener('pointerdown',e=>{
    const c=e.target.closest('[data-prog]');
    if(!c||e.pointerType==='mouse'||c.dataset.prog==='-1')return;
    clearTimeout(lp);
    lp=setTimeout(()=>{
      skip=true;
      editProg(c)
    },550)
  });
 
  for(const ev of ['pointerup','pointercancel','pointerleave'])box.addEventListener(ev,()=>clearTimeout(lp));
 
  box.addEventListener('click',e=>{
    if(skip){
      skip=false;
      e.stopImmediatePropagation()
    }
  },true)
}

$('#progBgm').onclick=e=>{
  const pbtn=e.target.closest('[data-play-bgm]');
  if(!pbtn)return;
  const b=cfg.bgms.find(x=>x.id===pbtn.dataset.playBgm);
  if(b)playBgm(b)
};

$('#progEdit').onclick=async()=>{
  if(isFree())return;
 
  const pr=curProgram();
  $('#progName').value=pr.name;
  $('#progAuto').checked=!!pr.autoBgm;
 
  for(const rd of document.querySelectorAll('input[name=progColor]'))rd.checked=rd.value===progColorKey(pr.color);
 
  const list=cfg.bgms.filter(b=>b.assetId).sort((a,b)=>a.tabIndex-b.tabIndex||a.slotIndex-b.slotIndex);
 
  $('#progBgmSel').innerHTML='<option value="">なし</option>'+list.map(b=>`<option value="${esc(b.id)}">${esc(cfg.bgmTabs[b.tabIndex]+'｜'+b.name)}</option>`).join('');
 
  $('#progBgmSel').value=list.some(b=>b.id===pr.bgmId)?pr.bgmId:'';
 
  pcSel=-1;
  await renderProgCover();
  updateProgMoveBtns();
  openModal('progModal');

};
// 番組ごとの動画用サムネイル：7枠（保存名 cover:prog-<番組ID>-<0〜6>）。coverIdx が使う枠（-1は共通画像）

const PC_SLOTS=8;
let pcSel=-1,
  pcTarget=-1;

const progCoverKey=(pid,n)=>'prog-'+pid+'-'+n;

function activeProgCoverKey(pid){
  const pr=cfg.programs.find(x=>x.id===pid);
  if(!pr||!(pr.coverIdx>=0))return null;
  return progCoverKey(pid,pr.coverIdx)
}

async function migrateProgCovers(){
 // 第10〜13版の「1番組1枚」を1枠目へ移す
 
  for(const pr of cfg.programs){
    const old=await idbGet('assets','cover:prog-'+pr.id);
    if(!old)continue;
  
    if(!await idbGet('assets','cover:'+progCoverKey(pr.id,0)))await idbPut('assets','cover:'+progCoverKey(pr.id,0),old);
  
    await idbDel('assets','cover:prog-'+pr.id);
    if(!(pr.coverIdx>=0))pr.coverIdx=0
  }
 
  persist();

}

async function renderProgCover(){
 
  const pr=curProgram(),
    box=$('#progCovers');
  const cells=[];
 
  for(let n=0;n<PC_SLOTS;n++){
    const url=await coverUrl(progCoverKey(pr.id,n));
    cells.push(`<button type="button" class="pc-slot ${url?'set':''} ${pr.coverIdx===n&&url?'use':''}" data-pc="${n}" ${url?`style="background-image:url('${url}')"`:''} aria-label="${n+1}枚目${url?(pr.coverIdx===n?'（使用中）':''):'（空き・押して登録）'}"><span class="pc-n">${n+1}</span>${url?'':'＋'}</button>`)
  }
 
  box.innerHTML=cells.join('');
 
  const hasSel=pcSel>=0&&!!coverUrls.get(progCoverKey(pr.id,pcSel));
 
  $('#pcReplace').disabled=!hasSel;
  $('#pcRemove').disabled=!hasSel;
  $('#pcUseDefault').disabled=!(pr.coverIdx>=0);
 
  box.querySelectorAll('.pc-slot').forEach(b=>{
    if(+b.dataset.pc===pcSel)b.style.outline='2px dashed '+look.decor
  });

}

$('#progCovers').onclick=async e=>{
  const b=e.target.closest('[data-pc]');
  if(!b)return;
  const n=+b.dataset.pc,
    pr=curProgram();
 
  if(!coverUrls.get(progCoverKey(pr.id,n))){
    pcTarget=n;
    $('#progCoverFile').click();
    return
  }
 
  pcSel=n;
  pr.coverIdx=n;
  persist();
  await renderProgCover();
  renderTakes();
  toast(`${n+1}枚目の画像を動画に使います`)
};

$('#pcReplace').onclick=()=>{
  if(pcSel<0)return;
  pcTarget=pcSel;
  $('#progCoverFile').click()
};

$('#pcRemove').onclick=async e=>{
  if(pcSel<0||!armButton(e.currentTarget,'もう一度押すと外す'))return;
  const pr=curProgram();
  await setCover(progCoverKey(pr.id,pcSel),null);
  if(pr.coverIdx===pcSel){
    const next=[...Array(PC_SLOTS).keys()].find(n=>coverUrls.get(progCoverKey(pr.id,n)));
    pr.coverIdx=next??-1
  }
  pcSel=-1;
  persist();
  await renderProgCover();
  renderTakes()
};

$('#pcUseDefault').onclick=async()=>{
  curProgram().coverIdx=-1;
  pcSel=-1;
  persist();
  await renderProgCover();
  renderTakes();
  toast('この番組は共通の画像を使います')
};

$('#progCoverFile').onchange=async e=>{
  const f=e.target.files[0];
  e.target.value='';
  if(!f||pcTarget<0)return;
  const pr=curProgram(),
    n=pcTarget;
  pcTarget=-1;
 
  await setCover(progCoverKey(pr.id,n),f);
  pr.coverIdx=n;
  pcSel=n;
  persist();
  await renderProgCover();
  renderTakes()
};

function moveProgram(d){
  const i=cfg.currentProgram,
    j=i+d;
  if(i<0)return;
  if(j<0||j>=cfg.programs.length||rec.state!=='idle')return;
  [cfg.programs[i],cfg.programs[j]]=[cfg.programs[j],cfg.programs[i]];
  cfg.currentProgram=j;
  persist();
  renderPrograms();
  updateProgMoveBtns()
}

function updateProgMoveBtns(){
  $('#progMovePrev').disabled=cfg.currentProgram===0;
  $('#progMoveNext').disabled=cfg.currentProgram===cfg.programs.length-1
}

$('#progMovePrev').onclick=()=>moveProgram(-1);
$('#progMoveNext').onclick=()=>moveProgram(1);

$('#progColors').innerHTML='<label><input type="radio" name="progColor" value="">指定なし</label>'+PROG_COLOR_KEYS.map(k=>[k,LOOK_PRESETS[k]]).map(([k,v])=>`<label${progColorStyle(k)} class="pc"><input type="radio" name="progColor" value="${k}">${esc(v.name)}</label>`).join('');

$('#progForm').onsubmit=e=>{
  e.preventDefault();
  const pr=curProgram();
  pr.name=$('#progName').value.trim()||pr.name;
  pr.bgmId=$('#progBgmSel').value||null;
  pr.autoBgm=$('#progAuto').checked;
  setTimeout(preloadProgBgm,0);
  pr.color=document.querySelector('input[name=progColor]:checked')?.value||'';
  persist();
  closeModal('progModal');
  renderPrograms();
  toast('番組の設定を保存しました')
};
