---
name: worktree
description: CrossLog 各リポジトリでの git worktree 並行開発の方針と手順。worktree の作成・セットアップ・掃除をするとき、「worktree で作業して」「並行で進めて」等で起動する。worktree 運用の相談を受けたときもこれを参照する。
---

CrossLog のリポジトリ群で git worktree を使った並行開発をするときの方針。

**worktree はどのリポジトリでも作れる。** ただし Docker を使う back系は、**worktree 側で `docker compose up` してはいけない**（main clone の Docker にコードをマウントし直す）→ 「back系（Docker あり）の worktree」参照。

## 基本方針

- **Claude Code のネイティブ機能を使う**（`claude --worktree <名前>` / EnterWorktree / `.worktreeinclude`）。外部の worktree マネージャや自作スクリプトは使わない
- worktree の作成先は Claude Code デフォルトの `.claude/worktrees/<名前>/` のままで良い。`.git/info/exclude` に `**/.claude/worktrees/` が自動登録されるため gitignore の追加は不要（チーム展開するときだけ `.gitignore` に追加）
- 1タスク = 1 worktree = 1ブランチ。同一ブランチは2つの worktree に同時チェックアウトできない
- Claude Code が作る worktree はデフォルトで `origin/HEAD`（リモートのデフォルトブランチ）起点。ローカルの HEAD 起点にしたい場合は settings.json に `"worktree": { "baseRef": "head" }`。PR レビュー用の worktree は `claude --worktree "#<PR番号>"` で切れる
- ブランチ・コミット・stash は全 worktree で共有。コミット済みの diff はどの checkout からでも見える。一方、worktree がチェックアウト中のブランチは他所から削除・rebase できず、stash は共有リストに積まれるため並行作業中は取り違えに注意
- フルクローンの複製（`-2` サフィックスのリポジトリ）と worktree の併用は許容する。無理に一本化しない

## worktree 作成後のセットアップ

worktree は tracked ファイルしか持ってこない。**worktree に進入した直後、以下を確認を取らずに自動実行する**（毎回ユーザーに聞かない）：

1. mise 管理のリポジトリ（front / webapp）は初回に必ず `mise trust` が必要 → 進入直後に `mise trust` を実行する（`mise ERROR ... not trusted` を待たず先回りで実行してよい）
2. 依存インストールを実行する（下表）。時間がかかっても進捗を報告するだけでよく、実行可否は聞かない
   - **`run_in_background: true` で走らせ、完了を待たずに本題を進める。** 待ちを本作業の時間に乗せない
   - **レビュー等の読み取り専用作業でも省略しない。** ユーザーがその worktree でそのまま画面を触って動作確認するため、環境は常に整えておく（「自分が使わないから不要」で判断しない）

| リポジトリ | セットアップ | 備考 |
|---|---|---|
| webapp | `pnpm install` のみ | pnpm は共有ストアからのハードリンクなので高速・省ディスク。husky は prepare で自動再生成。apps/connect の秘匿ファイルは `.worktreeinclude` が自動コピー |
| crosslog-front | `yarn install` | yarn v1 なので丸ごとコピーで重い（約1.6GB/worktree）・数分かかる。バックグラウンド実行推奨。.env は無い |
| back系（crosslog-back / baas-platform / report-back / customer-support-webapp） | 依存インストールは不要（コンテナ内で完結）。代わりに **main clone の `docker-compose.override.yml` でコードのマウント先を worktree に向ける** | 下記「back系（Docker あり）の worktree」参照。**worktree 側で `docker compose up` しない** |

- `.env` 等の git 管理外ファイルはリポジトリルートの `.worktreeinclude`（.gitignore 構文）に列挙すると worktree 作成時に自動コピーされる
  - コピー対象は「パターンに一致し、かつ gitignore 済み」のファイルのみ（tracked ファイルは対象外）。追記したら `git check-ignore <path>` で対象になっているか確認する
  - `WorktreeCreate` フックを使う場合 `.worktreeinclude` は処理されないので、ファイルコピーもフック内で行う
