#!/usr/bin/env node
// Fetches all public BlueDot grants data from the site's public tRPC endpoints.
// Usage: node scripts/fetch-grants.mjs
// Output: data/grants.json (raw, timestamped) and web/data.js (for the file:// friendly frontend)
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://bluedot.org/api/trpc";
const call = async (proc) => {
  const res = await fetch(`${BASE}/${proc}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${proc}: HTTP ${res.status}`);
  return (await res.json()).result.data;
};

// Grant types from https://bluedot.org/grants/<type>. Only some expose public data:
//  - rapid:             per-grant list (name, title, amount, month) + aggregate stats
//  - career-transition: roster of grantees (no amounts) + aggregate stats
//  - media, seed:       application-only pages, no public data endpoint (as of fetch time)
const [rapid, rapidStats, ctGrantees, ctStats] = await Promise.all([
  call("grants.getAllPublicRapidGrantees"),
  call("grants.getRapidGrantStats"),
  call("grants.getAllPublicCareerTransitionGrantees"),
  call("grants.getCareerTransitionGrantStats"),
]);

const out = {
  fetchedAt: new Date().toISOString(),
  source: BASE,
  types: {
    rapid: { grants: rapid, stats: rapidStats },
    "career-transition": { grantees: ctGrantees, stats: ctStats },
  },
};

await mkdir("data", { recursive: true });
await mkdir("web", { recursive: true });
await writeFile("data/grants.json", JSON.stringify(out, null, 2));
await writeFile("web/data.js", "window.BLUEDOT_DATA = " + JSON.stringify(out) + ";\n");
console.log(`rapid grants: ${rapid.length} public (site stats say ${rapidStats.count}, $${Math.round(rapidStats.totalAmountUsd)})`);
console.log(`career-transition grantees: ${ctGrantees.length} (stats: ${ctStats.count}, $${ctStats.totalAmountUsd})`);
