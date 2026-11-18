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
# 操作の流れは見ないので、窓が前に出て作業を邪魔しないようにする。設定ファイルは秘密を含むので環境変数で上書きする。
# 人の操作が要る認証のときに起動時の指定で窓を出せるよう、既に値があれば残す（.zshenv は子の zsh でも読まれるため）
export PLAYWRIGHT_MCP_HEADLESS=${PLAYWRIGHT_MCP_HEADLESS:-true}

# Herdr デスクトップ版の受信箱パネルが段取りを読めるよう、そこで動く Claude にだけ TaskCreate などを使わせる。
# デスクトップ版の端末（herdr-core）にだけ HC_TERMINAL_ID があり、ターミナル版の herdr には無い
if [ -n "${HC_TERMINAL_ID-}" ]; then
  export CLAUDE_CODE_ENABLE_TODO_TOOLS=1
fi

# Local-only overrides (not tracked)
[ -f "$HOME/.zshenv.local" ] && source "$HOME/.zshenv.local"
