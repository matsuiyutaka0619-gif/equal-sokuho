import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dataUrl = (path) => new URL(path, root);

const MAX_ARTICLES = 240;
const FETCH_TIMEOUT_MS = 15000;

const [rssSources, keywordData, categoryData, memberData] = await Promise.all([
  readJson("data/rss-sources.json"),
  readJson("data/keywords.json"),
  readJson("config/categories.json"),
  readJson("data/members.json")
]);

const enabledSources = rssSources.sources.filter((source) => source.enabled);
const report = {
  updatedAt: new Date().toISOString(),
  summary: {
    sourcesTotal: rssSources.sources.length,
    sourcesEnabled: enabledSources.length,
    articlesSaved: 0,
    duplicatesSkipped: 0
  },
  sources: []
};

const collected = [];
const seen = new Set();

for (const source of enabledSources) {
  const sourceReport = {
    id: source.id,
    name: source.name,
    url: source.url,
    ok: false,
    fetched: 0,
    matched: 0,
    skipped: 0,
    error: ""
  };

  try {
    const xml = await fetchText(source.url);
    const entries = parseFeed(xml);
    sourceReport.fetched = entries.length;

    for (const entry of entries) {
      const normalized = normalizeEntry(entry, source);
      if (!normalized.title || !normalized.url) {
        sourceReport.skipped += 1;
        continue;
      }

      const haystack = `${normalized.title} ${normalized.summary}`.toLowerCase();
      if (!isRelevant(haystack)) {
        sourceReport.skipped += 1;
        continue;
      }

      const dedupeKey = makeDedupeKey(normalized);
      if (seen.has(dedupeKey)) {
        report.summary.duplicatesSkipped += 1;
        sourceReport.skipped += 1;
        continue;
      }

      seen.add(dedupeKey);
      collected.push(enrichArticle(normalized));
      sourceReport.matched += 1;
    }

    sourceReport.ok = true;
  } catch (error) {
    sourceReport.error = error.message;
  }

  report.sources.push(sourceReport);
}

const articles = collected
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  .slice(0, MAX_ARTICLES);

report.summary.articlesSaved = articles.length;

await writeJson("data/articles.json", {
  updatedAt: report.updatedAt,
  articles
});

await writeJson("data/last-fetch-report.json", report);

console.log(`Saved ${articles.length} articles from ${enabledSources.length} enabled sources.`);

async function readJson(path) {
  return JSON.parse(await readFile(dataUrl(path), "utf8"));
}

async function writeJson(path, value) {
  await writeFile(dataUrl(path), `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "equal-sokuho-rss-reader/1.0 (+https://equal-sokuho.pages.dev)"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text)) {
      throw new Error("Feed XML was not detected");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeed(xml) {
  const blocks = collectBlocks(xml, "item").concat(collectBlocks(xml, "entry"));
  return blocks.map((block) => ({
    title: readTag(block, "title"),
    link: readLink(block),
    pubDate: readTag(block, "pubDate") || readTag(block, "published") || readTag(block, "updated") || readTag(block, "dc:date"),
    description: readTag(block, "description") || readTag(block, "summary") || readTag(block, "content") || readTag(block, "content:encoded")
  }));
}

function collectBlocks(xml, tag) {
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) || [];
}

function readTag(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function readLink(block) {
  const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (href) return decodeEntities(href[1]);
  return readTag(block, "link");
}

function normalizeEntry(entry, source) {
  const url = normalizeGoogleNewsUrl(entry.link);
  const publishedAt = parseDate(entry.pubDate);
  return {
    id: stableId(`${source.id}:${url || entry.title}`),
    title: entry.title,
    url,
    summary: trimSummary(entry.description),
    sourceId: source.id,
    sourceName: source.name,
    publishedAt
  };
}

function enrichArticle(article) {
  const text = `${article.title} ${article.summary}`;
  const categories = matchCategories(text);
  const people = matchPeople(text);
  const groups = matchGroups(categories, people);
  const members = people.filter((person) => person.kind !== "group");
  const statuses = matchStatuses(text, people);

  return {
    ...article,
    categories: categories.map((category) => category.id),
    categoryLabels: categories.map((category) => category.label),
    people: people.map((person) => person.name),
    personIds: people.map((person) => person.id),
    groupLabels: groups,
    memberNames: members.map((person) => person.name),
    statuses: statuses.map((status) => status.id),
    statusLabels: statuses.map((status) => status.label)
  };
}

function isRelevant(text) {
  const includes = keywordData.include.some((keyword) => text.includes(keyword.toLowerCase()));
  const excluded = keywordData.exclude.some((keyword) => text.includes(keyword.toLowerCase()));
  return includes && !excluded;
}

function matchCategories(text) {
  const matches = categoryData.categories.filter((category) =>
    category.keywords.some((keyword) => includesJa(text, keyword))
  );
  return matches.length ? matches : [categoryData.categories.find((category) => category.id === "kawaii-lab")];
}

function matchPeople(text) {
  return uniqueBy(
    memberData.members.filter((member) =>
      [member.name, ...(member.aliases || [])].some((keyword) => includesJa(text, keyword))
    ),
    (member) => member.id
  );
}

function matchGroups(categories, people) {
  const groups = [];
  for (const person of people) {
    if (person.kind === "group") groups.push(person.name);
    if (person.group) groups.push(person.group);
  }
  for (const category of categories) {
    if (isGroupCategory(category.label)) groups.push(category.label);
  }
  return uniqueValues(groups);
}

function matchStatuses(text, people) {
  const statusIds = new Set(people.map((person) => person.status));
  for (const [status, words] of Object.entries(keywordData.statusKeywords)) {
    if (words.some((word) => includesJa(text, word))) {
      statusIds.add(status);
    }
  }
  if (!statusIds.size) statusIds.add("active");
  return memberData.statuses.filter((status) => statusIds.has(status.id));
}

function includesJa(text, keyword) {
  return compactText(text).includes(compactText(keyword));
}

function compactText(value) {
  return String(value || "").toLowerCase().replace(/[\s　・.！!ーｰ-]/g, "");
}

function isGroupCategory(label) {
  return [
    "イコノイジョイ全体",
    "=LOVE",
    "≠ME",
    "≒JOY",
    "指原莉乃"
  ].includes(label);
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanText(value) {
  return decodeEntities(stripTags(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))).replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, " ");
}

function trimSummary(value) {
  const summary = cleanText(value);
  return summary.length > 120 ? `${summary.slice(0, 120)}...` : summary;
}

function decodeEntities(value) {
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => entities[name] || `&${name};`);
}

function normalizeGoogleNewsUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const target = parsed.searchParams.get("url");
    return target || url;
  } catch {
    return url;
  }
}

function makeDedupeKey(article) {
  const url = article.url.replace(/[?#].*$/, "").toLowerCase();
  const title = article.title.replace(/\s+/g, "").toLowerCase();
  return url || title;
}

function stableId(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `article-${Math.abs(hash)}`;
}
