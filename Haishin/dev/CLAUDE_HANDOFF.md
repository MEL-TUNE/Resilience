# Claudeへの引き継ぎ

以下を添付パッケージと一緒に渡してください。

---

配信処オトノハの開発を継続してください。まずREVIEW.mdを読み、修正済みと未対応の事項を区別してください。

使う完成ファイルはindex.html、編集元はsource/index.html・source/css/・source/js/です。編集元を変更した後、`python build.py` でindex.htmlを再生成します。生成後のindex.htmlだけを編集すると次のビルドで変更が消えるため、編集元を正としてください。

2026年10月30日の整理で、ミュート維持、録音開始の多重実行防止、空の名義・重複参照からのキャラクター補完、動きの設定値の引継ぎ、キャラクター保存上限、収録中の映像設定読み込み防止、読み込み前の置換確認、動画開始停止の競合、パック素材キー重複検証を修正しています。これらを元に戻さないでください。

元の三つのスクリプト境界と実行順序は維持しています。ES Modulesへの全面移行はしていません。共有されているcfg・ctx・db・音声バス・録音状態などの依存を把握してから分割してください。

既存のlocalStorageキー・IndexedDB名・素材キーは維持してください（名前に kissa を含むものも、端末内のデータを読むために残しています）。.kissa と旧形式の読み込み互換は、0.7.0でユーザーの判断により廃止しました（下の追記を参照）。ユーザーが使っている立ち絵や画像を、確認なく別画像に差し替えないでください。

設定ファイルは .live だけです。録音済みテイクと収録済み動画は .live に含まれません。

検証コマンドは `node --expose-internals tests/checks.cjs` です。Node.js 24の同梱Acornを使用しており、Node内部モジュールのパスが異なる環境では調整が必要です。回帰検証は関数の単体検証であって、実マイクやOBS連携の合格を意味しません。

最優先で追加してほしい確認は、Chrome/Edgeでの起動、既存設定の復元、ミュートしたままの録音終了、開始連打、立ち絵切替、収録中の読み込み拒否、短い動画の実再生、配信用出力の実機試験です。長尺動画はまだ停止までメモリに保持します。逐次保存は新しい設計として実装・検証してください。

歌枠管理シートは参照・レビューのみで、変更していません。曲・音源の不変ID、曲と音源の一致確認、未入力時の要確認、明示的な可否判定、IRIAM/17LIVEの別管理は改善案です。実施済みと誤認しないでください。ユーザーが望む曲名／歌手での選択操作は維持し、不変IDを採用する場合も通常画面には隠せます。

提供者の規約原文、元の登録表記を「重複している」という理由だけで削らないでください。端末内データの移行処理（映像設定の fmt 1→2、legacyVideos）は、ユーザーの端末のデータを読むためのもので、バックアップファイルの互換とは別に扱っています。不要なUIは、使用実態を確認して折りたたむことから検討してください。

修正を進める際は、変更したこと・理由・実施した検証・未検証の範囲を日本語で説明してください。

---

## 2026-10-30 追記（STUDIO 0.4.9）

- ユーザーの判断で、旧アプリ形式（.kinniku／KNKRPACK・kinniku-soundboard JSON）の読み込みを廃止しました。
- 設定ファイルは2種類です。
  - `.live`（先頭 `OTNHLIVE`、format `otonoha-live-pack`）：.kissa と同じ中身に、映像側の state（`studio`）と画像（kind `studio`）を加えた全部入り。
  - `.kissa`（先頭 `MTKSPACK`）：効果音・BGMのみ。純喫茶オトノハと共通なので形式を変えないこと。
  - 以前のスタジオ設定 .json は読み込みのみ対応（書き出しは .live に統一）。
- 季節の演出は名義・キャラクターから切り離しました（profileSnap に effect を持たない）。
- 降らせる画像は「画像のプリセット」（state.fxPresets、effect 値 `p:<id>`）。画像は `fxp-<id>-<0..5>`。旧 'image' はプリセット `img`（画像キーは従来の particle〜particle5）として引き継ぎます。

## 2026-10-30 追記（STUDIO 0.5.0）

