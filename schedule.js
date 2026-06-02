import { supabase } from './supabase.js';

/**
 * =========================
 * STATE
 * =========================
 */
let currentDate = new Date();
let bookings = [];
let availability = [];
let currentUser = null;

/**
 * =========================
 * INIT
 * =========================
 */
document.addEventListener('DOMContentLoaded', async () => {
  await initUser();
  await loadData();

  setupProfileImage();
  setupHamburgerMenu();

  renderCalendar();
  renderStats();
  renderUpcomingBookings();

  setupForm();
  setupCalendarButtons();
});

/**
 * =========================
 * GET USER
 * =========================
 */
async function initUser() {
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user || null;

  if (!currentUser) {
    window.location.href = 'login.html';
  }
}

/**
 * =========================
 * LOAD DATA
 * =========================
 */
async function loadData() {
  if (!currentUser) return;

  const userId = currentUser.id;

  // Load bookings where user is provider OR client
  const [providerRes, clientRes, availRes] = await Promise.all([
    supabase.from('bookings').select('*').eq('provider_id', userId),
    supabase.from('bookings').select('*').eq('user_id', userId),
    supabase.from('availability').select('*').eq('provider_id', userId),
  ]);

  // Merge and deduplicate bookings by id
  const allBookings = [
    ...(providerRes.data || []),
    ...(clientRes.data || []),
  ];
  const seen = new Set();
  bookings = allBookings.filter(b => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  availability = availRes.data || [];

  if (providerRes.error) console.error('Provider bookings error:', providerRes.error.message);
  if (clientRes.error) console.error('Client bookings error:', clientRes.error.message);
  if (availRes.error) console.error('Availability error:', availRes.error.message);
}

/**
 * =========================
 * PROFILE IMAGE
 * =========================
 */
function setupProfileImage() {
  const profileIcon = document.querySelector('[data-profile-icon="true"]');
  if (!profileIcon || !currentUser) return;

  const avatar =
    currentUser.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      currentUser.email || 'User'
    )}`;

  profileIcon.innerHTML = `
    <img 
      src="${avatar}" 
      alt="Profile"
      class="w-10 h-10 rounded-full object-cover"
    />
  `;
}

/**
 * =========================
 * HAMBURGER MENU
 * =========================
 */
function setupHamburgerMenu() {
  const hamburger = document.getElementById('hamburger');
  const sideMenu = document.getElementById('sideMenu');
  const closeMenu = document.getElementById('closeMenu');
  const overlay = document.getElementById('menuOverlay');

  if (!hamburger || !sideMenu || !closeMenu || !overlay) return;

  const openMenu = () => {
    sideMenu.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  };

  const close = () => {
    sideMenu.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  };

  hamburger.addEventListener('click', openMenu);
  closeMenu.addEventListener('click', close);
  overlay.addEventListener('click', close);
}

/**
 * =========================
 * CALENDAR
 * =========================
 */
function renderCalendar() {
  const calendar = document.getElementById('calendarDays');
  const monthYear = document.getElementById('monthYear');

  if (!calendar || !monthYear) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const todayStr = toDateStr(today);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  monthYear.innerText = currentDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  calendar.innerHTML = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    calendar.innerHTML += `<div></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(new Date(year, month, day));

    const hasBooking = bookings.some(b => normalizeDate(b.date) === dateStr);
    const isAvailable = availability.some(a => normalizeDate(a.date) === dateStr);
    const isToday = dateStr === todayStr;

    let classes = 'p-2 text-center rounded cursor-pointer transition hover:opacity-80 text-sm font-medium';

    if (hasBooking) {
      classes += ' bg-blue-500 text-white';
    } else if (isAvailable) {
      classes += ' bg-green-500 text-white';
    } else {
      classes += ' bg-gray-100 text-gray-700 hover:bg-gray-200';
    }

    if (isToday) {
      classes += ' ring-2 ring-offset-1 ring-blue-400';
    }

    const cell = document.createElement('div');
    cell.className = classes;
    cell.dataset.date = dateStr;
    cell.innerText = day;

    cell.addEventListener('click', () => handleDayClick(dateStr));

    calendar.appendChild(cell);
  }
}

/**
 * Handle clicking a calendar day — pre-fill the availability form date
 */
