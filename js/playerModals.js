/* js/playerModals.js */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('page-player-profile') || typeof currentPagePlayer === 'undefined') return;

    const els = {
        wrapper: document.querySelector('.page-wrapper'),
        modal: document.getElementById('stat-modal'),
        title: document.getElementById('stat-modal-title'),
        body: document.getElementById('stat-modal-body'),
        closeBtn: document.getElementById('stat-modal-close'),
        items: document.querySelectorAll('.stat-item--clickable')
    };

    if (!els.modal || !els.items.length) return;

    const getFilteredResults = (target) => {
        const r = currentPagePlayer.results_1yr || [];
        const filters = {
            'majors': x => ['S+', 'S'].includes(x.tier),
            'victories': x => x.placement === 1,
            'top3': x => x.placement <= 3,
            'top8': x => x.placement <= 8,
            'top16': x => x.placement <= 16
        };
        return filters[target] ? r.filter(filters[target]) : [];
    };

    const renderResults = (results) => {
        if (!results.length) return '<p class="modal-no-results">No relevant tournaments found in the last 12 months.</p>';
        
        return `<ul class="results-list">${results.map(r => {
            const tierClass = r.tier ? `archive-item-card--${r.tier.toLowerCase().replace('+', '-plus')}` : '';
            const finishClass = r.placement <= 3 ? '' : (r.placement <= 8 ? 'finish-style--top8' : (r.placement <= 16 ? 'finish-style--top16' : ''));
            const date = new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            
            return `
                <li>
                    <a href="/tournaments/${r.slug || '#'}/" class="result-row ${tierClass}">
                        <div class="result-row__finish ${finishClass}">${r.icon || '#' + r.placement}</div>
                        <div class="result-row__details">
                            <span class="result-row__name">${r.tournament}</span>
                            <span class="result-row__meta">${date}</span>
                        </div>
                        <i class="fas fa-chevron-right result-row__icon"></i>
                    </a>
                </li>`;
        }).join('')}</ul>`;
    };

    const toggleModal = (show) => {
        els.modal.style.display = show ? 'flex' : 'none';
        if (!show) els.body.innerHTML = '';
        els.wrapper?.classList.toggle('no-scroll', show);
    };

    const handleItemClick = (e) => {
        // GUARD: If user clicked the info/magnify icon group, let main.js handle the tooltip.
        if (e.target.closest('.stat-item__icon-group')) return;

        e.preventDefault();
        
        const item = e.currentTarget;
        const title = item.querySelector('.stat-item__title-text')?.textContent.trim() || 'Results';
        
        els.title.textContent = title;
        els.body.innerHTML = renderResults(getFilteredResults(item.dataset.modalTarget));
        toggleModal(true);
    };

    // Event Listeners
    els.items.forEach(item => item.addEventListener('click', handleItemClick)); // Bubbling phase (default)
    els.closeBtn?.addEventListener('click', () => toggleModal(false));
    els.modal.addEventListener('click', (e) => { if (e.target === els.modal) toggleModal(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && els.modal.style.display === 'flex') toggleModal(false); });
});