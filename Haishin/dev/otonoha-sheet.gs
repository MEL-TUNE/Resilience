/**
 * 配信処オトノハ ⇄ 歌枠管理シート（Apps Script・版4）
 * @OnlyCurrentDoc  … このスクリプトが触れられるのは、このスプレッドシートだけです（ドライブのほかのファイルには触れません）
 *
 * 1. 下の OTONOHA_KEY を、自分だけの合言葉に書き換えます（英数字で12文字以上がおすすめ）。
 * 2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」、次のユーザーとして実行「自分」、アクセスできるユーザー「全員」。
 *    版2・版3から入れ替えるときは、デプロイ → デプロイを管理 → 鉛筆の印 → バージョン「新バージョン」→ デプロイ（URLは変わりません）。
 * 3. 出てきたウェブアプリのURLと合言葉を、オトノハの「歌枠管理シートとつなぐ」に入れます。
 *
 * 書き込むのは、1行目に数式がない列（手で入力する列）だけです。1行目が数式の列（自動の列）には書きません。
 * 版3で足したこと：シートの編集（曲・音源・提供者を足す・直す）、ラベル（「ラベル一覧」タブと「曲」タブのラベル列）、
 *   「編集の記録」タブ（オトノハから直した項目の、前と後の値）、控え（「曲」「音源」「提供者」「ラベル一覧」タブを、このシートの中に写して隠す）。
 * 曲名・アーティスト・音源名・提供者名を直したときは、それを選んでいる「音源」「配信ログ」の行も新しい名前に付け替えます。
 * 版4で足したこと（配信ログへ送るところ）：配信一覧の「配信先」「収益化」「枠タイトル」も書く、
 *   オープニング・エンディング・トーク・企画の行も送る、同じ配信IDを送り直す（その配信IDの配信ログの行を入れ替える）。
 * 曲・音源・提供者の行を消す働きはありません（消すときは、シートで行を選んで消します）。
 */
