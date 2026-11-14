/* 歌枠管理シートとつなぐ：貼り付けで読み込む／Apps Script（ウェブアプリ）で読み書きする */

  const SHEET_GAS="/**\n * 配信処オトノハ ⇄ 歌枠管理シート（Apps Script・版4）\n * @OnlyCurrentDoc  … このスクリプトが触れられるのは、このスプレッドシートだけです（ドライブのほかのファイルには触れません）\n *\n * 1. 下の OTONOHA_KEY を、自分だけの合言葉に書き換えます（英数字で12文字以上がおすすめ）。\n * 2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」、次のユーザーとして実行「自分」、アクセスできるユーザー「全員」。\n *    版2・版3から入れ替えるときは、デプロイ → デプロイを管理 → 鉛筆の印 → バージョン「新バージョン」→ デプロイ（URLは変わりません）。\n * 3. 出てきたウェブアプリのURLと合言葉を、オトノハの「歌枠管理シートとつなぐ」に入れます。\n *\n * 書き込むのは、1行目に数式がない列（手で入力する列）だけです。1行目が数式の列（自動の列）には書きません。\n * 版3で足したこと：シートの編集（曲・音源・提供者を足す・直す）、ラベル（「ラベル一覧」タブと「曲」タブのラベル列）、\n *   「編集の記録」タブ（オトノハから直した項目の、前と後の値）、控え（「曲」「音源」「提供者」「ラベル一覧」タブを、このシートの中に写して隠す）。\n * 曲名・アーティスト・音源名・提供者名を直したときは、それを選んでいる「音源」「配信ログ」の行も新しい名前に付け替えます。\n * 版4で足したこと（配信ログへ送るところ）：配信一覧の「配信先」「収益化」「枠タイトル」も書く、\n *   オープニング・エンディング・トーク・企画の行も送る、同じ配信IDを送り直す（その配信IDの配信ログの行を入れ替える）。\n * 曲・音源・提供者の行を消す働きはありません（消すときは、シートで行を選んで消します）。\n */\nconst OTONOHA_KEY = 'ここに合言葉';\nconst GAS_VERSION = 4;\n\nfunction doGet(e) { return out_(handle_((e && e.parameter) || {})); }\nfunction doPost(e) {\n  let body = {};\n  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: '送られた内容が読めません' }); }\n  return out_(handle_(body));\n}\nfunction out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }\n\nfunction handle_(p) {\n  if (!OTONOHA_KEY || OTONOHA_KEY === 'ここに合言葉') return { ok: false, error: 'Apps Script の OTONOHA_KEY に合言葉を書いて、デプロイし直してください' };\n  if (String(p.key || '') !== OTONOHA_KEY) return { ok: false, error: '合言葉が違います' };\n  const ss = SpreadsheetApp.getActiveSpreadsheet();\n  try {\n    if (p.op === 'ping') return { ok: true, version: GAS_VERSION, name: ss.getName(), id: ss.getId() };\n    if (p.op === 'read') return read_(ss);\n    if (p.op === 'sheet') return sheet_(ss);\n    if (p.op === 'history') return history_(ss, p);\n    const writers = { log: log_, save: save_, labels: labels_, setup: setup_, backup: backup_ };\n    if (writers[p.op]) {\n      const lock = LockService.getDocumentLock();\n      lock.waitLock(20000);\n      try { return writers[p.op](ss, p); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }\n    }\n    return { ok: false, error: '知らない操作です：' + String(p.op || '') };\n  } catch (err) {\n    return { ok: false, error: String((err && err.message) || err) };\n  }\n}\n\n// 見出しで列を探す（まず見出しと同じ文字、なければ見出しの「始まりの文字」）。auto[i] は1行目が数式の列（自動の列）\nfunction tab_(ss, name) {\n  const sh = ss.getSheetByName(name);\n  if (!sh) throw new Error('「' + name + '」タブが見つかりません');\n  const v = sh.getDataRange().getDisplayValues();\n  const head = (v[0] || []).map(function (h) { return String(h).trim(); });\n  const fx = head.length ? sh.getRange(1, 1, 1, head.length).getFormulas()[0] : [];\n  const auto = fx.map(function (f) { return !!f; });\n  const col = function (prefix) {\n    for (let i = 0; i < head.length; i++) if (head[i] === prefix) return i;\n    for (let i = 0; i < head.length; i++) if (head[i].indexOf(prefix) === 0) return i;\n    return -1;\n  };\n  return { sh: sh, head: head, auto: auto, body: v.slice(1), col: col };\n}\n\nfunction cell_(row, i) { return i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim(); }\n// 列の中で、最後に値が入っている行（1始まり）。数式の空文字は値として数えない\nfunction lastRow_(sh, col) {\n  const n = sh.getMaxRows();\n  if (n < 2) return 1;\n  const v = sh.getRange(2, col, n - 1, 1).getDisplayValues();\n  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() !== '') return i + 2;\n  return 1;\n}\n\nfunction read_(ss) {\n  const S = tab_(ss, '曲'), R = tab_(ss, '音源'), P = tab_(ss, '提供者');\n  const sT = S.col('表示用曲名'), sW = S.col('作品名'), sA = S.col('表示用アーティスト'), sK = S.col('選択用'), sG = S.col('ラベル');\n  const songs = S.body.filter(function (r) { return cell_(r, sT); }).map(function (r) {\n    const o = { t: cell_(r, sT), a: cell_(r, sA), w: cell_(r, sW), k: cell_(r, sK) || (cell_(r, sT) + '／' + cell_(r, sA)) };\n    // 「ラベル」で始まる見出しの列があるときだけ、ラベルも送る（歌枠ルーレットのしぼりこみ用）\n    if (sG >= 0) o.g = cell_(r, sG);\n    return o;\n  });\n  const rS = R.col('曲（選ぶ）'), rN = R.col('音源名'), rKind = R.col('種類'), rKey = R.col('キー'), rU2 = R.col('URL（共有IDなし'), rU = R.col('URL（貼り付け'), rBy = R.col('提供者（選ぶ）'), rF = R.col('音源ファイルの保存場所'), rKK = R.col('キーの区分'), rLy = R.col('動画内の歌詞表示');\n  const srcs = R.body.filter(function (r) { return cell_(r, rN); }).map(function (r) {\n    return { s: cell_(r, rS), n: cell_(r, rN), kind: cell_(r, rKind), key: cell_(r, rKey), u: cell_(r, rU2) || cell_(r, rU), by: cell_(r, rBy), f: cell_(r, rF), kk: cell_(r, rKK), ly: cell_(r, rLy) };\n  });\n  const pN = P.col('提供者名');\n  const providers = P.body.map(function (r) { return cell_(r, pN); }).filter(String);\n  let accounts = [];\n  try {\n    const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');\n    accounts = A.body.filter(function (r) { return cell_(r, aI); }).map(function (r) { return { id: cell_(r, aI), name: cell_(r, aN) }; });\n  } catch (err) { }\n  return { ok: true, version: 1, songs: songs, srcs: srcs, providers: providers, accounts: accounts };\n}\n\n// p.stream = {id, date, prof, title, addStream, dest, mon, replace}\n// p.rows = [{n, ts, kind, t, a, k, src:{n, u, by}}]。kind は「曲」（空も曲）か、オープニング・エンディング・トーク・企画\nconst LOG_KINDS_ = { 'オープニング': 1, 'エンディング': 1, 'トーク・企画': 1 };\nfunction log_(ss, p) {\n  const st = p.stream || {}, rows = Array.isArray(p.rows) ? p.rows.slice(0, 300) : [];\n  const id = String(st.id || '').trim().slice(0, 60);\n  if (!id) return { ok: false, error: '配信IDがありません' };\n  if (!rows.length) return { ok: false, error: '送る曲がありません' };\n  let L = tab_(ss, '配信ログ');\n  const lId = L.col('配信ID');\n  const added = { songs: 0, srcs: 0, rows: 0, stream: 0, replaced: 0 };\n  const has = [];\n  L.body.forEach(function (r, i) { if (cell_(r, lId) === id) has.push(i + 2); });\n  if (has.length && !st.replace) return { ok: false, exists: true, error: '配信ログに、配信ID「' + id + '」の行がもうあります' };\n  // 送り直し：その配信IDの行を消してから入れる（下の行から消す）\n  for (let i = has.length - 1; i >= 0; i--) { L.sh.deleteRow(has[i]); added.replaced++; }\n  if (has.length) L = tab_(ss, '配信ログ');\n\n  // 配信一覧：まだない配信IDなら1行足す。配信先・収益化・枠タイトルは、送られてきたものだけ書く（空のものは、いまの値を残す）\n  {\n    const T = tab_(ss, '配信一覧'), tId = T.col('配信ID'), tDate = T.col('配信日'), tAcc = T.col('アカウントID'), tDest = T.col('配信先'), tMon = T.col('収益化'), tTitle = T.col('枠タイトル');\n    let r = 0;\n    T.body.forEach(function (x, i) { if (!r && cell_(x, tId) === id) r = i + 2; });\n    if (!r && st.addStream) {\n      let acc = '';\n      try {\n        const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');\n        A.body.forEach(function (x) { if (!acc && st.prof && cell_(x, aN) === String(st.prof)) acc = cell_(x, aI); });\n      } catch (err) { }\n      r = lastRow_(T.sh, tId + 1) + 1;\n      T.sh.getRange(r, tId + 1).setValue(id);\n      if (tDate >= 0) { T.sh.getRange(r, tDate + 1).setNumberFormat('@'); T.sh.getRange(r, tDate + 1).setValue(String(st.date || '')); }\n      if (tAcc >= 0 && acc) T.sh.getRange(r, tAcc + 1).setValue(acc);\n      added.stream = 1;\n    }\n    if (r) {\n      const put = function (c, v) { v = String(v == null ? '' : v).trim(); if (c >= 0 && v && !T.auto[c]) T.sh.getRange(r, c + 1).setValue(text_(v.slice(0, 300))); };\n      put(tDest, st.dest); put(tMon, st.mon); put(tTitle, st.title);\n    }\n  }\n  const songRows = rows.filter(function (x) { return !LOG_KINDS_[String(x.kind || '')]; });\n\n  // 曲：シートにない曲は「曲」タブに下書きとして足す（曲名・アーティスト・表記の状態）\n  const S = tab_(ss, '曲'), sT = S.col('表示用曲名'), sA = S.col('表示用アーティスト'), sK = S.col('選択用'), sState = S.col('表記の状態');\n  const songKeys = {};\n  S.body.forEach(function (r) { if (cell_(r, sT)) songKeys[cell_(r, sK) || (cell_(r, sT) + '／' + cell_(r, sA))] = 1; });\n  let sNext = lastRow_(S.sh, sT + 1) + 1;\n  songRows.forEach(function (x) {\n    const k = String(x.k || (String(x.t || '') + '／' + String(x.a || ''))).slice(0, 420);\n    x.k = k;\n    if (songKeys[k] || !x.t) return;\n    S.sh.getRange(sNext, sT + 1).setValue(String(x.t).slice(0, 200));\n    if (sA >= 0) S.sh.getRange(sNext, sA + 1).setValue(String(x.a || '').slice(0, 200));\n    if (sState >= 0) S.sh.getRange(sNext, sState + 1).setValue('下書き・要確認');\n    songKeys[k] = 1; sNext++; added.songs++;\n  });\n\n  // 音源：シートにない音源は「音源」タブに足す（提供者は、提供者タブにある名前のときだけ入れる）\n  const R = tab_(ss, '音源'), rS = R.col('曲（選ぶ）'), rN = R.col('音源名'), rKind = R.col('種類'), rU = R.col('URL（貼り付け'), rBy = R.col('提供者（選ぶ）');\n  const P = tab_(ss, '提供者'), pN = P.col('提供者名');\n  const providers = {};\n  P.body.forEach(function (r) { if (cell_(r, pN)) providers[cell_(r, pN)] = 1; });\n  const srcNames = {};\n  R.body.forEach(function (r) { if (cell_(r, rN)) srcNames[cell_(r, rN)] = 1; });\n  let rNext = lastRow_(R.sh, rN + 1) + 1;\n  songRows.forEach(function (x) {\n    const s = x.src;\n    if (!s || !s.n) return;\n    s.n = String(s.n).slice(0, 200);\n    if (srcNames[s.n]) return;\n    if (rS >= 0) R.sh.getRange(rNext, rS + 1).setValue(x.k);\n    R.sh.getRange(rNext, rN + 1).setValue(s.n);\n    if (rKind >= 0) R.sh.getRange(rNext, rKind + 1).setValue(/youtube\\.com|youtu\\.be/.test(String(s.u || '')) ? 'YouTube動画' : 'その他');\n    if (rU >= 0 && s.u) R.sh.getRange(rNext, rU + 1).setValue(String(s.u).slice(0, 500));\n    if (rBy >= 0 && s.by && providers[s.by]) R.sh.getRange(rNext, rBy + 1).setValue(s.by);\n    srcNames[s.n] = 1; rNext++; added.srcs++;\n  });\n\n  // 配信ログ：配信ID・順番・タイムスタンプ（文字）・区分「曲」・曲・音源\n  const values = rows.map(function (x, i) {\n    const kind = String(x.kind || '');\n    if (LOG_KINDS_[kind]) return [id, Number(x.n) || (i + 1), String(x.ts || ''), kind, '', ''];\n    return [id, Number(x.n) || (i + 1), String(x.ts || ''), '曲', x.k, x.src && x.src.n ? x.src.n : ''];\n  });\n  const start = lastRow_(L.sh, 1) + 1;\n  L.sh.getRange(start, 3, values.length, 1).setNumberFormat('@');\n  L.sh.getRange(start, 1, values.length, 6).setValues(values);\n  added.rows = values.length;\n  return { ok: true, added: added, firstRow: start };\n}\n\n// ===================== 版3：シートの編集 =====================\n\n// 画面の項目 → 見出し（「始まりの文字」で探す）。ここにない列には書きません\nconst FIELDS_ = {\n  '曲': { t: '表示用曲名', w: '作品名', a: '表示用アーティスト', y: '読み', st: '表記の状態', lu: '歌詞ページのURL', org: '管理団体', code: '作品コード', jt: '作品タイトル', ja: 'アーティスト名', ly: '作詞者', cp: '作曲者', memo: 'メモ', rt: '管理団体の登録表記（曲名', ra: '管理団体の登録表記（アーティスト', set: 'セトリでの表記', g: 'ラベル' },\n  '音源': { s: '曲（選ぶ）', n: '音源名', kind: '種類', key: 'キー', u: 'URL（貼り付け', by: '提供者（選ぶ）', yt: '個別：YouTube配信', mon: '個別：収益化配信', oth: '個別：YouTube以外', cond: '個別の利用条件', memo: 'メモ', f: '音源ファイルの保存場所', who: '使える名義', kk: 'キーの区分', lyr: '動画内の歌詞表示' },\n  '提供者': { n: '提供者名', url: '概要欄に載せるURL', yt: 'YouTube配信で使用', mon: '収益化済み配信で使用', oth: 'YouTube以外の配信', cr: 'クレジット表記の指定', tu: '利用規約・説明のURL', d: '確認日', memo: 'メモ', raw: '規約・説明の原文', y: '読み' }\n};\n// 1行を見分ける項目（曲は「曲名／アーティスト」、音源と提供者は名前）。ほかのタブから、この文字で選ばれています\nconst ID_ = { '曲': ['t', 'a'], '音源': ['n'], '提供者': ['n'] };\nconst LABEL_TAB_ = 'ラベル一覧';\nconst LABEL_HEAD_ = ['ラベル', '分類', '記号', 'メモ'];\n\nfunction cols_(T, tab) {\n  const m = {}, f = FIELDS_[tab];\n  Object.keys(f).forEach(function (k) { const i = T.col(f[k]); if (i >= 0 && !T.auto[i]) m[k] = i; });\n  return m;\n}\nfunction rowObj_(r, m) { const o = {}; Object.keys(m).forEach(function (k) { o[k] = cell_(r, m[k]); }); return o; }\nconst tagSplit_ = function (v) {\n  const seen = {}, out = [];\n  String(v || '').split(/[、,，\\/／\\n]/).forEach(function (x) { x = x.trim(); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });\n  return out;\n};\n// 並べ替えの文字：読み（なければ曲名）。英数字が先、かなが後\nfunction sortKey_(y, t) {\n  const s = String(y || t || '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });\n  return (/^[a-z0-9]/.test(s) ? '0' : '1') + s;\n}\n// プルダウン（一覧から選ぶ）の選択肢を、2行目の入力規則から読む\nfunction listOpts_(T, i) {\n  if (i < 0) return null;\n  try {\n    const dv = T.sh.getRange(2, i + 1).getDataValidation();\n    if (!dv || dv.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return null;\n    return (dv.getCriteriaValues()[0] || []).map(String);\n  } catch (err) { return null; }\n}\nfunction labelTab_(ss) {\n  const sh = ss.getSheetByName(LABEL_TAB_);\n  if (!sh) return null;\n  const v = sh.getDataRange().getDisplayValues().slice(1);\n  return { sh: sh, list: v.filter(function (r) { return cell_(r, 0); }).map(function (r) { return { name: cell_(r, 0), group: cell_(r, 1), mark: cell_(r, 2), memo: cell_(r, 3) }; }) };\n}\n\n// 編集画面用に、手で入れる列をすべて読む（r はシートの行番号）\nfunction sheet_(ss) {\n  const out = { ok: true, version: GAS_VERSION, name: ss.getName(), id: ss.getId(), opts: {} };\n  [['曲', 'songs'], ['音源', 'srcs'], ['提供者', 'provs']].forEach(function (x) {\n    const T = tab_(ss, x[0]), m = cols_(T, x[0]), idc = m[ID_[x[0]][0]];\n    out[x[1]] = [];\n    T.body.forEach(function (r, i) { if (cell_(r, idc)) { const o = rowObj_(r, m); o.r = i + 2; out[x[1]].push(o); } });\n    const opts = {};\n    Object.keys(m).forEach(function (k) { const l = listOpts_(T, m[k]); if (l) opts[k] = l; });\n    out.opts[x[0]] = opts;\n    out[x[1] + 'Cols'] = Object.keys(m);\n  });\n  const L = labelTab_(ss);\n  out.labels = L ? L.list : null;\n  try {\n    const A = tab_(ss, '配信アカウント'), aI = A.col('アカウントID'), aN = A.col('名義');\n    out.accounts = A.body.filter(function (r) { return cell_(r, aI); }).map(function (r) { return { id: cell_(r, aI), name: cell_(r, aN) }; });\n  } catch (err) { out.accounts = []; }\n  return out;\n}\n\n// 新しい行の場所：曲・提供者は読みの順の位置に1行差し込む。音源はいちばん下に足す\nfunction newRow_(T, m, tab, f) {\n  const sh = T.sh, idc = m[ID_[tab][0]];\n  const last = lastRow_(sh, idc + 1);\n  let at = last + 1;\n  if (tab !== '音源') {\n    const key = sortKey_(f.y, f[ID_[tab][0]]);\n    for (let i = 0; i < T.body.length && i + 2 <= last; i++) {\n      const r = T.body[i];\n      if (!cell_(r, idc)) continue;\n      if (sortKey_(m.y >= 0 ? cell_(r, m.y) : '', cell_(r, idc)) > key) { at = i + 2; break; }\n    }\n  }\n  const width = sh.getMaxColumns();\n  if (at <= last) {\n    sh.insertRowBefore(at);\n    const from = sh.getRange(at + 1, 1, 1, width), to = sh.getRange(at, 1, 1, width);\n    from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);\n    from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);\n  } else {\n    if (at > sh.getMaxRows()) sh.insertRowAfter(sh.getMaxRows());\n    if (last >= 2) {\n      const from = sh.getRange(last, 1, 1, width), to = sh.getRange(at, 1, 1, width);\n      from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);\n      from.copyTo(to, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);\n    }\n  }\n  return at;\n}\n\n// 名前を直したとき、ほかのタブでその名前を選んでいるセルを付け替える\nfunction relink_(ss, tabName, prefix, oldV, newV) {\n  if (!oldV || oldV === newV) return 0;\n  const T = tab_(ss, tabName), c = T.col(prefix);\n  if (c < 0 || T.auto[c]) return 0;\n  let n = 0;\n  T.body.forEach(function (r, i) {\n    if (String(r[c]) === oldV) { const cell = T.sh.getRange(i + 2, c + 1); cell.setNumberFormat('@'); cell.setValue(text_(newV)); n++; }\n  });\n  return n;\n}\n\nconst LIMIT_ = { raw: 45000, cond: 5000, memo: 5000 };\nfunction clean_(k, v) { return String(v == null ? '' : v).replace(/\\r\\n?/g, '\\n').trim().slice(0, LIMIT_[k] || 1000); }\n\n// p = {tab, r, before:{項目:シートで見た値}, f:{項目:新しい値}}。r が 0 なら新しい行\nfunction save_(ss, p) {\n  const tab = String(p.tab || '');\n  if (!FIELDS_[tab]) return { ok: false, error: '知らないタブです：' + tab };\n  const T = tab_(ss, tab), m = cols_(T, tab), ids = ID_[tab];\n  const f = {}, before = p.before || {};\n  Object.keys(p.f || {}).forEach(function (k) {\n    if (!(k in FIELDS_[tab])) throw new Error('知らない項目です：' + k);\n    if (!(k in m)) throw new Error('「' + tab + '」タブに「' + FIELDS_[tab][k] + '」の列が見つからないか、自動の列です');\n    f[k] = clean_(k, p.f[k]);\n  });\n  if (f.g != null) f.g = tagSplit_(f.g).join('、');\n  let row = Number(p.r) || 0, cur = null;\n  if (row) {\n    // シートで見た行と、いまの行が同じかを確かめる（ほかの端末で直した・行がずれた、を見つける）\n    const same = function (r) { return ids.every(function (k) { return cell_(r, m[k]) === String(before[k] == null ? '' : before[k]).trim(); }); };\n    let i = row - 2;\n    if (!(T.body[i] && same(T.body[i]))) { i = T.body.findIndex(same); row = i + 2; }\n    if (i < 0) return { ok: false, conflict: true, error: 'シートのほうで、この行が変わっているか見つかりません。読み直してから直してください' };\n    cur = rowObj_(T.body[i], m);\n    const changed = Object.keys(before).filter(function (k) { return k in m && cur[k] !== String(before[k] == null ? '' : before[k]).trim(); });\n    if (changed.length) return { ok: false, conflict: true, error: 'シートのほうで「' + changed.map(function (k) { return FIELDS_[tab][k]; }).join('」「') + '」が変わっています。読み直してから直してください' };\n  }\n  const next = {};\n  Object.keys(m).forEach(function (k) { next[k] = k in f ? f[k] : (cur ? cur[k] : ''); });\n  if (!next[ids[0]]) return { ok: false, error: '「' + FIELDS_[tab][ids[0]] + '」は空にできません' };\n  const idOf = function (o) { return ids.map(function (k) { return o[k] || ''; }).join('／'); };\n  const nid = idOf(next);\n  const dup = T.body.some(function (r, i) { return i + 2 !== row && cell_(r, m[ids[0]]) && idOf(rowObj_(r, m)) === nid; });\n  if (dup) return { ok: false, error: tab === '曲' ? '同じ曲名・アーティストの曲がもうあります' : '同じ名前の' + tab + 'がもうあります（名前で選ぶので、重ならない名前にしてください）' };\n  if (tab === '音源' && next.s) {\n    const S = tab_(ss, '曲'), k = S.col('選択用');\n    if (k >= 0 && !S.body.some(function (r) { return cell_(r, k) === next.s; })) return { ok: false, error: '「曲」タブに「' + next.s + '」がありません' };\n  }\n  const added = !row;\n  if (added) row = newRow_(T, m, tab, next);\n  const keys = added ? Object.keys(next).filter(function (k) { return next[k] !== ''; }) : Object.keys(f).filter(function (k) { return f[k] !== cur[k]; });\n  keys.forEach(function (k) { const cell = T.sh.getRange(row, m[k] + 1); cell.setNumberFormat('@'); cell.setValue(text_(next[k])); });\n  const moved = { srcs: 0, logs: 0 };\n  if (!added && cur) {\n    if (tab === '曲') {\n      const o = cur.t + '／' + cur.a, n = next.t + '／' + next.a;\n      moved.srcs = relink_(ss, '音源', '曲（選ぶ）', o, n);\n      moved.logs = relink_(ss, '配信ログ', '曲（選ぶ）', o, n);\n    } else if (tab === '音源') moved.logs = relink_(ss, '配信ログ', '音源（選ぶ）', cur.n, next.n);\n    else if (tab === '提供者') moved.srcs = relink_(ss, '音源', '提供者（選ぶ）', cur.n, next.n);\n  }\n  const now = stamp_(ss), name = idOf(next), log = keys.map(function (k) {\n    return [now, tab, name, T.head[m[k]] || FIELDS_[tab][k], added ? '' : cur[k], next[k], added ? '足した' : '直した', k];\n  });\n  if (moved.srcs || moved.logs) log.push([now, tab, name, 'ほかのタブの付け替え', idOf(cur), name, '付け替え', '', '音源 ' + moved.srcs + '行・配信ログ ' + moved.logs + '行']);\n  hist_(ss, log);\n  next.r = row;\n  return { ok: true, added: added, r: row, rec: next, wrote: keys, moved: moved, at: now };\n}\n\n// 「ラベル一覧」タブと、「曲」タブの「ラベル」列を作る（ないときだけ）\nfunction setup_(ss, p) {\n  const made = { tab: false, col: false };\n  let L = ss.getSheetByName(LABEL_TAB_);\n  if (!L) {\n    L = ss.insertSheet(LABEL_TAB_);\n    L.getRange(1, 1, 1, LABEL_HEAD_.length).setValues([LABEL_HEAD_]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#234c40');\n    L.setFrozenRows(1);\n    const seed = (Array.isArray(p.seed) ? p.seed : []).slice(0, 200).map(function (x) { return [clean_('', x.name).slice(0, 40), clean_('', x.group).slice(0, 40), clean_('', x.mark).slice(0, 8), clean_('', x.memo).slice(0, 300)]; }).filter(function (x) { return x[0] && !/[、,，\\/／\\n]/.test(x[0]); });\n    if (seed.length) L.getRange(2, 1, seed.length, 4).setNumberFormat('@').setValues(seed);\n    made.tab = true;\n  }\n  const S = tab_(ss, '曲');\n  if (S.col('ラベル') < 0) {\n    let c = S.head.length;\n    while (c > 0 && !S.head[c - 1]) c--;\n    if (c + 1 > S.sh.getMaxColumns()) S.sh.insertColumnAfter(S.sh.getMaxColumns());\n    S.sh.getRange(1, 1).copyTo(S.sh.getRange(1, c + 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);\n    S.sh.getRange(1, c + 1).setValue('ラベル');\n    made.col = true;\n  }\n  if (made.tab || made.col) hist_(ss, [[stamp_(ss), LABEL_TAB_, '', 'ラベルの準備', '', (made.tab ? '「' + LABEL_TAB_ + '」タブを作った　' : '') + (made.col ? '「曲」タブにラベル列を足した' : ''), '準備', '']]);\n  return { ok: true, made: made };\n}\n\n// p = {base:[シートで見たラベル名], list:[{was, name, group, mark, memo}]}。was は元の名前（新しいラベルは空）\n// 名前を変えたラベル・消したラベルは、「曲」タブのラベル列も同じように直す\nfunction labels_(ss, p) {\n  const L = labelTab_(ss);\n  if (!L) return { ok: false, error: '「' + LABEL_TAB_ + '」タブがありません' };\n  const base = (p.base || []).map(String), now = L.list.map(function (x) { return x.name; });\n  if (base.join('\\n') !== now.join('\\n')) return { ok: false, conflict: true, error: 'シートのほうでラベルが変わっています。読み直してから直してください' };\n  const list = (Array.isArray(p.list) ? p.list : []).slice(0, 300).map(function (x) {\n    return { was: clean_('', x.was), name: clean_('', x.name).slice(0, 40), group: clean_('', x.group).slice(0, 40), mark: clean_('', x.mark).slice(0, 8), memo: clean_('', x.memo).slice(0, 300) };\n  });\n  const seen = {};\n  for (let i = 0; i < list.length; i++) {\n    const n = list[i].name;\n    if (!n) return { ok: false, error: '名前が空のラベルがあります' };\n    if (/[、,，\\/／]/.test(n)) return { ok: false, error: 'ラベル「' + n + '」に「、」「,」「/」は使えません（区切りの記号なので）' };\n    if (seen[n]) return { ok: false, error: 'ラベル「' + n + '」が2つあります' };\n    seen[n] = 1;\n  }\n  const ren = {}, keep = {};\n  list.forEach(function (x) { if (x.was) { keep[x.was] = 1; if (x.was !== x.name) ren[x.was] = x.name; } });\n  const gone = {};\n  now.forEach(function (n) { if (!keep[n]) gone[n] = 1; });\n  // ラベル一覧タブを書き直す\n  const sh = L.sh, old = Math.max(sh.getLastRow() - 1, 0);\n  if (old) sh.getRange(2, 1, old, LABEL_HEAD_.length).clearContent();\n  if (list.length) sh.getRange(2, 1, list.length, 4).setNumberFormat('@').setValues(list.map(function (x) { return [x.name, x.group, x.mark, x.memo]; }));\n  // 曲タブのラベル列\n  let songs = 0;\n  if (Object.keys(ren).length || Object.keys(gone).length) {\n    const S = tab_(ss, '曲'), c = S.col('ラベル');\n    if (c >= 0 && !S.auto[c]) S.body.forEach(function (r, i) {\n      const a = tagSplit_(r[c]);\n      const b = tagSplit_(a.filter(function (t) { return !gone[t]; }).map(function (t) { return ren[t] || t; }).join('、'));\n      if (a.join('、') !== b.join('、')) { const cell = S.sh.getRange(i + 2, c + 1); cell.setNumberFormat('@'); cell.setValue(b.join('、')); songs++; }\n    });\n  }\n  hist_(ss, [[stamp_(ss), LABEL_TAB_, 'ラベル一覧', 'ラベルの並び', base.join('、'), list.map(function (x) { return x.name; }).join('、'), 'ラベル', '',\n    (Object.keys(ren).length ? '名前を変えた ' + Object.keys(ren).map(function (k) { return k + '→' + ren[k]; }).join('、') + '　' : '') + (Object.keys(gone).length ? '消した ' + Object.keys(gone).join('、') + '　' : '') + '曲 ' + songs + '曲を直した']]);\n  return { ok: true, labels: list.map(function (x) { return { name: x.name, group: x.group, mark: x.mark, memo: x.memo }; }), songs: songs };\n}\n\n// ===================== 版3：編集の記録と控え =====================\n\nconst HIST_TAB_ = '編集の記録';\nconst HIST_HEAD_ = ['日時', 'タブ', '行の名前', '項目', '前', '後', '操作', '項目の記号', 'メモ'];\n// 先頭が「=」の文字は、数式にならないよう「'」を付けて入れる（シートには「'」は見えません）\nfunction text_(v) { v = String(v == null ? '' : v); return /^=/.test(v) ? \"'\" + v : v; }\nfunction stamp_(ss) {\n  // 日本の時刻で残す（コピーしたシートは、タイムゾーンが日本以外になっていることがあるため）\n  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');\n}\nfunction hist_(ss, rows) {\n  if (!rows || !rows.length) return;\n  let sh = ss.getSheetByName(HIST_TAB_);\n  if (!sh) {\n    sh = ss.insertSheet(HIST_TAB_);\n    sh.getRange(1, 1, 1, HIST_HEAD_.length).setValues([HIST_HEAD_]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#234c40');\n    sh.setFrozenRows(1);\n  }\n  const vals = rows.map(function (r) {\n    const o = [];\n    for (let i = 0; i < HIST_HEAD_.length; i++) o.push(text_(String(r[i] == null ? '' : r[i]).slice(0, 3000)));\n    return o;\n  });\n  const at = sh.getLastRow() + 1;\n  sh.getRange(at, 1, vals.length, HIST_HEAD_.length).setNumberFormat('@').setValues(vals);\n}\n// 新しい順に、最大 p.n 行（既定 120）\nfunction history_(ss, p) {\n  const sh = ss.getSheetByName(HIST_TAB_);\n  if (!sh || sh.getLastRow() < 2) return { ok: true, rows: [] };\n  const n = Math.min(Math.max(Number(p.n) || 120, 1), 500), last = sh.getLastRow(), from = Math.max(2, last - n + 1);\n  const v = sh.getRange(from, 1, last - from + 1, HIST_HEAD_.length).getDisplayValues();\n  const keys = ['at', 'tab', 'id', 'field', 'before', 'after', 'act', 'k', 'memo'];\n  return { ok: true, rows: v.reverse().map(function (r) { const o = {}; keys.forEach(function (k, i) { o[k] = String(r[i] == null ? '' : r[i]); }); return o; }) };\n}\n// 控え：タブをこのシートの中に写して隠す（ほかのファイルは作りません）。戻すときは、シートで控えのタブを表示して写します\nfunction backup_(ss, p) {\n  const now = stamp_(ss), made = [];\n  ['曲', '音源', '提供者', LABEL_TAB_].forEach(function (name) {\n    const sh = ss.getSheetByName(name);\n    if (!sh) return;\n    const c = sh.copyTo(ss);\n    let nm = '控え ' + now.replace(/:\\d\\d$/, '') + ' ' + name, i = 2;\n    while (ss.getSheetByName(nm)) nm = '控え ' + now + ' ' + name + '（' + (i++) + '）';\n    c.setName(nm);\n    c.hideSheet();\n    made.push(nm);\n  });\n  hist_(ss, [[now, '控え', '', '控えのタブ', '', made.join('、'), '控え', '', String(p.why || '').slice(0, 200)]]);\n  return { ok: true, made: made, at: now };\n}\n\n";
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
      // 読むだけの操作は GET、書き込む操作は POST（中身が長くなるため）
      r=!['ping','read','sheet','history'].includes(op)
        ?await fetch(l.url,{method:'POST',body:JSON.stringify({op,key:l.key,...body}),redirect:'follow'})
        :await fetch(l.url+'?op='+encodeURIComponent(op)+'&key='+encodeURIComponent(l.key),{redirect:'follow'})
    }catch(_){throw Error('シートにつながりませんでした（URL・デプロイの「アクセスできるユーザー：全員」・ネットの接続をご確認ください）')}
    let j;
    try{j=JSON.parse(await r.text())}catch(_){throw Error('シートから読める返事が来ませんでした（URLがウェブアプリの「/exec」か、デプロイし直していないかをご確認ください）')}
    if(!j||j.ok!==true){const e=Error(j?.error||'シートで失敗しました');e.exists=!!j?.exists;e.conflict=!!j?.conflict;throw e}
    return j
  }

  // ---- 読み込み（貼り付け・Apps Script 共通）
  // songs:[{t,a,w,k,g}]（g＝ラベル。シートに「ラベル」で始まる見出しの列があるときだけ）  srcs:[{s,n,kind,key,u,by,f}]
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
      r.sk=String(x.k||t+'／'+a).slice(0,420);if(x.w)r.w=String(x.w).slice(0,200);if(x.g){const g=tagNorm(x.g);if(g)r.tag=g}
      byKey.set(r.sk,r);n.songs++
    }
    for(const x of srcs||[]){
      const key=String(x.s||'').trim();
      if(!x.n&&!x.u){n.skip++;continue}
      let r=byKey.get(key);
      if(!r&&key){const i=key.lastIndexOf('／');const t=i>0?key.slice(0,i):key,a=i>0?key.slice(i+1):'';const had=repFind(t,a);r=repAdd(t,a);if(r){if(!had)n.newSongs++;r.sk=key.slice(0,420);byKey.set(key,r)}}
      if(!r){n.skip++;continue}
      const u=x.u?okeNorm(x.u):'',f=/^https?:\/\//i.test(x.f||'')?String(x.f).slice(0,500):'';
      if(srcAdd(r,{u:u||'',n:String(x.n||''),by:String(x.by||''),k:String(x.key||''),kind:String(x.kind||''),f,kk:String(x.kk||''),ly:String(x.ly||'')}))n.srcs++
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
      const t=col('表示用曲名'),a=col('表示用アーティスト'),w=col('作品名'),k=col('選択用'),gl=col('ラベル');
      return {kind:'曲',songs:rows.slice(1).map(r=>({t:c(r,t),a:c(r,a),w:c(r,w),k:c(r,k),...(gl>=0?{g:c(r,gl)}:{})})).filter(x=>x.t)}
    }
    if(col('音源名')>=0){
      const s=col('曲（選ぶ）'),nm=col('音源名'),kind=col('種類'),key=col('キー'),u2=col('URL（共有IDなし'),u=col('URL（貼り付け'),by=col('提供者（選ぶ）'),f=col('音源ファイルの保存場所'),kk=col('キーの区分'),ly=col('動画内の歌詞表示');
      return {kind:'音源',srcs:rows.slice(1).map(r=>({s:c(r,s),n:c(r,nm),kind:c(r,kind),key:c(r,key),u:c(r,u2)||c(r,u),by:c(r,by),f:c(r,f),kk:c(r,kk),ly:c(r,ly)})).filter(x=>x.n||x.u)}
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
  const SHEET_NEED=4;
  const sheetOpenUrl=l=>l&&/^[\w-]{5,}$/.test(l.id||'')?'https://docs.google.com/spreadsheets/d/'+l.id+'/edit':'';
  // つなぎ先に、シートの名前・ID・Apps Script の版を覚えておく（つないだとき・確かめたとき）
  function sheetLinkInfo(j){const l=sheetLink();if(!l||!j)return;sheetLinkSet({...l,name:String(j.name||l.name||'').slice(0,200),id:String(j.id||l.id||'').slice(0,80),ver:Number(j.version)||l.ver||0,at:Date.now()})}
  function renderSheet(){
    const l=sheetLink();
    E('sheetUrl').value=l?.url||'';E('sheetKey').value=l?.key||'';
    sheetSay('sheetInfo',l?'つなぎ先を保存しています'+(l.name?'（'+l.name+'）':''):'まだつないでいません');
    E('sheetRead').disabled=E('sheetForget').disabled=!l;
    renderSheetBar()
  }
  // 歌枠ノートのいちばん上の帯：つながっているか、どのシートか。よく使う操作を1か所に
  function renderSheetBar(){
    const bar=E('sheetBar');if(!bar)return;
    const l=sheetLink(),say=document.createElement('span');say.className='sheet-bar-say';
    const jump=id=>{const d=E(id);if(d){d.open=true;d.scrollIntoView({block:'start',behavior:'smooth'})}};
    if(!l){
      say.textContent='📗 歌枠管理シート：まだつないでいません（つなぐと、曲リストで足した曲・音源がシートにも入ります）';
      bar.replaceChildren(say,rowBtn('🔗 つなぐ','',()=>jump('sbSheet')));return
    }
    say.textContent='📗 歌枠管理シート：'+(l.name||'つないでいます')+(l.ver&&l.ver<SHEET_NEED?'（Apps Script が版'+l.ver+'。版'+SHEET_NEED+'に入れ替えると、配信先・収益化とオープニング・エンディングも送れます）':'');
    const open=sheetOpenUrl(l);
    bar.replaceChildren(say,
      open?rowBtn('シートを開く','',()=>window.open(open,'_blank','noopener'),'Googleスプレッドシートを新しいタブで開きます'):'',
      rowBtn('🔄 シートから読み込む','',()=>E('sheetRead').click(),'シートの曲・音源を、曲リストに読み込みます'),
      rowBtn('📝 シートを直す','',()=>{jump('sxBox')},'曲・音源・提供者・ラベルを、シートに足す・直す'),
      rowBtn('🔗 つなぎ先','',()=>jump('sbSheet')))
  }
  E('sheetGasCopy').onclick=()=>copy(SHEET_GAS);
  E('sheetGasSave').onclick=()=>bridgeSave('otonoha-sheet.gs.txt',SHEET_GAS,'text/plain');
  E('sheetSave').onclick=async()=>{
    const url=E('sheetUrl').value.trim(),key=E('sheetKey').value;
    if(!sheetOk(url)){sheetSay('sheetInfo','URLは「https://script.google.com/macros/s/…/exec」の形です（デプロイで出る「ウェブアプリ」のURL）');return}
    if(key.length<6){sheetSay('sheetInfo','合言葉は6文字以上にしてください（Apps Script の OTONOHA_KEY と同じもの）');return}
    if(!sheetLinkSet({url,key})){sheetSay('sheetInfo','このブラウザに保存できませんでした');return}
    sheetSay('sheetInfo','確かめています…');
    try{const j=await sheetCall('ping');sheetLinkInfo(j);renderSheet();sheetSay('sheetInfo','つながりました：'+(j.name||'スプレッドシート')+'（Apps Script 版'+(j.version||'?')+'）'+(j.version<SHEET_NEED?'。版'+SHEET_NEED+'に入れ替えると、配信先・収益化とオープニング・エンディングも送れます（下の手順）':''));if(typeof sheetWarm==='function')sheetWarm(true)}
    catch(e){renderSheet();sheetSay('sheetInfo','保存しましたが、つながりませんでした：'+e.message)}
  };
  E('sheetRead').onclick=async()=>{
    sheetSay('sheetInfo','読み込んでいます…');
    try{const j=await sheetCall('read');const n=sheetImport(j.songs,j.srcs);sheetSay('sheetInfo',importText(n));toast(importText(n),5000);if(typeof sheetWarm==='function')sheetWarm(true)}
    catch(e){sheetSay('sheetInfo',e.message)}
  };
  E('sheetForget').onclick=e=>armed(e.currentTarget,'もう一度押すと、このブラウザからつなぎ先を消す',()=>{sheetLinkSet(null);renderSheet()});

  // ---- 配信ログへ：回ごとの記録から行を作る（時刻は、概要欄と同じもの）
  const tsSheet=sec=>{sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return h?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};
  // full＝オープニング・エンディング・足した行も入れる（Apps Script 版4から）
  function sheetRows(s,full){
    const info=state.sessInfo?.[s.id]||{},out=[];
    const song=x=>{
      const r=repFind(x.title,x.artist),t=Number.isFinite(x.ts)?x.ts:recTs(x,info);
      const src=usedSrc(x),by=src?provCanon(src.by):'';
      const name=src?(src.n||(x.title+' / '+(by||'カラオケ音源'))):'';
      return {t,kind:'曲',ts:tsSheet(t),tt:x.title,a:x.artist,k:r?.sk||x.title+'／'+x.artist,src:src?{n:name,u:src.u,by}:null}
    };
    for(const x of s.items)out.push(song(x));
    if(full){
      if(info.op!==0)out.push({t:-1,kind:'オープニング',ts:tsSheet(0)});
      for(const e of info.extra||[])out.push({t:e.ts,kind:'トーク・企画',ts:tsSheet(e.ts)});
      if(Number.isFinite(info.end))out.push({t:info.end+.5,kind:'エンディング',ts:tsSheet(info.end)});
      out.sort((a,b)=>a.t-b.t)
    }
    return out.map((x,i)=>({n:i+1,ts:x.ts,kind:x.kind,t:x.tt||'',a:x.a||'',k:x.k||'',src:x.src||null}))
  }
  const sheetDefaultId=s=>{const d=new Date(s.start);return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')};
  // 配信先・収益化は、前に選んだものを次の回の初めの値にする（このブラウザだけ）
  const SHEET_DEF_LS='otonoha-sheet-stream';
  const sheetDef=()=>{try{const v=JSON.parse(localStorage.getItem(SHEET_DEF_LS)||'{}');return v&&typeof v==='object'?v:{}}catch(_){return {}}};
  function sheetBox(s,box){
    const info=state.sessInfo[s.id]||(state.sessInfo[s.id]={url:''}),def=sheetDef();
    box.replaceChildren();
    const fld=(label,el)=>{const l=document.createElement('label');l.className='studio-field';l.append(label,el);return l};
    const pick=(opts,val)=>{const e=document.createElement('select');for(const v of ['',...opts])e.append(Object.assign(document.createElement('option'),{value:v,textContent:v||'（選ばない）'}));e.value=opts.includes(val)?val:'';return e};
    const id=document.createElement('input');id.maxLength=60;id.value=info.sheet?.id||sheetDefaultId(s);
    const tt=document.createElement('input');tt.maxLength=300;tt.placeholder='任意';tt.value=info.tt||'';
    const dest=pick(['YouTube','IRIAM','その他'],info.dest||def.dest||''),mon=pick(['あり','なし'],info.mon||def.mon||'');
    const keep=()=>{info.tt=tt.value.trim().slice(0,300);info.dest=dest.value;info.mon=mon.value;for(const k of ['tt','dest','mon'])if(!info[k])delete info[k];save();try{localStorage.setItem(SHEET_DEF_LS,JSON.stringify({dest:dest.value,mon:mon.value}))}catch(_){}};
    tt.oninput=keep;dest.onchange=keep;mon.onchange=keep;
    const addL=document.createElement('label');addL.className='studio-field sb-check';
    const add=document.createElement('input');add.type='checkbox';add.checked=true;addL.append(add,' 配信一覧にも、この配信の行を足す');
    const say=document.createElement('p');say.className='studio-mini';say.setAttribute('aria-live','polite');
    const sent=()=>info.sheet?.at?'送った日時：'+localTime(info.sheet.at)+'（配信ID '+info.sheet.id+'）。':'';
    say.textContent=sent()+'時刻は、概要欄と同じものを送ります（手で入れた時刻。なければ、記録した時刻に「全体をずらす」を足したもの）。';
    const g=document.createElement('div');g.className='studio-inline';g.append(fld('配信先（配信一覧に入れる）',dest),fld('収益化（配信一覧に入れる）',mon));
    const row=document.createElement('div');row.className='studio-row';
    const v4=()=>(sheetLink()?.ver||0)>=SHEET_NEED;
    const go=async replace=>{
      const c=sessOf(s.id);if(!c||!c.items.length){say.textContent='送る曲がありません';return}
      const sid=id.value.trim();if(!sid){say.textContent='配信IDを入れてください';return}
      const d=new Date(c.start);
      keep();say.textContent='送っています…';send.disabled=again.disabled=true;
      try{
        // 版が分からないとき（前の版でつないだまま）は、先に確かめる
        if(!sheetLink()?.ver){try{sheetLinkInfo(await sheetCall('ping'));renderSheetBar()}catch(_){}}
        const j=await sheetCall('log',{stream:{id:sid,date:d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate(),prof:c.prof||'',title:tt.value.trim(),addStream:add.checked,dest:dest.value,mon:mon.value,replace:!!replace},rows:sheetRows(c,v4())});
        info.sheet={id:sid,at:new Date().toISOString()};saveNow();
        const a=j.added||{};
        say.textContent=(a.replaced?'入れ替えました：':'送りました：')+'配信ログ '+(a.rows||0)+'行'+(a.stream?'・配信一覧 1行':'')+(a.songs?'・曲タブに新しい曲 '+a.songs+'曲（表記の状態「下書き・要確認」）':'')+(a.srcs?'・音源タブに新しい音源 '+a.srcs+'件':'')+'。'+(v4()?'':'（Apps Script が版'+(sheetLink()?.ver||'3以下')+'なので、配信先・収益化と、オープニング・エンディングの行は送っていません）');
        again.hidden=!v4()
      }catch(e){say.textContent=(e.exists?'送りませんでした：':'')+e.message+(e.exists?(v4()?'（直したものに入れ替えるときは「送り直す」を押します）':'（配信IDを変えると送れます）'):'');if(e.exists)again.hidden=!v4()}
      send.disabled=again.disabled=false
    };
    const send=rowBtn('シートの配信ログへ送る','accent',()=>go(false));
    const again=rowBtn('送り直す（この配信IDの行を入れ替える）','',e=>armed(e.currentTarget,'もう一度押すと、シートの行を入れ替える',()=>go(true)),'時刻や音源を直したあと、シートの配信ログにある、この配信IDの行を消して、いまの内容を入れます');
    again.hidden=!(info.sheet?.at&&v4());
    const cp=rowBtn('配信ログ用にコピー（貼り付けで入れる）','',()=>{
      const c=sessOf(s.id);if(!c)return;const sid=id.value.trim()||sheetDefaultId(c);
      copy(sheetRows(c,true).map(x=>[sid,x.n,x.ts,x.kind,x.kind==='曲'?x.k:'',x.src?.n||''].map(v=>String(v).replace(/[\t\n]/g,' ')).join('\t')).join('\n'));
      say.textContent='コピーしました。シートの配信ログで、空いている行のA列（配信ID）を選んで貼り付けます。配信一覧に配信IDの行がないと、判定が出ません。'
    });
    row.append(send,again,cp);
    if(!sheetLink())send.disabled=true,send.title='「歌枠管理シートとつなぐ」で、Apps Script をつなぐと使えます';
    box.append(fld('配信ID（配信一覧・配信ログの「配信ID」）',id),fld('枠タイトル（配信一覧に入れる）',tt),g,addL,row,say)
  }
