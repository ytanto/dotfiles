(when (require 'anything nil t)
  (setq
  ;; 候補を表示するまでの時間. デフォルト:0.5
  anything-idle-delay 0.3
  ;; タイプして再描写するまでの時間. デフォルト:0.1
  anything-input-idle-delay 0.2
  ;; 候補の最大表示数. デフォルト:50
  anything-candidate-number-limit 100
  ;; 候補選択ショートカットをアルファベットに
  ;; anything-enable-shortcuts 'alphabet
  ;; 候補が多いときに体感速度を早くする
  anything-quick-update t)

  (require 'anything-match-plugin nil t)

  (when (require 'anything-complete nil t)
    ;; lispシンボルの補完候補の再検索時間
    (anything-lisp-complete-symbol-set-timer 150))

  (when (require 'descbinds-anything nil t)
    ;; describe-bindingsをAnythingに置き換える
    (descbinds-anything-install)))
