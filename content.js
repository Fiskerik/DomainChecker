// Pipeline CRM — Content Script v3
// Fixes: contact name detection, inbox list coloring, message handling

const STAGES = [
  { id: 'new',        label: 'New Lead',    color: '#94A3B8', bg: '#F1F5F9' },
  { id: 'contacted',  label: 'Contacted',   color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'interested', label: 'Interested',  color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'meeting',    label: 'Meeting Set', color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'proposal',   label: 'Proposal',    color: '#EF4444', bg: '#FEF2F2' },
  { id: 'won',        label: 'Won',         color: '#10B981', bg: '#ECFDF5' },
  { id: 'cold',       label: 'Cold',        color: '#CBD5E1', bg: '#F8FAFC' }
];
const stageMap = Object.fromEntries(STAGES.map(s => [s.id, s]));

let currentThreadId  = null;
let lastUrl          = location.href;
let inboxUpdateTimer = null;
let inboxFilterStage = 'all';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
  if (!document.getElementById('plcrm-sidebar')) injectSidebar();

  chrome.storage.local.get(['popupInboxStageFilter'], function(r) {
    inboxFilterStage = r.popupInboxStageFilter || 'all';
  });

  // Initial thread check + inbox paint — delay for LinkedIn SPA to render
  setTimeout(function() {
    checkCurrentThread();
    updateInboxColors();
  }, 1200);

  // Watch for SPA navigation and DOM changes (virtual scroll repaints list)
  var observer = new MutationObserver(function() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Thread changed — wait for new content to render then re-check
      setTimeout(checkCurrentThread, 600);
    }
    clearTimeout(inboxUpdateTimer);
    inboxUpdateTimer = setTimeout(updateInboxColors, 350);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 900);
}

// ─── FIX 1: Contact Name Detection ───────────────────────────────────────────
// Issue: name showed "This contact" because sanitizeContactName was too aggressive
// and timing was off. New approach: multiple strategies, longer delay, no
// blacklisting of real names.

function getContactName() {
  // Strategy 1: conversation header — most reliable when a thread is open
  var headerSelectors = [
    '.msg-entity-lockup__entity-title',
    '.msg-thread__topcard .t-bold',
    '.msg-thread__topcard h2',
    '.msg-s-message-group__profile-link',
    '[data-control-name="view_profile"] .t-bold'
  ];
  for (var i = 0; i < headerSelectors.length; i++) {
    var el = document.querySelector(headerSelectors[i]);
    var name = el && el.textContent.trim();
    if (name && name.length > 1 && !isGenericLabel(name)) return name;
  }

  // Strategy 2: selected row in the conversation list
  var selectedSelectors = [
    'li.active a .msg-conversation-listitem__participant-names',
    'li[aria-selected="true"] .msg-conversation-listitem__participant-names',
    'li.selected .msg-conversation-listitem__participant-names'
  ];
  for (var j = 0; j < selectedSelectors.length; j++) {
    var sel = document.querySelector(selectedSelectors[j]);
    var n = sel && sel.textContent.trim();
    if (n && n.length > 1 && !isGenericLabel(n)) return n;
  }

  // Strategy 3: match the active thread URL to a list item
  var threadId = getThreadId();
  if (threadId) {
    var link = document.querySelector('a[href*="/messaging/thread/' + threadId + '"]');
    if (link) {
      var nameEl = link.querySelector('.msg-conversation-listitem__participant-names') ||
                   link.querySelector('.msg-conversation-card__participant-names') ||
                   link.querySelector('[dir="ltr"]');
      if (nameEl) {
        var nm = nameEl.textContent.trim();
        // Strip unread count prefix like "(3) Name"
        nm = nm.replace(/^\(\d+\)\s*/, '').trim();
        if (nm && nm.length > 1 && !isGenericLabel(nm)) return nm;
      }
    }
  }

  // Strategy 4: page title (stable even across SPA navigation)
  // Format: "Name | LinkedIn" or "(3) Name | LinkedIn"
  var titleMatch = document.title.match(/^(?:\(\d+\)\s*)?(.+?)\s*[\|\-]\s*(LinkedIn|Messaging)/i);
  if (titleMatch) {
    var fromTitle = titleMatch[1].trim();
    if (fromTitle && !isGenericLabel(fromTitle)) return fromTitle;
  }

  return '';  // Return empty — caller will decide on fallback display
}

