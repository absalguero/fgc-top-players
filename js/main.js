/* js/main.js */

/* --- UTILITIES --- */
const createSafeSlug = (name) => !name ? '' : name.toLowerCase().replace(/[#<>:"/\\|?*().]/g, '').replace(/\s+/g, '-').trim();
const smartGoBack = () => window.history.length > 2 ? history.back() : window.location.href = "/news/";
const debounce = (fn, delay = 180) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), delay); }; };

/* --- TOOLTIP SYSTEM --- */
function ensureGlobalTooltip() {
    let el = document.getElementById('tooltip');
    if (!el) {
        el = document.createElement('div');
        el.id = 'tooltip';
        el.innerHTML = `<div class="tooltip-content"></div><button class="tooltip-close-btn" aria-label="Close"><i class="fas fa-times"></i></button>`;
        // Base styles - specific positioning handled by JS/CSS classes
        el.style.cssText = 'position:fixed; z-index:1200; display:none;';
        document.body.appendChild(el);
        
        const close = el.querySelector('.tooltip-close-btn');
        close.addEventListener('click', (e) => { 
            e.preventDefault(); e.stopPropagation(); 
            el.style.display = 'none'; 
            el.classList.remove('is-active'); 
        });
    } else if (el.parentElement !== document.body) {
        document.body.appendChild(el);
    }
    return el;
}

function initUniversalTooltips() {
    const t = ensureGlobalTooltip();
    if (!t) return;
    
    const contentBox = t.querySelector('.tooltip-content');
    const closeBtn = t.querySelector('.tooltip-close-btn');
    const isTouch = () => navigator.maxTouchPoints > 0 || window.matchMedia('(hover: none)').matches;

    document.querySelectorAll('[data-tooltip]:not(th)').forEach((trigger) => {
        const text = trigger.getAttribute('data-tooltip');
        if (!text) return;

        let timer;
        const show = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                contentBox.textContent = text;
                t.style.display = 'block'; 
                t.classList.add('is-active');

                // Positioning Logic
                if (window.innerWidth < 1024) {
                    // Mobile/Tablet: Center on screen
                    t.style.left = '50%'; 
                    t.style.top = '50%'; 
                    t.style.transform = 'translate(-50%, -50%)';
                    if (closeBtn) closeBtn.style.display = 'block';
                } else {
                    // Desktop: Float above element
                    const r = trigger.getBoundingClientRect();
                    const tr = t.getBoundingClientRect();
                    t.style.left = `${Math.round(r.left + r.width / 2)}px`;
                    t.style.top = `${Math.round(r.top - tr.height - 5)}px`;
                    t.style.transform = 'translateX(-50%)';
                    if (closeBtn) closeBtn.style.display = 'none';
                }
            }, 10);
        };

        const hide = () => { clearTimeout(timer); t.style.display = 'none'; t.classList.remove('is-active'); };

        // Desktop Hover Interactions
        trigger.addEventListener('mouseenter', () => { if (!isTouch()) show(); });
        trigger.addEventListener('mouseleave', () => { if (!isTouch()) hide(); });
        trigger.addEventListener('focus', () => { if (!isTouch()) show(); });
        trigger.addEventListener('blur', () => { if (!isTouch()) hide(); });

        // Click Interaction (Mobile & Desktop)
        trigger.addEventListener('click', (e) => {
            // If clicked specifically on the icon group (info 'i' or magnifying glass) or tooltip icon directly
            if (e.target.closest('.stat-item__icon-group') || e.target.closest('.tooltip-icon')) {
                e.preventDefault();
                e.stopPropagation(); // Prevent bubbling to the Modal script
                show();
            }
        });
    });

    // Global close on outside click
    window.addEventListener('click', (e) => {
        if (t.style.display === 'block' && !t.contains(e.target)) {
            t.style.display = 'none'; 
            t.classList.remove('is-active');
        }
    });
}

