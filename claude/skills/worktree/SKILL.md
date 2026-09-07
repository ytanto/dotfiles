---
name: worktree
description: CrossLog 各リポジトリでの git worktree 並行開発の方針と手順。worktree の作成・セットアップ・掃除をするとき、「worktree で作業して」「並行で進めて」等で起動する。worktree 運用の相談を受けたときもこれを参照する。
---

git worktree を使った並行開発の方針。本文は**どのリポジトリでも変わらない汎用の手順**だけを持つ。リポジトリ固有の事情と、特定のケースでだけ要る詳細は `references/` に置く。

| 場面 | 読む先 |
|---|---|
| 作業対象リポジトリの固有事情（セットアップ・`.worktreeinclude`・Docker・落とし穴） | `references/repos/<リポジトリ名>.md`（無ければ本文の汎用手順だけで進める） |
| worktree 内でシェルコマンドが「拒否」される／コマンドの書き方 | `references/shell-commands.md` |
| Docker で動くリポジトリで worktree のコードを動かす・コンテナにどの worktree が載っているか確かめる | `references/docker-backend.md` |

**worktree はどのリポジトリでも作れる。** ただし Docker を使うリポジトリは、**worktree 側で `docker compose up` してはいけない**（Docker は main clone で 1 セットだけ動かし、コードのマウント先を worktree に向ける。→ `references/docker-backend.md`）。

## 基本方針

- **Claude Code のネイティブ機能を推奨する**（`claude --worktree <名前>` / `EnterWorktree` / `.worktreeinclude`）。作成先はデフォルトの `.claude/worktrees/<名前>/`、ブランチは `worktree-<名前>` が新規に切られる。既存ブランチを載せたいときだけ `git worktree add <path> <branch>` で手動作成する
  - `.claude/worktrees/` は `.git/info/exclude` に自動登録される（公式ドキュメントには無い実測挙動。登録されない例もあるので、`git status` に worktree が untracked で出たら `.gitignore` に足す）
- **作る前に現在地を確認する。** `git rev-parse --git-dir` と `git rev-parse --git-common-dir` の出力が違えば既に worktree の中にいる。その中で更に worktree を作らない
- 1 タスク = 1 worktree = 1 ブランチ。同一ブランチは 2 つの worktree に同時チェックアウトできない
- 起点はデフォルトで `origin/HEAD`（リモートのデフォルトブランチ。24 時間以内に fetch が無ければ自動 fetch される）。ローカルの HEAD 起点にしたい場合は settings.json に `"worktree": { "baseRef": "head" }`
- PR レビュー用は `claude --worktree "#<PR番号>"`（GitHub の PR URL でも可）。`.claude/worktrees/pr-<番号>` に作られる
- 同じ名前で `--worktree` すると既存の worktree を開く。未コミット変更・独自コミットが無く作成時のブランチのままなら（または PR がマージ済みでリモートブランチが消えていれば）デフォルトブランチに巻き戻されるので、古い作業の続きを期待しない（PR 番号指定の worktree は常に旧 tip で開く）
- ブランチ・コミット・stash は全 worktree で共有。コミット済みの diff はどの checkout からでも見える。一方、worktree がチェックアウト中のブランチは他所から削除・rebase できず、stash は共有リストに積まれるため並行作業中は取り違えに注意
- subagent にも `isolation: worktree` で同じ仕組みが使える。`.worktreeinclude` や `baseRef`、Docker の制約もそのまま適用される

### 複数リポジトリを触るタスクでは `EnterWorktree` を使わない

`EnterWorktree` で worktree を作れるのは現在のリポジトリ（と、その中に nested したリポジトリ）だけ。兄弟配置のリポジトリを同時に変えるタスクでは成立しない。進入後は隔離ガードが働き、他リポジトリのパスを含むコマンドも通らないことがある（実測。公式仕様は `references/shell-commands.md`）。

その場合は `git worktree add` で各リポジトリに worktree を作り、**進入せず絶対パスで作業する**。ネイティブ機能推奨からの逸脱になるので、理由を添えてユーザーに伝えてから進む。手動作成では `.worktreeinclude` が処理されない点に注意（次節）。

## worktree 作成後のセットアップ

worktree は tracked ファイルしか持ってこない。**worktree に進入した直後、以下を確認不要で実行する。** リポジトリ固有のコマンドと注意は `references/repos/<リポジトリ名>.md` を読む。

1. `mise.toml` のあるリポジトリは初回に必ず `mise trust` が必要 → 進入直後に実行する（`mise ERROR ... not trusted` を待たず先回りでよい）
2. **`.worktreeinclude` に列挙されたファイルが実際に来ているか `ls` で確かめる。** 手動の `git worktree add` では処理されず、Claude Code 経由でもコピー漏れの worktree が実在した。無ければ main clone からコピーする
3. 依存インストールを実行する（コマンドはリポジトリごとのファイル参照）。**`run_in_background: true` で走らせ、完了を待たずに本題を進める**。Docker で動くリポジトリはインストール不要で、代わりに `references/docker-backend.md` の方式で main clone の Docker に載せる
4. 実装に入る前に lint / 型チェック / 対象テストを 1 回通しておく。ベースラインが汚れていると、後の失敗が自分の変更由来か判別できない（Docker のリポジトリはコンテナ起動が要るので TDD の最初のテスト実行と兼ねてよい）

