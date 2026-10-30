'use strict';
/* ===================== 基本・保存 ===================== */

const $=s=>document.querySelector(s), 
  DB_NAME=OTONOHA_NS?'meltune-haishin-studio-db':'meltune-kissa-studio-db';

const KEY=OTONOHA_NS?'meltune-haishin-studio-config-v1':'meltune-kissa-studio-config-v1';

const TABS=5,
  EMOJI_SLOTS=42,
  TEXT_SLOTS=25,
  BGM_SLOTS=20,
  VOICE_SLOTS=15,
  ENV_SLOTS=8;

const emojiLabels=Array(EMOJI_SLOTS).fill(''), 
  textLabels=Array(TEXT_SLOTS).fill('');

const LEGACY_PRESET_LABELS=new Set(['👏','💖','😂','😢','💪','✨','🔔','✅','🌿','🦌','🍪','📚','🌟','🌸','📯','⭕','✖️','🎹','🫢','🪨','🪞','🥊','💥','🎉','📛取得','📛進化','長攻撃','吹雪','扉開け','扉閉じ','拍手','正解','退場']);

const BGM_TAB_DEFAULTS=['明るい','穏やか','切ない','緊張','その他'], 
  TEXT_TAB_DEFAULTS=['標準','感謝','力業','1','2'], 
  EMOJI_TAB_DEFAULTS=[...TEXT_TAB_DEFAULTS];

const LEGACY_EMOJI_TABS=['標準','感謝','力業','1','2','その他'];

const REC_DEFAULTS={
  micVolume:100,
  micId:'',
  ec:false,
  ns:false,
  agc:false,
  monitor:false,
  limiter:true,
  duck:true,
  duckDepth:10,
  duckThresh:-42,
  keepVoice:true,
  keepProg:false,
  normalize:false,
  mp3Rate:192,
  monitorMode:'auto',
  previewFull:true,
  bgmLevel:true,
  bgmLowLevel:35,
  fadeSec:3,
  fadeOnStop:true,
  coverFit:'cover',
  videoSize:1080,
  videoEffect:'none',
  effectSource:'default',
  videoFps:24,
  effectCount:45,
  effectSpeed:60,
  effectScale:70,
  effectOpacity:75
};

const id=()=>globalThis.crypto?.randomUUID?.()||'s'+Date.now().toString(36)+Math.random().toString(36).slice(2);

const graphemes=s=>[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(String(s))].map(x=>x.segment);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const newSound=(type,label,order)=>({id:id(),type,label,category:'全て',volume:100,assetId:null,fileName:'',shortcut:'',configured:false,order});

const newBgm=(tabIndex,slotIndex)=>({id:id(),name:'',volume:100,assetId:null,fileName:'',tabIndex,slotIndex});

const defaults=()=>({
  version:6,
  categories:[],
  sounds:[...EMOJI_TAB_DEFAULTS.flatMap((_,tab)=>emojiLabels.map((x,slot)=>({...newSound('emoji',x,slot),tabIndex:tab,slotIndex:slot}))),...TEXT_TAB_DEFAULTS.flatMap((_,tab)=>textLabels.map((x,slot)=>({...newSound('text',x,slot),tabIndex:tab,slotIndex:slot})))],
  emojiTabs:[...EMOJI_TAB_DEFAULTS],
  textTabs:[...TEXT_TAB_DEFAULTS],
  bgmTabs:[...BGM_TAB_DEFAULTS],
  bgms:BGM_TAB_DEFAULTS.flatMap((_,tab)=>Array.from({length:BGM_SLOTS},(_,slot)=>newBgm(tab,slot))),
  master:100,
  seVolume:100,
  bgmVolume:100,
  playMode:'restart',
  seDb:-18,
  bgmDb:-30,
  voDb:-6,
  envDb:-24,
  rec:{...REC_DEFAULTS},
  programs:defaultPrograms(),
  currentProgram:0
});

const dbGain=db=>db<=-60?0:Math.pow(10,db/20);

const pctToDb=p=>p<=0?-60:Math.max(-60,Math.min(0,Math.round(20*Math.log10(p/100)*2)/2));

const fmtDb=db=>db<=-60?'消音':(db>0?'+':'')+(+db).toFixed(1)+'dB';

const PROGRAMS=8;

function defaultPrograms(){
  return Array.from({length:PROGRAMS},(_,i)=>({id:'prog'+(i+1),name:'番組'+(i+1),bgmId:null,autoBgm:true,coverIdx:-1,color:''}))
}

const PROG_COLOR_KEYS=['creamsoda','napolitan','lemon','bluehawaii','strawberry'];

const PROG_COLORS=Object.fromEntries(PROG_COLOR_KEYS.map(k=>[k,LOOK_PRESETS[k].name]));

const PROG_COLOR_LEGACY={snow:'bluehawaii',leaf:'creamsoda',honey:'lemon',grape:'bluehawaii',hotchoco:'napolitan'};

const progColorKey=c=>PROG_COLORS[c]?c:(PROG_COLOR_LEGACY[c]||'');

const progColorStyle=c=>{
  const k=progColorKey(c);
  if(!k)return '';
  const a=LOOK_PRESETS[k].accent;
  return ` style="--pc:${a};--pc-ink:${lookInk(a)}"`
};

let db,
  cfg,
  emojiTab=0,
  textTab=0,
  bgmTab=0,
  noticeTimer;

let ctx,
  envBus,
  voBus,
  monProg,
  bgmTrim,
  bgmLow=false,
  seBus,
  bgmBus,
  masterBus,
  duckGain,
  programBus,
  progStereo,
  voiceBus,
  selfMon,
  recMix,
  limiter,
  limOut,
  micGain,
  micAnalyser,
  mixAnalyser,
  merger;

let bgmPlaying=null,
  bgmSerial=0,
  bgmPendingId=null;

const soundSerial=new Map(), 
  pendingText=new Set(), 
  active=new Set();


function normalize(raw){
 
  const base=defaults();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return ensureBgmSlots(ensureTextSlots(ensureEmojiSlots(ensureSlots(base))));
 
  base.rec={...REC_DEFAULTS,...(raw.rec&&typeof raw.rec==='object'?raw.rec:{})};
 
  {
    const v=base.rec.videoEffect;
    if(v==='snow'){
      base.rec.videoEffect='winter'
    }else if(v==='image'){
      base.rec.videoEffect='winter';
      base.rec.effectSource='image'
    }else if(!['none','spring','summer','autumn','winter'].includes(v))base.rec.videoEffect='none';
    if(!['default','image'].includes(base.rec.effectSource))base.rec.effectSource='default'
  }
 
  for(const [k,min,max] of [['effectCount',10,120],['effectSpeed',20,180],['effectScale',30,160],['effectOpacity',10,100]])base.rec[k]=Number.isFinite(+base.rec[k])?Math.max(min,Math.min(max,+base.rec[k])):REC_DEFAULTS[k];
 
  base.rec.videoFps=+base.rec.videoFps===30?30:24;
  base.rec.videoSize=+base.rec.videoSize===720?720:1080;
 
  if(Array.isArray(raw.programs)&&raw.programs.some(x=>x&&typeof x==='object')){
    raw={...raw,programs:raw.programs.filter(x=>x&&typeof x==='object')};
    const defs=defaultPrograms(),
      used=new Set(raw.programs.map(x=>x&&x.id));
    const kept=raw.programs.slice(0,PROGRAMS).map((x,i)=>({...defs[i],...x}));
    for(const d of defs){
      if(kept.length>=PROGRAMS)break;
      if(!used.has(d.id))kept.push(d)
    }
    base.programs=kept
  }
 
  base.currentProgram=Number.isInteger(raw.currentProgram)&&raw.currentProgram>=-1&&raw.currentProgram<PROGRAMS?raw.currentProgram:(raw.currentProgram===-1?-1:0);
 
  if(Array.isArray(raw.sounds)&&raw.sounds.some(x=>x&&x.emoji)&&!raw.sounds.some(x=>x&&x.type)){
  
    const old=raw.sounds.filter(x=>x&&typeof x==='object').map((s,i)=>({...newSound('emoji',s.emoji||'🔔',i),...s,label:s.emoji||'🔔',type:'emoji',category:s.assetId?s.category||'全て':'全て',order:i}));
  
    base.sounds=[...old,...emojiLabels.slice(old.length).map((x,i)=>newSound('emoji',x,old.length+i)),...textLabels.map((x,i)=>newSound('text',x,i))];
  
    if(raw.bgm?.assetId||raw.bgm?.name)base.bgms=[{id:id(),name:raw.bgm.name||'BGM',volume:raw.bgm.volume??100,assetId:raw.bgm.assetId||null,fileName:raw.bgm.fileName||''}];
  
    base.master=raw.master??100;
    base.playMode=raw.playMode||'restart';
    base.categories=Array.isArray(raw.categories)?raw.categories:base.categories;
    return ensureBgmSlots(ensureTextSlots(ensureEmojiSlots(ensureSlots(base))));
 
  }
 
  base.sounds=Array.isArray(raw.sounds)?raw.sounds.filter(x=>x&&typeof x==='object').map((s,i)=>({...newSound(s.type==='text'?'text':'emoji',s.label??'',i),...s})):base.sounds;
 
  base.bgms=Array.isArray(raw.bgms)?raw.bgms.filter(x=>x&&typeof x==='object'):[];
  base.categories=Array.isArray(raw.categories)?raw.categories:base.categories;
 
  const realSounds=t=>base.sounds.filter(x=>x.type===t&&(x.assetId||x.configured||(x.label&&!LEGACY_PRESET_LABELS.has(x.label))));
 
  base.emojiTabs=fitTabs(raw.emojiTabs,EMOJI_TAB_DEFAULTS,realSounds('emoji'));
 
  base.textTabs=fitTabs(raw.textTabs,TEXT_TAB_DEFAULTS,realSounds('text'));
 
  base.bgmTabs=fitTabs(raw.bgmTabs,BGM_TAB_DEFAULTS,base.bgms.filter(b=>b.assetId||b.name));
 
  for(const key of ['master','seVolume','bgmVolume'])base[key]=Number.isFinite(+raw[key])?+raw[key]:base[key];
 
  base.voDb=Number.isFinite(+raw.voDb)&&raw.voDb!==null?+raw.voDb:base.voDb;
  base.envDb=Number.isFinite(+raw.envDb)&&raw.envDb!==null?+raw.envDb:base.envDb;
 
  for(const [k,leg] of [['seDb','seVolume'],['bgmDb','bgmVolume']])base[k]=Number.isFinite(+raw[k])&&raw[k]!==null?+raw[k]:(Number.isFinite(+raw[leg])?pctToDb(+raw[leg]):base[k]);
  base.playMode=raw.playMode==='overlap'?'overlap':'restart';
  return ensureBgmSlots(ensureTextSlots(ensureEmojiSlots(ensureSlots(base))));

}

function ensureSlots(config){
 
  for(const s of config.sounds){
    delete s.favorite;
    if(s.type==='text')s.category='全て';
    if(!s.assetId){
   
      if(s.configured===true||(s.label&&!LEGACY_PRESET_LABELS.has(s.label)))s.configured=true;
   else{
        Object.assign(s,{label:'',category:'全て',volume:100,shortcut:'',configured:false})
      }
  
    }else s.configured=true
  }
 
  const oldPreset=['感謝','感情','力業','システム','その他'];
  if(config.categories.length===oldPreset.length&&config.categories.every((c,i)=>c===oldPreset[i])&&!config.sounds.some(s=>s.type==='emoji'&&s.configured&&s.category!=='全て'))config.categories=[];
 
  return config
}
// タブ数を5つに合わせる。多い場合は「登録が一番少ないタブ」を1つ前のタブへまとめる（登録は消さない）

function fitTabs(rawNames,defs,items){
 
  let names=Array.isArray(rawNames)&&rawNames.length?rawNames.map((x,i)=>String(x||defs[i]||'タブ'+(i+1))):[...defs];
 
  while(names.length>TABS){
  
    const counts=names.map((_,t)=>items.filter(x=>x.tabIndex===t).length);
  
    let drop=names.length-1;
    for(let t=names.length-1;t>=0;t--)if(counts[t]<counts[drop])drop=t;
  
    const target=drop>0?drop-1:0;
  
    for(const x of items){
      if(x.tabIndex===drop){
        x.tabIndex=target;
        x.slotIndex=-1
      }else if(x.tabIndex>drop)x.tabIndex--
    }
  
    names.splice(drop,1);
 
  }
 
  while(names.length<TABS)names.push(defs[names.length]||'タブ'+(names.length+1));
 
  return names;

}

function ensureGrid(config,type,SL,tabs=TABS){
 
  const N=tabs*SL,
    isReal=s=>s.assetId||s.configured||s.imageId;
 
  const real=config.sounds.filter(s=>s.type===type&&isReal(s)).sort((a,b)=>(a.tabIndex??0)-(b.tabIndex??0)||(a.slotIndex??a.order??0)-(b.slotIndex??b.order??0));
 
  config.sounds=config.sounds.filter(s=>s.type!==type||isReal(s));
 
  const taken=new Set();
 
  for(const s of real){
  
    let pref=Number.isInteger(s.tabIndex)&&s.tabIndex>=0?Math.min(s.tabIndex,tabs-1):0;
  
    if(type==='emoji'&&!Number.isInteger(s.tabIndex)&&s.category&&s.category!=='全て'){
      const m=LEGACY_EMOJI_TABS.indexOf(s.category);
      pref=m>=0?Math.min(m,tabs-1):tabs-1
    }
  
    let slot=Number.isInteger(s.slotIndex)&&s.slotIndex>=0&&s.slotIndex<SL&&s.tabIndex===pref?s.slotIndex:-1;
  
    if(slot<0||taken.has(pref*SL+slot)){
      const free=Array.from({length:N},(_,i)=>(pref*SL+i)%N).find(i=>!taken.has(i));
      if(free===undefined)continue;
      pref=Math.floor(free/SL);
      slot=free%SL
    }
  
    s.tabIndex=pref;
    s.slotIndex=slot;
    s.order=slot;
    taken.add(pref*SL+slot);
 
  }
 
  for(let tab=0;tab<tabs;tab++)for(let slot=0;slot<SL;slot++)if(!taken.has(tab*SL+slot))config.sounds.push({...newSound(type,'',slot),tabIndex:tab,slotIndex:slot});
 
  return config;

}
// 効果音はタブなしの一続きの並び。以前のタブは「タブごとにまとめて、行の頭から」順に並べ直す

const SE_COLS={emoji:6,text:5},
  SE_MIN={emoji:EMOJI_SLOTS,text:TEXT_SLOTS},
  SE_MAX=600;

const isRealSound=s=>s.assetId||s.configured||s.imageId;

function flattenSeTabs(config,type){
 
  const cols=SE_COLS[type],
    real=config.sounds.filter(s=>s.type===type&&isRealSound(s));
 
  if(!real.some(s=>Number.isInteger(s.tabIndex)&&s.tabIndex>0))return config;
 
  const tabs=[...new Set(real.map(s=>Number.isInteger(s.tabIndex)&&s.tabIndex>=0?s.tabIndex:0))].sort((a,b)=>a-b);
  let offset=0;
 
  for(const t of tabs){
  
    const items=real.filter(s=>(Number.isInteger(s.tabIndex)&&s.tabIndex>=0?s.tabIndex:0)===t).sort((a,b)=>(a.slotIndex??a.order??0)-(b.slotIndex??b.order??0));
  
    let max=offset-1,
      next=offset;
  
    for(const s of items){
      const si=Number.isInteger(s.slotIndex)&&s.slotIndex>=0?s.slotIndex:null;
      const idx=si===null?next:offset+si;
      s.tabIndex=0;
      s.slotIndex=s.order=idx;
      max=Math.max(max,idx);
      next=max+1
    }
  
    offset=(Math.floor(max/cols)+1)*cols;
 
  }
 
  return config;

}

function seSlotsNeeded(config,type){
  const cols=SE_COLS[type];
  let max=-1;
  for(const s of config.sounds)if(s.type===type&&isRealSound(s)&&Number.isInteger(s.slotIndex))max=Math.max(max,s.slotIndex);
  return Math.min(SE_MAX,Math.max(SE_MIN[type],(Math.floor(max/cols)+2)*cols))
}

const ensureSe=(config,type)=>{
  flattenSeTabs(config,type);
  return ensureGrid(config,type,seSlotsNeeded(config,type),1)
};
// 最後の行まで埋まったら、空いた行を1行足す（既存の枠のIDは変えない）

function growSe(){
  for(const type of ['emoji','text']){
    const have=cfg.sounds.filter(s=>s.type===type).length,
      need=seSlotsNeeded(cfg,type);
    for(let i=have;i<need;i++)cfg.sounds.push({...newSound(type,'',i),tabIndex:0,slotIndex:i})
  }
}

const ensureEmojiSlots=config=>ensureSe(config,'emoji');
// 文字の効果音とボイス（1タブ25枠）をまとめて整える

function fixedSlots(config,type,min,cols){
  let max=-1;
  for(const s of config.sounds)if(s.type===type&&isRealSound(s)&&Number.isInteger(s.slotIndex))max=Math.max(max,s.slotIndex);
  const used=config.sounds.filter(s=>s.type===type&&isRealSound(s)).length;
  return Math.max(min,Math.ceil(Math.max(max+1,used)/cols)*cols)
}

const ensureTextSlots=config=>ensureGrid(ensureGrid(ensureSe(config,'text'),'voice',fixedSlots(config,'voice',VOICE_SLOTS,5),1),'env',fixedSlots(config,'env',ENV_SLOTS,4),1);

function ensureBgmSlots(config){
 
  const N=TABS*BGM_SLOTS,
    prior=(config.bgms||[]).filter(b=>b.assetId||b.name);
 
  const slots=Array.from({length:N},(_,i)=>newBgm(Math.floor(i/BGM_SLOTS),i%BGM_SLOTS)),
    taken=new Set();
 
  const positioned=prior.some(b=>Number.isInteger(b.tabIndex)&&Number.isInteger(b.slotIndex));
 
  const list=positioned?prior.sort((a,b)=>(a.tabIndex??0)-(b.tabIndex??0)||(a.slotIndex??0)-(b.slotIndex??0)):prior;
 
  for(const b of list){
  
    let pref=Number.isInteger(b.tabIndex)&&b.tabIndex>=0?Math.min(b.tabIndex,TABS-1):0;
  
    let idx=Number.isInteger(b.slotIndex)&&b.slotIndex>=0&&b.slotIndex<BGM_SLOTS&&b.tabIndex===pref?pref*BGM_SLOTS+b.slotIndex:-1;
  
    if(idx<0||taken.has(idx)){
      idx=Array.from({length:N},(_,i)=>(pref*BGM_SLOTS+i)%N).find(i=>!taken.has(i));
      if(idx===undefined)continue
    }
  
    taken.add(idx);
    slots[idx]={...slots[idx],...b,tabIndex:Math.floor(idx/BGM_SLOTS),slotIndex:idx%BGM_SLOTS};
 
  }
 
  config.bgms=slots;
  return config;

}

// ブラウザ内に保存できない環境（プレビュー画面など）向けの、一時的な保存場所（閉じると消える）

