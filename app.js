/* =====================================================================
   MANGA VOICE — lector de manga con biblioteca compartida por GitHub
   Sin OCR / sin lectura por voz: solo biblioteca por carpetas + lector.
   ===================================================================== */

// ===== CONFIG (tu repositorio de GitHub Pages) =====
const GH_OWNER = 'geliazib7-cpu';
const GH_REPO = 'geliazib7-cpu.github.io';
const INDEX_PATH = 'library/index.json';
const TOKEN_KEY = 'mangaVoiceGhToken';
const PROGRESS_KEY = 'mangaVoiceProgress';
const THEME_KEY = 'mangaVoiceTheme';

// ===== ESTADO =====
let libraryIndex = { mangas: [] };
let currentManga = null;
let currentChapter = null;
let currentPageIndex = 0;

// ===== ELEMENTOS =====
const els = {};

document.addEventListener('DOMContentLoaded', () => {
    grabElements();
    loadTheme();
    bindEvents();
    loadLibrary();
});

function grabElements() {
    [
        'themeToggle', 'settingsBtn', 'statusBar', 'statusText',
        'libraryScreen', 'mangaGrid', 'createMangaBtn',
        'mangaScreen', 'mangaFolderTitle', 'backToLibraryFromFolder',
        'chapterFileInput', 'chapterList',
        'readerScreen', 'readerTitle', 'pageInfo', 'backToFolder',
        'mangaViewport', 'mangaImage', 'navPrev', 'navNext',
        'pageSlider', 'pageThumbnails'
    ].forEach(id => { els[id] = document.getElementById(id); });
}

function bindEvents() {
    els.themeToggle.addEventListener('click', toggleTheme);
    els.settingsBtn.addEventListener('click', openSettings);
    els.createMangaBtn.addEventListener('click', createManga);
    els.backToLibraryFromFolder.addEventListener('click', backToLibraryFromFolder);
    els.chapterFileInput.addEventListener('change', onChapterFileChange);
    els.backToFolder.addEventListener('click', backToMangaFolder);
    els.navPrev.addEventListener('click', () => changePage(-1));
    els.navNext.addEventListener('click', () => changePage(1));
    els.pageSlider.addEventListener('input', (e) => showPage(parseInt(e.target.value, 10)));

    document.addEventListener('keydown', (e) => {
        if (els.readerScreen.style.display === 'none') return;
        if (e.key === 'ArrowLeft') changePage(-1);
        if (e.key === 'ArrowRight') changePage(1);
    });

    // Swipe táctil en el visor
    let touchStartX = null;
    els.mangaViewport.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    els.mangaViewport.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 60) changePage(dx > 0 ? -1 : 1);
        touchStartX = null;
    }, { passive: true });
}

// ===== TEMA =====
function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const isLight = saved === 'light';
    document.body.classList.toggle('light-mode', isLight);
    els.themeToggle.innerHTML = `<i class="fas fa-${isLight ? 'sun' : 'moon'}"></i>`;
}
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    els.themeToggle.innerHTML = `<i class="fas fa-${isLight ? 'sun' : 'moon'}"></i>`;
}

// ===== ESTADO VISUAL (barra de estado compartida) =====
function showStatus(text, type) {
    if (!els.statusBar) return;
    els.statusBar.style.display = 'flex';
    els.statusBar.className = 'status-bar' + (type ? ' ' + type : '');
    els.statusText.textContent = text;
}
function hideStatus() {
    if (els.statusBar) els.statusBar.style.display = 'none';
}

