#
# Executes commands at the start of an interactive session.
#
# Authors:
#   Sorin Ionescu <sorin.ionescu@gmail.com>
#

# Source Prezto.
if [[ -s "${ZDOTDIR:-$HOME}/.zprezto/init.zsh" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprezto/init.zsh"
fi


# -------------------------------------------------------

# My configuration

# aliases
# alias ll='ls -l -G'
# alias la='ls -al -G'

# ディレクトリ名でcdを無効
unsetopt auto_cd

# ビープ音を鳴らさない
setopt no_beep

# 補完キー連打で順に補完候補を自動で補完
setopt auto_menu

# カッコの対応などを自動的に補完
setopt auto_param_keys

# 補完機能を使用する
autoload -U compinit && compinit

# 補完候補を初回のTABで一覧表示(default ON)
setopt auto_list

# 同時に起動したzshの間でヒストリを共有する
setopt share_history

# 同じコマンドをヒストリに残さない
setopt hist_ignore_all_dups

# historyコマンドは履歴に登録しない
setopt hist_save_no_dups

# 余分な空白は詰めて記録
setopt hist_reduce_blanks

# 大文字小文字を区別しない（大文字を入力した場合は区別する）
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'

# Redis
alias rs='redis-server'
alias rc='redis-cli'

# Docker
alias d='docker'
alias dm='docker-machine'
alias dc='docker-compose'
alias dps='docker ps --format "{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Command}}\t{{.RunningFor}}"'
alias de='docker exec -it `dps | peco | cut -f 1` /bin/bash'

# Git
alias -g lb='`git branch | $FILTERING_TOOL --prompt "GIT BRANCH>" | head -n 1 | sed -e "s/^\*\s*//g"`'

# Emacs
alias ec='emacsclient -n'

# Vagrant
alias v='vagrant'

# Kubernetes
alias k='kubectl'
alias ka='kubectl get all'
export EDITOR=vim
source <(kubectl completion zsh)

# make
alias a='make'

# svn
alias s='svn'

# peco

## history検索
function select-history() {
    local tac
    if which tac > /dev/null; then
        tac="tac"
    else
        tac="tail -r"
    fi
    BUFFER=$(fc -l -n 1 | eval $tac | $FILTERING_TOOL --query "$LBUFFER")
    CURSOR=$#BUFFER
    zle -R -c
}
zle -N select-history
bindkey '^r' select-history

## リポジトリにcd
alias g='cd $(ghq root)/$(ghq list | $FILTERING_TOOL)'
alias gh='ghq look $(ghq list | $FILTERING_TOOL)'

## make with peco
function peco-make () {
    local targets=$(make -qp | awk -F':' '/^[a-zA-Z0-9][^$#\/\t=]*:([^=]|$)/ {split($1,A,/ /);for(i in A)print A[i]}')
    local target=$(echo ${targets} | sort -f | peco --query "$LBUFFER")
    if [ -n "$target" ]; then
        BUFFER="make ${target}"
        zle accept-line
    fi
    zle clear-screen
}
zle -N peco-make
bindkey '^[' peco-make

# source zsh-syntax-highlighting
if [ -f $ZDOTDIR/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
  source $ZDOTDIR/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
fi

# Homebrewで入れた場合
if [ -f /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
    source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
fi

ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets)

# pyenv
eval "$(pyenv init -)"

# rbenv
eval "$(rbenv init -)"

# GCP
# The next line updates PATH for the Google Cloud SDK.
if [ -f ${HOME}/google-cloud-sdk/path.zsh.inc ]; then source ${HOME}/google-cloud-sdk/path.zsh.inc; fi

# The next line enables shell command completion for gcloud.
if [ -f ${HOME}/google-cloud-sdk/completion.zsh.inc ]; then source ${HOME}/google-cloud-sdk/completion.zsh.inc; fi

# Tab Title
function chpwd() { ls; echo -ne "\033]0;$(pwd | rev | awk -F \/ '{print "/"$1"/"$2}'| rev)\007"}

# XAMPPを使う時だけコメントを解除する。pyenvが変になる。
# settins for XAMPP
# export PATH=$PATH:/Applications/XAMPP/xamppfiles/bin
# export PATH=/Applications/XAMPP/xamppfiles/bin:$PATH
