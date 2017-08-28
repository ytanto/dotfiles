
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

;; Close all buffers
(require 'cl)
(defun clear-all-buffers ()
  (interactive)
  (loop for buffer being the buffers
     do (kill-buffer buffer)))


;; lisp directory's path
;; Localeに合わせた環境の設定
(set-locale-environment nil)


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
(el-get-bundle helm-ls-git)
(el-get-bundle helm-git-grep)
(el-get-bundle undohist)
(el-get-bundle undo-tree)
(el-get-bundle color-moccur)
(el-get-bundle moccur-edit)
(el-get-bundle multiple-cursors)
(el-get-bundle flycheck)
(el-get-bundle go-mode)
(el-get-bundle go-autocomplete)
(el-get-bundle go-eldoc)
(el-get-bundle js2-mode)
(el-get-bundle coffee-mode)
(el-get-bundle yaml-mode)
(el-get-bundle web-mode)
(el-get-bundle json-mode)
(el-get-bundle init-loader)
(el-get-bundle markdown-mode)
(el-get-bundle open-junk-file)
(el-get-bundle ace-isearch)
(el-get-bundle migemo)
(el-get-bundle minimap)
(el-get-bundle anzu)
(when (require 'init-loader nil t)
  (init-loader-load "~/.emacs.d/inits"))
