/* 歌枠管理シートとつなぐ：貼り付けで読み込む／Apps Script（ウェブアプリ）で読み書きする */

  const SHEET_GAS="/**\n * 配信処オトノハ ⇄ 歌枠管理シート（Apps Script・版1）\n * 1. 下の OTONOHA_KEY を、自分だけの合言葉に書き換えます（英数字で12文字以上がおすすめ）。\n * 2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」、次のユーザーとして実行「自分」、アクセスできるユーザー「全員」。\n * 3. 出てきたウェブアプリのURLと合言葉を、オトノハの「歌枠管理シートとつなぐ」に入れます。\n * このスクリプトが書き込むのは、手で入力する列（「曲」A・C・E列、「音源」A〜E・G列、「配信一覧」A〜C・F列、「配信ログ」A〜F列）だけです。自動の列には書きません。\n */\nconst OTONOHA_KEY = 'ここに合言葉';\n\nfunction doGet(e) { return out_(handle_((e && e.parameter) || {})); }\nfunction doPost(e) {\n  let body = {};\n  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: '送られた内容が読めません' }); }\n  return out_(handle_(body));\n}\nfunction out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }\n\nfunction handle_(p) {\n  if (!OTONOHA_KEY || OTONOHA_KEY === 'ここに合言葉') return { ok: false, error: 'Apps Script の OTONOHA_KEY に合言葉を書いて、デプロイし直してください' };\n  if (String(p.key || '') !== OTONOHA_KEY) return { ok: false, error: '合言葉が違います' };\n  const ss = SpreadsheetApp.getActiveSpreadsheet();\n  try {\n    if (p.op === 'ping') return { ok: true, version: 1, name: ss.getName() };\n    if (p.op === 'read') return read_(ss);\n    if (p.op === 'log') {\n      const lock = LockService.getDocumentLock();\n      lock.waitLock(20000);\n      try { return log_(ss, p); } finally { lock.releaseLock(); }\n    }\n    return { ok: false, error: '知らない操作です：' + String(p.op || '') };\n  } catch (err) {\n    return { ok: false, error: String((err && err.message) || err) };\n  }\n}\n\n// 見出しの「始まりの文字」で列を探す（見出しを少し書き足しても動くように）\nfunction tab_(ss, name) {\n  const sh = ss.getSheetByName(name);\n  if (!sh) throw new Error('「' + name + '」タブが見つかりません');\n  const v = sh.getDataRange().getDisplayValues();\n  const head = v[0] || [];\n  const col = function (prefix) { for (let i = 0; i < head.length; i++) if (String(head[i]).indexOf(prefix) === 0) return i; return -1; };\n  return { sh: sh, head: head, body: v.slice(1), col: col };\n}\nfunction cell_(row, i) { return i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim(); }\n// 列の中で、最後に値が入っている行（1始まり）。数式の空文字は値として数えない\nfunction lastRow_(sh, col) {\n  const n = sh.getMaxRows();\n  if (n < 2) return 1;\n  const v = sh.getRange(2, col, n - 1, 1).getDisplayValues();\n  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() !== '') return i + 2;\n  return 1;\n}\n\nfunction read_(ss) {\n  const S = tab_(ss, '曲'), R = tab_(ss, '音源'), P = tab_(ss, '提供者');\n  const sT = S.col('表示用曲名'), sW = S.col('作品名'), sA = S.col('表示用アーティスト'), sK = S.col('選択用');\n  const songs = S.body.filter(function (r) { return cell_(r, sT); }).map(function (r) {\n    return { t: cell_(r, sT), a: cell_(r, sA), w: cell_(r, sW), k: cell_(r, sK) || (cell_(r, sT) + '／' + cell_(r, sA)) };\n  });\n  const rS = R.col('曲（選ぶ）'), rN = R.col('音源名'), rKind = R.col('種類'), rKey = R.col('キー'), rU2 = R.col('URL（共有IDなし'), rU = R.col('URL（貼り付け'), rBy = R.col('提供者（選ぶ）'), rF = R.col('音源ファイルの保存場所');\n  const srcs = R.body.filter(function (r) { return cell_(r, rN); }).map(function (r) {\n    return { s: cell_(r, rS), n: cell_(r, rN), kind: cell_(r, rKind), key: cell_(r, rKey), u: cell_(r, rU2) || cell_(r, rU), by: cell_(r, rBy), f: cell_(r, rF) };\n  });\n  const pN = P.col('提供者名');\n  const providers = P.body.map(function (r) { return cell_(r, pN); }).filter(String);\n  let accounts = [];\n  try {\n    const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');\n    accounts = A.body.filter(function (r) { return cell_(r, aI); }).map(function (r) { return { id: cell_(r, aI), name: cell_(r, aN) }; });\n  } catch (err) { }\n  return { ok: true, version: 1, songs: songs, srcs: srcs, providers: providers, accounts: accounts };\n}\n\n// p.stream = {id, date, prof, title, addStream}\n// p.rows = [{n, ts, t, a, k, src:{n, u, by, kind}}]\nfunction log_(ss, p) {\n  const st = p.stream || {}, rows = Array.isArray(p.rows) ? p.rows.slice(0, 300) : [];\n  const id = String(st.id || '').trim().slice(0, 60);\n  if (!id) return { ok: false, error: '配信IDがありません' };\n  if (!rows.length) return { ok: false, error: '送る曲がありません' };\n  const L = tab_(ss, '配信ログ'), lId = L.col('配信ID');\n  if (L.body.some(function (r) { return cell_(r, lId) === id; })) return { ok: false, exists: true, error: '配信ログに、配信ID「' + id + '」の行がもうあります' };\n  const added = { songs: 0, srcs: 0, rows: 0, stream: 0 };\n\n  // 配信一覧：まだない配信IDなら1行足す（配信先・収益化は空欄。シートで選んでください）\n  if (st.addStream) {\n    const T = tab_(ss, '配信一覧'), tId = T.col('配信ID');\n    if (!T.body.some(function (r) { return cell_(r, tId) === id; })) {\n      let acc = '';\n      try {\n        const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');\n        A.body.forEach(function (r) { if (!acc && st.prof && cell_(r, aN) === String(st.prof)) acc = cell_(r, aI); });\n      } catch (err) { }\n      const r = lastRow_(T.sh, 1) + 1;\n      T.sh.getRange(r, 2).setNumberFormat('@');\n      T.sh.getRange(r, 1, 1, 3).setValues([[id, String(st.date || ''), acc]]);\n      if (st.title) T.sh.getRange(r, 6).setValue(String(st.title).slice(0, 300));\n      added.stream = 1;\n    }\n  }\n\n  // 曲：シートにない曲は「曲」タブに下書きとして足す（曲名・アーティスト・表記の状態）\n  const S = tab_(ss, '曲'), sT = S.col('表示用曲名'), sA = S.col('表示用アーティスト'), sK = S.col('選択用'), sState = S.col('表記の状態');\n  const songKeys = {};\n  S.body.forEach(function (r) { if (cell_(r, sT)) songKeys[cell_(r, sK) || (cell_(r, sT) + '／' + cell_(r, sA))] = 1; });\n  let sNext = lastRow_(S.sh, sT + 1) + 1;\n  rows.forEach(function (x) {\n    const k = String(x.k || (String(x.t || '') + '／' + String(x.a || ''))).slice(0, 420);\n    x.k = k;\n    if (songKeys[k] || !x.t) return;\n    S.sh.getRange(sNext, sT + 1).setValue(String(x.t).slice(0, 200));\n    if (sA >= 0) S.sh.getRange(sNext, sA + 1).setValue(String(x.a || '').slice(0, 200));\n    if (sState >= 0) S.sh.getRange(sNext, sState + 1).setValue('下書き・要確認');\n    songKeys[k] = 1; sNext++; added.songs++;\n  });\n\n  // 音源：シートにない音源は「音源」タブに足す（提供者は、提供者タブにある名前のときだけ入れる）\n  const R = tab_(ss, '音源'), rS = R.col('曲（選ぶ）'), rN = R.col('音源名'), rKind = R.col('種類'), rU = R.col('URL（貼り付け'), rBy = R.col('提供者（選ぶ）');\n  const P = tab_(ss, '提供者'), pN = P.col('提供者名');\n  const providers = {};\n  P.body.forEach(function (r) { if (cell_(r, pN)) providers[cell_(r, pN)] = 1; });\n  const srcNames = {};\n  R.body.forEach(function (r) { if (cell_(r, rN)) srcNames[cell_(r, rN)] = 1; });\n  let rNext = lastRow_(R.sh, rN + 1) + 1;\n  rows.forEach(function (x) {\n    const s = x.src;\n    if (!s || !s.n) return;\n    s.n = String(s.n).slice(0, 200);\n    if (srcNames[s.n]) return;\n    if (rS >= 0) R.sh.getRange(rNext, rS + 1).setValue(x.k);\n    R.sh.getRange(rNext, rN + 1).setValue(s.n);\n    if (rKind >= 0) R.sh.getRange(rNext, rKind + 1).setValue(/youtube\\.com|youtu\\.be/.test(String(s.u || '')) ? 'YouTube動画' : 'その他');\n    if (rU >= 0 && s.u) R.sh.getRange(rNext, rU + 1).setValue(String(s.u).slice(0, 500));\n    if (rBy >= 0 && s.by && providers[s.by]) R.sh.getRange(rNext, rBy + 1).setValue(s.by);\n    srcNames[s.n] = 1; rNext++; added.srcs++;\n  });\n\n  // 配信ログ：配信ID・順番・タイムスタンプ（文字）・区分「曲」・曲・音源\n  const values = rows.map(function (x, i) {\n    return [id, Number(x.n) || (i + 1), String(x.ts || ''), '曲', x.k, x.src && x.src.n ? x.src.n : ''];\n  });\n  const start = lastRow_(L.sh, 1) + 1;\n  L.sh.getRange(start, 3, values.length, 1).setNumberFormat('@');\n  L.sh.getRange(start, 1, values.length, 6).setValues(values);\n  added.rows = values.length;\n  return { ok: true, added: added, firstRow: start };\n}\n";
  const SHEET_LS='otonoha-sheet-link';
  // つなぎ先（URLと合言葉）はこのブラウザだけに置く。設定ファイル・書き出しには入れない
  function sheetLink(){try{const v=JSON.parse(localStorage.getItem(SHEET_LS)||'null');return v&&typeof v.url==='string'?v:null}catch(_){return null}}
  function sheetLinkSet(v){try{if(v)localStorage.setItem(SHEET_LS,JSON.stringify(v));else localStorage.removeItem(SHEET_LS);return true}catch(_){return false}}
  const sheetOk=u=>/^https:\/\/script\.google(usercontent)?\.com\/macros\/s\/[\w-]+\/exec$/.test(u);
  async function sheetCall(op,body){
    const l=sheetLink();
    if(!l)throw Error('先に、Apps Script のURLと合言葉を入れてください');
    let r;
    try{
      r=op==='log'
        ?await fetch(l.url,{method:'POST',body:JSON.stringify({op,key:l.key,...body}),redirect:'follow'})
        :await fetch(l.url+'?op='+encodeURIComponent(op)+'&key='+encodeURIComponent(l.key),{redirect:'follow'})
    }catch(_){throw Error('シートにつながりませんでした（URL・デプロイの「アクセスできるユーザー：全員」・ネットの接続をご確認ください）')}
    let j;
    try{j=JSON.parse(await r.text())}catch(_){throw Error('シートから読める返事が来ませんでした（URLがウェブアプリの「/exec」か、デプロイし直していないかをご確認ください）')}
    if(!j||j.ok!==true){const e=Error(j?.error||'シートで失敗しました');e.exists=!!j?.exists;throw e}
    return j
  }

  // ---- 読み込み（貼り付け・Apps Script 共通）
  // songs:[{t,a,w,k}]  srcs:[{s,n,kind,key,u,by,f}]
  function sheetImport(songs,srcs){
    const n={songs:0,srcs:0,newSongs:0,skip:0};
    const byKey=new Map();
    for(const r of repList())byKey.set(r.sk||r.title+'／'+r.artist,r);
    for(const x of songs||[]){
      const t=String(x.t||'').trim().slice(0,200),a=String(x.a||'').trim().slice(0,200);
      if(!t)continue;
      const had=repFind(t,a),r=repAdd(t,a);
      if(!r)break;
      if(!had)n.newSongs++;
      r.sk=String(x.k||t+'／'+a).slice(0,420);if(x.w)r.w=String(x.w).slice(0,200);
      byKey.set(r.sk,r);n.songs++
    }
    for(const x of srcs||[]){
      const key=String(x.s||'').trim();
      if(!x.n&&!x.u){n.skip++;continue}
      let r=byKey.get(key);
      if(!r&&key){const i=key.lastIndexOf('／');const t=i>0?key.slice(0,i):key,a=i>0?key.slice(i+1):'';const had=repFind(t,a);r=repAdd(t,a);if(r){if(!had)n.newSongs++;r.sk=key.slice(0,420);byKey.set(key,r)}}
      if(!r){n.skip++;continue}
      const u=x.u?okeNorm(x.u):'',f=/^https?:\/\//i.test(x.f||'')?String(x.f).slice(0,500):'';
      if(srcAdd(r,{u:u||'',n:String(x.n||''),by:String(x.by||''),k:String(x.key||''),kind:String(x.kind||''),f}))n.srcs++
    }
    saveNow();renderRep();renderSet();
    return n
  }
  // Googleスプレッドシートからコピーした表（タブ区切り。改行を含むセルは "…" で囲まれる）
  function tsvParse(text){
    const rows=[];let row=[],cell='',q=false;
    const s=String(text).replace(/\r\n?/g,'\n');
    for(let i=0;i<s.length;i++){
      const c=s[i];
      if(q){if(c==='"'){if(s[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c;continue}
      if(c==='"'&&cell===''){q=true;continue}
      if(c==='\t'){row.push(cell);cell='';continue}
      if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';continue}
      cell+=c
    }
    if(cell!==''||row.length){row.push(cell);rows.push(row)}
    return rows.filter(r=>r.some(x=>x.trim()))
  }
  function sheetPasteRead(text){
    const rows=tsvParse(text);
    if(rows.length<2)throw Error('見出しの行と、曲の行をいっしょにコピーして貼り付けてください');
    const head=rows[0].map(x=>x.trim()),col=p=>head.findIndex(h=>h.startsWith(p)),c=(r,i)=>i<0?'':String(r[i]??'').trim();
    if(col('表示用曲名')>=0){
      const t=col('表示用曲名'),a=col('表示用アーティスト'),w=col('作品名'),k=col('選択用');
      return {kind:'曲',songs:rows.slice(1).map(r=>({t:c(r,t),a:c(r,a),w:c(r,w),k:c(r,k)})).filter(x=>x.t)}
    }
    if(col('音源名')>=0){
      const s=col('曲（選ぶ）'),nm=col('音源名'),kind=col('種類'),key=col('キー'),u2=col('URL（共有IDなし'),u=col('URL（貼り付け'),by=col('提供者（選ぶ）'),f=col('音源ファイルの保存場所');
      return {kind:'音源',srcs:rows.slice(1).map(r=>({s:c(r,s),n:c(r,nm),kind:c(r,kind),key:c(r,key),u:c(r,u2)||c(r,u),by:c(r,by),f:c(r,f)})).filter(x=>x.n||x.u)}
    }
    throw Error('「曲」タブか「音源」タブの見出し（表示用曲名／音源名）が見つかりません。見出しの行からコピーしてください')
  }
  const sheetSay=(id,t)=>{const el=E(id);if(el)el.textContent=t};
  const importText=n=>'曲 '+n.songs+'曲（新しく '+n.newSongs+'曲）・音源 '+n.srcs+'件を読み込みました'+(n.skip?'（読めなかった行 '+n.skip+'）':'');
  E('sheetPasteGo').onclick=()=>{
    try{
      const r=sheetPasteRead(E('sheetPaste').value),n=sheetImport(r.songs,r.srcs);
      sheetSay('sheetPasteInfo','「'+r.kind+'」タブから'+(r.kind==='曲'?'曲 '+n.songs+'曲（新しく '+n.newSongs+'曲）':'音源 '+n.srcs+'件（新しい曲 '+n.newSongs+'曲）')+'を読み込みました');
      E('sheetPaste').value=''
    }catch(e){sheetSay('sheetPasteInfo',e.message)}
  };

  // ---- Apps Script
  function renderSheet(){
    const l=sheetLink();
    E('sheetUrl').value=l?.url||'';E('sheetKey').value=l?.key||'';
    sheetSay('sheetInfo',l?'つなぎ先を保存しています'+(l.name?'（'+l.name+'）':''):'まだつないでいません');
    E('sheetRead').disabled=E('sheetForget').disabled=!l
  }
  E('sheetGasCopy').onclick=()=>copy(SHEET_GAS);
  E('sheetGasSave').onclick=()=>bridgeSave('otonoha-sheet.gs.txt',SHEET_GAS,'text/plain');
  E('sheetSave').onclick=async()=>{
    const url=E('sheetUrl').value.trim(),key=E('sheetKey').value;
    if(!sheetOk(url)){sheetSay('sheetInfo','URLは「https://script.google.com/macros/s/…/exec」の形です（デプロイで出る「ウェブアプリ」のURL）');return}
    if(key.length<6){sheetSay('sheetInfo','合言葉は6文字以上にしてください（Apps Script の OTONOHA_KEY と同じもの）');return}
    if(!sheetLinkSet({url,key})){sheetSay('sheetInfo','このブラウザに保存できませんでした');return}
    sheetSay('sheetInfo','確かめています…');
    try{const j=await sheetCall('ping');sheetLinkSet({url,key,name:j.name||''});renderSheet();sheetSay('sheetInfo','つながりました：'+(j.name||'スプレッドシート'))}
    catch(e){renderSheet();sheetSay('sheetInfo','保存しましたが、つながりませんでした：'+e.message)}
  };
  E('sheetRead').onclick=async()=>{
    sheetSay('sheetInfo','読み込んでいます…');
    try{const j=await sheetCall('read');const n=sheetImport(j.songs,j.srcs);sheetSay('sheetInfo',importText(n))}
    catch(e){sheetSay('sheetInfo',e.message)}
  };
  E('sheetForget').onclick=e=>armed(e.currentTarget,'もう一度押すと、このブラウザからつなぎ先を消す',()=>{sheetLinkSet(null);renderSheet()});

  // ---- 配信ログへ：回ごとの記録から行を作る
  const tsSheet=sec=>{sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return h?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};
  function sheetRows(s){
    return s.items.map((x,i)=>{
      const r=repFind(x.title,x.artist),t=Number.isFinite(x.ts)?x.ts:x.off;
      const src=(r?.srcs||[]).find(y=>x.src&&(y.n===x.src||y.u===x.src))||null;
      const name=src?(src.n||(x.title+' / '+(src.by||'カラオケ音源'))):'';
      return {n:i+1,ts:tsSheet(t),t:x.title,a:x.artist,k:r?.sk||x.title+'／'+x.artist,src:src?{n:name,u:src.u,by:src.by}:null}
    })
  }
  const sheetDefaultId=s=>{const d=new Date(s.start);return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')};
  function sheetBox(s,box){
    const info=state.sessInfo[s.id]||(state.sessInfo[s.id]={url:''});
    box.replaceChildren();
    const idL=document.createElement('label');idL.className='studio-field';
    const id=document.createElement('input');id.maxLength=60;id.value=info.sheet?.id||sheetDefaultId(s);idL.append('配信ID（配信一覧・配信ログの「配信ID」）',id);
    const ttL=document.createElement('label');ttL.className='studio-field';
    const tt=document.createElement('input');tt.maxLength=300;tt.placeholder='任意';ttL.append('枠タイトル（配信一覧に入れる）',tt);
    const addL=document.createElement('label');addL.className='studio-field';
    const add=document.createElement('input');add.type='checkbox';add.checked=true;addL.append(add,' 配信一覧にも、この配信の行を足す（配信先・収益化はシートで選びます）');
    const say=document.createElement('p');say.className='studio-mini';say.setAttribute('aria-live','polite');
    say.textContent=info.sheet?.at?'送った日時：'+localTime(info.sheet.at)+'（配信ID '+info.sheet.id+'）':'時刻は、概要欄で入れた時刻を使い、入れていない曲は記録した経過時間を使います。';
    const row=document.createElement('div');row.className='studio-row';
    const send=rowBtn('シートの配信ログへ送る','accent',async()=>{
      const c=sessOf(s.id);if(!c||!c.items.length){say.textContent='送る曲がありません';return}
      const sid=id.value.trim();if(!sid){say.textContent='配信IDを入れてください';return}
      const d=new Date(c.start);
      say.textContent='送っています…';send.disabled=true;
      try{
        const j=await sheetCall('log',{stream:{id:sid,date:d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate(),prof:c.prof||'',title:tt.value.trim(),addStream:add.checked},rows:sheetRows(c)});
        info.sheet={id:sid,at:new Date().toISOString()};saveNow();
        const a=j.added||{};
        say.textContent='送りました：配信ログ '+(a.rows||0)+'行'+(a.stream?'・配信一覧 1行':'')+(a.songs?'・曲タブに新しい曲 '+a.songs+'曲（表記の状態「下書き・要確認」）':'')+(a.srcs?'・音源タブに新しい音源 '+a.srcs+'件':'')+'。判定はシートの配信ログでご確認ください。'
      }catch(e){say.textContent=(e.exists?'送りませんでした：':'')+e.message+(e.exists?'（配信IDを変えると送れます）':'')}
      send.disabled=false
    });
    const cp=rowBtn('配信ログ用にコピー（貼り付けで入れる）','',()=>{
      const c=sessOf(s.id);if(!c)return;const sid=id.value.trim()||sheetDefaultId(c);
      copy(sheetRows(c).map(x=>[sid,x.n,x.ts,'曲',x.k,x.src?.n||''].map(v=>String(v).replace(/[\t\n]/g,' ')).join('\t')).join('\n'));
      say.textContent='コピーしました。シートの配信ログで、空いている行のA列（配信ID）を選んで貼り付けます。配信一覧に配信IDの行がないと、判定が出ません。'
    });
    row.append(send,cp);
    if(!sheetLink())send.disabled=true,send.title='「歌枠管理シートとつなぐ」で、Apps Script をつなぐと使えます';
    box.append(idL,ttL,addL,row,say)
  }
