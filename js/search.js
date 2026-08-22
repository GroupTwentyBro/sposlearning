import { CONFIG } from "/js/config.js";

const API_URL = CONFIG.API_URL;

let pages = null;
let fuse = null;

/**
 * If the URL contains a valid ?grade=N parameter (1–4), persist it to the
 * cookie and return it.  Otherwise just return the current cookie value.
 * Call this once on page load before any grade-dependent UI is rendered.
 */
export function applyGradeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('grade');
    if (raw !== null) {
        const num = parseInt(raw, 10);
        if (num >= 1 && num <= 4) {
            setGradeCookie(num);
            return num;
        }
    }
    return getGradeCookie();
}

export function getGradeCookie() {
    const match = document.cookie.match(/(?:^|; )selected_grade=([^;]*)/);
    return match ? parseInt(match[1], 10) : 1;
}

export function setGradeCookie(gradeNum) {
    const val = parseInt(gradeNum, 10) || 1;
    document.cookie = `selected_grade=${val}; path=/; max-age=31536000; SameSite=Lax`;
}

export function getGradeName(gradeNum) {
    const map = { 0: 'All Grades', 1: '1st Grade', 2: '2nd Grade', 3: '3rd Grade', 4: '4th Grade' };
    return map[gradeNum] || '1st Grade';
}

export async function getPages() {
    try {
        const response = await fetch(`${API_URL}/pages`);
        if (!response.ok) throw new Error("Failed to load pages API");

        const data = await response.json();
        pages = data.map(page => ({
            id: page.id,
            title: page.title || '',
            path: page.path || '',
            accessLevel: (page.accessLevel || 'public').toLowerCase().trim(),
            grade: parseInt(page.grade || 0, 10),
            content: page.content ? page.content.toLowerCase() : ''
        }));

        const fuseOptions = {
            includeScore: true,
            threshold: 0.3,
            keys: [
                { name: 'title', weight: 0.7 },
                { name: 'content', weight: 0.2 },
                { name: 'path', weight: 0.1 }
            ]
        };
        fuse = new Fuse(pages, fuseOptions);
    } catch (err) {
        console.error("Failed to fetch pages:", err);
    }
}

export function getFilteredPages(term, userRole = 'user') {
    if (!pages) return [];

    const selectedGrade = getGradeCookie();

    const isMatch = (page) => {
        if (userRole !== 'admin' && page.accessLevel === 'admin') return false;
        return page.grade === 0 || page.grade === selectedGrade;
    };

    if (!term || term.trim() === "") {
        return pages.filter(isMatch);
    }

    if (!fuse) return [];

    const results = fuse.search(term.trim());
    return results
        .map(result => result.item)
        .filter(isMatch);
}