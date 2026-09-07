# customer-support-webapp

Rails + Docker（compose にあるのは app と redis だけで、DB は持たない）。**worktree 側で `docker compose up` しない**（`../docker-backend.md`）。理由は DB の初期化ではなく、`container_name` とポート（4100 / 7379）が固定で main clone と衝突するため。以下は 2026-09 時点の実測。

## セットアップ

- 依存インストールは不要（コンテナ内で完結）
- `.worktreeinclude` の有無と gitignore 済みの設定ファイルは、進入直後に `cat .worktreeinclude` と `git status --ignored` で確認する

## DB の共有

自前の MySQL を持たず、**crosslog-back の MySQL** を `host.docker.internal:5306` の `crosslog_development` で共有している（`docker-compose.local.yml` と `config/database.yml`）。crosslog-back 側の DB 停止・migration がそのまま波及する。逆にこちらで migration を当てると crosslog-back の作業を壊すので、共有 DB への migration は `docker-backend.md`「制約」に従う。
