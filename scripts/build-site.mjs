import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const SITE_URL = "https://equal-sokuho.pages.dev";
const ADSENSE = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8002455848254296" crossorigin="anonymous"></script>';
const [articleData, memberData, linkData, guideData, categoryData, report] = await Promise.all([
  readJson("data/articles.json"),
  readJson("data/members.json"),
  readJson("data/links.json"),
  readJson("data/group-guides.json"),
  readJson("config/categories.json"),
  readJson("data/last-fetch-report.json")
]);

const articles = articleData.articles || [];
const members = memberData.members || [];
const links = linkData.links || [];
const guides = guideData.guides || [];
const categories = categoryData.categories || [];
const updatedAt = articleData.updatedAt || new Date().toISOString();
const latestTime = Math.max(...articles.map((article) => new Date(article.publishedAt).getTime()).filter(Number.isFinite));
const latestDate = Number.isFinite(latestTime) ? new Date(latestTime) : new Date(updatedAt);
const todayArticles = articles.filter((article) => tokyoDay(article.publishedAt) === tokyoDay(latestDate));
const weeklyArticles = articles.filter((article) => latestDate.getTime() - new Date(article.publishedAt).getTime() <= 7 * 86400000);

await Promise.all([
  writePage("index.html", homePage()),
  writePage("today/index.html", newsPage({
    mode: "today",
    title: "今日のニュース",
    description: `${formatDate(latestDate)}に公開された=LOVE・≠ME・≒JOY・指原莉乃関連ニュースを、出典付きで一覧にしています。`,
    eyebrow: "TODAY",
    intro: `最新取得日である${formatDate(latestDate)}の記事を掲載しています。見出しをグループ・人物・話題別に自動分類し、元記事へ案内します。`,
    articles: todayArticles,
    canonical: "/today/",
    noindex: todayArticles.length === 0
  })),
  writePage("weekly/index.html", weeklyPage()),
  writePage("groups/index.html", groupsIndexPage()),
  writePage("members/index.html", membersPage()),
  writePage("categories/index.html", categoriesPage()),
  writePage("links/index.html", linksPage()),
  writePage("about/index.html", aboutPage()),
  writePage("editorial-policy/index.html", editorialPage()),
  writePage("privacy/index.html", privacyPage()),
  writePage("contact/index.html", contactPage()),
  writePage("404.html", notFoundPage()),
  writePage("categories/detail.html", thinDetailPage("カテゴリ別ニュース", "category")),
  writePage("members/detail.html", thinDetailPage("メンバー別ニュース", "member"))
]);

for (const guide of guides) {
  await writePage(`groups/${guide.id}/index.html`, guidePage(guide));
}

await writePage("sitemap.xml", sitemap());

console.log(`Built ${guides.length} guides and ${articles.length} pre-rendered news records.`);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

async function writePage(path, content) {
  const url = new URL(path, root);
  await mkdir(new URL("./", url), { recursive: true });
  await writeFile(url, `${content.trim()}\n`);
}

