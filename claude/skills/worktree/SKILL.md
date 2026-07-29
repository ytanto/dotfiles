---
name: worktree
description: CrossLog 各リポジトリでの git worktree 並行開発の方針と手順。worktree の作成・セットアップ・掃除をするとき、「worktree で作業して」「並行で進めて」等で起動する。worktree 運用の相談を受けたときもこれを参照する。
---

CrossLog のリポジトリ群で git worktree を使った並行開発をするときの方針。

**worktree を作るのは webapp / crosslog-front だけ。** back系（Docker 依存）は worktree にしない → 「back系の割り切り」参照。

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
| back系（crosslog-back / baas-platform / report-back / customer-support-webapp） | **worktree を作らない**（下記「back系の割り切り」参照） | |

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

## back系の割り切り

**back系（crosslog-back / baas-platform / report-back / customer-support-webapp）は worktree を作らない。** Docker 依存でややこしくなるため、main clone でブランチを切り替えて作業する。「並行で進めて」と言われても、対象が back系なら worktree 化せずその旨を伝える。worktree 可なのは Docker なしで動く **webapp / crosslog-front** だけ。

理由（実際に踏んだもの）:

- **git 管理外の設定ファイルが来ない**。`config/database.yml` `api_key.yml` 等を手でコピーする羽目になる
- **コンテナのマウント外になる**。compose の bind mount は main clone を指すため worktree のコードが見えない。サービスディレクトリだけをマウントしている場合（baas-platform は `ruby/services/connect` のみ）は**まったく見えず**、使い捨てコンテナを別途立てることになる
- **DB を共有しているので結局分離できない**。テスト用に別 MySQL を立てると**メモリを食って既存の DB コンテナが OOM で落ちる**（crosslog-back の DB が実際に2回落ちた）
- **worktree が消えると main clone が feature ブランチに残る**。Docker が main clone をマウントしているため、気づかないまま**別ブランチのコードで dev サーバーが動く**
- customer-support-webapp は **crosslog-back の MySQL を共有**しており（`host.docker.internal:5306`）、片方の都合が他方に波及する

運用:

- main clone で `git switch -c <branch>`。並行作業が必要なら worktree ではなく**フルクローンの複製**（`-2` サフィックス）を使う
- テストは main clone のコンテナでそのまま実行する（`docker compose exec -T <service> bundle exec rspec ...`）
- 作業後は**元のブランチに戻す**。Docker がそのチェックアウトを見ているため、feature ブランチに置きっぱなしにしない
- migration は共有 DB を壊しやすい（衝突・schema_migrations 不整合・seed 汚染）。特に crosslog-back は MySQL データが `.docker/volumes/`（リポジトリ内）にあり、作り直しコストが高い

## 掃除

- 作業が終わったら `git worktree remove <path>`、マージ済みならローカルブランチも `git branch -d` で削除。残骸は `git worktree list` で棚卸しして `git worktree prune`
- Claude Code が作った worktree は「未コミット変更・新規コミットが無ければ」セッション終了時に自動削除される。コミットが残っていれば消えない
- 自分で `git worktree add` した worktree と、`-p`（非対話）実行で作られた worktree は自動掃除の対象外。手動で remove する
- worktree を消す前に、Fork 等の GUI でそのディレクトリを開いているタブは閉じておく（remove 後にエラー表示になる）

## 参考

- 公式: https://code.claude.com/docs/en/worktrees.md
- 公式 SKILL / プラグインは存在しない（worktree はネイティブプリミティブという設計思想）
