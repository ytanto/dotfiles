# Homebrew で入れたコマンドの補完を読めるようにする。zsh 同梱の補完と名前が重なるもの（_git 等）は
# 同梱版の方が高機能なので、末尾に足して同梱版を優先する
fpath+=(/opt/homebrew/share/zsh/site-functions(N/))

bindkey -e

# 履歴（/etc/zshrc の 2000 / 1000 では少ないので上限を上げる）
HISTFILE=$ZDOTDIR/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
# 同時に起動した zsh の間で履歴を共有する
setopt share_history
# 同じコマンドは古い方を消して 1 つだけ残す
setopt hist_ignore_all_dups
# 他のシェルから共有された分で重複が生まれても、ファイルには 1 つだけ書き出す
setopt hist_save_no_dups
setopt extended_history hist_ignore_space hist_verify hist_reduce_blanks

setopt interactive_comments
# ^S / ^Q を端末の停止・再開に取られないようにする。
# no_flow_control は行編集中にしか効かないので、vim など他のプログラム実行中のために stty でも止める
setopt no_flow_control
[[ -t 0 ]] && stty -ixon

# タブを閉じても & で裏に回したジョブを道連れにしない
setopt no_hup

# ? や & を含む URL を打ったり貼ったりしたとき、glob と解釈されて no matches found にならないよう自動でクオートする
autoload -Uz url-quote-magic bracketed-paste-url-magic
zle -N self-insert url-quote-magic
zle -N bracketed-paste bracketed-paste-url-magic

# ディレクトリスタック
setopt auto_pushd pushd_ignore_dups pushd_silent
alias -- -='cd -'
for i in {1..9}; do alias "$i"="cd +$i"; done
unset i

alias ls='ls -G'
alias ll='ls -lh'
alias la='ll -A'

# 補完
zmodload zsh/complist
autoload -Uz compinit && compinit -d "$ZDOTDIR/.zcompdump"
zstyle ':completion:*' menu select
# 左から順に試す: 大文字小文字を無視（大文字を入力した場合は区別する）→ . _ - 区切りの各部分を前方一致（f.b → foo.bar）→ 部分一致
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}' 'm:{a-z}={A-Z} r:|[._-]=* r:|=*' 'm:{a-z}={A-Z} l:|=* r:|=*'
# 空指定でも既定の色が付き、menu select で選択中の候補がハイライトされる
zstyle ':completion:*:default' list-colors ''
zstyle ':completion:*' group-name ''
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:warnings' format '%F{red}-- no matches --%f'
# brew install や mise use の直後でも、hash -r せずに新しいコマンドを補完できるようにする
zstyle ':completion:*' rehash true
setopt complete_in_word always_to_end
bindkey '^[[Z' reverse-menu-complete

# 入力済みの文字で前方一致する履歴だけをたどる（何も入力していなければ通常の履歴移動と同じ）
autoload -Uz up-line-or-beginning-search down-line-or-beginning-search
zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search
# ↑↓ は端末のモードで送る文字列が変わるので、両方に割り当てる
bindkey '^[[A' up-line-or-beginning-search
bindkey '^[OA' up-line-or-beginning-search
bindkey '^P' up-line-or-beginning-search
bindkey '^[[B' down-line-or-beginning-search
bindkey '^[OB' down-line-or-beginning-search
bindkey '^N' down-line-or-beginning-search

autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^X^E' edit-command-line

# Alt+Backspace でパスを 1 階層ずつ消せるよう `/` と `=` を単語の区切りにする
WORDCHARS='*?_-.[]~&;!#$%^(){}<>'

# プロンプト
autoload -Uz vcs_info
# 毎プロンプトで git 以外の VCS を探しに行かないようにする
zstyle ':vcs_info:*' enable git
zstyle ':vcs_info:git:*' formats '%F{2}%b%f'
zstyle ':vcs_info:git:*' actionformats '%F{2}%b%f:%F{9}%a%f'
precmd_functions+=(vcs_info)

