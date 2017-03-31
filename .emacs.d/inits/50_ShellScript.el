(add-hook 'sh-mode-hook
          (lambda ()
          (define-key sh-mode-map (kbd "C-c C-i") nil)))
