const PROXY_URL = 'https://gentle-fire-c156.epiktet501.workers.dev';
const DIR = 1, CATEGORY = 1, DAYS = 30;

const CHECKPOINTS = [
  { id: 88, name: 'Грушів – Будомєж (для вантажівок ≤ 7,5 тонн)' },
  { id: 6,  name: 'Краківець – Корчова (для вантажівок ≥ 7,5 тонн)' },
  { id: 90, name: 'Краківець – Корчова (для порожніх вантажівок ≥ 7,5 тонн)' },
  { id: 20, name: 'Краківець – Корчова. Товари 1-24 групи УКТЗЕД (≥ 7,5 тонн)' },
  { id: 5,  name: 'Рава-Руська – Хребенне (для вантажівок ≥ 7,5 тонн)' },
  { id: 89, name: 'Рава-Руська – Хребенне (для порожніх вантажівок ≥ 7,5 тонн)' },
  { id: 19, name: 'Рава-Руська – Хребенне. Товари 1-24 групи УКТЗЕД (≥ 7,5 тонн)' },
  { id: 84, name: 'Смільниця – Кросьценко (для вантажівок ≤ 7,5 тонн)' },
  { id: 98, name: 'Угринів – Долгобичув (для вантажівок ≥ 3,5 тонн до ≤ 7,5 тонн)' },
  { id: 31, name: 'Угринів – Долгобичув (для порожніх вантажівок ≥ 7,5 тонн)' },
  { id: 80, name: 'Устилуг – Зосин (для вантажівок ≤ 7,5 тонн)' },
  { id: 7,  name: 'Устилуг – Зосин (для порожніх вантажівок ≥ 7,5 тонн)' },
  { id: 8,  name: 'Шегині – Медика (для вантажівок ≥ 7,5 тонн)' },
  { id: 91, name: 'Шегині – Медика (для порожніх вантажівок ≥ 7,5 тонн)' },
  { id: 1,  name: 'Ягодин – Дорогуськ (для вантажівок ≥ 7,5 тонн)' },
  { id: 29, name: 'Ягодин – Дорогуськ (для порожніх вантажівок ≥ 7,5 тонн)' },
  { id: 2,  name: 'Ягодин – Дорогуськ. Товари 1-24 групи УКТЗЕД (≥ 7,5 тонн)' },
  { id: 14, name: 'Ужгород – Вишнє Нємецьке (для вантажівок ≥ 3,5 тонн)' },
  { id: 87, name: 'Ужгород – Вишнє Нємецьке (для порожніх вантажівок > 3,5 тонн)' },
  { id: 17, name: 'Чоп (Тиса) – Захонь (для вантажівок ≥ 3,5 тонн)' },
  { id: 97, name: 'Чоп (Тиса) – Захонь (для порожніх вантажівок ≥ 3,5 тонн)' },
];

const CYR_TO_LAT_PLATE_MAP = {
  'А': 'A',
  'В': 'B',
  'Е': 'E',
  'І': 'I',
  'К': 'K',
  'М': 'M',
  'Н': 'H',
  'О': 'O',
  'Р': 'P',
  'С': 'C',
  'Т': 'T',
  'Х': 'X'
};

const ICON_URL = new URL('assets/img/icon.png', document.baseURI).href;
const STORAGE_KEY = 'ech_watchers_v1';
const ACTIVE_TAB_KEY = 'ech_active_watcher_id';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let watchers = [];
let activeWatcherId = null;

function createWatcher(initial = {}) {
  const id = initial.id || crypto.randomUUID();
  return {
    id,
    plate: initial.plate || '',
    interval: String(initial.interval || '180'),
    pingEvery: String(initial.pingEvery || '5'),
    checkpointId: initial.checkpointId || null,
    checkpointName: initial.checkpointName || '',
    tabLabel: initial.tabLabel || '',
    tabLabelLocked: Boolean(initial.tabLabelLocked),
    lastKey: initial.lastKey || '',
    pingCounter: Number(initial.pingCounter || 0),
    fields: initial.fields || [
      ['Пункт пропуску', '—'],
      ['Номер авто', '—'],
      ['Реєстрація в черзі', '—'],
      ['Орієнтовний час заїзду на кордон', '—'],
    ],
    status: initial.status || 'Введіть номер авто, задайте параметри сповіщень та натисніть "Старт"',
    statusClass: initial.statusClass || '',
    isRunning: Boolean(initial.isRunning),
    loopHandle: null
  };
}

