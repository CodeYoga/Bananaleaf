/* ============================================================
   NOURISH — Meal Tracker
   Google OAuth (implicit flow) + Google Drive App Data folder
   ============================================================ */

// ── CONFIG ───────────────────────────────────────────────────
// IMPORTANT: Replace with your own values from Google Cloud Console
const CONFIG = {
  CLIENT_ID: '588591713716-vh6994k5hlqdtfs87ioui0ao12d09766.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.appdata',
  DRIVE_FILE_NAME: 'nourish-meals.json',
};

// ── STATE ────────────────────────────────────────────────────
let state = {
  accessToken: null,
  driveFileId: null,
  meals: {},        // { "YYYY-MM-DD": { breakfast, lunch, dinner, snack } }
  currentWeekStart: getWeekStart(new Date()),
  userInfo: null,
};

// ── DOM REFS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const authScreen   = $('auth-screen');
const appScreen    = $('app-screen');
const signInBtn    = $('sign-in-btn');
const signOutBtn   = $('sign-out-btn');
const syncBtn      = $('sync-btn');
const weekLabel    = $('week-label');
const weekTbody    = $('week-tbody');
const prevWeekBtn  = $('prev-week');
const nextWeekBtn  = $('next-week');
const todayBtn     = $('today-btn');
const modalOverlay = $('modal-overlay');
const modalClose   = $('modal-close');
const modalCancel  = $('modal-cancel');
const modalSave    = $('modal-save');
const modalTitle   = $('modal-title');
const toast        = $('toast');
const userAvatar   = $('user-avatar');

let editingDate = null;

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Check for OAuth token in URL hash (implicit flow callback)
  const hash = window.location.hash;
  if (hash.includes('access_token')) {
const hash = window.location.hash;
const search = window.location.search;
const tokenSource = hash.includes('access_token') ? hash.slice(1) : 
                    search.includes('access_token') ? search.slice(1) : null;

if (tokenSource) {
  const params = new URLSearchParams(tokenSource);
  const token = params.get('access_token');
  if (token) {
    history.replaceState(null, '', window.location.pathname);
    handleToken(token);
    return;
  }
}

  // Check localStorage for existing token
  const saved = localStorage.getItem('nourish_token');
  const expiry = localStorage.getItem('nourish_token_expiry');
  if (saved && expiry && Date.now() < parseInt(expiry)) {
    handleToken(saved);
    return;
  }

  showScreen('auth');
});

// ── AUTH ─────────────────────────────────────────────────────
function startOAuth() {
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
  const scope       = encodeURIComponent(CONFIG.SCOPES);
  const url = `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${CONFIG.CLIENT_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=token` +
    `&scope=${scope}` +
    ` https://www.googleapis.com/auth/userinfo.profile` +
    `&prompt=consent`;
  window.location.href = url;
}

async function handleToken(token) {
  state.accessToken = token;
  localStorage.setItem('nourish_token', token);
  localStorage.setItem('nourish_token_expiry', Date.now() + 3500 * 1000); // ~1hr

  try {
    await fetchUserInfo();
    await loadFromDrive();
    showScreen('app');
    renderWeek();
  } catch (err) {
    console.error('Init error:', err);
    // Token may have expired
    localStorage.removeItem('nourish_token');
    localStorage.removeItem('nourish_token_expiry');
    showToast('Session expired. Please sign in again.', 'error');
    showScreen('auth');
  }
}

async function fetchUserInfo() {
  const res = await gFetch('https://www.googleapis.com/oauth2/v2/userinfo');
  state.userInfo = res;
  if (res.picture) {
    userAvatar.innerHTML = `<img src="${res.picture}" alt="${res.name || 'User'}" />`;
  } else {
    userAvatar.textContent = (res.name || 'U')[0].toUpperCase();
  }
}

function signOut() {
  state.accessToken = null;
  state.driveFileId = null;
  state.meals = {};
  state.userInfo = null;
  localStorage.removeItem('nourish_token');
  localStorage.removeItem('nourish_token_expiry');
  showScreen('auth');
}

// ── GOOGLE DRIVE ─────────────────────────────────────────────
async function gFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${state.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadFromDrive() {
  // List files in appDataFolder
  const list = await gFetch(
    'https://www.googleapis.com/drive/v3/files?' +
    'spaces=appDataFolder&fields=files(id,name)&pageSize=10'
  );
  const file = (list.files || []).find(f => f.name === CONFIG.DRIVE_FILE_NAME);

  if (file) {
    state.driveFileId = file.id;
    const content = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { 'Authorization': `Bearer ${state.accessToken}` } }
    );
    const text = await content.text();
    try {
      state.meals = JSON.parse(text);
    } catch {
      state.meals = {};
    }
  } else {
    state.meals = {};
  }
}

