
const state = {
  step: 1,
  names: [],
  tableType: 'rectangle', // Default per user request
  totalSeats: 4,
  customSeatPositions: [], // {x, y} relative to container
  isShuffling: false,
  animationInterval: null,
  audioContext: null
};

// DOM Elements
const steps = {
  1: document.getElementById('step-1'),
  2: document.getElementById('step-2'),
  3: document.getElementById('step-3')
};

// Controls
const tableTypeSelect = document.getElementById('table-type');
const seatCountInput = document.getElementById('seat-count');
const namesInput = document.getElementById('names-input');
const btnToStep2 = document.getElementById('btn-to-step-2');
const btnBackToStep1 = document.getElementById('btn-back-to-step-1');
const btnToStep3 = document.getElementById('btn-to-step-3');
const btnBackToStep2 = document.getElementById('btn-back-to-step-2');
const shuffleBtn = document.getElementById('shuffle-btn');

// Visualization Elements (Step 2 & 3)
// Note: We use the same table container structure for logic, but might need to ensure IDs match valid HTML
// In index.html we have #visualization-step-2 -> #table-container-step-2 -> #table
const tableElement = document.getElementById('table');
const tableContainer = document.getElementById('table-container-step-2');

// Audio (Kept same)
function initAudio() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playShuffleSound(duration) {
  if (!state.audioContext) initAudio();
  const ctx = state.audioContext;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(100, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + duration);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);

  gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.15;
  noiseSource.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start();
}

function playDing() {
  if (!state.audioContext) initAudio();
  const ctx = state.audioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.5);
}

// Navigation Logic
function goToStep(step) {
  // Validate Step 1 -> 2
  if (step === 2 && state.step === 1) {
    state.totalSeats = parseInt(seatCountInput.value) || 4;
    state.tableType = tableTypeSelect.value;
    updateTableShape();
    initSeatsForArrangement();
  }

  // Validate Step 2 -> 3
  if (step === 3 && state.step === 2) {
    saveSeatPositions();
    // Move visualization to Step 3? 
    // Actually, we can keep the visualization in the same place visually or clone it.
    // For simplicity, let's keep the visualization container visible in Step 3 but disable dragging.
    // In the HTML structure, #step-3 is a separate section.
    // To show the shuffle on the same table, we might need to change the HTML structure or move the container.
    // Let's Move the #visualization-step-2 into #step-3 or shared area?
    // BETTER IDEA: The visualization acts as a persistent background or dedicated area.
    // CURRENT FIX: Clone the table into Step 3 or just move the DOM element.
    const visContainer = document.getElementById('visualization-step-2');
    document.getElementById('step-3').insertBefore(visContainer, document.getElementById('step-3').firstChild);
    disableSeatDragging();
  }

  // Back Logic
  if (step === 2 && state.step === 3) {
    // Move visualization back
    const visContainer = document.getElementById('visualization-step-2');
    document.getElementById('step-2').insertBefore(visContainer, document.querySelector('#step-2 .step-controls'));
    enableSeatDragging();
  }

  // Update UI classes
  Object.keys(steps).forEach(k => {
    const s = steps[k];
    if (parseInt(k) === step) {
      s.classList.remove('hidden');
      s.classList.add('active');
    } else {
      s.classList.add('hidden');
      s.classList.remove('active');
    }
  });

  state.step = step;

  // Re-initialize seats if entering step 2
  if (step === 2) {
    // Use double RAF to ensure layout (display: block) is complete and styles applied
    // before getting dimensions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateTableShape(); // Ensure class is set
        initSeatsForArrangement();
      });
    });
  }
}

// Seat Arrangement Logic
function updateTableShape() {
  tableElement.className = `table-shape ${state.tableType}`;
}

