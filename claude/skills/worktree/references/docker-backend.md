# Docker で動くリポジトリで worktree のコードを動かす

**Docker で動くリポジトリでも worktree は使える。ただし Docker は main clone で 1 セットだけ動かし、コードのマウント先を worktree に向ける。** worktree ごとに Docker 環境を立てることはしない。

リポジトリごとの具体（サービス名・イメージ名・compose の置き場所・DB の共有先）は `repos/<リポジトリ名>.md` にある。ここは方式と事故防止だけを書く。

## なぜ worktree で `docker compose up` してはいけないか

- **DB データが巨大。** 数 GB 規模の DB ボリュームを worktree にコピーする選択肢はない
- **compose が `${PWD}` 依存のことがある。** ボリュームの `driver_opts.device` が `${PWD}/...` だと、worktree で up した瞬間に**空の別 DB が初期化される**（データは gitignore されているため worktree には来ない）
- **同じデータディレクトリを 2 つの mysqld が開くと壊れる。** device を絶対パスで共有しつつ両方起動する、は不可
- **MySQL を 2 つ立てるとメモリを食う**（実際に OOM で落ちた事例あり）
- **DB を他リポジトリと共有していることがある。** 片方の都合が他方に波及する（共有先は各リポジトリのファイル参照）

## 二つの方式を使い分ける

**やりたいことによって方式が変わる。** 既存の開発環境を他の作業が使っているなら、影響の無い方式 A を選ぶ。

| やりたいこと | 方式 | 既存への影響 |
|---|---|---|
| **テストを回す**（TDD 中はこれで足りる） | **A: 別プロジェクトでテスト専用コンテナを立てる** | **ほぼ無し**。サーバーを起動せず、開発用 DB にも触らない。ただしテスト DB を共有するリポジトリでは main clone 側の rspec と同時に走らせない |
| **画面から動作確認する** | **A: 別プロジェクトで別ポートにサーバーを立てる** | **無し**。既存のポートを奪わない |
| 既存とまったく同じ環境で確認する | **B: override でマウント先を切り替える** | **あり**。他作業がそのサービスを使えなくなる |

override は「そのサービスを占有してよいとき」の手段。並行作業がある間は方式 A のほうが安全。

### 方式 A: 別プロジェクトでテスト・サーバーを立てる（推奨）

DB は既存のものを共有する。**既存の compose ネットワークに `external: true` で参加すれば、サービス名（`db` 等）をそのまま名前解決できる**ので `database.yml` を書き換えずに済む。

```yaml
# docker-compose.worktree.yml（compose ファイルのあるディレクトリに置く・git 管理外）
services:
  test:
    image: <既存のイメージ名>          # docker compose ps / docker images で確認
    env_file: <主 compose の該当サービスと同じ env_file>
    command: sleep infinity          # サーバーは起動しない → ポート衝突なし
    volumes:
      - ${WORKTREE_PATH}:<主 compose と同じマウント先>

networks:
  default:
    name: <既存のネットワーク名>       # docker network ls で確認
    external: true
```

```bash
WORKTREE_PATH=<worktree の絶対パス> docker compose -p <リポジトリ名>-wt -f docker-compose.worktree.yml up -d
docker compose -p <リポジトリ名>-wt -f docker-compose.worktree.yml exec test sh -c 'cd <マウント先> && RAILS_ENV=test bundle exec rspec <path>'
```

- **イメージ名・ネットワーク名は compose のプロジェクト名（既定は clone のディレクトリ名）由来。** clone 名が違う人や `COMPOSE_PROJECT_NAME` を設定している人は名前が変わるので、必ず `docker compose ps` / `docker network ls` で確認してから書く
- **画面から確認したいときは `server` サービスを足す。** `command` をサーバー起動にし、`ports` を既存と別の番号にする。**それだけでは起動しない**ことが多い。主 compose の該当サービスにある `environment` と `command` の前処理（`server.pid` の削除など）を写す。足りない env は起動時のエラーで判明する。そのとき参照元（フロントの API 接続先設定や、連携先サービスの URL 設定）を新しいポートに向ける
- テストは test 用 DB を使うので開発用データベースを汚さない。**開発用データベースにマイグレーションを流さないこと**（既存の作業が壊れる）。流すのは test 側だけにする
- テスト DB 名を環境変数で変えられるサービスでは、worktree 用に別名を与えて main clone と分ける。名前がハードコードのサービスでは共有になるので、**同時にテストを走らせない**
- gems をイメージに焼いているサービスでは、**`/usr/local/bundle` を named volume で覆わない**（覆うと gem が消える）

### 方式 B: override でマウント先を切り替える