function memoryDB(){
 
  const S={assets:new Map(),takes:new Map(),chunks:new Map()};
 
  const req=fn=>{
    const r={};
    queueMicrotask(()=>{
      try{
        r.result=fn();
        r.onsuccess?.()
      }catch(e){
        r.error=e;
        r.onerror?.()
      }
    });
    return r
  };
 
  const hit=k=>k&&typeof k==='object'&&typeof k.includes==='function'?(x=>k.includes(x)):(x=>x===k);
 
  return {memory:true,transaction(){
      const tx={
        error:null,
        aborted:false,
        abort(){
          tx.aborted=true;
          tx.onabort?.()
        },
        objectStore(n){
          const m=S[n];
          return{
  
            put:(v,k)=>req(()=>{
              m.set(k,v);
              return k
            }),
            get:k=>req(()=>m.get(k)),
  
            delete:k=>req(()=>{
              const f=hit(k);
              for(const key of [...m.keys()])if(f(key))m.delete(key)
            }),
  
            getAll:()=>req(()=>[...m.values()]),
            getAllKeys:r=>req(()=>{
              const keys=[...m.keys()].sort();
              return r?keys.filter(hit(r)):keys
            })
          }
        }
      };
  
      setTimeout(()=>{
        if(!tx.aborted)tx.oncomplete?.()
      },0);
      return tx
    }};

}

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>{
      const d=r.result;
      for(const n of ['assets','takes','chunks'])if(!d.objectStoreNames.contains(n))d.createObjectStore(n)
    };
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error)
  })
}

const idbPut=(store,key,val)=>new Promise((resolve,reject)=>{
  const t=db.transaction(store,'readwrite');
  t.objectStore(store).put(val,key);
  t.oncomplete=resolve;
  t.onerror=()=>reject(t.error);
  t.onabort=()=>reject(t.error)
});

const idbGet=(store,key)=>new Promise((resolve,reject)=>{
  if(!key)return resolve(null);
  const r=db.transaction(store,'readonly').objectStore(store).get(key);
  r.onsuccess=()=>resolve(r.result??null);
  r.onerror=()=>reject(r.error)
});

const idbDel=(store,keyOrRange)=>new Promise(resolve=>{
  if(!keyOrRange)return resolve();
  const t=db.transaction(store,'readwrite');
  t.objectStore(store).delete(keyOrRange);
  t.oncomplete=resolve;
  t.onerror=resolve
});

const idbDelStrict=(store,keyOrRange)=>new Promise((resolve,reject)=>{
  const t=db.transaction(store,'readwrite');
  t.objectStore(store).delete(keyOrRange);
  t.oncomplete=resolve;
  t.onerror=()=>reject(t.error);
  t.onabort=()=>reject(t.error||Error('aborted'))
});

const idbAll=store=>new Promise((resolve,reject)=>{
  const r=db.transaction(store,'readonly').objectStore(store).getAll();
  r.onsuccess=()=>resolve(r.result||[]);
  r.onerror=()=>reject(r.error)
});

const idbKeys=(store,range)=>new Promise((resolve,reject)=>{
  const r=db.transaction(store,'readonly').objectStore(store).getAllKeys(range);
  r.onsuccess=()=>resolve(r.result||[]);
  r.onerror=()=>reject(r.error)
});

const putAsset=(k,b)=>idbPut('assets',k,b), 
  getAsset=k=>idbGet('assets',k), 
  deleteAsset=k=>idbDel('assets',k);

function persist(){
  try{
    localStorage.setItem(KEY,JSON.stringify(cfg))
  }catch(e){
    if(!persist.warned){
      persist.warned=true;
      console.warn('設定を保存できない環境です',e.name);
      toast('設定を保存できません。移行前に設定ファイルを書き出してください',8000)
    }
  }
}

function toast(msg,ms=2400){
  const el=$('#notice');
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>el.classList.remove('show'),ms)
}

/* ===================== 音声エンジン ===================== */
// 経路： 効果音 → seBus ┐
//        BGM → bgmBus → duckGain ┴→ programBus →(聴く) masterBus → スピーカー/ヘッドホン
// マイク → micGain → voiceBus →(任意) selfMon → masterBus
// voiceBus + programBus → recMix → limiter → limOut → 録音（ミックス）
// 録音ノードには ミックスL/R・声・BGM+SE L/R の5チャンネルを同時に渡す

function stereoGain(){
  const g=ctx.createGain();
  g.channelCount=2;
  g.channelCountMode='explicit';
  g.channelInterpretation='speakers';
  return g
}

function audioEngine(){
 
  if(ctx)return;
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)throw Error('Web Audio非対応');
 
  ctx=new C({latencyHint:'interactive'});
 
  masterBus=ctx.createGain();
  voBus=ctx.createGain();
  seBus=ctx.createGain();
  envBus=ctx.createGain();
  bgmBus=ctx.createGain();
  duckGain=ctx.createGain();
  programBus=stereoGain();
 
  voiceBus=ctx.createGain();
  selfMon=ctx.createGain();
  recMix=stereoGain();
  limiter=ctx.createDynamicsCompressor();
  limOut=stereoGain();
 
  bgmTrim=ctx.createGain();
  seBus.connect(programBus);
  envBus.connect(programBus);
  voBus.connect(programBus);
  bgmBus.connect(bgmTrim);
  bgmTrim.connect(duckGain);
  duckGain.connect(programBus);
 
  monProg=ctx.createGain();
  programBus.connect(monProg);
  monProg.connect(masterBus);
  voiceBus.connect(selfMon);
  selfMon.connect(masterBus);
  masterBus.connect(ctx.destination);
 
  programBus.connect(recMix);
  voiceBus.connect(recMix);
  recMix.connect(limiter);
  limiter.connect(limOut);
 
  micAnalyser=ctx.createAnalyser();
  micAnalyser.fftSize=2048;
  voiceBus.connect(micAnalyser);
 
  mixAnalyser=ctx.createAnalyser();
  mixAnalyser.fftSize=2048;
  limOut.connect(mixAnalyser);
 
  merger=ctx.createChannelMerger(5);
 
  const s1=ctx.createChannelSplitter(2);
  limOut.connect(s1);
  s1.connect(merger,0,0);
  s1.connect(merger,1,1);
 
  voiceBus.connect(merger,0,2);
 
  const s2=ctx.createChannelSplitter(2);
  programBus.connect(s2);
  s2.connect(merger,0,3);
  s2.connect(merger,1,4);
 
  updateGains();
  requestAnimationFrame(meterLoop);
  setInterval(duckLoop,40);

}

function updateGains(){
 
  if(!ctx)return;
  const r=cfg.rec;
 
  masterBus.gain.value=monitorMuted()?0:cfg.master/100;
  monProg.gain.value=previewBoost();
  seBus.gain.value=dbGain(cfg.seDb);
  envBus.gain.value=dbGain(cfg.envDb);
  bgmBus.gain.value=dbGain(cfg.bgmDb+(window.__sceneBgmBoost||0));
  voBus.gain.value=dbGain(cfg.voDb);
 
  if(micGain)micGain.gain.value=micMuted?0:r.micVolume/100;
  selfMon.gain.value=r.monitor?1:0;
 
  if(r.limiter){
    limiter.threshold.value=-2;
    limiter.knee.value=0;
    limiter.ratio.value=20;
    limiter.attack.value=.002;
    limiter.release.value=.15
  }
 else{
    limiter.threshold.value=0;
    limiter.knee.value=0;
    limiter.ratio.value=1
  }
 
  if(!r.duck){
    duckGain.gain.cancelScheduledValues(ctx.currentTime);
    duckGain.gain.setTargetAtTime(1,ctx.currentTime,.1);
    ducked=false;
    renderDuck()
  }

}
/* 再生は「音源を一度だけ解析して使い回す」方式（AudioBuffer）。
   以前のaudio要素方式は、効果音を何度も鳴らすとブラウザの再生器の上限に達してBGMが鳴らなくなることがあった */

const bufCache=new Map(),
  bgmLru=[],
  bgmLoud=new Map();

function measureRms(buf){
  let sum=0,
    n=0;
  const step=8;
  for(let c=0;c<buf.numberOfChannels;c++){
    const d=buf.getChannelData(c);
    for(let i=0;i<d.length;i+=step){
      sum+=d[i]*d[i];
      n++
    }
  }
  const rms=Math.sqrt(sum/Math.max(1,n));
  return rms>0?20*Math.log10(rms):-90
}
// BGMの音量差をそろえる：曲全体の平均の大きさを-20dB前後に合わせる（上げ下げは最大±12dBまで）

function bgmItemGain(assetId,volume){
  let g=volume/100;
  if(cfg.rec.bgmLevel!==false&&bgmLoud.has(assetId)){
    const adj=Math.max(-12,Math.min(12,-20-bgmLoud.get(assetId)));
    g*=Math.pow(10,adj/20)
  }
  return g
}

function decodeAsset(assetId,isBgm){
 
  if(bufCache.has(assetId)){
    if(isBgm){
      const i=bgmLru.indexOf(assetId);
      if(i>=0)bgmLru.splice(i,1);
      bgmLru.push(assetId)
    }
    return bufCache.get(assetId)
  }
 
  const pr=(async()=>{
    const blob=await getAsset(assetId);
    if(!blob)throw Object.assign(Error('missing'),{userMessage:'保存音源が見つかりません。再登録してください'});
  
    const data=await blob.arrayBuffer();
    audioEngine();
  
    try{
      const buf=await new Promise((res,rej)=>{
        const r=ctx.decodeAudioData(data,res,rej);
        if(r&&r.then)r.then(res,rej)
      });
      if(isBgm)bgmLoud.set(assetId,measureRms(buf));
      return buf
    }
  catch(e){
      throw Object.assign(Error('decode'),{userMessage:'この音源の形式を読み込めませんでした（'+(blob.type||'形式不明')+'）。mp3かwavで登録し直すと鳴る可能性があります'})
    }
  })();
 
  bufCache.set(assetId,pr);
  pr.catch(()=>bufCache.delete(assetId));
 
  if(isBgm){
    bgmLru.push(assetId);
    while(bgmLru.length>3){
      const old=bgmLru.shift();
      if(old!==bgmPlaying?.assetId)bufCache.delete(old)
    }
  }
 
  return pr;

}

function release(inst){
  if(!inst||inst.released)return;
  setTimeout(releaseBoostHoldIfQuiet,0);
  inst.released=true;
  active.delete(inst);
  if(bgmPlaying===inst)bgmPlaying=null;
  try{
    inst.source.onended=null;
    inst.source.stop()
  }catch(_){}
  try{
    inst.source.disconnect();
    inst.gain.disconnect()
  }catch(_){}
  render();
  renderBgmNow()
}

function fadeStop(inst,duration=.34){
  if(!inst||inst.released||inst.fading)return Promise.resolve();
  inst.fading=true;
  active.delete(inst);
  if(bgmPlaying===inst){
    bgmPlaying=null;
    bgmFading=inst
  }
  render();
  renderBgmNow();
  return new Promise(resolve=>{
    if(!ctx||ctx.state!=='running'){
      release(inst);
      if(bgmFading===inst)bgmFading=null;
      resolve();
      return
    }
    const now=ctx.currentTime;
    inst.gain.gain.cancelScheduledValues(now);
    inst.gain.gain.setValueAtTime(inst.gain.gain.value,now);
    inst.gain.gain.linearRampToValueAtTime(0,now+duration);
    setTimeout(()=>{
      release(inst);
      if(bgmFading===inst)bgmFading=null;
      renderBgmNow();
      resolve()
    },duration*1000+35)
  })
}

function startBuffer(buffer,volume,bus,meta,{loop=false,offset=0}={}){
 
  const source=ctx.createBufferSource(),
    gain=ctx.createGain();
  source.buffer=buffer;
  source.loop=loop;
  gain.gain.value=volume/100;
  source.connect(gain);
  gain.connect(bus);
 
  const inst={source,gain,buffer,...meta,released:false,fading:false,startedAt:ctx.currentTime-offset};
 
  source.onended=()=>release(inst);
  source.start(0,offset%buffer.duration);
  return inst;

}

async function ensureRunning(){
  audioEngine();
  if(ctx.state!=='running'){
    try{
      await Promise.race([ctx.resume(),sleep(1500)])
    }catch(_){}
  }
}

async function playSound(s){
 
  if(!s.assetId){
    toast('このボタンの音源を長押しして登録してください');
    return
  }
 
  if(s.type!=='emoji'){
  
    const playingNow=[...active].filter(a=>a.soundId===s.id);
  
    if(playingNow.length){
      soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
      playingNow.forEach(a=>fadeStop(a));
      return
    }
  
    if(pendingText.has(s.id)){
      soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
      pendingText.delete(s.id);
      return
    }
  
    pendingText.add(s.id);
 
  }
 
  const serial=(soundSerial.get(s.id)||0)+1;
  soundSerial.set(s.id,serial);
 
  try{
    await ensureRunning();
  
    if(s.type==='emoji'&&cfg.playMode==='restart')[...active].filter(a=>a.soundId===s.id).forEach(a=>release(a));
  
    const buf=await decodeAsset(s.assetId,false);
    if(serial!==soundSerial.get(s.id)&&(s.type!=='emoji'||cfg.playMode==='restart'))return;
  
    const inst=startBuffer(buf,s.volume,s.type==='voice'?voBus:s.type==='env'?envBus:seBus,{soundId:s.id,soundType:s.type},{loop:s.type==='env'});
    active.add(inst);
    render();
 
  }catch(e){
    console.error(e);
    toast(e.userMessage||'効果音を再生できませんでした',5000)
  }
 finally{
    if(s.type!=='emoji'&&serial===soundSerial.get(s.id))pendingText.delete(s.id)
  }

}

let bgmLoadingId=null,
  bgmError='',
  bgmFading=null;

async function playBgm(b,{restart=false,quiet=false}={}){
 
  if(!restart&&bgmPlaying?.trackId===b.id){
    bgmSerial++;
    addMarker('BGM停止：'+b.name,true);
    fadeStop(bgmPlaying);
    return
  }
 
  if(!restart&&bgmPendingId===b.id){
    bgmSerial++;
    bgmPendingId=null;
    bgmLoadingId=null;
    renderBgmNow();
    return
  }
 
  if(!b.assetId){
    toast('「設定」からBGM音源を登録してください');
    return
  }
 
  const serial=++bgmSerial,
    previous=bgmPlaying;
  bgmPendingId=b.id;
  bgmLoadingId=b.id;
  bgmError='';
  render();
  renderBgmNow();
 
  try{
  
    await ensureRunning();
  
    const bufP=decodeAsset(b.assetId,true);
  
    if(previous)await fadeStop(previous,restart?.12:.38);
  
    const buf=await bufP;
    if(serial!==bgmSerial)return;
  
    const inst=startBuffer(buf,100,bgmBus,{trackId:b.id,assetId:b.assetId,name:b.name},{loop:true});
    inst.gain.gain.value=bgmItemGain(b.assetId,b.volume);
  
    bgmPlaying=inst;
    addMarker('BGM開始：'+b.name,true);
    render();
 
  }catch(e){
    console.error(e);
    if(serial===bgmSerial){
      bgmError=(b.name||'BGM')+'：'+(e.userMessage||'再生できませんでした');
      if(!quiet)toast(bgmError,6000)
    }
  }
 finally{
    if(serial===bgmSerial){
      bgmPendingId=null;
      bgmLoadingId=null
    }
    renderBgmNow()
  }

}

function stopAll(){
  bgmSerial++;
  bgmPendingId=null;
  bgmLoadingId=null;
  for(const s of cfg.sounds)soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
  pendingText.clear();
  const sounds=[...active];
  if(bgmPlaying)sounds.push(bgmPlaying);
  sounds.forEach(x=>fadeStop(x,.42));
  toast('すべての音をフェードアウトしました')
}
// 録音欄のBGM表示

let bgmAnalyser=null;
const bgmBuf=new Float32Array(2048);

function renderBgmNow(){
 
  const el=document.getElementById('bgmNow');
  if(!el)return;
 
  const name=$('#bgmNowName'),
    stopBtn=$('#bgmNowStop');
  let state='idle',
    label='BGM：なし';
 
  if(bgmLoadingId){
    const b=cfg.bgms.find(x=>x.id===bgmLoadingId);
    state='loading';
    label='読み込み中：'+(b?.name||'')
  }
 else if(bgmPlaying){
    state=bgmLow?'low':'playing';
    label=(bgmLow?'小さく再生中：':'再生中：')+bgmPlaying.name
  }
 else if(bgmFading){
    state='fading';
    label='フェードアウト中：'+bgmFading.name
  }
 else if(bgmError){
    state='error';
    label=bgmError
  }
 
  const pb=progBgm();
 
  if((state==='idle'||state==='error')&&pb){
    if(state==='idle')label='待機中｜初期BGM：'+pb.name;
    stopBtn.textContent='▶ 初期BGM';
    stopBtn.disabled=false;
    stopBtn.dataset.mode='play'
  }
 else{
    stopBtn.textContent='■ BGM停止';
    stopBtn.disabled=!(bgmPlaying||bgmLoadingId);
    stopBtn.dataset.mode='stop'
  }
 
  el.dataset.state=state;
  name.textContent=label;
 
  if(state!=='playing'&&state!=='low'){
    $('#bgmNowTime').textContent='';
    $('#bgmNowBar').style.width='0%'
  }

}

function tickBgmNow(){
 
  if(!bgmPlaying||!ctx)return;
  const d=bgmPlaying.buffer.duration,
    t=((ctx.currentTime-bgmPlaying.startedAt)%d+d)%d;
 
  $('#bgmNowTime').textContent=fmtTime(t)+' / '+fmtTime(d);
  $('#bgmNowBar').style.width=(t/d*100).toFixed(2)+'%';

}
/* ===================== マイク・メーター・ダッキング ===================== */

let micStream=null,
  micSource=null,
  ducked=false,
  forceDuck=false,
  lastVoiceAt=0;

const micBuf=new Float32Array(2048),
  mixBuf=new Float32Array(2048);

const peakHold={mic:{v:-99,t:0},mix:{v:-99,t:0}};
let clipUntil=0;

async function enableMic(auto=false){
 
  try{
    audioEngine();
    if(auto)ctx.resume().catch(()=>{});else await ctx.resume();
  
    if(micStream)micStream.getTracks().forEach(t=>t.stop());
    if(micSource)micSource.disconnect();
  
    const r=cfg.rec;
  
    micStream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:r.micId?{exact:r.micId}:undefined,echoCancellation:r.ec,noiseSuppression:r.ns,autoGainControl:r.agc,channelCount:{ideal:1}}});
  
    micSource=ctx.createMediaStreamSource(micStream);
  
    if(!micGain){
      micGain=ctx.createGain();
      micGain.connect(voiceBus)
    }
  
    micSource.connect(micGain);
    updateGains();
  
    const track=micStream.getAudioTracks()[0];
    track.addEventListener('ended',()=>{
      toast('マイクが切断されました。つなぎ直しています…',4000);
      setTimeout(()=>{
        if(!micLive())enableMic(true)
      },600);
      renderRecState()
    });
  
    await listMics();
    detectOutput();
    $('#micInfo').textContent=(track.label||'マイク')+' · '+ctx.sampleRate/1000+'kHz';
  
    $('#micBtn').textContent='接続し直す';
    renderRecState();
    toast('マイクを有効にしました');
 
  }catch(e){
    console.error(e);
  
    if(e.name==='OverconstrainedError'&&cfg.rec.micId){
      cfg.rec.micId='';
      persist();
      return enableMic()
    }
  
    toast(e.name==='NotAllowedError'?'マイクの使用が許可されませんでした。アドレスバーの設定から許可できます':'マイクを開けませんでした',4000)
  }

}

