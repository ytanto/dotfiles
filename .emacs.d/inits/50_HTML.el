(add-hook 'html-mode-hook
          (lambda()
            (define-key html-mode-map (kbd "C-c C-i") nil)))
