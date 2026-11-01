#
# Defines environment variables.
#

# Ensure that a non-login, non-interactive shell has a defined environment.
if [[ "$SHLVL" -eq 1 && ! -o LOGIN && -s "${ZDOTDIR:-$HOME}/.zprofile" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprofile"
fi

# -------------------------------------------------------

# My configuration

# settings for zsh
export ZDOTDIR=$HOME/dotfiles/zsh

# settings for less
export LESSHISTFILE=-


# settings for Poetry
export PATH=$HOME/.local/bin:$PATH

export PATH=$HOME/bin:/usr/local/bin:$PATH

# dotfiles 管理の自作スクリプト。実体をそのまま PATH に載せ、symlink 管理を挟まない
export PATH=$HOME/dotfiles/bin:$PATH

# settings for Android Studio
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

. "$HOME/.cargo/env"

# For Android build
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home

# Local-only overrides (not tracked)
[ -f "$HOME/.zshenv.local" ] && source "$HOME/.zshenv.local"
