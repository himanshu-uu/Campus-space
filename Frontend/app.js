/**
 * app.js — CampusPulse & SpaceSync
 * Main application logic: navigation, room search, clash detection,
 * booking modal, admin charts, and recommendation engine.
 */

/* ═══════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════ */
let currentPage = 'finder';
let sidebarOpen = true;
let searchResults = [];
let pendingRequests = [...ROOM_REQUESTS]; // mutable copy (session state)
let currentBookingRoom = null;
let chartsRendered = false;

/* ═══════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  startClock();
  setTopbarDate();
  updateHeroStats();
});

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filter-date').value = today;
}

function startClock() {
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('sidebar-clock').textContent = `${h}:${m}`;
  }
  tick();
  setInterval(tick, 30000);
}

function setTopbarDate() {
  const now = new Date();
  const opts = { weekday:'short', day:'numeric', month:'short', year:'numeric' };
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('en-IN', opts);
}

function updateHeroStats() {
  const active = ROOMS.filter(r => r.status === 'active').length;
  document.getElementById('stat-total-rooms').textContent = active;

  // Count rooms with NO bookings today
  const today = new Date().toISOString().split('T')[0];
  const todayHour = new Date().getHours();
  const nowStr = `${String(todayHour).padStart(2,'0')}:00`;
  const bookedNow = new Set();
  [...CLASS_SCHEDULE, ...EVENTS].forEach(entry => {
    if (entry.date === today && timesOverlap(entry.start_time, entry.end_time, nowStr, nowStr)) {
      bookedNow.add(entry.room_id);
    }
  });
  document.getElementById('stat-available-now').textContent = active - bookedNow.size;

  const pending = pendingRequests.filter(r => r.status === 'pending').length;
  document.getElementById('stat-pending-req').textContent = pending;
}

/* ═══════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════ */
const PAGE_TITLES = {
  finder: '🎓 Student & Club Room Finder',
  admin:  '📊 Admin Analytics & Space Optimization',
};

function navigateTo(page) {
  currentPage = page;

  // Toggle pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  // Toggle nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`nav-${page}`).classList.add('active');

  // Update topbar title
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page];

  // Render admin charts lazily
  if (page === 'admin' && !chartsRendered) {
    setTimeout(() => {
      renderAdminCharts();
      renderUnderusedTable();
      renderPendingRequests();
      chartsRendered = true;
    }, 80);
  }

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
}

/* ═══════════════════════════════════════════════════════
   FACILITY FILTER CHIPS
   ═══════════════════════════════════════════════════════ */
function toggleFacility(btn) {
  btn.classList.toggle('active');
}

function getSelectedFacilities() {
  return [...document.querySelectorAll('#facility-chips .chip.active')]
    .map(b => b.dataset.facility);
}

/* ═══════════════════════════════════════════════════════
   CLASH DETECTION HELPER
   ═══════════════════════════════════════════════════════ */

/**
 * Check if two time windows overlap.
 * Uses half-open interval [start, end) semantics.
 */
function timesOverlap(aStart, aEnd, bStart, bEnd) {
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const as = toMin(aStart), ae = toMin(aEnd);
  const bs = toMin(bStart), be = toMin(bEnd);
  return as < be && bs < ae;
}

/**
 * Returns an array of clashing entry objects for a given room/date/time.
 * Checks both CLASS_SCHEDULE and EVENTS.
 * Also checks pending + approved ROOM_REQUESTS.
 *
 * @param {string} roomId
 * @param {string} date       — 'YYYY-MM-DD'
 * @param {string} startTime  — 'HH:MM'
 * @param {string} endTime    — 'HH:MM'
 * @returns {Array} — list of clashing records (empty = no clash)
 */