async function listMics(){
 
  try{
    const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
  
    const sel=$('#micSelect');
    sel.innerHTML='<option value="">既定のマイク</option>'+list.filter(d=>d.deviceId&&d.deviceId!=='default').map((d,i)=>`<option value="${esc(d.deviceId)}">${esc(d.label||'マイク '+(i+1))}</option>`).join('');
  
    sel.value=list.some(d=>d.deviceId===cfg.rec.micId)?cfg.rec.micId:'';
 
  }catch(e){
    console.error(e)
  }

}

function peakDb(an,buf){
  an.getFloatTimeDomainData(buf);
  let p=0;
  for(let i=0;i<buf.length;i++){
    const a=Math.abs(buf[i]);
    if(a>p)p=a
  }
  return p>0?20*Math.log10(p):-99
}

function rmsDb(an,buf){
  let s=0;
  for(let i=0;i<buf.length;i++)s+=buf[i]*buf[i];
  const r=Math.sqrt(s/buf.length);
  return r>0?20*Math.log10(r):-99
}

function drawMeter(name,db){
 
  const now=performance.now(),
    h=peakHold[name];
  if(db>=h.v||now-h.t>1200){
    h.v=db;
    h.t=now
  }
 
  const pct=v=>Math.max(0,Math.min(100,(v+60)/60*100));
 
  $('#'+name+'Meter').style.clipPath=`inset(0 ${100-pct(db)}% 0 0)`;
  $('#'+name+'Peak').style.left=`calc(${pct(h.v)}% - 2px)`;
 
  const out=$('#'+name+'Db');
  if(name==='mix'&&db>-0.5)clipUntil=now+1500;
 
  const clip=name==='mix'&&now<clipUntil;
  out.classList.toggle('clip',clip);
  out.textContent=clip?'過大':(h.v<=-60?'-∞ dB':h.v.toFixed(1)+' dB');

}

function meterLoop(){
 
  if(ctx){
    drawMeter('mic',micStream?peakDb(micAnalyser,micBuf):-99);
    drawMeter('mix',peakDb(mixAnalyser,mixBuf))
  }
 
  if(rec.state!=='idle')renderTimer();
 
  if(miniOn)syncMini();
 
  tickBgmNow();
  checkVoice();
 
  if(window.__otoLight)setTimeout(()=>requestAnimationFrame(meterLoop),70);else requestAnimationFrame(meterLoop);

}

function duckLoop(){
 
  if(!ctx||!cfg.rec.duck||rec.state==='ending')return;
  const now=performance.now();
 
  if(micStream){
    micAnalyser.getFloatTimeDomainData(micBuf);
    const level=rmsDb(micAnalyser,micBuf);
    if(level>cfg.rec.duckThresh)lastVoiceAt=now
  }
 
  for(const a of active)if(a.soundType==='voice'&&!a.fading){
    lastVoiceAt=now;
    break
  }
 
  const want=now-lastVoiceAt<500;
 
  if(want!==ducked||forceDuck){
    ducked=want;
    forceDuck=false;
    const t=ctx.currentTime;
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setTargetAtTime(want?Math.pow(10,-cfg.rec.duckDepth/20):1,t,want?.06:.35);
    renderDuck()
  }

}
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

/* ===================== モニター音（ヘッドホン・スピーカー） ===================== */

let monitorManualOff=false,
  outputLabel='',
  outputKind='unknown';

const HEAD_RE=/head|ヘッド|イヤ|ear|airpods|buds|bluetooth|hands-?free|headset/i,
  SPK_RE=/speaker|スピーカー|内蔵|built-?in|internal|macbook|display audio|hdmi/i;

async function detectOutput(){
 
  try{
    const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput');
    const d=ds.find(x=>x.deviceId==='default')||ds[0];
    outputLabel=d?.label||'';
  
    outputKind=!outputLabel?'unknown':HEAD_RE.test(outputLabel)?'headphones':SPK_RE.test(outputLabel)?'speaker':'unknown'
  }catch(_){
    outputKind='unknown';
    outputLabel=''
  }
 
  applyMonitor();

}
// 録音中に鳴り始めた音が残っている間は持ち上げない（録音停止・録り直しの瞬間にBGMが急に大きくなるのを防ぐ）

let boostHold=false,
  retaking=false;
// v0.4.1: スタジオ側のPNGTuber動画収録中もtrue。従来の音声録音と同じモニター保護（持ち上げ停止・スピーカー時の自動消音）を適用する

let studioCapturing=false;
// v0.4.2: マイクのミュート（micGainを0にする。口パク・ダッキング・録音・動画・配信用出力のすべてで声が消える）／配信スタジオ表示中は試聴の持ち上げを止める

let micMuted=false,
  studioLiveMode=false;

function releaseBoostHoldIfQuiet(){
  if(boostHold&&!retaking&&!studioCapturing&&rec.state==='idle'&&!bgmPlaying&&!bgmFading&&!bgmLoadingId&&active.size===0){
    boostHold=false;
    applyMonitor()
  }
}

function previewBoost(){
 // 録音していないときだけ、効果音・BGMを端末の音量いっぱいで聴けるよう持ち上げる（効果音とBGMの比率は変えない・録音には影響しない）
 
  if(!cfg.rec.previewFull||boostHold||retaking||studioCapturing||studioLiveMode)return 1;
  if(rec.state!=='idle'&&rec.state!=='paused')return 1;
 
  const top=Math.max(dbGain(cfg.seDb),dbGain(cfg.bgmDb),dbGain(cfg.voDb),0.001);
  return Math.min(20,1/top);

}

function monitorMuted(){
 
  if(monitorManualOff)return true;
  const active=rec.state==='recording'||rec.state==='ending'||studioCapturing;
  if(!active)return false;
 
  const m=cfg.rec.monitorMode;
  if(m==='always')return false;
  if(m==='muteRec')return true;
  return outputKind!=='headphones';

}

function applyMonitor(){
  if(ctx&&masterBus){
    const t=ctx.currentTime;
    monProg.gain.cancelScheduledValues(t);
    monProg.gain.setTargetAtTime(previewBoost(),t,.05);
    masterBus.gain.cancelScheduledValues(t);
    masterBus.gain.setTargetAtTime(monitorMuted()?0:cfg.master/100,t,.02)
  }
  renderMonitor()
}

function renderMonitor(){
 
  const btn=document.getElementById('monBtn');
  if(!btn||!cfg)return;
  const muted=monitorMuted();
 
  btn.classList.toggle('off',muted);
  btn.textContent=muted?(monitorManualOff?'モニター音：オフ':'モニター音：オフ（自動）'):'モニター音：オン';
 
  const kind={headphones:'イヤホン・ヘッドホンと判定',speaker:'スピーカーと判定',unknown:'判定できないため、スピーカーとして扱います'}[outputKind];
 
  const pi=document.getElementById('previewInfo');
  if(pi){
    const k=previewBoost(),
      top=Math.max(cfg.seDb,cfg.bgmDb,cfg.voDb);
    pi.textContent=!cfg.rec.previewFull?'効果音・BGMは、録音されるのと同じ音量で聞こえます。':(k>1?`今は効果音・BGM・ボイスを約${k.toFixed(1)}倍にして鳴らしています（大きい方の${fmtDb(top)}を0dBとして、比率はそのまま）。録音中は録音と同じ音量に戻ります。録音される音量は変わりません。`:'録音中は、録音されるのと同じ音量で聞こえます。')
  }
 
  const info=document.getElementById('outputInfo');
  if(info)info.textContent=`出力先：${outputLabel||'（ブラウザから名前を取得できません）'} → ${kind}。モニター音を消しても、BGM・効果音は録音に入ります。`;

}

$('#monBtn').onclick=()=>{
 
  if(monitorMuted()&&!monitorManualOff){
    toast('録音中のため自動で消しています。設定欄の「録音中のモニター音」で変えられます',5000);
    return
  }
 
  monitorManualOff=!monitorManualOff;
  applyMonitor();

};

$('#monitorMode').onchange=e=>{
  cfg.rec.monitorMode=e.target.value;
  persist();
  applyMonitor()
};

$('#previewFull').onchange=e=>{
  cfg.rec.previewFull=e.target.checked;
  persist();
  applyMonitor()
};


let silentSince=0;

function checkVoice(){
 
  const el=$('#voiceWarn');
  let msg='';
 
  if(rec.state==='recording'){
  
    const tr=micStream?.getAudioTracks?.()[0];
  
    if(!tr)msg='マイクがつながっていません。声は録音されていません';
  else if(tr.readyState!=='live')msg='マイクが止まりました。声は録音されていません（設定欄の「接続し直す」で戻せます）';
  else if(tr.muted)msg='マイクがパソコン側で一時停止されています。声は録音されていません';
  else if(micMuted)msg='マイクはミュート中です。声は録音されていません';
  else{
      const db=peakHold.mic.v;
      const now=performance.now();
      if(db>-55)silentSince=0;else if(!silentSince)silentSince=now;
      if(silentSince&&now-silentSince>6000)msg='6秒以上マイクに音が入っていません。マイクのミュートや接続先を確かめてください'
    }
 
  }else silentSince=0;
 
  if(el.textContent!==msg){
    el.textContent=msg;
    el.hidden=!msg
  }

}

function renderDuck(){
  const el=$('#duckState');
  el.textContent=!cfg.rec.duck?'オフ':ducked?'BGMを下げています':'待機';
  el.classList.toggle('on',ducked&&cfg.rec.duck)
}

/* ===================== 録音 ===================== */

const WORKLET=`class R extends AudioWorkletProcessor{constructor(){super();this.on=false;this.N=8192;this.b=[0,1,2,3,4].map(()=>new Float32Array(this.N));this.n=0;this.port.onmessage=e=>{const m=e.data;if(m==='start')this.on=true;else if(m==='pause'){this.on=false;this.flush()}else if(m==='stop'){this.on=false;this.flush();this.port.postMessage({done:true})}}}
flush(){if(!this.n)return;const ch=this.b.map(a=>a.slice(0,this.n));this.port.postMessage({frames:this.n,ch},ch.map(a=>a.buffer));this.n=0}
process(inputs){if(!this.on)return true;const inp=inputs[0]||[];const len=inp[0]?inp[0].length:128;if(this.n+len>this.N)this.flush();for(let c=0;c<5;c++){const src=inp[c],dst=this.b[c];if(src)dst.set(src,this.n);else dst.fill(0,this.n,this.n+len)}this.n+=len;return true}}
registerProcessor('kissa-rec',R);`;

const rec={
  state:'idle',
  take:null,
  node:null,
  mode:'',
  pending:{mix:[],voice:[],prog:[]},
  pendingFrames:0,
  idx:{mix:0,voice:0,prog:0},
  frames:0,
  flushChain:Promise.resolve(),
  stopResolve:null,
  retry:[],
  saveTrouble:false,
  saveErr:'',
  recovered:false
};

let rescue=null;

async function ensureRecorder(){
 
  if(rec.node)return;
  audioEngine();
 
  const sink=ctx.createGain();
  sink.gain.value=0;
  sink.connect(ctx.destination);
 
  if(ctx.audioWorklet&&window.AudioWorkletNode){
  
    try{
      let loaded=false;
   
      for(const url of [URL.createObjectURL(new Blob([WORKLET],{type:'text/javascript'})),'data:text/javascript;charset=utf-8,'+encodeURIComponent(WORKLET)]){
        try{
          await ctx.audioWorklet.addModule(url);
          loaded=true;
          break
        }catch(_){}finally{
          if(url.startsWith('blob:'))URL.revokeObjectURL(url)
        }
      }
   
      if(!loaded)throw Error('worklet module unavailable');
   
      const node=new AudioWorkletNode(ctx,'kissa-rec',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:5,channelCountMode:'explicit',channelInterpretation:'discrete'});
   
      node.port.onmessage=e=>{
        if(e.data.done){
          rec.stopResolve?.();
          rec.stopResolve=null
        }else onRecData(e.data)
      };
   
      merger.connect(node);
      node.connect(sink);
      rec.node=node;
      rec.mode='worklet';
      return;
  
    }catch(e){
      console.warn('AudioWorkletが使えないため代替方式で録音します',e)
    }
 
  }
 
  const sp=ctx.createScriptProcessor(4096,5,1);
 
  sp.onaudioprocess=e=>{
    if(rec.state!=='recording'&&rec.state!=='ending')return;
    const ch=[0,1,2,3,4].map(c=>e.inputBuffer.getChannelData(c).slice());
    onRecData({frames:ch[0].length,ch})
  };
 
  merger.connect(sp);
  sp.connect(sink);
  rec.node=sp;
  rec.mode='script';

}

const toI16=x=>{
  const s=x<-1?-1:x>1?1:x;
  return s<0?s*32768:s*32767
};

function onRecData({frames,ch}){
 
  const t=rec.take;
  if(!t)return;
 
  const mix=new Int16Array(frames*2);
  for(let i=0;i<frames;i++){
    mix[2*i]=toI16(ch[0][i]);
    mix[2*i+1]=toI16(ch[1][i])
  }
  rec.pending.mix.push(mix);
 
  if(t.tracks.includes('voice')){
    const v=new Int16Array(frames);
    for(let i=0;i<frames;i++)v[i]=toI16(ch[2][i]);
    rec.pending.voice.push(v)
  }
 
  if(t.tracks.includes('prog')){
    const p=new Int16Array(frames*2);
    for(let i=0;i<frames;i++){
      p[2*i]=toI16(ch[3][i]);
      p[2*i+1]=toI16(ch[4][i])
    }
    rec.pending.prog.push(p)
  }
 
  rec.frames+=frames;
  rec.pendingFrames+=frames;
 
  if(rec.pendingFrames>=t.sampleRate*3)flushChunks();

}

const chunkKey=(takeId,track,i)=>`${takeId}|${track}|${String(i).padStart(7,'0')}`;

const chunkRange=(takeId,track)=>IDBKeyRange.bound(`${takeId}|${track}|`,`${takeId}|${track}|￿`);
// 数秒ごとの保存。失敗した分は捨てずにメモリに持ち、次の保存で書き直す

function flushChunks(){
 
  const t=rec.take;
  if(!t)return rec.flushChain;
 
  const jobs=[];
  for(const k of t.tracks){
    if(rec.pending[k].length){
      jobs.push([chunkKey(t.id,k,rec.idx[k]++),new Blob(rec.pending[k])]);
      rec.pending[k]=[]
    }
  }
 
  const frames=rec.frames;
  rec.pendingFrames=0;
 
  rec.flushChain=rec.flushChain.then(async()=>{
  
    const all=[...rec.retry,...jobs];
    rec.retry=[];
  
    try{
   
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['chunks','takes'],'readwrite');
    
        try{
          for(const [key,blob] of all)tx.objectStore('chunks').put(blob,key);
          t.frames=frames;
          tx.objectStore('takes').put({...t},t.id)
        }catch(e){
          try{
            tx.abort()
          }catch(_){}
          reject(e);
          return
        }
    
        tx.oncomplete=resolve;
        tx.onerror=tx.onabort=()=>reject(tx.error||Error('保存が中断されました'))
      });
   
      if(rec.saveTrouble){
        rec.saveTrouble=false;
        rec.recovered=true;
        renderSaveWarn()
      }
  
    }catch(e){
      console.error(e);
      rec.retry=all;
      rec.saveTrouble=true;
      rec.saveErr=errText(e);
      renderSaveWarn()
    }
 
  });
 
  return rec.flushChain;

}

const unsavedSec=(jobs,sr)=>jobs.filter(([k])=>k.includes('|mix|')).reduce((n,[,b])=>n+b.size,0)/4/sr;

function renderSaveWarn(){
 
  const el=$('#saveWarn');
  if(!el)return;
 
  if(rec.saveTrouble&&rec.take){
    el.hidden=false;
    el.innerHTML=`ブラウザへの保存に失敗しています（${esc(rec.saveErr)}）。録音は続いていて、保存できなかった約${Math.ceil(unsavedSec(rec.retry,rec.take.sampleRate))}秒分はメモリに持ったまま、保存をやり直しています。`;
    return
  }
 
  if(rescue){
    const sec=Math.ceil(unsavedSec(rescue.jobs,rescue.take.sampleRate));
    el.hidden=false;
  
    el.innerHTML=(sec>0?`「${esc(rescue.take.name)}」の一部（約${sec}秒分）をブラウザに保存できませんでした（${esc(rescue.err)}）。この画面を閉じる前に、どちらかを押すと録音を残せます。`:`「${esc(rescue.take.name)}」の音声は保存できていますが、仕上げの保存に失敗しました（${esc(rescue.err)}）。「もう一度保存する」で完了できます。WAVで書き出して残すこともできます。`)+`<div class="warn-actions"><button class="btn" type="button" id="rescueRetry">もう一度保存する</button><button class="btn gold" type="button" id="rescueWav">この録音をWAVで書き出す</button><button class="btn" type="button" id="rescueClose">閉じる</button></div>`;
  
    $('#rescueRetry').onclick=rescueRetry;
    $('#rescueWav').onclick=rescueWav;
    $('#rescueClose').onclick=e=>{
      if(armButton(e.currentTarget,'もう一度押すと閉じる（未保存分は失われます）')){
        rescue=null;
        renderSaveWarn()
      }
    };
    return
  }
 
  el.hidden=true;
  el.innerHTML='';

}

async function rescueRetry(){
 
  if(!rescue)return;
  const {take,jobs}=rescue;
 
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['chunks','takes'],'readwrite');
      try{
        for(const [key,blob] of jobs)tx.objectStore('chunks').put(blob,key);
        tx.objectStore('takes').put({...take,status:'done',missingSec:0},take.id)
      }catch(e){
        try{
          tx.abort()
        }catch(_){}
        reject(e);
        return
      }
      tx.oncomplete=resolve;
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('保存が中断されました'))
    });
  
    rescue=null;
    renderSaveWarn();
    await renderTakes();
    updateStorage();
    toast(`「${take.name}」を最後まで保存できました`,4000)
  }
 catch(e){
    console.error(e);
    rescue.err=errText(e);
    renderSaveWarn();
    toast('まだ保存できません（'+errText(e)+'）。WAVで書き出すと録音を残せます',6000)
  }

}

async function rescueWav(){
 
  if(!rescue)return;
  const {take,jobs}=rescue;
 
  try{
    let stored=[];
    try{
      for(const k of await trackKeys(take,'mix')){
        const b=await idbGet('chunks',k);
        if(b)stored.push([k,b])
      }
    }catch(_){}
  
    const all=[...stored,...jobs.filter(([k])=>k.includes('|mix|'))].sort((a,b)=>a[0]<b[0]?-1:1);
  
    const bytes=all.reduce((n,[,b])=>n+b.size,0);
  
    download(new Blob([wavHeader(2,take.sampleRate,bytes),...all.map(([,b])=>b)],{type:'audio/wav'}),`${safeName(take.name)}_mix.wav`);
    toast('録音をWAVで書き出しました',4000)
  }
 catch(e){
    console.error(e);
    toast('書き出しに失敗しました（'+errText(e)+'）',6000)
  }

}