function initStatsTableTooltips() {
    const table = document.getElementById('stats-table') || document.getElementById('character-stats-table') || document.querySelector('.comparison-stats-grid');
    if (!table) return;

    const t = ensureGlobalTooltip();
    const contentBox = t.querySelector('.tooltip-content');
    const closeBtn = t.querySelector('.tooltip-close-btn');
    const tgt = table.querySelector('tbody') || table;

    if (tgt.hasAttribute('data-tooltip-initialized')) return;
    tgt.setAttribute('data-tooltip-initialized', 'true');

    let timer;
    const move = (e) => {
        if (!t.classList.contains('is-active')) return;
        const off = 15, tr = t.getBoundingClientRect();
        let x = e.clientX + off, y = e.clientY + off;
        if (x + tr.width > window.innerWidth - off) x = e.clientX - tr.width - off;
        if (y + tr.height > window.innerHeight - off) y = e.clientY - tr.height - off;
        t.style.left = `${x}px`; t.style.top = `${y}px`; t.style.transform = 'none';
    };

    // Desktop only table tooltips
    if (!window.matchMedia('(max-width: 1439px)').matches && navigator.maxTouchPoints === 0) {
        table.addEventListener('mouseover', (e) => {
            const cell = e.target.closest('td[data-key], th[data-tooltip]');
            if (!cell || (cell.tagName === 'TD' && ['rank', 'player'].includes(cell.dataset.key))) return;
            
            clearTimeout(timer);
            timer = setTimeout(() => {
                let text = cell.tagName === 'TH' ? cell.getAttribute('data-tooltip') : 
                           (table.querySelector(`thead th[data-key="${cell.dataset.key}"]`) || 
                            table.querySelector(`thead th[data-sort-key="${cell.dataset.key}"]`))?.getAttribute('data-tooltip');
                
                if (!text) return;
                contentBox.textContent = text;
                if (closeBtn) closeBtn.style.display = 'none';
                t.style.display = 'block'; 
                t.classList.add('is-active'); 
                move(e);
            }, 100);
        });
        table.addEventListener('mouseout', () => { clearTimeout(timer); t.style.display = 'none'; t.classList.remove('is-active'); });
        table.addEventListener('mousemove', move);
    }
}

/* --- NAVIGATION & UI --- */
function initHamburgerMenu() {
    const navToggle = document.querySelector('.nav-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    const overlay = document.getElementById('mobile-nav-overlay');
    
    if (!navToggle || !mobileNav || !overlay) return;
    
    const toggle = (open) => {
        mobileNav.classList.toggle('is-open', open); 
        overlay.classList.toggle('is-visible', open);
        document.body.classList.toggle('mobile-nav-open', open); 
        navToggle.setAttribute('aria-expanded', String(open));
        if (open) setTimeout(() => mobileNav.querySelector('a')?.focus(), 100); 
        else navToggle.focus();
    };

    navToggle.addEventListener('click', (e) => { e.stopPropagation(); toggle(!mobileNav.classList.contains('is-open')); });
    document.getElementById('mobile-nav-close')?.addEventListener('click', (e) => { e.stopPropagation(); toggle(false); });
    overlay.addEventListener('click', () => toggle(false));
    mobileNav.querySelectorAll('a').forEach(l => l.addEventListener('click', () => setTimeout(() => toggle(false), 100)));
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) toggle(false);
    });
}

function initSearchClearButtons() {
    const ids = ['player-search-input', 'search-input', 'character-search-input', 'mobile-search-input', 'sidebar-search-input', 'add-player-search', 'add-character-search'];
    ids.forEach(id => {
        const input = document.getElementById(id);
        const clearId = id + '-clear-btn'; // Assuming standard naming for most
        // Handle specific IDs if they deviate
        const clearBtn = document.getElementById(
            id === 'mobile-search-input' ? 'mobile-search-input-clear-btn' :
            id === 'sidebar-search-input' ? 'sidebar-search-input-clear-btn' :
            id === 'player-search-input' ? 'player-search-clear-btn' :
            clearId
        );

        if (input && clearBtn) {
            const update = () => clearBtn.classList.toggle('visible', input.value.length > 0);
            update();
            input.addEventListener('input', update);
            clearBtn.addEventListener('click', () => {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
            });
        }
    });
}

