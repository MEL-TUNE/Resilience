/* 設定の書き出し・読み込み */

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
  const nextConfig=normalize(incoming);
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
