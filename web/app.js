(() => {
const D = window.BLUEDOT_DATA, R = D.types.rapid, CT = D.types["career-transition"];
const grants = R.grants.map((g, i) => ({ ...g, i }));
const $ = (id) => document.getElementById(id);
const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
const k = (n) => n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k" : "$" + Math.round(n);
const pct = (x) => (x * 100).toFixed(1) + "%";

// ---------- categorisation (ordered; first match wins) ----------
const RULES = [
  ["Events & workshops", /\b(host(ing)?|organi[sz](e|ing)|run(ning)?)\b.*\b(event|workshop|meetup|briefing|panel|screening|talk|hackathon|forum|retreat|discussion|day|summit|dinner|salon|reading group|sprint|seminar|conference)|events? rfe|\b(workshop|meetup|hackathon|screening|panel|seminar|retreat)\b/i],
  ["Travel & conferences", /\b(travel|attend(ing)?|accommodation|flight|visa|registration|ea ?global|eag|conference|vision weekend|bay area|berkeley|trip|visit)\b/i],
  ["Compute, tools & subscriptions", /\b(compute|credits?|gpu|api|subscription|domain|cloud|software|tools?|hardware|laptop|llm access|tokens)\b/i],
  ["Stipend & living costs", /\b(stipend|salary|living|rent|housing|full[- ]time|part[- ]time|scholarship|fellowship|months?|income|cost of living|transition|sabbatical|internship|phd|master|thesis|finishing)\b/i],
  ["Community & org building", /\b(hub|chapter|community|group|club|organi[sz]ation|org\b|infrastructure|network|society|founder|startup|launch|build(ing)? a (new )?(org|team)|fieldbuilding|field-building|outreach)\b/i],
  ["Content & education", /\b(video|podcast|newsletter|course|curriculum|educat\w+|explainer|publish\w*|article|blog|book|documentary|translat\w+|website|content|materials?)\b/i],
];
const DEFAULT_CAT = "Research & projects";
const CATS = [...RULES.map((r) => r[0]), DEFAULT_CAT];
grants.forEach((g) => {
  const t = g.projectTitle + " " + (g.projectSummary || "");
  // Titles carry the strongest signal; test title first, then full text.
  g.cat = (RULES.find((r) => r[1].test(g.projectTitle)) || RULES.find((r) => r[1].test(t)) || [DEFAULT_CAT])[0];
});

// Stable ids (hash of content) so detail links survive data refreshes.
const fnv = (str) => { let x = 0x811c9dc5; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(36); };
const idSeen = {};
grants.forEach((g) => { let id = fnv([g.granteeName, g.projectTitle, g.monthLabel, g.amountUsd].join("|")); idSeen[id] = (idSeen[id] || 0) + 1; g.id = idSeen[id] > 1 ? id + "-" + idSeen[id] : id; });
const byId = new Map(grants.map((g) => [g.id, g]));

// ---------- dates ----------
const MON = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
grants.forEach((g) => { const [m, y] = g.monthLabel.split(" "); g.ym = +y * 12 + MON[m]; });
const ymLabel = (ym) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][ym % 12] + " " + String(Math.floor(ym / 12)).slice(2);

// ---------- stats helpers ----------
const sum = (a) => a.reduce((s, x) => s + x, 0);
const q = (sorted, p) => { const x = (sorted.length - 1) * p, l = Math.floor(x); return sorted[l] + (sorted[Math.min(l + 1, sorted.length - 1)] - sorted[l]) * (x - l); };
const describe = (vals) => { const s = [...vals].sort((a, b) => a - b); const n = s.length, m = sum(s) / n;
  return { n, total: sum(s), mean: m, sd: Math.sqrt(sum(s.map((x) => (x - m) ** 2)) / n), min: s[0], p25: q(s, .25), median: q(s, .5), p75: q(s, .75), p90: q(s, .9), p99: q(s, .99), max: s[n - 1] }; };
const amounts = grants.map((g) => g.amountUsd);
const S = describe(amounts);

// ---------- tables ----------
const table = (head, rows, numFrom = 1) => `<table><thead><tr>${head.map((h, i) => `<th class="${i >= numFrom ? "n" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i >= numFrom ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// ---------- header ----------
$("fetched").textContent = "Data fetched " + D.fetchedAt.slice(0, 10) + ".";
const cov = grants.length / R.stats.count;
$("coverage").innerHTML = `<b>Coverage caveat.</b> The public list contains <b>${grants.length.toLocaleString()}</b> rapid grants totalling <b>${usd(S.total)}</b>, but BlueDot's own stats count <b>${R.stats.count.toLocaleString()}</b> grants / <b>${usd(R.stats.totalAmountUsd)}</b>. So roughly ${pct(1 - cov)} of grants (${pct(1 - S.total / R.stats.totalAmountUsd)} of dollars) are not itemised publicly (likely opt-out). Everything below describes the public subset. Career-transition grants publish names only (no amounts); media and seed have no public data.`;
$("tiles").innerHTML = [
  [grants.length.toLocaleString(), "public rapid grants"],
  [k(S.total), "public $ awarded"],
  [usd(S.median), "median grant"],
  [usd(S.mean), "mean grant"],
  [R.stats.averageDaysToDecision.toFixed(1) + " days", "avg. time to decision"],
].map(([b, s]) => `<div class="tile"><b>${b}</b><span>${s}</span></div>`).join("");

// ---------- charts ----------
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const charts = [];
const mk = (id, cfgFn) => charts.push({ id, cfgFn, inst: null });
const base = () => ({ maintainAspectRatio: false, animation: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: css("--surface"), titleColor: css("--ink"), bodyColor: css("--ink2"), borderColor: css("--line"), borderWidth: 1, padding: 10 } },
  scales: { x: { grid: { display: false }, ticks: { color: css("--ink2") }, border: { color: css("--line") } }, y: { grid: { color: css("--grid") }, ticks: { color: css("--ink2") }, border: { display: false } } } });
