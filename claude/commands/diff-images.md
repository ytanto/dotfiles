# 変更前/変更後の画像テーブル生成

以下の入力から変更前/変更後のMarkdownテーブルを生成してください。

## 入力:
$ARGUMENTS

## 指示:
1. 入力から2つの `<img>` タグを抽出してください（1つ目がbefore、2つ目がafter）
2. 各タグから `alt` と `src` を抽出してください
3. 以下の形式でMarkdownテーブルを生成し、heredocとpbcopyでクリップボードにコピーしてください:

```bash
pbcopy << 'EOF'
| 変更前 | 変更後 |
| --- | --- |
| ![{before_alt}]({before_src}) | ![{after_alt}]({after_src})|
EOF
```

4. 「クリップボードにコピーしました」と報告してください
