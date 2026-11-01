# dotfiles

## セットアップ

```sh
git clone https://github.com/ytanto/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

`install.sh` はシンボリックリンクを冪等に張る。既存の実体ファイルや別の場所を指すリンクは上書きせず警告するので、警告が出たら内容を確認して手で解消する(リンク外れによる設定の二重管理の検出も兼ねているため、定期的に再実行してよい)。

リンク対象:

| 対象 | リンク先 |
| --- | --- |
| zsh | `~/.zshenv` のみ(`ZDOTDIR=~/dotfiles/zsh` を設定するため他は不要) |
| vim | `~/.vimrc` |
| git | `~/.gitconfig` |
| Claude Code | `~/.claude/` 配下の settings.json / CLAUDE.md / keybindings.json / skills |
| Ghostty | `~/Library/Application Support/com.mitchellh.ghostty/config` |
| herdr | `~/.config/herdr/config.toml` |
| mise | `~/.config/mise/config.toml`(trust も実行する) |
| Zed | `~/.config/zed/` 配下の settings.json / keymap.json / themes |
| ccstatusline | `~/.config/ccstatusline/settings.json` |
| Karabiner-Elements | `~/.config/karabiner`(ディレクトリごと) |

### コミット前の秘密情報チェック

公開リポジトリなので、`install.sh` がこのリポジトリにだけ `core.hooksPath = hooks` を設定し、コミット前に `hooks/pre-commit` が gitleaks でステージ済みの変更を検査する。検出したとき、または gitleaks が見つからないときはコミットを止める。

### git ユーザー設定(初回のみ)

`install.sh` が `git/.gitconfig.local`(untracked)の雛形を作るので、user.name / user.email を記入する。マシンローカルにしたい git 設定はこのファイルに書く。

### ツール

ランタイム・CLI ツールは mise を優先して管理する(グローバル設定は `mise/config.toml`、プロジェクトごとのバージョンは各リポジトリの `mise.toml`)。mise で扱えないものだけ Homebrew を使い、`Brewfile` に載せる。

```sh
brew bundle --file=~/dotfiles/Brewfile
mise install
```

brew で入れたものを増減したら `brew bundle dump --file=~/dotfiles/Brewfile --force` で書き出し直し、vscode / go / cargo / npm の行(各ツール側で管理する)は消してからコミットする。

### macOS 設定

```sh
# KeyRepeat
defaults write -g InitialKeyRepeat -int 12 # normal minimum is 15 (225 ms)
defaults write -g KeyRepeat -int 1 # normal minimum is 2 (30 ms)
defaults write -g ApplePressAndHoldEnabled -bool false
```
