const STAGES = [
  { id: 'new', label: 'New Lead', color: '#94A3B8' },
  { id: 'contacted', label: 'Contacted', color: '#3B82F6' },
  { id: 'interested', label: 'Interested', color: '#8B5CF6' },
  { id: 'meeting', label: 'Meeting Set', color: '#F59E0B' },
  { id: 'proposal', label: 'Proposal', color: '#EF4444' },
  { id: 'won', label: 'Won', color: '#10B981' },
  { id: 'cold', label: 'Cold', color: '#CBD5E1' }
];

const stageMap = Object.fromEntries(STAGES.map(stage => [stage.id, stage]));
let threadsStore = {};
let draggingThreadId = null;

function renderBoard() {
  chrome.storage.local.get(['threads'], (result) => {
    threadsStore = result.threads || {};
    const board = document.getElementById('board');
    board.innerHTML = '';

    const threadEntries = Object.entries(threadsStore);
    document.getElementById('kb-sub').textContent = `${threadEntries.length} tracked conversation${threadEntries.length === 1 ? '' : 's'}`;

    STAGES.forEach((stage) => {
      const stageThreads = threadEntries
        .filter(([, data]) => (data.stage || 'new') === stage.id)
        .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

      const column = document.createElement('section');
      column.className = 'kb-column';
      column.dataset.stage = stage.id;
      column.innerHTML = `
        <div class="kb-column-header" style="--sc:${stage.color}">
          <span class="kb-stage-pill"></span>
          ${stage.label}
          <span class="kb-count">${stageThreads.length}</span>
        </div>
        <div class="kb-list"></div>
      `;

      const list = column.querySelector('.kb-list');
      if (stageThreads.length === 0) {
        list.innerHTML = '<div class="kb-empty">Drop cards here</div>';
      } else {
        stageThreads.forEach(([threadId, data]) => {
          list.appendChild(createCard(threadId, data, stage));
        });
      }

      wireColumnDrop(column);
      board.appendChild(column);
    });
  });
}

function createCard(threadId, data, stage) {
  const card = document.createElement('article');
  card.className = 'kb-card';
  card.draggable = true;
  card.dataset.threadId = threadId;
  card.style.setProperty('--sc', stage.color);

  const due = getFollowUpBadge(data.followUpDate);
  card.innerHTML = `
    <div class="kb-card-name">${escapeHtml(data.name || 'Unknown')}</div>
    ${data.title ? `<div class="kb-card-title">${escapeHtml(data.title)}</div>` : ''}
    ${data.notes ? `<div class="kb-card-notes">${escapeHtml(truncate(data.notes, 180))}</div>` : ''}
    <div class="kb-card-meta">
      <button class="kb-link kb-open-thread-btn" type="button" data-thread-id="${threadId}">Open thread ↗</button>
      ${due ? `<span class="kb-due ${due.overdue ? 'overdue' : ''}">${due.label}</span>` : ''}
    </div>
  `;

  const openThreadBtn = card.querySelector('.kb-open-thread-btn');
  if (openThreadBtn) {
    openThreadBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'OPEN_LINKEDIN_THREAD',
        threadId
      });
    });
  }

  card.addEventListener('dragstart', (event) => {
    draggingThreadId = threadId;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', threadId);
    console.log('[Pipeline CRM] Drag start:', threadId);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggingThreadId = null;
  });

  return card;
}

function wireColumnDrop(column) {
  column.addEventListener('dragover', (event) => {
    event.preventDefault();
    column.classList.add('drag-over');
  });

  column.addEventListener('dragleave', (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    column.classList.remove('drag-over');
  });

  column.addEventListener('drop', (event) => {
    event.preventDefault();
    column.classList.remove('drag-over');

    const droppedThreadId = event.dataTransfer.getData('text/plain') || draggingThreadId;
    const targetStage = column.dataset.stage;
    if (!droppedThreadId || !targetStage) return;

    updateStage(droppedThreadId, targetStage);
  });
}

function updateStage(threadId, newStage) {
  const thread = threadsStore[threadId];
  if (!thread) return;

  const previousStage = thread.stage || 'new';
  if (previousStage === newStage) return;

  const history = thread.history || [];
  history.push({
    from: previousStage,
    to: newStage,
    timestamp: Date.now()
  });

  threadsStore[threadId] = {
    ...thread,
    stage: newStage,
    history,
    updatedAt: Date.now()
  };

  console.log('[Pipeline CRM] Stage updated:', { threadId, previousStage, newStage });

  chrome.storage.local.set({ threads: threadsStore }, () => {
    renderBoard();
  });
}

function getFollowUpBadge(dateString) {
  if (!dateString) return null;
  const dueDate = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = Math.round((dueDate - today) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: 'Due today', overdue: false };
  if (diff === 1) return { label: 'Due tomorrow', overdue: false };
  return { label: dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue: false };
}

function truncate(text, maxLen) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.getElementById('kb-refresh').addEventListener('click', renderBoard);
document.getElementById('kb-open-li').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_LINKEDIN' });
});

renderBoard();
