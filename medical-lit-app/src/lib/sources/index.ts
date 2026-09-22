import { pubmedSource } from "./pubmed";
import type { LiteratureSource } from "./types";

// 将来 J-STAGE や Europe PMC を追加する場合は、同じ LiteratureSource
// インターフェースを実装したファイルを作り、ここに登録するだけでよい。
export const SOURCES: Record<string, LiteratureSource> = {
  pubmed: pubmedSource,
};

export const DEFAULT_SOURCE = "pubmed";

export type { ArticleResult, SearchOptions, LiteratureSource } from "./types";
