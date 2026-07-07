/**
 * Inversiones Correlacion - Frontend Application Logic
 * Handles all UI interactions, API calls, and result rendering
 */

// ============================================================================
// Global State
// ============================================================================

const state = {
  currentAnalysis: null,
  isLoading: false,
  retryCountdown: 0,
  retryInterval: null,
  currentErrorMessage: ''
};

// ============================================================================
// DOM Elements
// ============================================================================

// Form & Input Elements
const tickersInput = document.getElementById('tickers');
const periodSelect = document.getElementById('periodSelect');
const thresholdSlider = document.getElementById('threshold');
const thresholdValue = document.getElementById('thresholdValue');
const modelSelect = document.getElementById('modelSelect');
const submitBtn = document.getElementById('submitBtn');
const correlationForm = document.getElementById('correlationForm');

// API Key Management
const apiKeyInput = document.getElementById('apiKey');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const helpApiKeyBtn = document.getElementById('helpApiKey');
const apiKeyModal = document.getElementById('apiKeyModal');
const closeApiKeyModalBtn = document.getElementById('closeApiKeyModal');
const modalOverlay = document.getElementById('modalOverlay');

// Dashboard States
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const resultsDashboard = document.getElementById('resultsDashboard');

// Error State Elements
const errorMessage = document.getElementById('errorMessage');
const retryCountdownText = document.getElementById('retryCountdown');
const retryBtn = document.getElementById('retryBtn');
const cancelRetryBtn = document.getElementById('cancelRetryBtn');

// Loading State Elements
const loadingMessage = document.getElementById('loadingMessage');
const stepMarket = document.getElementById('step-market');
const stepCorrelation = document.getElementById('step-correlation');
const stepGrouping = document.getElementById('step-grouping');
const stepGemini = document.getElementById('step-gemini');

// History
const historyList = document.getElementById('historyList');

// Result Elements
const resTickersCount = document.getElementById('resTickersCount');
const resPeriodLabel = document.getElementById('resPeriodLabel');
const resThresholdLabel = document.getElementById('resThresholdLabel');
const resVerdictBadge = document.getElementById('resVerdictBadge');
const resPortfolioSummary = document.getElementById('resPortfolioSummary');
const heatmapCanvas = document.getElementById('heatmapCanvas');
const groupsGrid = document.getElementById('groupsGrid');
const resDiversificationAssessment = document.getElementById('resDiversificationAssessment');
const recommendationsList = document.getElementById('recommendationsList');
const warningsList = document.getElementById('warningsList');
const citationsList = document.getElementById('citationsList');

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing...');

  // Initialize Lucide icons
  lucide.createIcons();

  // Load API key from localStorage
  loadApiKeyFromStorage();

  // Setup event handlers
  setupApiKeyHandlers();
  setupFormHandlers();
  setupThresholdSlider();
  setupHistoryHandlers();

  // Load history on startup
  await loadHistory();

  console.log('[App] Initialization complete');
});

// ============================================================================
// API Key Management
// ============================================================================

function loadApiKeyFromStorage() {
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) {
    apiKeyInput.value = storedKey;
  }
}

function saveApiKeyToStorage() {
  const key = apiKeyInput.value.trim();
  if (key) {
    localStorage.setItem('gemini_api_key', key);
  }
}

function setupApiKeyHandlers() {
  // Toggle visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';

    // Update icon
    const icon = toggleApiKeyBtn.querySelector('i');
    icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    lucide.createIcons();
  });

  // Help button
  helpApiKeyBtn.addEventListener('click', () => {
    apiKeyModal.classList.remove('hidden');
  });

  // Close modal
  closeApiKeyModalBtn.addEventListener('click', () => {
    apiKeyModal.classList.add('hidden');
  });

  modalOverlay.addEventListener('click', () => {
    apiKeyModal.classList.add('hidden');
  });

  // Save API key on input
  apiKeyInput.addEventListener('change', saveApiKeyToStorage);
}

// ============================================================================
// Form Handling
// ============================================================================

