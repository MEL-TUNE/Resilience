/* 歌枠管理シートを編集する（歌枠ノートの「📝 シートの曲を足す・直す」）。Apps Script 版3 の sheet／save／labels／setup／history／backup を使う */

  // 画面の項目の名前（シートの見出しと同じ意味。書き込むのは Apps Script の FIELDS_ にある項目だけ）
  const SX_NAMES={
    '曲':{t:'曲名',a:'アーティスト',w:'作品名（タイアップ）',y:'読み（並べ替え用）',st:'表記の状態',g:'ラベル',set:'セトリでの表記',lu:'歌詞ページのURL',org:'管理団体',code:'作品コード',jt:'作品タイトル（申請用）',ja:'アーティスト名（申請用）',ly:'作詞者',cp:'作曲者',rt:'管理団体の登録表記（曲名）',ra:'管理団体の登録表記（アーティスト）',memo:'メモ'},
    '音源':{s:'曲',n:'音源名',u:'URL',by:'提供者',kind:'種類',kk:'キーの区分',key:'キー',lyr:'動画内の歌詞表示',who:'使える名義',yt:'個別：YouTube配信',mon:'個別：収益化配信',oth:'個別：YouTube以外',cond:'個別の利用条件・購入メモ',f:'音源ファイルの保存場所',memo:'メモ'},
    '提供者':{n:'提供者名',url:'概要欄に載せるURL',yt:'YouTube配信で使用',mon:'収益化済み配信で使用',oth:'YouTube以外の配信で使用',cr:'クレジット表記の指定',tu:'利用規約・説明のURL',d:'確認日',memo:'メモ（要点）',raw:'規約・説明の原文',y:'読み（並べ替え用）'}
  };
  const SX_IDS={'曲':['t','a'],'音源':['n'],'提供者':['n']};
  const SX_ARR={'曲':'songs','音源':'srcs','提供者':'provs'};
  // シートにプルダウンがないときの選択肢（シートの入力規則が読めたら、そちらを使う）
  const SX_OPTS={
    '曲':{st:['下書き・要確認','確認済み','概要欄で使用済み'],org:['JASRAC','NexTone','なし（自作）','その他']},
    '音源':{kind:['YouTube動画','購入音源','依頼制作','自作（オリジナル曲）','その他'],kk:['原曲キー','女性キー','男性キー','その他'],lyr:['出る','出ない'],yt:['可','不可','条件付き','未確認'],mon:['可','不可','条件付き','未確認'],oth:['可','不可','条件付き','未確認']},
    '提供者':{yt:['可','不可','条件付き','未確認'],mon:['可','不可','条件付き','未確認'],oth:['可','不可','条件付き','未確認']}
  };
  // 「ラベルの準備」で最初に入れる候補（作者が挙げた分け方から。準備のときに外せる・あとで名前も変えられる）
  const SX_SEED=[
    {group:'歌のジャンル',name:'J-POP',mark:'💿'},{group:'歌のジャンル',name:'アニメソング',mark:'📺'},{group:'歌のジャンル',name:'ゲームソング',mark:'🎮'},
    {group:'原曲の声',name:'男性キー曲',mark:'👔'},{group:'原曲の声',name:'女性キー曲',mark:'👗'},
    {group:'原作',name:'少年漫画',mark:'📘'},{group:'原作',name:'少女漫画',mark:'📕'},
    {group:'掲載誌',name:'週刊少年ジャンプ',mark:''},{group:'掲載誌',name:'週刊少年サンデー',mark:''},{group:'掲載誌',name:'りぼん',mark:''},{group:'掲載誌',name:'なかよし',mark:''},
    {group:'作者',name:'CLAMP',mark:''}
  ];
  const SX={box:E('sxBox'),body:E('sxBody'),data:null,at:'',view:'sync',q:'',lab:'',busy:false};

  // ---- 小さな部品
  function h(tag,props,...kids){
    const el=document.createElement(tag);
    if(props)for(const [k,v] of Object.entries(props)){
      if(v==null||v===false)continue;
      if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('on'))el[k]=v;else if(k in el&&typeof v!=='string')el[k]=v;else el.setAttribute(k,v===true?'':v)
    }
    for(const c of kids.flat())if(c!=null&&c!==false)el.append(c);
    return el
  }
  const sxBtn=(label,fn,cls,title)=>h('button',{type:'button',class:cls||null,title:title||null,onclick:fn},label);
  const sxNote=(t,cls)=>h('p',{class:cls||'studio-mini',text:t});
  function sxInput(val,o={}){
    const el=o.area?h('textarea',{class:'studio-textarea',rows:o.rows||3,maxLength:o.max||1000}):h('input',{type:o.type||'text',maxLength:o.max||300,autocomplete:'off'});
    el.value=val||'';if(o.ph)el.placeholder=o.ph;if(o.list)el.setAttribute('list',o.list);
    return el
  }
  function sxSelect(val,opts,blank=true){
    const el=h('select');
    const list=[...(blank?['']:[]),...opts];
    if(val&&!list.includes(val))list.push(val);
    for(const o of list)el.append(h('option',{value:o},o===''?'（空欄）':o));
    el.value=val||'';
    return el
  }
  const sxField=(label,el,hint)=>h('label',{class:'studio-field'},label,el,hint?h('small',{class:'sx-hint',text:hint}):null);
  const sxOpts=(tab,k)=>SX.data?.opts?.[tab]?.[k]||SX_OPTS[tab]?.[k]||[];
  const sxId=(tab,o)=>SX_IDS[tab].map(k=>o[k]||'').join('／');
  const songSk=o=>(o.t||'')+'／'+(o.a||'');
  const sxHas=(tab,k)=>!!SX.data&&(SX.data[SX_ARR[tab]+'Cols']||[]).includes(k);
  const sxLabels=()=>Array.isArray(SX.data?.labels)?SX.data.labels:null;
  const sxNoKanji=t=>!/[\u3400-\u9fff々〆ヵヶ]/.test(t);
  // 読みの見当：カタカナはひらがなに、英字は小文字に（漢字があるときは見当を付けない）
  const sxYomi=t=>sxNoKanji(t)?String(t||'').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[ヴ]/g,'ゔ'):'';
  const sxToday=()=>{const d=new Date();return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0')};
  const sxIsDrive=u=>/^https?:\/\/(drive|docs)\.google\.com\//i.test(String(u||''));

  async function sxCall(op,body){
    if(SX.busy)throw Error('前の書き込みが終わるまで、お待ちください');
    SX.busy=true;SX.box.classList.add('sx-busy');
    try{return await sheetCall(op,body)}finally{SX.busy=false;SX.box.classList.remove('sx-busy')}
  }
  function sxSay(el,t,kind){el.textContent=t;el.dataset.kind=kind||''}

  // ---- 読み込み
  // 画面を作り直さずに、シートを読み直す
  async function sxFetch(){
    let j;
    try{j=await sxCall('sheet')}catch(e){if(/知らない操作/.test(e.message))e.message='Apps Script が古い版です。下の「歌枠管理シートとつなぐ」の「コードをコピー」で版3に入れ替えて、デプロイを「新バージョン」にしてください';throw e}
    if(!(j.version>=3))throw Error('Apps Script が古い版です（版'+(j.version||'?')+'）。下の「歌枠管理シートとつなぐ」の「コードをコピー」で版3に入れ替えて、デプロイを「新バージョン」にしてください');
    SX.data=j;SX.at=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
    return j
  }
  async function sxLoad(quiet){
    const say=SX.body.querySelector('.sx-status');
    if(say&&!quiet)sxSay(say,'シートを読んでいます…');
    try{
      await sxFetch();
      sxRender()
    }catch(e){
      if(/知らない操作/.test(e.message))e.message='Apps Script が古い版です。下の「歌枠管理シートとつなぐ」の「コードをコピー」で版3に入れ替えて、デプロイを「新バージョン」にしてください';
      SX.data=null;sxRender(e.message)
    }
  }

  // ---- 全体
  function sxRender(err){
    const B=SX.body;B.replaceChildren();
    if(!sheetLink()){
      B.append(sxNote('まだ歌枠管理シートとつないでいません。この下の「歌枠管理シートとつなぐ」の「B. Apps Script でつなぐ」で、URLと合言葉を入れると使えます。端末ごと（パソコン・スマホ）に一度ずつ入れます。','studio-note'),
        h('div',{class:'studio-row'},sxBtn('つなぐ欄を開く',()=>{const d=SX.box.parentElement.querySelector('#sbSheet')||document.getElementById('sbSheet');if(d){d.open=true;d.scrollIntoView({block:'start',behavior:'smooth'})}})));
      return
    }
    const status=h('p',{class:'studio-mini sx-status','aria-live':'polite'});
    const top=h('div',{class:'sx-top'},status,sxBtn('🔄 読み直す',()=>sxLoad()));
    B.append(top);
    if(err){sxSay(status,err,'err');return}
    if(!SX.data){sxSay(status,'「🔄 読み直す」でシートを読み込みます');return}
    sxSay(status,'📗 '+(SX.data.name||'スプレッドシート')+'（'+SX.at+' に読み込み）　曲 '+SX.data.songs.length+'・音源 '+SX.data.srcs.length+'・提供者 '+SX.data.provs.length);
    const tabs=[['sync','🔄 曲リストとそろえる'],['songs','🎵 曲と音源'],['provs','🎧 音源の提供者'],['labels','🏷 ラベルの項目'],['hist','📜 変更の記録']];
    const nav=h('div',{class:'sx-nav',role:'tablist'});
    for(const [v,l] of tabs)nav.append(h('button',{type:'button',role:'tab','aria-selected':String(SX.view===v),class:SX.view===v?'selected':null,onclick:()=>{SX.view=v;sxRender()}},l));
    const pane=h('div',{class:'sx-pane'});
    B.append(nav,pane);
    ({sync:sxSyncPane,songs:sxSongList,provs:sxProvList,labels:sxLabelPane,hist:sxHistPane})[SX.view](pane)
  }

  // ---- 書き込む前に、変わるところを見せる
  function sxDiff(tab,rec,f){
    const N=SX_NAMES[tab];
    return Object.keys(f).filter(k=>(rec?rec[k]||'':'')!==(f[k]||'')).map(k=>({k,label:N[k]||k,from:rec?rec[k]||'':'',to:f[k]||''}))
  }
  // anchor（ボタンの行など）のすぐ下に出す
  function sxConfirm(anchor,lines,extra,go){
    const box=h('div',{class:'sx-confirm',role:'region','aria-label':'書き込む内容'});
    const ul=h('ul',{class:'sx-diff'});
    for(const x of lines)ul.append(h('li',null,h('b',{text:x.label}),x.from!==''?h('span',{class:'sx-from',text:x.from.length>80?x.from.slice(0,80)+'…':x.from}):h('span',{class:'sx-from sx-none',text:'（空欄）'}),h('span',{class:'sx-arrow','aria-hidden':'true',text:'→'}),x.to!==''?h('span',{class:'sx-to',text:x.to.length>80?x.to.slice(0,80)+'…':x.to}):h('span',{class:'sx-to sx-none',text:'（空欄にする）'})));
    const say=h('p',{class:'studio-mini','aria-live':'polite'});
    const goBtn=sxBtn('📝 シートに書き込む',async()=>{goBtn.disabled=true;sxSay(say,'書き込んでいます…');try{await go(say)}catch(e){sxSay(say,e.message,'err');goBtn.disabled=false;if(e.conflict)box.append(h('div',{class:'studio-row'},sxBtn('🔄 シートを読み直す',()=>sxLoad())))}},'accent');
    box.append(h('p',{class:'sx-confirm-h',text:'シートのこの項目を書き換えます'}),ul,...(extra||[]),h('div',{class:'studio-row'},goBtn,sxBtn('やめる',()=>box.remove())),say);
    if(anchor.nextElementSibling?.classList.contains('sx-confirm'))anchor.nextElementSibling.remove();
    anchor.after(box);box.scrollIntoView({block:'nearest',behavior:'smooth'});
    return box
  }
  // 1行を書き込み、読み込んだ控え（SX.data）とオトノハの曲リストをそろえる
  async function sxSave(tab,rec,f){
    const changed={};for(const k of Object.keys(f))if((rec?rec[k]||'':'')!==(f[k]||''))changed[k]=f[k]||'';
    const before={};
    if(rec){for(const k of [...SX_IDS[tab],...Object.keys(changed)])before[k]=rec[k]||''}
    let j;
    try{j=await sxCall('save',{tab,r:rec?rec.r:0,before,f:rec?changed:Object.fromEntries(Object.entries(changed).filter(([,v])=>v!==''))})}
    catch(e){if(/変わっています|見つかりません/.test(e.message))e.conflict=true;throw e}
    const arr=SX.data[SX_ARR[tab]],old=rec?{...rec}:null;
    if(j.added){if(tab!=='音源')for(const x of arr)if(x.r>=j.r)x.r++;arr.push(j.rec);arr.sort((a,b)=>a.r-b.r)}
    else Object.assign(rec,j.rec);
    const now=j.added?j.rec:rec;
    if(old&&j.moved){
      if(tab==='曲'&&songSk(old)!==songSk(now))for(const x of SX.data.srcs)if(x.s===songSk(old))x.s=songSk(now);
      if(tab==='提供者'&&old.n!==now.n)for(const x of SX.data.srcs)if(x.by===old.n)x.by=now.n
    }
    try{if(tab==='曲')sxSyncSong(old,now,j.wrote);else if(tab==='音源')sxSyncSrc(old,now)}catch(e){toast('シートには書き込みました。オトノハの曲リストへの反映でつまずきました：'+e.message,6000)}
    return {j,rec:now}
  }
  // ---- オトノハの曲リスト（歌枠ノート）へ反映する
  // wrote＝シートに書いた項目。曲リストにもとからある曲は、書いた項目だけを写す（書いていない作品名・ラベルを、シートの値で消さない）
  function sxSyncSong(old,rec,wrote){
    const oldSk=old?songSk(old):'';
    let s=(oldSk&&repList().find(x=>x.sk===oldSk))||(old&&repFind(old.t,old.a))||repFind(rec.t,rec.a);
    const fresh=!s;
    if(!s){s=repAdd(rec.t,rec.a);if(!s)return}
    const all=fresh||!Array.isArray(wrote);
    const k0=songKey(s.title,s.artist),k1=songKey(rec.t,rec.a);
    if(k0!==k1){
      if(repFind(rec.t,rec.a)&&repFind(rec.t,rec.a)!==s)return;
      for(const x of logList())if(songKey(x.title,x.artist)===k0){x.title=rec.t;x.artist=rec.a}
      for(const x of state.songs||[])if(songKey(x.title,x.artist)===k0){x.title=rec.t;x.artist=rec.a}
      s.title=rec.t.slice(0,200);s.artist=(rec.a||'').slice(0,200)
    }
    s.sk=songSk(rec).slice(0,420);
    if(all||wrote.includes('w')){if(rec.w)s.w=rec.w.slice(0,200);else delete s.w}
    if('g' in rec&&(all||wrote.includes('g'))){const g=tagNorm(rec.g);if(g)s.tag=g;else delete s.tag}
    saveNow();renderRep();renderSet();if(k0!==k1)renderLog()
  }
  function sxLocalSrc(rec){
    const u=rec.u?okeNorm(rec.u):'';
    return {u:u||'',n:rec.n||'',by:rec.by||'',k:rec.key||'',kind:rec.kind||'',f:/^https?:\/\//i.test(rec.f||'')?String(rec.f).slice(0,500):'',kk:rec.kk||'',ly:rec.lyr||''}
  }
  function sxSyncSrc(old,rec){
    const sk=rec.s||'';if(!sk)return;
    const i=sk.lastIndexOf('／'),t=i>0?sk.slice(0,i):sk,a=i>0?sk.slice(i+1):'';
    let s=repList().find(x=>x.sk===sk)||repFind(t,a);
    if(!s){s=repAdd(t,a);if(!s)return;s.sk=sk}
    if(!Array.isArray(s.srcs))s.srcs=[];
    const src=sxLocalSrc(rec);
    const hit=s.srcs.find(x=>(old&&old.n&&x.n===old.n)||(x.n&&x.n===rec.n));
    if(hit)Object.assign(hit,src);else srcAdd(s,src);
    if(old&&old.s&&old.s!==rec.s){
      const o=repList().find(x=>x.sk===old.s);
      if(o&&Array.isArray(o.srcs))o.srcs=o.srcs.filter(x=>x.n!==old.n)
    }
    saveNow();renderRep();renderSet()
  }

  // ===================== 曲 =====================
  function sxSongMatch(o,q,lab){
    if(lab&&!tagSplit(o.g).includes(lab))return false;
    if(!q)return true;
    const hay=sbNorm([o.t,o.a,o.w,o.y,o.g,o.memo].join(' '));
    return q.split(/\s+/).filter(Boolean).every(w=>hay.includes(sbNorm(w)))
  }
  function sxSongList(pane){
    const D=SX.data;
    const q=h('input',{type:'search',class:'sb-filter',placeholder:'曲名・アーティスト・作品・読み・ラベルで探す','aria-label':'シートの曲を探す'});q.value=SX.q;
    const labs=sxLabels();
    const lab=labs?sxSelect(SX.lab,labs.map(x=>x.name)):null;
    if(lab){lab.firstChild.textContent='ラベルで絞らない';lab.setAttribute('aria-label','ラベルで絞る')}
    const ul=h('ul',{class:'sx-list'});
    const count=h('p',{class:'studio-mini'});
    const draw=()=>{
      SX.q=q.value.trim();SX.lab=lab?.value||'';
      const list=D.songs.filter(o=>sxSongMatch(o,SX.q,SX.lab));
      count.textContent=list.length+'曲'+(list.length>40?'（はじめの40曲を出しています。探す欄で絞り込めます）':'');
      ul.replaceChildren(...list.slice(0,40).map(o=>{
        const n=D.srcs.filter(x=>x.s===songSk(o));
        const kinds=[...new Set(n.map(x=>x.kk).filter(x=>x&&x!=='原曲キー'))];
        return h('li',null,h('button',{type:'button',class:'sx-item',onclick:()=>sxSongEdit(pane,o)},
          h('span',{class:'sx-item-t',text:o.t+(o.a?' / '+o.a:'')}),
          h('small',{text:[o.w,'音源 '+n.length+(kinds.length?'（'+kinds.join('・')+'も）':''),sxMarks(o.g)].filter(Boolean).join('　')})))
      }));
      if(!list.length)ul.append(h('li',{class:'sb-empty',text:'見つかりませんでした。「＋ 新しい曲を足す」から足せます'}))
    };
    q.oninput=draw;if(lab)lab.onchange=draw;
    pane.append(h('div',{class:'studio-row'},sxBtn('＋ 新しい曲を足す',()=>sxSongEdit(pane,null,{t:q.value.trim()}),'accent')),
      h('div',{class:'sx-find'},q,lab),count,ul);
    draw()
  }
  function sxMarks(g){
    const L=sxLabels(),t=tagSplit(g);if(!t.length)return '';
    return t.map(n=>{const x=L?.find(y=>y.name===n);return (x?.mark?x.mark+' ':'')+n}).join(' ')
  }
  // 曲の編集（rec が null なら新しい曲。seed は最初に入れておく値）
  function sxSongEdit(pane,rec,seed){
    const tab='曲',v=rec||{...seed};
    pane.replaceChildren();
    const I={};
    const add=(k,el)=>(I[k]=el);
    add('t',sxInput(v.t,{max:200}));add('a',sxInput(v.a,{max:200}));add('w',sxInput(v.w,{max:200,ph:'アニメ・ゲーム・ドラマなど。なければ空欄'}));
    add('y',sxInput(v.y||(!rec&&v.t?sxYomi(v.t):''),{max:200}));
    add('st',sxSelect(v.st||(!rec?'下書き・要確認':''),sxOpts(tab,'st')));
    let yomiTouched=!!rec;I.y.oninput=()=>{yomiTouched=true};
    I.t.oninput=()=>{if(!yomiTouched)I.y.value=sxYomi(I.t.value)};
    const head=h('div',{class:'sx-head'},sxBtn('← 曲の一覧へ',()=>{pane.replaceChildren();sxSongList(pane)}),h('b',{text:rec?'曲を直す':'新しい曲を足す'}));
    const basic=h('div',{class:'sx-sec'},
      h('div',{class:'studio-inline'},sxField('曲名（正式な表記）',I.t),sxField('アーティスト',I.a)),
      sxField('作品名（タイアップ）',I.w),
      h('div',{class:'studio-inline'},sxField('読み（並べ替え用）',I.y,'ひらがなか半角の小文字。英字の曲は英字のまま。カタカナ・英字の曲名は自動で入ります'),sxField('表記の状態',I.st)));
    // ラベル：ふだんは付いているラベルだけ。押すと選ぶ欄が出る
    const labWrap=h('div',{class:'sx-sec'});
    let tags=tagSplit(v.g);
    const drawLab=()=>{
      labWrap.replaceChildren();
      const L=sxLabels();
      if(!sxHas(tab,'g')||!L){labWrap.append(sxNote('🏷 ラベル：まだ準備していません（「🏷 ラベルの項目」で準備できます）'));return}
      const chips=h('div',{class:'sx-chips'},...(tags.length?tags.map(n=>{const x=L.find(y=>y.name===n);return h('span',{class:'sx-chip'+(x?'':' sx-chip-gone'),title:x?null:'ラベル一覧にない名前です',text:(x?.mark?x.mark+' ':'')+n})}):[h('span',{class:'studio-mini',text:'ラベルなし'})]));
      const pick=h('div',{class:'sx-pick',hidden:true});
      const groups=[];for(const x of L){const gname=x.group||'分類なし';let gr=groups.find(y=>y.name===gname);if(!gr)groups.push(gr={name:gname,items:[]});gr.items.push(x)}
      for(const gr of groups){
        const fs=h('fieldset',{class:'sx-group'},h('legend',{text:gr.name}));
        for(const x of gr.items){
          const cb=h('input',{type:'checkbox'});cb.checked=tags.includes(x.name);
          cb.onchange=()=>{tags=cb.checked?[...tags,x.name]:tags.filter(t=>t!==x.name);chips.replaceWith(drawLabChips(L))};
          fs.append(h('label',{class:'sx-check'},cb,(x.mark?x.mark+' ':'')+x.name))
        }
        pick.append(fs)
      }
      const tgl=sxBtn('🏷 ラベルを選ぶ',()=>{pick.hidden=!pick.hidden;tgl.textContent=pick.hidden?'🏷 ラベルを選ぶ':'🏷 ラベルの選択を閉じる';tgl.setAttribute('aria-expanded',String(!pick.hidden))});
      tgl.setAttribute('aria-expanded','false');
      labWrap.append(h('div',{class:'sx-labhead'},h('b',{text:'ラベル'}),chips,tgl),pick)
    };
    const drawLabChips=L=>{const c=h('div',{class:'sx-chips'},...(tags.length?tags.map(n=>{const x=L.find(y=>y.name===n);return h('span',{class:'sx-chip',text:(x?.mark?x.mark+' ':'')+n})}):[h('span',{class:'studio-mini',text:'ラベルなし'})]));labWrap.querySelector('.sx-chips')?.replaceWith(c);return c};
    drawLab();
    // 申請・概要欄のくわしい項目
    const more=h('details',{class:'sx-more'},h('summary',null,'申請用・概要欄のくわしい項目（管理団体・作品コード・作詞者など）'));
    for(const k of ['set','lu','org','code','jt','ja','ly','cp','rt','ra','memo']){
      if(!sxHas(tab,k))continue;
      add(k,k==='org'?sxSelect(v.org||(!rec?'JASRAC':''),sxOpts(tab,'org')):sxInput(v[k],{max:k==='memo'?2000:300,type:k==='lu'?'url':'text',area:k==='memo'}));
      more.append(sxField(SX_NAMES[tab][k],I[k],k==='set'?'自作の曲など、「（アーティスト様）」の代わりに括弧の中へ入れる文字。入れると「様」が付きません':k==='org'?'NexTone の曲は、JASRAC とだけ提携している配信先では歌えない曲として判定します':null))
    }
    if(I.jt&&I.ja)more.append(h('div',{class:'studio-row'},sxBtn('曲名・アーティストを、申請用の欄へ写す（空欄だけ）',()=>{if(!I.jt.value)I.jt.value=I.t.value;if(!I.ja.value)I.ja.value=I.a.value})));
    const say=h('p',{class:'studio-mini','aria-live':'polite'});
    const actions=h('div',{class:'studio-row sx-actions'});
    const collect=()=>{const f={};for(const [k,el] of Object.entries(I))if(sxHas(tab,k))f[k]=el.value.trim();if(sxHas(tab,'g')&&sxLabels())f.g=tags.join('、');return f};
    actions.append(sxBtn(rec?'✓ 直したところを確かめる':'✓ 足す内容を確かめる',()=>{
      const f=collect();
      if(!f.t){sxSay(say,'曲名を入れてください','err');I.t.focus();return}
      const same=SX.data.songs.find(o=>o!==rec&&songSk(o)===songSk(f));
      if(same){sxSay(say,'同じ曲名・アーティストの曲がシートにもうあります','err');return}
      const lines=sxDiff(tab,rec,f);
      if(!lines.length){sxSay(say,'変わったところがありません');return}
      sxSay(say,'');
      const extra=rec&&songSk(rec)!==songSk(f)?[sxNote('曲名かアーティストを変えるので、この曲を選んでいる「音源」「配信ログ」の行も、新しい名前に付け替えます。オトノハの曲リスト・歌唱の記録も同じ曲として付け替えます。','sx-warn')]:[];
      sxConfirm(actions,lines,extra,async s2=>{
        const r=await sxSave(tab,rec,f);
        toast(r.j.added?'シートに曲を足しました。曲リストにも入れました':'シートの曲を直しました',3000);
        sxSongEdit(pane,r.rec);
        pane.querySelector('.sx-srcs')?.scrollIntoView({block:'nearest'})
      })
    },'accent'));
    pane.append(head,basic,labWrap,more,actions,say);
    if(rec)pane.append(sxSrcBlock(pane,rec));
    else pane.append(sxNote('曲をシートに書き込むと、このすぐ下に音源（カラオケのURL）を足す欄が出ます。','studio-note'));
    (rec?I.t:I.t.value?I.a:I.t).focus({preventScroll:true})
  }

  // ===================== 音源（曲の編集の中） =====================
  function sxSrcBlock(pane,song){
    const D=SX.data,sk=songSk(song);
    const box=h('div',{class:'sx-srcs sx-sec'},h('h4',{class:'sb-h4',text:'🎧 この曲の音源'}));
    const list=D.srcs.filter(x=>x.s===sk);
    const order=['原曲キー','','女性キー','男性キー','その他'];
    list.sort((a,b)=>order.indexOf(a.kk||'')-order.indexOf(b.kk||'')||a.r-b.r);
    if(!list.length)box.append(sxNote('まだ音源がありません。原曲キーの音源から足すと、あとで別のキー（男性キー・女性キーなど）を足すときに写せます。'));
    const ul=h('ul',{class:'sx-list'});
    for(const x of list){
      const li=h('li',{class:'sx-src'});
      li.append(h('span',{class:'sx-kk',dataset:null,text:x.kk||'キー未設定'}),
        h('span',{class:'sx-item-t'},x.n,h('small',{text:[x.by,x.kind,x.key?'キー '+x.key:'',x.lyr==='出ない'?'歌詞は出ない':''].filter(Boolean).join('　')})),
        h('span',{class:'sx-src-btns'},x.u?sxBtn('▶',()=>window.open(x.u,'_blank','noopener'),'','音源を開く'):null,sxBtn('直す',()=>sxSrcEdit(box,song,x)),sxBtn('＋ 別のキー',()=>sxSrcEdit(box,song,null,{...x,n:'',u:'',kk:x.kk==='男性キー'?'女性キー':'男性キー',key:'',f:'',memo:'',cond:''}),'','この音源の提供者・種類を写して、別のキーの音源を足す')));
      ul.append(li)
    }
    box.append(ul,h('div',{class:'studio-row'},sxBtn('＋ 音源を足す',()=>sxSrcEdit(box,song,null,{kk:'原曲キー',kind:'YouTube動画',lyr:'出る'}),'accent')));
    return box
  }
  function sxSrcName(song,f){
    const base=song.t+' / '+(f.by||f.kind||'音源')+(f.kk&&f.kk!=='原曲キー'?'（'+f.kk+'）':'')+(f.key?' キー'+f.key:'');
    let n=base,i=2;while(SX.data.srcs.some(x=>x.n===n))n=base+' ('+(i++)+')';
    return n
  }
  function sxSrcEdit(box,song,rec,seed){
    const tab='音源',v=rec||{...seed,s:songSk(song)};
    box.querySelector('.sx-src-form')?.remove();
    const form=h('div',{class:'sx-src-form',role:'group','aria-label':rec?'音源を直す':'音源を足す'});
    const I={};
    const provNames=SX.data.provs.map(x=>x.n);
    I.u=sxInput(v.u,{type:'url',max:500,ph:'https://youtu.be/…（共有リンクのまま貼れます）'});
    I.n=sxInput(v.n,{max:200,ph:'空欄なら「曲名 / 提供者（キー）」で付けます'});
    I.by=sxSelect(v.by,provNames);
    I.kind=sxSelect(v.kind,sxOpts(tab,'kind'));
    I.kk=sxSelect(v.kk,sxOpts(tab,'kk'));
    I.key=sxInput(v.key,{max:20,ph:'例：-5、+2、原曲'});
    I.lyr=sxSelect(v.lyr,sxOpts(tab,'lyr'));
    const urlSay=h('small',{class:'sx-hint'});
    I.u.onchange=()=>{
      const raw=I.u.value.trim();if(!raw){urlSay.textContent='';return}
      if(sxIsDrive(raw)){urlSay.textContent='Google ドライブのリンクは概要欄に載ってしまうので、ここには入れません。「音源ファイルの保存場所」に移します。';I.f&&(I.f.value=raw);I.u.value='';more.open=true;return}
      const u=okeNorm(raw);
      if(u===null){urlSay.textContent='URLが読めません（https:// から始まるURLを入れてください）';return}
      if(u!==raw){I.u.value=u;urlSay.textContent='共有ID（?si=…）などを外しました'}else urlSay.textContent=''
    };
    if(!provNames.length)I.by.firstChild.textContent='（提供者タブにまだ誰もいません）';
    const more=h('details',{class:'sx-more'},h('summary',null,'くわしい項目（使える名義・個別の可否・保存場所・メモ）'));
    for(const k of ['who','yt','mon','oth','cond','f','memo']){
      if(!sxHas(tab,k))continue;
      I[k]=k==='who'?sxSelect(v.who,(SX.data.accounts||[]).map(x=>x.name).filter(Boolean)):['yt','mon','oth'].includes(k)?sxSelect(v[k],sxOpts(tab,k)):sxInput(v[k],{max:k==='f'?500:2000,area:k==='cond'||k==='memo'});
      more.append(sxField(SX_NAMES[tab][k],I[k],{who:'購入した名義だけで使える音源のとき。空欄＝制限なし',yt:'空欄なら、提供者の設定を使います（有償ライセンスを買った音源など、この音源だけ違うときに選びます）',f:'購入音源・依頼制作の音源のファイルの場所（Google ドライブのリンクなど）。概要欄には出ません'}[k]))
    }
    const say=h('p',{class:'studio-mini','aria-live':'polite'});
    const row=h('div',{class:'studio-row'});
    row.append(sxBtn('✓ 確かめる',()=>{
      I.u.onchange();
      const f={s:songSk(song)};for(const [k,el] of Object.entries(I))if(sxHas(tab,k))f[k]=el.value.trim();
      if(f.u&&okeNorm(f.u)===null){sxSay(say,'URLが読めません','err');return}
      if(!f.n)f.n=sxSrcName(song,f),I.n.value=f.n;
      if(SX.data.srcs.some(x=>x!==rec&&x.n===f.n)){sxSay(say,'同じ音源名がシートにもうあります（音源名で選ぶので、重ならない名前にしてください）','err');return}
      if(!f.u&&!f.f&&f.kind==='YouTube動画'){sxSay(say,'YouTube動画の音源は、URLを入れてください','err');return}
      const lines=sxDiff(tab,rec,f).filter(x=>x.k!=='s'||rec);
      if(!lines.length){sxSay(say,'変わったところがありません');return}
      sxSay(say,'');
      const extra=rec&&rec.n!==f.n?[sxNote('音源名を変えるので、配信ログでこの音源を選んでいる行も、新しい名前に付け替えます。','sx-warn')]:[];
      if(rec&&rec.u&&f.u!==rec.u)extra.push(sxNote('提供者が新しい版を出したときは、このようにURLだけ差し替えて、メモに差し替えたことを残しておくと、過去の配信ログも崩れません。'));
      sxConfirm(row,lines,extra,async()=>{
        const r=await sxSave(tab,rec,f);
        toast(r.j.added?'シートに音源を足しました。曲リストの「▶」から開けます':'シートの音源を直しました',3000);
        const nb=sxSrcBlock(box.parentElement,song);box.replaceWith(nb)
      })
    },'accent'),sxBtn('閉じる',()=>form.remove()));
    form.append(h('p',{class:'sx-confirm-h',text:rec?'音源を直す：'+rec.n:'音源を足す'}),
      sxField('URL',I.u),urlSay,
      h('div',{class:'studio-inline'},sxField('キーの区分',I.kk),sxField('キー',I.key)),
      h('div',{class:'studio-inline'},sxField('提供者',I.by),sxField('種類',I.kind)),
      h('div',{class:'studio-inline'},sxField('音源名',I.n),sxField('動画内の歌詞',I.lyr)),
      provNames.length?null:sxNote('提供者は「🎧 音源の提供者」で足すと、ここで選べます。'),
      more,row,say);
    box.append(form);
    form.scrollIntoView({block:'nearest',behavior:'smooth'});
    (rec?I.n:I.u).focus({preventScroll:true})
  }

  // ===================== 提供者 =====================
  function sxProvList(pane){
    const ul=h('ul',{class:'sx-list'});
    for(const o of SX.data.provs)ul.append(h('li',null,h('button',{type:'button',class:'sx-item',onclick:()=>sxProvEdit(pane,o)},h('span',{class:'sx-item-t',text:o.n}),h('small',{text:'YouTube '+(o.yt||'？')+'・収益化 '+(o.mon||'？')+'・YouTube以外 '+(o.oth||'？')+(o.d?'　確認 '+o.d:'')}))));
    pane.append(sxNote('カラオケ音源の提供者（チャンネル）ごとの、使ってよい配信の記録です。音源で「提供者」を選ぶと、この可否で判定します。','studio-note'),
      h('div',{class:'studio-row'},sxBtn('＋ 提供者を足す',()=>sxProvEdit(pane,null),'accent')),ul)
  }
  function sxProvEdit(pane,rec){
    const tab='提供者',v=rec||{};
    pane.replaceChildren();
    const I={};
    I.n=sxInput(v.n,{max:120});I.url=sxInput(v.url,{type:'url',max:500,ph:'メンションの付かないチャンネルURLなど'});
    for(const k of ['yt','mon','oth'])I[k]=sxSelect(v[k]||(!rec?'未確認':''),sxOpts(tab,k));
    I.cr=sxInput(v.cr,{max:300});I.tu=sxInput(v.tu,{type:'url',max:500});I.d=sxInput(v.d,{max:20,ph:'2026/11/12'});
    I.memo=sxInput(v.memo,{area:true,max:5000,rows:3});I.raw=sxInput(v.raw,{area:true,max:45000,rows:4});I.y=sxInput(v.y,{max:120});
    let yt=!!rec;I.y.oninput=()=>{yt=true};I.n.oninput=()=>{if(!yt)I.y.value=sxYomi(I.n.value)};
    const say=h('p',{class:'studio-mini','aria-live':'polite'});
    const actions=h('div',{class:'studio-row'});
    actions.append(sxBtn('✓ 確かめる',()=>{
      const f={};for(const [k,el] of Object.entries(I))if(sxHas(tab,k))f[k]=el.value.trim();
      if(!f.n){sxSay(say,'提供者名を入れてください','err');return}
      if(SX.data.provs.some(o=>o!==rec&&o.n===f.n)){sxSay(say,'同じ名前の提供者がもういます','err');return}
      const lines=sxDiff(tab,rec,f);if(!lines.length){sxSay(say,'変わったところがありません');return}
      const extra=rec&&rec.n!==f.n?[sxNote('提供者名を変えるので、「音源」タブでこの提供者を選んでいる行も付け替えます。','sx-warn')]:[];
      sxConfirm(actions,lines,extra,async()=>{const r=await sxSave(tab,rec,f);toast(r.j.added?'提供者を足しました':'提供者を直しました',2500);pane.replaceChildren();sxProvList(pane)})
    },'accent'));
    pane.append(h('div',{class:'sx-head'},sxBtn('← 提供者の一覧へ',()=>{pane.replaceChildren();sxProvList(pane)}),h('b',{text:rec?'提供者を直す':'提供者を足す'})),
      h('div',{class:'studio-inline'},sxField('提供者名（チャンネル名）',I.n),sxField('読み（並べ替え用）',I.y)),
      sxField('概要欄に載せるURL',I.url),
      h('div',{class:'sx-3'},sxField('YouTube配信',I.yt),sxField('収益化した配信',I.mon),sxField('YouTube以外（IRIAM等）',I.oth)),
      h('div',{class:'studio-inline'},sxField('利用規約・説明のURL',I.tu),h('div',null,sxField('確認日',I.d),sxBtn('今日の日付',()=>{I.d.value=sxToday()}))),
      sxField('クレジット表記の指定',I.cr),sxField('メモ（要点）',I.memo),
      h('details',{class:'sx-more'},h('summary',null,'規約・説明の原文（転記）'),sxField('原文',I.raw,'規約のページの文章を、そのまま貼って残しておけます')),
      actions,say)
  }

  // ===================== ラベルの項目 =====================
  function sxLabelPane(pane){
    const L=sxLabels();
    pane.append(sxNote('ラベルは、曲を分けるための自分で作る項目です（歌枠ルーレットのしぼりこみにも使います）。アーティストと作品名（タイアップ）は、曲の欄にあるので、ラベルにしなくても探す欄・ルーレットで絞れます。曲ごとのキー（男性キーの音源・女性キーの音源）は、ラベルではなく音源の「キーの区分」に入れます。','studio-note'));
    if(!L||!sxHas('曲','g')){
      const picks=SX_SEED.map(x=>{const cb=h('input',{type:'checkbox'});cb.checked=true;return {x,cb}});
      const groups=[...new Set(SX_SEED.map(x=>x.group))];
      const grid=h('div',{class:'sx-pick'},...groups.map(gn=>h('fieldset',{class:'sx-group'},h('legend',{text:gn}),...picks.filter(p=>p.x.group===gn).map(p=>h('label',{class:'sx-check'},p.cb,(p.x.mark?p.x.mark+' ':'')+p.x.name)))));
      const say=h('p',{class:'studio-mini','aria-live':'polite'});
      const go=sxBtn('🏷 ラベルの準備をする',async()=>{
        go.disabled=true;sxSay(say,'準備しています…');
        try{const j=await sxCall('setup',{seed:picks.filter(p=>p.cb.checked).map(p=>p.x)});toast('ラベルの準備ができました',2500);await sxLoad(true);SX.view='labels';sxRender()}
        catch(e){sxSay(say,e.message,'err');go.disabled=false}
      },'accent');
      pane.append(sxNote('まだラベルの準備をしていません。準備すると、シートに「ラベル一覧」タブ（ラベルの名前・分類・記号）を作り、「曲」タブのいちばん右の空いている列に「ラベル」の列を足します。ほかの列は動かしません。'),
        sxNote('最初に入れておく候補です（チェックを外したものは入れません。あとで足す・名前を変える・並べ替える・消すことができます）。'),grid,h('div',{class:'studio-row'},go),say);
      return
    }
    const rows=L.map(x=>({was:x.name,name:x.name,group:x.group,mark:x.mark,memo:x.memo}));
    const dl=h('datalist',{id:'sxGroups'});
    const ul=h('ol',{class:'sx-labels'});
    const say=h('p',{class:'studio-mini','aria-live':'polite'});
    const draw=()=>{
      dl.replaceChildren(...[...new Set(rows.map(x=>x.group).filter(Boolean))].map(g=>h('option',{value:g})));
      ul.replaceChildren(...rows.map((x,i)=>{
        const mk=sxInput(x.mark,{max:4,ph:'記号'});mk.className='sx-mark';mk.setAttribute('aria-label','記号（絵文字1つなど・なくてもよい）');mk.oninput=()=>{x.mark=mk.value.trim()};
        const nm=sxInput(x.name,{max:40});nm.setAttribute('aria-label','ラベルの名前');nm.oninput=()=>{x.name=nm.value.trim()};
        const gr=sxInput(x.group,{max:40,list:'sxGroups',ph:'分類'});gr.setAttribute('aria-label','分類');gr.onchange=()=>{x.group=gr.value.trim();draw()};
        const used=x.was?SX.data.songs.filter(o=>tagSplit(o.g).includes(x.was)).length:0;
        return h('li',{class:'sx-lab'},mk,nm,gr,
          h('span',{class:'sx-lab-btns'},sxBtn('↑',()=>{if(i>0){[rows[i-1],rows[i]]=[rows[i],rows[i-1]];draw()}},'','上へ'),sxBtn('↓',()=>{if(i<rows.length-1){[rows[i+1],rows[i]]=[rows[i],rows[i+1]];draw()}},'','下へ'),
            sxBtn('🗑',e=>armed(e.currentTarget,'消す'+(used?'（'+used+'曲から外す）':''),()=>{rows.splice(i,1);draw()}),'','このラベルを消す')),
          h('small',{class:'sx-lab-used',text:x.was?(used?used+'曲':'まだ0曲'):'新しいラベル'}))
      }))
    };
    draw();
    const backup=h('input',{type:'checkbox'});backup.checked=true;
    pane.append(dl,sxNote('記号は、一覧で見分けるための絵文字などです（なくても使えます）。並びは、曲の編集でラベルを選ぶときの順番になります。分類が同じラベルは、まとめて表示します。'),ul,
      h('div',{class:'studio-row'},sxBtn('＋ ラベルを足す',()=>{rows.push({was:'',name:'',group:rows.at(-1)?.group||'',mark:'',memo:''});draw();ul.lastElementChild?.querySelectorAll('input')[1]?.focus()})),
      h('div',{class:'studio-row sx-labgo'},sxBtn('✓ 確かめる',()=>{
        const names=rows.map(x=>x.name);
        if(names.some(n=>!n)){sxSay(say,'名前が空のラベルがあります（要らないものは 🗑 で消せます）','err');return}
        const bad=names.find(n=>/[、,，\/／]/.test(n));if(bad){sxSay(say,'ラベル「'+bad+'」に「、」「,」「/」は使えません（区切りの記号なので）','err');return}
        const dup=names.find((n,i)=>names.indexOf(n)!==i);if(dup){sxSay(say,'ラベル「'+dup+'」が2つあります','err');return}
        const lines=[];
        const keep=new Set(rows.filter(x=>x.was).map(x=>x.was));
        for(const x of rows){if(!x.was)lines.push({label:'足す',from:'',to:x.name});else if(x.was!==x.name)lines.push({label:'名前を変える',from:x.was,to:x.name+'（'+SX.data.songs.filter(o=>tagSplit(o.g).includes(x.was)).length+'曲のラベルも変わります）'})}
        for(const x of L)if(!keep.has(x.name))lines.push({label:'消す',from:x.name,to:SX.data.songs.filter(o=>tagSplit(o.g).includes(x.name)).length+'曲から外れます'});
        const old=L.map(x=>[x.name,x.group,x.mark].join('\t')).join('\n'),now=rows.map(x=>[x.was,x.group,x.mark].join('\t')).join('\n');
        if(!lines.length&&old===now&&L.length===rows.length){sxSay(say,'変わったところがありません');return}
        if(old!==now&&!lines.some(x=>x.label!=='足す'))lines.push({label:'並び・分類・記号',from:'',to:'変えたとおりにします'});
        sxSay(say,'');
        const risky=lines.some(x=>x.label==='消す'||x.label==='名前を変える');
        backup.checked=risky;
        sxConfirm(pane.querySelector('.sx-labgo'),lines,[h('label',{class:'sx-check'},backup,'書き込む前に、控えを取る（「曲」「音源」「提供者」「ラベル一覧」タブを、シートの中に写して隠しておく）')],async s2=>{
          if(backup.checked){sxSay(s2,'控えを取っています…');await sxCall('backup',{why:'ラベルを変える前'})}
          sxSay(s2,'書き込んでいます…');
          let j;
          try{j=await sxCall('labels',{base:L.map(x=>x.name),list:rows})}catch(e){if(/変わっています/.test(e.message))e.conflict=true;throw e}
          toast('ラベルを書き込みました'+(j.songs?'（曲 '+j.songs+'曲のラベルも直しました）':''),3500);
          await sxLoad(true);
          const ren={},gone=new Set(L.map(x=>x.name));for(const x of rows)if(x.was){gone.delete(x.was);if(x.was!==x.name)ren[x.was]=x.name}
          if(Object.keys(ren).length||gone.size){for(const s of repList())if(s.tag){const g=tagNorm(tagSplit(s.tag).filter(t=>!gone.has(t)).map(t=>ren[t]||t).join('、'));if(g)s.tag=g;else delete s.tag}saveNow();renderRep()}
        })
      },'accent')),say)
  }

  // ===================== 変更の記録 =====================
  async function sxHistPane(pane){
    const say=h('p',{class:'studio-mini','aria-live':'polite',text:'読んでいます…'});
    const bk=h('p',{class:'studio-mini','aria-live':'polite'});
    pane.append(sxNote('オトノハから直した項目の、前と後の値です（シートの「編集の記録」タブ）。直したすぐあとなら「前の値に戻す」で戻せます。シートを直接さわった変更は、ここには出ません（Google スプレッドシートの「ファイル」→「変更履歴」で見られます）。','studio-note'),
      h('div',{class:'studio-row'},sxBtn('🗂 いま控えを取る',async e=>{const b=e.currentTarget;b.disabled=true;sxSay(bk,'控えを取っています…');try{const j=await sxCall('backup',{why:'手で取った控え'});sxSay(bk,'控えを取りました：'+j.made.join('、')+'（シートで隠してあります。表示するときは、シートの下のタブの一覧から選びます）')}catch(err){sxSay(bk,err.message,'err')}b.disabled=false})),bk,say);
    let j;
    try{j=await sxCall('history',{n:200})}catch(e){sxSay(say,e.message,'err');return}
    if(!j.rows.length){sxSay(say,'まだ記録はありません');return}
    sxSay(say,'');
    const groups=[];
    for(const r of j.rows){const key=r.at+'\n'+r.tab+'\n'+r.id+'\n'+r.act;let g=groups.at(-1);if(!g||g.key!==key)groups.push(g={key,at:r.at,tab:r.tab,id:r.id,act:r.act,rows:[]});g.rows.push(r)}
    const ul=h('ul',{class:'sx-hist'});
    for(const g of groups.slice(0,60)){
      const li=h('li',null,h('div',{class:'sx-hist-h'},h('b',{text:g.act}),h('span',{text:g.tab+(g.id?'：'+g.id:'')}),h('small',{text:g.at})));
      const dl=h('ul',{class:'sx-diff'});
      for(const r of g.rows)dl.append(h('li',null,h('b',{text:r.field}),r.before!==''?h('span',{class:'sx-from',text:r.before.length>60?r.before.slice(0,60)+'…':r.before}):null,r.before!==''||r.after!==''?h('span',{class:'sx-arrow','aria-hidden':'true',text:'→'}):null,h('span',{class:'sx-to',text:(r.after.length>60?r.after.slice(0,60)+'…':r.after)+(r.memo?'　'+r.memo:'')})));
      li.append(dl);
      if(g.act==='直した'&&SX_ARR[g.tab]&&g.rows.every(r=>r.k)){
        const s2=h('p',{class:'studio-mini','aria-live':'polite'});
        const undoRow=h('div',{class:'studio-row'});
        li.append(undoRow,s2);
        undoRow.append(sxBtn('↩ 前の値に戻す',()=>{
          const rec=SX.data[SX_ARR[g.tab]].find(o=>sxId(g.tab,o)===g.id);
          if(!rec){sxSay(s2,'この行がシートに見つかりません（そのあとに名前を変えたか、行を消したかもしれません）','err');return}
          const later=g.rows.filter(r=>(rec[r.k]||'')!==r.after);
          if(later.length){sxSay(s2,'そのあとにも「'+later.map(r=>r.field).join('」「')+'」が変わっているので、ここからは戻せません。曲・音源の画面で直してください','err');return}
          const f={};for(const r of g.rows)f[r.k]=r.before;
          sxConfirm(undoRow,sxDiff(g.tab,rec,f),[],async()=>{await sxSave(g.tab,rec,f);toast('前の値に戻しました',2500);pane.replaceChildren();sxHistPane(pane)})
        }))
      }
      ul.append(li)
    }
    pane.append(ul)
  }

  // ---- 開く
  SX.box.addEventListener('toggle',()=>{if(SX.box.open){if(!SX.data&&sheetLink())sxLoad();else sxRender()}});
  // 曲リストの「📝」から：その曲をシートで開く（シートにない曲なら、新しい曲として名前を入れておく）
  async function sxOpenSong(s){
    SX.box.open=true;SX.view='songs';
    if(!SX.data)await sxLoad();
    if(!SX.data)return;
    sxRender();
    const pane=SX.body.querySelector('.sx-pane');if(!pane)return;
    const rec=SX.data.songs.find(o=>s.sk&&songSk(o)===s.sk)||SX.data.songs.find(o=>songKey(o.t,o.a)===songKey(s.title,s.artist));
    sxSongEdit(pane,rec||null,rec?null:{t:s.title,a:s.artist,w:s.w||'',g:s.tag||''});
    SX.box.scrollIntoView({block:'start',behavior:'smooth'})
  }

  // ===================== 曲リスト（③）とシートをそろえる =====================
  // ③ 曲リストで足した・直した曲、音源、ラベルを、シートへ書き込む。
  // ・まとめて：曲リスト全体とシートを比べ、シートにないものを足す（シートにある値は消さない。ラベルは両方を合わせる）
  // ・その場で：曲リストの「編集」「曲リストに登録」のあと、直したところだけをシートへ（前の値と比べて、足したラベル・外したラベルを、シートのいまの値に当てる）
  const SX_AUTO_LS='otonoha-sheet-autopush';
  const sxAutoOn=()=>{try{return localStorage.getItem(SX_AUTO_LS)!=='0'}catch(_){return true}};
  const sxVid=u=>{const m=String(u||'').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);return m?m[1]:String(u||'').replace(/[?&]si=[^&]*/,'').trim()};
  function sxSheetSongOf(s){
    const D=SX.data;
    return D.songs.find(o=>s.sk&&songSk(o)===s.sk)||D.songs.find(o=>songKey(o.t,o.a)===songKey(s.title,s.artist))||null
  }
  function sxSheetSrcOf(sk,x){
    const list=SX.data.srcs.filter(y=>y.s===sk);
    return (x.n&&list.find(y=>y.n===x.n))||(x.u&&list.find(y=>y.u&&sxVid(y.u)===sxVid(x.u)))||null
  }
  function sxSrcFields(sk,t,x){
    const u=x.u?okeNorm(x.u)||'':'';
    const f={s:sk,u,by:x.by||'',key:x.k||'',kk:x.kk||'原曲キー',kind:x.kind||(/youtube\.com|youtu\.be/.test(u)?'YouTube動画':''),f:x.f||'',lyr:x.ly||''};
    f.n=x.n||sxSrcName({t},f);
    return f
  }
  // 1曲ぶんの書き込みの計画。before＝直す前の曲リストの曲（新しい曲なら null）。all＝まとめて（両方を合わせる）
  function sxPlanSong(s,before,all){
    const items=[],rec=sxSheetSongOf(before&&!all?{...before,title:before.title,artist:before.artist}:s)||sxSheetSongOf(s);
    const tags=tagSplit(s.tag),sk0=rec?songSk(rec):(s.title+'／'+(s.artist||''));
    if(!rec){
      const f={t:s.title,a:s.artist||'',w:s.w||'',y:sxYomi(s.title),st:'下書き・要確認'};
      if(tags.length&&sxHas('曲','g'))f.g=tags.join('、');
      items.push({kind:'song',label:'曲を足す',text:s.title+(s.artist?' / '+s.artist:''),s,rec:null,f,on:true})
    }else{
      const f={};
      if(before&&!all){
        if(songKey(before.title,before.artist)!==songKey(s.title,s.artist)){f.t=s.title;f.a=s.artist||''}
        if((before.w||'')!==(s.w||''))f.w=s.w||'';
        if(sxHas('曲','g')){
          const b=tagSplit(before.tag),add=tags.filter(x=>!b.includes(x)),del=b.filter(x=>!tags.includes(x));
          if(add.length||del.length){const g=[...tagSplit(rec.g).filter(x=>!del.includes(x)),...add.filter(x=>!tagSplit(rec.g).includes(x))];f.g=g.join('、')}
        }
      }else{
        if(s.w&&!rec.w)f.w=s.w;
        if(sxHas('曲','g')){const g0=tagSplit(rec.g),add=tags.filter(x=>!g0.includes(x));if(add.length)f.g=[...g0,...add].join('、')}
      }
      for(const k of Object.keys(f))if((rec[k]||'')===(f[k]||''))delete f[k];
      if(Object.keys(f).length)items.push({kind:'song',label:'曲を直す',text:s.title+(s.artist?' / '+s.artist:'')+'：'+Object.keys(f).map(k=>SX_NAMES['曲'][k]+'「'+(f[k]||'空欄')+'」').join('、'),s,rec,f,on:true})
      if(all&&s.w&&rec.w&&s.w!==rec.w)items.push({kind:'song',label:'作品名がちがう',text:s.title+'：シート「'+rec.w+'」→ 曲リスト「'+s.w+'」にする',s,rec,f:{w:s.w},on:false})
    }
    const sk=(f=>f?f.t+'／'+f.a:sk0)(items.find(x=>x.kind==='song'&&x.f.t)?.f);
    const bsrcs=before&&!all?(before.srcs||[]):[];
    (s.srcs||[]).forEach((x,i)=>{
      if(!x.u&&!x.n)return;
      const prev=bsrcs.find(y=>(y.n&&y.n===x.n)||(y.u&&y.u===x.u))||(before&&!all?bsrcs[i]:null);
      const hit=rec?(sxSheetSrcOf(songSk(rec),x)||(prev&&sxSheetSrcOf(songSk(rec),prev))):null;
      if(!hit){items.push({kind:'src',label:'音源を足す',text:s.title+'：'+(x.n||x.by||x.u),s,x,sk,rec:null,on:true});return}
      if(before&&!all&&prev){
        const f={};
        if(x.u&&prev.u!==x.u&&sxVid(hit.u)!==sxVid(x.u))f.u=okeNorm(x.u)||'';
        if((prev.by||'')!==(x.by||'')&&(hit.by||'')!==(x.by||''))f.by=x.by||'';
        if((prev.n||'')!==(x.n||'')&&x.n&&hit.n!==x.n)f.n=x.n;
        if(Object.keys(f).length)items.push({kind:'srcset',label:'音源を直す',text:hit.n+'：'+Object.keys(f).map(k=>SX_NAMES['音源'][k]+'「'+f[k]+'」').join('、'),s,x,rec:hit,f,on:true})
      }
    });
    return items
  }
  // 足すラベル・提供者（ラベル一覧・提供者タブにない名前）
  function sxPlanExtras(items){
    const L=sxLabels(),out=[];
    if(L){
      const have=new Set(L.map(x=>x.name)),need=new Set();
      for(const it of items)if(it.kind==='song'&&it.f.g)for(const g of tagSplit(it.f.g))if(!have.has(g))need.add(g);
      if(need.size)out.push({kind:'labels',label:'ラベル一覧に足す',text:[...need].join('、')+'（分類は「未分類」。あとで「🏷 ラベルの項目」で直せます）',names:[...need],on:true})
    }
    const pv=new Set(SX.data.provs.map(x=>x.n)),needP=new Set();
    for(const it of items){const by=it.kind==='src'?it.x.by:it.kind==='srcset'?it.f.by:'';if(by&&!pv.has(by))needP.add(by)}
    for(const n of needP)out.push({kind:'prov',label:'提供者を足す',text:n+'（名前だけ。使ってよい配信は「未確認」）',name:n,on:true});
    return out
  }
  async function sxRun(items,prog,stop){
    const done={ok:0,ng:[]};let i=0;
    const order=['labels','prov','song','src','srcset'];
    items=items.filter(x=>x.on).sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
    for(const it of items){
      if(stop&&stop.v)break;
      prog&&prog(++i,items.length,it);
      try{
        if(it.kind==='labels'){
          const L=sxLabels();
          const j=await sxCall('labels',{base:L.map(x=>x.name),list:[...L.map(x=>({was:x.name,name:x.name,group:x.group,mark:x.mark,memo:x.memo})),...it.names.map(n=>({was:'',name:n,group:'未分類',mark:'',memo:''}))]});
          SX.data.labels=j.labels
        }else if(it.kind==='prov')await sxSave('提供者',null,{n:it.name,yt:'未確認',mon:'未確認',oth:'未確認',y:sxYomi(it.name)});
        else if(it.kind==='song'){
          const rec=it.rec?SX.data.songs.find(o=>o===it.rec)||sxSheetSongOf(it.s):null;
          if(!it.rec&&sxSheetSongOf(it.s)){done.ok++;continue}
          const r=await sxSave('曲',rec,it.f);
          it.s.sk=songSk(r.rec)
        }else if(it.kind==='src'){
          const sk=it.s.sk||it.sk,song=SX.data.songs.find(o=>songSk(o)===sk);
          if(!song)throw Error('シートに曲「'+it.s.title+'」がないので、音源を足せません');
          if(sxSheetSrcOf(sk,it.x)){done.ok++;continue}
          await sxSave('音源',null,sxSrcFields(sk,song.t,it.x))
        }else if(it.kind==='srcset')await sxSave('音源',it.rec,it.f);
        done.ok++
      }catch(e){if(e.conflict)done.conflict=true;done.ng.push(it.text+'：'+e.message)}
    }
    saveNow();renderRep();
    return done
  }
  // 曲リストの「編集」「曲リストに登録」のあと（11-songbook.js から呼ぶ）。before＝直す前の写し（新しい曲は null）
  let sxQ=Promise.resolve();
  function sxAutoPush(s,before){
    if(!s||!sheetLink()||!sxAutoOn())return;
    sxQ=sxQ.then(async()=>{
      try{
        // ほかの端末やシートで直したあとかもしれないので、書く前にシートを読み直す
        await sxFetch();
        let items=sxPlanSong(s,before,false);
        if(!items.length)return;
        items=[...sxPlanExtras(items),...items];
        let r=await sxRun(items);
        if(r.conflict){await sxFetch();items=sxPlanSong(s,before,false);items=[...sxPlanExtras(items),...items];const r2=await sxRun(items);r={ok:r.ok+r2.ok,ng:r2.ng}}
        if(r.ng.length)toast('曲リストは保存しました。シートへの書き込みで、うまくいかなかったところがあります：'+r.ng[0]+(r.ng.length>1?'　ほか'+(r.ng.length-1)+'件':''),9000);
        else toast('シートにも書き込みました（'+r.ok+'件）',2500);
        if(SX.box.open&&SX.view!=='sync')sxRender()
      }catch(e){toast('曲リストは保存しました。シートには書き込めませんでした：'+e.message+'（「📝 歌枠管理シート」の「🔄 曲リストとそろえる」から、あとでまとめて送れます）',9000)}
    })
  }
  function sxSyncPane(pane){
    const auto=h('input',{type:'checkbox'});auto.checked=sxAutoOn();
    auto.onchange=()=>{try{localStorage.setItem(SX_AUTO_LS,auto.checked?'1':'0')}catch(_){}};
    const say=h('p',{class:'studio-mini','aria-live':'polite'});
    const box=h('div');
    pane.append(sxNote('③ 曲リストで足した曲・音源・ラベルを、歌枠管理シートへ書き込みます。シートにある値は消しません（ラベルは、シートと曲リストの両方を合わせます）。','studio-note'),
      h('label',{class:'sx-check'},auto,'曲リストの「編集」「曲リストに登録」で保存したら、シートにもすぐ書き込む（この端末の設定）'),
      h('div',{class:'studio-row'},sxBtn('曲リストとシートを比べる',()=>draw(),'accent')),say,box);
    const draw=async()=>{
      box.replaceChildren();
      sxSay(say,'シートを読み直しています…');
      try{await sxFetch()}catch(e){sxSay(say,e.message,'err');return}
      let items=[];
      for(const s of repList())items.push(...sxPlanSong(s,null,true));
      items=[...sxPlanExtras(items),...items];
      if(!items.length){sxSay(say,'曲リストとシートは、そろっています（シートにない曲・音源・ラベルはありません）');return}
      const groups={};for(const it of items)(groups[it.label]=groups[it.label]||[]).push(it);
      const n=()=>items.filter(x=>x.on).length;
      const go=sxBtn('',null,'accent');const upd=()=>{go.textContent='📝 シートに書き込む（'+n()+'件）';go.disabled=!n()};
      for(const [label,list] of Object.entries(groups)){
        const all=h('input',{type:'checkbox'});all.checked=list.every(x=>x.on);
        const det=h('details',{class:'sx-more',open:list.length<=12},h('summary',null,h('label',{class:'sx-check',onclick:e=>e.stopPropagation()},all,label+'（'+list.length+'件）')));
        const cbs=list.map(it=>{const cb=h('input',{type:'checkbox'});cb.checked=it.on;cb.onchange=()=>{it.on=cb.checked;all.checked=list.every(x=>x.on);upd()};det.append(h('label',{class:'sx-check'},cb,it.text));return cb});
        all.onchange=()=>{for(const [i,it] of list.entries()){it.on=all.checked;cbs[i].checked=all.checked}upd()};
        box.append(det)
      }
      const stop={v:false},prog=h('p',{class:'studio-mini','aria-live':'polite'});
      const stopBtn=sxBtn('止める',()=>{stop.v=true;stopBtn.disabled=true},null);stopBtn.hidden=true;
      go.onclick=async()=>{
        go.disabled=true;stopBtn.hidden=false;
        const r=await sxRun(items,(i,all,it)=>sxSay(prog,'書き込んでいます… '+i+' / '+all+'　'+it.text),stop);
        stopBtn.hidden=true;
        sxSay(prog,(stop.v?'途中で止めました。':'終わりました。')+'書き込んだ '+r.ok+'件'+(r.ng.length?'・うまくいかなかった '+r.ng.length+'件：'+r.ng.slice(0,5).join('　/　'):''),r.ng.length?'err':'');
        toast('シートへ書き込みました（'+r.ok+'件）',3000)
      };
      upd();
      sxSay(say,'シートにないもの・ちがうものが見つかりました。書き込まないものは、チェックを外せます。');
      box.append(h('div',{class:'studio-row'},go,stopBtn),prog)
    };
  }
