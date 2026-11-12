/* お題帳：AIに議題・架空のお悩み相談・ヤンデレラブレター・架空コメントなどを作ってもらい、
   一覧（台帳）にためて、配信画面に貼り出す。台帳の題は、次に頼むときの「既出」として添える。 */

  const TOPIC_ST={cand:'候補',adopt:'採用・準備中',rec:'収録済み・未公開',pub:'公開済み',hold:'保留',rej:'不採用',used:'使った'};
  const TOPIC_PRESETS={
    talk:{name:'番組の議題',fields:['タイトル','ジャンル','問いの型','概要','トークの切り口','笑い・意外性','例を考える材料','関連論点','検索入口'],head:0,body:3,who:-1,mode:'card',label:'きょうの議題',count:7,autoUse:false,
      instr:'あなたはトーク番組の構成作家です。出演者が自由に語れる議題を考えてください。\n- 出演者の結論・感情・セリフ・オチは書かない。\n- 日常・言葉・対人・創作・文化・もしもの仮定などに偏らず、問い方も分散する。\n- 下の「既出」と、タイトルを言い換えただけの重複をしない。題材が近い場合は、中心の問いがどう違うかを「概要」に書く。\n- 検索数や流行を、調べずに断定しない。「検索入口」には想定される検索の言い回しを書き、実測値ではないことがわかる書き方にする。'},
    consult:{name:'架空のお悩み相談',fields:['相談の見出し','相談者（架空の名前）','相談文'],head:0,body:2,who:1,mode:'card',label:'お悩み相談（架空）',count:10,autoUse:false,
      instr:'配信で読み上げる、架空のお悩み相談を作ってください。\n- すべて架空です。実在の人物や、実際に届いた投稿のように見せない。\n- 日常の困り事や対人関係など、多くの人が自分ごととして読める悩みにする。\n- 医療・法律など専門家の判断が要る深刻な内容や、命に関わる内容は避ける。\n- 相談文は1件120〜250字くらい。相談者の名前・年代・口調を毎回変える。'},
    letter:{name:'ヤンデレラブレター',fields:['題','差出人（架空）','本文'],head:0,body:2,who:1,mode:'card',label:'ヤンデレラブレター（架空）',count:10,autoUse:false,
      instr:'配信で読み上げる、架空のヤンデレのラブレターを作ってください。\n- 差出人は架空の人物。実在の人物を思わせない。\n- 執着や独占欲は、怖さとユーモアの両方が感じられる程度にする。暴力・自傷・犯罪の具体的な描写は書かない。\n- 1通150〜300字くらい。差出人ごとに、執着の向き・口調・小道具を変える。'},
    gachi:{name:'架空コメント100本ノック（ガチ恋）',fields:['名前（架空）','コメント'],head:1,body:-1,who:0,mode:'comment',label:'架空コメント',count:50,autoUse:true,
      instr:'配信のコメント欄に流す、架空のガチ恋コメントを作ってください。\n- すべて架空の視聴者。実在の人物や、実際のコメントのように見せない。\n- 配信者が笑って返せる熱量にする。住所などの個人情報・脅し・性的な表現は書かない。\n- 1件40字以内。名前・言い回し・熱量の種類を毎回変える。'},
    chuuni:{name:'架空コメント100本ノック（厨二病）',fields:['名前（架空）','コメント'],head:1,body:-1,who:0,mode:'comment',label:'架空コメント',count:50,autoUse:true,
      instr:'配信のコメント欄に流す、厨二病の視聴者になりきった架空のコメントを作ってください。\n- すべて架空の視聴者。実在の人物や、実際のコメントのように見せない。\n- 大げさな言い回し・設定・二つ名で笑える内容にする。人を傷つける表現は書かない。\n- 1件40字以内。名前・設定・言い回しを毎回変える。'},
    // 歌枠ルーレット：曲リスト（歌枠ノート）の曲を取り込み、まだ出していない曲からくじ引きで出す。項目の並び（曲名・アーティスト・作品・ラベル・メモ）は取り込みで使うので固定
    song:{name:'歌枠ルーレット',fields:['曲名','アーティスト','作品','ラベル','メモ'],head:0,body:2,who:1,mode:'card',label:'つぎの曲は…',count:10,autoUse:true,rand:true,instr:''},
    free:{name:'自由なお題',fields:['お題','説明'],head:0,body:1,who:-1,mode:'card',label:'お題',count:10,autoUse:false,instr:''}
  };
  const topicCfg=()=>state.topics||(state.topics={decks:[],sel:''});
  const tid=()=>Math.random().toString(36).slice(2,10);
  function topicDeck(){const t=topicCfg();return t.decks.find(d=>d.id===t.sel)||t.decks[0]||null}
  function topicNew(key){
    const P=TOPIC_PRESETS[key]||TOPIC_PRESETS.free,t=topicCfg();
    if(t.decks.length>=30){toast('お題帳は30冊までです');return null}
    const d={id:tid(),preset:key,name:P.name,instr:P.instr,theme:'',count:P.count,fields:P.fields.slice(),head:P.head,body:P.body,who:P.who,mode:P.mode,label:P.label,autoUse:P.autoUse,rand:!!P.rand,pick:'',items:[],cur:''};
    t.decks.push(d);t.sel=d.id;return d
  }
  const tHead=(d,it)=>String(it.f[d.fields[d.head]]||'').trim();
  const tField=(d,it,i)=>i>=0&&i<d.fields.length?String(it.f[d.fields[i]]||'').trim():'';
  function topicCur(d=topicDeck()){return d?d.items.find(x=>x.id===d.cur)||null:null}

  // ---- AIへの依頼文：指示・テーマ・数・返答の形・既出の題
  function topicPrompt(d){
    const ex=d.items.slice(-300).reverse().map(it=>'・'+tHead(d,it).slice(0,80)+'（'+TOPIC_ST[it.st]+'）');
    const sample={};for(const f of d.fields)sample[f]='…';
    return [
      d.instr.trim(),
      d.theme.trim()?'【テーマ・方向】\n'+d.theme.trim():'',
      '【お願い】\n'+d.count+'件作ってください。',
      '【返答の形】\n次の形のJSONだけを返してください。前置き・説明・コードブロックの記号は付けないでください。項目の名前は一字も変えないでください。1つの項目に複数の内容があるときは、文字列の配列にしてください。\n'+JSON.stringify({items:[sample]}),
      '【既出（重ねないでください）】\n'+(ex.length?ex.join('\n'):'（まだありません）')
    ].filter(Boolean).join('\n\n')
  }
  function topicParse(d,text){
    let s=String(text).trim().replace(/^```[a-z]*\s*/i,'').replace(/```\s*$/,'').trim();
    const a=s.indexOf('{'),b=s.lastIndexOf('}');
    if(a<0||b<a)throw Error('JSON（{"items":[...]} の形）が見つかりません');
    let j;try{j=JSON.parse(s.slice(a,b+1))}catch(_){throw Error('JSONを読めませんでした（途中で切れていないかご確認ください）')}
    const arr=Array.isArray(j?.items)?j.items:Array.isArray(j)?j:null;
    if(!arr)throw Error('items がありません');
    const have=new Set(d.items.map(it=>serifNorm(tHead(d,it)))),out=[];let dup=0,empty=0;
    for(const o of arr.slice(0,500)){
      if(!o||typeof o!=='object'){empty++;continue}
      const f={};
      for(const k of d.fields){const v=o[k];f[k]=(Array.isArray(v)?v.map(x=>String(x??'').trim()).filter(Boolean).join('\n'):String(v??'').trim()).slice(0,2000)}
      const h=String(f[d.fields[d.head]]||'');
      if(!h){empty++;continue}
      const n=serifNorm(h);if(have.has(n)){dup++;continue}
      have.add(n);out.push({id:tid(),f,st:'cand',at:new Date().toISOString()})
    }
    return {items:out,dup,empty}
  }

  // ---- 配信画面に出す／手元に出す
  function topicShow(d,it){
    if(!d||!it)return;
    d.cur=it.id;
    if(d.mode==='comment'){
      audShow([{name:tField(d,it,d.who)||d.label,text:tHead(d,it).slice(0,140),icon:'💬',color:'#f4c6d6',force:true}],'topic')
    }else{
      play.topic={deck:d.id,item:it.id,at:performance.now()};
      // くじ引きの冊：はじめの1秒ほど、ほかの題をぱらぱら見せてから止める
      if(d.rand&&d.items.length>1){const pool=d.items.filter(x=>x!==it).map(x=>tHead(d,x)).filter(Boolean),spin=[];for(let i=0;i<10&&pool.length;i++)spin.push(pool[playRnd(pool.length)]);play.topic.spin=spin}
    }
    if((d.autoUse||d.rand)&&(it.st==='cand'||(d.rand&&it.st==='adopt')))it.st='used';
    save();renderTopics();renderTopicHand()
  }
  function topicNext(d=topicDeck(),dir=1,show=true){
    if(!d||!d.items.length)return;
    const list=d.items.filter(it=>it.st!=='rej');
    if(!list.length)return;
    if(d.rand&&dir>0){
      // くじ引き：まだ出していないもの（しぼりこみに合うもの）から1つ。出したものは、手元だけに出したときも「使った」にする
      const pool=list.filter(it=>(it.st==='cand'||it.st==='adopt')&&topicPickOk(d,it));
      if(!pool.length){toast(d.pick?'このしぼりこみで出せるものは、もうありません（「↺ リセット」で戻せます）':'出せるものは、もうありません（「↺ リセット」で戻せます）',5000);return}
      const it=pool[playRnd(pool.length)];
      if(show)topicShow(d,it);else{d.cur=it.id;it.st='used';save();renderTopics();renderTopicHand()}
      return
    }
    let i=list.findIndex(it=>it.id===d.cur);
    // 次へ：まだ使っていない（候補・採用）ものを優先して、並び順に進む
    if(dir>0){
      const rest=list.slice(i+1).concat(list.slice(0,i+1)).filter(it=>it.st==='cand'||it.st==='adopt');
      const it=rest[0]||list[(i+1)%list.length];
      if(show)topicShow(d,it);else{d.cur=it.id;save();renderTopicHand()}
    }else{
      const it=list[(i-1+list.length)%list.length];
      if(show)topicShow(d,it);else{d.cur=it.id;save();renderTopicHand()}
    }
  }
  // ---- くじ引きの冊：しぼりこみ（作品・ラベル）、リセット、曲リストからの取り込み
  const topicTags=v=>[...new Set(String(v||'').split(/[、,，\/／\n]/).map(x=>x.trim()).filter(Boolean))];
  function topicPickOk(d,it){
    const p=d.pick||'';if(!p)return true;
    const F=d.fields,v=p.slice(2);
    return p.startsWith('w:')?String(it.f[F[2]]||'').trim()===v:p.startsWith('t:')?topicTags(it.f[F[3]]).includes(v):true
  }
  function topicPickOptions(d){
    const F=d.fields,w=new Map(),t=new Map(),open=it=>it.st==='cand'||it.st==='adopt';
    for(const it of d.items){if(it.st==='rej')continue;
      const a=String(it.f[F[2]]||'').trim();if(a){const c=w.get(a)||[0,0];c[0]++;if(open(it))c[1]++;w.set(a,c)}
      for(const x of topicTags(it.f[F[3]])){const c=t.get(x)||[0,0];c[0]++;if(open(it))c[1]++;t.set(x,c)}}
    const all=d.items.filter(it=>it.st!=='rej'),srt=m=>[...m].sort((x,y)=>x[0].localeCompare(y[0],'ja'));
    return [['','すべて（残り '+all.filter(open).length+' / '+all.length+'）'],...srt(t).map(([k,c])=>['t:'+k,'ラベル：'+k+'（残り '+c[1]+' / '+c[0]+'）']),...srt(w).map(([k,c])=>['w:'+k,'作品：'+k+'（残り '+c[1]+' / '+c[0]+'）'])]
  }
  function topicPickFill(sel,d){
    const opts=topicPickOptions(d),sig=JSON.stringify(opts);
    if(sel.dataset.sig!==sig){sel.dataset.sig=sig;sel.replaceChildren(...opts.map(([v,tx])=>Object.assign(document.createElement('option'),{value:v,textContent:tx})))}
    if(d.pick&&!opts.some(o=>o[0]===d.pick)){d.pick=''}
    sel.value=d.pick||''
  }
  function topicReset(d){
    if(!d)return;
    let n=0;for(const it of d.items)if(it.st==='used'){it.st='cand';n++}
    d.cur='';if(play.topic?.deck===d.id)play.topic=null;
    save();renderTopics();toast(n+'件を、まだ出していない状態に戻しました',3500)
  }
  function topicSongSync(d){
    if(!d||d.fields.length<5){toast('この冊は項目が5つより少ないので、曲リストから取り込めません',5000);return}
    const F=d.fields,by=new Map(d.items.map(it=>[songKey(it.f[F[0]],it.f[F[1]]),it]));let add=0,upd=0,over=0;
    topicKeep();
    for(const r of repList()){
      const v=[r.title,r.artist||'',r.w||'',r.tag||'',r.memo||''],it=by.get(songKey(r.title,r.artist));
      if(it){let ch=false;for(let i=2;i<5;i++)if((it.f[F[i]]||'')!==v[i]){it.f[F[i]]=v[i];ch=true}if(ch)upd++;continue}
      if(d.items.length>=2000){over++;continue}
      const f={};F.forEach((k,i)=>{f[k]=i<5?v[i]:''});
      const n={id:tid(),f,st:'cand',at:new Date().toISOString()};d.items.push(n);by.set(songKey(r.title,r.artist),n);add++
    }
    save();renderTopics();
    toast(repList().length?'曲リストから、新しく '+add+'曲を入れました'+(upd?'・作品やラベルを '+upd+'曲で更新':'')+(over?'（1冊2000件までのため '+over+'曲は入りません）':''):'曲リストが空です。「🎤 歌枠ノート」で曲を登録するか、歌枠管理シートから読み込んでください',6000)
  }

  function drawTopic(k){
    const tp=play.topic;if(!tp)return;
    const d=topicCfg().decks.find(x=>x.id===tp.deck),it=d?.items.find(x=>x.id===tp.item);
    if(!d||!it){play.topic=null;return}
    let head=tHead(d,it),body=tField(d,it,d.body),who=tField(d,it,d.who);const label=d.label||d.name;
    if(tp.spin&&tp.spin.length){const el=performance.now()-tp.at;if(el<1100){head=tp.spin[Math.floor(el/110)%tp.spin.length];body='';who=''}else tp.spin=null}
    const acc=(typeof look!=='undefined'&&look.accent)||'#8a5a3b';
    const a=Math.min(1,(performance.now()-tp.at)/220),w=Math.min(W*.74,940*k),pad=30*k;
    const fsL=20*k,fsH=36*k,fsB=23*k,fsW=19*k;
    g.save();g.globalAlpha=a;
    g.font=sceneFontCss(fsH,head);const hl=wrapLines(head,w-pad*2,3);
    g.font=sceneFontCss(fsB,body);const bl=body?wrapLines(body,w-pad*2,7):[];
    const h=pad+fsL*1.9+hl.length*fsH*1.4+(who?fsW*1.6:0)+(bl.length?14*k+bl.length*fsB*1.55:0)+pad*.8;
    const x=(W-w)/2,y=Math.max(30*k,H*.08);
    playPlace('topic',x+w/2,y+h/2,w+12*k,h+12*k);
    g.fillStyle='rgba(0,0,0,.16)';g.beginPath();g.roundRect(x+5*k,y+7*k,w,h,24*k);g.fill();
    g.fillStyle='rgba(255,251,244,.97)';g.strokeStyle=acc;g.lineWidth=3*k;g.beginPath();g.roundRect(x,y,w,h,24*k);g.fill();g.stroke();
    g.textBaseline='top';g.textAlign='left';
    g.font=sceneFontCss(fsL,label);const lw=Math.min(w-pad*2,g.measureText(label).width+28*k);
    g.fillStyle=acc;g.beginPath();g.roundRect(x+pad,y+pad*.7,lw,fsL*1.5,fsL*.75);g.fill();
    g.fillStyle=lookInk(acc);g.fillText(label,x+pad+14*k,y+pad*.7+fsL*.25,lw-28*k);
    let yy=y+pad*.7+fsL*1.9;
    g.font=sceneFontCss(fsH,head);g.fillStyle='#2e211c';
    hl.forEach((l,i)=>g.fillText(l,x+pad,yy+i*fsH*1.4,w-pad*2));yy+=hl.length*fsH*1.4;
    if(who){g.font=sceneFontCss(fsW,who);g.fillStyle='#8a5a3b';g.fillText('— '+who,x+pad,yy+fsW*.3,w-pad*2);yy+=fsW*1.6}
    if(bl.length){yy+=14*k;g.font=sceneFontCss(fsB,body);g.fillStyle='#4a3a32';bl.forEach((l,i)=>g.fillText(l,x+pad,yy+i*fsB*1.55,w-pad*2))}
    g.restore()
  }

  // ---- 企画卓の画面
  let topicPlan=null;
  function renderTopics(){
    const t=topicCfg(),d=topicDeck();
    E('topicDeck').replaceChildren(...t.decks.map(x=>Object.assign(document.createElement('option'),{value:x.id,textContent:x.name+'（'+x.items.length+'）'})));
    if(d)E('topicDeck').value=d.id;
    E('topicBody').hidden=!d;
    if(!d){renderTopicHand();renderPon();return}
    E('topicBody').toggleAttribute('data-rand',!!d.rand);
    E('topicBody').toggleAttribute('data-song',d.preset==='song');
    E('topicRand').checked=!!d.rand;
    if(d.rand)topicPickFill(E('topicPick'),d);
    E('topicName').value=d.name;E('topicInstr').value=d.instr;E('topicTheme').value=d.theme;E('topicCount').value=d.count;
    E('topicFields').value=d.fields.join('、');E('topicLabel').value=d.label;E('topicMode').value=d.mode;E('topicAutoUse').checked=!!d.autoUse;
    for(const [id,k,none] of [['topicHead','head',false],['topicBodyF','body',true],['topicWho','who',true]]){
      E(id).replaceChildren(...[...(none?[[-1,'（出さない）']]:[]),...d.fields.map((f,i)=>[i,f])].map(([v,tx])=>Object.assign(document.createElement('option'),{value:String(v),textContent:tx})));
      E(id).value=String(d[k])
    }
    // 一覧
    const fs=E('topicFilter').value,q=serifNorm(E('topicFind').value||'');
    const list=d.items.filter(it=>(fs==='all'||(fs==='open'?it.st==='cand'||it.st==='adopt':it.st===fs))&&(!q||d.fields.some(f=>serifNorm(it.f[f]||'').includes(q))));
    const cnt={};for(const it of d.items)cnt[it.st]=(cnt[it.st]||0)+1;
    E('topicCountInfo').textContent='全'+d.items.length+'件　'+Object.entries(TOPIC_ST).filter(([k])=>cnt[k]).map(([k,v])=>v+' '+cnt[k]).join('・');
    E('topicList').replaceChildren(...list.slice(0,400).map(it=>topicRow(d,it)));
    if(list.length>400)E('topicList').append(Object.assign(document.createElement('li'),{className:'sb-empty',textContent:'ほか'+(list.length-400)+'件（絞り込みで探せます）'}));
    if(!d.items.length)E('topicList').append(Object.assign(document.createElement('li'),{className:'sb-empty',textContent:'まだありません。「AIに頼む文をコピー」から作るか、既出の題を貼り付けて登録できます'}));
    renderTopicHand();renderPon()
  }
  function topicRow(d,it){
    const li=document.createElement('li');li.className='topic-row'+(d.cur===it.id?' cur':'');
    const det=document.createElement('details');
    const sum=document.createElement('summary');sum.textContent=tHead(d,it)||'（見出しなし）';
    const box=document.createElement('div');box.className='topic-fields';
    det.ontoggle=()=>{if(det.open&&!box.childElementCount)for(const f of d.fields){const v=it.f[f];if(!v)continue;const p=document.createElement('p');const b=document.createElement('b');b.textContent=f+'：';p.append(b,document.createTextNode(v));box.append(p)}};
    det.append(sum,box);
    const sel=document.createElement('select');sel.setAttribute('aria-label','状態');
    sel.replaceChildren(...Object.entries(TOPIC_ST).map(([k,v])=>Object.assign(document.createElement('option'),{value:k,textContent:v})));sel.value=it.st;
    sel.onchange=()=>{it.st=sel.value;save();renderTopics()};
    const bt=(t,c,f)=>{const b=document.createElement('button');b.type='button';b.textContent=t;if(c)b.className=c;b.onclick=f;return b};
    const row=document.createElement('div');row.className='studio-row';
    row.append(sel,bt('📌 貼り出す','accent',()=>topicShow(d,it)),bt('手元に出す','',()=>{d.cur=it.id;save();renderTopics()}),bt('編集','',()=>topicEdit(d,it,li)),bt('削除','',e=>armed(e.currentTarget,'もう一度押すと削除',()=>{topicKeep();d.items=d.items.filter(x=>x!==it);if(d.cur===it.id)d.cur='';if(play.topic?.item===it.id)play.topic=null;save();renderTopics()})));
    li.append(det,row);return li
  }
  function topicEdit(d,it,li){
    if(li.querySelector('.topic-edit')){li.querySelector('.topic-edit').remove();return}
    const box=document.createElement('div');box.className='topic-edit';
    const tas=d.fields.map(f=>{const l=document.createElement('label');l.className='studio-field';const ta=document.createElement('textarea');ta.className='studio-textarea';ta.rows=f===d.fields[d.head]?2:3;ta.maxLength=2000;ta.value=it.f[f]||'';l.append(f,ta);box.append(l);return [f,ta]});
    const ok=document.createElement('button');ok.type='button';ok.className='accent';ok.textContent='保存';
    ok.onclick=()=>{for(const [f,ta] of tas)it.f[f]=ta.value.trim().slice(0,2000);if(!tHead(d,it)){toast('見出しの項目（'+d.fields[d.head]+'）は空にできません');return}save();renderTopics()};
    box.append(ok);li.append(box)
  }
  // 取り消し（このページを開いているあいだ、10回分）
  const topicUndo=[];
  function topicKeep(){const d=topicDeck();if(!d)return;topicUndo.push({id:d.id,items:JSON.stringify(d.items)});if(topicUndo.length>10)topicUndo.shift();E('topicUndo').disabled=false}
  E('topicUndo').onclick=()=>{const u=topicUndo.pop();if(!u)return;const d=topicCfg().decks.find(x=>x.id===u.id);if(d){d.items=JSON.parse(u.items);topicCfg().sel=d.id;save();renderTopics();toast('元に戻しました')}E('topicUndo').disabled=!topicUndo.length};

  // 手元カード（ステージ。配信画面には出ない）
  function renderTopicHand(){
    const d=topicDeck(),it=topicCur(d),box=E('topicHand');
    if(!box)return;
    // 「🎲 企画」に並べていない冊は、手元カードも出さない
    box.hidden=!d||!d.items.length||(ponCfg().hide||[]).includes('topic:'+d.id);
    if(box.hidden)return;
    box.toggleAttribute('data-rand',!!d.rand);
    E('topicHandNext').textContent=d.rand?'🎲 引く（手元だけ）':'次へ ▶';
    E('topicHandPrev').hidden=!!d.rand;
    E('topicHandRand').hidden=!d.rand;
    if(d.rand)topicPickFill(E('topicHandPick'),d);
    const open=d.items.filter(x=>x.st==='cand'||x.st==='adopt').length;
    E('topicHandTitle').textContent=d.name+'　未使用 '+open+' / 全 '+d.items.length;
    const body=E('topicHandBody');body.replaceChildren();
    if(!it){body.textContent=d.rand?'「🎲 引く」で、まだ出していないものから1つ出します。':'「次へ ▶」で、最初のお題を出します。';return}
    for(const f of d.fields){const v=it.f[f];if(!v)continue;const p=document.createElement('p');const b=document.createElement('b');b.textContent=f+'：';p.append(b,document.createTextNode(v));body.append(p)}
    if(d.rand){
      // 曲リストにある曲なら、音源を開くボタンと、セトリ・歌い始めのボタンを添える
      const F=d.fields,r=repFind(it.f[F[0]],it.f[F[1]]),row=document.createElement('div');row.className='studio-row topic-song-row';
      if(r)row.append(...okeButtons(r));
      row.append(rowBtn('セトリへ','',()=>{state.songs.push({title:it.f[F[0]],artist:it.f[F[1]]||''});save();renderSet();toast('セトリに追加しました')}),
        rowBtn('♪ 歌い始め','sb-sing',()=>sing(it.f[F[0]],it.f[F[1]]||''),'この曲を歌い始めた時刻を記録します'));
      if(!r)row.append(Object.assign(document.createElement('span'),{className:'studio-mini',textContent:'（曲リストに同じ曲が見つからないため、音源のボタンは出ません）'}));
      body.append(row)
    }
    E('topicHandSt').value=it.st;
    E('topicHandShow').textContent=d.mode==='comment'?'💬 コメント欄に流す':'📌 配信画面に貼り出す'
  }
  E('topicHandPrev').onclick=()=>topicNext(topicDeck(),-1,false);
  E('topicHandNext').onclick=()=>topicNext(topicDeck(),1,false);
  E('topicHandShow').onclick=()=>{const d=topicDeck(),it=topicCur(d);if(it)topicShow(d,it);else topicNext(d,1,true)};
  E('topicHandPick').onchange=e=>{const d=topicDeck();if(d){d.pick=e.target.value.slice(0,220);save();renderTopics()}};
  E('topicHandReset').onclick=e=>armed(e.currentTarget,'もう一度押すとリセット',()=>topicReset(topicDeck()));
  E('topicPick').onchange=e=>{const d=topicDeck();if(d){d.pick=e.target.value.slice(0,220);save();renderTopics()}};
  E('topicSongSync').onclick=()=>topicSongSync(topicDeck());
  E('topicSongReset').onclick=e=>armed(e.currentTarget,'もう一度押すとリセット',()=>topicReset(topicDeck()));
  E('topicRand').onchange=e=>{const d=topicDeck();if(d){d.rand=e.target.checked;save();renderTopics()}};
  E('topicHandHide').onclick=()=>{play.topic=null;renderPon()};
  E('topicHandSt').onchange=e=>{const it=topicCur();if(it){it.st=e.target.value;save();renderTopics()}};

  // 操作
  E('topicDeck').onchange=e=>{topicCfg().sel=e.target.value;save();renderTopics()};
  E('topicAdd').onclick=()=>{const d=topicNew(E('topicPreset').value);if(d){save();renderTopics();toast('「'+d.name+'」を作りました')}};
  E('topicDup').onclick=()=>{const d=topicDeck();if(!d)return;const t=topicCfg();if(t.decks.length>=30){toast('お題帳は30冊までです');return}const n=JSON.parse(JSON.stringify(d));n.id=tid();n.name=(d.name+'のコピー').slice(0,40);n.items=[];n.cur='';t.decks.push(n);t.sel=n.id;save();renderTopics();toast('設定だけを写した新しいお題帳を作りました')};
  E('topicDel').onclick=e=>armed(e.currentTarget,'もう一度押すと、このお題帳ごと削除',()=>{const t=topicCfg(),d=topicDeck();if(!d)return;t.decks=t.decks.filter(x=>x!==d);t.sel=t.decks[0]?.id||'';if(play.topic?.deck===d.id)play.topic=null;save();renderTopics()});
  E('topicName').oninput=e=>{const d=topicDeck();if(d){d.name=e.target.value.slice(0,40)||'お題帳';save()}};
  E('topicName').onchange=()=>renderTopics();
  E('topicInstr').oninput=e=>{const d=topicDeck();if(d){d.instr=e.target.value.slice(0,20000);save()}};
  E('topicTheme').oninput=e=>{const d=topicDeck();if(d){d.theme=e.target.value.slice(0,4000);save()}};
  E('topicCount').onchange=e=>{const d=topicDeck();if(d){d.count=Math.max(1,Math.min(100,Math.round(Number(e.target.value)||7)));e.target.value=d.count;save()}};
  E('topicLabel').oninput=e=>{const d=topicDeck();if(d){d.label=e.target.value.slice(0,40);save()}};
  E('topicMode').onchange=e=>{const d=topicDeck();if(d){d.mode=e.target.value==='comment'?'comment':'card';save();renderTopics()}};
  E('topicAutoUse').onchange=e=>{const d=topicDeck();if(d){d.autoUse=e.target.checked;save()}};
  for(const [id,k] of [['topicHead','head'],['topicBodyF','body'],['topicWho','who']])E(id).onchange=e=>{const d=topicDeck();if(d){d[k]=Number(e.target.value);save()}};
  E('topicFields').onchange=e=>{
    const d=topicDeck();if(!d)return;
    const f=[...new Set(e.target.value.split(/[、,，\n]/).map(x=>x.trim().slice(0,30)).filter(Boolean))].slice(0,12);
    if(!f.length){e.target.value=d.fields.join('、');return}
    // 名前が変わった項目の中身は、同じ位置の項目に引き継ぐ
    for(const it of d.items){const o={};f.forEach((k,i)=>{o[k]=it.f[k]??it.f[d.fields[i]]??''});it.f=o}
    d.fields=f;for(const k of ['head','body','who'])if(d[k]>=f.length)d[k]=k==='head'?0:-1;
    save();renderTopics()
  };
  E('topicPromptCopy').onclick=()=>{const d=topicDeck();if(!d)return;copy(topicPrompt(d));toast('依頼文をコピーしました（既出 '+Math.min(300,d.items.length)+'件を添えています）',4000)};
  E('topicPaste').oninput=()=>{topicPlan=null;E('topicPasteGo').disabled=true;E('topicPasteInfo').textContent=''};
  E('topicPasteCheck').onclick=()=>{
    const d=topicDeck();if(!d)return;
    try{const r=topicParse(d,E('topicPaste').value);topicPlan={d,r};
      E('topicPasteInfo').textContent='新しく '+r.items.length+'件'+(r.dup?'・既出と同じ見出し '+r.dup+'件は足しません':'')+(r.empty?'・見出しが空のもの '+r.empty+'件は足しません':'')+(r.items.length?'：'+r.items.slice(0,5).map(it=>'「'+tHead(d,it).slice(0,24)+'」').join('')+(r.items.length>5?'…':''):'');
      E('topicPasteGo').disabled=!r.items.length
    }catch(err){E('topicPasteInfo').textContent='読めませんでした：'+err.message}
  };
  E('topicPasteGo').onclick=()=>{
    if(!topicPlan||topicPlan.d!==topicDeck())return;
    const d=topicPlan.d,room=2000-d.items.length,add=topicPlan.r.items.slice(0,Math.max(0,room));
    const all=topicPlan.r.items.length;
    topicKeep();d.items.push(...add);topicPlan=null;E('topicPaste').value='';E('topicPasteGo').disabled=true;
    save();renderTopics();toast(add.length+'件を候補として足しました'+(add.length<all?'（1冊2000件までです）':''),4000)
  };
  E('topicPastGo').onclick=()=>{
    const d=topicDeck();if(!d)return;
    const st=E('topicPastSt').value,have=new Set(d.items.map(it=>serifNorm(tHead(d,it))));let n=0;
    topicKeep();
    for(const line of E('topicPast').value.split('\n')){
      const h=line.replace(/^\s*(?:[-・*]|\d+[.)．、])\s*/,'').trim().slice(0,2000);if(!h)continue;
      const k=serifNorm(h);if(have.has(k))continue;have.add(k);
      if(d.items.length>=2000)break;
      const f={};for(const x of d.fields)f[x]='';f[d.fields[d.head]]=h;
      d.items.push({id:tid(),f,st:TOPIC_ST[st]?st:'pub',at:new Date().toISOString()});n++
    }
    E('topicPast').value='';save();renderTopics();toast(n+'件を「'+TOPIC_ST[st]+'」として登録しました')
  };
  E('topicFilter').onchange=renderTopics;
  {let tm=0;E('topicFind').oninput=()=>{clearTimeout(tm);tm=setTimeout(renderTopics,200)}}
  E('topicCopyList').onclick=()=>{
    const d=topicDeck();if(!d)return;
    copy(['# '+d.name,...d.items.map((it,i)=>'\n## '+(i+1)+'. '+tHead(d,it)+'（'+TOPIC_ST[it.st]+'）\n'+d.fields.filter((f,j)=>j!==d.head&&it.f[f]).map(f=>'- '+f+'：'+it.f[f].replace(/\n/g,' ／ ')).join('\n'))].join('\n'));
    toast('一覧をコピーしました（Markdown）')
  };
  E('topicExport').onclick=()=>{
    const d=topicDeck();if(!d)return;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({kind:'otonoha-topics',version:1,deck:d},null,1)],{type:'application/json'}));
    a.download=(d.name||'お題帳').replace(/[\\/:*?"<>|]/g,'_')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)
  };
  E('topicImport').onclick=()=>E('topicFile').click();
  E('topicFile').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{
      if(f.size>16*1024*1024)throw Error('16MBまでです');
      const j=JSON.parse(await f.text());
      if(j?.kind!=='otonoha-topics'||!j.deck)throw Error('お題帳のファイルではありません');
      const clean=topicSanitize({decks:[j.deck],sel:''});
      if(!clean.decks.length)throw Error('読めるお題帳がありませんでした');
      const t=topicCfg();if(t.decks.length>=30)throw Error('お題帳は30冊までです');
      const d=clean.decks[0];d.id=tid();t.decks.push(d);t.sel=d.id;save();renderTopics();toast('「'+d.name+'」を読み込みました（'+d.items.length+'件）')
    }catch(err){toast('読み込めませんでした：'+err.message,5000)}
  };

  // 設定の点検（読み込み時にも使うので関数の中で完結させる）
  function topicSanitize(v){
    const ST=['cand','adopt','rec','pub','hold','rej','used'],out={decks:[],sel:''};
    if(!v||typeof v!=='object'||!Array.isArray(v.decks))return out;
    const S=(x,n)=>String(x??'').slice(0,n),ids=new Set();
    for(const d of v.decks.slice(0,30)){
      if(!d||typeof d!=='object')continue;
      const id=/^[a-z0-9]{1,16}$/.test(d.id)&&!ids.has(d.id)?d.id:Math.random().toString(36).slice(2,10);ids.add(id);
      const fields=[...new Set((Array.isArray(d.fields)?d.fields:[]).map(x=>S(x,30).trim()).filter(Boolean))].slice(0,12);
      if(!fields.length)continue;
      const idx=(x,none)=>{const n=Math.round(Number(x));return Number.isFinite(n)&&n>=(none?-1:0)&&n<fields.length?n:(none?-1:0)};
      const iids=new Set(),items=[];
      for(const it of (Array.isArray(d.items)?d.items:[]).slice(0,2000)){
        if(!it||typeof it!=='object'||!it.f||typeof it.f!=='object')continue;
        const iid=/^[a-z0-9]{1,16}$/.test(it.id)&&!iids.has(it.id)?it.id:Math.random().toString(36).slice(2,10);iids.add(iid);
        const f={};for(const k of fields)f[k]=S(it.f[k],2000);
        items.push({id:iid,f,st:ST.includes(it.st)?it.st:'cand',at:S(it.at,40)})
      }
      out.decks.push({id,preset:S(d.preset,20),name:S(d.name,40)||'お題帳',instr:S(d.instr,20000),theme:S(d.theme,4000),count:Math.max(1,Math.min(100,Math.round(Number(d.count))||7)),
        fields,head:idx(d.head,false),body:idx(d.body,true),who:idx(d.who,true),mode:d.mode==='comment'?'comment':'card',label:S(d.label,40),autoUse:!!d.autoUse,rand:d.rand===true,pick:S(d.pick,220),items,cur:typeof d.cur==='string'&&items.some(x=>x.id===d.cur)?d.cur:''})
    }
    out.sel=typeof v.sel==='string'&&out.decks.some(d=>d.id===v.sel)?v.sel:(out.decks[0]?.id||'');
    return out
  }