function handleDayClick(dateStr) {
  const dateInput = document.getElementById('availabilityDate');
  if (dateInput) {
    dateInput.value = dateStr;
  }

  // Show bookings for that day
  const dayBookings = bookings.filter(b => normalizeDate(b.date) === dateStr);
  const dayAvailability = availability.filter(a => normalizeDate(a.date) === dateStr);

  if (dayBookings.length === 0 && dayAvailability.length === 0) return;

  const lines = [];

  if (dayAvailability.length > 0) {
    lines.push(`✅ Available: ${dayAvailability.map(a => `${a.start_time} – ${a.end_time}`).join(', ')}`);
  }

  if (dayBookings.length > 0) {
    lines.push(`📅 Bookings: ${dayBookings.map(b => `${b.service_name || 'Service'} (${b.status})`).join(', ')}`);
  }

  alert(`${dateStr}\n\n${lines.join('\n')}`);
}

/**
 * =========================
 * NAV MONTH
 * =========================
 */
function setupCalendarButtons() {
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('nextMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
}

/**
 * =========================
 * AVAILABILITY FORM
 * =========================
 */
function setupForm() {
  const form = document.getElementById('availabilityForm');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = document.getElementById('availabilityDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (!currentUser) return;

    // Validate times
    if (startTime >= endTime) {
      alert('End time must be after start time.');
      return;
    }

    // Check for duplicate availability on same date
    const duplicate = availability.find(
      a => normalizeDate(a.date) === date && a.provider_id === currentUser.id
    );

    if (duplicate) {
      const confirmUpdate = confirm(
        `You already have availability set for ${date} (${duplicate.start_time} – ${duplicate.end_time}).\n\nDo you want to add another slot?`
      );
      if (!confirmUpdate) return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Saving...';

    const { error } = await supabase.from('availability').insert([
      {
        provider_id: currentUser.id,
        date,
        start_time: startTime,
        end_time: endTime,
      },
    ]);

    submitBtn.disabled = false;
    submitBtn.innerText = 'Mark as Available';

    if (error) {
      alert(`Failed to set availability: ${error.message}`);
      return;
    }

    // Clear form
    form.reset();

    // Reload and re-render everything
    await loadData();
    renderCalendar();
    renderStats();
    renderUpcomingBookings();

    alert('✅ Availability saved!');
  });
}

/**
 * =========================
 * STATS
 * =========================
 */
function renderStats() {
  const total = bookings.length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  setEl('totalBookings', total);
  setEl('pendingBookings', pending);
  setEl('confirmedBookings', confirmed);
  setEl('completedBookings', completed);
}

/**
 * =========================
 * UPCOMING BOOKINGS
 * =========================
 */
function renderUpcomingBookings() {
  const container = document.getElementById('upcomingBookings');
  if (!container) return;

  const todayStr = toDateStr(new Date());

  const upcoming = bookings
    .filter(b => b.status !== 'completed' && normalizeDate(b.date) >= todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!upcoming.length) {
    container.innerHTML = `<p class="text-gray-500 text-center py-8">No upcoming bookings</p>`;
    return;
  }

  container.innerHTML = upcoming
    .map(b => {
      const statusColor = {
        pending: 'bg-yellow-100 text-yellow-700',
        confirmed: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700',
        completed: 'bg-blue-100 text-blue-700',
      }[b.status] || 'bg-gray-100 text-gray-700';

      const displayDate = b.date ? formatDisplayDate(normalizeDate(b.date)) : '—';
      const displayTime = b.time || b.start_time || '';

      return `
        <div class="border border-gray-200 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-sm transition">
          <div>
            <p class="font-bold text-gray-800">${escapeHtml(b.service_name || 'Service')}</p>
            <p class="text-gray-500 text-sm mt-1">
              📅 ${displayDate}${displayTime ? ` &nbsp;•&nbsp; 🕐 ${displayTime}` : ''}
            </p>
            ${b.client_name ? `<p class="text-gray-500 text-sm">👤 ${escapeHtml(b.client_name)}</p>` : ''}
          </div>
          <span class="px-3 py-1 rounded-full text-sm font-semibold ${statusColor} capitalize">
            ${escapeHtml(b.status)}
          </span>
        </div>
      `;
    })
    .join('');
}

/**
 * =========================
 * HELPERS
 * =========================
 */

/** Convert Date → "YYYY-MM-DD" */
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Normalize any date string/ISO to "YYYY-MM-DD" */
function normalizeDate(dateVal) {
  if (!dateVal) return '';
  return dateVal.toString().slice(0, 10);
}

/** Format "YYYY-MM-DD" → "Mon DD, YYYY" */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Safe innerHTML helper */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Set element text */
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}