/* セリフ帳のスロット：役柄（シチュエーション）×セリフを2段で抽選し、筐体の見た目で配信画面に出す（筋肉室スロットの仕組み） */

  const slotCfg=()=>state.slot||(state.slot={aName:'役柄',bName:'セリフ',dur:1,se:'',use:[],look:'machine'});
  let slotRoleBag=[],slotLineBags={},slotLog=[];
  // 抽選の対象：選んだシチュエーション（未選択なら、セリフのあるものすべて）
  function slotPool(){
    const use=slotCfg().use||[],all=serifList().filter(s=>serifLines(s).length);
    const pick=all.filter(s=>use.includes(s.id));
    return pick.length?pick:all
  }
  function slotShuffle(a){for(let i=a.length-1;i>0;i--){const j=playRnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
  function slotPickRole(pool){
    const ids=pool.map(s=>s.id);
    slotRoleBag=slotRoleBag.filter(id=>ids.includes(id));
    if(!slotRoleBag.length)slotRoleBag=slotShuffle([...ids]);
    const id=slotRoleBag.pop();
    return pool.find(s=>s.id===id)
  }
  function slotPickLine(s){
    const lines=serifLines(s);
    if(!slotLineBags[s.id]?.length||slotLineBags[s.id].some(i=>i>=lines.length))slotLineBags[s.id]=slotShuffle(lines.map((_,i)=>i));
    return lines[slotLineBags[s.id].pop()]
  }
  // what: 'all'（役柄→セリフ）, 'a'（役柄だけ引き直す）, 'b'（セリフだけ引き直す）
  function slotSpin(what){
    const pool=slotPool();
    if(!pool.length){toast('セリフのあるシチュエーションがありません');return}
    const cur=play.slot;
    if(cur&&!cur.done)return;
    let role=cur&&what==='b'?serifList().find(s=>s.id===cur.roleId)||null:null,line=cur&&what==='a'?cur.line:'';
    if(what!=='b'||!role)role=slotPickRole(pool);
    if(what!=='a'||!line)line=slotPickLine(role);
    play.serif=null;
    play.slot={what,roleId:role.id,role:role.title,line,names:pool.map(s=>s.title),lines:serifLines(role),at:performance.now(),dur:Math.max(0,Math.min(10,Number(slotCfg().dur)||0))*1000,done:false};
    // 配信画面を描いていないとき（企画卓を見ているとき・別タブのとき）も、時間が来たら結果を確定する
    const me=play.slot;setTimeout(()=>{if(play.slot===me&&!me.done)slotDone()},me.dur+30);
    renderSlot()
  }
  function slotDone(){
    const s=play.slot;
    s.done=true;
    slotLog.unshift({role:s.role,line:s.line});slotLog.length=Math.min(slotLog.length,200);
    const se=slotCfg().se&&(typeof cfg!=='undefined'?cfg.sounds:[]).find(x=>x.id===slotCfg().se&&x.assetId);
    if(se)playSound(se);
    bridgeEmit('serif',{text:s.line,title:s.role,slot:true});
    audEvent(slotCfg().aName+'「'+s.role+'」×'+slotCfg().bName+'「'+s.line.slice(0,40)+'」');
    renderSlot()
  }
  function renderSlot(){
    const c=slotCfg(),s=play.slot;
    E('slotAName').value=c.aName;E('slotBName').value=c.bName;E('slotDur').value=String(c.dur);E('slotLook').value=c.look;
    E('slotPos').value=c.pos||'center';E('slotSize').value=c.size||62;E('slotSizeVal').textContent=(c.size||62)+'%';E('slotColor').value=c.color||'classic';
    {const cs=slotBase();E('slotColors').hidden=(c.color||'classic')!=='custom';for(let i=0;i<5;i++)E('slotC'+i).value=cs[i]}
    E('slotSpin').textContent='🎰 抽選開始（'+c.aName+'×'+c.bName+'）';E('slotRe').textContent=c.aName+'だけ引き直す';E('slotRb').textContent=c.bName+'だけ引き直す';
    const ses=(typeof cfg!=='undefined'?cfg.sounds:[]).filter(x=>x.assetId&&(x.type==='emoji'||x.type==='text'));
    E('slotSe').replaceChildren(new Option('鳴らさない',''),...ses.map(x=>new Option((x.label||x.fileName||'効果音').slice(0,30),x.id)));
    E('slotSe').value=ses.some(x=>x.id===c.se)?c.se:'';
    const box=E('slotUse'),use=c.use||[],q=serifNorm(E('slotFind').value||'');
    box.replaceChildren(...serifList().filter(x=>serifLines(x).length&&(!q||use.includes(x.id)||serifNorm(x.title).includes(q)||serifLines(x).some(l=>serifNorm(l).includes(q)))).map(x=>{
      const b=document.createElement('button');b.type='button';b.textContent=x.title+'（'+serifLines(x).length+'）';
      b.className=use.includes(x.id)?'selected':'';b.setAttribute('aria-pressed',use.includes(x.id));
      b.onclick=()=>{c.use=use.includes(x.id)?use.filter(i=>i!==x.id):[...use,x.id];save();renderSlot()};
      return b
    }));
    E('slotAiNote').value=c.aiNote||'';
    E('slotNow').textContent=s?(s.done?c.aName+'「'+s.role+'」×'+c.bName+'「'+s.line+'」':'抽選中…'):'画面には出していません';
    E('slotLog').replaceChildren(...slotLog.slice(0,50).map((x,i)=>{const li=document.createElement('li');li.textContent=String(slotLog.length-i).padStart(3,'0')+'　'+x.role+'：'+x.line;return li}))
  }
  E('slotSpin').onclick=()=>slotSpin('all');
  E('slotRe').onclick=()=>slotSpin('a');
  E('slotRb').onclick=()=>slotSpin('b');
  E('slotHide').onclick=()=>{play.slot=null;renderSlot()};
  E('slotReset').onclick=()=>{if(play.slot&&!play.slot.done)return;play.slot=null;slotRoleBag=[];slotLineBags={};slotLog=[];renderSlot()};
  E('slotCopyLog').onclick=()=>copy(slotLog.slice().reverse().map((x,i)=>String(i+1).padStart(3,'0')+'　'+x.role+'：'+x.line).join('\n'));
  E('slotAName').oninput=e=>{slotCfg().aName=e.target.value.slice(0,20)||'役柄';save();renderSlot()};
  E('slotBName').oninput=e=>{slotCfg().bName=e.target.value.slice(0,20)||'セリフ';save();renderSlot()};
  E('slotDur').onchange=e=>{slotCfg().dur=Math.max(0,Math.min(10,Number(e.target.value)||0));save()};
  E('slotSe').onchange=e=>{slotCfg().se=e.target.value;save()};
  E('slotLook').onchange=e=>{slotCfg().look=e.target.value==='bubble'?'bubble':'machine';save()};
  // ざっくりの置き方を選び直したら、細かく決めた位置（いまの向き）は外す
  E('slotPos').onchange=e=>{slotCfg().pos=['left','right'].includes(e.target.value)?e.target.value:'center';playLaySet('slot',null);save();renderLay()};
  E('slotSize').oninput=e=>{slotCfg().size=Math.max(30,Math.min(90,Number(e.target.value)||62));E('slotSizeVal').textContent=slotCfg().size+'%';save()};
  E('slotColor').onchange=e=>{const c=slotCfg();c.color=['theme','custom'].includes(e.target.value)?e.target.value:'classic';
    // 「自分で選ぶ」にしたときは、いま見えている色から始める
    if(c.color==='custom'&&!(Array.isArray(c.colors)&&c.colors.length===5))c.colors=SLOT_CLASSIC.slice();
    save();renderSlot()};
  for(let i=0;i<5;i++)E('slotC'+i).oninput=e=>{const c=slotCfg();if(!Array.isArray(c.colors)||c.colors.length!==5)c.colors=SLOT_CLASSIC.slice();c.colors[i]=e.target.value;save()};
  // 筐体の色：外枠・内側・役柄の窓・飾り・文字の5色から、窓や見出しの色を作る
  const SLOT_CLASSIC=['#e8c984','#fffdf7','#dfb4c3','#a9cfa7','#5e4a43'];
  function slotHex(h){h=String(h||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return [0,0,0];return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}
  function slotMix(a,b,t){const x=slotHex(a),y=slotHex(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}
  function slotLum(h){const [r,g2,b]=slotHex(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g2+.0722*b}
  function slotBase(){
    const c=slotCfg();
    if(c.color==='custom'&&Array.isArray(c.colors)&&c.colors.length===5)return c.colors;
    if(c.color==='theme'&&typeof look!=='undefined'){
      const inner=look.paper||'#fffdf7',frame=look.accent||'#234c40',deco=look.decor||'#a47c42';
      // 文字は内側の色に対して読める色（明るい内側には濃い文字、暗い内側には明るい文字）
      const text=slotLum(inner)>.35?slotMix(frame,'#000000',.35):slotMix(look.accent||'#ffffff','#ffffff',.6);
      return [frame,inner,slotMix(frame,inner,.35),deco,text]
    }
    return SLOT_CLASSIC
  }
  function slotPal(){
    const c=slotCfg(),[frame,inner,acc,deco,text]=slotBase();
    if((c.color||'classic')==='classic')return {frame:'#e8c984',in0:'#fffdf7',in1:'#fff8e9',stud:'#a9cfa7',studL:'#7faa80',badge:'#e3f2df',badgeL:'#acd0aa',badgeT:'#52694f',role:'#fff7f9',roleL:'#dfb4c3',line:'#fffaf0',lineL:'#e4cfa5',text:'#5e4a43'};
    return {frame,in0:inner,in1:slotMix(inner,frame,.07),stud:deco,studL:slotMix(deco,'#000000',.2),badge:slotMix(deco,inner,.78),badgeL:slotMix(deco,inner,.35),badgeT:text,role:slotMix(acc,inner,.9),roleL:acc,line:slotMix(frame,inner,.9),lineL:slotMix(frame,inner,.55),text}
  }
  // 筋肉室スロットの設定JSON（version 3：{config, roles:[{name, lines}]}）を、セリフ帳のシチュエーションとして読み込む
  E('slotImport').onclick=()=>E('slotFile').click();
  E('slotFile').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{
      const j=JSON.parse(await f.text());
      if(!j||!Array.isArray(j.roles))throw Error('筋肉室スロットの設定JSON（roles が入ったもの）ではありません');
      const c=slotCfg(),plan=slotPlan(j.roles);
      if(!plan.newRoles.length&&!plan.addTo.length)throw Error('足せるセリフがありませんでした（すべて登録済みか、空でした）');
      serifKeep('JSONの読み込み');slotApply(plan);
      if(j.config){if(typeof j.config.aName==='string')c.aName=j.config.aName.slice(0,20)||c.aName;if(typeof j.config.bName==='string')c.bName=j.config.bName.slice(0,20)||c.bName;if(Number.isFinite(Number(j.config.duration)))c.dur=Math.max(0,Math.min(10,Number(j.config.duration)))}
      save();renderSerifs();renderSlot();
      toast('読み込みました：'+slotPlanText(plan),7000)
    }catch(err){toast(err.message||'読み込めませんでした',6000)}
  };
  // 取り込みの見積もり（まだ変えない）：同じ名前の役柄には足し、新しい名前は新しいシチュエーションにする
  function slotPlan(roles){
    const plan={newRoles:[],addTo:[],dup:0,over:0,skipRoles:0},byTitle=new Map(serifList().map(s=>[serifNorm(s.title),s]));
    const pending=new Map();
    for(const r of (Array.isArray(roles)?roles:[]).slice(0,200)){
      const title=String(r?.name??r?.title??'').trim().slice(0,80);
      const lines=(Array.isArray(r?.lines)?r.lines:[]).map(x=>String(x??'').replace(/\s*\n\s*/g,' ').trim().slice(0,300)).filter(Boolean);
      if(!title)continue;
      const key=serifNorm(title),same=byTitle.get(key);
      let slot=pending.get(key);
      if(!slot){
        if(same)slot={s:same,have:new Set(serifLines(same).map(serifNorm)),lines:[],room:LINE_MAX-serifLines(same).length};
        else{
          if(serifList().length+plan.newRoles.length>=SERIF_MAX){plan.skipRoles++;continue}
          slot={title,have:new Set(),lines:[],room:LINE_MAX};plan.newRoles.push(slot)
        }
        pending.set(key,slot)
      }
      for(const l of lines){
        const k=serifNorm(l);
        if(slot.have.has(k)){plan.dup++;continue}
        if(slot.lines.length>=slot.room){plan.over++;continue}
        slot.have.add(k);slot.lines.push(l)
      }
    }
    plan.addTo=[...pending.values()].filter(x=>x.s&&x.lines.length);
    return plan
  }
  function slotApply(plan){
    for(const r of plan.newRoles)serifList().push({id:Math.random().toString(36).slice(2,10),title:r.title,lines:r.lines});
    for(const a of plan.addTo)a.s.lines=[...serifLines(a.s),...a.lines];
    serifBag=[];slotLineBags={}
  }
  function slotPlanText(p){
    const nl=p.newRoles.reduce((n,r)=>n+r.lines.length,0),al=p.addTo.reduce((n,a)=>n+a.lines.length,0);
    return [p.newRoles.length?'新しいシチュエーション '+p.newRoles.length+'個（セリフ '+nl+'本）':'',p.addTo.length?'登録済みの '+p.addTo.length+'個にセリフ '+al+'本':'',
      p.dup?'同じセリフ '+p.dup+'本は足しません':'',p.over?'1つ'+LINE_MAX+'本の上限を超える '+p.over+'本は入りません':'',p.skipRoles?'シチュエーションの上限（'+SERIF_MAX+'個）を超える '+p.skipRoles+'個は入りません':''].filter(Boolean).join('・')||'足せるものはありません'
  }
  // AIへの依頼文：今のセリフ帳を全部添えて、重なりを避けてもらう
  E('slotAiNote').oninput=e=>{slotCfg().aiNote=e.target.value.slice(0,2000);save()};
  E('slotAiPrompt').onclick=()=>{
    const c=slotCfg(),mode=E('slotAiMode').value,nr=Number(E('slotAiRoles').value)||6,nl=Number(E('slotAiLines').value)||10;
    const all=serifList().filter(s=>s.title.trim()).map(s=>({name:s.title,lines:serifLines(s)}));
    const targets=mode==='add'?serifList().filter(s=>(c.use||[]).includes(s.id)).map(s=>s.title):[];
    if(mode==='add'&&!targets.length){toast('「抽選の対象」で、セリフを足したい役柄を選んでください',5000);return}
    const persona=(E('planPrompt')?.value||'').trim(),note=(c.aiNote||'').trim();
    copy([
      'あなたは配信のセリフ読み上げ企画の台本作家です。下の【今のデータ】を全部読んでから、まだ無い'+c.aName+'と'+c.bName+'を作ってください。',
      persona?'【演じる人・企画の設定】\n'+persona:'',
      '【お願い】\n'+(mode==='add'
        ?'次の'+c.aName+'それぞれに、'+c.bName+'を'+nl+'本ずつ足してください。'+c.aName+'の名前は一字も変えないでください。\n'+targets.map(t=>'・'+t).join('\n')
        :'新しい'+c.aName+'を'+nr+'個、それぞれに'+c.bName+'を'+nl+'本ずつ作ってください。今ある'+c.aName+'と同じ名前や、言い換えただけの名前は避けてください。'),
      note?'【方向・世界観・避けたいこと】\n'+note:'',
      '【重なりを避ける】\n今のデータと同じ文、語尾や小道具だけを変えた文、同じ場面で同じオチの文は作らないでください。1本の中で改行しないでください。',
      '【返答の形】\n次の形のJSONだけを返してください。前置き・説明・コードブロックの記号は付けないでください。\n{"roles":[{"name":"'+c.aName+'の名前","lines":["'+c.bName+'","'+c.bName+'"]}]}',
      '【今のデータ】\n'+(all.length?JSON.stringify({roles:all}):'（まだありません）')
    ].filter(Boolean).join('\n\n'));
    toast('依頼文をコピーしました（今のセリフ帳 '+all.length+'個を添えています）',4000)
  };
  // まとめて貼り付け：確かめてから足す
  let slotBulkPlan=null;
  function slotBulkParse(text){
    let t=String(text).trim().replace(/^```[a-z]*\s*/i,'').replace(/```\s*$/,'').trim();
    const a=t.indexOf('{'),b=t.lastIndexOf('}');
    if(a<0||b<a)throw Error('JSON（{"roles":[...]} の形）が見つかりません');
    const j=JSON.parse(t.slice(a,b+1));
    if(!Array.isArray(j?.roles))throw Error('roles が入っていません');
    return j.roles
  }
  E('slotBulk').oninput=()=>{slotBulkPlan=null;E('slotBulkGo').disabled=true;E('slotBulkInfo').textContent='';E('slotBulkPrev').replaceChildren()};
  E('slotBulkCheck').onclick=()=>{
    slotBulkPlan=null;E('slotBulkGo').disabled=true;E('slotBulkPrev').replaceChildren();
    try{
      const plan=slotPlan(slotBulkParse(E('slotBulk').value));
      E('slotBulkInfo').textContent=slotPlanText(plan);
      const li=(head,lines)=>{const x=document.createElement('li');x.textContent=head+'\n'+lines.map(l=>'・'+l).join('\n');x.style.whiteSpace='pre-wrap';return x};
      E('slotBulkPrev').replaceChildren(...plan.newRoles.filter(r=>r.lines.length).map(r=>li('【新】'+r.title,r.lines)),...plan.addTo.map(a=>li('【足す】'+a.s.title,a.lines)));
      plan.newRoles=plan.newRoles.filter(r=>r.lines.length);
      if(plan.newRoles.length||plan.addTo.length){slotBulkPlan=plan;E('slotBulkGo').disabled=false}
    }catch(err){E('slotBulkInfo').textContent='読めませんでした：'+(err.message||err)}
  };
  E('slotBulkGo').onclick=()=>{
    if(!slotBulkPlan)return;
    // 確かめた後にセリフ帳が変わっていたら、もう一度見積もる
    let plan;try{plan=slotPlan(slotBulkParse(E('slotBulk').value));plan.newRoles=plan.newRoles.filter(r=>r.lines.length)}catch(_){return}
    if(!plan.newRoles.length&&!plan.addTo.length){toast('足せるものがありません');return}
    serifKeep('まとめて追加');slotApply(plan);save();renderSerifs();
    toast('足しました：'+slotPlanText(plan),6000);
    E('slotBulk').value='';E('slotBulk').oninput()
  };
  E('slotFind').oninput=()=>renderSlot();
  E('slotExport').onclick=()=>{
    const c=slotCfg(),roles=slotPool().map(s=>({name:s.title,lines:serifLines(s)}));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({version:3,config:{title:'筋肉室スロット',sub:'セリフ読み上げ企画',aName:c.aName,bName:c.bName,spin:'抽選開始',intro:'',duration:c.dur,ratio:'landscape',footer:''},roles},null,2)],{type:'application/json'}));a.download='筋肉室スロット設定.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)
  };

  // 配信画面：筐体（ビスケット色の枠、緑の鋲、ピンクの役柄窓、クリームのセリフ窓）。図形だけで描き、画像は使わない
  function drawSlot(now,k){
    const s=play.slot;
    if(!s)return;
    const c=slotCfg(),t=s.dur?Math.min(1,(now-s.at)/s.dur):1;
    if(t>=1&&!s.done)slotDone();
    const spinA=!s.done&&s.what!=='b',spinB=!s.done&&s.what==='b';
    const flick=(arr,fb)=>arr.length?arr[Math.floor(now/70)%arr.length]:fb;
    const roleTxt=spinA?flick(s.names,s.role):s.role,lineTxt=s.what==='all'&&!s.done?'抽選中……':spinB?flick(s.lines,s.line):s.line;
    if(c.look==='bubble'){
      if(s.done&&!s.bub){s.bub=true;play.serif={title:s.role,text:s.line,at:performance.now(),who:s.role};renderSerifs()}
      return
    }
    const P=slotPal(),pos=c.pos||'center',w=Math.min(W*(c.size||62)/100,W-48*k),x=pos==='left'?24*k:pos==='right'?W-24*k-w:(W-w)/2,y=36*k;
    const sc=Math.max(.6,Math.min(1.2,w/(793*k))),fsA=40*k*sc;
    g.save();
    let fsB=26*k*sc,lines;
    for(;;){g.font=sceneFontCss(fsB,lineTxt);lines=wrapLines('「'+lineTxt+'」',w-90*k,99);if(lines.length<=4||fsB<=16*k*sc)break;fsB-=2*k*sc}
    if(lines.length>7)lines=wrapLines('「'+lineTxt+'」',w-90*k,7);
    const lhB=fsB*1.55,hA=fsA*1.9,hB=Math.max(lhB*2.4,lines.length*lhB+30*k);
    const h=44*k+36*k+hA+14*k+hB+30*k;
    playPlace('slot',x+w/2,y+h/2,w+12*k,h+12*k);
    // 筐体
    g.fillStyle='rgba(92,65,48,.16)';g.beginPath();g.roundRect(x+6*k,y+8*k,w,h,30*k);g.fill();
    g.fillStyle=P.frame;g.beginPath();g.roundRect(x,y,w,h,30*k);g.fill();
    const ix=x+9*k,iy=y+9*k,iw=w-18*k,ih=h-18*k;
    const grd=g.createLinearGradient(0,iy,0,iy+ih);grd.addColorStop(0,P.in0);grd.addColorStop(1,P.in1);
    g.fillStyle=grd;g.beginPath();g.roundRect(ix,iy,iw,ih,22*k);g.fill();
    for(const [cx,cy] of [[ix+18*k,iy+18*k],[ix+iw-18*k,iy+18*k],[ix+18*k,iy+ih-18*k],[ix+iw-18*k,iy+ih-18*k]]){
      g.fillStyle=P.stud;g.strokeStyle=P.studL;g.lineWidth=2*k;g.beginPath();g.arc(cx,cy,10*k,0,Math.PI*2);g.fill();g.stroke();
      g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.arc(cx-3*k,cy-3*k,3.2*k,0,Math.PI*2);g.fill()
    }
    // 見出し「役柄 × セリフ」
    g.textAlign='center';g.textBaseline='middle';
    const badge=c.aName+'  ×  '+c.bName;g.font=sceneFontCss(17*k,badge);
    const bw=g.measureText(badge).width+40*k,by=iy+22*k;
    g.fillStyle=P.badge;g.strokeStyle=P.badgeL;g.lineWidth=2*k;g.beginPath();g.roundRect(x+(w-bw)/2,by,bw,32*k,16*k);g.fill();g.stroke();
    g.fillStyle=P.badgeT;g.fillText(badge,x+w/2,by+16*k);
    // 役柄の窓
    const ay=by+46*k,aw=iw-52*k,ax=x+(w-aw)/2;
    g.fillStyle=P.role;g.strokeStyle=P.roleL;g.lineWidth=4*k;g.beginPath();g.roundRect(ax,ay,aw,hA,22*k);g.fill();g.stroke();
    g.font=sceneFontCss(fsA,roleTxt);g.fillStyle=P.text;g.fillText(roleTxt,x+w/2,ay+hA/2,aw-30*k);
    // セリフの窓
    const byy=ay+hA+14*k;
    g.fillStyle=P.line;g.strokeStyle=P.lineL;g.lineWidth=3*k;g.beginPath();g.roundRect(ax,byy,aw,hB,20*k);g.fill();g.stroke();
    g.font=sceneFontCss(fsB,lineTxt);g.fillStyle=P.text;
    const top=byy+(hB-lines.length*lhB)/2;
    lines.forEach((l,i)=>g.fillText(l,x+w/2,top+i*lhB+lhB/2,aw-30*k));
    g.restore()
  }
