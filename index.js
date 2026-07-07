const express = require('express');
const path = require('path');
const fs = require('fs');
const YahooFinance = require('yahoo-finance2').default;
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { calculateReturns, buildCorrelationMatrix, groupByCorrelation } = require('./correlation');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize YahooFinance
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure analisis directory exists
const analisisDir = path.join(__dirname, 'analisis');
if (!fs.existsSync(analisisDir)) {
  fs.mkdirSync(analisisDir, { recursive: true });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch historical prices for a single ticker over a given period
 */
async function fetchHistoricalPrices(ticker, period) {
  const startDate = new Date();
  let monthsToFetch;

  switch (period) {
    case '3m':
      monthsToFetch = 3;
      break;
    case '6m':
      monthsToFetch = 6;
      break;
    case '1y':
      monthsToFetch = 12;
      break;
    case '2y':
      monthsToFetch = 24;
      break;
    default:
      monthsToFetch = 12;
  }

  startDate.setMonth(startDate.getMonth() - monthsToFetch);

  try {
    const chartData = await yf.chart(ticker, {
      period1: startDate,
      interval: '1d',
      return: 'array'
    });

    const quotes = chartData.quotes
      .filter(q => q.close !== null)
      .map(q => ({
        date: q.date,
        close: q.close
      }));

    return { success: true, ticker, quotes };
  } catch (err) {
    console.warn(`[Yahoo Finance Warning] Failed to fetch ${ticker}: ${err.message}`);
    return { success: false, ticker, error: err.message };
  }
}

/**
 * Align prices by common trading dates across all tickers
 */
function alignByDate(pricesByTicker) {
  const tickerKeys = Object.keys(pricesByTicker);
  if (tickerKeys.length === 0) throw new Error('No tickers provided');

  // Find common dates
  const dateSets = tickerKeys.map(t =>
    new Set(pricesByTicker[t].map(p => {
      const d = new Date(p.date);
      return d.toISOString().split('T')[0];
    }))
  );

  // Intersect all date sets
  let commonDates = Array.from(dateSets[0]);
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = commonDates.filter(d => dateSets[i].has(d));
  }

  commonDates.sort();

  if (commonDates.length < 2) {
    throw new Error('Not enough common trading dates across all tickers');
  }

  // Build aligned price arrays
  const aligned = {};
  for (const t of tickerKeys) {
    const dateMap = {};
    pricesByTicker[t].forEach(p => {
      const d = new Date(p.date);
      const dateKey = d.toISOString().split('T')[0];
      dateMap[dateKey] = p.close;
    });
    aligned[t] = commonDates.map(d => dateMap[d]);
  }

  return { commonDates, aligned };
}

/**
 * Get company names from Yahoo Finance quoteSummary
 */
async function getCompanyNames(tickers) {
  const names = {};
  const results = await Promise.allSettled(
    tickers.map(t =>
      yf.quoteSummary(t, { modules: ['price'] })
        .then(result => {
          const name = result.price?.longName || t;
          names[t] = name;
        })
        .catch(err => {
          console.warn(`Could not get name for ${t}: ${err.message}`);
          names[t] = t;
        })
    )
  );
  return names;
}

/**
 * Format correlation matrix for Gemini prompt
 */
function formatMatrixForPrompt(tickers, matrix) {
  let table = '         ' + tickers.map(t => t.padStart(8)).join('') + '\n';
  for (let i = 0; i < tickers.length; i++) {
    table += tickers[i].padEnd(9);
    for (let j = 0; j < tickers.length; j++) {
      table += matrix[i][j].toFixed(2).padStart(8);
    }
    table += '\n';
  }
  return table;
}

/**
 * Generate Markdown report from analysis results
 */
