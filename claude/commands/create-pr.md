---
allowed-tools: Bash(gh:*), Read(.github/*)
description: "Push a Pull Request Draft (Branch Optional)"
---

使用例：
- `/create-pr` → developブランチへのPR作成（デフォルト）
- `/create-pr main` → mainブランチへのPR作成
- `/create-pr master` → masterブランチへのPR作成

以下の手順でPull Requestを作成してください：

1. **ベースブランチの設定**
   - 引数（`${ARGUMENT}`）があればそれを使用、なければ`develop`をデフォルトとする
   - ブランチが存在するか確認

2. **Issue番号の抽出**
   - 現在のブランチ名から`#`を含むIssue番号を抽出
   - 例: `feature/#123-add-login` → `123`
   - 注意: ブランチ名に`#`が含まれる場合、gitコマンドではシングルクォートで囲む必要がある
     - 例: `git diff develop..'feature/#123-add-login'`

3. **Issue情報の取得**
   - Issue番号が見つかった場合、`gh issue view`でタイトルを取得

4. **PRタイトルの作成**
   - Issue連携あり: `{Issueタイトル}（#{Issue番号}）` 形式を厳守
   - Issue連携なし: 直前のコミットメッセージを使用

5. **PRテンプレートの読み込み**
   - `.github/PULL_REQUEST_TEMPLATE.md`の内容を取得

6. **PR本文の作成**
   - テンプレートに従ってPR本文を作成
   - Issue番号がある場合は関連Issueとして記載
   - 変更内容にコードベースの細かな記載は不要
      - APIを追加・変更した場合：対象APIと変更点を明記
      - 機能を追加・変更した場合：追加・変更した機能仕様を明記

7. **PR作成と確認**
   - `gh pr create --assignee @me --base {ベースブランチ}` で作成
   - 作成後、`gh pr view --web`でブラウザで開く

**補足**

- リモートリポジトリにプッシュ済みの前提で進めて良い