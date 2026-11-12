/* 歌枠ノート：曲リスト・セトリ・歌唱の記録 */

  const SB={
    title:E('songTitle'),artist:E('songArtist'),memo:E('songMemo'),oke:E('songOke'),okeBy:E('songOkeBy'),
    set:E('songList'),rep:E('repList'),repFilter:E('repFilter'),repCount:E('repCount'),
    log:E('singLog'),sessBtn:E('singSessBtn'),sessState:E('singSessState'),now:E('singNow'),undo:E('singUndo'),
    core:E('songbookCore'),home:E('songbookHome'),away:E('songbookAway')
  };
  const songKey=(t,a)=>(t||'').trim().toLowerCase()+'\n'+(a||'').trim().toLowerCase();
  const sbId=()=>Math.random().toString(36).slice(2,10);
  // ラベル：「、」「,」「／」や改行で区切ったものを、重なりを除いて「、」でつなぐ
  const tagSplit=v=>[...new Set(String(v||'').split(/[、,，\/／\n]/).map(x=>x.trim()).filter(Boolean))].slice(0,12);
  const tagNorm=v=>tagSplit(v).join('、').slice(0,200);
  function repList(){if(!Array.isArray(state.repertoire))state.repertoire=[];return state.repertoire}
  function logList(){if(!Array.isArray(state.singLog))state.singLog=[];return state.singLog}
  function sbInput(){return {title:SB.title.value.trim(),artist:SB.artist.value.trim(),memo:SB.memo.value.trim(),oke:SB.oke.value.trim(),okeBy:SB.okeBy.value.trim()}}
  function sbClear(){SB.title.value='';SB.artist.value='';SB.memo.value='';SB.oke.value='';SB.okeBy.value=''}
  // 探すときは、全角・半角や空白、英字の大小をそろえて比べる
  const sbNorm=t=>String(t||'').normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
  // カラオケ音源のURL：共有ID（si=）などを外し、YouTubeの動画は watch?v= の形にそろえる。http(s) 以外は受け付けない
  function okeNorm(raw){
    const v=String(raw||'').trim();
    if(!v)return '';
    let u;try{u=new URL(/^[a-z][a-z0-9+.-]*:/i.test(v)?v:'https://'+v)}catch(_){return null}
    if(!/^https?:$/.test(u.protocol))return null;
    const id=ytId(u.href);
    if(id&&/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(u.hostname))return 'https://www.youtube.com/watch?v='+id;
    for(const k of ['si','feature','pp','utm_source','utm_medium','utm_campaign','fbclid','igshid'])u.searchParams.delete(k);
    return u.href.slice(0,500)
  }
  function srcAdd(r,src){
    if(!r||!src||(!src.u&&!src.n&&!src.by))return false;
    if(!Array.isArray(r.srcs))r.srcs=[];
    const same=r.srcs.find(x=>(src.u&&x.u===src.u)||(src.n&&x.n&&sbNorm(x.n)===sbNorm(src.n)));
    if(same){for(const k of ['u','n','by','k','kind','f','kk','ly'])if(src[k]&&!same[k])same[k]=src[k];return false}
    if(r.srcs.length>=8){toast('1曲に登録できる音源は8つまでです');return false}
    // kk＝キーの区分（原曲キー・女性キー・男性キー・その他）、ly＝動画内の歌詞（出る・出ない）。歌枠管理シートの「音源」タブから
    r.srcs.push({u:src.u||'',n:(src.n||'').slice(0,200),by:(src.by||'').slice(0,120),k:(src.k||'').slice(0,20),kind:(src.kind||'').slice(0,30),f:src.f||'',...(src.kk?{kk:String(src.kk).slice(0,20)}:{}),...(src.ly?{ly:String(src.ly).slice(0,10)}:{})});
    return true
  }
  // 音源を開く（カラオケ音源を探すときと同じ窓を使う）。開いた音源は、次の「♪ 歌い始め」の記録に残す
  function okeOpen(r,x){
    if(!x.u){toast('この音源にはURLがありません'+(x.f?'（音源ファイルの保存場所は「編集」から開けます）':''),4000);return}
    r.useSrc=x.n||x.u;save();
    karaGo(x.u)
  }
  function okeButtons(r){
    const list=(r?.srcs||[]).filter(x=>x.u);
    const kk=x=>x.kk&&x.kk!=='原曲キー'?'（'+x.kk.replace(/キー$/,'')+'）':'';
    return list.map((x,i)=>rowBtn('▶ '+(x.by||'音源'+(list.length>1?i+1:''))+kk(x),'sb-oke'+(r.useSrc&&(r.useSrc===x.n||r.useSrc===x.u)?' used':''),()=>{okeOpen(r,x);for(const b of document.querySelectorAll('.sb-oke'))b.classList.remove('used')},(x.n?x.n+'\n':'')+x.u))
  }
  function repFind(t,a){const k=songKey(t,a);return repList().find(s=>songKey(s.title,s.artist)===k)}
  function repAdd(t,a,memo,src){
    let s=repFind(t,a);
    if(!s){
      if(repList().length>=3000){toast('曲リストは3000曲までです');return null}
      s={id:sbId(),title:t.slice(0,200),artist:(a||'').slice(0,200),memo:(memo||'').slice(0,200),count:0,last:''};
      repList().push(s)
    }else if(memo)s.memo=memo.slice(0,200);
    if(src)srcAdd(s,src);
    return s
  }
  // 入力欄の音源（URLが読めないときは null）
  function formSrc(v){
    if(!v.oke)return v.okeBy?{by:v.okeBy}:undefined;
    const u=okeNorm(v.oke);
    if(!u){toast('音源のURLが読めません（https:// から始まるURLを入れてください）',5000);return null}
    return {u,by:v.okeBy}
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
    state.setlistHide='';
    const r=repAdd(t,a);
    {const ss2=(r?.srcs||[]),used=ss2.find(y=>r.useSrc&&(y.n===r.useSrc||y.u===r.useSrc))||(ss2.length===1?ss2[0]:null);if(used)x.src=used.n||used.u}
    logList().push(x);
    if(r){r.count=(r.count||0)+1;r.last=x.t}
    sbLast=x;
    bridgeEmit('sing',{title:t,artist:a||''});audEvent('歌い始めた曲：'+t+(a?' / '+a:''));
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
    const src=formSrc(v);if(src===null)return;
    state.songs.push({title:v.title,artist:v.artist});
    const r=repAdd(v.title,v.artist,v.memo,src);
    save();renderSet();if(r)repRowUpdate(r);sbClear()
  };
  E('repAdd').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力してください');return}
    const src=formSrc(v);if(src===null)return;
    const had=repFind(v.title,v.artist),n0=had?.srcs?.length||0,r=repAdd(v.title,v.artist,v.memo,src);
    if(r){save();repRowUpdate(r,true);sbClear();toast(had?((r.srcs?.length||0)>n0?'登録済みの曲に音源を足しました':'登録済みの曲です'+(v.memo?'（メモを更新しました）':'')):'曲リストに登録しました')}
  };
  E('singNowBtn').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力するか、セトリ・曲リストの「♪ 歌い始め」を押してください',5000);return}
    sing(v.title,v.artist);sbClear()
  };
  E('songOkeFind').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('探す曲名を入力してください');return}
    E('karaQuery').value=[v.title,v.artist].filter(Boolean).join(' ');
    E('karaAll').click()
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
  E('repSort').onchange=e=>{state.repSort=['name','count'].includes(e.target.value)?e.target.value:'recent';save();renderRep()};

  function rowBtn(label,cls,fn,title){const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;if(title)b.title=title;b.onclick=fn;return b}
  function songSpan(t,a,extra){const s=document.createElement('span');s.className='sb-name';s.textContent=t+(a?' / '+a:'');if(extra){const x=document.createElement('small');x.textContent=extra;s.append(x)}return s}
  function sbEmpty(tag,text){const e=document.createElement(tag);e.className=tag==='p'?'studio-note sb-empty':'sb-empty';e.textContent=text;return e}

  function renderSet(){
    SB.set.replaceChildren();
    state.songs.forEach((s,i)=>{
      const li=document.createElement('li');
      li.append(rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist),'この曲を歌い始めた時刻を記録します'),songSpan(s.title,s.artist),...okeButtons(repFind(s.title,s.artist)));
      li.append(rowBtn('↑','',()=>{if(i>0){[state.songs[i-1],state.songs[i]]=[state.songs[i],state.songs[i-1]];save();renderSet()}}),
        rowBtn('↓','',()=>{if(i<state.songs.length-1){[state.songs[i+1],state.songs[i]]=[state.songs[i],state.songs[i+1]];save();renderSet()}}),
        rowBtn('外す','',()=>{state.songs.splice(i,1);save();renderSet()}));
      SB.set.append(li)
    });
    if(!state.songs.length)SB.set.append(sbEmpty('li','セトリは空です。下の「③ 曲リスト」の「セトリへ」か、「＋ 曲を登録する」の「登録してセトリにも入れる」で追加できます'))
  }

  // 曲リスト：行は曲のIDごとに持ち、歌った曲だけ書き換える
  const repRows=new Map();
  const repInfo=s=>(s.count?'歌った回数 '+s.count+'回':'まだ記録なし')+(s.last?'・最後 '+s.last.slice(0,10):'')+(s.srcs?.length?'・音源 '+s.srcs.length:'')+(s.w?'・作品 '+s.w:'')+(s.tag?'・ラベル '+s.tag:'')+(s.memo?'・'+s.memo:'');
  const repHay=s=>sbNorm(s.title+' '+s.artist+' '+(s.memo||'')+' '+(s.w||'')+' '+(s.tag||'')+' '+(s.srcs||[]).map(x=>x.n+' '+x.by+' '+x.u).join(' '));
  const repMatch=(s,q)=>!q||q.split(/\s+/).filter(Boolean).every(w=>repHay(s).includes(sbNorm(w)));
  function repRow(s){
    const li=document.createElement('li');
    li.dataset.rep=s.id;
    li.append(rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist)),songSpan(s.title,s.artist,repInfo(s)),...okeButtons(s),
      rowBtn('セトリへ','',()=>{state.songs.push({title:s.title,artist:s.artist});save();renderSet();toast('セトリに追加しました')}),
      rowBtn('編集','',()=>repEdit(s,li)),
      sheetLink()?rowBtn('📝 シート','',()=>sxOpenSong(s),'歌枠管理シートで、この曲と音源を足す・直す'):'',
      rowBtn('削除','',e=>armed(e.currentTarget,'もう一度押すと削除',()=>{state.repertoire=repList().filter(x=>x!==s);save();repRows.get(s.id)?.remove();repRows.delete(s.id);SB.repCount.textContent=repList().length+'曲'})));
    repRows.set(s.id,li);
    return li
  }
  // 曲の編集：曲名・アーティスト・メモと、音源（名前・提供者・URL）
  function repEdit(s,li){
    if(li.nextElementSibling?.classList.contains('sb-edit')){li.nextElementSibling.remove();return}
    const box=document.createElement('li');box.className='sb-edit';
    const inp=(label,val,max,type)=>{const l=document.createElement('label');l.className='studio-field';const i=document.createElement('input');i.type=type||'text';i.maxLength=max;i.value=val||'';l.append(label,i);return [l,i]};
    const [lt,it]=inp('曲名',s.title,200),[la,ia]=inp('アーティスト',s.artist,200),[lm,im]=inp('メモ',s.memo,200),[lw,iw]=inp('作品名（アニメ・ゲームなど）',s.w,200),[lg,ig]=inp('ラベル（「、」で区切る。歌枠ルーレットのしぼりこみに使います）',s.tag,200);
    const srcBox=document.createElement('div');srcBox.className='sb-srcs';
    const rows=[];
    const addRow=x=>{
      const r=document.createElement('div');r.className='sb-src-row';
      const [ln,inn]=inp('音源の名前',x.n,200),[lb,ib]=inp('提供者',x.by,120),[lu,iu]=inp('URL',x.u,500,'url');
      const parts=[ln,lb,lu];
      if(x.f){const fb=rowBtn('📁 音源ファイルの場所を開く','',()=>window.open(x.f,'_blank','noopener'));parts.push(fb)}
      const del=rowBtn('この音源を外す','',()=>{r.remove();rows.splice(rows.indexOf(o),1)});
      r.append(...parts,del);srcBox.append(r);
      const o={x,inn,ib,iu};rows.push(o)
    };
    (s.srcs||[]).forEach(addRow);
    const row=document.createElement('div');row.className='studio-row';
    row.append(rowBtn('＋ 音源を足す','',()=>{if(rows.length>=8){toast('1曲に登録できる音源は8つまでです');return}addRow({})}),
      rowBtn('保存','accent',()=>{
        const t=it.value.trim(),a=ia.value.trim();
        if(!t){toast('曲名を入れてください');return}
        const other=repFind(t,a);
        if(other&&other!==s){toast('同じ曲名・アーティストの曲がすでにあります',4000);return}
        const srcs=[];
        for(const o of rows){
          const raw=o.iu.value.trim(),u=raw?okeNorm(raw):'';
          if(u===null){toast('音源のURLが読めません：'+raw.slice(0,40),5000);o.iu.focus();return}
          if(!u&&!o.inn.value.trim()&&!o.ib.value.trim())continue;
          srcs.push({...o.x,u,n:o.inn.value.trim().slice(0,200),by:o.ib.value.trim().slice(0,120)})
        }
        // 曲名を変えたら、これまでの記録とセトリも同じ曲として付け替える
        const k0=songKey(s.title,s.artist),k1=songKey(t,a);
        if(k0!==k1){for(const x of logList())if(songKey(x.title,x.artist)===k0){x.title=t;x.artist=a}for(const x of state.songs)if(songKey(x.title,x.artist)===k0){x.title=t;x.artist=a}}
        s.title=t.slice(0,200);s.artist=a.slice(0,200);s.memo=im.value.trim().slice(0,200);s.srcs=srcs;
        {const w=iw.value.trim().slice(0,200),g=tagNorm(ig.value);if(w)s.w=w;else delete s.w;if(g)s.tag=g;else delete s.tag}
        if(s.useSrc&&!srcs.some(x=>x.n===s.useSrc||x.u===s.useSrc))delete s.useSrc;
        saveNow();box.remove();renderRep();renderSet();if(k0!==k1)renderLog();toast('保存しました',2000)
      }),
      rowBtn('閉じる','',()=>box.remove()));
    {const d2=Object.assign(document.createElement('div'),{className:'studio-inline'});d2.append(lw,lg);box.append(Object.assign(document.createElement('div'),{className:'studio-inline'}),d2,lm,srcBox,row)}
    box.firstChild.append(lt,la);
    li.after(box);it.focus()
  }
  function repRowUpdate(s,rebuild){
    SB.repCount.textContent=repList().length+'曲';
    const q=SB.repFilter.value.trim(),li=repRows.get(s.id);
    if(li&&rebuild){const n=repRow(s);li.replaceWith(n);if(!q&&(state.repSort||'recent')==='recent'&&SB.rep.firstElementChild!==n)SB.rep.prepend(n);return}
    if(li){li.querySelector('.sb-name small').textContent=repInfo(s);if(!q&&(state.repSort||'recent')==='recent'&&s.last&&SB.rep.firstElementChild!==li)SB.rep.prepend(li);return}
    if(!repMatch(s,q))return;
    SB.rep.querySelector('.sb-empty')?.remove();
    SB.rep.prepend(repRow(s))
  }
  function renderRep(){
    const q=SB.repFilter.value.trim(),all=repList(),sort=state.repSort||'recent';
    E('repSort').value=sort;
    const byName=(a,b)=>a.title.localeCompare(b.title,'ja')||a.artist.localeCompare(b.artist,'ja');
    const list=all.filter(s=>repMatch(s,q)).sort(sort==='name'?byName:sort==='count'?(a,b)=>(b.count||0)-(a.count||0)||byName(a,b):(a,b)=>(b.last||'').localeCompare(a.last||'')||byName(a,b));
    SB.repCount.textContent=all.length+'曲'+(q?' のうち '+list.length+'曲':'');
    repRows.clear();
    SB.rep.replaceChildren(...list.slice(0,300).map(repRow));
    if(list.length>300)SB.rep.append(sbEmpty('li','ほか'+(list.length-300)+'曲（探す欄で絞り込めます）'));
    if(!all.length)SB.rep.append(sbEmpty('li','まだ曲が登録されていません。「＋ 曲を登録する」から曲名・アーティスト・音源のURLを入れるか、「歌枠管理シートとつなぐ」で読み込めます'));
    else if(!list.length)SB.rep.append(sbEmpty('li','見つかりませんでした'))
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
    const name=songSpan(hms(x.off)+'　'+x.title,x.artist,[x.src?'音源：'+((()=>{const y=(repFind(x.title,x.artist)?.srcs||[]).find(y=>y.n===x.src||y.u===x.src);return y?(y.n||y.by||x.src):x.src})()):'',Number.isFinite(x.off0)&&x.off0!==x.off?'時刻を直しました（記録した時刻 '+hms(x.off0)+'）':''].filter(Boolean).join('　'));
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
  // 概要欄：アーカイブのURLと、曲ごとの時刻（あとから入力）でタイムスタンプを作る
  const ytId=u=>{const m=String(u||'').match(/(?:youtu\.be\/|[?&]v=|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/);return m?m[1]:''};
  const tsOf=x=>Number.isFinite(x.ts)?x.ts:state.descEmpty==='rec'?x.off:null;
  function fmtTs(sec,long){sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return long?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):Math.floor(sec/60)+':'+String(s).padStart(2,'0')}
  function descText(s,withLink){
    const url=state.sessInfo?.[s.id]?.url||'',id=ytId(url),list=s.items.filter(x=>state.descEmpty!=='skip'||tsOf(x)!==null);
    const long=list.some(x=>(tsOf(x)||0)>=3600),lines=[];
    if(state.descHead.trim())lines.push(state.descHead.trim());
    list.forEach((x,i)=>{
      const t=tsOf(x),name=x.title+(x.artist?' / '+x.artist:'');
      lines.push((t!==null?fmtTs(t,long)+' ':'')+name+(withLink&&t!==null&&id?'  https://youtu.be/'+id+'?t='+t:''))
    });
    return lines.join('\n')
  }
  function descBuild(s,rec){
    const box=rec.descBody;box.replaceChildren();
    const info=state.sessInfo[s.id]||(state.sessInfo[s.id]={url:''});
    const url=document.createElement('input');url.type='url';url.className='sb-url';url.placeholder='アーカイブのURL（例：https://www.youtube.com/watch?v=…）';url.value=info.url||'';
    const urlL=document.createElement('label');urlL.className='studio-field';urlL.append('アーカイブのURL',url);
    const out=document.createElement('textarea');out.className='studio-textarea sb-desc-out';out.readOnly=true;out.rows=Math.min(14,s.items.length+2);
    const refresh=()=>{out.value=descText(sessOf(s.id)||s,false)};
    url.oninput=()=>{info.url=url.value.trim().slice(0,500);save();refresh()};
    const tbl=document.createElement('ol');tbl.className='sb-list sb-desc-list';
    for(const x of s.items){
      const li=document.createElement('li');
      const inp=document.createElement('input');inp.className='sb-time';inp.inputMode='numeric';inp.placeholder=Number.isFinite(x.ts)?'':'時刻';inp.value=Number.isFinite(x.ts)?fmtTs(x.ts,x.ts>=3600):'';
      inp.setAttribute('aria-label','「'+x.title+'」のアーカイブ上の時刻');
      inp.onchange=()=>{const v=inp.value.trim();if(!v){delete x.ts;save();refresh();return}const sec=parseHms(v);if(sec===null){toast('「1:02:03」「12:34」のように入力してください',4000);inp.focus();return}x.ts=sec;inp.value=fmtTs(sec,sec>=3600);save();refresh()};
      inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();const n=li.nextElementSibling?.querySelector('.sb-time');if(n)n.focus()}};
      const rb=rowBtn('記録した時刻','',()=>{x.ts=x.off;inp.value=fmtTs(x.off,x.off>=3600);save();refresh()},'歌い始めを押したときの経過時間（'+hms(x.off)+'）を入れます');
      li.append(inp,songSpan(x.title,x.artist,'記録：'+hms(x.off)),rb);
      tbl.append(li)
    }
    const row=document.createElement('div');row.className='studio-row';
    row.append(rowBtn('概要欄用にコピー','accent',()=>copy(descText(sessOf(s.id)||s,false))),
      rowBtn('時刻リンクつきでコピー（Xなど用）','',()=>{if(!ytId(info.url)){toast('YouTubeのURLを入れると、時刻リンクを作れます',4000);return}copy(descText(sessOf(s.id)||s,true))}));
    const note=document.createElement('p');note.className='studio-mini';
    note.textContent='アーカイブを見ながら、各曲の歌い始めの時刻を「12:34」「1:02:03」の形で入れてください（Enterで次の曲へ）。下の文が、そのまま概要欄に貼れる形になります。見出しと、時刻を入れていない曲の扱いは「概要欄の形」で変えられます。';
    box.append(urlL,note,tbl,out,row);
    refresh()
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
    const desc=document.createElement('details');desc.className='sb-desc';
    const dsum=document.createElement('summary');dsum.textContent='概要欄を作る（アーカイブのURLと時刻を入れる）';
    const descBody=document.createElement('div');desc.append(dsum,descBody);
    const sh=document.createElement('details');sh.className='sb-desc';
    const shsum=document.createElement('summary');shsum.textContent='歌枠管理シートへ（配信ログに送る・コピー）';
    const shBody=document.createElement('div');sh.append(shsum,shBody);
    sh.ontoggle=()=>{if(sh.open){const c=sessOf(s.id);if(c)sheetBox(c,shBody)}};
    const rec={box,sum,ol,filled:false,desc,descBody};
    desc.ontoggle=()=>{if(desc.open){const c=sessOf(s.id);if(c)descBuild(c,rec)}};
    box.ontoggle=()=>{if(box.open&&!rec.filled){const c=sessOf(s.id);if(c)sessFill(c,rec)}};
    box.append(sum,ol,row,desc,sh);
    sessBoxes.set(s.id,rec);
    return rec
  }
  function logSessUpdate(id){
    const s=sessOf(id),rec=sessBoxes.get(id);
    if(!s){if(rec){rec.box.remove();sessBoxes.delete(id)}if(!logList().length&&!state.singSess)renderLog();return}
    if(!rec){renderLog();return}
    rec.sum.textContent=sessSummary(s);
    // 時刻を入力している最中は行を作り直さない（確定・取り消しのときに作り直す）
    if(rec.box.contains(document.activeElement)&&document.activeElement.classList.contains('sb-time'))return;
    if(rec.filled||rec.box.open)sessFill(s,rec);
    if(rec.desc.open)descBuild(s,rec)
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
  function renderSongs(){sbLast=sessLast();renderSess();renderSet();renderRep();renderLog();renderSongOpts();renderSheet()}

  // 概要欄の形・画面に出すセトリの設定
  function renderSongOpts(){
    E('descHead').value=state.descHead;E('descEmpty').value=state.descEmpty;
    E('setlistShow').value=state.setlistShow;E('setlistPos').value=state.setlistPos;E('setlistTime').value=String(state.setlistTime);
    E('setlistSize').value=state.setlistSize;E('setlistSizeVal').textContent=state.setlistSize+'%'
  }
  const refreshDescs=()=>{for(const [id,rec] of sessBoxes)if(rec.desc.open){const c=sessOf(id);if(c)descBuild(c,rec)}};
  E('descHead').oninput=e=>{state.descHead=e.target.value.slice(0,200);save();refreshDescs()};
  E('descEmpty').onchange=e=>{state.descEmpty=e.target.value;save();refreshDescs()};
  E('setlistShow').onchange=e=>{state.setlistShow=e.target.value;state.setlistHide='';save()};
  E('setlistPos').onchange=e=>{state.setlistPos=e.target.value;save()};
  E('setlistTime').onchange=e=>{state.setlistTime=Number(e.target.value)||0;state.setlistHide='';save()};
  E('setlistSize').oninput=e=>{state.setlistSize=Math.max(50,Math.min(200,Number(e.target.value)||100));E('setlistSizeVal').textContent=state.setlistSize+'%';save()};
  E('setlistHideBtn').onclick=()=>{const x=sbLast||sessLast();if(!x){toast('画面に出ている曲はありません');return}state.setlistHide=x.id;save();toast('画面の曲名を消しました。次の「♪ 歌い始め」でまた出ます',4000)};

  // 配信画面（PNGTuber画面）に、いま歌っている曲・これまでの曲を描く
  function slFit(s,maxW){if(g.measureText(s).width<=maxW)return s;let t=s;while(t.length>1&&g.measureText(t+'…').width>maxW)t=t.slice(0,-1);return t+'…'}
  function drawSetlist(){
    const mode=state.setlistShow,ss=state.singSess;
    if(mode==='off'||!ss)return;
    const items=sessItems(ss.id);
    if(!items.length)return;
    const cur=sbLast&&sbLast.sess===ss.id?sbLast:items.at(-1);
    if(state.setlistHide&&state.setlistHide===cur.id)return;
    if(mode==='now'&&state.setlistTime>0&&Date.now()-new Date(cur.t).getTime()>state.setlistTime*1000)return;
    const k=state.setlistSize/100*Math.min(W,H)/720,pad=20*k,m=34*k,maxW=W*.46;
    const rows=mode==='now'
      ?[{t:'♪ '+cur.title,size:34,bold:true},...(cur.artist?[{t:cur.artist,size:23}]:[])]
      :[{t:'セットリスト',size:20,dim:true},...items.slice(-8).map((x,i,a)=>({t:(items.length-a.length+i+1)+'. '+x.title+(x.artist?' / '+x.artist:''),size:24,bold:x===cur,dim:x!==cur,mark:x===cur}))];
    g.save();
    g.textBaseline='middle';g.textAlign='left';
    const lines=rows.map(r=>{g.font=sceneFontCss(r.size*k,r.t);const t=slFit((r.mark?'♪ ':'')+r.t,maxW);return {...r,t,w:g.measureText(t).width,h:r.size*k*1.45}});
    const w=Math.max(...lines.map(l=>l.w))+pad*2,h=lines.reduce((a,l)=>a+l.h,0)+pad*1.4;
    const x=state.setlistPos.endsWith('l')?m:W-m-w,y=state.setlistPos.startsWith('t')?m:H-m-h;
    g.fillStyle='rgba(22,34,29,.66)';g.beginPath();g.roundRect(x,y,w,h,14*k);g.fill();
    g.strokeStyle='rgba(255,248,232,.35)';g.lineWidth=1;g.beginPath();g.roundRect(x+5*k,y+5*k,w-10*k,h-10*k,10*k);g.stroke();
    let yy=y+pad*.7;
    for(const l of lines){g.font=sceneFontCss(l.size*k,l.t);g.fillStyle=l.dim?'rgba(251,245,233,.72)':'#fbf5e9';g.fillText(l.t,x+pad,yy+l.h/2);yy+=l.h}
    g.restore()
  }

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