function findClashes(roomId, date, startTime, endTime) {
  const clashes = [];

  CLASS_SCHEDULE.forEach(s => {
    if (s.room_id === roomId && s.date === date &&
        timesOverlap(s.start_time, s.end_time, startTime, endTime)) {
      clashes.push({ type: 'class', label: `Class: ${s.course_name}`, time: `${s.start_time}–${s.end_time}` });
    }
  });

  EVENTS.forEach(e => {
    if (e.room_id === roomId && e.date === date &&
        timesOverlap(e.start_time, e.end_time, startTime, endTime)) {
      clashes.push({ type: 'event', label: `Event: ${e.event_name}`, time: `${e.start_time}–${e.end_time}` });
    }
  });

  pendingRequests.forEach(r => {
    if (r.room_id === roomId && r.date === date &&
        (r.status === 'pending' || r.status === 'approved') &&
        timesOverlap(r.start_time, r.end_time, startTime, endTime)) {
      clashes.push({ type: 'request', label: `Booking: ${r.group_name || r.requester_name}`, time: `${r.start_time}–${r.end_time}` });
    }
  });

  return clashes;
}

/* ═══════════════════════════════════════════════════════
   ROOM SEARCH & RANKING
   ═══════════════════════════════════════════════════════ */
function resetFilters() {
  setDefaultDate();
  document.getElementById('filter-start').value = '09:00';
  document.getElementById('filter-end').value   = '11:00';
  document.getElementById('filter-capacity').value = 20;
  document.getElementById('cap-display').textContent = '20';
  document.getElementById('filter-accessible').checked = false;
  document.getElementById('filter-type').value = '';
  document.querySelectorAll('#facility-chips .chip').forEach(c => c.classList.remove('active'));
  hideResults();
}

function hideResults() {
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('initial-state').style.display = '';
}