function getContactSubtitle() {
  var selectors = [
    '.msg-entity-lockup__subtitle span',
    '.msg-entity-lockup__subtitle',
    '.msg-thread__topcard .t-12',
    '.msg-s-message-group__occupation'
  ];
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    var t = el && el.textContent.trim();
    if (t && t.length > 2) return t;
  }
  return '';
}

function isGenericLabel(name) {
  var lower = name.toLowerCase();
  return lower === 'messaging' || lower === 'linkedin' || lower === 'inbox' ||
         lower === 'search' || lower.startsWith('(') && lower.endsWith(') messaging');
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2)
    .map(function(n) { return n[0] && n[0].toUpperCase(); }).join('') || '?';
}

// ─── FIX 2: Inbox List Colors ─────────────────────────────────────────────────
// Issue: colors only showed on the open message preview, not the left-side list.
// Root cause: CSS selector `.msg-conversation-card__row.msg-conversation-card__title-row`
// doesn't match LinkedIn's current DOM. Fix: style the <li> element directly —
// a colored left border + subtle tinted background. This is layout-proof.

function updateInboxColors() {
  chrome.storage.local.get(['threads'], function(result) {
    var threads = result.threads || {};

    document.querySelectorAll('a[href*="/messaging/thread/"]').forEach(function(link) {
      var m = link.href.match(/\/messaging\/thread\/([^/?#]+)/);
      if (!m) return;

      var threadId = m[1];
      var data     = threads[threadId];
      var li       = link.closest('li') || link.parentElement;
      if (!li) return;

      // Remove our previous injections cleanly
      li.style.removeProperty('border-left');
      li.style.removeProperty('background-color');
      li.querySelectorAll('.plcrm-stage-label').forEach(function(el) { el.remove(); });

      // Filter: hide/show based on inbox stage filter
      var stage = data && data.stage ? data.stage : 'new';
      li.style.display = shouldShow(stage) ? '' : 'none';

      // No stage assigned — don't color
      if (!data || !data.stage || data.stage === 'new') return;

      var s = stageMap[data.stage];
      if (!s) return;

      // ── The key fix: style the <li> directly ──
      // LinkedIn's list items are flex rows; a left border always renders.
      li.style.setProperty('border-left', '4px solid ' + s.color, 'important');
      li.style.setProperty('background-color', s.bg, 'important');

      // Inject a tiny stage pill inside the link for extra clarity
      if (!link.querySelector('.plcrm-stage-label')) {
        var pill = document.createElement('span');
        pill.className = 'plcrm-stage-label';
        pill.textContent = s.label;
        pill.style.cssText = [
          'position:absolute',
          'bottom:6px',
          'right:8px',
          'font-size:9px',
          'font-weight:700',
          'padding:1px 6px',
          'border-radius:8px',
          'background:' + s.color,
          'color:#fff',
          'pointer-events:none',
          'z-index:9999',
          'letter-spacing:0.03em',
          'white-space:nowrap'
        ].join(';');

        if (getComputedStyle(link).position === 'static') link.style.position = 'relative';
        link.appendChild(pill);
      }

      // Overdue: pulse the border
      var overdue = data.followUpDate && (function() {
        var d = new Date(data.followUpDate + 'T00:00:00');
        var t = new Date(); t.setHours(0,0,0,0);
        return d < t;
      })();
      if (overdue) li.classList.add('plcrm-li-overdue');
      else li.classList.remove('plcrm-li-overdue');
    });
  });
}

function shouldShow(stageId) {
  if (inboxFilterStage === 'all') return true;
  if (inboxFilterStage === 'unlabeled') return !stageId || stageId === 'new';
  return stageId === inboxFilterStage;
}

// ─── Thread Detection ─────────────────────────────────────────────────────────

function getThreadId() {
  var m = location.pathname.match(/\/messaging\/thread\/([^\/]+)/);
  return m ? m[1] : null;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadThreadData(threadId, cb) {
  chrome.storage.local.get(['threads'], function(r) { cb((r.threads || {})[threadId] || null); });
}

function saveThreadData(threadId, data, cb) {
  chrome.storage.local.get(['threads'], function(r) {
    var threads = r.threads || {};
    var existing = threads[threadId] || {};
    // Preserve history
    threads[threadId] = Object.assign({}, existing, data, { updatedAt: Date.now() });
    chrome.storage.local.set({ threads: threads }, function() { if (cb) cb(); });
  });
}

function loadFiles(threadId, cb) {
  chrome.storage.local.get(['files_' + threadId], function(r) { cb(r['files_' + threadId] || []); });
}

function saveFiles(threadId, files, cb) {
  var obj = {}; obj['files_' + threadId] = files;
  chrome.storage.local.set(obj, function() { if (cb) cb(); });
}

// ─── Sidebar HTML ─────────────────────────────────────────────────────────────

function buildSidebarHTML() {
  var stageBtns = STAGES.map(function(s) {
    return '<button class="plcrm-stage-btn" data-stage="' + s.id +
      '" style="--stage-color:' + s.color + ';--stage-bg:' + s.bg + '">' + s.label + '</button>';
  }).join('');

  return '<div id="plcrm-tab" title="Pipeline CRM"><span class="plcrm-tab-label">CRM</span></div>' +
    '<div id="plcrm-panel">' +
      '<div id="plcrm-header">' +
        '<div id="plcrm-avatar">?</div>' +
        '<div id="plcrm-contact-meta">' +
          '<div id="plcrm-contact-name">Select a conversation</div>' +
          '<div id="plcrm-contact-title"></div>' +
        '</div>' +
        '<button id="plcrm-info-btn" class="plcrm-icon-btn" title="Contact details">\u24d8</button>' +
        '<button id="plcrm-close" class="plcrm-icon-btn" title="Close">\u2715</button>' +
      '</div>' +

      '<div id="plcrm-contact-drawer" style="display:none">' +
        '<div class="plcrm-drawer-grid">' +
          '<label class="plcrm-field-label">Email</label>' +
          '<input id="plcrm-ci-email" class="plcrm-field-input" type="email" placeholder="name@company.com" />' +
          '<label class="plcrm-field-label">Phone</label>' +
          '<input id="plcrm-ci-phone" class="plcrm-field-input" type="tel" placeholder="+46 70 000 00 00" />' +
          '<label class="plcrm-field-label">Company</label>' +
          '<input id="plcrm-ci-company" class="plcrm-field-input" type="text" placeholder="Company name" />' +
          '<label class="plcrm-field-label">LinkedIn</label>' +
          '<input id="plcrm-ci-linkedin" class="plcrm-field-input" type="url" placeholder="linkedin.com/in/\u2026" />' +
        '</div>' +
        '<div class="plcrm-ci-hint">Saved with the Save button below</div>' +
      '</div>' +

      '<div id="plcrm-no-thread" class="plcrm-empty-state">' +
        '<div class="plcrm-empty-icon">\ud83d\udcac</div>' +
        '<div>Open a conversation<br>to start tracking</div>' +
      '</div>' +

      '<div id="plcrm-content" style="display:none">' +
        '<section class="plcrm-section">' +
          '<div class="plcrm-section-label">Deal stage</div>' +
          '<div id="plcrm-stages">' + stageBtns + '</div>' +
        '</section>' +

        '<section class="plcrm-section">' +
          '<div class="plcrm-section-label">Notes</div>' +
          '<textarea id="plcrm-notes" placeholder="Key objections, budget signals, next steps\u2026" rows="4"></textarea>' +
        '</section>' +

        '<section class="plcrm-section">' +
          '<div class="plcrm-section-label-row">' +
            '<span class="plcrm-section-label">Files</span>' +
            '<label id="plcrm-file-add-btn" class="plcrm-add-file-label">+ Attach</label>' +
            '<input id="plcrm-file-input" type="file" style="display:none" multiple />' +
          '</div>' +
          '<div id="plcrm-file-list"></div>' +
          '<div id="plcrm-file-hint"></div>' +
        '</section>' +

        '<section class="plcrm-section">' +
          '<div class="plcrm-section-label">History</div>' +
          '<div id="plcrm-history-list"><span style="color:#B0BBC6;font-size:11px">No history yet.</span></div>' +
        '</section>' +

        '<section class="plcrm-section">' +
          '<div class="plcrm-section-label">Follow-up reminder</div>' +
          '<div id="plcrm-date-row">' +
            '<input type="date" id="plcrm-followup-date" />' +
            '<button id="plcrm-clear-date" title="Clear">\u2715</button>' +
          '</div>' +
          '<div id="plcrm-followup-hint"></div>' +
        '</section>' +

        '<div id="plcrm-actions"><button id="plcrm-save-btn">Save</button></div>' +

        '<div id="plcrm-analytics-link">' +
          '<button id="plcrm-open-analytics">Weekly analytics</button>' +
        '</div>' +

        '<div id="plcrm-kanban-link">' +
          '<button id="plcrm-open-kanban">Open full Kanban board \u2197</button>' +
        '</div>' +

        '<div id="plcrm-meta"></div>' +
      '</div>' +

      '<div id="plcrm-analytics-modal" class="plcrm-modal-hidden">' +
        '<div class="plcrm-modal-backdrop"></div>' +
        '<div class="plcrm-modal-card" role="dialog" aria-modal="true" aria-labelledby="plcrm-analytics-title">' +
          '<div class="plcrm-modal-head">' +
            '<div>' +
              '<div id="plcrm-analytics-title">Weekly analytics</div>' +
              '<div id="plcrm-analytics-subtitle"></div>' +
            '</div>' +
            '<button id="plcrm-close-analytics" class="plcrm-icon-btn" title="Close">\u2715</button>' +
          '</div>' +
          '<div id="plcrm-analytics-body"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ─── Sidebar Injection & Events ───────────────────────────────────────────────

function injectSidebar() {
  var el = document.createElement('div');
  el.id = 'plcrm-sidebar';
  el.innerHTML = buildSidebarHTML();
  document.body.appendChild(el);
  attachSidebarEvents();
}

function attachSidebarEvents() {
  document.getElementById('plcrm-tab').addEventListener('click', toggleSidebar);
  document.getElementById('plcrm-close').addEventListener('click', function() { setSidebarOpen(false); });

  document.getElementById('plcrm-info-btn').addEventListener('click', function() {
    var drawer = document.getElementById('plcrm-contact-drawer');
    var open   = drawer.style.display !== 'none';
    drawer.style.display = open ? 'none' : 'block';
    document.getElementById('plcrm-info-btn').classList.toggle('plcrm-icon-active', !open);
  });

  ['plcrm-ci-email','plcrm-ci-phone','plcrm-ci-company','plcrm-ci-linkedin'].forEach(function(id) {
    document.getElementById(id).addEventListener('input', markUnsaved);
  });

  document.getElementById('plcrm-stages').addEventListener('click', function(e) {
    var btn = e.target.closest('.plcrm-stage-btn');
    if (!btn) return;
    selectStage(btn.dataset.stage);
    markUnsaved();
  });

  document.getElementById('plcrm-notes').addEventListener('input', markUnsaved);

  document.getElementById('plcrm-followup-date').addEventListener('change', function(e) {
    updateFollowupHint(e.target.value);
    markUnsaved();
  });
  document.getElementById('plcrm-clear-date').addEventListener('click', function() {
    document.getElementById('plcrm-followup-date').value = '';
    document.getElementById('plcrm-followup-hint').textContent = '';
    markUnsaved();
  });

  document.getElementById('plcrm-file-add-btn').addEventListener('click', function() {
    document.getElementById('plcrm-file-input').click();
  });
  document.getElementById('plcrm-file-input').addEventListener('change', handleFileAttach);

  document.getElementById('plcrm-save-btn').addEventListener('click', saveCurrentThread);
  document.getElementById('plcrm-open-analytics').addEventListener('click', openWeeklyAnalyticsModal);
  document.getElementById('plcrm-close-analytics').addEventListener('click', closeWeeklyAnalyticsModal);
  document.querySelector('#plcrm-analytics-modal .plcrm-modal-backdrop').addEventListener('click', closeWeeklyAnalyticsModal);
  document.getElementById('plcrm-open-kanban').addEventListener('click', function() {
    chrome.runtime.sendMessage({ type: 'OPEN_KANBAN' });
  });
}

function toggleSidebar() {
  var open = document.getElementById('plcrm-sidebar').classList.contains('plcrm-open');
  setSidebarOpen(!open);
}
function setSidebarOpen(open) {
  document.getElementById('plcrm-sidebar').classList.toggle('plcrm-open', open);
}
function selectStage(id) {
  document.querySelectorAll('.plcrm-stage-btn').forEach(function(b) {
    b.classList.toggle('plcrm-stage-active', b.dataset.stage === id);
  });
}
function markUnsaved() {
  document.getElementById('plcrm-save-btn').textContent = 'Save';
  document.getElementById('plcrm-save-btn').classList.remove('plcrm-saved');
}
function updateFollowupHint(dateStr) {
  var hint = document.getElementById('plcrm-followup-hint');
  if (!dateStr) { hint.textContent = ''; return; }
  var today = new Date(); today.setHours(0,0,0,0);
  var diff  = Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000);
  hint.textContent = diff < 0 ? Math.abs(diff) + 'd overdue' : diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : 'In ' + diff + ' days';
  hint.className   = 'plcrm-followup-hint ' + (diff < 0 ? 'plcrm-hint-overdue' : diff <= 1 ? 'plcrm-hint-soon' : 'plcrm-hint-future');
}

// ─── File Attachments ─────────────────────────────────────────────────────────

var FILE_SIZE_LIMIT = 2 * 1024 * 1024;

function handleFileAttach(e) {
  if (!currentThreadId) return;
  var files = Array.from(e.target.files);
  var hint  = document.getElementById('plcrm-file-hint');
  hint.textContent = '';
  e.target.value = '';

  var tooBig = files.filter(function(f) { return f.size > FILE_SIZE_LIMIT; });
  if (tooBig.length) {
    hint.textContent = tooBig.map(function(f) { return f.name; }).join(', ') + ' exceed 2 MB limit.';
    hint.className = 'plcrm-file-hint-warn';
  }
  var ok = files.filter(function(f) { return f.size <= FILE_SIZE_LIMIT; });
  if (!ok.length) return;

  loadFiles(currentThreadId, function(existing) {
    var remaining = ok.length;
    ok.forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        existing.push({ id: Date.now() + Math.random().toString(36).slice(2), name: file.name, type: file.type, size: file.size, data: ev.target.result, addedAt: Date.now() });
        remaining--;
        if (remaining === 0) saveFiles(currentThreadId, existing, function() { renderFileList(existing); });
      };
      reader.readAsDataURL(file);
    });
  });
}

function renderFileList(files) {
  var list = document.getElementById('plcrm-file-list');
  if (!files || !files.length) { list.innerHTML = ''; return; }
  list.innerHTML = files.map(function(f) {
    return '<div class="plcrm-file-chip" data-id="' + f.id + '">' +
      '<span class="plcrm-file-name" title="' + f.name + '">' + truncate(f.name, 24) + '</span>' +
      '<span class="plcrm-file-size">' + fmtSize(f.size) + '</span>' +
      '<button class="plcrm-file-dl" data-id="' + f.id + '" title="Download">\u2193</button>' +
      '<button class="plcrm-file-del" data-id="' + f.id + '" title="Remove">\u2715</button>' +
    '</div>';
  }).join('');

  list.querySelectorAll('.plcrm-file-dl').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var file = files.find(function(f) { return f.id === btn.dataset.id; });
      if (!file) return;
      var a = document.createElement('a'); a.href = file.data; a.download = file.name; a.click();
    });
  });
  list.querySelectorAll('.plcrm-file-del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var updated = files.filter(function(f) { return f.id !== btn.dataset.id; });
      saveFiles(currentThreadId, updated, function() { renderFileList(updated); });
    });
  });
}

