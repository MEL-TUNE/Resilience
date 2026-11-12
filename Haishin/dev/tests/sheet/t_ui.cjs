const {launch,connect}=require('./cdp.cjs');
const fs=require('fs');const assert=require('assert');
const W=+process.env.W||390,H=+process.env.H||844,TAG=process.env.TAG||'m';
(async()=>{
  const {ch,ws}=await launch(9333+(W%100));
  const P=await connect(ws);
  let fails=0;const ok=async(n,f)=>{try{await f();console.log('PASS',n)}catch(e){fails++;console.log('FAIL',n,'\n   ',e.message)}};
  try{
  await P.send('Page.enable');await P.send('Runtime.enable');
  await P.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:W<700});
  await P.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(__dirname+'/bundle.js','utf8')});
  await P.send('Page.navigate',{url:'http://127.0.0.1:8765/page.html'});
  await new Promise(r=>setTimeout(r,2500));
  const errs=[];
  P.ws.addEventListener('message',m=>{const j=JSON.parse(m.data);if(j.method==='Runtime.exceptionThrown')errs.push(j.params.exceptionDetails.exception?.description||j.params.exceptionDetails.text)});
  const E=P.eval;
  await E(`window.$=s=>document.querySelector(s);window.$$=s=>[...document.querySelectorAll(s)];
    window.btn=(t,root=document)=>{const b=[...root.querySelectorAll('button')].filter(x=>x.offsetParent!==null&&x.textContent.trim().startsWith(t));if(!b.length)throw Error('no button '+t);b[0].click();return b.length};
    window.setv=(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    window.fieldOf=(label,root=document)=>{const l=[...root.querySelectorAll('label.studio-field')].find(x=>x.firstChild&&x.firstChild.textContent===label&&x.offsetParent!==null);if(!l)throw Error('no field '+label);return l.querySelector('input,select,textarea')};
    window.wait=ms=>new Promise(r=>setTimeout(r,ms));true`);
  const shot=async name=>{const r=await P.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('shot-'+TAG+'-'+name+'.png',Buffer.from(r.data,'base64'))};
  const shotEl=async(name,sel)=>{const b=await E(`(()=>{const r=$('${sel}').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`);const r=await P.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:b.x,y:b.y,width:Math.max(1,b.w),height:Math.min(Math.max(1,b.h),4000),scale:1}});fs.writeFileSync('shot-'+TAG+'-'+name+'.png',Buffer.from(r.data,'base64'))};

  await ok('歌枠ノートを開くと、編集の欄がある（閉じている）',async()=>{
    await E(`(async()=>{const b=$('#deckLevel [data-level=prep]');b&&b.click();await wait(200);$('[data-deck=songs]').click();await wait(300);return true})()`);
    const r=await E(`({has:!!$('#sxBox'),open:$('#sxBox').open,vis:$('#sxBox').offsetParent!==null})`);
    assert.ok(r.has&&r.vis,'見える'+JSON.stringify(r));assert.equal(r.open,false);
  });
  await ok('曲リストの行に「📝 シート」が出る（つないでいるとき）',async()=>{
    const n=await E(`(async()=>{setv($('#repFilter'),'');await wait(50);return $$('#repList button').filter(b=>b.textContent==='📝 シート').length})()`);
    // 曲リストが空なら0のまま。あとで確かめる
    console.log('    曲リストの📝ボタン',n);
  });
  await ok('開くとシートを読み込み、曲の一覧が出る',async()=>{
    await E(`(async()=>{$('#sxBox summary').click();await wait(600);return true})()`);
    const r=await E(`({st:$('.sx-status').textContent,items:$$('.sx-item').length,calls:__calls.map(x=>x.op+':'+x.method)})`);
    assert.match(r.st,/曲 217・音源 126・提供者 6/);assert.equal(r.items,40);assert.ok(r.calls.includes('sheet:GET'),r.calls.join());
  });
  await shotEl('01-list','#sxBox');
  await ok('探す欄で絞り込む',async()=>{
    const n=await E(`(async()=>{setv($('.sx-find input'),'デジモン');await wait(50);return $$('.sx-item').length})()`);
    assert.ok(n>=3&&n<10,String(n));
  });
  await ok('新しい曲を足す：読みの見当・確認の表示・書き込み・曲リストへ反映',async()=>{
    const r=await E(`(async()=>{setv($('.sx-find input'),'');btn('＋ 新しい曲を足す');await wait(50);
      setv(fieldOf('曲名（正式な表記）'),'カタカナテスト');setv(fieldOf('アーティスト'),'試験歌手');setv(fieldOf('作品名（タイアップ）'),'試験アニメ');
      const y=fieldOf('読み（並べ替え用）').value;
      btn('✓ 足す内容を確かめる');await wait(50);
      const conf=$('.sx-confirm')?.innerText||'';
      btn('📝 シートに書き込む');await wait(400);
      const sh=__G.ss.sheets['曲'];const row=sh.g.findIndex(r=>r[0]==='カタカナテスト')+1;
      return {y,conf,row,state:sh.g[row-1][4],local:!!__otonohaChars.state.repertoire.find(s=>s.title==='カタカナテスト'&&s.sk==='カタカナテスト／試験歌手'&&s.w==='試験アニメ'),head:$('.sx-head b').textContent,srcBox:!!$('.sx-srcs')}})()`);
    assert.equal(r.y,'かたかなてすと');assert.match(r.conf,/曲名[\s\S]*カタカナテスト/);assert.ok(r.row>2);assert.equal(r.state,'下書き・要確認');assert.ok(r.local,'曲リストに入った');assert.equal(r.head,'曲を直す');assert.ok(r.srcBox);
  });
  await shotEl('02-song','#sxBox');
  await ok('編集の欄の中で、右にはみ出す部品がない',async()=>{
    const r=await E(`(()=>{const b=$('#sxBox'),R=b.getBoundingClientRect();return [...b.querySelectorAll('*')].filter(e=>e.offsetParent!==null&&e.getBoundingClientRect().right>R.right+1).slice(0,6).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right)+'>'+Math.round(R.right))})()`);
    assert.deepEqual(r,[]);
  });
  await ok('音源を足す（共有IDを外す・名前を自動で付ける・キーの区分）',async()=>{
    const r=await E(`(async()=>{btn('＋ 音源を足す');await wait(50);const f=$('.sx-src-form');
      setv(fieldOf('URL',f),'https://youtu.be/abcdefghijk?si=XYZ');
      setv(fieldOf('提供者',f),'OKE-sound');
      btn('✓ 確かめる',f);await wait(50);
      const conf=f.parentElement.querySelector('.sx-confirm')?.innerText||'';
      btn('📝 シートに書き込む');await wait(400);
      const R=__G.ss.sheets['音源'];const row=R.g.find(r=>r[0]==='カタカナテスト／試験歌手');
      const s=__otonohaChars.state.repertoire.find(s=>s.title==='カタカナテスト');
      return {conf,row,local:s.srcs,list:$$('.sx-src').map(x=>x.innerText)}})()`);
    assert.ok(r.row,'シートに音源');assert.equal(r.row[4],'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(r.row[1],'カタカナテスト / OKE-sound');assert.equal(r.row[15],'原曲キー');
    assert.equal(r.local.length,1);assert.equal(r.local[0].kk,'原曲キー');assert.equal(r.local[0].u,'https://www.youtube.com/watch?v=abcdefghijk');
    assert.equal(r.list.length,1);
  });
  await ok('＋ 別のキー：提供者を写して男性キーの音源を足す。曲リストの▶に（男性）',async()=>{
    const r=await E(`(async()=>{btn('＋ 別のキー');await wait(50);const f=$('.sx-src-form');
      const kk=fieldOf('キーの区分',f).value,by=fieldOf('提供者',f).value;
      setv(fieldOf('URL',f),'https://www.youtube.com/watch?v=zzzzzzzzzzz&si=1');setv(fieldOf('キー',f),'-5');
      btn('✓ 確かめる',f);await wait(50);btn('📝 シートに書き込む');await wait(400);
      const s=__otonohaChars.state.repertoire.find(s=>s.title==='カタカナテスト');setv($('#repFilter'),'カタカナテスト');await wait(100);
      return {kk,by,local:s.srcs.map(x=>x.kk+'|'+x.n),btns:$$('#repList button').map(b=>b.textContent)}})()`);
    assert.equal(r.kk,'男性キー');assert.equal(r.by,'OKE-sound');
    assert.deepEqual(r.local,['原曲キー|カタカナテスト / OKE-sound','男性キー|カタカナテスト / OKE-sound（男性キー） キー-5']);
    assert.ok(r.btns.includes('▶ OKE-sound（男性）'),r.btns.join(','));assert.ok(r.btns.includes('📝 シート'));
  });
  await shotEl('03-srcs','#sxBox');
  await ok('Googleドライブのリンクは URL に入れず、保存場所へ移す',async()=>{
    const r=await E(`(async()=>{btn('＋ 音源を足す');await wait(50);const f=$('.sx-src-form');
      setv(fieldOf('URL',f),'https://drive.google.com/file/d/abc/view');
      return {u:fieldOf('URL',f).value,f:f.querySelector('details').open,hint:f.querySelector('.sx-hint').textContent}})()`);
    assert.equal(r.u,'');assert.ok(r.f);assert.match(r.hint,/保存場所/);
    await E(`btn('閉じる',$('.sx-src-form'))`);
  });
  await ok('曲名を直すと、確認に付け替えの注意が出て、音源の「曲」と曲リストの名前も変わる',async()=>{
    const r=await E(`(async()=>{setv(fieldOf('曲名（正式な表記）'),'カタカナテスト改');btn('✓ 直したところを確かめる');await wait(50);
      const conf=$('.sx-confirm').innerText;btn('📝 シートに書き込む');await wait(400);
      return {conf,src:__G.ss.sheets['音源'].g.filter(r=>r[0]==='カタカナテスト改／試験歌手').length,local:!!__otonohaChars.state.repertoire.find(s=>s.title==='カタカナテスト改'&&s.srcs.length===2),old:!!__otonohaChars.state.repertoire.find(s=>s.title==='カタカナテスト')}})()`);
    assert.match(r.conf,/付け替えます/);assert.equal(r.src,2);assert.ok(r.local);assert.ok(!r.old);
  });
  await ok('ラベルの準備：候補を選んで作る',async()=>{
    const r=await E(`(async()=>{btn('🏷 ラベルの項目');await wait(50);const n=$$('.sx-pane .sx-check input').length;
      $$('.sx-pane .sx-check input')[2].click();
      btn('🏷 ラベルの準備をする');await wait(800);
      return {n,labels:__G.ss.sheets['ラベル一覧'].g.slice(1).map(r=>r[0]),head:__G.ss.sheets['曲'].disp(1,20),rows:$$('.sx-lab').length}})()`);
    assert.equal(r.n,12);assert.equal(r.labels.length,11);assert.ok(!r.labels.includes('ゲームソング'));assert.equal(r.head,'ラベル');assert.equal(r.rows,11);
  });
  await shotEl('04-labels','#sxBox');
  await ok('ラベルを足す・並べ替える・名前を変える（控えを取ってから）',async()=>{
    const r=await E(`(async()=>{btn('＋ ラベルを足す');await wait(50);const li=$$('.sx-lab').at(-1);const ins=li.querySelectorAll('input');
      setv(ins[0],'🌸');setv(ins[1],'魔法少女アニメ');setv(ins[2],'作品の種類');
      btn('↑',$$('.sx-lab').at(-1));await wait(30);
      const first=$$('.sx-lab')[0].querySelectorAll('input')[1];setv(first,'Jポップ');
      btn('✓ 確かめる');await wait(50);const conf=$('.sx-confirm').innerText;const bk=$('.sx-confirm input[type=checkbox]').checked;
      btn('📝 シートに書き込む');await wait(900);
      return {conf,bk,labels:__G.ss.sheets['ラベル一覧'].g.slice(1).map(r=>r[0]+'|'+r[1]+'|'+r[2]),backups:Object.keys(__G.ss.sheets).filter(n=>n.startsWith('控え')).length}})()`);
    assert.match(r.conf,/足す[\s\S]*魔法少女アニメ/);assert.match(r.conf,/名前を変える[\s\S]*J-POP/);assert.ok(r.bk);
    assert.equal(r.labels[0],'Jポップ|歌のジャンル|💿');assert.equal(r.labels[10],'魔法少女アニメ|作品の種類|🌸');assert.equal(r.labels.length,12);assert.equal(r.backups,4);
  });
  await ok('曲にラベルを付ける（ふだんは隠れていて、押すと選べる）',async()=>{
    const r=await E(`(async()=>{btn('🎵 曲と音源');await wait(50);setv($('.sx-find input'),'カタカナテスト改');await wait(30);$('.sx-item').click();await wait(50);
      const hidden=$('.sx-pick').hidden;btn('🏷 ラベルを選ぶ');
      const boxes=$$('.sx-pick .sx-check');boxes.find(l=>l.textContent.includes('魔法少女アニメ')).querySelector('input').click();boxes.find(l=>l.textContent.includes('アニメソング')).querySelector('input').click();
      const chips=$$('.sx-labhead .sx-chip').map(x=>x.textContent);
      btn('✓ 直したところを確かめる');await wait(50);btn('📝 シートに書き込む');await wait(400);
      const sh=__G.ss.sheets['曲'];const row=sh.g.find(r=>r[0]==='カタカナテスト改');
      return {hidden,chips,g:row[19],local:__otonohaChars.state.repertoire.find(s=>s.title==='カタカナテスト改').tag}})()`);
    assert.equal(r.hidden,true);assert.deepEqual(r.chips,['🌸 魔法少女アニメ','📺 アニメソング']);assert.equal(r.g,'魔法少女アニメ、アニメソング');assert.equal(r.local,'魔法少女アニメ、アニメソング');
  });
  await shotEl('05-songlabels','#sxBox');
  await ok('ラベルで絞る',async()=>{
    const n=await E(`(async()=>{btn('← 曲の一覧へ');await wait(30);setv($('.sx-find input'),'');setv($('.sx-find select'),'魔法少女アニメ');await wait(30);return $$('.sx-item').length})()`);
    assert.equal(n,1);
  });
  await ok('提供者を足す（今日の日付・読み）',async()=>{
    const r=await E(`(async()=>{btn('🎧 音源の提供者');await wait(30);btn('＋ 提供者を足す');await wait(30);
      setv(fieldOf('提供者名（チャンネル名）'),'テストチャンネル');btn('今日の日付');setv(fieldOf('YouTube配信'),'可');
      btn('✓ 確かめる');await wait(30);btn('📝 シートに書き込む');await wait(400);
      const row=__G.ss.sheets['提供者'].g.find(r=>r[0]==='テストチャンネル');return {row,list:$$('.sx-item').length}})()`);
    assert.ok(r.row);assert.match(r.row[7],/^[0-9]{4}[/][0-9]{2}[/][0-9]{2}$/);assert.equal(r.row[2],'可');assert.equal(r.row[10],'てすとちゃんねる');assert.equal(r.list,7);
  });
  await ok('変更の記録：一覧が出て、前の値に戻せる',async()=>{
    const r=await E(`(async()=>{btn('📜 変更の記録');await wait(500);const n=$$('.sx-hist>li').length;
      const li=$$('.sx-hist>li').find(x=>x.innerText.includes('直した')&&x.innerText.includes('ラベル'));
      btn('↩ 前の値に戻す',li);await wait(30);btn('📝 シートに書き込む',li);await wait(800);
      const row=__G.ss.sheets['曲'].g.find(r=>r[0]==='カタカナテスト改');return {n,g:row[19],local:__otonohaChars.state.repertoire.find(s=>s.title==='カタカナテスト改').tag||''}})()`);
    assert.ok(r.n>=5,String(r.n));assert.equal(r.g,'');assert.equal(r.local,'');
  });
  await shotEl('06-hist','#sxBox');
  await ok('ほかの端末で変わっていたら、書かずに読み直しを出す',async()=>{
    const r=await E(`(async()=>{btn('🎵 曲と音源');await wait(30);setv($('.sx-find select'),'');setv($('.sx-find input'),'Lemon');await wait(30);$('.sx-item').click();await wait(30);
      const sh=__G.ss.sheets['曲'];const i=sh.g.findIndex(r=>r[0]==='Lemon');sh.g[i][1]='ほかの端末で直した';
      setv(fieldOf('作品名（タイアップ）'),'こちらの値');btn('✓ 直したところを確かめる');await wait(30);btn('📝 シートに書き込む');await wait(400);
      return {msg:$('.sx-confirm').innerText,val:sh.g[i][1],re:!!$$('.sx-confirm button').find(b=>b.textContent.includes('読み直す'))}})()`);
    assert.match(r.msg,/変わっています/);assert.equal(r.val,'ほかの端末で直した');assert.ok(r.re);
  });
  await ok('書き込みは POST、読むのは GET',async()=>{
    const c=await E(`__calls.map(x=>x.op+':'+x.method)`);
    for(const x of c){const [op,m]=x.split(':');assert.equal(m,['ping','read','sheet','history'].includes(op)?'GET':'POST',x)}
  });
  await ok('横にはみ出さない',async()=>{
    const r=await E(`({sw:document.documentElement.scrollWidth,iw:innerWidth})`);assert.ok(r.sw<=r.iw+1,JSON.stringify(r));
  });
  await ok('ページのエラーがない',async()=>{assert.deepEqual(errs,[])});
  }finally{ch.kill();console.log(fails?'FAILED '+fails:'ALL PASS')}
})();
