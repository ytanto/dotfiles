;; 画像ファイルを表示
(auto-image-file-mode t)

;; メニューバーを消す
(menu-bar-mode -1)

;; ツールバーを消す
(tool-bar-mode -1)

;; カーソルの点滅を止める
(blink-cursor-mode 0)

;; Welcomeページを非表示
(setq inhibit-startup-message t)

;; scratchの初期メッセージ消去
(setq initial-scratch-message "")

;; タイトルバーにファイルのフルパス表示
(setq frame-title-format "%f")

;; ファイルサイズを表示
(size-indication-mode t)

;; paren-mode : 対応括弧のハイライト
(setq show-paren-delay 0) ; 表示までの秒数. デフォルトは0.125
(show-paren-mode t)

;; emacs-lisp-mode
;; カーソル位置にある関数や変数をエコーエリアに表示
(defun elisp-mode-hooks ()
  "lisp-mode-hooks"
  (when (require 'eldoc nil t)
    (setq eldoc-idle-delay 0.2)
    (setq eldoc-eho-area-use-multiline-p t)
    (turn-on-eldoc-mode)))

(add-hook 'emacs-lisp-mode-hook 'elisp-mode-hooks)

