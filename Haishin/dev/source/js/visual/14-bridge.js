/* オトノハ連携（Otonoha Bridge 1）：企画卓に登録したアプリと、postMessage で伝言を交わす */

  const BRIDGE_VER=1;
  const bridgeSubs=new Map(); // window -> Set(購読するイベント名)
  const bridgeRate=new Map(); // window -> [時刻...]
  const BRIDGE_EVENTS=['sing','scene','talk','serif','dice','wheel','comments','streamer'];
  const bridgeLog=[];

  // 伝言を送ってきたのが、登録アプリの枠（企画卓の中・別ウインドウの中）かを確かめる
  function bridgeSource(win){
    const a=appCur();
    if(!a||!win)return null;
    try{if(win===E('appFrame').contentWindow)return {app:a,where:'page'}}catch(_){}
    try{if(appWinOpen()&&win===appWindow.document.getElementById('app')?.contentWindow)return {app:a,where:'window'}}catch(_){}
    return null
  }
  function bridgeNote(text){
    bridgeLog.unshift(new Date().toLocaleTimeString('ja-JP')+'　'+text);
    bridgeLog.length=Math.min(bridgeLog.length,8);
    const el=E('bridgeLog');
    if(el)el.textContent=bridgeLog.join('\n')
  }
  function bridgeReply(win,msg){try{win.postMessage({otonoha:BRIDGE_VER,...msg},'*')}catch(_){}}
  // オトノハ → アプリ（購読している窓だけに送る）
  function bridgeEmit(name,data){
    for(const [win,set] of bridgeSubs){
      if(win.closed){bridgeSubs.delete(win);continue}
      if(set.has(name)||set.has('*'))bridgeReply(win,{type:'event',name,data})
    }
  }
  const S_=(v,n)=>String(v??'').slice(0,n);
  window.addEventListener('message',e=>{
    const m=e.data;
    if(!m||typeof m!=='object'||m.otonoha!==BRIDGE_VER||typeof m.type!=='string')return;
    const src=bridgeSource(e.source);
    if(!src)return;
    const {app}=src,win=e.source;
    if(app.bridge===false){bridgeReply(win,{type:'error',to:m.type,error:'このアプリの連携はオフになっています'});return}
    // 送りすぎの抑え（1秒に20件まで）
    const now=performance.now(),q=(bridgeRate.get(win)||[]).filter(t=>now-t<1000);
    if(q.length>=20){return}
    q.push(now);bridgeRate.set(win,q);
    const ok=(extra)=>bridgeReply(win,{type:'ok',to:m.type,id:m.id,...extra});
    const ng=(error)=>{bridgeReply(win,{type:'error',to:m.type,id:m.id,error});bridgeNote(app.name+'：'+error)};
    switch(m.type){
      case 'hello':{
        const wants=Array.isArray(m.events)?m.events.filter(x=>x==='*'||BRIDGE_EVENTS.includes(x)):[];
        bridgeSubs.set(win,new Set(wants));
        bridgeNote(S_(m.name,40)||app.name+' がつながりました');
        bridgeReply(win,{type:'welcome',id:m.id,version:BRIDGE_VER,app:{name:app.name},can:['say','clear','dice','wheel','comments',...(app.bridgeMore?['se','scene']:[])],events:BRIDGE_EVENTS,streamer:(state.profiles||[]).find(p=>p.id===state.profileId)?.name||''});
        return
      }
      case 'say':{
        const text=S_(m.text,600).trim();
        if(!text)return ng('text が空です');
        play.serif={title:S_(m.title,80)||app.name,text,at:performance.now(),who:S_(m.speaker,40)};
        renderSerifs();bridgeNote(app.name+'：「'+text.slice(0,30)+'」');bridgeEmit('serif',{text,title:play.serif.title});
        return ok()
      }
      case 'clear':{
        const what=m.what||'all';
        if(what==='all'||what==='say')play.serif=null;
        if(what==='all'||what==='dice'||what==='wheel'){play.dice=null;play.wheel=null}
        if(what==='all'||what==='comments')audClear();
        renderPlays();return ok()
      }
      case 'dice':{
        state.diceN=[1,2,3].includes(m.count)?m.count:state.diceN;
        state.diceF=[4,6,8,10,12,20,100].includes(m.faces)?m.faces:state.diceF;
        E('diceRoll').click();
        return ok()
      }
      case 'wheel':{
        if(Array.isArray(m.items)){const items=m.items.map(x=>S_(x,40).trim()).filter(Boolean).slice(0,24);if(items.length<2)return ng('items は2つ以上');state.wheelItems=items.join('\n');renderPlayOpts()}
        E('wheelSpin').click();
        return ok()
      }
      case 'comments':{
        if(!Array.isArray(m.items))return ng('items がありません');
        const list=m.items.slice(0,10).map(c=>({name:S_(c.name,40),text:S_(c.text,140).trim(),icon:S_(c.icon,8),color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#f4e6d8'})).filter(c=>c.text);
        audShow(list,'app');
        return ok({count:list.length})
      }
      case 'se':{
        if(!app.bridgeMore)return ng('効果音を鳴らす許可がありません（「企画の準備」の「アプリを並べる」で許可できます）');
        const label=S_(m.label,60).trim();
        const s=(typeof cfg!=='undefined'?cfg.sounds:[]).find(x=>x.assetId&&x.label===label);
        if(!s)return ng('その名前の効果音が見つかりません：'+label);
        playSound(s);return ok()
      }
      case 'scene':{
        if(!app.bridgeMore)return ng('場面を切り替える許可がありません（「企画の準備」の「アプリを並べる」で許可できます）');
        if(!['live','standby','away','end'].includes(m.scene))return ng('scene は live / standby / away / end のどれかです');
        enterScene(m.scene);return ok()
      }
      default:return ng('知らない種類の伝言です：'+S_(m.type,30))
    }
  });

  // 開発者向けの説明と、そのまま動く見本アプリ
  const BRIDGE_DOC=`# オトノハ連携（Otonoha Bridge 1）

配信処オトノハの「企画の準備」の「アプリを並べる」に登録したHTMLアプリは、ブラウザ標準の window.postMessage で、オトノハと伝言を交わせます。

## つなぐ
アプリの中で、親のページ（オトノハ）へ hello を送ります。

    parent.postMessage({otonoha:1, type:'hello', name:'わたしのアプリ', events:['sing','scene','talk']}, '*');

オトノハは welcome を返します。welcome の can に、このアプリが使える命令が入ります。

    window.addEventListener('message', e => {
      const m = e.data;
      if (!m || m.otonoha !== 1) return;
      if (m.type === 'welcome') console.log('つながりました', m.can);
      if (m.type === 'event') console.log('出来事', m.name, m.data);
    });

## アプリ → オトノハ（命令）
すべての伝言に otonoha:1 と type を付けます。id を付けると、返事（ok / error）に同じ id が入ります。

| type | 中身 | すること |
| --- | --- | --- |
| say | text（600字まで）, title, speaker | 配信画面に吹き出しでセリフを出す |
| clear | what: all / say / dice / comments | 出しているものを消す |
| dice | count: 1〜3, faces: 4/6/8/10/12/20/100 | サイコロを振る |
| wheel | items: ['項目', ...]（2〜24個。省略すると今の項目） | ルーレットを回す |
| comments | items: [{name, text, icon, color}]（10件まで） | AI観客席と同じコメント欄に出す |
| se | label（効果音ボタンの名前） | 効果音を鳴らす（※利用者が許可したときだけ） |
| scene | scene: live / standby / away / end | 配信中・準備中・離席中・配信終了を切り替える（※利用者が許可したときだけ） |

## オトノハ → アプリ（出来事）
hello の events に書いた名前の出来事だけ届きます（'*' ですべて）。

| name | data |
| --- | --- |
| sing | {title, artist} 歌枠ノートで「歌い始め」を押した |
| scene | {scene} 場面が変わった |
| talk | {talking} 配信者がマイクで話し始めた・話し終えた |
| serif | {text, title} セリフ帳・アプリのセリフを画面に出した |
| dice | {values, total} サイコロが止まった |
| wheel | {result} ルーレットが止まった |
| comments | {items} AI観客席のコメントが出た |
| streamer | {text} AI観客席に配信者の発言を送った |

## 守ること
- オトノハは、登録されたアプリの枠から届いた伝言だけを受け取ります。1秒に20件を超える伝言は捨てます。
- 効果音と場面の切り替えは、利用者がアプリごとに許可したときだけ使えます。
- 文字数の上限を超えた部分は切り捨てます。
- オトノハから届く出来事には、利用者の個人情報は入りません。
`;
  const BRIDGE_SAMPLE=`<!doctype html><html lang="ja"><meta charset="utf-8"><title>オトノハ連携の見本</title>
<style>body{font-family:sans-serif;margin:16px;background:#fbf6ee;color:#2e211c}button{margin:4px;padding:8px 12px}#log{white-space:pre-wrap;font-size:12px;background:#fff;padding:8px;border-radius:8px;min-height:80px}</style>
<h1>オトノハ連携の見本</h1>
<p id="st">オトノハを探しています…</p>
<input id="t" value="ほら、こちらへ。迎えに来ましたのよ" size="40"><button id="say">セリフを出す</button>
<button id="dice">サイコロ</button><button id="wheel">ルーレット</button><button id="cm">コメントを出す</button><button id="clr">消す</button>
<div id="log"></div>
<script>
const send=(type,extra)=>parent.postMessage({otonoha:1,type,...extra},'*');
const log=s=>{document.getElementById('log').textContent=s+'\\n'+document.getElementById('log').textContent};
addEventListener('message',e=>{const m=e.data;if(!m||m.otonoha!==1)return;
 if(m.type==='welcome')document.getElementById('st').textContent='つながりました（使える命令：'+m.can.join(' / ')+'）';
 if(m.type==='event')log('出来事：'+m.name+' '+JSON.stringify(m.data));
 if(m.type==='error')log('エラー：'+m.error)});
send('hello',{name:'オトノハ連携の見本',events:['*']});
document.getElementById('say').onclick=()=>send('say',{text:document.getElementById('t').value,title:'見本'});
document.getElementById('dice').onclick=()=>send('dice',{count:2,faces:6});
document.getElementById('wheel').onclick=()=>send('wheel',{items:['歌う','語る','罰ゲーム']});
document.getElementById('cm').onclick=()=>send('comments',{items:[{name:'リン',icon:'🌻',color:'#ffdf79',text:'見本アプリからのコメント！'}]});
document.getElementById('clr').onclick=()=>send('clear',{what:'all'});
<\/script></html>`;
  function bridgeSave(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
  E('bridgeDoc').onclick=()=>bridgeSave('otonoha-bridge-1.md',BRIDGE_DOC,'text/markdown');
  E('bridgeSample').onclick=()=>bridgeSave('otonoha-bridge-sample.html',BRIDGE_SAMPLE,'text/html');
  E('appBridge').onchange=e=>{const a=appCur();if(a){a.bridge=e.target.checked;save()}};
  E('appBridgeMore').onchange=e=>{const a=appCur();if(a){a.bridgeMore=e.target.checked;save()}};
  function renderBridge(){const a=appCur();if(!a)return;E('appBridge').checked=a.bridge!==false;E('appBridgeMore').checked=!!a.bridgeMore}
