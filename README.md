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

### zsh プラグイン(初回のみ)

prezto と zsh-syntax-highlighting はリポジトリ管理外(gitignore 済み)なので clone する。

```sh
git clone --recursive https://github.com/sorin-ionescu/prezto.git ~/dotfiles/zsh/.zprezto
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ~/dotfiles/zsh/zsh-syntax-highlighting
```

### git ユーザー設定(初回のみ)

`install.sh` が `git/.gitconfig.local`(untracked)の雛形を作るので、user.name / user.email を記入する。マシンローカルにしたい git 設定はこのファイルに書く。

### ツール

ランタイム・CLI ツールは mise を優先して管理する(グローバル設定は `mise/config.toml`、プロジェクトごとのバージョンは各リポジトリの `mise.toml`)。mise で扱えないものだけ Homebrew を使う。

```sh
brew install mise git peco ghq fzf tig
brew install --cask ghostty
mise install
```

### macOS 設定

```sh
# KeyRepeat
defaults write -g InitialKeyRepeat -int 12 # normal minimum is 15 (225 ms)
defaults write -g KeyRepeat -int 1 # normal minimum is 2 (30 ms)
defaults write -g ApplePressAndHoldEnabled -bool false
```