1. worktree を作る
2. **main clone** の compose ファイルと同じディレクトリに `docker-compose.override.yml` を置き、コードのマウント先を worktree の絶対パスに向ける
3. **main clone のディレクトリで** `docker compose up -d` して反映する
4. worktree を切り替えるときは override のパスを書き換えて再度 `up -d`

**コードをマウントしているサービスを全部書く。** 主 compose を `grep -n ':<マウント先>' docker-compose*.yml` して洗い出し、その全サービスに同じ volume を書く。一部だけ書くと、残りのサービスが main clone のコードのまま動き、気づきにくいズレになる。

```yaml
# docker-compose.override.yml（main clone 側・git 管理外）
services:
  <コードをマウントしている各サービス>:
    volumes:
      - /abs/path/to/<repo>/.claude/worktrees/<名前>:<マウント先>
```

DB / Redis / PubSub は**触らない**。main clone のものをそのまま共有する。

#### 切り替えのルール（重要）

**マウント先の切り替えは、ユーザーの明示的な指示・承認があるときだけ行う。自分の判断で勝手に切り替えない。**

override は 1 ファイルしかないため、切り替えた瞬間に**それまでの worktree は Docker から外れる**。影響が自分の作業範囲を超え、別セッションで作業している人のコンテナを黙って奪うことになる。

```
worktree A で作業中（Docker は A を見ている）
  ↓ B に切り替える
worktree A のセッションで docker compose exec ... rspec を叩くと
  → B のコードでテストが走る。しかも気づきにくい
```

## コンテナに載っているコードを確認する

**コンテナでコマンドを実行する前に、今どの worktree が載っているか必ず確認する。**

worktree の `.git` は `gitdir: <main clone>/.git/worktrees/<名前>` を書いたただのファイルで、その指し先はコンテナにマウントされていない。そのため**コンテナ内で `git branch` は動かない**（`fatal: not a git repository` になるが壊れているわけではない）。代わりに `.git` ファイルを読めば、どの worktree が載っているかが git 無しで分かる。

```bash
docker compose exec -T <service> cat <マウント先>/.git
# → gitdir: /Users/.../<repo>/.git/worktrees/<名前>   ← いま Docker が握っているコード
# → main clone が載っていれば .git はディレクトリなので cat が "Is a directory" で失敗する
```

ブランチ名まで要るときはホスト側で `git -C <worktree のパス> branch --show-current` を見る。意図と違えば、切り替えてよいかユーザーに確認してから `up -d` する。

## 落とし穴

- **compose ファイル自体は main clone のものが読まれる。** worktree 側の compose に環境変数を足しても**起動には反映されない**。同じ設定を override / worktree 用 compose にも書く（worktree 側はコミット用、override は起動用の二重管理になる）
- **compose ファイルを編集するときは編集先を間違えやすい。** 「Docker は main clone で動かす」ため main clone のパスを開きたくなるが、**コミットすべき変更は worktree 側**。main clone を編集すると、そこにチェックアウトされている**別作業のブランチを汚す**。復旧手順は SKILL.md「worktree 内での作業ルール」
- **Makefile の `make rspec` 等は起動済みコンテナに `exec` する。** worktree のディレクトリから叩いても、コンテナがマウントしているコードで走る。マウント先を確認してから使う
- **`docker compose run -v <worktree>:<マウント先>` での上書きは効かない。** サービス定義側の `volumes` が優先され、新規追加したファイルが `cannot load such file` になる。方式 A の専用 compose を使う
- **override のバックアップ（`docker-compose.override.yml.bak-*` 等）は gitignore に当たらない。** untracked として `git status` に出てコミット事故のもとになるので、切り替え前の退避は compose ディレクトリの外に置く

## 制約

- **同時に Docker へ接続できる worktree は 1 つだけ**（方式 B）。並行で 2 つ動かすなら方式 A で別プロジェクトを立てる
- main clone のブランチはデフォルトブランチのままでよい（コードはマウントされないため）
- migration は共有 DB を壊しやすい（衝突・schema_migrations 不整合・seed 汚染）。作り直しコストが高いので、worktree を切り替える前に**当てた migration を戻す**か、戻せない変更なら別途合意を取る

## ignore の置き場所

- **`docker-compose.override.yml` → 各自の global gitignore**（`git config --global core.excludesFile` で指定するファイル）。個人環境の絶対パスを含むため、どのリポジトリでも永久にコミットしない
- **`docker-compose.worktree.yml`** は `${WORKTREE_PATH}` 経由で絶対パスを含まない。リポジトリの `.git/info/exclude` に入れるか、チームで共通化するなら tracked にしてもよい
- **`.worktreeinclude` → リポジトリに tracked が慣習**
