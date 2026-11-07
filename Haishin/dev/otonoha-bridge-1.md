# オトノハ連携（Otonoha Bridge 1）

配信処オトノハの企画卓「アプリを並べる」に登録したHTMLアプリは、ブラウザ標準の window.postMessage で、オトノハと伝言を交わせます。

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
