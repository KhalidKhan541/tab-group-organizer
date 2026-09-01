const ProjectManager = (() => {
  const STORAGE_KEY = 'projects';

  const TEMPLATES = [
    {
      name: 'Web Development',
      color: 'green',
      description: 'Frontend and backend web development',
      patterns: ['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com', 'vercel.com', 'netlify.com', 'codepen.io'],
      patternType: 'domain'
    },
    {
      name: 'Design',
      color: 'purple',
      description: 'Design tools and resources',
      patterns: ['figma.com', 'sketch.com', 'dribbble.com', 'behance.net', 'canva.com', 'adobe.com'],
      patternType: 'domain'
    },
    {
      name: 'Research',
      color: 'blue',
      description: 'Research and documentation',
      patterns: ['scholar.google.com', 'arxiv.org', 'researchgate.net', 'jstor.org', 'wikipedia.org'],
      patternType: 'domain'
    },
    {
      name: 'Social Media',
      color: 'pink',
      description: 'Social networking platforms',
      patterns: ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'tiktok.com'],
      patternType: 'domain'
    },
    {
      name: 'Work',
      color: 'red',
      description: 'Work-related tools and platforms',
      patterns: ['slack.com', 'notion.so', 'trello.com', 'asana.com', 'jira.atlassian.com', 'confluence.atlassian.com', 'monday.com'],
      patternType: 'domain'
    }
  ];

  async function getAll() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || [];
  }

  async function save(projects) {
    await chrome.storage.local.set({ [STORAGE_KEY]: projects });
  }

  async function create(project) {
    const projects = await getAll();
    const newProject = {
      id: generateId(),
      name: project.name || 'Untitled Project',
      color: project.color || 'grey',
      description: project.description || '',
      patterns: project.patterns || [],
      patternType: project.patternType || 'domain',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    projects.push(newProject);
    await save(projects);
    return newProject;
  }

  async function update(id, updates) {
    const projects = await getAll();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return null;
    projects[index] = {
      ...projects[index],
      ...updates,
      id,
      updatedAt: Date.now()
    };
    await save(projects);
    return projects[index];
  }

  async function remove(id) {
    const projects = await getAll();
    const filtered = projects.filter(p => p.id !== id);
    if (filtered.length === projects.length) return false;
    await save(filtered);
    return true;
  }

  async function getById(id) {
    const projects = await getAll();
    return projects.find(p => p.id === id) || null;
  }

  async function fromTemplate(templateIndex) {
    const template = TEMPLATES[templateIndex];
    if (!template) return null;
    return create(template);
  }

  async function detectProjectFromUrl(url) {
    const projects = await getAll();
    for (const project of projects) {
      const matches = project.patterns.some(p =>
        Organizer.matchPattern(url, p, project.patternType || 'domain')
      );
      if (matches) return project;
    }
    return null;
  }

  async function exportProjects() {
    const projects = await getAll();
    return JSON.stringify(projects, null, 2);
  }

  async function importProjects(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      const existing = await getAll();
      const existingIds = new Set(existing.map(p => p.id));
      let added = 0;
      for (const project of imported) {
        if (!project.name || !project.patterns) continue;
        if (existingIds.has(project.id)) {
          project.id = generateId();
        }
        existing.push({
          ...project,
          id: project.id || generateId(),
          createdAt: project.createdAt || Date.now(),
          updatedAt: Date.now()
        });
        added++;
      }
      await save(existing);
      return { success: true, added };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function parsePatterns(patternText) {
    return patternText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }

  function generateId() {
    return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function getTemplates() {
    return TEMPLATES.map((t, i) => ({ ...t, index: i }));
  }

  return {
    getAll,
    save,
    create,
    update,
    remove,
    getById,
    fromTemplate,
    detectProjectFromUrl,
    exportProjects,
    importProjects,
    parsePatterns,
    getTemplates
  };
})();
