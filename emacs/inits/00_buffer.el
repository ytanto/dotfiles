(defun force-revert-buffer ()
  "Revert buffer without confirmation."
  (interactive) (revert-buffer t t))

(global-set-key (kbd "s-r") 'force-revert-buffer)
