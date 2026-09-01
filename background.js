chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'rules', 'projects'], (data) => {
    if (!data.settings) {
      chrome.storage.local.set({
        settings: {
          autoGroupOnCreate: true,
          preserveExisting: false,
          showBadge: true
        }
      });
    }
    if (!data.rules) {
      chrome.storage.local.set({ rules: [] });
    }
    if (!data.projects) {
      chrome.storage.local.set({ projects: [] });
    }
  });

  chrome.contextMenus.create({
    id: 'tab-group-organizer',
    title: 'Tab Group Organizer',
    contexts: ['tab']
  });

  chrome.contextMenus.create({
    id: 'group-this-domain',
    parentId: 'tab-group-organizer',
    title: 'Group all tabs from this domain',
    contexts: ['tab']
  });

  chrome.contextMenus.create({
    id: 'ungroup-this-tab',
    parentId: 'tab-group-organizer',
    title: 'Ungroup this tab',
    contexts: ['tab']
  });

  updateBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'group-this-domain' && tab) {
    const domain = Organizer.extractDomain(tab.url);
    if (!domain) return;
    const allTabs = await chrome.tabs.query({});
    const domainTabs = allTabs.filter(t => {
      const d = Organizer.extractDomain(t.url);
      return d === domain;
    });
    if (domainTabs.length > 0) {
      const groupId = await Organizer.createGroup(
        domain.split('.')[0],
        'blue',
        domainTabs.map(t => t.id)
      );
      showToast(`Grouped ${domainTabs.length} tabs from ${domain}`);
    }
  }

  if (info.menuItemId === 'ungroup-this-tab' && tab) {
    if (tab.groupId !== -1) {
      await chrome.tabs.ungroup(tab.id);
      showToast('Tab ungrouped');
    }
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.pendingUrl || tab.url) {
    setTimeout(() => Organizer.handleNewTab(tab), 500);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    Organizer.handleNewTab(tab);
  }
});

chrome.tabs.onActivated.addListener(async () => {
  updateBadge();
});

chrome.tabGroups.onCreated.addListener(() => updateBadge());
chrome.tabGroups.onRemoved.addListener(() => updateBadge());

async function updateBadge() {
  const settings = await Organizer.getSettings();
  if (!settings.showBadge) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const stats = await Organizer.getStats();
  const text = stats.groupCount > 0 ? String(stats.groupCount) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
}

function showToast(message) {
  chrome.runtime.sendMessage({
    type: 'SHOW_TOAST',
    message
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TABS') {
    chrome.tabs.query({}).then(tabs => sendResponse({ tabs }));
    return true;
  }

  if (msg.type === 'GET_GROUPS') {
    Organizer.getExistingGroups().then(groups => sendResponse({ groups }));
    return true;
  }

  if (msg.type === 'GET_STATS') {
    Organizer.getStats().then(stats => sendResponse({ stats }));
    return true;
  }

  if (msg.type === 'AUTO_GROUP') {
    Organizer.autoGroup().then(results => {
      updateBadge();
      sendResponse({ results });
    });
    return true;
  }

  if (msg.type === 'GROUP_BY_DOMAIN') {
    Organizer.groupByDomain(null, msg.preserveExisting).then(results => {
      updateBadge();
      sendResponse({ results });
    });
    return true;
  }

  if (msg.type === 'GROUP_BY_PROJECT') {
    Organizer.groupByProject(msg.projectId).then(results => {
      updateBadge();
      sendResponse({ results });
    });
    return true;
  }

  if (msg.type === 'GROUP_BY_PRESET') {
    Organizer.groupByPreset(msg.preset).then(results => {
      updateBadge();
      sendResponse({ results });
    });
    return true;
  }

  if (msg.type === 'GROUP_BY_RULES') {
    Organizer.groupByRules().then(results => {
      updateBadge();
      sendResponse({ results });
    });
    return true;
  }

  if (msg.type === 'COLLAPSE_ALL') {
    Organizer.collapseAll().then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === 'EXPAND_ALL') {
    Organizer.expandAll().then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === 'UNGROUP_ALL') {
    Organizer.ungroupAll().then(() => {
      updateBadge();
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.type === 'RENAME_GROUP') {
    Organizer.renameGroup(msg.groupId, msg.title).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === 'CHANGE_GROUP_COLOR') {
    Organizer.changeGroupColor(msg.groupId, msg.color).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === 'MOVE_TAB') {
    Organizer.moveTabToGroup(msg.tabId, msg.groupId).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.type === 'UPDATE_BADGE') {
    updateBadge().then(() => sendResponse({ success: true }));
    return true;
  }
});

chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'auto-group') {
    Organizer.autoGroup().then(() => updateBadge());
  }
  if (command === 'collapse-all') {
    Organizer.collapseAll();
  }
  if (command === 'expand-all') {
    Organizer.expandAll();
  }
});
