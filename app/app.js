// Leonida Trophy Guide & Tracker — checklist saved in localStorage, export/import,
// kind + search filters, spoiler-free mode, roadmap and missable flags.
// All trophy data (names, descriptions, grades, guides, sources) lives in data/trophies.json.
const STORE_KEY = 'gta6-trophy-tracker-v1';
const SPOILER_KEY = 'gta6-trophy-spoiler-v1';
const listEl = document.getElementById('trophyList');
const earnedCountEl = document.getElementById('earnedCount');
const progressBarEl = document.getElementById('progressBar');
const gradeCountsEl = document.getElementById('gradeCounts');
const platStateEl = document.getElementById('platState');
const shownCountEl = document.getElementById('shownCount');
const emptyMsgEl = document.getElementById('emptyMsg');
const missableListEl = document.getElementById('missableList');
const ioMsgEl = document.getElementById('ioMsg');

let trophies = [];
let earned = new Set(loadStoredIds());
let activeKind = 'all';
let spoilerOn = localStorage.getItem(SPOILER_KEY) === '1';
let searchText = '';
let openId = null;

const params = new URLSearchParams(location.search);
if (params.get('demo') === '1') {
  // Preview mode used for screenshots: show some progress without touching saved data.
  earned = new Set([2, 3, 8, 15, 20, 28, 35, 46].map(String));
} else if (params.get('demo') === '2') {
  // Preview mode with no story trophies earned, so spoiler mode hides them.
  earned = new Set([15, 20, 28, 35, 46].map(String));
}
if (params.get('spoiler') === 'on') spoilerOn = true;
if (params.get('open')) openId = Number(params.get('open'));

function loadStoredIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveProgress() {
  localStorage.setItem(STORE_KEY, JSON.stringify([...earned].sort()));
}

function trophyKey(t) {
  return String(t.id ?? t.name);
}

function isStory(t) {
  return t.kind === 'story';
}

function kindMatches(t) {
  if (activeKind === 'all') return true;
  if (activeKind === 'missable') return t.missable === true;
  if (activeKind === 'earned') return earned.has(trophyKey(t));
  if (activeKind === 'todo') return !earned.has(trophyKey(t));
  if (activeKind === 'online') return false; // No online trophies in GTA 6 (all 55 are offline).
  return t.kind === activeKind;
}

function searchMatches(t) {
  if (!searchText) return true;
  const hay = `${t.name} ${t.description} ${t.guide} ${t.kind}`.toLowerCase();
  return hay.includes(searchText);
}

function updateProgress() {
  const total = trophies.length;
  const done = trophies.filter((t) => earned.has(trophyKey(t)));
  earnedCountEl.textContent = String(done.length);
  progressBarEl.style.width = total ? `${Math.round((done.length / total) * 100)}%` : '0%';
  const byGrade = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of done) if (byGrade[t.grade] !== undefined) byGrade[t.grade] += 1;
  gradeCountsEl.textContent =
    `${byGrade.platinum} platinum · ${byGrade.gold} gold · ${byGrade.silver} silver · ${byGrade.bronze} bronze`;
  const plat = trophies.find((t) => t.grade === 'platinum');
  platStateEl.textContent = plat && earned.has(trophyKey(plat))
    ? 'Vice Got a Price! — earned 🏆'
    : 'Vice Got a Price! — locked';
}

function sourceLinks(t) {
  return (t.sources ?? []).map((s) => {
    const a = document.createElement('a');
    a.href = s.url;
    a.textContent = s.name;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  });
}

