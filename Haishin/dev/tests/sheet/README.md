# 歌枠管理シートの編集の試験（0.10.2）

- `t_gas.cjs`：Apps Script 版3（`../../otonoha-sheet.gs`）を、`mockgas.cjs`（SpreadsheetApp のまね）と `fx_part.json`（【試験用】歌枠管理シートの値の写し、2026-11-12。曲の一覧や規約の原文を含むので、リポジトリには入れていない）で動かす。`node t_gas.cjs`
- `t_ui.cjs`：組み立てた `index.html` を Chrome（headless）で開き、`fetch` を横取りして版3のまねにつなぎ、歌枠ノートの「📝 歌枠管理シートの曲を足す・直す」を操作する。
  1. `node mkbundle.cjs`（`bundle.js` を作る）
  2. `../../index.html` を `page.html` として写し、そのフォルダで `python3 -m http.server 8765`
  3. `W=390 H=844 node t_ui.cjs`（スマホの幅）／`W=1280 H=900 TAG=d node t_ui.cjs`（パソコンの幅）。前回の Chrome のデータ（/tmp/chx*）を消してから動かす。
- どちらも、本物の Google の上での動きを確かめたものではありません。

## 版4（0.10.8）

- `t_gas4.cjs`：配信ログへ送るところ（配信先・収益化・枠タイトル、オープニング・エンディングの行、送り直し）。小さな作りもののシートで動くので、`fx_part.json` は要りません。`node t_gas4.cjs`
