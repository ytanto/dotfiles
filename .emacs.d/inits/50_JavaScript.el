(when (require 'js2-mode)
  (add-to-list 'auto-mode-alist '("\\.js" . js2-mode))
  (add-to-list 'auto-mode-alist '("\\.es" . js2-mode))
  (add-to-list 'auto-mode-alist '("\\.es6" . js2-mode))
  (add-to-list 'auto-mode-alist '("\\.jsx" . js2-mode))

  ;; js2-modeのインデントの不具合を解決
  (add-hook 'js2-mode-hook 'js-indent-hook)

  (when (require 'flycheck)
     (flycheck-add-mode 'javascript-eslint 'js2-mode))
)
