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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OPEN_KANBAN') {
    chrome.tabs.create({ url: 'kanban.html' });
  }
  if (msg.type === 'OPEN_LINKEDIN') {
    openOrFocusLinkedIn(msg.url || 'https://www.linkedin.com/messaging/');
    sendResponse({ ok: true });
  }
  if (msg.type === 'OPEN_LINKEDIN_THREAD') {
    const threadId = msg.threadId || '';
    const cleanThreadId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const targetUrl = cleanThreadId
      ? `https://www.linkedin.com/messaging/thread/${cleanThreadId}/`
      : 'https://www.linkedin.com/messaging/';
    openOrFocusLinkedIn(targetUrl);
    sendResponse({ ok: true });
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
