// Polls /api/status and updates the page. No framework, no build step.
//
// The one rule that shapes this file: a redraw must never disturb what you are reading. Rows are
// reconciled by id and updated in place (never rebuilt), an open log pane is the same <pre>
// element across redraws so its scroll position survives, rows do not reorder while a pane is
// open, and the window scroll position is restored if our DOM edits moved it.
const POLL_MS = 1000;

const fmtBytes = (n) => {
  if (n === null || n === undefined) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
};
const fmtNum = (n) => (n ?? 0).toLocaleString();
const since = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
};
/** Set text only when it changed, so we never touch a node the browser is mid-selection on. */
const setText = (node, text) => {
  if (node && node.textContent !== text) node.textContent = text;
};

// ── Expanded log panes ─────────────────────────────────────────────────────
// id -> { lastLine, pre, row }. The <pre> is created once and re-attached, never rebuilt.
const open = new Map();

function lineEl(line) {
  const cls = /\b(fail|failed|error|panic)\b/i.test(line.text) ? "err" : "";
  const time = new Date(line.at).toLocaleTimeString();
  return el("div", { className: cls }, el("span", { className: "t", textContent: `${time}  ` }), line.text);
}

async function pollLog(id) {
  const state = open.get(id);
  if (!state) return;
  try {
    const res = await fetch(`/api/logs/${encodeURIComponent(id)}?since=${state.lastLine}`);
    if (res.status === 404) {
      if (!state.lastLine) {
        state.pre.replaceChildren(
          el("div", { className: "t", textContent: "no console output on this node (the job ran elsewhere)" }),
        );
      }
      return;
    }
    const { lines } = await res.json();
    if (!lines.length) return;
    // Only follow the tail if you are already at the bottom; otherwise leave the view alone.
    const atBottom = state.pre.scrollTop + state.pre.clientHeight >= state.pre.scrollHeight - 24;
    if (state.placeholder) {
      state.pre.replaceChildren();
      state.placeholder = false;
    }
    state.pre.append(...lines.map(lineEl));
    state.lastLine = lines[lines.length - 1].n;
    if (atBottom) state.pre.scrollTop = state.pre.scrollHeight;
  } catch {
    // transient; the next tick retries
  }
}

function logRowFor(state) {
  return el("tr", { className: "logs" }, el("td", { colSpan: 9 }, state.pre));
}

function toggle(id, row) {
  const existing = open.get(id);
  if (existing) {
    open.delete(id);
    row.classList.remove("open");
    if (row.nextElementSibling?.classList.contains("logs")) row.nextElementSibling.remove();
    return;
  }
  const pre = el("pre", { className: "console" }, el("div", { className: "t", textContent: "loading…" }));
  const state = { lastLine: 0, pre, placeholder: true };
  open.set(id, state);
  row.classList.add("open");
  row.after(logRowFor(state));
  pollLog(id);
}

function opRow(id, cells) {
  const row = el("tr", { className: "op" }, el("td", {}, el("span", { className: "caret", textContent: "›" })), ...cells);
  row.dataset.id = id;
  row.addEventListener("click", () => toggle(id, row));
  return row;
}

/**
 * Keyed reconcile: update rows that are still present, append new ones, remove the rest.
 * An expanded row is never removed or reordered — losing it mid-read is exactly the thing this
 * dashboard must not do — and its log row always travels with it.
 */
function reconcile(tbody, items, keyOf, create, update) {
  const rows = new Map();
  for (const tr of tbody.querySelectorAll("tr.op")) rows.set(tr.dataset.id, tr);

  const wanted = new Set(items.map(keyOf));
  for (const [id, tr] of rows) {
    if (wanted.has(id) || open.has(id)) continue; // keep what is expanded, even if it aged out
    if (tr.nextElementSibling?.classList.contains("logs")) tr.nextElementSibling.remove();
    tr.remove();
    rows.delete(id);
  }

  // Append only: reordering rows under the cursor is a scroll jump of its own. New work appears
  // at the end of the table until the next full reload.
  for (const item of items) {
    const id = keyOf(item);
    const existing = rows.get(id);
    if (existing) {
      update(existing, item);
    } else {
      const row = create(item);
      tbody.append(row);
      const state = open.get(id);
      if (state) {
        row.classList.add("open");
        row.after(logRowFor(state)); // re-attach the same <pre>, scroll position intact
      }
    }
  }
}