- 画面上部で「配信・録画（PNGTuber）」と「ラジオ（音声のみ）」を切り替えます（body[data-app]、localStorage `<名前空間>otonoha_app`）。設定画面は「配信・録画」「ラジオ」「共通」の3区分。
- 上部の小さな録音欄（#miniBar）は、音声録音中または映像収録中だけ表示します。
- 追加：マスコット（state.mascots、画像 `msc-<id>`、話者 state.speaker）、表情差分（キャラクターの exprs、画像スロット `x<id>`／口開き `y<id>`）、画面の切り替え「配信終了」（scenes.end）と各画面の画像（`scene-<standby|away|end>`）、切り替え時のBGMの持ち上げ（state.sceneBoost dB、`window.__sceneBgmBoost`）。
- 削除：「音の操作卓」、ステージ上の見出し。

## 2026-10-30 追記（STUDIO 0.5.1：整理）

- ソースの構成を変えました。`source/js/audio/`（音声側・14ファイル）と `source/js/visual/`（映像側・14ファイル）に機能ごとに分け、`build.py` がファイル名順につなげて1ファイルにします。映像側は `data-wrap="iife"` で一つの関数に包まれ、変数を共有します（ファイルの順番が実行順です）。
- 画面の配置は index.html にそのまま書いてあります（実行時に要素を移動する処理はなくなりました）。
- 「収録スタジオ」は「ステージ」に統合しました（動画の収録はステージから行えます）。
- 使われていない CSS の規則（存在しない要素を指すもの）を削除し、1規則1行に整えました。`type+'-pad'` のように実行時に組み立てるクラス名があるので、クラス名の検索だけで削除の判断をしないこと。
- 検証：`node --expose-internals tests/checks.cjs`（フォルダを読むように変更済み）。

---

## 2026-11-06 追記（STUDIO 0.7.0）

- ユーザーの判断（配信処オトノハへ完全移行）で、.kissa の読み込み・書き出し、0.4.9以前のスタジオ設定 .json の読み込み、旧形式の設定値の変換（季節演出の snow／image、絵文字だけの効果音形式、単独の bgm、seVolume／bgmVolume、旧カテゴリ・旧タブ名、番組画像の prog-ID 形式、0.6.5の名義タブ移し替え）を除去しました。
- 残しているもの：localStorage キーと IndexedDB 名、素材キー、映像設定の保存形式の版（fmt 2）と、0.6.8の動画一覧（legacyVideos）の移行。
- 設定の保存は、映像側 save()・音側 persist() とも約0.4秒（最長2秒）でまとめて書きます。確定操作は saveNow()／persistNow()。ページを閉じる・裏に回るときに書き出します。
- 歌唱の記録は5,000件で切り捨てません。時刻を直した記録は、記録したときの経過秒を off0 に残します。

---

## 2026-11-06 追記（STUDIO 0.7.4）

- 画像の左右反転は、ユーザーの指示で禁止です（立ち絵・マスコットの絵師さんの多くが反転を禁じているため）。マスコットの「画像を左右反転する」「走り回るときの向き」は撤去しました。立ち絵・マスコット・登録画像を反転して描く機能を追加しないでください。
- （0.7.5）画像を歪ませること（縦横で違う倍率、つぶす・伸ばす・裏返す）も、ユーザーの指示で禁止です。立ち絵・マスコット・降らせる画像・季節の演出・登録したすべての画像は、位置・回転・縦横同じ倍率の拡大縮小だけで描きます。tests/checks.cjs の「Images are never mirrored or stretched」が、canvas の scale(x,y) で x≠y や負の値を使う箇所を検出します（例外は、効果音動画用の花びら・葉っぱの形を描く p.scale だけで、これは画像ではなく図形の形づくりです）。

---

## 2026-11-07 追記（STUDIO 0.9.0）

- オトノハ連携（Otonoha Bridge 1）は js/visual/14-bridge.js。決まりは dev/otonoha-bridge-1.md。命令を足すときは version を変えずに type を足し、意味の変わる変更をするときは otonoha:2 として並行して受け付けてください（既存のアプリを壊さないため）。
- AI観客席は js/visual/15-audience.js。依頼文と検証は AI観客席 0.8（exe内の lib/personality.js）の規則に合わせています。つなぎ先を足すときは、audPrompt() の文をそのまま送り、返答を audParse() に通す形にしてください。
- ボイス録りは js/visual/16-voicerec.js。録音は IndexedDB の vr:ID に WAV で保存します。

---

## 2026-11-07 追記（STUDIO 0.9.1）

