/**
 * Pure math module for correlation analysis
 * No external dependencies, fully testable
 */

/**
 * Converts a price series into percentage returns.
 * Formula from PDF: R_t = (P_t - P_{t-1}) / P_{t-1}
 *
 * @param {number[]} prices - Array of closing prices (chronological order)
 * @returns {number[]} - Array of returns (length = prices.length - 1)
 */
function calculateReturns(prices) {
  if (prices.length < 2) throw new Error('Need at least 2 prices');

  const returns = [];
  for (let t = 1; t < prices.length; t++) {
    if (prices[t - 1] === 0) {
      returns.push(0);
    } else {
      returns.push((prices[t] - prices[t - 1]) / prices[t - 1]);
    }
  }
  return returns;
}

/**
 * Calculates the Pearson correlation coefficient between two return series.
 * Formula from PDF:
 *   r = Cov(X,Y) / (sigma_X * sigma_Y)
 *   Cov(X,Y) = SUM((X_i - X_mean)(Y_i - Y_mean)) / (n - 1)
 *
 * @param {number[]} x - Return series for asset X
 * @param {number[]} y - Return series for asset Y (same length as x)
 * @returns {number} - Pearson coefficient in [-1, +1]
 * @throws {Error} - If arrays have different lengths or length < 2
 */
function pearsonCorrelation(x, y) {
  if (x.length !== y.length) throw new Error('Series must have equal length');
  const n = x.length;
  if (n < 2) throw new Error('Need at least 2 data points');

  // Step 1: Calculate means
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  // Step 2: Calculate covariance and standard deviations
  let covSum = 0, varXSum = 0, varYSum = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    covSum += dx * dy;
    varXSum += dx * dx;
    varYSum += dy * dy;
  }

  const sigmaX = Math.sqrt(varXSum / (n - 1));
  const sigmaY = Math.sqrt(varYSum / (n - 1));

  // If either series is constant (zero variance), return 0
  if (sigmaX === 0 || sigmaY === 0) return 0;

  const covariance = covSum / (n - 1);
  const r = covariance / (sigmaX * sigmaY);

  // Clamp to [-1, 1] to handle floating point errors
  return Math.max(-1, Math.min(1, r));
}

/**
 * Builds the symmetric NxN correlation matrix.
 * PDF: "Diagonal = 1.0, symmetric, values in [-1, +1]"
 *
 * @param {Object} returnsByTicker - { "AAPL": [r1, r2, ...], "MSFT": [...], ... }
 * @returns {{ tickers: string[], matrix: number[][] }}
 */
function buildCorrelationMatrix(returnsByTicker) {
  const tickers = Object.keys(returnsByTicker).sort();
  const n = tickers.length;

  if (n === 0) throw new Error('No tickers provided');
  if (n === 1) {
    // Single ticker: matrix is just [1.0]
    return { tickers, matrix: [[1.0]] };
  }

  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0; // Diagonal
    for (let j = i + 1; j < n; j++) {
      const r = pearsonCorrelation(
        returnsByTicker[tickers[i]],
        returnsByTicker[tickers[j]]
      );
      // Round to 2 decimal places for display
      const rounded = Math.round(r * 100) / 100;
      matrix[i][j] = rounded;
      matrix[j][i] = rounded; // Symmetric
    }
  }

  return { tickers, matrix };
}

/**
 * Groups assets using single-linkage agglomerative clustering based on
 * correlation threshold using Union-Find data structure.
 *
 * Algorithm:
 * 1. Start with each ticker as its own group.
 * 2. For each pair (i, j) where |matrix[i][j]| >= threshold (and i != j),
 *    merge the groups of ticker i and ticker j.
 * 3. Uses Union-Find (disjoint set) for efficient merging.
 *
 * This implements the PDF's concept:
 * - Assets with |correlation| >= threshold belong to the same "behavioral cluster"
 * - If 3+ distinct groups remain, the portfolio is considered diversified
 *
 * @param {string[]} tickers - Array of ticker symbols
 * @param {number[][]} matrix - NxN correlation matrix
 * @param {number} threshold - Correlation threshold (default 0.7, from PDF)
 * @returns {{ groups: Array<{id, label, tickers}>, isDiversified: boolean, groupCount: number }}
 */
function groupByCorrelation(tickers, matrix, threshold = 0.7) {
  const n = tickers.length;

  if (n === 0) throw new Error('No tickers provided');
  if (threshold < 0 || threshold > 1) throw new Error('Threshold must be in [0, 1]');

  // Union-Find data structure
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x) {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]); // Path compression
    }
    return parent[x];
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[ra] = rb; // Union
    }
  }

  // Merge tickers whose absolute correlation >= threshold
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[i][j]) >= threshold) {
        union(i, j);
      }
    }
  }

  // Collect groups
  const groupMap = {};
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groupMap[root]) {
      groupMap[root] = [];
    }
    groupMap[root].push(tickers[i]);
  }

  // Convert to sorted array format
  const groups = Object.values(groupMap)
    .map((memberTickers, idx) => ({
      id: idx + 1,
      label: `Grupo ${idx + 1}`,
      tickers: memberTickers.sort()
    }))
    .sort((a, b) => a.tickers[0].localeCompare(b.tickers[0])); // Sort by first ticker name

  return {
    groups,
    groupCount: groups.length,
    isDiversified: groups.length >= 3
  };
}

module.exports = {
  calculateReturns,
  pearsonCorrelation,
  buildCorrelationMatrix,
  groupByCorrelation
};
