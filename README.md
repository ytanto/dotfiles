# dotfiles

## Getting Started

```
$ git clone https://github.com/mochi8k/dotfiles.git

# Emacs
$ ln -s dotfiles/emacs ~/.emacs.d

# Zsh
$ ln -s dotfiles/zsh/.zshenv ~/.zshenv
$ ln -s dotfiles/zsh/.zshrc ~/.zshrc
$ git clone git://github.com/zsh-users/zsh-syntax-highlighting.git ~/dotfiles/zsh/zsh-syntax-highlighting
$ git clone --recursive https://github.com/sorin-ionescu/prezto.git "${ZDOTDIR:-$HOME}/dotfiles/zsh/.zprezto"

# Vim
$ ln -s dotfiles/vim/.vimrc ~/.vimrc

# Git
$ ln -s dotfiles/git/.gitconfig ~/.gitconfig

```
