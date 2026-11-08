/* 設定の書き出し・読み込み */

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

async function exportLive(){
  const st=window.__otonohaStudio;
  if(!st){toast('映像側の準備中です。少し待ってからお試しください');return}
  try{
    toast('すべての設定を書き出しています…',60000);
    const {conf,assets,blobs,off:o}=await buildSoundPack();
    let off=o,images=0;
    const studio=st.collect();
    if(st.extra)Object.assign(studio.assets,await st.extra());
    for(const[key,b]of Object.entries(studio.assets)){
      assets.push({key,kind:'studio',offset:off,size:b.size,type:b.type||''});
      blobs.push(b);
      off+=b.size;
      images++
    }
    // 企画卓に登録したアプリ（ファイルから読み込んだもの）のHTMLも入れる
    let apps=0;
    for(const a of (studio.state.apps||[]))if(a&&a.kind==='file'&&/^[a-z0-9]{1,16}$/.test(a.id)){
      const b=await getAsset('app:'+a.id);
      if(!b)continue;
      const bb=b instanceof Blob?new Blob([b],{type:'text/html'}):new Blob([String(b)],{type:'text/html'});
      assets.push({key:'app-'+a.id,kind:'studio',offset:off,size:bb.size,type:'text/html'});
      blobs.push(bb);off+=bb.size;apps++
    }
    download(packBlob(LIVE_MAGIC,{format:LIVE_FORMAT,version:1,app:look.title,created:new Date().toISOString(),config:conf,look:lookForExport(),studio:studio.state,assets},blobs),packFileName());
    toast(`すべての設定を書き出しました（.live・音源${assets.filter(a=>a.kind==='audio').length}件・画像${images}枚・アプリ${apps}件・${(off/1048576).toFixed(1)}MB）`,5000);
  }catch(e){
    console.error(e);
    toast('書き出しに失敗しました（'+errText(e)+'）',6000)
  }
}

function errText(e){
  if(!e)return '原因不明';
  if(e.name==='QuotaExceededError')return '端末の空き容量が足りません';
  if(e instanceof RangeError||/memory|allocation/i.test(e.message||''))return 'ファイルが大きく、この端末では一度に読み込めません';
  return e.userMessage||((e.name&&e.name!=='Error'?e.name+'：':'')+(e.message||String(e)))
}

async function readPackHeader(file){
  const first=new Uint8Array(await file.slice(0,12).arrayBuffer());

  if(String.fromCharCode(...first.slice(0,8))!==LIVE_MAGIC)return null;

  if(first.length<12)throw Error('設定ファイルのヘッダーが途中で切れています');

  const len=new DataView(first.buffer).getUint32(8,true);

  if(!len||len>32*1048576||12+len>file.size)throw Error('設定ファイルのヘッダーが壊れています');

  const head=JSON.parse(new TextDecoder().decode(await file.slice(12,12+len).arrayBuffer()));

  if(head.format!==LIVE_FORMAT||!head.config||!head.studio||typeof head.studio!=='object')throw Object.assign(Error(''),{userMessage:'設定ファイルの中身を読み取れませんでした'});

  if(!head.config||typeof head.config!=='object'||Array.isArray(head.config)||!Array.isArray(head.assets))throw Error('設定ファイルの形式が正しくありません');

  const seen=new Set();
  let end=0;

  for(const a of head.assets){
    if(!a||typeof a.key!=='string'||!['audio','image','cover','studio'].includes(a.kind)||!Number.isSafeInteger(a.offset)||!Number.isSafeInteger(a.size)||a.offset<end||a.size<0||a.offset+a.size>file.size-12-len)throw Error('設定ファイルの音源・画像の範囲が壊れています');

    const key=(a.kind==='cover'?'cover:':a.kind==='studio'?'studio:':'asset:')+a.key;
    if(seen.has(key))throw Error('設定ファイルの音源・画像キーが重複しています');
    seen.add(key);
    end=a.offset+a.size;
  }

  return {head,base:12+len};
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

  const keepRec=cfg.rec,
    keepVol={master:cfg.master,seDb:cfg.seDb,bgmDb:cfg.bgmDb,voDb:cfg.voDb,envDb:cfg.envDb,micVolume:cfg.rec.micVolume};
  stopAll();
  cfg=nextConfig;
  if(!incoming.rec)cfg.rec=keepRec;
  Object.assign(cfg,{master:keepVol.master,seDb:keepVol.seDb,bgmDb:keepVol.bgmDb,voDb:keepVol.voDb,envDb:keepVol.envDb});
  cfg.rec.micVolume=keepVol.micVolume;
  emojiTab=0;
  textTab=0;
  bgmTab=0;
  save();
  renderVolumes();
  updateGains();

  if(coverBlob){
    await setCover('default',coverBlob)
  }

  for(const [k,b] of Object.entries(progCovers))await setCover(k,b);
  persistNow();

  renderPrograms();
  renderEffectControls();
  await renderEffectAsset();

  for(const assetId of oldAssets)await deleteAsset(assetId);
  updateStorage();

  toast(`設定を読み込みました（音源${stored}件${coverBlob?'・サムネイル画像':''}。音量はこの端末の設定のままです）`,5000);
}

$('#exportBtn').onclick=exportLive;
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
      {
        if(!st)throw Object.assign(Error(''),{userMessage:'映像側の準備中です。少し待ってからお試しください'});
        if(st.busy())throw Object.assign(Error(''),{userMessage:'動画の収録が終わってから読み込んでください'});
        for(const a of pack.head.assets)if(a.kind==='studio'){
          const blob=file.slice(pack.base+a.offset,pack.base+a.offset+a.size,a.type);
          if(blob.size!==a.size)throw Object.assign(Error(''),{userMessage:'ファイルが途中で切れています。書き出し直したファイルでお試しください'});
          studioBlobs[a.key]=new Blob([await blob.arrayBuffer()],{type:a.type})
        }
        await st.validate(studioBlobs)
      }
      if(!await askConfirm('現在の効果音・BGM・立ち絵・名義・降らせる画像・背景・台本・映像設定・歌枠ノートを、読み込む内容ですべて置き換えますか？\n録音したテイクと収録済みの動画は残ります。','置き換える','すべての設定の読み込み（.live）')){
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
      await st.apply(pack.head.studio,studioBlobs);
      return;
    }
    throw Object.assign(Error(''),{userMessage:'配信処オトノハの設定ファイル（.live）ではありません'});
   }catch(err){
    console.error(err);
    for(const k of added)await deleteAsset(k);
    toast('設定ファイルを読み込めませんでした（'+errText(err)+'）',9000)
  }
 finally{
    e.target.value=''
  }
};