// ── Rows ───────────────────────────────────────────────────────────────────

function sizeText(job) {
  const down = fmtBytes(job.downloadBytes ?? job.sizeBytes);
  const known = job.jsonBytes !== null && job.jsonBytes !== undefined;
  const plain = known ? fmtBytes(job.jsonBytes) : `~${fmtBytes(job.stagingBytes)}`;
  const ratio = known && job.downloadBytes ? ` (${(job.jsonBytes / job.downloadBytes).toFixed(1)}x)` : "";
  return `${down} → ${plain}${ratio}`;
}

function createJobRow(job) {
  return opRow(job.id, [
    el("td", {}, el("span", { className: `step ${job.step}`, textContent: job.step })),
    el("td", { className: "mono", title: job.url }, job.name.length > 52 ? `${job.name.slice(0, 49)}…` : job.name),
    el("td", { className: "num" }, sizeText(job)),
    el("td", { className: "hide-sm" }, el("div", { className: "bar" }, el("i"))),
    el("td", { className: "num" }, "—"),
    el("td", { className: "num" }, since(job.startedAt)),
    el("td", { className: "detail hide-sm" }, ""),
  ]);
}

function updateJobRow(row, job) {
  const td = row.children;
  const badge = td[1].firstElementChild;
  if (badge.textContent !== job.step) {
    badge.textContent = job.step;
    badge.className = `step ${job.step}`;
  }
  setText(td[3], sizeText(job));
  const pct = job.stepProgress === null ? null : Math.round(job.stepProgress * 100);
  const fill = td[4].querySelector("i");
  fill.style.width = `${pct ?? 100}%`;
  fill.style.opacity = pct === null ? 0.35 : 1;
  setText(td[5], pct === null ? "—" : `${pct}%`);
  setText(td[6], since(job.startedAt));
  setText(td[7], job.detail ?? "");
  td[7].title = job.detail ?? "";
}

function createRunRow(run) {
  return opRow(run.id, [
    el("td", {},
      el("span", { className: "mono", textContent: run.label.length > 56 ? `${run.label.slice(0, 53)}…` : run.label }),
      el("span", { className: "muted", textContent: ` ${run.kind}` })),
    el("td", {}, el("span", { className: `status ${run.status}`, textContent: run.status })),
    el("td", { className: "num" }, fmtNum(run.lines)),
    el("td", { className: "num" }, new Date(run.startedAt).toLocaleTimeString()),
    el("td", { className: "num" }, ""),
  ]);
}

function updateRunRow(row, run) {
  const td = row.children;
  const badge = td[2].firstElementChild;
  if (badge.textContent !== run.status) {
    badge.textContent = run.status;
    badge.className = `status ${run.status}`;
  }
  setText(td[3], fmtNum(run.lines));
  setText(
    td[5],
    run.endedAt ? `${((new Date(run.endedAt) - new Date(run.startedAt)) / 1000).toFixed(1)}s` : since(run.startedAt),
  );
}

// ── Nodes ──────────────────────────────────────────────────────────────────

function nodeSummary(node) {
  return (
    `${node.jobs.length}/${node.limits.maxConcurrentFiles} files` +
    `, ${node.tasks.length}/${node.limits.maxConcurrentTasks} tasks` +
    (node.storage
      ? ` · staging ${fmtBytes(node.storage.reservedBytes)} / ${fmtBytes(node.storage.totalBytes)} (${node.storage.expansionRatio}x assumed)`
      : "") +
    ` · up ${since(node.startedAt)}`
  );
}

function createNodeCard(node, isSelf) {
  const card = el("div", { className: "node" });
  card.dataset.node = node.nodeId;
  card.append(
    el("h3", {},
      el("span", { className: "dot" }),
      el("span", { className: "mono", textContent: node.nodeId }),
      el("span", { className: "tag", textContent: node.role }),
      isSelf ? el("span", { className: "tag self", textContent: "this node" }) : null,
      el("span", { className: "muted", style: "font-weight:400", textContent: nodeSummary(node) })),
    el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { style: "width:18px" }, ""), el("th", {}, "Step"), el("th", {}, "File"),
        el("th", { className: "num" }, "Download → Uncompressed"), el("th", { className: "hide-sm" }, "Progress"),
        el("th", { className: "num" }, "%"), el("th", { className: "num" }, "Elapsed"),
        el("th", { className: "hide-sm" }, "Detail"))),
      el("tbody", {})),
    el("div", { className: "empty" }),
  );
  return card;
}

