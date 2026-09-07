# worktree セッションでのシェルコマンドの書き方

Claude Code の worktree セッション（`claude --worktree` / `EnterWorktree` で進入した状態）には**隔離ガード**が働く。該当するコマンドは、承認を求められるのではなく**実行自体を断られる**（ツールエラーとして返り、書き直し方が案内される）。

## 公式仕様: 4 つのチェック

出典: https://code.claude.com/docs/en/worktrees.md「How Claude Code enforces isolation」

1. **ファイル編集**: main checkout のパスを対象にした Edit / Write / NotebookEdit
2. **作業ディレクトリ**: cwd が main checkout に解決するコマンド、または main checkout の外に留まると検証できないコマンド
3. **git のリダイレクト**: `git -C <main>`、`--git-dir`、`GIT_DIR` / `GIT_WORK_TREE`、`cd <main> && git ...` のように git を main checkout に向けるコマンド
4. **コマンドの形**: コマンド文字列から「実行される git が worktree 内に留まる」と静的に検証できないもの（コマンド名が実行時に決まる、構文がパースできない等）。このチェックは無効化できない

保護対象は「起動したリポジトリの main checkout」であって、worktree の外全般ではない。

## 実測で拒否された形

上の 4 分類に当たるかは形によるが、CrossLog の作業で実際に断られたもの:

- `for` / `while` ループやコマンド置換（`$(...)`）を含み、中で git を呼ぶ複合コマンド
- worktree 外（scratchpad や `~/` 配下）のファイルを `git commit -F` / `gh pr create --body-file` に渡すコマンド
- `git add -A` のように対象が静的に定まらない git 操作

## 回避

**素の単独コマンドに分割する。** 1 呼び出し 1 コマンドにすれば、ほぼすべて通る。

- `git add <明示パス>` と `git commit` は別々の呼び出しにする
- コミット本文・PR 本文・Issue 本文は **worktree 内のファイル**に書き出し、`-F <file>` / `--body-file <file>` で渡す。必要なら worktree 内へ `cp` してから使う
  - 使い終わったら消す。消し忘れるとリポジトリに残る（`COMMIT_MSG.txt` / `PR_BODY.md` のような一時ファイルは毎回消す）
- 複数ファイルを確認する場合もループにせず 1 ファイルずつ読む
- 現在地の確認（`git rev-parse --git-dir` と `--git-common-dir` の比較）も `$(...)` で束ねず 2 回に分けて目視で比べる