- スロット（役柄×セリフ）は js/visual/17-slot.js。役柄はセリフ帳のシチュエーションそのもので、別の保存場所は持ちません（設定は state.slot）。筋肉室スロット単体版（kinniku-slot-* の保存キー）とはデータを共有せず、やり取りは version 3 のJSONです。
- 取り込みは slotPlan()（見積もり・変更しない）→ slotApply() の順。重複の判定は 13-plays.js の serifNorm()（NFKC・空白除去・小文字）です。セリフ帳を変える操作の前には serifKeep() で取り消し用の控えを取ってください。
- 単体版のキー操作（Space・A・B）は入れていません。オトノハは効果音ボタンに利用者が1文字のキーを割り当てられるため、ぶつかるからです。

---

## 2026-11-08 追記（STUDIO 0.9.2）

- 企画のポン出しは js/visual/18-pon.js（設定は state.pon：hide と app）。ボタンは構成が変わったときだけ作り直し、点灯は0.4秒ごとに印だけ変えます。
- 1列表示（幅1099px以下）では、.studio-workspace の最初の div を display:contents にして、ステージ→音のお品書き→企画卓・歌枠ノート・AIキャラ の順に order で並べています（css/studio.css の末尾）。
- 曲リストの曲は srcs（u:URL, n:音源名, by:提供者, k:キー, kind:種類, f:音源ファイルの保存場所）、sk（シートの「選択用」表記）、w（作品名）、useSrc（最後に▶で開いた音源）を持ちます。歌唱の記録は src（音源名かURL）を持ちます。URLは okeNorm() で整え、http(s) 以外は受け付けません。
- 歌枠管理シートとの連携は js/visual/19-sheet.js。Apps Script のコードは dev/otonoha-sheet.gs で、19-sheet.js の SHEET_GAS に同じ内容を埋め込んでいます（変えるときは両方）。つなぎ先は localStorage の otonoha-sheet-link に置き、state には入れません。シートの列は見出しの始まりの文字で探します。

---

## 2026-11-08 追記（STUDIO 0.9.3）

- 背景画像は js/visual/85-backgrounds.js。名義（profiles[].bgs[aspect] と bgSel[aspect]）に、{id, name, x, y, z} を持ちます。画像は IDB の visual-studio:bgi-<id> で、使うときに読み込みます（bgImage）。.live の書き出しでは、読み込んでいない背景画像も __otonohaStudio.extra（bgAllBlobs）で渡します。
- 映像の向きは landscape / portrait / x34（960×1280）。縦横の比を前提にした固定の寸法を書かないでください（プレビューは W/H から計算）。
- アプリ表示の「キャラクターだけ」：アプリの表示があるときだけ、立ち絵を透過のレイヤー（appLayerCtx）に描いてから配信画面へ写し、そのレイヤーを切り抜いてアプリ側に使います（drawAvatar の4つ目の引数が描く先）。マスコットはアプリ側だけ appCharDraw でキャラクターのまわりを楕円にめぐらせます。どちらも縦横同じ倍率で縮めるだけです。
- .live の studio 資産に app-<id>（text/html）が入ります。読み込みでは IDB の app:<id> に戻します。

---

## 2026-11-08 追記（STUDIO 0.9.4）

- ファイルの地図と守ることは dev/STRUCTURE.md にまとめました。まずそちらを読んでください。
- visual/00-basics.js は 00-state / 01-sanitize / 02-assets / 03-values に、20-characters.js は 20-characters / 21-character-ui / 22-stage-controls に、60-loop-capture-files.js は 60-frame / 61-capture / 62-videos / 63-studio-files に分けました（つなぐ順番は元のまま）。
- 向きごとの位置は 41-aspect-memory.js。いまの値（state.x・y・scale、マスコットの x・y・size・tilt）は、いまの向きのもの。向きを変えるとき aspectStash（前の向きへ控える）→ aspectRestore（次の向きの控えに戻す）。syncChar が chars[id].pos[向き] を、activateChar が控えを使います。
- drawAvatar(now, talking, blink, cx, view)：view={pose,k,cx,bottom} を渡すと、同じ動きのまま別の場所・倍率で描きます（アプリ表示の透過レイヤー用。1000×1000 に全身を描いてから切り抜く）。動きの計算は1フレームに1回です。
- tests/checks.cjs の取り出す関数の一覧に aspectPosClean を加えました。

---

## 2026-11-08 追記（STUDIO 0.9.5）