function initBackToTopButton() {
    const btn = document.getElementById('back-to-top-btn');
    const searchPanel = document.getElementById('site-search-panel');
    if (!btn) return;

    const getScrollers = () => !searchPanel ? [] : [searchPanel, searchPanel.querySelector('.site-search-panel__results'), searchPanel.querySelector('.pagefind-ui__results')].filter(Boolean);
    const showHide = () => btn.classList.toggle('show', window.scrollY > 200 || getScrollers().some(el => el.scrollTop > 200));
    
    window.addEventListener('scroll', showHide, { passive: true });
    if (searchPanel) searchPanel.addEventListener('scroll', showHide, { passive: true, capture: true });
    showHide();

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Also scroll search panel if active
        const active = getScrollers().find(el => el.scrollTop > 0);
        if (active) active.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initSidebarDropdown() {
    document.querySelectorAll('.nav-sidebar .nav-group-header').forEach(h => h.addEventListener('click', () => {
        h.classList.toggle('is-open'); 
        const sm = h.nextElementSibling;
        if (sm?.classList.contains('nav-submenu')) sm.style.maxHeight = sm.style.maxHeight ? null : sm.scrollHeight + 'px';
    }));
    // Open active menu on load
    const active = document.querySelector('.nav-sidebar .nav-item--active');
    if (active) { 
        const sm = active.closest('.nav-submenu'); 
        if (sm) { 
            sm.previousElementSibling?.classList.add('is-open'); 
            sm.style.maxHeight = sm.scrollHeight + 'px'; 
        } 
    }
}

function initFilterToggle() {
    const b = document.getElementById('filter-toggle-btn');
    const c = document.querySelector('.controls-container--archive');
    const p = document.getElementById('filter-panel');
    if (b && c && p) b.addEventListener('click', () => {
        const ex = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(ex)); 
        c.classList.toggle('is-open', ex); 
        p.hidden = !ex;
    });
}

function initExpandableTableRows() {
    const tbody = document.querySelector('#rankings-table tbody');
    if (tbody) tbody.addEventListener('click', (e) => { 
        if (!e.target.closest('a')) e.target.closest('tr')?.classList.toggle('is-expanded'); 
    });
}

function initInactivityRefresh() {
    let t; 
    const reset = () => { clearTimeout(t); t = setTimeout(() => window.location.reload(), 20 * 60 * 1000); };
    ['mousemove', 'keypress', 'scroll', 'touchstart'].forEach(e => document.addEventListener(e, reset, true));
    reset();
}

/* --- INFINITE SCROLL --- */
function initInfiniteScroll() {
    const container = document.querySelector('[data-infinite-scroll-container]');
    const sentinel = document.getElementById('sentinel');
    if (!container || !sentinel) return;

    const seenKeys = new Set();
    const getNodeKey = (n) => {
        if (!(n instanceof HTMLElement)) return null;
        const slug = (n.hasAttribute('data-slug') ? n : n.querySelector('[data-slug]'))?.getAttribute('data-slug');
        return slug ? `slug:${slug}` : (n.dataset.id || n.id ? `id:${n.dataset.id || n.id}` : null);
    };

    const register = () => Array.from(container.children).forEach(c => { const k = getNodeKey(c); if (k) seenKeys.add(k); });
    register(); 
    document.addEventListener('archive:items-appended', register);

    let loading = false;
    const loadMore = async () => {
        const nextLink = document.querySelector('[data-next-page-link]');
        if (loading || !nextLink) return;
        
        loading = true; 
        sentinel.classList.add('is-loading');
        
        try {
            const response = await fetch(nextLink.href);
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const items = doc.querySelectorAll('[data-infinite-scroll-container] > *');
            const newNext = doc.querySelector('[data-next-page-link]');
            
            items.forEach(n => { 
                if (!seenKeys.has(getNodeKey(n))) { 
                    container.appendChild(n); 
                    seenKeys.add(getNodeKey(n)); 
                }
            });

            if (newNext) nextLink.href = newNext.href; 
            else { nextLink.remove(); sentinel.remove(); }
            
            document.dispatchEvent(new CustomEvent('archive:items-appended'));
        } catch (e) { 
            console.error(e); 
        } finally { 
            loading = false; 
            sentinel.classList.remove('is-loading'); 
        }
    };

    window.__tArchive = Object.assign(window.__tArchive || {}, { loadMore });
    new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMore(); }, { rootMargin: '250px' }).observe(sentinel);
}