function saveWatchers() {
  const serializable = watchers.map(w => ({
    id: w.id,
    plate: w.plate,
    interval: w.interval,
    pingEvery: w.pingEvery,
    checkpointId: w.checkpointId,
    checkpointName: w.checkpointName,
    tabLabel: w.tabLabel,
    tabLabelLocked: w.tabLabelLocked,
    lastKey: w.lastKey,
    pingCounter: w.pingCounter,
    fields: w.fields,
    status: w.status,
    statusClass: w.statusClass,
    isRunning: w.isRunning
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  if (activeWatcherId) {
    localStorage.setItem(ACTIVE_TAB_KEY, activeWatcherId);
  }
}

function loadWatchers() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    watchers = raw.map(item => createWatcher(item));
  } catch {
    watchers = [];
  }

  if (!watchers.length) {
    watchers = [createWatcher()];
  }

  const savedActive = localStorage.getItem(ACTIVE_TAB_KEY);
  activeWatcherId = watchers.some(w => w.id === savedActive) ? savedActive : watchers[0].id;
}

function getWatcher(id) {
  return watchers.find(w => w.id === id) || null;
}

function getActiveWatcher() {
  return getWatcher(activeWatcherId);
}

function setActiveWatcher(id) {
  if (!getWatcher(id)) return;
  activeWatcherId = id;
  saveWatchers();
  renderApp();
}

function addWatcher() {
  const watcher = createWatcher();
  watchers.push(watcher);
  activeWatcherId = watcher.id;
  saveWatchers();
  renderApp();
}

function removeWatcher(id) {
  const watcher = getWatcher(id);
  if (!watcher) return;

  stopWatcher(id);

  watchers = watchers.filter(w => w.id !== id);

  if (!watchers.length) {
    watchers = [createWatcher()];
  }

  if (!watchers.some(w => w.id === activeWatcherId)) {
    activeWatcherId = watchers[0].id;
  }

  saveWatchers();
  renderApp();
}

function setWatcherStatus(id, msg, cls = '') {
  const watcher = getWatcher(id);
  if (!watcher) return;
  watcher.status = msg;
  watcher.statusClass = cls;
  saveWatchers();
  if (watcher.id === activeWatcherId) {
    renderCard();
  }
}

function setWatcherFields(id, pairs) {
  const watcher = getWatcher(id);
  if (!watcher) return;
  watcher.fields = pairs;
  saveWatchers();
  if (watcher.id === activeWatcherId) {
    renderCard();
  }
}

function watcherDisplayTitle(watcher) {
  if (watcher.tabLabelLocked) {
    return watcher.tabLabel || 'Нове авто';
  }

  return watcher.tabLabel || watcher.plate || 'Нове авто';
}

function normPlate(value) {
  return (value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .split('')
    .map(ch => CYR_TO_LAT_PLATE_MAP[ch] || ch)
    .join('')
    .replace(/[^A-Z0-9]/g, '');
}

async function ensurePermissionInteractive() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;
  if (Notification.permission === 'default') {
    try {
      const r = await Notification.requestPermission();
      if (r !== 'granted') return false;
    } catch {
      return false;
    }
  }
  return true;
}

function notifyPlateTime(plate, eta) {
  const title = 'єЧерга';
  const body  = `🚚 ${plate || '—'}\n⏰ ${eta || '—'}`;
  try {
    const n = new Notification(title, {
      body,
      tag: `echerha-watch-${plate || 'default'}`,
      renotify: true,
      icon: ICON_URL
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    alert(`${title}\n\n${body}`);
  }
}

function apiUrl(plate, checkpointId, page = 1) {
  const base = `https://back.echerha.gov.ua/api/v4/workload/${DIR}/checkpoints/${checkpointId}/details/${CATEGORY}/${DAYS}`;
  const params = new URLSearchParams({ page, plate_number: plate });
  return `${base}?${params.toString()}`;
}

async function getJSON(url) {
  const full = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch(full, { cache: 'no-store' });
    const text = await resp.text();

    if (resp.ok) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('Bad JSON from upstream');
      }
    }

    console.warn('Upstream error', resp.status, text.slice(0, 300));

    if (resp.status === 429 || resp.status === 403) {
      const ra = Number(resp.headers.get('retry-after')) || 0;
      const wait = ra ? ra * 1000 : 300 * attempt * attempt + Math.floor(Math.random() * 400);
      await sleep(wait);
      continue;
    }

    throw new Error(`HTTP ${resp.status} · ${text.slice(0, 160)}`);
  }

  throw new Error('Rate-limited (too many retries)');
}

