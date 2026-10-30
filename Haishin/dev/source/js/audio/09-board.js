/* ===================== 画面描画（ポン出し） ===================== */

function renderVolumes(){
 
  $('#masterVolume').value=cfg.master;
  $('#masterVal').textContent=cfg.master+'%';
 
  for(const [name,key] of [['se','seDb'],['bgm','bgmDb'],['vo','voDb'],['env','envDb']]){
    $('#'+name+'Volume').value=cfg[key];
    $('#'+name+'Val').textContent=fmtDb(cfg[key])
  }
 
  $('#bgmLevel').checked=cfg.rec.bgmLevel!==false;
 
  const r=cfg.rec;
  $('#micVolume').value=r.micVolume;
  $('#micVal').textContent=r.micVolume+'%';
 
  $('#duckDepth').value=r.duckDepth;
  $('#duckDepthVal').textContent='-'+r.duckDepth+'dB';
  $('#duckThresh').value=r.duckThresh;
  $('#duckThreshVal').textContent=r.duckThresh+'dB';
 
  for(const [sel,key] of [['#optEc','ec'],['#optNs','ns'],['#optAgc','agc'],['#optMon','monitor'],['#optLimiter','limiter'],['#duckOn','duck'],['#keepVoice','keepVoice'],['#keepProg','keepProg'],['#optNormalize','normalize']])$(sel).checked=!!r[key];
 
  $('#mp3Rate').value=String(r.mp3Rate);
  $('#previewFull').checked=r.previewFull!==false;
  $('#monitorMode').value=r.monitorMode||'auto';
  $('#bgmLowLevel').value=r.bgmLowLevel;
  $('#bgmLowVal').textContent=r.bgmLowLevel+'%';
  $('#fadeSec').value=String(r.fadeSec);
  $('#fadeOnStop').checked=!!r.fadeOnStop;
  $('#coverFit').value=r.coverFit;
  $('#videoSize').value=String(r.videoSize);
  if(typeof renderBgmLow==='function'&&$('#bgmLowBtn'))renderBgmLow();
  $('#playMode').value=cfg.playMode;
  renderDuck();

}

function render(){
  if(cfg?.programs&&document.getElementById('progChips'))queueMicrotask(renderPrograms);
 
  $('#emojiTabs').innerHTML=cfg.emojiTabs.map((name,i)=>`<button class="chip ${i===emojiTab?'active':''}" data-emoji-tab="${i}">${esc(name)}</button>`).join('');
 
  $('#textTabs').innerHTML=cfg.textTabs.map((name,i)=>`<button class="chip ${i===textTab?'active':''}" data-text-tab="${i}">${esc(name)}</button>`).join('');
 
  for(const type of ['emoji','text','env']){
  
    const list=cfg.sounds.filter(s=>s.type===type&&s.tabIndex===(type==='text'?textTab:emojiTab)).sort((a,b)=>a.order-b.order);
  
    $('#'+type+'Grid').innerHTML=list.map(s=>`<button class="${type==='env'?'text-pad env-pad':type+'-pad'} ${s.assetId?'loaded':''} ${[...active].some(a=>a.soundId===s.id)?'playing':''}" data-sound="${esc(s.id)}" title="${esc(s.assetId?s.fileName+' · 長押しで編集':'空き枠 · 押して設定')}" aria-label="${esc(s.assetId?s.label||'効果音':'空き枠、押して設定')}">${s.assetId?esc(s.label||'♪'):''}${s.assetId&&s.shortcut?`<span class="shortcut">${esc(s.shortcut)}</span>`:''}</button>`).join('');
 
  }
 
  {
    const list=cfg.sounds.filter(s=>s.type==='voice').sort((a,b)=>a.order-b.order);
  
    $('#voiceGrid').innerHTML=list.map(s=>{
      const loaded=!!s.assetId,
        img=s.imageId?imgUrl(s.imageId):null;
      return `<button class="voice-pad ${loaded||s.imageId?'loaded':''} ${[...active].some(a=>a.soundId===s.id)?'playing':''}" data-sound="${esc(s.id)}" ${img?`style="background-image:url('${img}')"`:''} title="${esc(loaded?(s.label||s.fileName)+' · 長押しで編集':'空き枠 · 押して設定')}" aria-label="${esc(loaded?(s.label||'ボイス'):'空き枠、押して設定')}">${!img&&(loaded||s.label)?`<span class="vp-noimg">${esc(s.label||'♪')}</span>`:''}${img&&s.label?`<span class="vp-name">${esc(s.label)}</span>`:''}${loaded&&s.shortcut?`<span class="shortcut">${esc(s.shortcut)}</span>`:''}</button>`
    }).join('');
  }
 
  $('#bgmTabs').innerHTML=cfg.bgmTabs.map((name,i)=>`<button class="chip ${i===bgmTab?'active':''}" data-bgm-tab="${i}">${esc(name)}</button>`).join('');
 
  $('#bgmList').innerHTML=cfg.bgms.filter(b=>b.tabIndex===bgmTab).sort((a,b)=>a.slotIndex-b.slotIndex).map(b=>{
    const on=bgmPlaying?.trackId===b.id,
      load=bgmLoadingId===b.id;
    return `<button class="bgm-tile ${b.assetId?'':'unset'} ${on||load?'active':''}" data-play-bgm="${esc(b.id)}" title="${esc(b.assetId?(b.fileName||b.name)+' · 長押し・右クリックで編集':'空き枠 · 押して登録')}" aria-label="${esc(b.assetId?b.name:'空きBGM枠、押して登録')}"><span class="bt-ic">${b.assetId?(on?'■':load?'…':'▶'):'＋'}</span><span class="bt-name">${b.assetId?esc(b.name):''}</span></button>`
  }).join('');

}

