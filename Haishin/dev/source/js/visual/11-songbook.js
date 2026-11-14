/* 歌枠ノート：曲リスト・セトリ・歌唱の記録 */

  const SB={
    title:E('songTitle'),artist:E('songArtist'),memo:E('songMemo'),oke:E('songOke'),okeBy:E('songOkeBy'),
    work:E('songWork'),tag:E('songTag'),okeName:E('songOkeName'),okeKk:E('songOkeKk'),more:E('songMoreSrcs'),
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
  function sbInput(){return {title:SB.title.value.trim(),artist:SB.artist.value.trim(),memo:SB.memo.value.trim(),oke:SB.oke.value.trim(),okeBy:SB.okeBy.value.trim(),
    w:SB.work.value.trim().slice(0,200),tag:tagNorm(SB.tag.value),okeName:SB.okeName.value.trim(),okeKk:SB.okeKk.value}}
  function sbClear(){for(const k of ['title','artist','memo','oke','okeBy','work','tag','okeName'])SB[k].value='';SB.okeKk.value='原曲キー';sbMore.length=0;SB.more.replaceChildren();tagChipsSync(SB.tag)}

  // ---- 歌枠管理シートから読んだ提供者・ラベルの控え（このブラウザだけ）。提供者の名前をそろえる・選ぶのに使う
  const SHEET_CACHE_LS='otonoha-sheet-cache';
  let sheetCacheMem;
  function sheetCache(){
    if(sheetCacheMem!==undefined)return sheetCacheMem;
    try{const v=JSON.parse(localStorage.getItem(SHEET_CACHE_LS)||'null');sheetCacheMem=v&&Array.isArray(v.provs)?v:null}catch(_){sheetCacheMem=null}
    return sheetCacheMem
  }
  function sheetCacheSet(j){
    if(!j||!Array.isArray(j.provs))return;
    sheetCacheMem={at:Date.now(),provs:j.provs.filter(x=>x&&x.n).slice(0,400).map(x=>({n:String(x.n).slice(0,120),url:String(x.url||'').slice(0,300)})),labels:(Array.isArray(j.labels)?j.labels:[]).map(x=>String(x.name||'').slice(0,40)).filter(Boolean).slice(0,300)};
    try{localStorage.setItem(SHEET_CACHE_LS,JSON.stringify(sheetCacheMem))}catch(_){}
    provListFill()
  }
  // 提供者の名前を、シートの提供者タブの名前にそろえる（例：「歌っちゃ王」→「カラオケ歌っちゃ王」）。
  // シートにそのままの名前があればそれ。なければ、その名前で終わる・始まる提供者が1つだけのときに限って、そちらにする
  function provCanon(name){
    const n=String(name||'').trim(),c=sheetCache();
    if(!n||!c||!c.provs.length)return n;
    if(c.provs.some(x=>x.n===n))return n;
    const k=sbNorm(n);
    if(k.length<3)return n;
    const same=c.provs.filter(x=>sbNorm(x.n)===k);
    if(same.length===1)return same[0].n;
    const hit=c.provs.filter(x=>{const y=sbNorm(x.n);return y.endsWith(k)||y.startsWith(k)});
    return hit.length===1?hit[0].n:n
  }
  const provUrl=name=>sheetCache()?.provs.find(x=>x.n===name)?.url||'';
  // 曲リストの音源の提供者を、まとめてそろえる。直した名前と件数を返す
  function provAlign(){
    const done=new Map();
    for(const r of repList())for(const x of r.srcs||[]){const c=provCanon(x.by);if(x.by&&c!==x.by){done.set(x.by+' → '+c,(done.get(x.by+' → '+c)||0)+1);x.by=c}}
    if(done.size){saveNow();renderRep();renderSet();toast('提供者の名前を、歌枠管理シートの提供者にそろえました：'+[...done].map(([k,n])=>k+'（'+n+'件）').join('、'),9000)}
    return done
  }
  const provNames=()=>[...new Set([...(sheetCache()?.provs.map(x=>x.n)||[]),...repList().flatMap(r=>(r.srcs||[]).map(x=>provCanon(x.by)))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
  function provListFill(){const dl=E('provList');if(dl)dl.replaceChildren(...provNames().slice(0,400).map(n=>Object.assign(document.createElement('option'),{value:n})))}
  // ラベルの候補：シートのラベル一覧（読んであれば、その並び）と、曲リストで使っているラベル
  const tagNames=()=>[...new Set([...(sheetCache()?.labels||[]),...repList().flatMap(r=>tagSplit(r.tag))])];
  // ラベルを選ぶ欄（ふだんは閉じている）。押すと、入力欄の「、」区切りの文字に足す・外す
  function tagChips(input){
    const det=document.createElement('details');det.className='sb-tags';
    const sum=document.createElement('summary');sum.textContent='🏷 ラベルを一覧から選ぶ';
    const box=document.createElement('div');box.className='sb-tag-box';
    det.append(sum,box);
    const draw=()=>{
      const cur=tagSplit(input.value),all=tagNames();
      box.replaceChildren(...all.map(n=>{const b=document.createElement('button');b.type='button';b.textContent=n;b.className='sb-tag'+(cur.includes(n)?' on':'');b.setAttribute('aria-pressed',String(cur.includes(n)));
        b.onclick=()=>{const c=tagSplit(input.value);input.value=(c.includes(n)?c.filter(x=>x!==n):[...c,n]).join('、');draw()};return b}));
      if(!all.length)box.append(sbEmpty('p','まだラベルがありません。上の欄に「、」で区切って書くと、次からここに並びます'))
    };
    det.addEventListener('toggle',()=>{if(det.open)draw()});
    input.addEventListener('input',()=>{if(det.open)draw()});
    input._chips=draw;
    return det
  }
  const tagChipsSync=input=>{if(input._chips)input._chips()};
  // 音源1つぶんの入力欄（「編集」と「曲を登録する」で同じもの）：音源の名前・提供者・URL・キーの区分
  const KK_OPTS=['原曲キー','女性キー','男性キー','その他'];
  function srcRowUI(x,onDel){
    const r=document.createElement('div');r.className='sb-src-row';
    const inp=(label,val,max,type)=>{const l=document.createElement('label');l.className='studio-field';const i=document.createElement('input');i.type=type||'text';i.maxLength=max;i.value=val||'';l.append(label,i);return [l,i]};
    const [lu,iu]=inp('URL（共有リンクのまま貼れます）',x.u,500,'url'),[lb,ib]=inp('提供者（チャンネル名）',x.by,120),[ln,inn]=inp('音源の名前（動画のタイトル。空なら自動）',x.n,200);
    ib.setAttribute('list','provList');
    const lk=document.createElement('label');lk.className='studio-field';const ik=document.createElement('select');
    for(const v of [...new Set([...KK_OPTS,x.kk||'原曲キー'])])ik.append(Object.assign(document.createElement('option'),{value:v,textContent:v}));
    ik.value=x.kk||'原曲キー';lk.append('キーの区分',ik);
    const parts=[lu,lb,ln,lk];
    if(x.f)parts.push(rowBtn('📁 音源ファイルの場所を開く','',()=>window.open(x.f,'_blank','noopener')));
    const o={x,inn,ib,iu,ik,el:r};
    r.append(...parts,rowBtn('この音源を外す','',()=>{r.remove();onDel(o)}));
    return o
  }
  // 入力欄の音源の並びを、保存する形に。URLが読めないときは null（その欄にカーソルを置く）
  function srcRowsRead(rows){
    const srcs=[];
    for(const o of rows){
      const raw=o.iu.value.trim(),u=raw?okeNorm(raw):'';
      if(u===null){toast('音源のURLが読めません（https:// から始まるURLを入れてください）：'+raw.slice(0,40),5000);o.iu.focus();return null}
      const n=o.inn.value.trim().slice(0,200),by=provCanon(o.ib.value.trim()).slice(0,120);
      if(!u&&!n&&!by)continue;
      const y={...o.x,u,n,by};
      if(o.ik.value&&o.ik.value!=='原曲キー'||o.x.kk)y.kk=o.ik.value;
      srcs.push(y)
    }
    return srcs
  }
  const sbMore=[];
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
    const by=provCanon(v.okeBy),kk=v.okeKk&&v.okeKk!=='原曲キー'?{kk:v.okeKk}:{};
    if(!v.oke)return by||v.okeName?{by,n:v.okeName,...kk}:undefined;
    const u=okeNorm(v.oke);
    if(!u){toast('音源のURLが読めません（https:// から始まるURLを入れてください）',5000);return null}
    return {u,by,n:v.okeName,...kk}
  }
  // 「曲を登録する」の中身を曲リストに入れる。作品名・ラベル・音源（いくつでも）まで。読めないURLがあれば null
  function formApply(v){
    const first=formSrc(v);if(first===null)return null;
    const rest=srcRowsRead(sbMore);if(rest===null)return null;
    const had=repFind(v.title,v.artist),before=had?JSON.parse(JSON.stringify(had)):null,n0=had?.srcs?.length||0;
    const r=repAdd(v.title,v.artist,v.memo,first);
    if(!r)return null;
    for(const x of rest)srcAdd(r,x);
    if(v.w)r.w=v.w;
    if(v.tag)r.tag=tagNorm([r.tag,v.tag].filter(Boolean).join('、'));
    return {r,had,before,more:(r.srcs?.length||0)>n0}
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
    // 記録を終えた時刻（概要欄の「エンディング」に使える）。画面を閉じるまでの控え
    if(n)sInfo(id).endRec=Math.round((Date.now()-new Date(state.singSess.start))/1000);
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
    const a=formApply(v);if(!a)return;
    state.songs.push({title:v.title,artist:v.artist});
    save();renderSet();repRowUpdate(a.r,true);sbClear();sxAutoPush(a.r,a.before);
    toast((a.had?'登録済みの曲です。':'曲リストに登録して、')+'セトリに入れました',2500)
  };
  E('repAdd').onclick=()=>{
    const v=sbInput();
    if(!v.title){toast('曲名を入力してください');return}
    const a=formApply(v);if(!a)return;
    save();repRowUpdate(a.r,true);sbClear();sxAutoPush(a.r,a.before);
    toast(a.had?(a.more?'登録済みの曲に音源を足しました':'登録済みの曲です'+(v.memo||v.w||v.tag?'（メモ・作品名・ラベルを更新しました）':'')):'曲リストに登録しました')
  };
  E('songSrcMore').onclick=()=>{
    if(sbMore.length>=7){toast('1曲に登録できる音源は8つまでです');return}
    const o=srcRowUI({},x=>sbMore.splice(sbMore.indexOf(x),1));sbMore.push(o);SB.more.append(o.el);o.iu.focus()
  };
  SB.tag.after(tagChips(SB.tag));
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
  // 行の中のまとまり（音源のボタン／操作のボタン）。まとまりごとに折り返すので、ボタンがばらばらの行に散らない
  function rowGroup(cls,nodes){const g=document.createElement('span');g.className=cls;g.append(...nodes.filter(Boolean));return g}
  function sbEmpty(tag,text){const e=document.createElement(tag);e.className=tag==='p'?'studio-note sb-empty':'sb-empty';e.textContent=text;return e}

  function renderSet(){
    SB.set.replaceChildren();
    state.songs.forEach((s,i)=>{
      const li=document.createElement('li');
      const ok=okeButtons(repFind(s.title,s.artist));
      li.classList.toggle('sb-many',ok.length>1);
      li.append(rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist),'この曲を歌い始めた時刻を記録します'),songSpan(s.title,s.artist),rowGroup('sb-okes',ok));
      li.append(rowGroup('sb-acts',[rowBtn('↑','',()=>{if(i>0){[state.songs[i-1],state.songs[i]]=[state.songs[i],state.songs[i-1]];save();renderSet()}}),
        rowBtn('↓','',()=>{if(i<state.songs.length-1){[state.songs[i+1],state.songs[i]]=[state.songs[i],state.songs[i+1]];save();renderSet()}}),
        rowBtn('外す','',()=>{state.songs.splice(i,1);save();renderSet()})]));
      SB.set.append(li)
    });
    if(!state.songs.length)SB.set.append(sbEmpty('li','セトリは空です。下の「③ 曲リスト」の「セトリへ」か、「＋ 曲を登録する」の「登録してセトリにも入れる」で追加できます'))
    renderDeckSet()
  }

  // 本番の「🎲 企画」タブに出すセトリ（0.10.5）。セトリに曲があるか、歌唱を記録しているときだけ出す。
  // 「♪ 歌い始め」・音源・記録の開始と終了だけを置き、並べ替えや追加は歌枠ノートで行う
  let deckSetSig='';
  const DECK_SET_LS='otonoha-deck-setlist-open';
  function renderDeckSet(){
    const box=E('deckSet');if(!box)return;
    const ss=state.singSess,sung=new Set(ss?logList().filter(x=>x.sess===ss.id).map(x=>songKey(x.title,x.artist)):[]),last=sbLast;
    const nowK=last&&ss&&last.sess===ss.id?songKey(last.title,last.artist):'';
    const sig=JSON.stringify([state.songs.map(s=>[s.title,s.artist,(repFind(s.title,s.artist)?.srcs||[]).map(x=>x.u+x.by+(x.kk||'')).join('|'),repFind(s.title,s.artist)?.useSrc||'']),!!ss,[...sung],nowK]);
    box.hidden=!state.songs.length&&!ss;
    if(sig===deckSetSig)return;
    deckSetSig=sig;
    E('deckSetCount').textContent=state.songs.length?state.songs.length+'曲'+(ss?'・歌った '+state.songs.filter(s=>sung.has(songKey(s.title,s.artist))).length:''):'';
    E('deckSessBtn').textContent=ss?'■ 記録を終える':'● 歌唱の記録を始める';
    E('deckSessBtn').classList.toggle('recording',!!ss);
    E('deckSetUndo').hidden=!(ss&&last&&last.sess===ss.id);
    E('deckSetNow').textContent=nowK?'いま：'+last.title+(last.artist?' / '+last.artist:''):'';
    const ol=E('deckSongList');ol.replaceChildren();
    state.songs.forEach((s,i)=>{
      const k=songKey(s.title,s.artist),li=document.createElement('li');
      li.classList.toggle('sung',sung.has(k));li.classList.toggle('now',k===nowK);
      const no=document.createElement('span');no.className='deck-set-no';no.textContent=sung.has(k)?'✓':String(i+1);
      const ok=okeButtons(repFind(s.title,s.artist));
      li.classList.toggle('sb-many',ok.length>1);
      li.append(no,rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist),'この曲を歌い始めた時刻を記録します'),songSpan(s.title,s.artist),rowGroup('sb-okes',ok));
      ol.append(li)
    });
    if(!state.songs.length)ol.append(sbEmpty('li','セトリは空です（記録はこのまま続けられます）'))
  }
  {
    const box=E('deckSet');
    try{if(localStorage.getItem(DECK_SET_LS)!=='0')box.open=true}catch(_){box.open=true}
    box.addEventListener('toggle',()=>{try{localStorage.setItem(DECK_SET_LS,box.open?'1':'0')}catch(_){}});
    E('deckSessBtn').onclick=()=>state.singSess?sessEnd():sessStart();
    E('deckSetUndo').onclick=()=>SB.undo.click()
  }

  // 曲リスト：行は曲のIDごとに持ち、歌った曲だけ書き換える
  const repRows=new Map();
  const repInfo=s=>(s.count?'歌った回数 '+s.count+'回':'まだ記録なし')+(s.last?'・最後 '+s.last.slice(0,10):'')+(s.srcs?.length?'・音源 '+s.srcs.length:'')+(s.w?'・作品 '+s.w:'')+(s.tag?'・ラベル '+s.tag:'')+(s.memo?'・'+s.memo:'');
  const repHay=s=>sbNorm(s.title+' '+s.artist+' '+(s.memo||'')+' '+(s.w||'')+' '+(s.tag||'')+' '+(s.srcs||[]).map(x=>x.n+' '+x.by+' '+x.u).join(' '));
  const repMatch=(s,q)=>!q||q.split(/\s+/).filter(Boolean).every(w=>repHay(s).includes(sbNorm(w)));
  function repRow(s){
    const li=document.createElement('li');
    li.dataset.rep=s.id;
    const ok=okeButtons(s);
    li.classList.toggle('sb-many',ok.length>1);
    li.append(rowBtn('♪ 歌い始め','sb-sing',()=>sing(s.title,s.artist)),songSpan(s.title,s.artist,repInfo(s)),rowGroup('sb-okes',ok),
      rowGroup('sb-acts',[rowBtn('セトリへ','',()=>{state.songs.push({title:s.title,artist:s.artist});save();renderSet();toast('セトリに追加しました')}),
      rowBtn('編集','',()=>repEdit(s,li)),
      sheetLink()?rowBtn('📝 シート','',()=>sxOpenSong(s),'歌枠管理シートで、この曲と音源を足す・直す（読み・管理団体・歌詞ページなど、くわしい項目）'):null,
      rowBtn('削除','',e=>armed(e.currentTarget,'もう一度押すと削除',()=>{state.repertoire=repList().filter(x=>x!==s);save();repRows.get(s.id)?.remove();repRows.delete(s.id);SB.repCount.textContent=repList().length+'曲'}))]));
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
    const addRow=x=>{const o=srcRowUI(x,y=>rows.splice(rows.indexOf(y),1));rows.push(o);srcBox.append(o.el);return o};
    (s.srcs||[]).forEach(addRow);
    const row=document.createElement('div');row.className='studio-row';
    row.append(rowBtn('＋ 音源を足す','',()=>{if(rows.length>=8){toast('1曲に登録できる音源は8つまでです');return}addRow({}).iu.focus()}),
      rowBtn('保存','accent',()=>{
        const t=it.value.trim(),a=ia.value.trim(),before=JSON.parse(JSON.stringify(s));
        if(!t){toast('曲名を入れてください');return}
        const other=repFind(t,a);
        if(other&&other!==s){toast('同じ曲名・アーティストの曲がすでにあります',4000);return}
        const srcs=srcRowsRead(rows);if(srcs===null)return;
        // 曲名を変えたら、これまでの記録とセトリも同じ曲として付け替える
        const k0=songKey(s.title,s.artist),k1=songKey(t,a);
        if(k0!==k1){for(const x of logList())if(songKey(x.title,x.artist)===k0){x.title=t;x.artist=a}for(const x of state.songs)if(songKey(x.title,x.artist)===k0){x.title=t;x.artist=a}}
        s.title=t.slice(0,200);s.artist=a.slice(0,200);s.memo=im.value.trim().slice(0,200);s.srcs=srcs;
        {const w=iw.value.trim().slice(0,200),g=tagNorm(ig.value);if(w)s.w=w;else delete s.w;if(g)s.tag=g;else delete s.tag}
        if(s.useSrc&&!srcs.some(x=>x.n===s.useSrc||x.u===s.useSrc))delete s.useSrc;
        saveNow();box.remove();renderRep();renderSet();if(k0!==k1)renderLog();toast('保存しました',2000);sxAutoPush(s,before)
      }),
      rowBtn('閉じる','',()=>box.remove()));
    {const d2=Object.assign(document.createElement('div'),{className:'studio-inline'});d2.append(lw,lg);box.append(Object.assign(document.createElement('div'),{className:'studio-inline'}),d2,tagChips(ig),lm,srcBox,row)}
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
  // 概要欄：セトリ（時刻つき）と、使ったカラオケ音源（提供者・音源のURL）を、貼れる形で作る
  const ytId=u=>{const m=String(u||'').match(/(?:youtu\.be\/|[?&]v=|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/);return m?m[1]:''};
  const sInfo=id=>state.sessInfo[id]||(state.sessInfo[id]={url:''});
  // 曲の時刻：手で入れた時刻があればそれ。なければ、記録した経過時間に「全体をずらす」秒を足したもの
  const recTs=(x,info)=>Math.max(0,x.off+(info?.shift||0));
  const tsOf=(x,info)=>Number.isFinite(x.ts)?x.ts:state.descEmpty==='rec'?recTs(x,info):null;
  function fmtTs(sec,long){sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return long?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):Math.floor(sec/60)+':'+String(s).padStart(2,'0')}
  // 概要欄での時刻の書き方：「01:54」「1:02:07」（分を2桁に。1時間を超えた行だけ時を付ける）か、「1:54」（1時間を超える回は、全部の行を h:mm:ss にそろえる）
  function descTs(sec,long){
    if(!state.desc.pad)return fmtTs(sec,long);
    sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,ss=sec%60;
    return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0')
  }
  // 曲の書き方：『作品 / 曲名（アーティスト様）』か、曲名 / アーティスト
  function descSong(x){
    if(state.desc.fmt!=='work')return x.title+(x.artist?' / '+x.artist:'');
    const w=repFind(x.title,x.artist)?.w||'';
    return '『'+(w?w+' / ':'')+x.title+(x.artist?'（'+x.artist+'様）':'')+'』'
  }
  // その曲で使った音源：「▶」で開いた音源。分からないときは、音源が1つだけならそれ
  function usedSrc(x){
    const ss=repFind(x.title,x.artist)?.srcs||[];
    return ss.find(y=>x.src&&(y.n===x.src||y.u===x.src))||(ss.length===1?ss[0]:null)
  }
  // 1回ぶんの行。kind：op＝オープニング／song／extra＝足した行（トーク・企画）／ed＝エンディング
  function descRows(s){
    const info=state.sessInfo?.[s.id]||{},D=state.desc,rows=[];
    if(info.op!==0&&D.op.trim())rows.push({kind:'op',t:0,text:D.op.trim()});
    for(const x of s.items){const t=tsOf(x,info);if(t===null&&state.descEmpty==='skip')continue;rows.push({kind:'song',t,text:descSong(x),x})}
    for(const e of info.extra||[])rows.push({kind:'extra',t:e.ts,text:e.t});
    if(Number.isFinite(info.end)&&D.ed.trim())rows.push({kind:'ed',t:info.end,text:D.ed.trim()});
    // どの行にも時刻があるときは、時刻の順に並べる（足した行を、曲の間に入れるため）
    if(rows.every(r=>r.t!==null)){const pri={op:0,song:1,extra:1,ed:2};rows.forEach((r,i)=>r.i=i);rows.sort((a,b)=>a.t-b.t||pri[a.kind]-pri[b.kind]||a.i-b.i)}
    return rows
  }
  // 概要欄の中身を、部分ごとに返す。set＝セトリの行、prov＝提供者の行、src＝音源の行、miss＝使った音源が分からない曲
  function descParts(s,withLink){
    const D=state.desc,url=state.sessInfo?.[s.id]?.url||'',id=ytId(url),rows=descRows(s);
    const long=rows.some(r=>(r.t||0)>=3600);
    const set=rows.map(r=>(r.t!==null?descTs(r.t,long)+' ':'')+r.text+(withLink&&r.t!==null&&id?'  https://youtu.be/'+id+'?t='+r.t:''));
    const prov=[],src=[],miss=[],seenP=new Set(),seenS=new Set();
    for(const r of rows){
      if(r.kind!=='song')continue;
      const y=usedSrc(r.x);
      if(!y){miss.push(r.x.title);continue}
      const by=provCanon(y.by),name=y.n||(r.x.title+(by?' / '+by:''));
      if(by&&!seenP.has(by)){seenP.add(by);const u=D.purl?provUrl(by):'';prov.push(D.pm+by+(D.sama?'様':'')+(u?' '+u:''))}
      const k=y.u||name;
      if(!seenS.has(k)){seenS.add(k);src.push((D.sm+name+(y.u?' '+y.u:'')).trim())}
    }
    return {set,prov,src,miss}
  }
  const descSetText=(s,withLink)=>[state.descHead.trim(),...descParts(s,withLink).set].filter(Boolean).join('\n');
  function descSrcText(s){const p=descParts(s);return p.prov.length||p.src.length?[state.desc.srcHead.trim(),...p.prov,...p.src].filter(Boolean).join('\n'):''}
  // セトリ → 区切り線 → 使用音源
  function descFull(s){const a=descSetText(s),b=descSrcText(s),sep=state.desc.sep.trim();return b?[a,'',...(sep?[sep,'']:[]),b].join('\n'):a}
  const descText=(s,withLink)=>descSetText(s,withLink);
  // 概要欄の形（見出し・区切り線・記号・書き方）。どの回にも同じものを使う
  function descOpts(onChange){
    const D=state.desc,det=document.createElement('details');det.className='sb-desc-opts';
    const sum=document.createElement('summary');sum.textContent='概要欄の形（見出し・区切り線・記号・曲の書き方）';
    const fld=(label,el)=>{const l=document.createElement('label');l.className='studio-field';l.append(label,el);return l};
    const txt=(label,get,set,max)=>{const i=document.createElement('input');i.type='text';i.maxLength=max;i.value=get();i.oninput=()=>{set(i.value);save();onChange()};return fld(label,i)};
    const chk=(label,k)=>{const i=document.createElement('input');i.type='checkbox';i.checked=!!D[k];i.onchange=()=>{D[k]=i.checked;save();onChange()};const l=document.createElement('label');l.className='studio-field sb-check';l.append(i,' '+label);return l};
    const sel=(label,get,set,opts)=>{const e=document.createElement('select');for(const [v,t] of opts)e.append(Object.assign(document.createElement('option'),{value:v,textContent:t}));e.value=get();e.onchange=()=>{set(e.value);save();onChange()};return fld(label,e)};
    const g=(...els)=>{const d=document.createElement('div');d.className='studio-inline';d.append(...els);return d};
    det.append(sum,
      g(txt('セトリの見出し',()=>state.descHead,v=>{state.descHead=v.slice(0,200);E('descHead').value=state.descHead},200),txt('使用音源の見出し',()=>D.srcHead,v=>D.srcHead=v,200)),
      g(txt('区切り線（空にすると入れません）',()=>D.sep,v=>D.sep=v,80),sel('曲の書き方',()=>D.fmt,v=>D.fmt=v,[['work','『作品 / 曲名（アーティスト様）』'],['plain','曲名 / アーティスト']])),
      g(txt('提供者の行の記号',()=>D.pm,v=>D.pm=v,8),txt('音源の行の記号',()=>D.sm,v=>D.sm=v,8)),
      g(txt('最初の行（空にすると入れません）',()=>D.op,v=>D.op=v,40),txt('最後の行（時刻を入れた回だけ入ります）',()=>D.ed,v=>D.ed=v,40)),
      chk('提供者の名前に「様」を付ける','sama'),chk('提供者の行に、シートの「概要欄に載せるURL」も付ける（歌枠管理シートとつないで読み込んだあと）','purl'),chk('時刻の分を2桁にそろえる（01:54）','pad'),
      sel('時刻を手で入れていない曲',()=>state.descEmpty,v=>{state.descEmpty=v;E('descEmpty').value=v},[['rec','記録した時刻を使う'],['blank','曲名だけ載せる'],['skip','載せない']]));
    return det
  }
  function descBuild(s,rec){
    const box=rec.descBody;box.replaceChildren();
    const info=sInfo(s.id);
    const fld=(label,el)=>{const l=document.createElement('label');l.className='studio-field';l.append(label,el);return l};
    const url=document.createElement('input');url.type='url';url.className='sb-url';url.placeholder='アーカイブのURL（例：https://www.youtube.com/watch?v=…）';url.value=info.url||'';
    const out=document.createElement('textarea');out.className='studio-textarea sb-desc-out';out.readOnly=true;
    const warn=document.createElement('p');warn.className='studio-mini sb-desc-warn';warn.setAttribute('aria-live','polite');
    const cur=()=>sessOf(s.id)||s;
    const tbl=document.createElement('ol');tbl.className='sb-list sb-desc-list';
    const hints=[];
    const refresh=()=>{
      const c=cur(),t=descFull(c),p=descParts(c);
      out.value=t;out.rows=Math.max(4,Math.min(26,t.split('\n').length+1));
      warn.textContent=p.miss.length?'使った音源が分からない曲があります（使用音源に載りません）：'+p.miss.join('、')+'。上の一覧の「使った音源」で選べます。':'';
      for(const [inp,x] of hints)if(!Number.isFinite(x.ts))inp.placeholder=state.descEmpty==='rec'?descTs(recTs(x,info),false):'時刻'
    };
    url.oninput=()=>{info.url=url.value.trim().slice(0,500);save();refresh()};
    // 全体をずらす：記録を始めたのが配信の開始とずれていたとき、記録した時刻をまとめて動かす
    const sh=document.createElement('input');sh.type='number';sh.className='sb-time sb-shift';sh.step='1';sh.min='-36000';sh.max='36000';sh.value=String(info.shift||0);sh.inputMode='numeric';
    sh.oninput=()=>{const n=Math.round(Number(sh.value));if(Number.isFinite(n)&&n){info.shift=Math.max(-36000,Math.min(36000,n))}else delete info.shift;save();refresh()};
    // 最初の行（オープニング）・最後の行（エンディング）
    const op=document.createElement('input');op.type='checkbox';op.checked=info.op!==0;op.onchange=()=>{if(op.checked)delete info.op;else info.op=0;save();refresh()};
    const opL=document.createElement('label');opL.className='studio-field sb-check';opL.append(op,' 最初に「00:00 '+(state.desc.op||'オープニング')+'」の行を入れる');
    const ed=document.createElement('input');ed.className='sb-time';ed.inputMode='numeric';ed.placeholder='入れない';ed.value=Number.isFinite(info.end)?descTs(info.end,info.end>=3600):'';
    ed.setAttribute('aria-label','エンディングの時刻');
    ed.onchange=()=>{const v=ed.value.trim();if(!v){delete info.end;save();refresh();return}const sec=parseHms(v);if(sec===null){toast('「45:01」「1:02:03」のように入力してください',4000);ed.focus();return}info.end=sec;ed.value=descTs(sec,sec>=3600);save();refresh()};
    const timeIn=(get,set,label)=>{
      const inp=document.createElement('input');inp.className='sb-time';inp.inputMode='numeric';const v=get();inp.value=Number.isFinite(v)?fmtTs(v,v>=3600):'';inp.setAttribute('aria-label',label);
      inp.onchange=()=>{const t=inp.value.trim();if(!t){set(null);save();refresh();return}const sec=parseHms(t);if(sec===null){toast('「1:02:03」「12:34」のように入力してください',4000);inp.focus();return}set(sec);inp.value=fmtTs(sec,sec>=3600);save();refresh()};
      inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();const n=inp.closest('li')?.nextElementSibling?.querySelector('.sb-time');if(n)n.focus()}};
      return inp
    };
    for(const x of s.items){
      const li=document.createElement('li');
      const inp=timeIn(()=>x.ts,v=>{if(v===null)delete x.ts;else x.ts=v},'「'+x.title+'」のアーカイブ上の時刻');
      hints.push([inp,x]);
      const rb=rowBtn('記録した時刻','',()=>{x.ts=x.off;inp.value=fmtTs(x.off,x.off>=3600);save();refresh()},'歌い始めを押したときの経過時間（'+hms(x.off)+'）を、そのまま入れます');
      li.append(inp,songSpan(x.title,x.artist,'記録：'+hms(x.off)));
      // 使った音源：音源がいくつかある曲・まだ分からない曲では、ここで選べる
      const ss=(repFind(x.title,x.artist)?.srcs||[]).filter(y=>y.u||y.n);
      if(ss.length>1||(ss.length&&!usedSrc(x))){
        const se=document.createElement('select');se.className='sb-used';se.setAttribute('aria-label','「'+x.title+'」で使った音源');
        se.append(Object.assign(document.createElement('option'),{value:'',textContent:'使った音源を選ぶ'}));
        ss.forEach((y,i)=>se.append(Object.assign(document.createElement('option'),{value:String(i),textContent:(y.by?y.by+'：':'')+(y.n||y.u)+(y.kk&&y.kk!=='原曲キー'?'（'+y.kk+'）':'')})));
        const u=usedSrc(x);se.value=u?String(ss.indexOf(u)):'';
        se.onchange=()=>{const y=ss[Number(se.value)];if(se.value===''||!y)delete x.src;else x.src=y.n||y.u;save();refresh()};
        li.append(se)
      }
      li.append(rb);tbl.append(li)
    }
    // 足した行（トーク・企画など）
    const exBox=document.createElement('ol');exBox.className='sb-list sb-desc-list sb-desc-extra';
    const exDraw=()=>{
      exBox.replaceChildren(...(info.extra||[]).map(e=>{
        const li=document.createElement('li');
        const ti=timeIn(()=>e.ts,v=>{e.ts=v===null?0:v},'足した行の時刻');
        const tx=document.createElement('input');tx.type='text';tx.maxLength=120;tx.className='sb-extra-text';tx.value=e.t;tx.placeholder='この行に書く文字（例：○○をやってみよう！）';tx.oninput=()=>{e.t=tx.value.slice(0,120);save();refresh()};
        li.append(ti,tx,rowBtn('外す','',()=>{info.extra=info.extra.filter(y=>y!==e);if(!info.extra.length)delete info.extra;save();exDraw();refresh()}));
        return li
      }))
    };
    exDraw();
    const exAdd=rowBtn('＋ 行を足す（トーク・企画など）','',()=>{if((info.extra||[]).length>=30){toast('足せる行は30までです');return}(info.extra=info.extra||[]).push({ts:0,t:''});exDraw();exBox.lastElementChild?.querySelector('.sb-extra-text')?.focus()});
    const row=document.createElement('div');row.className='studio-row';
    row.append(rowBtn('📋 概要欄をコピー（セトリ＋使用音源）','accent',()=>copy(descFull(cur()))),
      rowBtn('セトリだけコピー','',()=>copy(descSetText(cur(),false))),
      rowBtn('使用音源だけコピー','',()=>{const t=descSrcText(cur());if(!t){toast('使った音源が分かる曲がありません',4000);return}copy(t)}),
      rowBtn('時刻リンクつきでコピー（Xなど用）','',()=>{if(!ytId(info.url)){toast('YouTubeのURLを入れると、時刻リンクを作れます',4000);return}copy(descSetText(cur(),true))}));
    const note=document.createElement('p');note.className='studio-mini';
    note.textContent='時刻は、記録した経過時間がそのまま入っています。アーカイブと合わないときは、「全体をずらす」でまとめて動かすか、曲ごとの欄に「12:34」「1:02:03」の形で入れます（Enterで次の曲へ。空にすると記録した時刻に戻ります）。下の文が、そのまま概要欄に貼れる形です。';
    const g=document.createElement('div');g.className='studio-inline';
    const edB=rowBtn('記録を終えた時刻を入れる','',()=>{const c=cur(),last=c.items.at(-1);if(!Number.isFinite(info.endRec)&&!last){toast('入れられる時刻がありません');return}const sec=Math.max(0,(Number.isFinite(info.endRec)?info.endRec:last.off)+(info.shift||0));info.end=sec;ed.value=descTs(sec,sec>=3600);save();refresh()});
    edB.hidden=!Number.isFinite(info.endRec);
    const edL=fld('最後の行「'+(state.desc.ed||'エンディング')+'」の時刻（空なら入れません）',ed);
    g.append(fld('全体をずらす（秒。例：30＝30秒あとへ、-15＝15秒前へ）',sh),edL);
    const exRow=document.createElement('div');exRow.className='studio-row';exRow.append(exAdd,edB);
    box.append(fld('アーカイブのURL（時刻リンクを作るときだけ使います）',url),note,g,opL,tbl,exBox,exRow,warn,out,row,descOpts(()=>{opL.lastChild.textContent=' 最初に「00:00 '+(state.desc.op||'オープニング')+'」の行を入れる';refresh()}));
    refresh()
  }
  function sessBox(s){
    const box=document.createElement('details');box.className='sb-sess';box.dataset.sess=s.id;
    const sum=document.createElement('summary');sum.textContent=sessSummary(s);
    const ol=document.createElement('ol');
    const row=document.createElement('div');row.className='studio-row';
    row.append(rowBtn('📋 概要欄をコピー（セトリ＋使用音源）','accent',()=>{const c=sessOf(s.id);if(c)copy(descFull(c))},'セトリ（時刻つき）と、使ったカラオケ音源を、概要欄に貼れる形でコピーします。時刻や形を直すときは、下の「概要欄を作る」を開きます'),
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
    const dsum=document.createElement('summary');dsum.textContent='概要欄を作る（時刻を直す・行を足す・形を変える）';
    const descBody=document.createElement('div');desc.append(dsum,descBody);
    const sh=document.createElement('details');sh.className='sb-desc';
    const shsum=document.createElement('summary');shsum.textContent='歌枠管理シートへ（配信ログに送る）';
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
    renderDeckSet();
    if(!ss){SB.sessState.textContent='記録していません';SB.now.textContent='';SB.undo.hidden=true;return}
    SB.sessState.textContent='記録中 '+hms((Date.now()-new Date(ss.start))/1000)+'（'+localTime(ss.start)+'から）';
    const last=sbLast;
    SB.now.textContent=last?'いま：'+last.title+(last.artist?' / '+last.artist:'')+'（'+hms(last.off)+'〜）':'';
    SB.undo.hidden=!last
  }
  // 毎秒の更新は経過時間の表示だけ（記録の全件はたどらない）
  setInterval(()=>{if(state.singSess)SB.sessState.textContent='記録中 '+hms((Date.now()-new Date(state.singSess.start))/1000)+'（'+localTime(state.singSess.start)+'から）'},1000);
  function renderSongs(){sbLast=sessLast();renderSess();renderSet();renderRep();renderLog();renderSongOpts();renderSheet();provListFill()}

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