function setupFormHandlers() {
  correlationForm.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  // Validate inputs
  const tickers = tickersInput.value
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);

  if (tickers.length < 2) {
    alert('Se requieren al menos 2 tickers.');
    return;
  }

  if (tickers.length > 20) {
    alert('Máximo 20 tickers permitidos.');
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('Se requiere una API Key de Gemini.');
    helpApiKeyBtn.click();
    return;
  }

  // Save API key
  saveApiKeyToStorage();

  // Prepare request
  const period = periodSelect.value;
  const threshold = parseFloat(thresholdSlider.value);
  const model = modelSelect.value;

  const requestData = {
    tickers,
    period,
    threshold,
    geminiApiKey: apiKey,
    model
  };

  console.log('[Form] Submitting analysis request:', requestData);

  // Transition to loading state
  transitionToLoading();
  state.isLoading = true;
  submitBtn.disabled = true;

  try {
    // Call API
    const response = await fetch('/api/generate-correlation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[App] Analysis complete:', data);

    // Store in state and render
    state.currentAnalysis = data;
    transitionToResults(data);

    // Reload history
    await loadHistory();

  } catch (error) {
    console.error('[App] Error:', error);
    transitionToError(error.message || 'Error desconocido');
  } finally {
    state.isLoading = false;
    submitBtn.disabled = false;
  }
}

function setupThresholdSlider() {
  thresholdSlider.addEventListener('input', () => {
    const value = parseFloat(thresholdSlider.value).toFixed(2);
    thresholdValue.textContent = value;
  });
}

// ============================================================================
// State Transitions
// ============================================================================

function transitionToLoading() {
  emptyState.classList.add('hidden');
  resultsDashboard.classList.add('hidden');
  errorState.classList.add('hidden');
  loadingState.classList.remove('hidden');

  // Reset progress steps
  resetProgressSteps();

  // Simulate progress animation
  simulateProgressSteps();
}

function resetProgressSteps() {
  const steps = [stepMarket, stepCorrelation, stepGrouping, stepGemini];
  steps.forEach(step => {
    step.classList.remove('completed', 'active');
    step.classList.add('active');
    const icon = step.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', 'circle');
    }
  });
  stepMarket.classList.add('active');
  lucide.createIcons();
}

function simulateProgressSteps() {
  const steps = [
    { elem: stepMarket, msg: 'Obteniendo datos de mercado...', delay: 0 },
    { elem: stepCorrelation, msg: 'Calculando correlaciones...', delay: 2000 },
    { elem: stepGrouping, msg: 'Agrupando activos...', delay: 4000 },
    { elem: stepGemini, msg: 'Analizando con IA...', delay: 6000 }
  ];

  steps.forEach(({ elem, msg, delay }) => {
    setTimeout(() => {
      loadingMessage.textContent = msg;

      // Update step status
      document.querySelectorAll('.progress-steps .step').forEach(s => s.classList.remove('active'));
      elem.classList.add('active');

      // Update icon
      const icon = elem.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', 'loader');
        lucide.createIcons();
      }
    }, delay);
  });
}

function transitionToResults(data) {
  emptyState.classList.add('hidden');
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  resultsDashboard.classList.remove('hidden');

  // Render all results
  renderResults(data);
}

function transitionToError(message) {
  emptyState.classList.add('hidden');
  loadingState.classList.add('hidden');
  resultsDashboard.classList.add('hidden');
  errorState.classList.remove('hidden');

  state.currentErrorMessage = message;
  errorMessage.textContent = message;

  // Start auto-retry countdown
  startRetryCountdown();
}

function startRetryCountdown() {
  state.retryCountdown = 20;
  retryCountdownText.textContent = `Reintentando automáticamente en ${state.retryCountdown}s...`;

  if (state.retryInterval) clearInterval(state.retryInterval);

  state.retryInterval = setInterval(() => {
    state.retryCountdown--;
    retryCountdownText.textContent = `Reintentando automáticamente en ${state.retryCountdown}s...`;

    if (state.retryCountdown <= 0) {
      clearInterval(state.retryInterval);
      retryBtn.click();
    }
  }, 1000);
}

