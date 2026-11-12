/**
 * 配信処オトノハ ⇄ 歌枠管理シート（Apps Script・版2）
 * 1. 下の OTONOHA_KEY を、自分だけの合言葉に書き換えます（英数字で12文字以上がおすすめ）。
 * 2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」、次のユーザーとして実行「自分」、アクセスできるユーザー「全員」。
 * 3. 出てきたウェブアプリのURLと合言葉を、オトノハの「歌枠管理シートとつなぐ」に入れます。
 * このスクリプトが書き込むのは、手で入力する列（「曲」A・C・E列、「音源」A〜E・G列、「配信一覧」A〜C・F列、「配信ログ」A〜F列）だけです。自動の列には書きません。
 */
const OTONOHA_KEY = 'ここに合言葉';

function doGet(e) { return out_(handle_((e && e.parameter) || {})); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: '送られた内容が読めません' }); }
  return out_(handle_(body));
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle_(p) {
  if (!OTONOHA_KEY || OTONOHA_KEY === 'ここに合言葉') return { ok: false, error: 'Apps Script の OTONOHA_KEY に合言葉を書いて、デプロイし直してください' };
  if (String(p.key || '') !== OTONOHA_KEY) return { ok: false, error: '合言葉が違います' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (p.op === 'ping') return { ok: true, version: 1, name: ss.getName() };
    if (p.op === 'read') return read_(ss);
    if (p.op === 'log') {
      const lock = LockService.getDocumentLock();
      lock.waitLock(20000);
      try { return log_(ss, p); } finally { lock.releaseLock(); }
    }
    return { ok: false, error: '知らない操作です：' + String(p.op || '') };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

// 見出しの「始まりの文字」で列を探す（見出しを少し書き足しても動くように）
function tab_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('「' + name + '」タブが見つかりません');
  const v = sh.getDataRange().getDisplayValues();
  const head = v[0] || [];
  const col = function (prefix) { for (let i = 0; i < head.length; i++) if (String(head[i]).indexOf(prefix) === 0) return i; return -1; };
  return { sh: sh, head: head, body: v.slice(1), col: col };
}
function cell_(row, i) { return i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim(); }
// 列の中で、最後に値が入っている行（1始まり）。数式の空文字は値として数えない
function lastRow_(sh, col) {
  const n = sh.getMaxRows();
  if (n < 2) return 1;
  const v = sh.getRange(2, col, n - 1, 1).getDisplayValues();
  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() !== '') return i + 2;
  return 1;
}

function read_(ss) {
  const S = tab_(ss, '曲'), R = tab_(ss, '音源'), P = tab_(ss, '提供者');
  const sT = S.col('表示用曲名'), sW = S.col('作品名'), sA = S.col('表示用アーティスト'), sK = S.col('選択用'), sG = S.col('ラベル');
  const songs = S.body.filter(function (r) { return cell_(r, sT); }).map(function (r) {
    const o = { t: cell_(r, sT), a: cell_(r, sA), w: cell_(r, sW), k: cell_(r, sK) || (cell_(r, sT) + '／' + cell_(r, sA)) };
    // 「ラベル」で始まる見出しの列があるときだけ、ラベルも送る（歌枠ルーレットのしぼりこみ用）
    if (sG >= 0) o.g = cell_(r, sG);
    return o;
  });
  const rS = R.col('曲（選ぶ）'), rN = R.col('音源名'), rKind = R.col('種類'), rKey = R.col('キー'), rU2 = R.col('URL（共有IDなし'), rU = R.col('URL（貼り付け'), rBy = R.col('提供者（選ぶ）'), rF = R.col('音源ファイルの保存場所');
  const srcs = R.body.filter(function (r) { return cell_(r, rN); }).map(function (r) {
    return { s: cell_(r, rS), n: cell_(r, rN), kind: cell_(r, rKind), key: cell_(r, rKey), u: cell_(r, rU2) || cell_(r, rU), by: cell_(r, rBy), f: cell_(r, rF) };
  });
  const pN = P.col('提供者名');
  const providers = P.body.map(function (r) { return cell_(r, pN); }).filter(String);
  let accounts = [];
  try {
    const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');
    accounts = A.body.filter(function (r) { return cell_(r, aI); }).map(function (r) { return { id: cell_(r, aI), name: cell_(r, aN) }; });
  } catch (err) { }
  return { ok: true, version: 1, songs: songs, srcs: srcs, providers: providers, accounts: accounts };
}

