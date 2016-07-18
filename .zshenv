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

export ZDOTDIR=$HOME/dotfiles/

# settings for Go
export GOPATH=$HOME/Documents/Code/Go
export PATH=$GOPATH/bin:$PATH

export PATH=$HOME/bin:/usr/local/bin:$PATH

# nodebrew
export PATH=$HOME/.nodebrew/current/bin:$PATH

