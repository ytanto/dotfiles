#
# Defines environment variables.
#
# Authors:
#   Sorin Ionescu <sorin.ionescu@gmail.com>
#

# Ensure that a non-login, non-interactive shell has a defined environment.
if [[ "$SHLVL" -eq 1 && ! -o LOGIN && -s "${ZDOTDIR:-$HOME}/.zprofile" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprofile"
fi

# -------------------------------------------------------

# My configuration

# settings for zsh
export ZDOTDIR=$HOME/dotfiles/zsh
export HISTFILESIZE=10000

# settings for less
export LESSHISTFILE=-


# settings for Poetry
export PATH=$HOME/.local/bin:$PATH

export PATH=$HOME/bin:/usr/local/bin:$PATH

case ${OSTYPE} in
    darwin*)
        export FILTERING_TOOL=peco
        ;;
    linux*)
        # for Bow
        export FILTERING_TOOL=percol
        ;;
esac

# settings for Android Studio
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# settings for Homebrew
export PATH=$PATH:/opt/homebrew/bin

. "$HOME/.cargo/env"

# For Android build
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home

# Local-only overrides (not tracked)
[ -f "$HOME/.zshenv.local" ] && source "$HOME/.zshenv.local"
