---
name: test-evidence
description: PR のテスト項目を実際にブラウザで実施し、エビデンス動画を撮って PR に反映するまでを行う。テスト項目の実装との突き合わせ・実施計画・録画・チェックリスト反映までが範囲。「テスト実施して」「動作確認してエビデンス取って」「テスト項目やって動画撮って」「録画して」「PR のテストお願い」等で起動する。
---

PR に書かれたテスト項目を自分で実施し、その様子を動画に残して PR に反映する。

**「動画を撮ること」が目的ではない。** テスト項目が実装と合っているかを確かめ、実際に動かして通し、結果を PR に残すまでが仕事。動画は「そう見える」証拠でしかなく、**スクリプト内の待機・検証が「実際にそうなった」証拠**になる。両方あって初めてエビデンスとして成立する。

録画は **Playwright MCP の `page.screencast`**（Playwright 1.59+）を使う。ブラウザ操作と録画が同じスクリプトの中で完結する。

> **参照先**
> - 公式の動画ガイドは `playwright-core` の `tools/cli-client/skill/references/video-recording.md`（ローカルには配布されていない）。本スキルはその内容を取り込み済み
> - **locator / 待機 / ダイアログ / 認証の一般論は `~/Documents/src/github/skills/testing/playwright-test/SKILL.md` が詳しい。** E2E テスト向けだが考え方は共通なので、判断に迷ったらそちらを見る
> - `playwright-cli` 系スキルは `npx playwright test` / `codegen` / CI 用で、**エージェント操作向けではない**（本人たちがそう明記している）。録画には使わない

以降の `<scratchpad>` は、このセッションの scratchpad ディレクトリに読み替えること。

## 人手が必要な箇所

**PR への動画添付だけ**（Step 6）。`gh` に user-attachments へのアップロード手段がないため、最後の貼り付けはユーザーの手作業になる。それ以外は自動で通せる。ユーザーの画面を占有しないので、作業を止めてもらう必要はない。

---

## Step 0: 環境が整っているか確認する（最初にやる）

**揃っていないまま進めると、撮影の途中で止まるか、間違った画面を撮る。** 下記を一度に確認し、欠けているものはユーザーに整え方を示す。**自分で勝手に環境を変えない**（アプリの起動、コンテナの停止、認証情報の入力はいずれもユーザーの領分）。

```bash
# 対象アプリが起動しているか（URL は対象に合わせる）
for u in http://localhost:8081 http://localhost:4100; do
  printf "%-28s " "$u"; curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 "$u" || echo "応答なし"
done
# 変換用の ffmpeg（システム側）
which ffmpeg || echo "ffmpeg なし → brew install ffmpeg"
# 録画用の ffmpeg（Playwright 内蔵）
ls -d ~/Library/Caches/ms-playwright/ffmpeg-* 2>/dev/null || echo "録画用 ffmpeg なし → pnpm dlx playwright install ffmpeg"
```

| 確認 | 欠けていたときの対処 |
|---|---|
| **`browser_run_code_unsafe` が使える** | 1 行流して確かめる。RCE 級のため無効化されている環境がある。使えないならこのスキルは成立しないのでユーザーに相談する |
| **対象アプリが起動している** | 起動コマンドを案内する（自分で起動しない。ポートやブランチの取り違えが起きる） |
| **録画用 ffmpeg**（Playwright 内蔵） | `pnpm dlx playwright install ffmpeg`。`~/Library/Caches/ms-playwright/` に入るだけでシステムには影響しない。**`dlx` は最新版を取るため、MCP が使う playwright と版が食い違うと期待するディレクトリ名（`ffmpeg-10xx`）がずれる**。その場合はエラーのパスを見て版を合わせる |
| **変換用 ffmpeg**（システム側） | `brew install ffmpeg` |
| **認証が通っている** | 後述 |
| **対象ブランチがチェックアウトされている** | 複数リポジトリにまたがる機能なら**全リポジトリ分**。`git branch --show-current` で確認する |
| **マイグレーション等が適用済み** | 未適用だと保存時にエラーになる。適用コマンドを案内する |

### 認証の確認

Playwright MCP は独立したブラウザインスタンスなので、**普段使いのブラウザのログイン状態は引き継がれない**。

```js
async (page) => {
  await page.goto('<対象URL>', { waitUntil: 'domcontentloaded' });
  return JSON.stringify({ url: page.url(), title: await page.title() });
}
```

開発環境では素通りできることもある。サインイン画面に飛ぶ場合は次の手順を踏む。

