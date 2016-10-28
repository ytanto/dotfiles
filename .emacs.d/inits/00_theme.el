;; TODO: my-theme作成
(load-theme 'misterioso t)

(deftheme my-theme
  "tannaka theme")

(custom-theme-set-faces
 'my-theme
 ;; 背景・文字・カーソル
 ;; '(cursor ((t (:foreground "#F8F8F0"))))
 ;; '(default ((t (:background "#1B1D1E" :foreground "#F8F8F2"))))

 ;; 選択範囲
 ;;  '(region ((t (:background "#403D3D"))))

 ;; モードライン
 '(mode-line ((t (:background "#8b2252" :foreground "#FFFFf9"
                              :box (:line-width 1 :color "#8b2252")))))
 '(mode-line-buffer-id ((t (:weight bold))))
 '(mode-line-emphasis ((t (:weight bold))))
 '(mode-line-highlight ((t nil)))
 '(mode-line-inactive ((t (:background "#200019" :foreground "#999999"
                                       :box (:line-width 1 :color "#200019")))))
 )
