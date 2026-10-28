# 積木小鎮 Brick Town

用積木人偶拍連續劇的 3D 框架，像積木大電影那樣：**寫好劇本，其餘交給程式**。劇本格式、導演、配音和紙偶小劇場（[paperpuppets](https://github.com/ywchen0711/paperpuppets)）共用；這裡換成 3D 的積木世界：人偶照真實比例做（腿在髖關節擺動、手臂在肩膀轉、C 形手在手腕轉、頭會轉），臉是印上去的，表情和嘴型隨台詞換；場景用一塊塊有凸點的積木蓋成；光影、柔和陰影和微距鏡頭的淺景深。

A 3D framework for filming a series with brick minifigures: write the script, and the director lays out the blocking, faces, camera and voices. The script format, the director and the voices are shared with Paper Puppets; here they are filmed in a world of bricks: minifigures built to the real proportions (legs at the hip, arms at the shoulder, C-shaped hands at the wrist, a turning head) with printed faces that change with the feeling and the words, places built brick by brick with their studs, soft shadows and the shallow focus of a macro lens.

**線上看：** https://ywchen0711.github.io/bricktown/ — 《隔壁的阿樂》積木版第一集。`figs.html` 看所有人偶。`?fps=12` 讓動作像定格動畫一樣一秒十二格。

## 做一集新的

同紙偶小劇場：在 `series/<系列>/episodes/` 寫劇本，`node tools/lines.mjs <系列> <集>`、`python tools/voices.py tools/lines.json` 錄配音，打開 `?s=<系列>&ep=<集>`。劇本格式見 `js/script.js` 的說明。

| 檔案 | |
|---|---|
| `js/minifig.js` | 積木人偶：腿、髖、身體與印花、手臂、手、頭與印上去的臉、頭髮 |
| `js/bricks.js` | 蓋積木：磚、薄板、平板、圓磚、斜磚、牆、底板，依形狀合批繪製 |
| `js/sets.js` | 場景（公園）：樹、長椅、花、路燈、房子；白天、黃昏、夜晚的光 |
| `js/motion.js` | 人偶的動作：搖擺走路、轉身、跳、坐、手勢、情緒、說話 |
| `js/player.js` | 鏡頭（開場、遠景、雙人、過肩單人、特寫）、淺景深、道具、字幕、聲音 |
| `js/script.js`、`js/direct.js`、`js/audio.js`、`tools/` | 與紙偶小劇場共用 |

積木人偶的造型是向經典積木玩具致敬的原創作品，與 LEGO 公司無關。
