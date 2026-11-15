/* テロップ（0.10.11）：本番の「🔊 効果音」タブの「テロップ」。打ち込んだ文・登録した決まり文句を、文字のアニメで配信画面に出す。
   効果音を1つ指名して一緒に鳴らせる（効果音の設定＝.kissa には手を入れず、映像側の state.telop に音の id を持つだけ）。
   動きは、移動・回転・縦横同じ倍率の拡大縮小・フェードだけ。state.telop は .live に入る */

  const TELOP_ANIM={band:'帯で出す（テロップ）',pop:'中央にどん',scatter:'あちこちに散らす',rise:'ふわっと上がって消える'};
  const TELOP_COLOR={
    white:{name:'白（こげ茶のふち）',fill:'#ffffff',line:'#3b2a22',bg:'rgba(40,28,22,.78)'},
    pink:{name:'ピンク（白のふち）',fill:'#ff6fa8',line:'#ffffff',bg:'rgba(255,240,246,.92)'},
    yellow:{name:'黄色（茶色のふち）',fill:'#ffd23f',line:'#5a3a10',bg:'rgba(40,28,22,.78)'},
    sky:{name:'水色（白のふち）',fill:'#5cc4f2',line:'#ffffff',bg:'rgba(236,248,255,.92)'},
    dark:{name:'こげ茶（白のふち）',fill:'#2e211c',line:'#ffffff',bg:'rgba(255,251,244,.94)'}
  };
  const TELOP_POS={bottom:'下',top:'上',center:'真ん中'};
  const telopCfg=()=>{
    if(!state.telop||typeof state.telop!=='object')state.telop=JSON.parse(JSON.stringify(defaults.telop));
    if(!Array.isArray(state.telop.items))state.telop.items=[];
    if(!state.telop.typed)state.telop.typed=JSON.parse(JSON.stringify(defaults.telop.typed));
    return state.telop
  };

  // ---- 画面に出ているテロップ
  let telops=[];
  function telopSound(id){
    if(!id||typeof cfg==='undefined'||!cfg)return null;
    return (cfg.sounds||[]).find(s=>s.id===id&&s.assetId)||null
  }
  function telopShow(text,st){
    text=String(text||'').trim().slice(0,80);
    if(!text)return;
    const now=performance.now(),anim=TELOP_ANIM[st.anim]?st.anim:'band';
    // 帯・中央は、同じ出し方の前のものと入れ替える（重ならないように）
    if(anim==='band'||anim==='pop')telops=telops.filter(t=>t.anim!==anim);
    const n=Math.max(1,Math.min(16,st.n||8)),cnt=anim==='scatter'?(state.light?Math.ceil(n/2):n):1;
    const parts=[];
    // 散らす：画面を升目に分けて、重ならない升に1つずつ（升の中で少しずらす）
    const cols=W>H?4:2,rows=W>H?4:8,cells=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)cells.push([c,r]);
    for(let i=cells.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]]}
    for(let i=0;i<cnt;i++){const [cx,cy]=cells[i%cells.length];parts.push({x:(cx+.5+(Math.random()-.5)*.16)/cols,y:.1+.8*(cy+.5+(Math.random()-.5)*.3)/rows,r:(Math.random()-.5)*.3,s:.8+Math.random()*.4,d:i*110})}
    telops.push({text,anim,color:TELOP_COLOR[st.color]?st.color:'white',font:st.font||'',pos:TELOP_POS[st.pos]?st.pos:'bottom',at:now,dur:Math.max(1,Math.min(15,st.sec||4))*1000,parts});
    if(telops.length>6)telops=telops.slice(-6);
    // 一緒に切り替える表情・一緒に出す漫符（表情を切り替えると漫符は止まるので、表情が先）
    if(st.expr&&typeof setExpr==='function'){const c=curChar();if(c&&(c.exprs||[]).some(e=>e.id===st.expr))setExpr(st.expr)}
    if(st.mp&&typeof manpuStart==='function')manpuStart(st.mp,Math.max(1,Math.min(15,st.sec||4))*1000);
    const s=telopSound(st.se);
    if(s&&typeof playSound==='function'){try{playSound(s)}catch(_){}}
    renderTelopNow()
  }
  function telopClear(){telops=[];decoClear();manpuStop();renderTelopNow()}

  const easeOut=x=>1-Math.pow(1-x,3);
  const backOut=x=>{const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
  function telopFont(t,size){return t.font&&typeof SCENE_FONTS!=='undefined'&&SCENE_FONTS[t.font]?sceneFontCss(size,t.text,t.font):sceneFontCss(size,t.text)}
  function outlined(t,text,x,y,fs){
    const c=TELOP_COLOR[t.color];
    g.lineJoin='round';g.lineWidth=Math.max(2,fs*.18);g.strokeStyle=c.line;g.strokeText(text,x,y);
    g.fillStyle=c.fill;g.fillText(text,x,y)
  }
  // 文字の大きさ・折り返し・幅は、出すときに一度だけ測って覚えておく（毎コマ測り直さない）。
  // 文字（フォント）が遅れて読み込まれることがあるので、0.7秒ごとと、画面の大きさが変わったときに測り直す
  function telopLay(t,now,k){
    const key=W+'x'+H;
    if(t.lay&&t.lay.key===key&&now-t.lay.at<700)return t.lay;
    const fs=(t.anim==='band'?34:t.anim==='pop'?72:t.anim==='scatter'?48:52)*k,font=telopFont(t,fs);
    g.font=font;
    const L={key,at:now,fs,font};
    if(t.anim==='scatter'){L.text=t.text.slice(0,24);L.tw=g.measureText(L.text).width}
    else{
      L.lines=wrapLines(t.text,t.anim==='band'?W*.86-60*k:t.anim==='pop'?W*.84:W*.8,2);
      if(t.anim==='band')L.w=Math.min(W*.86,Math.max(...L.lines.map(l=>g.measureText(l).width))+70*k)
    }
    return t.lay=L
  }
  function drawTelops(now){
    if(!telops.length)return;
    telops=telops.filter(t=>now-t.at<t.dur+(t.anim==='scatter'?t.parts.length*110:0));
    if(!telops.length){renderTelopNow();return}
    const k=Math.min(W,H)/720;
    for(const t of telops){
      const el=now-t.at,c=TELOP_COLOR[t.color],L=telopLay(t,now,k),fs=L.fs;
      const out=Math.max(0,Math.min(1,(t.dur-el)/400));
      g.save();g.textAlign='center';g.textBaseline='middle';g.font=L.font;
      if(t.anim==='band'){
        const lh=fs*1.4,w=L.w,h=L.lines.length*lh+28*k;
        const y=t.pos==='top'?40*k:t.pos==='center'?(H-h)/2:H-70*k-h;
        const inP=easeOut(Math.min(1,el/320));
        g.globalAlpha=Math.min(inP,out);
        g.translate((1-inP)*-W*.25,0);
        g.fillStyle=c.bg;g.beginPath();g.roundRect((W-w)/2,y,w,h,14*k);g.fill();
        g.fillStyle=c.fill;
        L.lines.forEach((l,i)=>g.fillText(l,W/2,y+14*k+lh*i+lh/2))
      }else if(t.anim==='pop'){
        const lh=fs*1.25,cy=t.pos==='top'?H*.22:t.pos==='bottom'?H*.72:H*.45;
        const sc=el<380?.45+.55*backOut(el/380):1;
        g.globalAlpha=Math.min(1,el/150,out);
        g.translate(W/2,cy);g.scale(sc,sc);
        L.lines.forEach((l,i)=>outlined(t,l,0,(i-(L.lines.length-1)/2)*lh,fs))
      }else if(t.anim==='scatter'){
        // 文字の大きさは1つに決めておき、1つずつは縦横同じ倍率で大きさを変える（升の幅に収まるまで縮め、端で切れない位置に寄せる）
        const cw=W/(W>H?4:2),lim=cw*.86;
        for(const p of t.parts){
          const e=el-p.d;if(e<0)continue;
          const f=p.s*Math.min(1,lim/(L.tw*p.s)),hw=L.tw*f/2+fs*f*.2,hh=fs*f;
          const x=Math.max(hw+10*k,Math.min(W-hw-10*k,p.x*W)),y=Math.max(hh+10*k,Math.min(H-hh-10*k,p.y*H));
          const sc=f*(e<260?.3+.7*backOut(e/260):1);
          g.save();
          g.globalAlpha=Math.min(1,e/120,Math.max(0,Math.min(1,(t.dur-e)/400)));
          g.translate(x,y);g.rotate(p.r);g.scale(sc,sc);
          outlined(t,L.text,0,0,fs);
          g.restore()
        }
      }else{
        const lh=fs*1.25,p=Math.min(1,el/t.dur),cy=(t.pos==='top'?H*.34:t.pos==='center'?H*.55:H*.78)-p*140*k;
        g.globalAlpha=Math.min(1,el/300,out);
        g.translate(W/2+Math.sin(el/420)*14*k,cy);
        L.lines.forEach((l,i)=>outlined(t,l,0,(i-(L.lines.length-1)/2)*lh,fs))
      }
      g.restore()
    }
  }

  // ---- 画面（本番の「🔊 効果音」タブ）
  function renderTelopNow(){
    const n=telops.length,el=E('telopNow');
    const txt=n?'表示中：'+telops.map(t=>t.text.slice(0,20)).join('／'):'';
    if(el.textContent!==txt)el.textContent=txt;
    E('telopClear').disabled=!n&&!decoBusy()
  }
  function telopEditOpen(target){
    const c=telopCfg(),it=target==='typed'?c.typed:c.items.find(x=>x.id===target);
    if(!it)return;
    telopEditing=target;
    E('telopEdit').hidden=false;
    E('telopEditTitle').textContent=target==='typed'?'打ち込んで出すときの見た目':'ボタンの編集';
    E('telopFText').closest('label').hidden=target==='typed';
    E('telopFDel').hidden=target==='typed';
    E('telopFText').value=it.text||'';
    E('telopFAnim').value=it.anim;E('telopFColor').value=it.color;E('telopFPos').value=it.pos;E('telopFSec').value=String(it.sec);E('telopFN').value=String(it.n);
    E('telopFFont').replaceChildren(new Option('場面の文字と同じ',''),...Object.entries(SCENE_FONTS).map(([k,f])=>new Option(f.name,k)));E('telopFFont').value=it.font||'';
    const snd=(typeof cfg!=='undefined'&&cfg?cfg.sounds:[]).filter(s=>s.assetId);
    E('telopFSe').replaceChildren(new Option('鳴らさない',''),...snd.map(s=>new Option((s.type==='emoji'?'絵文字 ':s.type==='voice'?'ボイス ':'文字 ')+(s.label||'（名前なし）'),s.id)));
    E('telopFSe').value=snd.some(s=>s.id===it.se)?it.se:'';
    const ex=(curChar()?.exprs)||[];
    E('telopFExpr').replaceChildren(new Option('変えない',''),...ex.map(e=>new Option(e.name,e.id)));E('telopFExpr').value=ex.some(e=>e.id===it.expr)?it.expr:'';
    E('telopFMp').value=it.mp||'';
    telopFormSync();
    E('telopEdit').scrollIntoView?.({block:'nearest'});
    if(target!=='typed')E('telopFText').focus()
  }
  let telopEditing='';
  function telopFormSync(){E('telopFN').closest('label').hidden=E('telopFAnim').value!=='scatter'}
  function telopFormRead(){
    return {anim:E('telopFAnim').value,color:E('telopFColor').value,pos:E('telopFPos').value,sec:Number(E('telopFSec').value)||4,n:Number(E('telopFN').value)||8,font:E('telopFFont').value,se:E('telopFSe').value,expr:E('telopFExpr').value,mp:E('telopFMp').value}
  }
  // 本番の「🔊 効果音」タブ：押すと出すボタンだけ。設定の画面：押すと編集、＋で登録
  function renderTelop(){
    const c=telopCfg();
    const mk=(it,edit)=>{const b=document.createElement('button');b.type='button';b.className='telop-btn';b.dataset.telop=it.id;b.textContent=it.text;b.title=edit?it.text+'（押すと編集）':it.text;return b};
    E('telopGrid').replaceChildren(...c.items.map(it=>mk(it,false)));
    E('telopGrid').hidden=!c.items.length;
    E('telopSetGrid').replaceChildren(...c.items.map(it=>mk(it,true)),Object.assign(document.createElement('button'),{type:'button',className:'telop-btn telop-add',textContent:'＋ 決まり文句を登録'}));
    renderTelopNow()
  }
  E('telopGrid').addEventListener('click',e=>{
    const b=e.target.closest('[data-telop]');if(!b)return;
    const it=telopCfg().items.find(x=>x.id===b.dataset.telop);if(it)telopShow(it.text,it)
  });
  E('telopSetGrid').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.classList.contains('telop-add')){
      const c=telopCfg();if(c.items.length>=60){toast('テロップのボタンは60個までです');return}
      const it={id:'t'+Date.now().toString(36),text:'新しいテロップ',...JSON.parse(JSON.stringify(c.typed))};c.items.push(it);save();renderTelop();telopEditOpen(it.id);E('telopFText').select();return}
    telopEditOpen(b.dataset.telop)
  });
  E('telopShow').onclick=()=>{const t=E('telopIn').value.trim();if(!t){toast('出す文を打ち込んでください');E('telopIn').focus();return}telopShow(t,telopCfg().typed);E('telopIn').value=''};
  E('telopIn').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();E('telopShow').click()}};
  E('telopTyped').onclick=()=>telopEditOpen('typed');
  E('telopClear').onclick=telopClear;
  E('telopFAnim').onchange=telopFormSync;
  E('telopFSave').onclick=()=>{
    const c=telopCfg(),v=telopFormRead();
    if(telopEditing==='typed')Object.assign(c.typed,v);
    else{const it=c.items.find(x=>x.id===telopEditing);if(!it)return;const t=E('telopFText').value.trim().slice(0,80);if(!t){toast('文が空です');return}Object.assign(it,v,{text:t})}
    save();renderTelop();E('telopEdit').hidden=true;toast('テロップの設定を保存しました')
  };
  E('telopFTry').onclick=()=>telopShow(telopEditing==='typed'?'テロップの見本です':E('telopFText').value,telopFormRead());
  E('telopFClose').onclick=()=>{E('telopEdit').hidden=true};
  E('telopFDel').onclick=e=>armed(e.currentTarget,'もう一度押すと、このボタンを消す',()=>{const c=telopCfg();c.items=c.items.filter(x=>x.id!==telopEditing);save();renderTelop();E('telopEdit').hidden=true});
  E('telopFUp').onclick=()=>{const c=telopCfg(),i=c.items.findIndex(x=>x.id===telopEditing);if(i>0){[c.items[i-1],c.items[i]]=[c.items[i],c.items[i-1]];save();renderTelop()}};
  E('telopFDown').onclick=()=>{const c=telopCfg(),i=c.items.findIndex(x=>x.id===telopEditing);if(i>=0&&i<c.items.length-1){[c.items[i+1],c.items[i]]=[c.items[i],c.items[i+1]];save();renderTelop()}};
  E('telopFAnim').replaceChildren(...Object.entries(TELOP_ANIM).map(([k,v])=>new Option(v,k)));
  E('telopFColor').replaceChildren(...Object.entries(TELOP_COLOR).map(([k,v])=>new Option(v.name,k)));
  E('telopFPos').replaceChildren(...Object.entries(TELOP_POS).map(([k,v])=>new Option(v,k)));
  renderTelop();
  window.__otonohaTelop={active:()=>telops.map(t=>({text:t.text,anim:t.anim,n:t.parts.length,color:t.color})),render:renderTelop};
