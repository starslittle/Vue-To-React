import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  GitHubRepoInfo,
  GitHubTreeItem,
  GitHubTreeResponse,
  GitHubBranchInfo,
  GitLabProjectInfo,
  GitLabTreeItem,
} from './interfaces';

const execPromise = promisify(exec);

@Injectable()
export class GitImporterService {
  private readonly logger = new Logger(GitImporterService.name);
  private readonly githubApiBaseUrl = 'https://api.github.com';
  private readonly githubRawContentBaseUrl =
    'https://raw.githubusercontent.com';
  private readonly githubToken = process.env.GITHUB_TOKEN; // Optional: for private repos or higher rate limits

  // GitLab Configuration
  private readonly gitlabApiBaseUrl = 'https://gitlab.com/api/v4';
  private readonly gitlabToken = process.env.GITLAB_TOKEN; // Optional: for private repos

  private readonly ignoreList = [
    '.git',
    'node_modules',
    '.DS_Store',
    'dist',
    'build',
    '.vscode',
    '.idea',
    '*.log',
    '.env',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    'coverage',
    '.nyc_output',
    '.cache',
    'tmp',
    'temp',
    '.tmp',
    '.temp',
    '*.tmp',
    '*.temp',
    '.next',
    '.nuxt',
    'out',
    '.output',
    '.vercel',
    '.netlify',
    '.sass-cache',
    '.eslintcache',
    '*.swp',
    '*.swo',
    '*~',
    '.thumbs.db',
    'thumbs.db',
    'desktop.ini',
    '.lock-wscript',
    '.wafpickle-*',
    '.*.pid',
    '.npm',
    '.yarn-integrity',
    'yarn-error.log',
    'yarn-debug.log',
    'npm-debug.log*',
    'npm-debug.log.*',
    'package-lock.json',
    'package-lock.json.bak',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
  ];

  async importLocalProject(localPath: string): Promise<string> {
    try {
      this.logger.log(`Starting to process local directory: ${localPath}`);

      const filesToRead: string[] = [];
      await this.findFilesInDir(localPath, localPath, filesToRead);

      let structure = `Repository Structure for ${localPath}:\n\n`;
      const allContent: string[] = [];

      for (const filePath of filesToRead) {
        const relativePath = path.relative(localPath, filePath);
        structure += `${relativePath}\n`;

        const fileContent = await fs.readFile(filePath, 'utf-8');
        allContent.push(`// File: ${relativePath}\n\n${fileContent}`);
      }

      this.logger.log(`Finished processing ${filesToRead.length} files.`);
      return `${structure}\n\n---\n\nComplete Code:\n\n${allContent.join(
        '\n\n---\n\n',
      )}`;
    } catch (error) {
      this.logger.error(
        `Failed to process local directory ${localPath}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to process local directory: ${error.message}`,
      );
    }
  }