function buildCard(t) {
  const card = document.createElement('article');
  card.className = 'card' + (earned.has(trophyKey(t)) ? ' earned' : '');
  card.dataset.trophyId = trophyKey(t);

  const head = document.createElement('div');
  head.className = 'card-head';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(trophyKey(t));
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(trophyKey(t));
    else earned.delete(trophyKey(t));
    saveProgress();
    renderTrophies();
  });
  const title = document.createElement('h3');
  const badge = document.createElement('span');
  badge.className = `badge ${t.grade}`;
  badge.textContent = t.grade;
  head.append(box, title, badge);

  const hiddenBySpoiler = spoilerOn && isStory(t) && !earned.has(trophyKey(t));
  if (hiddenBySpoiler) {
    title.textContent = '🔒 Hidden story trophy — earn it to reveal';
    title.classList.add('spoiler-hidden');
    const desc = document.createElement('p');
    desc.className = 'desc spoiler-hidden';
    desc.textContent = 'Spoiler-free mode is on: the name and description stay hidden until you earn this trophy.';
    card.append(head, desc);
  } else {
    title.textContent = t.name;
    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = `“${t.description}”`;
    card.append(head, desc);
  }

  const kinds = document.createElement('div');
  kinds.className = 'kind-row';
  const kindTag = document.createElement('span');
  kindTag.className = 'tag';
  kindTag.textContent = t.kind;
  kinds.append(kindTag);
  if (t.missable) {
    const missTag = document.createElement('span');
    missTag.className = 'tag miss';
    missTag.textContent = '⚠ MISSABLE';
    kinds.append(missTag);
  }
  card.append(kinds);

  // The guide + its sources are shown for every revealed trophy; for a story trophy
  // hidden by spoiler-free mode the guide stays hidden too, or it would spoil the mission.
  if (!hiddenBySpoiler) {
    const guideLabel = document.createElement('p');
    guideLabel.className = 'guide-label';
    guideLabel.textContent = 'Guide';
    const guide = document.createElement('p');
    guide.className = 'guide';
    guide.textContent = t.guide;
    const sources = document.createElement('p');
    sources.className = 'sources';
    sources.textContent = 'Sources: ';
    sourceLinks(t).forEach((a, i) => {
      if (i > 0) sources.append(document.createTextNode(' · '));
      sources.append(a);
    });
    card.append(guideLabel, guide, sources);
  } else {
    const hiddenGuide = document.createElement('p');
    hiddenGuide.className = 'guide spoiler-hidden';
    hiddenGuide.textContent = 'Guide hidden in spoiler-free mode — earn this trophy to reveal it.';
    card.append(hiddenGuide);
  }
  if (openId === t.id) card.style.outline = '3px solid #e84393';
  return card;
}

function renderTrophies() {
  const visible = trophies.filter((t) => kindMatches(t) && searchMatches(t));
  listEl.replaceChildren(...visible.map(buildCard));
  emptyMsgEl.hidden = visible.length !== 0;
  shownCountEl.textContent = `— showing ${visible.length} of ${trophies.length}`;
  updateProgress();
}

function renderMissables() {
  const miss = trophies.filter((t) => t.missable);
  missableListEl.replaceChildren();
  if (miss.length === 0) {
    missableListEl.textContent = 'No trophies are flagged missable.';
    return;
  }
  const label = document.createElement('strong');
  label.textContent = 'Flagged in this guide: ';
  missableListEl.append(label);
  miss.forEach((t, i) => {
    if (i > 0) missableListEl.append(document.createTextNode(', '));
    const a = document.createElement('a');
    a.href = `#trophy-${trophyKey(t)}`;
    a.textContent = t.name;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector(`[data-trophy-id="${trophyKey(t)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    missableListEl.append(a);
  });
}

async function loadTrophies() {
  const res = await fetch('data/trophies.json');
  const doc = await res.json();
  trophies = doc.trophies ?? doc;
  renderMissables();
  renderTrophies();
  if (openId) {
    document.querySelector(`[data-trophy-id="${openId}"]`)?.scrollIntoView({ block: 'center' });
  }
}

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-kind]');
  if (!btn) return;
  activeKind = btn.dataset.kind;
  document.querySelectorAll('.filter').forEach((b) => b.classList.toggle('active', b === btn));
  renderTrophies();
});

document.getElementById('search').addEventListener('input', (e) => {
  searchText = e.target.value.trim().toLowerCase();
  renderTrophies();
});

const spoilerBox = document.getElementById('spoiler');
spoilerBox.checked = spoilerOn;
spoilerBox.addEventListener('change', () => {
  spoilerOn = spoilerBox.checked;
  localStorage.setItem(SPOILER_KEY, spoilerOn ? '1' : '0');
  renderTrophies();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = { game: 'Grand Theft Auto VI', exportedAt: new Date().toISOString(), earned: [...earned].sort() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
  ioMsgEl.textContent = `Exported ${earned.size} earned trophies.`;
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(ids)) throw new Error('bad file');
    earned = new Set(ids.map(String));
    saveProgress();
    renderTrophies();
    ioMsgEl.textContent = `Imported ${earned.size} earned trophies from ${file.name}.`;
  } catch {
    ioMsgEl.textContent = 'That file could not be imported — it must be a progress export from this guide.';
  }
  e.target.value = '';
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!window.confirm('Clear all earned trophies from this checklist?')) return;
  earned = new Set();
  saveProgress();
  renderTrophies();
  ioMsgEl.textContent = 'Checklist reset.';
});

await loadTrophies();