function save(){
  growSe();
  persist();
  render()
}

const imgUrls=new Map(),
  imgLoading=new Set();

function imgUrl(id){
  if(imgUrls.has(id))return imgUrls.get(id);
  if(!imgLoading.has(id)&&db){
    imgLoading.add(id);
    getAsset(id).then(async b=>{
      imgUrls.set(id,b?await thumbUrl(b,256):null);
      imgLoading.delete(id);
      render()
    }).catch(()=>imgLoading.delete(id))
  }
  return null
}

function openSound(s,type){
  const del=$('#deleteSound');
  clearTimeout(del._armTimer);
  del.dataset.armed='';
  del.classList.remove('armed');
  del.textContent='削除';
  $('#soundForm').reset();
  $('#soundId').value=s?.id||'';
  $('#soundType').value=type;
  $('#soundHeading').textContent=type==='voice'?'ボイスの編集':type==='env'?'環境音の編集':s?'効果音の編集':'効果音を追加';
  const configured=!!(s?.assetId||s?.configured);
  $('#labelInput').value=configured?s.label||'':'';
  $('#labelInput').maxLength=type==='emoji'?12:20;
  $('#labelInput').required=type!=='voice';
  $('#labelCaption').textContent=type==='emoji'?'ボタン名（絵文字1文字）':type==='env'?'ボタン名（最大6文字）':type==='voice'?'ボタン名（なくても可・12文字まで）':'ボタン名（最大3文字）';
  $('#labelHelp').textContent=type==='emoji'?'絵文字1文字を指定します。':type==='env'?'押すとループ再生、もう一度押すと止まります。':type==='voice'?'画像の下に小さく表示されます。画像がないときはボタンに文字で表示します。':'絵文字も1文字として数えます。';
  $('#imageField').hidden=type!=='voice';
  $('#imageFile').value='';
  $('#currentImage').textContent=s?.imageId?(s.imageName||'登録済み'):'画像未登録';
  $('#soundVol').previousElementSibling.firstChild.textContent=type==='voice'?'このボイスの音量：':type==='env'?'この環境音の音量：':'この効果音の音量：';
  const volume=configured?s.volume??100:100;
  $('#soundVol').value=volume;
  $('#soundVolVal').textContent=volume+'%';
  $('#shortcutInput').value=configured?s.shortcut||'':'';
  $('#currentSoundFile').textContent=s?.fileName||'音源未登録';
  $('#soundFile').value='';
  $('#deleteSound').hidden=!s;
  $('#movePrev').disabled=!s;
  $('#moveNext').disabled=!s;
  openModal('soundModal')
}

