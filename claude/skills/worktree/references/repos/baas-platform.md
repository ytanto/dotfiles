# baas-platform

Rails のサービス群を `ruby/services/<service>/` に持ち、Docker の compose は **サービスごと**に `containers/services/<service>/docker-compose.dev.yml` にあるモノレポ。**worktree 側で `docker compose up` しない**（`../docker-backend.md`）。以下は 2026-09 時点の実測。

## セットアップ

- 依存インストールは不要（コンテナ内で完結）
- `.worktreeinclude` は**無い**。idp は `config/database.yml` が tracked で、`git status --ignored ruby/services/idp` に設定系の ignored ファイルが出ない（2026-09）ので、コピーするものが無い。他サービスは同じコマンドで確認する（video には ignored の `.env` がある）
- tracked の `.gitignore` に `.claude/worktrees/` が入っている。`.git/info/exclude` への自動登録に頼らず `.gitignore` に足した前例

## compose の事情

- 「main clone 直下」ではなく **compose のあるサービスディレクトリ**（例: `containers/services/idp/`）に override / worktree 用 compose を置く。`docker-backend.md` の「compose ファイルのあるディレクトリ」はここを指す
- ボリュームは固定名の named volume（`${PWD}` 非依存）。ただし `container_name` とポートが固定なので、同じサービスの**同時起動は不可**
- テスト DB は `RAILS_TEST_DATABASE_PREFIX` で名前を変えられる（`database.yml` が `ENV.fetch` している）。方式 A の worktree 用コンテナには別の prefix を与えて main clone と分ける

## DB の共有先

idp は crosslog-back の MySQL を `host.docker.internal:5306` で参照し（`RAILS_CROSSLOG_DATABASE_HOST`）、`CROSSLOG_BACK_BASE_URL` で crosslog-back の API（既定 4000）を呼ぶ。crosslog-back を方式 A の別ポートで立てたときは、この URL も向け直す。
