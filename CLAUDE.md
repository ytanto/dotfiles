# CLAUDE.md

このリポジトリで作業するときの指針。

## このリポジトリの位置づけ

個人の dotfiles。**GitHub で公開しているリポジトリ**（`ytanto/dotfiles`）なので、ここに置いたものは誰でも読める前提で扱う。

- `claude/CLAUDE.md` は **全プロジェクト共通の Claude Code の指示**（`~/.claude/CLAUDE.md` の実体）。このリポジトリ用の指示ではない。書き換えるとすべてのセッションに効く。

## 秘密情報を入れない

トークン・認証情報・社内固有の情報はコミットしない。置き場は次のとおりで、どれも管理外にしている。

| 置くもの | 場所 |
| --- | --- |
| 環境変数（トークン等） | `~/.zshenv.local` |
| git の user 情報・マシン固有の設定 | `git/.gitconfig.local` |
| 社内固有のルール・実測ログ | `*.local/` |
| ツールの認証情報 | `~/.config/<ツール名>/`（例: `gmail-fetch`, `gspread`） |

## 設定の反映の仕組み

- 設定は `install.sh` が張るシンボリックリンク越しに使う。`~/.claude/settings.json` などを直すときも、編集するのはこのリポジトリ側の実体。
- 管理するファイルを足したら、`install.sh` の `link` と README の「リンク対象」の表の両方に足す。
- zsh は `~/.zshenv` が `ZDOTDIR=~/dotfiles/zsh` を設定するので、リンクは `.zshenv` の 1 本だけ。
- `install.sh` は冪等で、既存の実体や別の場所を指すリンクは上書きせず警告する。新しいファイルを足したら流し直して `WARN` が出ないことを確かめる。

## ツール

- ランタイム・CLI は mise を優先する（全体設定は `mise/config.toml`）。mise で扱えないものだけ Homebrew を使う。
- ターミナルは Ghostty、エディタは Zed。iTerm2 は使わない。
- `bin/` のスクリプトは `uv run --script` で依存ごと動かす形にする。生成されるロックファイルはコミットしない。

## コミット

- メッセージは `<対象>: <何をなぜ変えたか>` の形で、日本語で書く（例: `zsh: Homebrew の GNU rsync を macOS 標準の openrsync より優先する`）。対象はディレクトリ名かツール名。