function stamp(d=new Date()){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

let lastTakeId=null;

function micLive(){
  const tr=micStream?.getAudioTracks?.()[0];
  return !!(tr&&tr.readyState==='live')
}

async function discardRec(){
 
  const t=rec.take;
  boostHold=true;
  rec.state='stopping';
  renderRecState();
 
  if(rec.mode==='worklet'){
    await new Promise(resolve=>{
      rec.stopResolve=resolve;
      rec.node.port.postMessage('stop');
      setTimeout(resolve,1500)
    })
  }
 
  rec.pending={mix:[],voice:[],prog:[]};
  rec.pendingFrames=0;
  await rec.flushChain;
  rec.retry=[];
  rec.saveTrouble=false;
  rec.recovered=false;
  renderSaveWarn();
 
  rec.take=null;
  rec.state='idle';
  if(t)await deleteTakeData(t.id).catch(e=>console.error(e));

}

async function discardTake(btn){
 
  if(!(rec.state==='recording'||rec.state==='paused'))return;
 
  if(!armButton(btn,'もう一度押すと破棄'))return;
 
  boostHold=true;
  await discardRec();
 
  if(bgmLow){
    bgmLow=false;
    bgmTrim.gain.cancelScheduledValues(ctx.currentTime);
    bgmTrim.gain.setTargetAtTime(1,ctx.currentTime,.05);
    renderBgmLow()
  }
 
  if(bgmPlaying){
    bgmSerial++;
    fadeStop(bgmPlaying,.5)
  }
 
  renderRecState();
  await renderTakes();
  updateStorage();
  setTimeout(releaseBoostHoldIfQuiet,700);
 
  toast('録音を止めて破棄しました（保存していません）',3500);

}

async function retake(btn){
 
  if(retaking||rec.state==='stopping'||rec.state==='ending')return;
 
  const live=rec.state==='recording'||rec.state==='paused';
 
  if(!live&&!armButton(btn,'もう一度押すと録り直し'))return;
  boostHold=true;
  retaking=true;
  applyMonitor();
 
  try{
    await retakeInner()
  }finally{
    retaking=false;
    releaseBoostHoldIfQuiet()
  }

}

async function retakeInner(){
 
  let startBgmId=null;
 
  if(rec.state==='recording'||rec.state==='paused'){
    startBgmId=rec.take.startBgmId;
    await discardRec()
  }
 else if(rec.state==='idle'&&lastTakeId){
    const t=await idbGet('takes',lastTakeId);
    startBgmId=t?.startBgmId||null;
    if(t)await deleteTakeData(t.id).catch(e=>console.error(e));
    lastTakeId=null
  }
 else return;
 
  if(bgmLow){
    bgmLow=false;
    bgmTrim.gain.cancelScheduledValues(ctx.currentTime);
    bgmTrim.gain.setValueAtTime(1,ctx.currentTime);
    renderBgmLow()
  }
 
  if(bgmPlaying){
    bgmSerial++;
    await fadeStop(bgmPlaying,.12)
  }
 
  await renderTakes();
  renderRecState();
 
  const b=startBgmId&&cfg.bgms.find(x=>x.id===startBgmId&&x.assetId);
 
  if(b)await decodeAsset(b.assetId,true).catch(()=>{});
 
  await startRec({noAutoBgm:true});
 
  if(rec.state==='recording'){
    rec.take.startBgmId=b?b.id:null;
    idbPut('takes',rec.take.id,{...rec.take}).catch(()=>{});
    if(b)await playBgm(b,{restart:true});
    toast(b?`録り直し中（BGM「${b.name}」を頭から）`:'録り直し中',3500)
  }

}

async function startRec(opts={}){
 
  if(rec.state!=='idle')return;
 
  rec.state='starting';
  renderRecState();
 
  try{
  
    audioEngine();
    await ctx.resume();
    await ensureRecorder();
  
    if(!micLive())await enableMic();
  
    if(!micLive()){
      rec.state='idle';
      renderRecState();
      toast('マイクがつながっていないため、録音を始めませんでした。マイクの許可や接続を確かめてから、もう一度「録音開始」を押してください',7000);
      return
    }
  
    navigator.storage?.persist?.().catch(()=>{});
  
    try{
      const est=await navigator.storage?.estimate?.();
      if(est&&est.quota&&est.quota-est.usage<150*1048576)toast(`ブラウザの空き容量が少なくなっています（残り約${Math.max(0,Math.round((est.quota-est.usage)/1048576))}MB）。長い録音は途中で保存できなくなる可能性があります`,7000)
    }catch(_){}
  
    const tracks=['mix'];
    if(cfg.rec.keepVoice)tracks.push('voice');
    if(cfg.rec.keepProg)tracks.push('prog');
  
    rec.take={
      id:id(),
      name:(curProgram()?.name||'フリー')+' '+stamp(),
      programId:curProgram()?.id||null,
      created:Date.now(),
      sampleRate:ctx.sampleRate,
      frames:0,
      tracks,
      markers:[],
      status:'recording',
      startBgmId:bgmPlaying?.trackId||bgmLoadingId||null
    };
  
    rec.pending={mix:[],voice:[],prog:[]};
    rec.pendingFrames=0;
    rec.idx={mix:0,voice:0,prog:0};
    rec.frames=0;
    rec.retry=[];
    rec.saveTrouble=false;
    rec.recovered=false;
  
    await idbPut('takes',rec.take.id,{...rec.take});
  
    rec.state='recording';
    if(rec.mode==='worklet')rec.node.port.postMessage('start');
  
    if(bgmPlaying){
      const b=cfg.bgms.find(x=>x.id===bgmPlaying.trackId);
      if(b)addMarker('BGM再生中：'+b.name,true)
    }
  
    renderRecState();
    renderTakes();
  
    if(!opts.noAutoBgm){
      const pb=progBgm();
      if(curProgram()?.autoBgm&&pb&&!bgmPlaying&&!bgmLoadingId){
        rec.take.startBgmId=pb.id;
        idbPut('takes',rec.take.id,{...rec.take}).catch(()=>{});
        playBgm(pb,{restart:true})
      }
    }
 
  }catch(e){
    console.error(e);
    rec.state='idle';
    rec.take=null;
    renderRecState();
    toast('録音を開始できませんでした')
  }

}

function pauseRec(){
  if(rec.state!=='recording')return;
  rec.state='paused';
  if(rec.mode==='worklet')rec.node.port.postMessage('pause');
  addMarker('一時停止',true);
  renderRecState()
}

function resumeRec(){
  if(rec.state!=='paused')return;
  rec.state='recording';
  if(rec.mode==='worklet')rec.node.port.postMessage('start');
  addMarker('再開',true);
  renderRecState()
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function stopRec(){
 
  if(rec.state==='idle'||rec.state==='starting'||rec.state==='stopping'||rec.state==='ending')return;
 
  if(cfg.rec.fadeOnStop&&bgmPlaying&&rec.state==='recording'){
  
    rec.state='ending';
    renderRecState();
    if(micGain){
      const t0=ctx.currentTime;
      micGain.gain.cancelScheduledValues(t0);
      micGain.gain.setValueAtTime(micGain.gain.value,t0);
      micGain.gain.linearRampToValueAtTime(0,t0+.12)
    }
    const b=cfg.bgms.find(x=>x.id===bgmPlaying.trackId);
    addMarker('BGMフェードアウト：'+(b?.name||''),true);
  
    bgmSerial++;
    await fadeStop(bgmPlaying,cfg.rec.fadeSec);
    await sleep(500);
 
  }
 
  rec.state='stopping';
  renderRecState();
 
  const t=rec.take;
  let ok=true,
    err='';
 
  try{
  
    if(rec.mode==='worklet'){
      await new Promise(resolve=>{
        rec.stopResolve=resolve;
        rec.node.port.postMessage('stop');
        setTimeout(resolve,1500)
      })
    }
  
    await flushChunks();
  
    for(let i=0;i<3&&rec.retry.length;i++){
      await sleep(500);
      await flushChunks()
    }
  
    ok=!rec.retry.length;
    if(!ok)err=rec.saveErr;
  
    t.frames=rec.frames;
    t.status=ok?'done':'partial';
    t.missingSec=ok?0:Math.ceil(unsavedSec(rec.retry,t.sampleRate));
    if(rec.recovered)t.retried=true;
  
    try{
      await idbPut('takes',t.id,{...t})
    }catch(e){
      console.error(e);
      ok=false;
      err=errText(e)
    }
 
  }catch(e){
    console.error(e);
    ok=false;
    err=err||errText(e)
  }
 finally{
  
    if(!ok)rescue={take:{...t},jobs:rec.retry.slice(),err:err||'原因不明'};
  
    rec.retry=[];
    rec.saveTrouble=false;
  
    lastTakeId=t.id;
    rec.take=null;
    rec.state='idle';
    if(micGain){
      micGain.gain.cancelScheduledValues(ctx.currentTime);
      micGain.gain.setValueAtTime(micMuted?0:cfg.rec.micVolume/100,ctx.currentTime)
    }
    if(bgmLow&&!bgmPlaying){
      bgmLow=false;
      bgmTrim.gain.setTargetAtTime(1,ctx.currentTime,.05);
      renderBgmLow()
    }
  
    renderRecState();
    renderSaveWarn();
    try{
      await renderTakes()
    }catch(_){}
    updateStorage();
 
  }
 
  if(ok)toast(rec.recovered?`「${t.name}」を保存しました（${fmtTime(t.frames/t.sampleRate)}）。途中で保存できない時間がありましたが、すべて保存し直しました`:`「${t.name}」を保存しました（${fmtTime(t.frames/t.sampleRate)}）`,rec.recovered?6000:3500);
 else toast('録音の一部を保存できませんでした。録音欄の案内から残せます',6000);
 
  rec.recovered=false;
  releaseBoostHoldIfQuiet();

}

function addMarker(label,auto=false){
 
  const t=rec.take;
  if(!t||rec.state==='idle'||rec.state==='stopping')return;/* ending中も記録 */
 
  const n=t.markers.filter(m=>!m.auto).length+1;
  t.markers.push({t:rec.frames/t.sampleRate,label:label||('マーカー'+n),auto});
 
  if(!auto)toast('マーカー'+n+'：'+fmtTime(rec.frames/t.sampleRate));
  renderLiveMarkers();

}

function fmtTime(sec,tenths=false){
  sec=Math.max(0,sec);
  const h=Math.floor(sec/3600),
    m=Math.floor(sec/60)%60,
    s=Math.floor(sec)%60,
    p=n=>String(n).padStart(2,'0');
  return (h?h+':'+p(m):p(m))+':'+p(s)+(tenths?'.'+Math.floor(sec*10)%10:'')
}

function renderTimer(){
  const t=rec.take,
    sec=t?rec.frames/t.sampleRate:0,
    str=fmtTime(sec,true),
    i=str.lastIndexOf('.');
  $('#timer').innerHTML=esc(str.slice(0,i))+'<small>'+esc(str.slice(i))+'</small>'
}

function renderRecState(){
  if(rec.state!=='idle'&&rec.state!=='paused')boostHold=true;
  applyMonitor();
  if(cfg?.programs)renderPrograms();
 
  const lamp=$('#recLamp'),
    txt=$('#recLampText'),
    st=rec.state;
 
  lamp.className='lamp '+(st==='recording'||st==='ending'?'rec':st==='paused'?'pause':micLive()?'ready':'');
 
  txt.textContent=st==='starting'?'マイク・録音の準備中…':st==='ending'?'BGMフェードアウト中…':st==='recording'?'録音中':st==='paused'?'一時停止中':st==='stopping'?'保存中…':micLive()?'待機中':'マイク未接続';
 
  const rb=$('#recBtn');
  rb.textContent=st==='recording'?'‖ 一時停止':st==='paused'?'● 再開':'● 録音開始';
  rb.classList.toggle('on',st==='recording');
  rb.disabled=st==='starting'||st==='stopping'||st==='ending';
 
  $('#stopRecBtn').disabled=!(st==='recording'||st==='paused');
  const rb2=$('#retakeBtn');
  rb2.disabled=!(st==='recording'||st==='paused'||(st==='idle'&&lastTakeId));
  if(rb2.dataset.armed!=='1')rb2.textContent='↺ 録り直し';
  const db2=$('#discardBtn');
  db2.disabled=!(st==='recording'||st==='paused');
  if(db2.dataset.armed!=='1')db2.textContent='✕ 停止して破棄';
 
  const busy=st!=='idle';
  for(const s of ['#micSelect','#optEc','#optNs','#optAgc','#micBtn','#importBtn','#keepVoice','#keepProg'])$(s).disabled=busy;
 
  if(st==='idle')$('#timer').innerHTML='00:00<small>.0</small>';

}

function renderLiveMarkers(){
  const el=document.getElementById('liveMarkers');
  if(el&&rec.take)el.innerHTML=markerList(rec.take.markers)
}

function markerList(ms){
  return ms.length?ms.map(m=>`<li><time>${fmtTime(m.t,true)}</time><span>${esc(m.label)}</span></li>`).join(''):'<li>なし</li>'
}

/* ===================== テイク一覧・書き出し ===================== */

const TRACK_INFO={mix:{label:'ミックス',ch:2},voice:{label:'声だけ',ch:1},prog:{label:'BGM＋効果音',ch:2}};

const busyTakes=new Map();

async function loadTakes(){
  return (await idbAll('takes')).sort((a,b)=>b.created-a.created)
}

async function renderTakes(){
 
  const list=await loadTakes(),
    box=$('#takes');
 
  await coverUrl('default');
  for(const pr of cfg.programs){
    const k=activeProgCoverKey(pr.id);
    if(k)await coverUrl(k)
  }
  for(const t of list)if(t.cover)await coverUrl(t.id);
 
  const openState=new Map([...box.querySelectorAll('details[data-take]')].map(d=>[d.dataset.take,d.open]));
 
  const players=new Map([...box.querySelectorAll('audio[data-take]')].map(a=>[a.dataset.take,a]));
 
  if(!list.length){
    box.innerHTML='<div class="empty">まだ録音はありません。<br>「● 録音開始」を押すと、ここにテイクが並びます。</div>';
    return
  }
 
  box.innerHTML=list.map(t=>{
  
    const live=rec.take?.id===t.id,
      dur=fmtTime((live?rec.frames:t.frames)/t.sampleRate),
      broken=t.status==='recovered'||(t.status==='recording'&&!live);
  
    const mk=t.markers||[];
  
    return `<article class="take ${live?'live':''}" data-id="${esc(t.id)}">
   <div class="take-top"><button class="take-cover ${t.cover?'own':(t.programId&&coverUrls.get(activeProgCoverKey(t.programId)))||coverUrls.get('default')?'inherit':''}" data-take-cover="${esc(t.id)}" title="このテイクの動画用画像（押して変更）" style="${coverStyle(t)}">${t.cover||(t.programId&&coverUrls.get(activeProgCoverKey(t.programId)))||coverUrls.get('default')?'':'画像'}</button><input class="take-name" data-rename="${esc(t.id)}" value="${esc(t.name)}" aria-label="テイク名" maxlength="60"><button class="btn danger" data-del="${esc(t.id)}" ${live||busyTakes.has(t.id)?'disabled':''}>削除</button></div>
   <div class="take-meta">${esc(stamp(new Date(t.created)))} · ${live?'録音中':dur} · ${t.sampleRate/1000}kHz · ${t.tracks.map(k=>TRACK_INFO[k].label).join('／')}${broken?' · <span class="warn">途中で閉じられたため、保存済みの部分まで復旧</span>':''}${t.status==='partial'?` · <span class="warn">約${t.missingSec||'?'}秒分を保存できませんでした</span>`:''}</div>
   ${live?'':`<div class="take-play" data-player="${esc(t.id)}"><button class="btn primary" data-listen="${esc(t.id)}">▶ 試聴する</button></div>`}
   ${live?'':`<div class="take-actions">${t.tracks.map(k=>`<button class="btn" data-wav="${esc(t.id)}" data-track="${k}">${TRACK_INFO[k].label} WAV</button>`).join('')}<button class="btn gold" data-mp3="${esc(t.id)}" data-track="mix">ミックス MP3</button><button class="btn primary" data-video="${esc(t.id)}">動画を書き出す</button>${t.cover?`<button class="btn" data-uncover="${esc(t.id)}">画像を共通に戻す</button>`:''}${t.tracks.includes('voice')?`<button class="btn" data-mp3="${esc(t.id)}" data-track="voice">声だけ MP3</button>`:''}</div>`}
   <div class="take-progress" data-progress="${esc(t.id)}">${esc(busyTakes.get(t.id)||'')}</div>
   <details class="markers" data-take="${esc(t.id)}" ${live||openState.get(t.id)?'open':''}><summary>BGM操作の記録（${mk.length}）</summary><ol ${live?'id="liveMarkers"':''}>${markerList(mk)}</ol>${!live&&mk.length?`<button class="btn" style="margin-top:5px" data-copy="${esc(t.id)}">記録をコピー</button>`:''}</details>
  </article>`
  }).join('');
 
  for(const [tid,audio] of players){
    const slot=box.querySelector(`[data-player="${CSS.escape(tid)}"]`);
    if(slot){
      slot.replaceChildren(audio)
    }
  }

}

async function trackKeys(t,track){
  return idbKeys('chunks',chunkRange(t.id,track))
}

function wavHeader(ch,rate,dataBytes){
  const b=new ArrayBuffer(44),
    v=new DataView(b),
    w=(o,s)=>{
    for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))
  };
 
  w(0,'RIFF');
  v.setUint32(4,36+dataBytes,true);
  w(8,'WAVE');
  w(12,'fmt ');
  v.setUint32(16,16,true);
  v.setUint16(20,1,true);
  v.setUint16(22,ch,true);
  v.setUint32(24,rate,true);
  v.setUint32(28,rate*ch*2,true);
  v.setUint16(32,ch*2,true);
  v.setUint16(34,16,true);
  w(36,'data');
  v.setUint32(40,dataBytes,true);
  return b
}

async function* readChunks(t,track){
  for(const k of await trackKeys(t,track)){
    const blob=await idbGet('chunks',k);
    if(blob)yield new Int16Array(await blob.arrayBuffer())
  }
}

async function scanPeak(t,track,progress){
  let peak=0,
    done=0;
  const total=(await trackKeys(t,track)).length||1;
  for await(const a of readChunks(t,track)){
    for(let i=0;i<a.length;i++){
      const v=a[i]<0?-a[i]:a[i];
      if(v>peak)peak=v
    }
    progress?.(++done/total)
  }
  return peak
}

async function normGain(t,track,progress){
  if(!cfg.rec.normalize)return 1;
  const peak=await scanPeak(t,track,progress);
  if(!peak)return 1;
  return Math.min(16,(32767*Math.pow(10,-1/20))/peak)
}

const scaleI16=(a,g)=>{
  if(g===1)return a;
  const o=new Int16Array(a.length);
  for(let i=0;i<a.length;i++){
    const v=Math.round(a[i]*g);
    o[i]=v>32767?32767:v<-32768?-32768:v
  }
  return o
};

async function buildWav(t,track,progress){
 
  const ch=TRACK_INFO[track].ch,
    keys=await trackKeys(t,track);
 
  if(!cfg.rec.normalize||!progress){
    const blobs=[];
    let bytes=0;
    for(const k of keys){
      const b=await idbGet('chunks',k);
      if(b){
        blobs.push(b);
        bytes+=b.size
      }
    }
    return new Blob([wavHeader(ch,t.sampleRate,bytes),...blobs],{type:'audio/wav'})
  }
 
  const g=await normGain(t,track,p=>progress('音量を解析中 '+Math.round(p*100)+'%'));
  const parts=[];
  let bytes=0,
    done=0;
 
  for await(const a of readChunks(t,track)){
    const s=scaleI16(a,g);
    parts.push(new Blob([s]));
    bytes+=s.byteLength;
    progress('WAVを作成中 '+Math.round(++done/keys.length*100)+'%')
  }
 
  return new Blob([wavHeader(ch,t.sampleRate,bytes),...parts],{type:'audio/wav'});

}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=resolve;
    s.onerror=()=>{
      s.remove();
      reject(Error('load failed'))
    };
    document.head.append(s)
  })
}

