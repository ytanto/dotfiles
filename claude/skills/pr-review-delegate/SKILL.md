---
name: pr-review-delegate
description: PR のレビューを別の Claude セッションに任せる。herdr で対象リポジトリのルートに新しいタブを作り、そこで `/pr-review <PR URL>` を起動し、承認待ちになったときと統合報告が出たときに知らせるまで見守る。「別セッションでこの PR レビューして」「新しいタブで pr-review 回して」のように、PR のリンクとともに別セッションでのレビューを頼まれたときに使う。PR のリンクだけでレビューを頼まれたときは pr-review を使う。
argument-hint: "<PR URL>"
---

# PR のレビューを別セッションに任せる

レビューそのものは向こうのセッションの `/pr-review` がやる。ここでやるのは、**正しい場所で起動して、見守って、知らせる**ことだけ。

## 決まりごと

- **向こうのセッションに文字やキーを送り込まない**（`pane send-text`・`pane send-keys`・`agent send`、起動後の `pane run`）。承認ボタンを押すのも同じ。承認や質問への答えは、指示者が向こうのタブで直接する
- **後片付けをしない。** worktree の削除・タブを閉じるのは、指示者が向こうのセッションに「レビュー完了」と言ってから向こうがやる
- タブは `--no-focus` で作り、指示者の見ている画面を奪わない
- ID（`w1:t5S` など）は毎回取り直す。前に見た ID を使い回さない

## 手順

### 1. herdr の中か確かめる

`echo $HERDR_ENV` が `1` でなければ herdr の外なので、そう伝えて止める。

### 2. 対象のリポジトリを決める

1. `gh pr view <PR URL> --json number,title,headRefName,baseRefName,headRepository` で PR の情報を取る
2. 手元のクローンを探す。`~/Documents/src` の下で、`git remote get-url origin` が PR のリポジトリと一致するディレクトリを使う（ディレクトリ名がリポジトリ名と違う、改名前の名前のままのことがある）
3. 見つからない・複数あるときは指示者に聞く

### 3. タブを作って起動する

1. `herdr workspace list` のラベルから、リポジトリに合うワークスペースを選ぶ。合うものが無ければ指示者に聞く
2. `herdr tab create --workspace <ID> --label pr-<番号> --cwd <リポジトリの絶対パス> --no-focus`。返ってきた `result.root_pane.pane_id` を控える
3. `herdr pane run <pane_id> "claude '/pr-review <PR URL>'"`
   - `--remote-control` は付けない
   - 指示者から追加の指示（「重くていいから全部見て」など）があれば、PR URL の後ろに続けて書く

### 4. 起動を確かめて報告する

`herdr wait agent-status <pane_id> --status working --timeout 60000` で動き始めたのを確かめ、`herdr pane read <pane_id> --source visible --lines 30` で `/pr-review` が始まっていることを読む。

報告: ワークスペース名・タブ名・ディレクトリ・PR のタイトル。

### 5. 見守る

状態が `blocked`（承認・入力待ち）か `done` / `idle`（手を止めた）になるまで、バックグラウンドで待つ。`run_in_background` で次を流し、終わったら通知で戻ってくる。

```bash
while :; do
  s=$(herdr agent get <pane_id> | grep -o '"agent_status":"[a-z]*"' | cut -d'"' -f4)
  case "$s" in blocked|done|idle) echo "$s"; break ;; esac
  sleep 30
done
```

戻ってきたら `herdr agent read <pane_id> --source recent --lines 150` で画面を読み、状態ごとに次のようにする。

| 状態 | やること |
| --- | --- |
| `blocked` | 何の承認・質問で止まっているかを、向こうの画面の文面に即して短く伝える。「向こうのタブで答えてください」と添え、5 の待機をもう一度流す |
| `done` / `idle` で統合報告が出ている | 所見を要点だけまとめて伝える（重大度・件数・各所見の一行要約）。全文は向こうのタブにあると添える。見守りはここで終わり |
| `done` / `idle` で統合報告が無い | 途中で止まっている。最後の画面の内容（エラー・質問）を伝えて、指示者の判断を待つ |

報告のあと、後片付けは向こうのセッションに「レビュー完了」と言えば始まることを添える。
