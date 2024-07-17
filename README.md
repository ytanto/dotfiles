# dotfiles

## Getting Started

### Mac

```
# brew cask: must
brew install --cask iterm2
brew install --cask google-chrome
brew install --cask fork
brew install --cask tableplus

# brew
brew install git
brew install pyenv
brew install rbenv
brew install go
brew install peco
brew install ghq
brew install yarn
brew install tig
brew install kubectl
brew install zsh-syntax-highlighting

# KeyRepeat
defaults write -g InitialKeyRepeat -int 12 # normal minimum is 15 (225 ms)
defaults write -g KeyRepeat -int 1 # normal minimum is 2 (30 ms)
```

### dotfiles

```
# dotfiles

$ git clone https://github.com/ytanto/dotfiles.git

## Zsh
$ ln -s dotfiles/zsh/.zshenv ~/.zshenv
$ ln -s dotfiles/zsh/.zshrc ~/.zshrc
$ git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ~/dotfiles/zsh/zsh-syntax-highlighting
$ git clone --recursive https://github.com/sorin-ionescu/prezto.git "${ZDOTDIR:-$HOME}/dotfiles/zsh/.zprezto"

## Vim
$ ln -s dotfiles/vim/.vimrc ~/.vimrc

## Git
$ ln -s dotfiles/git/.gitconfig ~/.gitconfig
```