function openBgm(b){
  if(!b)return;
  {
    const rb=$('#resetBgm');
    clearTimeout(rb._armTimer);
    rb.dataset.armed='';
    rb.classList.remove('armed');
    rb.textContent='選択リセット'
  }
  $('#bgmForm').reset();
  $('#bgmId').value=b.id;
  $('#bgmHeading').textContent=b.assetId||b.name?'BGMの編集':'BGMを登録';
  $('#bgmNameInput').value=b.name||'';
  $('#currentBgmFile').textContent=b.fileName||'音源未登録';
  $('#bgmVolModal').value=b.volume??100;
  $('#bgmVolModalVal').textContent=(b.volume??100)+'%';
  $('#resetBgm').disabled=!b.assetId&&!b.name;
  $('#bgmMovePrev').disabled=b.slotIndex===0;
  $('#bgmMoveNext').disabled=b.slotIndex===BGM_SLOTS-1;
  openModal('bgmModal')
}
// コピー：使える方法から順に試し、どれもだめなら画面に出して手で選べるようにする

async function copyText(text){
 
  if(!text){
    toast('コピーする記録がありません');
    return
  }
 
  try{
    await navigator.clipboard.writeText(text);
    toast('記録をコピーしました');
    return
  }catch(_){}
 
  try{
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    const ok=document.execCommand('copy');
    ta.remove();
    if(ok){
      toast('記録をコピーしました');
      return
    }
  }catch(_){}
 
  askConfirm(text,'閉じる','この画面ではコピーできないため、下の記録を選んでコピーしてください');

}

function armButton(btn,label='もう一度押すと削除'){
 
  if(btn.dataset.armed==='1'){
    clearTimeout(btn._armTimer);
    btn.dataset.armed='';
    btn.classList.remove('armed');
    return true
  }
 
  btn.dataset.armed='1';
  btn.dataset.orig=btn.textContent;
  btn.textContent=label;
  btn.classList.add('armed');
 
  btn._armTimer=setTimeout(()=>{
    btn.dataset.armed='';
    btn.textContent=btn.dataset.orig;
    btn.classList.remove('armed')
  },4000);
  return false;

}

let confirmResolve=null;

function askConfirm(text,yesLabel='削除する',title='確認'){
 
  if(confirmResolve)confirmResolve(false);
 
  $('#confirmTitle').textContent=title;
  $('#confirmText').textContent=text;
  $('#confirmYes').textContent=yesLabel;
  openModal('confirmModal');
  setTimeout(()=>$('#confirmNo').focus(),0);
 
  return new Promise(resolve=>{
    confirmResolve=resolve
  });

}

function closeConfirm(ok){
  closeModal('confirmModal');
  const f=confirmResolve;
  confirmResolve=null;
  f?.(ok)
}

$('#confirmYes').onclick=()=>closeConfirm(true);
$('#confirmNo').onclick=()=>closeConfirm(false);

$('#confirmModal').addEventListener('click',e=>{
  if(e.target.id==='confirmModal')closeConfirm(false)
});

const modalFocus=new Map();

function openModal(id){
  const back=$('#'+id),
    dialog=back.querySelector('.modal');
  modalFocus.set(id,document.activeElement);
  dialog.setAttribute('role',id==='confirmModal'?'alertdialog':'dialog');
  dialog.setAttribute('aria-modal','true');
  const title=dialog.querySelector('h2');
  if(title){
    title.id||=id+'Title';
    dialog.setAttribute('aria-labelledby',title.id)
  }
  back.classList.add('open');
  (dialog.querySelector('input:not([type=hidden]),select,button')||dialog).focus()
}

function closeModal(id){
  $('#'+id).classList.remove('open');
  modalFocus.get(id)?.focus();
  modalFocus.delete(id)
}

document.addEventListener('keydown',e=>{
  const back=[...document.querySelectorAll('.modal-back.open')].at(-1);
  if(!back)return;
  if(e.key==='Escape'){
    e.preventDefault();
    if(back.id==='confirmModal')closeConfirm(false);else closeModal(back.id)
  }
  if(e.key==='Tab'){
    const nodes=[...back.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length);
    if(!nodes.length)return;
    const first=nodes[0],
      last=nodes.at(-1);
    if(e.shiftKey&&document.activeElement===first){
      e.preventDefault();
      last.focus()
    }else if(!e.shiftKey&&document.activeElement===last){
      e.preventDefault();
      first.focus()
    }
  }
});

let longPress=null,
  ignoreClickId=null;