### `.worktreeinclude`

- `.env` 等の git 管理外ファイルはリポジトリルートの `.worktreeinclude`（.gitignore 構文）に列挙すると worktree 作成時に自動コピーされる
- コピー対象は「パターンに一致し、かつ gitignore 済み」のファイルのみ（tracked ファイルは対象外）。追記したら `git check-ignore <path>` で対象になっているか確認する
- `WorktreeCreate` フックを使う場合も `.worktreeinclude` は処理されないので、ファイルコピーはフック内で行う
- リポジトリに tracked にするのが慣習。未コミットで試す間は `.git/info/exclude` に入れる

### settings / hooks の効き方

- worktree での「don't ask again」承認は main checkout の `.claude/settings.local.json` に保存され、全 worktree で効く（v2.1.211 以降）。チームで共有したい許可は tracked の `.claude/settings.json` に寄せる
- **hooks の `${CLAUDE_PROJECT_DIR}` は worktree に追従しない。** hook のスクリプト本体は main checkout 側のものが走り、cwd と対象ファイルだけが worktree になる。worktree 側で hook スクリプトを直しても効かない
- 依存に触らないタスクなら settings に `"worktree": { "symlinkDirectories": ["node_modules"] }` を置くと main の `node_modules` が symlink され、インストールを省ける。**ただし main と worktree で lockfile が違うと壊れる。** 安全に動くかはパッケージマネージャ次第で未検証なので、使うなら lockfile が同一のときだけ・個人の settings.local.json で

## worktree 内での作業ルール（事故防止）

- **ファイルの Read / Edit / Write は必ず worktree 配下のパスで行う。** worktree 進入前の会話に残っているメインチェックアウト側の絶対パスをそのまま使い続けると、main 側の作業ツリー（別ブランチ・作業中の可能性あり）を書き換える事故になる
  - worktree 進入直後に、以降の操作パスを worktree ルート起点に切り替えることを明示的に確認する
- コミット前に `git status`（cwd = worktree）で差分が worktree 側に出ていることを確認する。**「nothing to commit」が出たら誤パス編集を疑う**（気づくのが遅れるほど main 側が汚れる）
- 誤って main 側を書き換えた場合の復旧手順:
  1. main 側で対象ファイルのみ `git diff -- <files> > patch` で退避
  2. worktree で `git apply --check` → `git apply`（ブランチ間でベースが違うと当たらないので --check 必須）
  3. main 側を `git checkout -- <files>` で復元（自分が触っていないファイルを巻き込まない）
- **シェルコマンドは素の単独コマンドに分割する。** git を含む複合コマンドや main checkout に触るコマンドは隔離ガードに拒否される。書き方は `references/shell-commands.md`
- **Docker のリポジトリ: コンテナでテストやサーバーを実行する前に、どの worktree が載っているか確認する。** worktree のディレクトリからコマンドを叩いても、走るのはコンテナがマウントしているコード（`references/docker-backend.md`）
- 並行作業を始める前に `gh pr list` で open な PR の変更ファイル（`gh pr diff <n> --name-only`）を眺め、同じファイルを触る PR があれば先に相談する。後でコンフリクト解消に払うコストのほうが高い

## 掃除

- 作業が終わったら `git worktree remove <path>`、マージ済みならローカルブランチも `git branch -d` で削除。残骸は `git worktree list` で棚卸しして `git worktree prune`。放置すると数十個溜まるので、PR をマージしたタイミングで消す
- Claude Code が作った worktree の終了時の扱い:
  - 変更もコミットも無い → 無名セッションなら自動削除。名前付きセッションは残すか聞かれる
  - 変更やコミットがある → keep / remove を聞かれる。**remove を選ぶとブランチごと作業が消える**ので、push 済みか確かめてから選ぶ
- 自分で `git worktree add` した worktree は自動掃除の対象外。`-p`（非対話）実行で作られた worktree は掃除されないうえロックが残るので、`git worktree remove` が拒否されたら `git worktree unlock <path>` してから消す
- subagent / バックグラウンドセッションの worktree は `cleanupPeriodDays` 経過後に自動 sweep される。作業が残っているものと手動作成のものは残る
- worktree を消す前に、GUI の git クライアントでそのディレクトリを開いているタブは閉じておく（remove 後にエラー表示になる）

## 参考

- 公式: https://code.claude.com/docs/en/worktrees.md
- 公式 SKILL / プラグインは存在しない（worktree はネイティブプリミティブという設計思想）
