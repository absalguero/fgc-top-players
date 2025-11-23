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
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const getNestedValue = (obj, path) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

  function showButtonFeedback(button, feedbackHtml, duration = 2000) {
    if (!button) return;
    const originalHtml = button.innerHTML;
    button.innerHTML = feedbackHtml;
    setTimeout(() => {
      button.innerHTML = originalHtml;
    }, duration);
  }

  async function initPlayerComparisonPage() {
    if (!document.body.classList.contains('page-player-comparison')) return;

    const mainContainer = document.getElementById('comparison-container');
    if (!mainContainer) return;

    try {
      const response = await fetch('/api/players.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch player data: ${response.statusText}`);
      }

      const pageData = await response.json();
      const allPlayers = pageData.allPlayers || [];

      const MAX_PLAYERS = 5;
      const REVERSED_ARROW_STATS = ['rank', 'stats.PR', 'stats.AF12', 'stats.AF6', 'stats.AFM12', 'stats.AFM6'];

      const STAT_DEFINITIONS = [
        { label: "Rank", key: 'rank', higherIsBetter: false, tooltip: "The player's current official ranking." },
        { label: "FGPI", key: 'stats.FGPI', higherIsBetter: true, tooltip: "FGC Player Index: A measure of a player's overall skill and performance." },
        { label: "Peak Rank", key: 'stats.PR', higherIsBetter: false, tooltip: "The highest rank this player has ever achieved." },
        { label: "Weeks in Top 40", key: 'stats.TR', higherIsBetter: true, tooltip: "Total number of weeks the player has been ranked in the Top 40." },
        { label: "Momentum Score", key: 'stats.MS', higherIsBetter: true, tooltip: "A score indicating the player's recent performance trend. Positive is good." },
        { label: "Tournament Difficulty", key: 'stats.TDR', higherIsBetter: true, tooltip: "The average difficulty of tournaments the player has attended." },
        { label: "Performance Floor", key: 'stats.PF', higherIsBetter: true, tooltip: "Measures a player's consistency and worst expected performance. Higher is better." },
        { label: "Avg. Placement %", key: 'stats.APP', higherIsBetter: true, tooltip: "The player's average finishing position as a percentage. Higher is better (e.g., 99% means they often finish 1st)." },
        { label: "Avg. Placement % (Majors)", key: 'stats.APM', higherIsBetter: true, tooltip: "Average placement percentage in Major tournaments only." },
        { label: "Avg. Finish (12 mo.)", key: 'stats.AF12', higherIsBetter: false, tooltip: "Average final placement number over the last 12 months. Lower is better." },
        { label: "Avg. Finish (6 mo.)", key: 'stats.AF6', higherIsBetter: false, tooltip: "Average final placement number over the last 6 months. Lower is better." },
        { label: "Avg. Finish Majors (12 mo.)", key: 'stats.AFM12', higherIsBetter: false, tooltip: "Average final placement in Major tournaments over the last 12 months. Lower is better." },
        { label: "Avg. Finish Majors (6 mo.)", key: 'stats.AFM6', higherIsBetter: false, tooltip: "Average final placement in Major tournaments over the last 6 months. Lower is better." },
        { label: "Victories (12 mo.)", key: 'stats.V', higherIsBetter: true, tooltip: "Total 1st place victories in the last 12 months." },
        { label: "Top 3 (12 mo.)", key: 'stats.T3', higherIsBetter: true, tooltip: "Total Top 3 finishes in the last 12 months." },
        { label: "Top 8 (12 mo.)", key: 'stats.T8', higherIsBetter: true, tooltip: "Total Top 8 finishes in the last 12 months." },
        { label: "Top 16 (12 mo.)", key: 'stats.T16', higherIsBetter: true, tooltip: "Total Top 16 finishes in the last 12 months." }
      ];

      const dom = {
        placeholder: document.getElementById('comparison-placeholder'),
        addPlayerInput: document.getElementById('add-player-search'),
        autocompleteContainer: document.getElementById('autocomplete-results'),
        persistentBarPlayers: document.getElementById('persistent-bar-players'),
        playerLimitMessage: document.getElementById('player-limit-message'),
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
      const defaultAddPlayerPlaceholder = dom.addPlayerInput?.getAttribute('placeholder') || 'Add a Player...';

      const DEFAULT_SORT_KEY = 'rank';
      const DEFAULT_SORT_DIR = 'asc';

      const urlParams = new URLSearchParams(window.location.search);
      const comparedPlayerSlugs = (urlParams.get('players') || '').split(',').filter(Boolean).sort();
      let comparedPlayers = comparedPlayerSlugs.map(slug => allPlayers.find(p => p.slug === slug)).filter(Boolean);

      // D. Track URL-loaded comparisons
      if (comparedPlayers.length > 0 && typeof PlayerPopularity !== 'undefined') {
        comparedPlayers.forEach(player => {
          PlayerPopularity.trackComparison(player.slug);
        });
      }

      let currentSortKey = DEFAULT_SORT_KEY;
      let currentSortDir = DEFAULT_SORT_DIR;

      const updateSortedHeaderWrapState = () => {
        requestAnimationFrame(() => {
          document.querySelectorAll('.sorted-header-content').forEach(container => {
            const button = container.querySelector('.clear-sort-btn');
            if (!button) return;
            const isWrapped = (button.offsetTop - container.offsetTop) > 4;
            container.classList.toggle('is-wrapped', isWrapped);
          });
        });
      };

      const debouncedHeaderWrapUpdate = debounce(updateSortedHeaderWrapState, 120);
      window.addEventListener('resize', debouncedHeaderWrapUpdate);

      const updateHeadContent = () => {
        const canonicalLink = document.getElementById('canonical-url');
        let newTitle = "Street Fighter 6 Player Comparison | FGC Top Players";
        let newDescription = "Compare stats, tournament performance, and rankings for top FGC players side-by-side.";
        let newUrl = `${window.location.origin}${window.location.pathname}`;

        if (comparedPlayers.length > 0) {
          const playerNames = comparedPlayers.map(p => p.name);
          const sortedSlugs = comparedPlayers.map(p => p.slug).sort().join(',');

          if (playerNames.length > 1) {
            const nameString = playerNames.join(' vs. ');
            newTitle = `${nameString} | Street Fighter 6 Player Comparison`;
            newDescription = `Side-by-side stats comparison of ${nameString}. Compare rankings, FGPI, tournament wins, and performance metrics for top SF6 players.`;
          } else {
            newTitle = `${playerNames[0]} Stats & Comparison | Street Fighter 6`;
            newDescription = `View detailed stats for ${playerNames[0]} and compare them against other top SF6 players.`;
          }
          newUrl = `${window.location.origin}${window.location.pathname}?players=${sortedSlugs}`;
        }

        document.title = newTitle;
        const md = document.querySelector('meta[name="description"]');
        if (md) md.setAttribute('content', newDescription);
        if (canonicalLink) {
          canonicalLink.setAttribute('href', newUrl);
        }
      };

      const updateSchema = () => {
        const oldSchema = document.getElementById('comparison-schema');
        if (oldSchema) oldSchema.remove();

        if (comparedPlayers.length > 0) {
          const schema = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": document.title,
            "mainEntity": comparedPlayers.map(player => ({
              "@type": "Person",
              "name": player.name,
              "url": `${window.location.origin}/players/${player.slug}/`,
              "image": player.photoUrl || ''
            }))
          };

          const script = document.createElement('script');
          script.id = 'comparison-schema';
          script.type = 'application/ld+json';
          script.textContent = JSON.stringify(schema);
          document.head.appendChild(script);
        }
      };

      // B. Update updatePlayersAndReload to track comparisons
      const updatePlayersAndReload = (slug, action) => {
        const slugs = new Set(comparedPlayerSlugs);
        if (action === 'add' && slugs.size < MAX_PLAYERS) {
          slugs.add(slug);
          if (typeof PlayerPopularity !== 'undefined') {
            PlayerPopularity.trackComparison(slug);
          }
        } else if (action === 'remove') {
          slugs.delete(slug);
        }
        const newSlugs = Array.from(slugs).sort().join(',');
        window.location.href = newSlugs ? `${window.location.pathname}?players=${newSlugs}` : window.location.pathname;
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
        const bar = document.getElementById('persistent-comparison-bar');
        if (comparedPlayers.length === 0) bar.classList.add('no-players');
        else bar.classList.remove('no-players');

        const canAddMore = comparedPlayers.length < MAX_PLAYERS;
        dom.addPlayerInput.disabled = !canAddMore;
        if (dom.addPlayerInput) {
          let placeholderText;
          if (!canAddMore) {
            placeholderText = ''; // No placeholder when disabled
          } else if (comparedPlayers.length > 0) {
            placeholderText = 'Add another player...';
          } else {
            placeholderText = defaultAddPlayerPlaceholder;
          }
          dom.addPlayerInput.placeholder = placeholderText;
        }
        dom.playerLimitMessage.style.display = canAddMore ? 'none' : 'block';
        dom.resetBtn.style.display = comparedPlayers.length > 0 ? 'inline-flex' : 'none';

        dom.persistentBarPlayers.innerHTML = '';

        comparedPlayers.forEach((p, index) => {
          const hasPhoto = p.photoUrl && typeof p.photoUrl === 'string' && p.photoUrl.trim() !== '';
          const bgColor = getHashColor(p.slug);
          const initials = getInitials(p.name);

          const avatar = document.createElement('div');
          avatar.className = 'persistent-bar__player';
          avatar.dataset.playerSlug = p.slug;

          if (index === 0) avatar.classList.add('active-sort-icon');

          const removeButton = `<button class="remove-player-btn--small" data-slug="${p.slug}" aria-label="Remove ${p.name}">&times;</button>`;

          let imageOrPlaceholderHTML;
          const placeholderHTML = `<div class="persistent-bar__initials-placeholder" style="background-color: ${bgColor}; color: #fff;" title="${p.name}">${initials}</div>`;

          if (hasPhoto) {
            imageOrPlaceholderHTML = `<img src="${p.photoUrl}" alt="${p.name}" onerror='this.outerHTML = ${JSON.stringify(placeholderHTML)};'>`;
          } else {
            imageOrPlaceholderHTML = placeholderHTML;
          }

          avatar.innerHTML = imageOrPlaceholderHTML + removeButton;
          dom.persistentBarPlayers.appendChild(avatar);
        });
      };

      const buildComparisonGrid = () => {
        if (comparedPlayers.length === 0) {
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

        comparedPlayers.sort((a, b) => {
          const statDef = STAT_DEFINITIONS.find(s => s.key === currentSortKey);
          const isHigherBetter = statDef ? statDef.higherIsBetter : true;
          const getComparableValue = (val) => (val != null && val !== '' && val !== 'N/A') ? parseFloat(val) : (isHigherBetter ? -Infinity : Infinity);

          const valA = getComparableValue(getNestedValue(a, currentSortKey));
          const valB = getComparableValue(getNestedValue(b, currentSortKey));

          if (valA === valB) return (a.rank || Infinity) - (b.rank || Infinity);
          return currentSortDir === 'desc' ? valB - valA : valA - valB;
        });

        const statDef = STAT_DEFINITIONS.find(s => s.key === currentSortKey);
        const statHeaderContent = (currentSortKey && statDef)
          ? `<div class="sorted-header-content"><span>Sorted by ${statDef.label}</span><button id="clear-sort-btn" class="clear-sort-btn" title="Clear sort">&times;</button></div>`
          : 'Stat';

        let headerHtml = `<tr><th scope="col" class="stat-label-header">${statHeaderContent}</th>`;

        comparedPlayers.forEach((p, index) => {
          const hasPhoto = p.photoUrl && typeof p.photoUrl === 'string' && p.photoUrl.trim() !== '';
          const bgColor = getHashColor(p.slug);
          const initials = getInitials(p.name);
          const headerHighlightClass = (index === 0 && currentSortKey) ? ' active-sort-column' : '';

          let rankClass = '';
          if (p.rank && p.rank <= 20) {
            rankClass = p.rank <= 5 ? ` rank-highlight rank-${p.rank}` : ' rank-highlight rank-top-20';
          }

          let imageHtml;
          const placeholderHtml = `<div class="player-placeholder-icon" style="background-color: ${bgColor};">${initials}</div>`;
          if (hasPhoto) {
            imageHtml = `<img src="${p.photoUrl}" alt="${p.name}" class="player-header__photo" onerror='this.outerHTML = ${JSON.stringify(placeholderHtml)};'>`;
          } else {
            imageHtml = placeholderHtml;
          }

          const displayName = p.englishName ? `${p.name} (${p.englishName})` : p.name;

          headerHtml += `
            <th scope="col" class="player-header-cell${headerHighlightClass}${rankClass}">
              <div class="player-header-card">
                <a href="/players/${p.slug}/" class="player-header-card__link">
                  <div class="player-header-card__photo-wrapper">${imageHtml}</div>
                  <span class="player-header__name player-header__name--truncate">${displayName}</span>
                </a>
              </div>
            </th>`;
        });
        headerHtml += `</tr>`;

        let bodyHtml = '';
        STAT_DEFINITIONS.forEach(stat => {
          const sortClass = (currentSortKey === stat.key) ? `sorted-by ${currentSortDir}` : '';
          const arrowLogicClass = REVERSED_ARROW_STATS.includes(stat.key) ? 'reverse-arrow' : '';
          const sortIconSvg = `<svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m7 14 5 5 5-5"/></svg>`;

          const values = comparedPlayers.map(p => ({
            value: getNestedValue(p, stat.key) ?? 'N/A',
            numeric: parseFloat(getNestedValue(p, stat.key))
          }));
          const validNumericValues = values.map(v => v.numeric).filter(v => !isNaN(v));
          const sortedValues = [...new Set(validNumericValues)].sort((a, b) => stat.higherIsBetter ? b - a : a - b);

          let firstCellRankClass = '';
          let firstCellHighlightClass = '';
          const cellsHtml = values.map((data, colIndex) => {
            const rank = sortedValues.indexOf(data.numeric);
            const statRankClass = (rank !== -1 && rank < 5) ? `rank-${rank + 1}` : '';
            const cellHighlightClass = (colIndex === 0 && currentSortKey) ? 'sorted-column-highlight' : '';
            if (colIndex === 0) {
              firstCellRankClass = statRankClass;
              firstCellHighlightClass = cellHighlightClass;
            }
            const combinedClass = [statRankClass, cellHighlightClass].filter(Boolean).join(' ');
            const classAttr = combinedClass ? ` class="${combinedClass}"` : '';
            return `<td${classAttr} data-key="${stat.key.split('.').pop().toLowerCase()}">${data.value}</td>`;
          }).join('');

          const labelClasses = ['stat-label-cell', 'sortable-stat', sortClass, arrowLogicClass, firstCellRankClass, firstCellHighlightClass].filter(Boolean).join(' ');
          bodyHtml += `<tr><th scope="row" class="${labelClasses}" data-sort-key="${stat.key}" data-tooltip="${stat.tooltip || ''}"><div class="header-content"><span>${stat.label}</span>${sortIconSvg}</div></th>${cellsHtml}</tr>`;
        });

        mainContainer.innerHTML = `<div class="table-wrapper"><table class="comparison-stats-grid stats-table"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`;
        if (typeof initStatsTableTooltips === 'function') {
          initStatsTableTooltips();
        }
        updateSortedHeaderWrapState();
      };

      const renderSavedComparisons = () => {
        if (!dom.savedList) return;
        const saved = JSON.parse(localStorage.getItem('fgcSavedComparisons') || '[]');
        if (saved.length === 0) {
          dom.savedList.innerHTML = '<li>No comparisons saved.</li>';
        } else {
          dom.savedList.innerHTML = saved.map(item => `
            <li>
              <span class="saved-comparison-entry">
                <a href="${item.url}">${item.name}</a>
                <button class="delete-saved-btn" data-url="${item.url}" title="Delete this comparison">&times;</button>
              </span>
            </li>`).join('');
        }
      };

      // ---------- Dynamic Popular Comparisons ----------

      // A. Replace computePopularityScore to use engagement (PlayerPopularity) with performance fallback
      function computePopularityScore(player) {
        if (!player || !player.slug) return 0;

        const engagementScore = typeof PlayerPopularity !== 'undefined'
          ? PlayerPopularity.getPopularityScore(player.slug)
          : 0;

        if (engagementScore === 0) {
          const rank = Number(player.rank) || 9999;
          if (rank > 40) return 0;

          const rankScore = Math.max(0, (41 - rank) * 10);
          const fgpi = Number(getNestedValue(player, 'stats.FGPI')) || 0;
          const victories = Number(getNestedValue(player, 'stats.V')) || 0;

          return (rankScore * 0.5) + (fgpi * 0.3) + (victories * 2);
        }

        const rank = Number(player.rank) || 9999;
        const performanceBoost = rank <= 40 ? (1 + (41 - rank) / 100) : 1;

        return engagementScore * performanceBoost;
      }

      function pickPopularPlayers(players, count = 6) {
        const top40Qualified = players.filter(p =>
          typeof p.rank === 'number' &&
          p.rank > 0 &&
          p.rank <= 40 &&
          p.isQualified === true
        );

        if (top40Qualified.length < 2) {
          console.warn('Not enough qualified Top 40 players for popular comparisons');
          return [];
        }

        const hasNativePopularity = top40Qualified.some(p =>
          typeof p.popularity === 'number' || typeof p.popularityScore === 'number'
        );

        const scored = top40Qualified.map(p => ({
          player: p,
          score: hasNativePopularity
            ? (p.popularity ?? p.popularityScore ?? 0)
            : computePopularityScore(p)
        }));

        scored.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const ra = a.player.rank || 9999;
          const rb = b.player.rank || 9999;
          if (ra !== rb) return ra - rb;
          const fa = Number(getNestedValue(a.player, 'stats.FGPI')) || 0;
          const fb = Number(getNestedValue(b.player, 'stats.FGPI')) || 0;
          return fb - fa;
        });

        const picked = scored.slice(0, Math.min(count, scored.length)).map(s => s.player);
        return picked;
      }

      function renderPopularComparisons(players) {
        if (!dom.popularList) {
          console.warn('Popular comparisons list element not found');
          return;
        }

        dom.popularList.innerHTML = '';
        const picked = pickPopularPlayers(players, 6);

        if (!picked || picked.length < 2) {
          console.log('Not enough players for popular comparisons');
          if (dom.popularEmpty) dom.popularEmpty.style.display = 'block';
          if (dom.popularList.parentElement) {
            dom.popularList.parentElement.style.display = 'none';
          }
          return;
        } else {
          if (dom.popularEmpty) dom.popularEmpty.style.display = 'none';
          if (dom.popularList.parentElement) {
            dom.popularList.parentElement.style.display = 'block';
          }
        }

        if (picked.length % 2 === 1) picked.pop();

        const pairs = [];
        const halfPoint = Math.floor(picked.length / 2);

        for (let i = 0; i < Math.min(3, halfPoint); i++) {
          const a = picked[i];
          const b = picked[i + halfPoint];
          if (a && b) pairs.push([a, b]);
        }

        if (pairs.length === 0 && picked.length >= 2) {
          for (let i = 0; i < Math.min(6, picked.length); i += 2) {
            const a = picked[i];
            const b = picked[i + 1];
            if (a && b) pairs.push([a, b]);
          }
        }

        if (pairs.length === 0) {
          console.log('Could not create any pairs from picked players');
          if (dom.popularEmpty) dom.popularEmpty.style.display = 'block';
          return;
        }

        const listHtml = pairs.map(([a, b]) => {
          const slugs = [a.slug, b.slug].sort().join(',');
          const href = `${window.location.pathname}?players=${encodeURIComponent(slugs)}`;

          const rankA = a.rank ? `#${a.rank}` : '';
          const rankB = b.rank ? `#${b.rank}` : '';

          return `
      <li>
        <a href="${href}">
          <span class="comparison-player">${a.name} ${rankA}</span>
          <span class="comparison-vs">vs</span>
          <span class="comparison-player">${b.name} ${rankB}</span>
        </a>
      </li>`;
        }).join('');

        dom.popularList.innerHTML = listHtml;

        console.log(`Rendered ${pairs.length} popular comparison pairs`);
      }

      // ---------- /Dynamic Popular Comparisons ----------

      const saveComparisonWithName = (name) => {
        if (comparedPlayers.length === 0 || !dom.saveBtn) return;
        let saved = JSON.parse(localStorage.getItem('fgcSavedComparisons') || '[]');
        const url = window.location.href;
        if (saved.some(i => i.url === url)) {
          showButtonFeedback(dom.saveBtn, `<i class="fas fa-check"></i> Already Saved!`);
          return;
        }

        const comparisonName = (name || '').trim() || comparedPlayers.map(p => p.name).join(' vs. ');
        saved.unshift({ name: comparisonName, url, date: new Date().toISOString() });
        saved = saved.slice(0, 10);
        localStorage.setItem('fgcSavedComparisons', JSON.stringify(saved));

        renderSavedComparisons();
        showButtonFeedback(dom.saveBtn, `<i class="fas fa-check"></i> Saved!`);

        const savedContainer = document.getElementById('saved-comparisons-container');
        if (savedContainer) {
          savedContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
          savedContainer.style.transition = 'background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out';
          savedContainer.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.1)';
          savedContainer.style.boxShadow = `0 0 15px 5px rgba(var(--color-primary-rgb), 0.1)`;
          setTimeout(() => {
            savedContainer.style.backgroundColor = 'transparent';
            savedContainer.style.boxShadow = 'none';
          }, 2500);
        }
      };

      const deleteSavedComparison = (url) => {
        if (!dom.savedList || !url) return;
        let saved = JSON.parse(localStorage.getItem('fgcSavedComparisons') || '[]');
        saved = saved.filter(i => i.url !== url);
        localStorage.setItem('fgcSavedComparisons', JSON.stringify(saved));
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
            sessionStorage.setItem('comparisonSortKey', currentSortKey);
            sessionStorage.setItem('comparisonSortDir', currentSortDir);

            buildComparisonGrid();
            updatePersistentBar();
            return;
          }

          if (e.target.closest('#clear-sort-btn')) {
            sessionStorage.removeItem('comparisonSortKey');
            sessionStorage.removeItem('comparisonSortDir');
            window.location.reload();
          }
        });

        document.body.addEventListener('click', (e) => {
          const removeBtn = e.target.closest('.remove-player-btn--small');
          if (removeBtn) {
            updatePlayersAndReload(removeBtn.dataset.slug, 'remove');
          }
          const deleteBtn = e.target.closest('.delete-saved-btn');
          if (deleteBtn) {
            deleteSavedComparison(deleteBtn.dataset.url);
          }
        });

        if (dom.addPlayerInput) {
          dom.addPlayerInput.addEventListener('input', debounce(() => {
            if (!dom.autocompleteContainer) return;
            const query = dom.addPlayerInput.value.toLowerCase();
            dom.autocompleteContainer.innerHTML = '';

            if (query.length < 2) {
              dom.autocompleteContainer.style.display = 'none';
              return;
            }

            const results = allPlayers
              .filter(p => p.name.toLowerCase().includes(query) && !comparedPlayerSlugs.includes(p.slug))
              .slice(0, 15);

            // C. Track autocomplete selections
            if (results.length > 0) {
              results.forEach(p => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = p.englishName ? `${p.name} (${p.englishName})` : p.name;
                item.addEventListener('click', () => {
                  if (typeof PlayerPopularity !== 'undefined') {
                    PlayerPopularity.trackSearch(p.slug);
                  }
                  updatePlayersAndReload(p.slug, 'add');
                });
                dom.autocompleteContainer.appendChild(item);
              });
              dom.autocompleteContainer.style.display = 'block';
            } else {
              dom.autocompleteContainer.style.display = 'none';
            }
          }, 300));
        }

        if (dom.placeholder) {
          dom.placeholder.addEventListener('click', (e) => {
            const button = e.target.closest('button[id^="preset-"]');
            if (!button) return;

            const presetSorters = {
              'preset-top-5': (a, b) => (a.rank || Infinity) - (b.rank || Infinity),
              'preset-top-5-fgpi': (a, b) => (getNestedValue(b, 'stats.FGPI') || 0) - (getNestedValue(a, 'stats.FGPI') || 0),
              'preset-random-5': () => 0.5 - Math.random()
            };

            const sorter = presetSorters[button.id];
            if (sorter) {
              const slugs = allPlayers.sort(sorter).slice(0, 5).map(p => p.slug).join(',');
              if (slugs) {
                window.location.href = `${window.location.pathname}?players=${slugs}`;
              }
            }
          });
        }

        if (dom.resetBtn) dom.resetBtn.addEventListener('click', () => window.location.href = window.location.pathname);
        if (dom.saveBtn) dom.saveBtn.addEventListener('click', () => {
          if (comparedPlayers.length > 0) {
            dom.saveNameInput.value = comparedPlayers.map(p => p.name).join(' vs. ');
            openModal(dom.saveModal);
            dom.saveNameInput.focus();
          }
        });
        if (dom.confirmSaveBtn) dom.confirmSaveBtn.addEventListener('click', () => {
          saveComparisonWithName(dom.saveNameInput.value);
          closeModal();
        });
        if (dom.shareBtn) dom.shareBtn.addEventListener('click', () => {
          if (comparedPlayers.length === 0) return;
          const playerNames = comparedPlayers.length > 2
            ? `${comparedPlayers.slice(0, -1).map(p => p.name).join(', ')}, and ${comparedPlayers.slice(-1)[0].name}`
            : comparedPlayers.map(p => p.name).join(' vs. ');

          dom.socialMediaText.value = `I just compared ${playerNames} on FGC Top Players! See the full breakdown of their performance metrics here: ${window.location.href}`;
          openModal(dom.shareModal);
        });
        if (dom.copySocialBtn) dom.copySocialBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(dom.socialMediaText.value)
            .then(() => showButtonFeedback(dom.copySocialBtn, 'Copied!'))
            .catch(err => console.error('Failed to copy social text:', err));
        });
        if (dom.copyLinkBtn) dom.copyLinkBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(window.location.href)
            .then(() => showButtonFeedback(dom.copyLinkBtn, 'Copied!'))
            .catch(err => console.error('Failed to copy link:', err));
        });

        if (dom.modalOverlay) dom.modalOverlay.addEventListener('click', closeModal);
        if (dom.closeSaveModal) dom.closeSaveModal.addEventListener('click', closeModal);
        if (dom.closeShareModal) dom.closeShareModal.addEventListener('click', closeModal);
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') closeModal();
        });
      };

      // initial render
      buildComparisonGrid();
      updatePersistentBar();
      updateHeadContent();
      updateSchema();
      renderSavedComparisons();
      renderPopularComparisons(allPlayers); // dynamic suggestions
      setupEventListeners();

    } catch (error) {
      console.error("Error initializing player comparison page:", error);
      const mainContainer = document.getElementById('comparison-container');
      if (mainContainer) {
        mainContainer.innerHTML = '<div class="error-message"><h2>Error loading player data.</h2><p>Please try refreshing the page or check that /api/players.json exists.</p></div>';
      }
    }
  }

  initPlayerComparisonPage();
});