function homePage() {
  const guideCards = guides.map(guideCard).join("");
  return layout({
    title: "イコール速報！｜イコノイジョイニュースと初心者ガイド",
    description: "=LOVE・≠ME・≒JOYの違い、メンバー、成り立ちを公式情報から整理し、最新ニュースをRSSで自動更新する非公式ファンサイトです。",
    canonical: "/",
    bodyPage: "home",
    schema: [
      webSiteSchema(),
      breadcrumbSchema([{ name: "トップ", path: "/" }])
    ],
    content: `
      <section class="hero">
        <div>
          <p class="eyebrow">IKONOIJOY NEWS &amp; GUIDE</p>
          <h1>イコール速報！</h1>
          <p>=LOVE・≠ME・≒JOYを初めて知る人向けのガイドと、毎日自動更新されるニュースをひとつにまとめています。</p>
          <div class="stats">
            <span>最終更新: <b data-updated-at>${escapeHtml(formatDateTime(updatedAt))}</b></span>
            <span>RSS: <b data-source-count>${Number(report?.summary?.sourcesEnabled || 0)}</b>件</span>
            <span>掲載: <b data-article-count>${articles.length}</b>件</span>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true"><span></span></div>
      </section>
      <main class="main-layout">
        <section class="content">
          <section class="guide-callout">
            <p class="eyebrow">初めての方へ</p>
            <h2>3グループの違いを、ここから理解できます</h2>
            <p>読み方、結成順、現在のメンバー、代表的な活動、公式リンクを、出典と確認日付きで整理しました。</p>
            <div class="guide-grid">${guideCards}</div>
          </section>
          ${adSlot("ヘッダー下広告")}
          <div class="section-title">
            <div><p class="eyebrow">LATEST NEWS</p><h2>新着ニュース</h2></div>
            <p><span data-article-count>${articles.length}</span>件</p>
          </div>
          <div class="article-list" data-article-list>${articles.slice(0, 60).map(articleCard).join("")}</div>
          ${adSlot("記事下広告")}
        </section>
        <aside class="sidebar">
          <section class="side-panel">
            <h2>ニュースの見方</h2>
            <p>見出し・公開日・配信元を整理し、本文は元記事で確認できるようにしています。転載記事や自動生成した感想文は掲載しません。</p>
          </section>
          <section class="filter-panel">
            <h2>カテゴリ</h2><div class="chip-row" data-category-filters></div>
            <h2>グループ・関連</h2><div class="chip-row" data-member-filters></div>
            <h2>ステータス</h2><div class="chip-row" data-status-filters></div>
          </section>
        </aside>
      </main>`
  });
}

function newsPage({ mode, title, description, eyebrow, intro, articles: pageArticles, canonical, noindex = false }) {
  return layout({
    title: `${title} - イコール速報！`,
    description,
    canonical,
    noindex,
    bodyPage: mode,
    schema: [breadcrumbSchema([{ name: "トップ", path: "/" }, { name: title, path: canonical }])],
    content: `
      ${pageHero(eyebrow, title, intro)}
      <main class="main-layout">
        <section class="content">
          ${adSlot("ヘッダー下広告")}
          <div class="section-title"><h2>${escapeHtml(title)}</h2><p><span data-article-count>${pageArticles.length}</span>件</p></div>
          <div class="article-list" data-article-list>${pageArticles.slice(0, 60).map(articleCard).join("") || emptyState()}</div>
          ${adSlot("記事下広告")}
        </section>
        <aside class="sidebar"><section class="filter-panel">
          <h2>カテゴリ</h2><div class="chip-row" data-category-filters></div>
          <h2>グループ・関連</h2><div class="chip-row" data-member-filters></div>
          <h2>ステータス</h2><div class="chip-row" data-status-filters></div>
        </section></aside>
      </main>`
  });
}

