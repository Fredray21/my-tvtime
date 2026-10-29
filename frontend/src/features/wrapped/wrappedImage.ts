import type { WrappedResponse } from '../../api/userApi';

// Format "story" (Instagram, WhatsApp, Snapchat...)
const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 90;
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface WrappedTheme {
    id: string;
    label: string;
    from: string;
    via: string;
    to: string;
    accent: string;
    shape: string;
}

export const WRAPPED_THEMES: WrappedTheme[] = [
    { id: 'violet', label: 'Violet', from: '#7c3aed', via: '#3b0764', to: '#09090b', accent: '#d8b4fe', shape: '#a855f7' },
    { id: 'sunset', label: 'Sunset', from: '#f97316', via: '#9f1239', to: '#1c0a0a', accent: '#fde68a', shape: '#fb7185' },
    { id: 'lime', label: 'Lime', from: '#84cc16', via: '#14532d', to: '#052e16', accent: '#ecfccb', shape: '#bef264' },
    { id: 'ocean', label: 'Océan', from: '#06b6d4', via: '#1e3a8a', to: '#020617', accent: '#a5f3fc', shape: '#38bdf8' },
];

const loadImage = (path: string, size = 'w500'): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
        if (!path) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous'; // image.tmdb.org autorise le CORS : le canvas reste exportable
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // une affiche manquante ne doit pas bloquer la génération
        // URL distincte de celle des <img> de l'app : sans en-tête Origin, TMDB ne renvoie pas de CORS (ni de Vary),
        // et le navigateur réutiliserait cette version en cache, ce qui ferait échouer le chargement dans le canvas
        img.src = `https://image.tmdb.org/t/p/${size}${path}?canvas=1`;
    });

const setFont = (ctx: CanvasRenderingContext2D, weight: number, size: number) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
};

// Tronque un texte avec "…" pour qu'il tienne dans maxWidth
const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return `${truncated.trimEnd()}…`;
};

// Réduit la taille de police jusqu'à ce que le texte tienne sur une ligne
const fitFontSize = (ctx: CanvasRenderingContext2D, text: string, weight: number, maxSize: number, maxWidth: number) => {
    let size = maxSize;
    setFont(ctx, weight, size);
    while (size > 24 && ctx.measureText(text).width > maxWidth) {
        size -= 4;
        setFont(ctx, weight, size);
    }
    return size;
};

// Découpe un texte sur au plus maxLines lignes (la dernière est tronquée si besoin)
const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !current) {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);

    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = fitText(ctx, lines.slice(maxLines - 1).join(' '), maxWidth);
        return kept;
    }
    return lines.map(line => fitText(ctx, line, maxWidth));
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
};