function setupGrid(type){
  const g=$('#'+type+'Grid');
  g.addEventListener('click',e=>{
    const b=e.target.closest('[data-sound]');
    if(!b)return;
    if(ignoreClickId===b.dataset.sound){
      ignoreClickId=null;
      return
    }
    const s=cfg.sounds.find(x=>x.id===b.dataset.sound);
    if(s){
      if(s.assetId)playSound(s);else openSound(s,type)
    }
  });
 
  g.addEventListener('contextmenu',e=>{
    const b=e.target.closest('[data-sound]');
    if(!b)return;
    e.preventDefault();
    const s=cfg.sounds.find(x=>x.id===b.dataset.sound);
    if(s)openSound(s,type)
  });
 
  g.addEventListener('pointerdown',e=>{
    const b=e.target.closest('[data-sound]');
    if(!b||e.pointerType==='mouse')return;
    clearTimeout(longPress);
    longPress=setTimeout(()=>{
      ignoreClickId=b.dataset.sound;
      openSound(cfg.sounds.find(x=>x.id===b.dataset.sound),type)
    },550)
  });
 
  for(const ev of ['pointerup','pointercancel','pointerleave'])g.addEventListener(ev,()=>clearTimeout(longPress));

}

setupGrid('emoji');
setupGrid('text');
setupGrid('voice');
setupGrid('env');

$('#emojiTabs').onclick=e=>{
  const tab=e.target.closest('[data-emoji-tab]');
  if(tab){
    emojiTab=+tab.dataset.emojiTab;
    render()
  }
};

$('#textTabs').onclick=e=>{
  const tab=e.target.closest('[data-text-tab]');
  if(tab){
    textTab=+tab.dataset.textTab;
    render()
  }
};

$('#bgmTabs').onclick=e=>{
  const tab=e.target.closest('[data-bgm-tab]');
  if(tab){
    bgmTab=+tab.dataset.bgmTab;
    render()
  }
};
// タブ名の編集と並べ替え（↑↓で行を動かし、保存するとタブの中身ごと順番が入れ替わる）

function tabEditor(kind,label){
 
  const k=kind.toLowerCase(),
    key=k+'Tabs',
    box=$('#'+k+'TabNames');
 
  const syncBtns=()=>{
    const rows=[...box.children];
    rows.forEach((row,i)=>{
      row.querySelector('[data-up]').disabled=i===0;
      row.querySelector('[data-down]').disabled=i===rows.length-1;
      row.querySelector('input').setAttribute('aria-label',(i+1)+'番目の'+label+'分類名')
    })
  };
 
  $('#edit'+kind+'Tabs').onclick=()=>{
  
    box.replaceChildren(...cfg[key].map((name,i)=>{
      const row=document.createElement('div');
      row.className='category-line';
      row.dataset.orig=i;
   
      const input=document.createElement('input');
      input.value=name;
      input.maxLength=20;
   
      const up=document.createElement('button');
      up.type='button';
      up.className='btn tab-move';
      up.dataset.up='1';
      up.textContent='↑';
      up.setAttribute('aria-label','上へ');
   
      const down=document.createElement('button');
      down.type='button';
      down.className='btn tab-move';
      down.dataset.down='1';
      down.textContent='↓';
      down.setAttribute('aria-label','下へ');
   
      row.append(input,up,down);
      return row
    }));
  
    syncBtns();
    openModal(k+'TabsModal');
 
  };
 
  box.onclick=e=>{
    const btn=e.target.closest('.tab-move');
    if(!btn)return;
    const row=btn.closest('.category-line');
  
    if(btn.dataset.up&&row.previousElementSibling)box.insertBefore(row,row.previousElementSibling);
  else if(btn.dataset.down&&row.nextElementSibling)box.insertBefore(row.nextElementSibling,row);
  
    syncBtns();
    row.classList.remove('moved');
    void row.offsetWidth;
    row.classList.add('moved');
    row.scrollIntoView({block:'nearest'})
  };
 
  $('#'+k+'TabsForm').onsubmit=e=>{
    e.preventDefault();
  
    const rows=[...box.children],
      names=rows.map(r=>r.querySelector('input').value.trim()),
      order=rows.map(r=>+r.dataset.orig);
  
    if(names.length!==TABS||names.some(x=>!x)||new Set(names).size!==TABS){
      toast('分類名は空欄や重複を避けてください');
      return
    }
  
    const newIndex=new Map(order.map((orig,pos)=>[orig,pos]));
  
    const items=kind==='Bgm'?cfg.bgms:cfg.sounds.filter(x=>x.type===(kind==='Emoji'?'emoji':'text'));
  
    for(const x of items)if(newIndex.has(x.tabIndex))x.tabIndex=newIndex.get(x.tabIndex);
  
    if(kind==='Emoji')emojiTab=newIndex.get(emojiTab)??0;else if(kind==='Text')textTab=newIndex.get(textTab)??0;else bgmTab=newIndex.get(bgmTab)??0;
  
    const moved=order.some((o,i)=>o!==i);
    cfg[key]=names;
    save();
    closeModal(k+'TabsModal');
    toast(label+(moved?'のタブの名前と順番を保存しました':'の分類名を保存しました'))
  };

}