function weeklyPage() {
  const groupCounts = [
    ["=LOVE", countMatches(weeklyArticles, ["=LOVE"])],
    ["≠ME", countMatches(weeklyArticles, ["≠ME"])],
    ["≒JOY", countMatches(weeklyArticles, ["≒JOY"])],
    ["指原莉乃", countMatches(weeklyArticles, ["指原莉乃"])]
  ];
  const topicCounts = categories
    .filter((category) => ["live-event", "release", "media"].includes(category.id))
    .map((category) => [category.label, weeklyArticles.filter((article) => (article.categories || []).includes(category.id)).length]);
  return layout({
    title: "今週のイコノイジョイニュースまとめ - イコール速報！",
    description: "直近7日間の=LOVE・≠ME・≒JOY・指原莉乃ニュースをグループ別・話題別に自動集計し、時系列で確認できます。",
    canonical: "/weekly/",
    bodyPage: "weekly",
    schema: [breadcrumbSchema([{ name: "トップ", path: "/" }, { name: "週間まとめ", path: "/weekly/" }])],
    content: `
      ${pageHero("WEEKLY DASHBOARD", "今週のイコノイジョイ", `最新取得日から7日間の${weeklyArticles.length}件を、グループ別・話題別に自動集計しました。内容の判断は元記事と公式発表をご確認ください。`)}
      <main class="main-layout">
        <section class="content">
          <section class="weekly-dashboard" aria-labelledby="weekly-summary">
            <div class="section-title"><h2 id="weekly-summary">7日間の話題マップ</h2><p>${escapeHtml(formatDate(latestDate))}更新</p></div>
            <div class="metric-grid">${groupCounts.concat(topicCounts).map(([label, count]) => `<div class="metric-card"><strong>${count}</strong><span>${escapeHtml(label)}</span></div>`).join("")}</div>
            <p class="method-note">記事タイトルとRSS情報に含まれる名称・語句をもとに自動分類しています。1件が複数カテゴリに数えられる場合があります。</p>
          </section>
          ${adSlot("ヘッダー下広告")}
          <div class="section-title"><h2>7日間のニュース</h2><p><span data-article-count>${weeklyArticles.length}</span>件</p></div>
          <div class="article-list" data-article-list>${weeklyArticles.slice(0, 60).map(articleCard).join("") || emptyState()}</div>
          ${adSlot("記事下広告")}
        </section>
        <aside class="sidebar"><section class="filter-panel">
          <h2>カテゴリ</h2><div class="chip-row" data-category-filters></div>
          <h2>グループ・関連</h2><div class="chip-row" data-member-filters></div>
        </section></aside>
      </main>`
  });
}

function groupsIndexPage() {
  return layout({
    title: "イコノイジョイ初心者ガイド｜=LOVE・≠ME・≒JOYの違い",
    description: "=LOVE・≠ME・≒JOYの読み方、結成順、メンバー、代表的な活動、指原莉乃との関係を公式情報から整理しています。",
    canonical: "/groups/",
    schema: [breadcrumbSchema([{ name: "トップ", path: "/" }, { name: "初心者ガイド", path: "/groups/" }])],
    content: `
      ${pageHero("BEGINNER'S GUIDE", "はじめてのイコノイジョイ", "=LOVE・≠ME・≒JOYは、それぞれ独立して活動する3つのグループです。名前が似ている理由と各グループの違いを、公式情報に基づいて案内します。")}
      <main class="static-page guide-index-page">
        <section class="comparison-section">
          <h2>3グループを比較</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>グループ</th><th>読み方</th><th>発表・お披露目</th><th>現在の人数</th></tr></thead>
            <tbody>
              ${guides.filter((guide) => ["equal-love", "not-equal-me", "nearly-equal-joy"].includes(guide.id)).map((guide) => `<tr><th><a href="/groups/${guide.id}/">${escapeHtml(guide.name)}</a></th><td>${escapeHtml(guide.reading)}</td><td>${escapeHtml(guide.founded)}</td><td>${activeMembers(guide.membersMode).length}人</td></tr>`).join("")}
            </tbody>
          </table></div>
          <p>3組はいずれも指原莉乃がプロデュースし、代々木アニメーション学院との取り組みから誕生しました。合同公演などでは「イコノイジョイ」として扱われますが、普段は別々のグループとして活動しています。</p>
        </section>
        <section>
          <h2>詳しく知る</h2>
          <div class="guide-grid">${guides.map(guideCard).join("")}</div>
        </section>
        <section class="source-note"><h2>このガイドの確認方法</h2><p>各グループの公式ABOUT・プロフィール・ディスコグラフィーを優先して確認しています。人数や活動状況は変わることがあるため、各ページに情報確認日と公式リンクを掲載しています。</p></section>
      </main>`
  });
}

