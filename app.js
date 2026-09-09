/**
 * Manga Voice Reader - App Principal
 */

// ==================== VARIABLES GLOBALES ====================
let allMangas = [];
let currentManga = null;
let currentIndex = 0;
let bubbles = [];
let isReading = false;
let currentReadIndex = -1;
let isDarkMode = true;
let availableVoices = []; // Voces TTS disponibles (ordenadas)

// ==================== REFERENCIAS DOM ====================
const els = {
    libraryScreen: document.getElementById('libraryScreen'),
    readerScreen: document.getElementById('readerScreen'),
    mangaGrid: document.getElementById('mangaGrid'),
    librarySection: document.getElementById('librarySection'),
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    mangaImage: document.getElementById('mangaImage'),
    bubbleOverlay: document.getElementById('bubbleOverlay'),
    pageInfo: document.getElementById('pageInfo'),
    readerTitle: document.getElementById('readerTitle'),
    pageSlider: document.getElementById('pageSlider'),
    pageThumbnails: document.getElementById('pageThumbnails'),
    detectBtn: document.getElementById('detectBtn'),
    readBtn: document.getElementById('readBtn'),
    stopBtn: document.getElementById('stopBtn'),
    voiceSelect: document.getElementById('voiceSelect'),
    rateSlider: document.getElementById('rateSlider'),
    rateValue: document.getElementById('rateValue'),
    pauseSlider: document.getElementById('pauseSlider'),
    pauseValue: document.getElementById('pauseValue'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    dialoguesList: document.getElementById('dialoguesList'),
    themeToggle: document.getElementById('themeToggle'),
    manualModeBtn: document.getElementById('manualModeBtn'),
    manualOverlay: document.getElementById('manualOverlay'),
    manualHint: document.getElementById('manualHint'),
    manualCount: document.getElementById('manualCount'),
};

// Cache del canvas de la página actual (para no releer la imagen en cada operación)
let pageCanvasCache = { index: -1, canvas: null, w: 0, h: 0 };
let manualMode = false;
let manualDraft = null; // rectángulo que se está dibujando ahora mismo

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    initVoices();
    initEventListeners();
    loadTheme();
});

function initEventListeners() {
    // El input file ya está vinculado al label via atributo "for"
    // Solo necesitamos escuchar el evento change del input
    els.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
        // Resetear el input para permitir seleccionar el mismo archivo de nuevo
        e.target.value = '';
    });

    // Drag & drop (desktop)
    els.dropZone.addEventListener('click', () => els.fileInput.click());
    els.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.dropZone.classList.add('dragover');
    });
    els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('dragover'));
    els.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // Navegación
    document.getElementById('backToLibrary').addEventListener('click', backToLibrary);
    document.getElementById('navPrev').addEventListener('click', () => changePage(-1));
    document.getElementById('navNext').addEventListener('click', () => changePage(1));
    els.pageSlider.addEventListener('input', (e) => showPage(parseInt(e.target.value)));

    // TTS
    els.detectBtn.addEventListener('click', detectBubbles);
    els.readBtn.addEventListener('click', readAllBubbles);
    els.stopBtn.addEventListener('click', stopReading);

    // Recorte manual
    els.manualModeBtn.addEventListener('click', toggleManualMode);
    initManualDrawing();

    // Sliders
    els.rateSlider.addEventListener('input', (e) => els.rateValue.textContent = e.target.value + 'x');
    els.pauseSlider.addEventListener('input', (e) => els.pauseValue.textContent = e.target.value + 's');

    // Tema
    els.themeToggle.addEventListener('click', toggleTheme);

    // Teclado
    document.addEventListener('keydown', handleKeyboard);

    // Touch gestures
    initTouchGestures();

    // Resize
    window.addEventListener('resize', () => {
        if (bubbles.length > 0) renderBubbleOverlay();
    });
}

// ==================== TOUCH GESTURES ====================
function initTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    const viewport = document.getElementById('mangaViewport');

    viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchStartX - touchEndX;
        const deltaY = touchStartY - touchEndY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                changePage(1);
            } else {
                changePage(-1);
            }
        }
    }, { passive: true });
}

