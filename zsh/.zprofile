if [[ "$OSTYPE" == darwin* ]]; then
  export BROWSER='open'
fi

export EDITOR='vim'
export VISUAL='vim'
export PAGER='less'

if [[ -z "$LANG" ]]; then
  export LANG='en_US.UTF-8'
fi

typeset -gU cdpath fpath mailpath path

# ログインシェルでは macOS の path_helper が /usr/bin を先頭に並べ直すので、
# Homebrew の版（git 等）を優先するためにここで先頭へ置く
# mysql-client は keg-only で bin に載らないので明示的に足す
path=(
  /opt/homebrew/opt/mysql-client/bin
  /opt/homebrew/{bin,sbin}
  /usr/local/{bin,sbin}
  $path
  $HOME/.maestro/bin
)

# Mouse-wheel scrolling has been disabled by -X (disable screen clearing).
# Remove -X and -F (exit if the content fits on one screen) to enable it.
export LESS='-F -g -i -M -R -S -w -X -z-4'

# Try both `lesspipe` and `lesspipe.sh` as either might exist on a system.
if (( $#commands[(i)lesspipe(|.sh)] )); then
  export LESSOPEN="| /usr/bin/env $commands[(i)lesspipe(|.sh)] %s 2>&-"
fi

# zsh の一時ファイルを共有の /tmp ではなくユーザー専用の TMPDIR に置く
[[ -n "$TMPDIR" ]] && TMPPREFIX="${TMPDIR%/}/zsh"
