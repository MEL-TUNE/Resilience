/* 歌枠ノート（0.11.9）：提供者の略称・配信先ごとに使える音源・歌詞ページ（シートにURLがある曲だけ）・音源ファイル・セトリの音源をまとめて開く・歌枠ガチャ
   11-songbook.js の行の作り方（rowBtn・okeButtons）と、歌枠管理シートの読み込み（sheetCacheSet）から呼ばれる。
   ほかのファイルから先に呼ばれることがあるので、ここでは const の値を置かず、関数（function 宣言）だけにする */

  // ---- 提供者（歌枠管理シートの「提供者」タブ。読み込んであれば）
  function provInfo(name){
    const c=sheetCache();if(!c||!name)return null;
    const n=provCanon(name);
    return c.provs.find(x=>x.n===n)||null
  }
  // 長いチャンネル名を短くする（シートの「略称」が空のとき）。
  // 「」『』の中があればそれ。【】（）の中は外す。絵文字で区切られていれば、いちばん後ろの名前。それでも長ければそのまま（ボタンの幅で省く）
  function provShortAuto(name){
    let s=String(name||'').trim();
    if(!s)return '';
    const plain=s.replace(/[\p{Extended_Pictographic}️‍]/gu,'').trim();
    if(plain.length<=10)return plain||s;
    const q=s.match(/[「『]([^」』]+)[」』]/);
    if(q&&q[1].trim())return q[1].trim();
    s=s.replace(/【[^】]*】|（[^）]*）|\([^)]*\)|\[[^\]]*\]/g,' ');
    const parts=s.split(/[\p{Extended_Pictographic}️‍]+/u).map(x=>x.trim()).filter(Boolean);
    return (parts.length>1?parts[parts.length-1]:parts[0]||plain).trim()
  }
  function provShort(name){
    const p=provInfo(name),ab=String(p?.ab||'').trim();
    return ab||provShortAuto(p?.n||name)
  }

  // ---- 配信先ごとに使えるか
  // 配信先：yt＝YouTube、iriam＝IRIAM（収益化済み・JASRAC と NexTone の両方と提携）、l17＝17LIVE（収益化済み・JASRAC だけと提携）
  function destName(d){return {yt:'YouTube',iriam:'IRIAM',l17:'17LIVE'}[d]||''}
  // 音源1つ：{ok:true|false|null（未確認）, cond:条件付きか, why:理由}
  // 「音源」タブの「個別：…」が入っていればそれを、なければ「提供者」タブの可否を使う
  function srcAvail(r,x,dest){
    if(!dest||!x)return {ok:true};
    if(/^自作/.test(x.kind||''))return {ok:true,why:'自作の音源'};
    const p=provInfo(x.by)||{},o=x.pv||{};
    const val=k=>{const a=String(o[k]||'').trim();return a&&a!=='未確認'?a:String(p[k]||'').trim()};
    const need=dest==='yt'?[['yt','YouTube配信']]:[['oth','YouTube以外の配信'],['mon','収益化した配信']];
    const v=need.map(([k,n])=>[val(k),n]);
    const no=v.find(([a])=>a==='不可');
    if(no)return {ok:false,why:(x.by||'この音源')+'は'+no[1]+'で使えません'};
    const org=String(r?.org||'');
    if(dest==='l17'&&/nextone/i.test(org)&&!/jasrac/i.test(org))return {ok:false,why:'管理団体が NexTone の曲は、JASRAC だけと提携している 17LIVE では歌えません'};
    const un=v.find(([a])=>!a||a==='未確認');
    if(un)return {ok:null,why:(x.by?x.by+'の':'')+un[1]+'の可否が未確認です（歌枠管理シートの提供者タブ）'};
    return {ok:true,cond:v.some(([a])=>a==='条件付き'),why:v.some(([a])=>a==='条件付き')?'条件付きで使えます（クレジットなど。提供者タブの指定を確かめてください）':''}
  }
  // 曲：この配信先で使える音源があるか（true／false／null＝音源が未確認だけ・音源がない）
  function songAvail(r,dest){
    if(!dest)return true;
    const list=(r?.srcs||[]).filter(x=>x.u||x.f);
    if(!list.length)return null;
    let unk=false;
    for(const x of list){const a=srcAvail(r,x,dest);if(a.ok===true)return true;if(a.ok===null)unk=true}
    return unk?null:false
  }

  // ---- 歌詞ページ
  function lyricsOpen(r){
    let w=null;
    try{w=window.open(r.lu,'otonohaLyrics',state.karaOpen==='popup'?'popup=yes,width=560,height=860':'')}catch(_){}
    if(!w)toast('ブラウザに新しい窓を止められました。アドレスバーの表示からポップアップを許可すると開けます',7000);else try{w.focus()}catch(_){}
  }

  // ---- 音源のボタンに足すもの（音源ファイル・歌詞）。行の幅をそろえるため、絵文字だけの小さなボタンにする（0.11.9）
  // 歌詞は、歌枠管理シートの「歌詞ページのURL」が入っている曲だけ
  function okeExtras(r){
    if(!r)return [];
    const out=[];
    for(const x of (r.srcs||[]).filter(x=>x.f)){
      const b=rowBtn('📁','sb-icon sb-file',()=>{const w=window.open(x.f,'_blank','noopener');if(!w)toast('ブラウザに新しいタブを止められました。ポップアップを許可すると開けます',6000)},'音源ファイルを開く'+(x.by?'（'+x.by+'）':'')+(x.n?'\n'+x.n:''));
      b.setAttribute('aria-label','音源ファイルを開く'+(x.by?'（'+provShort(x.by)+'）':''));out.push(b)
    }
    if(r.lu){const b=rowBtn('🗒️','sb-icon sb-lyrics',()=>lyricsOpen(r),'歌詞ページを開く\n'+r.lu);b.setAttribute('aria-label','歌詞ページを開く');out.push(b)}
    return out
  }

  // ---- 配信先の選び方（セトリの上）
  function renderOkeDest(){
    const sel=E('okeDest');if(!sel)return;
    sel.value=state.okeDest||'';
    const d=state.okeDest,info=E('okeDestInfo');
    if(!info)return;
    if(!d){info.textContent='';return}
    let no=0,unk=0;
    for(const s of state.songs){const a=songAvail(repFind(s.title,s.artist),d);if(a===false)no++;else if(a===null)unk++}
    info.textContent=destName(d)+'で使えない音源は、✕を付けて薄く出します。'+(no?'セトリのうち '+no+'曲は、'+destName(d)+'で使える音源がありません。':'')+(unk?'可否が未確認の曲が '+unk+'曲あります。':'')+(sheetCache()?'':'（歌枠管理シートの提供者タブを読み込むと判定できます）')
  }

  // ---- セトリの YouTube の音源を、まとめて開く
  function setlistUrls(){
    const d=state.okeDest,out=[],seen=new Set();
    for(const s of state.songs){
      const r=repFind(s.title,s.artist),list=(r?.srcs||[]).filter(x=>x.u&&/youtube\.com|youtu\.be/i.test(x.u));
      if(!list.length)continue;
      const okd=x=>!d||srcAvail(r,x,d).ok!==false;
      const use=list.find(x=>r.useSrc&&(x.n===r.useSrc||x.u===r.useSrc)&&okd(x))||list.find(okd);
      if(!use||seen.has(use.u))continue;
      seen.add(use.u);out.push({u:use.u,t:s.title,by:provShort(use.by)})
    }
    return out
  }
  function openAllSetlist(){
    const list=setlistUrls(),box=E('songOpenAll');
    if(!list.length){toast(state.songs.length?'セトリの曲に、開けるYouTubeの音源がありません':'セトリは空です',4000);return}
    let opened=0;
    for(const x of list){let w=null;try{w=window.open(x.u,'_blank')}catch(_){}if(w)opened++;else break}
    if(box){
      // 開けなかったとき（ブラウザがポップアップを止めたとき）のために、リンクの一覧も出す
      box.replaceChildren();
      const p=document.createElement('p');p.className='studio-mini';
      p.textContent=opened===list.length?list.length+'件の音源を、新しいタブで開きました。':'ブラウザに止められたため、'+list.length+'件のうち '+opened+'件だけ開きました。下のリンクを押すと1つずつ開けます。まとめて開くには、アドレスバーの表示から、このページのポップアップを「常に許可」にしてください。';
      const ol=document.createElement('ol');ol.className='sb-openall-list';
      list.forEach((x,i)=>{const li=document.createElement('li'),a=document.createElement('a');a.href=x.u;a.target='_blank';a.rel='noopener';a.textContent=x.t+(x.by?'（'+x.by+'）':'');li.append(a);if(i<opened)li.className='done';ol.append(li)});
      box.append(p,ol);box.hidden=false
    }
    if(opened<list.length)toast('ブラウザに止められて、'+list.length+'件のうち'+opened+'件だけ開きました。セトリの下のリンクから開けます',8000)
  }

  // ---- 歌枠管理シートの詳しい項目（管理団体・歌詞ページ・音源ごとの可否・動画内の歌詞表示・音源ファイル）を曲リストへ写す
  function sheetDetailApply(j){
    if(!j||!Array.isArray(j.songs))return 0;
    let n=0;
    const http=u=>/^https?:\/\//i.test(String(u||'').trim())?String(u).trim().slice(0,500):'';
    for(const x of j.songs){
      const r=repFind(String(x.t||''),String(x.a||''));if(!r)continue;
      const org=String(x.org||'').trim().slice(0,40),lu=http(x.lu);
      if((r.org||'')!==org){if(org)r.org=org;else delete r.org;n++}
      if((r.lu||'')!==lu){if(lu)r.lu=lu;else delete r.lu;n++}
    }
    for(const x of (Array.isArray(j.srcs)?j.srcs:[])){
      const key=String(x.s||''),i=key.lastIndexOf('／');
      const r=i>0?repFind(key.slice(0,i),key.slice(i+1)):repFind(key,'');
      if(!r||!Array.isArray(r.srcs))continue;
      const u=x.u?okeNorm(String(x.u)):'';
      const y=r.srcs.find(y=>(u&&y.u===u)||(x.n&&y.n&&sbNorm(y.n)===sbNorm(String(x.n))));
      if(!y)continue;
      const pv={};for(const k of ['yt','mon','oth']){const v=String(x[k]||'').trim();if(v&&v!=='未確認')pv[k]=v.slice(0,10)}
      const was=JSON.stringify(y.pv||{});
      if(Object.keys(pv).length)y.pv=pv;else delete y.pv;
      if(JSON.stringify(y.pv||{})!==was)n++;
      const ly=String(x.lyr||'').trim();if(ly&&y.ly!==ly){y.ly=ly.slice(0,10);n++}
      const f=http(x.f);if(f&&y.f!==f){y.f=f;n++}
    }
    if(n){saveNow();renderRep();renderSet()}
    return n
  }

  // ---- 「カラオケ音源を探す」：シートの提供者タブにあって、まだ登録していないチャンネルを足す
  function karaMergeProvs(){
    const c=sheetCache();if(!c||typeof karaList!=='function')return 0;
    const list=karaList(),bases=new Set(list.map(x=>karaBase(x.url)).filter(Boolean)),names=new Set(list.map(x=>provCanon(x.name)));
    // 一度足したチャンネルは覚えておき、あとで消したときに足し直さない
    let seen=[];try{seen=JSON.parse(localStorage.getItem('otonoha-kara-offered')||'[]')}catch(_){}
    if(!Array.isArray(seen))seen=[];
    const was=seen.length;
    let add=0;
    for(const p of c.provs){
      const base=karaBase(p.url);
      if(!base||seen.includes(p.n))continue;
      if(bases.has(base)||names.has(p.n)){seen.push(p.n);continue}
      if(list.length>=60)continue;
      seen.push(p.n);
      list.push({name:p.n.slice(0,80),url:p.url.slice(0,300),memo:'YouTube '+(p.yt||'？')+'／収益化 '+(p.mon||'？')+'／YouTube以外 '+(p.oth||'？')});
      bases.add(base);names.add(p.n);add++
    }
    if(seen.length!==was)try{localStorage.setItem('otonoha-kara-offered',JSON.stringify(seen.slice(-400)))}catch(_){}
    if(add){save();renderKara()}
    return add
  }

  // ---- 歌枠ガチャ（ラベルでしぼってランダムで1曲・ラベルから選出）
  function gachaOpt(){
    let o=null;try{o=JSON.parse(localStorage.getItem('otonoha-gacha')||'null')}catch(_){}
    o=o&&typeof o==='object'?o:{};
    return {tags:Array.isArray(o.tags)?o.tags.filter(x=>typeof x==='string').slice(0,40):[],all:o.all===true,noSet:o.noSet!==false,dest:o.dest!==false,noSung:o.noSung===true}
  }
  function gachaOptSet(o){try{localStorage.setItem('otonoha-gacha',JSON.stringify(o))}catch(_){}}
  function gachaMark(t){return (sheetCache()?.labelInfo||[]).find(x=>x.name===t)?.mark||''}
  function gachaPool(o){
    o=o||gachaOpt();
    const inSet=new Set(state.songs.map(s=>songKey(s.title,s.artist)));
    const sess=state.singSess,sung=new Set(sess?logList().filter(x=>x.sess===sess.id).map(x=>songKey(x.title,x.artist)):[]);
    return repList().filter(r=>{
      if(o.tags.length){const t=tagSplit(r.tag);if(o.all?!o.tags.every(x=>t.includes(x)):!o.tags.some(x=>t.includes(x)))return false}
      const k=songKey(r.title,r.artist);
      if(o.noSet&&inSet.has(k))return false;
      if(o.noSung&&sung.has(k))return false;
      if(o.dest&&state.okeDest&&songAvail(r,state.okeDest)!==true)return false;
      return true
    })
  }
  var gachaTimer=0;
  function gachaShow(r){
    if(typeof topicCfg!=='function'||typeof topicShow!=='function'){toast('この画面では、配信画面に出せません',4000);return}
    const t=topicCfg();
    let d=t.decks.find(x=>x.preset==='song');
    if(!d){const sel=t.sel;d=topicNew('song');if(!d)return;t.sel=sel||d.id;toast('「🎲 企画」のお題帳に「歌枠ルーレット」の冊を作りました（ガチャの結果をここから画面に出します）',6000)}
    const F=d.fields;
    let it=d.items.find(x=>songKey(x.f[F[0]],x.f[F[1]])===songKey(r.title,r.artist));
    if(!it){
      if(d.items.length>=2000){toast('お題帳「'+d.name+'」が2000件でいっぱいです',5000);return}
      const v=[r.title,r.artist||'',r.w||'',r.tag||'',r.memo||''],f={};F.forEach((k,i)=>{f[k]=v[i]||''});
      it={id:tid(),f,st:'cand',at:new Date().toISOString()};d.items.push(it)
    }
    topicShow(d,it)
  }
  function gachaResult(box,r){
    box.replaceChildren();
    const card=document.createElement('div');card.className='sb-gacha-card';
    const head=document.createElement('p');head.className='sb-gacha-head';head.textContent='🎲 出ました';
    const t=document.createElement('p');t.className='sb-gacha-title';t.textContent=r.title;
    const a=document.createElement('p');a.className='sb-gacha-artist';a.textContent=[r.artist,r.w].filter(Boolean).join('　');
    card.append(head,t,a);
    const tags=tagSplit(r.tag);
    if(tags.length){const g=document.createElement('p');g.className='sb-gacha-tags';g.textContent=tags.map(x=>(gachaMark(x)?gachaMark(x)+' ':'')+x).join('　');card.append(g)}
    const row=document.createElement('div');row.className='studio-row';
    row.append(rowBtn('セトリへ','accent',()=>{state.songs.push({title:r.title,artist:r.artist});save();renderSet();renderGacha();toast('セトリに追加しました',2000)}),
      rowBtn('♪ 歌い始め','sb-sing',()=>sing(r.title,r.artist)),
      rowBtn('📺 配信画面に出す','',()=>gachaShow(r),'「🎲 企画」の歌枠ルーレットのカードとして、配信画面に出します'),
      rowBtn('🎲 もう一回','',()=>gachaDraw()));
    const ok=okeButtons(r);
    if(ok.length){const g=document.createElement('div');g.className='studio-row sb-okes';g.append(...ok);card.append(g)}
    card.append(row);box.append(card)
  }
  function gachaDraw(){
    const box=E('gachaOut');if(!box)return;
    const pool=gachaPool();
    clearTimeout(gachaTimer);
    if(!pool.length){box.replaceChildren(sbEmpty('p','このしぼりこみに当てはまる曲がありません'));return}
    const pick=pool[Math.floor(Math.random()*pool.length)];
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduce||pool.length<2){gachaResult(box,pick);return}
    // はじめの1秒ほど、ほかの曲名をぱらぱら見せてから止める（おみくじを振るように）
    const p=document.createElement('p');p.className='sb-gacha-spin';box.replaceChildren(p);
    let i=0;
    const step=()=>{
      if(i>=12){gachaResult(box,pick);return}
      p.textContent=pool[Math.floor(Math.random()*pool.length)].title;
      i++;gachaTimer=setTimeout(step,50+i*12)
    };
    step()
  }
  function renderGacha(){
    const box=E('gachaBody');if(!box||!box.closest('details')?.open)return;
    const o=gachaOpt(),c=sheetCache(),info=c?.labelInfo||[];
    // ラベル：シートのラベル一覧の分類ごとに（記号つき）。シートにない、曲リストだけのラベルは「そのほか」
    const count=new Map();for(const r of repList())for(const t of tagSplit(r.tag))count.set(t,(count.get(t)||0)+1);
    const groups=new Map();
    for(const x of info){const g=x.group||'ラベル';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(x.name)}
    const known=new Set(info.map(x=>x.name)),rest=[...count.keys()].filter(t=>!known.has(t)).sort((a,b)=>a.localeCompare(b,'ja'));
    if(rest.length)groups.set(info.length?'そのほか':'ラベル',[...(groups.get(info.length?'そのほか':'ラベル')||[]),...rest]);
    const chips=document.createElement('div');chips.className='sb-gacha-groups';
    for(const [g,names] of groups){
      const row=document.createElement('div');row.className='sb-gacha-group';
      const h=document.createElement('span');h.className='sb-gacha-gname';h.textContent=g;row.append(h);
      for(const n of names){
        const b=rowBtn((gachaMark(n)?gachaMark(n)+' ':'')+n+'（'+(count.get(n)||0)+'）','sb-chip'+(o.tags.includes(n)?' on':''),()=>{const t=gachaOpt();t.tags=t.tags.includes(n)?t.tags.filter(x=>x!==n):[...t.tags,n];gachaOptSet(t);renderGacha()});
        b.setAttribute('aria-pressed',o.tags.includes(n)?'true':'false');row.append(b)
      }
      chips.append(row)
    }
    if(!groups.size)chips.append(sbEmpty('p','ラベルの付いた曲がまだありません（曲の「編集」か、歌枠管理シートでラベルを付けられます）'));
    const ck=(key,label)=>{const l=document.createElement('label');l.className='studio-field sb-gacha-ck';const i=document.createElement('input');i.type='checkbox';i.checked=!!o[key];i.onchange=()=>{const t=gachaOpt();t[key]=i.checked;gachaOptSet(t);renderGacha()};l.append(i,' '+label);return l};
    const mode=document.createElement('label');mode.className='studio-field';
    const ms=document.createElement('select');
    for(const [v,t] of [['any','選んだラベルの、どれかが付いた曲'],['all','選んだラベルが、全部付いた曲']])ms.append(Object.assign(document.createElement('option'),{value:v,textContent:t}));
    ms.value=o.all?'all':'any';ms.onchange=()=>{const t=gachaOpt();t.all=ms.value==='all';gachaOptSet(t);renderGacha()};
    mode.append('しぼりこみ方',ms);
    const pool=gachaPool(o);
    const opts=document.createElement('div');opts.className='studio-inline';
    opts.append(mode,ck('noSet','セトリに入っている曲は出さない'),ck('noSung','今回の記録で歌った曲は出さない'),ck('dest','配信先で使える音源がある曲だけ'+(state.okeDest?'（'+destName(state.okeDest)+'）':'（配信先を選んだとき）')));
    const act=document.createElement('div');act.className='studio-row';
    act.append(rowBtn('🎲 ガチャを引く','accent',()=>gachaDraw()),
      o.tags.length?rowBtn('ラベルの選択を外す','',()=>{const t=gachaOpt();t.tags=[];gachaOptSet(t);renderGacha()}):'');
    const n=document.createElement('p');n.className='studio-mini';n.textContent='当てはまる曲：'+pool.length+'曲'+(o.tags.length?'（'+o.tags.join(o.all?'＋':'・')+'）':'（ラベルを選ばないときは、曲リスト全体から）');
    // 当てはまる曲の一覧（ラベルで抜き出す）
    const det=document.createElement('details');det.className='sb-gacha-list';
    const sum=document.createElement('summary');sum.textContent='当てはまる曲の一覧（'+pool.length+'曲）';det.append(sum);
    det.ontoggle=()=>{if(!det.open||det.querySelector('ul'))return;
      const ul=document.createElement('ul');ul.className='sb-list';
      for(const r of pool.slice().sort((a,b)=>a.title.localeCompare(b.title,'ja')).slice(0,300)){
        const li=document.createElement('li');
        li.append(songSpan(r.title,r.artist,tagSplit(r.tag).map(x=>(gachaMark(x)||'')+x).join(' ')),rowGroup('sb-acts',[rowBtn('セトリへ','',()=>{state.songs.push({title:r.title,artist:r.artist});save();renderSet();toast('セトリに追加しました',2000)})]));
        ul.append(li)
      }
      if(pool.length>300)ul.append(sbEmpty('li','ほか'+(pool.length-300)+'曲'));
      det.append(ul)};
    const out=E('gachaOut')||Object.assign(document.createElement('div'),{id:'gachaOut',className:'sb-gacha-out'});
    box.replaceChildren(chips,opts,act,n,out,det)
  }

  {
    const sel=E('okeDest');
    if(sel)sel.onchange=()=>{state.okeDest=sel.value;save();renderSet();renderRep();renderGacha()};
    const b=E('songOpenAllBtn');if(b)b.onclick=openAllSetlist;
    const g=E('sbGacha');if(g)g.addEventListener('toggle',()=>renderGacha());
    renderOkeDest();karaMergeProvs()
  }