const withScales = (o, f) => { f(o); return o; };

// (a) type
const byCat = CATS.map((c) => { const gs = grants.filter((g) => g.cat === c); return { c, n: gs.length, tot: sum(gs.map((g) => g.amountUsd)), d: gs.length ? describe(gs.map((g) => g.amountUsd)) : null }; });
const byCatN = [...byCat].sort((a, b) => b.n - a.n);
const ctShare = CT.stats.count / (CT.stats.count + R.stats.count);
$("a-desc").innerHTML = `By program, <b>Rapid Grants dominate</b>: ${R.stats.count.toLocaleString()} vs ${CT.stats.count} career-transition (${pct(1 - ctShare)} of grants), though career-transition grants are ~${Math.round((CT.stats.totalAmountUsd / CT.stats.count) / (R.stats.totalAmountUsd / R.stats.count))}× larger on average (${k(CT.stats.totalAmountUsd / CT.stats.count)} vs ${k(R.stats.totalAmountUsd / R.stats.count)}), so they hold ${pct(CT.stats.totalAmountUsd / (CT.stats.totalAmountUsd + R.stats.totalAmountUsd))} of dollars. Within rapid grants, the most common purpose is <b>${byCatN[0].c}</b> (${pct(byCatN[0].n / grants.length)}).`;
mk("a1", () => ({ type: "bar", data: { labels: ["Rapid", "Career transition"], datasets: [{ label: "Grants", data: [R.stats.count, CT.stats.count], backgroundColor: css("--c1"), borderRadius: 4, maxBarThickness: 56 }] }, options: withScales(base(), (o) => { o.plugins.title = { display: true, text: "Grants by program (BlueDot's own totals)", color: css("--ink") }; }) }));
mk("a2", () => ({ type: "bar", data: { labels: byCatN.map((x) => x.c), datasets: [{ label: "Grants", data: byCatN.map((x) => x.n), backgroundColor: css("--c1"), borderRadius: 4, maxBarThickness: 22 }] }, options: withScales({ ...base(), indexAxis: "y" }, (o) => { o.plugins.title = { display: true, text: "Rapid grants by inferred purpose", color: css("--ink") }; o.scales.x = { grid: { color: css("--grid") }, ticks: { color: css("--ink2") }, border: { display: false } }; o.scales.y = { grid: { display: false }, ticks: { color: css("--ink2") }, border: { color: css("--line") } }; }) }));

