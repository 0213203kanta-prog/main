export type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export type Keyword = {
  id: string;
  term: string;
  category_id: string | null;
};

export type SavedArticle = {
  id: string;
  source: string;
  source_id: string;
  title: string;
  authors: string;
  journal: string;
  pub_date: string;
  abstract: string;
  doi: string | null;
  url: string;
  keyword_term: string | null;
  saved_at: string;
};
