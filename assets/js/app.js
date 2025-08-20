/* === Автопошук КПП за номером → далі моніторинг як раніше === */
const PROXY_URL = 'https://gentle-fire-c156.epiktet501.workers.dev';
const DIR = 1, CATEGORY = 1, DAYS = 30;

/* 1) СПИСОК КПП (порядок важливий — перший збіг виграє) */
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

/* Стан */
let loopHandle = null;       // заміна setInterval → самопланувальник
let lastKeyMap = {};         // ключ: `${plate}|${cpId}` → JSON.stringify({...})
let selectedCheckpointId = null;
let selectedCheckpointName = '';

/* Утиліти */
const $ = (id) => document.getElementById(id);
const setStatus = (msg, cls='') => { $('status').className = 'muted ' + cls; $('status').textContent = msg; };
const normPlate = (p) => (p || '').replace(/\s+/g, '').toUpperCase();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function apiUrl(plate, checkpointId, page=1) {
  const base = `https://back.echerha.gov.ua/api/v4/workload/${DIR}/checkpoints/${checkpointId}/details/${CATEGORY}/${DAYS}`;
  const params = new URLSearchParams({ page, plate_number: plate });
  return `${base}?${params.toString()}`;
}

async function ensurePermissionInteractive() {
  if (!('Notification' in window)) { setStatus('Браузер не підтримує сповіщення.', 'err'); return false; }
  if (Notification.permission === 'denied') { setStatus('Сповіщення заборонені для цього сайту.', 'err'); return false; }
  if (Notification.permission === 'default') {
    try { const r = await Notification.requestPermission(); if (r !== 'granted') return false; } catch { return false; }
  }
  return true;
}

const ICON_URL = new URL('assets/img/icon.png', document.baseURI).href;

