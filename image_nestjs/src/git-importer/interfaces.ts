export interface GitHubRepoInfo {
  default_branch: string;
  parent?: {
    sha: string;
  };
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface GitHubBranchInfo {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitLabProjectInfo {
  id: number;
  default_branch: string;
}

export interface GitLabTreeItem {
  path: string;
  type: 'blob' | 'tree';
} 