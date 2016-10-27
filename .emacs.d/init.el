;; Added by Package.el.  This must come before configurations of
;; installed packages.  Don't delete this line.  If you don't want it,
;; just comment it out by adding a semicolon to the start of the line.
;; You may delete these explanatory comments.
(package-initialize)

;; ロードパス追加用関数
(defun add-to-load-path (&rest paths)
  (let (path)
    (dolist (path paths paths)
     (let ((default-directory (expand-file-name (concat user-emacs-directory path))))
        (add-to-list 'load-path default-directory)
         (if (fboundp 'normal-top-level-add-subdirs-to-load-path)
             (normal-top-level-add-subdirs-to-load-path))))))


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


;;; el-get

(add-to-list 'load-path "~/.emacs.d/el-get/el-get")

(unless (require 'el-get nil 'noerror)
  (with-current-buffer
      (url-retrieve-synchronously
       "https://raw.github.com/dimitri/el-get/master/el-get-install.el")
    (let (el-get-master-branch)
      (goto-char (point-max))
      (eval-print-last-sexp))))

(el-get 'sync)

(el-get-bundle exec-path-from-shell)
(el-get-bundle auto-complete)
(el-get-bundle helm)
(el-get-bundle undohist)
(el-get-bundle undo-tree)
(el-get-bundle color-moccur)
(el-get-bundle moccur-edit)
(el-get-bundle go-mode)
(el-get-bundle go-autocomplete)
(el-get-bundle go-eldoc)
(el-get-bundle init-loader)
(when (require 'init-loader nil t)
  (init-loader-load "~/.emacs.d/inits"))