function stopRetryCountdown() {
  if (state.retryInterval) {
    clearInterval(state.retryInterval);
    state.retryInterval = null;
  }
}

// Retry button handler
retryBtn.addEventListener('click', () => {
  stopRetryCountdown();
  correlationForm.dispatchEvent(new Event('submit'));
});

cancelRetryBtn.addEventListener('click', () => {
  stopRetryCountdown();
  emptyState.classList.remove('hidden');
  errorState.classList.add('hidden');
});

// ============================================================================
// Results Rendering
// ============================================================================

function renderResults(data) {
  console.log('[Render] Rendering analysis results');

  // Update header
  resTickersCount.textContent = data.tickers.length;
  resPeriodLabel.textContent = data.periodLabel;
  resThresholdLabel.textContent = data.threshold.toFixed(2);

  // Update verdict badge
  const badge = resVerdictBadge;
  if (data.isDiversified) {
    badge.className = 'verdict-badge approved';
    badge.textContent = 'DIVERSIFICADO';
  } else {
    badge.className = 'verdict-badge not-diversified';
    badge.textContent = 'NO DIVERSIFICADO';
  }

  // Render portfolio summary
  resPortfolioSummary.textContent = data.geminiAnalysis.portfolioHealthSummary || 'N/A';

  // Render heatmap
  setTimeout(() => {
    drawHeatmap(heatmapCanvas, data.tickers, data.matrix);
  }, 100);

  // Render groups
  renderGroups(data.groups, data.geminiAnalysis.groupInterpretations || []);

  // Render diversification assessment
  resDiversificationAssessment.textContent = data.geminiAnalysis.diversificationAssessment || 'N/A';

  // Render recommendations
  renderRecommendations(data.geminiAnalysis.recommendations || []);

  // Render warnings
  renderWarnings(data.geminiAnalysis.riskWarnings || []);

  // Render citations
  renderCitations(data.geminiAnalysis.citations || []);

  // Re-initialize Lucide icons
  lucide.createIcons();
}

// ============================================================================
// Heatmap Rendering
// ============================================================================

function drawHeatmap(canvas, tickers, matrix) {
  const ctx = canvas.getContext('2d');
  const n = tickers.length;

  // Calculate cell size based on number of tickers
  let cellSize = 65;
  if (n > 10) cellSize = 50;
  if (n > 15) cellSize = 40;

  // Padding for labels
  const topPadding = 100;
  const leftPadding = 100;
  const rightPadding = 40;
  const bottomPadding = 50;

  // Set canvas dimensions
  const canvasWidth = leftPadding + n * cellSize + rightPadding;
  const canvasHeight = topPadding + n * cellSize + bottomPadding;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Grid positions
  const gridStartX = leftPadding;
  const gridStartY = topPadding;

  // Clear canvas with gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
  bgGradient.addColorStop(0, 'rgba(11, 15, 25, 1)');
  bgGradient.addColorStop(1, 'rgba(15, 20, 35, 1)');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw subtle grid background
  ctx.fillStyle = 'rgba(30, 40, 60, 0.4)';
  ctx.fillRect(gridStartX, gridStartY, n * cellSize, n * cellSize);

  // Draw correlation cells with improved styling
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const value = matrix[i][j];
      const x = gridStartX + j * cellSize;
      const y = gridStartY + i * cellSize;

      // Color interpolation: blue (-1) → white (0) → red (+1)
      const color = correlationToColor(value);

      // Draw cell with slight rounding and shadow
      const borderRadius = 4;

      // Shadow effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

      // Main cell color
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellSize, cellSize);

      // Cell border with gradient
      const borderGradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
      borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      ctx.strokeStyle = borderGradient;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Cell value text with better contrast
      const textColor = value > 0.7 || value < -0.7 ? '#ffffff' : '#f3f4f6';
      ctx.fillStyle = textColor;
      ctx.font = 'bold 15px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(value.toFixed(2), x + cellSize / 2, y + cellSize / 2);
      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    }
  }

  // Draw Y-axis labels (left side, vertical)
  ctx.fillStyle = '#b4bcd4';
  ctx.font = '600 14px "Outfit", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 1;

  for (let i = 0; i < n; i++) {
    const y = gridStartY + i * cellSize + cellSize / 2;
    ctx.fillText(tickers[i], gridStartX - 20, y);
  }

  // Draw X-axis labels (top side, rotated 45°)
  for (let j = 0; j < n; j++) {
    const x = gridStartX + j * cellSize + cellSize / 2;
    const y = gridStartY - 30;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#b4bcd4';
    ctx.font = '600 14px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 1;
    ctx.fillText(tickers[j], 0, 0);
    ctx.restore();
  }

  ctx.shadowColor = 'rgba(0, 0, 0, 0)';

  // Draw title at top with better styling
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 22px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 2;
  ctx.fillText('Matriz de Correlación de Pearson', 20, 15);
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';

  // Draw enhanced legend at bottom
  const legendY = gridStartY + n * cellSize + 25;

  // Legend background
  ctx.fillStyle = 'rgba(30, 40, 60, 0.3)';
  ctx.fillRect(20, legendY - 5, canvasWidth - 40, 30);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, legendY - 5, canvasWidth - 40, 30);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Escala: Azul (-1.0) Negativa → Blanco (0.0) Sin Correlación → Rojo (+1.0) Positiva', 30, legendY + 12);
}

