/* ボイス録り：音声モデルの学習用に、1文ずつ録音して確かめ、WAVと一覧をZIPで書き出す */

  const VR_MAX=2000;
  const vrState=()=>state.vr||(state.vr={speaker:'rio',lines:[],cur:0,trim:true,autoNext:true});
  const vrKey=id=>'vr:'+id;
  let vrStream=null,vrCtx=null,vrNode=null,vrSrc=null,vrBufs=[],vrRec=false,vrRate=48000,vrMeterRaf=0,vrPeakNow=-99,vrInfo={},vrPlaying=null;

  async function vrMic(){
    if(vrStream&&vrStream.active)return true;
    try{
      vrStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
      vrCtx=new AudioContext();vrRate=vrCtx.sampleRate;
      vrSrc=vrCtx.createMediaStreamSource(vrStream);
      vrNode=vrCtx.createScriptProcessor(4096,1,1);
      vrNode.onaudioprocess=e=>{
        const d=e.inputBuffer.getChannelData(0);
        let pk=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>pk)pk=a}
        vrPeakNow=20*Math.log10(Math.max(1e-6,pk));
        if(vrRec)vrBufs.push(new Float32Array(d))
      };
      const mute=vrCtx.createGain();mute.gain.value=0;
      vrSrc.connect(vrNode);vrNode.connect(mute);mute.connect(vrCtx.destination);
      E('vrMicState').textContent='マイク：'+(vrStream.getAudioTracks()[0]?.label||'接続済み')+'（'+vrRate+'Hz・ブラウザの音声加工なし）';
      vrMeter();
      return true
    }catch(e){toast('マイクを開けませんでした',4000);return false}
  }
  function vrMeter(){
    cancelAnimationFrame(vrMeterRaf);
    const bar=E('vrMeter'),tick=()=>{if(!vrStream?.active)return;bar.style.width=Math.max(0,Math.min(100,(vrPeakNow+60)/60*100))+'%';bar.dataset.hot=vrPeakNow>-1?'1':'';vrMeterRaf=requestAnimationFrame(tick)};tick()
  }
  // 録り終えた音を確かめる：音割れ・小さすぎ・雑音・短すぎ。前後の無音を整える
  function vrCheck(x){
    const n=x.length,db=v=>20*Math.log10(Math.max(1e-9,v));
    let pk=0;for(let i=0;i<n;i++){const a=Math.abs(x[i]);if(a>pk)pk=a}
    const win=Math.round(vrRate*.02),rms=[];
    for(let i=0;i+win<=n;i+=win){let s=0;for(let j=i;j<i+win;j++)s+=x[j]*x[j];rms.push(Math.sqrt(s/win))}
    const sorted=[...rms].sort((a,b)=>a-b),floor=db(sorted[Math.floor(sorted.length*.1)]||0),loud=db(sorted[Math.floor(sorted.length*.95)]||0);
    let clip=0;for(let i=0;i<n;i++)if(Math.abs(x[i])>=.995)clip++;
    const th=Math.max(floor+10,-50);
    let a=rms.findIndex(v=>db(v)>th),b=rms.length-1-[...rms].reverse().findIndex(v=>db(v)>th);
    if(a<0){a=0;b=rms.length-1}
    const voiced=(b-a+1)*win/vrRate,notes=[];
    if(clip>3||db(pk)>-.3)notes.push('音割れの疑い');
    if(loud<-30)notes.push('声が小さめ');
    if(floor>-50)notes.push('雑音が多め（'+floor.toFixed(0)+'dB）');
    if(voiced<.5)notes.push('短すぎる');
    return {peak:db(pk),floor,loud,clip,a:Math.max(0,a*win-Math.round(vrRate*.15)),b:Math.min(n,(b+1)*win+Math.round(vrRate*.2)),secs:n/vrRate,notes}
  }
  function vrWav(x,rate){
    const buf=new ArrayBuffer(44+x.length*2),v=new DataView(buf),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
    w(0,'RIFF');v.setUint32(4,36+x.length*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,x.length*2,true);
    for(let i=0;i<x.length;i++){const s=Math.max(-1,Math.min(1,x[i]));v.setInt16(44+i*2,s<0?s*32768:s*32767,true)}
    return new Blob([buf],{type:'audio/wav'})
  }
  async function vrStart(){
    const s=vrState(),line=s.lines[s.cur];
    if(!line){toast('先に、読み上げる文を入れてください');return}
    if(!await vrMic())return;
    if(vrCtx.state==='suspended')await vrCtx.resume();
    vrBufs=[];vrRec=true;
    E('vrRec').textContent='■ 録音を止める（Space）';E('vrRec').classList.add('recording');
    E('vrStatus').textContent='録音中…　読み終えたら止めてください'
  }
  async function vrStop(){
    if(!vrRec)return;
    vrRec=false;
    E('vrRec').textContent='● 録音する（Space）';E('vrRec').classList.remove('recording');
    const s=vrState(),line=s.lines[s.cur],len=vrBufs.reduce((a,b)=>a+b.length,0),x=new Float32Array(len);
    let o=0;for(const b of vrBufs){x.set(b,o);o+=b.length}
    vrBufs=[];
    if(len<vrRate*.3){E('vrStatus').textContent='録音が短すぎたので保存しませんでした';return}
    const c=vrCheck(x),body=s.trim?x.subarray(c.a,c.b):x;
    try{await putAsset(vrKey(line.id),vrWav(body,vrRate))}catch(_){toast('保存できませんでした（空き容量をご確認ください）',5000);return}
    line.done=true;line.secs=+(body.length/vrRate).toFixed(2);line.notes=c.notes;line.rate=vrRate;
    save();
    E('vrStatus').textContent=(c.notes.length?'要確認：'+c.notes.join('・'):'問題は見つかりませんでした')+'　（最大 '+c.peak.toFixed(1)+'dB／雑音 '+c.floor.toFixed(0)+'dB／'+line.secs+'秒）';
    vrRenderList();
    if(s.autoNext&&!c.notes.length&&s.cur<s.lines.length-1){s.cur++;save();vrRender()}else vrRender()
  }
  async function vrPlay(line){
    try{
      vrPlaying?.pause();
      const b=await getAsset(vrKey(line.id));if(!b){toast('この文はまだ録音されていません');return}
      const u=URL.createObjectURL(b),au=new Audio(u);vrPlaying=au;au.onended=()=>URL.revokeObjectURL(u);await au.play()
    }catch(_){toast('再生できませんでした')}
  }
  function vrRender(){
    const s=vrState(),line=s.lines[s.cur];
    E('vrSpeaker').value=s.speaker;E('vrTrim').checked=s.trim;E('vrAuto').checked=s.autoNext;
    const done=s.lines.filter(l=>l.done).length,secs=s.lines.reduce((a,l)=>a+(l.done?l.secs||0:0),0);
    E('vrProgress').textContent=s.lines.length?`${s.cur+1}／${s.lines.length}文目　録音済み ${done}文（合計 ${Math.floor(secs/60)}分${Math.round(secs%60)}秒）`:'読み上げる文がありません';
    E('vrLine').textContent=line?line.text:'下の「読み上げる文」に、1行に1文ずつ入れてください';
    E('vrLineState').textContent=line?(line.done?'録音済み（'+line.secs+'秒）'+(line.notes?.length?'・要確認：'+line.notes.join('・'):''):'未録音'):''
  }
  function vrRenderList(){
    const s=vrState(),box=E('vrList');
    box.replaceChildren(...s.lines.slice(0,VR_MAX).map((l,i)=>{
      const li=document.createElement('li');
      li.className=(i===s.cur?'cur ':'')+(l.done?(l.notes?.length?'warn':'done'):'');
      const t=document.createElement('span');t.className='sb-name';t.textContent=(i+1)+'. '+l.text;
      const st=document.createElement('small');st.textContent=l.done?(l.notes?.length?'要確認':'済')+'・'+l.secs+'秒':'未';
      const go=document.createElement('button');go.type='button';go.textContent='この文へ';go.onclick=()=>{s.cur=i;save();vrRender();vrRenderList()};
      const pl=document.createElement('button');pl.type='button';pl.textContent='▶';pl.disabled=!l.done;pl.onclick=()=>vrPlay(l);
      li.append(t,st,go,pl);return li
    }))
  }
  E('vrRec').onclick=()=>vrRec?vrStop():vrStart();
  document.addEventListener('keydown',e=>{
    if(e.code!=='Space'||document.body.dataset.studioMode!=='aivoice'||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
    e.preventDefault();vrRec?vrStop():vrStart()
  });
  E('vrPrev').onclick=()=>{const s=vrState();if(s.cur>0){s.cur--;save();vrRender();vrRenderList()}};
  E('vrNext').onclick=()=>{const s=vrState();if(s.cur<s.lines.length-1){s.cur++;save();vrRender();vrRenderList()}};
  E('vrPlay').onclick=()=>{const s=vrState(),l=s.lines[s.cur];if(l)vrPlay(l)};
  E('vrSpeaker').oninput=e=>{vrState().speaker=e.target.value.replace(/[^\w\-ぁ-んァ-ヶ一-龠ー]/g,'').slice(0,30)||'speaker';save()};
  E('vrTrim').onchange=e=>{vrState().trim=e.target.checked;save()};
  E('vrAuto').onchange=e=>{vrState().autoNext=e.target.checked;save()};
  E('vrAddLines').onclick=()=>{
    const s=vrState(),add=E('vrText').value.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/^[A-Z_]*\d+[:：]/,'').trim()).filter(Boolean);
    if(!add.length){toast('読み上げる文を入れてください');return}
    if(s.lines.length+add.length>VR_MAX){toast('文は'+VR_MAX+'個までです');return}
    s.lines.push(...add.map(text=>({id:Math.random().toString(36).slice(2,10),text:text.slice(0,300)})));
    E('vrText').value='';save();vrRender();vrRenderList();
    toast(add.length+'文を足しました',2500)
  };
  E('vrLoadTxt').onclick=()=>E('vrTxtFile').click();
  E('vrTxtFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f){E('vrText').value=(await f.text()).slice(0,400000);toast('ファイルの中身を入れました。「文を足す」で一覧に加わります',4000)}};
  E('vrDelLine').onclick=e=>armed(e.currentTarget,'もう一度押すとこの文と録音を消す',async()=>{
    const s=vrState(),l=s.lines[s.cur];if(!l)return;
    await deleteAsset(vrKey(l.id));s.lines.splice(s.cur,1);s.cur=Math.max(0,Math.min(s.cur,s.lines.length-1));save();vrRender();vrRenderList()
  });
  // ZIP（無圧縮）を作る
  const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
  const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=crcT[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
  function zipStore(files){
    const enc=new TextEncoder(),parts=[],cen=[];let off=0;
    for(const f of files){
      const name=enc.encode(f.name),d=f.data,crc=crc32(d),h=new DataView(new ArrayBuffer(30));
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,name.length,true);
      parts.push(h.buffer,name,d);
      const c=new DataView(new ArrayBuffer(46));
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
      cen.push(c.buffer,name);off+=30+name.length+d.length
    }
    const cs=cen.reduce((a,b)=>a+(b.byteLength??b.length),0),e=new DataView(new ArrayBuffer(22));
    e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
    return new Blob([...parts,...cen,e.buffer],{type:'application/zip'})
  }
  E('vrExport').onclick=async()=>{
    const s=vrState(),done=s.lines.filter(l=>l.done);
    if(!done.length){toast('録音済みの文がありません');return}
    E('vrExport').disabled=true;
    try{
      const files=[],list=[],plain=[],sp=s.speaker||'speaker';
      let i=0;
      for(const l of done){
        const b=await getAsset(vrKey(l.id));if(!b)continue;
        i++;const fn=sp+'_'+String(i).padStart(4,'0')+'.wav';
        files.push({name:sp+'/raw/'+fn,data:new Uint8Array(await b.arrayBuffer())});
        list.push(fn+'|'+sp+'|JP|'+l.text);plain.push(fn+'\t'+l.text)
      }
      const enc=new TextEncoder();
      files.push({name:sp+'/esd.list',data:enc.encode(list.join('\n')+'\n')});
      files.push({name:sp+'/transcript.tsv',data:enc.encode(plain.join('\n')+'\n')});
      files.push({name:sp+'/README.txt',data:enc.encode('配信処オトノハ「ボイス録り」で録音した '+i+'文\n話者名：'+sp+'\n形式：WAV（モノラル・16bit・'+(done[0].rate||vrRate)+'Hz）\nraw/ … 1文1ファイルの録音\nesd.list … 「ファイル名|話者名|JP|読み上げた文」の一覧（Style-Bert-VITS2 などの学習用の形式）\ntranscript.tsv … ファイル名と文（タブ区切り）\n')});
      const z=zipStore(files),a=document.createElement('a');
      a.href=URL.createObjectURL(z);a.download='voice_'+sp+'_'+new Date().toISOString().slice(0,10)+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
      toast(i+'文をZIPに書き出しました（ダウンロードを開始しました）',5000)
    }finally{E('vrExport').disabled=false}
  };
  function renderVoiceRec(){vrRender();vrRenderList()}
