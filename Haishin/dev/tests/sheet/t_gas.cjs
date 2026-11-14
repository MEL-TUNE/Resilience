// 版3の Apps Script を、試験用シートの写しの値でまねて動かす
const assert = require('assert');
const { mkSheet, mkGas } = require('./mockgas.cjs');
const fx = require('./fx_part.json');
const blank = (rows, cols) => rows.map((r, i) => i === 0 ? r : r.map((v, j) => cols.includes(j + 1) ? '' : v));
const ARR = (head, f) => ({ head, f });
function build() {
  const S = fx['曲'];
  const song = mkSheet('曲', blank(S, [6, 7, 9]).map((r, i) => i === 0 ? r.map((h, j) => [6, 7, 9].includes(j + 1) ? '' : h) : r), {
    maxCols: 29,
    fx: {
      6: ARR('セトリ表記（自動）', (sh, r) => sh.disp(r, 1) ? '『' + sh.disp(r, 1) + '』' : ''),
      7: ARR('選択用（自動）', (sh, r) => sh.disp(r, 1) ? sh.disp(r, 1) + '／' + sh.disp(r, 3) : ''),
      9: ARR('歌詞を検索（自動）', (sh, r) => sh.disp(r, 1) ? '検索' : ''),
    },
    dv: { 5: ['確認済み', '下書き・要確認', '概要欄で使用済み'], 10: ['JASRAC', 'NexTone', 'なし（自作）', 'その他'] },
  });
  const R = fx['音源'];
  const src = mkSheet('音源', blank(R, [6, 8]).map((r, i) => i === 0 ? r.map((h, j) => [6, 8].includes(j + 1) ? '' : h) : r), {
    fx: { 6: ARR('URL（共有IDなし・自動）', (sh, r) => sh.disp(r, 5)), 8: ARR('チャンネルURL（自動）', (sh, r) => sh.disp(r, 7) ? 'url' : '') },
    dv: { 3: ['YouTube動画', '購入音源', '依頼制作', '自作（オリジナル曲）', 'その他'], 9: ['可', '不可', '条件付き', '未確認'], 16: ['原曲キー', '女性キー', '男性キー', 'その他'], 17: ['出る', '出ない'] },
  });
  const prov = mkSheet('提供者', [
    ['提供者名（表示）', '概要欄に載せるURL（チャンネル・公式サイト）', 'YouTube配信で使用', '収益化済み配信で使用', 'YouTube以外の配信（IRIAM等）で使用', 'クレジット表記の指定', '利用規約・説明のURL', '確認日', 'メモ（要点）', '規約・説明の原文（転記）', '読み（並べ替え用）'],
    ['Hiroのピアノ伴奏アレンジ', 'https://www.youtube.com/channel/UCWX2b3xIeJHoiNOPd9nTuKA', '可', '可', '可', '', '', '2026/10/30', '', '', 'hiroのぴあのばんそうあれんじ'],
    ['OKE-sound', '', '可', '可', '可', '', '', '', '', '', 'oke-sound'],
    ['SELA', '', '可', '可', '不可', '', '', '', '', '', 'sela'],
    ['かいちょ', '', '可', '可', '可', '', '', '', '', '', 'かいちょ'],
    ['カラオケ歌っちゃ王', '', '条件付き', '不可', '不可', '', '', '', '', '', 'からおけうたっちゃおう'],
    ['桜音ふう', '', '条件付き', '条件付き', '条件付き', '', '', '', '', '', 'さくらねふう'],
  ], { dv: { 3: ['可', '不可', '条件付き', '未確認'] } });
  const log = mkSheet('配信ログ', [
    ['配信ID', '順番', 'タイムスタンプ', '区分', '曲（選ぶ）', '音源（選ぶ）'],
    ['例001', '1', '00:00', 'オープニング'],
    ['例001', '2', '00:46', '曲', 'Endless Story／田村ゆかり', 'Endless Story (C3 -シーキューブ- OP) -自作カラオケ-'],
    ['例001', '3', '05:08', '曲', '暁／志方あきこ', '【カラオケ音源】志方あきこ　暁　オフボーカル　暁のヨナ'],
  ], { fx: { 7: ARR('表記（自動）', () => '') } });
  const acc = mkSheet('配信アカウント', [['アカウントID', '名義'], ['A1', '雪見おと'], ['A2', 'コウサカチヅル']]);
  const list = mkSheet('配信一覧', [['配信ID', '配信日', 'アカウントID'], ['例001', '2026/10/25', 'A1']]);
  return mkGas({ '曲': song, '音源': src, '提供者': prov, '配信ログ': log, '配信アカウント': acc, '配信一覧': list });
}
let G = build(), j;
const ok = (name, f) => { try { f(); console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n  ', e.message); process.exitCode = 1; } };

ok('ping は版4と、シートのIDを返す', () => { j = G.call({ op: 'ping' }); assert.equal(j.version, 4); assert.equal(j.id, 'TESTID'); });
ok('合言葉が違うと断る', () => { j = JSON.parse(G.api.doPost({ postData: { contents: JSON.stringify({ op: 'sheet', key: 'x' }) } })); assert.equal(j.ok, false); });
let D;
ok('sheet：手で入れる列だけを読む（自動の列は入らない）', () => {
  D = G.call({ op: 'sheet' });
  assert.equal(D.ok, true, D.error);
  assert.equal(D.songs.length, 217); assert.equal(D.srcs.length, 126); assert.equal(D.provs.length, 6);
  assert.equal(D.songs[0].t, '30minutes night flight'); assert.equal(D.songs[0].r, 2);
  assert.ok(!('k' in D.songs[0]));
  assert.deepEqual(D.opts['曲'].st, ['確認済み', '下書き・要確認', '概要欄で使用済み']);
  assert.ok(D.opts['音源'].kk.includes('男性キー'));
  assert.equal(D.labels, null);
  assert.ok(!D.songsCols.includes('g'), 'ラベル列はまだない');
});
ok('曲を足す：読みの順の位置に差し込み、自動の列には書かない', () => {
  const sh = G.ss.sheets['曲'];
  j = G.call({ op: 'save', tab: '曲', r: 0, f: { t: 'からっぽ試験曲', a: 'テスト歌手', y: 'からっぽしけんきょく', st: '下書き・要確認' } });
  assert.equal(j.ok, true, j.error);
  assert.ok(j.added);
  const prev = sh.disp(j.r - 1, 4), nextY = sh.disp(j.r + 1, 4);
  assert.ok(prev <= 'からっぽしけんきょく' && nextY > 'からっぽしけんきょく', prev + ' / ' + nextY);
  assert.equal(sh.disp(j.r, 7), 'からっぽ試験曲／テスト歌手');
  assert.ok(sh.log.some(x => x[0] === 'insertBefore'));
});
ok('英字の曲は英字の並びの中に入る', () => {
  j = G.call({ op: 'save', tab: '曲', r: 0, f: { t: 'Zzz Test', a: 'X', y: 'zzz test' } });
  const sh = G.ss.sheets['曲'];
  assert.equal(j.ok, true, j.error);
  assert.ok(/^[a-z0-9]/.test(sh.disp(j.r - 1, 4)) && !/^[a-z0-9]/.test(sh.disp(j.r + 1, 4)), sh.disp(j.r - 1, 4) + ' / ' + sh.disp(j.r + 1, 4));
});
ok('同じ曲名・アーティストは足せない', () => { j = G.call({ op: 'save', tab: '曲', r: 0, f: { t: 'Lemon', a: '米津玄師' } }); assert.equal(j.ok, false); });
ok('知らない項目・自動の列は断る', () => {
  j = G.call({ op: 'save', tab: '曲', r: 0, f: { t: 'a', k: 'x' } }); assert.equal(j.ok, false);
  j = G.call({ op: 'save', tab: '曲', r: 0, f: { t: 'a', g: 'x' } }); assert.equal(j.ok, false); assert.match(j.error, /ラベル/);
});
ok('曲名を直すと、音源タブと配信ログの「曲（選ぶ）」も付け替える', () => {
  D = G.call({ op: 'sheet' });
  const s = D.songs.find(x => x.t === 'Endless Story');
  j = G.call({ op: 'save', tab: '曲', r: s.r, before: { t: s.t, a: s.a }, f: { t: 'Endless Story (改)' } });
  assert.equal(j.ok, true, j.error);
  assert.equal(j.moved.srcs, 1); assert.equal(j.moved.logs, 1);
  assert.equal(G.ss.sheets['配信ログ'].disp(3, 5), 'Endless Story (改)／田村ゆかり');
  assert.ok(G.ss.sheets['音源'].g.some(r => r[0] === 'Endless Story (改)／田村ゆかり'));
});
ok('ほかで変わっていたら書かない（読み直しを頼む）', () => {
  D = G.call({ op: 'sheet' });
  const s = D.songs.find(x => x.t === 'Lemon');
  j = G.call({ op: 'save', tab: '曲', r: s.r, before: { t: s.t, a: s.a, w: 'ちがう値' }, f: { w: '新しい作品' } });
  assert.equal(j.ok, false); assert.ok(j.conflict);
});
ok('行がずれていても、曲名・アーティストで見つけて直す', () => {
  D = G.call({ op: 'sheet' });
  const s = D.songs.find(x => x.t === 'Lemon');
  G.call({ op: 'save', tab: '曲', r: 0, f: { t: 'AAA先頭', a: 'X', y: 'aaa' } }); // 英字の先頭に1行入って、Lemon の行がずれる
  j = G.call({ op: 'save', tab: '曲', r: s.r, before: { t: s.t, a: s.a, w: s.w }, f: { w: 'テスト作品' } });
  assert.equal(j.ok, true, j.error); assert.equal(j.r, s.r + 1);
  assert.equal(G.ss.sheets['曲'].disp(j.r, 2), 'テスト作品');
});
ok('音源を足す：いちばん下。曲がないと断る。名前が重なると断る', () => {
  j = G.call({ op: 'save', tab: '音源', r: 0, f: { s: 'ないうた／だれ', n: 'x' } }); assert.equal(j.ok, false);
  j = G.call({ op: 'save', tab: '音源', r: 0, f: { s: 'Lemon／米津玄師', n: 'Lemon 男性キー', kk: '男性キー', key: '-5', u: 'https://youtu.be/abcdefghijk?si=zz' } });
  assert.equal(j.ok, true, j.error); assert.equal(j.r, 128);
  assert.equal(G.ss.sheets['音源'].fmt['128:4'], '@', 'キーは文字として入れる');
  j = G.call({ op: 'save', tab: '音源', r: 0, f: { s: 'Lemon／米津玄師', n: 'Lemon 男性キー' } }); assert.equal(j.ok, false);
});
ok('音源名を直すと、配信ログの「音源（選ぶ）」も付け替える', () => {
  D = G.call({ op: 'sheet' });
  const s = D.srcs.find(x => x.n.startsWith('【カラオケ音源】志方あきこ'));
  j = G.call({ op: 'save', tab: '音源', r: s.r, before: { n: s.n }, f: { n: '暁（新しい名前）' } });
  assert.equal(j.ok, true, j.error); assert.equal(j.moved.logs, 1);
  assert.equal(G.ss.sheets['配信ログ'].disp(4, 6), '暁（新しい名前）');
});
ok('提供者名を直すと、音源の「提供者（選ぶ）」も付け替える', () => {
  D = G.call({ op: 'sheet' });
  const p = D.provs.find(x => x.n === 'OKE-sound');
  const before = G.ss.sheets['音源'].g.filter(r => r[6] === 'OKE-sound').length;
  j = G.call({ op: 'save', tab: '提供者', r: p.r, before: { n: p.n }, f: { n: 'OKE-sound（改）' } });
  assert.equal(j.ok, true, j.error); assert.equal(j.moved.srcs, before);
});
ok('先頭が「=」の文字も、数式にならないよう文字の書式で入れる', () => {
  D = G.call({ op: 'sheet' });
  const s = D.songs.find(x => x.t === 'Lemon');
  j = G.call({ op: 'save', tab: '曲', r: s.r, before: { t: s.t, a: s.a, memo: s.memo }, f: { memo: '=1+1' } });
  assert.equal(j.ok, true); assert.equal(G.ss.sheets['曲'].fmt[j.r + ':16'], '@');
  assert.equal(G.ss.sheets['曲'].raw(j.r, 16), "'=1+1");
});
ok('setup：ラベル一覧タブと曲タブのラベル列（T列）を作る。2回目は作らない', () => {
  j = G.call({ op: 'setup', seed: [{ name: 'アニメソング', group: 'ジャンル' }, { name: 'J-POP', group: 'ジャンル' }, { name: 'だめ/名前', group: 'x' }] });
  assert.equal(j.ok, true, j.error); assert.deepEqual(j.made, { tab: true, col: true });
  assert.equal(G.ss.sheets['曲'].disp(1, 20), 'ラベル');
  D = G.call({ op: 'sheet' });
  assert.deepEqual(D.labels.map(x => x.name), ['アニメソング', 'J-POP']);
  assert.ok(D.songsCols.includes('g'));
  j = G.call({ op: 'setup', seed: [] }); assert.deepEqual(j.made, { tab: false, col: false });
});
ok('曲にラベルを付ける（区切りをそろえる）', () => {
  D = G.call({ op: 'sheet' });
  const s = D.songs.find(x => x.t === 'Lemon');
  j = G.call({ op: 'save', tab: '曲', r: s.r, before: { t: s.t, a: s.a, g: '' }, f: { g: 'J-POP,アニメソング、J-POP' } });
  assert.equal(j.ok, true, j.error); assert.equal(G.ss.sheets['曲'].disp(j.r, 20), 'J-POP、アニメソング');
});
ok('ラベルの名前を変える・消すと、曲のラベルも直る', () => {
  j = G.call({ op: 'labels', base: ['アニメソング', 'J-POP'], list: [{ was: 'J-POP', name: 'Jポップ', group: 'ジャンル' }, { was: '', name: '男性キー曲', group: '原曲のキー' }] });
  assert.equal(j.ok, true, j.error); assert.equal(j.songs, 1);
  D = G.call({ op: 'sheet' });
  assert.equal(D.songs.find(x => x.t === 'Lemon').g, 'Jポップ');
  assert.deepEqual(D.labels.map(x => x.name), ['Jポップ', '男性キー曲']);
});
ok('ラベル：古い一覧のまま送ると断る・「/」は使えない', () => {
  j = G.call({ op: 'labels', base: ['アニメソング', 'J-POP'], list: [] }); assert.equal(j.ok, false); assert.ok(j.conflict);
  j = G.call({ op: 'labels', base: ['Jポップ', '男性キー曲'], list: [{ name: 'a/b' }] }); assert.equal(j.ok, false);
});
ok('オトノハの read（既存）はラベルも送る', () => {
  j = G.call({ op: 'read' });
  assert.equal(j.ok, true); assert.equal(j.songs.find(x => x.t === 'Lemon').g, 'Jポップ');
});
ok('編集の記録：直した項目の前と後が残る（新しい順）', () => {
  j = G.call({ op: 'history', n: 500 });
  assert.equal(j.ok, true, j.error);
  const r = j.rows.find(x => x.field === '作品名（タイアップ）' && x.after === 'テスト作品');
  assert.ok(r, '作品名の記録'); assert.equal(r.act, '直した'); assert.equal(r.k, 'w'); assert.equal(r.id, 'Lemon／米津玄師');
  assert.ok(j.rows.some(x => x.act === '付け替え'));
  assert.ok(j.rows.some(x => x.act === '足した' && x.id === 'からっぽ試験曲／テスト歌手'));
  assert.ok(j.rows.some(x => x.act === 'ラベル'));
  assert.ok(j.rows.some(x => x.act === '準備'));
  assert.equal(G.ss.sheets['編集の記録'].disp(1, 1), '日時');
});
ok('控え：4つのタブを写して隠す。元のタブは変えない', () => {
  const before = JSON.stringify(G.ss.sheets['曲'].g);
  j = G.call({ op: 'backup', why: 'ラベルの名前を変える前' });
  assert.equal(j.ok, true, j.error); assert.equal(j.made.length, 4);
  for (const n of j.made) { assert.ok(G.ss.sheets[n], n); assert.equal(G.ss.sheets[n].hidden, true); }
  assert.equal(JSON.stringify(G.ss.sheets['曲'].g), before);
  j = G.call({ op: 'backup' }); assert.equal(j.ok, true); assert.equal(new Set(j.made).size, 4);
});
ok('read：音源のキーの区分・歌詞表示も送る', () => {
  j = G.call({ op: 'read' });
  const x = j.srcs.find(y => y.n === 'Lemon 男性キー'); assert.equal(x.kk, '男性キー');
});
ok('自動の列には一度も書いていない', () => {
  for (const sh of Object.values(G.ss.sheets)) for (const x of sh.log) if (typeof x[0] === 'number') assert.ok(!sh.fx[x[1]] || x[0] === 1, sh.name + ' ' + x);
});