// (b) repeats
const people = new Map();
grants.forEach((g) => { const key = g.granteeName.trim().toLowerCase(); if (!people.has(key)) people.set(key, { name: g.granteeName.trim(), gs: [] }); people.get(key).gs.push(g); });
// Grantee profile: if ANY of a grantee's grants carries a LinkedIn profile URL, use it for the grantee.
const linkedinIn = (t) => ((t || "").match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:in|pub)\/[^\s,;()"'<>]+/gi) || [])[0] || null;
people.forEach((p) => { p.li = p.gs.map((g) => linkedinIn(g.link)).find(Boolean) || null; });
const liCell = (p) => p && p.li ? `<a class="lnk" href="${p.li.replace(/"/g, "%22")}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>` : '<span style="color:var(--muted)">–</span>';
const liLink = (p) => p.li ? ` <a class="cite" href="${p.li.replace(/"/g, "%22")}" target="_blank" rel="noopener noreferrer" title="LinkedIn profile" aria-label="LinkedIn profile of ${esc(p.name).replace(/"/g, "&quot;")}">[in]</a>` : "";
people.forEach((p, key) => { p.id = fnv(key); });
const P = [...people.values()].map((p) => ({ ...p, n: p.gs.length, tot: sum(p.gs.map((g) => g.amountUsd)) }));
const rep = P.filter((p) => p.n > 1);
const repGrants = sum(rep.map((p) => p.n)), repTot = sum(rep.map((p) => p.tot));
const maxN = Math.max(...P.map((p) => p.n));
const hist = {}; P.forEach((p) => (hist[p.n] = (hist[p.n] || 0) + 1));
$("b-desc").innerHTML = `<b>Yes.</b> ${P.length.toLocaleString()} unique names received ${grants.length.toLocaleString()} grants; <b>${rep.length}</b> (${pct(rep.length / P.length)}) received more than one, accounting for ${pct(repGrants / grants.length)} of grants and ${pct(repTot / S.total)} of dollars. The most frequent grantee has ${maxN} grants.`;
mk("b1", () => ({ type: "bar", data: { labels: Object.keys(hist).map((n) => n + (n == 1 ? " grant" : " grants")), datasets: [{ label: "Grantees", data: Object.values(hist), backgroundColor: css("--c1"), borderRadius: 4, maxBarThickness: 48 }] }, options: base() }));
const topFreq = [...P].sort((a, b) => b.n - a.n || b.tot - a.tot).slice(0, 8);
const topAmt = [...P].sort((a, b) => b.tot - a.tot).slice(0, 8);
// Citations [n] link to our own grant detail page (original title, summary, BlueDot link).
const cites = (p) => " " + [...p.gs].sort((a, b) => b.ym - a.ym || b.amountUsd - a.amountUsd).map((g, j) => `<a class="cite" href="#/grant/${g.id}" title="${esc(g.projectTitle.slice(0, 140)).replace(/"/g, "&quot;")} (${usd(g.amountUsd)}, ${g.monthLabel})">[${j + 1}]</a>`).join("");
const nameCell = (p) => esc(p.name) + liLink(p) + cites(p);
$("b-table").innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><b style="font-size:13px">Most grants</b>${table(["Grantee", "#", "Total"], topFreq.map((p) => [nameCell(p), p.n, usd(p.tot)]))}</div><div><b style="font-size:13px">Most dollars</b>${table(["Grantee", "#", "Total"], topAmt.map((p) => [nameCell(p), p.n, usd(p.tot)]))}</div></div><p class="d" style="margin:10px 0 0">[n] = one grant of that grantee, newest first; opens its detail page (hover for the title). [in] = LinkedIn profile, taken from any of the grantee's grants that lists one.</p>`;

// (c) size
const bins = [[0, 100], [100, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 3000], [3000, 5000], [5000, 10000], [10000, 1e9]];
const binLabel = ([a, b]) => b >= 1e9 ? "$10k+" : (a === 0 ? "<$" : "$") + (a === 0 ? "" : "") + (a === 0 ? k(b).slice(1) : k(a).slice(1) + "–" + k(b).slice(1));
const binCounts = bins.map(([a, b]) => amounts.filter((x) => (a === 0 ? x >= 0 : x >= a) && x < b).length);
const sortedDesc = [...amounts].sort((a, b) => b - a);
const top10 = sum(sortedDesc.slice(0, Math.ceil(grants.length * .1))) / S.total;
$("c-desc").innerHTML = `Right-skewed: the median grant is ${usd(S.median)} but the mean is ${usd(S.mean)}. The top 10% of grants hold ${pct(top10)} of all dollars; ${pct(amounts.filter((x) => x <= 1000).length / grants.length)} of grants are ≤ $1,000.`;
mk("c1", () => ({ type: "bar", data: { labels: bins.map(binLabel), datasets: [{ label: "Grants", data: binCounts, backgroundColor: css("--c1"), borderRadius: 4, maxBarThickness: 40 }] }, options: base() }));
$("c-table").innerHTML = table(["Metric", "USD"], [["Count", S.n.toLocaleString()], ["Total", usd(S.total)], ["Mean", usd(S.mean)], ["Std. dev.", usd(S.sd)], ["Min", usd(S.min)], ["25th pct", usd(S.p25)], ["Median", usd(S.median)], ["75th pct", usd(S.p75)], ["90th pct", usd(S.p90)], ["99th pct", usd(S.p99)], ["Max", usd(S.max)]]);

// (d) category
const catOrder = byCat.filter((x) => x.n).sort((a, b) => b.d.median - a.d.median);
mk("d1", () => ({ type: "bar", data: { labels: catOrder.map((x) => x.c), datasets: [{ label: "Median grant (USD)", data: catOrder.map((x) => x.d.median), backgroundColor: css("--c1"), borderRadius: 4, maxBarThickness: 24 }] }, options: withScales({ ...base(), indexAxis: "y" }, (o) => { o.plugins.title = { display: true, text: "Median grant size", color: css("--ink") }; o.scales.x = { grid: { color: css("--grid") }, ticks: { color: css("--ink2"), callback: (v) => k(v) }, border: { display: false } }; o.scales.y = { grid: { display: false }, ticks: { color: css("--ink2") }, border: { color: css("--line") } }; }) }));
const catTot = [...byCat].filter((x) => x.n).sort((a, b) => b.tot - a.tot);
mk("d2", () => ({ type: "bar", data: { labels: catTot.map((x) => x.c), datasets: [{ label: "Total awarded (USD)", data: catTot.map((x) => x.tot), backgroundColor: css("--c1"), borderRadius: 4, maxBarThickness: 24 }] }, options: withScales({ ...base(), indexAxis: "y" }, (o) => { o.plugins.title = { display: true, text: "Total $ awarded", color: css("--ink") }; o.scales.x = { grid: { color: css("--grid") }, ticks: { color: css("--ink2"), callback: (v) => k(v) }, border: { display: false } }; o.scales.y = { grid: { display: false }, ticks: { color: css("--ink2") }, border: { color: css("--line") } }; }) }));
$("d-table").innerHTML = table(["Category", "Grants", "Total", "Mean", "P25", "Median", "P75", "Max"], catOrder.map((x) => [x.c, x.n, usd(x.tot), usd(x.d.mean), usd(x.d.p25), usd(x.d.median), usd(x.d.p75), usd(x.d.max)]));
$("rules").innerHTML = "<p>First matching rule wins (title checked before summary); no match → “" + DEFAULT_CAT + "”.</p><ol>" + RULES.map((r) => `<li><b>${r[0]}</b>: <code>${esc(String(r[1]).slice(0, 220))}…</code></li>`).join("") + "</ol><p>Rules are in <code>web/app.js</code> (RULES) — edit and refresh.</p>";

// (e) growth
const yms = grants.map((g) => g.ym), minY = Math.min(...yms), maxY = Math.max(...yms);
const months = []; for (let m = minY; m <= maxY; m++) months.push(m);
const mCount = (m, c) => grants.filter((g) => g.ym === m && (!c || g.cat === c)).length;
const mAmt = months.map((m) => sum(grants.filter((g) => g.ym === m).map((g) => g.amountUsd)));
const mN = months.map((m) => mCount(m));
const peak = months[mN.indexOf(Math.max(...mN))];
const lastM = maxY;
$("e-desc").innerHTML = `Activity is tiny until Dec 2025, then ramps sharply: peak month is <b>${ymLabel(peak)}</b> with ${Math.max(...mN)} grants. ${ymLabel(lastM)} is a partial month (data fetched ${D.fetchedAt.slice(0, 10)}). Month = month awarded as labelled by BlueDot; grants before 2026 are few and possibly only those still listed.`;
const catColors = (c) => css("--c" + (CATS.indexOf(c) + 1));
$("e-legend").innerHTML = CATS.map((c) => `<span><i style="background:${catColors(c)}"></i>${c}</span>`).join("");
mk("e1", () => ({ type: "bar", data: { labels: months.map(ymLabel), datasets: CATS.map((c) => ({ label: c, data: months.map((m) => mCount(m, c)), backgroundColor: catColors(c), borderColor: css("--surface"), borderWidth: 1 })) }, options: withScales(base(), (o) => { o.scales.x.stacked = true; o.scales.y.stacked = true; o.plugins.tooltip.mode = "index"; o.plugins.tooltip.itemSort = (a, b) => b.raw - a.raw; o.scales.x.ticks.maxTicksLimit = 10; o.scales.y.title = { display: true, text: "Grants / month", color: css("--ink2") }; }) }));
mk("e2", () => ({ type: "bar", data: { labels: months.map(ymLabel), datasets: [{ label: "$ awarded", data: mAmt, backgroundColor: css("--c1"), borderRadius: 3 }] }, options: withScales(base(), (o) => { o.scales.x.ticks.maxTicksLimit = 10; o.scales.y.ticks.callback = (v) => k(v); o.plugins.tooltip.callbacks = { label: (c) => usd(c.raw) }; }) }));

// (f) intel
const round = amounts.filter((x) => x % 50 === 0).length / grants.length;
const modeMap = {}; amounts.forEach((x) => (modeMap[x] = (modeMap[x] || 0) + 1));
const topAmounts = Object.entries(modeMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
const recent = (ym0) => grants.filter((g) => g.ym >= ym0);
const firstHalf = grants.filter((g) => g.ym <= 2026 * 12 + 5), secondHalf = grants.filter((g) => g.ym >= 2026 * 12 + 6 && g.ym < lastM);
const events = byCat.find((x) => x.c === "Events & workshops");
const bigGrants = grants.filter((g) => g.amountUsd >= 10000).length;
const repeatIncr = rep.map((p) => { const s = [...p.gs].sort((a, b) => a.ym - b.ym || a.i - b.i); return s[s.length - 1].amountUsd - s[0].amountUsd; });
const growers = repeatIncr.filter((x) => x > 0).length;
const withSummary = grants.filter((g) => g.projectSummary).length / grants.length;
const withLink = grants.filter((g) => g.link).length / grants.length;
const ctPer = CT.stats.totalAmountUsd / CT.stats.count;
const full = months.filter((m) => m < lastM && m >= 2026 * 12);
const intel = [
  `<b>Scale:</b> rapid grants went from a handful in 2024–25 to ~${Math.round(sum(secondHalf.map(() => 1)) / Math.max(1, new Set(secondHalf.map((g) => g.ym)).size))} per month in Jul–Oct 2026. ${ymLabel(peak)} was the peak with ${Math.max(...mN)} grants and ${k(mAmt[months.indexOf(peak)])}.`,
  `<b>Small-ticket program:</b> ${pct(amounts.filter((x) => x <= 1000).length / grants.length)} of grants are ≤ $1k; only ${bigGrants} (${pct(bigGrants / grants.length)}) reach $10k+, yet they hold ${pct(sum(amounts.filter((x) => x >= 10000)) / S.total)} of dollars.`,
  `<b>Anchoring on round numbers:</b> ${pct(round)} of amounts are multiples of $50. Most common: ${topAmounts.map(([a, n]) => `${usd(+a)} (${n}×)`).join(", ")}. Suggests applicants anchor to a few price points (flights, registration, event kits).`,
  `<b>Where the money goes:</b> ${byCatN[0].c} is the biggest bucket by count (${pct(byCatN[0].n / grants.length)}) but has the lowest median (${usd(byCat.find((x) => x.c === DEFAULT_CAT).d.median)}). Stipends &amp; living costs have the highest median (${usd(byCat.find((x) => x.c === "Stipend & living costs").d.median)}); events &amp; workshops are the largest purpose-specific category by dollars (${k(events.tot)}, median ${usd(events.d.median)}).`,
  `<b>Repeat funding:</b> ${rep.length} people were funded more than once (${pct(rep.length / P.length)}); of them ${growers} received a larger later grant than their first. Repeat grantees get ${pct(repTot / S.total)} of dollars from ${pct(rep.length / P.length)} of people — a modest concentration, not a closed circle.`,
  `<b>Speed:</b> BlueDot reports an average of ${R.stats.averageDaysToDecision.toFixed(1)} days to decision for rapid grants vs ${CT.stats.averageDaysToDecision} for career-transition grants.`,
  `<b>Career transition is the big-ticket line:</b> ${CT.stats.count} grants worth ${k(CT.stats.totalAmountUsd)} (avg ${k(ctPer)}) — ${pct(CT.stats.totalAmountUsd / (CT.stats.totalAmountUsd + R.stats.totalAmountUsd))} of combined dollars from ${pct(ctShare)} of grants. Only ${CT.grantees.length} of ${CT.stats.count} are named publicly, and without amounts.`,
  `<b>Transparency gap:</b> ${pct(1 - cov)} of rapid grants and ${pct(1 - S.total / R.stats.totalAmountUsd)} of dollars aren't itemised publicly — the non-public grants average ${k((R.stats.totalAmountUsd - S.total) / (R.stats.count - grants.length))} vs ${k(S.mean)} for public ones, i.e. larger grants are disproportionately unlisted.`,
  `<b>Data quality:</b> only ${pct(withLink)} of public grants link to a profile/project and ${pct(withSummary)} carry a summary, so outcomes can't be tracked from this dataset alone.`,
];
$("intel").innerHTML = intel.map((t) => `<li>${t}</li>`).join("");

// ---------- render ----------
function render() { charts.forEach((c) => { c.inst && c.inst.destroy(); c.inst = new Chart($(c.id), c.cfgFn()); }); }

// ---------- browse + detail views ----------
const urls = (t) => (t || "").match(/https?:\/\/[^\s,;()]+/gi) || [];
const attr = (t) => esc(t).replace(/"/g, "&quot;");
const st = { q: "", cat: "", month: "", sort: "date", page: 0 };
const PAGE = 50;
const monthOpts = [...new Set(grants.map((g) => g.ym))].sort((a, b) => b - a);
$("view-browse").innerHTML = `<section class="card"><h2>Browse grants</h2><p class="d">Every public rapid grant. Click a title for the full detail.</p>
<div class="ctrls"><input id="f-q" type="search" placeholder="Search grantee, title or summary…" aria-label="Search">
<select id="f-cat" aria-label="Category"><option value="">All categories</option>${CATS.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
<select id="f-month" aria-label="Month"><option value="">All months</option>${monthOpts.map((m) => `<option value="${m}">${ymLabel(m)}</option>`).join("")}</select>
<select id="f-sort" aria-label="Sort"><option value="date">Newest first</option><option value="amt-d">Amount: high → low</option><option value="amt-a">Amount: low → high</option><option value="name">Grantee A–Z</option></select></div>
<div id="b-res"></div></section>`;
function browse() {
  const ql = st.q.trim().toLowerCase();
  let r = grants.filter((g) => (!st.cat || g.cat === st.cat) && (!st.month || g.ym === +st.month) && (!ql || (g.granteeName + " " + g.projectTitle + " " + (g.projectSummary || "")).toLowerCase().includes(ql)));
  const sorts = { date: (a, b) => b.ym - a.ym || b.amountUsd - a.amountUsd, "amt-d": (a, b) => b.amountUsd - a.amountUsd, "amt-a": (a, b) => a.amountUsd - b.amountUsd, name: (a, b) => a.granteeName.localeCompare(b.granteeName) };
  r.sort(sorts[st.sort]);
  const pages = Math.max(1, Math.ceil(r.length / PAGE)); st.page = Math.min(st.page, pages - 1);
  const rows = r.slice(st.page * PAGE, (st.page + 1) * PAGE).map((g) => [g.monthLabel, esc(g.granteeName), liCell(people.get(g.granteeName.trim().toLowerCase())), `<a class="t" href="#/grant/${g.id}">${esc(g.projectTitle.length > 140 ? g.projectTitle.slice(0, 140) + "…" : g.projectTitle)}</a>`, esc(g.cat), usd(g.amountUsd)]);
  $("b-res").innerHTML = `<p class="d">${r.length.toLocaleString()} grants · ${usd(sum(r.map((g) => g.amountUsd)))}</p>` + (rows.length ? table(["Month", "Grantee", "LinkedIn", "Project", "Category", "Amount"], rows, 5) : "<p>No grants match.</p>") +
    `<div class="pager"><button id="pg-p" ${st.page === 0 ? "disabled" : ""}>← Prev</button><span>Page ${st.page + 1} of ${pages}</span><button id="pg-n" ${st.page >= pages - 1 ? "disabled" : ""}>Next →</button></div>`;
  $("pg-p").onclick = () => { st.page--; browse(); window.scrollTo(0, 0); };
  $("pg-n").onclick = () => { st.page++; browse(); window.scrollTo(0, 0); };
}
$("f-q").oninput = (e) => { st.q = e.target.value; st.page = 0; browse(); };
$("f-cat").onchange = (e) => { st.cat = e.target.value; st.page = 0; browse(); };
$("f-month").onchange = (e) => { st.month = e.target.value; st.page = 0; browse(); };
$("f-sort").onchange = (e) => { st.sort = e.target.value; st.page = 0; browse(); };

function detail(id) {
  const g = byId.get(id);
  if (!g) { $("view-detail").innerHTML = `<section class="card detail"><h2>Grant not found</h2><p class="d">It may have been removed in a data refresh.</p><a class="lnk" href="#/grants">← Browse grants</a></section>`; return; }
  const p = people.get(g.granteeName.trim().toLowerCase());
  const others = p.gs.filter((x) => x.id !== g.id).sort((a, b) => b.ym - a.ym);
  const links = urls(g.link);
  $("view-detail").innerHTML = `<section class="card detail"><a class="lnk" href="javascript:history.length>1?history.back():(location.hash='#/grants')">← Back</a>
<div class="q" style="margin-top:12px">Rapid grant · ${esc(g.monthLabel)}</div><h2>${esc(g.projectTitle)}</h2>
<dl><dt>Grantee</dt><dd><a class="lnk" href="#/grantee/${p.id}">${esc(g.granteeName)}</a>${p.li ? ` · <a class="lnk" href="${attr(p.li)}" target="_blank" rel="noopener noreferrer">LinkedIn profile ↗</a>` : ""}</dd><dt>Amount</dt><dd><b>${usd(g.amountUsd)}</b></dd><dt>Month</dt><dd>${esc(g.monthLabel)}</dd><dt>Category</dt><dd>${esc(g.cat)} <span style="color:var(--muted)">(inferred)</span></dd>
<dt>Link</dt><dd>${links.length ? links.map((u) => `<a class="lnk" href="${attr(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join("<br>") : g.link ? esc(g.link) : '<span style="color:var(--muted)">none listed</span>'}</dd></dl>
${g.projectSummary ? `<div class="q">Summary</div><div class="sum">${esc(g.projectSummary)}</div>` : ""}
${others.length ? `<div class="q" style="margin-top:18px">Other grants to this grantee (${others.length})</div>${table(["Month", "Project", "Amount"], others.map((x) => [x.monthLabel, `<a class="t" href="#/grant/${x.id}">${esc(x.projectTitle.length > 120 ? x.projectTitle.slice(0, 120) + "…" : x.projectTitle)}</a>`, usd(x.amountUsd)]), 2)}` : ""}
<p class="d" style="margin-top:14px">Source: <a class="lnk" href="https://bluedot.org/grants/rapid" target="_blank" rel="noopener noreferrer">bluedot.org/grants/rapid</a></p></section>`;
}


// ---------- grantees list + grantee page ----------
const gs = { q: "", sort: "total", rep: false, page: 0 };
const peopleArr = [...people.values()].map((p) => ({ ...p, n: p.gs.length, tot: sum(p.gs.map((g) => g.amountUsd)), last: Math.max(...p.gs.map((g) => g.ym)) }));
$("view-grantees").innerHTML = `<section class="card"><h2>Grantees</h2><p class="d">${peopleArr.length.toLocaleString()} unique names (matched by exact name). Click a name to see all their grants.</p>
<div class="ctrls"><input id="g-q" type="search" placeholder="Search grantee name…" aria-label="Search grantees">
<select id="g-sort" aria-label="Sort"><option value="total">Total $: high → low</option><option value="n">Most grants</option><option value="recent">Most recent</option><option value="name">Name A–Z</option></select>
<label style="display:flex;align-items:center;gap:6px;color:var(--ink2);font-size:14px"><input id="g-rep" type="checkbox"> Repeat grantees only</label></div><div id="g-res"></div></section>`;
function grantees() {
  const ql = gs.q.trim().toLowerCase();
  const sorts = { total: (a, b) => b.tot - a.tot, n: (a, b) => b.n - a.n || b.tot - a.tot, recent: (a, b) => b.last - a.last || b.tot - a.tot, name: (a, b) => a.name.localeCompare(b.name) };
  const r = peopleArr.filter((p) => (!gs.rep || p.n > 1) && (!ql || p.name.toLowerCase().includes(ql))).sort(sorts[gs.sort]);
  const pages = Math.max(1, Math.ceil(r.length / PAGE)); gs.page = Math.min(gs.page, pages - 1);
  const rows = r.slice(gs.page * PAGE, (gs.page + 1) * PAGE).map((p) => [`<a class="t" href="#/grantee/${p.id}">${esc(p.name)}</a>`, liCell(p), p.n, usd(p.tot), usd(p.tot / p.n), ymLabel(p.last)]);
  $("g-res").innerHTML = `<p class="d">${r.length.toLocaleString()} grantees</p>` + (rows.length ? table(["Grantee", "LinkedIn", "Grants", "Total", "Avg", "Latest"], rows, 2) : "<p>No grantees match.</p>") +
    `<div class="pager"><button id="gp-p" ${gs.page === 0 ? "disabled" : ""}>← Prev</button><span>Page ${gs.page + 1} of ${pages}</span><button id="gp-n" ${gs.page >= pages - 1 ? "disabled" : ""}>Next →</button></div>`;
  $("gp-p").onclick = () => { gs.page--; grantees(); window.scrollTo(0, 0); };
  $("gp-n").onclick = () => { gs.page++; grantees(); window.scrollTo(0, 0); };
}
$("g-q").oninput = (e) => { gs.q = e.target.value; gs.page = 0; grantees(); };
$("g-sort").onchange = (e) => { gs.sort = e.target.value; gs.page = 0; grantees(); };
$("g-rep").onchange = (e) => { gs.rep = e.target.checked; gs.page = 0; grantees(); };

function granteePage(id) {
  const p = peopleArr.find((x) => x.id === id);
  if (!p) { $("view-detail").innerHTML = `<section class="card detail"><h2>Grantee not found</h2><a class="lnk" href="#/grantees">← Grantees</a></section>`; return; }
  const list = [...p.gs].sort((a, b) => b.ym - a.ym || b.amountUsd - a.amountUsd);
  $("view-detail").innerHTML = `<section class="card detail"><a class="lnk" href="#/grantees">← Grantees</a>
<div class="q" style="margin-top:12px">Grantee</div><h2>${esc(p.name)}</h2>
<dl><dt>Grants</dt><dd>${p.n}</dd><dt>Total</dt><dd><b>${usd(p.tot)}</b> (avg ${usd(p.tot / p.n)})</dd><dt>Active</dt><dd>${ymLabel(Math.min(...p.gs.map((g) => g.ym)))} – ${ymLabel(p.last)}</dd>
<dt>LinkedIn</dt><dd>${p.li ? `<a class="lnk" href="${attr(p.li)}" target="_blank" rel="noopener noreferrer">${esc(p.li)}</a>` : '<span style="color:var(--muted)">none listed</span>'}</dd></dl>
${table(["Month", "Project", "Category", "Amount"], list.map((x) => [x.monthLabel, `<a class="t" href="#/grant/${x.id}">${esc(x.projectTitle.length > 140 ? x.projectTitle.slice(0, 140) + "…" : x.projectTitle)}</a>`, esc(x.cat), usd(x.amountUsd)]), 3)}</section>`;
}

function route() {
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/grant\/([\w-]+)/), gm = hash.match(/^#\/grantee\/([\w-]+)/);
  const view = m || gm ? "detail" : hash.startsWith("#/grantees") ? "grantees" : hash.startsWith("#/grants") ? "browse" : "dash";
  ["dash", "browse", "grantees", "detail"].forEach((v) => ($("view-" + v).hidden = v !== view));
  $("nav-dash").classList.toggle("on", view === "dash");
  $("nav-browse").classList.toggle("on", view === "browse" || !!m);
  $("nav-grantees").classList.toggle("on", view === "grantees" || !!gm);
  if (view === "dash") render(); else if (view === "browse") browse(); else if (view === "grantees") grantees(); else if (gm) granteePage(gm[1]); else detail(m[1]);
  if (!(view === "dash" && st.keepScroll)) window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!$("view-dash").hidden) render(); });
})();
