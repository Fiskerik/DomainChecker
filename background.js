// Pipeline CRM — Background Service Worker
// Handles follow-up alarms, browser notifications, and LinkedIn tab focusing

function openOrFocusLinkedIn(url = 'https://www.linkedin.com/messaging/') {
  chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.log('[Pipeline CRM] Could not query tabs:', chrome.runtime.lastError.message);
      chrome.tabs.create({ url });
      return;
    }

    const existingTab = tabs.find((tab) => tab && tab.id);
    if (existingTab?.id) {
      chrome.tabs.update(existingTab.id, { url, active: true }, (updatedTab) => {
        if (chrome.runtime.lastError) {
          console.log('[Pipeline CRM] Could not update existing tab, opening new tab:', chrome.runtime.lastError.message);
          chrome.tabs.create({ url });
          return;
        }
        if (updatedTab?.windowId !== undefined) {
          chrome.windows.update(updatedTab.windowId, { focused: true });
        }
      });
      return;
    }

    chrome.tabs.create({ url });
  });
}

function findLinkedInMessagingTab(callback) {
  chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.log('[Pipeline CRM] Could not query messaging tabs:', chrome.runtime.lastError.message);
      callback(null);
      return;
    }
    const tab = tabs.find((item) => item && item.id);
    callback(tab || null);
  });
}

function focusTab(tabId, windowId) {
  if (!tabId) return;
  chrome.tabs.update(tabId, { active: true }, () => {
    if (chrome.runtime.lastError) {
      console.log('[Pipeline CRM] Could not focus tab:', chrome.runtime.lastError.message);
    }
  });
  if (windowId !== undefined) {
    chrome.windows.update(windowId, { focused: true }, () => {
      if (chrome.runtime.lastError) {
        console.log('[Pipeline CRM] Could not focus window:', chrome.runtime.lastError.message);
      }
    });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OPEN_KANBAN') {
    chrome.tabs.create({ url: 'kanban.html' });
  }
  if (msg.type === 'OPEN_LINKEDIN') {
    openOrFocusLinkedIn(msg.url || 'https://www.linkedin.com/messaging/');
    sendResponse({ ok: true });
  }
  if (msg.type === 'OPEN_LINKEDIN_THREAD') {
    const threadId = String(msg.threadId || '').trim();
    const targetUrl = threadId
      ? `https://www.linkedin.com/messaging/thread/${threadId}/`
      : 'https://www.linkedin.com/messaging/';
    console.log('[Pipeline CRM] OPEN_LINKEDIN_THREAD', { threadId, targetUrl });

    findLinkedInMessagingTab((tab) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SELECT_LINKEDIN_THREAD',
          threadId
        }, (resp) => {
          if (chrome.runtime.lastError) {
            console.log('[Pipeline CRM] Could not select thread in existing tab:', chrome.runtime.lastError.message);
            openOrFocusLinkedIn(targetUrl);
            sendResponse({ ok: true, mode: 'fallback_reload' });
            return;
          }

          if (resp?.ok) {
            focusTab(tab.id, tab.windowId);
            sendResponse({ ok: true, mode: 'selected_in_existing_tab' });
            return;
          }

          openOrFocusLinkedIn(targetUrl);
          sendResponse({ ok: true, mode: 'fallback_reload_no_row' });
        });
        return;
      }

      openOrFocusLinkedIn(targetUrl);
      sendResponse({ ok: true, mode: 'opened_or_updated_tab' });
    });
  }
  if (msg.type === 'OPEN_SIDEBAR_PANEL') {
    findLinkedInMessagingTab((tab) => {
      if (!tab?.id) {
        openOrFocusLinkedIn('https://www.linkedin.com/messaging/');
        sendResponse({ ok: false, reason: 'tab_not_found' });
        return;
      }
      focusTab(tab.id, tab.windowId);
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDEBAR_PANEL' }, (resp) => {
        if (chrome.runtime.lastError) {
          console.log('[Pipeline CRM] Could not open sidebar panel:', chrome.runtime.lastError.message);
          sendResponse({ ok: false, reason: 'send_failed' });
          return;
        }
        sendResponse({ ok: !!resp?.ok });
      });
    });
  }
  if (msg.type === 'APPLY_INBOX_FILTER') {
    findLinkedInMessagingTab((tab) => {
      if (!tab?.id) {
        console.log('[Pipeline CRM] No LinkedIn messaging tab found for inbox filter');
        sendResponse({ ok: false, reason: 'tab_not_found' });
        return;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: 'APPLY_INBOX_FILTER',
        stageId: msg.stageId || 'all'
      }, (resp) => {
        if (chrome.runtime.lastError) {
          console.log('[Pipeline CRM] Could not send inbox filter message:', chrome.runtime.lastError.message);
          sendResponse({ ok: false, reason: 'send_failed' });
          return;
        }
        sendResponse({ ok: true, response: resp || null });
      });
    });
  }
  if (msg.type === 'SCHEDULE_ALARM') {
    chrome.alarms.create(msg.alarmName, { when: msg.alarmTime });

    // Store alarm metadata so we can read it on fire
    chrome.storage.local.get(['alarmMeta'], (result) => {
      const meta = result.alarmMeta || {};
      meta[msg.alarmName] = {
        contactName: msg.contactName,
        threadId:    msg.threadId
      };
      chrome.storage.local.set({ alarmMeta: meta });
    });

    sendResponse({ ok: true });
  }
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith('followup_')) return;

  chrome.storage.local.get(['alarmMeta'], (result) => {
    const meta = (result.alarmMeta || {})[alarm.name];
    const name = meta?.contactName || 'a prospect';

    chrome.notifications.create(alarm.name, {
      type:    'basic',
      iconUrl: 'icons/icon48.png',
      title:   'Follow-up reminder — Pipeline CRM',
      message: `Time to follow up with ${name} on LinkedIn.`,
      buttons: [{ title: 'Open LinkedIn' }],
      priority: 2
    });
  });
});

chrome.notifications.onButtonClicked.addListener((notifId) => {
  openOrFocusLinkedIn('https://www.linkedin.com/messaging/');
});
