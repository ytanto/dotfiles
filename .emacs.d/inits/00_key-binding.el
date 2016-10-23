;; C-h(ヘルプコマンド)をバックスペースに設定
(keyboard-translate ?\C-h ?\C-?)

;; C-t(transpose-chars)をウィンドウ切り替えに設定
(define-key global-map (kbd "C-t") 'other-window)
