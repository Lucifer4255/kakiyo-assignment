type GHUser = {
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  blog: string | null;
};

type GHRepo = {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  updated_at: string;
};

function parseUsername(url: string): string {
  // Handles: https://github.com/username, github.com/username, username
  const match = url.match(/github\.com\/([^/?\s]+)/i);
  if (match) return match[1];
  // Plain username fallback
  return url.replace(/^[@/]/, "").split("/")[0];
}

export async function extractGitHub(url: string): Promise<string> {
  const username = parseUsername(url);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kakiyo-outreach",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`, { headers }),
    fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`, { headers }),
  ]);

  if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);

  const user: GHUser = await userRes.json();
  const repos: GHRepo[] = reposRes.ok ? await reposRes.json() : [];

  const ownRepos = repos.filter((r) => !r.fork);
  const topLangs = [...new Set(ownRepos.map((r) => r.language).filter(Boolean))].slice(0, 5);

  const lines = [
    `GitHub: ${username}`,
    user.name ? `Name: ${user.name}` : null,
    user.bio ? `Bio: ${user.bio}` : null,
    user.company ? `Company: ${user.company}` : null,
    user.location ? `Location: ${user.location}` : null,
    user.blog ? `Website: ${user.blog}` : null,
    `Public repos: ${user.public_repos} | Followers: ${user.followers}`,
    topLangs.length ? `Top languages: ${topLangs.join(", ")}` : null,
    "",
    "Recent / notable repos:",
    ...ownRepos.slice(0, 8).map(
      (r) =>
        `- ${r.name}${r.description ? `: ${r.description}` : ""} [${r.language ?? "N/A"}] ⭐${r.stargazers_count} (updated ${r.updated_at.slice(0, 10)})`
    ),
  ].filter((l) => l !== null);

  return lines.join("\n");
}
