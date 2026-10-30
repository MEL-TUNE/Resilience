/* 歌枠ノート：カラオケ音源の検索、伴奏タブの取り込み、歌い始めのフェード */
/* ===================== カラオケ音源を探す・伴奏タブの音を取り込む ===================== */
 
  function karaDefaults(){
    return [
  
      {name:'Hiroのピアノ伴奏アレンジ',url:'https://www.youtube.com/channel/UCWX2b3xIeJHoiNOPd9nTuKA',memo:'YouTube 可／収益化 可／YouTube以外 可・クレジット「Hiro」'},
  
      {name:'OKE-sound',url:'https://www.youtube.com/@OKE-sound',memo:'YouTube 可／収益化 可／YouTube以外 可'},
  
      {name:'SELA',url:'https://www.youtube.com/@SELA_',memo:'YouTube 可／収益化 可／YouTube以外 不可'},
  
      {name:'かいちょ',url:'https://www.youtube.com/@kaicho_uk',memo:'YouTube 可／収益化 可／YouTube以外 可'},
  
      {name:'カラオケ歌っちゃ王',url:'https://www.youtube.com/@uta-cha-oh',memo:'YouTube 条件付き／収益化 不可／YouTube以外 不可'},
  
      {name:'桜音ふう',url:'https://www.youtube.com/@sakuranefu',memo:'YouTube 条件付き／収益化 条件付き／YouTube以外 条件付き'}
    ]
  }
 
  function karaList(){
    if(!Array.isArray(state.karaChannels))state.karaChannels=karaDefaults();
    return state.karaChannels
  }
 
  function karaBase(u){
    u=String(u||'').trim();
    if(/^@[^\s/?#]+$/.test(u))return 'https://www.youtube.com/'+u;
    const m=u.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(@[^\/?#\s]+|channel\/UC[\w-]{22}|c\/[^\/?#\s]+|user\/[^\/?#\s]+)/i);
    return m?'https://www.youtube.com/'+m[1]:''
  }
 
  function karaQueryText(){
    return E('karaQuery').value.trim()
  }
 
  function karaGo(url){
    const popup=state.karaOpen!=='tab';
    let w=null;
    try{
      w=popup?window.open(url,'otonohaKaraokeWin','popup=yes,width=1040,height=780'):window.open(url,'otonohaKaraokeTab')
    }catch(_){}
    if(!w){
      toast('ブラウザに新しい窓を止められました。アドレスバーの表示からポップアップを許可すると開けます',7000);
      return
    }
    try{
      w.focus()
    }catch(_){}
  }
 
  function karaSearch(ch){
    const q=karaQueryText();
    const base=karaBase(ch.url);
    if(!base){
      toast('「'+(ch.name||'このチャンネル')+'」のURLが読み取れません。チャンネルを編集から直せます',6000);
      return
    }
    karaGo(q?base+'/search?query='+encodeURIComponent(q):base+'/videos')
  }
 
  function renderKara(){
    const box=E('karaChannels');
    if(!box)return;
    const list=karaList();
    box.replaceChildren();
    list.forEach(ch=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='kara-ch';
      const n=document.createElement('span');
      n.textContent=ch.name||'（名前なし）';
      b.append(n);
      if(ch.memo){
        const s=document.createElement('small');
        s.textContent=ch.memo;
        b.append(s)
      }
      b.title=karaBase(ch.url)?(karaQueryText()?'このチャンネル内を検索':'このチャンネルの動画一覧を開く'):'URLが読み取れません';
      b.onclick=()=>karaSearch(ch);
      box.append(b)
    });
    if(!list.length){
      const p=document.createElement('p');
      p.className='studio-note';
      p.textContent='チャンネルが登録されていません。「チャンネルを編集」から追加できます。';
      box.append(p)
    }
  
    const ed=E('karaEdit');
    ed.replaceChildren();
    list.forEach((ch,i)=>{
      const row=document.createElement('div');
      row.className='kara-edit-row';
      const mk=(cls,key,ph,label)=>{
        const inp=document.createElement('input');
        inp.type='text';
        inp.className=cls;
        inp.value=ch[key]||'';
        inp.placeholder=ph;
        inp.setAttribute('aria-label',label);
        inp.onchange=()=>{
          ch[key]=inp.value.trim();
          save();
          renderKara()
        };
        return inp
      };
      const btns=document.createElement('div');
      btns.className='kara-btns';
      for(const[label,act]of [['↑',()=>{
            if(i>0)[list[i-1],list[i]]=[list[i],list[i-1]]
          }],['↓',()=>{
            if(i<list.length-1)[list[i+1],list[i]]=[list[i],list[i+1]]
          }],['削除',()=>list.splice(i,1)]]){
        const b=document.createElement('button');
        b.type='button';
        b.textContent=label;
        b.setAttribute('aria-label',(ch.name||'チャンネル')+' '+label);
        b.onclick=()=>{
          act();
          save();
          renderKara()
        };
        btns.append(b)
      }
      row.append(mk('kara-name','name','チャンネル名','チャンネル名'),mk('kara-url','url','https://www.youtube.com/@…','URL'),btns,mk('kara-memo','memo','メモ（使用条件など）','メモ'));
      ed.append(row)
    });
  
    E('karaOpen').value=state.karaOpen==='tab'?'tab':'popup';
    E('karaVol').value=state.karaVol;
    E('karaVolVal').textContent=Math.round(state.karaVol)+'%';
    E('karaSuppress').checked=state.karaSuppress!==false;
    E('karaAutoFade').checked=state.karaAutoFade!==false;
    E('karaFadeEnv').checked=state.karaFadeEnv===true
  }
 
  E('karaQuery').addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const list=karaList();
      if(list[0])karaSearch(list[0])
    }
  });
 
  E('karaQuery').addEventListener('input',()=>{
    clearTimeout(E('karaQuery')._t);
    E('karaQuery')._t=setTimeout(renderKara,250)
  });
 
  E('karaFromSong').onclick=()=>{
    const v=[E('songTitle').value.trim(),E('songArtist').value.trim()].filter(Boolean).join(' ');
    if(!v){
      toast('上の曲名欄が空です');
      return
    }
    E('karaQuery').value=v;
    renderKara()
  };
 
  E('karaAll').onclick=()=>{
    const q=karaQueryText();
    if(!q){
      toast('探す言葉を入力してください');
      return
    }
    karaGo('https://www.youtube.com/results?search_query='+encodeURIComponent(q+' カラオケ'))
  };
 
  E('karaOpen').onchange=e=>{
    state.karaOpen=e.target.value==='tab'?'tab':'popup';
    save()
  };
 
  E('karaAdd').onclick=()=>{
    karaList().push({name:'',url:'',memo:''});
    save();
    renderKara();
    const rows=E('karaEdit').querySelectorAll('.kara-name');
    rows[rows.length-1]?.focus()
  };
 
  E('karaReset').onclick=e=>{
    const b=e.currentTarget;
    if(b.dataset.armed!=='1'){
      b.dataset.armed='1';
      b.textContent='もう一度押すと初期の6件に戻します';
      clearTimeout(b._t);
      b._t=setTimeout(()=>{
        b.dataset.armed='';
        b.textContent='初期の6件に戻す'
      },4000);
      return
    }
    b.dataset.armed='';
    b.textContent='初期の6件に戻す';
    state.karaChannels=karaDefaults();
    save();
    renderKara();
    toast('チャンネルを初期の6件に戻しました')
  };
 
  let karaStream=null,
    karaSrc=null,
    karaGain=null;
 
  function karaSetInfo(text){
    const el=E('karaCapInfo');
    if(el)el.textContent=text
  }
 
  function karaStopCapture(byUser){
    if(karaSrc){
      try{
        karaSrc.disconnect()
      }catch(_){}
    }
    if(karaGain){
      try{
        karaGain.disconnect()
      }catch(_){}
    }
    if(karaStream)karaStream.getTracks().forEach(t=>{
      try{
        t.stop()
      }catch(_){}
    });
    const was=!!karaStream;
    karaStream=null;
    karaSrc=null;
    karaGain=null;
    E('karaStop').disabled=true;
    E('karaCapture').textContent='伴奏タブの音を取り込む';
    karaSetInfo('停止中');
    if(was&&!byUser)toast('伴奏タブの取り込みが終わりました（共有が止められたか、タブが閉じられました）',5000)
  }
 
  async function karaCapture(){
    if(!navigator.mediaDevices?.getDisplayMedia){
      toast('このブラウザでは別タブの音を取り込めません（パソコン版のChrome・Edgeで使えます）',7000);
      return
    }
  
    const btn=E('karaCapture');
    btn.disabled=true;
    try{
      await ensureRunning();
      const controller=('CaptureController' in window)?new CaptureController():null;
      const opts={
        video:{frameRate:{ideal:1,max:5},width:{max:640},height:{max:360}},
        audio:{suppressLocalAudioPlayback:state.karaSuppress!==false,echoCancellation:false,noiseSuppression:false,autoGainControl:false},
        preferCurrentTab:false,
        selfBrowserSurface:'exclude',
        surfaceSwitching:'include',
        systemAudio:'include',
        monitorTypeSurfaces:'exclude'
      };
      if(controller)opts.controller=controller;
   
      const st=await navigator.mediaDevices.getDisplayMedia(opts);
      try{
        controller?.setFocusBehavior?.('no-focus-change')
      }catch(_){}
   
      const at=st.getAudioTracks();
      if(!at.length){
        st.getTracks().forEach(t=>t.stop());
        toast('音声が取り込まれていません。選ぶ画面で「タブの音声も共有する」をオンにして、もう一度試してください',8000);
        return
      }
   
      karaStopCapture(true);
      karaStream=st;
      karaSrc=ctx.createMediaStreamSource(new MediaStream(at));
      karaGain=ctx.createGain();
      karaGain.channelCount=2;
      karaGain.channelCountMode='explicit';
      karaGain.channelInterpretation='speakers';
      karaGain.gain.value=state.karaVol/100;
      karaSrc.connect(karaGain);
      karaGain.connect(programBus);
   
      at[0].addEventListener('ended',()=>{
        if(karaStream===st)karaStopCapture(false)
      });
      st.getVideoTracks().forEach(v=>v.addEventListener('ended',()=>{
        if(karaStream===st&&st.getAudioTracks().every(a=>a.readyState==='ended'))karaStopCapture(false)
      }));
   
      const vt=st.getVideoTracks()[0],
        surface=vt?.getSettings?.().displaySurface;
      E('karaStop').disabled=false;
      btn.textContent='別のタブに切り替える';
      karaSetInfo('取り込み中：'+(surface==='browser'?'タブの音':surface==='window'?'ウィンドウの音':surface==='monitor'?'画面全体の音（パソコンの音すべて）':'選んだ画面の音')+'・再生と一時停止はそのタブで');
   
      if(surface==='monitor')toast('画面全体を選ぶと、パソコンで鳴っている音すべて（このアプリ自身の音も）が入ります。二重やハウリングに注意してください',8000);else toast('伴奏タブの音を取り込みました')
    }
  catch(e){
      if(e&&e.name==='NotAllowedError')toast('取り込みを取り消しました');else toast('取り込めませんでした：'+(e&&(e.message||e.name)||'不明'),7000)
    }finally{
      btn.disabled=false
    }
  }
 
  E('karaCapture').onclick=karaCapture;
  E('karaStop').onclick=()=>{
    karaStopCapture(true);
    toast('伴奏タブの取り込みをやめました')
  };
 
  E('karaVol').oninput=e=>{
    state.karaVol=Number(e.target.value);
    E('karaVolVal').textContent=Math.round(state.karaVol)+'%';
    if(karaGain&&ctx)karaGain.gain.setTargetAtTime(state.karaVol/100,ctx.currentTime,.03)
  };
  E('karaVol').onchange=()=>save();
 
  E('karaSuppress').onchange=e=>{
    state.karaSuppress=e.target.checked;
    save()
  };
 
  if(!navigator.mediaDevices?.getDisplayMedia){
    E('karaCapture').disabled=true;
    karaSetInfo('このブラウザでは使えません（パソコン版のChrome・Edgeで使えます）')
  }
 
  window.addEventListener('pagehide',()=>{
    if(karaStream)karaStream.getTracks().forEach(t=>{
      try{
        t.stop()
      }catch(_){}
    })
  });

 // v0.4.7: 歌い始めたらBGM・効果音をフェードアウト
 
  function singFade(reason){
    if(!ready||!cfg)return 0;
    const insts=[...active].filter(a=>{
      const s=cfg.sounds.find(x=>x.id===a.soundId);
      return !s||s.type!=='env'||state.karaFadeEnv===true
    });
    if(bgmPlaying)insts.push(bgmPlaying);
    bgmSerial++;
    bgmPendingId=null;
    bgmLoadingId=null;
    for(const s of cfg.sounds)if(s.type!=='env'||state.karaFadeEnv===true)soundSerial.set(s.id,(soundSerial.get(s.id)||0)+1);
    pendingText.clear();
    insts.forEach(x=>fadeStop(x,1.2));
    if(insts.length)toast(reason+'：BGM・効果音をフェードアウトしました',3000);
    return insts.length
  }
 
  E('karaSingStart').onclick=()=>{
    if(!singFade('歌い始め'))toast('止める音は鳴っていません')
  };
 
  E('karaAutoFade').onchange=e=>{
    state.karaAutoFade=e.target.checked;
    save()
  };
  E('karaFadeEnv').onchange=e=>{
    state.karaFadeEnv=e.target.checked;
    save()
  };
 
  let karaAnal=null,
    karaBuf=null,
    karaQuietStart=0,
    karaOnsetGap=0,
    karaLoudSince=0,
    karaSinging=false;
 
  setInterval(()=>{
    if(!karaGain||!ctx){
      karaAnal=null;
      karaSinging=false;
      karaLoudSince=0;
      return
    }
    const now=performance.now();
    if(!karaAnal||karaAnal.__src!==karaGain){
      karaAnal=ctx.createAnalyser();
      karaAnal.fftSize=2048;
      karaAnal.__src=karaGain;
      karaGain.connect(karaAnal);
      karaBuf=new Float32Array(2048);
      karaQuietStart=now-2500;
      karaLoudSince=0;
      karaSinging=false
    }
    karaAnal.getFloatTimeDomainData(karaBuf);
    let s=0;
    for(const x of karaBuf)s+=x*x;
    const db=20*Math.log10(Math.max(1e-8,Math.sqrt(s/karaBuf.length)));
  
    if(db>-48){
      if(!karaLoudSince){
        karaLoudSince=now;
        karaOnsetGap=karaQuietStart?now-karaQuietStart:0;
        karaQuietStart=0
      }
      if(!karaSinging&&now-karaLoudSince>=300&&karaOnsetGap>=1800){
        karaSinging=true;
        if(state.karaAutoFade!==false)singFade('伴奏が始まりました')
      }
    }
  else{
      karaLoudSince=0;
      if(db<-60){
        if(!karaQuietStart)karaQuietStart=now;
        if(now-karaQuietStart>=1800)karaSinging=false
      }
    }
  },100);
