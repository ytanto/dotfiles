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

### 画面から確認できない項目は動画にしない

DevTools で属性を書き換える、API を直接叩く、といった画面操作を迂回する検証はエビデンス動画に向かない。**自動テストで担保する領域**なので外してテストコード側に寄せる。ただし**テストコードが実際に動く状態か確認してから**外すこと。書けないなら、その事実を伝えて判断を仰ぐ（黙って落とさない）。

### 実施の前提を項目に書き足す

実施して初めて分かる前提は項目に書く。例:「配信先が Connect のみだと表示種別がバナーに固定されるため、保存にはバナー用設定 3 項目の入力が必要」。これが無いと実施者が必須エラーで詰まる。

最新化したら `gh pr edit <N> --body-file` で反映する。

## Step 2: 実施計画を立てる

**動画は 1 本にまとめるのが基本。** `showChapter()` で章立てできるので節ごとにファイルを分けない。

- **章 = テスト項目の節**。`showChapter('1. 配信先サービスの選択と保存', { description: '...' })`
- 分けるのは**対象データが変わって前提を作り直すとき**くらい（新機能の確認 → 既存データでのデグレ確認）。それでも 2 本まで
- 尺の目安は 1 本 90 秒以内。**ただし 1 回の tool 呼び出しが長時間になるとタイムアウトの危険がある**（Step 3-1）

計画とカバー対応表をユーザーに示してから実施に入る。対応表は Step 6 でそのまま使う。

### 尺を削る（手順は削らない）

- **検証対象でない項目の入力は `fill()` でまとめる。** タイトルやカテゴリを 1 文字ずつ打つ様子に価値はない
- **入力そのものが検証対象なら `pressSequentially(text, { delay: 60 })`**。打っている過程が見える
- **同じ確認を 2 回しない**

## Step 3: 準備

### 3-1. 前提ツールを確認する

`browser_run_code_unsafe` は RCE 級のため無効化されている環境がある。1 行流して確認する。使えなければユーザーに相談する（このスキルは成立しない）。

長時間の単一呼び出しは MCP 側のタイムアウトに当たることがある。**当たると録画したまま切られる**ので、1 本が長くなるなら分割するか、タイムアウト設定を確認する。

### 3-2. 録画に必要なバイナリ

Playwright 内蔵の ffmpeg が要る。無いと `screencast.start` が `Executable doesn't exist at .../ffmpeg-*` で落ちる。

```bash
pnpm dlx playwright install ffmpeg
```

`~/Library/Caches/ms-playwright/` に入るだけでシステムの ffmpeg には影響しない。**`dlx` は最新版を取るため、MCP が使う playwright と版が食い違うと期待するディレクトリ名（`ffmpeg-10xx`）がずれて解決しないことがある。** その場合はエラーメッセージのパスを見て版を合わせる。

### 3-3. 認証状態を確認する

Playwright MCP は独立したブラウザインスタンスなので、**ログインが必要なアプリでは認証が通っているか先に確かめる**。

```js
async (page) => {
  await page.goto('<対象URL>', { waitUntil: 'domcontentloaded' });
  return JSON.stringify({ url: page.url(), title: await page.title() });
}
```

開発環境では素通りできることが多い。サインイン画面に飛ぶ場合は、一度ログインして `storageState` を保存しておけば以降のセッションで使い回せる。

```js
// ログイン後に実行して認証状態を保存する
await page.context().storageState({ path: '<repo>/.playwright-mcp/auth.json' });
```

パスワードの入力が要るなら**自分で入力せずユーザーに依頼する**。認証情報を扱うのはこちらの役割ではない。

### 3-4. テストデータを整える

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

### 4-8. ダイアログ

Playwright はネイティブの `confirm` / `alert` を**デフォルトで自動 dismiss** する。削除確認のようなフローは「キャンセルを押した」扱いで静かに流れるので、扱うなら明示する。

```js
page.on('dialog', d => d.accept());
```

### 4-9. 注釈で補う

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

### 4-10. 途中でスクリーンショットを挟まない

動画に写り込む上に往復も増える。戻り値（`passed` 配列）で足りることがほとんど。確認したいなら録画前に予行として通す。

## Step 5: 納品

出力は VP8 の `.webm`（実測で 25fps CFR。公式はフレームレートを規定していないので版が変われば変わり得る）。GitHub でも Chrome でも再生できるが、QuickTime で開けないので mp4 も添えると親切。

```bash
ffmpeg -y -i <出力>/evidence.webm \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart \
  ~/Downloads/<pr番号>-<内容>-<日付>.mp4
```

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
| `Executable doesn't exist at .../ffmpeg-*` | 内蔵 ffmpeg 未取得、または版の不一致 | Step 3-2 |
| `Screencast is already started` | 前回 `stop()` に到達せず終了した | **`finally` で `stop()`**（Step 4-2）。それでも残るなら `browser_close` でブラウザごと作り直す。`page.screencast._started = false` の直叩きは内部実装依存の最終手段 |
| `File access denied: ... outside allowed roots` | `filename` が許可ルート外 | `<repo>/.playwright-mcp/` に置く（Step 4-1） |
| `require is not defined` / `URL is not defined` | サンドボックスで標準グローバルが限定的 | `page` と素の JS だけで書く |
| 検証が不安定・たまに落ちる | 即時判定でレースしている | `waitFor` で合流する（Step 4-3） |
| 遷移を待ったつもりが待てていない | Turbo は `load` を再発火しない | `waitForURL` か結果の DOM を待つ（Step 4-4） |
| 章の冒頭の操作が動画に写らない | `showChapter` の duration より短く待って次に進んだ | duration と待ちを一致させる。そもそも後ろに待ちは不要 |
| 削除確認などが素通りする | ネイティブダイアログが自動 dismiss される | `page.on('dialog', ...)`（Step 4-7） |
| 新規タブを開くと以降が撮れない | `page.screencast` はその page だけを録る | 同一タブで完結させる。無理なら計画段階でその項目を外す |
| 録画したまま途中で切られた | 単一 tool 呼び出しが MCP のタイムアウトを超えた | シナリオを分割する（Step 3-1） |
| サインイン画面に飛ぶ | Playwright は独立インスタンスで認証が別 | Step 3-3 |
| QuickTime で開けない | 出力が webm | mp4 に変換して添える（Step 5） |

## 付録: ブラウザ以外を録画したい場合

このスキルは Playwright で到達できる画面（＝ブラウザ）専用。ネイティブアプリ・シミュレータ・ターミナルを撮る必要が出たら、ScreenCaptureKit で任意のウィンドウを録画する方法がある（macOS 14+ / `SCContentFilter(desktopIndependentWindow:)` を使えば他アプリが映り込まない）。ただし可変フレームレートになり、外部プロセスで撮るぶんツール往復が空白として尺に入るため、後処理が必要になる。ブラウザで済むなら選ばない。