function correlationToColor(value) {
  // value in [-1, 1]
  // -1: deep blue (#1e40af)
  //  0: white (#f8fafc) - neutral
  // +1: deep red (#dc2626) - vibrant red

  let r, g, b;

  if (value < 0) {
    // Deep Blue to White (negative correlation)
    const t = (value + 1) / 1; // [0, 1]
    const blue = [30, 64, 175];     // Deep blue for strong negative
    const white = [248, 250, 252];  // Almost white for neutral
    r = Math.round(blue[0] + (white[0] - blue[0]) * t);
    g = Math.round(blue[1] + (white[1] - blue[1]) * t);
    b = Math.round(blue[2] + (white[2] - blue[2]) * t);
  } else {
    // White to Deep Red (positive correlation)
    const t = value; // [0, 1]
    const white = [248, 250, 252];  // Almost white for neutral
    const red = [220, 38, 38];      // Deep vibrant red for strong positive
    r = Math.round(white[0] + (red[0] - white[0]) * t);
    g = Math.round(white[1] + (red[1] - white[1]) * t);
    b = Math.round(white[2] + (red[2] - white[2]) * t);
  }

  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// Groups Rendering
// ============================================================================

function renderGroups(groups, interpretations) {
  groupsGrid.innerHTML = '';

  const colors = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4'  // Cyan
  ];

  groups.forEach((group, idx) => {
    const interpretation = interpretations.find(gi => gi.groupId === group.id);
    const colorIndex = idx % colors.length;
    const color = colors[colorIndex];

    const card = document.createElement('div');
    card.className = 'card group-card';
    card.style.borderTopColor = color;

    const header = document.createElement('h4');
    header.innerHTML = `
      ${group.label}
      <span class="badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
        ${group.tickers.length} activos
      </span>
    `;
    card.appendChild(header);

    const tickersContainer = document.createElement('div');
    tickersContainer.className = 'group-tickers';
    group.tickers.forEach(ticker => {
      const chip = document.createElement('span');
      chip.className = 'ticker-chip';
      chip.style.background = `${color}20`;
      chip.style.borderColor = `${color}40`;
      chip.style.color = color;
      chip.textContent = ticker;
      tickersContainer.appendChild(chip);
    });
    card.appendChild(tickersContainer);

    if (interpretation) {
      const p = document.createElement('p');
      p.textContent = interpretation.interpretation;
      card.appendChild(p);
    }

    groupsGrid.appendChild(card);
  });
}

// ============================================================================
// Recommendations Rendering
// ============================================================================