function generateMarkdown(ticker, data) {
  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let md = `# Analisis de Correlacion de Portafolio\n`;
  md += `**Fecha:** ${dateStr}\n\n`;
  md += `**Activos Analizados:** ${data.tickers.join(', ')}\n`;
  md += `**Período:** ${data.periodLabel}\n`;
  md += `**Umbral de Agrupamiento:** ${data.threshold}\n\n`;

  md += `## Resumen de Salud del Portafolio\n`;
  md += `> ${data.geminiAnalysis.portfolioHealthSummary}\n\n`;

  md += `## Matriz de Correlacion de Pearson\n`;
  md += `| | ${data.tickers.join(' | ')} |\n`;
  md += `|---|${data.tickers.map(() => '---').join('|')}|\n`;
  for (let i = 0; i < data.tickers.length; i++) {
    md += `| ${data.tickers[i]} | ${data.matrix[i].map(v => v.toFixed(2)).join(' | ')} |\n`;
  }
  md += `\n`;

  md += `## Grupos Formados por Correlacion\n`;
  data.groups.forEach((group, idx) => {
    const interpretation = data.geminiAnalysis.groupInterpretations.find(
      gi => gi.groupId === group.id
    );
    md += `### ${group.label}: ${group.tickers.join(', ')}\n`;
    if (interpretation) {
      md += `${interpretation.interpretation}\n\n`;
    }
  });

  md += `## Veredicto de Diversificacion\n`;
  md += `**Número de Grupos:** ${data.groupCount}\n`;
  md += `**Estado:** ${data.isDiversified ? 'DIVERSIFICADO (3+ grupos)' : 'NO DIVERSIFICADO (menos de 3 grupos)'}\n\n`;

  md += `## Evaluacion de Diversificacion\n`;
  md += `${data.geminiAnalysis.diversificationAssessment}\n\n`;

  md += `## Recomendaciones\n`;
  data.geminiAnalysis.recommendations.forEach((rec, idx) => {
    md += `${idx + 1}. ${rec}\n`;
  });
  md += `\n`;

  md += `## Advertencias de Riesgo\n`;
  data.geminiAnalysis.riskWarnings.forEach((warning, idx) => {
    md += `- ${warning}\n`;
  });
  md += `\n`;

  if (data.citations && data.citations.length > 0) {
    md += `## Fuentes Consultadas\n`;
    data.citations.forEach(citation => {
      md += `- [${citation.title}](${citation.url})\n`;
    });
  }

  return md;
}

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /api/analisis
 * List all saved analyses
 */
app.get('/api/analisis', (req, res) => {
  try {
    const files = fs.readdirSync(analisisDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(analisisDir, file);
        const stats = fs.statSync(filePath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        return {
          id: data.id,
          tickers: data.tickers,
          period: data.period,
          threshold: data.threshold,
          groupCount: data.groupCount,
          isDiversified: data.isDiversified,
          createdAt: stats.mtime,
          filename: file
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Error reading analisis directory: ' + error.message });
  }
});

/**
 * GET /api/analisis/:filename
 * Get a specific saved analysis
 */
app.get('/api/analisis/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(analisisDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error reading file: ' + error.message });
  }
});

/**
 * POST /api/generate-correlation
 * Main endpoint: analyze correlation of multiple assets
 */
