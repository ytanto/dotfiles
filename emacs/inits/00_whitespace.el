(when (require 'whitespace)

  ;; Color relationship
  (set-face-foreground 'whitespace-space "DarkGoldenrod1")
  (set-face-background 'whitespace-space nil)
  (set-face-bold-p 'whitespace-space t)
  (set-face-foreground 'whitespace-tab "DarkOliveGreen1")
  (set-face-background 'whitespace-tab nil)
  (set-face-underline  'whitespace-tab t)

  ;; Highlighting
  (setq whitespace-style '(face tabs tab-mark spaces space-mark))
  (setq whitespace-space-regexp "\\(\x3000+\\)")
  (setq whitespace-display-mappings
        '((space-mark ?\x3000 [?\□])
          (tab-mark   ?\t   [?\xBB ?\t])))

  (global-whitespace-mode 1))
