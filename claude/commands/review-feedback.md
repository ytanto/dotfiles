---
allowed-tools: Bash(gh:*), Bash(git:*)
description: "PRレビュー対応：対応計画ユーザー承認→コード修正→commit/push承認→push→返信・resolveまでを実施（Claudeレビュー対応時のみ@claude通知）"
---

使用例:
- `/review-feedback` → 現在のブランチに紐付くPRに対して実施
- `/review-feedback 293` → PR #293 に対して実施

未resolveのレビュースレッドを取得し、**対応計画をユーザーに提示・承認** → コード修正 → **ユーザーにcommit/push確認** → push → 返信 → resolve の順で実行してください。Claude (bot) によるレビューに対応した場合のみ、最後に `@claude` 宛コメントで通知してください。

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
- 各 thread の `id`（threadId）、先頭コメントの `databaseId`（commentId）、`path` / `line` / `body` / `author.login` を控える
- `author.login` に `claude` を含む bot アカウント（例: `claude[bot]`）が含まれているかをチェックし、後段の `@claude` 通知判定に用いる

### 4. 対応方針の検討と計画提示・ユーザー承認

各 thread の指摘内容を読み、以下のいずれかの方針に分類する:

- **コード修正で対応** → 修正対象ファイル/行と、想定する修正内容の概要
- **仕様通り・意図的設計** → 根拠（仕様書セクション、設計意図）
- **対応しないが認識した指摘** → 現状維持の理由（優先度、別タスク化等）
- **PR description 訂正で対応** → 訂正したい本文の概要

この時点ではまだコード修正・PR 編集は行わない。スレッド単位で上記方針をまとめた **対応計画** をユーザーに提示し、承認を得ること。承認が得られるまでは次ステップ（コード修正）に進まないこと。

### 5. 承認後、コード修正を実施

承認された計画に従って:

- コード修正対象 → 該当ファイル/行を修正
- PR description 訂正対象 → `gh pr edit {prNumber} --body '...'` で本文を更新
- 仕様通り / 現状維持の thread はこの時点では何もしない（返信文言は後段で作成）

修正後は型チェック・テストで影響を確認すること（プロジェクトのコマンドに従う。例: `pnpm run check:all`）。

計画外の修正が必要になった場合はその場でユーザーに確認すること。

### 6. 対応内容のサマリーをユーザーに提示し、commit/push承認を得る

- 修正したファイルの diff サマリーと、計画通りに進んだか／差分があったかを提示する
- ユーザーに **「この内容でコミット・pushしてよいか」** を必ず確認する
- 承認が得られるまでは以降の手順（push・返信・resolve・通知）を実行しない
- コード修正がない（全て仕様通り/現状維持）場合は本ステップはスキップして次の返信フェーズへ進む

### 7. 承認後、commit / push を実施

承認が得られたら以下を実行:

- リポジトリのコミットメッセージ規約に準拠してコミット（git log で直近のメッセージを確認）
- `git push`（mise / volta 等のランタイム管理ツールで pre-push hook を通すこと）
- push 失敗時は原因を報告し、返信フェーズに進まない

### 8. 返信文言の決定

返信の書き分け基準:
- **コード修正で対応した指摘** → 「〜するよう修正しました」など、何をどう変えたか具体的に
- **仕様通り・意図的設計** → 「仕様通りの設計です（仕様書 §X）」など根拠を示す
- **対応しないが認識した指摘** → 「現状維持します。〜の場合に対応します」など理由を添える
- **PR description 訂正で対応した指摘** → 「PR description を訂正しました」を併記

### 9. 各スレッドへ返信

push 完了後に実行する。各 thread について並列で:

```bash
gh api repos/{owner}/{name}/pulls/{prNumber}/comments/{commentId}/replies \
  -f body='返信文言' --silent
```

シングルクォートが本文に含まれる場合は `'"'"'` でエスケープすること。

### 10. 各スレッドを resolve

```bash
gh api graphql -f query='mutation($tid: ID!) {
  resolveReviewThread(input: { threadId: $tid }) {
    thread { id isResolved }
  }
}' -f tid="${threadId}"
```

すべての thread に対して実行する。

### 11. PR本体に最終コメント（Claudeレビュー対応時のみ）

step 3 で控えた `author.login` に Claude bot（例: `claude[bot]`）が含まれていた場合のみ実行する。人間のレビュアーのみへの対応の場合はこのステップをスキップする。

```bash
gh pr comment {prNumber} --body '@claude レビュー対応しました'
```

このコメントは **インラインスレッドではなく PR 本体（issue comment）** として投稿すること。

### 12. 結果報告

- 修正したファイル・行の概要
- コミットハッシュ / push 結果
- 返信件数 / resolve 件数
- 最終コメント（Claudeレビュー対応時のみ）の URL、スキップした場合はその旨
- もし返信できなかった thread / ユーザー判断を仰ぎたい thread があればその理由

## 注意

- **push 前に返信しないこと**。「修正しました」という返信文言とリモートの実際のコードが一致しない期間を作らないため
- **コード修正前に対応計画の承認を得ること**。スレッド取得後、各threadへの対応方針をまとめてユーザーに提示・承認を得てから修正に着手する
- 副作用のある操作（GitHub への書き込み）は thread の対応方針が決まってから実行すること
- 大きな設計変更を伴う修正の場合は計画提示時に明示し、ユーザー判断を仰ぐこと
- 既に resolve 済みの thread にはアクションしない
- 最終の `@claude` 通知コメントは Claude bot のレビューに対応した場合のみ投稿する。人間レビュアーのみの場合は投稿しない