// ==================== TEMA ====================
function loadTheme() {
    const saved = localStorage.getItem('mangaReaderTheme');
    if (saved === 'light') {
        isDarkMode = false;
        document.body.classList.add('light-mode');
        els.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('light-mode', !isDarkMode);
    els.themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    localStorage.setItem('mangaReaderTheme', isDarkMode ? 'dark' : 'light');
}

// ==================== VOCES TTS ====================
function initVoices() {
    const load = () => {
        const voices = speechSynthesis.getVoices();
        els.voiceSelect.innerHTML = '';

        const esVoices = voices.filter(v => v.lang.startsWith('es'));
        const enVoices = voices.filter(v => v.lang.startsWith('en'));
        const others = voices.filter(v => !v.lang.startsWith('es') && !v.lang.startsWith('en'));
        availableVoices = [...esVoices, ...enVoices, ...others];

        availableVoices.forEach((v, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${v.name} (${v.lang})`;
            els.voiceSelect.appendChild(opt);
        });

        if (availableVoices.length === 0) {
            els.voiceSelect.innerHTML = '<option value="">Voces del sistema</option>';
        }
    };

    speechSynthesis.onvoiceschanged = load;
    load();
}

// ==================== CARGA DE ARCHIVOS ====================
async function handleFiles(files) {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    showStatus('Procesando archivos...', 'loading');

    for (const file of arr) {
        const ext = file.name.split('.').pop().toLowerCase();
        let pages = [];

        if (ext === 'zip' || ext === 'cbz') {
            pages = await extractZip(file);
        } else if (file.type.startsWith('image/')) {
            pages = [URL.createObjectURL(file)];
        }

        if (pages.length > 0) {
            allMangas.push({
                id: Date.now() + Math.random(),
                name: file.name.replace(/\.[^.]+$/, ''),
                pages: pages,
                cover: pages[0]
            });
        }
    }

    renderLibrary();
    showStatus(`${allMangas.length} archivo(s) cargado(s)`, 'success');
}

async function extractZip(file) {
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const imgs = [];

        content.forEach((path, entry) => {
            if (!entry.dir) {
                const ext = path.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext) && !path.includes('__MACOSX')) {
                    imgs.push(entry);
                }
            }
        });

        imgs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        const urls = [];
        for (const img of imgs) {
            const blob = await img.async('blob');
            urls.push(URL.createObjectURL(blob));
        }
        return urls;
    } catch (e) {
        showStatus('Error al leer ZIP: ' + e.message, 'error');
        return [];
    }
}

// ==================== BIBLIOTECA ====================
function renderLibrary() {
    els.mangaGrid.innerHTML = '';

    if (allMangas.length === 0) {
        els.librarySection.style.display = 'none';
        return;
    }

    els.librarySection.style.display = 'block';

    allMangas.forEach((manga) => {
        const card = document.createElement('div');
        card.className = 'manga-card';
        card.innerHTML = `
            <img class="cover" src="${manga.cover}" alt="${manga.name}" loading="lazy">
            <div class="info">
                <div class="title" title="${manga.name}">${manga.name}</div>
                <div class="pages">${manga.pages.length} páginas</div>
            </div>
        `;
        card.addEventListener('click', () => openManga(manga.id));
        els.mangaGrid.appendChild(card);
    });
}

function openManga(id) {
    currentManga = allMangas.find(m => m.id === id);
    if (!currentManga) return;

    currentIndex = 0;
    els.readerTitle.textContent = currentManga.name;

    els.libraryScreen.style.display = 'none';
    els.readerScreen.style.display = 'flex';

    els.pageSlider.max = currentManga.pages.length - 1;

    renderThumbnails();
    showPage(0);
    showStatus(`Leyendo: ${currentManga.name}`, 'success');
}

function backToLibrary() {
    stopReading();
    els.readerScreen.style.display = 'none';
    els.libraryScreen.style.display = 'block';
    currentManga = null;
    bubbles = [];
}

// ==================== VISOR ====================
function renderThumbnails() {
    if (!currentManga) return;
    els.pageThumbnails.innerHTML = '';

    currentManga.pages.forEach((src, i) => {
        const img = document.createElement('img');
        img.className = 'page-thumb' + (i === currentIndex ? ' active' : '');
        img.src = src;
        img.alt = `Página ${i + 1}`;
        img.loading = 'lazy';
        img.addEventListener('click', () => showPage(i));
        els.pageThumbnails.appendChild(img);
    });
}

function showPage(index) {
    if (!currentManga || index < 0 || index >= currentManga.pages.length) return;

    stopReading();
    currentIndex = index;
    els.mangaImage.src = currentManga.pages[index];
    els.pageInfo.textContent = `${index + 1} / ${currentManga.pages.length}`;
    els.pageSlider.value = index;

    bubbles = [];
    els.bubbleOverlay.innerHTML = '';
    els.readBtn.disabled = true;
    els.detectBtn.disabled = false;
    els.detectBtn.innerHTML = '<i class="fas fa-search"></i><span>Detectar Burbujas</span>';
    pageCanvasCache = { index: -1, canvas: null, w: 0, h: 0 };
    if (manualMode) toggleManualMode();
    els.manualOverlay.innerHTML = '';

    els.dialoguesList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <p>Detecta las burbujas primero</p>
            <small>Se ordenarán derecha→izquierda, arriba→abajo</small>
        </div>
    `;

    document.querySelectorAll('.page-thumb').forEach((t, i) => {
        t.classList.toggle('active', i === index);
    });

    const activeThumb = document.querySelector('.page-thumb.active');
    if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center' });
}

function changePage(delta) {
    if (!currentManga) return;
    const newIndex = currentIndex + delta;
    if (newIndex >= 0 && newIndex < currentManga.pages.length) {
        showPage(newIndex);
    }
}

// ==================== CANVAS DE PÁGINA (con cache) ====================
async function loadPageCanvas(index) {
    if (pageCanvasCache.index === index && pageCanvasCache.canvas) {
        return pageCanvasCache;
    }
    const img = new Image();
    img.src = currentManga.pages[index];
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    pageCanvasCache = { index, canvas, w: canvas.width, h: canvas.height };
    return pageCanvasCache;
}

// ==================== DETECCIÓN DE BURBUJAS ====================
// Detecta DOS tipos de caja: "light" (globos blancos clásicos) y "dark"
// (recuadros de narración negros/grises con texto blanco). Antes solo se
// buscaba gray > 200, así que cualquier caja oscura ni siquiera entraba
// como candidata. Para las oscuras exigimos alta "rectangularidad" (area
// muy cercana al área del bounding box) porque un recuadro de narración es
// casi un rectángulo perfecto, mientras que sombras/arte oscuro del dibujo
// tienen contornos irregulares — así evitamos que el fondo del dibujo se
// detecte como si fuera una caja de texto.
async function detectBubbles() {
    if (!currentManga) return;

    els.detectBtn.disabled = true;
    els.detectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Analizando...</span>';
    showStatus('Detectando burbujas...', 'loading');

    try {
        const { canvas, w, h } = await loadPageCanvas(currentIndex);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const gray = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
            const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
            gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }

        const rawBubbles = [
            ...findBoxesByThreshold(gray, w, h, 'light'),
            ...findBoxesByThreshold(gray, w, h, 'dark'),
            ...findBoxesByThreshold(gray, w, h, 'mid'),
            ...findBoxesByEdges(gray, w, h),
        ];

        const merged = removeOverlappingBoxes(rawBubbles);
        bubbles = sortMangaBubbles(merged);
        renderBubbleOverlay();

        if (bubbles.length > 0) {
            await ocrBubbles(canvas, bubbles);
        }

        renderDialogues();
        els.readBtn.disabled = bubbles.length === 0;

        const msg = bubbles.length > 0
            ? `✅ ${bubbles.length} burbujas detectadas`
            : '⚠️ No se detectaron burbujas — prueba con Recorte Manual';
        showStatus(msg, bubbles.length > 0 ? 'success' : 'error');

    } catch (e) {
        showStatus('Error: ' + e.message, 'error');
        console.error(e);
    } finally {
        els.detectBtn.disabled = false;
        els.detectBtn.innerHTML = '<i class="fas fa-search"></i><span>Detectar Burbujas</span>';
    }
}

function findBoxesByThreshold(gray, w, h, kind) {
    const rawThresh = new Uint8Array(w * h);
    if (kind === 'light') {
        for (let i = 0; i < w * h; i++) rawThresh[i] = gray[i] > 190 ? 255 : 0;
    } else if (kind === 'dark') {
        for (let i = 0; i < w * h; i++) rawThresh[i] = gray[i] < 80 ? 255 : 0;
    } else if (kind === 'mid') {
        // Grises medios: burbujas grises, beige, etc.
        for (let i = 0; i < w * h; i++) {
            const g = gray[i];
            rawThresh[i] = (g >= 100 && g <= 170) ? 255 : 0;
        }
    }

    const closeK = Math.max(5, Math.min(15, Math.round(Math.min(w, h) / 120)));
    const closed = morphClose(rawThresh, w, h, closeK);
    const cleaned = morphOpen(closed, w, h, 3);
    const components = findConnectedComponents(cleaned, w, h);

    const results = [];
    for (const comp of components) {
        const area = comp.pixels.length;
        // Filtros más permisivos
        if (area < 200 || area > 600000) continue;

        const bbox = getBoundingBox(comp.pixels, w);
        const bw = bbox.maxX - bbox.minX + 1;
        const bh = bbox.maxY - bbox.minY + 1;
        const aspect = bw / bh;
        // Aspect ratio más permisivo
        if (bw < 25 || bh < 18 || aspect < 0.08 || aspect > 10) continue;

        let rawCount = 0;
        for (let y = bbox.minY; y <= bbox.maxY; y++) {
            const rowBase = y * w;
            for (let x = bbox.minX; x <= bbox.maxX; x++) {
                if (rawThresh[rowBase + x] === 255) rawCount++;
            }
        }
        const rawRatio = rawCount / (bw * bh);

        if (kind === 'light') {
            if (rawRatio < 0.22) continue;
            results.push({ x: bbox.minX, y: bbox.minY, w: bw, h: bh, area, invert: false });
        } else if (kind === 'dark') {
            if (rawRatio < 0.35) continue;
            results.push({ x: bbox.minX, y: bbox.minY, w: bw, h: bh, area, invert: true });
        } else {
            // mid: menos estricto
            if (rawRatio < 0.25) continue;
            results.push({ x: bbox.minX, y: bbox.minY, w: bw, h: bh, area, invert: false });
        }
    }
    return results;
}

// Si un mismo texto quedó detectado por ambos pases (raro, pero puede
// pasar en bordes), nos quedamos con el de mayor área y descartamos el
// que se solapa fuertemente con él.
function removeOverlappingBoxes(boxes) {
    const kept = [];
    const sorted = [...boxes].sort((a, b) => b.area - a.area);
    for (const b of sorted) {
        // Solo descartar si hay solapamiento MUY fuerte (>70%)
        const overlaps = kept.some(k => boxOverlapRatio(b, k) > 0.7);
        if (!overlaps) kept.push(b);
    }
    return kept;
}

function boxOverlapRatio(a, b) {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const inter = ix * iy;
    const smaller = Math.min(a.w * a.h, b.w * b.h);
    return smaller > 0 ? inter / smaller : 0;
}

// Detección por bordes: encuentra regiones con alto contraste de bordes,
// útil para burbujas de colores o con bordes definidos.
function findBoxesByEdges(gray, w, h) {
    // Calcular gradiente (magnitud de Sobel simplificado)
    const edges = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const gx = -gray[idx - w - 1] + gray[idx - w + 1]
                     - 2 * gray[idx - 1] + 2 * gray[idx + 1]
                     - gray[idx + w - 1] + gray[idx + w + 1];
            const gy = -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1]
                     + gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];
            const mag = Math.sqrt(gx * gx + gy * gy);
            edges[idx] = mag > 40 ? 255 : 0;
        }
    }

    // Cerrar bordes para formar contornos cerrados
    const closed = morphClose(edges, w, h, 7);
    const filled = morphClose(closed, w, h, 15); // Rellenar interiores
    const cleaned = morphOpen(filled, w, h, 5);
    const components = findConnectedComponents(cleaned, w, h);

    const results = [];
    for (const comp of components) {
        const area = comp.pixels.length;
        if (area < 300 || area > 500000) continue;

        const bbox = getBoundingBox(comp.pixels, w);
        const bw = bbox.maxX - bbox.minX + 1;
        const bh = bbox.maxY - bbox.minY + 1;
        const aspect = bw / bh;
        if (bw < 30 || bh < 20 || aspect < 0.1 || aspect > 8) continue;

        // Verificar que el interior tenga variación de color (texto)
        let interiorVar = 0;
        let interiorCount = 0;
        const pad = Math.max(3, Math.min(bw, bh) / 10);
        for (let y = bbox.minY + pad; y <= bbox.maxY - pad; y++) {
            for (let x = bbox.minX + pad; x <= bbox.maxX - pad; x++) {
                const idx = y * w + x;
                // Variación local
                const localVar = Math.abs(gray[idx] - gray[idx + 1]) + 
                                Math.abs(gray[idx] - gray[idx + w]);
                interiorVar += localVar;
                interiorCount++;
            }
        }
        const avgVar = interiorCount > 0 ? interiorVar / interiorCount : 0;
        // Si hay variación, probablemente hay texto
        if (avgVar < 8) continue;

        // Verificar que tenga bordes cerrados (circularidad)
        const perimeter = estimatePerimeter(comp.pixels);
        const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
        // Burbujas de manga suelen tener circularidad entre 0.3 y 1.0
        if (circularity < 0.15) continue;

        results.push({ x: bbox.minX, y: bbox.minY, w: bw, h: bh, area, invert: false });
    }
    return results;
}