tabEditor('Emoji','絵文字SE');
tabEditor('Text','文字SE');
tabEditor('Bgm','BGM');

$('#bgmList').onclick=e=>{
  const edit=e.target.closest('[data-edit-bgm]'),
    reset=e.target.closest('[data-reset-bgm]'),
    play=e.target.closest('[data-play-bgm]');
  if(edit){
    openBgm(cfg.bgms.find(b=>b.id===edit.dataset.editBgm));
    return
  }
  if(reset){
    resetBgm(reset.dataset.resetBgm);
    return
  }
  if(play){
    const b=cfg.bgms.find(x=>x.id===play.dataset.playBgm);
    if(b){
      if(b.assetId)playBgm(b);else openBgm(b)
    }
  }
};

function moveBgm(direction){
  const b=cfg.bgms.find(x=>x.id===$('#bgmId').value);
  if(!b)return;
  const target=b.slotIndex+direction,
    other=cfg.bgms.find(x=>x.tabIndex===b.tabIndex&&x.slotIndex===target);
  if(!other)return;
  [b.slotIndex,other.slotIndex]=[other.slotIndex,b.slotIndex];
  persist();
  render();
  $('#bgmMovePrev').disabled=b.slotIndex===0;
  $('#bgmMoveNext').disabled=b.slotIndex===BGM_SLOTS-1
}

{
  const g=$('#bgmList');
  let lp=null,
    skip=null;
 
  g.addEventListener('contextmenu',e=>{
    const t=e.target.closest('[data-play-bgm]');
    if(!t)return;
    e.preventDefault();
    openBgm(cfg.bgms.find(b=>b.id===t.dataset.playBgm))
  });
 
  g.addEventListener('pointerdown',e=>{
    const t=e.target.closest('[data-play-bgm]');
    if(!t||e.pointerType==='mouse')return;
    clearTimeout(lp);
    lp=setTimeout(()=>{
      skip=t.dataset.playBgm;
      openBgm(cfg.bgms.find(b=>b.id===skip))
    },550)
  });
 
  for(const ev of ['pointerup','pointercancel','pointerleave'])g.addEventListener(ev,()=>clearTimeout(lp));
 
  g.addEventListener('click',e=>{
    const t=e.target.closest('[data-play-bgm]');
    if(t&&skip===t.dataset.playBgm){
      skip=null;
      e.stopImmediatePropagation()
    }
  },true)
}

$('#bgmMovePrev').onclick=()=>moveBgm(-1);
$('#bgmMoveNext').onclick=()=>moveBgm(1);

$('#bgmList').oninput=e=>{
  const slider=e.target.closest('[data-bgm-volume]');
  if(!slider)return;
  const b=cfg.bgms.find(x=>x.id===slider.dataset.bgmVolume);
  if(!b)return;
  b.volume=+slider.value;
  slider.nextElementSibling.textContent=b.volume+'%';
  if(bgmPlaying?.trackId===b.id)bgmPlaying.gain.gain.value=bgmItemGain(bgmPlaying.assetId,b.volume);
  persist()
};

const DB_KEY={se:'seDb',bgm:'bgmDb',vo:'voDb',env:'envDb'};

function setDb(kind,db){
  const key=DB_KEY[kind];
  cfg[key]=Math.max(-60,Math.min(0,Math.round(db*2)/2));
  if(kind==='se'||kind==='bgm')cfg[kind==='se'?'seVolume':'bgmVolume']=Math.round(dbGain(cfg[key])*1000)/10;
  $('#'+kind+'Volume').value=cfg[key];
  $('#'+kind+'Val').textContent=fmtDb(cfg[key]);
  updateGains();
  renderMonitor();
  persist()
}

