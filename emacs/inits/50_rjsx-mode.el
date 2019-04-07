(when (require 'rjsx-mode)
  (setq company-tern-property-marker "")
  (defun company-tern-depth (candidate)
    "Return depth attribute for CANDIDATE. 'nil' entries are treated as 0."
    (let ((depth (get-text-property 0 'depth candidate)))
      (if (eq depth nil) 0 depth)))
  (add-hook 'rjsx-mode-hook
            '(lambda ()
               (setq tern-command '("tern" "--no-port-file"))
               (tern-mode t)))
  (add-to-list 'company-backends 'company-tern)
)
