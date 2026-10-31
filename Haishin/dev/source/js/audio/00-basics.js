'use strict';
/* 基本・保存 */

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
  voiceOut,
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

function growSe(){
  for(const type of ['emoji','text']){
    const have=cfg.sounds.filter(s=>s.type===type).length,
      need=seSlotsNeeded(cfg,type);
    for(let i=have;i<need;i++)cfg.sounds.push({...newSound(type,'',i),tabIndex:0,slotIndex:i})
  }
}

const ensureEmojiSlots=config=>ensureSe(config,'emoji');

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

function streamMode(){
  return document.body.dataset.app==='live'&&document.body.dataset.kind==='stream'
}
