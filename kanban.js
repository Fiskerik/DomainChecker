// Pipeline CRM — Kanban JS v3

const STAGES = [
  { id: 'new',        label: 'New Lead',    color: '#94A3B8' },
  { id: 'contacted',  label: 'Contacted',   color: '#3B82F6' },
  { id: 'interested', label: 'Interested',  color: '#8B5CF6' },
  { id: 'meeting',    label: 'Meeting Set', color: '#F59E0B' },
  { id: 'proposal',   label: 'Proposal',    color: '#EF4444' },
  { id: 'won',        label: 'Won',         color: '#10B981' },
  { id: 'cold',       label: 'Cold',        color: '#CBD5E1' }
];

let threads = {};
let draggingId = null;

function renderBoard() {
  chrome.storage.local.get(['threads'], (result) => {
    threads = result.threads || {};
    const entries = Object.entries(threads);
    document.getElementById('kb-sub').textContent =
      '— ' + entries.length + ' deal' + (entries.length !== 1 ? 's' : '');

    const board = document.getElementById('board');
    board.innerHTML = '';

    STAGES.forEach(stage => {
      const stageCards = entries
        .filter(([, d]) => (d.stage || 'new') === stage.id)
        .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

      const col = document.createElement('section');
      col.className = 'kb-col';
      col.dataset.stage = stage.id;
      col.style.setProperty('--sc', stage.color);

      col.innerHTML =
        '<div class="kb-col-header">' +
          '<span class="kb-col-dot"></span>' +
          esc(stage.label) +
          '<span class="kb-col-count">' + stageCards.length + '</span>' +
        '</div>' +
        '<div class="kb-list"></div>';

      const list = col.querySelector('.kb-list');

      if (!stageCards.length) {
        list.innerHTML = '<div class="kb-empty">No deals</div>';
      } else {
        stageCards.forEach(([id, data]) => {
          list.appendChild(makeCard(id, data, stage.color));
        });
      }

      wireDropZone(col);
      board.appendChild(col);
    });
  });
}

function makeCard(threadId, data, color) {
  const card = document.createElement('article');
  card.className = 'kb-card';
  card.draggable = true;
  card.dataset.id = threadId;
  card.style.setProperty('--sc', color);

  const due = dueBadge(data.followUpDate);

  card.innerHTML =
    '<div class="kb-card-name">' + esc(data.name || 'Unknown') + '</div>' +
    (data.title ? '<div class="kb-card-role">' + esc(trunc(data.title, 50)) + '</div>' : '') +
    (data.notes ? '<div class="kb-card-notes">' + esc(trunc(data.notes, 90)) + '</div>' : '') +
    '<div class="kb-card-footer">' +
      '<button class="kb-open-btn" data-id="' + threadId + '">Open ↗</button>' +
      (due ? '<span class="kb-due ' + (due.overdue ? 'overdue' : '') + '">' + due.label + '</span>' : '') +
    '</div>';

  card.querySelector('.kb-open-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_LINKEDIN_THREAD', threadId });
  });

  card.addEventListener('dragstart', e => {
    draggingId = threadId;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', threadId);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggingId = null;
  });

  return card;
}

function wireDropZone(col) {
  col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
  col.addEventListener('dragleave', e => {
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    const newStage = col.dataset.stage;
    if (!id || !newStage) return;
    moveCard(id, newStage);
  });
}

function moveCard(threadId, newStage) {
  const d = threads[threadId];
  if (!d) return;
  const prev = d.stage || 'new';
  if (prev === newStage) return;
  const history = d.history || [];
  history.push({ from: prev, to: newStage, timestamp: Date.now() });
  threads[threadId] = Object.assign({}, d, { stage: newStage, history, updatedAt: Date.now() });
  chrome.storage.local.set({ threads }, renderBoard);
}

function dueBadge(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(); t.setHours(0,0,0,0);
  const diff = Math.round((d - t) / 86400000);
  if (diff < 0)      return { label: Math.abs(diff) + 'd overdue', overdue: true };
  if (diff === 0)    return { label: 'Today', overdue: false };
  if (diff === 1)    return { label: 'Tomorrow', overdue: false };
  return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue: false };
}

function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : (s || ''); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('kb-refresh').addEventListener('click', renderBoard);
document.getElementById('kb-open-li').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_LINKEDIN' });
});

renderBoard();