function mapFields(data) {
  const first = data?.data?.[0] || {};
  const cp = data?.checkpoint || {};
  return [
    ['Пункт пропуску', cp.title || '—'],
    ['Номер авто', first.plate_number || '—'],
    ['Реєстрація в черзі', first.confirmed_at || '—'],
    ['Орієнтовний час заїзду на кордон', first.estimated_time || '—'],
  ];
}

function isHitForPlate(userPlate, json) {
  const first = json?.data?.[0];
  if (!first?.plate_number) return false;
  return normPlate(first.plate_number) === normPlate(userPlate);
}

async function probeCheckpoint(plate, cpId) {
  try {
    const json = await getJSON(apiUrl(plate, cpId));
    return { ok: isHitForPlate(plate, json), json };
  } catch {
    return { ok: false, json: null };
  }
}

async function findCheckpointByPlate(plate, watcherId) {
  const watcher = getWatcher(watcherId);
  if (!watcher) return null;

  if (watcher.checkpointId) {
    setWatcherStatus(watcherId, `Шукаю на кешованому КПП (${watcher.checkpointId})…`);
    const { ok, json } = await probeCheckpoint(plate, watcher.checkpointId);
    if (ok) {
      return {
        id: watcher.checkpointId,
        name: json?.checkpoint?.title || watcher.checkpointName || String(watcher.checkpointId),
        json
      };
    }
  }

  setWatcherStatus(watcherId, 'Шукаю КПП для номера…');

  for (const cp of CHECKPOINTS) {
    const { ok, json } = await probeCheckpoint(plate, cp.id);
    if (ok) {
      return {
        id: cp.id,
        name: json?.checkpoint?.title || cp.name,
        json
      };
    }
    await sleep(150 + Math.random() * 250);
  }

  return null;
}

async function tickWatcher(watcherId) {
  const watcher = getWatcher(watcherId);
  if (!watcher) return;

  if (!watcher.plate || !watcher.checkpointId) {
    setWatcherStatus(watcherId, 'Не задано номер або КПП.', 'warn');
    return;
  }

  try {
    setWatcherStatus(watcherId, 'Завантаження…');

    const json = await getJSON(apiUrl(watcher.plate, watcher.checkpointId));
    const pairs = mapFields(json);
    setWatcherFields(watcherId, pairs);

    const first = json?.data?.[0] || {};
    const plateNow = first.plate_number || watcher.plate || '—';
    const etaNow = first.estimated_time || '—';

    const keyNow = JSON.stringify({
      position_number: first.position_number ?? null,
      confirmed_at: first.confirmed_at ?? null,
    });

    const changed = !!watcher.lastKey && keyNow !== watcher.lastKey;
    watcher.lastKey = keyNow;

    const pingEvery = Number(watcher.pingEvery || '5');
    watcher.pingCounter = (watcher.pingCounter + 1) % pingEvery;

    const shouldNotify = changed || (watcher.pingCounter === 0 && watcher.lastKey !== '');

    setWatcherStatus(
      watcherId,
      `Останнє оновлення: ${new Date().toLocaleTimeString()}${shouldNotify ? ' · нотифікація' : ''}`,
      shouldNotify ? 'ok' : ''
    );

    saveWatchers();

    if (shouldNotify) {
      notifyPlateTime(plateNow, etaNow);
    }
  } catch (e) {
    console.error(e);
    setWatcherStatus(watcherId, `Помилка: ${String(e.message || e)}`, 'err');
  }
}

async function loopWatcher(watcherId) {
  const watcher = getWatcher(watcherId);
  if (!watcher || !watcher.isRunning) return;

  await tickWatcher(watcherId);

  const current = getWatcher(watcherId);
  if (!current || !current.isRunning) return;

  const base = Number(current.interval) * 1000;
  const jitter = Math.floor(base * 0.1 * Math.random());

  current.loopHandle = setTimeout(() => {
    loopWatcher(watcherId);
  }, base + jitter);

  saveWatchers();
}