async function loadLame(){
  if(window.lamejs)return;
  try{
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js')
  }catch(_){
    await loadScript('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js')
  }
  if(!window.lamejs)throw Error('lamejs missing')
}

async function buildMp3(t,track,progress){
 
  progress('MP3変換の準備中…');
 
  try{
    await loadLame()
  }catch(e){
    throw Object.assign(Error('MP3変換用の部品を読み込めませんでした。インターネット接続をご確認ください'),{user:true})
  }
 
  const ch=TRACK_INFO[track].ch,
    keys=await trackKeys(t,track),
    g=await normGain(t,track,p=>progress('音量を解析中 '+Math.round(p*100)+'%'));
 
  const enc=new lamejs.Mp3Encoder(ch,t.sampleRate,+cfg.rec.mp3Rate),
    out=[];
  let done=0;
  const BLOCK=1152*20;
 
  for await(const raw of readChunks(t,track)){
  
    const a=scaleI16(raw,g),
      n=a.length/ch;
  
    if(ch===2){
      const L=new Int16Array(n),
        R=new Int16Array(n);
      for(let i=0;i<n;i++){
        L[i]=a[2*i];
        R[i]=a[2*i+1]
      }
      for(let i=0;i<n;i+=BLOCK){
        const m=enc.encodeBuffer(L.subarray(i,i+BLOCK),R.subarray(i,i+BLOCK));
        if(m.length)out.push(new Uint8Array(m))
      }
    }
  else{
      for(let i=0;i<n;i+=BLOCK){
        const m=enc.encodeBuffer(a.subarray(i,i+BLOCK));
        if(m.length)out.push(new Uint8Array(m))
      }
    }
  
    progress('MP3に変換中 '+Math.round(++done/keys.length*100)+'%');
    await new Promise(r=>setTimeout(r,0));
 
  }
 
  const end=enc.flush();
  if(end.length)out.push(new Uint8Array(end));
 
  return new Blob(out,{type:'audio/mpeg'});

}
/* ===================== 動画の入れ物（WebM / MP4）を組み立てる ===================== */

const Mux=(()=>{
 
  const te=new TextEncoder();
 
  const u=(n,bytes)=>{
    const a=new Uint8Array(bytes);
    for(let i=bytes-1;i>=0;i--){
      a[i]=n%256;
      n=Math.floor(n/256)
    }
    return a
  };
 
  const cat=parts=>{
    let n=0;
    for(const p of parts)n+=p.length;
    const o=new Uint8Array(n);
    let off=0;
    for(const p of parts){
      o.set(p,off);
      off+=p.length
    }
    return o
  };
 
  const total=parts=>parts.reduce((s,p)=>s+p.length,0);
 /* ---- WebM (Matroska) ---- */
 
  const vint=n=>{
    for(let len=1;len<=8;len++){
      if(n<Math.pow(2,7*len)-1){
        const a=u(n,len);
        a[0]|=0x80>>(len-1);
        return a
      }
    }
    throw Error('size')
  };
 
  const idb=id=>u(id,Math.ceil(id.toString(16).length/2));
 
  const el=(id,data)=>{
    const d=Array.isArray(data)?cat(data):data;
    return cat([idb(id),vint(d.length),d])
  };
 
  const uintEl=(id,n)=>{
    let b=1;
    while(n>=Math.pow(2,8*b))b++;
    return el(id,u(n,b))
  };
 
  const uint8El=(id,n)=>el(id,u(n,8));
 
  const floatEl=(id,f)=>{
    const b=new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0,f);
    return el(id,b)
  };
 
  const strEl=(id,s)=>el(id,te.encode(s));
 
  function opusHead(channels,sampleRate,preSkip=312){
    const b=new Uint8Array(19),
      v=new DataView(b.buffer);
    b.set(te.encode('OpusHead'));
    v.setUint8(8,1);
    v.setUint8(9,channels);
    v.setUint16(10,preSkip,true);
    v.setUint32(12,sampleRate,true);
    v.setInt16(16,0,true);
    v.setUint8(18,0);
    return b
  }
 
  function webm({video,audio,durationMs}){
  
    const head=audio.description&&audio.description.length>=19&&String.fromCharCode(...audio.description.slice(0,8))==='OpusHead'?audio.description:opusHead(audio.channels,audio.sampleRate);
  
    const preSkip=new DataView(head.buffer,head.byteOffset).getUint16(10,true);
  
    const ebml=el(0x1A45DFA3,[uintEl(0x4286,1),uintEl(0x42F7,1),uintEl(0x42F2,4),uintEl(0x42F3,8),strEl(0x4282,'webm'),uintEl(0x4287,4),uintEl(0x4285,2)]);
  
    const info=el(0x1549A966,[uintEl(0x2AD7B1,1000000),strEl(0x4D80,'kissa-studio'),strEl(0x5741,'kissa-studio'),floatEl(0x4489,durationMs)]);
  
    const tracks=el(0x1654AE6B,[
   el(0xAE,[uintEl(0xD7,1),uintEl(0x73C5,1),uintEl(0x83,1),strEl(0x86,video.codec),el(0xE0,[uintEl(0xB0,video.width),uintEl(0xBA,video.height)])]),
   el(0xAE,[
        uintEl(0xD7,2),
        uintEl(0x73C5,2),
        uintEl(0x83,2),
        strEl(0x86,'A_OPUS'),
        el(0x63A2,head),
        uintEl(0x56AA,Math.round(preSkip/48000*1e9)),
        uintEl(0x56BB,80000000),
        el(0xE1,[floatEl(0xB5,48000),uintEl(0x9F,audio.channels)])
      ])]);
  
    const blocks=[...video.chunks.map(c=>({...c,track:1})),...audio.chunks.map(c=>({...c,track:2,key:true}))].map(b=>({...b,ms:Math.max(0,Math.round(b.ts/1000))})).sort((a,b)=>a.ms-b.ms||a.track-b.track);
  
    const clusters=[],
      cueList=[];
    let cur=null;
  
    const close=()=>{
      if(cur){
        clusters.push({ms:cur.ms,cue:cur.cue,bytes:el(0x1F43B675,[uintEl(0xE7,cur.ms),...cur.blocks])})
      }
    };
  
    for(const b of blocks){
   
      if(!cur||(b.track===1&&b.key)||b.ms-cur.ms>30000){
        close();
        cur={ms:b.ms,cue:b.track===1&&b.key,blocks:[]}
      }
   
      const hdr=new Uint8Array(4);
      hdr[0]=0x80|b.track;
      new DataView(hdr.buffer).setInt16(1,b.ms-cur.ms);
      hdr[3]=b.key?0x80:0;
   
      cur.blocks.push(el(0xA3,cat([hdr,b.data])));
  
    }
  
    close();
  
    const seek=(id,pos)=>el(0x4DBB,[el(0x53AB,idb(id)),uint8El(0x53AC,pos)]);
  
    const seekLen=el(0x114D9B74,[seek(0x1549A966,0),seek(0x1654AE6B,0),seek(0x1C53BB6B,0)]).length;
  
    const posInfo=seekLen,
      posTracks=posInfo+info.length;
    let pos=posTracks+tracks.length;
  
    for(const c of clusters){
      if(c.cue)cueList.push(el(0xBB,[uintEl(0xB3,c.ms),el(0xB7,[uintEl(0xF7,1),uint8El(0xF1,pos)])]));
      pos+=c.bytes.length
    }
  
    const cues=el(0x1C53BB6B,cueList.length?cueList:[el(0xBB,[uintEl(0xB3,0),el(0xB7,[uintEl(0xF7,1),uint8El(0xF1,posTracks+tracks.length)])])]);
  
    const seekHead=el(0x114D9B74,[seek(0x1549A966,posInfo),seek(0x1654AE6B,posTracks),seek(0x1C53BB6B,pos)]);
  
    const body=[seekHead,info,tracks,...clusters.map(c=>c.bytes),cues];
  
    const segSize=u(total(body),8);
    segSize[0]=0x01;
  
    return [ebml,cat([idb(0x18538067),segSize]),...body];
 
  }
 /* ---- MP4 (H.264 + AAC) ---- */
 
  const box=(type,...parts)=>{
    const body=cat(parts.flat());
    return cat([u(body.length+8,4),te.encode(type),body])
  };
 
  const fbox=(type,v,flags,...parts)=>box(type,u(v,1),u(flags,3),...parts);
 
  const MATRIX=cat([0x00010000,0,0,0,0x00010000,0,0,0,0x40000000].map(x=>u(x,4)));
 
  const rle=list=>{
    const out=[];
    for(const d of list){
      const last=out[out.length-1];
      if(last&&last[1]===d)last[0]++;else out.push([1,d])
    }
    return out
  };
 
  function aacConfig(sampleRate,channels){
    const rates=[96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000,7350];
    const fi=rates.indexOf(sampleRate);
    return new Uint8Array([(2<<3)|(fi>>1),((fi&1)<<7)|(channels<<3)])
  }
 
  function desc(tag,body){
    return cat([new Uint8Array([tag,body.length]),body])
  }
 
  function mp4({video,audio,durationMs}){
  
    const vs=video.chunks,
      as=audio.chunks,
      VTS=90000,
      ATS=audio.sampleRate;
  
    const order=[...vs.map((c,i)=>({c,t:1,i})),...as.map((c,i)=>({c,t:2,i}))].sort((a,b)=>a.c.ts-b.c.ts||a.t-b.t);
  
    const dataSize=total(order.map(o=>o.c.data));
  
    const large=dataSize+16>0xFFFFFFFF, 
      co64=dataSize+(1<<24)>0xFFFFFFFF;
  
    const vDur=vs.map((c,i)=>Math.max(1,Math.round(((i+1<vs.length?vs[i+1].ts:durationMs*1000)-c.ts)*VTS/1e6)));
  
    const aDur=as.map((c,i)=>i+1<as.length?Math.max(1,Math.round((as[i+1].ts-c.ts)*ATS/1e6)):1024);
  
    const asc=aacConfig(audio.sampleRate,audio.channels);
  
    function build(offsets){
   
      const stco=list=>co64?fbox('co64',0,0,u(list.length,4),...list.map(x=>u(x,8))):fbox('stco',0,0,u(list.length,4),...list.map(x=>u(x,4)));
   
      const stts=d=>{
        const r=rle(d);
        return fbox('stts',0,0,u(r.length,4),...r.map(([n,v])=>cat([u(n,4),u(v,4)])))
      };
   
      const stsc=fbox('stsc',0,0,u(1,4),u(1,4),u(1,4),u(1,4));
   
      const stsz=list=>fbox('stsz',0,0,u(0,4),u(list.length,4),...list.map(c=>u(c.data.length,4)));
   
      const dinf=box('dinf',fbox('dref',0,0,u(1,4),fbox('url ',0,1)));
   
      const hdlr=(t,name)=>fbox('hdlr',0,0,u(0,4),te.encode(t),new Uint8Array(12),te.encode(name+'\0'));
   
      const tkhd=(id,dur,vol,w,h)=>fbox('tkhd',0,3,u(0,4),u(0,4),u(id,4),u(0,4),u(dur,4),new Uint8Array(8),u(0,2),u(0,2),u(vol,2),u(0,2),MATRIX,u(w*65536,4),u(h*65536,4));
   
      const mdhd=(ts,dur)=>fbox('mdhd',0,0,u(0,4),u(0,4),u(ts,4),u(dur,4),u(0x55C4,2),u(0,2));
   
      const avc1=box('avc1',new Uint8Array(6),u(1,2),new Uint8Array(16),u(video.width,2),u(video.height,2),u(0x00480000,4),u(0x00480000,4),u(0,4),u(1,2),new Uint8Array(32),u(0x18,2),u(0xFFFF,2),box('avcC',video.description));
   
      const esds=fbox('esds',0,0,desc(3,cat([u(1,2),u(0,1),desc(4,cat([u(0x40,1),u(0x15,1),u(0,3),u(audio.bitrate||192000,4),u(audio.bitrate||192000,4),desc(5,asc)])),desc(6,new Uint8Array([2]))])));
   
      const mp4a=box('mp4a',new Uint8Array(6),u(1,2),new Uint8Array(8),u(audio.channels,2),u(16,2),u(0,2),u(0,2),u(ATS*65536,4),esds);
   
      const keys=vs.map((c,i)=>c.key?i+1:0).filter(Boolean);
   
      const vTrak=box('trak',tkhd(1,durationMs,0,video.width,video.height),box('mdia',mdhd(VTS,vDur.reduce((a,b)=>a+b,0)),hdlr('vide','VideoHandler'),box('minf',fbox('vmhd',0,1,new Uint8Array(8)),dinf,box('stbl',fbox('stsd',0,0,u(1,4),avc1),stts(vDur),fbox('stss',0,0,u(keys.length,4),...keys.map(k=>u(k,4))),stsc,stsz(vs),stco(offsets.v)))));
   
      const aTrak=box('trak',tkhd(2,durationMs,0x0100,0,0),box('mdia',mdhd(ATS,aDur.reduce((a,b)=>a+b,0)),hdlr('soun','SoundHandler'),box('minf',fbox('smhd',0,0,u(0,4)),dinf,box('stbl',fbox('stsd',0,0,u(1,4),mp4a),stts(aDur),stsc,stsz(as),stco(offsets.a)))));
   
      const mvhd=fbox('mvhd',0,0,u(0,4),u(0,4),u(1000,4),u(durationMs,4),u(0x00010000,4),u(0x0100,2),new Uint8Array(10),MATRIX,new Uint8Array(24),u(3,4));
   
      return box('moov',mvhd,vTrak,aTrak);
  
    }
  
    const ftyp=box('ftyp',te.encode('isom'),u(0x200,4),te.encode('isom'),te.encode('iso2'),te.encode('avc1'),te.encode('mp41'));
  
    const mdatHead=large?cat([u(1,4),te.encode('mdat'),u(dataSize+16,8)]):cat([u(dataSize+8,4),te.encode('mdat')]);
  
    const zero={v:vs.map(()=>0),a:as.map(()=>0)};
  
    const base=ftyp.length+build(zero).length+mdatHead.length;
  
    const offsets={v:[],a:[]};
    let off=base;
    for(const o of order){
      (o.t===1?offsets.v:offsets.a)[o.i]=off;
      off+=o.c.data.length
    }
  
    return [ftyp,build(offsets),mdatHead,...order.map(o=>o.c.data)];
 
  }
 
  const stripAdts=d=>d.length>9&&d[0]===0xFF&&(d[1]&0xF6)===0xF0?d.subarray((d[1]&1)?7:9):d;
 
  return {webm,mp4,stripAdts};

})();

/* ===================== サムネイルと動画書き出し ===================== */

const coverUrls=new Map();
let coverTarget=null;
// 表示用の画像は、小さく縮めてページ内に埋め込める形（data:）にする。
// プレビュー画面などでは、ブラウザ内の一時的な住所（blob:）の画像表示が禁止されていることがあるため

async function thumbUrl(blob,max=512){
 
  try{
    const bmp=await createImageBitmap(blob);
    const k=Math.min(1,max/Math.max(bmp.width,bmp.height)),
      w=Math.max(1,Math.round(bmp.width*k)),
      h=Math.max(1,Math.round(bmp.height*k));
  
    const c=document.createElement('canvas');
    c.width=w;
    c.height=h;
    c.getContext('2d').drawImage(bmp,0,0,w,h);
    bmp.close();
  
    return /png|webp|gif/.test(blob.type)?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.88)
  }
 catch(_){
    return await new Promise(res=>{
      const r=new FileReader();
      r.onload=()=>res(r.result);
      r.onerror=()=>res(null);
      r.readAsDataURL(blob)
    })
  }

}

async function coverUrl(key){
  if(coverUrls.has(key))return coverUrls.get(key);
  const blob=db?await idbGet('assets','cover:'+key):null;
  const url=blob?await thumbUrl(blob):null;
  coverUrls.set(key,url);
  return url
}

function coverStyle(t){
  const url=t.cover?coverUrls.get(t.id):(t.programId&&coverUrls.get(activeProgCoverKey(t.programId)))||coverUrls.get('default');
  return url?`background-image:url('${url}')`:''
}

async function renderCover(){
  const url=await coverUrl('default'),
    el=$('#coverPreview');
  el.style.backgroundImage=url?`url('${url}')`:'';
  el.style.backgroundSize=cfg.rec.coverFit==='contain'?'contain':'cover';
  el.classList.toggle('set',!!url);
  el.textContent=url?'':'画像なし';
  $('#coverClear').disabled=!url
}

async function setCover(key,file){
 
  if(coverUrls.get(key))URL.revokeObjectURL(coverUrls.get(key));
  coverUrls.delete(key);
 
  if(file)await idbPut('assets','cover:'+key,file);else await idbDel('assets','cover:'+key);
 
  if(key!=='default'){
    const t=await idbGet('takes',key);
    if(t){
      t.cover=!!file;
      await idbPut('takes',t.id,t);
      if(rec.take?.id===t.id)rec.take.cover=t.cover
    }
  }
 
  await renderCover();
  await renderTakes();
  toast(file?'動画用の画像を設定しました':'画像を外しました');

}

$('#coverPick').onclick=()=>$('#coverFile').click();

$('#coverClear').onclick=()=>setCover('default',null);

$('#coverFile').onchange=e=>{
  const f=e.target.files[0];
  if(f)setCover('default',f);
  e.target.value=''
};

$('#takeCoverFile').onchange=e=>{
  const f=e.target.files[0];
  if(f&&coverTarget)setCover(coverTarget,f);
  e.target.value='';
  coverTarget=null
};

async function drawCover(blob,size,fit){
 
  const bmp=await createImageBitmap(blob),
    c=document.createElement('canvas');
  c.width=c.height=size;
  const g=c.getContext('2d');
 
  const cover=Math.max(size/bmp.width,size/bmp.height),
    contain=Math.min(size/bmp.width,size/bmp.height);
 
  const draw=s=>{
    const w=bmp.width*s,
      h=bmp.height*s;
    g.drawImage(bmp,(size-w)/2,(size-h)/2,w,h)
  };
 
  g.fillStyle='#000';
  g.fillRect(0,0,size,size);
  g.imageSmoothingQuality='high';
 
  if(fit==='contain'){
    g.filter='blur(30px) brightness(.85)';
    draw(cover*1.15);
    g.filter='none';
    draw(contain)
  }else draw(cover);
 
  bmp.close();
  return c;

}

function drawPlainCover(size,title){
 
  const c=document.createElement('canvas');
  c.width=c.height=size;
  const g=c.getContext('2d');
 
  const gr=g.createLinearGradient(0,0,0,size);
  gr.addColorStop(0,look.paper);
  gr.addColorStop(1,look.bg);
  g.fillStyle=gr;
  g.fillRect(0,0,size,size);
 
  g.strokeStyle=look.decor;
  g.lineWidth=size*.03;
  g.strokeRect(size*.05,size*.05,size*.9,size*.9);
 
  g.fillStyle=lookInk(look.paper);
  g.textAlign='center';
  g.textBaseline='middle';
  let fs=size*.075;
  g.font=`700 ${fs}px "Hiragino Sans","Yu Gothic",sans-serif`;
 
  while(g.measureText(title).width>size*.8&&fs>size*.03){
    fs*=.92;
    g.font=`700 ${fs}px "Hiragino Sans","Yu Gothic",sans-serif`
  }
 
  g.fillText(title,size/2,size/2);
 
  if(look.subtitle){
    g.fillStyle=look.accent;
    let sf=size*.03;
    g.font=`${sf}px "Hiragino Mincho ProN","Yu Mincho",serif`;
    while(g.measureText(look.subtitle).width>size*.8&&sf>size*.015){
      sf*=.92;
      g.font=`${sf}px "Hiragino Mincho ProN","Yu Mincho",serif`
    }
    g.fillText(look.subtitle,size/2,size*.76)
  }
  return c;

}