// ==================== PROCESAMIENTO DE IMAGEN ====================
function morphOpen(src, w, h, k) {
    return dilate(erode(src, w, h, k), w, h, k);
}

function morphClose(src, w, h, k) {
    return erode(dilate(src, w, h, k), w, h, k);
}

// Versión separable: un filtro min/max con ventana cuadrada de radio k
// se puede calcular como una pasada horizontal + una vertical, lo cual
// es muchísimo más rápido que recorrer el cuadrado completo pixel por
// pixel — necesario porque ahora usamos kernels bastante más grandes.
function erode(src, w, h, k) {
    const half = Math.floor(k / 2);
    const tmp = new Uint8Array(w * h);
    const dst = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            const xs = Math.max(0, x - half), xe = Math.min(w - 1, x + half);
            let minVal = 255;
            for (let xx = xs; xx <= xe; xx++) {
                const v = src[row + xx];
                if (v < minVal) minVal = v;
            }
            tmp[row + x] = minVal;
        }
    }
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const ys = Math.max(0, y - half), ye = Math.min(h - 1, y + half);
            let minVal = 255;
            for (let yy = ys; yy <= ye; yy++) {
                const v = tmp[yy * w + x];
                if (v < minVal) minVal = v;
            }
            dst[y * w + x] = minVal;
        }
    }
    return dst;
}