async function startWatcher(watcherId) {
  const watcher = getWatcher(watcherId);
  if (!watcher) return;

  watcher.plate = normPlate(watcher.plate);

  if (!watcher.plate) {
    setWatcherStatus(watcherId, 'Введи номер авто', 'warn');
    renderCard();
    return;
  }

  const ok = await ensurePermissionInteractive();
  if (!ok) {
    setWatcherStatus(watcherId, 'Дозволь сповіщення у браузері.', 'warn');
    return;
  }

  const found = await findCheckpointByPlate(watcher.plate, watcherId);
  if (!found) {
    setWatcherStatus(watcherId, 'Номер не знайдено на вказаних КПП.', 'warn');
    return;
  }

watcher.checkpointId = found.id;
watcher.checkpointName = found.name || String(found.id);
watcher.lastKey = '';
watcher.pingCounter = 0;
watcher.isRunning = true;

if (!watcher.tabLabelLocked) {
  watcher.tabLabel = watcher.plate;
  watcher.tabLabelLocked = true;
}

if (watcher.loopHandle) {
  clearTimeout(watcher.loopHandle);
  watcher.loopHandle = null;
}

  saveWatchers();
  renderApp();

  setWatcherStatus(
    watcherId,
    `Знайдено КПП: ${watcher.checkpointName} (ID ${watcher.checkpointId}). Починаю моніторинг…`
  );

  const startDelay = Math.floor(Math.random() * 1500);
  watcher.loopHandle = setTimeout(() => loopWatcher(watcherId), startDelay);
  saveWatchers();
}

function stopWatcher(watcherId) {
  const watcher = getWatcher(watcherId);
  if (!watcher) return;

  if (watcher.loopHandle) {
    clearTimeout(watcher.loopHandle);
    watcher.loopHandle = null;
  }

  watcher.isRunning = false;
  saveWatchers();
  setWatcherStatus(watcherId, 'Зупинено.', 'warn');
}

function renderTabsHtml() {
  return watchers.map(watcher => `
    <div
      class="tab-btn ${watcher.id === activeWatcherId ? 'active' : ''}"
      data-tab-id="${watcher.id}"
      role="tab"
      tabindex="0"
    >
      <span class="tab-btn-label" title="Подвійний клік, щоб перейменувати">${watcherDisplayTitle(watcher)}</span>
      <button
        class="tab-edit-btn"
        data-edit-tab-id="${watcher.id}"
        type="button"
        title="Перейменувати таб"
        aria-label="Перейменувати таб ${watcherDisplayTitle(watcher)}"
      >
        ✎
      </button>
      <button
        class="tab-delete-btn"
        data-delete-tab-id="${watcher.id}"
        type="button"
        title="Видалити авто"
        aria-label="Видалити авто ${watcherDisplayTitle(watcher)}"
      >
        ✕
      </button>
    </div>
  `).join('');
}

function renderFieldsHtml(pairs) {
  return pairs.map(([k, v]) => `
    <div class="frow">
      <div class="k">${k}</div>
      <div class="v mono" title="${String(v ?? '—')}">${v ?? '—'}</div>
    </div>
  `).join('');
}

function renderCard() {
  const host = $('cardHost');
  const watcher = getActiveWatcher();

  if (!watcher) {
    host.innerHTML = `<div class="card-host-empty">Немає активної вкладки.</div>`;
    return;
  }

host.innerHTML = `
  <div class="card-shell">
    <div class="card-tabs">
      <div class="tabs">
        ${renderTabsHtml()}
      </div>
      <button id="addWatcherBtn" class="tab-add-btn" title="Додати авто" type="button">+</button>
    </div>

    <div class="card">
      <div class="card-topbar">
        <div class="card-plate-title">${watcher.plate || 'Нове авто'}</div>
      </div>

      <div class="hdr">
        <div class="title">
          <div class="logo">
            <img class="logo" src="assets/img/logo.png" alt="">
          </div>
        </div>

        <div class="controls">
          <label>
            <h3>Введіть номер тягача або автомобіля (латиницею)</h3>
            <input id="plateInput" value="${watcher.plate}" size="14"/>
          </label>

          <label>
            <h3>Як часто робити запит</h3>
            <div class="select-wrap">
              <select id="intervalInput" title="Як часто опитувати API">
                <option value="60" ${watcher.interval === '60' ? 'selected' : ''}>Щохвилини</option>
                <option value="180" ${watcher.interval === '180' ? 'selected' : ''}>Кожні 3 хв</option>
                <option value="300" ${watcher.interval === '300' ? 'selected' : ''}>Кожні 5 хв</option>
              </select>
            </div>
          </label>

          <label>
            <h3>Як часто показувати сповіщення</h3>
            <div class="select-wrap">
              <select id="pingEveryInput" title="Нагадувати без змін кожні N перевірок">
                <option value="3" ${watcher.pingEvery === '3' ? 'selected' : ''}>Нагадувати кожні 3 перевірки</option>
                <option value="5" ${watcher.pingEvery === '5' ? 'selected' : ''}>Нагадувати кожні 5 перевірок</option>
                <option value="10" ${watcher.pingEvery === '10' ? 'selected' : ''}>Нагадувати кожні 10 перевірок</option>
              </select>
            </div>
          </label>

          <div class="buttons">
            <button id="startBtn" type="button">Старт</button>
            <button id="stopBtn" class="secondary" type="button">Стоп</button>
          </div>
        </div>
      </div>

      <div class="wrap">
        <div class="pane">
          <div class="ph">Дані по авто</div>
          <div id="fieldsBox">${renderFieldsHtml(watcher.fields)}</div>
        </div>
      </div>

      <div class="foot">
        <div id="statusBox" class="muted ${watcher.statusClass || ''}">
          ${watcher.status}
        </div>

        <div class="foot-actions">
          <button id="testNotifBtn" class="tiny-btn" title="Показати тестову нотифікацію" type="button">🔔</button>
          <button id="helpBtn" class="help-btn" aria-haspopup="dialog" aria-controls="helpModal" aria-expanded="false" title="Інструкція" type="button">?</button>
        </div>
      </div>
    </div>
  </div>
`;

  bindCardEvents(watcher.id);
}