const EFFECT_ASSET='video-falling-image';

let previewToken=0,
  previewRaf=0,
  previewImage=null,
  videoJob=null;

const checkVideoJob=job=>{
  if(job?.cancelled)throw Object.assign(Error('動画の書き出しを中止しました'),{user:true})
};

function effectSettings(){
  const r=cfg.rec;
  return {
    mode:r.videoEffect,
    source:r.effectSource,
    count:+r.effectCount,
    speed:+r.effectSpeed,
    scale:+r.effectScale,
    opacity:+r.effectOpacity,
    fps:+r.videoFps
  }
}
// 季節の演出。time（秒）だけで位置が決まるので、プレビューと書き出しで同じ動きになる

const SEASON_FX={
 spring:{size:.06,img:.085,n:1},
 summer:{size:.032,img:.07,n:1},
 autumn:{size:.075,img:.1,n:.35},
 winter:{size:.042,img:.065,n:.8}
};
// Seasonal artwork: translucent botanical illustration and fine crystal filigree.
// Cache at high resolution; gradients and vein paths are painted once, not every frame.

const elegantFxCache=new Map();

function elegantSprite(kind,variant=0){
 
  const key=kind+':'+variant;
  if(elegantFxCache.has(key))return elegantFxCache.get(key);
 
  const c=document.createElement('canvas');
  c.width=c.height=256;
  const p=c.getContext('2d');
  p.translate(128,128);
  const R=78,
    T=Math.PI*2;
 
  const pathPetal=()=>{
    p.beginPath();
    p.moveTo(0,R*.96);
    p.bezierCurveTo(-R*.9,R*.22,-R*.67,-R*.7,-R*.19,-R*.9);
    p.quadraticCurveTo(-R*.07,-R*.9,0,-R*.7);
    p.quadraticCurveTo(R*.11,-R*.91,R*.22,-R*.85);
    p.bezierCurveTo(R*.76,-R*.52,R*.63,R*.55,0,R*.96);
    p.closePath()
  };
 
  function petal(){
    const f=p.createLinearGradient(-R*.5,-R*.8,R*.45,R);
    f.addColorStop(0,'#fff9fc');
    f.addColorStop(.28,'#fce5ee');
    f.addColorStop(.68,variant===1?'#efb3cc':'#f3c6d7');
    f.addColorStop(1,'#d984a7');
    pathPetal();
    p.fillStyle=f;
    p.fill();
    p.strokeStyle='#fff7fcaa';
    p.lineWidth=.9;
    p.stroke();
    p.save();
    pathPetal();
    p.clip();
    const glow=p.createRadialGradient(-R*.27,-R*.4,0,-R*.27,-R*.4,R*.85);
    glow.addColorStop(0,'#ffffffb0');
    glow.addColorStop(1,'#ffffff00');
    p.fillStyle=glow;
    p.fillRect(-R,-R,R*2,R*2);
    p.strokeStyle='#c77c9b40';
    p.lineWidth=.65;
    for(let k=-2;k<=2;k++){
      p.beginPath();
      p.moveTo(0,R*.84);
      p.bezierCurveTo(k*R*.09,R*.3,k*R*.15,-R*.2,k*R*.14,-R*.64);
      p.stroke()
    }
    p.restore()
  }
 
  if(kind==='petal')petal();
 else if(kind==='blossom'){
    for(let i=0;i<5;i++){
      p.save();
      p.rotate(i*T/5);
      p.translate(0,-R*.27);
      p.scale(.46,.64);
      petal();
      p.restore()
    }
    p.strokeStyle='#c4917eaa';
    p.lineWidth=.8;
    for(let i=0;i<13;i++){
      const a=i*T/13,
        x=Math.cos(a)*R*.2,
        y=Math.sin(a)*R*.2;
      p.beginPath();
      p.moveTo(0,0);
      p.lineTo(x,y);
      p.stroke();
      p.fillStyle='#f0d3a1';
      p.beginPath();
      p.arc(x,y,1.3,0,T);
      p.fill()
    }
  }
 else if(kind==='bubble'){
  
    const f=p.createRadialGradient(-R*.34,-R*.4,R*.02,0,0,R);
    f.addColorStop(0,'#ffffff03');
    f.addColorStop(.72,'#a9dce709');
    f.addColorStop(.91,'#e0c6ec20');
    f.addColorStop(1,'#bce7e940');
    p.fillStyle=f;
    p.beginPath();
    p.arc(0,0,R,0,T);
    p.fill();
  
    const edge=p.createLinearGradient(-R,-R,R,R);
    for(const [n,col]of [[0,'#fff8e9ee'],[.22,'#d1f9ffb0'],[.48,'#d8c1ea80'],[.7,'#efdbd380'],[1,'#aee8e9d0']])edge.addColorStop(n,col);
    p.strokeStyle=edge;
    p.lineWidth=1.55;
    p.stroke();
  
    p.lineCap='round';
    p.strokeStyle='#ffffffdd';
    p.lineWidth=2.4;
    p.beginPath();
    p.arc(0,0,R*.935,3.58,4.32);
    p.stroke();
    p.strokeStyle='#ffffff77';
    p.lineWidth=.8;
    p.beginPath();
    p.arc(0,0,R*.87,3.72,4.16);
    p.stroke();
    p.strokeStyle='#c2f5f5bb';
    p.lineWidth=1.1;
    p.beginPath();
    p.arc(0,0,R*.98,.45,1.18);
    p.stroke();
  
    const gl=p.createRadialGradient(-R*.53,-R*.61,0,-R*.53,-R*.61,R*.16);
    gl.addColorStop(0,'#ffffffb0');
    gl.addColorStop(1,'#ffffff00');
    p.fillStyle=gl;
    p.beginPath();
    p.arc(-R*.53,-R*.61,R*.16,0,T);
    p.fill();
 
  }
 else if(kind==='leaf'){
  
    p.save();
    p.scale(.86,1);
    const f=p.createLinearGradient(-R*.6,-R,R*.5,R);
    f.addColorStop(0,variant===1?'#f1d99b':'#efbf87');
    f.addColorStop(.42,variant===1?'#c79c54':'#c77a54');
    f.addColorStop(1,variant===1?'#967043':'#874b4a');
    p.beginPath();
  
    if(variant===1){
      p.moveTo(0,R*.8);
      p.bezierCurveTo(-R*.2,R*.15,-R*.85,-R*.05,-R*.84,-R*.6);
      p.bezierCurveTo(-R*.6,-R*.97,-R*.12,-R*.84,0,-R*.65);
      p.bezierCurveTo(R*.18,-R*.92,R*.58,-R*.93,R*.84,-R*.6);
      p.bezierCurveTo(R*.82,-R*.08,R*.2,R*.2,0,R*.8)
    }
  else{
      const points=[[0,.8],[-.16,.39],[-.59,.53],[-.46,.16],[-.91,-.03],[-.55,-.17],[-.64,-.65],[-.19,-.4],[0,-1],[.19,-.4],[.64,-.65],[.55,-.17],[.91,-.03],[.46,.16],[.59,.53],[.16,.39]];
      points.forEach(([x,y],i)=>i?p.lineTo(x*R,y*R):p.moveTo(x*R,y*R))
    }
    p.closePath();
    p.fillStyle=f;
    p.fill();
    p.strokeStyle='#f7d9a858';
    p.lineWidth=.7;
    p.stroke();
    p.save();
    p.clip();
    p.strokeStyle='#f9e5bf80';
    p.lineWidth=.85;
    p.beginPath();
    p.moveTo(0,R*.83);
    p.quadraticCurveTo(-R*.045,0,0,-R*.87);
    p.stroke();
    p.lineWidth=.65;
    for(let i=0;i<5;i++)for(const side of [-1,1]){
      p.beginPath();
      const y=R*(.47-i*.23);
      p.moveTo(0,y);
      p.quadraticCurveTo(side*R*.22,y-R*.16,side*R*(.47+(i===2?.23:0)),y-R*.34);
      p.stroke()
    }
    p.restore();
    p.strokeStyle='#ae855c';
    p.lineWidth=1.2;
    p.beginPath();
    p.moveTo(0,R*.73);
    p.quadraticCurveTo(R*.1,R*.97,R*.04,R*1.16);
    p.stroke();
    p.restore();
 
  }
 else if(kind==='snow'){
  
    const glow=p.createRadialGradient(0,0,0,0,0,R*1.25);
    glow.addColorStop(0,'#d6eaff30');
    glow.addColorStop(.4,'#e4eeff12');
    glow.addColorStop(1,'#eaf5ff00');
    p.fillStyle=glow;
    p.fillRect(-110,-110,220,220);
  
    p.strokeStyle=variant===1?'#f5f1ffe6':'#e6f4ffe6';
    p.lineWidth=1.1;
    p.lineCap='round';
    for(let k=0;k<6;k++){
      p.save();
      p.rotate(k*T/6);
      p.beginPath();
      p.moveTo(0,0);
      p.lineTo(0,-R);
      for(const[t,b]of [[.38,.2],[.62,.2],[.81,.12]])for(const sign of [-1,1]){
        p.moveTo(0,-R*t);
        p.lineTo(sign*R*b,-R*(t+b*.68))
      }
      p.stroke();
      p.restore()
    }
  
    p.strokeStyle='#ffffffc0';
    p.lineWidth=.75;
    p.beginPath();
    for(let k=0;k<=6;k++){
      const a=k*T/6;
      const x=Math.sin(a)*R*.25,
        y=-Math.cos(a)*R*.25;
      k?p.lineTo(x,y):p.moveTo(x,y)
    }
    p.stroke();
    p.fillStyle='#ffffff';
    p.beginPath();
    p.arc(0,0,1.65,0,T);
    p.fill();
    for(const k of [1,4]){
      p.save();
      p.rotate(k*T/6);
      p.translate(0,-R*.81);
      p.strokeStyle='#ffffffc0';
      p.lineWidth=.7;
      p.beginPath();
      p.moveTo(-4,0);
      p.lineTo(4,0);
      p.moveTo(0,-4);
      p.lineTo(0,4);
      p.stroke();
      p.restore()
    }
 
  }
 else if(kind==='acorn'){
  // v0.4.3 acorn: soft lacquered nut, fine scale texture on the cap, no heavy outline. variant 1 = slender konara shape.
  
    const sl=variant===1;
    p.save();
    p.translate(0,R*.1);
  
    const nw=sl?R*.5:R*.6,
      nh=sl?R*.82:R*.66;
  
    const body=()=>{
      p.beginPath();
      p.moveTo(-nw,-R*.12);
      p.bezierCurveTo(-nw*1.02,nh*.62,-nw*.42,nh*1.02,0,nh*1.06);
      p.bezierCurveTo(nw*.42,nh*1.02,nw*1.02,nh*.62,nw,-R*.12);
      p.closePath()
    };
  
    const f=p.createLinearGradient(-nw,-R*.1,nw*.8,nh);
    f.addColorStop(0,'#d9a46d');
    f.addColorStop(.45,'#b9783f');
    f.addColorStop(1,'#7a4a2a');
    body();
    p.fillStyle=f;
    p.fill();
  
    p.save();
    body();
    p.clip();
    const hl=p.createRadialGradient(-nw*.42,nh*.18,0,-nw*.42,nh*.18,nw*.9);
    hl.addColorStop(0,'#fff1d8a8');
    hl.addColorStop(1,'#fff1d800');
    p.fillStyle=hl;
    p.fillRect(-R,-R,R*2,R*2);
  
    p.strokeStyle='#f6dcb340';
    p.lineWidth=.7;
    for(const k of [-.45,0,.45]){
      p.beginPath();
      p.moveTo(nw*k,-R*.08);
      p.quadraticCurveTo(nw*k*1.15,nh*.5,nw*k*.4,nh*.98);
      p.stroke()
    }
    p.restore();
  
    p.strokeStyle='#f3d2a655';
    p.lineWidth=.8;
    body();
    p.stroke();
  
    p.fillStyle='#6f4527';
    p.beginPath();
    p.ellipse(0,nh*1.06,1.6,2.2,0,0,T);
    p.fill();
  
    const cw=nw*1.12,
      ch=sl?R*.36:R*.42;
    const cap=()=>{
      p.beginPath();
      p.moveTo(-cw,-R*.06);
      p.bezierCurveTo(-cw*1.02,-R*.06-ch*1.05,cw*1.02,-R*.06-ch*1.05,cw,-R*.06);
      p.quadraticCurveTo(0,R*.06,-cw,-R*.06);
      p.closePath()
    };
  
    const cf=p.createLinearGradient(0,-R*.06-ch,0,R*.04);
    cf.addColorStop(0,'#a07a52');
    cf.addColorStop(1,'#5f4029');
    cap();
    p.fillStyle=cf;
    p.fill();
  
    p.save();
    cap();
    p.clip();
    p.strokeStyle='#e8cfa266';
    p.lineWidth=.6;
    for(let row=0;row<5;row++){
      const y=-R*.04-row*ch*.2;
      for(let i=-6;i<=6;i++){
        const x=i*cw*.17+(row%2)*cw*.085;
        p.beginPath();
        p.arc(x,y,cw*.085,Math.PI*1.05,Math.PI*1.95);
        p.stroke()
      }
    }
    p.restore();
  
    p.strokeStyle='#f0d6ab4d';
    p.lineWidth=.7;
    cap();
    p.stroke();
  
    p.strokeStyle='#6a472c';
    p.lineWidth=2.2;
    p.lineCap='round';
    p.beginPath();
    p.moveTo(0,-R*.06-ch*.78);
    p.quadraticCurveTo(R*.03,-R*.06-ch*.78-R*.12,R*.09,-R*.06-ch*.78-R*.2);
    p.stroke();
  
    p.restore();
 
  }
 else if(kind==='mote'){
  
    const f=p.createRadialGradient(0,0,0,0,0,R);
    f.addColorStop(0,'#fffef2dd');
    f.addColorStop(.13,'#f7f5e4a0');
    f.addColorStop(.42,'#eff7f12a');
    f.addColorStop(1,'#eff7f100');
    p.fillStyle=f;
    p.fillRect(-R,-R,2*R,2*R);
 
  }
 
  elegantFxCache.set(key,c);
  return c;

}

function drawElegantMotif(g,kind,r,variant=0){
  const c=elegantSprite(kind,variant);
  const span=r*256/78;
  g.drawImage(c,-span/2,-span/2,span,span)
}

function drawPetal(g,r){
  drawElegantMotif(g,'petal',r)
}

function drawBlossom(g,r){
  drawElegantMotif(g,'blossom',r)
}

function drawBubble(g,r){
  drawElegantMotif(g,'bubble',r)
}

function drawAcorn(g,r){
  drawElegantMotif(g,'leaf',r)
} // Retained caller name for older saved settings.

function drawSnow(g,r){
  drawElegantMotif(g,'snow',r)
}


function drawEffectFrame(canvas,base,time,settings,image){
 
  const g=canvas.getContext('2d'),
    S=canvas.width;
  g.clearRect(0,0,S,S);
  g.drawImage(base,0,0,S,S);
 
  const fx=SEASON_FX[settings.mode];
  if(!fx)return;
 
  const rand=n=>{
    const v=Math.sin(n*127.1+311.7)*43758.5453;
    return v-Math.floor(v)
  };
 
  const useImg=settings.source==='image'&&image,
    count=Math.max(1,Math.round(settings.count*fx.n)),
    sp=settings.speed/100,
    alpha=settings.opacity/100,
    TAU=Math.PI*2;
 
  let blossom=false;
  const put=(x,y,r,rot,sx,sy,wx,wy)=>{
    g.save();
    g.translate(x,y);
    if(wx)g.scale(wx,wy);
    g.rotate(rot);
    g.scale(sx,sy);
  
    if(useImg){
      const ratio=image.width/image.height,
        w=ratio>=1?r*2:r*2*ratio,
        h=ratio>=1?r*2/ratio:r*2;
      g.drawImage(image,-w/2,-h/2,w,h)
    }
  else if(settings.mode==='spring')(blossom?drawBlossom(g,r):drawPetal(g,r));else if(settings.mode==='summer')drawBubble(g,r);else if(settings.mode==='autumn')drawAcorn(g,r);else drawSnow(g,r);
  
    g.restore()
  };
 
  for(let i=0;i<count;i++){
  
    const a=k=>rand(i*13+k),
      depth=.45+a(1)*.55,
      r=(useImg?fx.img:fx.size)*S*(settings.scale/70)*depth*.5;
  
    g.globalAlpha=alpha*(.3+depth*.65);
  
    if(settings.mode==='winter'){
   // ゆったり降る雪：遅い落下と、大きくゆるやかな横揺れ
   
      const span=S+r*4,
        y=((a(2)*span+time*S*.06*sp*(.55+depth))%span)-r*2;
   
      const x=a(3)*S+Math.sin(time*.45*(.6+a(4))+a(5)*TAU)*S*.035;
   
      put(x,y,r,useImg?Math.sin(time*.3+a(6)*TAU)*.3:0,1,1);
  
    }else if(settings.mode==='spring'){
   // はらはらと散る花：斜めに流れ、ひらひら裏返りながら回る
   
      const span=S+r*6,
        prog=time*S*.11*sp*(.6+depth),
        y=((a(2)*span+prog)%span)-r*3;
   
      const x=((a(3)*S*1.4+prog*.45+Math.sin(time*1.3*(.7+a(4))+a(5)*TAU)*S*.05)%(S*1.4))-S*.2;
   
      const flip=Math.cos(time*.8*(.6+a(6))+a(7)*TAU);
      blossom=a(10)<.1;
   
      put(x,y,r,a(8)*TAU+time*(a(9)-.5)*.7,Math.max(.15,Math.abs(flip)),1);
  
    }else if(settings.mode==='summer'){
   // ぷくぷくソーダ：下から湧き出て、ゆらゆら揺れながら上へ（形と大きさは変えない）
   
      const span=S+r*6,
        rise=((a(2)*span+time*S*.15*sp*(.55+depth))%span),
        y=S+r*3-rise,
        pos=Math.min(1,Math.max(0,rise/S));
   
      const x=a(3)*S+Math.sin(time*2.6*(.6+a(4))+a(5)*TAU)*S*(.006+pos*.014);
   
      put(x,y,r*.8,0,1,1);
  
    }else{
   // Botanical leaves drift down with a slow turn; no bouncing or floor collision.
   
      const span=S+r*6,
        fall=time*S*.065*sp*(.5+depth),
        y=(a(2)*span+fall)%span-r*3;
   
      const x=((a(3)*S*1.25+fall*.18+Math.sin(time*.65+a(5)*TAU)*S*.045)%(S*1.25))-S*.125;
   
      put(x,y,r,a(6)*TAU+Math.sin(time*.45+a(7)*TAU)*.8, .45+.55*Math.abs(Math.cos(time*.7+a(8)*TAU)),1);
  
    }
 
  }
 
  g.globalAlpha=1;

}

function renderEffectControls(){
 
  if(!cfg)return;
 
  for(const key of ['videoEffect','effectSource','videoFps','effectCount','effectSpeed','effectScale','effectOpacity'])$('#'+key).value=cfg.rec[key];
 
  for(const key of ['effectCount','effectSpeed','effectScale','effectOpacity'])$('#'+key+'Val').textContent=cfg.rec[key]+(key==='effectCount'?'個':'%');

}