function dilate(src, w, h, k) {
    const half = Math.floor(k / 2);
    const tmp = new Uint8Array(w * h);
    const dst = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            const xs = Math.max(0, x - half), xe = Math.min(w - 1, x + half);
            let maxVal = 0;
            for (let xx = xs; xx <= xe; xx++) {
                const v = src[row + xx];
                if (v > maxVal) maxVal = v;
            }
            tmp[row + x] = maxVal;
        }
    }
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const ys = Math.max(0, y - half), ye = Math.min(h - 1, y + half);
            let maxVal = 0;
            for (let yy = ys; yy <= ye; yy++) {
                const v = tmp[yy * w + x];
                if (v > maxVal) maxVal = v;
            }
            dst[y * w + x] = maxVal;
        }
    }
    return dst;
}

function findConnectedComponents(src, w, h) {
    const visited = new Uint8Array(w * h);
    const components = [];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (src[idx] === 255 && !visited[idx]) {
                const pixels = [];
                const stack = [{ x, y }];
                visited[idx] = 1;

                while (stack.length > 0) {
                    const p = stack.pop();
                    pixels.push(p);
                    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                    for (const [dx, dy] of dirs) {
                        const nx = p.x + dx, ny = p.y + dy;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            const nidx = ny * w + nx;
                            if (src[nidx] === 255 && !visited[nidx]) {
                                visited[nidx] = 1;
                                stack.push({ x: nx, y: ny });
                            }
                        }
                    }
                }
                components.push({ pixels });
            }
        }
    }
    return components;
}