function renderRecommendations(recommendations) {
  recommendationsList.innerHTML = '';

  recommendations.forEach(rec => {
    const item = document.createElement('div');
    item.className = 'recommendation-item';
    item.innerHTML = `<p>${rec}</p>`;
    recommendationsList.appendChild(item);
  });
}

// ============================================================================
// Warnings Rendering
// ============================================================================

function renderWarnings(warnings) {
  warningsList.innerHTML = '';

  warnings.forEach(warning => {
    const item = document.createElement('div');
    item.className = 'warning-item';
    item.innerHTML = `<p>${warning}</p>`;
    warningsList.appendChild(item);
  });
}

// ============================================================================
// Citations Rendering
// ============================================================================

function renderCitations(citations) {
  citationsList.innerHTML = '';

  if (citations.length === 0) {
    citationsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No citations available</p>';
    return;
  }

  citations.forEach(citation => {
    const chip = document.createElement('a');
    chip.className = 'citation-chip';
    chip.href = citation.url;
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.innerHTML = `
      <i data-lucide="link-2"></i>
      <span title="${citation.title}">${citation.title}</span>
    `;
    citationsList.appendChild(chip);
  });

  lucide.createIcons();
}

// ============================================================================
// History Management
// ============================================================================

function setupHistoryHandlers() {
  historyList.addEventListener('click', (e) => {
    const historyItem = e.target.closest('.history-item');
    if (!historyItem) return;

    const filename = historyItem.dataset.filename;
    if (filename) {
      loadSavedAnalysis(filename);
    }
  });
}

async function loadHistory() {
  try {
    const response = await fetch('/api/analisis');
    if (!response.ok) throw new Error('Failed to load history');

    const analyses = await response.json();
    console.log('[History] Loaded:', analyses.length, 'analyses');

    historyList.innerHTML = '';

    if (analyses.length === 0) {
      historyList.innerHTML = '<div class="empty-history">Sin analisis guardados</div>';
      return;
    }

    analyses.forEach(analysis => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.dataset.filename = analysis.filename;

      const tickersStr = analysis.tickers.join(', ').substring(0, 40);
      const isActive = state.currentAnalysis?.id === analysis.id ? 'active' : '';

      item.innerHTML = `
        <div>
          <div class="history-item-ticker">${tickersStr}${analysis.tickers.join(', ').length > 40 ? '...' : ''}</div>
          <div class="history-item-date">${new Date(analysis.createdAt).toLocaleDateString('es-ES')}</div>
        </div>
      `;
      item.classList.add(isActive);

      historyList.appendChild(item);
    });

  } catch (error) {
    console.error('[History] Error loading:', error);
    historyList.innerHTML = '<div class="empty-history">Error cargando historial</div>';
  }
}

async function loadSavedAnalysis(filename) {
  try {
    console.log('[History] Loading:', filename);
    const response = await fetch(`/api/analisis/${filename}`);
    if (!response.ok) throw new Error('Failed to load analysis');

    const data = await response.json();
    console.log('[History] Loaded analysis:', data);

    state.currentAnalysis = data;
    transitionToResults(data);

    // Update active state in history
    document.querySelectorAll('.history-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-filename="${filename}"]`)?.classList.add('active');

  } catch (error) {
    console.error('[History] Error loading analysis:', error);
    alert('Error cargando analisis: ' + error.message);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function colorLerp(c1, c2, t) {
  // Linear interpolation between two RGB colors
  const c1rgb = c1.match(/\d+/g).map(Number);
  const c2rgb = c2.match(/\d+/g).map(Number);

  const r = Math.round(c1rgb[0] + (c2rgb[0] - c1rgb[0]) * t);
  const g = Math.round(c1rgb[1] + (c2rgb[1] - c1rgb[1]) * t);
  const b = Math.round(c1rgb[2] + (c2rgb[2] - c1rgb[2]) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// Debugging
// ============================================================================

window.appDebug = {
  state,
  loadHistory,
  loadSavedAnalysis
};