$('#seVolume').oninput=e=>setDb('se',+e.target.value);
$('#voVolume').oninput=e=>setDb('vo',+e.target.value);
$('#envVolume').oninput=e=>setDb('env',+e.target.value);
$('#bgmVolume').oninput=e=>setDb('bgm',+e.target.value);

document.querySelector('.db-steps').onclick=e=>{
  const b=e.target.closest('[data-db]');
  if(!b)return;
  const [k,d]=b.dataset.db.split(':');
  setDb(k,cfg[DB_KEY[k]]+(+d))
};

$('#bgmLevel').onchange=e=>{
  cfg.rec.bgmLevel=e.target.checked;
  persist();
  if(bgmPlaying)bgmPlaying.gain.gain.value=bgmItemGain(bgmPlaying.assetId,cfg.bgms.find(x=>x.id===bgmPlaying.trackId)?.volume??100)
};

for(const [selector,key] of [['masterVolume','master']])$('#'+selector).oninput=e=>{
  queueMicrotask(renderMonitor);
  cfg[key]=+e.target.value;
  $('#'+selector.replace('Volume','Val')).textContent=cfg[key]+'%';
  updateGains();
  persist()
};

$('#micVolume').oninput=e=>{
  cfg.rec.micVolume=+e.target.value;
  $('#micVal').textContent=cfg.rec.micVolume+'%';
  updateGains();
  persist()
};

$('#duckDepth').oninput=e=>{
  cfg.rec.duckDepth=+e.target.value;
  $('#duckDepthVal').textContent='-'+cfg.rec.duckDepth+'dB';
  forceDuck=true;
  persist()
};

$('#duckThresh').oninput=e=>{
  cfg.rec.duckThresh=+e.target.value;
  $('#duckThreshVal').textContent=cfg.rec.duckThresh+'dB';
  persist()
};

for(const [sel,key,reopen] of [
  ['#optEc','ec',1],
  ['#optNs','ns',1],
  ['#optAgc','agc',1],
  ['#optMon','monitor'],
  ['#optLimiter','limiter'],
  ['#duckOn','duck'],
  ['#keepVoice','keepVoice'],
  ['#keepProg','keepProg'],
  ['#optNormalize','normalize']
])
 $(sel).onchange=e=>{
  cfg.rec[key]=e.target.checked;
  persist();
  updateGains();
  renderDuck();
  if(key==='monitor'&&e.target.checked)toast('自分の声は少し遅れて聞こえます。ヘッドホンでご利用ください',3500);
  if(reopen&&micStream)enableMic()
};

$('#mp3Rate').onchange=e=>{
  cfg.rec.mp3Rate=+e.target.value;
  persist()
};

$('#micSelect').onchange=e=>{
  cfg.rec.micId=e.target.value;
  persist();
  if(micStream)enableMic()
};

$('#micBtn').onclick=()=>enableMic();

$('#recBtn').onclick=()=>{
  if(rec.state==='idle')startRec();else if(rec.state==='recording')pauseRec();else if(rec.state==='paused')resumeRec()
};

$('#stopRecBtn').onclick=stopRec;
$('#retakeBtn').onclick=e=>retake(e.currentTarget);
$('#discardBtn').onclick=e=>discardTake(e.currentTarget);

$('#bgmFadeBtn').onclick=()=>{
  if(!bgmPlaying){
    toast('再生中のBGMはありません');
    return
  }
  const b=cfg.bgms.find(x=>x.id===bgmPlaying.trackId);
  bgmSerial++;
  addMarker('BGMフェードアウト：'+(b?.name||''),true);
  fadeStop(bgmPlaying,cfg.rec.fadeSec)
};

function setBgmLow(on){
  audioEngine();
  bgmLow=on;
  const t=ctx.currentTime;
  bgmTrim.gain.cancelScheduledValues(t);
  bgmTrim.gain.setTargetAtTime(on?cfg.rec.bgmLowLevel/100:1,t,.6);
  addMarker(on?'BGMを小さく':'BGMを元の音量へ',true);
  renderBgmLow();
  renderBgmNow()
}