function guidePage(guide) {
  const related = articles.filter((article) => articleMatchesGuide(article, guide)).slice(0, 18);
  const currentMembers = activeMembers(guide.membersMode);
  const memberContent = guide.membersMode === "groups"
    ? `<div class="guide-grid">${guides.filter((item) => ["equal-love", "not-equal-me", "nearly-equal-joy"].includes(item.id)).map(guideCard).join("")}</div>`
    : guide.membersMode === "none"
      ? `<p>このページでは、本人の芸能活動全般ではなく、=LOVE・≠ME・≒JOYとの関係を中心に扱います。</p>`
      : `<ul class="member-list">${currentMembers.map((member) => `<li>${escapeHtml(member.name)}</li>`).join("")}</ul>`;
  return layout({
    title: `${guide.name}（${guide.reading}）とは？メンバー・成り立ち・代表曲`,
    description: guide.shortDescription,
    canonical: `/groups/${guide.id}/`,
    schema: [
      breadcrumbSchema([
        { name: "トップ", path: "/" },
        { name: "初心者ガイド", path: "/groups/" },
        { name: guide.name, path: `/groups/${guide.id}/` }
      ]),
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `${guide.name}ガイド`,
        description: guide.shortDescription,
        dateModified: guideData.checkedAt,
        url: `${SITE_URL}/groups/${guide.id}/`,
        isPartOf: { "@type": "WebSite", name: "イコール速報！", url: `${SITE_URL}/` }
      }
    ],
    content: `
      ${pageHero(guide.eyebrow, `${guide.name}（${guide.reading}）ガイド`, guide.shortDescription)}
      <main class="main-layout">
        <article class="content guide-article">
          <section class="guide-summary">
            <h2>${escapeHtml(guide.name)}とは</h2>
            <p>${escapeHtml(guide.overview)}</p>
            <dl class="fact-list">
              <div><dt>結成・発表</dt><dd>${escapeHtml(guide.founded)}</dd></div>
              <div><dt>デビュー・展開</dt><dd>${escapeHtml(guide.debut)}</dd></div>
              <div><dt>プロデューサー</dt><dd>${escapeHtml(guide.producer)}</dd></div>
              <div><dt>情報確認日</dt><dd>${escapeHtml(guideData.checkedAt)}</dd></div>
            </dl>
          </section>
          <section><h2>特徴と主な活動</h2><ul class="feature-list">${guide.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
          <section><h2>${guide.membersMode === "groups" ? "3つのグループ" : guide.membersMode === "none" ? "このページで扱う範囲" : `現在のメンバー（${currentMembers.length}人）`}</h2>${memberContent}</section>
          <section><h2>代表的な作品・活動</h2><ul class="work-list">${guide.representativeWorks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p class="method-note">初めて知る人が公式ディスコグラフィーをたどる入口として、グループ名を冠した作品や主要な活動を例示しています。</p></section>
          ${adSlot("ガイド内広告")}
          <section>
            <div class="section-title"><h2>最近の${escapeHtml(guide.name)}ニュース</h2><p>${related.length}件</p></div>
            <div class="article-list compact-list">${related.map(articleCard).join("") || emptyState()}</div>
          </section>
          <section class="sources-section"><h2>出典・公式リンク</h2><ul>${guide.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`).join("")}</ul><p>最終確認日：${escapeHtml(guideData.checkedAt)}。最新の所属・活動予定は必ず公式サイトでご確認ください。</p></section>
        </article>
        <aside class="sidebar"><section class="side-panel"><h2>関連ガイド</h2><nav class="side-links">${guides.filter((item) => item.id !== guide.id).map((item) => `<a href="/groups/${item.id}/">${escapeHtml(item.name)}ガイド</a>`).join("")}</nav></section>${adSlot("サイド広告")}</aside>
      </main>`
  });
}

function membersPage() {
  const groupSections = ["=LOVE", "≠ME", "≒JOY"].map((group) => {
    const groupGuide = guides.find((guide) => guide.membersMode === group);
    return `<section><h2><a href="/groups/${groupGuide.id}/">${escapeHtml(group)}</a> 現在のメンバー</h2><ul class="member-list">${activeMembers(group).map((member) => `<li>${escapeHtml(member.name)}</li>`).join("")}</ul></section>`;
  }).join("");
  return layout({
    title: "イコノイジョイ メンバー一覧｜=LOVE・≠ME・≒JOY",
    description: "=LOVE・≠ME・≒JOYの現在のメンバーをグループ別に整理し、詳しいグループガイドへ案内します。",
    canonical: "/members/",
    schema: [breadcrumbSchema([{ name: "トップ", path: "/" }, { name: "メンバー一覧", path: "/members/" }])],
    content: `${pageHero("MEMBER DIRECTORY", "メンバー一覧", "公式プロフィールをもとに、現在のメンバーをグループ別に確認できます。人物ごとの薄いページは作らず、各グループガイドに情報を集約しています。")}<main class="static-page">${groupSections}<p class="source-note">情報確認日：${escapeHtml(guideData.checkedAt)}。最新情報は各グループの公式プロフィールをご確認ください。</p></main>`
  });
}

function categoriesPage() {
  const cards = categories.map((category) => {
    const count = articles.filter((article) => (article.categories || []).includes(category.id)).length;
    return `<button class="index-tile category-jump" type="button" data-category-jump="${escapeHtml(category.id)}"><strong>${escapeHtml(category.label)}</strong><span>${count}件</span></button>`;
  }).join("");
  return layout({
    title: "ニュースカテゴリ一覧 - イコール速報！",
    description: "イコノイジョイニュースをグループ、ライブ、新曲、テレビ・メディア別に整理しています。",
    canonical: "/categories/",
    bodyPage: "categories",
    schema: [breadcrumbSchema([{ name: "トップ", path: "/" }, { name: "カテゴリ", path: "/categories/" }])],
    content: `${pageHero("NEWS CATEGORIES", "カテゴリから探す", "RSSで取得したニュースを、グループ名と話題語を使って自動分類しています。")}<main class="main-layout"><section class="content"><div class="index-grid">${cards}</div><div class="section-title"><h2>全ニュース</h2><p><span data-article-count>${articles.length}</span>件</p></div><div class="article-list" data-article-list>${articles.slice(0, 60).map(articleCard).join("")}</div></section><aside class="sidebar"><section class="filter-panel"><h2>カテゴリ</h2><div class="chip-row" data-category-filters></div><h2>グループ</h2><div class="chip-row" data-member-filters></div></section></aside></main>`
  });
}

function linksPage() {
  const groups = ["=LOVE", "≠ME", "≒JOY", "指原莉乃"];
  const content = groups.map((group) => `<section><h2>${escapeHtml(group)}</h2><div class="link-grid">${links.filter((link) => link.group === group).map((link) => `<a class="link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(link.title || link.name)}</strong><span>${escapeHtml(link.type)}</span></a>`).join("")}</div></section>`).join("");
  return layout({
    title: "公式リンク集｜=LOVE・≠ME・≒JOY",
    description: "=LOVE・≠ME・≒JOY・指原莉乃の公式サイト、公式ニュース、公式YouTubeへのリンクを整理しています。",
    canonical: "/links/",
    bodyPage: "links",
    schema: [breadcrumbSchema([{ name: "トップ", path: "/" }, { name: "公式リンク", path: "/links/" }])],
    content: `${pageHero("OFFICIAL LINKS", "公式情報への入口", "ニュースの確認は、まず公式発表をおすすめします。公式サイト・公式ニュース・公式YouTubeをグループ別に整理しました。")}<main class="static-page">${content}<p class="source-note">外部サイトは各運営者が管理しています。本サイトは各グループおよび所属・運営会社とは関係のない非公式サイトです。</p></main>`
  });
}

function aboutPage() {
  return staticPolicyPage({
    title: "運営者情報",
    canonical: "/about/",
    description: "イコール速報！の運営目的、掲載内容、非公式サイトとしての立場を説明します。",
    content: `
      <h2>サイトの目的</h2><p>イコール速報！は、=LOVE・≠ME・≒JOYを初めて知る人向けのガイドと、関連ニュースの入口を提供する個人運営の非公式ファンサイトです。</p>
      <h2>掲載内容</h2><p>各グループの公式サイトをもとに作成した固定ガイドと、公開RSSから取得したニュースの見出し・配信元・公開日・元記事リンクを掲載します。外部記事の本文を転載せず、自動生成した感想や事実未確認の情報も掲載しません。</p>
      <h2>公式との関係</h2><p>当サイトは非公式サイトです。=LOVE、≠ME、≒JOY、指原莉乃、代々木アニメーション学院、各所属会社・レーベル・運営会社とは関係ありません。</p>
      <h2>運営者</h2><p>イコール速報！運営</p>
      <h2>関連ページ</h2><p><a href="/editorial-policy/">編集方針</a>、<a href="/privacy/">プライバシーポリシー</a>、<a href="/contact/">お問い合わせ</a>もご確認ください。</p>`
  });
}

function editorialPage() {
  return staticPolicyPage({
    title: "編集方針・情報源・訂正ポリシー",
    canonical: "/editorial-policy/",
    description: "イコール速報！が使用する情報源、RSSの扱い、訂正・更新、広告掲載の方針を説明します。",
    content: `
      <h2>編集方針</h2><p>ニュースを速く見つけることと、初めて知った人がグループの全体像を理解できることを両立させます。固定ガイドでは公式情報を確認し、出典と情報確認日を表示します。</p>
      <h2>情報源の選定基準</h2><p>グループのプロフィール、結成、作品、予定は公式サイト・公式ニュース・公式ディスコグラフィーを優先します。速報一覧は、一般に公開されているRSSとGoogleニュースの検索RSSから、サイトの対象語を含む記事を機械的に抽出します。</p>
      <h2>RSS記事の扱い</h2><p>見出し、配信元、公開日、元記事リンクを整理して掲載します。記事本文の丸ごと転載や、元記事を読んだように見せる自動生成の解説は行いません。分類は記事内の名称・語句による自動判定であり、誤分類が発生する場合があります。</p>
      <h2>訂正・更新ポリシー</h2><p>固定ガイドの誤りや古い情報が判明した場合は、公式発表を確認して修正します。RSS由来の見出しやリンクに問題がある場合は、元媒体での修正を確認したうえで、削除または表示対象外の対応を行います。</p>
      <h2>広告掲載方針</h2><p>当サイトはGoogle AdSenseの広告配信スクリプトを設置しています。広告と本文を区別できる表示にし、広告主の商品・サービスを当サイトが推薦するものではありません。広告の有無がニュースの掲載判断やガイド内容に影響することはありません。</p>
      <h2>著作権とリンク</h2><p>記事・画像・名称などの権利は各権利者に帰属します。問題のある掲載やリンク切れを見つけた場合は、<a href="/contact/">お問い合わせフォーム</a>からご連絡ください。</p>
      <p class="source-note">制定・最終更新：2026年7月29日</p>`
  });
}

function privacyPage() {
  return staticPolicyPage({
    title: "プライバシーポリシー",
    canonical: "/privacy/",
    description: "イコール速報！のCookie、Google AdSense、アクセス情報、お問い合わせ情報の取り扱いを説明します。",
    content: `
      <h2>Google AdSenseについて</h2><p>当サイトはGoogle AdSenseの広告配信スクリプトを使用しています。Googleを含む第三者配信事業者は、Cookieを使用して、ユーザーが当サイトや他のサイトへ過去にアクセスした情報に基づく広告を配信する場合があります。</p>
      <h2>パーソナライズ広告</h2><p>Googleによる広告Cookieの使用により、Googleとそのパートナーは適切な広告を表示できます。ユーザーは<a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer">Googleの広告設定</a>でパーソナライズ広告を無効にできます。</p>
      <h2>Cookieについて</h2><p>Cookieはブラウザに保存される小さな情報で、通常は氏名や住所を直接特定するものではありません。ブラウザの設定からCookieを無効にできますが、一部機能や広告表示に影響する場合があります。</p>
      <h2>アクセス時に送信される情報</h2><p>サイト配信・安全対策・広告配信のため、IPアドレス、ブラウザ、端末、参照元、閲覧日時などの情報がCloudflareや広告配信事業者のログに記録される場合があります。</p>
      <h2>お問い合わせ情報</h2><p>お問い合わせフォームに入力された情報は、問い合わせ対応に必要な範囲で使用します。Googleフォーム上の情報はGoogleのサービスを通じて処理されます。</p>
      <h2>外部リンク</h2><p>当サイトから移動した外部サイトでの情報の取り扱いについては、各サイトのプライバシーポリシーをご確認ください。</p>
      <p class="source-note">制定・最終更新：2026年7月29日</p>`
  });
}

function contactPage() {
  return staticPolicyPage({
    title: "お問い合わせ",
    canonical: "/contact/",
    description: "イコール速報！の掲載内容、訂正、削除依頼、リンク切れに関するお問い合わせ窓口です。",
    content: `<h2>お問い合わせの対象</h2><p>掲載内容の訂正、リンク切れ、削除依頼、権利に関するご連絡を受け付けています。対象ページのURLと具体的な内容をご記載ください。</p><p><a class="text-link button-link" href="https://docs.google.com/forms/d/e/1FAIpQLSemyoJObizpVTs0s3o4poKYRlQ5Gg2o-DDNz50rdZLY_w2z6Q/viewform" target="_blank" rel="noopener noreferrer">お問い合わせフォームを開く</a></p><p>広告営業やサイトと無関係なご案内には返信できない場合があります。</p>`
  });
}

function notFoundPage() {
  return layout({
    title: "ページが見つかりません - イコール速報！",
    description: "指定されたページは見つかりませんでした。",
    canonical: "/404.html",
    noindex: true,
    includeScript: false,
    content: `${pageHero("404", "ページが見つかりません", "URLが変更されたか、ページが削除された可能性があります。")}<main class="static-page"><p><a class="button-link" href="/">トップページへ戻る</a></p><p><a href="/groups/">イコノイジョイ初心者ガイドを見る</a></p></main>`
  });
}

function thinDetailPage(title, mode) {
  return layout({
    title: `${title} - イコール速報！`,
    description: "ニュースの絞り込み表示ページです。",
    canonical: mode === "category" ? "/categories/" : "/members/",
    noindex: true,
    bodyPage: mode,
    content: `${pageHero("NEWS FILTER", title, "このページはニュースを絞り込むための補助ページです。主要な情報は固定ガイドにまとめています。")}<main class="main-layout"><section class="content"><div class="article-list" data-article-list>${articles.slice(0, 30).map(articleCard).join("")}</div></section><aside class="sidebar"><section class="filter-panel"><h2>カテゴリ</h2><div class="chip-row" data-category-filters></div><h2>グループ</h2><div class="chip-row" data-member-filters></div></section></aside></main>`
  });
}

function staticPolicyPage({ title, description, canonical, content }) {
  return layout({
    title: `${title} - イコール速報！`,
    description,
    canonical,
    includeScript: false,
    schema: [breadcrumbSchema([{ name: "トップ", path: "/" }, { name: title, path: canonical }])],
    content: `${pageHero("SITE INFORMATION", title, description)}<main class="static-page policy-page">${content}</main>`
  });
}

function layout({ title, description, canonical, content, bodyPage = "", noindex = false, schema = [], includeScript = true }) {
  const canonicalUrl = `${SITE_URL}${canonical}`;
  const schemaHtml = schema.length ? `<script type="application/ld+json">${JSON.stringify(schema.length === 1 ? schema[0] : schema)}</script>` : "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${SITE_URL}/assets/ogp.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/assets/favicon.svg">
  <link rel="stylesheet" href="/styles.css?v=202607290001">
  ${ADSENSE}
  ${schemaHtml}
</head>
<body${bodyPage ? ` data-page="${escapeHtml(bodyPage)}"` : ""}>
  ${header()}
  ${content}
  ${footer()}
  ${includeScript ? '<script src="/app.js?v=202607290001" defer></script>' : ""}
</body>
</html>`.replace(/[ \t]+$/gm, "");
}