function searchRooms() {
  const date       = document.getElementById('filter-date').value;
  const startTime  = document.getElementById('filter-start').value;
  const endTime    = document.getElementById('filter-end').value;
  const minCap     = parseInt(document.getElementById('filter-capacity').value);
  const needAccess = document.getElementById('filter-accessible').checked;
  const type       = document.getElementById('filter-type').value;
  const facilities = getSelectedFacilities();

  // Basic validation
  if (!date) { showToast('Please select a date.', 'warn'); return; }
  if (startTime >= endTime) { showToast('End time must be after start time.', 'warn'); return; }

  // Animate button
  const btn = document.getElementById('search-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Searching…';

  setTimeout(() => {
    const results = [];

    ROOMS.forEach(room => {
      // Skip maintenance rooms
      if (room.status !== 'active') return;

      // Capacity filter
      if (room.capacity < minCap) return;

      // Accessibility filter
      if (needAccess && !room.accessible) return;

      // Room type filter
      if (type && room.room_type !== type) return;

      // Facility filter — must have ALL selected
      const missingFacilities = facilities.filter(f => !room.facilities.includes(f));
      if (missingFacilities.length > 0) return;

      // Clash detection
      const clashes = findClashes(room.room_id, date, startTime, endTime);
      if (clashes.length > 0) return;

      // Compute match score (higher = better)
      let score = 0;
      score += room.accessible ? 10 : 0;
      score += room.facilities.length * 3;
      // Prefer rooms that aren't massively oversized (penalty for huge surplus)
      const surplus = room.capacity - minCap;
      if (surplus <= 20) score += 20;
      else if (surplus <= 50) score += 12;
      else if (surplus <= 100) score += 5;

      results.push({ room, clashes, matchedFacilities: facilities, score });
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    searchResults = results;

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔍</span> Find Available Rooms';

    renderResults(date, startTime, endTime, minCap);
  }, 350); // slight delay for UX feel
}

function renderResults(date, startTime, endTime, minCap) {
  document.getElementById('initial-state').style.display = 'none';

  if (searchResults.length === 0) {
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('empty-state').style.display = '';
    return;
  }

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('results-section').style.display = '';
  document.getElementById('results-count').textContent = searchResults.length;

  const grid = document.getElementById('room-grid');
  grid.innerHTML = '';

  searchResults.forEach(({ room, matchedFacilities }, idx) => {
    const card = buildRoomCard(room, date, startTime, endTime, minCap, matchedFacilities, idx);
    grid.appendChild(card);
  });
}

function sortResults() {
  const val = document.getElementById('sort-select').value;
  if (val === 'match') {
    searchResults.sort((a, b) => b.score - a.score);
  } else if (val === 'capacity-asc') {
    searchResults.sort((a, b) => a.room.capacity - b.room.capacity);
  } else if (val === 'capacity-desc') {
    searchResults.sort((a, b) => b.room.capacity - a.room.capacity);
  } else if (val === 'name') {
    searchResults.sort((a, b) => a.room.room_name.localeCompare(b.room.room_name));
  }
  const dateVal  = document.getElementById('filter-date').value;
  const startVal = document.getElementById('filter-start').value;
  const endVal   = document.getElementById('filter-end').value;
  const capVal   = parseInt(document.getElementById('filter-capacity').value);
  renderResults(dateVal, startVal, endVal, capVal);
}

/* ═══════════════════════════════════════════════════════
   ROOM CARD BUILDER
   ═══════════════════════════════════════════════════════ */
function buildRoomCard(room, date, startTime, endTime, minCap, matchedFacilities, idx) {
  const card = document.createElement('div');
  card.className = 'room-card';
  card.style.animationDelay = `${idx * 50}ms`;

  const icon = ROOM_TYPE_ICONS[room.room_type] || '🏫';
  const surplus = room.capacity - minCap;
  let capacityLabel, capacityClass;
  if (surplus <= 10) {
    capacityLabel = `${room.capacity} seats — Perfect fit`;
    capacityClass = 'ok';
  } else if (surplus <= 40) {
    capacityLabel = `${room.capacity} seats (requested ${minCap}) — Optimal spacing`;
    capacityClass = 'ok';
  } else {
    capacityLabel = `${room.capacity} seats (requested ${minCap}) — Spacious`;
    capacityClass = 'ok';
  }

  const allFacilitiesPresent = matchedFacilities.length > 0;
  const facilityLabel = matchedFacilities.length > 0
    ? `All required facilities present (${matchedFacilities.join(', ')})`
    : 'No specific facility requirements set';

  const accessLabel = room.accessible
    ? (room.floor === 0 ? 'Ground floor ramp access verified' : `Floor ${room.floor} — Lift & ramp accessible`)
    : 'Standard access (no specific accessibility data)';

  // Build facilities pills
  const facilityPills = room.facilities.map(f => {
    const isMatched = matchedFacilities.includes(f);
    return `<span class="facility-tag ${isMatched ? 'matched' : ''}">${f}</span>`;
  }).join('');

  card.innerHTML = `
    <div class="room-card-head">
      <div class="room-card-icon">${icon}</div>
      <div class="room-card-title">
        <h3>${room.room_name}</h3>
        <div class="room-meta">
          <span>📍 ${room.building}</span>
          <span>Floor ${room.floor === 0 ? 'G' : room.floor}</span>
        </div>
      </div>
      <div class="room-capacity-badge">👥 ${room.capacity}</div>
    </div>

    <div class="match-breakdown">
      <div class="match-breakdown-title">✦ Explainable Match</div>

      <div class="match-item">
        <div class="match-icon ok">✓</div>
        <div class="match-text"><strong>Capacity Fit:</strong> ${capacityLabel}</div>
      </div>

      <div class="match-item">
        <div class="match-icon ${allFacilitiesPresent || matchedFacilities.length === 0 ? 'ok' : 'warn'}">✓</div>
        <div class="match-text"><strong>Facilities:</strong> ${facilityLabel}</div>
      </div>

      <div class="match-item">
        <div class="match-icon ok">✓</div>
        <div class="match-text"><strong>Clash Check:</strong> No class clashes or event conflicts from ${startTime}–${endTime}</div>
      </div>

      <div class="match-item">
        <div class="match-icon ${room.accessible ? 'ok' : 'warn'}">${room.accessible ? '✓' : '!'}</div>
        <div class="match-text"><strong>Accessibility:</strong> ${accessLabel}</div>
      </div>
    </div>

    <div class="room-facilities">${facilityPills}</div>

    <div class="room-card-footer">
      ${room.accessible ? '<span class="accessible-badge">♿ Accessible</span>' : '<span></span>'}
      <button class="btn-book" onclick="openBookingModal('${room.room_id}', '${date}', '${startTime}', '${endTime}')">
        📅 Book Room
      </button>
    </div>
  `;

  return card;
}

/* ═══════════════════════════════════════════════════════
   BOOKING MODAL
   ═══════════════════════════════════════════════════════ */
function openBookingModal(roomId, date, startTime, endTime) {
  const room = getRoomById(roomId);
  if (!room) return;

  currentBookingRoom = { room, date, startTime, endTime };

  document.getElementById('modal-room-name').textContent =
    `${ROOM_TYPE_ICONS[room.room_type] || '🏫'} ${room.room_name} · ${room.building}`;

  document.getElementById('modal-booking-summary').innerHTML = `
    <strong>📅 Date:</strong> ${formatDate(date)}<br>
    <strong>⏰ Time:</strong> ${startTime} – ${endTime}<br>
    <strong>👥 Capacity:</strong> ${room.capacity} seats
  `;

  // Reset form / success
  document.getElementById('booking-form').style.display = '';
  document.getElementById('booking-success').style.display = 'none';
  document.getElementById('booking-form').reset();

  document.getElementById('booking-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.remove('open');
  document.body.style.overflow = '';
  currentBookingRoom = null;
}

function closeModal(event) {
  if (event.target === document.getElementById('booking-modal')) {
    closeBookingModal();
  }
}

function submitBooking(event) {
  event.preventDefault();
  if (!currentBookingRoom) return;

  const name      = document.getElementById('book-name').value.trim();
  const email     = document.getElementById('book-email').value.trim();
  const group     = document.getElementById('book-group').value.trim();
  const attendees = parseInt(document.getElementById('book-attendees').value);
  const purpose   = document.getElementById('book-purpose').value.trim();

  const { room, date, startTime, endTime } = currentBookingRoom;

  // Warn if attendees >> capacity
  if (attendees > room.capacity) {
    showToast(`⚠️ ${attendees} attendees exceeds capacity (${room.capacity}). Consider a larger room.`, 'warn');
    return;
  }

  // Create new request record (session state)
  const newReq = {
    request_id:         `REQ${String(pendingRequests.length + 1).padStart(3, '0')}-NEW`,
    requester_name:     name,
    requester_email:    email,
    requester_type:     'student',
    group_name:         group || name,
    room_id:            room.room_id,
    date:               date,
    start_time:         startTime,
    end_time:           endTime,
    expected_attendees: attendees,
    purpose:            purpose,
    status:             'pending',
    submitted_at:       new Date().toISOString(),
  };

  pendingRequests.push(newReq);
  chartsRendered = false; // force re-render on next admin visit

  // Show success
  document.getElementById('booking-form').style.display = 'none';
  document.getElementById('booking-success').style.display = '';
  document.getElementById('success-message').innerHTML =
    `Your request to book <strong>${room.room_name}</strong> on <strong>${formatDate(date)}</strong> from <strong>${startTime}–${endTime}</strong> has been submitted. The admin team will confirm within 24 hours.`;

  updateHeroStats();
  showToast('✅ Booking request submitted successfully!', 'success');
}

/* ═══════════════════════════════════════════════════════
   ADMIN — CHARTS (Plotly)
   ═══════════════════════════════════════════════════════ */
const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font: { family: 'Inter, sans-serif', color: '#94a3b8', size: 11 },
  margin: { t: 16, b: 40, l: 44, r: 16 },
  xaxis: { gridcolor: 'rgba(255,255,255,0.05)', zerolinecolor: 'rgba(255,255,255,0.05)' },
  yaxis: { gridcolor: 'rgba(255,255,255,0.05)', zerolinecolor: 'rgba(255,255,255,0.05)' },
  showlegend: false,
};
const PLOTLY_CONFIG = { displayModeBar: false, responsive: true };

function renderAdminCharts() {
  renderWeeklyChart();
  renderHourlyHeatmap();
  renderRoomTypeChart();
  renderForecastChart();
}

function renderWeeklyChart() {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dayAbbr = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Count total booked hours per day across schedule + events
  const counts = days.map(day => {
    const sched = CLASS_SCHEDULE.filter(s => {
      const d = new Date(s.date);
      return d.toLocaleDateString('en-US', { weekday: 'long' }) === day;
    }).length;
    const evts = EVENTS.filter(e => {
      const d = new Date(e.date);
      return d.toLocaleDateString('en-US', { weekday: 'long' }) === day;
    }).length;
    return sched + evts;
  });

  const maxCount = Math.max(...counts);
  const colors = counts.map(c => {
    const t = c / maxCount;
    if (t > 0.75) return '#3b82f6';
    if (t > 0.45) return '#2563eb';
    return '#1d4ed8';
  });

  Plotly.newPlot('chart-weekly', [{
    type: 'bar',
    x: dayAbbr,
    y: counts,
    marker: {
      color: colors,
      line: { color: 'rgba(255,255,255,0.05)', width: 1 },
    },
    text: counts.map(String),
    textposition: 'outside',
    textfont: { color: '#cbd5e1', size: 11 },
    hovertemplate: '<b>%{x}</b><br>Bookings: %{y}<extra></extra>',
  }], {
    ...PLOTLY_LAYOUT_BASE,
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: 'Total Bookings', font: { size: 10 } } },
    bargap: 0.35,
  }, PLOTLY_CONFIG);
}

function renderHourlyHeatmap() {
  const hours = Array.from({ length: 14 }, (_, i) => `${String(i + 7).padStart(2,'0')}:00`);
  const days  = ['Mon','Tue','Wed','Thu','Fri'];
  const allEntries = [...CLASS_SCHEDULE, ...EVENTS];

  // Build z-matrix [day][hour]
  const z = days.map((day, di) => {
    return hours.map(hour => {
      const hNum = 7 + di; // rough mapping
      const h = parseInt(hour);
      return allEntries.filter(e => {
        const eDay = new Date(e.date).getDay(); // 1=Mon
        const eH   = parseInt(e.start_time);
        return (eDay === di + 1) && (eH <= h) && (parseInt(e.end_time) > h);
      }).length;
    });
  });

  Plotly.newPlot('chart-hourly', [{
    type: 'heatmap',
    z: z,
    x: hours,
    y: days,
    colorscale: [
      [0,   'rgba(13,21,38,1)'],
      [0.3, 'rgba(37,99,235,0.4)'],
      [0.6, 'rgba(37,99,235,0.7)'],
      [1,   'rgba(59,130,246,1)'],
    ],
    showscale: false,
    hovertemplate: '<b>%{y} %{x}</b><br>Rooms booked: %{z}<extra></extra>',
  }], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 16, b: 40, l: 44, r: 8 },
  }, PLOTLY_CONFIG);
}

