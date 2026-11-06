/* 歌枠ノート：曲リスト・セトリ・歌唱の記録 */

  const SB={
    title:E('songTitle'),artist:E('songArtist'),memo:E('songMemo'),
    set:E('songList'),rep:E('repList'),repFilter:E('repFilter'),repCount:E('repCount'),
    log:E('singLog'),sessBtn:E('singSessBtn'),sessState:E('singSessState'),now:E('singNow'),undo:E('singUndo'),
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
  const hms=sec=>{sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};
  // 「1:02:03」「12:34」「95」を秒に。読めなければ null
  function parseHms(v){
    const s=String(v||'').trim().replace(/[：]/g,':').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
    if(!/^\d+(?::\d{1,2}){0,2}$/.test(s))return null;
    const p=s.split(':').map(Number);
    if(p.slice(1).some(x=>x>59))return null;
    return p.reduce((a,x)=>a*60+x,0)
  }
  const curProfName=()=>(state.profiles||[]).find(p=>p.id===state.profileId)?.name||'';
  const sessItems=id=>logList().filter(x=>x.sess===id).sort((a,b)=>a.off-b.off);
  const sessLast=()=>state.singSess?sessItems(state.singSess.id).at(-1)||null:null;
  let sbLast=null;

  function sessStart(){
    state.singSess={id:sbId(),start:new Date().toISOString(),prof:curProfName()};
    sbLast=null;
    saveNow();renderSess();logSessUpdate(state.singSess.id);
    toast('歌唱の記録を始めました。「♪ 歌い始め」を押すと、ここからの経過時間と一緒に残ります',6000)
  }
  function sessEnd(){
    if(!state.singSess)return;
    const id=state.singSess.id,n=sessItems(id).length;
    state.singSess=null;sbLast=null;
    saveNow();renderSess();logSessUpdate(id);
    toast('記録を終えました（'+n+'曲）。下の「これまでの記録」に残っています',5000)
  }
  // 歌唱1回の記録。画面は、いまの曲・その回の行・その曲の集計だけを書き換える
  function sing(t,a){
    if(!t)return;
    if(!state.singSess)sessStart();
    const ss=state.singSess,now=new Date(),off=Math.round((now-new Date(ss.start))/1000);
    const x={id:sbId(),t:now.toISOString(),title:t,artist:a||'',sess:ss.id,start:ss.start,off,prof:ss.prof||curProfName()};
    logList().push(x);
    const r=repAdd(t,a);
    if(r){r.count=(r.count||0)+1;r.last=x.t}
    sbLast=x;
    saveNow();
    renderSess();logSessUpdate(ss.id);if(r)repRowUpdate(r);
    toast('「'+t+'」を記録しました（'+hms(off)+'）。間違えたときは「直前の記録を取り消す」',3500)
  }
  // 記録を1件消す。曲リストの回数と最後に歌った日も合わせて戻す
  function logRemove(x){
    const log=logList(),i=log.indexOf(x);
    if(i<0)return;
    log.splice(i,1);
    const r=repFind(x.title,x.artist);
    if(r){
      r.count=Math.max(0,(r.count||0)-1);
      if(r.last===x.t){const k=songKey(x.title,x.artist);r.last=log.filter(y=>songKey(y.title,y.artist)===k).reduce((m,y)=>y.t>m?y.t:m,'')}
    }
    if(sbLast===x)sbLast=sessLast();
    saveNow();
    renderSess();logSessUpdate(x.sess);if(r)repRowUpdate(r)
  }
  function logRetime(x,sec){
    const r=repFind(x.title,x.artist),oldT=x.t;
    if(!Number.isFinite(x.off0))x.off0=x.off;
    x.off=sec;
    x.t=new Date(new Date(x.start).getTime()+sec*1000).toISOString();
    if(r&&r.last===oldT)r.last=x.t;
    if(state.singSess?.id===x.sess)sbLast=sessLast();
    saveNow();
    renderSess();logSessUpdate(x.sess);if(r)repRowUpdate(r)
  }

  E('songAdd').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力してください');return}
    if(state.songs.length>=300){toast('セトリは300曲までです');return}
    state.songs.push({title:v.title,artist:v.artist});
    const r=repAdd(v.title,v.artist,v.memo);
    save();renderSet();if(r)repRowUpdate(r);sbClear()
  };
  E('repAdd').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力してください');return}
    const had=!!repFind(v.title,v.artist),r=repAdd(v.title,v.artist,v.memo);
    if(r){save();repRowUpdate(r);sbClear();toast(had?'登録済みの曲です（メモを更新しました）':'曲リストに登録しました')}
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
  SB.undo.onclick=()=>{
    const x=sbLast||sessLast();
    if(!x){toast('取り消せる記録はありません');return}
    logRemove(x);
    toast('「'+x.title+'」（'+hms(x.off)+'）の記録を取り消しました',4000)
  };
  E('songCopy').onclick=()=>copy(state.songs.map((s,i)=>`${i+1}. ${s.title}${s.artist?' / '+s.artist:''}`).join('\n'));
  E('songClear').onclick=e=>armed(e.currentTarget,'もう一度押すとセトリを空にする',()=>{state.songs=[];save();renderSet()});
  {let tm=0;SB.repFilter.oninput=()=>{clearTimeout(tm);tm=setTimeout(renderRep,180)}}

  function rowBtn(label,cls,fn,title){const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;if(title)b.title=title;b.onclick=fn;return b}
  function songSpan(t,a,extra){const s=document.createElement('span');s.className='sb-name';s.textContent=t+(a?' / '+a:'');if(extra){const x=document.createElement('small');x.textContent=extra;s.append(x)}return s}
  function sbEmpty(tag,text){const e=document.createElement(tag);e.className=tag==='p'?'studio-note sb-empty':'sb-empty';e.textContent=text;return e}

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
    if(!state.songs.length)SB.set.append(sbEmpty('li','セトリは空です。上で曲名を入れて「セトリに追加」、または曲リストの「セトリへ」で追加できます'))
  }

  // 曲リスト：行は曲のIDごとに持ち、歌った曲だけ書き換える
  const repRows=new Map();
  const repInfo=s=>(s.count?'歌った回数 '+s.count+'回':'まだ記録なし')+(s.last?'・最後 '+s.last.slice(0,10):'')+(s.memo?'・'+s.memo:'');
  const repMatch=(s,q)=>!q||(s.title+' '+s.artist+' '+(s.memo||'')).toLowerCase().includes(q);
  function repRow(s){
    const li=document.createElement('li');
    li.dataset.rep=s.id;
    li.append(rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist)),songSpan(s.title,s.artist,repInfo(s)),
      rowBtn('セトリへ','',()=>{state.songs.push({title:s.title,artist:s.artist});save();renderSet();toast('セトリに追加しました')}),
      rowBtn('削除','',e=>armed(e.currentTarget,'もう一度押すと削除',()=>{state.repertoire=repList().filter(x=>x!==s);save();repRows.get(s.id)?.remove();repRows.delete(s.id);SB.repCount.textContent=repList().length+'曲'})));
    repRows.set(s.id,li);
    return li
  }
  function repRowUpdate(s){
    SB.repCount.textContent=repList().length+'曲';
    const q=SB.repFilter.value.trim().toLowerCase(),li=repRows.get(s.id);
    if(li){li.querySelector('.sb-name small').textContent=repInfo(s);if(!q&&s.last&&SB.rep.firstElementChild!==li)SB.rep.prepend(li);return}
    if(!repMatch(s,q))return;
    SB.rep.querySelector('.sb-empty')?.remove();
    SB.rep.prepend(repRow(s))
  }
  function renderRep(){
    const q=SB.repFilter.value.trim().toLowerCase(),all=repList();
    const list=all.filter(s=>repMatch(s,q)).sort((a,b)=>(b.last||'').localeCompare(a.last||'')||a.title.localeCompare(b.title,'ja'));
    SB.repCount.textContent=all.length+'曲';
    repRows.clear();
    SB.rep.replaceChildren(...list.slice(0,300).map(repRow));
    if(list.length>300)SB.rep.append(sbEmpty('li','ほか'+(list.length-300)+'曲（絞り込みで探せます）'));
    if(!all.length)SB.rep.append(sbEmpty('li','まだ曲が登録されていません。上で曲名・アーティストを入れて「曲リストに登録」を押すか、「♪ 歌い始め」で記録すると自動で登録されます'))
  }

  function sessions(){
    const m=new Map();
    for(const x of logList()){if(!m.has(x.sess))m.set(x.sess,{id:x.sess,start:x.start,prof:x.prof,items:[]});m.get(x.sess).items.push(x)}
    const ss=state.singSess;
    if(ss&&!m.has(ss.id))m.set(ss.id,{id:ss.id,start:ss.start,prof:ss.prof,items:[]});
    for(const s of m.values())s.items.sort((a,b)=>a.off-b.off);
    return [...m.values()].sort((a,b)=>(b.start||'').localeCompare(a.start||''))
  }
  function sessOf(id){
    const items=sessItems(id),ss=state.singSess,f=items[0]||(ss&&ss.id===id?ss:null);
    return f?{id,start:f.start,prof:f.prof,items}:null
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

  // これまでの記録：回の見出しだけ先に作り、開いたときに中の行を作る
  const SESS_PAGE=30;
  let sessShown=SESS_PAGE;
  const sessBoxes=new Map();
  function sessSummary(s){return localTime(s.start)+'　'+(s.prof||'')+'　'+s.items.length+'曲'+(state.singSess?.id===s.id?'（記録中）':'')}
  function logItemRow(x){
    const li=document.createElement('li');
    li.dataset.log=x.id;
    const name=songSpan(hms(x.off)+'　'+x.title,x.artist,Number.isFinite(x.off0)&&x.off0!==x.off?'時刻を直しました（記録した時刻 '+hms(x.off0)+'）':'');
    const edit=rowBtn('時刻','',()=>{
      const inp=document.createElement('input');
      inp.className='sb-time';inp.value=hms(x.off);inp.inputMode='numeric';inp.setAttribute('aria-label','経過時間（時:分:秒）');
      let done=false;
      const finish=ok=>{
        if(done)return;done=true;
        if(!ok){inp.onblur=null;inp.replaceWith(edit);logSessUpdate(x.sess);return}
        const sec=parseHms(inp.value);
        if(sec===null){toast('「1:02:03」「12:34」のように入力してください',4000);done=false;inp.focus();return}
        inp.onblur=null;inp.replaceWith(edit);
        if(sec!==x.off)logRetime(x,sec)
      };
      inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape'){e.preventDefault();finish(false)}};
      inp.onblur=()=>finish(true);
      edit.replaceWith(inp);inp.focus();inp.select()
    },'経過時間を直します（Enterで確定、Escで取り消し）');
    li.append(name,edit,rowBtn('消す','',e=>armed(e.currentTarget,'もう一度押すと消す',()=>logRemove(x))));
    return li
  }
  function sessFill(s,rec){
    rec.ol.replaceChildren(...s.items.map(logItemRow));
    if(!s.items.length)rec.ol.append(sbEmpty('li','まだ曲は記録されていません'));
    rec.filled=true
  }
  function sessBox(s){
    const box=document.createElement('details');box.className='sb-sess';box.dataset.sess=s.id;
    const sum=document.createElement('summary');sum.textContent=sessSummary(s);
    const ol=document.createElement('ol');
    const row=document.createElement('div');row.className='studio-row';
    row.append(rowBtn('タイムスタンプをコピー（概要欄用）','accent',()=>{const c=sessOf(s.id);if(c)copy(sessText(c))}),
      rowBtn('CSVで保存','',()=>{const c=sessOf(s.id);if(c)saveCsv([c],'utawaku_'+c.start.slice(0,10)+'.csv')}),
      rowBtn('この回の記録を削除','',e=>armed(e.currentTarget,'もう一度押すと削除',()=>{
        const gone=logList().filter(y=>y.sess===s.id);
        for(const x of gone){const r=repFind(x.title,x.artist);if(r)r.count=Math.max(0,(r.count||0)-1)}
        state.singLog=logList().filter(y=>y.sess!==s.id);
        for(const x of gone){const r=repFind(x.title,x.artist);if(r&&r.last===x.t){const k=songKey(x.title,x.artist);r.last=state.singLog.filter(y=>songKey(y.title,y.artist)===k).reduce((m,y)=>y.t>m?y.t:m,'')}}
        if(state.singSess?.id===s.id){state.singSess=null;sbLast=null}
        saveNow();renderSess();renderRep();renderLog()
      })));
    const rec={box,sum,ol,filled:false};
    box.ontoggle=()=>{if(box.open&&!rec.filled){const c=sessOf(s.id);if(c)sessFill(c,rec)}};
    box.append(sum,ol,row);
    sessBoxes.set(s.id,rec);
    return rec
  }
  function logSessUpdate(id){
    const s=sessOf(id),rec=sessBoxes.get(id);
    if(!s){if(rec){rec.box.remove();sessBoxes.delete(id)}if(!logList().length&&!state.singSess)renderLog();return}
    if(!rec){renderLog();return}
    rec.sum.textContent=sessSummary(s);
    // 時刻を入力している最中は行を作り直さない（確定・取り消しのときに作り直す）
    if(rec.ol.contains(document.activeElement)&&document.activeElement.classList.contains('sb-time'))return;
    if(rec.filled||rec.box.open)sessFill(s,rec)
  }
  function renderLog(){
    sessBoxes.clear();
    SB.log.replaceChildren();
    const ss=sessions();
    for(const s of ss.slice(0,sessShown)){const rec=sessBox(s);SB.log.append(rec.box);if(s===ss[0]){rec.box.open=true;sessFill(s,rec)}}
    if(!ss.length){SB.log.append(sbEmpty('p','まだ記録はありません。歌枠を始めるときに「● 歌唱の記録を始める」を押し、歌うたびに「♪ 歌い始め」を押すと、ここに経過時間つきで残ります。'));return}
    const row=document.createElement('div');row.className='studio-row';
    if(ss.length>sessShown)row.append(rowBtn('さらに前の回を表示（残り'+(ss.length-sessShown)+'回）','',()=>{sessShown+=SESS_PAGE;renderLog()}));
    row.append(rowBtn('すべての記録をCSVで保存','',()=>saveCsv(sessions(),'utawaku_all.csv')));
    SB.log.append(row)
  }
  function renderSess(){
    const ss=state.singSess;
    SB.sessBtn.textContent=ss?'■ 記録を終える':'● 歌唱の記録を始める';
    SB.sessBtn.classList.toggle('recording',!!ss);
    if(!ss){SB.sessState.textContent='記録していません';SB.now.textContent='';SB.undo.hidden=true;return}
    SB.sessState.textContent='記録中 '+hms((Date.now()-new Date(ss.start))/1000)+'（'+localTime(ss.start)+'から）';
    const last=sbLast;
    SB.now.textContent=last?'いま：'+last.title+(last.artist?' / '+last.artist:'')+'（'+hms(last.off)+'〜）':'';
    SB.undo.hidden=!last
  }
  // 毎秒の更新は経過時間の表示だけ（記録の全件はたどらない）
  setInterval(()=>{if(state.singSess)SB.sessState.textContent='記録中 '+hms((Date.now()-new Date(state.singSess.start))/1000)+'（'+localTime(state.singSess.start)+'から）'},1000);
  function renderSongs(){sbLast=sessLast();renderSess();renderSet();renderRep();renderLog()}

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