function header() {
  return `<header class="site-header"><div class="header-inner"><a class="brand" href="/"><span class="brand-mark"></span><span>イコール速報！</span></a><nav class="site-nav" aria-label="主要メニュー"><a href="/groups/">初心者ガイド</a><a href="/weekly/">週間</a><a href="/today/">今日</a><a href="/members/">メンバー</a><a href="/links/">公式リンク</a></nav></div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="footer-inner"><div><strong>イコール速報！</strong><p>イコノイジョイのニュースと初心者ガイドを届ける非公式ファンサイトです。</p></div><nav aria-label="運営情報"><a href="/about/">運営者情報</a><a href="/editorial-policy/">編集方針</a><a href="/privacy/">プライバシー</a><a href="/contact/">お問い合わせ</a></nav><p>&copy; イコール速報！</p></div></footer>`;
}

function pageHero(eyebrow, title, description) {
  return `<section class="page-hero"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></section>`;
}

function guideCard(guide) {
  return `<a class="guide-card" href="/groups/${escapeHtml(guide.id)}/"><span>${escapeHtml(guide.eyebrow)}</span><strong>${escapeHtml(guide.name)}</strong><small>${escapeHtml(guide.reading)}</small><p>${escapeHtml(guide.shortDescription)}</p><b>ガイドを読む →</b></a>`;
}