- 0.9.4 の不具合：aspectPosClean が立ち絵の位置を ±100 に切り詰めていた（つまみは横 ±300・縦 -200〜500）。CHAR_RANGES を使うように直した。
- スロット・ルーレット・サイコロの位置と大きさは state.playLay[向き][slot|wheel|dice]={x,y,s}。描くときに playPlace() が縦横同じ倍率で移し、ドラッグ用の範囲 playBoxes を覚える。
- ドラッグは「✋ ドラッグで動かす」（dragFree）か、その場で調整が開いているとき。
- 作者はこのあと ChatGPT で修正・チェックし、修正後の index.html を次のチャットに持ってくる予定。dev/HANDOFF_TO_CHATGPT.md を渡している。戻ってきたら、0.9.5 の index.html と比べて差分を source/ に取り込むこと（ChatGPT には、整形し直さない・変えたところに /* GPT: … */ の印・版の表示を 0.9.5-gpt1 などにする・変更点の一覧、をお願いしている）。

---

## 2026-11-08 追記（STUDIO 0.9.6）

- ChatGPT の 0.9.5-gpt1（83-tuning-drag.js の pointerdown・pointermove・endDrag、#studioCanvas.locked の touch-action）を source に取り込んだ。差分は3か所だけで、ほかは 0.9.5 と同じだった。
- 取り込み後のテスト：t096（CDP のタッチで、1本指のドラッグ、2本目の指に横取りされないこと、ロック中の touch-action）。0.9.5 では横取りが起きることも確かめた。

---

## 2026-11-09 追記（STUDIO 0.9.7）

- お題帳は js/visual/24-topics.js。state.topics={decks:[{id,name,instr,theme,count,fields[],head,body,who,mode:'card'|'comment',label,autoUse,items:[{id,f:{項目名:値},st,at}],cur}],sel}。点検は topicSanitize（01-sanitize から呼ぶので、外の const を使わない）。
- 貼り出しは play.topic → drawTopic（13-plays の drawPlays から）。位置は playLay の 'topic'。コメントの形は audShow に force:true を付けて出す（AI観客席の表示がオフでも出る）。
- AITuber の設計は作者の判断待ちで止めている。再開するときは dev/AITUBER_RESUME.md を読む。

## 2026-11-09 追記（STUDIO 0.9.8）

- 作者の指摘「番組設定どこ……勝手に削除していますよね？」：0.9.6→0.9.7 で消した要素はない。ただし 0.5.0 から `body[data-app="live"] .recbar{display:none}` で番組のボタン（#progChips・#progEdit）が配信・動画で見えず、BGM欄の「番組ボタンを長押し」という案内だけが残っていた。
- 新しいファイル `js/visual/86-plan-nav.js`：
  - `progPlace(app)`：配信・動画では `.prog-row` をステージの `#liveProgSlot` へ要素ごと移し、#progEdit を見せる。ラジオでは元の録音バーへ戻して隠す（ラジオの見た目は変えていない）。
  - 企画卓（#studioPlan）を `.plan-group` に分ける（DOM を移すだけ。ID・働きはそのまま）。
  - 目次 `#jumpBar`（.studio-tabs の直後、sticky）。`window.__otonohaAppChanged` を包み、モードのボタンでも作り直す。移動は scrollIntoView ではなく window.scrollTo（scrollIntoView は横にも動かすため）。
- 注意：目次や番組の行が狭い画面で幅を押し広げると、スマホ全体が縮小表示になる（scrollWidth の検査では見つからない）。t098 は `max(scrollWidth, innerWidth) - screen.width` で確かめる。

## 2026-11-09 追記（STUDIO 0.9.9）

- 作者の指摘：「マイクを再接続」がステージの上に大きくあって邪魔。画面を見ながらすぐポン出ししたい（スロット・ルーレット・サイコロ・コメントノックもポン出しの対象）。番組・BGMの設定がたくさんの場所にあって見づらい。
- ステージ（.stage-card）は配信・動画とも flex の縦並びにし、CSS の order で並べる（studio.css 末尾の 0.9.9 の節。旧来の stream 用 order より詳細度を上げるため `body[data-app="live"][data-kind]` で書く）。
- プレビューの固定：body[data-pv-pin]（localStorage `otonoha-pv-pin`、'0' でオフ）。ステージの画面（data-studio-mode="live"）のときだけ sticky。top は目次の高さ（--jump-h、86-plan-nav.js の jumpH()）。枠の高さは 26vh、canvas は object-fit:contain のままなので歪まない（t099 で3つの向きの枠の比を確かめる）。
- 18-pon.js：スロット・ルーレット・サイコロは常に。お題帳は中身のある冊ごとに id 'topic:'+冊id（旧 'topic' は隠す一覧に残っても害はない）。
- 番組の行：#liveProgSlot は BGM 欄（#progBgm の直前）へ移した。ラジオでは録音バーへ戻す（86-plan-nav.js progPlace）。
- 13-minibar.js consoleBgm()：選択欄が見えないときは番組の初期BGMだけを使う（以前に選んで保存した曲は使わない）。