function renderBgmLow(){
  $('#bgmLowBtn').classList.toggle('on',bgmLow);
  $('#bgmLowBtn').textContent=bgmLow?'BGMを元に戻す':'BGMを小さくする';
  $('#bgmLowState').textContent=bgmLow?'小さくしています（'+cfg.rec.bgmLowLevel+'%）':'通常の音量'
}

$('#bgmLowBtn').onclick=()=>setBgmLow(!bgmLow);

$('#bgmNowStop').onclick=e=>{
  if(e.currentTarget.dataset.mode==='play'){
    const pb=progBgm();
    if(pb)playBgm(pb,{restart:true});
    return
  }
  if(bgmLoadingId){
    bgmSerial++;
    bgmPendingId=null;
    bgmLoadingId=null;
    render();
    renderBgmNow();
    return
  }
  if(bgmPlaying){
    bgmSerial++;
    addMarker('BGM停止：'+bgmPlaying.name,true);
    fadeStop(bgmPlaying,.6)
  }
};

$('#bgmLowLevel').oninput=e=>{
  cfg.rec.bgmLowLevel=+e.target.value;
  $('#bgmLowVal').textContent=cfg.rec.bgmLowLevel+'%';
  if(bgmLow&&ctx)bgmTrim.gain.setTargetAtTime(cfg.rec.bgmLowLevel/100,ctx.currentTime,.2);
  renderBgmLow();
  persist()
};

$('#fadeSec').onchange=e=>{
  cfg.rec.fadeSec=+e.target.value;
  persist()
};

$('#fadeOnStop').onchange=e=>{
  cfg.rec.fadeOnStop=e.target.checked;
  persist()
};

$('#coverFit').onchange=e=>{
  cfg.rec.coverFit=e.target.value;
  persist();
  renderCover()
};

$('#videoSize').onchange=e=>{
  cfg.rec.videoSize=+e.target.value;
  persist()
};

$('#playMode').onchange=e=>{
  cfg.playMode=e.target.value;
  persist()
};
$('#stopAll').onclick=stopAll;
$('#soundVol').oninput=e=>$('#soundVolVal').textContent=e.target.value+'%';
$('#bgmVolModal').oninput=e=>$('#bgmVolModalVal').textContent=e.target.value+'%';

$('#shortcutInput').onkeydown=e=>{
  e.preventDefault();
  $('#shortcutInput').value=e.key==='Escape'?'':(e.key.length===1?e.key.toUpperCase():e.key)
};

function moveSound(direction){
  const s=cfg.sounds.find(x=>x.id===$('#soundId').value);
  if(!s)return;
  const list=cfg.sounds.filter(x=>x.type===s.type&&x.tabIndex===s.tabIndex).sort((a,b)=>a.order-b.order),
    index=list.findIndex(x=>x.id===s.id),
    other=list[index+direction];
  if(!other)return;
  const o=s.order;
  s.order=other.order;
  other.order=o;
  s.slotIndex=s.order;
  other.slotIndex=other.order;
  save()
}

$('#movePrev').onclick=()=>moveSound(-1);
$('#moveNext').onclick=()=>moveSound(1);

$('#soundForm').onsubmit=async e=>{
  e.preventDefault();
  const type=$('#soundType').value,
    label=$('#labelInput').value.trim(),
    length=graphemes(label).length;
  if((type!=='voice'&&!label)||(type==='emoji'&&length!==1)||(type==='text'&&length>3)||(type==='env'&&length>6)||(type==='voice'&&length>12)){
    toast(type==='emoji'?'絵文字1文字を入力してください':type==='voice'?'ボタン名は12文字以内にしてください':type==='env'?'ボタン名は6文字以内にしてください':'ボタン名は3文字以内にしてください');
    return
  }
 
  const old=cfg.sounds.find(x=>x.id===$('#soundId').value),
    file=$('#soundFile').files[0],
    previousAsset=old?.assetId;
  let assetId=previousAsset||null,
    fileName=old?.fileName||'';
 
  if(!old){
    toast('空欄を押して登録してください');
    return
  }
 
  const imgFile=type==='voice'?$('#imageFile').files[0]:null,
    prevImg=old?.imageId;
  let imageId=prevImg||null,
    imageName=old?.imageName||'';
 
  if(type==='voice'&&!file&&!previousAsset){
    toast('音声ファイルを選んでください');
    return
  }
 
  try{
    if(file){
      const nextId=id();
      await putAsset(nextId,file);
      assetId=nextId;
      fileName=file.name
    }
  
    if(imgFile){
      const nid=id();
      await putAsset(nid,imgFile);
      imageId=nid;
      imageName=imgFile.name
    }
  
    Object.assign(old,{label,volume:+$('#soundVol').value,assetId,fileName,shortcut:$('#shortcutInput').value.trim(),configured:true},type==='voice'?{imageId,imageName}:{});
    save();
    closeModal('soundModal');
    if(file&&previousAsset)await deleteAsset(previousAsset);
    if(imgFile&&prevImg){
      await deleteAsset(prevImg);
      imgUrls.delete(prevImg)
    }
    toast(type==='voice'?'ボイスを保存しました':type==='env'?'環境音を保存しました':'効果音を保存しました')
 
  }catch(err){
    console.error(err);
    toast('音源を保存できませんでした。空き容量をご確認ください')
  }
};

