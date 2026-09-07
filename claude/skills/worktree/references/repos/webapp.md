# webapp

pnpm モノレポ（apps/connect / report / video など）。mise 管理。以下は 2026-09 時点の実測。

## セットアップ

- 進入直後に `mise trust`
- `pnpm install` のみ。pnpm は共有ストアからのハードリンクなので高速・省ディスク。husky は prepare で自動再生成される
- `.worktreeinclude` は tracked。apps/connect の秘匿ファイル（`.env`、Firebase / Google の設定 JSON）が自動コピーされる。`ios/` `android/` は絶対パスを含む生成物なのでコピー対象外。必要なら worktree 内で `expo prebuild` し直す
- worktree を多用するなら pnpm の Global Virtual Store（ https://pnpm.io/global-virtual-store ）でさらに省ディスク化できる

## 注意

- `worktree.sparsePaths` でアプリ単位のチェックアウトもできるが、`.claude` を含めないと settings が来ない等の落とし穴があり、現状は不要