- 共通の permissions は tracked の `.claude/settings.json` に寄せる。`settings.local.json` は worktree ごとに独立なので、そこに書いた許可は worktree では効かず再承認が発生する
- webapp で worktree を多用するなら、pnpm の Global Virtual Store（pnpm 公式がマルチエージェント worktree 用途として案内: https://pnpm.io/global-virtual-store ）でさらに省ディスク化できる

## worktree 内での作業ルール（事故防止）

- **ファイルの Read / Edit / Write は必ず worktree 配下のパスで行う**。worktree 進入前の会話に残っているメインチェックアウト側の絶対パスをそのまま使い続けると、main 側の作業ツリー（別ブランチ・作業中の可能性あり）を書き換える事故になる
  - worktree 進入直後に、以降の操作パスを worktree ルート起点に切り替えることを明示的に確認する
- コミット前に `git status`（cwd = worktree）で差分が worktree 側に出ていることを確認する。**「nothing to commit」が出たら誤パス編集を疑う**（気づくのが遅れるほど main 側が汚れる）
- 誤って main 側を書き換えた場合の復旧手順:
  1. main 側で対象ファイルのみ `git diff -- <files> > patch` で退避
  2. worktree で `git apply --check` → `git apply`（ブランチ間でベースが違うと当たらないので --check 必須）
  3. main 側を `git checkout -- <files>` で復元（自分が触っていないファイルを巻き込まない）
- crosslog-front: jest の `testPathIgnorePatterns` に `/\.claude/` が含まれるため、デフォルトの `.claude/worktrees/` 配下では**全テストが 0 件マッチ**になる。`yarn test:unit <path> --testPathIgnorePatterns=/node_modules/` で上書きして実行する（`yarn check:all` の test ステージは同じ理由で落ちるので、lint / tsc / test を個別に回す）

## back系（Docker あり）の worktree

**back系でも worktree は使える。ただし Docker は main clone で 1 セットだけ動かし、コードのマウント先を override で worktree に向ける。** worktree ごとに Docker 環境を立てることはしない。

> 以前は「back系は worktree を作らない」としていたが、**Docker を worktree 側で立てようとするから破綻していた**だけで、コードのマウント先だけ差し替えれば成立する。2026-08-04 に方針変更。

### なぜこの形なのか（worktree で `docker compose up` してはいけない理由）

- **DB データが巨大**。crosslog-back の `.docker/volumes/db` は **6.8GB**。worktree にコピーする選択肢はない
- **crosslog-back の compose は `${PWD}` 依存**。`db-volume` の `driver_opts.device` が `${PWD}/.docker/volumes/db` なので、**worktree で up すると空の別 DB が初期化される**（データは gitignore されているため worktree には来ない）
- **同じデータディレクトリを 2 つの mysqld が開くと壊れる**。device を絶対パスで共有しつつ両方起動する、は不可
- **MySQL を 2 つ立てるとメモリを食う**（crosslog-back の DB が実際に 2 回 OOM で落ちた）
- customer-support-webapp は **crosslog-back の MySQL を共有**しており（`host.docker.internal:5306`）、片方の都合が他方に波及する

### 二つの方式を使い分ける

**やりたいことによって方式が変わる。** 既存の開発環境を他の人（他の作業）が使っているなら、後者を選ぶ。

| やりたいこと | 方式 | 既存への影響 |
|---|---|---|
| **テストを回す**（TDD 中はこれで足りる） | **別プロジェクトでテスト専用コンテナを立てる** | **なし**。サーバーを起動せず、テスト用データベースしか触らない |
| **画面から動作確認する** | **別プロジェクトで別ポートにサーバーを立てる** | **なし**。既存のポートを奪わない |
| 既存とまったく同じ環境で確認する | **override でマウント先を切り替える** | **あり**。他作業がそのサービスを使えなくなる |

override は「そのサービスを占有してよいとき」の手段。**並行作業がある間は別プロジェクト方式のほうが安全**。

