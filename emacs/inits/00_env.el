(when (require 'exec-path-from-shell)
  (let ((envs '("PATH")))
    (exec-path-from-shell-copy-envs envs)))

(if window-system (progn
   (server-start)
))

;; タブをスペースで扱う
(setq-default indent-tabs-mode nil)

;; タブ幅
(custom-set-variables '(tab-width 4))

;; ビープ音を消す
(setq visible-bell t)
(setq ring-bell-function 'ignore)

;; 文字コード: UTF-8
(prefer-coding-system 'utf-8)

;; ファイル名の設定(Mac OS X)
(when (eq system-type 'darwin)
  (require 'ucs-normalize)
  (set-file-name-coding-system 'utf-8-hfs)
  (setq locale-coding-system 'utf-8-hfs))

;; ファイル名の設定(Windows)
(when (eq system-type 'w32)
  (set-file-name-coding-system 'cp932)
  (setq locale-coding-system 'cp932))

;; バックアップファイルのディレクトリ指定
(add-to-list 'backup-directory-alist
             (cons "." "~/.emacs.d/backups/"))


;; オートセーブファイルのディレクトリ指定
(setq auto-save-file-name-transforms
      `((".*" ,(expand-file-name "~/.emacs.d/backups/")) t))

;; 括弧の自動補完を有効
(electric-pair-mode 1)