function updateNodeCard(card, node) {
  const head = card.querySelector("h3");
  head.querySelector(".dot").className = `dot ${Date.now() - new Date(node.updatedAt).getTime() > 15000 ? "stale" : ""}`;
  setText(head.querySelector(".tag"), node.role);
  setText(head.lastElementChild, nodeSummary(node));

  const table = card.querySelector("table");
  const empty = card.querySelector(".empty");
  const hasJobs = node.jobs.length > 0 || [...open.keys()].some((id) => card.querySelector(`tr[data-id="${CSS.escape(id)}"]`));
  table.style.display = hasJobs ? "" : "none";
  empty.style.display = hasJobs ? "none" : "";
  setText(empty, node.tasks.length ? `running ${node.tasks.length} management task(s)` : "idle");
  reconcile(table.querySelector("tbody"), node.jobs, (j) => j.id, createJobRow, updateJobRow);
}

function renderNodes(s) {
  const container = document.getElementById("nodes");
  const cards = new Map([...container.querySelectorAll(".node")].map((c) => [c.dataset.node, c]));
  const wanted = new Set(s.nodes.map((n) => n.nodeId));
  for (const [id, card] of cards) {
    // Keep a card that holds an expanded log pane, even if that node just went away.
    if (wanted.has(id) || card.querySelector("tr.logs")) continue;
    card.remove();
    cards.delete(id);
  }
  for (const node of s.nodes) {
    let card = cards.get(node.nodeId);
    if (!card) {
      card = createNodeCard(node, node.nodeId === s.thisNode);
      container.append(card);
    }
    updateNodeCard(card, node);
  }
}

// ── Render ─────────────────────────────────────────────────────────────────

function stat(container, key, n, label) {
  let node = container.querySelector(`[data-stat="${key}"]`);
  if (!node) {
    node = el("div", { className: "stat" }, el("div", { className: "n" }), el("div", { className: "l", textContent: label }));
    node.dataset.stat = key;
    container.append(node);
  }
  setText(node.firstElementChild, n);
}

function render(s) {
  setText(document.getElementById("this-node"), s.thisNode);
  setText(document.getElementById("updated"), `updated ${new Date(s.fetchedAt).toLocaleTimeString()}`);
  setText(document.getElementById("log-dir"), `console output in ${s.logDir} (cleared on restart)`);

  const p = document.getElementById("progress");
  stat(p, "tasks", fmtNum(s.progress.pendingTasks), "tasks pending");
  stat(p, "files", fmtNum(s.progress.pendingFiles), "files pending");
  stat(p, "running", fmtNum(s.runningJobs), "files running");
  stat(p, "failed", fmtNum(s.progress.failedFiles), "files failed");
  stat(p, "seen", fmtNum(s.seenUrls), "urls evaluated");
  stat(p, "nodes", fmtNum(s.nodes.length), "live nodes");

  renderNodes(s);
  reconcile(document.getElementById("runs"), s.runs, (r) => r.id, createRunRow, updateRunRow);

  const tbody = document.getElementById("queues");
  const rows = new Map([...tbody.querySelectorAll("tr")].map((tr) => [tr.dataset.key, tr]));
  for (const q of [...s.queues.tasks, ...s.queues.files]) {
    let tr = rows.get(q.key);
    if (!tr) {
      tr = el("tr", {}, el("td", { className: "mono", textContent: q.key }), el("td", { className: "num" }),
        el("td", { className: "num" }), el("td", { className: "num" }));
      tr.dataset.key = q.key;
      tbody.append(tr);
    }
    setText(tr.children[1], fmtNum(q.waiting));
    setText(tr.children[2], fmtNum(q.inflight));
    setText(tr.children[3], fmtNum(q.dead));
    tr.children[3].style.color = q.dead ? "var(--bad)" : "";
  }
}

async function tick() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    // Belt and braces: if any of the above still shifted layout, put the page back where it was.
    const y = window.scrollY;
    render(data);
    if (window.scrollY !== y) window.scrollTo(0, y);
  } catch (e) {
    setText(document.getElementById("updated"), `disconnected — ${e.message}`);
  }
}

tick();
setInterval(tick, POLL_MS);
setInterval(() => { for (const id of open.keys()) pollLog(id); }, POLL_MS);
