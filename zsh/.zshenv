#
# Defines environment variables.
#

# settings for zsh
export ZDOTDIR=$HOME/dotfiles/zsh

# settings for less
export LESSHISTFILE=-


# claude や uv など、公式インストーラーが入れるコマンドの置き場
export PATH=$HOME/.local/bin:$PATH

export PATH=/usr/local/bin:$PATH

# dotfiles 管理の自作スクリプト。実体をそのまま PATH に載せ、symlink 管理を挟まない
export PATH=$HOME/dotfiles/bin:$PATH

# 公開リポジトリに置けない（社内の接続先などを含む）自作スクリプトの置き場
export PATH=$HOME/bin:$PATH

# settings for Android Studio
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# For Android build
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home

# アプリが裏で起動するシェル（ログインでない最初の zsh）は .zprofile を読まないので、
# Homebrew の PATH などをログインシェルと揃えるためにここで読む。ZDOTDIR を決めた後でないと dotfiles 側を読めない
if [[ "$SHLVL" -eq 1 && ! -o LOGIN && -s "$ZDOTDIR/.zprofile" ]]; then
  source "$ZDOTDIR/.zprofile"
fi

# Playwright MCP に STG の Basic 認証とログイン用の secrets を渡す。認証情報は公開できないので dotfiles の外に置く
export PLAYWRIGHT_MCP_CONFIG=$HOME/.config/playwright-mcp/config.json

# Local-only overrides (not tracked)
[ -f "$HOME/.zshenv.local" ] && source "$HOME/.zshenv.local"