function getBoundingBox(pixels, w) {
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (const p of pixels) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
}

function estimatePerimeter(pixels) {
    const set = new Set(pixels.map(p => `${p.x},${p.y}`));
    let perimeter = 0;
    for (const p of pixels) {
        const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of neighbors) {
            if (!set.has(`${p.x + dx},${p.y + dy}`)) perimeter++;
        }
    }
    return perimeter;
}

function sortMangaBubbles(bubbles) {
    if (bubbles.length === 0) return [];

    const byY = [...bubbles].sort((a, b) => a.y - b.y);
    const rows = [];
    let currentRow = [byY[0]];
    const threshold = Math.max(80, byY[0].h * 0.5);

    for (let i = 1; i < byY.length; i++) {
        if (Math.abs(byY[i].y - currentRow[currentRow.length - 1].y) < threshold) {
            currentRow.push(byY[i]);
        } else {
            rows.push(currentRow.sort((a, b) => b.x - a.x));
            currentRow = [byY[i]];
        }
    }
    if (currentRow.length > 0) {
        rows.push(currentRow.sort((a, b) => b.x - a.x));
    }

    let num = 1;
    const result = [];
    for (const row of rows) {
        for (const b of row) {
            result.push({ ...b, num });
            num++;
        }
    }
    return result;
}

