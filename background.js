// Pipeline CRM — Background Service Worker v3
// Fix: open thread in existing LinkedIn tab WITHOUT causing a page reload

// ─── Tab Helpers ──────────────────────────────────────────────────────────────

function findLinkedInTab(cb) {
  chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' }, function(tabs) {
    if (chrome.runtime.lastError) { cb(null); return; }
    cb((tabs && tabs.length > 0) ? tabs[0] : null);
  });
}

function focusTab(tabId, windowId) {
  chrome.tabs.update(tabId, { active: true }, function() {
    if (chrome.runtime.lastError) return;
    if (windowId !== undefined) chrome.windows.update(windowId, { focused: true });
  });
}

function openLinkedIn(url) {
  url = url || 'https://www.linkedin.com/messaging/';
  // Check if LinkedIn is open anywhere (not just /messaging/)
  chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, function(tabs) {
    if (tabs && tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { url: url, active: true });
      if (tabs[0].windowId) chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: url });
    }
  });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
  if (!msg) return true;

  // ── Open Kanban board ──
  if (msg.type === 'OPEN_KANBAN') {
    chrome.tabs.create({ url: chrome.runtime.getURL('kanban.html') });
    sendResponse({ ok: true });
    return true;
  }

  // ── Open / focus LinkedIn ──
  if (msg.type === 'OPEN_LINKEDIN') {
    findLinkedInTab(function(tab) {
      if (tab) {
        focusTab(tab.id, tab.windowId);
      } else {
        chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/' });
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  // ── FIX 3: Open specific thread WITHOUT page reload ──────────────────────
  // Strategy:
  //   1. If a /messaging/ tab is open, send it a SELECT_LINKEDIN_THREAD message.
  //      The content script clicks the row — zero reload.
  //   2. If that message fails (thread not visible in list), navigate to the
  //      thread URL in the existing tab — still no new tab, but causes a reload.
  //   3. If no LinkedIn tab at all, open a new one.
  if (msg.type === 'OPEN_LINKEDIN_THREAD') {
    var threadId  = String(msg.threadId || '').trim();
    var targetUrl = threadId
      ? 'https://www.linkedin.com/messaging/thread/' + threadId + '/'
      : 'https://www.linkedin.com/messaging/';

    findLinkedInTab(function(tab) {
      if (!tab) {
        // No LinkedIn open — create fresh tab with correct URL
        chrome.tabs.create({ url: targetUrl });
        sendResponse({ ok: true, mode: 'new_tab' });
        return;
      }

      // LinkedIn tab exists — try to click the row (no reload)
      focusTab(tab.id, tab.windowId);

      chrome.tabs.sendMessage(tab.id, { type: 'SELECT_LINKEDIN_THREAD', threadId: threadId }, function(resp) {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          // Row wasn't visible in the list — navigate to URL in same tab
          // This reloads the page but keeps the same tab (no new tab)
          chrome.tabs.update(tab.id, { url: targetUrl });
          sendResponse({ ok: true, mode: 'url_navigate' });
        } else {
          sendResponse({ ok: true, mode: 'clicked_row' });
        }
      });
    });
    return true; // keep sendResponse open (async)
  }

  // ── Open sidebar panel in existing LinkedIn tab ──
  if (msg.type === 'OPEN_SIDEBAR_PANEL') {
    findLinkedInTab(function(tab) {
      if (!tab) {
        openLinkedIn('https://www.linkedin.com/messaging/');
        sendResponse({ ok: false, reason: 'no_tab' });
        return;
      }
      focusTab(tab.id, tab.windowId);
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDEBAR_PANEL' }, function(resp) {
        sendResponse({ ok: !chrome.runtime.lastError && resp && resp.ok });
      });
    });
    return true;
  }

  // ── Apply inbox filter ──
  if (msg.type === 'APPLY_INBOX_FILTER') {
    findLinkedInTab(function(tab) {
      if (!tab) { sendResponse({ ok: false }); return; }
      chrome.tabs.sendMessage(tab.id, { type: 'APPLY_INBOX_FILTER', stageId: msg.stageId }, function(resp) {
        sendResponse({ ok: !chrome.runtime.lastError });
      });
    });
    return true;
  }

  // ── Schedule alarm ──
  if (msg.type === 'SCHEDULE_ALARM') {
    chrome.alarms.create(msg.alarmName, { when: msg.alarmTime });
    chrome.storage.local.get(['alarmMeta'], function(r) {
      var meta = r.alarmMeta || {};
      meta[msg.alarmName] = { contactName: msg.contactName, threadId: msg.threadId };
      chrome.storage.local.set({ alarmMeta: meta });
    });
    sendResponse({ ok: true });
    return true;
  }

  return true;
});

// ─── Alarm Notifications ──────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (!alarm.name.startsWith('followup_')) return;
  chrome.storage.local.get(['alarmMeta'], function(r) {
    var meta = (r.alarmMeta || {})[alarm.name];
    var name = (meta && meta.contactName) || 'a prospect';
    chrome.notifications.create(alarm.name, {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'Follow-up — Pipeline CRM',
      message: 'Time to follow up with ' + name + ' on LinkedIn.',
      buttons: [{ title: 'Open LinkedIn' }],
      priority: 2
    });
  });
});

chrome.notifications.onButtonClicked.addListener(function() {
  findLinkedInTab(function(tab) {
    if (tab) focusTab(tab.id, tab.windowId);
    else chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/' });
  });
});