## 2026-11-09 追記（STUDIO 0.9.10）

- 作者の指摘：「ポン出し」という呼び名が分からない（「企画」でよい）。目次で飛ぶなら企画のボタンの場所では。→ 0.9.9 の目次の移動は、固定したプレビューの高さを差し引いておらず、企画のボタンがプレビューの裏に隠れていた（t0910_on099 で再現）。
- 86-plan-nav.js の移動：プレビューが sticky で、行き先がプレビューより後ろ（同じ .stage-card の中）のときは、プレビューの高さも差し引く。
- 画面の文言で「ポン出し」は使わない（コード内の名前 pon-* はそのまま）。

## 2026-11-11 追記（STUDIO 0.10.0）

- 作者の依頼：これまでを振り返り、未実装の機能の追加、とっさの操作に特化した見やすいUI、画面崩れなし、撮った動画が保存できること、低スペックでも使えること、コードの整理。
- 画面は「操作盤（デッキ）」に組み直した。決まりは `dev/STRUCTURE.md` の「画面の並べ方」。`css/deck.css` と `js/visual/86-deck.js`。
  - 以前の `[data-mode]` のボタンは、タブ（`#deckNav [data-deck]`）が兼ねる（`data-mode` 属性も残してある）。`.stage-card`・`.studio-workspace`・`#jumpBar` はもうない。
  - 作者は「ポン出し」という呼び名を使わない。画面の文言は「企画」。
- 動画：`61-capture.js` の `cap`（途中保存）と `62-videos.js` の `vpart:`／`vrec:`。MediaRecorder は `start(2000)`。Chromium の `video/mp4` は、かけらをつないだものが再生できることを ffprobe で確かめた。iPhone の Safari では未確認。
- 場面の画像の向きごとの控え：`state.scenes[k].pos[向き]={imgSize,imgX,imgY}`（`sceneClean`・`41-aspect-memory.js`）。
- テスト（手元の `work/test`）：`t0100d.js`（操作盤：4つの幅×配信・動画×全タブ）、`t0100v.js`（動画の保存・取り戻し）。以前のテストは `mk0100.sh` で写して動かす（「全部」のタブと、企画の準備の見出しを開いた状態で始める）。
- まだないもの：ボイス録りの音声を .live に入れること。AITuber（`dev/AITUBER_RESUME.md`、作者の返事待ち）。
- 注意：`t094` などの以前のテストは `process.env.PAGE||'v094.html'` で古いファイルを開いていた。写すときに既定のファイル名も置き換えること。

## 2026-11-12 追記（STUDIO 0.10.1）

- 作者は、顔・感情の絵文字が怖く見える。画面の絵文字は、物（🧸👗🎧 など）を使う。
- 立ち絵の動き：`state.motion`（`setMotion` が保存、起動で戻す）。
- ボイス・BGM のタブ：localStorage `…otonoha_sound_tabs`（名義のIDで持つ）。`setBgmProfiles` の「名義のタブを追いかける」は、前回の呼び出しから名義が変わったときだけ（`soundTabsLastCur`）。
- 演出の向きごとの控え：季節（`state.fxSeason[e]`）と画像のプリセット（`state.fxPresets[]`）のそれぞれに `pos[向き]={count,fxSize}`（`fxPosClean`、`41-aspect-memory.js`）。`tests/checks.cjs` の取り出す関数の一覧に `fxPosClean` を足した。
- 曲リストの曲に `tag`（ラベル、「、」区切り）。シートの読み込みは `g`。Apps Script は版2（`gas/otonoha-sheet.gs` が元。`19-sheet.js` の `SHEET_GAS` は、その中身を JSON の文字列にしたもの。直したら両方そろえる）。
- お題帳：冊に `rand`（くじ引き）と `pick`（しぼりこみ。`t:ラベル`／`w:作品`／空）。形 `song`（歌枠ルーレット）は項目の並び（曲名・アーティスト・作品・ラベル・メモ）を取り込みに使う。`topicNext` のくじ引き、`topicSongSync`、`topicReset`、`topicPickOptions`。くじ引きの冊は、出したら必ず「使った」にする。
- 手元カードは、企画に並べていない冊（`ponCfg().hide` に `topic:冊ID`）では出さない。企画のボタンで引くと、その冊を選んだ冊（`topics.sel`）にする。
- 歌枠管理シートそのもの（Google スプレッドシート）には、ラベルの列を足していない。作者が足すかどうかを決める。