### 方式A: 別プロジェクトでテスト・サーバーを立てる（推奨）

DB は既存のものを共有する。**既存のネットワークに参加すれば compose のサービス名（`db` 等）を名前解決できる**ので、`database.yml` を書き換えずに済む。

```yaml
# docker-compose.worktree.yml（main clone 直下・git 管理外）
services:
  test:
    image: crosslog-back-back        # 既存のイメージをそのまま使う
    platform: linux/x86_64
    container_name: crosslog-back-worktree-test
    tty: true
    env_file: ./.docker/services/back/.env.development
    command: sleep infinity          # サーバーは起動しない → ポート衝突なし
    volumes:
      - ${WORKTREE_PATH}:/crosslog-back
      - ~/.ssh/id_rsa:/.ssh/id_rsa

networks:
  default:
    name: crosslog-back_default      # 既存のネットワークに参加する
    external: true
```

```bash
WORKTREE_PATH=<worktree の絶対パス> docker compose -p crosslog-back-wt -f docker-compose.worktree.yml up -d
docker compose -p crosslog-back-wt -f docker-compose.worktree.yml exec test \
  sh -c 'cd /crosslog-back && RAILS_ENV=test bundle exec rspec <path>'
```

**画面から確認したくなったら、同じファイルの `command` を `rails s` に変え `ports: ["4001:3000"]` を足すだけ**でサーバー用になる。そのとき参照元（front の `.env`、IDP の `CROSSLOG_BACK_BASE_URL`）を新しいポートに向ける。

- **テストは `crosslog_test` を使うので開発用データベースを汚さない**
- **開発用データベースにマイグレーションを流さないこと**（既存の作業が壊れる）。流すのは test 側だけにする

### 方式B: override でマウント先を切り替える

1. worktree を作る
2. **main clone** に `docker-compose.override.yml` を置き、コードのマウント先を worktree の絶対パスに向ける
3. **main clone のディレクトリで** `docker compose up -d <service>` して反映する
4. worktree を切り替えるときは override のパスを書き換えて再度 `up -d`

```yaml
# crosslog-back/docker-compose.override.yml（main clone 側・git 管理外）
services:
  back:
    volumes:
      - /Users/<user>/.../crosslog-back/.claude/worktrees/<名前>:/crosslog-back
      - ~/.ssh/id_rsa:/.ssh/id_rsa
  sidekiq:
    volumes:
      - /Users/<user>/.../crosslog-back/.claude/worktrees/<名前>:/crosslog-back
```

DB / Redis / PubSub は**触らない**。main clone のものをそのまま共有する。

#### 落とし穴（実際に踏んだもの）

- **`.worktreeinclude` は手動の `git worktree add` では処理されない。** Claude Code の worktree 機能（`EnterWorktree` / `claude --worktree`）が処理する仕組みのため。**手動で作ったら設定ファイルは自分でコピーする**（crosslog-back なら `config/*.yml` の 7 本と `.docker/services/back/.env.development`）
- **compose ファイル自体は main clone のものが読まれる。** worktree 側の `docker-compose.dev.yml` に環境変数を足しても**起動には反映されない**。同じ設定を **override にも書く**こと（worktree 側はコミット用、override は起動用の二重管理になる）
- **compose ファイルを編集するときは編集先を間違えやすい。** 「Docker は main clone で動かす」ため main clone のパスを開きたくなるが、**コミットすべき変更は worktree 側**。main clone を編集すると、そこにチェックアウトされている**別作業のブランチを汚す**
  - 汚した場合の復旧: main clone で `git diff -- <file> > /tmp/x.patch` → worktree で `git apply --check` してから `git apply` → main clone を `git checkout -- <file>` で戻す
- **zsh の `noclobber` で `>` によるファイル上書きが拒否される**（`file exists:` と出て中身が変わらない）。上書きは Write ツールか `>|` を使う

### リポジトリ別の事情

