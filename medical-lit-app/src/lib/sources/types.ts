// 文献データベース(PubMed, 将来的にはJ-STAGEやEurope PMCなど)を
// 共通の形で扱うための型。新しいソースを追加するときはこの形式に合わせる。

export type ArticleResult = {
  source: string; // 例: "pubmed"
  sourceId: string; // そのソース内でのID(PubMedならPMID)
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  abstract: string;
  doi: string | null;
  url: string;
};

export type SearchOptions = {
  retmax?: number;
};

export interface LiteratureSource {
  id: string;
  name: string;
  search(query: string, options?: SearchOptions): Promise<ArticleResult[]>;
}