1. `page.bringToFront()` で Playwright のウィンドウを前面に出し、ログイン画面を開いておく
2. **ユーザーにログインしてもらう。** パスワードは自分で入力しない（認証情報を扱うのはこちらの役割ではない）。ユーザーが認証情報を提示して「入力していい」と言った場合も断る

**`storageState` の保存で復元できると考えないこと。** Firebase 認証のような SPA では、実セッションが IndexedDB 側にあり localStorage には短命なトークンしか入らない。書き戻してもログイン画面に落ちる。加えてトークンをファイルに落とすと、扱うたびに認証情報が露出する。

したがって **ログイン状態は「一度もらった機会を使い切る」前提で計画する**。

- ログアウトを含む項目は**必ず最後の動画の最後**に置く
- ログアウト後に撮り直しが必要になったら、ユーザーに再ログインを頼むしかない。だから**撮る前にシナリオを固め、撮り直しの芽を潰しておく**（Step 4-10 の余白のような、フレームを見るまで気づけない不具合が該当）
- 認証状態を保存したファイルを作ってしまったら、用が済み次第削除する

### 尺とタイムアウト

長時間の単一呼び出しは MCP 側のタイムアウトに当たることがある。**当たると録画したまま切られる**ので、1 本が長くなるなら分割するか、タイムアウト設定を確認する。

## Step 1: テスト項目を実装と突き合わせて最新化する

**実施の前に必ずやる。** 項目が実装から遅れていることが多く、そのまま実施すると「通ったが検証できていない」状態になる。

> **テスト項目の書き方そのものは `/crosslog:gh-pr-description` に従う。** 画面操作ベースで書く / 影響箇所を推測せず実コードで特定する / 「新機能の確認」と「デグレ確認」を分ける / デグレ確認は base ブランチの既存機能に限る / 過剰なチェックを書かない、といった規約と出力テンプレートはあちらが持っている。ここでは重複させず、**実施する側から見た観点**だけを足す。
>
> 項目がそもそも無い・薄すぎて実施できない場合は `/crosslog:test-generate-cases` で起こしてから、下記の観点で削る。

```bash
gh pr view <N> --json body -q .body > <scratchpad>/pr_body.md
git diff <base>...HEAD --stat
git log <base>..HEAD --oneline
```

差分の一つ一つに対応するテスト項目があるか確認する。**実施しようとすると気づく類の抜け**が多い:

- **コミットメッセージにあるのに項目が無い変更**（`fix: エラーメッセージを並び順で表示する` 等）。修正コミットは項目化されずに埋もれる
- **同じロジックが複数ファイルに重複している場合**（新規作成用と編集用で JS が別ファイル等）。片方だけ動く事故を検出できるよう、両方の項目を置く
- **リファクタで通り道が変わった既存機能**。「変わっていないこと」の確認だけでなく、実際に値を入れ直して往復させる項目を足す
- **「〜も弾く」と本文に書いてあるのに項目が無いサーバ側検証**
- **UI が無効化している操作を、実際にクリックして無反応であることを確かめる項目**。「薄くなる」だけの確認では disabled が効いているか分からない

### 実施順は項目順に縛られない

テスト項目は「何を確認するか」の網羅リストであって、実施手順書ではない。**最終的に全項目をカバーできれば、実施順は操作の自然な流れで決めてよい。**

- 項目順どおりだと画面を何度も往復する場合は、**操作順で実施し対応表で紐づける**
- 項目の並び自体が明らかに不自然なら PR 本文を直してもよいが、**直すことが目的ではない**
- 順序を変えても**項目は落とさない**。カバレッジが目的で、順序は手段

### 画面から確認できない項目はテスト項目から落とす

**curl での API 直叩き・SQL でのレコード確認・DevTools での属性書き換えは、テスト項目に書かない。** これらは自動テスト（rspec / jest）で担保する領域で、人が手で確認する意味がない。テスト項目は**人が画面を操作して確認できること**だけにする。

落とす前に、対応するテストが実在するか確認する。

```bash
grep -rn "it \|context " spec/requests/<対象>_spec.rb spec/models/<対象>_spec.rb
```

401 / 絞り込み条件 / 並び順 / 空配列 / 通信失敗時のフォールバックなどが網羅されていれば落として良い。**無ければ落とさず**、その事実を伝えて判断を仰ぐ（黙って落とさない）。