function bindCardEvents(watcherId) {
  const watcher = getWatcher(watcherId);
  if (!watcher) return;

  const plateInput = $('plateInput');
  const intervalInput = $('intervalInput');
  const pingEveryInput = $('pingEveryInput');
  const startBtn = $('startBtn');
  const stopBtn = $('stopBtn');
  const testNotifBtn = $('testNotifBtn');
  const helpBtn = $('helpBtn');
  const addWatcherBtn = $('addWatcherBtn');

  document.querySelectorAll('[data-tab-id]').forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-tab-id]')) return;
      if (e.target.closest('[data-edit-tab-id]')) return;

      const tabId = tab.getAttribute('data-tab-id');
      setActiveWatcher(tabId);
    });

    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('[data-delete-tab-id]')) return;

      e.preventDefault();
      const tabId = tab.getAttribute('data-tab-id');
      setActiveWatcher(tabId);
    });
  });

document.querySelectorAll('[data-edit-tab-id]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();

    const tabId = btn.getAttribute('data-edit-tab-id');
    const tab = document.querySelector(`[data-tab-id="${tabId}"]`);
    const labelEl = tab?.querySelector('.tab-btn-label');
    const freshWatcher = getWatcher(tabId);

    if (!tab || !labelEl || !freshWatcher) return;
    if (tab.querySelector('.tab-label-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-label-input';
    input.value = freshWatcher.tabLabel || '';
    input.maxLength = 40;

    let closed = false;

    const cleanup = () => {
      document.removeEventListener('pointerdown', handleOutsideClick, true);
    };

    const commit = () => {
      if (closed) return;
      closed = true;

      const currentWatcher = getWatcher(tabId);
      if (!currentWatcher) {
        cleanup();
        input.remove();
        return;
      }

      currentWatcher.tabLabel =
        input.value.trim() || currentWatcher.tabLabel || currentWatcher.plate || 'Нове авто';

      currentWatcher.tabLabelLocked = true;

      saveWatchers();

      labelEl.textContent = watcherDisplayTitle(currentWatcher);
      labelEl.hidden = false;
      cleanup();
      input.remove();
    };

    const cancel = () => {
      if (closed) return;
      closed = true;

      labelEl.hidden = false;
      cleanup();
      input.remove();
    };

    const stopInputEvent = (ev) => {
      ev.stopPropagation();
    };

    const handleOutsideClick = (ev) => {
      if (ev.target === input) return;
      commit();
    };

    input.addEventListener('pointerdown', stopInputEvent);
    input.addEventListener('mousedown', stopInputEvent);
    input.addEventListener('click', stopInputEvent);

    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();

      if (ev.key === 'Enter') {
        commit();
        return;
      }

      if (ev.key === 'Escape') {
        cancel();
      }
    });

    labelEl.hidden = true;
    labelEl.insertAdjacentElement('afterend', input);

    setTimeout(() => {
      document.addEventListener('pointerdown', handleOutsideClick, true);
      input.focus();
      input.select();
    }, 0);
  });
});

  document.querySelectorAll('[data-delete-tab-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = btn.getAttribute('data-delete-tab-id');
      removeWatcher(tabId);
    });
  });

  addWatcherBtn.addEventListener('click', addWatcher);

  plateInput.addEventListener('input', () => {
    watcher.plate = normPlate(plateInput.value);
    plateInput.value = watcher.plate;

    if (!watcher.tabLabelLocked) {
      watcher.tabLabel = watcher.plate;
    }

    const titleEl = document.querySelector('.card-plate-title');
    if (titleEl) {
      titleEl.textContent = watcher.plate || 'Нове авто';
    }

    const activeTabLabel = document.querySelector(
      `[data-tab-id="${watcher.id}"] .tab-btn-label`
    );
    if (activeTabLabel) {
      activeTabLabel.textContent = watcherDisplayTitle(watcher);
    }

    const activeTabDeleteBtn = document.querySelector(
      `[data-delete-tab-id="${watcher.id}"]`
    );
    if (activeTabDeleteBtn) {
      activeTabDeleteBtn.setAttribute(
        'aria-label',
        `Видалити авто ${watcherDisplayTitle(watcher)}`
      );
    }

    saveWatchers();
  });

  document.querySelectorAll('[data-tab-id]').forEach(tab => {
    const labelEl = tab.querySelector('.tab-btn-label');
    if (!labelEl) return;
  });

  intervalInput.addEventListener('change', () => {
    watcher.interval = intervalInput.value;
    saveWatchers();
  });

  pingEveryInput.addEventListener('change', () => {
    watcher.pingEvery = pingEveryInput.value;
    saveWatchers();
  });

  startBtn.addEventListener('click', () => startWatcher(watcherId));
  stopBtn.addEventListener('click', () => stopWatcher(watcherId));

  testNotifBtn.addEventListener('click', async () => {
    const ok = await ensurePermissionInteractive();
    if (!ok) {
      setWatcherStatus(watcherId, 'Дозволь сповіщення у браузері, тоді спрацює тест.', 'warn');
      return;
    }
    notifyPlateTime(watcher.plate || '🥳', 'Сповіщення працюють!');
    setWatcherStatus(watcherId, 'Тестову нотифікацію показано.', 'ok');
  });

  helpBtn.addEventListener('click', openHelp);
}