## 2026-11-12 追記（STUDIO 0.10.2：歌枠管理シートの編集）

- 作者の希望：歌枠管理シートを直接さわるのは分かりにくいので、歌枠ノートから編集したい（オトノハに付いてくる編集アプリのイメージ）。パソコン・iOS・Android・外出先でも使えること。まず曲の追加と編集（音源・提供者・ラベルを含む）。原曲キーの音源が基本で、別のキー（男性キー・女性キー）を足せること。ラベルは自分で作る項目をチェックで選び、ふだんは隠す。項目名はあとで直せて、並べ替えられること。列の並びは使いやすいように変えてよい。
- 画面：`js/visual/19s-sheet-edit.js`（ファイル名の順で 19-sheet.js の後に読まれる）。歌枠ノートの曲リストの上に `<details id="sxBox">`。曲リストの行の「📝 シート」は `sxOpenSong(s)`（つないでいるときだけ出る）。歌枠ノートは別タブへ移ることがあるので、要素は起動時に取った参照（SX.box・SX.body）を使い、あとから getElementById で探さない。
- Apps Script は版3（`dev/otonoha-sheet.gs`、`@OnlyCurrentDoc`）。`19-sheet.js` の `SHEET_GAS` はその中身の JSON 文字列（直したら両方）。操作：ping／read／sheet（手で入れる列をすべて）／history（読むだけ、GET）、log／save／labels／setup／backup（書き込み、POST）。
  - 書き込むのは1行目に数式がない列だけ。列は見出しで探す（同じ文字→始まりの文字）。曲・提供者は読みの順の位置に1行差し込み、音源はいちばん下。差し込んだ行には下の行の書式とプルダウンを写す。
  - save は before（画面で見た値）とシートの値を比べ、違えば conflict で書かない。行がずれていたら曲名／アーティスト・名前で探し直す。
  - 曲名・アーティスト・音源名・提供者名を直したら、「音源」「配信ログ」の選ぶ列を付け替える。
  - 「編集の記録」タブ（日時・タブ・行の名前・項目・前・後・操作・項目の記号・メモ）に1項目1行で残す。画面の「↩ 前の値に戻す」は、そのあと変わっていないときだけ。
  - 控え（backup）は「曲」「音源」「提供者」「ラベル一覧」をシートの中に写して隠す（ほかのファイルは作らない）。
  - ラベル：「ラベル一覧」タブ（ラベル・分類・記号・メモ。行の順が並び）と「曲」タブの「ラベル」列（右端の空いた列に足す。値は「、」区切り）。名前の変更・削除は曲のラベル列も直す。
  - 先頭が「=」の値は「'」を付けて書く（数式にしないため）。本物の Google で確かめていない。
- 曲リストの音源に `kk`（キーの区分）と `ly`（動画内の歌詞）。sanitize・srcAdd・シートの読み込み（Apps Script と貼り付け）で通す。▶ のボタンは原曲キー以外のとき「（男性）」などを付ける。
- 行を消す働きは作っていない（作者が求めていない。消すのはシートで）。
- テスト：`tests/sheet/`（README.md）。t_gas.cjs 23件、t_ui.cjs（390px と 1280px）。本物の Google（Apps Script のデプロイ・CORS・iPhone の Safari）は未確認。
- 2026-11-12 時点で、作者の Google ドライブの「MEL-TUNE」フォルダに「【試験用】歌枠管理シート」（ID 1YnCKq1WXp_0Dz6Kt2_qj4D0sCfFSX2WQTiBuV9eK3CE）がある。本物は「歌枠管理シート」（ID 12Yy__n0ObIdhvtC3YY9CwpoWkciJlwTXrV3YbFP87bo）。Claude はどちらにも版3のコードを入れていない（Claude の道具では Apps Script を入れられない。シートにすでにスクリプトがあるかも確かめていない）。
- 同じ 0.10.2 で直したこと：立ち絵の動きの下の「見た目をその場で調整」（83-tuning-drag.js の QT）に、右往左往の歩く幅・いやいやの大きさがなかった（0.10.1 からの抜け。設定画面の「動きの大きさ・速さ」にはあった）。QT に足した。
- 作者への説明の誤り（2026-11-12）：「📝 歌枠管理シートの曲を足す・直す」の位置を「③ 曲リストのすぐ上」と伝えたが、実際は「③ 曲リスト」の見出しのすぐ下、「＋ 曲を登録する」の上。