バックエンドの PR でも同じで、動作確認はその API を使うクライアント（アプリ・管理画面）の操作で書く。クライアントが別リポジトリなら Step 2 の方針でそちらに寄せる。

### 実施の前提を項目に書き足す

実施して初めて分かる前提は項目に書く。例:「配信先が Connect のみだと表示種別がバナーに固定されるため、保存にはバナー用設定 3 項目の入力が必要」。これが無いと実施者が必須エラーで詰まる。

最新化したら `gh pr edit <N> --body-file` で反映する。

## Step 2: 実施計画を立てる

**動画は 1 本にまとめるのが基本。** `showChapter()` で章立てできるので節ごとにファイルを分けない。

- **章 = テスト項目の節**。`showChapter('1. 配信先サービスの選択と保存', { description: '...' })`
- 分けるのは**対象データが変わって前提を作り直すとき**くらい（新機能の確認 → 既存データでのデグレ確認）。それでも 2 本まで
- 尺の目安は 1 本 90 秒以内。**ただし 1 回の tool 呼び出しが長時間になるとタイムアウトの危険がある**（Step 0）

計画とカバー対応表をユーザーに示してから実施に入る。対応表は Step 6 でそのまま使う。

### 「出ないこと」は、出ない条件を作った画面から撮る

**否定形の確認（表示されない / 含まれない / 変わらない）は、前提を作った操作を同じ動画に入れないとエビデンスにならない。** 見る人には「条件を満たしたのに出なかった」のか「そもそもデータが無かった」のかが区別できない。

- 「配信先を A のみにしたから B には出ない」→ **設定画面で配信先を見せてから** B の画面を映す
- 「1 件も無い状態で崩れない」→ **無くす操作（非公開にする等）を録画の中で行う**。裏で消してから撮ると、消えた理由が追えない
- 「移行して値が入った」→ **移行後のレコードを画面で開いて見せる**

前提を作る操作を「準備」と見て録画の外に出すと、この穴が空く。**否定形の項目があるなら、章立ての最初に「前提の提示」章を置く**。

**前提の提示とテストは、章タイトルのラベルで区別する。** 混ざっていると、見る人がどこからが確認対象なのか分からない。

```js
await page.screencast.showChapter('【事前確認】配信先サービスの設定', {
  description: 'CrossLog / Connect のどちらに配信しているかを、登録内容で確認する',
  duration: 3000,
});
// 設定画面を開いて、条件そのものを画面に映してから検証する

await page.screencast.showChapter('【テスト】CrossLog のお知らせバナー', { /* ... */ });
```

**テスト項目そのものを設定画面で示す場合は `【テスト】` に入れる。** 例えば「データ移行で既存レコードに値が入ったか」は、確認場所が設定画面でも前提ではなくテスト対象。**確認場所ではなく、テスト項目かどうかで振り分ける。**

同時に、**その条件をコードでも読む**（チェックボックスの `checked` を検証する等）。映像は「そう見える」証拠、検証は「実際にそうだった」証拠で、否定形の項目では両方が要る。

### 元に戻せない操作は、撮り直しが効かないと考えて配置する

既読化・使い切りのトークン消費・一方向のステータス遷移などは、一度実行すると同じ前提を作り直せない。**そういう項目はシナリオの最後に置く**。前半でロケータを間違えて落ちても、後半に到達していなければ前提は消費されない。

- 消費してしまったら、前提を作り直す手段（新しいデータを登録する等）とその副作用（テストデータが増える）をユーザーに伝えて判断を仰ぐ
- ログアウトも同種（Step 0 の認証）。**ログアウトは全シナリオの最後の最後**に置く

### 複数リポジトリにまたがる機能は、末端の画面でまとめて実施する

1 つの機能が複数の PR に分かれている場合（DB・API・バックエンド・表示 UI など）、**画面を持たない層を個別にテストしない**。ユーザーが実際に見る末端の画面で通しで確認すれば、その経路上の層が動いていることが同時に示せる。

- **実施と動画は末端の PR（表示 UI 側）に置く。** 他の PR は「<末端の PR> でまとめて確認」と URL を書くだけでよい。項目を再掲しない（同じ内容が二重管理になる）
- **別の画面を持つ層は、その画面で個別に撮る。** 例えば同じデータを 2 つのサービスが読む場合、片方の PR は自分側の画面のデータ確認を持つ
- 参照される側の PR に個別項目を残すのは、**画面で確認できるもの**に限る。curl での API 直叩き・SQL でのレコード確認は書かない（Step 1 参照）
- **「経路が通った」ことと「その層のロジックが網羅された」ことは別物。** 末端の画面で確認できるのは前者。後者は自動テストの領域

