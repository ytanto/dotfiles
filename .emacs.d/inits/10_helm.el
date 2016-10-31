(when (require 'helm-config)
  (define-key global-map (kbd "C-x b") 'helm-for-files)
  (define-key global-map (kbd "C-x C-f") 'helm-find-files))
