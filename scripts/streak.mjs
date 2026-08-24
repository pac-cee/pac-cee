// Generates streak.terminal.svg — a mac-terminal-styled contribution streak card.
// Data comes straight from the GitHub GraphQL API; run daily by .github/workflows/metrics.yml.
import { writeFileSync } from "node:fs";

const LOGIN = "pac-cee";
const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) throw new Error("GH_TOKEN is not set");

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// Fetch every contribution day since account creation (calendar API caps at 1y per query)
const { user } = await gql(`query { user(login: "${LOGIN}") { createdAt } }`);
const days = new Map();
const now = new Date();
for (let from = new Date(user.createdAt); from < now; ) {
  const to = new Date(Math.min(from.getTime() + 364 * 86400e3, now.getTime()));
  const data = await gql(
    `query ($from: DateTime!, $to: DateTime!) {
      user(login: "${LOGIN}") {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar { weeks { contributionDays { date contributionCount } } }
        }
      }
    }`,
    { from: from.toISOString(), to: to.toISOString() },
  );
  for (const w of data.user.contributionsCollection.contributionCalendar.weeks)
    for (const d of w.contributionDays) days.set(d.date, d.contributionCount);
  from = to;
}

const today = now.toISOString().slice(0, 10);
const sorted = [...days.entries()].filter(([date]) => date <= today).sort();
const total = sorted.reduce((a, [, c]) => a + c, 0);
const firstActive = sorted.find(([, c]) => c > 0)?.[0];

// Longest streak
let longest = { len: 0, start: null, end: null };
let run = { len: 0, start: null };
for (const [date, count] of sorted) {
  if (count > 0) {
    if (!run.len) run.start = date;
    run.len++;
    if (run.len > longest.len) longest = { len: run.len, start: run.start, end: date };
  } else run = { len: 0, start: null };
}

// Current streak (a zero for today doesn't break it — the day isn't over)
let current = { len: 0, start: null, end: null };
const back = [...sorted].reverse();
let i = 0;
if (back[0]?.[0] === today && back[0][1] === 0) i = 1;
for (; i < back.length && back[i][1] > 0; i++) {
  if (!current.len) current.end = back[i][0];
  current.len++;
  current.start = back[i][0];
}

const fmt = (d, year = false) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
const n = (x) => x.toLocaleString("en-US");

const lines = [
  { t: [["#e6edf3", ` up ${n(total)} contributions`], ["#9198a1", `  (since ${fmt(firstActive, true)})`]] },
  { t: [["#e6edf3", " current streak  "], ["#39d353", `${current.len} days`, true], ["#9198a1", `   ${fmt(current.start)} → ${fmt(current.end)}`]] },
  { t: [["#e6edf3", " longest streak  "], ["#39d353", `${longest.len} days`, true], ["#9198a1", `  ${fmt(longest.start, true)} → ${fmt(longest.end, true)}`]] },
];

const W = 880, HEADER = 38, LH = 30, PAD = 26;
const H = HEADER + PAD + (lines.length + 2) * LH + PAD - 8;
let y = HEADER + PAD + LH - 10;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const tspan = (parts) => parts.map(([fill, text, bold]) => `<tspan fill="${fill}"${bold ? ' font-weight="bold"' : ""}>${esc(text)}</tspan>`).join("");

let body = `<text class="l l0" x="24" y="${y}"><tspan fill="#39d353" font-weight="bold">pac-cee@github</tspan><tspan fill="#e6edf3">:</tspan><tspan fill="#4493f8">~</tspan><tspan fill="#e6edf3"> $ uptime</tspan></text>`;
lines.forEach((line, idx) => {
  y += LH;
  body += `<text class="l l${idx + 1}" x="24" y="${y}">${tspan(line.t)}</text>`;
});
y += LH;
body += `<text class="l l${lines.length + 1}" x="24" y="${y}"><tspan fill="#39d353" font-weight="bold">pac-cee@github</tspan><tspan fill="#e6edf3">:</tspan><tspan fill="#4493f8">~</tspan><tspan fill="#e6edf3"> $ </tspan><tspan class="cursor" fill="#e6edf3">▊</tspan></text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="contribution streak">
<style>
  text { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 16px; }
  .title { font-size: 13px; }
  .l { animation: fade .4s ease-out backwards; }
  ${[...Array(lines.length + 2)].map((_, i) => `.l${i} { animation-delay: ${(i * 0.45).toFixed(2)}s; }`).join("\n  ")}
  .cursor { animation: blink 1.1s step-end infinite; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes blink { 50% { opacity: 0; } }
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="#161b22" stroke="#30363d"/>
<path d="M.5 12.5 a12 12 0 0 1 12-12 h${W - 25} a12 12 0 0 1 12 12 v${HEADER - 12} h-${W - 1} z" fill="#21262d"/>
<circle cx="24" cy="${HEADER / 2}" r="6" fill="#ff5f57"/>
<circle cx="46" cy="${HEADER / 2}" r="6" fill="#febc2e"/>
<circle cx="68" cy="${HEADER / 2}" r="6" fill="#28c840"/>
<text class="title" x="${W / 2}" y="${HEADER / 2 + 5}" text-anchor="middle" fill="#9198a1">pac-cee@github: ~ (zsh)</text>
${body}
</svg>`;

writeFileSync("streak.terminal.svg", svg);
console.log(`streak.terminal.svg written — total=${total} current=${current.len} longest=${longest.len}`);