/* --- ARCHIVE CONTROLS --- */
function initAutosizeArchiveControls() {
    const s = document.getElementById('search-input');
    const els = [document.getElementById('year-filter'), document.getElementById('sort-by')];
    
    const measure = (el, txt) => {
        const c = document.createElement('canvas');
        const st = getComputedStyle(el);
        c.getContext('2d').font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} / ${st.lineHeight} ${st.fontFamily}`;
        return Math.ceil(c.getContext('2d').measureText(txt).width);
    };

    const resize = () => {
        if (s) s.style.width = Math.max(192, measure(s, s.value || s.placeholder || '') + 44) + 'px';
        els.forEach(el => { 
            if (el) el.style.width = Math.max(128, measure(el, el.options[el.selectedIndex]?.text || '') + 56) + 'px'; 
        });
    };

    [s, ...els, window].forEach(el => el?.addEventListener(el === window ? 'resize' : (el === s ? 'input' : 'change'), resize));
    resize();
}

function bindFilterVisibilityPump() {
    const pump = debounce(async () => {
        let vis = 0, tries = 0;
        const grid = document.getElementById('player-card-grid') || document.getElementById('archive-list');
        if (!grid) return;

        const getVis = () => Array.from(grid.children).filter(el => el.offsetParent !== null && el.style.display !== 'none').length;
        
        while ((vis = getVis()) < (Number(document.querySelector('[data-infinite-scroll-container]')?.dataset.pageSize) || 1) && tries++ < 12) {
            if (!document.querySelector('[data-next-page-link]')) break;
            window.__tArchive?.loadMore();
            await new Promise(r => document.addEventListener('archive:items-appended', r, { once: true }));
            window.__tArchive?.reapply?.();
        }
    }, 120);

    ['year-filter', 'rated-only-filter', 'search-input', 'sort-by'].forEach(id => 
        document.getElementById(id)?.addEventListener(id === 'search-input' ? 'input' : 'change', pump));
    document.addEventListener('archive:items-appended', pump);
}

/* --- TOC --- */
function initRankingSystemTOC() {
    const btn = document.querySelector('.toc-toggle-btn');
    const links = document.querySelectorAll('.toc-list a[href^="#"]');
    if (!links.length) return;

    btn?.addEventListener('click', () => btn.setAttribute('aria-expanded', String(btn.getAttribute('aria-expanded') !== 'true')));

    const sections = Array.from(links).map(l => document.getElementById(l.getAttribute('href').slice(1))).filter(Boolean);

    const updateActive = () => {
        const scrollY = window.scrollY;
        const headerOffset = window.innerWidth >= 1280 ? 120 : 150;

        let activeSection = null;
        let minDistance = Infinity;

        // Find section closest to the top of viewport (considering header offset)
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const sectionTop = rect.top + scrollY;
            const distance = Math.abs(scrollY + headerOffset - sectionTop);

            // If this section is above the scroll position + offset, consider it
            if (scrollY + headerOffset >= sectionTop - 50 && distance < minDistance) {
                minDistance = distance;
                activeSection = section;
            }
        });

        // If no section found (near top of page), use first section
        if (!activeSection && sections.length > 0) {
            activeSection = sections[0];
        }

        // Update active link
        links.forEach(l => l.classList.remove('is-active'));
        if (activeSection) {
            const activeLink = document.querySelector(`.toc-list a[href="#${activeSection.id}"]`);
            if (activeLink) activeLink.classList.add('is-active');
        }
    };

    // Update on scroll with throttle
    let scrollTimeout;
    const handleScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateActive, 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateActive(); // Initial call

    links.forEach(l => l.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(l.getAttribute('href').slice(1));
        if (target) {
            if (btn) btn.setAttribute('aria-expanded', 'false');
            window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 768 ? 150 : 110), behavior: 'smooth' });
            history.replaceState(null, '', l.getAttribute('href'));
        }
    }));
}

/* --- INIT --- */
document.addEventListener('click', (e) => {
    if (e.target.matches('.add-to-compare-btn')) {
        e.preventDefault();
        const slug = e.target.dataset.playerSlug;
        const url = new URL(window.location);
        const cur = (url.searchParams.get('players') || '').split(',').filter(Boolean);
        if (!cur.includes(slug)) { 
            cur.push(slug); 
            url.searchParams.set('players', cur.sort().join(',')); 
            window.location.href = url.toString(); 
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initHamburgerMenu();
    initExpandableTableRows();
    initBackToTopButton();
    initSidebarDropdown();
    initFilterToggle();
    initInactivityRefresh();
    initSearchClearButtons();
    initInfiniteScroll();
    initUniversalTooltips();
    initStatsTableTooltips();
    initAutosizeArchiveControls();
    bindFilterVisibilityPump();
    initRankingSystemTOC();
    initExternalLinks();
    setTimeout(() => document.dispatchEvent(new CustomEvent('archive:items-appended')), 0);
});
/* --- EXTERNAL LINKS --- */
function initExternalLinks() {
    const isExternal = (url) => {
        try {
            const link = new URL(url, window.location.href);
            return link.host !== window.location.host;
        } catch {
            return false;
        }
    };

    document.querySelectorAll('a[href]').forEach(link => {
        if (isExternal(link.href) && !link.hasAttribute('target')) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        }
    });
}
