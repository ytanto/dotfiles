(when (require 'rjsx-mode)
  (add-hook 'rjsx-mode-hook
            (lambda ()
              (auto-complete-mode t))))
