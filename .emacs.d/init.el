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

;; 自動保存を無効
(setq auto-save-default nil)

;; バックアップを無効
(setq make-backup-files nil)

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