前提として、**全リポジトリのブランチが揃っていないと通しで動かない**。実施前に各リポジトリのブランチと、マイグレーション等の適用状態を確認する。

### 尺を削る（手順は削らない）

- **検証対象でない項目の入力は `fill()` でまとめる。** タイトルやカテゴリを 1 文字ずつ打つ様子に価値はない
- **入力そのものが検証対象なら `pressSequentially(text, { delay: 60 })`**。打っている過程が見える
- **同じ確認を 2 回しない**

## Step 3: テストデータを整える

新規にデータを作るなら `/crosslog:test-seed-data`（crosslog-back / crosslog-front 向け、非破壊）を使う。ここで扱うのは**実施の邪魔になる既存データの見極め**。

**既存データと過去の検証データを取り違えない。** `created_at` を見て判別する。連番が飛んでいるだけでは判断材料にならない。

```sql
SELECT id, title, <対象カラム>, created_at, updated_at FROM <table> ORDER BY id DESC LIMIT 6\G
```

過去の検証データは**現在の実装では作れない不正な組み合わせ**を持つことがある（仕様変更前に作られたため）。使うと結果が食い違うので消してから始める。削除はユーザーの許可を取る。**予行で作ったデータも本番前に消す。**

## Step 4: シナリオを書いて実施＋録画

### 4-1. スクリプトはファイルに書く

`browser_run_code_unsafe` の **`filename` パラメータ**でファイルを渡す（`code` に直接書かない）。撮り直しのたびに編集して同じ呼び出しを繰り返せる。日本語もエスケープ不要。

**`filename` は許可ルート内に限られる**（プロジェクトルートと `<repo>/.playwright-mcp/`）。scratchpad は使えない。`.playwright-mcp/` は gitignore されていないことがあるので、`git check-ignore` で確認し、必要なら `.git/info/exclude` に足す（リポジトリの `.gitignore` は勝手に変えない）。

実行環境は**サンドボックス**で、`require` / `process` / `expect` / `URL` などは使えない。使えるのは渡された `page` と標準的な JS 構文のみ。

### 4-2. 骨格

```js
async (page) => {
  const out = '<出力先>/evidence.webm';
  const passed = [];

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('<URL>', { waitUntil: 'domcontentloaded' });

  await page.screencast.start({ path: out, size: { width: 1280, height: 800 } });
  try {
    await page.screencast.showActions();   // カーソル・操作対象・アクション名を描く

    // showChapter は duration の間ブロックして自動で消える。後ろに待ちを入れない
    await page.screencast.showChapter('1. 配信先サービスの選択と保存', {
      description: '未選択で弾かれること、選択が保存されることを確認します',
      duration: 2000,
    });

    const crosslog = page.getByRole('checkbox', { name: 'CrossLog' });
    await crosslog.check();

    // 状態の合流は必ず waitFor で取る（後述）
    const fields = page.locator('[data-...-target="crosslogFields"]');
    await fields.waitFor({ state: 'visible', timeout: 5000 });
    passed.push('CrossLog を選ぶと専用項目が出る');

    await page.waitForTimeout(700);   // ここは「読ませるための演出」

    return JSON.stringify({ passed });
  } finally {
    // 失敗しても必ず flush する。これが無いと動画が壊れ、次回 "already started" になる
    await page.screencast.stop();
  }
}
```

### 4-3. 状態の合流は `waitFor` で取る（最重要）

**`isVisible()` / `isChecked()` / `isDisabled()` は即座に返り、状態変化を待たない。** 公式も `expect(await locator.isVisible()).toBe(true)` を「手動アサーションのアンチパターン」として挙げている。Turbo / Stimulus の部分更新はクリックの戻りと非同期なので、即時読み取りは構造的にレースする。

この環境では `expect` が使えないが、**`locator.waitFor()` と `locator.waitForFunction()` が使える**。これで auto-waiting 相当になる。

```js
await fields.waitFor({ state: 'visible', timeout: 5000 });          // 表示されるまで待つ
await fields.waitFor({ state: 'hidden',  timeout: 5000 });          // 消えるまで待つ
await radio.waitForFunction(el => el.disabled, undefined, { timeout: 5000 });  // 属性が変わるまで待つ
// 件数が変わるのを待つ（count() で読む前に必ず合流させる）
await page.waitForFunction(() => document.querySelectorAll('[name="ids[]"]:checked').length > 0, null, { timeout: 5000 });
```

