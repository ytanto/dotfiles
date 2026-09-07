# crosslog-front

Nuxt + yarn v1。**以下は 2026-09 時点の要約で、利用前に CLAUDE.md と package.json を読む。** `.claude/rules/` に git-workflow も commands.md も無い。CLAUDE.md にはブランチ名の例（`feature/#<番号>-...` / `hotfix/#<番号>-...`）だけで base の記載は無いので、**ベースブランチは既存 PR の `baseRefName`（`gh pr list --state merged --json headRefName,baseRefName`）で確認する**（2026-09 時点の実測では feature は develop、hotfix は master 起点）。

## 品質ゲート

- `yarn check:all`（lint / tsc / test をまとめて回す。package.json が正本）
- 個別に回すなら `yarn lint`、`yarn test:unit <path>`
- lint の `--fix` 系がコードを書き換えることがある。ゲート後に `git diff` を見直す

## worktree

`worktree` スキルの `references/repos/crosslog-front.md` を読む。
