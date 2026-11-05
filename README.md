# math

大学1年の数学の学習用ページ置き場です。

## 解析学II（`analysis/`）

多変数の微分積分。各ページは HTML ファイル1つで完結しています（外部ライブラリなし・オフラインで動作）。ブラウザで直接開いてください。目次は [analysis/index.html](analysis/index.html)。

各回は「何の話か（直感）→ 定義・定理 → 具体例 → 動かしてみよう → よくある間違い → 練習問題（解答つき）」の構成です。

| 回 | ページ | 内容 |
|---|---|---|
| 1 | [01-multivariable.html](analysis/01-multivariable.html) | 多変数関数：グラフと等高線、2変数の極限・連続 |
| 2 | [02-partial-derivative.html](analysis/02-partial-derivative.html) | 偏微分：偏導関数、全微分可能性、接平面 |
| 3 | [03-chain-rule.html](analysis/03-chain-rule.html) | 合成関数の偏微分：連鎖律、極座標 |
| 4 | [04-exercise1.html](analysis/04-exercise1.html) | 演習I：偏微分の基本計算（答え合わせ計算機つき） |
| 5 | [05-taylor.html](analysis/05-taylor.html) | Taylor展開、1次・2次近似 |
| 6 | [06-gradient.html](analysis/06-gradient.html) | 方向微分と勾配 |
| 7 | [07-extremum.html](analysis/07-extremum.html) | 極値問題：停留点とヘッシアンによる判定 |
| 8 | [08-implicit-lagrange.html](analysis/08-implicit-lagrange.html) | 陰関数定理、条件付き極値（ラグランジュの未定乗数法） |
| 9 | [09-midterm-review.html](analysis/09-midterm-review.html) | 中間まとめ：公式集・確認クイズ・総合問題 |
| 10 | [10-double-integral.html](analysis/10-double-integral.html) | 2重積分：リーマン和、体積・面積 |
| 11 | [11-iterated-integral.html](analysis/11-iterated-integral.html) | 累次積分、積分順序の変更 |
| 12 | [12-change-of-variables.html](analysis/12-change-of-variables.html) | 変数変換：ヤコビアン、極座標 |
| 13 | [13-exercise2.html](analysis/13-exercise2.html) | 演習II：条件付き極値・2重積分（積分計算機つき） |
| 14 | [14-improper-integral.html](analysis/14-improper-integral.html) | 広義積分、ガウス積分 |
| 15 | [15-final-review.html](analysis/15-final-review.html) | まとめ：積分の公式集・確認クイズ・総合問題 |

### ページの編集

`analysis/*.html` は `analysis/_src/` から生成しています。本文は `analysis/_src/pages/*.html`（数式は `$...$` / `$$...$$` に TeX 風に書く）、共通部分は `common.css` と `lib/`（TeX 風数式の変換・数式の記号微分・グラフ描画）です。編集したら次を実行してください。

```bash
node analysis/_src/build.js
```
