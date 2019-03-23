# dotfiles

## Getting Started

```
# brew cask
brew cask install google-japanese-ime
brew cask install iterm2
brew cask install shiftit
brew cask install google-chrome
brew cask install alfred
brew cask install kindle
brew cask install hyperswitch
brew cask install emacs
brew tap caskroom/fonts
brew cask install font-ricty-diminished

# brew
brew install git
brew install nodebrew
mkdir -p ~/.nodebrew/src
nodebrew install-binary latest
nodebrew use latest
brew install emacs
brew install pyenv
brew install rbenv
brew install zsh
brew install the_silver_searcher

# dotfiles

$ git clone https://github.com/ytanto/dotfiles.git
sudo vi /etc/shells
chsh -s /usr/local/bin/zsh

## Zsh
$ ln -s dotfiles/zsh/.zshenv ~/.zshenv
$ ln -s dotfiles/zsh/.zshrc ~/.zshrc
$ git clone git://github.com/zsh-users/zsh-syntax-highlighting.git ~/dotfiles/zsh/zsh-syntax-highlighting
$ git clone --recursive https://github.com/sorin-ionescu/prezto.git "${ZDOTDIR:-$HOME}/dotfiles/zsh/.zprezto"

## Vim
$ ln -s dotfiles/vim/.vimrc ~/.vimrc

## Git
$ ln -s dotfiles/git/.gitconfig ~/.gitconfig

## tern
$ npm install -g tern
$ ln -s ~/dotfiles/emacs/config/tern-config.json ~/.tern-config

## beautify
$ npm install -g js-beautify
$ git clone https://github.com/yasuyk/web-beautify.git /Users/tannaka/dotfiles/emacs/recipes/web-beautify

## Emacs
$ npm install -g eslint babel-eslint eslint-plugin-react
$ ln -s dotfiles/emacs ~/.emacs.d

```