function articleCard(article) {
  const category = (article.groupLabels || [])[0] || (article.categoryLabels || [])[0] || "イコノイジョイ";
  const people = (article.memberNames || []).slice(0, 3).join(" / ");
  const summary = article.summary && compact(article.summary) !== compact(article.title) ? article.summary : "";
  return `<article class="article-card" data-article-card>
    <div class="article-meta"><span>${escapeHtml(article.sourceName || "配信元")}</span><time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatDateTime(article.publishedAt))}</time></div>
    <h2><a class="article-title-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a></h2>
    ${summary ? `<p class="article-summary">${escapeHtml(summary)}</p>` : ""}
    <div class="tag-row"><span>${escapeHtml(category)}</span>${people ? `<span>${escapeHtml(people)}</span>` : ""}</div>
    <a class="article-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">元記事で確認</a>
  </article>`;
}

function adSlot(label) {
  return `<div data-ad-slot data-ad-label="${escapeHtml(label)}"><aside class="ad-slot" aria-label="${escapeHtml(label)}"><span>ADVERTISEMENT</span><strong>${escapeHtml(label)}</strong></aside></div>`;
}

function emptyState() {
  return `<p class="empty">この期間の記事はまだありません。次回のRSS更新後に自動で再集計されます。</p>`;
}

