/* ===================== 名前と着せ替え（設定画面） ===================== */

let lookSaved={...look};

const lookSame=(a,b)=>JSON.stringify(lookSanitize(a))===JSON.stringify(lookSanitize(b));

function lookForExport(){
  return {...lookSaved}
}

function packFileName(){
  const base=(lookSaved.title||'settings').replace(/[\\/:*?"<>|（）()\s]+/g,'_').replace(/^_+|_+$/g,'')||'settings';
  return base+'_settings'+PACK_EXT
}

function lookRenderUI(){
 
  const box=$('#lookPresets');
 
  if(!box.childElementCount){
  
    for(const [key,p] of [...Object.entries(LOOK_PRESETS),['custom',{name:'カスタム'}]]){
   
      const b=document.createElement('button');
      b.type='button';
      b.className='look-preset';
      b.dataset.preset=key;
      b.setAttribute('role','radio');
   
      b.innerHTML=`<span class="look-sw">${LOOK_COLOR_KEYS.map(k=>`<i data-k="${k}"></i>`).join('')}</span><span>${esc(p.name)}</span>`;
   
      b.onclick=()=>lookDraft(key==='custom'?{...look,preset:'custom'}:{...look,preset:key});
      box.appendChild(b);
  
    }
 
  }
 
  for(const b of box.children){
    const key=b.dataset.preset,
      c=key==='custom'?look:LOOK_PRESETS[key];
    b.setAttribute('aria-checked',String(look.preset===key));
    b.querySelectorAll('i').forEach(i=>i.style.background=c[i.dataset.k])
  }
 
  for(const inp of document.querySelectorAll('[data-look]'))inp.value=look[inp.dataset.look];
 
  if(document.activeElement!==$('#lookTitleIn'))$('#lookTitleIn').value=look.title;
 
  if(document.activeElement!==$('#lookSubIn'))$('#lookSubIn').value=look.subtitle;
 
  if(document.activeElement!==$('#lookEyebrowIn'))$('#lookEyebrowIn').value=look.eyebrow;
 
  const dirty=!lookSame(look,lookSaved),
    st=$('#lookState');
  st.textContent=dirty?'未保存（仮の表示）':'保存済み';
  st.classList.toggle('dirty',dirty);

}

function lookDraft(v){
  look=lookSanitize(v);
  lookPaint(look);
  lookRenderUI()
}

function lookCommit(v){
  look=lookSanitize(v);
  lookSaved={...look};
  try{
    localStorage.setItem(LOOK_KEY,JSON.stringify(look))
  }catch(e){
    console.warn('着せ替えを保存できない環境です',e.name)
  }
  lookPaint(look);
  lookRenderUI()
}

for(const inp of document.querySelectorAll('[data-look]'))inp.oninput=()=>lookDraft({...look,preset:'custom',[inp.dataset.look]:inp.value});

$('#lookTitleIn').oninput=e=>lookDraft({...look,title:e.target.value});

$('#lookSubIn').oninput=e=>lookDraft({...look,subtitle:e.target.value});

$('#lookEyebrowIn').oninput=e=>lookDraft({...look,eyebrow:e.target.value});

$('#lookTitleIn').onblur=$('#lookSubIn').onblur=$('#lookEyebrowIn').onblur=()=>lookRenderUI();

$('#lookSave').onclick=()=>{
  lookCommit(look);
  toast('名前と着せ替えを保存しました')
};

$('#lookRevert').onclick=()=>{
  lookDraft(lookSaved);
  toast('保存済みの状態に戻しました')
};

$('#lookReset').onclick=()=>{
  lookDraft(LOOK_DEFAULT);
  toast('初期状態を表示しています（保存すると確定します）')
};

lookPaint(look);
lookRenderUI();
