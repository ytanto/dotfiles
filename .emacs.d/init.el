;;ロードパスの追加
;; load-path

;; Added by Package.el.  This must come before configurations of
;; installed packages.  Don't delete this line.  If you don't want it,
;; just comment it out by adding a semicolon to the start of the line.
;; You may delete these explanatory comments.
(package-initialize)

;; ロードパス追加用関数
(defun add-to-load-path (&rest paths)
  (mapc '(lambda (path)
           (add-to-list 'load-path path))
        (mapcar 'expand-file-name paths)))

;; lisp directory's path
;; Localeに合わせた環境の設定
(set-locale-environment nil)

;; 画像ファイルを表示
(auto-image-file-mode t)

;; メニューバーを消す
(menu-bar-mode -1)

;; ツールバーを消す
(tool-bar-mode -1)

;; カーソルの点滅を止める
(blink-cursor-mode 0)

;; テーマの設定
(load-theme 'misterioso t)

;; Welcomeページを非表示
(setq inhibit-startup-message t)

;; scratchの初期メッセージ消去
(setq initial-scratch-message "")

;; タイトルバーにファイルのフルパス表示
(setq frame-title-format "%f")

;; タブをスペースで扱う
(setq-default indent-tabs-mode nil)

;; タブ幅
(custom-set-variables '(tab-width 4))

;; フォント設定
(set-face-attribute 'default nil
                    :family "Ricty Diminished Discord"
                    :height 160)

(setq visible-bell t)
(setq ring-bell-function 'ignore)

;; キーマップ

;; C-h(ヘルプコマンド)をバックスペースに設定
(keyboard-translate ?\C-h ?\C-?)

;; C-t(transpose-chars)をウィンドウ切り替えに設定
(define-key global-map (kbd "C-t") 'other-window)

;; 文字コード: UTF-8
(prefer-coding-system 'utf-8)

;; ファイル名の設定(Mac OS X)
(when (eq system-type 'darwin)
  (require 'ucs-normalize)
  (set-file-name-coding-system 'utf-8-hfs)
  (setq locale-coding-system 'utf-8-hfs)
)

;; ファイル名の設定(Windows)
(when (eq system-type 'w32)
  (set-file-name-coding-system 'cp932)
  (setq locale-coding-system 'cp932)
)

;; ファイルサイズを表示
(size-indication-mode t)

;; paren-mode : 対応括弧のハイライト
(setq show-paren-delay 0) ; 表示までの秒数. デフォルトは0.125
(show-paren-mode t)

;; バックアップファイルのディレクトリ指定
(add-to-list 'backup-directory-alist
             (cons "." "~/.emacs.d/backups/"))


;; オートセーブファイルのディレクトリ指定
(setq auto-save-file-name-transforms
      `((".*" ,(expand-file-name "~/.emacs.d/backups/")) t))


;; emacs-lisp-mode
;; カーソル位置にある関数や変数をエコーエリアに表示
(defun elisp-mode-hooks ()
  "lisp-mode-hooks"
  (when (require 'eldoc nil t)
    (setq eldoc-idle-delay 0.2)
    (setq eldoc-eho-area-use-multiline-p t)
    (turn-on-eldoc-mode)))

(add-hook 'emacs-lisp-mode-hook 'elisp-mode-hooks)
