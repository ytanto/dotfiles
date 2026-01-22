---
description: Playwright MCPを使ってテストケースを実行
argument-hint: [テストケースファイル または テスト対象URL]
---

# Playwright MCPテスト実行

Playwright MCPを使用して、指定されたテストケース「$ARGUMENTS」のテストを実行します。

## コンテキスト圧迫を避けるための重要なルール

### 1. `browser_run_code` を優先使用する
- 個別のツール呼び出し（`browser_click`, `browser_type`など）は **使用しない**
- 複数の操作は `browser_run_code` でまとめて実行する
- これにより、ツール呼び出し回数を大幅に削減できる

### 2. `browser_snapshot` の使用を最小限に
- スナップショットは必要な時のみ取得する
- ページ遷移後やエラー発生時のデバッグ用途に限定する
- 連続したテストでは、最初と最後のみスナップショットを取る

### 3. バッチテストの実行
- 関連するテストケースはまとめて1つの `browser_run_code` で実行する
- 結果はJavaScript内で配列にまとめて返す

## テスト実行パターン

### 基本パターン: browser_run_code でバッチ実行

```javascript
async (page) => {
  const results = [];

  // テスト1
  try {
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForSelector('.success-message');
    results.push({ id: 'TC-001', status: 'PASS' });
  } catch (e) {
    results.push({ id: 'TC-001', status: 'FAIL', error: e.message });
  }

  // テスト2
  try {
    // ... テストコード
    results.push({ id: 'TC-002', status: 'PASS' });
  } catch (e) {
    results.push({ id: 'TC-002', status: 'FAIL', error: e.message });
  }

  return results;
}
```

### セレクタのベストプラクティス

| 推奨 | 非推奨 |
|------|--------|
| `getByRole('button', { name: 'Submit' })` | `locator('button.submit')` |
| `getByRole('cell', { name: '+' })` | `locator('td:has-text("+")')` |
| `getByRole('button', { name: '2', exact: true })` | `getByText('2')` |
| `locator('.class').first()` | `locator('.class')` (複数マッチの場合) |

### 複数要素マッチへの対処

```javascript
// ❌ 複数要素にマッチする可能性
await page.getByText('2026年1月').click();

// ✅ 最初の要素を明示的に選択
await page.getByText('2026年1月').first().click();

// ✅ より具体的なセレクタを使用
await page.getByRole('button', { name: '2', exact: true }).click();
```

### キーボード操作

```javascript
// キー入力
await page.keyboard.press('ArrowRight');
await page.keyboard.press('1');

// 修飾キー付き
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
await page.keyboard.press('Control+z');

// Shift + 矢印（範囲選択）
await page.keyboard.press('Shift+ArrowRight');
```

### モーダル/ダイアログ対処

```javascript
// モーダルが表示される可能性がある場合
const modal = await page.locator('.modal').isVisible();
if (modal) {
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await page.waitForSelector('.modal', { state: 'hidden' });
}
```

## テスト実行フロー

1. **ブラウザでページを開く**: `browser_navigate` で対象URLに移動
2. **ログイン（必要な場合）**: `browser_run_code` でログイン処理
3. **スナップショット取得**: `browser_snapshot` で初期状態確認
4. **バッチテスト実行**: `browser_run_code` で複数テストをまとめて実行
5. **結果レポート**: テスト結果をマークダウン表形式で報告

## コンソールエラー確認

テスト完了後、`browser_console_messages` でエラーを確認する：

```
mcp__plugin_playwright_playwright__browser_console_messages
level: "error"
```

- warning レベルは開発時の既知の警告が多いため、error に絞る
- テスト対象機能に関連するエラーのみ報告する

## 出力形式

テスト結果は以下の形式で報告：

```markdown
## テスト結果サマリー

| カテゴリ | テストID | 結果 |
|---------|---------|------|
| 〇〇機能 | ID 1-5 | ✅ PASS |
| △△機能 | ID 6-10 | ✅ PASS |

**全N件: ✅ ALL PASS** または **N件中M件失敗**

## コンソールエラー
- エラー: なし / あり（詳細）
```

## 注意事項

- **chrome-devtools MCP は使用しない**: コンテキストを大量消費するため
- **スクリーンショットは最小限**: `browser_take_screenshot` も必要時のみ
- **エラー時のみ詳細調査**: 成功したテストの詳細は報告不要
- **テストケースファイル（TSV）がある場合**: それを読んでテスト内容を把握する