// ===== CLAVE DE ACCESO DE GITHUB (guardada solo en este dispositivo) =====
function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
}
function openSettings() {
    const current = getToken();
    const masked = current ? (current.slice(0, 4) + '…' + current.slice(-4)) : '(sin configurar)';
    const val = prompt(
        'Clave de acceso de GitHub actual: ' + masked +
        '\n\nPega aquí tu clave para subir mangas desde este dispositivo.\n' +
        'Escribe BORRAR para quitar la clave guardada.\n' +
        '(Cancela o deja vacío para no cambiar nada)', ''
    );
    if (val === null) return;
    const trimmed = val.trim();
    if (trimmed === '') return;
    if (trimmed.toUpperCase() === 'BORRAR') {
        localStorage.removeItem(TOKEN_KEY);
        showStatus('Clave eliminada de este dispositivo', 'success');
        return;
    }
    localStorage.setItem(TOKEN_KEY, trimmed);
    showStatus('Clave guardada en este dispositivo', 'success');
}
function requireToken() {
    if (getToken()) return true;
    alert('Primero necesitas configurar tu clave de acceso de GitHub.\nToca el ícono de engranaje (⚙️) arriba a la derecha.');
    openSettings();
    return false;
}

// ===== PROGRESO DE LECTURA (propio de este dispositivo, no se sube) =====
function getAllProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch (e) { return {}; }
}
function getProgress(mangaId) {
    return getAllProgress()[mangaId] || null;
}
function saveProgress(mangaId, chapterId, pageIndex) {
    const all = getAllProgress();
    all[mangaId] = { chapterId, pageIndex, updatedAt: Date.now() };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

// ===== BIBLIOTECA: LECTURA (todos los dispositivos, sin clave) =====
async function loadLibrary() {
    showStatus('Cargando biblioteca...', 'loading');
    try {
        const res = await fetch('./' + INDEX_PATH + '?t=' + Date.now(), { cache: 'no-store' });
        libraryIndex = res.ok ? await res.json() : { mangas: [] };
    } catch (e) {
        libraryIndex = { mangas: [] };
    }
    renderLibrary();
    if (libraryIndex.mangas.length) hideStatus();
    else showStatus('Aún no hay mangas. Toca "Nuevo Manga" para crear el primero.', '');
}

function renderLibrary() {
    els.mangaGrid.innerHTML = '';
    libraryIndex.mangas.forEach(m => {
        const progress = getProgress(m.id);
        const total = m.chapters.length;
        const card = document.createElement('div');
        card.className = 'manga-card';
        const coverHtml = m.cover
            ? `<img class="cover" src="./${m.cover}" alt="${escapeHtml(m.name)}" loading="lazy">`
            : `<div class="cover cover-placeholder"><i class="fas fa-book"></i></div>`;
        card.innerHTML = `
            <div class="cover-wrap">
                ${coverHtml}
                ${progress ? '<span class="progress-badge">Continuar</span>' : ''}
            </div>
            <div class="info">
                <div class="title">${escapeHtml(m.name)}</div>
                <div class="pages">${total} capítulo${total === 1 ? '' : 's'}</div>
            </div>`;
        card.addEventListener('click', () => openMangaFolder(m.id));
        els.mangaGrid.appendChild(card);
    });
}

// ===== CREAR MANGA (carpeta) — requiere clave =====
async function createManga() {
    if (!requireToken()) return;
    const name = prompt('Nombre del manga (será el nombre de la carpeta):', '');
    if (!name || !name.trim()) return;
    const id = slugify(name.trim());
    if (libraryIndex.mangas.some(m => m.id === id)) {
        alert('Ya existe un manga con ese nombre.');
        return;
    }
    showStatus('Creando carpeta "' + name.trim() + '"...', 'loading');
    try {
        await updateIndexOnGitHub((idx) => {
            idx.mangas.push({ id, name: name.trim(), cover: '', chapters: [] });
        });
        renderLibrary();
        showStatus('Manga creado ✅', 'success');
    } catch (e) {
        console.error(e);
        showStatus('No se pudo crear: ' + e.message, 'error');
    }
}

// ===== PANTALLA: CARPETA DE UN MANGA (lista de capítulos) =====
function openMangaFolder(mangaId) {
    currentManga = libraryIndex.mangas.find(m => m.id === mangaId);
    if (!currentManga) return;
    els.libraryScreen.style.display = 'none';
    els.mangaScreen.style.display = 'flex';
    els.mangaFolderTitle.textContent = currentManga.name;
    renderChapterList();
}

function backToLibraryFromFolder() {
    els.mangaScreen.style.display = 'none';
    els.libraryScreen.style.display = 'block';
    currentManga = null;
    renderLibrary();
    if (libraryIndex.mangas.length) hideStatus();
}

function renderChapterList() {
    els.chapterList.innerHTML = '';
    if (!currentManga.chapters.length) {
        els.chapterList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>Aún no hay capítulos aquí</p>
                <small>Usa "Importar Capítulo" para agregar el primero</small>
            </div>`;
        return;
    }
    const progress = getProgress(currentManga.id);
    currentManga.chapters.forEach((ch) => {
        const isCurrent = progress && progress.chapterId === ch.id;
        const item = document.createElement('div');
        item.className = 'chapter-item';
        item.innerHTML = `
            <div class="chapter-info">
                <span class="chapter-name">${escapeHtml(ch.name)}</span>
                <span class="chapter-pages">${ch.pages.length} páginas</span>
            </div>
            ${isCurrent ? `<span class="progress-badge">Pág. ${progress.pageIndex + 1}</span>` : '<i class="fas fa-chevron-right chapter-arrow"></i>'}`;
        item.addEventListener('click', () => openChapter(currentManga.id, ch.id));
        els.chapterList.appendChild(item);
    });
}

// ===== IMPORTAR CAPÍTULO (dentro de una carpeta) — requiere clave =====
async function onChapterFileChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!requireToken()) return;
    await importChapter(files);
}

async function importChapter(files) {
    showStatus('Preparando capítulo...', 'loading');
    try {
        let pages = [];
        if (files.length === 1 && /\.(zip|cbz|cbr)$/i.test(files[0].name)) {
            pages = await extractZipToBlobs(files[0]);
        } else {
            pages = files
                .filter(f => f.type.startsWith('image/'))
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                .map(f => ({ name: f.name, blob: f }));
        }
        if (!pages.length) {
            showStatus('No se encontraron imágenes en lo seleccionado', 'error');
            return;
        }

        const chapterNum = currentManga.chapters.length + 1;
        const defaultName = 'Capítulo ' + chapterNum;
        const chapterName = (prompt('Nombre del capítulo:', defaultName) || defaultName).trim() || defaultName;
        const chapterId = slugify(chapterName) + '-' + Date.now().toString(36);

        const pagePaths = [];
        for (let i = 0; i < pages.length; i++) {
            showStatus(`Subiendo página ${i + 1} de ${pages.length}...`, 'loading');
            const ext = (pages[i].name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
            const pagePath = `library/${currentManga.id}/${chapterId}/${String(i + 1).padStart(4, '0')}.${ext}`;
            const buf = await pages[i].blob.arrayBuffer();
            const b64 = arrayBufferToBase64(buf);
            await ghPutFile(pagePath, b64, `Agregar página ${i + 1} de "${chapterName}" (${currentManga.name})`);
            pagePaths.push(pagePath);
        }

        showStatus('Guardando en la biblioteca compartida...', 'loading');
        await updateIndexOnGitHub((idx) => {
            const manga = idx.mangas.find(m => m.id === currentManga.id);
            if (!manga) return;
            manga.chapters.push({ id: chapterId, name: chapterName, pages: pagePaths });
            if (!manga.cover) manga.cover = pagePaths[0];
        });
        currentManga = libraryIndex.mangas.find(m => m.id === currentManga.id);
        renderChapterList();
        showStatus('Capítulo agregado ✅ (puede tardar un minuto en verse en tus otros dispositivos)', 'success');
    } catch (e) {
        console.error(e);
        showStatus('Error al importar: ' + e.message, 'error');
    }
}

async function extractZipToBlobs(file) {
    const zip = new JSZip();
    const content = await zip.loadAsync(file);
    const entries = [];
    content.forEach((path, entry) => {
        if (entry.dir || path.includes('__MACOSX')) return;
        const ext = path.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) {
            entries.push(entry);
        }
    });
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const result = [];
    for (const entry of entries) {
        const blob = await entry.async('blob');
        result.push({ name: entry.name, blob });
    }
    return result;
}

// ===== PANTALLA: LECTOR =====
function openChapter(mangaId, chapterId) {
    currentManga = libraryIndex.mangas.find(m => m.id === mangaId);
    if (!currentManga) return;
    currentChapter = currentManga.chapters.find(c => c.id === chapterId);
    if (!currentChapter || !currentChapter.pages.length) return;

    const progress = getProgress(mangaId);
    currentPageIndex = (progress && progress.chapterId === chapterId)
        ? Math.min(progress.pageIndex, currentChapter.pages.length - 1)
        : 0;

    els.mangaScreen.style.display = 'none';
    els.readerScreen.style.display = 'flex';
    hideStatus();
    els.readerTitle.textContent = currentManga.name + ' · ' + currentChapter.name;
    els.pageSlider.max = currentChapter.pages.length - 1;

    renderThumbnails();
    showPage(currentPageIndex);
}

function backToMangaFolder() {
    els.readerScreen.style.display = 'none';
    els.mangaScreen.style.display = 'flex';
    renderChapterList();
}

function renderThumbnails() {
    els.pageThumbnails.innerHTML = '';
    currentChapter.pages.forEach((src, i) => {
        const img = document.createElement('img');
        img.className = 'page-thumb' + (i === currentPageIndex ? ' active' : '');
        img.src = './' + src;
        img.loading = 'lazy';
        img.alt = 'Página ' + (i + 1);
        img.addEventListener('click', () => showPage(i));
        els.pageThumbnails.appendChild(img);
    });
}

function showPage(index) {
    if (!currentChapter || index < 0 || index >= currentChapter.pages.length) return;
    currentPageIndex = index;
    els.mangaImage.src = './' + currentChapter.pages[index];
    els.pageInfo.textContent = (index + 1) + ' / ' + currentChapter.pages.length;
    els.pageSlider.value = index;
    const thumbs = els.pageThumbnails.querySelectorAll('.page-thumb');
    thumbs.forEach((t, i) => t.classList.toggle('active', i === index));
    if (thumbs[index]) thumbs[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    saveProgress(currentManga.id, currentChapter.id, index);
}

function changePage(delta) {
    const newIndex = currentPageIndex + delta;
    if (newIndex >= 0 && newIndex < currentChapter.pages.length) {
        showPage(newIndex);
        return;
    }
    if (delta > 0 && newIndex >= currentChapter.pages.length) {
        goToNextChapterIfAny();
    }
}

function goToNextChapterIfAny() {
    const idx = currentManga.chapters.findIndex(c => c.id === currentChapter.id);
    if (idx >= 0 && idx < currentManga.chapters.length - 1) {
        if (confirm('Llegaste al final del capítulo. ¿Ir al siguiente?')) {
            openChapter(currentManga.id, currentManga.chapters[idx + 1].id);
        }
    }
}

// ===== GITHUB API (lectura de índice fresco + escritura) =====
function ghHeaders(extra) {
    return Object.assign({
        'Authorization': 'Bearer ' + getToken(),
        'Accept': 'application/vnd.github+json'
    }, extra || {});
}

async function ghGetFile(path) {
    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`, {
        headers: ghHeaders()
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || ('GitHub: ' + res.status));
    }
    return res.json();
}

async function ghPutFile(path, base64Content, message, sha) {
    const body = { message, content: base64Content };
    if (sha) body.sha = sha;
    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`, {
        method: 'PUT',
        headers: ghHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || ('GitHub: ' + res.status));
    }
    return res.json();
}

async function updateIndexOnGitHub(mutator) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const file = await ghGetFile(INDEX_PATH);
            let index = { mangas: [] };
            let sha;
            if (file) {
                index = JSON.parse(b64DecodeUnicode(file.content));
                sha = file.sha;
            }
            mutator(index);
            const content = b64EncodeUnicode(JSON.stringify(index, null, 2));
            await ghPutFile(INDEX_PATH, content, 'Actualizar biblioteca', sha);
            libraryIndex = index;
            return index;
        } catch (e) {
            lastErr = e;
            await sleep(700);
        }
    }
    throw lastErr;
}

// ===== UTILIDADES =====
function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
}
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}
function slugify(str) {
    return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        || ('item-' + Date.now().toString(36));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
