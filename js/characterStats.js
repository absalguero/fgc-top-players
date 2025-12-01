document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('page-character-stats')) return;
  const table = document.getElementById('character-stats-table');
  if (!table) return;

  const tableHead = table.querySelector('thead');
  const tableBody = table.querySelector('tbody');
  const searchInput = document.getElementById('character-search-input');
  const clearSearchBtn = document.getElementById('character-search-clear-btn');
  const resultsCount = document.getElementById('results-count');

  const howToUseBtn = document.getElementById('how-to-use-btn');
  const howToUsePanel = document.getElementById('how-to-use-panel');
  const toggleColsBtn = document.getElementById('toggle-columns-btn');
  const columnControlsWrapper = document.getElementById('column-controls-wrapper');

  const primaryCheckboxContainer = document.getElementById('column-checkboxes-primary');
  const secondaryCheckboxContainer = document.getElementById('column-checkboxes-secondary');
  const selectAllColsBtn = document.getElementById('select-all-cols');
  const deselectAllColsBtn = document.getElementById('deselect-all-cols');

  // Mobile controls
  const mobileHowToUseBtn = document.getElementById('mobile-how-to-use-btn');
  const mobileToggleColumnsBtn = document.getElementById('mobile-toggle-columns-btn');
  const mobileCardsContainer = document.getElementById('stats-card-container');

  // Close buttons
  const howToUseCloseBtn = document.getElementById('how-to-use-close-btn');
  const columnControlsCloseBtn = document.getElementById('column-controls-close-btn');

  // Mobile detection
  const isMobile = () =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : window.innerWidth <= 767;

  if (!tableBody || !searchInput || !resultsCount || !columnControlsWrapper) {
    console.error('Character stats: required elements missing.');
    return;
  }
  const initialCharacterStats = (typeof characterStats !== 'undefined' && Array.isArray(characterStats))
    ? characterStats
    : [];

  if (initialCharacterStats.length === 0) {
    const colspan = tableHead.querySelectorAll('th').length || 1;
    tableBody.innerHTML = `<tr><td colspan="${colspan}">Error: Character data not found.</td></tr>`;
    return;
  }
  const tierOrder = { 'S+': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'N/A': 99 };
  let currentSort = { key: 'CPV', direction: 'desc' };
  const allHeaders = Array.from(tableHead.querySelectorAll('th[data-key]'));
  const allKeys = allHeaders.map(h => h.dataset.key);
  let visibleColumns = JSON.parse(localStorage.getItem('visibleCharacterColumns')) || allKeys;

  let filteredCharacters = [...initialCharacterStats];

  const primaryStatKeys = ['Tier', 'name', 'CPV', 'TWE', 'FGPI'];
  const secondaryStatKeys = ['CPF', 'CMS', 'TS', 'primaryRDI.region', 'primaryRDI.score', 'TP'];
  const getNestedValue = (obj, path) =>
    path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

  const formatTrendValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const num = Number(Number(value).toFixed(2));
    if (num > 0)  return `<span class="trend"><i class="fas fa-arrow-up is-positive"></i><span>${num}</span></span>`;
    if (num < 0)  return `<span class="trend"><i class="fas fa-arrow-down is-negative"></i><span>${Math.abs(num)}</span></span>`;
    return `<span class="trend"><i class="fas fa-minus is-neutral"></i><span>${num}</span></span>`;
  };

  const sortData = (data, key, direction) => {
  const dirMul = direction === 'asc' ? 1 : -1;
  data.sort((a, b) => {
    let valA = getNestedValue(a, key);
    let valB = getNestedValue(b, key);

    if (key === 'Tier') {
      valA = tierOrder[a.Tier] ?? 99;
      valB = tierOrder[b.Tier] ?? 99;
    }

    // 🔧 Special case: always push Top Region "N/A" (count = 0) to the bottom
    if (key === 'primaryRDI_count') {
      if (valA === 0) valA = null;
      if (valB === 0) valB = null;
    }

    const isNullA = (valA === null || valA === undefined);
    const isNullB = (valB === null || valB === undefined);
    if (isNullA && !isNullB) return 1;
    if (!isNullA && isNullB) return -1;
    if (isNullA && isNullB) return 0;

    if (typeof valA === 'string' || typeof valB === 'string') {
      return valA.toString().localeCompare(valB.toString()) * dirMul;
    }

    // 🔧 When sorting by region count, use region name as tiebreaker for grouping
    if (key === 'primaryRDI_count' && Number(valA) === Number(valB)) {
      const regionA = getNestedValue(a, 'primaryRDI.region') || '';
      const regionB = getNestedValue(b, 'primaryRDI.region') || '';
      return regionA.localeCompare(regionB);
    }

    return (Number(valA) - Number(valB)) * dirMul;
  });
  return data;
};

  const debounce = (func, wait = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => func.apply(null, args), wait);
    };
  };

  const numericRankableHeaders = Array.from(table.querySelectorAll('thead th[data-sort][data-sort-type="number"]'));
  const specialRegionHeader = table.querySelector('thead th[data-sort="primaryRDI.region"]');
  const competitionPositions = {};
  numericRankableHeaders.forEach((th) => {
    const sortKey = th.getAttribute('data-sort');
    if (!sortKey) return;
    const defaultDir = th.getAttribute('data-sort-default') || 'desc';
    const higherIsBetter = defaultDir !== 'asc';
    const entries = initialCharacterStats
      .map(ch => {
        const v = getNestedValue(ch, sortKey);
        const n = Number.parseFloat(v);
        return Number.isFinite(n) ? { slug: ch.slug, v: n } : null;
      })
      .filter(Boolean);
    entries.sort((a, b) => higherIsBetter ? (b.v - a.v) : (a.v - b.v));
    const posMap = {};
    let pos = 1;
    for (let i = 0; i < entries.length; ) {
      const value = entries[i].v;
      let j = i + 1;
      while (j < entries.length && entries[j].v === value) j++;
      for (let k = i; k < j; k++) posMap[entries[k].slug] = pos;
      pos += (j - i);
      i = j;
    }
    competitionPositions[sortKey] = posMap;
  });
  if (specialRegionHeader) {
    const regionCounts = {};
    initialCharacterStats.forEach(c => {
      const region = c?.primaryRDI?.region || null;
      if (region) regionCounts[region] = (regionCounts[region] || 0) + 1;
    });
    const regions = Object.entries(regionCounts)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);
    const regionPos = {};
    let pos = 1;
    for (let i = 0; i < regions.length; ) {
      const cnt = regions[i].count;
      let j = i + 1;
      while (j < regions.length && regions[j].count === cnt) j++;
      for (let k = i; k < j; k++) regionPos[regions[k].region] = pos;
      pos += (j - i);
      i = j;
    }
    const charPos = {};
    initialCharacterStats.forEach(c => {
      const r = c?.primaryRDI?.region || null;
      if (r && regionPos[r]) charPos[c.slug] = regionPos[r];
    });
    competitionPositions['primaryRDI.region'] = charPos;
  }
  const applyFrozenTop5Badges = () => {
    const rankableHeaders = Array.from(table.querySelectorAll('thead th[data-sort]'));
    rankableHeaders.forEach((th) => {
      const sortKey = th.getAttribute('data-sort');
      const colIndex = Array.from(th.parentElement.children).indexOf(th);
      if (!sortKey || colIndex < 0) return;

      const posMap = competitionPositions[sortKey];
      const isRankable = !!posMap;
      tableBody.querySelectorAll('tr').forEach((tr) => {
        const td = tr.children[colIndex];
        if (!td) return;
        td.classList.remove('rank-1', 'rank-2', 'rank-3', 'rank-4', 'rank-5');
        if (!isRankable) return;

        const slug = tr.dataset.slug;
        const pos = posMap?.[slug];
        if (Number.isFinite(pos) && pos >= 1 && pos <= 5) {
          td.classList.add(`rank-${pos}`);
        }
      });
    });
  };

  // Helper function to get rank class for a stat value
  const getRankClass = (statKey, slug) => {
    const posMap = competitionPositions[statKey];
    if (!posMap) return '';
    const pos = posMap[slug];
    if (Number.isFinite(pos) && pos >= 1 && pos <= 5) {
      return `rank-${pos}`;
    }
    return '';
  };

  // Mobile card rendering
  const createCardHtml = (char) => {
    const tier = char.Tier || 'N/A';
    const tierClass = `tier-${tier.toLowerCase().replace('+', '-plus')}`;
    const cardTierClass = tier === 'S+' ? 'tier-s-plus-card' :
                          tier === 'S' ? 'tier-s-card' :
                          tier === 'A' ? 'tier-a-card' :
                          tier === 'B' ? 'tier-b-card' :
                          tier === 'C' ? 'tier-c-card' :
                          tier === 'D' ? 'tier-d-card' : '';

    const cmsHtml = formatTrendValue(char.CMS);
    const tsHtml = formatTrendValue(char.TS);
    const region = char.primaryRDI?.region || 'N/A';
    const rdiScore = (char.primaryRDI && char.primaryRDI.score !== null && char.primaryRDI.score !== undefined)
      ? Number(char.primaryRDI.score).toFixed(2)
      : 'N/A';

    // Get rank classes for each stat
    const cpvRank = getRankClass('CPV', char.slug);
    const tweRank = getRankClass('TWE', char.slug);
    const fgpiRank = getRankClass('FGPI', char.slug);
    const cpfRank = getRankClass('CPF', char.slug);
    const cmsRank = getRankClass('CMS', char.slug);
    const tsRank = getRankClass('TS', char.slug);
    const regionRank = getRankClass('primaryRDI.region', char.slug);
    const rdiRank = getRankClass('primaryRDI.score', char.slug);
    const tpRank = getRankClass('TP', char.slug);

    return `
      <div class="character-stat-card ${cardTierClass}">
        <div class="character-stat-card__header">          
          <div class="character-name-row">
            <span class="tier-badge ${tierClass}">${tier}</span>
            <div class="character-stat-card__name">
              <a href="/characters/${char.slug}/">${char.name}</a>
            </div>
          </div>
        </div>

        <div class="character-stat-card__stats">
          <div class="stat-row">
            <span class="stat-label">CPV:</span>
            <span class="stat-value ${cpvRank}">${char.CPV !== null && char.CPV !== undefined ? Number(char.CPV).toFixed(2) : 'N/A'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">T3R:</span>
            <span class="stat-value ${tweRank}">${char.TWE !== null && char.TWE !== undefined ? Number(char.TWE).toFixed(2) : 'N/A'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">FGPI:</span>
            <span class="stat-value ${fgpiRank}">${char.FGPI !== null && char.FGPI !== undefined ? Number(char.FGPI).toFixed(2) : 'N/A'}</span>
          </div>
        </div>

        <button class="character-stat-card__more-toggle">
          More stats <i class="fas fa-chevron-down"></i>
        </button>

        <div class="character-stat-card__more">
          <div class="stat-row">
            <span class="stat-label">CPF:</span>
            <span class="stat-value ${cpfRank}">${char.CPF !== null && char.CPF !== undefined && char.CPF !== 'N/A' ? Number(char.CPF).toFixed(2) : 'N/A'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">CMS:</span>
            <span class="stat-value ${cmsRank}">${cmsHtml}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">TS:</span>
            <span class="stat-value ${tsRank}">${tsHtml}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Top Region:</span>
            <span class="stat-value ${regionRank}">${region}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">RDI:</span>
            <span class="stat-value ${rdiRank}">${rdiScore}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">TP:</span>
            <span class="stat-value ${tpRank}">${char.TP !== null && char.TP !== undefined ? Math.round(char.TP) : 'N/A'}</span>
          </div>
        </div>
      </div>
    `;
  };

  // Event delegation for more stats toggle
  const handleMoreToggleClick = (e) => {
    const btn = e.target.closest('.character-stat-card__more-toggle');
    if (!btn) return;
    const more = btn.nextElementSibling;
    if (!more) return;
    const isOpen = more.classList.toggle('is-open');
    const icon = btn.querySelector('i');
    if (isOpen) {
      btn.childNodes[0].textContent = 'Hide extra stats ';
      if (icon) icon.className = 'fas fa-chevron-up';
    } else {
      btn.childNodes[0].textContent = 'More stats ';
      if (icon) icon.className = 'fas fa-chevron-down';
    }
  };

  const renderMobileCards = () => {
    if (!mobileCardsContainer) return;

    const cardsHtml = filteredCharacters
      .map(char => createCardHtml(char))
      .join('');

    mobileCardsContainer.innerHTML = cardsHtml;

    // Wire "More stats" toggles - event delegation
    if (!mobileCardsContainer._hasToggleListener) {
      mobileCardsContainer.addEventListener('click', handleMoreToggleClick);
      mobileCardsContainer._hasToggleListener = true;
    }
  };
  const renderTable = (data) => {
    resultsCount.textContent = `Showing ${data.length} characters`;

    // On mobile, only render cards
    if (isMobile()) {
      renderMobileCards();
      return;
    }

    // Desktop/tablet: render table
    tableBody.innerHTML = '';
    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="${visibleColumns.length}">No characters found.</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();

    data.forEach(char => {
      const row = document.createElement('tr');
      row.className = `tier-${(char.Tier || 'na').toLowerCase().replace('+', '-plus')}`;
      row.dataset.slug = char.slug;

      const region = char.primaryRDI?.region || 'N/A';
      const cmsHtml = formatTrendValue(char.CMS);
      const tsHtml  = formatTrendValue(char.TS);

      row.innerHTML = `
        <td class="tier-cell" data-key="Tier">
          <span class="tier-badge tier-${(char.Tier || 'na').toLowerCase().replace('+', '-plus')}">${char.Tier || 'N/A'}</span>
        </td>
        <td class="col-character" data-key="name">
          <div class="player-cell-content">
            <span><a href="/characters/${char.slug}/">${char.name}</a></span>
          </div>
        </td>
        <td data-key="CPV">${char.CPV !== null && char.CPV !== undefined ? Number(char.CPV).toFixed(2) : 'N/A'}</td>
        <td data-key="TWE">${char.TWE !== null && char.TWE !== undefined ? Number(char.TWE).toFixed(2) : 'N/A'}</td>
        <td data-key="FGPI">${char.FGPI !== null && char.FGPI !== undefined ? Number(char.FGPI).toFixed(2) : 'N/A'}</td>
        <td data-key="CPF">${char.CPF !== null && char.CPF !== undefined && char.CPF !== 'N/A' ? Number(char.CPF).toFixed(2) : 'N/A'}</td>
        <td data-key="CMS">${cmsHtml}</td>
        <td data-key="TS">${tsHtml}</td>
        <td data-key="primaryRDI.region">${region}</td>
        <td data-key="primaryRDI.score">${(char.primaryRDI && char.primaryRDI.score !== null && char.primaryRDI.score !== undefined) ? Number(char.primaryRDI.score).toFixed(2) : 'N/A'}</td>
<td data-key="TP">${char.TP !== null && char.TP !== undefined ? Math.round(char.TP) : 'N/A'}</td>
      `;
      frag.appendChild(row);
    });

    tableBody.appendChild(frag);
    applyColumnVisibility();
    applyFrozenTop5Badges();
  };

  const applyColumnVisibility = () => {
    allHeaders.forEach(th => {
      th.style.display = visibleColumns.includes(th.dataset.key) ? '' : 'none';
    });
    tableBody.querySelectorAll('tr').forEach(tr => {
      Array.from(tr.children).forEach((td, idx) => {
        const key = allHeaders[idx]?.dataset.key;
        if (!key) return;
        td.style.display = visibleColumns.includes(key) ? '' : 'none';
      });
    });
    updateCheckboxStates();
  };

  const updateVisibleColumns = () => {
    visibleColumns = [];
    columnControlsWrapper.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      visibleColumns.push(cb.dataset.columnKey);
    });
    localStorage.setItem('visibleCharacterColumns', JSON.stringify(visibleColumns));
    performRender();
  };

  const updateCheckboxStates = () => {
    columnControlsWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = visibleColumns.includes(cb.dataset.columnKey);
    });
  };

  const initializeColumnControls = () => {
    const createCheckbox = (header, isChecked) => {
      const key = header.dataset.key;
      const labelText = header.querySelector('span')?.textContent || key;
      const label = document.createElement('label');
      label.className = 'styled-checkbox-label';
      label.innerHTML = `
        <input type="checkbox" data-column-key="${key}" ${isChecked ? 'checked' : ''}>
        <span class="styled-checkbox-box"><i class="fas fa-check"></i></span>
        <span class="styled-checkbox-text">${labelText}</span>
      `;
      return label;
    };

    primaryCheckboxContainer.innerHTML = '';
    secondaryCheckboxContainer.innerHTML = '';

    allHeaders.forEach(header => {
      const key = header.dataset.key;
      const isChecked = visibleColumns.includes(key);
      if (primaryStatKeys.includes(key)) {
        primaryCheckboxContainer.appendChild(createCheckbox(header, isChecked));
      } else if (secondaryStatKeys.includes(key)) {
        secondaryCheckboxContainer.appendChild(createCheckbox(header, isChecked));
      }
    });
  };

  const updateSortHeaders = () => {
    table.querySelectorAll('thead th.sortable').forEach(th => th.classList.remove('sorted', 'asc', 'desc'));
    const activeHeader = table.querySelector(`thead th[data-sort="${currentSort.key}"]`);
    if (activeHeader) activeHeader.classList.add('sorted', currentSort.direction);
  };

  const performRender = () => {
    const query = searchInput.value.toLowerCase().trim();
    const hasQuery = query.length > 0;
    clearSearchBtn?.classList.toggle('visible', hasQuery);

    const filtered = initialCharacterStats.filter(char =>
      (char.name || '').toLowerCase().includes(query)
    );
    const sorted = sortData(filtered, currentSort.key, currentSort.direction);

    // Update filteredCharacters for mobile cards
    filteredCharacters = sorted;

    renderTable(sorted);
    updateSortHeaders();
  };

  let searchRenderTimeout = null;

  const searchHandler = () => {
    // Cancel any pending render to avoid redundant work
    if (searchRenderTimeout) {
      clearTimeout(searchRenderTimeout);
    }

    // Update visual state immediately
    const hasQuery = searchInput.value.trim().length > 0;
    clearSearchBtn?.classList.toggle('visible', hasQuery);

    // Schedule render after browser paints
    searchRenderTimeout = setTimeout(() => {
      searchRenderTimeout = null;
      performRender();
    }, 1);
  };

  table.querySelectorAll('thead th.sortable').forEach(header => {
    header.addEventListener('click', () => {
      const key = header.getAttribute('data-sort');
      if (!key) return;
      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = key;
        currentSort.direction = header.getAttribute('data-sort-default') || 'desc';
      }
      performRender();
    });
  });
  searchInput.addEventListener('input', searchHandler);

  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    performRender();
  });
  columnControlsWrapper.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') updateVisibleColumns();
  });

  selectAllColsBtn?.addEventListener('click', () => {
    columnControlsWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateVisibleColumns();
  });

  deselectAllColsBtn?.addEventListener('click', () => {
    columnControlsWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateVisibleColumns();
  });
  const closePopovers = (evtTarget) => {
    const howToTriggers = [howToUseBtn, mobileHowToUseBtn].filter(Boolean);
    if (howToUsePanel && !howToUsePanel.contains(evtTarget) && !howToTriggers.some(btn => btn.contains(evtTarget))) {
      howToUsePanel.classList.remove('is-visible');
    }
    const columnTriggers = [toggleColsBtn, mobileToggleColumnsBtn].filter(Boolean);
    if (columnControlsWrapper && !columnControlsWrapper.contains(evtTarget) && !columnTriggers.some(btn => btn.contains(evtTarget))) {
      columnControlsWrapper.classList.remove('is-visible');
    }
  };

  howToUseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    howToUsePanel?.classList.toggle('is-visible');
    columnControlsWrapper?.classList.remove('is-visible');
  });

  toggleColsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    columnControlsWrapper?.classList.toggle('is-visible');
    howToUsePanel?.classList.remove('is-visible');
  });

  // Mobile button handlers
  mobileHowToUseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    howToUsePanel?.classList.toggle('is-visible');
    columnControlsWrapper?.classList.remove('is-visible');
  });

  mobileToggleColumnsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    columnControlsWrapper?.classList.toggle('is-visible');
    howToUsePanel?.classList.remove('is-visible');
  });

  // Close button handlers
  howToUseCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    howToUsePanel?.classList.remove('is-visible');
  });

  columnControlsCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    columnControlsWrapper?.classList.remove('is-visible');
  });

  document.addEventListener('click', (e) => closePopovers(e.target));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      howToUsePanel?.classList.remove('is-visible');
      columnControlsWrapper?.classList.remove('is-visible');
    }
  });
  table.querySelectorAll('th[data-sort-default="asc"]').forEach(th => th.classList.add('reverse-arrow'));

  initializeColumnControls();
  performRender();
});