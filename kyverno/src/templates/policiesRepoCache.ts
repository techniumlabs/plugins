import { KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/K8s/cluster';
import { parseAllDocuments } from 'yaml';

const REPO_OWNER = 'kyverno';
const REPO_NAME = 'policies';
const REPO_BRANCH = 'main';
const CACHE_KEY = 'kyverno-policies-repo-cache-v1';
const TEMPLATES_CACHE_KEY = 'kyverno-generating-policy-templates-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type GitHubTreeEntry = {
  path: string;
  type: 'blob' | 'tree' | string;
};

type GitHubTreeResponse = {
  tree?: GitHubTreeEntry[];
};

export type PoliciesRepoCache = {
  repo: string;
  branch: string;
  fetchedAt: number;
  folders: string[];
  files: string[];
};

export type GeneratingPolicyTemplate = {
  id: string;
  path: string;
  name: string;
  title: string;
  policy: Omit<KubeObjectInterface, 'metadata'> & {
    metadata: Partial<import('@kinvolk/headlamp-plugin/lib/K8s/KubeMetadata').KubeMetadata>;
  };
};

type GeneratingPolicyTemplatesCache = {
  repo: string;
  branch: string;
  fetchedAt: number;
  treeFetchedAt: number;
  templates: GeneratingPolicyTemplate[];
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hasFreshCache(cache: PoliciesRepoCache | null): cache is PoliciesRepoCache {
  if (!cache) {
    return false;
  }

  const isFresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  return isFresh && Array.isArray(cache.folders) && Array.isArray(cache.files);
}

function readCache(): PoliciesRepoCache | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PoliciesRepoCache;
  } catch {
    return null;
  }
}

async function fetchRepoTree(): Promise<GitHubTreeEntry[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}?recursive=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch repo tree (${response.status})`);
  }

  const data = (await response.json()) as GitHubTreeResponse;
  return data.tree ?? [];
}

function hasDotPrefixedFolder(path: string, isFolderPath = false): boolean {
  const parts = path.split('/').filter(Boolean);
  const folderParts = isFolderPath ? parts : parts.slice(0, -1);
  return folderParts.some(part => part.startsWith('.'));
}

function buildCache(entries: GitHubTreeEntry[]): PoliciesRepoCache {
  const folders = entries
    .filter(entry => entry.type === 'tree' && !hasDotPrefixedFolder(entry.path, true))
    .map(entry => entry.path)
    .sort((a, b) => a.localeCompare(b));

  const files = entries
    .filter(entry => entry.type === 'blob' && !hasDotPrefixedFolder(entry.path))
    .map(entry => entry.path)
    .sort((a, b) => a.localeCompare(b));

  return {
    repo: `${REPO_OWNER}/${REPO_NAME}`,
    branch: REPO_BRANCH,
    fetchedAt: Date.now(),
    folders,
    files,
  };
}

function writeCache(cache: PoliciesRepoCache): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Unable to store kyverno policies tree in localStorage.', error);
  }
}

export function readKyvernoPoliciesRepoCache(): PoliciesRepoCache | null {
  return readCache();
}

export async function ensureKyvernoPoliciesRepoCached(
  forceRefresh = false
): Promise<PoliciesRepoCache | null> {
  const currentCache = readCache();
  if (!forceRefresh && hasFreshCache(currentCache)) {
    return currentCache;
  }

  try {
    const entries = await fetchRepoTree();
    const cache = buildCache(entries);
    writeCache(cache);
    return cache;
  } catch (error) {
    console.error('Unable to fetch kyverno policies repository tree.', error);
    return currentCache;
  }
}

export function readAllFoldersFromLocalCache(): string[] {
  const cache = readCache();
  return cache?.folders ?? [];
}

export function readFilesForFolderFromLocalCache(folderPath: string): string[] {
  const cache = readCache();
  if (!cache) {
    return [];
  }

  const prefix = folderPath ? `${folderPath}/` : '';
  return cache.files.filter(path => path.startsWith(prefix));
}

export function readAllFoldersWithFilesFromLocalCache(): Record<string, string[]> {
  const cache = readCache();
  if (!cache) {
    return {};
  }

  const result: Record<string, string[]> = {};
  for (const folder of cache.folders) {
    result[folder] = readFilesForFolderFromLocalCache(folder);
  }

  return result;
}

function isYamlFile(path: string): boolean {
  return path.endsWith('.yaml') || path.endsWith('.yml');
}

function buildRawContentUrl(path: string): string {
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${path}`;
}

