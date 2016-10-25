(require 'go-mode nil t)
(require 'go-autocomplete nil t)
(require 'go-eldoc nil t)
(add-hook 'go-mode-hook '(lambda () (setq tab-width 2)))
