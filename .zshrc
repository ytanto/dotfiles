# User configuration

# aliases
alias ll='ls -l -G'
alias la='ls -al -G'

# ディレクトリ名でcd
setopt auto_cd

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

# 大文字小文字を区別しない（大文字を入力した場合は区別する）
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'