async function fetchYamlContent(path: string): Promise<string> {
  const response = await fetch(buildRawContentUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to fetch yaml file ${path} (${response.status})`);
  }

  return response.text();
}

function getTemplateTitle(policy: any, fallbackName: string): string {
  const title = policy?.metadata?.annotations?.['policies.kyverno.io/title'];
  if (typeof title === 'string' && title.trim().length > 0) {
    return title;
  }

  return fallbackName;
}

export type PolicyTemplate = GeneratingPolicyTemplate;

function parseGeneratingPoliciesFromYaml(
  filePath: string,
  yamlContent: string
): GeneratingPolicyTemplate[] {
  const docs = parseAllDocuments(yamlContent);
  const templates: GeneratingPolicyTemplate[] = [];

  docs.forEach((doc, index) => {
    const policy = doc.toJSON() as any;
    if (!policy || !policy.kind || !policy.apiVersion) {
      return;
    }

    const metadataName = policy?.metadata?.name;
    const fallbackName = filePath.split('/').pop()?.replace(/\.ya?ml$/i, '') || `policy-${index}`;
    const name = typeof metadataName === 'string' && metadataName.length > 0 ? metadataName : fallbackName;

    templates.push({
      id: `${filePath}#${index}`,
      path: filePath,
      name,
      title: getTemplateTitle(policy, name),
      policy,
    });
  });

  return templates;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

function readTemplatesCache(): GeneratingPolicyTemplatesCache | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(TEMPLATES_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GeneratingPolicyTemplatesCache;
  } catch {
    return null;
  }
}

function writeTemplatesCache(cache: GeneratingPolicyTemplatesCache): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Unable to store generating policy templates in localStorage.', error);
  }
}

export async function getPolicyTemplatesFromRepo(
  kindFilter?: string,
  forceRefresh = false
): Promise<PolicyTemplate[]> {
  const templatesCache = readTemplatesCache();
  if (!forceRefresh && templatesCache?.templates?.length) {
    return kindFilter
      ? templatesCache.templates.filter(t => t.policy?.kind === kindFilter)
      : templatesCache.templates;
  }

  const repoCache = await ensureKyvernoPoliciesRepoCached(forceRefresh);
  if (!repoCache) {
    return templatesCache?.templates ?? [];
  }

  const yamlFiles = repoCache.files.filter(isYamlFile);
  const parsedByFile = await mapWithConcurrency(yamlFiles, 8, async filePath => {
    try {
      const yamlContent = await fetchYamlContent(filePath);
      return parseGeneratingPoliciesFromYaml(filePath, yamlContent);
    } catch (error) {
      console.error(`Failed processing yaml file: ${filePath}`, error);
      return [] as GeneratingPolicyTemplate[];
    }
  });

  const allTemplates = parsedByFile
    .flat()
    .sort((a, b) => a.title.localeCompare(b.title) || a.name.localeCompare(b.name));

  writeTemplatesCache({
    repo: repoCache.repo,
    branch: repoCache.branch,
    fetchedAt: Date.now(),
    treeFetchedAt: repoCache.fetchedAt,
    templates: allTemplates,
  });

  return kindFilter ? allTemplates.filter(t => t.policy?.kind === kindFilter) : allTemplates;
}

export async function getGeneratingPolicyTemplatesFromRepo(
  forceRefresh = false
): Promise<GeneratingPolicyTemplate[]> {
  return getPolicyTemplatesFromRepo('GeneratingPolicy', forceRefresh);
}
