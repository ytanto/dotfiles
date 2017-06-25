(when (require 'ace-isearch)
  (global-ace-isearch-mode +1)
  (define-key isearch-mode-map (kbd "M-o") 'helm-multi-swoop-all-from-isearch))