function fmtSize(b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(1) + ' MB'; }
function truncate(s, n) { return s.length > n ? s.slice(0,n) + '\u2026' : s; }

// ─── History ──────────────────────────────────────────────────────────────────

function renderHistory(history) {
  var el = document.getElementById('plcrm-history-list');
  if (!history || !history.length) {
    el.innerHTML = '<span style="color:#B0BBC6;font-size:11px">No history yet.</span>';
    return;
  }
  el.innerHTML = history.slice(-5).reverse().map(function(item) {
    var from = stageMap[item.from] || { label: item.from, color: '#64748B' };
    var to   = stageMap[item.to]   || { label: item.to,   color: '#64748B' };
    var date = new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return '<div class="plcrm-history-item">' +
      '<div class="plcrm-history-date">' + date + '</div>' +
      '<div class="plcrm-history-text">' +
        '<span class="plcrm-history-stage" style="border-color:' + from.color + ';color:' + from.color + '">' + from.label + '</span>' +
        ' \u2192 ' +
        '<span class="plcrm-history-stage" style="border-color:' + to.color + ';color:' + to.color + '">' + to.label + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ─── Thread Load & Save ────────────────────────────────────────────────────────

function checkCurrentThread() {
  var threadId = getThreadId();
  if (!threadId) {
    if (currentThreadId !== null) { currentThreadId = null; showNoThread(); }
    return;
  }

  if (threadId !== currentThreadId) {
    currentThreadId = threadId;

    // Give LinkedIn time to render the contact name in the header
    // Try immediately, then retry with longer delay if empty
    tryLoadContact(threadId, 0);
  }
}

function tryLoadContact(threadId, attempt) {
  var name     = getContactName();
  var subtitle = getContactSubtitle();

  if (name && name.length > 1) {
    updateContactHeader(name, subtitle);
    loadAndPopulateSidebar(threadId);
  } else if (attempt < 5) {
    // Retry with increasing delay until name is available
    setTimeout(function() { tryLoadContact(threadId, attempt + 1); }, 300 + attempt * 200);
  } else {
    // Give up on name, still load sidebar data
    updateContactHeader('Contact', subtitle);
    loadAndPopulateSidebar(threadId);
  }
}

function showNoThread() {
  document.getElementById('plcrm-no-thread').style.display = 'flex';
  document.getElementById('plcrm-content').style.display   = 'none';
  document.getElementById('plcrm-contact-name').textContent = 'Select a conversation';
  document.getElementById('plcrm-contact-title').textContent = '';
  document.getElementById('plcrm-avatar').textContent = '?';
  document.getElementById('plcrm-contact-drawer').style.display = 'none';
  document.getElementById('plcrm-info-btn').classList.remove('plcrm-icon-active');
}

function updateContactHeader(name, subtitle) {
  document.getElementById('plcrm-contact-name').textContent  = name || 'Contact';
  document.getElementById('plcrm-contact-title').textContent = subtitle || '';
  document.getElementById('plcrm-avatar').textContent        = getInitials(name);
}

function loadAndPopulateSidebar(threadId) {
  loadThreadData(threadId, function(data) {
    document.getElementById('plcrm-no-thread').style.display = 'none';
    document.getElementById('plcrm-content').style.display   = 'flex';

    if (data) {
      selectStage(data.stage || 'new');
      document.getElementById('plcrm-notes').value          = data.notes || '';
      document.getElementById('plcrm-followup-date').value  = data.followUpDate || '';
      updateFollowupHint(data.followUpDate || '');
      document.getElementById('plcrm-ci-email').value    = data.email    || '';
      document.getElementById('plcrm-ci-phone').value    = data.phone    || '';
      document.getElementById('plcrm-ci-company').value  = data.company  || getContactSubtitle();
      document.getElementById('plcrm-ci-linkedin').value = data.linkedin || '';
      renderHistory(data.history || []);
      updateMeta(data.updatedAt);
      setSidebarOpen(true);
    } else {
      selectStage('new');
      document.getElementById('plcrm-notes').value = '';
      document.getElementById('plcrm-followup-date').value = '';
      document.getElementById('plcrm-followup-hint').textContent = '';
      ['plcrm-ci-email','plcrm-ci-phone','plcrm-ci-linkedin'].forEach(function(id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('plcrm-ci-company').value = getContactSubtitle();
      renderHistory([]);
      updateMeta(null);
    }

    document.getElementById('plcrm-contact-drawer').style.display = 'none';
    document.getElementById('plcrm-info-btn').classList.remove('plcrm-icon-active');
    document.getElementById('plcrm-save-btn').textContent = 'Save';
    document.getElementById('plcrm-save-btn').classList.remove('plcrm-saved');
  });

  loadFiles(threadId, function(files) { renderFileList(files); });
}

function saveCurrentThread() {
  if (!currentThreadId) return;
  var activeBtn = document.querySelector('.plcrm-stage-btn.plcrm-stage-active');
  var newStage  = activeBtn ? activeBtn.dataset.stage : 'new';

  loadThreadData(currentThreadId, function(existing) {
    var history = (existing && existing.history) ? existing.history : [];
    if (existing && existing.stage && existing.stage !== newStage) {
      history.push({ from: existing.stage, to: newStage, timestamp: Date.now() });
    }

    var data = {
      name:         document.getElementById('plcrm-contact-name').textContent,
      title:        document.getElementById('plcrm-contact-title').textContent,
      stage:        newStage,
      notes:        document.getElementById('plcrm-notes').value.trim(),
      followUpDate: document.getElementById('plcrm-followup-date').value,
      email:        document.getElementById('plcrm-ci-email').value.trim(),
      phone:        document.getElementById('plcrm-ci-phone').value.trim(),
      company:      document.getElementById('plcrm-ci-company').value.trim(),
      linkedin:     document.getElementById('plcrm-ci-linkedin').value.trim(),
      history:      history
    };

    saveThreadData(currentThreadId, data, function() {
      updateMeta(Date.now());
      renderHistory(data.history);
      var btn = document.getElementById('plcrm-save-btn');
      btn.textContent = 'Saved \u2713';
      btn.classList.add('plcrm-saved');
      // Immediately repaint inbox colors
      setTimeout(updateInboxColors, 100);
      if (data.followUpDate) scheduleAlarm(currentThreadId, data.name, data.followUpDate);
    });
  });
}

function updateMeta(ts) {
  var m = document.getElementById('plcrm-meta');
  if (!ts) { m.textContent = ''; return; }
  var d = new Date(ts);
  m.textContent = 'Saved ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

// ─── Weekly Analytics ─────────────────────────────────────────────────────────

function openWeeklyAnalyticsModal() {
  var modal = document.getElementById('plcrm-analytics-modal');
  if (!modal) return;
  renderWeeklyAnalytics(function() {
    modal.classList.remove('plcrm-modal-hidden');
  });
}

function closeWeeklyAnalyticsModal() {
  var modal = document.getElementById('plcrm-analytics-modal');
  if (!modal) return;
  modal.classList.add('plcrm-modal-hidden');
}

function renderWeeklyAnalytics(done) {
  chrome.storage.local.get(['threads'], function(result) {
    var threads = result.threads || {};
    var allDeals = Object.keys(threads).map(function(threadId) {
      return Object.assign({ threadId: threadId }, threads[threadId] || {});
    });

    var stats = computeWeeklyAnalytics(allDeals);
    var subtitle = document.getElementById('plcrm-analytics-subtitle');
    var body = document.getElementById('plcrm-analytics-body');

    subtitle.textContent = 'Last 7 days · ' + new Date().toLocaleDateString();
    body.innerHTML =
      '<div class="plcrm-analytics-grid">' +
        metricCardHTML('Active deals', stats.activeDeals) +
        metricCardHTML('Follow-ups due', stats.followUpsDue) +
        metricCardHTML('Overdue follow-ups', stats.overdueFollowUps) +
        metricCardHTML('Deals moved', stats.dealsMovedThisWeek) +
      '</div>' +
      '<div class="plcrm-analytics-block">' +
        '<div class="plcrm-analytics-block-title">Avg days in current stage</div>' +
        '<div class="plcrm-analytics-kv">' + (stats.avgDaysByStageHTML || '<span class="plcrm-muted">No stage timing data yet.</span>') + '</div>' +
      '</div>' +
      '<div class="plcrm-analytics-block">' +
        '<div class="plcrm-analytics-block-title">Pipeline distribution</div>' +
        '<div class="plcrm-analytics-kv">' + (stats.distributionHTML || '<span class="plcrm-muted">No saved deals yet.</span>') + '</div>' +
      '</div>';

    if (done) done();
  });
}

function metricCardHTML(label, value) {
  return '<div class="plcrm-analytics-card">' +
    '<div class="plcrm-analytics-label">' + label + '</div>' +
    '<div class="plcrm-analytics-value">' + value + '</div>' +
  '</div>';
}

function computeWeeklyAnalytics(deals) {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var weekAgoMs = now.getTime() - (7 * 24 * 60 * 60 * 1000);

  var activeDeals = 0;
  var followUpsDue = 0;
  var overdueFollowUps = 0;
  var dealsMovedThisWeek = 0;
  var stageCounts = {};
  var stageDurations = {};

  deals.forEach(function(deal) {
    var stage = deal.stage || 'new';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    if (stage !== 'won' && stage !== 'cold') activeDeals++;

    if (deal.followUpDate) {
      var followDate = new Date(deal.followUpDate + 'T00:00:00');
      if (!Number.isNaN(followDate.getTime())) {
        var diffDays = Math.round((followDate.getTime() - now.getTime()) / 86400000);
        if (diffDays >= 0 && diffDays <= 7) followUpsDue++;
        if (diffDays < 0) overdueFollowUps++;
      }
    }

    var history = Array.isArray(deal.history) ? deal.history : [];
    if (history.some(function(item) { return item && item.timestamp >= weekAgoMs; })) {
      dealsMovedThisWeek++;
    }

    var stageEnteredAt = inferStageEnteredAt(deal);
    if (stageEnteredAt) {
      var daysInStage = Math.max(0, Math.floor((now.getTime() - stageEnteredAt) / 86400000));
      if (!stageDurations[stage]) stageDurations[stage] = { total: 0, count: 0 };
      stageDurations[stage].total += daysInStage;
      stageDurations[stage].count += 1;
    }
  });

  return {
    activeDeals: activeDeals,
    followUpsDue: followUpsDue,
    overdueFollowUps: overdueFollowUps,
    dealsMovedThisWeek: dealsMovedThisWeek,
    avgDaysByStageHTML: buildAvgDaysByStageHTML(stageDurations),
    distributionHTML: buildDistributionHTML(stageCounts, deals.length)
  };
}

function inferStageEnteredAt(deal) {
  var stage = deal.stage || 'new';
  var history = Array.isArray(deal.history) ? deal.history.slice() : [];
  history.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
  for (var i = history.length - 1; i >= 0; i--) {
    var item = history[i];
    if (item && item.to === stage && item.timestamp) return item.timestamp;
  }
  return deal.updatedAt || null;
}

function buildAvgDaysByStageHTML(stageDurations) {
  var entries = Object.keys(stageDurations).map(function(stageId) {
    var stageData = stageDurations[stageId];
    var stageInfo = stageMap[stageId] || { label: stageId, color: '#64748B' };
    var avg = stageData.count ? (stageData.total / stageData.count).toFixed(1) : '0.0';
    return '<div class="plcrm-analytics-kv-row">' +
      '<span class="plcrm-stage-dot" style="background:' + stageInfo.color + '"></span>' +
      '<span class="plcrm-analytics-k">' + stageInfo.label + '</span>' +
      '<span class="plcrm-analytics-v">' + avg + 'd</span>' +
    '</div>';
  });
  return entries.join('');
}

function buildDistributionHTML(stageCounts, total) {
  if (!total) return '';
  var entries = Object.keys(stageCounts).sort(function(a, b) {
    return (stageCounts[b] || 0) - (stageCounts[a] || 0);
  }).map(function(stageId) {
    var stageInfo = stageMap[stageId] || { label: stageId, color: '#64748B' };
    var count = stageCounts[stageId];
    var pct = Math.round((count / total) * 100);
    return '<div class="plcrm-analytics-kv-row">' +
      '<span class="plcrm-stage-dot" style="background:' + stageInfo.color + '"></span>' +
      '<span class="plcrm-analytics-k">' + stageInfo.label + '</span>' +
      '<span class="plcrm-analytics-v">' + count + ' (' + pct + '%)</span>' +
    '</div>';
  });
  return entries.join('');
}

// ─── Alarms ───────────────────────────────────────────────────────────────────

function scheduleAlarm(threadId, name, dateStr) {
  var t = new Date(dateStr + 'T09:00:00').getTime();
  if (t <= Date.now()) return;
  chrome.runtime.sendMessage({ type: 'SCHEDULE_ALARM', alarmName: 'followup_' + threadId, alarmTime: t, contactName: name, threadId: threadId });
}

// ─── Message Listener (from background/popup) ─────────────────────────────────

chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
  if (!msg) return;

  if (msg.type === 'APPLY_INBOX_FILTER') {
    inboxFilterStage = msg.stageId || 'all';
    updateInboxColors();
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'SELECT_LINKEDIN_THREAD') {
    // Click the thread row in the already-open inbox (no page reload)
    var link = document.querySelector('a[href*="/messaging/thread/' + msg.threadId + '"]');
    if (link) {
      link.click();
      var li = link.closest('li');
      if (li) li.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return;
  }

  if (msg.type === 'OPEN_SIDEBAR_PANEL') {
    setSidebarOpen(true);
    sendResponse({ ok: true });
    return;
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
