# 立ち絵の動きの試験（0.10.3）

- `sim.cjs`：`30-drawing.js` の `avatarPose` を取り出し、歌うゆらぎ・ぴょんぴょん・ガタガタ・右往左往・いやいやを 10 秒ぶん計算する（7 秒で止める）。`node sim.cjs ../../source/js/visual/30-drawing.js out.json`
- `plot.py`：その結果を、横ずれ（dx）・上下（dy）・傾き（度×10）のグラフにする。`python3 plot.py out.json out.png`
- `t_expr.cjs`：組み立てた画面で、表情ごとの動きの大きさ・速さ、「この表情を試す」、その場で調整の速さ、読み直したあとも残るかを確かめる（`../sheet/README.md` と同じく、`page.html` を `python3 -m http.server 8765` で出してから）。