function getTableDimensions() {
  // Use ACTUAL rendered dimensions for responsiveness
  let w = tableElement.offsetWidth;
  let h = tableElement.offsetHeight;

  // Fallbacks if not rendered yet (e.g. logic runs before paint)
  if (w === 0 || h === 0) {
    const isMobile = window.innerWidth <= 600;
    if (state.tableType === 'rectangle') {
      w = isMobile ? 300 : 600;
      h = isMobile ? 150 : 300; // Aspect ratio 2:1
    } else {
      w = isMobile ? 300 : 400;
      h = isMobile ? 300 : 400;
    }
  }

  // Center is relative to the container
  // The container is usually same size + padding, or flexible.
  // We assume the table is centered in the container.
  // Container Center:
  const containerRect = tableContainer.getBoundingClientRect();
  const centerX = containerRect.width / 2;
  const centerY = containerRect.height / 2;

  return { width: w, height: h, centerX, centerY };
}

// Debounce resize
let resizeTimeout;
window.addEventListener('resize', () => {
  if (state.step !== 2) return;
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    initSeatsForArrangement();
    // If we have custom positions, we might want to scale them?
    // For now, reset to default or keep absolute pixels (which might be off-screen).
    // Simple approach: Only reset if clean state, otherwise just re-center?
    // User request: "Perfect on mobile". 
    // Re-initializing ensures they fit.
  }, 200);
});

function initSeatsForArrangement(retryCount = 0) {
  // Clear existing
  tableContainer.querySelectorAll('.empty-seat, .seat').forEach(el => el.remove());
  state.customSeatPositions = [];

  // FORCE styles to guarantee container is the offset parent
  tableContainer.style.position = 'relative';

  const dims = getTableDimensions();
  const count = state.totalSeats;
  const offsets = calculateDefaultOffsets(count, dims);

  offsets.forEach((off, i) => {
    const seat = document.createElement('div');
    seat.className = 'empty-seat';
    seat.id = `empty-seat-${i}`;

    // Position relative to Container Center
    seat.style.position = 'absolute';

    const left = dims.centerX + off.x;
    const top = dims.centerY + off.y;

    seat.style.left = `${left}px`;
    seat.style.top = `${top}px`;
    seat.style.margin = '0';

    seat.style.transform = 'translate(-50%, -50%)';

    // Drag Events
    makeDraggable(seat);

    tableContainer.appendChild(seat);
  });
}

function calculateDefaultOffsets(count, dims) {
  const offsets = [];
  if (state.tableType === 'round') {
    const radius = dims.width / 2;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      offsets.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }
  } else {
    // Square/Rect Perimeter Logic
    const w = dims.width;
    const h = dims.height;

    const perimeter = 2 * (w + h);
    const step = perimeter / count;

    // Start at Top Center for Symmetry
    // Top Left is 0 distance in our previous logic? 
    // Previous:
    // 0 -> w (Top: -w/2 to w/2)
    // Actually previous logic: d < w => Top Edge. x = -w/2 + d.
    // So d=0 is Top-Left (-w/2, -h/2).

    // We want d=0 to be Top-Center.
    // Top-Center is x=0, y=-h/2.
    // In our linear mapping, Top-Center corresponds to d = w/2.

    // So distinct start offset = w/2.
    const startDist = w / 2;

    for (let i = 0; i < count; i++) {
      let d = (startDist + (i * step)) % perimeter;

      let x, y;

      if (d < w) {
        // Top Edge
        x = -w / 2 + d;
        y = -h / 2;
      } else if (d < w + h) {
        // Right Edge
        x = w / 2;
        y = -h / 2 + (d - w);
      } else if (d < 2 * w + h) {
        // Bottom Edge
        x = w / 2 - (d - (w + h));
        y = h / 2;
      } else {
        // Left Edge
        x = -w / 2;
        y = h / 2 - (d - (2 * w + h));
      }
      offsets.push({ x, y });
    }
  }
  return offsets;
}

// Drag & Drop
let draggedEl = null;
let startX = 0;
let startY = 0;
let initialTransform = '';

function makeDraggable(el) {
  el.addEventListener('mousedown', dragStart);
  el.addEventListener('touchstart', dragStart, { passive: false });
}

