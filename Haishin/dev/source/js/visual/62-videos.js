/* 収録した動画の一覧：ブラウザ内への保存（実体と目録）、ダウンロード、整理 */

  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const VID_MAX=30,VMETA='vmeta:',VBLOB='video:';
  // 動画は設定（state）とは別に、IndexedDBの assets に「実体 video:ID」と「目録 vmeta:ID」を同じトランザクションで置く。
  const vids=[];
  let vidQ=Promise.resolve();
  function vidQueue(fn){const run=vidQ.then(()=>fn());vidQ=run.catch(()=>{});return run}
  const vidRange=p=>IDBKeyRange.bound(p,p+'￿');
  const vidPersistent=()=>!!(ready&&db&&!db.memory);
  const vidMetaOf=m=>({id:m.id,name:String(m.name||'otonoha.mp4').slice(0,120),size:Math.max(0,Number(m.size)||0),type:String(m.type||'').slice(0,40),at:m.at||new Date().toISOString(),v:1});
  const VST={saving:'保存処理中…',stored:'ブラウザ内に保存',temp:'一時保持のみ（この画面を閉じると消えます）',failed:'保存失敗・一時保持（この画面を閉じると消えます）',missing:'実体なし（この端末に動画データがありません）',orphan:'一覧から外れていた動画データ',unknown:'保存状態を確認できません'};
  function vidTx(work,mode='readwrite'){
    return new Promise((resolve,reject)=>{
      let t;
      try{t=db.transaction('assets',mode)}catch(e){reject(e);return}
      const out={};
      t.oncomplete=()=>resolve(out);
      t.onerror=()=>reject(t.error||Error('保存に失敗しました'));
      t.onabort=()=>reject(out.reason||t.error||Error('保存を中止しました'));
      try{work(t.objectStore('assets'),t,out)}catch(e){out.reason=e;try{t.abort()}catch(_){reject(e)}}
    })
  }
  function vidStore(m,blob){
    return vidQueue(()=>vidTx((s,t,out)=>{
      const r=s.getAllKeys(vidRange(VMETA));
      r.onsuccess=()=>{
        const keys=r.result||[];
        if(!keys.includes(VMETA+m.id)&&keys.length>=VID_MAX){out.reason=Object.assign(Error('full'),{full:true});t.abort();return}
        try{
          s.put(blob,VBLOB+m.id);
          s.put(vidMetaOf(m),VMETA+m.id)
        }catch(e){out.reason=e;t.abort()}
      }
    }))
  }
  function vidDelete(id){return vidQueue(()=>vidTx(s=>{s.delete(VBLOB+id);s.delete(VMETA+id)}))}
  function vidCatalog(){
    return vidTx((s,t,out)=>{
      const a=s.getAll(vidRange(VMETA)),k=s.getAllKeys(vidRange(VBLOB));
      a.onsuccess=()=>{out.metas=(a.result||[]).filter(x=>x&&typeof x.id==='string')};
      k.onsuccess=()=>{out.blobs=new Set(k.result||[])}
    },'readonly')
  }
  async function videoBlob(v){
    if(v.mem)return v.mem;
    if(!vidPersistent())throw Error('この動画のデータが見つかりません');
    const b=await getAsset(VBLOB+v.m.id);
    if(!b)throw Error('この動画のデータが見つかりません');
    return b
  }
  function vidDownload(v){
    return videoBlob(v).then(b=>{
      const u=URL.createObjectURL(b),a=document.createElement('a');
      a.href=u;a.download=v.m.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
      return true
    })
  }
  function vidButton(text,cls,title,fn){
    const b=document.createElement('button');
    b.type='button';b.className='vbtn'+(cls?' '+cls:'');b.textContent=text;if(title)b.title=title;b.onclick=fn;
    return b
  }
  function vidPaint(v){
    const row=v.el||(v.el=document.createElement('div'));
    row.className='studio-take vid-'+v.status;
    row.dataset.vid=v.m.id;
    const name=document.createElement('span');
    name.className='vname';
    name.textContent=v.m.name+(v.m.size?' / '+(v.m.size/1048576).toFixed(1)+' MB':'');
    if(v.m.at)name.title=new Date(v.m.at).toLocaleString('ja-JP');
    const st=document.createElement('span');
    st.className='vstate';
    st.textContent=VST[v.status]||'';
    const kids=[name,st];
    const has=v.mem||v.status==='stored'||v.status==='orphan';
    if(has){
      if(navigator.canShare)kids.push(vidButton(isIOS?'写真に保存（共有）':'共有','primary','共有の画面で「ビデオを保存」を選ぶと、写真アプリに入ります',async()=>{
        try{
          const b=await videoBlob(v),file=new File([b],v.m.name,{type:b.type||v.m.type});
          if(!navigator.canShare({files:[file]}))throw Error('この端末では共有できません。「ファイルに保存」をお使いください');
          await navigator.share({files:[file]})
        }catch(e){if(e?.name!=='AbortError')toast(e.message||'共有できませんでした。「ファイルに保存」をお使いください',5000)}
      }));
      kids.push(vidButton('ファイルに保存','vsave','',async()=>{
        try{await vidDownload(v);toast('ファイルのダウンロードを開始しました。完了はブラウザのダウンロード表示でご確認ください',5000)}
        catch(e){toast(e.message||'書き出せませんでした',5000)}
      }))
    }
    if((v.status==='temp'||v.status==='failed')&&v.mem&&vidPersistent())kids.push(vidButton('ブラウザ内に保存を再試行','','',()=>vidCommit(v,true)));
    if(v.status==='orphan')kids.push(vidButton('一覧に戻す','','この動画データを一覧に登録し直します（データは変わりません）',()=>vidRestore(v)));
    if(v.status==='stored'||v.status==='orphan')kids.push(vidButton('削除','','このブラウザ内に保存した動画を消します。書き出し済みのファイルは消えません',e=>armed(e.currentTarget,'もう一度押すと削除',()=>vidRemove(v))));
    else if(v.status==='missing'||v.status==='unknown')kids.push(vidButton('一覧から外す','','この行だけを外します。ほかの動画やファイルには触れません',e=>armed(e.currentTarget,'もう一度押すと外す',()=>vidForget(v))));
    else if(v.status!=='saving')kids.push(vidButton('一覧から消す','','一時保持している動画を手放します。書き出し済みのファイルは消えません',e=>armed(e.currentTarget,'もう一度押すと消す',()=>{v.mem=null;vidDrop(v)})));
    row.replaceChildren(...kids);
    return row
  }
  // 実体のない行を外す。目録（vmeta）にある行は、目録の削除が終わってから画面から消す
  async function vidForget(v){
    if(v.cat){
      try{await vidQueue(()=>vidTx(s=>s.delete(VMETA+v.m.id)))}
      catch(_){toast('一覧から外せませんでした。もう一度お試しください',5000);return}
    }
    if((state.legacyVideos||[]).some(x=>x.id===v.m.id)){state.legacyVideos=state.legacyVideos.filter(x=>x.id!==v.m.id);saveNow()}
    vidDrop(v)
  }
  function vidDrop(v){const i=vids.indexOf(v);if(i>=0)vids.splice(i,1);v.el?.remove();renderVideoInfo()}
  async function vidRemove(v){
    try{await vidDelete(v.m.id)}
    catch(e){toast('削除できませんでした。動画は残っています。もう一度お試しください',6000);return}
    vidDrop(v);
    toast('動画を削除しました',2500)
  }
  async function vidRestore(v){
    try{
      const b=await getAsset(VBLOB+v.m.id);
      if(!b)throw Error('');
      const m={...v.m,name:v.m.name,size:b.size,type:b.type||'',at:v.m.at||new Date().toISOString()};
      await vidStore(m,b);
      v.m=m;v.status='stored';vidPaint(v);renderVideoInfo();
      toast('一覧に戻しました',2500)
    }catch(e){toast(e?.full?'ブラウザ内の動画が'+VID_MAX+'本あるため戻せません。古い動画を削除してからお試しください':'一覧に戻せませんでした',6000)}
  }
  // 戻り値：stored / full / temp / failed。結果は行の表示に残し、あとからの通知で上書きしない。
  async function vidCommit(v,retry){
    if(!v.mem)return v.status;
    if(!vidPersistent()){
      v.status='temp';vidPaint(v);renderVideoInfo();
      if(retry)toast('この画面ではブラウザ内に保存できません。「ファイルに保存」で書き出してください',6000);
      return ready&&db?'temp':'failed'
    }
    v.status='saving';vidPaint(v);
    let res;
    try{await vidStore(v.m,v.mem);v.status='stored';v.mem=null;res='stored'}
    catch(e){v.status=e?.full?'temp':'failed';res=e?.full?'full':'failed'}
    vidPaint(v);renderVideoInfo();
    if(retry)toast(res==='stored'?'ブラウザ内に保存しました':res==='full'?'ブラウザ内の動画が'+VID_MAX+'本あるため、まだ保存できません。古い動画を削除してから再試行してください':'ブラウザ内に保存できませんでした（空き容量をご確認ください）',6000);
    return res
  }
  async function renderVideoInfo(){
    const el=E('studioVideoInfo');
    if(!el)return;
    const n=vids.filter(v=>v.status==='stored').length,t=vids.filter(v=>v.mem).length,miss=vids.filter(v=>v.status==='missing'||v.status==='orphan').length;
    const parts=[];
    if(n)parts.push('ブラウザ内に保存した動画 '+n+'／'+VID_MAX+'本');
    if(t)parts.push('一時保持 '+t+'本（画面を閉じると消えます）');
    if(miss)parts.push('要確認 '+miss+'件');
    if(parts.length&&vidPersistent())try{const s=await navigator.storage?.estimate?.();if(s&&s.quota)parts.push('このサイトの保存容量 '+(s.usage/1048576).toFixed(0)+' MB／上限の目安 '+(s.quota/1073741824).toFixed(1)+' GB')}catch(_){}
    el.textContent=parts.length?parts.join('・')+'。ブラウザ内の保存は、サイトデータの削除などで消えることがあります。残したい動画はファイルに書き出してください':''
  }
  async function addVideoRow(blob,name){
    const v={m:{id:Math.random().toString(36).slice(2,10),name,size:blob.size,type:blob.type,at:new Date().toISOString()},mem:blob,status:'saving'};
    vids.unshift(v);
    E('studioVideos').prepend(vidPaint(v));
    let dl=false;
    if(!isIOS)try{dl=await vidDownload(v)}catch(_){}
    const res=await vidCommit(v,false);
    const tail=isIOS?'「写真に保存（共有）」→「ビデオを保存」で写真アプリに入ります':dl?'ファイルのダウンロードを開始しました（完了はブラウザの表示でご確認ください）':'「ファイルに保存」で書き出せます';
    if(res==='stored')toast('収録できました。ブラウザ内に保存し、'+tail,7000);
    else if(res==='full')toast('ブラウザ内の動画が'+VID_MAX+'本あるため、今回の動画は一時保持です（古い動画は自動では消しません）。古い動画を削除すると「ブラウザ内に保存を再試行」で保存できます。'+tail,11000);
    else if(res==='temp')toast('この画面ではブラウザ内に保存できないため、一時保持です。'+tail,9000);
    else toast('ブラウザ内に保存できませんでした（空き容量をご確認ください）。一時保持のまま残しています。'+tail,10000)
  }
  // 起動時：目録を読み、0.6.8までの設定内の動画一覧（legacyVideos）を実体と照合して移す。実体のないものは「実体なし」として残し、勝手に消さない。
  async function renderStoredVideos(){
    const box=E('studioVideos');
    const legacy=Array.isArray(state.legacyVideos)?state.legacyVideos:[];
    for(const v of vids.filter(v=>!v.mem))vidDrop(v);
    if(!vidPersistent()){
      for(const m of legacy)vids.push({m,mem:null,status:'unknown'});
      box.append(...vids.filter(v=>!v.mem).map(vidPaint));
      renderVideoInfo();
      return
    }
    let cat;
    try{cat=await vidCatalog()}catch(e){toast('保存した動画の一覧を読めませんでした',5000);return}
    if(legacy.length){
      const keep=[],have=new Set(cat.metas.map(x=>x.id));
      for(const m of legacy){
        if(have.has(m.id))continue;
        if(cat.blobs.has(VBLOB+m.id)){
          try{await vidQueue(()=>vidTx(s=>s.put(vidMetaOf(m),VMETA+m.id)));continue}catch(_){keep.push(m);continue}
        }
        keep.push({...m,missing:true})
      }
      if(keep.length!==legacy.length||keep.some((m,i)=>m.missing!==legacy[i].missing)){state.legacyVideos=keep;save()}
      try{cat=await vidCatalog()}catch(_){}
    }
    const metaIds=new Set(cat.metas.map(x=>x.id)),list=[];
    for(const m of cat.metas.sort((a,b)=>String(b.at).localeCompare(String(a.at))))list.push(cat.blobs.has(VBLOB+m.id)?{m,mem:null,status:'stored'}:{m,mem:null,status:'missing',cat:true});
    for(const m of state.legacyVideos||[])if(!metaIds.has(m.id))list.push({m,mem:null,status:m.missing?'missing':'unknown'});
    for(const k of cat.blobs){
      const id=String(k).slice(VBLOB.length);
      if(metaIds.has(id)||list.some(v=>v.m.id===id))continue;
      list.push({m:{id,name:'動画データ（ID '+id+'）',size:0,type:'',at:''},mem:null,status:'orphan'})
    }
    vids.push(...list);
    box.append(...list.map(vidPaint));
    renderVideoInfo();
    // 一覧から外れていたデータの大きさは、1件ずつ取り出して確かめる（中身は読み込まない）
    for(const v of list.filter(v=>v.status==='orphan'))try{const b=await getAsset(VBLOB+v.m.id);if(b){v.m.size=b.size;v.m.type=b.type||'';vidPaint(v)}}catch(_){}
  }
  window.__otonohaVideos={list:()=>vids.map(v=>({id:v.m.id,status:v.status,mem:!!v.mem,name:v.m.name})),catalog:()=>vidCatalog(),reload:()=>renderStoredVideos()};

  let vidProgSig='';
  function renderVidProg(){
    if(!cfg)return;
    const sel=E('vidProg'),pr=curProgram(),pb=progBgm();
    const sig=JSON.stringify([cfg.currentProgram,cfg.programs.map(p=>[p.name,p.bgmId,p.autoBgm]),pb?.name||'',studioCapturing]);
    if(sig===vidProgSig)return;
    vidProgSig=sig;
    sel.replaceChildren(new Option('フリー（初期BGMなし）','-1'),...cfg.programs.map((p,i)=>new Option(p.name,String(i))));
    sel.value=String(cfg.currentProgram);
    sel.disabled=studioCapturing||captureStarting||rec.state!=='idle';
    E('vidProgNote').textContent=!pr?'番組は、音のお品書きの BGM 欄で切り替え・設定できます。':pb?(pr.autoBgm?'収録開始と同時に「'+pb.name+'」を頭から流します。':'初期BGM「'+pb.name+'」は、番組の設定で「録音開始と同時に初期BGMを頭から流す」をオンにすると収録開始と同時に流れます。'):'この番組の初期BGMは未設定です（音のお品書きの BGM 欄の「番組の設定」で選べます）。'
  }
  E('vidProg').onchange=e=>{
    if(rec.state!=='idle'||studioCapturing)return;
    cfg.currentProgram=Number(e.target.value);
    persist();renderPrograms();preloadProgBgm();renderVidProg()
  };
  setInterval(renderVidProg,700);
  E('vidFormat').value=state.vidFormat;E('vidQuality').value=String(state.vidQuality);
  E('vidFormat').onchange=e=>{state.vidFormat=e.target.value==='webm'?'webm':'mp4';save()};
  E('vidQuality').onchange=e=>{state.vidQuality=Number(e.target.value)||8;save()};
