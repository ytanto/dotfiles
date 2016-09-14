" setting

" 矢印キーを無効
noremap <Up> <Nop>
noremap <Down> <Nop>
noremap <Left> <Nop>
noremap <Right> <Nop>
inoremap <Up> <Nop>
inoremap <Down> <Nop>
inoremap <Left> <Nop>
inoremap <Right> <Nop>

" シンタックスを有効
syntax on

" 文字コードをUTF-8
set fenc=utf-8

" スワップファイルの生成を無効
set noswapfile

" バックアップファイルの生成を無効
set nobackup

" 入力中のコマンドをステータスに表示
set showcmd

" タブを半角スペースへ
set expandtab

" タブ
set tabstop=2
set shiftwidth=2

" オートインデント
set smartindent

" 対応する括弧の表示
set showmatch

" undoファイルの生成を無効
set noundofile