条件が満たされなければタイムアウトで例外になり、`finally` を通って止まる。**これが正しい失敗の仕方**。

**one-shot read（retry しない API）を一覧で押さえておく:**

| API | 挙動 |
|---|---|
| `locator.waitFor()` / `waitForFunction()` / `page.waitForFunction()` | 条件が満たされるまで待つ。**合流にはこれを使う** |
| `isVisible()` / `isChecked()` / `isDisabled()` / `count()` / `textContent()` / `inputValue()` | **一度読むだけで retry しない。flaky の温床** |

**`count()` も one-shot** なのを忘れやすい。「クリック → 少し待つ → `count()` で件数を確認」は、待ちを詰めた瞬間に壊れる。

**`waitForTimeout` を合流手段に使わない。** 演出専用と割り切る。演出用の sleep が同期を兼ねていると、ペーシングを詰めた瞬間に flaky 化する。

即時判定を使ってよいのは、**`waitFor` で合流した後のスナップショット確認**だけ。

### レイアウトを自分で測るときは隠し要素を除く

行数や位置を `getBoundingClientRect` で測ることがあるが、**UI には測定用・アニメーション用の不可視要素が仕込まれていることがある**。素朴に探すと、それを拾って誤った値を得る。実際に「本文が 3 行までのはずが 5 行」と誤検出し、実装のバグかと疑った（原因は `opacity: 0` の測定用テキストだった）。

```js
const visible = (e) => {
  const cs = getComputedStyle(e);
  if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
  return !e.closest('[aria-hidden="true"]');
};
// テキストを直接持つ要素を探す（子要素にリンク等が埋まっていても親を拾える）
const hasOwnText = (e, s) => [...e.childNodes].some(c => c.nodeType === 3 && (c.textContent || '').includes(s));
```

`children.length === 0` で絞るのも罠。**インラインのリンクが本文の子要素として埋め込まれている場合に本文が見つからなくなる**。上記の `hasOwnText` のようにテキストノードの有無で判断する。

`innerText` も不可視要素を含むことがあるので、「2 回出ている」ように見えても二重描画とは限らない。疑う前に要素ごとの `opacity` / `position` を確認する。

### 4-4. ページ遷移の待ち方

- **フル遷移**: `page.waitForURL('**/notifications', { timeout: 8000 })`
- **Turbo の部分更新（Streams / frame）**: URL も load state も変わらないので、**結果の DOM を `locator.waitFor()` で待つ**
- **`waitForLoadState` は Turbo Drive では使えない。** body 差し替えなので `load` が再発火せず、即座に resolve して「待ったつもり」になる

録画・`showActions`・オーバーレイは**ページ遷移をまたいでも継続する**（実測確認済み）。

### 4-5. ロケータはユーザーに見える名前で

**`getByRole` / `getByLabel` を優先する。** 公式の推奨であるだけでなく、**エビデンスとして意味が違う**。`getByRole('checkbox', { name: 'CrossLog' })` で到達できたということは、ユーザーに見えている名前でその要素に辿り着けたこと自体の検証になる。`[name="target_services[]"]` で押すと、ラベルの付け間違いやラベル消失があっても全項目 PASS してしまう。

優先順位は `getByRole` → `getByLabel` / `getByText` → `getByTestId` → CSS セレクタ（最後の手段）。`[name=][value=]` に落とすのは、**同一 name で value 違いのラジオ / チェックボックス群など role+name で特定しきれない場合だけ**。

チェックボックス・ラジオは `check()` / `uncheck()` を使う（操作後に checked になったことまで自動で検証される）。

**同じ名前の要素が複数あるときは `filter()` で絞る。** 一覧に同名のレコードが並ぶと `strict mode violation` になる。`.first()` で回避すると「たまたま 1 件目」を押すだけなので、狙った行を指定する:

```js
// 行を絞ってから、その中の要素を掴む
const row = page.getByRole('row').filter({ hasText: '配信先サービスの動作確認' });
await row.getByRole('link').click();
```

なお `strict mode violation` は**曖昧な指定を Playwright が検出してくれた**ということ。潰す前に「なぜ複数あるのか」を確認する（前回の失敗実行のデータが残っている、等）。

### 4-6. actionability を迂回しない

以下は**実ユーザーには押せない要素でも成功してしまい、エビデンスが偽陽性になる**ので使わない。

