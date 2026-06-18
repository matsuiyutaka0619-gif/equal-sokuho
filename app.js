const DATA_VERSION = "202606180001";
const pageMode = document.body.dataset.page || "home";
const pageFilter = document.body.dataset.filter || new URLSearchParams(location.search).get("category") || new URLSearchParams(location.search).get("member") || "";

const paths = {
  site: "/config/site.json",
  categories: "/config/categories.json",
  ads: "/config/ads.json",
  operator: "/config/operator.json",
  articles: "/data/articles.json",
  members: "/data/members.json",
  links: "/data/links.json",
  report: "/data/last-fetch-report.json"
};

const state = {
  articles: [],
  categories: [],
  members: [],
  statuses: [],
  links: [],
  ads: null,
  activeCategory: "all",
  activeMember: "all",
  activeStatus: "all",
  visibleLimit: 60
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [site, categoryData, articleData, memberData, linkData, ads, report] = await Promise.all([
      loadJson(paths.site),
      loadJson(paths.categories),
      loadJson(paths.articles),
      loadJson(paths.members),
      loadJson(paths.links),
      loadJson(paths.ads),
      loadJson(paths.report)
    ]);

    state.articles = articleData.articles || [];
    state.categories = categoryData.categories || [];
    state.members = memberData.members || [];
    state.statuses = memberData.statuses || [];
    state.links = linkData.links || [];
    state.ads = ads;

    applySiteMeta(site, articleData.updatedAt, report);
    applyPageHeading();
    renderAds();
    renderFilters();
    renderPage();
  } catch (error) {
    const list = document.querySelector("[data-article-list]");
    if (list) {
      list.innerHTML = `<p class="empty">データの読み込みに失敗しました。ローカル確認はサーバー起動後に開いてください。</p>`;
    }
    console.error(error);
  }
}

