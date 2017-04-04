(when (require 'helm-config)
  ;; helm-for-files
  ;; (define-key global-map (kbd "C-x b") 'helm-for-files)
  
  ;; helm-find-files
  (define-key global-map (kbd "C-x C-f") 'helm-find-files)

  ;; tab 補完
  (define-key helm-find-files-map (kbd "<tab>") 'helm-execute-persistent-action)

  ;; C-h バックスペース
  (define-key helm-find-files-map (kbd "C-h") 'delete-backward-char)

  (when (require 'helm-ls-git)
    (custom-set-variables
     '(helm-truncate-lines t)
     '(helm-delete-minibuffer-contents-from-point t)
     '(helm-mini-default-sources '(helm-source-buffers-list
                                   helm-source-ls-git-status
                                   helm-source-files-in-current-dir
                                   helm-source-ls-git
                                   helm-source-recentf)))
    (global-set-key (kbd "C-x C-i") 'helm-mini))

  (when (require 'helm-git-grep)
    (global-set-key (kbd "C-x g") 'helm-git-grep)
    ;; Invoke 'helm-git-grep' from isearch.
    (define-key isearch-mode-map (kbd "C-x g") 'helm-git-grep-from-isearch)
    ;; Invoke 'helm-git-grep' from other helm.
    (eval-after-load 'helm
      '(define-key helm-map (kbd "C-x g") 'helm-git-grep-from-helm))))