async function renderEffectAsset(){
  const b=await getAsset(EFFECT_ASSET);
  $('#effectImageName').textContent=b?(b.name||'登録済みの画像'):'未登録（透過PNGも使えます）';
  $('#effectImageClear').disabled=!b
}

function stopFilmPreview(){
  previewToken++;
  cancelAnimationFrame(previewRaf);
  previewImage?.close();
  previewImage=null;
  $('#filmPreview').hidden=true;
  $('#filmPreviewBtn').textContent='▶ 演出をプレビュー';
  $('#filmPreviewBtn').setAttribute('aria-pressed','false')
}

async function startFilmPreview(){
 
  stopFilmPreview();
  const token=previewToken;
  let image;
 
  try{
  
    const settings=effectSettings(),
      blob=await idbGet('assets','cover:default'),
      size=480;
  
    const base=blob?await drawCover(blob,size,cfg.rec.coverFit):drawPlainCover(size,look.title);
  
    if(settings.mode!=='none'&&settings.source==='image'){
      const b=await getAsset(EFFECT_ASSET);
      if(!b)throw Error('動かす画像を選んでください');
      image=await createImageBitmap(b)
    }
  
    if(token!==previewToken){
      image?.close();
      return
    }
  
    previewImage=image;
    const c=$('#filmPreview');
    c.hidden=false;
    $('#filmPreviewBtn').textContent='■ プレビューを止める';
    $('#filmPreviewBtn').setAttribute('aria-pressed','true');
    $('#filmStatus').textContent='共通サムネイルのプレビュー';
  
    let started;
    const tick=now=>{
      if(token!==previewToken)return;
      started??=now;
      drawEffectFrame(c,base,matchMedia('(prefers-reduced-motion: reduce)').matches?0:(now-started)/1000,settings,image);
      previewRaf=requestAnimationFrame(tick)
    };
  
    previewRaf=requestAnimationFrame(tick);
 
  }catch(e){
    image?.close();
    if(token===previewToken){
      stopFilmPreview();
      $('#filmStatus').textContent=e.message
    }
  }

}

document.addEventListener('visibilitychange',()=>{
  if(document.hidden)stopFilmPreview()
});

$('#filmPreviewBtn').onclick=()=>$('#filmPreview').hidden?startFilmPreview():stopFilmPreview();

for(const key of ['videoEffect','effectSource','videoFps','effectCount','effectSpeed','effectScale','effectOpacity'])$('#'+key).oninput=()=>{
  cfg.rec[key]=key==='videoEffect'||key==='effectSource'?$('#'+key).value:+$('#'+key).value;
  persist();
  renderEffectControls();
  if(!$('#filmPreview').hidden)startFilmPreview()
};

$('#effectImagePick').onclick=()=>$('#effectImageFile').click();

$('#effectImageFile').onchange=async e=>{
  const f=e.target.files[0];
  e.target.value='';
  if(!f)return;
  try{
    if(f.size>20*1048576)throw Error('画像は20MB以内で選んでください');
    const bmp=await createImageBitmap(f);
    if(bmp.width*bmp.height>40000000){
      bmp.close();
      throw Error('画像が大きすぎます。縮小してお試しください')
    }
    bmp.close();
    await putAsset(EFFECT_ASSET,f);
    cfg.rec.effectSource='image';
    if(cfg.rec.videoEffect==='none')cfg.rec.videoEffect='winter';
    persist();
    renderEffectControls();
    await renderEffectAsset();
    if(!$('#filmPreview').hidden)startFilmPreview();
    toast('動かす画像を登録しました')
  }catch(e){
    toast('画像を登録できませんでした：'+e.message,5000)
  }
};

$('#effectImageClear').onclick=async()=>{
  try{
    await deleteAsset(EFFECT_ASSET);
    if(cfg.rec.effectSource==='image')cfg.rec.effectSource='default';
    persist();
    renderEffectControls();
    await renderEffectAsset();
    stopFilmPreview()
  }catch(e){
    toast(errText(e))
  }
};

$('#cancelVideoBtn').onclick=()=>{
  if(videoJob){
    videoJob.cancelled=true;
    $('#filmStatus').textContent='中止しています…'
  }
};


const toU8=d=>!d?null:d instanceof ArrayBuffer?new Uint8Array(d.slice(0)):new Uint8Array(d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength));

async function pickVideoFormat(size,sr,forceWebm=false,fps=1){
 
  const ok=async(E,c)=>{
    try{
      return (await E.isConfigSupported(c)).supported
    }catch(_){
      return false
    }
  };
 
  const vbase={width:size,height:size,bitrate:size>=1080?2000000:1200000,framerate:fps};
 
  const aac={codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:2,bitrate:192000};
 
  if(window.VideoEncoder&&window.AudioEncoder){
  
    if(!forceWebm&&await ok(AudioEncoder,aac))for(const codec of ['avc1.640028','avc1.4d0028','avc1.420028']){
      const v={...vbase,codec,latencyMode:'realtime',avc:{format:'avc'}};
      if(await ok(VideoEncoder,v))return {kind:'mp4',v,a:aac}
    }
  
    const opus={codec:'opus',sampleRate:sr,numberOfChannels:2,bitrate:160000};
  
    if(await ok(AudioEncoder,opus))for(const [codec,name] of [['vp09.00.40.08','V_VP9'],['vp8','V_VP8']]){
      const v={...vbase,codec};
      if(await ok(VideoEncoder,v))return {kind:'webm',v,a:opus,vcodec:name}
    }
 
  }
 
  return null;

}

async function buildVideo(t,progress,forceWebm=false,options=null,job=null){
 
  checkVideoJob(job);
  options??={...effectSettings(),size:cfg.rec.videoSize,fit:cfg.rec.coverFit};
 
  const fps=options.mode==='none'?1:options.fps;
 
  const pk=t.programId&&activeProgCoverKey(t.programId);
 
  const blob=(t.cover&&await idbGet('assets','cover:'+t.id))||(pk&&await idbGet('assets','cover:'+pk))||await idbGet('assets','cover:default');

 
  const size=+options.size||1080,
    sr=t.sampleRate,
    fmt=await pickVideoFormat(size,sr,forceWebm,fps);
 
  if(!fmt)throw Object.assign(Error('このブラウザは動画の書き出しに対応していません。最新のChromeかEdgeでお試しください'),{user:true});
 
  progress('画像を準備中…');
  let canvas;
  try{
    canvas=blob?await drawCover(blob,size,options.fit):drawPlainCover(size,t.name)
  }catch(e){
    throw Object.assign(Error('画像を読み込めませんでした。別の画像でお試しください'),{user:true})
  }
 
  const g=await normGain(t,'mix',p=>progress('音量を解析中 '+Math.round(p*100)+'%'));
 
  const base=canvas;
  let effectImage=null;
 
  if(options.mode!=='none'&&options.source==='image'){
    const b=await getAsset(EFFECT_ASSET);
    if(!b)throw Object.assign(Error('動かす画像を選んでください'),{user:true});
    try{
      effectImage=await createImageBitmap(b)
    }catch(_){
      throw Object.assign(Error('動かす画像を読み込めませんでした'),{user:true})
    }
  }
 
  canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
 
  const vChunks=[],
    aChunks=[];
  let vDesc=null,
    aDesc=null,
    err=null;
 
  const grab=(list,c,extra)=>{
    const d=new Uint8Array(c.byteLength);
    c.copyTo(d);
    list.push({ts:c.timestamp,data:d,...extra})
  };
 
  let srcPeak=0,
    ae,
    ve;
 
  try{
 
    ae=new AudioEncoder({output:(c,m)=>{
        if(m?.decoderConfig?.description)aDesc=toU8(m.decoderConfig.description);
        grab(aChunks,c);
        if(fmt.kind==='mp4'){
          const last=aChunks[aChunks.length-1];
          last.data=Mux.stripAdts(last.data)
        }
      },error:e=>err=e});
    ae.configure(fmt.a);
 
    ve=new VideoEncoder({output:(c,m)=>{
        if(m?.decoderConfig?.description)vDesc=toU8(m.decoderConfig.description);
        grab(vChunks,c,{key:c.type==='key'})
      },error:e=>err=e});
    ve.configure(fmt.v);
  
    const keys=await trackKeys(t,'mix');
    let pos=0,
      done=0;
  
    for await(const raw of readChunks(t,'mix')){
   
      checkVideoJob(job);
      if(err)throw err;
      const a=scaleI16(raw,g),
        n=a.length/2,
        pl=new Float32Array(n*2);
   
      for(let i=0;i<n;i++){
        pl[i]=a[2*i]/32768;
        pl[n+i]=a[2*i+1]/32768
      }
   
      if(pos<sr*4)for(let i=0;i<Math.min(n,sr*4-pos);i++){
        const v=Math.abs(pl[i])+Math.abs(pl[n+i]);
        if(v>srcPeak)srcPeak=v
      }
   
      const ad=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(pos*1e6/sr),data:pl});
      ae.encode(ad);
      ad.close();
      pos+=n;
   
      while(ae.encodeQueueSize>6){
        checkVideoJob(job);
        if(err)throw err;
        await sleep(4)
      }
      progress('音声を変換中 '+Math.round(++done/keys.length*100)+'%');
  
    }
  
    await ae.flush();
    if(err)throw err;
  
    if(!pos)throw Object.assign(Error('このテイクに書き出せる音声がありません'),{user:true});
  
    const frames=Math.max(1,Math.ceil(pos/sr*fps));
  
    for(let i=0;i<frames;i++){
   
      checkVideoJob(job);
      if(err)throw err;
      drawEffectFrame(canvas,base,i/fps,options,effectImage);
      const ts=Math.round(i*1e6/fps),
        end=Math.min(Math.round((i+1)*1e6/fps),Math.round(pos*1e6/sr));
      const f=new VideoFrame(canvas,{timestamp:ts,duration:Math.max(1,end-ts)});
      ve.encode(f,{keyFrame:i%(fps*2)===0});
      f.close();
   
      while(ve.encodeQueueSize>3){
        checkVideoJob(job);
        if(err)throw err;
        await sleep(4)
      }
      if(i%15===0){
        progress('映像を作成中 '+Math.round(i/frames*100)+'%');
        await sleep(0)
      }
  
    }
  
    await ve.flush();
    if(err)throw err;
  
    progress('ファイルにまとめています…');
  
    const durationMs=Math.round(pos/sr*1000);
  
    const parts=fmt.kind==='mp4'
   ?Mux.mp4({
      durationMs,
      video:{width:size,height:size,description:vDesc,chunks:vChunks},
      audio:{sampleRate:sr,channels:2,description:aDesc,bitrate:192000,chunks:aChunks}
    })
   :Mux.webm({
      durationMs,
      video:{codec:fmt.vcodec,width:size,height:size,chunks:vChunks},
      audio:{sampleRate:sr,channels:2,description:aDesc,chunks:aChunks}
    });
  
    if(fmt.kind==='mp4'){
   
      progress('音声が入っているか確認中…');
   
      const ok=await verifyMp4Audio(vChunks,aChunks,{size,sr,vDesc,srcPeak});
   
      if(!ok){
        try{
          ae.close()
        }catch(_){}
        try{
          ve.close()
        }catch(_){}
        toast('MP4の音声を確認できなかったため、WebM形式で作り直します',5000);
        const v=await buildVideo(t,progress,true,options,job);
        v.fallback=true;
        return v
      }
  
    }
  
    return {blob:new Blob(parts,{type:fmt.kind==='mp4'?'video/mp4':'video/webm'}),ext:fmt.kind};
 
  }finally{
    effectImage?.close();
    try{
      ae.close()
    }catch(_){}
    try{
      ve.close()
    }catch(_){}
  }

}

async function verifyMp4Audio(vChunks,aChunks,{size,sr,vDesc,srcPeak}){
 // 冒頭約4秒だけの小さなMP4を作り、ブラウザ自身に音声を読ませて確かめる
 
  try{
  
    const lim=4e6,
      v=vChunks.filter(c=>c.ts<lim),
      a=aChunks.filter(c=>c.ts<lim);
    if(!a.length)return false;
  
    const parts=Mux.mp4({
      durationMs:4000,
      video:{width:size,height:size,description:vDesc,chunks:v.length?v:vChunks.slice(0,1)},
      audio:{sampleRate:sr,channels:2,chunks:a}
    });
  
    const buf=await new Blob(parts).arrayBuffer();
  
    const oc=new OfflineAudioContext(2,sr,sr);
    const decoded=await oc.decodeAudioData(buf);
  
    if(decoded.duration<=0)return false;
  
    if(srcPeak<0.01)return true;
  
    let peak=0;
    for(let c=0;c<decoded.numberOfChannels;c++){
      const d=decoded.getChannelData(c);
      for(let i=0;i<d.length;i++){
        const x=Math.abs(d[i]);
        if(x>peak)peak=x
      }
    }
  
    return peak>srcPeak*0.05;
 
  }catch(e){
    console.warn('MP4音声の確認に失敗',e);
    return false
  }

}

function safeName(s){
  return String(s).replace(/[\\/:*?"<>|]/g,'_').trim()||'recording'
}

function download(blob,name){
  const url=URL.createObjectURL(blob),
    a=document.createElement('a');
  a.href=url;
  a.download=name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000)
}

async function exportTake(takeId,track,kind){
 
  if(busyTakes.has(takeId)){
    toast('このテイクは書き出し中です');
    return
  }
 
  if(kind==='video'&&videoJob){
    toast('別の動画を書き出し中です');
    return
  }
 
  const t=await idbGet('takes',takeId);
  if(!t)return;
 
  if(busyTakes.has(takeId)||(kind==='video'&&videoJob)){
    toast('書き出し中です');
    return
  }
 
  let job=null;
  if(kind==='video'){
    job={cancelled:false};
    videoJob=job;
    $('#cancelVideoBtn').hidden=false;
    stopFilmPreview()
  }
 
  const el=()=>document.querySelector(`[data-progress="${CSS.escape(takeId)}"]`);
 
  const progress=msg=>{
    busyTakes.set(takeId,msg);
    const e=el();
    if(e)e.textContent=msg;
    if(job)$('#filmStatus').textContent=msg
  };
 
  try{
    progress(kind==='mp3'?'MP3変換の準備中…':'WAVを作成中…');
  
    if(kind==='video'){
      const v=await buildVideo(t,progress,false,null,job);
      checkVideoJob(job);
      download(v.blob,`${safeName(t.name)}.${v.ext}`);
      toast(`動画を書き出しました（${v.ext.toUpperCase()}・${(v.blob.size/1048576).toFixed(1)}MB）${v.fallback?'。MP4で音声を確認できなかったためWebMにしました':''}`,6000);
      return
    }
  
    const blob=kind==='mp3'?await buildMp3(t,track,progress):await buildWav(t,track,progress);
  
    download(blob,`${safeName(t.name)}_${({mix:'mix',voice:'voice',prog:'bgm-sfx'})[track]||track}.${kind}`);
    toast('書き出しました（'+(blob.size/1048576).toFixed(1)+'MB）');
 
  }catch(e){
    console.error(e);
    toast(e.user?e.message:'書き出しに失敗しました',4500)
  }
 finally{
    busyTakes.delete(takeId);
    const e=el();
    if(e)e.textContent='';
    if(job){
      videoJob=null;
      $('#cancelVideoBtn').hidden=true;
      $('#filmStatus').textContent=job.cancelled?'動画の書き出しを中止しました':''
    }
  }

}

async function listenTake(takeId,btn){
 
  const t=await idbGet('takes',takeId);
  if(!t)return;
  btn.disabled=true;
  btn.textContent='準備中…';
 
  try{
    const blob=await buildWav(t,'mix');
    const audio=document.createElement('audio');
    audio.controls=true;
    audio.dataset.take=takeId;
    audio.src=URL.createObjectURL(blob);
    btn.parentElement.replaceChildren(audio);
    audio.play().catch(()=>{})
  }
 catch(e){
    console.error(e);
    btn.disabled=false;
    btn.textContent='▶ 試聴する';
    toast('試聴を準備できませんでした')
  }

}

async function deleteTakeData(takeId){
 
  if(busyTakes.has(takeId))throw Object.assign(Error('書き出し中のテイクは削除できません'),{user:true});
 
  for(const k of ['mix','voice','prog'])await idbDelStrict('chunks',chunkRange(takeId,k));
 
  await idbDelStrict('takes',takeId);
  await idbDel('assets','cover:'+takeId);
  if(lastTakeId===takeId)lastTakeId=null;

}

async function deleteTake(takeId,btn){
 
  if(rec.take?.id===takeId){
    toast('録音中のテイクは削除できません');
    return
  }
 
  if(btn){
    btn.disabled=true;
    btn.textContent='削除中…'
  }
 
  try{
  
    await deleteTakeData(takeId);
  
    if(await idbGet('takes',takeId))throw Error('削除後もデータが残っています');
  
    const a=document.querySelector(`audio[data-take="${CSS.escape(takeId)}"]`);
    if(a){
      a.pause();
      URL.revokeObjectURL(a.src)
    }
  
    document.querySelector(`.take[data-id="${CSS.escape(takeId)}"]`)?.remove();
  
    if(coverUrls.get(takeId))URL.revokeObjectURL(coverUrls.get(takeId));
    coverUrls.delete(takeId);
  
    await renderTakes();
    updateStorage();
    toast('テイクを削除しました');
 
  }catch(e){
    console.error(e);
    toast('削除できませんでした（'+(e?.name&&e.name!=='Error'?e.name+'：':'')+(e?.message||e)+'）',6000);
    if(btn){
      btn.disabled=false;
      btn.textContent='削除'
    }
  }

}

$('#takes').addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b)return;
 
  if(b.dataset.takeCover){
    coverTarget=b.dataset.takeCover;
    $('#takeCoverFile').click();
    return
  }
 
  if(b.dataset.uncover){
    setCover(b.dataset.uncover,null);
    return
  }
 
  if(b.dataset.del&&busyTakes.has(b.dataset.del)){
    toast('書き出し中のテイクは削除できません');
    return
  }
 
  if(b.dataset.video){
    exportTake(b.dataset.video,'mix','video');
    return
  }
 
  if(b.dataset.listen)listenTake(b.dataset.listen,b);else if(b.dataset.wav)exportTake(b.dataset.wav,b.dataset.track,'wav');else if(b.dataset.mp3)exportTake(b.dataset.mp3,b.dataset.track,'mp3');else if(b.dataset.del){
    if(armButton(b))deleteTake(b.dataset.del,b)
  }
 else if(b.dataset.copy){
    idbGet('takes',b.dataset.copy).then(t=>{
      const text=(t.markers||[]).map(m=>fmtTime(m.t,true)+'\t'+m.label).join('\n');
      copyText(text)
    })
  }
});

$('#takes').addEventListener('change',async e=>{
  const inp=e.target.closest('[data-rename]');
  if(!inp)return;
  const name=inp.value.trim()||'収録';
 
  if(rec.take?.id===inp.dataset.rename){
    rec.take.name=name;
    return
  }
  const t=await idbGet('takes',inp.dataset.rename);
  if(t){
    t.name=name;
    await idbPut('takes',t.id,t);
    toast('テイク名を変更しました')
  }
});

async function updateStorage(){
  try{
    const est=await navigator.storage?.estimate?.();
    if(!est)return;
    const mb=x=>x>1073741824?(x/1073741824).toFixed(1)+'GB':Math.round(x/1048576)+'MB';
    $('#storageInfo').textContent=`保存 ${mb(est.usage)}／空き 約${mb(est.quota-est.usage)}`
  }catch(_){}
}

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