function activeMembers(group) {
  return members.filter((member) => member.kind === "member" && member.status === "active" && member.group === group);
}

function articleMatchesGuide(article, guide) {
  const values = [...(article.groupLabels || []), ...(article.people || []), ...(article.categoryLabels || [])];
  if (guide.id === "ikonoi-joy") return values.some((value) => ["=LOVE", "≠ME", "≒JOY", "イコノイジョイ全体"].includes(value));
  return values.includes(guide.name);
}

function countMatches(items, names) {
  return items.filter((article) => names.some((name) => [...(article.groupLabels || []), ...(article.people || []), ...(article.categoryLabels || [])].includes(name))).length;
}

function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "イコール速報！",
    url: `${SITE_URL}/`,
    description: "=LOVE・≠ME・≒JOYの初心者ガイドと最新ニュース"
  };
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`
    }))
  };
}

function sitemap() {
  const newsModified = updatedAt.slice(0, 10);
  const guideModified = guideData.checkedAt;
  const pages = [
    ["/", newsModified],
    ["/groups/", guideModified],
    ...guides.map((guide) => [`/groups/${guide.id}/`, guideModified]),
    ["/weekly/", newsModified],
    ["/today/", newsModified],
    ["/members/", guideModified],
    ["/categories/", newsModified],
    ["/links/", guideModified],
    ["/about/", "2026-07-29"],
    ["/editorial-policy/", "2026-07-29"],
    ["/privacy/", "2026-07-29"],
    ["/contact/", "2026-07-29"]
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([path, lastmod]) => `  <url><loc>${SITE_URL}${path}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>`;
}

function tokyoDay(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function compact(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