## 2026-11-12 追記（STUDIO 0.10.3：表情ごとの動きの大きさ・速さ、立ち絵の動きの見直し）

- 作者の指摘：表情ごとに動きの大きさを持てないと意味がない。立ち絵の動きが不自然で、値を調整しにくい。
- 見つけた不具合：`20-characters.js` のキャラクターの整え直しで、表情の「連動する動き」が none・shake・hop・sing しか通らず、右往左往（wander）・いやいや（iya）を選んでも読み直すと「動かさない」に戻っていた。直した。
- 表情（c.exprs[]）に amt（大きさ 0〜200、既定 100）・spd（速さ 40〜200、既定 100）。表情に連動した動きは、キャラの設定の値ではなく、この値を使う（`30-drawing.js` の motionParam）。表情の欄に「この表情を試す」（setExpr で切り替え）と「キャラの設定の値を写す」。
- キャラの設定に、ぴょんぴょん・ガタガタ・右往左往・いやいやの速さ（motionHopSpeed・motionShakeSpeed・motionWanderSpeed・motionIyaSpeed、40〜200）。CHAR_KEYS・CHAR_RANGES・sanitize・03-values・その場で調整（QT）に入れた。
- 動きの物差し：これまでは画面の高さ（u＝H/720）の固定のpxで、立ち絵の大きさを変えると見え方が変わっていた。いまは見えている立ち絵の高さ S＝min(立ち絵の高さ, 画面の高さ×1.15)、q＝S/600。右往左往の歩く幅だけは画面の横幅（W×0.13、12-apps.js の切り抜きと同じ）。
- 右往左往：ゆっくりした正弦波の重ね合わせ（すべって漂って見えた）をやめ、行き先を決めて歩く形に。臨界減衰のばね（ω=4.4、速さの上限あり）で向かい、0.75〜1.6秒ごとに逆へ向きを変える。22％でその場で小さくおろおろ。速さに応じて一歩ごとの上下（S×0.014）と、進む向きへの傾き（最大約3°）。止めたときは、まん中まで歩いて戻る。
- いやいや：横ずれ中心の小さな揺れ（約0.7°・5px）だったのを、足もとを軸に上半身を振る形に（約2.4°、端で少しためる）。約2.1回/秒、速さと大きさをゆっくり揺らがせる。
- ぴょんぴょん：止めても宙に浮いたまま消えず、いまの一跳びを着地まで続けてから止める。始めるときは、しゃがむところから。
- 動きの大きさ・速さも、表情の切り替えで急に変わらないよう、0.25秒でなめらかに寄せる（mk・ms）。
- テスト：`tests/motion/`（README.md）。本物の立ち絵の画像では見ていない（試験の画面は、画像なしのときの仮の姿）。

## 2026-11-12 追記（STUDIO 0.10.4：曲リストからシートへ書き込む）

- 作者の指摘：③ 曲リストで曲・音源・ラベルを足しても、歌枠管理シートに入らない。二度手間。0.10.2 は「シートの編集」と「曲リスト」が別々で、曲リストで直したものはこの端末の中にしか残らなかった（設計の抜け）。
- `19s-sheet-edit.js` の後半：
  - その場で（sxAutoPush）：曲リストの「編集」の保存、「曲リストに登録」「登録してセトリにも入れる」のあと、シートを読み直してから、直したところだけを書く。ラベルは、直す前と後を比べて足した・外したものだけをシートのいまの値に当てる（シートで付けたラベルを消さない）。作品名・曲名・音源のURL・提供者・音源名も、変えたものだけ。食い違い（conflict）なら読み直して一度だけやり直す。端末ごとに切れる（localStorage `otonoha-sheet-autopush`、既定は入）。
  - まとめて（「🔄 曲リストとそろえる」タブ。編集の欄の最初のタブ）：曲リスト全体とシートを比べ、シートにない曲・音源、シートにないラベル（両方を合わせる）、シートで空の作品名を書く。作品名が両方にあって違うものは、チェックを外した状態で出す。
  - ラベル一覧にないラベルは「未分類」で足す。提供者タブにない提供者は、名前だけ（可否は未確認）で足す。
  - 曲リストの音源に名前がなければ「曲名 / 提供者（キー）」で付け、キーの区分は原曲キーにする。
  - シートの値で曲リストを上書きするのは、シートに書いた項目だけ（sxSyncSong の wrote）。
