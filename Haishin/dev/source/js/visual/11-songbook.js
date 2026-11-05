/* 歌枠ノート：曲リスト・セトリ・歌唱の記録 */

  const SB={
    title:E('songTitle'),artist:E('songArtist'),memo:E('songMemo'),
    set:E('songList'),rep:E('repList'),repFilter:E('repFilter'),repCount:E('repCount'),
    log:E('singLog'),sessBtn:E('singSessBtn'),sessState:E('singSessState'),now:E('singNow'),
    core:E('songbookCore'),home:E('songbookHome'),away:E('songbookAway')
  };
  const songKey=(t,a)=>(t||'').trim().toLowerCase()+'\n'+(a||'').trim().toLowerCase();
  const sbId=()=>Math.random().toString(36).slice(2,10);
  function repList(){if(!Array.isArray(state.repertoire))state.repertoire=[];return state.repertoire}
  function logList(){if(!Array.isArray(state.singLog))state.singLog=[];return state.singLog}
  function sbInput(){return {title:SB.title.value.trim(),artist:SB.artist.value.trim(),memo:SB.memo.value.trim()}}
  function sbClear(){SB.title.value='';SB.artist.value='';SB.memo.value=''}
  function repFind(t,a){const k=songKey(t,a);return repList().find(s=>songKey(s.title,s.artist)===k)}
  function repAdd(t,a,memo){
    let s=repFind(t,a);
    if(!s){
      if(repList().length>=3000){toast('曲リストは3000曲までです');return null}
      s={id:sbId(),title:t.slice(0,200),artist:(a||'').slice(0,200),memo:(memo||'').slice(0,200),count:0,last:''};
      repList().push(s)
    }else if(memo)s.memo=memo.slice(0,200);
    return s
  }
  const hms=sec=>{sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return (h?String(h).padStart(2,'0')+':':'00:')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};
  const curProfName=()=>(state.profiles||[]).find(p=>p.id===state.profileId)?.name||'';

  function sessStart(){
    state.singSess={id:sbId(),start:new Date().toISOString(),prof:curProfName()};
    save();renderSongs();
    toast('歌唱の記録を始めました。「♪ 歌い始め」を押すと、ここからの経過時間と一緒に残ります',6000)
  }
  function sessEnd(){
    if(!state.singSess)return;
    const n=logList().filter(x=>x.sess===state.singSess.id).length;
    state.singSess=null;save();renderSongs();
    toast('記録を終えました（'+n+'曲）。下の「歌唱の記録」に残っています',5000)
  }
  function sing(t,a){
    if(!t)return;
    if(!state.singSess)sessStart();
    const ss=state.singSess,now=new Date(),off=(now-new Date(ss.start))/1000;
    const log=logList();
    log.push({id:sbId(),t:now.toISOString(),title:t,artist:a||'',sess:ss.id,start:ss.start,off:Math.round(off),prof:ss.prof||curProfName()});
    if(log.length>5000)log.splice(0,log.length-5000);
    const r=repAdd(t,a);
    if(r){r.count=(r.count||0)+1;r.last=now.toISOString()}
    save();renderSongs();
    toast('「'+t+'」を記録しました（'+hms(off)+'）',3000)
  }

  E('songAdd').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力してください');return}
    if(state.songs.length>=300){toast('セトリは300曲までです');return}
    state.songs.push({title:v.title,artist:v.artist});
    repAdd(v.title,v.artist,v.memo);
    save();renderSongs();sbClear()
  };
  E('repAdd').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力してください');return}
    const had=!!repFind(v.title,v.artist);
    if(repAdd(v.title,v.artist,v.memo)){save();renderSongs();sbClear();toast(had?'登録済みの曲です（メモを更新しました）':'曲リストに登録しました')}
  };
  E('singNowBtn').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力するか、セトリ・曲リストの「♪ 歌い始め」を押してください',5000);return}
    sing(v.title,v.artist);sbClear()
  };
  E('songSearch').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('検索する曲名を入力してください');return}
    window.open('https://www.google.com/search?q='+encodeURIComponent([v.title,v.artist,'歌詞'].filter(Boolean).join(' ')),'_blank')
  };
  SB.sessBtn.onclick=()=>state.singSess?sessEnd():sessStart();
  E('songCopy').onclick=()=>copy(state.songs.map((s,i)=>`${i+1}. ${s.title}${s.artist?' / '+s.artist:''}`).join('\n'));
  E('songClear').onclick=e=>armed(e.currentTarget,'もう一度押すとセトリを空にする',()=>{state.songs=[];save();renderSongs()});
  SB.repFilter.oninput=()=>renderRep();

  function rowBtn(label,cls,fn,title){const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;if(title)b.title=title;b.onclick=fn;return b}
  function songSpan(t,a,extra){const s=document.createElement('span');s.className='sb-name';s.textContent=t+(a?' / '+a:'');if(extra){const x=document.createElement('small');x.textContent=extra;s.append(x)}return s}

  function renderSet(){
    SB.set.replaceChildren();
    state.songs.forEach((s,i)=>{
      const li=document.createElement('li');
      li.append(rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist),'この曲を歌い始めた時刻を記録します'),songSpan(s.title,s.artist));
      li.append(rowBtn('↑','',()=>{if(i>0){[state.songs[i-1],state.songs[i]]=[state.songs[i],state.songs[i-1]];save();renderSet()}}),
        rowBtn('↓','',()=>{if(i<state.songs.length-1){[state.songs[i+1],state.songs[i]]=[state.songs[i],state.songs[i+1]];save();renderSet()}}),
        rowBtn('外す','',()=>{state.songs.splice(i,1);save();renderSet()}));
      SB.set.append(li)
    });
    if(!state.songs.length){const li=document.createElement('li');li.className='sb-empty';li.textContent='セトリは空です。上で曲名を入れて「セトリに追加」、または曲リストの「セトリへ」で追加できます';SB.set.append(li)}
  }
  function renderRep(){
    const q=SB.repFilter.value.trim().toLowerCase(),all=repList();
    const list=all.filter(s=>!q||(s.title+' '+s.artist+' '+(s.memo||'')).toLowerCase().includes(q)).sort((a,b)=>(b.last||'').localeCompare(a.last||'')||a.title.localeCompare(b.title,'ja'));
    SB.repCount.textContent=all.length+'曲';
    SB.rep.replaceChildren();
    for(const s of list.slice(0,300)){
      const li=document.createElement('li');
      const info=(s.count?'歌った回数 '+s.count+'回':'まだ記録なし')+(s.last?'・最後 '+s.last.slice(0,10):'')+(s.memo?'・'+s.memo:'');
      li.append(rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist)),songSpan(s.title,s.artist,info),
        rowBtn('セトリへ','',()=>{state.songs.push({title:s.title,artist:s.artist});save();renderSet();toast('セトリに追加しました')}),
        rowBtn('削除','',e=>armed(e.currentTarget,'もう一度押すと削除',()=>{state.repertoire=repList().filter(x=>x!==s);save();renderRep()})));
      SB.rep.append(li)
    }
    if(list.length>300){const li=document.createElement('li');li.className='sb-empty';li.textContent='ほか'+(list.length-300)+'曲（絞り込みで探せます）';SB.rep.append(li)}
    if(!all.length){const li=document.createElement('li');li.className='sb-empty';li.textContent='まだ曲が登録されていません。上で曲名・アーティストを入れて「曲リストに登録」を押すか、「♪ 歌い始め」で記録すると自動で登録されます';SB.rep.append(li)}
  }
  function sessions(){
    const m=new Map();
    for(const x of logList()){if(!m.has(x.sess))m.set(x.sess,{id:x.sess,start:x.start,prof:x.prof,items:[]});m.get(x.sess).items.push(x)}
    return [...m.values()].sort((a,b)=>(b.start||'').localeCompare(a.start||''))
  }
  const localTime=iso=>{const d=new Date(iso);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
  function sessText(s){return s.items.map(x=>`${hms(x.off)} ${x.title}${x.artist?' / '+x.artist:''}`).join('\n')}
  function sessCsv(list){
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const rows=[['日付','記録の開始','経過','曲名','アーティスト','名義']];
    for(const s of list)for(const x of s.items){const d=new Date(x.t);rows.push([`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,localTime(s.start),hms(x.off),x.title,x.artist,x.prof])}
    return '﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n')
  }
  function saveCsv(list,name){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([sessCsv(list)],{type:'text/csv'}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)
  }
  function renderLog(){
    SB.log.replaceChildren();
    const ss=sessions();
    for(const s of ss.slice(0,30)){
      const box=document.createElement('details');box.className='sb-sess';box.open=s===ss[0];
      const sum=document.createElement('summary');sum.textContent=localTime(s.start)+'　'+(s.prof||'')+'　'+s.items.length+'曲'+(state.singSess?.id===s.id?'（記録中）':'');
      const ol=document.createElement('ol');
      for(const x of s.items){const li=document.createElement('li');li.append(songSpan(hms(x.off)+'　'+x.title,x.artist),rowBtn('消す','',()=>{state.singLog=logList().filter(y=>y!==x);save();renderLog()}));ol.append(li)}
      const row=document.createElement('div');row.className='studio-row';
      row.append(rowBtn('タイムスタンプをコピー（概要欄用）','accent',()=>copy(sessText(s))),
        rowBtn('CSVで保存','',()=>saveCsv([s],'utawaku_'+s.start.slice(0,10)+'.csv')),
        rowBtn('この回の記録を削除','',e=>armed(e.currentTarget,'もう一度押すと削除',()=>{state.singLog=logList().filter(y=>y.sess!==s.id);if(state.singSess?.id===s.id)state.singSess=null;save();renderSongs()})));
      box.append(sum,ol,row);SB.log.append(box)
    }
    if(!ss.length){const p=document.createElement('p');p.className='studio-note';p.textContent='まだ記録はありません。歌枠を始めるときに「● 歌唱の記録を始める」を押し、歌うたびに「♪ 歌い始め」を押すと、ここに経過時間つきで残ります。';SB.log.append(p)}
    else{const row=document.createElement('div');row.className='studio-row';row.append(rowBtn('すべての記録をCSVで保存','',()=>saveCsv(ss,'utawaku_all.csv')));SB.log.append(row)}
  }
  function renderSess(){
    const ss=state.singSess;
    SB.sessBtn.textContent=ss?'■ 記録を終える':'● 歌唱の記録を始める';
    SB.sessBtn.classList.toggle('recording',!!ss);
    if(!ss){SB.sessState.textContent='記録していません';SB.now.textContent='';return}
    SB.sessState.textContent='記録中 '+hms((Date.now()-new Date(ss.start))/1000)+'（'+localTime(ss.start)+'から）';
    const last=logList().filter(x=>x.sess===ss.id).at(-1);
    SB.now.textContent=last?'いま：'+last.title+(last.artist?' / '+last.artist:'')+'（'+hms(last.off)+'〜）':''
  }
  setInterval(()=>{if(state.singSess)renderSess()},1000);
  function renderSongs(){renderSess();renderSet();renderRep();renderLog()}

  // 別タブで開く：ノートの部品をそのタブへ移し、閉じたら戻す
  let sbWin=null;
  function sbBack(){
    if(!SB.core.isConnected||SB.core.ownerDocument!==document){try{SB.home.append(document.adoptNode(SB.core))}catch(_){}}
    SB.away.hidden=true;sbWin=null
  }
  E('songbookPop').onclick=()=>{
    if(sbWin&&!sbWin.closed){sbWin.focus();return}
    const w=window.open('','otonohaSongbook');
    if(!w){toast('新しいタブを開けませんでした。ポップアップの許可をご確認ください',6000);return}
    sbWin=w;
    const css=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n');
    w.document.open();
    w.document.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>歌枠ノート｜オトノハ</title><style>'+css.replace(/<\/style/gi,'<\\/style')+'</style><style>body{padding:14px;background:var(--bg)}.sb-pop{max-width:980px;margin:0 auto}</style></head><body><div class="studio-card sb-pop"></div></body></html>');
    w.document.close();
    const st=document.documentElement.getAttribute('style');if(st)w.document.documentElement.setAttribute('style',st);
    for(const a of document.body.attributes)if(a.name.startsWith('data-'))w.document.body.setAttribute(a.name,a.value);
    w.document.querySelector('.sb-pop').append(w.document.adoptNode(SB.core));
    SB.away.hidden=false;
    w.addEventListener('pagehide',()=>setTimeout(sbBack,0));
    const chk=setInterval(()=>{if(!sbWin||sbWin.closed){clearInterval(chk);sbBack()}},800)
  };
  E('songbookReturn').onclick=()=>{try{sbWin?.close()}catch(_){}sbBack()};
  window.addEventListener('pagehide',()=>{try{sbWin?.close()}catch(_){}});