async function loadJson(path) {
  const response = await fetch(`${path}?v=${DATA_VERSION}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function applySiteMeta(site, updatedAt, report) {
  document.querySelectorAll("[data-site-name]").forEach((node) => {
    node.textContent = site.name;
  });
  document.querySelectorAll("[data-site-description]").forEach((node) => {
    node.textContent = site.description;
  });
  document.querySelectorAll("[data-updated-at]").forEach((node) => {
    node.textContent = updatedAt ? formatDateTime(updatedAt) : "未取得";
  });
  document.querySelectorAll("[data-source-count]").forEach((node) => {
    node.textContent = report?.summary?.sourcesEnabled || 0;
  });
}

function applyPageHeading() {
  if (pageMode === "member") {
    const member = state.members.find((item) => item.id === pageFilter || item.name === pageFilter);
    const title = member?.name || "グループ・メンバー";
    const group = member?.group && member.group !== member.name ? member.group : "";
    const description = group
      ? `${group} / ${member.name} に関連するニュースを表示しています。`
      : `${title} に関連するニュースを表示しています。`;
    setPageHeading(title, member?.kind === "member" ? "Member" : "Group", description);
    return;
  }

  if (pageMode === "category") {
    const category = state.categories.find((item) => item.id === pageFilter || item.label === pageFilter);
    const title = category?.label || "カテゴリ";
    setPageHeading(title, "Category", `${title} に関連するニュースを表示しています。`);
  }
}

function setPageHeading(title, eyebrow, description) {
  const titleNode = document.querySelector("[data-page-title]");
  const eyebrowNode = document.querySelector("[data-page-eyebrow]");
  const descriptionNode = document.querySelector("[data-page-description]");
  if (titleNode) titleNode.textContent = title;
  if (eyebrowNode) eyebrowNode.textContent = eyebrow;
  if (descriptionNode) descriptionNode.textContent = description;
  if (title) document.title = `${title} - イコール速報！`;
}

function renderPage() {
  if (pageMode === "links") {
    renderLinks();
    return;
  }
  if (pageMode === "categories") {
    renderCategoryIndex();
    renderArticles(getFilteredArticles());
    return;
  }
  if (pageMode === "members") {
    renderMemberIndex();
    renderArticles(getFilteredArticles());
    return;
  }
  renderArticles(getFilteredArticles());
}

function renderFilters() {
  renderCategoryFilters();
  renderMemberFilters();
  renderStatusFilters();
}

function renderCategoryFilters() {
  const container = document.querySelector("[data-category-filters]");
  if (!container) return;
  const counts = countBy((article) => normalizeList(article.categories).concat(normalizeList(article.categoryLabels)));
  const available = state.categories.filter((category) => (counts.get(category.id) || counts.get(category.label) || 0) > 0);
  container.innerHTML = buttonHtml("all", "すべて", "category", true) + available.map((category) => {
    const count = counts.get(category.id) || counts.get(category.label) || 0;
    return buttonHtml(category.id, `${category.label} (${count})`, "category");
  }).join("");
  container.addEventListener("click", onFilterClick);
}

function renderMemberFilters() {
  const container = document.querySelector("[data-member-filters]");
  if (!container) return;
  const counts = countBy((article) => normalizeList(article.personIds).concat(normalizeList(article.people)));
  const available = state.members.filter((member) => (counts.get(member.id) || counts.get(member.name) || 0) > 0);
  container.innerHTML = buttonHtml("all", "すべて", "member", true) + available.map((member) => {
    const count = counts.get(member.id) || counts.get(member.name) || 0;
    return buttonHtml(member.id, `${member.name} (${count})`, "member");
  }).join("");
  container.addEventListener("click", onFilterClick);
}

function renderStatusFilters() {
  const container = document.querySelector("[data-status-filters]");
  if (!container) return;
  const counts = countBy((article) => normalizeList(article.statuses).concat(normalizeList(article.statusLabels)));
  const available = state.statuses.filter((status) => (counts.get(status.id) || counts.get(status.label) || 0) > 0);
  container.innerHTML = buttonHtml("all", "すべて", "status", true) + available.map((status) => {
    const count = counts.get(status.id) || counts.get(status.label) || 0;
    return buttonHtml(status.id, `${status.label} (${count})`, "status");
  }).join("");
  container.addEventListener("click", onFilterClick);
}

function onFilterClick(event) {
  const button = event.target.closest("button[data-filter-type]");
  if (!button) return;
  const type = button.dataset.filterType;
  const value = button.dataset.filterValue;
  if (type === "category") state.activeCategory = value;
  if (type === "member") state.activeMember = value;
  if (type === "status") state.activeStatus = value;
  state.visibleLimit = 60;
  document.querySelectorAll(`button[data-filter-type="${type}"]`).forEach((node) => {
    node.setAttribute("aria-pressed", String(node === button));
  });
  renderArticles(getFilteredArticles());
}

function getFilteredArticles() {
  const now = new Date();
  return state.articles.filter((article) => {
    if (pageMode === "today" && !isSameDay(article.publishedAt, now)) return false;
    if (pageMode === "weekly" && !isWithinDays(article.publishedAt, 7)) return false;
    if (pageMode === "category" && !articleMatchesCategory(article, pageFilter)) return false;
    if (pageMode === "member" && !articleMatchesMember(article, pageFilter)) return false;
    if (state.activeCategory !== "all" && !articleMatchesCategory(article, state.activeCategory)) return false;
    if (state.activeMember !== "all" && !articleMatchesMember(article, state.activeMember)) return false;
    if (state.activeStatus !== "all" && !articleMatchesStatus(article, state.activeStatus)) return false;
    return true;
  });
}

function articleMatchesCategory(article, value) {
  const category = state.categories.find((item) => item.id === value || item.label === value);
  const accepted = [value, category?.id, category?.label].filter(Boolean);
  return accepted.some((item) => normalizeList(article.categories).includes(item) || normalizeList(article.categoryLabels).includes(item));
}

function articleMatchesMember(article, value) {
  const member = state.members.find((item) => item.id === value || item.name === value);
  const accepted = [value, member?.id, member?.name].filter(Boolean);
  return accepted.some((item) => normalizeList(article.personIds).includes(item) || normalizeList(article.people).includes(item));
}

function articleMatchesStatus(article, value) {
  const status = state.statuses.find((item) => item.id === value || item.label === value);
  const accepted = [value, status?.id, status?.label].filter(Boolean);
  return accepted.some((item) => normalizeList(article.statuses).includes(item) || normalizeList(article.statusLabels).includes(item));
}

function renderArticles(articles) {
  const list = document.querySelector("[data-article-list]");
  if (!list) return;
  document.querySelectorAll("[data-article-count]").forEach((node) => {
    node.textContent = articles.length;
  });
  if (!articles.length) {
    list.innerHTML = `<p class="empty">該当する記事はまだありません。RSS更新後に自動で表示されます。</p>`;
    return;
  }
  const inFeedAfter = Number(state.ads?.slots?.inFeed?.after || 0);
  const visibleArticles = articles.slice(0, state.visibleLimit);
  const more = articles.length > visibleArticles.length
    ? `<div class="more-row"><button type="button" data-load-more>さらに${Math.min(30, articles.length - visibleArticles.length)}件表示</button></div>`
    : "";
  list.innerHTML = visibleArticles.map((article, index) => {
    const card = articleCard(article);
    const ad = state.ads?.enabled && state.ads?.slots?.inFeed?.enabled && index + 1 === inFeedAfter
      ? adBox("記事一覧途中広告")
      : "";
    return `${card}${ad}`;
  }).join("") + more;
  const loadMore = list.querySelector("[data-load-more]");
  if (loadMore) {
    loadMore.addEventListener("click", () => {
      state.visibleLimit += 30;
      renderArticles(getFilteredArticles());
    });
  }
}

function articleCard(article) {
  const category = normalizeList(article.groupLabels)[0] || normalizeList(article.categoryLabels)[0] || "イコノイジョイ";
  const people = normalizeList(article.memberNames).slice(0, 4).join(" / ") || "グループ全体";
  const status = normalizeList(article.statusLabels).join(" / ") || "現役";
  const summary = article.summary && article.summary !== article.title ? article.summary : "";
  return `
    <article class="article-card" data-article-card>
      <div class="article-meta">
        <span>${escapeHtml(article.sourceName)}</span>
        <time datetime="${escapeHtml(article.publishedAt)}">${formatDate(article.publishedAt)}</time>
      </div>
      <h2><a class="article-title-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a></h2>
      ${summary ? `<p class="article-summary">${escapeHtml(summary)}</p>` : ""}
      <div class="tag-row">
        <span>${escapeHtml(category)}</span>
        <span>${escapeHtml(people)}</span>
        <span>${escapeHtml(status)}</span>
      </div>
      <a class="article-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">元記事を開く</a>
    </article>
  `;
}

function renderCategoryIndex() {
  const container = document.querySelector("[data-category-index]");
  if (!container) return;
  const counts = countBy((article) => normalizeList(article.categories).concat(normalizeList(article.categoryLabels)));
  container.innerHTML = state.categories.map((category) => {
    const count = counts.get(category.id) || counts.get(category.label) || 0;
    return `<a class="index-tile" href="/categories/detail.html?category=${encodeURIComponent(category.id)}"><strong>${escapeHtml(category.label)}</strong><span>${count}件</span></a>`;
  }).join("");
}

function renderMemberIndex() {
  const container = document.querySelector("[data-member-index]");
  if (!container) return;
  const counts = countBy((article) => normalizeList(article.personIds).concat(normalizeList(article.people)));
  container.innerHTML = state.members.map((member) => {
    const count = counts.get(member.id) || counts.get(member.name) || 0;
    return `<a class="index-tile" href="/members/detail.html?member=${encodeURIComponent(member.id)}"><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.status)} / ${count}件</span></a>`;
  }).join("");
}

function renderLinks() {
  const container = document.querySelector("[data-links]");
  if (!container) return;
  container.innerHTML = state.links.map((link) => `
    <a class="link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
      <strong>${escapeHtml(link.name)}</strong>
      <span>${escapeHtml(link.group)}</span>
    </a>
  `).join("");
}

function renderAds() {
  document.querySelectorAll("[data-ad-slot]").forEach((slot) => {
    const label = slot.dataset.adLabel || "広告";
    slot.innerHTML = adBox(label);
  });
}

function adBox(label) {
  return `<aside class="ad-slot" aria-label="${escapeHtml(label)}"><span>ADVERTISEMENT</span><strong>${escapeHtml(label)}</strong></aside>`;
}

function countBy(getValues) {
  const counts = new Map();
  for (const article of state.articles) {
    for (const value of getValues(article)) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return counts;
}

function buttonHtml(value, label, type, pressed = false) {
  return `<button type="button" data-filter-type="${type}" data-filter-value="${escapeHtml(value)}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isSameDay(value, now) {
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isWithinDays(value, days) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
