export interface CardData {
  license?: string;
  license_link?: string;
  base_model?: string | string[];
  language?: string[];
  tags?: string[];
  datasets?: string[];
  pipeline_tag?: string;
}

export interface ModelSummary {
  id: string;
  modelId: string;
  author?: string;
  sha: string;
  downloads: number;
  likes: number;
  tags: string[];
  cardData?: CardData;
  pipeline_tag?: string;
  library_name?: string;
  lastModified?: string;
  createdAt: string;
  gated: boolean | string;
  private: boolean;
}