function dragStart(e) {
  e.stopPropagation();
  draggedEl = e.target;

  // Basic drag logic using transform usually better, but let's stick to absolute pixels relative to container 
  // to avoid complex transform math on every move.
  // Switch from 'move via transform' to 'move via left/top pixels'

  const rect = draggedEl.getBoundingClientRect();
  const containerRect = tableContainer.getBoundingClientRect();

  // Calculate current center relative to container
  const currentCenterX = rect.left - containerRect.left + (rect.width / 2);
  const currentCenterY = rect.top - containerRect.top + (rect.height / 2);

  // Reset transform to just centering
  draggedEl.style.transform = 'translate(-50%, -50%)';
  // Set left/top to current position
  draggedEl.style.left = `${currentCenterX}px`;
  draggedEl.style.top = `${currentCenterY}px`;

  function onMove(ev) {
    ev.preventDefault();
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;

    let newX = cx - containerRect.left;
    let newY = cy - containerRect.top;

    draggedEl.style.left = `${newX}px`;
    draggedEl.style.top = `${newY}px`;
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    draggedEl = null;
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onUp);
}

function saveSeatPositions() {
  state.customSeatPositions = [];
  const seats = tableContainer.querySelectorAll('.empty-seat');
  seats.forEach(seat => {
    state.customSeatPositions.push({
      x: parseFloat(seat.style.left),
      y: parseFloat(seat.style.top)
    });
  });
}

function disableSeatDragging() {
  const seats = tableContainer.querySelectorAll('.empty-seat');
  seats.forEach(seat => {
    // Clone to remove listener
    const clone = seat.cloneNode(true);
    seat.parentNode.replaceChild(clone, seat);
    clone.style.cursor = 'default';
    clone.style.borderStyle = 'solid'; // Make them look fixed
  });
}

function enableSeatDragging() {
  // Re-init from saved state
  initSeatsForArrangement();
  // Apply saved positions
  const seats = tableContainer.querySelectorAll('.empty-seat');
  state.customSeatPositions.forEach((pos, i) => {
    if (seats[i]) {
      seats[i].style.left = `${pos.x}px`;
      seats[i].style.top = `${pos.y}px`;
    }
  });
}

// Shuffle Logic
function startShuffle() {
  state.names = namesInput.value.split(',').map(n => n.trim()).filter(n => n.length > 0);

  if (state.names.length === 0) {
    alert('Please enter names!');
    return;
  }
  if (state.names.length > state.totalSeats) {
    alert(`Too many names! You have ${state.totalSeats} seats.`);
    return;
  }

  state.isShuffling = true;
  state.names.sort(() => Math.random() - 0.5);

  // Create flying name cards
  document.querySelectorAll('.seat').forEach(s => s.remove());
  const dims = getTableDimensions();

  state.names.forEach((name, i) => {
    const card = document.createElement('div');
    card.className = 'seat shuffling';
    card.textContent = name;
    card.style.left = `${dims.centerX}px`;
    card.style.top = `${dims.centerY}px`;
    tableContainer.appendChild(card);
  });

  initAudio();
  playShuffleSound(5);

  const cards = document.querySelectorAll('.seat');
  const startTime = Date.now();
  const duration = 5000;

  state.animationInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed >= duration) {
      endShuffle();
      return;
    }
    cards.forEach(card => {
      // Fly randomly
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 300;
      const x = dims.centerX + Math.cos(angle) * dist;
      const y = dims.centerY + Math.sin(angle) * dist;
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
    });
  }, 100);
}

function endShuffle() {
  clearInterval(state.animationInterval);
  state.isShuffling = false;

  const cards = document.querySelectorAll('.seat');

  // Assign to custom positions
  // We need to pick N unique positions from customSeatPositions
  const seatIndices = Array.from({ length: state.totalSeats }, (_, i) => i);
  seatIndices.sort(() => Math.random() - 0.5);

  cards.forEach((card, i) => {
    card.classList.remove('shuffling');
    const targetIndex = seatIndices[i];
    const pos = state.customSeatPositions[targetIndex];
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;
  });

  playDing();
}


// Event Wiring
btnToStep2.addEventListener('click', () => goToStep(2));
btnBackToStep1.addEventListener('click', () => goToStep(1));
btnToStep3.addEventListener('click', () => goToStep(3));
btnBackToStep2.addEventListener('click', () => goToStep(2));
shuffleBtn.addEventListener('click', () => !state.isShuffling && startShuffle());
