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