- `locator.evaluate(el => el.click())` / `dispatchEvent()` — 合成イベントでヒットテストを飛ばす
- `click({ force: true })` — visible / stable / receives events の検査を明示的に飛ばす

`locator.click()` はこれらの検査を通るので、「実際に操作できた」証拠になる。

**無効化されている操作は、実際にクリックして変化しないことまで確かめる。** `isDisabled()` が true でも、属性が付いているだけで JS 側が動く実装があり得る。

### 4-7. スクロールを滑らかにする

**Playwright はクリック前に要素まで自動スクロールするが、これが一瞬で飛ぶ**（実測 18ms）。動画では画面が突然切り替わったように見えて追えない。

`html { scroll-behavior: smooth }` を注入しても**効かない**。自動スクロールは CDP 経由で、CSS のスクロール挙動を経由しないため。

ビューポート外の要素を操作するときは、**明示的にスムーススクロールしてから click する**（実測 904ms かけてアニメーションする）。

```js
// 画面外のときだけ滑らかに寄せる。scrollIntoView はページ側で走らせる
const scrollTo = async (locator) => {
  const scrolled = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= window.innerHeight;
    if (!inView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !inView;
  });
  if (scrolled) await page.waitForTimeout(700);   // アニメーションの完了を待つ
};
const smoothClick = async (loc, opts) => { await scrollTo(loc); await loc.click(opts); };
const smoothCheck = async (loc) => { await scrollTo(loc); await loc.check(); };
```

保存ボタンなどページ下部の要素で効く。既に見えている要素では余計な待ちが入らない。

待機に **`setTimeout` は使えない**（サンドボックスに存在しない）。`page.waitForTimeout` を使う。チェックボックスは `click()` ではなく `check()` を通したいので、ヘルパーは分けておく。

### 4-8. スマホ表示は「幅を狭める」だけでは足りないことがある

`setViewportSize` で幅を変えても `navigator.userAgent` は変わらない。**UA を見て出し分けている要素（アプリ誘導バナー、ストア誘導、モバイル専用の案内）は出てこない。** CDP で UA を上書きする。

```js
const cdp = await page.context().newCDPSession(page);
const { userAgent: realUA } = await cdp.send('Browser.getVersion');   // 上書き前に本来の UA を確保する
await cdp.send('Network.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
});
// ... モバイル前提の確認 ...
await cdp.send('Network.setUserAgentOverride', { userAgent: realUA });   // 明示的に戻す
```

**`userAgent: ''` では戻らない。`cdp.detach()` でも戻らない。** 上書きはブラウザ側に残り続け、**次のシナリオ・次の撮影まで汚染する**。実際に、UA を戻せていない状態で PC 表示の動画を撮ってしまい（PC 幅なのにアプリ誘導バナーが写り込む）、撮り直しになった。`Browser.getVersion` は override の影響を受けないので、ここから取った値を設定し直すのが唯一確実。

**「出ないから未確認」で片付ける前に、表示条件を実装で確かめる。** 幅なのか UA なのか特定できれば再現できることが多い。

### 4-9. 録画を始める前に前提を検証する

前のシナリオが残した状態（UA 上書き、閉じた記録などの localStorage、絞り込み条件、ログイン状態）は、**そのまま次の撮影に持ち込まれる**。スクリプトは自分が設定した前提だけを見て動くので、汚染に気づかず「正しく見える動画」を撮ってしまう。

録画開始前に、そのシナリオが依存する前提をコードで確かめ、違っていたら**撮る前に止める**。

```js
const pre = await page.evaluate(() => ({ ua: navigator.userAgent, closed: localStorage.getItem('<閉じた記録のキー>') }));
if (/Mobile|Android|iPhone/.test(pre.ua)) throw new Error(`FAILED: UA が上書きされたまま / ${pre.ua}`);
if (pre.closed) await page.evaluate(() => localStorage.removeItem('<閉じた記録のキー>'));
```

止めれば数十秒の損失で済む。撮ってから気づくと、ログアウトを含むシナリオでは**再ログインを頼むところまで巻き戻る**。

### 4-10. 新規タブは別録画にする。閉じたあとビューポートを再適用する

`page.screencast` はその page だけを録る。`target="_blank"` のリンクを踏むと以降が元タブの録画に写らないので、**popup を掴んで別セグメントとして録り、あとで連結する**（同じ `size` で撮れば `concat` でつながる）。