app.post('/api/generate-correlation', async (req, res) => {
  const { tickers: rawTickers, period = '1y', threshold = 0.7, geminiApiKey, model = 'gemini-2.5-flash' } = req.body;

  // Validate inputs
  if (!rawTickers || !Array.isArray(rawTickers) || rawTickers.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 tickers.' });
  }

  if (rawTickers.length > 20) {
    return res.status(400).json({ error: 'Máximo 20 tickers permitidos.' });
  }

  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'Se requiere una API Key de Gemini.' });
  }

  try {
    console.log(`[Correlation Analysis] Starting analysis for: ${rawTickers.join(', ')}`);

    // Clean and validate tickers
    const tickers = rawTickers
      .map(t => t.trim().toUpperCase())
      .filter((t, idx, arr) => arr.indexOf(t) === idx); // Remove duplicates

    if (tickers.length < 2) {
      return res.status(400).json({ error: 'Se requieren al menos 2 tickers diferentes.' });
    }

    // Step 1: Fetch historical prices in parallel
    console.log(`[Yahoo Finance] Fetching prices for ${tickers.length} tickers...`);
    const fetchResults = await Promise.allSettled(
      tickers.map(t => fetchHistoricalPrices(t, period))
    );

    const pricesByTicker = {};
    const failedTickers = [];

    fetchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value.success) {
        pricesByTicker[result.value.ticker] = result.value.quotes;
      } else {
        failedTickers.push(tickers[idx]);
      }
    });

    if (Object.keys(pricesByTicker).length < 2) {
      return res.status(400).json({
        error: `No se pudieron obtener datos para suficientes tickers. Fallos: ${failedTickers.join(', ')}`
      });
    }

    if (failedTickers.length > 0) {
      console.warn(`[Yahoo Finance] Failed to fetch: ${failedTickers.join(', ')}`);
    }

    const successfulTickers = Object.keys(pricesByTicker);

    // Step 2: Align prices by common trading dates
    console.log(`[Date Alignment] Aligning ${successfulTickers.length} tickers...`);
    const { commonDates, aligned } = alignByDate(pricesByTicker);
    console.log(`[Date Alignment] Found ${commonDates.length} common trading dates`);

    // Step 3: Calculate returns
    console.log(`[Returns] Calculating returns...`);
    const returnsByTicker = {};
    for (const t of successfulTickers) {
      returnsByTicker[t] = calculateReturns(aligned[t]);
    }

    // Step 4: Build correlation matrix
    console.log(`[Correlation] Building matrix...`);
    const { tickers: sortedTickers, matrix } = buildCorrelationMatrix(returnsByTicker);

    // Step 5: Group by correlation
    console.log(`[Grouping] Grouping by threshold ${threshold}...`);
    const { groups, groupCount, isDiversified } = groupByCorrelation(sortedTickers, matrix, threshold);

    // Step 5.5: Calculate cumulative returns for price history visualization
    console.log(`[Price History] Calculating cumulative returns...`);
    const cumulativeReturns = {};
    // Use sortedTickers to ensure consistency with the correlation matrix tickers
    for (const ticker of sortedTickers) {
      const prices = aligned[ticker];
      if (prices && prices.length > 0) {
        const basePrice = prices[0];
        cumulativeReturns[ticker] = prices.map(p => +((p / basePrice - 1) * 100).toFixed(4));
      }
    }
    console.log(`[Price History] Cumulative returns calculated for ${Object.keys(cumulativeReturns).length} tickers`);

    // Step 6: Get company names
    console.log(`[Company Names] Fetching company names...`);
    const tickerNames = await getCompanyNames(sortedTickers);

    // Step 7: Build Gemini prompt
    console.log(`[Gemini] Constructing prompt...`);
    const periodLabel = {
      '3m': '3 meses',
      '6m': '6 meses',
      '1y': '1 año',
      '2y': '2 años'
    }[period] || period;

    const geminiPrompt = `
Eres un analista financiero experto en construcción de portafolios y diversificación.
Se te presenta el análisis de correlación de un portafolio de inversión compuesto por los siguientes activos:

**Activos analizados:** ${sortedTickers.join(', ')}
**Período histórico analizado:** ${periodLabel} (datos de precios de cierre diarios)
**Umbral de correlación utilizado para agrupamiento:** ${threshold}

**Matriz de Correlación de Pearson (calculada sobre retornos diarios):**
${formatMatrixForPrompt(sortedTickers, matrix)}

**Grupos formados por correlación (umbral ${threshold}):**
${groups.map(g => `- ${g.label}: ${g.tickers.join(', ')}`).join('\n')}

**Número de grupos distintos:** ${groupCount}
**Veredicto de diversificación (3+ grupos = diversificado):** ${isDiversified ? 'DIVERSIFICADO' : 'NO DIVERSIFICADO'}

Tu tarea es generar un análisis narrativo completo que incluya:

1. **portfolioHealthSummary**: Un resumen ejecutivo de 2-3 oraciones sobre la salud general del portafolio en términos de diversificación. Sé directo.

2. **groupInterpretations**: Para cada grupo formado, explica por qué están agrupados (sector, tipo de activo, exposición similar). Retorna array: [{ "groupId": 1, "interpretation": "..." }, ...]

3. **diversificationAssessment**: Una evaluación detallada: ¿hay "falsa diversificación"? ¿Pares con correlación negativa que actúan como cobertura? ¿Activos descorrelacionados?

4. **recommendations**: Array de 2-4 recomendaciones concretas para mejorar o mantener la diversificación.

5. **riskWarnings**: Array de 1-3 advertencias sobre riesgos del portafolio. Siempre incluir que "las correlaciones cambian en el tiempo y en crisis tienden a 1".

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "portfolioHealthSummary": "string",
  "groupInterpretations": [
    { "groupId": 1, "interpretation": "string" }
  ],
  "diversificationAssessment": "string",
  "recommendations": ["string"],
  "riskWarnings": ["string"]
}
`;

    // Step 8: Call Gemini with retry logic
    console.log(`[Gemini] Calling Gemini API with model ${model}...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({
      model: model,
      tools: [{ googleSearch: {} }]
    });

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 15000;
    let geminiResponse;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Gemini] Attempt ${attempt}/${MAX_RETRIES}...`);
        const result = await genModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }]
        });
        geminiResponse = result;
        break;
      } catch (geminiError) {
        const status = geminiError.status || 0;
        const isRetryable = status === 429 || status === 503 || status === 500;

        if (isRetryable && attempt < MAX_RETRIES) {
          console.warn(`[Gemini] Error ${status} on attempt ${attempt}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          throw geminiError;
        }
      }
    }

    // Step 9: Parse Gemini response
    console.log(`[Gemini] Response received. Parsing...`);
    const responseText = geminiResponse.response.text();
    let geminiAnalysis;

    try {
      geminiAnalysis = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          geminiAnalysis = JSON.parse(jsonMatch[1].trim());
        } catch (innerError) {
          console.error('[JSON Parse Error] Could not parse extracted block');
          throw new Error('AI did not return valid JSON.');
        }
      } else {
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            geminiAnalysis = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
          } catch (bruteError) {
            console.error('[JSON Parse Error] All parse attempts failed');
            throw new Error('AI did not return valid JSON.');
          }
        } else {
          throw new Error('AI did not return valid JSON.');
        }
      }
    }

    // Step 10: Extract citations
    const candidate = geminiResponse.response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const searchChunks = groundingMetadata?.groundingChunks || [];
    const citations = searchChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        title: chunk.web.title,
        url: chunk.web.uri
      }));

    geminiAnalysis.citations = citations;

    // Step 11: Assemble result object
    const timestamp = Date.now();
    const filename = `${timestamp}_${sortedTickers.join('-')}.json`;
    const id = `${timestamp}_${sortedTickers.join('-')}`;

    const analysisData = {
      id,
      tickers: sortedTickers,
      period,
      threshold,
      tickerNames,
      matrix,
      groups,
      groupCount,
      isDiversified,
      geminiAnalysis,
      citations,
      createdAt: new Date().toISOString(),
      filename,
      periodLabel,
      priceHistory: {
        dates: commonDates,
        cumulative: cumulativeReturns
      }
    };

    // Step 12: Save to disk
    console.log(`[Persistence] Saving to analisis/ directory...`);
    const jsonPath = path.join(analisisDir, filename);
    const mdFilename = filename.replace('.json', '.md');
    const mdPath = path.join(analisisDir, mdFilename);

    fs.writeFileSync(jsonPath, JSON.stringify(analysisData, null, 2), 'utf8');
    const mdContent = generateMarkdown(sortedTickers[0], analysisData);
    fs.writeFileSync(mdPath, mdContent, 'utf8');

    console.log(`[Persistence] Analysis saved to ${filename}`);

    // Step 13: Return response
    res.json(analysisData);

  } catch (error) {
    console.error('[Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve markdown files from analisis directory
app.use('/analisis', express.static(analisisDir));

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
