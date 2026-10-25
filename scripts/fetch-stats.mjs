// Fetches the last year of contributions for the hero into scripts/data/gh-stats.json.
// Needs GITHUB_TOKEN; the Action's own token is enough, because the contribution graph is public
// (private contributions show as counts since "Include private contributions" is on).
// Run: GITHUB_TOKEN=$(gh auth token) pnpm stats
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data/gh-stats.json');
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is not set');

const query = `{ user(login: "AzimHsy") { contributionsCollection { contributionCalendar {
  totalContributions weeks { contributionDays { date contributionCount } } } } } }`;
const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'azimhsy-profile' },
  body: JSON.stringify({ query }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(`GitHub answered ${res.status}: ${JSON.stringify(json.errors ?? json)}`);

// Never overwrite good numbers with an empty calendar.
const cal = json.data?.user?.contributionsCollection?.contributionCalendar;
if (!cal?.weeks?.length) throw new Error('The contribution calendar came back empty');

fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
console.log(`${cal.totalContributions} contributions, ${cal.weeks.length} weeks, last day ${cal.weeks.at(-1).contributionDays.at(-1).date}`);
