/* 企画卓：セリフ帳・ルーレット・サイコロ（配信画面に描く） */

  const SERIF_MAX=100,LINE_MAX=300;
  const serifList=()=>Array.isArray(state.serifs)?state.serifs:(state.serifs=[]);
  const serifCur=()=>serifList().find(s=>s.id===state.serifSel)||null;
  // 画面に出しているもの（保存しない）
  const play={serif:null,serifAt:0,dice:null,wheel:null};
  let serifBag=[];

  // ---- セリフ帳
  function serifLines(s){return (s?.lines||[]).filter(x=>x.trim())}
  function renderSerifs(){
    const sel=E('serifSel'),cur=serifCur();
    sel.replaceChildren(new Option('（シチュエーションを選ぶ）',''),...serifList().map(s=>new Option(s.title+'（'+serifLines(s).length+'）',s.id)));
    sel.value=cur?cur.id:'';
    E('serifEdit').hidden=!cur;
    if(cur){E('serifTitle').value=cur.title;E('serifText').value=cur.lines.join('\n')}
    E('serifPos').value=state.serifPos;E('serifName').checked=state.serifName;
    E('serifNow').textContent=play.serif?'表示中：'+play.serif.text:'画面には出していません'
  }
  function serifShow(s,text){
    play.serif={title:s.title,text,at:performance.now()};
    renderSerifs()
  }
  function serifPick(dir){
    const s=serifCur(),lines=serifLines(s);
    if(!s||!lines.length){toast('セリフがありません。下の欄にセリフを入れてください');return}
    if(dir==='random'){
      if(!serifBag.length||serifBag.sid!==s.id){serifBag=lines.map((_,i)=>i).sort(()=>Math.random()-.5);serifBag.sid=s.id}
      const i=serifBag.pop();
      s.pos=i
    }else{
      const n=lines.length;
      s.pos=Number.isInteger(s.pos)?(s.pos+(dir==='next'?1:-1)+n)%n:0
    }
    save();
    serifShow(s,lines[s.pos])
  }
  E('serifSel').onchange=e=>{state.serifSel=e.target.value;serifBag=[];save();renderSerifs()};
  E('serifAdd').onclick=()=>{
    const t=E('serifNew').value.trim();
    if(!t){toast('シチュエーションを入力してください');return}
    if(serifList().length>=SERIF_MAX){toast('シチュエーションは'+SERIF_MAX+'個までです');return}
    const s={id:Math.random().toString(36).slice(2,10),title:t.slice(0,80),lines:[]};
    serifList().push(s);state.serifSel=s.id;E('serifNew').value='';save();renderSerifs();
    E('serifText').focus()
  };
  E('serifTitle').oninput=e=>{const s=serifCur();if(s){s.title=e.target.value.slice(0,80)||'シチュエーション';save();const o=E('serifSel').selectedOptions[0];if(o)o.textContent=s.title+'（'+serifLines(s).length+'）'}};
  E('serifText').oninput=e=>{const s=serifCur();if(s){s.lines=e.target.value.split('\n').slice(0,LINE_MAX).map(x=>x.slice(0,300));serifBag=[];save();const o=E('serifSel').selectedOptions[0];if(o)o.textContent=s.title+'（'+serifLines(s).length+'）'}};
  E('serifDel').onclick=e=>armed(e.currentTarget,'もう一度押すと削除',()=>{state.serifs=serifList().filter(x=>x.id!==state.serifSel);state.serifSel='';save();renderSerifs()});
  E('serifPrompt').onclick=()=>{
    const s=serifCur(),t=s?.title||E('serifNew').value.trim();
    if(!t){toast('シチュエーションを入力するか選んでください');return}
    const n=Math.max(1,Math.min(50,Number(E('serifCount').value)||10));
    const persona=(E('planPrompt').value||'').trim();
    copy([persona?'【キャラクター・設定】\n'+persona:'',
      '【シチュエーション】\n'+t,
      '【お願い】\nこのシチュエーションで、キャラクターが言うセリフを'+n+'個、考えてください。それぞれ違う切り口にしてください。',
      '【返答の形】\n1行に1つのセリフだけを書いてください。番号・かぎかっこ・説明は付けないでください。'].filter(Boolean).join('\n\n'))
  };
  E('serifPaste').onclick=()=>{
    const s=serifCur();
    if(!s){toast('先にシチュエーションを選ぶか作ってください');return}
    const add=E('serifIn').value.split('\n').map(x=>x.trim().replace(/^(\d+[.)．、]|[-・*●])\s*/,'').replace(/^[「『](.*)[」』]$/,'$1')).filter(Boolean);
    if(!add.length){toast('貼り付ける欄にセリフを入れてください');return}
    s.lines=[...serifLines(s),...add].slice(0,LINE_MAX);E('serifIn').value='';serifBag=[];save();renderSerifs();
    toast(add.length+'個のセリフを足しました',2500)
  };
  E('serifRandom').onclick=()=>serifPick('random');
  E('serifNext').onclick=()=>serifPick('next');
  E('serifPrev').onclick=()=>serifPick('prev');
  E('serifHide').onclick=()=>{play.serif=null;renderSerifs()};
  E('serifPos').onchange=e=>{state.serifPos=e.target.value;save()};
  E('serifName').onchange=e=>{state.serifName=e.target.checked;save()};

  // ---- サイコロ・ルーレット
  function renderPlayOpts(){
    E('diceN').value=String(state.diceN);E('diceF').value=String(state.diceF);
    E('wheelItems').value=state.wheelItems;E('playPos').value=state.playPos;
    E('playResult').textContent=play.dice&&play.dice.done?'サイコロ：'+play.dice.vals.join('・')+(play.dice.vals.length>1?'（合計 '+play.dice.vals.reduce((a,b)=>a+b,0)+'）':''):play.wheel&&play.wheel.done?'ルーレット：'+play.wheel.items[play.wheel.pick]:''
  }
  const playRnd=n=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n};
  E('diceRoll').onclick=()=>{
    const n=state.diceN,f=state.diceF;
    play.wheel=null;
    play.dice={vals:Array.from({length:n},()=>1+playRnd(f)),f,at:performance.now(),dur:1300,done:false};
    renderPlayOpts()
  };
  E('wheelSpin').onclick=()=>{
    const items=state.wheelItems.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,24);
    if(items.length<2){toast('ルーレットの項目を2つ以上入れてください');return}
    const pick=playRnd(items.length),seg=Math.PI*2/items.length;
    // 針は真上。選ばれた項目の真ん中付近が真上に来る角度まで、4〜6回転して止まる
    const target=-(pick+.15+Math.random()*.7)*seg,turns=4+playRnd(3);
    play.dice=null;
    play.wheel={items,pick,from:play.wheel?.end%(Math.PI*2)||0,end:target-turns*Math.PI*2,at:performance.now(),dur:4200+playRnd(1200),done:false};
    renderPlayOpts()
  };
  E('playClear').onclick=()=>{play.dice=null;play.wheel=null;renderPlayOpts()};
  E('diceN').onchange=e=>{state.diceN=Math.max(1,Math.min(3,Number(e.target.value)||1));save()};
  E('diceF').onchange=e=>{state.diceF=[4,6,8,10,12,20,100].includes(Number(e.target.value))?Number(e.target.value):6;save()};
  E('wheelItems').oninput=e=>{state.wheelItems=e.target.value.slice(0,2000);save()};
  E('playPos').onchange=e=>{state.playPos=e.target.value;save()};

  function wrapLines(text,maxW,max){
    const out=[];
    for(const para of String(text).split('\n')){
      let line='';
      for(const c of [...para]){if(line&&g.measureText(line+c).width>maxW){out.push(line);line=c}else line+=c}
      out.push(line)
    }
    if(out.length>max){out.length=max;out[max-1]=out[max-1].slice(0,-1)+'…'}
    return out
  }
  function drawSerif(k){
    const s=play.serif;
    if(!s)return;
    const a=Math.min(1,(performance.now()-s.at)/220);
    g.save();
    g.globalAlpha=a;
    const fs=32*k,maxW=Math.min(W*.78,1000*k);
    g.font=sceneFontCss(fs,s.text);
    const lines=wrapLines(s.text,maxW-60*k,4),lh=fs*1.5;
    const name=state.serifName?((state.profiles||[]).find(p=>p.id===state.profileId)?.name||''):'';
    const w=Math.min(maxW,Math.max(...lines.map(l=>g.measureText(l).width))+60*k),h=lines.length*lh+40*k+(name?fs*.9:0);
    const pos=state.serifPos,x=pos==='left'?40*k:pos==='right'?W-40*k-w:(W-w)/2,y=pos==='top'?40*k:H-60*k-h-(pos==='bottom'?0:H*.18);
    g.fillStyle='rgba(255,251,244,.94)';g.strokeStyle='rgba(60,40,30,.35)';g.lineWidth=2*k;
    g.beginPath();g.roundRect(x,y,w,h,22*k);g.fill();g.stroke();
    let yy=y+22*k;
    g.textBaseline='top';g.textAlign='left';
    if(name){g.font=sceneFontCss(fs*.62,name);g.fillStyle='#8a5a3b';g.fillText(name,x+30*k,yy);yy+=fs*.9}
    g.font=sceneFontCss(fs,s.text);g.fillStyle='#2e211c';
    lines.forEach((l,i)=>g.fillText(l,x+30*k,yy+i*lh+(lh-fs)/2));
    g.restore()
  }
  function playAnchor(sz,k){
    const p=state.playPos,m=50*k;
    return {x:p==='left'?m+sz/2:p==='right'?W-m-sz/2:W/2,y:H*.42}
  }
  function drawDie(cx,cy,s,v,f,rot){
    g.save();g.translate(cx,cy);g.rotate(rot);
    g.fillStyle='#fffaf2';g.strokeStyle='#3b2a22';g.lineWidth=s*.04;
    g.beginPath();g.roundRect(-s/2,-s/2,s,s,s*.18);g.fill();g.stroke();
    const pip=(x,y)=>{g.beginPath();g.arc(x*s*.28,y*s*.28,s*.085,0,Math.PI*2);g.fill()};
    if(f===6&&v>=1&&v<=6){
      g.fillStyle=v===1?'#d43d4b':'#3b2a22';
      const P={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
      for(const [x,y] of P[v])pip(x,y)
    }else{
      g.fillStyle='#3b2a22';g.textAlign='center';g.textBaseline='middle';g.font='800 '+Math.round(s*(String(v).length>2?.34:.46))+'px sans-serif';g.fillText(String(v),0,s*.03)
    }
    g.restore()
  }
  function drawDice(now,k){
    const d=play.dice;
    if(!d)return;
    const t=Math.min(1,(now-d.at)/d.dur),s=150*k,gap=34*k,n=d.vals.length,tw=n*s+(n-1)*gap,an=playAnchor(tw,k);
    if(t>=1&&!d.done){d.done=true;renderPlayOpts()}
    d.vals.forEach((v,i)=>{
      const shown=t<1?1+playRnd(d.f):v,
        rot=t<1?(1-t)*(1-t)*Math.sin(now/70+i*2)*.9:0,
        bounce=t<1?-Math.abs(Math.sin(t*Math.PI*3.2))*(1-t)*60*k:0;
      drawDie(an.x-tw/2+s/2+i*(s+gap),an.y+bounce,s,shown,d.f,rot)
    });
    if(d.done&&n>1){
      g.save();g.font=sceneFontCss(30*k,'合計');g.textAlign='center';g.textBaseline='top';
      const txt='合計 '+d.vals.reduce((a,b)=>a+b,0),tw2=g.measureText(txt).width+40*k;
      g.fillStyle='rgba(22,34,29,.7)';g.beginPath();g.roundRect(an.x-tw2/2,an.y+s/2+20*k,tw2,46*k,12*k);g.fill();
      g.fillStyle='#fbf5e9';g.fillText(txt,an.x,an.y+s/2+28*k);g.restore()
    }
  }
  const WHEEL_COLORS=['#e8746a','#f2b84b','#8cc084','#6fa8dc','#b494d6','#f29ab3','#e0a46a','#7cc6c0'];
  function drawWheel(now,k){
    const r=play.wheel;
    if(!r)return;
    const t=Math.min(1,(now-r.at)/r.dur),e=1-Math.pow(1-t,3.2),ang=r.from+(r.end-r.from)*e;
    if(t>=1&&!r.done){r.done=true;renderPlayOpts()}
    const R=Math.min(W,H)*.3,an=playAnchor(R*2,k),n=r.items.length,seg=Math.PI*2/n;
    g.save();g.translate(an.x,an.y);
    g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.arc(4*k,6*k,R+8*k,0,Math.PI*2);g.fill();
    for(let i=0;i<n;i++){
      const a0=ang+i*seg-Math.PI/2,a1=a0+seg;
      g.fillStyle=WHEEL_COLORS[i%WHEEL_COLORS.length];
      if(r.done&&i===r.pick)g.fillStyle='#fff3c4';
      g.beginPath();g.moveTo(0,0);g.arc(0,0,R,a0,a1);g.closePath();g.fill();
      g.strokeStyle='#fffaf2';g.lineWidth=3*k;g.stroke();
      g.save();g.rotate(a0+seg/2);g.textAlign='right';g.textBaseline='middle';
      // 項目名は、扇の長さに収まるまで文字を小さくする（最小で14px相当。それでも長いときだけ末尾を省く）
      const label=r.items[i],room=R*.74;
      let fs=Math.min(30*k,seg*R*.42);
      g.font=sceneFontCss(fs,label);
      const w0=g.measureText(label).width;
      if(w0>room){fs=Math.max(14*k,fs*room/w0);g.font=sceneFontCss(fs,label)}
      g.fillStyle='#2e211c';
      let tx=label;while(tx.length>1&&g.measureText(tx).width>room)tx=tx.slice(0,-1);
      g.fillText(tx===label?tx:tx+'…',R-14*k,0);g.restore()
    }
    g.fillStyle='#fffaf2';g.strokeStyle='#3b2a22';g.lineWidth=4*k;
    g.beginPath();g.arc(0,0,R*.12,0,Math.PI*2);g.fill();g.stroke();
    g.beginPath();g.arc(0,0,R,0,Math.PI*2);g.stroke();
    // 針（真上）
    g.fillStyle='#d43d4b';g.beginPath();g.moveTo(0,-R+22*k);g.lineTo(-18*k,-R-24*k);g.lineTo(18*k,-R-24*k);g.closePath();g.fill();g.stroke();
    if(r.done){
      const txt='→ '+r.items[r.pick];
      g.font=sceneFontCss(34*k,txt);g.textAlign='center';g.textBaseline='middle';
      const tw=Math.min(W*.8,g.measureText(txt).width+48*k);
      g.fillStyle='rgba(22,34,29,.74)';g.beginPath();g.roundRect(-tw/2,R+28*k,tw,58*k,14*k);g.fill();
      g.fillStyle='#fbf5e9';g.fillText(txt,0,R+57*k,tw-30*k)
    }
    g.restore()
  }
  function drawPlays(now){
    if(!play.serif&&!play.dice&&!play.wheel)return;
    const k=Math.min(W,H)/720;
    drawWheel(now,k);drawDice(now,k);drawSerif(k)
  }
  function renderPlays(){renderSerifs();renderPlayOpts()}
