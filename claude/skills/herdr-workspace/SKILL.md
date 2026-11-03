---
name: herdr-workspace
description: herdr（ターミナルのタブ・ペインを管理するツール）の中から、作業の場所を整える。新しいタブで Claude セッションをリモートコントロール付きで開く、worktree とタブをまとめて作る、サーバーやログを横のペインに出す、入力待ち・終わったセッションを一覧にする、他のセッションの画面を割り込まずに読む、タブを片付ける。「新しいタブで Claude 開いて」「〇〇リポジトリで △△ という名前でセッション作って」「どのセッションが止まってる？」「〇〇のセッションが何してるか見て」「worktree とタブ作って」「サーバーを横で起動して」「タブ片付けて」のように頼まれたときに使う。herdr の話題に触れただけでは起動しない。
argument-hint: "[やりたいこと（例: crosslog-front で nuxt4 という名前のセッション）]"
---

# herdr で作業の場所を整える

herdr の CLI は、動いている herdr にソケット経由でつながる。**最初に `HERDR_ENV=1` を確かめる。** 1 でなければ herdr の外なので、そう伝えて止める。

コマンドの全体は `herdr <workspace|tab|pane|agent|wait|worktree> --help` で引ける。公式の `herdr` スキル（`~/.agents/skills/herdr/SKILL.md`）は API の説明が詳しいので、知らないコマンドを使うときに読む。

## 決まりごと

- **他のセッションに文字やキーを送り込まない**（`pane send-text`・`pane send-keys`・`agent send`・Claude の入った他人のペインへの `pane run`）。承認ボタンを押す操作も同じ。相手の作業や承認の仕組みを壊す。頼みごとは `SendMessage` でする
- **タブ・ペインは、頼まれたときだけ作る。** 気を利かせて増やさない。作るときは `--no-focus` で、ユーザーの見ている画面を奪わない
- **閉じる前に確かめる。** エージェントが動いている（`working`・`blocked`）タブやペインを閉じると作業が止まり、戻せない
- ID（`w1:t5S` など）は毎回 `list` で取り直す。前に見た ID を使い回さない

## 新しいタブで Claude セッションを開く

1. ワークスペースを選ぶ: `herdr workspace list` のラベルから、リポジトリに合うものを選ぶ。合うものが無ければユーザーに聞く
2. **先にタブを作る**: `herdr tab create --workspace <ID> --label <名前> --cwd <リポジトリの絶対パス> --no-focus`。返ってきた `result.root_pane.pane_id` を控える
3. そのペインで起動する: `herdr pane run <pane_id> "claude --remote-control <名前>"`
   - 最初の指示があるときは後ろに足す: `claude --remote-control <名前> "<指示>"`。指示には背景と目的を書く（会話は引き継がれない）
4. 起動を待って画面を読む: `herdr wait output <pane_id> --match "remote-control is active" --timeout 30000` → `herdr pane read <pane_id> --source visible --lines 30`
5. 報告する: タブの場所（ワークスペース名・タブ名）、ディレクトリ、画面に出た `https://claude.ai/code/session_…` の URL

**`herdr agent start` は使わない。** タブを指定しないと、ワークスペースで開いているタブ（ユーザーの別作業のタブのこともある）にペインとして足される。

## worktree とタブをまとめて作る

`herdr worktree create --cwd <リポジトリ> --branch <ブランチ> --base <元のブランチ> --label <名前> --no-focus --json` で、worktree とそのタブができる。返ってきた JSON からペインとパスを控え、セッションが要るなら上の 3 から続ける。

リポジトリに worktree の決まり（CLAUDE.md・worktree 用のスキル）があれば、そちらのセットアップ手順（依存の入れ方・.env の扱い）に従う。

## サーバーやログを横のペインに出す

1. 自分のペインの横に分ける: `herdr pane split --current --direction right --cwd <ディレクトリ> --no-focus`。新しいペインは `result.pane.pane_id`
2. コマンドを流す: `herdr pane run <pane_id> "<起動コマンド>"`
3. 準備ができるまで待つ: `herdr wait output <pane_id> --match "<起動完了の文字>" --timeout <ミリ秒>`
4. エラーを見るときは `herdr pane read <pane_id> --source recent --lines 80`

起動前のポートの確認など、リポジトリ側のサーバー起動の決まりがあればそれに従う。

## 止まっている・終わったセッションを一覧にする

`herdr agent list`（または `herdr tab list`）の `agent_status` を読み、次の順に表で伝える。

| 状態 | 意味 |
| --- | --- |
| `blocked` | 承認や入力を待っている。真っ先に伝える |
| `done` | 終わったが、まだ誰も見ていない |
| `working` | 作業中 |
| `idle` | 入力待ち（何も頼まれていない） |

ワークスペース名とタブ名を添える。`unknown` はシェルだけのペインなので、聞かれなければ省く。

## 他のセッションの画面を読む

`herdr agent read <名前かペインID> --source recent --lines 100` で読み、何をしているか・どこで止まっているかを短くまとめる。**読むだけで、何も送らない。**

## タブを片付ける

- 名前を直す: `herdr tab rename <tab_id> <名前>`（制御文字が混じった名前もこれで直る）
- 閉じる: 閉じる候補をワークスペース名・タブ名・状態つきで一覧にし、OK をもらってから `herdr tab close <tab_id>`
