# crosslog-front

Nuxt + yarn v1。mise 管理。以下は 2026-09 時点の実測。

## セットアップ

- 進入直後に `mise trust`
- `yarn install`。yarn v1 は共有ストアが無く丸ごとコピーになるため **約 1.6GB / worktree・数分かかる**。必ず `run_in_background: true` で走らせ、完了を待たずに本題を進める
- `.env` は無い。`.worktreeinclude` も無い（コピーすべき git 管理外ファイルが無い）
- `symlinkDirectories` で `node_modules` を共有する手はあるが、yarn v1 で main と worktree の lockfile が違うときに安全かは未検証。使うなら lockfile 同一のときだけ

## hooks

`.claude/settings.json` の PostToolUse hook が `"$CLAUDE_PROJECT_DIR"/.claude/hooks/lint-changed.sh` を呼ぶ。worktree ではスクリプト本体は main clone 側のものが走り、対象ファイルだけが worktree になる。`yarn install` が終わる前に Edit すると hook の lint が依存不足で失敗する可能性がある（未検証。失敗したらインストール完了を待って再実行する）。

## テスト

以前は jest の `testPathIgnorePatterns` が `.claude/` を除外していて worktree ではテストが 0 件になったが、**2026-08 に削除済み**。いま 0 件マッチするなら `config/tests/unit/jest.config.js` の除外設定を疑う。
