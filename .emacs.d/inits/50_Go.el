(when (require 'exec-path-from-shell)
  (let ((envs '("GOROOT" "GOPATH")))
    (exec-path-from-shell-copy-envs envs)))

(require 'go-mode nil t)
(require 'go-autocomplete nil t)
(require 'go-eldoc nil t)
(add-hook 'go-mode-hook
          (lambda ()
            (setq tab-width 2)
            (go-eldoc-setup)
            (add-hook 'before-save-hook 'gofmt-before-save)
            (local-set-key (kbd "M-.") 'godef-jump)
            ))