$('#deleteSound').onclick=async e=>{
  const s=cfg.sounds.find(x=>x.id===$('#soundId').value);
  if(!s||!armButton(e.currentTarget,'もう一度押すと削除'))return;
  [...active].filter(a=>a.soundId===s.id).forEach(release);
  const previousAsset=s.assetId;
 
  const prevImg=s.imageId;
  Object.assign(s,{label:'',category:'全て',volume:100,assetId:null,fileName:'',shortcut:'',configured:false,imageId:null,imageName:''});
  save();
  closeModal('soundModal');
  await deleteAsset(previousAsset);
  if(prevImg){
    await deleteAsset(prevImg);
    imgUrls.delete(prevImg)
  }
};

$('#bgmForm').onsubmit=async e=>{
  e.preventDefault();
  const old=cfg.bgms.find(x=>x.id===$('#bgmId').value);
  if(!old){
    toast('BGMの枠が見つかりません');
    return
  }
  const file=$('#bgmFile').files[0],
    previousAsset=old.assetId;
  let assetId=previousAsset||null,
    fileName=old.fileName||'';
 
  try{
    if(file){
      const nextId=id();
      await putAsset(nextId,file);
      assetId=nextId;
      fileName=file.name
    }
  
    const next={name:$('#bgmNameInput').value.trim(),volume:+$('#bgmVolModal').value,assetId,fileName};
    Object.assign(old,next);
  
    if(bgmPlaying?.trackId===old.id){
      if(file){
        bgmSerial++;
        fadeStop(bgmPlaying)
      }else bgmPlaying.gain.gain.value=bgmItemGain(bgmPlaying.assetId,next.volume)
    }
  
    save();
    closeModal('bgmModal');
    if(file&&previousAsset)await deleteAsset(previousAsset);
    toast('BGMを保存しました')
 
  }catch(err){
    console.error(err);
    toast('音源を保存できませんでした。空き容量をご確認ください')
  }
};

async function resetBgm(trackId){
  const b=cfg.bgms.find(x=>x.id===trackId);
  if(!b||(!b.assetId&&!b.name))return;
  const oldAsset=b.assetId;
 
  Object.assign(b,{name:'',volume:100,assetId:null,fileName:''});
  bgmSerial++;
  if(bgmPendingId===trackId)bgmPendingId=null;
  if(bgmPlaying?.trackId===trackId)fadeStop(bgmPlaying);
 
  save();
  closeModal('bgmModal');
  await deleteAsset(oldAsset);
  toast('この枠の選択をリセットしました')
}

$('#resetBgm').onclick=e=>{
  if(armButton(e.currentTarget,'もう一度押すとリセット'))resetBgm($('#bgmId').value)
};

document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.querySelectorAll('.modal-back').forEach(m=>m.onclick=e=>{
  if(e.target===m){
    if(m.id==='confirmModal')closeConfirm(false);else closeModal(m.id)
  }
});

document.addEventListener('keydown',e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||document.querySelector('.modal-back.open')||e.target.closest('input,select,textarea,[contenteditable]'))return;
  const key=e.key.length===1?e.key.toUpperCase():e.key;
  const s=cfg.sounds.find(x=>x.shortcut&&x.shortcut.toUpperCase()===key);
  if(s){
    e.preventDefault();
    playSound(s)
  }
});

window.addEventListener('beforeunload',e=>{
  if(rec.state!=='idle'||videoJob){
    e.preventDefault();
    e.returnValue=''
  }
});
