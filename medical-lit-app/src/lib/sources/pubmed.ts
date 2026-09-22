import { XMLParser } from "fast-xml-parser";
import type { ArticleResult, LiteratureSource, SearchOptions } from "./types";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// タグに属性がある場合 {"#text": "...", "@_Xxx": "..."} になり、
// 属性がなければ文字列そのものになる。どちらでも文字列を取り出す。
function textOf(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

function buildParams(extra: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(extra);
  const apiKey = process.env.NCBI_API_KEY;
  const email = process.env.NCBI_CONTACT_EMAIL;
  const tool = process.env.NCBI_TOOL_NAME || "medical-lit-app";
  if (apiKey) params.set("api_key", apiKey);
  if (email) params.set("email", email);
  params.set("tool", tool);
  return params;
}

async function esearch(term: string, retmax: number): Promise<string[]> {
  const params = buildParams({
    db: "pubmed",
    term,
    retmax: String(retmax),
    retmode: "json",
    sort: "date",
  });

  const res = await fetch(`${EUTILS_BASE}/esearch.fcgi?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PubMed検索(esearch)に失敗しました: HTTP ${res.status}`);
  }
  const data = await res.json();
  return (data?.esearchresult?.idlist as string[] | undefined) ?? [];
}

function parseAuthors(authorList: unknown): string[] {
  const authors = toArray<Record<string, unknown>>(
    (authorList as Record<string, unknown> | undefined)?.Author as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );

  return authors
    .map((author) => {
      if (author.CollectiveName) return textOf(author.CollectiveName);
      const last = textOf(author.LastName);
      const initials = textOf(author.Initials) || textOf(author.ForeName);
      const name = [last, initials].filter(Boolean).join(" ");
      return name;
    })
    .filter((name) => name.length > 0);
}

function parseAbstract(article: Record<string, unknown>): string {
  const abstractNode = article.Abstract as Record<string, unknown> | undefined;
  if (!abstractNode) return "";
  const parts = toArray(abstractNode.AbstractText);
  return parts
    .map((part) => {
      const label =
        typeof part === "object" && part !== null && "@_Label" in (part as Record<string, unknown>)
          ? String((part as Record<string, unknown>)["@_Label"])
          : "";
      const text = textOf(part);
      return label ? `${label}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

function parsePubDate(journal: Record<string, unknown> | undefined): string {
  const pubDate = (journal?.JournalIssue as Record<string, unknown> | undefined)?.PubDate as
    | Record<string, unknown>
    | undefined;
  if (!pubDate) return "";
  if (pubDate.MedlineDate) return textOf(pubDate.MedlineDate);
  const year = textOf(pubDate.Year);
  const month = textOf(pubDate.Month);
  const day = textOf(pubDate.Day);
  return [year, month, day].filter(Boolean).join("-");
}

function parseDoi(pubmedData: Record<string, unknown> | undefined): string | null {
  const ids = toArray<Record<string, unknown>>(
    (pubmedData?.ArticleIdList as Record<string, unknown> | undefined)?.ArticleId as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );
  const doiEntry = ids.find((id) => id["@_IdType"] === "doi");
  return doiEntry ? textOf(doiEntry) : null;
}

async function efetch(ids: string[]): Promise<ArticleResult[]> {
  if (ids.length === 0) return [];

  const params = buildParams({
    db: "pubmed",
    id: ids.join(","),
    rettype: "abstract",
    retmode: "xml",
  });

  const res = await fetch(`${EUTILS_BASE}/efetch.fcgi?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PubMed詳細取得(efetch)に失敗しました: HTTP ${res.status}`);
  }
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const doc = parser.parse(xml);

  const rawArticles = toArray<Record<string, unknown>>(
    doc?.PubmedArticleSet?.PubmedArticle as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );

  const results: ArticleResult[] = [];

  for (const raw of rawArticles) {
    try {
      const medline = raw.MedlineCitation as Record<string, unknown>;
      const article = medline.Article as Record<string, unknown>;
      const journal = article.Journal as Record<string, unknown> | undefined;
      const pmid = textOf(medline.PMID);

      results.push({
        source: "pubmed",
        sourceId: pmid,
        title: textOf(article.ArticleTitle),
        authors: parseAuthors(article.AuthorList),
        journal: textOf(journal?.Title) || textOf(journal?.ISOAbbreviation),
        pubDate: parsePubDate(journal),
        abstract: parseAbstract(article),
        doi: parseDoi(raw.PubmedData as Record<string, unknown> | undefined),
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    } catch {
      // 1件のパースに失敗しても全体は止めず、その論文だけスキップする
    }
  }

  return results;
}

export const pubmedSource: LiteratureSource = {
  id: "pubmed",
  name: "PubMed",
  async search(query: string, options?: SearchOptions) {
    const retmax = options?.retmax ?? 20;
    const ids = await esearch(query, retmax);
    return efetch(ids);
  },
};
