// 版4の Apps Script：配信ログへ送るところ（配信先・収益化・枠タイトル、オープニング・エンディングの行、送り直し）。
// 小さな作りもののシートで動かす（node t_gas4.cjs）。本物の Google の上での動きを確かめたものではありません。
const assert = require('assert');
const { mkSheet, mkGas } = require('./mockgas.cjs');
const ARR = (head, f) => ({ head, f });
function build() {
  const song = mkSheet('曲', [['表示用曲名', '作品名（タイアップ）', '表示用アーティスト', '読み（並べ替え用）', '表記の状態', '', ''], ['Days', 'ながされて藍蘭島', '堀江由衣', 'days', '確認済み']], {
    fx: { 6: ARR('セトリ表記（自動）', () => ''), 7: ARR('選択用（自動）', (sh, r) => sh.disp(r, 1) ? sh.disp(r, 1) + '／' + sh.disp(r, 3) : '') } });
  const src = mkSheet('音源', [['曲（選ぶ）', '音源名（動画タイトル・購入音源名）', '種類', 'キー', 'URL（貼り付け）', '', '提供者（選ぶ）'], ['Days／堀江由衣', '【カラオケ】Days/堀江由衣', 'YouTube動画', '', 'https://www.youtube.com/watch?v=9ty9GZU3WwE', '', 'カラオケ歌っちゃ王']], { fx: { 6: ARR('URL（共有IDなし・自動）', (sh, r) => sh.disp(r, 5)) } });
  const prov = mkSheet('提供者', [['提供者名（表示）', '概要欄に載せるURL（チャンネル・公式サイト）'], ['カラオケ歌っちゃ王', 'https://www.youtube.com/@uta-cha-oh']]);
  const log = mkSheet('配信ログ', [['配信ID', '順番', 'タイムスタンプ', '区分', '曲（選ぶ）', '音源（選ぶ）'], ['例001', '1', '00:00', 'オープニング'], ['例001', '2', '00:46', '曲', 'Days／堀江由衣', '【カラオケ】Days/堀江由衣']], { fx: { 7: ARR('表記（自動）', () => '') } });
  const acc = mkSheet('配信アカウント', [['アカウントID', '名義'], ['A1', '雪見おと']]);
  const list = mkSheet('配信一覧', [['配信ID', '配信日', 'アカウントID', '配信先', '収益化', '枠タイトル', '導入文（概要欄の冒頭）', 'メモ'], ['例001', '2026/10/25', 'A1', 'YouTube', 'なし', 'れい']]);
  return mkGas({ '曲': song, '音源': src, '提供者': prov, '配信ログ': log, '配信アカウント': acc, '配信一覧': list });
}
const G = build(); let j;
const ok = (name, f) => { try { f(); console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n  ', e.message); process.exitCode = 1; } };
const rows = [
  { n: 1, ts: '00:00', kind: 'オープニング' },
  { n: 2, ts: '01:54', kind: '曲', t: 'Days', a: '堀江由衣', k: 'Days／堀江由衣', src: { n: '【カラオケ】Days/堀江由衣', u: 'https://www.youtube.com/watch?v=9ty9GZU3WwE', by: 'カラオケ歌っちゃ王' } },
  { n: 3, ts: '28:40', kind: 'トーク・企画' },
  { n: 4, ts: '30:00', kind: '曲', t: 'あたらしい曲', a: 'だれか', k: 'あたらしい曲／だれか', src: null },
  { n: 5, ts: '45:01', kind: 'エンディング' },
];
const L = () => G.ss.sheets['配信ログ'].g.filter(r => r[0] === 'S1'), T = () => G.ss.sheets['配信一覧'].g.find(r => r[0] === 'S1');
ok('ping は版4を返す', () => { j = G.call({ op: 'ping' }); assert.equal(j.version, 4); });
ok('log：曲の行と、オープニング・トーク・企画・エンディングの行が入る', () => {
  j = G.call({ op: 'log', stream: { id: 'S1', date: '2026/11/13', prof: '雪見おと', title: 'テスト枠', addStream: true, dest: 'YouTube', mon: 'なし' }, rows });
  assert.equal(j.ok, true, j.error); assert.equal(j.added.rows, 5); assert.equal(j.added.stream, 1); assert.equal(j.added.songs, 1);
  const l = L(); assert.equal(l.length, 5);
  assert.deepEqual(l.map(r => r[3]), ['オープニング', '曲', 'トーク・企画', '曲', 'エンディング']);
  assert.equal(l[0][4] || '', ''); assert.equal(l[1][4], 'Days／堀江由衣'); assert.equal(l[1][5], '【カラオケ】Days/堀江由衣'); assert.equal(l[4][2], '45:01');
});
ok('log：オープニングなどの行から、曲タブ・音源タブに行を足さない（足すのは、シートにない曲だけ）', () => {
  assert.equal(G.ss.sheets['曲'].g.filter(r => r[0]).length, 3); assert.equal(G.ss.sheets['音源'].g.filter(r => r[1]).length, 2);
});
ok('log：配信一覧に、配信ID・日付・アカウント・配信先・収益化・枠タイトルが入る', () => { assert.deepEqual(T().slice(0, 6), ['S1', '2026/11/13', 'A1', 'YouTube', 'なし', 'テスト枠']); });
ok('log：同じ配信IDをそのまま送ると、重ねずに止める', () => { j = G.call({ op: 'log', stream: { id: 'S1', addStream: true }, rows }); assert.equal(j.ok, false); assert.equal(j.exists, true); assert.equal(L().length, 5); });
ok('log：送り直し（replace）は、その配信IDの行だけを入れ替える。ほかの配信の行は残る', () => {
  j = G.call({ op: 'log', stream: { id: 'S1', addStream: true, replace: true, mon: 'あり' }, rows: rows.slice(0, 2).concat([{ n: 3, ts: '40:00', kind: 'エンディング' }]) });
  assert.equal(j.ok, true, j.error); assert.equal(j.added.replaced, 5); assert.equal(j.added.rows, 3); assert.equal(j.added.stream, 0);
  assert.deepEqual(L().map(r => r[2]), ['00:00', '01:54', '40:00']);
  assert.equal(G.ss.sheets['配信ログ'].g.filter(r => r[0] === '例001').length, 2);
});
ok('log：送り直しで、配信一覧は送られてきたものだけ書き換える（空のものは、いまの値を残す）', () => { assert.deepEqual(T().slice(0, 6), ['S1', '2026/11/13', 'A1', 'YouTube', 'あり', 'テスト枠']); });
ok('log：版3までの形（kind なし・配信先なし）も、そのまま送れる', () => {
  j = G.call({ op: 'log', stream: { id: 'S2', date: '2026/11/14', prof: '雪見おと', title: '', addStream: true }, rows: [{ n: 1, ts: '00:10', t: 'Days', a: '堀江由衣', k: 'Days／堀江由衣', src: null }] });
  assert.equal(j.ok, true, j.error); const r = G.ss.sheets['配信ログ'].g.find(x => x[0] === 'S2'); assert.equal(r[3], '曲'); assert.equal(r[4], 'Days／堀江由衣');
  const t = G.ss.sheets['配信一覧'].g.find(x => x[0] === 'S2'); assert.equal(t[2], 'A1'); assert.equal(t[3] || '', '');
});
ok('自動の列には一度も書いていない', () => { for (const sh of Object.values(G.ss.sheets)) for (const x of sh.log) if (typeof x[0] === 'number') assert.ok(!sh.fx[x[1]] || x[0] === 1, sh.name + ' ' + x[0] + ',' + x[1]); });
