# 配信処オトノハ：プログラムの地図

編集するのは `source/` の中だけです。`python3 build.py` で、`source/index.html` を元に、CSS と JS を埋め込んだ1枚の `index.html` を作ります。点検は `node --expose-internals tests/checks.cjs` です。

## 守ること（変えないでください）

- 画像（立ち絵・マスコット・背景・場面の画像・降らせる画像）は、移動・回転・縦横同じ倍率の拡大縮小だけです。左右反転と、縦横の倍率が違う変形は使いません。`tests/checks.cjs` が `.scale(x,y)` の違う倍率・負の倍率を見張っています（図形を描く `p.scale` だけ例外）。drawImage で縮めるときも、幅と高さは同じ倍率で計算してください。
- 映像の向きは `landscape`（1280×720）／`portrait`（720×1280）／`x34`（960×1280）。寸法を決め打ちせず、`W`・`H` から計算してください。
- 保存キーの名前（`kissa` を含むもの）は変えません。

## 読み込む順番

`source/index.html` の `<script src="js/audio/">` と `<script src="js/visual/" data-wrap="iife">` は、フォルダの中の `.js` をファイル名の順につなげます。

- 音声側（`js/audio/`）は、ページ全体で共有する普通のスクリプトです。
- 映像側（`js/visual/`）は、一つの関数（IIFE）の中につながります。ファイルが分かれていても、同じ変数を使えます。
  - `function` で書いたものは、どのファイルからでも使えます。
  - `const`・`let` は、そのファイルが読まれる前に使うとエラーになります。設定の読み込み（`01-sanitize.js` の `sanitize`）のように早く動く処理から使うものは、関数の中に置いてください（例：`41-aspect-memory.js` の `aspectPosClean`）。

## 音声側 `js/audio/`

| ファイル | 中身 |
| --- | --- |
| 00-basics.js | 効果音・BGM の設定（cfg）、初期値、点検、保存（persist）、toast など共通の道具 |
| 01-engine.js | 音を鳴らす（playSound）、音量、BGM |
| 02-mic.js | マイク・メーター・ダッキング |
| 03-programs.js | 番組プリセット |
| 04-monitor.js | モニター音 |
| 05-recording.js | 録音 |
| 06-takes.js | テイク一覧・書き出し |
| 07-container.js | 動画の入れ物（WebM / MP4） |
| 08-video-export.js | サムネイルと動画の書き出し |
| 09-board.js | 音のお品書き（効果音・ボイス・環境音・BGM のボタン） |
| 10-files.js | すべての書き出し・読み込み（.live）の全体 |
| 11-look.js | 名前と着せ替え |
| 12-pages.js | 画面の切り替え |
| 13-minibar.js | スクロール中の小さな録音欄・BGM 欄 |

## 映像側 `js/visual/`

| ファイル | 中身 |
| --- | --- |
| 00-state.js | 設定の初期値（defaults）・読み込み・保存（save／saveNow） |
| 01-sanitize.js | 設定の点検（sanitize） |
| 02-assets.js | 画像の登録（installAsset／removeAsset） |
| 03-values.js | 設定画面と値の結び付け（renderValues）、企画メモ |
| 10-karaoke.js | カラオケ音源の検索 |
| 11-songbook.js | 歌枠ノート：曲リスト（音源 URL）・セトリ・歌唱の記録・概要欄 |
| 12-apps.js | 企画卓のアプリ、アプリと立ち絵のウインドウ、キャラクターだけの表示 |
| 13-plays.js | セリフ帳・ルーレット・サイコロ |
| 14-bridge.js | オトノハ連携（Otonoha Bridge 1） |
| 15-audience.js | AI 観客席 |
| 16-voicerec.js | ボイス録り |
| 17-slot.js | スロット（役柄×セリフ） |
| 18-pon.js | 企画のポン出し |
| 19-sheet.js | 歌枠管理シートとつなぐ（Apps Script のコードは `dev/otonoha-sheet.gs` と同じ内容） |
| 24-topics.js | お題帳（AIに作ってもらったお題の台帳・貼り出し・手元カード） |
| 20-characters.js | 名義とキャラクターのデータ、切り替え |
| 21-character-ui.js | キャラクター・名義の編集画面 |
| 22-stage-controls.js | 表示モード・マイク・全画面・配信用ウインドウ |
| 29-autumn-art.js | 秋・冬の演出の絵 |
| 30-drawing.js | 立ち絵の位置と動き（avatarGeom／avatarPose／drawAvatar）、降らせる演出、背景 |
| 40-motion-prompt.js | 映像の向きの切り替え、動きのボタン、画像生成 AI 用のプロンプト |
| 41-aspect-memory.js | 向きごとの、立ち絵とマスコットの位置・大きさ・傾き |
| 50-scenes.js | 準備中・離席中・配信終了の画面、ミュート、音の出力先 |
| 60-frame.js | 毎フレームの描画の順番 |
| 61-capture.js | 動画の収録 |
| 62-videos.js | 収録した動画の一覧と保存 |
| 63-studio-files.js | .live の映像側（立ち絵・背景・アプリの HTML など）の受け渡し |
| 70-effects-perf.js | 季節の演出・画像のプリセット、なめらかさ・軽量モード、プレビュー |
| 80-expressions.js | 表情差分 |
| 81-mascots.js | マスコット |
| 82-scene-images.js | 場面の画像 |
| 83-tuning-drag.js | その場で調整、プレビュー上のドラッグ |
| 84-app-mode.js | 配信・録画／ラジオの切り替え |
| 85-backgrounds.js | 背景画像（名義×向き） |
| 90-startup.js | 起動処理 |

## 毎フレームの描画の順番（60-frame.js）

背景 → 演出（奥） → マスコット → 立ち絵（アプリ表示が開いているときは、同じ動きで透過のレイヤーにも描く） → 場面の画像 → 演出（手前） → 字幕・セリフ・セトリ（配信中）／場面の文字 → AI 観客席のコメント → 配信用ウインドウへ写す → プレビュー → アプリ表示へ写す

## 保存のしかた

- 映像側の設定は `state`（IndexedDB）。`save()` はまとめて書き、`saveNow()` はすぐ書きます。
- 名義（`profiles[]`）ごと：キャラクター、場面、背景の種類、場面の文字の書体、背景画像（`bgs[向き]`・`bgSel[向き]`）、マスコットの持ち主。
- キャラクター（`chars[id]`）ごと：画像、口パク・動き、位置と大きさ（いまの向きの値と、向きごとの控え `pos[向き]`）。
- マスコット（`mascots[]`）ごと：画像、動き、位置・大きさ・傾き（いまの向きの値と、向きごとの控え `pos[向き]`）。
- 画像・アプリの HTML・動画は IndexedDB の assets に別に置きます（`visual-studio:…`、`app:…`、`video:…`）。