/* ===================== 設定の書き出し・読み込み ===================== */
// 形式：先頭8バイト（.kissa は "MTKSPACK"、.live は "OTNHLIVE"）+ 見出しJSONの長さ(4バイト) + 見出しJSON + 音源・画像をそのまま連結
// .kissa は効果音・BGMのみ（純喫茶オトノハと共通）。.live はそれに立ち絵・降らせる画像・背景・台本・映像設定（kind:'studio'）を加えたもの。
// 読み込み時はファイルを丸ごとメモリに載せず、音源ごとに切り出して保存する

const PACK_MAGIC='MTKSPACK',
  PACK_FORMAT='meltune-kissa-pack',
  PACK_EXT='.kissa';

const LIVE_MAGIC='OTNHLIVE',
  LIVE_FORMAT='otonoha-live-pack',
  LIVE_EXT='.live';

async function buildSoundPack(){
  const conf=JSON.parse(JSON.stringify(cfg)),
    assets=[],
    blobs=[],
    packed=new Set();
  let off=0;
  const add=async(key,kind)=>{
    const unique=(kind==='cover'?'cover:':'asset:')+key;
    if(packed.has(unique))return true;
    const b=kind==='cover'?await idbGet('assets','cover:'+key):await getAsset(key);
    if(!b)return false;
    assets.push({key,kind,offset:off,size:b.size,type:b.type||''});
    blobs.push(b);
    off+=b.size;
    packed.add(unique);
    return true
  };
  for(const item of [...conf.sounds,...conf.bgms])if(item.assetId&&!await add(item.assetId,'audio'))item.assetId=null;
  for(const item of conf.sounds)if(item.imageId&&!await add(item.imageId,'image'))item.imageId=null;
  await add(EFFECT_ASSET,'image');
  await add('default','cover');
  for(const pr of conf.programs||[])for(let n=0;n<PC_SLOTS;n++)await add(progCoverKey(pr.id,n),'cover');
  return {conf,assets,blobs,off}
}

function packBlob(magic,head,blobs){
  const h=new TextEncoder().encode(JSON.stringify(head));
  const len=new Uint8Array(4);
  new DataView(len.buffer).setUint32(0,h.length,true);
  return new Blob([magic,len,h,...blobs],{type:'application/octet-stream'})
}

async function exportPack(){
  try{
    toast('書き出しています…',60000);
    const {conf,assets,blobs,off}=await buildSoundPack();
    download(packBlob(PACK_MAGIC,{format:PACK_FORMAT,version:1,app:look.title,created:new Date().toISOString(),config:conf,look:lookForExport(),assets},blobs),packFileName());
    toast(`効果音・BGMの設定を書き出しました（.kissa・音源${assets.filter(a=>a.kind==='audio').length}件・${(off/1048576).toFixed(1)}MB）`,4000);
  }catch(e){
    console.error(e);
    toast('書き出しに失敗しました（'+errText(e)+'）',6000)
  }
}

async function exportLive(){
  const st=window.__otonohaStudio;
  if(!st){toast('映像側の準備中です。少し待ってからお試しください');return}
  try{
    toast('すべての設定を書き出しています…',60000);
    const {conf,assets,blobs,off:o}=await buildSoundPack();
    let off=o,images=0;
    const studio=st.collect();
    for(const[key,b]of Object.entries(studio.assets)){
      assets.push({key,kind:'studio',offset:off,size:b.size,type:b.type||''});
      blobs.push(b);
      off+=b.size;
      images++
    }
    download(packBlob(LIVE_MAGIC,{format:LIVE_FORMAT,version:1,app:look.title,created:new Date().toISOString(),config:conf,look:lookForExport(),studio:studio.state,assets},blobs),packFileName().replace(/\.kissa$/,LIVE_EXT));
    toast(`すべての設定を書き出しました（.live・音源${assets.filter(a=>a.kind==='audio').length}件・画像${images}枚・${(off/1048576).toFixed(1)}MB）`,5000);
  }catch(e){
    console.error(e);
    toast('書き出しに失敗しました（'+errText(e)+'）',6000)
  }
}

const blobData=blob=>new Promise((resolve,reject)=>{
  const r=new FileReader();
  r.onload=()=>resolve(r.result);
  r.onerror=()=>reject(r.error);
  r.readAsDataURL(blob)
});

function errText(e){
  if(!e)return '原因不明';
  if(e.name==='QuotaExceededError')return '端末の空き容量が足りません';
  if(e instanceof RangeError||/memory|allocation/i.test(e.message||''))return 'ファイルが大きく、この端末では一度に読み込めません';
  return e.userMessage||((e.name&&e.name!=='Error'?e.name+'：':'')+(e.message||String(e)))
}

function dataUrlToBlob(u){
 
  const comma=u.indexOf(','),
    meta=u.slice(5,comma),
    type=meta.split(';')[0]||'',
    b64=meta.includes(';base64');
  const body=u.slice(comma+1);
 
  if(!b64)return new Blob([decodeURIComponent(body)],{type});
 
  const parts=[],
    STEP=1<<20;
  for(let i=0;i<body.length;i+=STEP){
    const bin=atob(body.slice(i,i+STEP));
    const a=new Uint8Array(bin.length);
    for(let j=0;j<bin.length;j++)a[j]=bin.charCodeAt(j);
    parts.push(a)
  }
 
  return new Blob(parts,{type});

}

async function readPackHeader(file){
 
  const first=new Uint8Array(await file.slice(0,12).arrayBuffer());
 
  const magic=String.fromCharCode(...first.slice(0,8));
  if(magic!==PACK_MAGIC&&magic!==LIVE_MAGIC)return null;
  const live=magic===LIVE_MAGIC;
 
  if(first.length<12)throw Error('設定ファイルのヘッダーが途中で切れています');
 
  const len=new DataView(first.buffer).getUint32(8,true);
 
  if(!len||len>32*1048576||12+len>file.size)throw Error('設定ファイルのヘッダーが壊れています');
 
  const head=JSON.parse(new TextDecoder().decode(await file.slice(12,12+len).arrayBuffer()));
 
  if(head.format!==(live?LIVE_FORMAT:PACK_FORMAT)||!head.config||(live&&(!head.studio||typeof head.studio!=='object')))throwObject.assign(Error(''),{userMessage:'設定ファイルの中身を読み取れませんでした'});
 
  if(!head.config||typeof head.config!=='object'||Array.isArray(head.config)||!Array.isArray(head.assets))throw Error('設定ファイルの形式が正しくありません');
 
  const seen=new Set();
  let end=0;
 
  for(const a of head.assets){
  
    if(!a||typeof a.key!=='string'||!(live?['audio','image','cover','studio']:['audio','image','cover']).includes(a.kind)||!Number.isSafeInteger(a.offset)||!Number.isSafeInteger(a.size)||a.offset<end||a.size<0||a.offset+a.size>file.size-12-len)throw Error('設定ファイルの音源・画像の範囲が壊れています');
  
    const key=(a.kind==='cover'?'cover:':a.kind==='studio'?'studio:':'asset:')+a.key;
    if(seen.has(key))throw Error('設定ファイルの音源・画像キーが重複しています');
    seen.add(key);
    end=a.offset+a.size;
 
  }
 
  return {head,base:12+len,live};

}

async function applyImported(incoming,stored,coverBlob,progCovers={}){
 
  const nextConfig=normalize(incoming); // 既存素材に触れる前に設定を検証する。
 delete nextConfig.rec.effectImageAsset;
 
  stopFilmPreview();
  const importedEffect=incoming.rec?.effectImageAsset;
  if(importedEffect){
    const effectBlob=await getAsset(importedEffect);
    if(effectBlob)await putAsset(EFFECT_ASSET,effectBlob);
    delete incoming.rec.effectImageAsset;
    await deleteAsset(importedEffect)
  }else await deleteAsset(EFFECT_ASSET);
 
  const oldAssets=[...cfg.sounds,...cfg.bgms].flatMap(x=>[x.assetId,x.imageId]).filter(Boolean);
  for(const u of imgUrls.values())if(u)URL.revokeObjectURL(u);
  imgUrls.clear();
 
  const keepRec=cfg.rec;
  stopAll();
  cfg=nextConfig;
  if(!incoming.rec)cfg.rec=keepRec;
  emojiTab=0;
  textTab=0;
  bgmTab=0;
  save();
  renderVolumes();
  updateGains();
 
  if(coverBlob){
    await setCover('default',coverBlob)
  }
 
  for(const [k,b] of Object.entries(progCovers)){
    const m=/^prog-(.+)$/.exec(k);
    const isOld=m&&!/-\d$/.test(k);
    const key=isOld?progCoverKey(m[1],0):k;
    await setCover(key,b);
    if(isOld){
      const pr=cfg.programs.find(x=>x.id===m[1]);
      if(pr&&!(pr.coverIdx>=0))pr.coverIdx=0
    }
  }
  persist();
 
  renderPrograms();
  renderEffectControls();
  await renderEffectAsset();
 
  for(const assetId of oldAssets)await deleteAsset(assetId);
  updateStorage();
 
  toast(`設定を読み込みました（音源${stored}件${coverBlob?'・サムネイル画像':''}）`,4000);

}

$('#exportBtn').onclick=exportLive;
$('#exportKissaBtn').onclick=exportPack;
$('#importBtn').onclick=()=>$('#importFile').click();

$('#importFile').onchange=async e=>{
  const file=e.target.files[0];
  if(!file)return;
  if(rec.state!=='idle'||videoJob||studioCapturing){
    e.target.value='';
    toast('収録・動画書き出しが終わってから読み込んでください');
    return
  }
  const added=[];
 
  try{
  
    toast('設定ファイルを確認しています…',120000);
  
    const pack=await readPackHeader(file);
  
    if(pack){

      const st=window.__otonohaStudio,
        studioBlobs={};
      if(pack.live){
        if(!st)throw Object.assign(Error(''),{userMessage:'映像側の準備中です。少し待ってからお試しください'});
        if(st.busy())throw Object.assign(Error(''),{userMessage:'動画の収録が終わってから読み込んでください'});
        for(const a of pack.head.assets)if(a.kind==='studio'){
          const blob=file.slice(pack.base+a.offset,pack.base+a.offset+a.size,a.type);
          if(blob.size!==a.size)throw Object.assign(Error(''),{userMessage:'ファイルが途中で切れています。書き出し直したファイルでお試しください'});
          studioBlobs[a.key]=new Blob([await blob.arrayBuffer()],{type:a.type})
        }
        await st.validate(studioBlobs)
      }
      if(!await askConfirm(pack.live?'現在の効果音・BGM・立ち絵・名義・降らせる画像・背景・台本・映像設定を、読み込む内容ですべて置き換えますか？\n録音したテイクと収録済みの動画は残ります。':'現在の効果音・BGMの設定を、読み込む内容で置き換えますか？\n立ち絵・映像設定と、録音したテイクは残ります。','置き換える',pack.live?'すべての設定の読み込み（.live）':'効果音・BGMの読み込み（.kissa）')){
        toast('読み込みを取り消しました');
        return
      }

      const incoming=pack.head.config,
        map=new Map(),
        assets=pack.head.assets||[],
        progCovers={};
      let n=0,
        cover=null;
      const total=assets.filter(a=>a.kind==='audio').length;
   
      for(const a of assets){
    
        const blob=file.slice(pack.base+a.offset,pack.base+a.offset+a.size,a.type);
    
        if(blob.size!==a.size)throw Object.assign(Error(''),{userMessage:'ファイルが途中で切れています。書き出し直したファイルでお試しください'});
    
        if(a.kind==='studio')continue;
        if(a.kind==='cover'){
          const cb=new Blob([await blob.arrayBuffer()],{type:a.type});
          if(a.key==='default')cover=cb;else progCovers[a.key]=cb;
          continue
        }
    
        const nid=id();
        added.push(nid);
        await putAsset(nid,new Blob([await blob.arrayBuffer()],{type:a.type}));
        map.set(a.key,nid);
        if(a.kind==='audio')toast(`音源を取り込み中 ${++n}/${total}`,120000);
   
      }
   
      for(const item of [...(incoming.sounds||[]),...(incoming.bgms||[])]){
        item.assetId=item.assetId&&map.get(item.assetId)||null;
        if(item.imageId)item.imageId=map.get(item.imageId)||null
      }
   
      incoming.rec??={...REC_DEFAULTS};
      incoming.rec.effectImageAsset=map.get(EFFECT_ASSET)||null;
      await applyImported(incoming,n,cover,progCovers);
      if(pack.head.look)lookCommit(lookSanitize(pack.head.look));
      if(pack.live)await st.apply(pack.head.studio,studioBlobs);
      return;

    }
    throw Object.assign(Error(''),{userMessage:'このアプリの設定ファイル（.live／.kissa）ではありません'});

   }catch(err){
    console.error(err);
    for(const k of added)await deleteAsset(k);
    toast('設定ファイルを読み込めませんでした（'+errText(err)+'）',9000)
  }
 finally{
    e.target.value=''
  }
};

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

/* ===================== 画面の切り替え（収録画面／音量・マイクの設定） ===================== */

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
  document.querySelectorAll('[data-app]').forEach(b=>b.classList.toggle('on',pg==='main'&&b.dataset.app===document.body.dataset.app));
  $('#navSettings').classList.toggle('on',pg==='settings');
  window.scrollTo(0,0)
}

const APP_KEY=(typeof OTONOHA_NS==='string'?OTONOHA_NS:'')+'otonoha_app';
function setApp(app){
  app=app==='radio'?'radio':'live';
  document.body.dataset.app=app;
  try{localStorage.setItem(APP_KEY,app)}catch(_){}
  window.__otonohaAppChanged?.(app)
}
try{setApp(localStorage.getItem(APP_KEY)||'live')}catch(_){setApp('live')}
document.addEventListener('click',e=>{
  const ab=e.target.closest('[data-app]');
  if(ab)setApp(ab.dataset.app);
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
/* ===================== スクロール中の小さな録音欄・BGM欄への移動 ===================== */

let miniOn=false;

const MINI_LABEL={'● 録音開始':'● 録音','‖ 一時停止':'‖ 一時停止','● 再開':'● 再開','■ 停止・保存':'■ 停止','↺ 録り直し':'↺ 録り直し'};

function syncMini(){
 
  $('#miniTimer').textContent=$('#timer').textContent;
  $('#miniTimer').dataset.st=rec.state;
 
  for(const [m,o] of [['#miniRec','#recBtn'],['#miniStop','#stopRecBtn'],['#miniRetake','#retakeBtn']]){
    const a=$(m),
      b=$(o),
      txt=MINI_LABEL[b.textContent]||(b.classList.contains('armed')?'もう一度':b.textContent);
    if(a.textContent!==txt)a.textContent=txt;
    a.title=b.textContent;
    a.disabled=b.disabled;
    a.classList.toggle('on',b.classList.contains('on'));
    a.classList.toggle('armed',b.classList.contains('armed'))
  }
 
  const st=$('#bgmNow').dataset.state;
  $('#miniBgm').dataset.state=st;
  const nm=$('#bgmNowName').textContent;
  if($('#miniBgmName').textContent!==nm)$('#miniBgmName').textContent=nm;
 
  const bb=$('#bgmNowStop'),
    mb=$('#miniBgmBtn');
  if(mb.textContent!==bb.textContent)mb.textContent=bb.textContent;
  mb.disabled=bb.disabled;

}

let recbarSeen=false;
function setMini(on){
  const audio=rec.state!=='idle',
    video=!!window.__otonohaVideoRec?.();
  on=(audio&&!(recbarSeen&&document.body.dataset.page!=='settings'&&document.body.dataset.app==='radio'))||video;
  if(miniOn!==on){
    miniOn=on;
    $('#miniBar').hidden=!on
  }
  if(on){
    $('#miniAudioRow').hidden=!audio;
    $('#miniVideoRow').hidden=!video;
    syncMini()
  }
}

if('IntersectionObserver' in window){
  new IntersectionObserver(([e])=>{recbarSeen=e.isIntersecting||e.boundingClientRect.top>=0},{threshold:0}).observe(document.querySelector('.recbar'))
}
setInterval(()=>setMini(),300);

$('#miniRec').onclick=()=>$('#recBtn').click();
$('#miniStop').onclick=()=>$('#stopRecBtn').click();
$('#miniRetake').onclick=()=>$('#retakeBtn').click();
$('#miniBgmBtn').onclick=()=>$('#bgmNowStop').click();
$('#miniAllStop').onclick=()=>stopAll();
$('#miniVideoStop').onclick=()=>document.getElementById('studioStop')?.click();

function gotoBgm(){
 
  if(document.body.dataset.page==='settings'){
    clearPageHash();
    applyPage()
  }
 
  const sec=$('#bgmTabs').closest('.section');
  const y=sec.getBoundingClientRect().top+scrollY;
 
  requestAnimationFrame(()=>{
    const bar=document.querySelector('.recbar');
    const stickyH=getComputedStyle(bar).position==='sticky'?bar.offsetHeight:($('#miniBar').offsetHeight||110);
    window.scrollTo({top:Math.max(0,y-stickyH-8),behavior:'smooth'})
  });

}

for(const el of [$('#bgmNowMain'),$('#miniBgmName')]){
  el.onclick=gotoBgm;
  el.onkeydown=e=>{
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      gotoBgm()
    }
  }
}

(async()=>{
 
  try{
    db=await openDB();
    let stored=null;
    try{
      stored=localStorage.getItem(KEY)
    }catch(_){}
    cfg=normalize(stored?JSON.parse(stored):null);
    persist()
  }
 catch(err){
    console.warn('保存領域を使えないため一時保存で動作します',err);
    db=memoryDB();
    cfg=normalize(null);
    try{
      const st=localStorage.getItem(KEY);
      if(st)cfg=normalize(JSON.parse(st))
    }catch(_){}
  
    $('.footer').textContent='この画面ではブラウザに保存できないため、お試し表示で動いています。登録した音源や録音は、画面を閉じると消えます。';
    $('.footer').classList.add('temp-note');
    toast('お試し表示で動いています（保存はされません）',6000)
  }
 
  renderVolumes();
  render();
  renderRecState();
  renderEffectControls();
  if(db){
    renderCover();
    renderEffectAsset()
  }
 
  if(db){
    const takes=await loadTakes();
    for(const t of takes)if(t.status==='recording'){
      t.status='recovered';
      await idbPut('takes',t.id,t)
    }
    await renderTakes();
  
    if(takes.some(t=>t.status==='recovered'))toast('前回途中で終了した録音を復旧しました',4000)
  }
 
  updateStorage();
 
  if(!navigator.mediaDevices?.getUserMedia){
    $('#micBtn').disabled=true;
    $('#micInfo').textContent='このブラウザではマイクを使えません'
  }
 else{
    try{
      let st=null;
      try{st=await navigator.permissions?.query?.({name:'microphone'})}catch(_){}
      if(st?.state!=='denied')enableMic(true);else $('#micInfo').textContent='マイクがブロックされています（アドレスバーのサイト設定で許可できます）'
    }catch(_){}
  }
 
  document.addEventListener('pointerdown',()=>{
    if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{})
  });
 
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{
    listMics();
    if(micStream&&!micLive())enableMic(true)
  });
 
  setTimeout(preloadProgBgm,1500);
  renderBgmNow();
  if(db)await migrateProgCovers().catch(e=>console.error(e));
  renderPrograms();
  detectOutput();
  navigator.mediaDevices?.addEventListener?.('devicechange',detectOutput);

})();
