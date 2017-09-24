" setting

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

" viminfoの生成を無効
set viminfo=

" 自動でペーストモード
if &term =~ "xterm"
    let &t_ti .= "\e[?2004h"
    let &t_te .= "\e[?2004l"
    let &pastetoggle = "\e[201~"

    function XTermPasteBegin(ret)
        set paste
        return a:ret
    endfunction

    noremap <special> <expr> <Esc>[200~ XTermPasteBegin("0i")
    inoremap <special> <expr> <Esc>[200~ XTermPasteBegin("")
    cnoremap <special> <Esc>[200~ <nop>
    cnoremap <special> <Esc>[201~ <nop>
endif