```js
const [popup] = await Promise.all([
  page.context().waitForEvent('page', { timeout: 8000 }),
  page.getByRole('link', { name: '詳細を見る' }).first().click(),
]);
await popup.setViewportSize(SIZE);
await popup.screencast.start({ path: OUT_B, size: SIZE });
try { /* 新規タブ側の確認 */ } finally { await popup.screencast.stop(); }
await popup.close();
await page.bringToFront();

// ここが必要。popup を開閉すると元ページの録画サーフェスが縮んだまま残り、
// 以降のフレームが小さく描画されて右下にグレー余白が入る
await page.setViewportSize({ width: SIZE.width, height: SIZE.height - 1 });
await page.setViewportSize(SIZE);
```

**同じ値を再設定しても効かない**（no-op になる）。必ず一度別の値を通す。

この縮小は `window.innerWidth` では検出できない（JS からは元のサイズに見える）ため、**録画したフレームを見るまで気づけない**。新規タブを開閉したシナリオは、納品前にフレームを抜いて確認する。

```bash
ffmpeg -y -ss <秒> -i out.mp4 -frames:v 1 chk.png   # 余白が入っていないか目視
```

### 4-11. ダイアログ

Playwright はネイティブの `confirm` / `alert` を**デフォルトで自動 dismiss** する。削除確認のようなフローは「キャンセルを押した」扱いで静かに流れるので、扱うなら明示する。

```js
page.on('dialog', d => d.accept());
```

### 4-12. 注釈で補う

`showActions()` に加えて、任意の説明を重ねられる。オーバーレイは `pointer-events: none` なので操作を妨げない。

```js
// duration を省くと sticky。dispose() まで出したままにできる
const note = await page.screencast.showOverlay(
  '<div style="position:absolute;top:12px;right:12px;padding:6px 12px;background:rgba(0,0,0,.75);color:#fff;border-radius:8px">対象事業所なしでも保存できる</div>'
);
await note.dispose();

// 要素を名指しでハイライトしたいとき
const box = await page.getByRole('button', { name: '作成' }).boundingBox();
await page.screencast.showOverlay(
  `<div style="position:absolute;top:${box.y}px;left:${box.x}px;width:${box.width}px;height:${box.height}px;border:2px solid red"></div>`,
  { duration: 1500 }
);
```

### 4-13. 途中でスクリーンショットを挟まない

動画に写り込む上に往復も増える。戻り値（`passed` 配列）で足りることがほとんど。確認したいなら録画前に予行として通す。

## Step 5: 納品

録画の出力は VP8 の `.webm`（実測で 25fps CFR。公式はフレームレートを規定していないので版が変われば変わり得る）。**webm は中間ファイルとして扱い、納品するのは mp4 だけにする。** webm は QuickTime で開けず、二重に置くと取り違えるため、変換したら残さない。

**`~/Downloads/` に置き、ファイル名に撮影時刻を入れる。** 撮り直しても名前が同じだと、ユーザー側から見て更新されたのか分からない（Finder の更新日時を確認させることになる）。

```bash
TS=$(date +%Y%m%d-%H%M)
ffmpeg -y -i <出力>/evidence.webm \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart \
  ~/Downloads/pr<番号>-<連番>-<内容>-$TS.mp4
```

撮り直したら**古いファイルは消す**（PR に貼る際に取り違える）。**PR 本文のプレースホルダには時刻を含めない名前を書く**（Step 6）。撮り直すたびに本文を書き換える手間を持ち込まないため。

**納品前に必ず中身を目視確認する。**

```bash
ffmpeg -y -i ~/Downloads/<name>.mp4 \
  -vf "select='eq(n\,20)+eq(n\,150)+eq(n\,300)',tile=1x3" -vsync 0 -frames:v 1 <scratchpad>/check.png
```

参考値: 1280×800 で 5 秒 ≒ 110KB、7 秒 ≒ 180KB。

## Step 6: PR に反映する

実施したチェックボックスを埋め、動画を対応づける。実施順が項目順と違っていても、**全項目にチェックが付く**ことを確認する。

**`gh` CLI では PR 本文に動画を添付できない。** 本文には動画の位置にプレースホルダを置き、ブラウザで PR 編集画面に D&D してもらって `https://github.com/user-attachments/assets/...` の URL に差し替えてもらう。

**プレースホルダは各節の末尾に置く**（チェックリストの後）。先頭に置くと、読み手が項目を読む前に動画にぶつかる。ファイル名を書いておくと D&D 先を間違えない。