- 曲リストのメモは、シートには送らない（シートのメモを上書きしないため）。音源を外しても、シートの行は消さない（行を消す働きはない）。
- Apps Script：「編集の記録」の時刻を、いつも日本時間に（【試験用】シートのタイムゾーンが America/Los_Angeles だったため）。版の番号は3のまま。この直しは、作者がコードを貼り直すまでシートには入らない。

## 2026-11-13 追記（STUDIO 0.10.5：本番のセトリ、企画タブの並び、場面の設定画面、向きごとの大きさ）

- 作者の報告（4件）と直したこと：
  1. 設定の「準備中・離席中・配信終了の画面」：`.scene-pv` が `position:sticky` で、プレビュー（最大520px幅）と切り替えボタンが画面の半分ほどを覆ったまま貼り付き、下の設定が操作できなかった（375px・1280px で再現）。index.html で `.scene-layout`（`.scene-pv`＋`.scene-body`）に包み、861px 以上は2列（左がプレビュー、sticky でも重ならない。設定画面の `.ss-grid` と同じ考え方）。860px 以下は流れるまま。`#scenePin`「📌 確認用の画面を上に残す」で `.pinned`（sticky、canvas 最大18vh）。localStorage `otonoha-scene-pv-pin`（50-scenes.js の末尾）。
  2. マスコット・ミニキャラの大きさ：作者に確かめたところ「映像の向きを切り替えたとき」。大きさは H に対する％（`81-mascots.js` drawMascots、場面の画像は drawSceneImage）。横720→縦・3:4 1280 で同じ％のまま約1.78倍。初めての向きは横の値がそのまま写り、自分で直していないマスコットは写しのまま残るので、何体もあると毎回大きく出ていた。
     - `41-aspect-memory.js`：`aspectRestore(asp, prev)`（呼び出しは 40-motion-prompt.js の1か所。prev を渡す）。控えの `t`（1＝その向きで大きさを直した、0＝直していない、なし＝0.10.4 まで）。直していないものは `aspSizeConv`（H の比で換算、小数4桁まで。丸めると往復でずれるため）。t なしの控えは「前の向きと大きさが同じなら写し」とみなす。
     - つまみで大きさを直した時点で、いまの向きの控えに t:1 を書く（`aspMarkSize`。81-mascots.js の mscSize、50-scenes.js の scene_*_imgSize）。切り替える前に読み込み直しても印が消えないように。
     - sanitize：`aspectPosClean`（msc）と `sceneClean` の pos が t（0/1）を通す。表示は `Math.round`（mscSizeVal）。
  3. 本番にセトリ：`#deckSet`（企画パネルの先頭の details）。`11-songbook.js` の `renderDeckSet()`（renderSet と renderSess から呼ぶ。シグネチャが同じなら作り直さない）。セトリが空で記録もしていなければ hidden。開閉は localStorage `otonoha-deck-setlist-open`。並べ替え・追加・外すは歌枠ノートだけ。
  4. 企画タブの並び：`#ponGrid` は `.pon-groups`（中に `.pon-group`＞`.pon-gh`＋`.pon-grid`）。`18-pon.js` の `PON_GROUPS`（serif／slot・wheel・dice／topic／app）。ボタンの文字は `.pon-lb`（2行で切る）、title に全文。`#ponNow`・`.pon-sub` を見出しの直後へ、`.pon-opts` を `#topicHand` の後ろ（パネルの最後）へ移した（id はそのまま）。
- 0.10.2〜0.10.4 の節が README.md になかったので、短く足した。`dev/STRUCTURE.md` の「state（IndexedDB）」は誤りだったので直した（localStorage の1キー）。
- テスト：添付のテスト一式に `t0105.js` を足した（作者に渡す zip。リポジトリには入れない）。iPhone の実機・OBS では見ていない。
- 作者の方針（2026-11-13）：Live2D は保留（自分で使うだけなら良さそう、とのこと）。AITuber（彼岸リオ）は「企画と一緒に切り替える」「リオと2人で並ぶ」の両方を、必要なときに足せる形で。設計はこれから。