function renderRoomTypeChart() {
  const typeCounts = {};
  ROOMS.filter(r => r.status === 'active').forEach(r => {
    typeCounts[r.room_type] = (typeCounts[r.room_type] || 0) + 1;
  });

  const labels = Object.keys(typeCounts).map(t => t.replace('_', ' '));
  const values = Object.values(typeCounts);

  const palette = [
    '#3b82f6','#2563eb','#1d4ed8',
    '#10b981','#059669',
    '#f59e0b','#d97706',
    '#6366f1','#8b5cf6',
  ];

  Plotly.newPlot('chart-roomtype', [{
    type: 'pie',
    labels,
    values,
    hole: 0.55,
    marker: { colors: palette, line: { color: 'rgba(0,0,0,0.3)', width: 2 } },
    textinfo: 'label+percent',
    textfont: { size: 10, color: '#cbd5e1' },
    hovertemplate: '<b>%{label}</b><br>%{value} rooms (%{percent})<extra></extra>',
    pull: values.map(() => 0.02),
  }], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 16, b: 16, l: 16, r: 16 },
    showlegend: false,
  }, PLOTLY_CONFIG);
}

function renderForecastChart() {
  // Aggregate requests + events per date over next 7 days
  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const labels = dates.map(d => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
  });

  const schedCounts  = dates.map(d => CLASS_SCHEDULE.filter(s => s.date === d).length);
  const eventCounts  = dates.map(d => EVENTS.filter(e => e.date === d).length);
  const reqCounts    = dates.map(d => pendingRequests.filter(r => r.date === d && r.status === 'pending').length);
  const totalPressure = dates.map((_, i) => schedCounts[i] + eventCounts[i] * 1.5 + reqCounts[i]);

  Plotly.newPlot('chart-forecast', [
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Scheduled Classes',
      x: labels, y: schedCounts,
      line: { color: '#3b82f6', width: 2.5, shape: 'spline' },
      marker: { color: '#3b82f6', size: 7 },
      fill: 'tozeroy',
      fillcolor: 'rgba(59,130,246,0.07)',
      hovertemplate: '<b>%{x}</b><br>Classes: %{y}<extra></extra>',
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Events',
      x: labels, y: eventCounts,
      line: { color: '#10b981', width: 2.5, shape: 'spline' },
      marker: { color: '#10b981', size: 7 },
      fill: 'tozeroy',
      fillcolor: 'rgba(16,185,129,0.07)',
      hovertemplate: '<b>%{x}</b><br>Events: %{y}<extra></extra>',
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Pending Requests',
      x: labels, y: reqCounts,
      line: { color: '#f59e0b', width: 2, dash: 'dot', shape: 'spline' },
      marker: { color: '#f59e0b', size: 7 },
      hovertemplate: '<b>%{x}</b><br>Pending: %{y}<extra></extra>',
    },
  ], {
    ...PLOTLY_LAYOUT_BASE,
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.18,
      x: 0.5, xanchor: 'center',
      font: { size: 11, color: '#94a3b8' },
      bgcolor: 'rgba(0,0,0,0)',
    },
    margin: { t: 16, b: 60, l: 44, r: 16 },
  }, PLOTLY_CONFIG);
}