async function saveToDrive() {
  syncBtn.classList.add('syncing');
  try {
    const body = JSON.stringify(state.meals);
    const meta = { name: CONFIG.DRIVE_FILE_NAME, parents: ['appDataFolder'] };

    if (state.driveFileId) {
      // Update existing file
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${state.driveFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${state.accessToken}`,
            'Content-Type': 'application/json',
          },
          body,
        }
      );
    } else {
      // Create new file
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.accessToken}`,
            'Content-Type': 'multipart/related; boundary=bound',
          },
          body: [
            '--bound\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(meta),
            '\r\n--bound\r\nContent-Type: application/json\r\n\r\n' + body,
            '\r\n--bound--',
          ].join(''),
        }
      );
      const data = await res.json();
      state.driveFileId = data.id;
    }
    showToast('Saved to Drive ✓', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showToast('Sync failed: ' + err.message, 'error');
  } finally {
    syncBtn.classList.remove('syncing');
  }
}

// ── DATE HELPERS ─────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateStr(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekRange(start) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}–${end.getDate()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

// ── RENDER ────────────────────────────────────────────────────
function renderWeek() {
  weekLabel.textContent = formatWeekRange(state.currentWeekStart);
  weekTbody.innerHTML = '';
  const todayKey = dateStr(new Date());

  for (let i = 0; i < 7; i++) {
    const date = addDays(state.currentWeekStart, i);
    const key  = dateStr(date);
    const data = state.meals[key] || {};
    const isToday = key === todayKey;

    const tr = document.createElement('tr');
    if (isToday) tr.classList.add('is-today');
    tr.dataset.date = key;

    const meals = ['breakfast','lunch','dinner','snack'];
    const mealCell = (field) => {
      const val = data[field];
      if (val) return `<span class="meal-cell-text">${escapeHtml(val)}</span>`;
      return `<span class="meal-cell-empty">—</span>`;
    };

    tr.innerHTML = `
      <td>
        <div class="day-cell">
          <span class="day-name">${formatDay(date)}</span>
          <span class="day-date">${formatDate(date)}</span>
        </div>
      </td>
      <td>${mealCell('breakfast')}</td>
      <td>${mealCell('lunch')}</td>
      <td>${mealCell('dinner')}</td>
      <td>
        ${mealCell('snack')}
        <span class="add-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Edit
        </span>
      </td>
    `;

    tr.addEventListener('click', () => openModal(key, date));
    weekTbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal(dateKey, date) {
  editingDate = dateKey;
  const data = state.meals[dateKey] || {};
  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  modalTitle.textContent = dayLabel;
  $('field-breakfast').value = data.breakfast || '';
  $('field-lunch').value     = data.lunch     || '';
  $('field-dinner').value    = data.dinner    || '';
  $('field-snack').value     = data.snack     || '';
  modalOverlay.classList.remove('hidden');
  $('field-breakfast').focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  editingDate = null;
}

function saveModal() {
  if (!editingDate) return;
  const entry = {
    breakfast: $('field-breakfast').value.trim(),
    lunch:     $('field-lunch').value.trim(),
    dinner:    $('field-dinner').value.trim(),
    snack:     $('field-snack').value.trim(),
  };
  // Only store if at least one field has content
  if (entry.breakfast || entry.lunch || entry.dinner || entry.snack) {
    state.meals[editingDate] = entry;
  } else {
    delete state.meals[editingDate];
  }
  closeModal();
  renderWeek();
  saveToDrive();
}

// ── SCREEN ────────────────────────────────────────────────────
function showScreen(name) {
  authScreen.classList.toggle('active', name === 'auth');
  appScreen.classList.toggle('active', name === 'app');
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = `toast${type ? ' ' + type : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// ── EVENT LISTENERS ──────────────────────────────────────────
signInBtn.addEventListener('click', startOAuth);
signOutBtn.addEventListener('click', signOut);
syncBtn.addEventListener('click', saveToDrive);

prevWeekBtn.addEventListener('click', () => {
  state.currentWeekStart = addDays(state.currentWeekStart, -7);
  renderWeek();
});

nextWeekBtn.addEventListener('click', () => {
  state.currentWeekStart = addDays(state.currentWeekStart, 7);
  renderWeek();
});

todayBtn.addEventListener('click', () => {
  state.currentWeekStart = getWeekStart(new Date());
  renderWeek();
});

modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalSave.addEventListener('click', saveModal);

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && e.metaKey && !modalOverlay.classList.contains('hidden')) saveModal();
});

// ── SERVICE WORKER ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}