# 深い階層でも入力欄を広く使えるよう、途中のディレクトリを頭文字だけにする（~/D/s/c/webapp）
_prompt_short_pwd() {
  setopt localoptions extendedglob
  local pwd=${PWD/#$HOME/\~}
  if [[ $pwd == '~' || $pwd == / ]]; then
    _prompt_pwd=$pwd
  else
    # 隠しディレクトリは「.」だけだと区別できないので、先頭のドットに続く 1 文字まで残す
    _prompt_pwd="${${${(@j:/:M)${(@s:/:)pwd}##.#?}:h}%/}/${pwd:t}"
  fi
  # prompt_subst で展開した値はさらにプロンプト展開されるので、ディレクトリ名の % を逃がす
  _prompt_pwd=${_prompt_pwd//\%/%%}
}
precmd_functions+=(_prompt_short_pwd)

setopt prompt_subst
# 確定した行から右プロンプトを消し、ターミナルの履歴をコピーしたときにブランチ名が混ざらないようにする
setopt transient_rprompt
PROMPT='%F{4}${_prompt_pwd}%f %(?.%F{2}.%F{1})❯%f '
RPROMPT='${vcs_info_msg_0_}'

# ビープ音を鳴らさない
setopt no_beep

# Redis
alias rs='redis-server'
alias rc='redis-cli'

# Docker
alias d='docker'
alias dc='docker compose'
alias dps='docker ps --format "{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Command}}\t{{.RunningFor}}"'
alias de='docker exec -it `dps | fzf | cut -f 1` /bin/bash'

# Git
alias -g lb='`git branch | fzf --prompt "GIT BRANCH>" | head -n 1 | sed -e "s/^\*\s*//g"`'
alias -g rb='`git branch -r | fzf --prompt "GIT BRANCH>" | head -n 1 | sed -e "s/^\*\s*//g" | sed "s/origin\///"`'

# Kubernetes
alias k='kubectl'
alias ka='kubectl get all'
# source <(kubectl completion zsh)

# make
alias a='make'

# fzf（Ctrl-R で履歴、Ctrl-T でファイル、Alt-C でディレクトリ）
export FZF_DEFAULT_OPTS='--no-height --layout=reverse --exact'
# 履歴番号は見づらいので表示だけ消す（選んだ行は番号付きで返るので、選択後の動作は変わらない）
export FZF_CTRL_R_OPTS='--with-nth 2..'
(( $+commands[fzf] )) && source <(fzf --zsh)

## リポジトリにcd
alias g='cd $(ghq root)/$(ghq list | fzf)'

## git worktree に cd
function wt() {
    local dir=$(git worktree list --porcelain | awk '
        /^worktree /  { path = substr($0, 10) }
        /^branch /    { sub("refs/heads/", "", $2); print $2 "\t" path }
        /^detached$/  { print "(detached)\t" path }
    ' | fzf --with-nth=1 --delimiter='\t' | cut -f2)
    [ -n "$dir" ] && cd "$dir"
}

# cd したら中身を表示し、タブタイトルを「親/カレント/」にする
_chpwd_ls_and_title() { ls; print -n "\e]0;${PWD:h:t}/${PWD:t}/\a" }
chpwd_functions+=(_chpwd_ls_and_title)

export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

## [Completion]
## Completion scripts setup. Remove the following line to uninstall
[[ -f /Users/tannaka/.dart-cli-completion/zsh-config.zsh ]] && . /Users/tannaka/.dart-cli-completion/zsh-config.zsh || true
## [/Completion]


export PATH=$PATH:$HOME/.maestro/bin

# mise
eval "$(mise activate zsh)"

# 以下の 2 つは他の設定が作ったウィジェットを包んで動くので、.zshrc の最後に読む
# （autosuggestions → syntax-highlighting の順。逆だと色付けが候補表示に追従しない）

# 入力中に履歴から続きの候補を薄く出す（→ か Ctrl-E で採用）
[[ -f /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]] &&
  source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh

ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets)
[[ -f /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]] &&
  source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