// p.stream = {id, date, prof, title, addStream}
// p.rows = [{n, ts, t, a, k, src:{n, u, by, kind}}]
function log_(ss, p) {
  const st = p.stream || {}, rows = Array.isArray(p.rows) ? p.rows.slice(0, 300) : [];
  const id = String(st.id || '').trim().slice(0, 60);
  if (!id) return { ok: false, error: '配信IDがありません' };
  if (!rows.length) return { ok: false, error: '送る曲がありません' };
  const L = tab_(ss, '配信ログ'), lId = L.col('配信ID');
  if (L.body.some(function (r) { return cell_(r, lId) === id; })) return { ok: false, exists: true, error: '配信ログに、配信ID「' + id + '」の行がもうあります' };
  const added = { songs: 0, srcs: 0, rows: 0, stream: 0 };

  // 配信一覧：まだない配信IDなら1行足す（配信先・収益化は空欄。シートで選んでください）
  if (st.addStream) {
    const T = tab_(ss, '配信一覧'), tId = T.col('配信ID');
    if (!T.body.some(function (r) { return cell_(r, tId) === id; })) {
      let acc = '';
      try {
        const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');
        A.body.forEach(function (r) { if (!acc && st.prof && cell_(r, aN) === String(st.prof)) acc = cell_(r, aI); });
      } catch (err) { }
      const r = lastRow_(T.sh, 1) + 1;
      T.sh.getRange(r, 2).setNumberFormat('@');
      T.sh.getRange(r, 1, 1, 3).setValues([[id, String(st.date || ''), acc]]);
      if (st.title) T.sh.getRange(r, 6).setValue(String(st.title).slice(0, 300));
      added.stream = 1;
    }
  }

  // 曲：シートにない曲は「曲」タブに下書きとして足す（曲名・アーティスト・表記の状態）
  const S = tab_(ss, '曲'), sT = S.col('表示用曲名'), sA = S.col('表示用アーティスト'), sK = S.col('選択用'), sState = S.col('表記の状態');
  const songKeys = {};
  S.body.forEach(function (r) { if (cell_(r, sT)) songKeys[cell_(r, sK) || (cell_(r, sT) + '／' + cell_(r, sA))] = 1; });
  let sNext = lastRow_(S.sh, sT + 1) + 1;
  rows.forEach(function (x) {
    const k = String(x.k || (String(x.t || '') + '／' + String(x.a || ''))).slice(0, 420);
    x.k = k;
    if (songKeys[k] || !x.t) return;
    S.sh.getRange(sNext, sT + 1).setValue(String(x.t).slice(0, 200));
    if (sA >= 0) S.sh.getRange(sNext, sA + 1).setValue(String(x.a || '').slice(0, 200));
    if (sState >= 0) S.sh.getRange(sNext, sState + 1).setValue('下書き・要確認');
    songKeys[k] = 1; sNext++; added.songs++;
  });

  // 音源：シートにない音源は「音源」タブに足す（提供者は、提供者タブにある名前のときだけ入れる）
  const R = tab_(ss, '音源'), rS = R.col('曲（選ぶ）'), rN = R.col('音源名'), rKind = R.col('種類'), rU = R.col('URL（貼り付け'), rBy = R.col('提供者（選ぶ）');
  const P = tab_(ss, '提供者'), pN = P.col('提供者名');
  const providers = {};
  P.body.forEach(function (r) { if (cell_(r, pN)) providers[cell_(r, pN)] = 1; });
  const srcNames = {};
  R.body.forEach(function (r) { if (cell_(r, rN)) srcNames[cell_(r, rN)] = 1; });
  let rNext = lastRow_(R.sh, rN + 1) + 1;
  rows.forEach(function (x) {
    const s = x.src;
    if (!s || !s.n) return;
    s.n = String(s.n).slice(0, 200);
    if (srcNames[s.n]) return;
    if (rS >= 0) R.sh.getRange(rNext, rS + 1).setValue(x.k);
    R.sh.getRange(rNext, rN + 1).setValue(s.n);
    if (rKind >= 0) R.sh.getRange(rNext, rKind + 1).setValue(/youtube\.com|youtu\.be/.test(String(s.u || '')) ? 'YouTube動画' : 'その他');
    if (rU >= 0 && s.u) R.sh.getRange(rNext, rU + 1).setValue(String(s.u).slice(0, 500));
    if (rBy >= 0 && s.by && providers[s.by]) R.sh.getRange(rNext, rBy + 1).setValue(s.by);
    srcNames[s.n] = 1; rNext++; added.srcs++;
  });

  // 配信ログ：配信ID・順番・タイムスタンプ（文字）・区分「曲」・曲・音源
  const values = rows.map(function (x, i) {
    return [id, Number(x.n) || (i + 1), String(x.ts || ''), '曲', x.k, x.src && x.src.n ? x.src.n : ''];
  });
  const start = lastRow_(L.sh, 1) + 1;
  L.sh.getRange(start, 3, values.length, 1).setNumberFormat('@');
  L.sh.getRange(start, 1, values.length, 6).setValues(values);
  added.rows = values.length;
  return { ok: true, added: added, firstRow: start };
}