function notifyPlateTime(plate, eta) {
  const title = 'єЧерга';
  const body  = `🚚 ${plate || '—'}\n⏰ ${eta || '—'}`;
  try {
    const n = new Notification(title, {
      body,
      tag: 'echerha-watch',
      renotify: true,
      icon: ICON_URL
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) {
    alert(`${title}\n\n${body}`);
  }
}

/* ——— FETCH з ретраями/бекоффом (403/429) і зрозумілим текстом помилки ——— */
async function getJSON(url) {
  const full = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch(full, { cache:'no-store' });
    const text = await resp.text();
    if (resp.ok) {
      try { return JSON.parse(text); }
      catch { throw new Error('Bad JSON from upstream'); }
    }
    // лог для діагностики
    console.warn('Upstream error', resp.status, text.slice(0, 300));
    // 429/403 → експоненційний бекофф
    if (resp.status === 429 || resp.status === 403) {
      const ra = Number(resp.headers.get('retry-after')) || 0;
      const wait = ra ? ra*1000 : 300*attempt*attempt + Math.floor(Math.random()*400);
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
  const cpTitle = cp.title;
  return [
    ['Пункт пропуску', cpTitle],
    ['Номер авто', first.plate_number || '—'],
    ['Реєстрація в черзі', first.confirmed_at || '—'],
    ['Орієнтовний час заїзду на кордон', first.estimated_time || '—'],
  ];
}
function renderFields(pairs) {
  const box = $('fields');
  box.innerHTML = '';
  for (const [k,v] of pairs) {
    const row = document.createElement('div');
    row.className = 'frow';
    row.innerHTML = `<div class="k">${k}</div><div class="v mono" title="${String(v ?? '—')}">${v ?? '—'}</div>`;
    box.appendChild(row);
  }
}

/* === НОВЕ: пошук КПП за номером з паузами (анти-rate-limit) === */
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
/* Алгоритм:
   1) якщо є кеш для цього номеру — спершу пробуємо його
   2) якщо не зійшлось — ідемо послідовно по CHECKPOINTS із паузами
*/
async function findCheckpointByPlate(plate) {
  const cachedId = Number(localStorage.getItem('ech_last_cp:' + normPlate(plate)) || 0);
  if (cachedId) {
    setStatus(`Шукаю на кешованому КПП (${cachedId})…`);
    const { ok, json } = await probeCheckpoint(plate, cachedId);
    if (ok) return { id: cachedId, name: json?.checkpoint?.title || String(cachedId), json };
  }
  setStatus('Шукаю КПП для номера…');
  for (const cp of CHECKPOINTS) {
    const { ok, json } = await probeCheckpoint(plate, cp.id);
    if (ok) return { id: cp.id, name: json?.checkpoint?.title || cp.name, json };
    await sleep(120 + Math.random()*200); // 120–320 мс пауза між пробами
  }
  return null;
}

/* ——— Основний тик — тепер знає cpId і використовує пер-пару лічильник ——— */
async function tick(plate, cpId) {
  try {
    setStatus('Завантаження…');
    const json = await getJSON(apiUrl(plate, cpId));
    renderFields(mapFields(json));

    const first = json?.data?.[0] || {};
    const plateNow = first.plate_number || '—';
    const etaNow   = first.estimated_time || '—';

    // Стабільний ключ стану (без estimated_time)
    const keyNow = JSON.stringify({
      position_number: first.position_number ?? null,
      confirmed_at   : first.confirmed_at ?? null,
    });

    const keyCombo = `${normPlate(plate)}|${String(cpId)}`;
    const lastKey = lastKeyMap[keyCombo] ?? localStorage.getItem('ech_last_key:' + keyCombo) ?? '';
    const changed = !!lastKey && keyNow !== lastKey;

    lastKeyMap[keyCombo] = keyNow;
    localStorage.setItem('ech_last_key:' + keyCombo, keyNow);

    // Лічильник пінгів на комбінацію plate|cp
    const counterKey = 'ech_pingCounter:' + keyCombo;
    let pingCounter = Number(localStorage.getItem(counterKey) || 0);
    const pingEvery = Number($('pingEvery').value || '5');
    pingCounter = (pingCounter + 1) % pingEvery;
    localStorage.setItem(counterKey, String(pingCounter));

    const shouldNotify = changed || (pingCounter === 0 && lastKey !== '');

    setStatus(`Останнє оновлення: ${new Date().toLocaleTimeString()}${shouldNotify ? ' · нотифікація' : ''}`, shouldNotify ? 'ok' : '');
    if (shouldNotify) notifyPlateTime(plateNow, etaNow, true);

  } catch (e) {
    console.error(e);
    setStatus(`Помилка: ${String(e.message || e)}`, 'err');
  }
}

/* ——— Самопланувальник з джиттером ±10% замість setInterval ——— */
async function loop(plate, cpId) {
  await tick(plate, cpId);
  const base = Number($('interval').value) * 1000;
  const jitter = Math.floor(base * 0.1 * Math.random());
  loopHandle = setTimeout(() => loop(plate, cpId), base + jitter);
}

/* === Старт/Стоп з автопошуком КПП === */
async function startPolling() {
  const plate = $('plate').value.trim();
  if (!plate) { setStatus('Введи номер авто', 'warn'); return; }
  const ok = await ensurePermissionInteractive(); if (!ok) return;

  // Зберігаємо вибір користувача
  localStorage.setItem('ech_plate', plate);
  localStorage.setItem('ech_interval', $('interval').value);
  localStorage.setItem('ech_pingEvery', $('pingEvery').value);

  // Знаходимо КПП
  const found = await findCheckpointByPlate(plate);
  if (!found) { setStatus('Номер не знайдено на вказаних КПП.', 'warn'); return; }

  selectedCheckpointId = found.id;
  selectedCheckpointName = found.name || String(found.id);
  localStorage.setItem('ech_last_cp:' + normPlate(plate), String(selectedCheckpointId));

  // Скидаємо стан лише для цього plate+cp
  const keyCombo = `${normPlate(plate)}|${String(selectedCheckpointId)}`;
  lastKeyMap[keyCombo] = '';
  localStorage.setItem('ech_last_key:' + keyCombo, '');
  localStorage.setItem('ech_pingCounter:' + keyCombo, '0');

  clearTimeout(loopHandle);
  setStatus(`Знайдено КПП: ${selectedCheckpointName} (ID ${selectedCheckpointId}). Починаю моніторинг…`);
  await loop(plate, selectedCheckpointId);
}
function stopPolling(){
  clearTimeout(loopHandle);
  setStatus('Зупинено.', 'warn');
}

/* Події UI */
$('start').onclick = startPolling;
$('stop').onclick  = stopPolling;

// тестова нотифікація у футері
const testBtn = document.getElementById('testNotif');
if (testBtn) {
  testBtn.addEventListener('click', async () => {
    const ok = await ensurePermissionInteractive();
    if (!ok) { setStatus('Дозволь сповіщення у браузері, тоді спрацює тест.', 'warn'); return; }
    const now = new Date().toLocaleTimeString();
    notifyPlateTime('🥳', `Сповіщення працюють!`, true);
    setStatus('Тестову нотифікацію показано.', 'ok');
  });
}

/* Відновлення налаштувань */
$('plate').value = localStorage.getItem('ech_plate') || '';
$('interval').value = localStorage.getItem('ech_interval') || '180';
$('pingEvery').value = localStorage.getItem('ech_pingEvery') || '5';

/* Підказка про дозволи */
(function hintPerm(){
  if (!('Notification' in window)) { setStatus('Браузер не підтримує сповіщення.', 'err'); return; }
  if (Notification.permission === 'denied') setStatus('Сповіщення заборонені для цього сайту.', 'err');
  if (Notification.permission === 'default') setStatus('Натисни «Тест нотифікації» → Дозволити.', 'warn');
})();

document.addEventListener('DOMContentLoaded', () => {
  const helpBtn    = document.getElementById('helpBtn');
  const helpModal  = document.getElementById('helpModal');
  const helpClose  = document.getElementById('helpClose');
  const helpDialog = document.getElementById('helpDialog');

  if (!helpBtn || !helpModal || !helpClose || !helpDialog) {
    console.error('Help modal: elements not found (ids: helpBtn, helpModal, helpClose, helpDialog).');
    return;
  }

  let _prevFocus = null;

  function openHelp(){
    _prevFocus = document.activeElement;
    helpModal.classList.add('open');
    helpModal.removeAttribute('hidden');
    helpBtn.setAttribute('aria-expanded','true');
    helpDialog.focus();
    document.documentElement.style.overflow = 'hidden';
  }

  function closeHelp(){
    helpModal.classList.remove('open');
    helpModal.setAttribute('hidden','');
    helpBtn.setAttribute('aria-expanded','false');
    document.documentElement.style.overflow = '';
    (_prevFocus || helpBtn).focus();
  }

  helpBtn.addEventListener('click', openHelp);
  helpClose.addEventListener('click', closeHelp);
  helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.classList.contains('open')) closeHelp();
  });
});