const OTONOHA_KEY = 'ここに合言葉';
const GAS_VERSION = 4;

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
    if (p.op === 'ping') return { ok: true, version: GAS_VERSION, name: ss.getName(), id: ss.getId() };
    if (p.op === 'read') return read_(ss);
    if (p.op === 'sheet') return sheet_(ss);
    if (p.op === 'history') return history_(ss, p);
    const writers = { log: log_, save: save_, labels: labels_, setup: setup_, backup: backup_ };
    if (writers[p.op]) {
      const lock = LockService.getDocumentLock();
      lock.waitLock(20000);
      try { return writers[p.op](ss, p); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
    }
    return { ok: false, error: '知らない操作です：' + String(p.op || '') };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

// 見出しで列を探す（まず見出しと同じ文字、なければ見出しの「始まりの文字」）。auto[i] は1行目が数式の列（自動の列）
function tab_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('「' + name + '」タブが見つかりません');
  const v = sh.getDataRange().getDisplayValues();
  const head = (v[0] || []).map(function (h) { return String(h).trim(); });
  const fx = head.length ? sh.getRange(1, 1, 1, head.length).getFormulas()[0] : [];
  const auto = fx.map(function (f) { return !!f; });
  const col = function (prefix) {
    for (let i = 0; i < head.length; i++) if (head[i] === prefix) return i;
    for (let i = 0; i < head.length; i++) if (head[i].indexOf(prefix) === 0) return i;
    return -1;
  };
  return { sh: sh, head: head, auto: auto, body: v.slice(1), col: col };
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
  const rS = R.col('曲（選ぶ）'), rN = R.col('音源名'), rKind = R.col('種類'), rKey = R.col('キー'), rU2 = R.col('URL（共有IDなし'), rU = R.col('URL（貼り付け'), rBy = R.col('提供者（選ぶ）'), rF = R.col('音源ファイルの保存場所'), rKK = R.col('キーの区分'), rLy = R.col('動画内の歌詞表示');
  const srcs = R.body.filter(function (r) { return cell_(r, rN); }).map(function (r) {
    return { s: cell_(r, rS), n: cell_(r, rN), kind: cell_(r, rKind), key: cell_(r, rKey), u: cell_(r, rU2) || cell_(r, rU), by: cell_(r, rBy), f: cell_(r, rF), kk: cell_(r, rKK), ly: cell_(r, rLy) };
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

// p.stream = {id, date, prof, title, addStream, dest, mon, replace}
// p.rows = [{n, ts, kind, t, a, k, src:{n, u, by}}]。kind は「曲」（空も曲）か、オープニング・エンディング・トーク・企画
const LOG_KINDS_ = { 'オープニング': 1, 'エンディング': 1, 'トーク・企画': 1 };
function log_(ss, p) {
  const st = p.stream || {}, rows = Array.isArray(p.rows) ? p.rows.slice(0, 300) : [];
  const id = String(st.id || '').trim().slice(0, 60);
  if (!id) return { ok: false, error: '配信IDがありません' };
  if (!rows.length) return { ok: false, error: '送る曲がありません' };
  let L = tab_(ss, '配信ログ');
  const lId = L.col('配信ID');
  const added = { songs: 0, srcs: 0, rows: 0, stream: 0, replaced: 0 };
  const has = [];
  L.body.forEach(function (r, i) { if (cell_(r, lId) === id) has.push(i + 2); });
  if (has.length && !st.replace) return { ok: false, exists: true, error: '配信ログに、配信ID「' + id + '」の行がもうあります' };
  // 送り直し：その配信IDの行を消してから入れる（下の行から消す）
  for (let i = has.length - 1; i >= 0; i--) { L.sh.deleteRow(has[i]); added.replaced++; }
  if (has.length) L = tab_(ss, '配信ログ');

  // 配信一覧：まだない配信IDなら1行足す。配信先・収益化・枠タイトルは、送られてきたものだけ書く（空のものは、いまの値を残す）
  {
    const T = tab_(ss, '配信一覧'), tId = T.col('配信ID'), tDate = T.col('配信日'), tAcc = T.col('アカウントID'), tDest = T.col('配信先'), tMon = T.col('収益化'), tTitle = T.col('枠タイトル');
    let r = 0;
    T.body.forEach(function (x, i) { if (!r && cell_(x, tId) === id) r = i + 2; });
    if (!r && st.addStream) {
      let acc = '';
      try {
        const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');
        A.body.forEach(function (x) { if (!acc && st.prof && cell_(x, aN) === String(st.prof)) acc = cell_(x, aI); });
      } catch (err) { }
      r = lastRow_(T.sh, tId + 1) + 1;
      T.sh.getRange(r, tId + 1).setValue(id);
      if (tDate >= 0) { T.sh.getRange(r, tDate + 1).setNumberFormat('@'); T.sh.getRange(r, tDate + 1).setValue(String(st.date || '')); }
      if (tAcc >= 0 && acc) T.sh.getRange(r, tAcc + 1).setValue(acc);
      added.stream = 1;
    }
    if (r) {
      const put = function (c, v) { v = String(v == null ? '' : v).trim(); if (c >= 0 && v && !T.auto[c]) T.sh.getRange(r, c + 1).setValue(text_(v.slice(0, 300))); };
      put(tDest, st.dest); put(tMon, st.mon); put(tTitle, st.title);
    }
  }
  const songRows = rows.filter(function (x) { return !LOG_KINDS_[String(x.kind || '')]; });

  // 曲：シートにない曲は「曲」タブに下書きとして足す（曲名・アーティスト・表記の状態）
  const S = tab_(ss, '曲'), sT = S.col('表示用曲名'), sA = S.col('表示用アーティスト'), sK = S.col('選択用'), sState = S.col('表記の状態');
  const songKeys = {};
  S.body.forEach(function (r) { if (cell_(r, sT)) songKeys[cell_(r, sK) || (cell_(r, sT) + '／' + cell_(r, sA))] = 1; });
  let sNext = lastRow_(S.sh, sT + 1) + 1;
  songRows.forEach(function (x) {
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
  songRows.forEach(function (x) {
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
    const kind = String(x.kind || '');
    if (LOG_KINDS_[kind]) return [id, Number(x.n) || (i + 1), String(x.ts || ''), kind, '', ''];
    return [id, Number(x.n) || (i + 1), String(x.ts || ''), '曲', x.k, x.src && x.src.n ? x.src.n : ''];
  });
  const start = lastRow_(L.sh, 1) + 1;
  L.sh.getRange(start, 3, values.length, 1).setNumberFormat('@');
  L.sh.getRange(start, 1, values.length, 6).setValues(values);
  added.rows = values.length;
  return { ok: true, added: added, firstRow: start };
}

// ===================== 版3：シートの編集 =====================

// 画面の項目 → 見出し（「始まりの文字」で探す）。ここにない列には書きません
const FIELDS_ = {
  '曲': { t: '表示用曲名', w: '作品名', a: '表示用アーティスト', y: '読み', st: '表記の状態', lu: '歌詞ページのURL', org: '管理団体', code: '作品コード', jt: '作品タイトル', ja: 'アーティスト名', ly: '作詞者', cp: '作曲者', memo: 'メモ', rt: '管理団体の登録表記（曲名', ra: '管理団体の登録表記（アーティスト', set: 'セトリでの表記', g: 'ラベル' },
  '音源': { s: '曲（選ぶ）', n: '音源名', kind: '種類', key: 'キー', u: 'URL（貼り付け', by: '提供者（選ぶ）', yt: '個別：YouTube配信', mon: '個別：収益化配信', oth: '個別：YouTube以外', cond: '個別の利用条件', memo: 'メモ', f: '音源ファイルの保存場所', who: '使える名義', kk: 'キーの区分', lyr: '動画内の歌詞表示' },
  '提供者': { n: '提供者名', url: '概要欄に載せるURL', yt: 'YouTube配信で使用', mon: '収益化済み配信で使用', oth: 'YouTube以外の配信', cr: 'クレジット表記の指定', tu: '利用規約・説明のURL', d: '確認日', memo: 'メモ', raw: '規約・説明の原文', y: '読み' }
};
// 1行を見分ける項目（曲は「曲名／アーティスト」、音源と提供者は名前）。ほかのタブから、この文字で選ばれています
const ID_ = { '曲': ['t', 'a'], '音源': ['n'], '提供者': ['n'] };
const LABEL_TAB_ = 'ラベル一覧';
const LABEL_HEAD_ = ['ラベル', '分類', '記号', 'メモ'];

function cols_(T, tab) {
  const m = {}, f = FIELDS_[tab];
  Object.keys(f).forEach(function (k) { const i = T.col(f[k]); if (i >= 0 && !T.auto[i]) m[k] = i; });
  return m;
}
function rowObj_(r, m) { const o = {}; Object.keys(m).forEach(function (k) { o[k] = cell_(r, m[k]); }); return o; }
const tagSplit_ = function (v) {
  const seen = {}, out = [];
  String(v || '').split(/[、,，\/／\n]/).forEach(function (x) { x = x.trim(); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out;
};
// 並べ替えの文字：読み（なければ曲名）。英数字が先、かなが後
function sortKey_(y, t) {
  const s = String(y || t || '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  return (/^[a-z0-9]/.test(s) ? '0' : '1') + s;
}
// プルダウン（一覧から選ぶ）の選択肢を、2行目の入力規則から読む
function listOpts_(T, i) {
  if (i < 0) return null;
  try {
    const dv = T.sh.getRange(2, i + 1).getDataValidation();
    if (!dv || dv.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return null;
    return (dv.getCriteriaValues()[0] || []).map(String);
  } catch (err) { return null; }
}
function labelTab_(ss) {
  const sh = ss.getSheetByName(LABEL_TAB_);
  if (!sh) return null;
  const v = sh.getDataRange().getDisplayValues().slice(1);
  return { sh: sh, list: v.filter(function (r) { return cell_(r, 0); }).map(function (r) { return { name: cell_(r, 0), group: cell_(r, 1), mark: cell_(r, 2), memo: cell_(r, 3) }; }) };
}

// 編集画面用に、手で入れる列をすべて読む（r はシートの行番号）
function sheet_(ss) {
  const out = { ok: true, version: GAS_VERSION, name: ss.getName(), id: ss.getId(), opts: {} };
  [['曲', 'songs'], ['音源', 'srcs'], ['提供者', 'provs']].forEach(function (x) {
    const T = tab_(ss, x[0]), m = cols_(T, x[0]), idc = m[ID_[x[0]][0]];
    out[x[1]] = [];
    T.body.forEach(function (r, i) { if (cell_(r, idc)) { const o = rowObj_(r, m); o.r = i + 2; out[x[1]].push(o); } });
    const opts = {};
    Object.keys(m).forEach(function (k) { const l = listOpts_(T, m[k]); if (l) opts[k] = l; });
    out.opts[x[0]] = opts;
    out[x[1] + 'Cols'] = Object.keys(m);
  });
  const L = labelTab_(ss);
  out.labels = L ? L.list : null;
  try {
    const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');
    out.accounts = A.body.filter(function (r) { return cell_(r, aI); }).map(function (r) { return { id: cell_(r, aI), name: cell_(r, aN) }; });
  } catch (err) { out.accounts = []; }
  return out;
}

// 新しい行の場所：曲・提供者は読みの順の位置に1行差し込む。音源はいちばん下に足す
function newRow_(T, m, tab, f) {
  const sh = T.sh, idc = m[ID_[tab][0]];
  const last = lastRow_(sh, idc + 1);
  let at = last + 1;
  if (tab !== '音源') {
    const key = sortKey_(f.y, f[ID_[tab][0]]);
    for (let i = 0; i < T.body.length && i + 2 <= last; i++) {
      const r = T.body[i];
      if (!cell_(r, idc)) continue;
      if (sortKey_(m.y >= 0 ? cell_(r, m.y) : '', cell_(r, idc)) > key) { at = i + 2; break; }
    }
  }
  const width = sh.getMaxColumns();
  if (at <= last) {
    sh.insertRowBefore(at);
    const from = sh.getRange(at + 1, 1, 1, width), to = sh.getRange(at, 1, 1, width);
    from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  } else {
    if (at > sh.getMaxRows()) sh.insertRowAfter(sh.getMaxRows());
    if (last >= 2) {
      const from = sh.getRange(last, 1, 1, width), to = sh.getRange(at, 1, 1, width);
      from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    }
  }
  return at;
}

// 名前を直したとき、ほかのタブでその名前を選んでいるセルを付け替える
function relink_(ss, tabName, prefix, oldV, newV) {
  if (!oldV || oldV === newV) return 0;
  const T = tab_(ss, tabName), c = T.col(prefix);
  if (c < 0 || T.auto[c]) return 0;
  let n = 0;
  T.body.forEach(function (r, i) {
    if (String(r[c]) === oldV) { const cell = T.sh.getRange(i + 2, c + 1); cell.setNumberFormat('@'); cell.setValue(text_(newV)); n++; }
  });
  return n;
}

const LIMIT_ = { raw: 45000, cond: 5000, memo: 5000 };
function clean_(k, v) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim().slice(0, LIMIT_[k] || 1000); }

// p = {tab, r, before:{項目:シートで見た値}, f:{項目:新しい値}}。r が 0 なら新しい行
function save_(ss, p) {
  const tab = String(p.tab || '');
  if (!FIELDS_[tab]) return { ok: false, error: '知らないタブです：' + tab };
  const T = tab_(ss, tab), m = cols_(T, tab), ids = ID_[tab];
  const f = {}, before = p.before || {};
  Object.keys(p.f || {}).forEach(function (k) {
    if (!(k in FIELDS_[tab])) throw new Error('知らない項目です：' + k);
    if (!(k in m)) throw new Error('「' + tab + '」タブに「' + FIELDS_[tab][k] + '」の列が見つからないか、自動の列です');
    f[k] = clean_(k, p.f[k]);
  });
  if (f.g != null) f.g = tagSplit_(f.g).join('、');
  let row = Number(p.r) || 0, cur = null;
  if (row) {
    // シートで見た行と、いまの行が同じかを確かめる（ほかの端末で直した・行がずれた、を見つける）
    const same = function (r) { return ids.every(function (k) { return cell_(r, m[k]) === String(before[k] == null ? '' : before[k]).trim(); }); };
    let i = row - 2;
    if (!(T.body[i] && same(T.body[i]))) { i = T.body.findIndex(same); row = i + 2; }
    if (i < 0) return { ok: false, conflict: true, error: 'シートのほうで、この行が変わっているか見つかりません。読み直してから直してください' };
    cur = rowObj_(T.body[i], m);
    const changed = Object.keys(before).filter(function (k) { return k in m && cur[k] !== String(before[k] == null ? '' : before[k]).trim(); });
    if (changed.length) return { ok: false, conflict: true, error: 'シートのほうで「' + changed.map(function (k) { return FIELDS_[tab][k]; }).join('」「') + '」が変わっています。読み直してから直してください' };
  }
  const next = {};
  Object.keys(m).forEach(function (k) { next[k] = k in f ? f[k] : (cur ? cur[k] : ''); });
  if (!next[ids[0]]) return { ok: false, error: '「' + FIELDS_[tab][ids[0]] + '」は空にできません' };
  const idOf = function (o) { return ids.map(function (k) { return o[k] || ''; }).join('／'); };
  const nid = idOf(next);
  const dup = T.body.some(function (r, i) { return i + 2 !== row && cell_(r, m[ids[0]]) && idOf(rowObj_(r, m)) === nid; });
  if (dup) return { ok: false, error: tab === '曲' ? '同じ曲名・アーティストの曲がもうあります' : '同じ名前の' + tab + 'がもうあります（名前で選ぶので、重ならない名前にしてください）' };
  if (tab === '音源' && next.s) {
    const S = tab_(ss, '曲'), k = S.col('選択用');
    if (k >= 0 && !S.body.some(function (r) { return cell_(r, k) === next.s; })) return { ok: false, error: '「曲」タブに「' + next.s + '」がありません' };
  }
  const added = !row;
  if (added) row = newRow_(T, m, tab, next);
  const keys = added ? Object.keys(next).filter(function (k) { return next[k] !== ''; }) : Object.keys(f).filter(function (k) { return f[k] !== cur[k]; });
  keys.forEach(function (k) { const cell = T.sh.getRange(row, m[k] + 1); cell.setNumberFormat('@'); cell.setValue(text_(next[k])); });
  const moved = { srcs: 0, logs: 0 };
  if (!added && cur) {
    if (tab === '曲') {
      const o = cur.t + '／' + cur.a, n = next.t + '／' + next.a;
      moved.srcs = relink_(ss, '音源', '曲（選ぶ）', o, n);
      moved.logs = relink_(ss, '配信ログ', '曲（選ぶ）', o, n);
    } else if (tab === '音源') moved.logs = relink_(ss, '配信ログ', '音源（選ぶ）', cur.n, next.n);
    else if (tab === '提供者') moved.srcs = relink_(ss, '音源', '提供者（選ぶ）', cur.n, next.n);
  }
  const now = stamp_(ss), name = idOf(next), log = keys.map(function (k) {
    return [now, tab, name, T.head[m[k]] || FIELDS_[tab][k], added ? '' : cur[k], next[k], added ? '足した' : '直した', k];
  });
  if (moved.srcs || moved.logs) log.push([now, tab, name, 'ほかのタブの付け替え', idOf(cur), name, '付け替え', '', '音源 ' + moved.srcs + '行・配信ログ ' + moved.logs + '行']);
  hist_(ss, log);
  next.r = row;
  return { ok: true, added: added, r: row, rec: next, wrote: keys, moved: moved, at: now };
}

// 「ラベル一覧」タブと、「曲」タブの「ラベル」列を作る（ないときだけ）
function setup_(ss, p) {
  const made = { tab: false, col: false };
  let L = ss.getSheetByName(LABEL_TAB_);
  if (!L) {
    L = ss.insertSheet(LABEL_TAB_);
    L.getRange(1, 1, 1, LABEL_HEAD_.length).setValues([LABEL_HEAD_]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#234c40');
    L.setFrozenRows(1);
    const seed = (Array.isArray(p.seed) ? p.seed : []).slice(0, 200).map(function (x) { return [clean_('', x.name).slice(0, 40), clean_('', x.group).slice(0, 40), clean_('', x.mark).slice(0, 8), clean_('', x.memo).slice(0, 300)]; }).filter(function (x) { return x[0] && !/[、,，\/／\n]/.test(x[0]); });
    if (seed.length) L.getRange(2, 1, seed.length, 4).setNumberFormat('@').setValues(seed);
    made.tab = true;
  }
  const S = tab_(ss, '曲');
  if (S.col('ラベル') < 0) {
    let c = S.head.length;
    while (c > 0 && !S.head[c - 1]) c--;
    if (c + 1 > S.sh.getMaxColumns()) S.sh.insertColumnAfter(S.sh.getMaxColumns());
    S.sh.getRange(1, 1).copyTo(S.sh.getRange(1, c + 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    S.sh.getRange(1, c + 1).setValue('ラベル');
    made.col = true;
  }
  if (made.tab || made.col) hist_(ss, [[stamp_(ss), LABEL_TAB_, '', 'ラベルの準備', '', (made.tab ? '「' + LABEL_TAB_ + '」タブを作った　' : '') + (made.col ? '「曲」タブにラベル列を足した' : ''), '準備', '']]);
  return { ok: true, made: made };
}

// p = {base:[シートで見たラベル名], list:[{was, name, group, mark, memo}]}。was は元の名前（新しいラベルは空）
// 名前を変えたラベル・消したラベルは、「曲」タブのラベル列も同じように直す
function labels_(ss, p) {
  const L = labelTab_(ss);
  if (!L) return { ok: false, error: '「' + LABEL_TAB_ + '」タブがありません' };
  const base = (p.base || []).map(String), now = L.list.map(function (x) { return x.name; });
  if (base.join('\n') !== now.join('\n')) return { ok: false, conflict: true, error: 'シートのほうでラベルが変わっています。読み直してから直してください' };
  const list = (Array.isArray(p.list) ? p.list : []).slice(0, 300).map(function (x) {
    return { was: clean_('', x.was), name: clean_('', x.name).slice(0, 40), group: clean_('', x.group).slice(0, 40), mark: clean_('', x.mark).slice(0, 8), memo: clean_('', x.memo).slice(0, 300) };
  });
  const seen = {};
  for (let i = 0; i < list.length; i++) {
    const n = list[i].name;
    if (!n) return { ok: false, error: '名前が空のラベルがあります' };
    if (/[、,，\/／]/.test(n)) return { ok: false, error: 'ラベル「' + n + '」に「、」「,」「/」は使えません（区切りの記号なので）' };
    if (seen[n]) return { ok: false, error: 'ラベル「' + n + '」が2つあります' };
    seen[n] = 1;
  }
  const ren = {}, keep = {};
  list.forEach(function (x) { if (x.was) { keep[x.was] = 1; if (x.was !== x.name) ren[x.was] = x.name; } });
  const gone = {};
  now.forEach(function (n) { if (!keep[n]) gone[n] = 1; });
  // ラベル一覧タブを書き直す
  const sh = L.sh, old = Math.max(sh.getLastRow() - 1, 0);
  if (old) sh.getRange(2, 1, old, LABEL_HEAD_.length).clearContent();
  if (list.length) sh.getRange(2, 1, list.length, 4).setNumberFormat('@').setValues(list.map(function (x) { return [x.name, x.group, x.mark, x.memo]; }));
  // 曲タブのラベル列
  let songs = 0;
  if (Object.keys(ren).length || Object.keys(gone).length) {
    const S = tab_(ss, '曲'), c = S.col('ラベル');
    if (c >= 0 && !S.auto[c]) S.body.forEach(function (r, i) {
      const a = tagSplit_(r[c]);
      const b = tagSplit_(a.filter(function (t) { return !gone[t]; }).map(function (t) { return ren[t] || t; }).join('、'));
      if (a.join('、') !== b.join('、')) { const cell = S.sh.getRange(i + 2, c + 1); cell.setNumberFormat('@'); cell.setValue(b.join('、')); songs++; }
    });
  }
  hist_(ss, [[stamp_(ss), LABEL_TAB_, 'ラベル一覧', 'ラベルの並び', base.join('、'), list.map(function (x) { return x.name; }).join('、'), 'ラベル', '',
    (Object.keys(ren).length ? '名前を変えた ' + Object.keys(ren).map(function (k) { return k + '→' + ren[k]; }).join('、') + '　' : '') + (Object.keys(gone).length ? '消した ' + Object.keys(gone).join('、') + '　' : '') + '曲 ' + songs + '曲を直した']]);
  return { ok: true, labels: list.map(function (x) { return { name: x.name, group: x.group, mark: x.mark, memo: x.memo }; }), songs: songs };
}

// ===================== 版3：編集の記録と控え =====================

const HIST_TAB_ = '編集の記録';
const HIST_HEAD_ = ['日時', 'タブ', '行の名前', '項目', '前', '後', '操作', '項目の記号', 'メモ'];
// 先頭が「=」の文字は、数式にならないよう「'」を付けて入れる（シートには「'」は見えません）
function text_(v) { v = String(v == null ? '' : v); return /^=/.test(v) ? "'" + v : v; }
function stamp_(ss) {
  // 日本の時刻で残す（コピーしたシートは、タイムゾーンが日本以外になっていることがあるため）
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
}
function hist_(ss, rows) {
  if (!rows || !rows.length) return;
  let sh = ss.getSheetByName(HIST_TAB_);
  if (!sh) {
    sh = ss.insertSheet(HIST_TAB_);
    sh.getRange(1, 1, 1, HIST_HEAD_.length).setValues([HIST_HEAD_]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#234c40');
    sh.setFrozenRows(1);
  }
  const vals = rows.map(function (r) {
    const o = [];
    for (let i = 0; i < HIST_HEAD_.length; i++) o.push(text_(String(r[i] == null ? '' : r[i]).slice(0, 3000)));
    return o;
  });
  const at = sh.getLastRow() + 1;
  sh.getRange(at, 1, vals.length, HIST_HEAD_.length).setNumberFormat('@').setValues(vals);
}
// 新しい順に、最大 p.n 行（既定 120）
function history_(ss, p) {
  const sh = ss.getSheetByName(HIST_TAB_);
  if (!sh || sh.getLastRow() < 2) return { ok: true, rows: [] };
  const n = Math.min(Math.max(Number(p.n) || 120, 1), 500), last = sh.getLastRow(), from = Math.max(2, last - n + 1);
  const v = sh.getRange(from, 1, last - from + 1, HIST_HEAD_.length).getDisplayValues();
  const keys = ['at', 'tab', 'id', 'field', 'before', 'after', 'act', 'k', 'memo'];
  return { ok: true, rows: v.reverse().map(function (r) { const o = {}; keys.forEach(function (k, i) { o[k] = String(r[i] == null ? '' : r[i]); }); return o; }) };
}
// 控え：タブをこのシートの中に写して隠す（ほかのファイルは作りません）。戻すときは、シートで控えのタブを表示して写します
function backup_(ss, p) {
  const now = stamp_(ss), made = [];
  ['曲', '音源', '提供者', LABEL_TAB_].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const c = sh.copyTo(ss);
    let nm = '控え ' + now.replace(/:\d\d$/, '') + ' ' + name, i = 2;
    while (ss.getSheetByName(nm)) nm = '控え ' + now + ' ' + name + '（' + (i++) + '）';
    c.setName(nm);
    c.hideSheet();
    made.push(nm);
  });
  hist_(ss, [[now, '控え', '', '控えのタブ', '', made.join('、'), '控え', '', String(p.why || '').slice(0, 200)]]);
  return { ok: true, made: made, at: now };
}

