(() => {
  let currentTheme = 'light';
  let editingProjectId = null;
  let editingRuleIndex = null;
  let selectedProjectColor = 'blue';
  let selectedRuleColor = 'blue';

  const COLOR_MAP = {
    grey: '#5f6368', blue: '#4285f4', red: '#ea4335', yellow: '#fbbc04',
    green: '#34a853', pink: '#ff6d9b', purple: '#a142f4', cyan: '#24c1e0', orange: '#fa7b17'
  };

  const COLOR_NAMES = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

  function init() {
    loadTheme();
    setupTabs();
    setupModals();
    setupColorPickers();
    setupActions();
    loadStats();
    loadGroups();
    loadProjects();
    loadRules();
    setupDragAndDrop();
  }

  function loadTheme() {
    chrome.storage.local.get('theme', (data) => {
      currentTheme = data.theme || 'light';
      document.documentElement.setAttribute('data-theme', currentTheme);
    });
    document.getElementById('themeToggle').addEventListener('click', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', currentTheme);
      chrome.storage.local.set({ theme: currentTheme });
    });
  }

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  function setupColorPickers() {
    renderColorPicker('projectColorPicker', selectedProjectColor, (c) => { selectedProjectColor = c; });
    renderColorPicker('ruleColorPicker', selectedRuleColor, (c) => { selectedRuleColor = c; });
  }

  function renderColorPicker(containerId, selected, onChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    COLOR_NAMES.forEach(name => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch' + (name === selected ? ' selected' : '');
      swatch.style.background = COLOR_MAP[name];
      swatch.title = name;
      swatch.addEventListener('click', () => {
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        onChange(name);
      });
      container.appendChild(swatch);
    });
  }

  function setupModals() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById(btn.dataset.close);
        if (modal) modal.classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    document.getElementById('addProjectBtn').addEventListener('click', () => {
      editingProjectId = null;
      document.getElementById('projectModalTitle').textContent = 'New Project';
      document.getElementById('projectName').value = '';
      document.getElementById('projectDomains').value = '';
      document.getElementById('projectDesc').value = '';
      selectedProjectColor = 'blue';
      renderColorPicker('projectColorPicker', selectedProjectColor, (c) => { selectedProjectColor = c; });
      document.getElementById('projectModal').classList.add('active');
    });

    document.getElementById('addRuleBtn').addEventListener('click', () => {
      editingRuleIndex = null;
      document.getElementById('ruleModalTitle').textContent = 'New Rule';
      document.getElementById('ruleName').value = '';
      document.getElementById('rulePattern').value = '';
      document.getElementById('ruleType').value = 'domain';
      document.getElementById('ruleGroupName').value = '';
      selectedRuleColor = 'blue';
      renderColorPicker('ruleColorPicker', selectedRuleColor, (c) => { selectedRuleColor = c; });
      document.getElementById('ruleModal').classList.add('active');
    });
  }

  function setupActions() {
    document.getElementById('autoGroupBtn').addEventListener('click', async () => {
      showLoading('Auto-grouping tabs...');
      sendMsg({ type: 'AUTO_GROUP' }, (res) => {
        hideLoading();
        const count = res?.results?.reduce((s, r) => s + r.tabCount, 0) || 0;
        showToast(`Grouped ${count} tabs into ${res?.results?.length || 0} groups`, 'success');
        refreshAll();
      });
    });

    document.getElementById('collapseAllBtn').addEventListener('click', () => {
      sendMsg({ type: 'COLLAPSE_ALL' }, () => {
        showToast('All groups collapsed', 'success');
        loadGroups();
      });
    });

    document.getElementById('expandAllBtn').addEventListener('click', () => {
      sendMsg({ type: 'EXPAND_ALL' }, () => {
        showToast('All groups expanded', 'success');
        loadGroups();
      });
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const preset = btn.dataset.preset;
        btn.classList.toggle('active');
        showLoading(`Grouping by ${preset}...`);
        sendMsg({ type: 'GROUP_BY_PRESET', preset }, (res) => {
          hideLoading();
          const count = res?.results?.reduce((s, r) => s + r.tabCount, 0) || 0;
          showToast(`Grouped ${count} tabs as ${preset}`, 'success');
          refreshAll();
        });
      });
    });

    document.querySelector('[name="groupMode"][value="domain"]').addEventListener('change', () => {
      document.getElementById('presetSection').style.display = '';
    });

    document.querySelector('[name="groupMode"][value="project"]').addEventListener('change', () => {
      document.getElementById('presetSection').style.display = '';
    });

    document.querySelector('[name="groupMode"][value="custom"]').addEventListener('change', () => {
      document.getElementById('presetSection').style.display = 'none';
    });

    document.getElementById('saveProjectBtn').addEventListener('click', saveProject);
    document.getElementById('saveRuleBtn').addEventListener('click', saveRule);

    document.getElementById('autoGroupOnCreate').addEventListener('change', (e) => {
      updateSetting('autoGroupOnCreate', e.target.checked);
    });
    document.getElementById('preserveExisting').addEventListener('change', (e) => {
      updateSetting('preserveExisting', e.target.checked);
    });
    document.getElementById('showBadge').addEventListener('change', (e) => {
      updateSetting('showBadge', e.target.checked);
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      document.querySelector('[data-tab="rules"]').click();
    });
  }

  async function updateSetting(key, value) {
    const data = await chrome.storage.local.get('settings');
    const settings = { ...(data.settings || {}), [key]: value };
    await chrome.storage.local.set({ settings });
    sendMsg({ type: 'UPDATE_BADGE' });
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get('settings');
    const s = data.settings || {};
    document.getElementById('autoGroupOnCreate').checked = s.autoGroupOnCreate !== false;
    document.getElementById('preserveExisting').checked = s.preserveExisting === true;
    document.getElementById('showBadge').checked = s.showBadge !== false;
  }

  async function loadStats() {
    sendMsg({ type: 'GET_STATS' }, (res) => {
      const stats = res?.stats;
      if (!stats) return;
      document.getElementById('tabCount').textContent = stats.total;
      document.getElementById('groupCount').textContent = stats.groupCount;
      document.getElementById('statOpen').textContent = stats.total;
      document.getElementById('statGrouped').textContent = stats.grouped;
      document.getElementById('statUngrouped').textContent = stats.ungrouped;
      document.getElementById('ungroupedCount').textContent = stats.ungrouped;
      loadUngroupedTabs();
      loadSettings();
    });
  }

  async function loadUngroupedTabs() {
    sendMsg({ type: 'GET_TABS' }, (res) => {
      const tabs = (res?.tabs || []).filter(t => t.groupId === -1 && t.url && !t.url.startsWith('chrome://'));
      const list = document.getElementById('ungroupedList');

      if (tabs.length === 0) {
        list.innerHTML = '<div class="empty-state">All tabs are grouped!</div>';
        return;
      }

      list.innerHTML = '';
      tabs.slice(0, 30).forEach(tab => {
        list.appendChild(createTabElement(tab));
      });
    });
  }

  async function loadGroups() {
    sendMsg({ type: 'GET_GROUPS' }, (res) => {
      const groups = res?.groups || [];
      const list = document.getElementById('groupsList');

      if (groups.length === 0) {
        list.innerHTML = '<div class="empty-state">No tab groups yet. Click "Auto-Group All" to start.</div>';
        return;
      }

      list.innerHTML = '';
      groups.sort((a, b) => (b.tabCount || 0) - (a.tabCount || 0)).forEach(group => {
        list.appendChild(createGroupElement(group));
      });
    });
  }

  function createTabElement(tab) {
    const item = document.createElement('div');
    item.className = 'tab-item';
    item.draggable = true;
    item.dataset.tabId = tab.id;

    const favicon = tab.favIconUrl
      ? `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.style.display='none'">`
      : `<div class="tab-favicon" style="background:var(--bg-tertiary);border-radius:3px;"></div>`;

    item.innerHTML = `
      ${favicon}
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
        <div class="tab-url">${escapeHtml(Organizer.extractDomain(tab.url) || tab.url)}</div>
      </div>
      <div class="tab-actions">
        <button class="tab-action-btn" data-action="focus" title="Focus tab">↗</button>
        <button class="tab-action-btn" data-action="close" title="Close tab">×</button>
      </div>
    `;

    item.querySelector('[data-action="focus"]').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });

    item.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tab.id);
      item.remove();
      loadStats();
    });

    return item;
  }

  function createGroupElement(group) {
    const item = document.createElement('div');
    item.className = 'group-item';
    item.dataset.groupId = group.id;

    const colorHex = COLOR_MAP[group.color] || '#5f6368';

    item.innerHTML = `
      <div class="group-header">
        <div class="group-color" style="background:${colorHex}"></div>
        <span class="group-name">${escapeHtml(group.title || 'Untitled Group')}</span>
        <span class="group-count">${group.tabCount || 0} tabs</span>
        <div class="group-actions">
          <button class="tab-action-btn" data-action="rename" title="Rename">✎</button>
          <button class="tab-action-btn" data-action="color" title="Change color">◉</button>
          <button class="tab-action-btn" data-action="ungroup" title="Ungroup all">↗</button>
          <button class="tab-action-btn" data-action="delete" title="Delete group">×</button>
        </div>
        <button class="group-toggle" data-action="toggle">▾</button>
      </div>
      <div class="group-tabs" id="group-tabs-${group.id}"></div>
    `;

    const header = item.querySelector('.group-header');
    const toggleBtn = item.querySelector('[data-action="toggle"]');
    const tabsContainer = item.querySelector('.group-tabs');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tabsContainer.classList.toggle('collapsed');
      toggleBtn.classList.toggle('collapsed');
      chrome.tabGroups.update(group.id, { collapsed: tabsContainer.classList.contains('collapsed') });
    });

    item.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const nameEl = item.querySelector('.group-name');
      const input = document.createElement('input');
      input.className = 'group-name-input';
      input.value = group.title || '';
      nameEl.replaceWith(input);
      input.focus();
      input.select();

      const finish = () => {
        const newTitle = input.value.trim() || group.title;
        sendMsg({ type: 'RENAME_GROUP', groupId: group.id, title: newTitle }, () => {
          loadGroups();
        });
      };

      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') finish();
        if (ev.key === 'Escape') loadGroups();
      });
    });

    item.querySelector('[data-action="color"]').addEventListener('click', (e) => {
      e.stopPropagation();
      let colorMenu = item.querySelector('.color-menu-inline');
      if (colorMenu) {
        colorMenu.remove();
        return;
      }
      colorMenu = document.createElement('div');
      colorMenu.className = 'color-menu-inline';
      colorMenu.style.cssText = 'display:flex;gap:4px;padding:6px 12px;background:var(--bg);border-top:1px solid var(--border-light);flex-wrap:wrap;';
      COLOR_NAMES.forEach(name => {
        const s = document.createElement('div');
        s.style.cssText = `width:22px;height:22px;border-radius:50%;background:${COLOR_MAP[name]};cursor:pointer;border:2px solid ${name === group.color ? 'white' : 'transparent'};box-shadow:0 0 0 1px var(--border);`;
        s.title = name;
        s.addEventListener('click', () => {
          sendMsg({ type: 'CHANGE_GROUP_COLOR', groupId: group.id, color: name }, () => {
            loadGroups();
          });
        });
        colorMenu.appendChild(s);
      });
      item.appendChild(colorMenu);
    });

    item.querySelector('[data-action="ungroup"]').addEventListener('click', (e) => {
      e.stopPropagation();
      sendMsg({ type: 'GET_TABS' }, (res) => {
        const tabs = (res?.tabs || []).filter(t => t.groupId === group.id);
        tabs.forEach(t => chrome.tabs.ungroup(t.id));
        setTimeout(() => {
          loadGroups();
          loadStats();
        }, 200);
      });
    });

    item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      sendMsg({ type: 'GET_TABS' }, (res) => {
        const tabs = (res?.tabs || []).filter(t => t.groupId === group.id);
        tabs.forEach(t => chrome.tabs.ungroup(t.id));
        setTimeout(() => {
          loadGroups();
          loadStats();
        }, 200);
      });
    });

    loadGroupTabs(group.id, tabsContainer);

    return item;
  }

  async function loadGroupTabs(groupId, container) {
    sendMsg({ type: 'GET_TABS' }, (res) => {
      const tabs = (res?.tabs || []).filter(t => t.groupId === groupId);
      container.innerHTML = '';
      tabs.forEach(tab => {
        const el = createTabElement(tab);
        el.style.margin = '0';
        container.appendChild(el);
      });
    });
  }

  async function loadProjects() {
    const projects = await ProjectManager.getAll();
    const list = document.getElementById('projectsList');

    if (projects.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>No projects yet. Create one or use a template.</p>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
            ${ProjectManager.getTemplates().map(t => `
              <button class="btn btn-sm btn-secondary template-btn" data-index="${t.index}">${t.name}</button>
            `).join('')}
          </div>
        </div>
      `;
      list.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await ProjectManager.fromTemplate(parseInt(btn.dataset.index));
          showToast('Project template added', 'success');
          loadProjects();
        });
      });
      return;
    }

    list.innerHTML = '';
    projects.forEach(project => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <div class="project-header">
          <div class="group-color" style="background:${COLOR_MAP[project.color] || '#5f6368'}"></div>
          <span class="project-name">${escapeHtml(project.name)}</span>
        </div>
        ${project.description ? `<div class="project-desc">${escapeHtml(project.description)}</div>` : ''}
        <div class="project-patterns">
          ${(project.patterns || []).map(p => `<span class="pattern-tag">${escapeHtml(p)}</span>`).join('')}
        </div>
        <div class="project-actions">
          <button class="btn btn-sm btn-primary group-project-btn" data-id="${project.id}">Group Tabs</button>
          <button class="btn btn-sm btn-secondary edit-project-btn" data-id="${project.id}">Edit</button>
          <button class="btn btn-sm btn-danger delete-project-btn" data-id="${project.id}">×</button>
        </div>
      `;

      card.querySelector('.group-project-btn').addEventListener('click', () => {
        showLoading(`Grouping by ${project.name}...`);
        sendMsg({ type: 'GROUP_BY_PROJECT', projectId: project.id }, (res) => {
          hideLoading();
          const count = res?.results?.reduce((s, r) => s + r.tabCount, 0) || 0;
          showToast(`Grouped ${count} tabs for ${project.name}`, 'success');
          refreshAll();
        });
      });

      card.querySelector('.edit-project-btn').addEventListener('click', async () => {
        editingProjectId = project.id;
        document.getElementById('projectModalTitle').textContent = 'Edit Project';
        document.getElementById('projectName').value = project.name;
        document.getElementById('projectDomains').value = (project.patterns || []).join('\n');
        document.getElementById('projectDesc').value = project.description || '';
        selectedProjectColor = project.color || 'blue';
        renderColorPicker('projectColorPicker', selectedProjectColor, (c) => { selectedProjectColor = c; });
        document.getElementById('projectModal').classList.add('active');
      });

      card.querySelector('.delete-project-btn').addEventListener('click', async () => {
        if (confirm(`Delete project "${project.name}"?`)) {
          await ProjectManager.remove(project.id);
          showToast('Project deleted', 'success');
          loadProjects();
        }
      });

      list.appendChild(card);
    });
  }

  async function saveProject() {
    const name = document.getElementById('projectName').value.trim();
    if (!name) {
      showToast('Project name is required', 'error');
      return;
    }

    const patternsText = document.getElementById('projectDomains').value;
    const patterns = (await ProjectManager.parsePatterns(patternsText));
    const description = document.getElementById('projectDesc').value.trim();

    const projectData = {
      name,
      color: selectedProjectColor,
      patterns,
      description,
      patternType: 'domain'
    };

    if (editingProjectId) {
      await ProjectManager.update(editingProjectId, projectData);
      showToast('Project updated', 'success');
    } else {
      await ProjectManager.create(projectData);
      showToast('Project created', 'success');
    }

    document.getElementById('projectModal').classList.remove('active');
    loadProjects();
  }

  async function loadRules() {
    const data = await chrome.storage.local.get('rules');
    const rules = data.rules || [];
    const list = document.getElementById('rulesList');

    if (rules.length === 0) {
      list.innerHTML = '<div class="empty-state">No auto-group rules yet. Create one to get started.</div>';
      return;
    }

    list.innerHTML = '';
    rules.forEach((rule, index) => {
      const card = document.createElement('div');
      card.className = 'rule-card';
      card.innerHTML = `
        <div class="rule-header">
          <div class="group-color" style="background:${COLOR_MAP[rule.color] || '#5f6368'}"></div>
          <span class="rule-name">${escapeHtml(rule.name)}</span>
        </div>
        <div class="rule-detail">Pattern: <code>${escapeHtml(rule.pattern)}</code></div>
        <div class="rule-detail">Type: ${rule.type} → Group: <strong>${escapeHtml(rule.groupName)}</strong></div>
        <div class="rule-actions">
          <button class="btn btn-sm btn-secondary edit-rule-btn" data-index="${index}">Edit</button>
          <button class="btn btn-sm btn-danger delete-rule-btn" data-index="${index}">×</button>
        </div>
      `;

      card.querySelector('.edit-rule-btn').addEventListener('click', () => {
        editingRuleIndex = index;
        document.getElementById('ruleModalTitle').textContent = 'Edit Rule';
        document.getElementById('ruleName').value = rule.name;
        document.getElementById('rulePattern').value = rule.pattern;
        document.getElementById('ruleType').value = rule.type;
        document.getElementById('ruleGroupName').value = rule.groupName;
        selectedRuleColor = rule.color;
        renderColorPicker('ruleColorPicker', selectedRuleColor, (c) => { selectedRuleColor = c; });
        document.getElementById('ruleModal').classList.add('active');
      });

      card.querySelector('.delete-rule-btn').addEventListener('click', async () => {
        rules.splice(index, 1);
        await chrome.storage.local.set({ rules });
        showToast('Rule deleted', 'success');
        loadRules();
      });

      list.appendChild(card);
    });
  }

  async function saveRule() {
    const name = document.getElementById('ruleName').value.trim();
    const pattern = document.getElementById('rulePattern').value.trim();
    const type = document.getElementById('ruleType').value;
    const groupName = document.getElementById('ruleGroupName').value.trim();

    if (!name || !pattern || !groupName) {
      showToast('All fields are required', 'error');
      return;
    }

    const data = await chrome.storage.local.get('rules');
    const rules = data.rules || [];

    const rule = { name, pattern, type, groupName, color: selectedRuleColor };

    if (editingRuleIndex !== null && editingRuleIndex < rules.length) {
      rules[editingRuleIndex] = rule;
    } else {
      rules.push(rule);
    }

    await chrome.storage.local.set({ rules });
    document.getElementById('ruleModal').classList.remove('active');
    showToast(editingRuleIndex !== null ? 'Rule updated' : 'Rule created', 'success');
    editingRuleIndex = null;
    loadRules();
  }

  function setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.tab-item');
      if (!item) return;
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.dataset.tabId);
      e.dataTransfer.effectAllowed = 'move';
    });

    document.addEventListener('dragend', (e) => {
      const item = e.target.closest('.tab-item');
      if (item) item.classList.remove('dragging');
      document.querySelectorAll('.drop-zone').forEach(z => z.remove());
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const tabId = parseInt(e.dataTransfer.getData('text/plain'));
      if (!tabId) return;

      const groupItem = e.target.closest('.group-item');
      if (groupItem) {
        const groupId = parseInt(groupItem.dataset.groupId);
        sendMsg({ type: 'MOVE_TAB', tabId, groupId }, () => {
          showToast('Tab moved to group', 'success');
          setTimeout(refreshAll, 200);
        });
      }
    });
  }

  function sendMsg(msg, callback) {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        console.error('Message error:', chrome.runtime.lastError);
        return;
      }
      if (callback) callback(res);
    });
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  let loadingOverlay = null;
  function showLoading(message = 'Loading...') {
    if (loadingOverlay) return;
    loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:50;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
    loadingOverlay.innerHTML = `
      <div style="text-align:center;color:white;font-family:inherit;">
        <div style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.3);border-top-color:#4285f4;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 8px;"></div>
        <div style="font-size:13px;font-weight:500;">${message}</div>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    loadingOverlay.appendChild(style);
    document.body.appendChild(loadingOverlay);
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.remove();
      loadingOverlay = null;
    }
  }

  function refreshAll() {
    loadStats();
    loadGroups();
    loadProjects();
    loadRules();
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
