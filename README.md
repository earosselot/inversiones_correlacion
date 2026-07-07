# Inversiones Correlación - Análisis Inteligente de Portafolios

Herramienta avanzada para analizar la correlación entre activos de inversión y evaluar la diversificación de portafolios usando inteligencia artificial.

## 🎯 Características Principales

- **Análisis de Correlación de Pearson**: Calcula la correlación entre múltiples activos financieros
- **Matriz de Correlación Visual**: Heatmap interactivo con colores que representan correlaciones negativas, nulas y positivas
- **Gráfico de Retorno Acumulado**: Visualiza el desempeño histórico de cada activo con toggles interactivos
- **Agrupamiento Automático**: Agrupa activos por correlación usando Union-Find
- **Análisis con IA**: Integración con Gemini para obtener recomendaciones inteligentes
- **Evaluación de Diversificación**: Determina si un portafolio está suficientemente diversificado (3+ grupos independientes)
- **Persistencia**: Guarda todos los análisis en disco para revisión posterior

## 📋 Requisitos

- Node.js 14+
- npm o pnpm
- API Key de Google Gemini (gratuita en [aistudio.google.com](https://aistudio.google.com))

## 🚀 Instalación

```bash
# Clonar o descargar el proyecto
cd inversiones_correlacion

# Instalar dependencias
npm install
# o
pnpm install

# Configurar variables de entorno (opcional)
# Crear archivo .env:
# GEMINI_API_KEY=tu_clave_aqui
# PORT=3000

# Iniciar el servidor
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 📊 Fórmulas y Cálculos

### 1. Cálculo de Retornos Diarios

Los retornos diarios se calculan como el cambio porcentual entre precios de cierre consecutivos:

$$R_t = \frac{P_t - P_{t-1}}{P_{t-1}}$$

Donde:
- $R_t$ = Retorno en el período $t$
- $P_t$ = Precio de cierre en el período $t$
- $P_{t-1}$ = Precio de cierre en el período anterior

**Ejemplo**: Si una acción cuesta $100 hoy y $105 mañana:
$$R = \frac{105 - 100}{100} = 0.05 = 5\%$$

### 2. Coeficiente de Correlación de Pearson

La correlación de Pearson mide la relación lineal entre dos series de retornos:

$$r_{XY} = \frac{\text{Cov}(X,Y)}{\sigma_X \cdot \sigma_Y}$$

Donde:
- $\text{Cov}(X,Y)$ = Covarianza entre X e Y
- $\sigma_X$ = Desviación estándar de X
- $\sigma_Y$ = Desviación estándar de Y

#### Covarianza

$$\text{Cov}(X,Y) = \frac{\sum_{i=1}^{n} (X_i - \bar{X})(Y_i - \bar{Y})}{n-1}$$

Donde:
- $X_i, Y_i$ = Valores individuales
- $\bar{X}, \bar{Y}$ = Promedios de las series
- $n$ = Número de observaciones

#### Desviación Estándar

$$\sigma_X = \sqrt{\frac{\sum_{i=1}^{n} (X_i - \bar{X})^2}{n-1}}$$

#### Rango de Valores

El coeficiente de correlación $r$ siempre está entre -1 y 1:

| Rango | Interpretación |
|-------|---|
| $r = 1$ | Correlación positiva perfecta (movimiento idéntico) |
| $0 < r < 1$ | Correlación positiva (movimiento conjunto) |
| $r = 0$ | Sin correlación (movimientos independientes) |
| $-1 < r < 0$ | Correlación negativa (movimientos opuestos) |
| $r = -1$ | Correlación negativa perfecta (opuesto exacto) |

**Ejemplo**:
- AAPL y MSFT con $r = 0.82$ → Fuertemente correlacionados (ambas tech)
- GLD y STOCKS con $r = -0.15$ → Débilmente correlacionados negativos (oro = refugio seguro)

### 3. Matriz de Correlación

Se construye una matriz simétrica NxN donde N es el número de activos:

$$\begin{bmatrix}
1.00 & r_{12} & r_{13} & \cdots & r_{1N} \\
r_{21} & 1.00 & r_{23} & \cdots & r_{2N} \\
r_{31} & r_{32} & 1.00 & \cdots & r_{3N} \\
\vdots & \vdots & \vdots & \ddots & \vdots \\
r_{N1} & r_{N2} & r_{N3} & \cdots & 1.00
\end{bmatrix}$$

**Propiedades**:
- La diagonal siempre es 1.0 (correlación de un activo consigo mismo)
- Simétrica: $r_{ij} = r_{ji}$
- Cada elemento está en el rango [-1, 1]

### 4. Agrupamiento por Correlación (Union-Find)

Los activos se agrupan automáticamente usando un algoritmo de clustering jerárquico:

**Algoritmo**:
1. Cada activo comienza como su propio grupo
2. Para cada par de activos $(i, j)$: Si $|r_{ij}| \geq \text{umbral}$, se fusionan sus grupos
3. Se usa Union-Find con path compression para eficiencia $O(n \log n)$

**Ejemplo** con umbral = 0.7:
- Si AAPL y MSFT tienen $r = 0.82$ → Se agrupan
- Si GLD y TLT tienen $r = 0.45$ → No se agrupan
- Resultado: Activos altamente correlacionados en el mismo grupo

### 5. Criterio de Diversificación

Un portafolio se considera diversificado si tiene **3 o más grupos independientes**:

$$\text{Diversificado} = \begin{cases}
\text{SÍ} & \text{si } \text{número de grupos} \geq 3 \\
\text{NO} & \text{si } \text{número de grupos} < 3
\end{cases}$$

**Razonamiento**: Grupos distintos significan exposiciones independientes. 3+ grupos proporcionan suficiente protección contra caídas en un solo sector o clase de activo.

### 6. Retorno Acumulado

Muestra cómo ha evolucionado cada activo desde el inicio del período:

$$R_{\text{acum}}(t) = \left(\frac{P_t}{P_0} - 1\right) \times 100\%$$

Donde:
- $P_t$ = Precio en el período $t$
- $P_0$ = Precio inicial

**Ejemplo**: Si AAPL inició a $150 y está a $180:
$$R_{\text{acum}} = \left(\frac{180}{150} - 1\right) \times 100\% = 20\%$$

## 📈 Visualizaciones

### Matriz de Correlación (Heatmap)

- **Color azul profundo**: Correlación negativa (-1.0)
- **Color blanco**: Sin correlación (0.0)
- **Color rojo vibrante**: Correlación positiva (+1.0)
- **Tamaño**: Se adapta automáticamente según número de activos

### Gráfico de Retorno Acumulado

- Línea por cada activo con color único
- Eje Y: Retorno porcentual acumulado
- Eje X: Fechas en español
- **Toggles**: Haz clic en el nombre de cada activo para mostrar/ocultar su línea
- **Tooltips**: Pasa el mouse para ver valor exacto y fecha

## 🔄 Flujo de Análisis

```
1. Usuario ingresa tickers (ej: AAPL, MSFT, GLD)
   ↓
2. Sistema obtiene precios históricos (período seleccionado)
   ↓
3. Calcula retornos diarios para cada activo
   ↓
4. Construye matriz de correlación de Pearson
   ↓
5. Agrupa activos por umbral de correlación
   ↓
6. Evalúa diversificación (≥3 grupos = diversificado)
   ↓
7. Consulta Gemini AI para análisis narrativo
   ↓
8. Genera reporte con visualizaciones y recomendaciones
```

## 💡 Interpretación de Resultados

### Matriz de Correlación

**Leer la matriz**:
- Busca líneas rojas intensas para identificar activos altamente correlacionados
- Líneas azules indican correlaciones negativas (buenos para cobertura)
- Líneas blancas/amarillas indican baja correlación (deseable para diversificación)

**Ejemplo**:
```
      AAPL  MSFT  GLD   TLT
AAPL  1.00  0.82  -0.10 -0.25
MSFT  0.82  1.00  -0.12 -0.20
GLD   -0.10 -0.12 1.00  0.45
TLT   -0.25 -0.20 0.45  1.00
```

Aquí: AAPL y MSFT están correlacionados (0.82), mientras que los bonos (TLT) y oro (GLD) actúan como cobertura.

### Grupos de Activos

Activos en el mismo grupo tienen correlación ≥ umbral:
- **Grupo 1**: AAPL, MSFT (Tech correlacionados)
- **Grupo 2**: GLD (Refugio seguro)
- **Grupo 3**: TLT (Bonos)

**Veredicto**: 3 grupos → DIVERSIFICADO ✓

## 🛠️ Tecnologías Utilizadas

**Backend**:
- Node.js + Express
- Yahoo Finance 2 (datos de mercado)
- Google Generative AI (análisis con Gemini)

**Frontend**:
- HTML5 + CSS3 (Glassmorphism)
- Chart.js (gráficos)
- Lucide Icons (iconografía)

**Matemáticas**:
- Cálculo de correlación puro (sin librerías externas)
- Union-Find para clustering eficiente
- Aritmética de punto flotante con validación

## 📁 Estructura del Proyecto

```
inversiones_correlacion/
├── index.js                 # API Express y flujo principal
├── correlation.js           # Módulo matemático puro
├── package.json            # Dependencias
├── public/
│   ├── index.html          # Interfaz HTML
│   ├── app.js              # Lógica del frontend
│   ├── style.css           # Estilos CSS
│   └── style_base.css      # Reset CSS
├── analisis/               # Directorio de análisis guardados
└── README.md               # Este archivo
```

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Google Gemini API Key (obtener en https://aistudio.google.com)
GEMINI_API_KEY=tu_clave_aqui

# Puerto del servidor (opcional, default 3000)
PORT=3000
```

## 📚 Referencias Matemáticas

Las fórmulas implementadas están basadas en:

1. **Pearson Correlation**: Métrica estándar en estadística (Karl Pearson, 1896)
2. **Union-Find**: Estructura de datos para problemas de conectividad (Kruskal, 1956)
3. **Retornos Logarítmicos**: Estándar en finanzas cuantitativas

## ⚠️ Advertencias Importantes

1. **Las correlaciones varían en el tiempo**: Los valores históricos no garantizan comportamiento futuro
2. **En crisis, correlaciones tienden a 1**: Durante correcciones de mercado, los activos tienden a caer juntos
3. **Datos históricos**: Análisis basados en precios de cierre (no intraday)
4. **Limitaciones de API**: Yahoo Finance puede tener restricciones de llamadas

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo licencia ISC.

## 👨‍💻 Autor

Proyecto de análisis de correlación de portafolios con IA.

---

**Última actualización**: Julio 2026

Para preguntas o soporte, por favor abre un issue en el repositorio.
