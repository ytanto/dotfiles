#!/bin/sh
# dotfiles のシンボリックリンクを冪等に張る。
# 既存の実体ファイルや別リンクは上書きせず警告に留める
# （リンクが外れたまま実体が二重管理される事故の検出を兼ねる）。
set -eu

DOTFILES="$(cd "$(dirname "$0")" && pwd)"

link() {
  src="$DOTFILES/$1"
  dst="$2"
  mkdir -p "$(dirname "$dst")"
  if [ -L "$dst" ]; then
    if [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
      echo "ok:   $dst"
    else
      echo "WARN: $dst は別の場所 ($(readlink "$dst")) を指している。確認して張り直すこと"
    fi
    return
  fi
  if [ -e "$dst" ]; then
    echo "WARN: $dst に実体ファイルがある。dotfiles と二重管理になるため、内容を確認して symlink に置き換えること"
    return
  fi
  ln -s "$src" "$dst"
  echo "link: $dst -> $src"
}

# zsh は .zshenv が ZDOTDIR=~/dotfiles/zsh を設定するため、リンクはこれ1本で足りる
link zsh/.zshenv "$HOME/.zshenv"

link vim/.vimrc "$HOME/.vimrc"
link git/.gitconfig "$HOME/.gitconfig"

link claude/CLAUDE.md "$HOME/.claude/CLAUDE.md"
link claude/settings.json "$HOME/.claude/settings.json"
link claude/keybindings.json "$HOME/.claude/keybindings.json"
for skill in "$DOTFILES"/claude/skills/*/; do
  link "claude/skills/$(basename "$skill")" "$HOME/.claude/skills/$(basename "$skill")"
done

# Ghostty は XDG ではなく Application Support 配下を読む
link ghostty/config "$HOME/Library/Application Support/com.mitchellh.ghostty/config"

link herdr/config.toml "$HOME/.config/herdr/config.toml"
link mise/config.toml "$HOME/.config/mise/config.toml"

link zed/settings.json "$HOME/.config/zed/settings.json"
link zed/keymap.json "$HOME/.config/zed/keymap.json"
link zed/themes/allure.json "$HOME/.config/zed/themes/allure.json"

# user 情報などマシンローカルの git 設定は untracked の .gitconfig.local に置く
if [ ! -f "$DOTFILES/git/.gitconfig.local" ]; then
  cat > "$DOTFILES/git/.gitconfig.local" <<'EOF'
[user]
	name =
	email =
[ghq]
	root = ~/Documents/src
EOF
  echo "init: git/.gitconfig.local を作成した。user 設定を記入すること"
fi

# symlink 先の mise 設定は trust しないと読み込まれない
if command -v mise >/dev/null 2>&1; then
  mise trust "$DOTFILES/mise/config.toml" >/dev/null 2>&1 && echo "ok:   mise trust"
fi
