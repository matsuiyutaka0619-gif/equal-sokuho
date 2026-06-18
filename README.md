# イコール速報！

=LOVE（イコールラブ）、≠ME（ノットイコールミー）、≒JOY（ニアリーイコールジョイ）、指原莉乃のニュースをRSS中心に集める静的ニュースまとめサイトです。記事本文は転載せず、見出し・出典・公開日・分類・元記事リンクを表示します。

## 特徴

- X API、有料API、AI要約は使いません。
- HTML / CSS / JavaScript / JSON / Node.js だけで動きます。
- Cloudflare Pagesで無料公開しやすい構成です。
- GitHub ActionsでRSSを自動更新できます。
- 手動更新もできます。
- AdSense申請用に privacy / contact / about / ads.txt / robots.txt / sitemap.xml を用意しています。

## フォルダ構成

```
config/              サイト設定、カテゴリ、広告、運営者情報
data/                RSSソース、キーワード、メンバー辞書、記事JSON
scripts/update-feeds.mjs  RSS取得スクリプト
.github/workflows/   GitHub Actions
assets/              favicon / OGP画像
today/ weekly/ categories/ members/ links/  各ページ
privacy/ contact/ about/  AdSense申請向け固定ページ
```

## ローカル確認方法

Macのターミナルでこのフォルダに移動します。

```bash
cd ~/Documents/イコール速報！
python3 -m http.server 8000
```

ブラウザで開きます。

```
http://localhost:8000/
```

## RSS更新方法

手元で記事JSONを更新する場合:

```bash
cd ~/Documents/イコール速報！
node scripts/update-feeds.mjs
```

通常のMacで `node` が見つからない場合は、Node.jsをインストールしてください。

## GitHub Actionsで手動更新

GitHubにアップロード後、以下で手動更新できます。

1. GitHubでリポジトリを開く
2. Actions を開く
3. Update RSS feeds を選ぶ
4. Run workflow を押す
5. branch が main になっていることを確認
6. Run workflow を押す

GitHub Actionsの定期実行は時間がずれることがあります。急ぎのときは手動更新を使ってください。

## RSSソース追加方法

`data/rss-sources.json` に追加します。

```json
{
  "id": "sample-feed",
  "name": "サンプルRSS",
  "url": "https://example.com/feed",
  "enabled": true,
  "type": "rss",
  "notes": "対象キーワードで抽出"
}
```

不安なRSSや動かないRSSは `enabled: false` にして notes に理由を書いてください。

## キーワード追加方法

`data/keywords.json` の `include` に追加します。除外したい語句は `exclude` に追加します。

## メンバー追加・変更方法

`data/members.json` を編集します。名前・別表記・所属グループ・ステータスをJSONで管理しています。

## Cloudflare Pages公開方法

1. GitHubにこのフォルダをアップロード
2. Cloudflare Pagesで Connect to Git
3. リポジトリを選ぶ
4. Build command は空欄
5. Build output directory は `.`
6. Deploy

想定URLは以下です。

```
https://equal-sokuho.pages.dev/
```

公開URLが変わったら、以下を直してください。

- `config/site.json` の `publicUrl`
- `robots.txt`
- `sitemap.xml`
- `scripts/update-feeds.mjs` の user-agent URL

## AdSense申請前チェック

- `privacy/index.html` が開ける
- `contact/index.html` が開ける
- `about/index.html` が開ける
- `ads.txt` が公開URLで開ける
- `robots.txt` が開ける
- `sitemap.xml` が開ける
- 記事本文を丸ごと転載していない
- 元記事リンクがある
- サイトに数十件以上の記事がある

## よくあるトラブル

### 記事が出ない

まずRSS更新を実行してください。

```bash
node scripts/update-feeds.mjs
```

それでも出ない場合は `data/last-fetch-report.json` の error を見ます。

### カテゴリボタンを押しても記事が出ない

カテゴリIDと表示名の両方で判定しています。記事が0件のカテゴリはトップの絞り込みに出ないようにしています。

### Cloudflareに反映されない

GitHubにpushできているか確認し、Cloudflare PagesのDeploymentsを見てください。

### デザインが古いまま

HTMLの `app.js?v=YYYYMMDDHHMM` を更新するとブラウザキャッシュ対策になります。

## 本人がやること

- GitHubリポジトリ作成
- GitHub DesktopでCommit / Push
- Cloudflare Pages連携
- AdSenseの最終申請
- 独自ドメインを使う場合のDNS設定