// ==================== RENDERIZAR OVERLAY ====================
// Escala/offset del <img> dentro de su contenedor (para convertir entre
// coordenadas de pantalla y coordenadas reales de la imagen).
function getImageDisplayTransform() {
    const imgW = els.mangaImage.naturalWidth || els.mangaImage.width;
    const imgH = els.mangaImage.naturalHeight || els.mangaImage.height;
    const displayW = els.mangaImage.clientWidth;
    const displayH = els.mangaImage.clientHeight;
    const scale = Math.min(displayW / imgW, displayH / imgH);
    const offsetX = (displayW - imgW * scale) / 2;
    const offsetY = (displayH - imgH * scale) / 2;
    return { imgW, imgH, scale, offsetX, offsetY };
}

function renderBubbleOverlay() {
    els.bubbleOverlay.innerHTML = '';

    const { scale, offsetX, offsetY } = getImageDisplayTransform();

    bubbles.forEach((b) => {
        const div = document.createElement('div');
        div.className = 'bubble-box' + (b.manual ? ' manual-added' : '');
        div.id = `bubble-${b.num}`;
        div.style.left = (offsetX + b.x * scale) + 'px';
        div.style.top = (offsetY + b.y * scale) + 'px';
        div.style.width = (b.w * scale) + 'px';
        div.style.height = (b.h * scale) + 'px';
        div.textContent = b.num;
        els.bubbleOverlay.appendChild(div);
    });
}

// ==================== RECORTE MANUAL ====================
// Permite dibujar varios rectángulos seguidos sobre la página para
// agregarlos como "burbujas" adicionales, útil cuando la detección
// automática se salta viñetas con formatos poco comunes.
function toggleManualMode() {
    if (!currentManga) return;
    manualMode = !manualMode;
    els.manualModeBtn.classList.toggle('active', manualMode);
    els.manualOverlay.classList.toggle('active', manualMode);
    els.manualHint.style.display = manualMode ? 'block' : 'none';
    els.manualModeBtn.innerHTML = manualMode
        ? '<i class="fas fa-check"></i><span>Terminar Recorte Manual</span>'
        : '<i class="fas fa-draw-polygon"></i><span>Recorte Manual</span>';
    if (!manualMode) manualDraft = null;
}

