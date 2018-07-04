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

# settings for Go
export GOPATH=$HOME/Documents/src/go
export PATH=$GOPATH/bin:$PATH

# export PATH=$HOME/bin:/usr/local/bin:$PATH:$GOPATH/bin

# settings for nodebrew
export PATH=$HOME/.nodebrew/current/bin:$PATH

# settings for less
export LESSHISTFILE=- 

# settings for npmbrew
export PATH=$HOME/.npmbrew/current/bin:$PATH

# settings for pyenv
export PYENV_ROOT=$HOME/.pyenv
export PATH=$PYENV_ROOT/bin:$PATH

# settings for cd-bookmark
fpath=($HOME/dotfiles/functions/cd-bookmark(N-/) $fpath)
autoload -Uz cd-bookmark
alias cb='cd-bookmark'

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
