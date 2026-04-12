export type KnowledgeNote = {
  id: string;
  name: string;
  body: string;
  trigger_description: string;
  parent_folder_id: string | null;
  macro: string | null;
  pinned_repo: string | null;
  created_at: string;
  created_by: {
    full_name: string;
    id: string;
    image_url: string;
  } | null;
};

export type KnowledgeFolder = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};

export type KnowledgeFilter = "mine" | "org" | "all";