/* ═══════════════════════════════════════════════════════
   ADMIN — UNDERUSED TABLE
   ═══════════════════════════════════════════════════════ */
function computeUtilization(roomId) {
  const allEntries = [...CLASS_SCHEDULE, ...EVENTS, ...pendingRequests.filter(r => r.status === 'approved')];
  const bookings = allEntries.filter(e => e.room_id === roomId).length;
  // Assume max possible = 5 days × 3 slots = 15
  return Math.min(100, Math.round((bookings / 15) * 100));
}

function renderUnderusedTable() {
  const tbody = document.getElementById('underused-tbody');
  tbody.innerHTML = '';

  const underused = ROOMS
    .filter(r => r.status === 'active')
    .map(r => ({ room: r, util: computeUtilization(r.room_id) }))
    .filter(({ util }) => util < 25)
    .sort((a, b) => a.util - b.util);

  underused.forEach(({ room, util }) => {
    const suggestion = util < 10
      ? '🔄 Consider repurposing as storage or co-working space'
      : util < 20
        ? '📅 Schedule more regular classes here'
        : '💡 Promote for student club use';

    const barClass = util < 10 ? 'low' : util < 20 ? 'mid' : 'mid';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--text-primary)">${room.room_name}</strong></td>
      <td>${room.building}</td>
      <td style="text-transform:capitalize">${room.room_type.replace('_',' ')}</td>
      <td>${room.capacity}</td>
      <td>
        <div class="utilization-bar">
          <div class="util-bar-track">
            <div class="util-bar-fill ${barClass}" style="width:${util}%"></div>
          </div>
          <span class="util-pct">${util}%</span>
        </div>
      </td>
      <td style="font-size:12px;color:var(--text-secondary)">${suggestion}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ═══════════════════════════════════════════════════════
   ADMIN — PENDING REQUESTS + ENGINE
   ═══════════════════════════════════════════════════════ */

/**
 * Inefficiency detection rules:
 * 1. Small group in a very large room (< 30% of capacity used)
 * 2. Booking in a high-demand time slot when a smaller room is free
 */
function detectInefficiency(req) {
  const room = getRoomById(req.room_id);
  if (!room) return null;

  const usageRatio = req.expected_attendees / room.capacity;
  if (usageRatio < 0.3 && room.capacity > 40) {
    // Find a better (smaller) room
    const alternatives = ROOMS
      .filter(r =>
        r.status === 'active' &&
        r.room_id !== room.room_id &&
        r.capacity >= req.expected_attendees &&
        r.capacity <= req.expected_attendees * 2 + 10 &&
        findClashes(r.room_id, req.date, req.start_time, req.end_time).length === 0
      )
      .sort((a, b) => a.capacity - b.capacity);

    return {
      type: 'oversized',
      message: `⚠️ Inefficient: ${req.expected_attendees} attendees in a ${room.capacity}-seat room (${Math.round(usageRatio * 100)}% utilization)`,
      suggestion: alternatives.length > 0
        ? `💡 Suggest moving to <strong>${alternatives[0].room_name}</strong> (${alternatives[0].capacity} seats, ${alternatives[0].building})`
        : '💡 No smaller room available at this time slot — keep current allocation',
      hasFix: alternatives.length > 0,
    };
  }

  // Check if the room is in very high demand on that date
  const competingRequests = pendingRequests.filter(r =>
    r.room_id !== req.room_id &&
    r.date === req.date &&
    timesOverlap(r.start_time, r.end_time, req.start_time, req.end_time) &&
    r.status === 'pending'
  );
  if (competingRequests.length >= 3) {
    return {
      type: 'high-demand',
      message: `⚡ High Demand: ${competingRequests.length} other rooms also sought at this time window`,
      suggestion: '💡 Priority: review this request early to avoid conflicts',
      hasFix: false,
    };
  }

  return null;
}

function renderPendingRequests() {
  const container = document.getElementById('requests-list');
  container.innerHTML = '';

  const pending = pendingRequests.filter(r => r.status === 'pending');
  document.getElementById('pending-count-badge').textContent = `${pending.length} Pending`;
  document.getElementById('kpi-pending').textContent = pending.length;

  if (pending.length === 0) {
    container.innerHTML = `<div class="initial-state" style="padding:40px 0"><div class="initial-icon" style="font-size:36px">✅</div><h3>No pending requests</h3></div>`;
    return;
  }

  pending.forEach(req => {
    const room = getRoomById(req.room_id);
    const roomLabel = room ? `${room.room_name} · ${room.building}` : req.room_id;
    const flag = detectInefficiency(req);
    const isFlag = flag !== null;

    const card = document.createElement('div');
    card.className = `request-card${isFlag ? ' flagged' : ''}`;
    card.id = `req-${req.request_id}`;

    card.innerHTML = `
      <div>
        <div class="request-header">
          <span class="request-name">${req.requester_name}</span>
          <span class="request-type-badge badge-${req.requester_type}">${req.requester_type}</span>
          ${req.group_name ? `<span style="font-size:12px;color:var(--text-muted)">· ${req.group_name}</span>` : ''}
        </div>
        <div class="request-details">
          <strong>Room:</strong> ${roomLabel} &nbsp;|&nbsp;
          <strong>Date:</strong> ${formatDate(req.date)} &nbsp;|&nbsp;
          <strong>Time:</strong> ${req.start_time}–${req.end_time} &nbsp;|&nbsp;
          <strong>Attendees:</strong> ${req.expected_attendees}
          <br><strong>Purpose:</strong> ${req.purpose}
        </div>
        ${isFlag ? `
          <div class="flag-alert"><span>🚩</span><span><strong>Flag:</strong> ${flag.message}</span></div>
          <div class="suggest-box"><span>💡</span><span>${flag.suggestion}</span></div>
        ` : ''}
      </div>
      <div class="request-actions">
        <button class="btn-approve" onclick="approveRequest('${req.request_id}')">✅ Approve</button>
        <button class="btn-reject"  onclick="rejectRequest('${req.request_id}')">✕ Reject</button>
      </div>
    `;

    container.appendChild(card);
  });
}

function approveRequest(reqId) {
  const req = pendingRequests.find(r => r.request_id === reqId);
  if (!req) return;
  req.status = 'approved';
  const card = document.getElementById(`req-${reqId}`);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateX(20px)';
    card.style.transition = 'all 0.3s ease';
    setTimeout(() => renderPendingRequests(), 310);
  }
  showToast(`✅ Request by ${req.requester_name} approved!`, 'success');
  updateHeroStats();
}

function rejectRequest(reqId) {
  const req = pendingRequests.find(r => r.request_id === reqId);
  if (!req) return;
  req.status = 'rejected';
  const card = document.getElementById(`req-${reqId}`);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';
    card.style.transition = 'all 0.3s ease';
    setTimeout(() => renderPendingRequests(), 310);
  }
  showToast(`Rejected request from ${req.requester_name}.`, 'info');
  updateHeroStats();
}

/* ═══════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════ */
let toastTimeout;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════ */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