function initManualDrawing() {
    const overlay = els.manualOverlay;
    let startX = 0, startY = 0, draftEl = null;

    function pointFromEvent(e) {
        const rect = overlay.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function onStart(e) {
        if (!manualMode) return;
        e.preventDefault();
        const p = pointFromEvent(e);
        startX = p.x; startY = p.y;
        draftEl = document.createElement('div');
        draftEl.className = 'manual-box drawing';
        overlay.appendChild(draftEl);
        updateDraftEl(draftEl, startX, startY, startX, startY);
    }

    function onMove(e) {
        if (!manualMode || !draftEl) return;
        e.preventDefault();
        const p = pointFromEvent(e);
        updateDraftEl(draftEl, startX, startY, p.x, p.y);
    }

    async function onEnd(e) {
        if (!manualMode || !draftEl) return;
        const p = pointFromEvent(e.changedTouches ? { touches: e.changedTouches } : e);
        const left = Math.min(startX, p.x), top = Math.min(startY, p.y);
        const boxW = Math.abs(p.x - startX), boxH = Math.abs(p.y - startY);
        draftEl.remove();
        draftEl = null;

        if (boxW < 12 || boxH < 12) return; // muy chico, probablemente un tap accidental

        await addManualBox(left, top, boxW, boxH);
    }

    function updateDraftEl(el, x1, y1, x2, y2) {
        el.style.left = Math.min(x1, x2) + 'px';
        el.style.top = Math.min(y1, y2) + 'px';
        el.style.width = Math.abs(x2 - x1) + 'px';
        el.style.height = Math.abs(y2 - y1) + 'px';
    }

    overlay.addEventListener('mousedown', onStart);
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseup', onEnd);
    overlay.addEventListener('touchstart', onStart, { passive: false });
    overlay.addEventListener('touchmove', onMove, { passive: false });
    overlay.addEventListener('touchend', onEnd);
}

async function addManualBox(screenX, screenY, screenW, screenH) {
    const { scale, offsetX, offsetY, imgW, imgH } = getImageDisplayTransform();

    // Convertir de coordenadas de pantalla a coordenadas reales de la imagen
    let x = Math.round((screenX - offsetX) / scale);
    let y = Math.round((screenY - offsetY) / scale);
    let w = Math.round(screenW / scale);
    let h = Math.round(screenH / scale);

    x = Math.max(0, Math.min(x, imgW - 1));
    y = Math.max(0, Math.min(y, imgH - 1));
    w = Math.min(w, imgW - x);
    h = Math.min(h, imgH - y);
    if (w < 5 || h < 5) return;

    const nextNum = bubbles.length > 0 ? Math.max(...bubbles.map(b => b.num)) + 1 : 1;
    const box = { x, y, w, h, num: nextNum, manual: true, invert: false, text: '...' };
    bubbles.push(box);
    renderBubbleOverlay();
    renderDialogues();
    els.manualCount.textContent = bubbles.filter(b => b.manual).length;

    showStatus(`Leyendo recorte manual ${nextNum}...`, 'loading');
    const { canvas } = await loadPageCanvas(currentIndex);
    box.text = await ocrSingleBox(canvas, box);
    renderDialogues();
    els.readBtn.disabled = bubbles.length === 0;
    showStatus(`✅ Recorte ${nextNum} agregado`, 'success');
}

// ==================== OCR ====================
async function ocrBubbles(canvas, bubbleList) {
    showStatus('Extrayendo texto...', 'loading');

    for (let i = 0; i < bubbleList.length; i++) {
        const b = bubbleList[i];
        showStatus(`Burbuja ${b.num} de ${bubbleList.length}...`, 'loading');
        b.text = await ocrSingleBox(canvas, b);
    }
}

// OCR de una sola caja. Si b.invert es true (cajas oscuras: texto claro
// sobre fondo negro/gris), se invierten los colores antes de mandarlo a
// Tesseract, porque reconoce mucho mejor texto oscuro sobre fondo claro.
async function ocrSingleBox(canvas, b) {
    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.width = b.w;
    bubbleCanvas.height = b.h;
    const bctx = bubbleCanvas.getContext('2d');
    if (b.invert) bctx.filter = 'invert(1)';
    bctx.drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);

    try {
        const result = await Tesseract.recognize(bubbleCanvas, 'spa+eng', {
            logger: () => {}
        });
        const text = result.data.text.trim();
        return cleanMangaText(text) || '[Sin texto]';
    } catch (e) {
        return '[Error OCR]';
    }
}

