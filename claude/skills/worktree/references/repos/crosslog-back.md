# crosslog-back

Rails + Docker（MySQL / Redis / PubSub を compose で同梱）。**worktree 側で `docker compose up` しない**（`../docker-backend.md`）。以下は 2026-09 時点の実測。compose や gitignore は変わるので、利用前に現物で確認する。

## セットアップ

- 依存インストールは不要（コンテナ内で完結）
- `.worktreeinclude` は tracked。列挙されているのは `.docker/services/back/.env.development` と `config/*.yml`（api_key / cable / database / linkage / redis / secrets / storage）。進入直後に `cat .worktreeinclude` と `ls config/database.yml .docker/services/back/.env.development` で来ているか確かめ、無ければ main clone からコピーする（コピー漏れの worktree が実在した）
- DB データ（`.docker/volumes/db`）は数 GB。絶対にコピーしない

## compose の事情

- `db-volume` / `redis-data` / `pubsub-volume` の `driver_opts.device` が `${PWD}/.docker/volumes/...`。worktree で up すると空の別 DB が初期化される（main が起動中ならその前にポート 5306 / 4000 / 4002 / 6379 の衝突で失敗する）
- コードを `/crosslog-back` にマウントしているサービスは主 compose だけで **4 つ**（back / auth / sidekiq / activity_log_worker）。方式 B の override はこの全部に書く。`grep -n ':/crosslog-back' docker-compose*.yml` で洗い出す
- `make rspec` / `make rubocop` は起動済みの back コンテナに `exec` する。叩く前に `docker compose exec -T back cat /crosslog-back/.git` でどの worktree が載っているか確認する
- テスト DB は `config/database.yml` で `crosslog_test` 固定。方式 A のテスト用コンテナと main clone 側で **同時に rspec を走らせない**

## DB の共有先

crosslog-back の MySQL（ホストの 5306）は次のリポジトリからも `host.docker.internal:5306` で参照されている。DB を止める・migration を当てると、こちらにも波及する。

- customer-support-webapp
- baas-platform の idp（`RAILS_CROSSLOG_DATABASE_HOST`）

## 方式 A の実物

main clone 直下の `docker-compose.worktree.yml`（`.git/info/exclude` で無視）。`test`（`sleep infinity`）と `server`（4001 番でサーバー起動）の 2 サービスを持つ。

```yaml
services:
  test:
    image: crosslog-back-back            # docker images で確認
    platform: linux/x86_64
    container_name: crosslog-back-worktree-test
    tty: true
    env_file: ./.docker/services/back/.env.development
    command: sleep infinity
    volumes:
      - ${WORKTREE_PATH}:/crosslog-back
      - ~/.ssh/id_rsa:/.ssh/id_rsa

networks:
  default:
    name: crosslog-back_default          # docker network ls で確認
    external: true
```

```bash
WORKTREE_PATH=<worktree の絶対パス> docker compose -p crosslog-back-wt -f docker-compose.worktree.yml up -d
docker compose -p crosslog-back-wt -f docker-compose.worktree.yml exec test \
  sh -c 'cd /crosslog-back && RAILS_ENV=test bundle exec rspec <path>'
```

`server` サービスは上に加えて、`server.pid` を消してから `rails s` する `command`（主 compose の `back` から写す）と `ports: ["4001:3000"]` を持つ。さらに IDP 連携用の env（内部 API キーと IDP の URL）が要るが、**これは主 compose には無い**。IDP 側（baas-platform の idp）が送ってくる値と揃えて worktree.yml に足す。足りなければ起動時か認証時のエラーで判明する。フロントの API 接続先と IDP の `CROSSLOG_BACK_BASE_URL` を 4001 に向けると画面から通しで確認できる。

## 落とし穴

- PR レビュー用の worktree 名 `pr-<番号>` は `claude --worktree "#<番号>"` の作成先と同じ。手動作成したものと Claude Code 作成のものでは掃除ルールが違う（SKILL.md「掃除」）
