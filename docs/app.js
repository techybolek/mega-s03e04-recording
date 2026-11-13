import { fetchIncidents, ack } from './api.js?v=49899c7';

const list = document.querySelector('[data-testid="incident-list"]');
const board = document.querySelector('[data-testid="board"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const panel = document.querySelector('[data-testid="incident-panel"]');

const byId = new Map();
const acked = new Set();
let selected = null; // incident id shown in the panel; held by id, so new rows never change it

const fmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const els = new Map(); // incident id -> its row element; rows are never rebuilt, only inserted

function makeRow(i) {
  const li = document.createElement('li');
  li.setAttribute('data-testid', 'incident-row');
  li.dataset.id = i.id;
  li.tabIndex = 0;
  li.className = `row ${i.severity}`;
  li.innerHTML = `<span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}">${fmt.format(new Date(i.openedAt))}</time>`;
  return li;
}

function render() {
  const rows = [...byId.values()].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  empty.hidden = rows.length > 0;
  rows.forEach((i, k) => {
    let el = els.get(i.id);
    if (!el) els.set(i.id, (el = makeRow(i)));
    if (list.children[k] !== el) list.insertBefore(el, list.children[k] ?? null);
    el.classList.toggle('selected', i.id === selected);
    const mark = el.querySelector('[data-testid="acked"]');
    if (acked.has(i.id) && !mark) el.insertAdjacentHTML('beforeend', '<span data-testid="acked" class="acked">acked</span>');
  });
}

function renderPanel() {
  const i = byId.get(selected);
  panel.hidden = !i;
  if (!i) return;
  panel.innerHTML = `<h2>${esc(i.id)}</h2>
    <p>${esc(i.service)} · ${esc(i.region)} · ${esc(i.severity)}</p>
    <p>${esc(i.summary)}</p>
    <p><time datetime="${esc(i.openedAt)}">${fmt.format(new Date(i.openedAt))}</time></p>
    ${
      acked.has(i.id)
        ? '<p class="acked">acked</p>'
        : '<button data-testid="panel-ack" type="button">Ack</button>'
    }`;
}

async function refresh() {
  try {
    const page = await fetchIncidents();
    for (const i of page.incidents) byId.set(i.id, i);
    loader.remove();
    board.setAttribute('aria-busy', 'false');
    render();
  } catch (e) {
    console.error(e);
  }
}

function open(e) {
  const row = e.target.closest('[data-testid="incident-row"]');
  if (!row) return;
  selected = row.dataset.id;
  render();
  renderPanel();
}
list.addEventListener('click', open);
list.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });

panel.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="panel-ack"]');
  if (!btn) return;
  const id = selected; // the incident the panel names, not whatever is under the pointer
  btn.disabled = true;
  try {
    await ack(id);
    acked.add(id);
    render();
    renderPanel();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
  }
});

await refresh();
setInterval(refresh, 2000);
