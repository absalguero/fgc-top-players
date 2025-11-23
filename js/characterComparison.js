document.addEventListener('DOMContentLoaded', () => {
  function getHashColor(str) {
    const colors = ['#FF5E13', '#58a6ff', '#3fb950', '#f85149', '#9881b3'];
    if (!str) return colors[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash % colors.length)];
  }

  function getInitials(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => { clearTimeout(timeout); func(...args); };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const getNestedValue = (obj, path) =>
    path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

  function showButtonFeedback(button, feedbackHtml, duration = 2000) {
    if (!button) return;
    const originalHtml = button.innerHTML;
    button.innerHTML = feedbackHtml;
    setTimeout(() => { button.innerHTML = originalHtml; }, duration);
  }

  const formatTrendValue = (value) => {
    if (value === null || value === undefined || value === 'N/A') return 'N/A';
    const num = Number(value);
    if (isNaN(num)) return 'N/A';
    const fixedNum = num.toFixed(2);
    if (num > 0) return `<span><i class="fas fa-arrow-up" style="color:#3fb950;"></i> ${fixedNum}</span>`;
    if (num < 0) return `<span><i class="fas fa-arrow-down" style="color:#f85149;"></i> ${Math.abs(fixedNum)}</span>`;
    return `<span><i class="fas fa-minus" style="color:#aaa;"></i> ${fixedNum}</span>`;
  };
  async function initCharacterComparisonPage() {
    if (!document.body.classList.contains('page-character-comparison')) return;

    const mainContainer = document.getElementById('comparison-container');
    if (!mainContainer) return;

    try {
      const response = await fetch('/api/characters.json');
      if (!response.ok) throw new Error(`Failed to fetch character data: ${response.statusText}`);
      const pageData = await response.json();
      const allCharacters = pageData.allCharacters || [];

      const MAX_CHARACTERS = 5;

      const tierScore = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'N/A': 0 };

      const STAT_DEFINITIONS = [
        { label: "Tier", key: 'Tier', higherIsBetter: true, isTier: true, tooltip: "Character Tier based on overall performance." },
        { label: "CPV", key: 'CPV', higherIsBetter: true, tooltip: "Competitive Performance Viability: The character's overall competitive strength." },
        { label: "Top 3 Rate", key: 'TWE', higherIsBetter: true, tooltip: "Top 3 Rate (T3R): Share of tournaments where the character reaches the top 3." },
        { label: "Average Player FGPI", key: 'FGPI', higherIsBetter: true, tooltip: "The average skill rating (FGPI) of players who use this character." },
        { label: "Performance Floor", key: 'CPF', higherIsBetter: true, tooltip: "Character Performance Floor: Measures competitive consistency. Higher is better." },
        { label: "Momentum Score", key: 'CMS', higherIsBetter: true, isTrend: true, tooltip: "Character Momentum Score: Measures recent performance trend. Positive means improving." },
        { label: "Tournament Specialization", key: 'TS', higherIsBetter: true, isTrend: true, tooltip: "Performance improvement at Major events vs. smaller tournaments." },
        { label: "Top Region", key: 'primaryRDI.region', higherIsBetter: true, tooltip: "The character's strongest performing region (sorted by RDI score)." },
        { label: "Regional Dominance", key: 'primaryRDI.score', higherIsBetter: true, tooltip: "Peak performance score in the character's strongest region." },
        { label: "Tournament Popularity", key: 'TP', higherIsBetter: true, tooltip: "Tournament Popularity: How often this character shows up in rated tournaments. Higher TP means more players are using them." },
      ];
      const dom = {
        placeholder: document.getElementById('comparison-placeholder'),
        addCharacterInput: document.getElementById('add-character-search'),
        autocompleteContainer: document.getElementById('autocomplete-results'),
        persistentBarCharacters: document.getElementById('persistent-bar-characters'),
        characterLimitMessage: document.getElementById('character-limit-message'),
        saveBtn: document.getElementById('save-comparison-btn'),
        shareBtn: document.getElementById('share-comparison-btn'),
        savedList: document.getElementById('saved-comparisons-list'),
        resetBtn: document.getElementById('reset-comparison-btn'),
        modalOverlay: document.getElementById('modal-overlay'),
        saveModal: document.getElementById('save-modal'),
        shareModal: document.getElementById('share-modal'),
        closeSaveModal: document.getElementById('close-save-modal'),
        closeShareModal: document.getElementById('close-share-modal'),
        confirmSaveBtn: document.getElementById('confirm-save-btn'),
        saveNameInput: document.getElementById('save-comparison-name-input'),
        socialMediaText: document.getElementById('social-media-text'),
        copySocialBtn: document.getElementById('copy-social-text-btn'),
        copyLinkBtn: document.getElementById('copy-link-btn'),
        tooltip: document.getElementById('tooltip'),
        popularList: document.getElementById('popular-comparisons-list'),
        popularEmpty: document.getElementById('popular-comparisons-empty'),
      };
      const DEFAULT_SORT_KEY = 'Tier';
      const DEFAULT_SORT_DIR = 'desc';

      const urlParams = new URLSearchParams(window.location.search);
      const comparedCharacterSlugs = (urlParams.get('characters') || '').split(',').filter(Boolean).sort();
      let comparedCharacters = comparedCharacterSlugs.map(slug => allCharacters.find(c => c.slug === slug)).filter(Boolean);

      if (comparedCharacters.length > 0 && typeof CharacterPopularity !== 'undefined') {
        comparedCharacters.forEach(character => {
          CharacterPopularity.trackComparison(character.slug);
        });
      }

      let currentSortKey = DEFAULT_SORT_KEY;
      let currentSortDir = DEFAULT_SORT_DIR;
      const updateHeadContent = () => {
        const canonicalLink = document.getElementById('canonical-url');
        let newTitle = "Street Fighter 6 Character Comparison | FGC Top Players";
        let newDescription = "Compare stats, tier placement, and competitive viability for Street Fighter 6 characters side-by-side.";
        let newUrl = `${window.location.origin}${window.location.pathname}`;

        if (comparedCharacters.length > 0) {
          const charNames = comparedCharacters.map(c => c.name);
          const sortedSlugs = comparedCharacters.map(c => c.slug).sort().join(',');

          if (charNames.length > 1) {
            const nameString = charNames.join(' vs. ');
            newTitle = `${nameString} Stats | SF6 Character Comparison`;
            newDescription = `Side-by-side stats comparison of ${nameString}. Compare CPV, tier placement, momentum, and competitive viability for top SF6 characters.`;
          } else {
            newTitle = `${charNames[0]} Stats & Viability | SF6 Character Comparison`;
            newDescription = `View detailed stats for ${charNames[0]} and compare against other top SF6 characters, including tier placement, momentum, and win efficiency.`;
          }
          newUrl = `${window.location.origin}${window.location.pathname}?characters=${sortedSlugs}`;
        }

        document.title = newTitle;
        document.querySelector('meta[name="description"]').setAttribute('content', newDescription);
        if (canonicalLink) {
          canonicalLink.setAttribute('href', newUrl);
        }
      };

      const updateSchema = () => {
        const oldSchema = document.getElementById('comparison-schema');
        if (oldSchema) oldSchema.remove();

        if (comparedCharacters.length > 0) {
          const schema = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": document.title,
            "description": document.querySelector('meta[name="description"]').getAttribute('content'),
            "mainEntity": comparedCharacters.map(character => ({
              "@type": "Thing",
              "name": character.name,
              "url": `${window.location.origin}/characters/${character.slug}/`
            }))
          };

          const script = document.createElement('script');
          script.id = 'comparison-schema';
          script.type = 'application/ld+json';
          script.textContent = JSON.stringify(schema);
          document.head.appendChild(script);
        }
      };
      const updateCharactersAndReload = (slug, action) => {
        const slugs = new Set(comparedCharacterSlugs);
        if (action === 'add' && slugs.size < MAX_CHARACTERS) {
          slugs.add(slug);
          if (typeof CharacterPopularity !== 'undefined') {
            CharacterPopularity.trackComparison(slug);
          }
        }
        else if (action === 'remove') slugs.delete(slug);
        const newSlugs = Array.from(slugs).sort().join(',');
        window.location.href = newSlugs ? `${window.location.pathname}?characters=${newSlugs}` : window.location.pathname;
      };

      const closeModal = () => {
        if (dom.saveModal) dom.saveModal.style.display = 'none';
        if (dom.shareModal) dom.shareModal.style.display = 'none';
        if (dom.modalOverlay) dom.modalOverlay.style.display = 'none';
      };

      const openModal = (modal) => {
        if (modal) modal.style.display = 'block';
        if (dom.modalOverlay) dom.modalOverlay.style.display = 'block';
      };
      const updatePersistentBar = () => {
        const canAddMore = comparedCharacters.length < MAX_CHARACTERS;
        const defaultPlaceholder = 'Add a Character...';
        dom.addCharacterInput.disabled = !canAddMore;

        if (dom.addCharacterInput) {
          let placeholderText;
          if (!canAddMore) {
            placeholderText = ''; // No placeholder when disabled
          } else if (comparedCharacters.length > 0) {
            placeholderText = 'Add another character...';
          } else {
            placeholderText = defaultPlaceholder;
          }
          dom.addCharacterInput.placeholder = placeholderText;
        }

        dom.characterLimitMessage.style.display = canAddMore ? 'none' : 'block';
        dom.resetBtn.style.display = comparedCharacters.length > 0 ? 'inline-flex' : 'none';

        dom.persistentBarCharacters.innerHTML = '';

        comparedCharacters.forEach((c, index) => {
          const bgColor = getHashColor(c.slug);
          const initials = getInitials(c.name);
          const avatar = document.createElement('div');
          avatar.className = 'persistent-bar__player';
          avatar.dataset.characterSlug = c.slug;

          if (index === 0 && currentSortKey) {
            avatar.classList.add('active-sort-icon');
          }

          const removeButton = `<button class="remove-player-btn--small" data-slug="${c.slug}" aria-label="Remove ${c.name}">&times;</button>`;
          const placeholderHTML = `<div class="persistent-bar__initials-placeholder" style="background-color: ${bgColor}; color: #fff;" title="${c.name}">${initials}</div>`;
          avatar.innerHTML = placeholderHTML + removeButton;
          dom.persistentBarCharacters.appendChild(avatar);
        });
      };

      const buildComparisonGrid = () => {
        if (comparedCharacters.length === 0) {
          if (dom.placeholder) dom.placeholder.style.display = 'block';
          currentSortKey = DEFAULT_SORT_KEY;
          currentSortDir = DEFAULT_SORT_DIR;
          return;
        } else {
          if (dom.placeholder) dom.placeholder.style.display = 'none';
        }

        if (!currentSortKey) {
          currentSortKey = DEFAULT_SORT_KEY;
          currentSortDir = DEFAULT_SORT_DIR;
        }
        comparedCharacters.sort((a, b) => {
          const statDef = STAT_DEFINITIONS.find(s => s.key === currentSortKey);

          let valA = getNestedValue(a, currentSortKey);
          let valB = getNestedValue(b, currentSortKey);
          if (currentSortKey === 'primaryRDI.region') {
            valA = getNestedValue(a, 'primaryRDI.score');
            valB = getNestedValue(b, 'primaryRDI.score');
          }
          if (statDef && statDef.isTier) {
            const aScore = tierScore[valA] ?? 0;
            const bScore = tierScore[valB] ?? 0;
            if (aScore === bScore) return (b.CPV || 0) - (a.CPV || 0);
            return currentSortDir === 'desc' ? bScore - aScore : aScore - bScore;
          }
          if (typeof valA === 'string' && isNaN(parseFloat(valA))) {
            const strA = (valA || '').toString();
            const strB = (valB || '').toString();
            const cmp = strA.localeCompare(strB, undefined, { sensitivity: 'base' });
            return currentSortDir === 'desc' ? -cmp : cmp;
          }
          const isHigherBetter = statDef ? statDef.higherIsBetter : true;
          const getComparableValue = (val) =>
            (val != null && val !== '' && val !== 'N/A') ? parseFloat(val) : (isHigherIsBetter ? -Infinity : Infinity);
          const isHigherIsBetter = isHigherBetter;
          const numA = (valA != null && valA !== '' && valA !== 'N/A') ? parseFloat(valA) : (isHigherIsBetter ? -Infinity : Infinity);
          const numB = (valB != null && valB !== '' && valB !== 'N/A') ? parseFloat(valB) : (isHigherIsBetter ? -Infinity : Infinity);

          if (numA === numB) return (b.CPV || 0) - (a.CPV || 0);
          return currentSortDir === 'desc' ? numB - numA : numA - numB;
        });

        const statDef = STAT_DEFINITIONS.find(s => s.key === currentSortKey);
        const statHeaderContent = (currentSortKey && statDef)
          ? `<div class="sorted-header-content"><span>Sorted by ${statDef.label}</span><button id="clear-sort-btn" class="clear-sort-btn" title="Clear sort">&times;</button></div>`
          : 'Stat';
        let headerHtml = `<tr><th scope="col" class="stat-label-header">${statHeaderContent}</th>`;

        comparedCharacters.forEach((c, index) => {
          const bgColor = getHashColor(c.slug);
          const initials = getInitials(c.name);
          const headerHighlightClass = (index === 0 && currentSortKey) ? ' active-sort-column' : '';
          const tier = (c.Tier || 'N/A').toString();
          const tierKey = tier.toLowerCase().replace('+', '-plus');
          const tierClass = ` tier-${tierKey}`;
          const placeholderHtml = `<div class="player-placeholder-icon" style="background-color: ${bgColor};">${initials}</div>`;

          headerHtml += `
            <th scope="col" class="player-header-cell${headerHighlightClass}${tierClass}">
              <div class="player-header-card">
                <a href="/characters/${c.slug}/" class="player-header-card__link">
                  <div class="player-header-card__photo-wrapper">
                    ${placeholderHtml}
                  </div>
                  <span class="player-header__name player-header__name--truncate">${c.name}</span>
                </a>
              </div>
            </th>`;
        });
        headerHtml += `</tr>`;
        let bodyHtml = '';
        STAT_DEFINITIONS.forEach(stat => {
          const sortClass = (currentSortKey === stat.key) ? `sorted-by ${currentSortDir}` : '';
          const sortIconSvg = `<svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m7 14 5 5 5-5"/></svg>`;

          let rowHtml = `<tr>
            <th scope="row" class="stat-label-cell sortable-stat ${sortClass}" data-sort-key="${stat.key}" data-tooltip="${stat.tooltip || ''}">
              <div class="header-content"><span>${stat.label}</span>${sortIconSvg}</div>
            </th>`;

          const values = comparedCharacters.map(c => {
            if (stat.key === 'primaryRDI.region') {
              const displayRegion = getNestedValue(c, 'primaryRDI.region') ?? 'N/A';
              const scoreForRanking = parseFloat(getNestedValue(c, 'primaryRDI.score'));
              return {
                value: displayRegion,
                numeric: isNaN(scoreForRanking) ? NaN : scoreForRanking
              };
            }

            const raw = getNestedValue(c, stat.key);
            return {
              value: raw,
              numeric: stat.isTier ? (tierScore[raw] ?? 0) : parseFloat(raw)
            };
          });

          const validNumericValues = values.map(v => v.numeric).filter(v => !isNaN(v));
          const sortedValues = [...new Set(validNumericValues)].sort((a, b) => stat.higherIsBetter ? b - a : a - b);

          values.forEach((data, colIndex) => {
            const rank = sortedValues.indexOf(data.numeric);
            const statRankClass = (rank !== -1 && rank < 5 && stat.key !== 'primaryRDI.region') ? `rank-${rank + 1}` : '';
            const cellHighlightClass = (colIndex === 0 && currentSortKey) ? ' sorted-column-highlight' : '';

            let displayValue = (data.value === undefined || data.value === null) ? 'N/A' : data.value;

            if (stat.isTrend) {
              displayValue = formatTrendValue(data.value);
            } else if (typeof data.value === 'number') {
              displayValue = data.value % 1 !== 0 ? data.value.toFixed(2) : data.value;
            } else if (stat.key === 'primaryRDI.score' && displayValue !== 'N/A') {
              const n = Number(displayValue);
              displayValue = isNaN(n) ? displayValue : `${n}%`;
            } else if (stat.key === 'TP' && displayValue !== 'N/A') {
              const n = Number(displayValue);
              displayValue = isNaN(n) ? displayValue : (n % 1 !== 0 ? n.toFixed(2) : n);
            }

            if (stat.isTier) {
              displayValue = (displayValue || 'N/A').toString();
            }

            rowHtml += `<td class="${statRankClass}${cellHighlightClass}">${displayValue}</td>`;
          });

          rowHtml += `</tr>`;
          bodyHtml += rowHtml;
        });

        mainContainer.innerHTML = `
          <div class="table-wrapper">
            <table class="comparison-stats-grid stats-table">
              <thead>${headerHtml}</thead>
              <tbody>${bodyHtml}</tbody>
            </table>
          </div>`;
        if (typeof initStatsTableTooltips === 'function') {
          initStatsTableTooltips();
        }
      };

      const renderSavedComparisons = () => {
        if (!dom.savedList) return;
        const saved = JSON.parse(localStorage.getItem('fgcSavedCharComparisons') || '[]');
        if (saved.length === 0) {
          dom.savedList.innerHTML = '<li>No comparisons saved.</li>';
        } else {
          dom.savedList.innerHTML = saved.map(item => `
            <li>
              <div class="saved-comparison-entry">
                <a href="${item.url}">${item.name}</a>
                <button class="delete-saved-btn" data-url="${item.url}" title="Delete this comparison">&times;</button>
              </div>
            </li>`).join('');
        }
      };

      function computePopularityScore(character) {
        if (!character || !character.slug) return 0;

        const engagementScore = typeof CharacterPopularity !== 'undefined'
          ? CharacterPopularity.getPopularityScore(character.slug)
          : 0;

        if (engagementScore === 0) {
          const cpv = Number(character.CPV) || 0;
          const tp = Number(character.TP) || 0;
          return (cpv * 0.7) + (tp * 0.3);
        }

        const performanceBoost = 1 + (Number(character.CPV) / 100);
        return engagementScore * performanceBoost;
      }

      function pickPopularCharacters(characters, count = 6) {
        const scored = characters.map(c => ({
          character: c,
          score: computePopularityScore(c)
        }));

        scored.sort((a, b) => b.score - a.score);

        const picked = scored.slice(0, Math.min(count, scored.length)).map(s => s.character);
        return picked;
      }

      function renderPopularComparisons(characters) {
        if (!dom.popularList) return;

        dom.popularList.innerHTML = '';
        const picked = pickPopularCharacters(characters, 6);

        if (!picked || picked.length < 2) {
          if (dom.popularEmpty) dom.popularEmpty.style.display = 'block';
          if (dom.popularList.parentElement) dom.popularList.parentElement.style.display = 'none';
          return;
        } else {
          if (dom.popularEmpty) dom.popularEmpty.style.display = 'none';
          if (dom.popularList.parentElement) dom.popularList.parentElement.style.display = 'block';
        }

        if (picked.length % 2 === 1) picked.pop();

        const pairs = [];
        for (let i = 0; i < picked.length; i += 2) {
          if (picked[i] && picked[i + 1]) {
            pairs.push([picked[i], picked[i + 1]]);
          }
        }

        if (pairs.length === 0) {
          if (dom.popularEmpty) dom.popularEmpty.style.display = 'block';
          return;
        }

        const listHtml = pairs.map(([a, b]) => {
          const slugs = [a.slug, b.slug].sort().join(',');
          const href = `${window.location.pathname}?characters=${encodeURIComponent(slugs)}`;
          const tierA = a.Tier ? `(${a.Tier})` : '';
          const tierB = b.Tier ? `(${b.Tier})` : '';

          return `
            <li>
              <a href="${href}">
                <span class="comparison-player">${a.name} ${tierA}</span>
                <span class="comparison-vs">vs</span>
                <span class="comparison-player">${b.name} ${tierB}</span>
              </a>
            </li>`;
        }).join('');

        dom.popularList.innerHTML = listHtml;
      }

      const saveComparisonWithName = (name) => {
        if (comparedCharacters.length === 0 || !dom.saveBtn) return;
        let saved = JSON.parse(localStorage.getItem('fgcSavedCharComparisons') || '[]');
        const url = window.location.href;
        if (saved.some(i => i.url === url)) {
          showButtonFeedback(dom.saveBtn, `<i class="fas fa-check"></i> Already Saved`);
          return;
        }

        const comparisonName = name.trim() || comparedCharacters.map(c => c.name).join(' vs. ');
        saved.unshift({ name: comparisonName, url, date: new Date().toISOString() });
        saved = saved.slice(0, 10);
        localStorage.setItem('fgcSavedCharComparisons', JSON.stringify(saved));

        renderSavedComparisons();
        showButtonFeedback(dom.saveBtn, `<i class="fas fa-check"></i> Saved!`);
      };

      const deleteSavedComparison = (url) => {
        if (!dom.savedList || !url) return;
        let saved = JSON.parse(localStorage.getItem('fgcSavedCharComparisons') || '[]');
        saved = saved.filter(i => i.url !== url);
        localStorage.setItem('fgcSavedCharComparisons', JSON.stringify(saved));
        renderSavedComparisons();
      };
      const setupEventListeners = () => {
mainContainer.addEventListener('click', (e) => {
  const sortableHeader = e.target.closest('.sortable-stat');
  if (sortableHeader) {
    const sortKey = sortableHeader.dataset.sortKey;
    const statDef = STAT_DEFINITIONS.find(s => s.key === sortKey);
    if (!statDef) return;

    if (currentSortKey === sortKey) {
      currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
    } else {
      currentSortKey = sortKey;
      currentSortDir = statDef.higherIsBetter ? 'desc' : 'asc';
    }

    sessionStorage.setItem('charComparisonSortKey', currentSortKey);
    sessionStorage.setItem('charComparisonSortDir', currentSortDir);

    buildComparisonGrid();
    updatePersistentBar();
  }

  if (e.target.closest('#clear-sort-btn')) {
    sessionStorage.removeItem('charComparisonSortKey');
    sessionStorage.removeItem('charComparisonSortDir');
    window.location.reload();
  }
});
        document.body.addEventListener('click', (e) => {
          const removeBtn = e.target.closest('.remove-player-btn--small');
          if (removeBtn) updateCharactersAndReload(removeBtn.dataset.slug, 'remove');

          const deleteBtn = e.target.closest('.delete-saved-btn');
          if (deleteBtn) deleteSavedComparison(deleteBtn.dataset.url);
        });
        if (dom.addCharacterInput) {
          const clearSearchBtn = document.getElementById('add-character-search-clear-btn');

          // Update clear button visibility
          const updateClearButtonVisibility = () => {
            if (clearSearchBtn) {
              clearSearchBtn.style.display = (dom.addCharacterInput.value.length > 0) ? 'flex' : 'none';
            }
          };

          dom.addCharacterInput.addEventListener('input', debounce(() => {
            const query = dom.addCharacterInput.value.toLowerCase();
            updateClearButtonVisibility();

            dom.autocompleteContainer.innerHTML = '';
            if (query.length < 2) { dom.autocompleteContainer.style.display = 'none'; return; }

            const results = allCharacters
              .filter(c => c.name.toLowerCase().includes(query) && !comparedCharacterSlugs.includes(c.slug))
              .slice(0, 15);

            if (results.length > 0) {
              results.forEach(c => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = c.name;
                item.addEventListener('click', () => {
                  if (typeof CharacterPopularity !== 'undefined') {
                    CharacterPopularity.trackSearch(c.slug);
                  }
                  updateCharactersAndReload(c.slug, 'add');
                });
                dom.autocompleteContainer.appendChild(item);
              });
              dom.autocompleteContainer.style.display = 'block';
            } else {
              dom.autocompleteContainer.style.display = 'none';
            }
          }, 300));

          // Clear button click handler
          if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
              dom.addCharacterInput.value = '';
              dom.autocompleteContainer.style.display = 'none';
              updateClearButtonVisibility();
              dom.addCharacterInput.focus();
            });
          }

          // Initial state
          updateClearButtonVisibility();
        }
        if (dom.placeholder) {
          dom.placeholder.addEventListener('click', (e) => {
            const button = e.target.closest('button[id^="preset-"]');
            if (!button) return;

            const presetSorters = {
              'preset-top-5-cpv': (a, b) => (b.CPV || 0) - (a.CPV || 0),
              'preset-top-5-cms': (a, b) => (b.CMS ?? -Infinity) - (a.CMS ?? -Infinity),
              'preset-random-5': () => 0.5 - Math.random()
            };

            const sorter = presetSorters[button.id];
            if (sorter) {
              const slugs = [...allCharacters].sort(sorter).slice(0, 5).map(c => c.slug).join(',');
              if (slugs) window.location.href = `${window.location.pathname}?characters=${slugs}`;
            }
          });
        }
        if (dom.resetBtn) dom.resetBtn.addEventListener('click', () => window.location.href = window.location.pathname);
        if (dom.saveBtn) dom.saveBtn.addEventListener('click', () => {
          if (comparedCharacters.length > 0) {
            dom.saveNameInput.value = comparedCharacters.map(c => c.name).join(' vs. ');
            openModal(dom.saveModal);
            dom.saveNameInput.focus();
          }
        });
        if (dom.confirmSaveBtn) dom.confirmSaveBtn.addEventListener('click', () => {
          saveComparisonWithName(dom.saveNameInput.value);
          closeModal();
        });
        if (dom.shareBtn) dom.shareBtn.addEventListener('click', () => {
          if (comparedCharacters.length === 0) return;
          const charNames = comparedCharacters.length > 2
            ? `${comparedCharacters.slice(0, -1).map(c => c.name).join(', ')}, and ${comparedCharacters.slice(-1)[0].name}`
            : comparedCharacters.map(c => c.name).join(' vs. ');

          dom.socialMediaText.value = `I just compared ${charNames} on FGC Top Players! See the full breakdown of their performance metrics here: ${window.location.href}`;
          openModal(dom.shareModal);
        });
        if (dom.copySocialBtn) dom.copySocialBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(dom.socialMediaText.value).then(() => showButtonFeedback(dom.copySocialBtn, 'Copied!'));
        });
        if (dom.copyLinkBtn) dom.copyLinkBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(window.location.href).then(() => showButtonFeedback(dom.copyLinkBtn, 'Copied!'));
        });
        if (dom.modalOverlay) dom.modalOverlay.addEventListener('click', closeModal);
        if (dom.closeSaveModal) dom.closeSaveModal.addEventListener('click', closeModal);
        if (dom.closeShareModal) dom.closeShareModal.addEventListener('click', closeModal);
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
      };
      buildComparisonGrid();
      updatePersistentBar();
      renderSavedComparisons();
      renderPopularComparisons(allCharacters);
      setupEventListeners();
      updateHeadContent();
      updateSchema();

    } catch (error) {
      console.error("Error initializing character comparison page:", error);
      const mainContainer = document.getElementById('comparison-container');
      if (mainContainer) {
        mainContainer.innerHTML = `
          <div class="error-message">
            <h2>Error loading character data.</h2>
            <p>Please try refreshing the page or check that /api/characters.json exists.</p>
          </div>`;
      }
    }
  }

  initCharacterComparisonPage();
});