// ///////////////////







function renderApp() {
  renderCard();
}

let _prevFocus = null;

function openHelp() {
  const helpBtn = $('helpBtn');
  const helpModal = $('helpModal');
  const helpDialog = $('helpDialog');

  _prevFocus = document.activeElement;
  helpModal.classList.add('open');
  helpModal.removeAttribute('hidden');

  if (helpBtn) {
    helpBtn.setAttribute('aria-expanded', 'true');
  }

  helpDialog.focus();
  document.documentElement.style.overflow = 'hidden';
}

function closeHelp() {
  const helpBtn = $('helpBtn');
  const helpModal = $('helpModal');

  helpModal.classList.remove('open');
  helpModal.setAttribute('hidden', '');

  if (helpBtn) {
    helpBtn.setAttribute('aria-expanded', 'false');
  }

  document.documentElement.style.overflow = '';
  (_prevFocus || helpBtn)?.focus();
}

function setupGlobalEvents() {
  const helpModal = $('helpModal');
  const helpClose = $('helpClose');

  helpClose.addEventListener('click', closeHelp);

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      closeHelp();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.classList.contains('open')) {
      closeHelp();
    }
  });
}

function restoreRunningWatchers() {
  let offset = 0;

  for (const watcher of watchers) {
    if (!watcher.isRunning) continue;

    watcher.loopHandle = setTimeout(() => loopWatcher(watcher.id), offset);
    offset += 2000;
  }
}

function initPermissionHint() {
  const watcher = getActiveWatcher();
  if (!watcher) return;

  if (!('Notification' in window)) {
    setWatcherStatus(watcher.id, 'Браузер не підтримує сповіщення.', 'err');
    return;
  }

  if (Notification.permission === 'denied') {
    setWatcherStatus(watcher.id, 'Сповіщення заборонені для цього сайту.', 'err');
    return;
  }

  if (Notification.permission === 'default') {
    setWatcherStatus(watcher.id, 'Натисни «🔔» → Дозволити.', 'warn');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadWatchers();
  setupGlobalEvents();
  renderApp();
  initPermissionHint();
  restoreRunningWatchers();
});