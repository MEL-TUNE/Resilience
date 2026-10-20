// 表示用の台詞です。入力本文や読み上げ音声は変更しません。
window.RIO_DEFAULT_CONFIG = Object.freeze({
  "productName": "彼岸リオ Reader",
  "displayName": "彼岸リオ",
  "lines": {
    "ready": "読みたい文章を、こちらへ。目を休める時間にしませんこと。",
    "play": "では、続きを読みすすめますわ。どうぞ楽になさって。",
    "pause": "ここでひと息入れましょう。続きは、こちらの文から再開できますわ。",
    "finish": "最後まで読みおえました。このまま余韻を楽しむのもよいですわね。",
    "empty": "まだ文章が入っていないようですわ。入力欄に貼りつけてから、ご再生ください。",
    "error": "読みあげが止まったようですわ。音声の設定を確かめ、もう一度お試しくださいませ。"
  },
  "skipExactLines": [
    "↓",
    "-----",
    "⋱♱⋰",
    "⋱♱⋰ ⋱♱⋰ ⋱♱⋰ ⋱♱⋰ ⋱♱⋰"
  ],
  "skipContains": [],
  "stripMarkdown": true,
  "stripUrls": true
});
