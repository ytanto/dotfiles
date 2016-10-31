(when (require 'helm-config)
  ;; helm-for-files
  (define-key global-map (kbd "C-x b") 'helm-for-files)
  
  ;; helm-find-files
  (define-key global-map (kbd "C-x C-f") 'helm-find-files)

  ;; tab 補完
  (define-key helm-find-files-map (kbd "<tab>") 'helm-execute-persistent-action)

  ;; C-h バックスペース
  (define-key helm-find-files-map (kbd "C-h") 'delete-backward-char))

