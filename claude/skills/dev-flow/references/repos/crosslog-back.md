# crosslog-back

Rails + Docker（MySQL / Redis / PubSub 同梱）。**以下は 2026-09 時点の要約で、利用前に CLAUDE.md と makefile を読む。** `.claude/rules/` に git-workflow は無く CLAUDE.md にもブランチの記述が無いので、**ブランチ規約は既存 PR の `baseRefName`（`gh pr list --state merged --json headRefName,baseRefName`）で確認する**（2026-09 時点の実測では feature / fix は develop、hotfix は master 起点）。`commands.md` も無いので、品質ゲートは makefile を読む。

## 品質ゲート

`make rspec` / `make rubocop`（makefile が正本）。2026-09 時点の実測:

- `rspec` は**起動済みの back コンテナに `exec`** する。worktree で作業しているときは `docker compose exec -T back cat /crosslog-back/.git` でどの worktree が載っているかを先に確認する（`worktree` スキルの `references/docker-backend.md`）
- `rubocop` は `run --rm` の使い捨てコンテナで **`rubocop -a`（自動修正あり）** を走らせる。ゲート後に `git diff` を見直す。worktree のディレクトリから叩くと compose のプロジェクト名がディレクトリ名になり、依存コンテナ（db 等）を別プロジェクトで起こしにいく可能性がある（未検証）。main clone のディレクトリで叩くか、方式 A の worktree 用コンテナで `bundle exec rubocop` を直接実行する

## worktree

`worktree` スキルの `references/repos/crosslog-back.md` を読む。