function cleanMangaText(text) {
    if (!text) return '';
    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    lines = lines.filter(line => {
        if (line.length <= 2) {
            const onlyPunct = /^[\d\s\.\,\;\:\!\?\-\(\)\[\]\{\}\|\*\&\%\$\#\@\+\=\<\>\~\`\"\'\/\\]+$/.test(line);
            if (onlyPunct) return false;
        }
        return true;
    });
    let result = lines.join(' ');
    result = result.replace(/\s+/g, ' ').trim();
    result = result.replace(/^[\s\.\,\;\:\!\?]+/, '').replace(/[\s\.\,\;\:\!\?]+$/, '');
    return result;
}

// ==================== DIÁLOGOS ====================
function renderDialogues() {
    els.dialoguesList.innerHTML = '';

    if (bubbles.length === 0) {
        els.dialoguesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No se detectaron burbujas</p>
            </div>`;
        return;
    }

    bubbles.forEach((b) => {
        const div = document.createElement('div');
        div.className = 'dialogue-item';
        div.id = `dialogue-${b.num}`;
        div.innerHTML = `<span class="bubble-num">${b.num}.</span>${b.text || '...'}`;
        div.addEventListener('click', () => readSingleBubble(b.num - 1));
        els.dialoguesList.appendChild(div);
    });
}

// ==================== TTS ====================
async function readAllBubbles() {
    if (isReading) {
        stopReading();
        return;
    }
    if (bubbles.length === 0) return;

    // Workaround para Chrome: asegurar que speechSynthesis esté activo
    if (speechSynthesis.paused) speechSynthesis.resume();

    isReading = true;
    els.readBtn.style.display = 'none';
    els.stopBtn.style.display = 'flex';
    els.detectBtn.disabled = true;

    const selectedVoice = availableVoices[els.voiceSelect.value];
    const rate = parseFloat(els.rateSlider.value);
    const pauseMs = parseFloat(els.pauseSlider.value) * 1000;

    for (let i = 0; i < bubbles.length && isReading; i++) {
        currentReadIndex = i;
        highlightBubble(i);

        const text = bubbles[i].text;
        if (!text || text === '[Sin texto]' || text === '[Error OCR]') {
            await sleep(500);
            continue;
        }

        await speakBubble(text, selectedVoice, rate);
        if (isReading && i < bubbles.length - 1) {
            await sleep(pauseMs);
        }
    }

    if (isReading) stopReading();
}

async function readSingleBubble(index) {
    if (index < 0 || index >= bubbles.length) return;
    stopReading();

    // Workaround para Chrome
    if (speechSynthesis.paused) speechSynthesis.resume();

    const selectedVoice = availableVoices[els.voiceSelect.value];
    const rate = parseFloat(els.rateSlider.value);

    currentReadIndex = index;
    highlightBubble(index);

    const text = bubbles[index].text;
    if (text && text !== '[Sin texto]' && text !== '[Error OCR]') {
        await speakBubble(text, selectedVoice, rate);
    }

    clearHighlights();
}

function speakBubble(text, voice, rate) {
    return new Promise((resolve) => {
        // Workaround Chrome: cancelar cualquier utterance pendiente
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        if (voice) utterance.voice = voice;
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
            resolve();
        };
        utterance.onerror = (e) => {
            console.warn('TTS error:', e.error);
            resolve();
        };

        // Pequeño delay para evitar problemas en Chrome
        setTimeout(() => {
            speechSynthesis.speak(utterance);
        }, 50);
    });
}

function highlightBubble(index) {
    clearHighlights();

    const b = bubbles[index];
    if (!b) return;

    const bubbleEl = document.getElementById(`bubble-${b.num}`);
    const dialogueEl = document.getElementById(`dialogue-${b.num}`);

    if (bubbleEl) bubbleEl.classList.add('active');
    if (dialogueEl) {
        dialogueEl.classList.add('active');
        dialogueEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    for (let i = 0; i < index; i++) {
        const prevBubble = document.getElementById(`bubble-${bubbles[i].num}`);
        const prevDialogue = document.getElementById(`dialogue-${bubbles[i].num}`);
        if (prevBubble) prevBubble.classList.add('read');
        if (prevDialogue) prevDialogue.classList.add('read');
    }
}

function clearHighlights() {
    document.querySelectorAll('.bubble-box, .dialogue-item').forEach(el => {
        el.classList.remove('active', 'read');
    });
}

function stopReading() {
    isReading = false;
    currentReadIndex = -1;
    speechSynthesis.cancel();
    els.readBtn.style.display = 'flex';
    els.stopBtn.style.display = 'none';
    els.detectBtn.disabled = false;
    clearHighlights();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== ESTADO ====================
function showStatus(msg, type) {
    els.statusText.textContent = msg;
    els.statusBar.className = 'status-bar ' + (type || '');

    const icons = {
        loading: 'fa-spinner fa-spin',
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        '': 'fa-info-circle'
    };
    els.statusBar.querySelector('.status-icon').innerHTML = `<i class="fas ${icons[type] || icons['']}"></i>`;
}

// ==================== TECLADO ====================
function handleKeyboard(e) {
    if (els.readerScreen.style.display === 'none') return;

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            changePage(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            changePage(1);
            break;
        case 'd':
        case 'D':
            if (!els.detectBtn.disabled) detectBubbles();
            break;
        case ' ':
        case 'Enter':
            e.preventDefault();
            if (!els.readBtn.disabled) readAllBubbles();
            break;
        case 'Escape':
            stopReading();
            break;
    }
}