// Dessine une image en mode "cover" (recadrée pour remplir la zone)
const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, radius: number) => {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.save();
    roundedRect(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    ctx.restore();
};

const drawList = (ctx: CanvasRenderingContext2D, theme: WrappedTheme, title: string, items: string[], x: number, y: number, width: number) => {
    setFont(ctx, 700, 30);
    ctx.fillStyle = theme.accent;
    ctx.fillText(title.toUpperCase(), x, y);

    items.slice(0, 5).forEach((item, i) => {
        const lineY = y + 70 + i * 62;
        setFont(ctx, 900, 40);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(String(i + 1), x, lineY);

        setFont(ctx, 700, 38);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(fitText(ctx, item, width - 50), x + 50, lineY);
    });

    if (items.length === 0) {
        setFont(ctx, 500, 34);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('—', x, y + 70);
    }
};

export const generateWrappedImage = async (wrapped: WrappedResponse, theme: WrappedTheme): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas non supporté');

    const topSeries = wrapped.top_series;
    const topMovies = wrapped.highlight_movies;

    // Affiches mises en avant : série n°1, film n°1, puis les suivants en alternance.
    // On en charge plusieurs et on garde les 3 premières qui arrivent, pour qu'une affiche introuvable soit remplacée
    const candidates = [topSeries[0], topMovies[0], topSeries[1], topMovies[1], topSeries[2], topMovies[2]]
        .filter(title => title?.poster_path);
    const [loaded] = await Promise.all([
        Promise.all(candidates.map(title => loadImage(title.poster_path))),
        document.fonts?.ready,
    ]);
    const posters = loaded.filter((img): img is HTMLImageElement => img !== null).slice(0, 3);

    // 1. Fond dégradé
    const gradient = ctx.createLinearGradient(0, 0, WIDTH * 0.4, HEIGHT);
    gradient.addColorStop(0, theme.from);
    gradient.addColorStop(0.45, theme.via);
    gradient.addColorStop(1, theme.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 2. Formes décoratives (cercles flous façon Wrapped)
    ctx.save();
    ctx.filter = 'blur(60px)';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = theme.shape;
    ctx.beginPath();
    ctx.arc(WIDTH - 80, 260, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(60, 1180, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. En-tête
    ctx.textBaseline = 'alphabetic';
    setFont(ctx, 800, 30);
    ctx.fillStyle = theme.accent;
    ctx.fillText('MY TV TIME  ·  WRAPPED', PADDING, PADDING + 30);
    setFont(ctx, 900, 150);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(wrapped.year), PADDING - 6, PADDING + 180);

    // 4. Affiches en éventail
    const posterW = 300;
    const posterH = 450;
    const centerX = WIDTH / 2;
    const postersY = 380;
    const layout = [
        { dx: 0, rotate: 0, scale: 1.12, z: 2 },
        { dx: -250, rotate: -0.12, scale: 0.92, z: 1 },
        { dx: 250, rotate: 0.12, scale: 0.92, z: 1 },
    ];
    const order = posters.map((img, i) => ({ ...layout[i], img })).sort((a, b) => a.z - b.z);

    for (const p of order) {
        const w = posterW * p.scale;
        const h = posterH * p.scale;
        ctx.save();
        ctx.translate(centerX + p.dx, postersY + posterH / 2);
        ctx.rotate(p.rotate);
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 50;
        ctx.shadowOffsetY = 20;
        roundedRect(ctx, -w / 2, -h / 2, w, h, 24);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        drawCover(ctx, p.img, -w / 2, -h / 2, w, h, 24);
        ctx.restore();
    }

    // 5. Top séries / Top films en deux colonnes
    const listsY = 1010;
    const columnWidth = (WIDTH - PADDING * 2 - 60) / 2;
    drawList(ctx, theme, 'Top séries', topSeries.map(s => s.title), PADDING, listsY, columnWidth);
    drawList(ctx, theme, 'Films marquants', topMovies.map(m => m.title), PADDING + columnWidth + 60, listsY, columnWidth);

    // 6. Chiffres clés : heures + genre n°1
    const statsY = 1450;
    const hours = Math.round(wrapped.total_minutes / 60).toLocaleString('fr-FR');
    const topGenre = wrapped.top_genres[0]?.name ?? '—';

    setFont(ctx, 700, 30);
    ctx.fillStyle = theme.accent;
    ctx.fillText('HEURES DE VISIONNAGE', PADDING, statsY);
    ctx.fillText('GENRE N°1', PADDING + columnWidth + 60, statsY);

    ctx.fillStyle = '#ffffff';
    fitFontSize(ctx, hours, 900, 120, columnWidth);
    ctx.fillText(hours, PADDING, statsY + 120);
    // Genre : une ligne en gros si ça tient, sinon deux lignes plus petites (ex: "Science-Fiction & Fantastique")
    setFont(ctx, 900, 72);
    if (ctx.measureText(topGenre).width <= columnWidth) {
        ctx.fillText(topGenre, PADDING + columnWidth + 60, statsY + 100);
    } else {
        setFont(ctx, 900, 52);
        wrapLines(ctx, topGenre, columnWidth, 2).forEach((line, i) => {
            ctx.fillText(line, PADDING + columnWidth + 60, statsY + 75 + i * 60);
        });
    }

    // 7. Ligne de stats + pied de page
    const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;
    const footerStats = [
        plural(wrapped.movies_count, 'film'),
        plural(wrapped.episodes_count, 'épisode'),
        plural(wrapped.series_count, 'série'),
    ].join('  ·  ');

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundedRect(ctx, PADDING, 1660, WIDTH - PADDING * 2, 96, 48);
    ctx.fill();
    setFont(ctx, 700, 36);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, footerStats, WIDTH - PADDING * 2 - 60), WIDTH / 2, 1721);
    ctx.textAlign = 'left';

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("Échec de l'export de l'image"))), 'image/png');
    });
};
