export interface GHRepoSearchResult {
  name: string;
  owner: string;
  full_name: string;
  description: string;
  html_url: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  private: boolean;
}

export interface GHCodeSearchResult {
  repo: string;
  owner: string;
  name: string;
  path: string;
  html_url: string;
  text_matches?: {
    snippet: string;
    matches: string[];
  }[];
}

export interface GHIssueSearchResult {
  number: number;
  title: string;
  state: string;
  repo: string;
  owner: string;
  createdAt: string;
  labels: { name: string }[];
  url: string;
}

export interface GHPRSearchResult {
  number: number;
  title: string;
  state: string;
  repo: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  labels: { name: string }[];
  url: string;
  mergeable: string;
}