  private async findFilesInDir(
    startPath: string,
    basePath: string,
    fileList: string[],
  ) {
    const entries = await fs.readdir(startPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(startPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      
      // 检查文件名和相对路径是否需要忽略
      if (this.isIgnored(entry.name) || this.isPathIgnored(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.findFilesInDir(fullPath, basePath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }
  }

  private isPathIgnored(relativePath: string): boolean {
    // 检查路径中是否包含需要忽略的目录
    const pathParts = relativePath.split(path.sep);
    return pathParts.some((part) => this.isIgnored(part));
  }

  async cloneAndReadRepo(repoUrl: string): Promise<string> {
    // Detect provider from URL
    const githubMatch = repoUrl.match(
      /github\.com[/:]([\w\-_.]+)\/([\w\-_.]+?)(?:\.git)?$/i,
    );
    if (githubMatch) {
      const [, owner, repoName] = githubMatch;
      this.logger.log(`Detected GitHub repository: ${owner}/${repoName}`);
      return this.getGithubRepoContent(owner, repoName);
    }

    const gitlabMatch = repoUrl.match(
      /(?:gitlab|jihulab)\.com[/:]([\w\-_./]+?)(?:\.git)?$/i,
    );
    if (gitlabMatch && gitlabMatch[1]) {
      const projectPath = gitlabMatch[1].replace(/\.git$/, '');
      const gitlabDomain = gitlabMatch[0].includes('jihulab.com')
        ? 'jihulab.com'
        : 'gitlab.com';
      this.logger.log(
        `Detected GitLab repository: ${projectPath} on ${gitlabDomain}`,
      );
      return this.getGitlabRepoContent(projectPath, gitlabDomain);
    }

    throw new BadRequestException(
      'Invalid or unsupported Git repository URL. Only GitHub and GitLab are supported.',
    );
  }

  private async getGithubRepoContent(
    owner: string,
    repoName: string,
  ): Promise<string> {
    this.logger.log(
      `Fetching content for ${owner}/${repoName} using GitHub API.`,
    );

    try {
      // Get default branch and latest commit SHA
      const repoInfo: GitHubRepoInfo = await this.fetchGithubApi<GitHubRepoInfo>(
        `${this.githubApiBaseUrl}/repos/${owner}/${repoName}`,
      );
      const defaultBranch = repoInfo.default_branch || 'main';
      const commitSha = repoInfo.parent?.sha; // Or get from default branch tree if 'parent' isn't available

      // Get recursive tree
      let treeResponse: GitHubTreeResponse;
      if (commitSha) {
        treeResponse = await this.fetchGithubApi<GitHubTreeResponse>(
          `${this.githubApiBaseUrl}/repos/${owner}/${repoName}/git/trees/${commitSha}?recursive=1`,
        );
      } else {
        // Fallback if commitSha is not directly available from repoInfo
        const branchInfo: GitHubBranchInfo =
          await this.fetchGithubApi<GitHubBranchInfo>(
            `${this.githubApiBaseUrl}/repos/${owner}/${repoName}/branches/${defaultBranch}`,
          );
        treeResponse = await this.fetchGithubApi<GitHubTreeResponse>(
          `${this.githubApiBaseUrl}/repos/${owner}/${repoName}/git/trees/${branchInfo.commit.sha}?recursive=1`,
        );
      }

      const filesToRead = treeResponse.tree.filter(
        (item: GitHubTreeItem) =>
          item.type === 'blob' && !this.isIgnored(item.path),
      );

      let structure = `Repository Structure for ${owner}/${repoName} (snapshot from ${defaultBranch} branch):\n\n`;
      const allContent: string[] = [];

      for (const file of filesToRead) {
        // Reconstruct simple structure based on path
        structure += `${file.path}\n`;

        // Fetch file content using raw content URL
        const fileContent = await this.fetchRawContent(
          `${this.githubRawContentBaseUrl}/${owner}/${repoName}/${defaultBranch}/${file.path}`,
        );
        allContent.push(`// File: ${file.path}\n\n${fileContent}`);
      }

      return `${structure}\n\n---\n\nComplete Code:\n\n${allContent.join(
        '\n\n---\n\n',
      )}`;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed to fetch repository content from GitHub API',
          error.stack,
        );
        throw new InternalServerErrorException(
          `Failed to fetch repository content: ${error.message}`,
        );
      } else {
        throw new InternalServerErrorException(
          'An unknown error occurred while fetching GitHub repository content.',
        );
      }
    }
  }

  private async getGitlabRepoContent(
    projectPath: string,
    gitlabDomain: string,
  ): Promise<string> {
    const encodedProjectPath = encodeURIComponent(projectPath);
    const currentGitlabApiBaseUrl = `https://${gitlabDomain}/api/v4`;
    this.logger.log(
      `Fetching content for GitLab project ${projectPath} on ${gitlabDomain}`,
    );
    this.logger.log(`Using GitLab API Base URL: ${currentGitlabApiBaseUrl}`);

    try {
      // 1. Get project info for default branch
      const projectInfo: GitLabProjectInfo =
        await this.fetchGitlabApi<GitLabProjectInfo>(
          `${currentGitlabApiBaseUrl}/projects/${encodedProjectPath}`,
        );
      const defaultBranch = projectInfo.default_branch;

      // 2. Get repository tree (paginated, get all pages)
      const treeResponse: GitLabTreeItem[] = await this.fetchGitlabApi<
        GitLabTreeItem[]
      >(
        `${currentGitlabApiBaseUrl}/projects/${encodedProjectPath}/repository/tree?recursive=true&per_page=100`,
      );

      const filesToRead = treeResponse.filter(
        (item: GitLabTreeItem) =>
          item.type === 'blob' && !this.isIgnored(item.path),
      );

      let structure = `Repository Structure for ${projectPath} (snapshot from ${defaultBranch} branch):\n\n`;
      const allContent: string[] = [];

      // 3. Fetch each file
      for (const file of filesToRead) {
        structure += `${file.path}\n`;
        const encodedFilePath = encodeURIComponent(file.path);
        const fileContent = await this.fetchGitlabApi<string>(
          `${currentGitlabApiBaseUrl}/projects/${encodedProjectPath}/repository/files/${encodedFilePath}/raw?ref=${defaultBranch}`,
          true, // raw content
        );
        allContent.push(`// File: ${file.path}\n\n${fileContent}`);
      }

      return `${structure}\n\n---\n\nComplete Code:\n\n${allContent.join(
        '\n\n---\n\n',
      )}`;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to fetch repository content from GitLab API for project ${projectPath}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          `Failed to fetch GitLab repository content: ${error.message}`,
        );
      } else {
        throw new InternalServerErrorException(
          'An unknown error occurred while fetching GitLab repository content.',
        );
      }
    }
  }

