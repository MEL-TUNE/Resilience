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


const BGM_TAB_DEFAULTS=['明るい','穏やか','切ない','緊張','その他'],
  TEXT_TAB_DEFAULTS=['標準','感謝','力業','1','2'],
  EMOJI_TAB_DEFAULTS=[...TEXT_TAB_DEFAULTS];


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

const newBgm=(tabIndex,slotIndex,owner)=>({id:id(),name:'',volume:100,assetId:null,fileName:'',tabIndex,slotIndex,...(owner?{owner}:{})});

const defaults=()=>({
  version:6,
  categories:[],
  sounds:[...EMOJI_TAB_DEFAULTS.flatMap((_,tab)=>emojiLabels.map((x,slot)=>({...newSound('emoji',x,slot),tabIndex:tab,slotIndex:slot}))),...TEXT_TAB_DEFAULTS.flatMap((_,tab)=>textLabels.map((x,slot)=>({...newSound('text',x,slot),tabIndex:tab,slotIndex:slot})))],
  emojiTabs:[...EMOJI_TAB_DEFAULTS],
  textTabs:[...TEXT_TAB_DEFAULTS],
  bgmTabs:[...BGM_TAB_DEFAULTS],
  bgms:BGM_TAB_DEFAULTS.flatMap((_,tab)=>Array.from({length:BGM_SLOTS},(_,slot)=>newBgm(tab,slot))),
  master:100,
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


const fmtDb=db=>db<=-60?'消音':(db>0?'+':'')+(+db).toFixed(1)+'dB';

const PROGRAMS=30;

function defaultPrograms(){
  return Array.from({length:1},(_,i)=>({id:'prog'+(i+1),name:'番組'+(i+1),bgmId:null,autoBgm:true,coverIdx:-1,color:''}))
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

  if(!['none','spring','summer','autumn','winter'].includes(base.rec.videoEffect))base.rec.videoEffect='none';
  if(!['default','image'].includes(base.rec.effectSource))base.rec.effectSource='default';

  for(const [k,min,max] of [['effectCount',10,120],['effectSpeed',20,180],['effectScale',30,160],['effectOpacity',10,100]])base.rec[k]=Number.isFinite(+base.rec[k])?Math.max(min,Math.min(max,+base.rec[k])):REC_DEFAULTS[k];

  base.rec.videoFps=+base.rec.videoFps===30?30:24;
  base.rec.videoSize=+base.rec.videoSize===720?720:1080;

  if(Array.isArray(raw.programs)&&raw.programs.some(x=>x&&typeof x==='object')){
    raw={...raw,programs:raw.programs.filter(x=>x&&typeof x==='object')};
        const blank={name:'',bgmId:null,autoBgm:true,coverIdx:-1,color:''};
    const kept=raw.programs.slice(0,PROGRAMS).map((x,i)=>({...blank,id:'prog'+(i+1),name:'番組'+(i+1),...x}));
    // 使っていない既定の番組（名前も初期BGMも色も画像もない「番組N」）は、末尾から片付ける
    const untouched=(x,i)=>x.name==='番組'+(i+1)&&!x.bgmId&&!x.color&&!(x.coverIdx>=0)&&x.id==='prog'+(i+1);
    while(kept.length>1&&untouched(kept.at(-1),kept.length-1)&&!(Number.isInteger(raw.currentProgram)&&raw.currentProgram>=kept.length-1))kept.pop();
    base.programs=kept
  }

  base.currentProgram=Number.isInteger(raw.currentProgram)&&raw.currentProgram>=-1&&raw.currentProgram<base.programs.length?raw.currentProgram:(raw.currentProgram===-1?-1:0);

  base.sounds=Array.isArray(raw.sounds)?raw.sounds.filter(x=>x&&typeof x==='object').map((s,i)=>({...newSound(s.type==='text'?'text':'emoji',s.label??'',i),...s})):base.sounds;

  base.bgms=Array.isArray(raw.bgms)?raw.bgms.filter(x=>x&&typeof x==='object'):[];
  base.categories=Array.isArray(raw.categories)?raw.categories:base.categories;

  const realSounds=t=>base.sounds.filter(x=>x.type===t&&(x.assetId||x.configured||x.label));

  base.emojiTabs=fitTabs(raw.emojiTabs,EMOJI_TAB_DEFAULTS,realSounds('emoji'));

  base.textTabs=fitTabs(raw.textTabs,TEXT_TAB_DEFAULTS,realSounds('text'));

  base.bgmTabs=Array.isArray(raw.bgmTabs)&&raw.bgmTabs.length?raw.bgmTabs.slice(0,BGM_TAB_MAX).map(x=>String(x||'名義').slice(0,40)):[...BGM_TAB_DEFAULTS];

  base.master=Number.isFinite(+raw.master)?+raw.master:base.master;

  base.voDb=Number.isFinite(+raw.voDb)&&raw.voDb!==null?+raw.voDb:base.voDb;
  base.envDb=Number.isFinite(+raw.envDb)&&raw.envDb!==null?+raw.envDb:base.envDb;

  for(const k of ['seDb','bgmDb'])base[k]=Number.isFinite(+raw[k])&&raw[k]!==null?+raw[k]:base[k];
  base.playMode=raw.playMode==='overlap'?'overlap':'restart';
  return ensureBgmSlots(ensureTextSlots(ensureEmojiSlots(ensureSlots(base))));
}

function ensureSlots(config){
  for(const s of config.sounds){
    delete s.favorite;
    if(s.type==='text')s.category='全て';
    if(!s.assetId){
      if(s.configured===true||s.label)s.configured=true;
   else{
        Object.assign(s,{label:'',category:'全て',volume:100,shortcut:'',configured:false})
      }
    }else s.configured=true
  }

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

const SE_COLS={emoji:6,text:5,env:4},
  SE_MIN={emoji:EMOJI_SLOTS,text:TEXT_SLOTS,env:ENV_SLOTS},
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
  for(const type of ['emoji','text','env']){
    const need=seSlotsNeeded(cfg,type);
    cfg.sounds=cfg.sounds.filter(s=>s.type!==type||isRealSound(s)||!(s.slotIndex>=need));
    const have=new Set(cfg.sounds.filter(s=>s.type===type).map(s=>s.slotIndex));
    for(let i=0;i<need;i++)if(!have.has(i))cfg.sounds.push({...newSound(type,'',i),tabIndex:0,slotIndex:i})
  }
}

const ensureEmojiSlots=config=>ensureSe(config,'emoji');

function fixedSlots(config,type,min,cols){
  let max=-1;
  for(const s of config.sounds)if(s.type===type&&isRealSound(s)&&Number.isInteger(s.slotIndex))max=Math.max(max,s.slotIndex);
  const used=config.sounds.filter(s=>s.type===type&&isRealSound(s)).length;
  return Math.max(min,Math.ceil(Math.max(max+1,used)/cols)*cols)
}

const ensureTextSlots=config=>layoutVoices(ensureSe(ensureSe(config,'text'),'env'),null);

// ボイスは「標準」＋名義ごとのタブ（owner＝'std' か名義のid）。各タブは最後の行まで埋まると1行増える
const VOICE_COLS=5,VOICE_MAX=600;
let voiceOwnerIds=null,voiceTab=0;
const voiceOwnerOf=s=>typeof s.owner==='string'&&s.owner?s.owner:'std';
function voiceSlotsNeeded(items){
  let max=-1;
  for(const s of items)if(isRealSound(s)&&Number.isInteger(s.slotIndex))max=Math.max(max,s.slotIndex);
  return Math.min(VOICE_MAX,Math.max(VOICE_SLOTS,(Math.floor(max/VOICE_COLS)+2)*VOICE_COLS))
}
function layoutVoices(config,ids){
  const all=config.sounds.filter(s=>s.type==='voice'),
    real=all.filter(isRealSound),
    empty=all.filter(s=>!isRealSound(s));
  if(!ids)ids=['std',...new Set(real.map(voiceOwnerOf).filter(o=>o!=='std'))];
  for(const s of real)if(!ids.includes(voiceOwnerOf(s)))s.owner=ids[0];
  const out=config.sounds.filter(s=>s.type!=='voice');
  ids.forEach((owner,t)=>{
    const items=real.filter(s=>voiceOwnerOf(s)===owner).sort((a,b)=>(a.slotIndex??a.order??0)-(b.slotIndex??b.order??0)),
      N=voiceSlotsNeeded(items),taken=new Set();
    for(const s of items){
      let i=Number.isInteger(s.slotIndex)&&s.slotIndex>=0&&s.slotIndex<N&&!taken.has(s.slotIndex)?s.slotIndex:-1;
      if(i<0)for(let k=0;k<VOICE_MAX;k++)if(!taken.has(k)){i=k;break}
      taken.add(i);
      Object.assign(s,{owner,tabIndex:t,slotIndex:i,order:i});
      out.push(s)
    }
    const spare=empty.filter(s=>voiceOwnerOf(s)===owner);
    for(let i=0;i<N;i++)if(!taken.has(i)){
      const k=spare.findIndex(s=>s.slotIndex===i),e=k>=0?spare.splice(k,1)[0]:{...newSound('voice','',i)};
      Object.assign(e,{owner,tabIndex:t,slotIndex:i,order:i});
      out.push(e)
    }
  });
  config.sounds=out;
  return config
}
function growVoices(){layoutVoices(cfg,voiceOwnerIds)}

const BGM_COLS=3,
  BGM_MIN=12,
  BGM_MAX=600;

function bgmSlotsNeeded(list){
  let max=-1;
  for(const b of list)if((b.assetId||b.name)&&Number.isInteger(b.slotIndex))max=Math.max(max,b.slotIndex);
  return Math.min(BGM_MAX,Math.max(BGM_MIN,(Math.floor(max/BGM_COLS)+2)*BGM_COLS))
}

const BGM_TAB_MAX=21;
let bgmCurTab=0;
let bgmOwnerIds=null;

const bgmReal=b=>!!(b.assetId||b.name);
const bgmTabOf=b=>Number.isInteger(b.tabIndex)&&b.tabIndex>=0?Math.min(b.tabIndex,BGM_TAB_MAX-1):0;

function bgmTabSlots(items,tab,owner){
  const N=bgmSlotsNeeded(items),
    slots=Array.from({length:N},(_,i)=>newBgm(tab,i,owner)),
    taken=new Set();
  for(const b of items.sort((x,y)=>(x.slotIndex??0)-(y.slotIndex??0))){
    let idx=Number.isInteger(b.slotIndex)&&b.slotIndex>=0&&b.slotIndex<N?b.slotIndex:-1;
    if(idx<0||taken.has(idx)){
      idx=Array.from({length:N},(_,i)=>i).find(i=>!taken.has(i));
      if(idx===undefined)continue
    }
    taken.add(idx);
    slots[idx]={...slots[idx],...b,tabIndex:tab,slotIndex:idx,...(owner?{owner}:{})}
  }
  return slots
}

function growBgm(){
  const tabs=bgmOwnerIds?bgmOwnerIds.length:Math.max(1,...cfg.bgms.map(b=>bgmTabOf(b)+1));
  for(let t=0;t<tabs;t++){
    const need=bgmSlotsNeeded(cfg.bgms.filter(b=>bgmTabOf(b)===t));
    cfg.bgms=cfg.bgms.filter(b=>bgmTabOf(b)!==t||bgmReal(b)||!(b.slotIndex>=need));
    const have=new Set(cfg.bgms.filter(b=>bgmTabOf(b)===t).map(b=>b.slotIndex));
    for(let i=0;i<need;i++)if(!have.has(i))cfg.bgms.push(newBgm(t,i,bgmOwnerIds?.[t]))
  }
}

function ensureBgmSlots(config){
  const prior=(config.bgms||[]).filter(bgmReal),
    tabs=Math.max(1,...prior.map(b=>bgmTabOf(b)+1));
  config.bgms=[];
  for(let t=0;t<tabs;t++)config.bgms.push(...bgmTabSlots(prior.filter(b=>bgmTabOf(b)===t),t,null));
  return config
}

// 名義（映像側のプロフィール）がそのままBGMのタブになる。名義のない曲・消した名義の曲は先頭の名義のタブへ
const cur0=(ids,curId)=>ids.indexOf(curId);
function setBgmProfiles(profiles,curId,follow){
  if(!cfg||!Array.isArray(profiles)||!profiles.length)return;
  const list=[{id:'std',name:'標準'},...profiles],
    ids=list.slice(0,BGM_TAB_MAX).map(p=>p.id),
    real=cfg.bgms.filter(bgmReal);
  const
orphans=real.filter(b=>!ids.includes(b.owner)).sort((x,y)=>bgmTabOf(x)-bgmTabOf(y)||(x.slotIndex??0)-(y.slotIndex??0));
  for(const b of real)if(ids.includes(b.owner))b.tabIndex=ids.indexOf(b.owner);
  const taken=new Set(real.filter(b=>b.owner===ids[0]).map(b=>b.slotIndex));
  let next=Math.max(-1,...taken)+1;
  for(const b of orphans){
    let s=Number.isInteger(b.slotIndex)&&b.slotIndex>=0&&bgmTabOf(b)===0?b.slotIndex:-1;
    if(s<0||taken.has(s)){while(taken.has(next))next++;s=next}
    taken.add(s);
    b.owner=ids[0];b.tabIndex=0;b.slotIndex=s
  }
  bgmOwnerIds=ids;
  const vSig=()=>JSON.stringify(cfg.sounds.filter(s=>s.type==='voice'&&isRealSound(s)).map(s=>[s.id,s.owner,s.slotIndex]));
  const vBefore=vSig();
  voiceOwnerIds=ids;
  layoutVoices(cfg,ids);
  if(follow&&cur0(ids,curId)>0&&voiceTab>0)voiceTab=cur0(ids,curId);
  if(voiceTab>=ids.length)voiceTab=0;
  const vChanged=vBefore!==vSig();
  const before=JSON.stringify(cfg.bgms.filter(bgmReal).map(b=>[b.id,b.owner,b.slotIndex]))+cfg.bgms.length+cfg.bgmTabs.join();
  cfg.bgms=ids.flatMap((owner,t)=>bgmTabSlots(real.filter(b=>b.owner===owner),t,owner));
  cfg.bgmTabs=list.slice(0,BGM_TAB_MAX).map(p=>String(p.name||'名義').slice(0,40));
  const cur=ids.indexOf(curId);
  bgmCurTab=cur>0?cur:0;
  if(follow&&cur>0&&bgmTab>0)bgmTab=cur;
  if(bgmTab>=ids.length)bgmTab=0;
  if(vChanged||before!==JSON.stringify(cfg.bgms.filter(bgmReal).map(b=>[b.id,b.owner,b.slotIndex]))+cfg.bgms.length+cfg.bgmTabs.join())persist();
  render();
  renderPrograms?.()
}
window.__otonohaBgmProfiles=setBgmProfiles;

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

            getAll:r=>req(()=>r?[...m.keys()].sort().filter(hit(r)).map(k=>m.get(k)):[...m.values()]),
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

// 音側の設定も、操作が止まってから約0.4秒後（最長2秒）にまとめて書く。確定操作は persistNow()
let persistTm=0,persistFirst=0;
function persistNow(){
  clearTimeout(persistTm);persistTm=0;persistFirst=0;
  try{
    localStorage.setItem(KEY,JSON.stringify(cfg));
    persist.failed=false
  }catch(e){
    persist.failed=true;
    if(!persist.warned){
      persist.warned=true;
      console.warn('設定を保存できない環境です',e.name);
      toast('設定を保存できません。端末の空き容量をご確認のうえ、設定ファイルを書き出してください',8000)
    }
  }
  saveBadge();
  return !persist.failed
}
function persist(){
  const now=Date.now();
  if(!persistFirst)persistFirst=now;
  clearTimeout(persistTm);
  persistTm=setTimeout(persistNow,Math.max(0,Math.min(400,persistFirst+2000-now)));
  saveBadge()
}
function saveBadge(){
  const el=document.getElementById('saveState');
  if(!el)return;
  const v=window.__otonohaSaveState?.()||'saved',a=persist.failed?'failed':persistTm?'pending':'saved',
    s=a==='failed'||v==='failed'?'failed':a==='pending'||v==='pending'?'pending':'saved';
  if(el.dataset.s===s)return;
  el.dataset.s=s;
  el.textContent=s==='failed'?'設定の保存：保存できていません（端末の空き容量をご確認ください）':s==='pending'?'設定の保存：まもなく保存します':'設定の保存：保存済み'
}
function flushSaves(){
  if(persistTm)persistNow();
  try{window.__otonohaSaveFlush?.()}catch(_){}
}
window.addEventListener('pagehide',flushSaves);
window.addEventListener('beforeunload',flushSaves);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushSaves()});

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
