---
allowed-tools: Bash(gh:*), Bash(git:*)
description: "PRレビュー対応：コード修正→ユーザー承認→push→返信・resolve・@claude通知までを実施"
---

使用例:
- `/review-feedback` → 現在のブランチに紐付くPRに対して実施
- `/review-feedback 293` → PR #293 に対して実施

未resolveのレビュースレッドを取得し、コード修正 → **ユーザーにcommit/push確認** → push → 返信 → resolve → @claude通知 の順で実行してください。

**重要**: 返信文言が「〜修正しました」とリモートに反映されていない状態を作らないため、必ず push 後に返信すること。

## 手順

### 1. PR番号の特定

- 引数（`${ARGUMENT}`）があればそれを使用
- なければ `gh pr view --json number,headRepository,headRepositoryOwner` で現在のブランチに紐付く PR を取得

### 2. リポジトリ情報の取得

- `gh repo view --json owner,name` で `{owner, name}` を取得（ハードコードしない）

### 3. 未resolveのレビュースレッドを全件取得

GraphQL で取得:

```graphql
query {
  repository(owner: "...", name: "...") {
    pullRequest(number: ...) {
      reviewThreads(first: 50) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              databaseId
              path
              line
              originalLine
              body
              author { login }
            }
          }
        }
      }
    }
  }
}
```

- `isResolved=false` のものだけ抽出
- 各 thread の `id`（threadId）、先頭コメントの `databaseId`（commentId）、`path` / `line` / `body` を控える

### 4. 対応方針の判断とコード修正

各 thread の指摘内容を読み、以下のいずれかに分類する。判断は基本的に自動で進めて良い:

- **コード修正で対応** → 該当ファイル/行を確認し、修正を実施
- **仕様通り・意図的設計** → 根拠（仕様書セクション、設計意図）を控える
- **対応しないが認識した指摘** → 現状維持の理由（優先度、別タスク化等）を控える
- **PR description 訂正で対応** → `gh pr edit {prNumber} --body '...'` で本文を更新

判断に迷う場合・大きな設計変更を伴う場合のみユーザーに確認すること。軽微なリファクタや明確な指摘は確認なしで修正して良い。

修正後は型チェック・テストで影響を確認すること（プロジェクトのコマンドに従う。例: `pnpm run check:all`）。

### 5. 対応内容のサマリーをユーザーに提示し、commit/push承認を得る

- 各threadへの対応方針（修正内容 / 仕様通り / 現状維持の理由 等）と、修正したファイルの diff サマリーを提示する
- ユーザーに **「この内容でコミット・pushしてよいか」** を必ず確認する
- 承認が得られるまでは以降の手順（push・返信・resolve・通知）を実行しない
- コード修正がない（全て仕様通り/現状維持）場合でも、返信内容の確認は取ること

### 6. 承認後、commit / push を実施

承認が得られたら以下を実行:

- リポジトリのコミットメッセージ規約に準拠してコミット（git log で直近のメッセージを確認）
- `git push`（mise / volta 等のランタイム管理ツールで pre-push hook を通すこと）
- push 失敗時は原因を報告し、返信フェーズに進まない

### 7. 返信文言の決定

返信の書き分け基準:
- **コード修正で対応した指摘** → 「〜するよう修正しました」など、何をどう変えたか具体的に
- **仕様通り・意図的設計** → 「仕様通りの設計です（仕様書 §X）」など根拠を示す
- **対応しないが認識した指摘** → 「現状維持します。〜の場合に対応します」など理由を添える
- **PR description 訂正で対応した指摘** → 「PR description を訂正しました」を併記

### 8. 各スレッドへ返信

push 完了後に実行する。各 thread について並列で:

```bash
gh api repos/{owner}/{name}/pulls/{prNumber}/comments/{commentId}/replies \
  -f body='返信文言' --silent
```

シングルクォートが本文に含まれる場合は `'"'"'` でエスケープすること。

### 9. 各スレッドを resolve

```bash
gh api graphql -f query='mutation($tid: ID!) {
  resolveReviewThread(input: { threadId: $tid }) {
    thread { id isResolved }
  }
}' -f tid="${threadId}"
```

すべての thread に対して実行する。

### 10. PR本体に最終コメント

```bash
gh pr comment {prNumber} --body '@claude レビュー対応しました'
```

このコメントは **インラインスレッドではなく PR 本体（issue comment）** として投稿すること。

### 11. 結果報告

- 修正したファイル・行の概要
- コミットハッシュ / push 結果
- 返信件数 / resolve 件数
- 最終コメントの URL
- もし返信できなかった thread / ユーザー判断を仰ぎたい thread があればその理由

## 注意

- **push 前に返信しないこと**。「修正しました」という返信文言とリモートの実際のコードが一致しない期間を作らないため
- 副作用のある操作（GitHub への書き込み）は thread の対応方針が決まってから実行すること
- 大きな設計変更を伴う修正の場合は実行前にユーザーに確認すること
- 既に resolve 済みの thread にはアクションしない