| リポジトリ | `.worktreeinclude` | 備考 |
|---|---|---|
| **crosslog-back** | **必要**。`.docker/services/back/.env.development` と `config/*.yml`（api_key / cable / database / linkage / redis / secrets / storage の 7 本）がすべて gitignore | DB データは 6.8GB。絶対にコピーしない |
| **baas-platform** | **不要**。`config/database.yml` は tracked で、gitignore は `/**/.env` のみ。IDP 配下に持ち出すべきファイルは実質ない | compose の volume は**固定名の named volume**（`crosslog-baas-idp-mysql-volume-development`）で `${PWD}` 非依存。ただし `container_name` とポートが固定なので**同時起動は不可** |

### 切り替えのルール（重要）

**マウント先の切り替えは、ユーザーの明示的な指示・承認があるときだけ行う。自分の判断で勝手に切り替えない。**

override は 1 ファイルしかないため、切り替えた瞬間に**それまでの worktree は Docker から外れる**。影響が自分の作業範囲を超え、別セッションで作業している人のコンテナを黙って奪うことになる。

```
worktree A で作業中（Docker は A を見ている）
  ↓ B に切り替える
worktree A のセッションで docker compose exec ... rspec を叩くと
  → B のコードでテストが走る。しかも気づきにくい
```

**back系のコンテナでコマンドを実行する前に、今どのブランチが載っているか必ず確認する。**

```bash
docker compose exec -T back git -C /crosslog-back branch --show-current
```

worktree の `.git` は `gitdir: .../worktrees/<名前>` を指すファイルなので、**コンテナ内から見えるブランチ＝いま Docker が握っているコード**。意図と違えば、切り替えてよいかユーザーに確認してから `up -d` する。

### 制約

- **同時に Docker へ接続できる worktree は 1 つだけ**。並行で 2 つ動かすことはできない
- main clone のブランチは develop のままでよい（コードはマウントされないため）。**以前あった「main clone が feature ブランチに残る」問題は、この形では起きない**
- テストは main clone のコンテナでそのまま実行する（`docker compose exec -T <service> bundle exec rspec ...`）。コードは worktree を向いているので、worktree の変更がそのまま走る
- migration は共有 DB を壊しやすい（衝突・schema_migrations 不整合・seed 汚染）。作り直しコストが高いので、worktree を切り替える前に**当てた migration を戻す**か、戻せない変更なら別途合意を取る

### ignore の置き場所

- **`docker-compose.override.yml` / `docker-compose.worktree.yml` → global gitignore**（`~/dotfiles/git/.gitignore_global`）。個人環境の絶対パスを含むため、どのリポジトリでも永久にコミットしない
- **`.worktreeinclude` → リポジトリに tracked が慣習**（webapp が前例）。未コミットで試す間はそのリポジトリの `.git/info/exclude` に入れる

### 検証状況

- 2026-08-04: crosslog-back に `.worktreeinclude` を設置（`.git/info/exclude` で無視）／global gitignore に override を追加
- 2026-08-04: **baas-platform（idp）で override 方式の実起動を確認済み**。コンテナのマウント元が worktree を指し、worktree 側のコードでマイグレーション・モデル・ルーティングが動作した。上記「落とし穴」はこのときに踏んだもの
- crosslog-back での実起動は未検証（DB データ 6.8GB を共有する構成のため、実際に動かすときに確認する）

## 掃除

- 作業が終わったら `git worktree remove <path>`、マージ済みならローカルブランチも `git branch -d` で削除。残骸は `git worktree list` で棚卸しして `git worktree prune`
- Claude Code が作った worktree は「未コミット変更・新規コミットが無ければ」セッション終了時に自動削除される。コミットが残っていれば消えない
- 自分で `git worktree add` した worktree と、`-p`（非対話）実行で作られた worktree は自動掃除の対象外。手動で remove する
- worktree を消す前に、Fork 等の GUI でそのディレクトリを開いているタブは閉じておく（remove 後にエラー表示になる）

## 参考

- 公式: https://code.claude.com/docs/en/worktrees.md
- 公式 SKILL / プラグインは存在しない（worktree はネイティブプリミティブという設計思想）