**プレースホルダのファイル名からは時刻を落とす**（`pr466-1-banner-display.mp4`）。実ファイルには時刻が付く（Step 5）が、本文に書くのは時刻なしの名前にしておく。撮り直しのたびに本文を編集する作業が増えるだけで、D&D 先を特定するには連番と内容で足りる。

```markdown
### 1. <節のタイトル>

- [x] <項目> → <期待結果>
- [x] <項目> → <期待結果>

<!-- ▼▼ ここに pr153-1-selection-and-save.mp4 をドラッグ&ドロップ ▼▼ -->
```

- 実施できなかった項目は**チェックを付けずに理由を書く**。黙って通さない
- 実装の問題が見つかったらチェックを付けずに報告する。エビデンスを作ることが目的化しないこと

---

## 付録: screencast API

| メソッド | 備考 |
|---|---|
| `start({path, size, quality, onFrame})` | `path` を渡すとファイルに保存。他の録画設定が有効だと `size` が効かないことがある |
| `stop()` | **ファイルはここで書き出される。** 必ず `finally` で呼ぶ |
| `showActions({duration, position, fontSize, cursor})` | カーソル・操作対象のハイライト・アクション名を描く。`position` は `top-left` / `top` / `top-right` / `bottom-*` |
| `hideActions()` | 上を止める |
| `showChapter(title, {description, duration, styleSheet})` | 背景をぼかして章タイトルを表示。**`duration` の間ブロックし自動で消える**（既定 2000ms。実測で 1500 指定 → 約 1.8 秒ブロック）。後ろに待ちを足さない |
| `showOverlay(html, {duration})` | `duration` 省略で sticky、戻り値の `dispose()` で解除。`pointer-events: none` |
| `showOverlays()` / `hideOverlays()` | オーバーレイの表示切替 |

## 付録: ハマりどころ

| 症状 | 原因 | 対処 |
|---|---|---|
| `Executable doesn't exist at .../ffmpeg-*` | 内蔵 ffmpeg 未取得、または版の不一致 | Step 0 |
| `Screencast is already started` | 前回 `stop()` に到達せず終了した | **`finally` で `stop()`**（Step 4-2）。それでも残るなら `browser_close` でブラウザごと作り直す。`page.screencast._started = false` の直叩きは内部実装依存の最終手段 |
| `File access denied: ... outside allowed roots` | `filename` が許可ルート外 | `<repo>/.playwright-mcp/` に置く（Step 4-1） |
| `require is not defined` / `URL is not defined` | サンドボックスで標準グローバルが限定的 | `page` と素の JS だけで書く |
| 検証が不安定・たまに落ちる | 即時判定でレースしている | `waitFor` で合流する（Step 4-3） |
| 遷移を待ったつもりが待てていない | Turbo は `load` を再発火しない | `waitForURL` か結果の DOM を待つ（Step 4-4） |
| 章の冒頭の操作が動画に写らない | `showChapter` の duration より短く待って次に進んだ | duration と待ちを一致させる。そもそも後ろに待ちは不要 |
| 削除確認などが素通りする | ネイティブダイアログが自動 dismiss される | `page.on('dialog', ...)`（Step 4-11） |
| 新規タブを開くと以降が撮れない | `page.screencast` はその page だけを録る | popup を別セグメントで録って連結する（Step 4-10） |
| 画面が縮んで右下にグレー余白が入る | 新規タブを開閉したあと元ページの録画サーフェスが縮んだまま残る | 録画開始前にビューポートを再適用する（Step 4-10）。`innerWidth` では検出できないのでフレームで確認する |
| 録画したまま途中で切られた | 単一 tool 呼び出しが MCP のタイムアウトを超えた | シナリオを分割する（Step 0） |
| サインイン画面に飛ぶ | Playwright は独立インスタンスで認証が別 | Step 0。保存した `storageState` の書き戻しでは戻らない（Firebase 等は IndexedDB 側にセッションがある） |
| QuickTime で開けない | 出力が webm | mp4 に変換して添える（Step 5） |

## 付録: ブラウザ以外を録画したい場合

このスキルは Playwright で到達できる画面（＝ブラウザ）専用。ネイティブアプリ・シミュレータ・ターミナルを撮る必要が出たら、ScreenCaptureKit で任意のウィンドウを録画する方法がある（macOS 14+ / `SCContentFilter(desktopIndependentWindow:)` を使えば他アプリが映り込まない）。ただし可変フレームレートになり、外部プロセスで撮るぶんツール往復が空白として尺に入るため、後処理が必要になる。ブラウザで済むなら選ばない。
