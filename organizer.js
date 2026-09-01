const Organizer = (() => {
  const CHROME_COLORS = [
    { name: 'grey', hex: '#5f6368' },
    { name: 'blue', hex: '#4285f4' },
    { name: 'red', hex: '#ea4335' },
    { name: 'yellow', hex: '#fbbc04' },
    { name: 'green', hex: '#34a853' },
    { name: 'pink', hex: '#ff6d9b' },
    { name: 'purple', hex: '#a142f4' },
    { name: 'cyan', hex: '#24c1e0' },
    { color: 'orange', hex: '#fa7b17' }
  ];

  const PRESETS = {
    social: {
      name: 'Social',
      color: 'blue',
      patterns: ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'tiktok.com', 'snapchat.com', 'pinterest.com', 'mastodon', 'threads.net', 'bsky.app']
    },
    shopping: {
      name: 'Shopping',
      color: 'yellow',
      patterns: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com', 'aliexpress.com', 'shopify.com', 'wish.com', 'costco.com']
    },
    dev: {
      name: 'Dev',
      color: 'green',
      patterns: ['github.com', 'gitlab.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com', 'vercel.com', 'netlify.com', 'heroku.com', 'replit.com', 'codepen.io', 'codesandbox.io', 'figma.com']
    },
    news: {
      name: 'News',
      color: 'red',
      patterns: ['cnn.com', 'bbc.com', 'nytimes.com', 'reuters.com', 'theguardian.com', 'washingtonpost.com', 'apnews.com', 'bloomberg.com', 'techcrunch.com', 'theverge.com', 'arstechnica.com']
    },
    entertainment: {
      name: 'Entertainment',
      color: 'purple',
      patterns: ['youtube.com', 'netflix.com', 'twitch.tv', 'hulu.com', 'disneyplus.com', 'spotify.com', 'imdb.com', 'rottentomatoes.com', 'medium.com', 'substack.com']
    }
  };

  let _settings = {
    autoGroupOnCreate: true,
    preserveExisting: false,
    showBadge: true
  };

  async function getSettings() {
    const data = await chrome.storage.local.get('settings');
    return { ..._settings, ...data.settings };
  }

  async function saveSettings(settings) {
    _settings = { ..._settings, ...settings };
    await chrome.storage.local.set({ settings: _settings });
  }

  function extractDomain(url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'chrome:' || u.protocol === 'chrome-extension:' || u.protocol === 'about:' || u.protocol === 'edge:' || u.protocol === 'brave:') {
        return null;
      }
      let host = u.hostname.replace(/^www\./, '');
      const parts = host.split('.');
      if (parts.length > 2) {
        host = parts.slice(-2).join('.');
      }
      return host.toLowerCase();
    } catch {
      return null;
    }
  }

  function matchPattern(url, pattern, type = 'domain') {
    const domain = extractDomain(url);
    if (!domain) return false;

    if (type === 'domain') {
      const patterns = pattern.split(',').map(p => p.trim().toLowerCase());
      return patterns.some(p => {
        if (p.startsWith('*.')) {
          const base = p.slice(2);
          return domain === base || domain.endsWith('.' + base);
        }
        return domain === p;
      });
    }

    if (type === 'wildcard') {
      const regex = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(`^${regex}$`, 'i').test(domain);
    }

    if (type === 'regex') {
      try {
        return new RegExp(pattern, 'i').test(url);
      } catch {
        return false;
      }
    }

    return false;
  }

  function pickColor(index) {
    const named = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
    return named[index % named.length];
  }

  async function getAllTabs() {
    return chrome.tabs.query({});
  }

  async function getGroupedTabs() {
    const tabs = await getAllTabs();
    return tabs.filter(t => t.groupId !== -1);
  }

  async function getUngroupedTabs() {
    const tabs = await getAllTabs();
    return tabs.filter(t => t.groupId === -1);
  }

  async function getExistingGroups() {
    const groups = await chrome.tabGroups.query({});
    const tabCounts = {};
    const tabs = await getAllTabs();
    tabs.forEach(t => {
      if (t.groupId !== -1) {
        tabCounts[t.groupId] = (tabCounts[t.groupId] || 0) + 1;
      }
    });
    return groups.map(g => ({
      ...g,
      tabCount: tabCounts[g.id] || 0
    }));
  }

  async function createGroup(title, color, tabIds) {
    if (!tabIds || tabIds.length === 0) return null;
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title,
      color: color || 'grey',
      collapsed: false
    });
    return groupId;
  }

  async function groupByDomain(tabs = null, preserveExisting = false) {
    const allTabs = tabs || await getAllTabs();
    const settings = await getSettings();
    const preserve = preserveExisting !== false ? settings.preserveExisting : preserveExisting;

    let tabsToGroup = allTabs.filter(t => {
      if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false;
      if (preserve && t.groupId !== -1) return false;
      return true;
    });

    const domainMap = new Map();
    tabsToGroup.forEach(tab => {
      const domain = extractDomain(tab.url);
      if (domain) {
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain).push(tab.id);
      }
    });

    const results = [];
    let colorIdx = 0;
    for (const [domain, tabIds] of domainMap) {
      if (tabIds.length > 0) {
        const color = pickColor(colorIdx++);
        const shortName = domain.split('.')[0];
        const groupId = await createGroup(shortName, color, tabIds);
        if (groupId) {
          results.push({ groupId, name: shortName, color, tabCount: tabIds.length });
        }
      }
    }
    return results;
  }

  async function groupByProject(projectId, tabs = null) {
    const projects = await ProjectManager.getAll();
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];

    const allTabs = tabs || await getAllTabs();
    const tabsToGroup = allTabs.filter(t => {
      if (!t.url || t.url.startsWith('chrome://')) return false;
      if (t.groupId !== -1 && settings.preserveExisting) return false;
      return true;
    });

    const matched = [];
    const unmatched = [];
    tabsToGroup.forEach(tab => {
      const matches = project.patterns.some(p => matchPattern(tab.url, p, project.patternType || 'domain'));
      if (matches) matched.push(tab.id);
      else unmatched.push(tab);
    });

    const results = [];
    if (matched.length > 0) {
      const groupId = await createGroup(project.name, project.color, matched);
      if (groupId) {
        results.push({ groupId, name: project.name, color: project.color, tabCount: matched.length });
      }
    }
    return results;
  }

  async function groupByPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return [];

    const allTabs = await getAllTabs();
    const tabsToGroup = allTabs.filter(t => {
      if (!t.url || t.url.startsWith('chrome://')) return false;
      return true;
    });

    const matched = tabsToGroup.filter(t =>
      preset.patterns.some(p => matchPattern(t.url, p, 'domain'))
    );

    const results = [];
    if (matched.length > 0) {
      const groupId = await createGroup(preset.name, preset.color, matched.map(t => t.id));
      if (groupId) {
        results.push({ groupId, name: preset.name, color: preset.color, tabCount: matched.length });
      }
    }
    return results;
  }

  async function groupByRules(tabs = null) {
    const rules = (await chrome.storage.local.get('rules')).rules || [];
    const allTabs = tabs || await getAllTabs();
    const tabsToGroup = allTabs.filter(t => {
      if (!t.url || t.url.startsWith('chrome://')) return false;
      return true;
    });

    const results = [];
    const assigned = new Set();

    for (const rule of rules) {
      const matched = tabsToGroup.filter(t => {
        if (assigned.has(t.id)) return false;
        return matchPattern(t.url, rule.pattern, rule.type);
      });

      if (matched.length > 0) {
        matched.forEach(t => assigned.add(t.id));
        const groupId = await createGroup(rule.groupName, rule.color, matched.map(t => t.id));
        if (groupId) {
          results.push({ groupId, name: rule.groupName, color: rule.color, tabCount: matched.length });
        }
      }
    }

    return results;
  }

  async function autoGroup() {
    const allTabs = await getAllTabs();
    const settings = await getSettings();
    let tabsToGroup = allTabs.filter(t => {
      if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false;
      if (settings.preserveExisting && t.groupId !== -1) return false;
      return true;
    });

    if (tabsToGroup.length === 0) return [];

    const rules = (await chrome.storage.local.get('rules')).rules || [];
    const projects = await ProjectManager.getAll();
    const unassigned = [];
    const results = [];

    for (const rule of rules) {
      const matched = tabsToGroup.filter(t =>
        !unassigned.includes(t) && matchPattern(t.url, rule.pattern, rule.type)
      );
      if (matched.length > 0) {
        const groupId = await createGroup(rule.groupName, rule.color, matched.map(t => t.id));
        if (groupId) {
          results.push({ groupId, name: rule.groupName, color: rule.color, tabCount: matched.length });
          matched.forEach(t => unassigned.push(t.id));
        }
      }
    }

    for (const project of projects) {
      const matched = tabsToGroup.filter(t => {
        if (unassigned.includes(t.id)) return false;
        return project.patterns.some(p => matchPattern(t.url, p, project.patternType || 'domain'));
      });
      if (matched.length > 0) {
        const groupId = await createGroup(project.name, project.color, matched.map(t => t.id));
        if (groupId) {
          results.push({ groupId, name: project.name, color: project.color, tabCount: matched.length });
          matched.forEach(t => unassigned.push(t.id));
        }
      }
    }

    const remaining = tabsToGroup.filter(t => !unassigned.includes(t.id));
    const domainMap = new Map();
    remaining.forEach(tab => {
      const domain = extractDomain(tab.url);
      if (domain) {
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain).push(tab.id);
      }
    });

    let colorIdx = results.length;
    for (const [domain, tabIds] of domainMap) {
      if (tabIds.length >= 2) {
        const color = pickColor(colorIdx++);
        const shortName = domain.split('.')[0];
        const groupId = await createGroup(shortName, color, tabIds);
        if (groupId) {
          results.push({ groupId, name: shortName, color, tabCount: tabIds.length });
        }
      }
    }

    return results;
  }

  async function collapseAll() {
    const groups = await chrome.tabGroups.query({});
    for (const g of groups) {
      await chrome.tabGroups.update(g.id, { collapsed: true });
    }
  }

  async function expandAll() {
    const groups = await chrome.tabGroups.query({});
    for (const g of groups) {
      await chrome.tabGroups.update(g.id, { collapsed: false });
    }
  }

  async function ungroupAll() {
    const tabs = await getGroupedTabs();
    for (const tab of tabs) {
      await chrome.tabs.ungroup(tab.id);
    }
  }

  async function renameGroup(groupId, newTitle) {
    await chrome.tabGroups.update(groupId, { title: newTitle });
  }

  async function changeGroupColor(groupId, color) {
    await chrome.tabGroups.update(groupId, { color });
  }

  async function moveTabToGroup(tabId, groupId) {
    await chrome.tabs.group({ tabIds: [tabId], groupId });
  }

  async function getStats() {
    const allTabs = await getAllTabs();
    const grouped = allTabs.filter(t => t.groupId !== -1);
    const ungrouped = allTabs.filter(t => t.groupId === -1);
    const groups = await chrome.tabGroups.query({});

    const groupStats = groups.map(g => {
      const count = grouped.filter(t => t.groupId === g.id).length;
      return { id: g.id, title: g.title, color: g.color, tabCount: count };
    }).sort((a, b) => b.tabCount - a.tabCount);

    return {
      total: allTabs.length,
      grouped: grouped.length,
      ungrouped: ungrouped.length,
      groupCount: groups.length,
      groupStats
    };
  }

  async function handleNewTab(tab) {
    const settings = await getSettings();
    if (!settings.autoGroupOnCreate) return;
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

    const rules = (await chrome.storage.local.get('rules')).rules || [];
    const projects = await ProjectManager.getAll();

    for (const rule of rules) {
      if (matchPattern(tab.url, rule.pattern, rule.type)) {
        const existingGroups = await chrome.tabGroups.query({});
        const existing = existingGroups.find(g => g.title === rule.groupName);
        if (existing) {
          await chrome.tabs.group({ tabIds: [tab.id], groupId: existing.id });
        } else {
          await createGroup(rule.groupName, rule.color, [tab.id]);
        }
        return;
      }
    }

    for (const project of projects) {
      if (project.patterns.some(p => matchPattern(tab.url, p, project.patternType || 'domain'))) {
        const existingGroups = await chrome.tabGroups.query({});
        const existing = existingGroups.find(g => g.title === project.name);
        if (existing) {
          await chrome.tabs.group({ tabIds: [tab.id], groupId: existing.id });
        } else {
          await createGroup(project.name, project.color, [tab.id]);
        }
        return;
      }
    }

    const domain = extractDomain(tab.url);
    if (domain) {
      const existingGroups = await chrome.tabGroups.query({});
      const domainShort = domain.split('.')[0];
      const existing = existingGroups.find(g => g.title === domainShort);
      if (existing) {
        await chrome.tabs.group({ tabIds: [tab.id], groupId: existing.id });
      } else {
        const tabsInDomain = (await chrome.tabs.query({})).filter(t =>
          t.id !== tab.id && extractDomain(t.url) === domain
        );
        if (tabsInDomain.length >= 1) {
          const color = pickColor(existingGroups.length);
          await createGroup(domainShort, color, [tab.id, ...tabsInDomain.map(t => t.id)]);
        }
      }
    }
  }

  return {
    CHROME_COLORS,
    PRESETS,
    getSettings,
    saveSettings,
    extractDomain,
    matchPattern,
    getAllTabs,
    getGroupedTabs,
    getUngroupedTabs,
    getExistingGroups,
    createGroup,
    groupByDomain,
    groupByProject,
    groupByPreset,
    groupByRules,
    autoGroup,
    collapseAll,
    expandAll,
    ungroupAll,
    renameGroup,
    changeGroupColor,
    moveTabToGroup,
    getStats,
    handleNewTab
  };
})();
