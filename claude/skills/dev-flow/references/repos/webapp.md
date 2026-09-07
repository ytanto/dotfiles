# webapp

pnpm モノレポ。apps 配下に connect / report / video。**正本は `.claude/rules/git-workflow.md` と `commands.md`。** 以下は 2026-09 時点の要約で、利用前に正本を読む。

## ブランチ

| 種別 | 形式 | base |
|---|---|---|
| 通常開発 | `feature/{app}/#{Issue番号}-{タイトル}` | `develop` |
| 緊急バグ修正 | `hotfix/{app}/#{Issue番号}-{タイトル}` | `main` |

hotfix を develop に出すとリリース経路がずれる。どちらか判断できないときは①で聞く。

## 品質ゲート

`<app>` は package.json の `name`（`connect` / `report-front` / `video-front`）であってディレクトリ名ではない。

| app | コマンド |
|---|---|
| connect | `pnpm --filter connect run check:all` |
| report | `pnpm --filter report-front run check:all` |
| video | `pnpm --filter video-front run format` と `check-types`（`check:all` は無い） |

- `check:all` は format / check-types / jest のみで **Firestore ルールのテストを含まない**。ルールを変更したら `pnpm --filter connect run test:rules:firestore` も回す

## worktree

`worktree` スキルの `references/repos/webapp.md` を読む。