  private async fetchGithubApi<T>(url: string): Promise<T> {
    const urlString = url.replace(/\s+/g, ' ').trim();
    let curlCmd = `curl -sS --fail -H "Accept: application/vnd.github.v3+json" "${urlString}"`;
    if (this.githubToken) {
      curlCmd = `curl -sS --fail -H "Accept: application/vnd.github.v3+json" -H "Authorization: token ${this.githubToken}" "${urlString}"`;
    }
    const command = `chcp 65001 > nul && ${curlCmd}`;

    try {
      this.logger.log(`Executing GitHub API curl command: ${command}`);
      const { stdout } = await execPromise(command, { encoding: 'utf8' });
      return JSON.parse(stdout) as T;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string };
        const errorMessage = `GitHub API request failed for URL: ${url}. Message: ${execError.message}. Stderr: ${execError.stderr ?? 'N/A'}`;
        this.logger.error(errorMessage, execError.stack);
        throw new InternalServerErrorException(errorMessage);
      } else {
        throw new InternalServerErrorException(
          'An unknown error occurred while making GitHub API request.',
        );
      }
    }
  }

  private async fetchGitlabApi<T>(url: string, raw = false): Promise<T> {
    const headers = raw ? '' : '--header "Accept: application/json"';
    const cleanedUrl = url.replace(/\s+/g, ' ').trim();
    let curlCmd = `curl -sS --fail ${headers} "${cleanedUrl}"`;
    if (this.gitlabToken) {
      curlCmd = `curl -sS --fail --header "PRIVATE-TOKEN: ${this.gitlabToken}" ${headers} "${cleanedUrl}"`;
    }
    const command = `chcp 65001 > nul && ${curlCmd}`;

    try {
      this.logger.log(`Executing GitLab API curl command: ${command}`);
      const { stdout } = await execPromise(command, { encoding: 'utf8' });
      return raw ? (stdout as T) : (JSON.parse(stdout) as T);
    } catch (error: unknown) {
      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string };
        const errorMessage = `GitLab API request failed for URL: ${url}. Message: ${execError.message}. Stderr: ${execError.stderr ?? 'N/A'}`;
        this.logger.error(errorMessage, execError.stack);
        throw new InternalServerErrorException(errorMessage);
      } else {
        throw new InternalServerErrorException(
          'An unknown error occurred while making GitLab API request.',
        );
      }
    }
  }

  private async fetchRawContent(url: string): Promise<string> {
    const curlCmd = `curl -sS --fail "${url}"`;
    const command = `chcp 65001 > nul && ${curlCmd}`;
    try {
      this.logger.log(`Executing raw content curl command: ${command}`);
      const { stdout } = await execPromise(command, { encoding: 'utf8' });
      return stdout;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string };
        const errorMessage = `Raw content request failed for URL: ${url}. Message: ${execError.message}. Stderr: ${execError.stderr ?? 'N/A'}`;
        this.logger.error(errorMessage, execError.stack);
        throw new InternalServerErrorException(errorMessage);
      } else {
        throw new InternalServerErrorException(
          'An unknown error occurred while fetching raw content.',
        );
      }
    }
  }

  // Re-adding the fetchFileContent method as it's used by the controller
  async fetchFileContent(fileUrl: string): Promise<string> {
    this.logger.log(
      `Fetching content from ${fileUrl} using curl for fetch-file-content endpoint`,
    );
    try {
      const command = `chcp 65001 > nul && curl -sS --fail "${fileUrl}"`;
      const { stdout } = await execPromise(command, {
        encoding: 'utf8',
      });
      this.logger.log(`Successfully fetched content from ${fileUrl}`);
      return stdout;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string };
        const errorMessage = `Failed to fetch content from URL: ${fileUrl}. Message: ${execError.message}. Stderr: ${execError.stderr ?? 'N/A'}`;
        this.logger.error(errorMessage, execError.stack);
        throw new InternalServerErrorException(errorMessage);
      } else {
        throw new InternalServerErrorException(
          'An unknown error occurred while fetching file content.',
        );
      }
    }
  }

  private isIgnored(fileName: string): boolean {
    return this.ignoreList.some((pattern) => {
      // 精确匹配（不含通配符的情况）
      if (!pattern.includes('*')) {
        return fileName === pattern;
      }
      
      // 处理通配符模式
      const regexPattern = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(fileName);
    });
  }
}
