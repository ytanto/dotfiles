# baas-platform

Rails のサービス群（idp / connect / messenger / accounts など）を `ruby/services/<service>/` に持つモノレポ。Docker はサービスごとに `containers/services/<service>/`。**正本は `.claude/rules/git-workflow.md` と `commands.md`。** 以下は 2026-09 時点の要約で、利用前に正本を読む。

## ブランチ

- 形式: `feature/{service}/#{Issue番号}-{タイトル}`（git-workflow.md）
- **git-workflow.md にベースブランチの記載は無い。** `gh repo view crossloglife/baas-platform --json defaultBranchRef` と既存 PR の `baseRefName` で確認する（2026-09 時点の実測では `main`）。`develop` は存在しない（webapp の規約を流用して `couldn't find remote ref develop` になった実測あり）

## 品質ゲート

`containers/services/<service>/` で `make rspec` / `make rubocop`（各サービスの Makefile が正本）。2026-09 時点の idp の実測:

- `rspec` は**起動済みコンテナに `exec`** する。worktree で作業しているときはコンテナにどのコードが載っているかを先に確認する（`worktree` スキルの `references/docker-backend.md`）
- `rubocop` は `run --rm` の使い捨てコンテナで **`rubocop -a`（自動修正あり）** を走らせる。ゲート後に `git diff` を見直す

## worktree

`worktree` スキルの `references/repos/baas-platform.md` を読む。
