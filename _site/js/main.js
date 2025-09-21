// /js/main.js
document.addEventListener('DOMContentLoaded', () => {

  /**
   * Debounces a function call, ensuring it's only executed once after a specified delay.
   * @param {Function} func The function to debounce.
   * @param {number} delay The delay in milliseconds.
   * @returns {Function} The debounced function.
   */
  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Helper function to update clear button visibility
  const updateClearButtonVisibility = (inputId, clearBtnId) => {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearBtnId);
    if (input && clearBtn) {
      clearBtn.classList.toggle('visible', input.value.length > 0);
    }
  };

  // --- SITewide TEXT HIGHLIGHTER (REMOVED) ---
  // The logic has been integrated into the individual page functions for stability.
  function highlightTextInElement(searchTerm, containerElement) {
    if (!searchTerm || !containerElement || !window.Highlight) {
      console.warn("CSS Custom Highlight API not supported or search term/container missing.");
      return;
    }

    CSS.highlights.clear();
    const highlight = new Highlight();
    const walker = document.createTreeWalker(containerElement, NodeFilter.SHOW_TEXT);
    let textNode;
    const regex = new RegExp(searchTerm.trim(), 'gi');

    while ((textNode = walker.nextNode())) {
      const textContent = textNode.nodeValue;
      let match;

      while ((match = regex.exec(textContent))) {
        const range = new Range();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, match.index + match[0].length);
        highlight.add(range);
      }
    }
    CSS.highlights.set('search-highlight', highlight);
  }

  // --- HAMBURGER MENU ---
  function initHamburgerMenu() {
    const navToggle = document.querySelector('.nav-toggle');
    const sidebar = document.querySelector('.nav-sidebar');
    const mainContent = document.querySelector('main.content');
    if (!navToggle || !sidebar || !mainContent) return;

    navToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      navToggle.classList.toggle('active');
      sidebar.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    });

    mainContent.addEventListener('click', () => {
      if (sidebar.classList.contains('active')) {
        navToggle.classList.remove('active');
        sidebar.classList.remove('active');
        document.body.classList.remove('no-scroll');
      }
    });
  }

  // --- EXPANDABLE MOBILE TABLE ROWS ---
  function initExpandableTableRows() {
    const rankingsTableBody = document.querySelector('#rankings-table tbody');
    if (rankingsTableBody) {
      rankingsTableBody.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        const clickedRow = event.target.closest('tr');
        if (clickedRow) {
          clickedRow.classList.toggle('is-expanded');
        }
      });
    }
  }

  // --- SEARCH INPUT CLEAR BUTTONS ---
  function initSearchClearButtons() {
    function setupSearchClear(inputId, clearBtnId) {
      const input = document.getElementById(inputId);
      const clearBtn = document.getElementById(clearBtnId);
      if (input && clearBtn) {
        // Function to update clear button visibility
        const updateVisibility = () => {
          clearBtn.classList.toggle('visible', input.value.length > 0);
        };
        
        // Check initial state on page load
        updateVisibility();
        
        // Update on input changes
        input.addEventListener('input', updateVisibility);
        
        clearBtn.addEventListener('click', () => {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        });
      }
    }
    setupSearchClear('player-search-input', 'player-search-clear-btn');
    setupSearchClear('search-input', 'search-clear-btn');
  }

  // --- BACK TO TOP BUTTON ---
  function initBackToTopButton() {
    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (!backToTopBtn) return;

    const checkScrollPosition = () => {
      const isScrolled = window.scrollY > 200;
      backToTopBtn.classList.toggle('show', isScrolled);
    };
    
    window.addEventListener('scroll', checkScrollPosition);
    setInterval(checkScrollPosition, 1000);

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --- RANKING SYSTEM PAGE: TABLE OF CONTENTS & SCROLL-SPY ---
  function initRankingSystemTOC() {
    if (!document.body.classList.contains('page-ranking-system')) return;
    
    const tocWrapper = document.querySelector('.page-ranking-system__toc-wrapper');
    const tocToggleBtn = document.querySelector('.toc-toggle-btn');
    const tocLinks = document.querySelectorAll('.toc-list ul li a');
    const isMobile = window.innerWidth < 769;

    const mobileHeader = document.querySelector('.mobile-header');
    const mobileHeaderHeight = mobileHeader ? mobileHeader.offsetHeight : 60;

    if (tocToggleBtn) {
      tocToggleBtn.addEventListener('click', () => {
        const isExpanded = tocToggleBtn.getAttribute('aria-expanded') === 'true';
        tocToggleBtn.setAttribute('aria-expanded', !isExpanded);
        tocWrapper.classList.toggle('is-open');
      });
    }

    if (tocLinks.length > 0) {
      let isClickScrolling = false;
      let scrollTimeout;

      const activateLink = (id) => {
        tocLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      };

      tocLinks.forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          isClickScrolling = true;
          const targetId = this.getAttribute('href');
          const targetElement = document.querySelector(targetId);
          if (!targetElement) return;

          activateLink(targetId.substring(1));
          
          const calculateAndScroll = () => {
            const topOffset = isMobile ? mobileHeaderHeight + 20 : 30;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - topOffset;

            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => { isClickScrolling = false; }, 1000);
          };

          if (isMobile && tocWrapper.classList.contains('is-open')) {
            tocToggleBtn.click();
            setTimeout(calculateAndScroll, 450);
          } else {
            calculateAndScroll();
          }
        });
      });

      const observerMarginTop = isMobile ? mobileHeaderHeight + 20 : 30;
      const observer = new IntersectionObserver(entries => {
        if (isClickScrolling) return;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            activateLink(entry.target.id);
          }
        });
      }, { rootMargin: `-${observerMarginTop}px 0px -${window.innerHeight - observerMarginTop - 50}px 0px` });
      
      document.querySelectorAll('.page-ranking-system__main-content [id]').forEach(section => observer.observe(section));
    }
  }
    
  // --- EVENT DETAIL PAGE SCRIPTS ---
  function initEventPageScripts() {
    const isEventPage = document.body.classList.contains('page-event') || document.body.classList.contains('page-tournament-detail');
    if (!isEventPage) return;
    
    document.querySelectorAll('.event-image-container').forEach(container => {
      const img = container.querySelector('img');
      if (img && img.src) {
        container.style.setProperty('--bg-image-url', `url(${img.src})`);
      }
    });

    const eventHeaderGroup = document.querySelector('.event-header-group');
    if (eventHeaderGroup) {
      window.addEventListener('scroll', () => {
          eventHeaderGroup.classList.toggle('is-scrolled', window.scrollY > 10);
      });
    }
  }

  // --- RANKINGS PAGE: LIVE TABLE & INFINITE SCROLL ---
  function initRankingsTable() {
    const rankingsTableBody = document.querySelector('#rankings-table tbody');
    if (!rankingsTableBody) return;

    const sheetURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315';
    const playerSearchInput = document.getElementById('player-search-input');
    const sentinel = document.getElementById('sentinel');
    const lastUpdatedEl = document.getElementById('last-updated');
    let allPlayers = [], playersToShow = 10;
    const playersPerLoad = 15, maxPlayers = 40;
    let currentSortColumn = 0, currentSortDirection = 'asc', currentSortDataType = 'number';

    const urlParams = new URLSearchParams(window.location.search);
    let searchTerm = urlParams.get('q') || '';
    if (searchTerm) {
      playerSearchInput.value = searchTerm;
      // Update clear button visibility after setting search value
      updateClearButtonVisibility('player-search-input', 'player-search-clear-btn');
    }

    const parseCSV = (text) => {
      const rows = text.trim().split('\n');
      if (rows.length <= 1) return [];
      const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
      return rows.slice(1).map(row => {
        const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        return headers.reduce((obj, header, i) => {
          obj[header] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
          return obj;
        }, {});
      });
    };

    const createRowHtml = (player) => {
      const highlight = (text) => searchTerm ? text.replace(new RegExp(searchTerm.split(' ').filter(k => k).join('|'), 'gi'), match => `<mark>${match}</mark>`) : text;
      const change = player['Rank Change'] || '';
      let changeContent = `<div class="change-cell no-change"><i class="fas fa-minus"></i></div>`;
      if (change === 'New') changeContent = `<div class="change-cell new"><i class="fas fa-star"></i> New</div>`;
      else if (change.startsWith('+')) changeContent = `<div class="change-cell positive"><i class="fas fa-arrow-up"></i> ${change.substring(1)}</div>`;
      else if (change.startsWith('-')) changeContent = `<div class="change-cell negative"><i class="fas fa-arrow-down"></i> ${change.substring(1)}</div>`;
      
      const rank = parseInt(player.Rank, 10);
      let rankClass = '';
      if (rank <= 4) rankClass = `rank-${rank}`;
      else if (rank <= 40) rankClass = 'ranked-6-40';

      return `
        <tr class="${rankClass}">
          <td data-label="Rank" class="rank-cell expandable-cell">${player.Rank || 'N/A'}</td>
          <td data-label="Change" class="cell-hidden-mobile">${changeContent}</td>
          <td data-label="Player" class="cell-player">
            <div class="player-cell-content">
              <img src="${player['Player Icon'] || ''}" alt="${player.Player}" class="player-icon" onerror="this.style.display='none'">
              <span>${highlight(player.Player)}</span>
            </div>
          </td>
          <td data-label="Main Character" class="cell-character cell-hidden-mobile">
            <div class="player-cell-content">
              <img src="/images/characters/${(player['Main Character'] || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}.png" alt="${player['Main Character']}" class="character-icon" onerror="this.style.display='none'">
              <span>${highlight(player['Main Character'])}</span>
            </div>
          </td>
          <td data-label="Country" class="cell-center cell-hidden-mobile">
            <div class="player-cell-content">
              <img src="/images/flags/${(player.Country || '').toLowerCase()}.png" alt="${player.Country}" class="flag-icon" onerror="this.style.display='none'">
              <span>${highlight(player.Country)}</span>
            </div>
          </td>
          <td data-label="Rating">${player.Rating || '0'}</td>
        </tr>`;
    };

    const renderTable = (playersToRender) => {
      if (playersToRender.length === 0 && searchTerm) {
        rankingsTableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No players found.</td></tr>';
        return;
      }
      rankingsTableBody.innerHTML = playersToRender.map(createRowHtml).join('');
      highlightTextInElement(searchTerm, rankingsTableBody);
    };

    const refreshTable = () => {
      let filteredPlayers = searchTerm ? allPlayers.filter(p =>
        (p.Player || '').toLowerCase().includes(searchTerm) ||
        (p['Main Character'] || '').toLowerCase().includes(searchTerm) ||
        (p.Country || '').toLowerCase().includes(searchTerm)
      ) : allPlayers;
      
      const headersMap = { 0: 'Rank', 1: 'Rank Change', 2: 'Player', 3: 'Main Character', 4: 'Country', 5: 'Rating' };
      const key = headersMap[currentSortColumn];
      filteredPlayers.sort((a, b) => {
        let aVal = a[key], bVal = b[key];
        if (currentSortDataType === 'number') {
          aVal = parseFloat(String(aVal).replace(/[^0-9.-]+/g,"")) || 0;
          bVal = parseFloat(String(bVal).replace(/[^0-9.-]+/g,"")) || 0;
        } else {
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
        }
        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      renderTable(filteredPlayers.slice(0, playersToShow));
      if (sentinel) {
        sentinel.style.display = playersToShow < filteredPlayers.length ? 'block' : 'none';
      }
    };
    
    const updateSortUI = () => {
      document.querySelectorAll('[data-column-index]').forEach(h => h.classList.remove('sorted', 'asc', 'desc'));
      document.querySelectorAll(`[data-column-index="${currentSortColumn}"]`).forEach(h => h.classList.add('sorted', currentSortDirection));
    };

    const setupSorting = () => {
      document.querySelectorAll('#rankings-table th, #rankings-mobile-sort .btn').forEach(header => {
        header.addEventListener('click', (e) => {
          const colIndex = parseInt(e.currentTarget.dataset.columnIndex);
          if (colIndex === currentSortColumn) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            currentSortColumn = colIndex;
            currentSortDirection = 'asc';
            currentSortDataType = e.currentTarget.dataset.type;
          }
          playersToShow = 25;
          refreshTable();
          updateSortUI();
        });
      });
    };

    const fetchData = async () => {
      try {
        const createSkeletonRow = () => `
          <tr class="skeleton-row">
            <td class="rank-cell"><div class="skeleton skeleton-text skeleton-text--short" style="margin: 0 auto;"></div></td>
            <td class="cell-hidden-mobile"><div class="skeleton skeleton-text skeleton-text--short" style="margin: 0 auto;"></div></td>
            <td class="cell-player">
              <div class="player-cell-content">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton skeleton-text skeleton-text--medium"></div>
              </div>
            </td>
            <td class="cell-character cell-hidden-mobile">
                <div class="player-cell-content">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="skeleton skeleton-text skeleton-text--medium"></div>
                </div>
            </td>
            <td class="cell-center cell-hidden-mobile">
                <div class="player-cell-content">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="skeleton skeleton-text skeleton-text--medium"></div>
                </div>
            </td>
            <td><div class="skeleton skeleton-text skeleton-text--short" style="margin: 0 auto;"></div></td>
          </tr>
        `;
        rankingsTableBody.innerHTML = Array(10).fill(null).map(createSkeletonRow).join('');
        const response = await fetch(`${sheetURL}&cachebuster=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        
        const rawPlayers = parseCSV(csvText);
        
        if (lastUpdatedEl && rawPlayers.length > 0 && rawPlayers[0]['Last Updated']) {
          lastUpdatedEl.textContent = `Last Updated: ${rawPlayers[0]['Last Updated']}`;
        }

        allPlayers = rawPlayers.filter(p => {
          const rank = parseInt(p['Rank'], 10);
          return !isNaN(rank) && rank >= 1 && rank <= maxPlayers;
        });

        refreshTable();
        updateSortUI();
        setupSorting();
      } catch (error) {
        console.error("Failed to fetch live rankings:", error);
        if (window.cachedRankingsData && window.cachedRankingsData.length > 0) {
          console.log("Live fetch failed. Using cached data as a fallback.");
          allPlayers = window.cachedRankingsData;
          refreshTable();
          updateSortUI();
          setupSorting();
        } else {
          rankingsTableBody.innerHTML = '<tr><td colspan="6" class="loading-row" style="color: red;">Failed to load data. No cache available.</td></tr>';
        }
      }
    };

    if (playerSearchInput) {
      playerSearchInput.addEventListener('input', debounce((e) => {
        const currentSearchTerm = e.target.value;
        const newUrl = currentSearchTerm ? `${window.location.pathname}?q=${encodeURIComponent(currentSearchTerm)}` : window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        searchTerm = currentSearchTerm.toLowerCase();
        playersToShow = 25;
        refreshTable();
      }, 300));
    }
    
    if (sentinel) {
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && playersToShow < allPlayers.length) {
          playersToShow = Math.min(playersToShow + playersPerLoad, maxPlayers);
          refreshTable();
        }
      }, { threshold: 1.0 });
      observer.observe(sentinel);
    }

    fetchData();
  }
  
// /js/main.js

// ... (previous code in main.js)

// --- UPCOMING TOURNAMENTS PAGE: FILTER & SORT ---
function initUpcomingTournaments() {
    if (!document.body.classList.contains('page-upcoming-tournaments')) return;
    if (typeof tournamentData === 'undefined' || !Array.isArray(tournamentData)) return;

    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-by');
    const tournamentList = document.getElementById('tournaments-list');
    const resultsCountEl = document.getElementById('results-count');
    const noResultsEl = document.getElementById('no-results-message');

    if (!tournamentList || !searchInput || !sortSelect || !resultsCountEl || !noResultsEl) return;

    const allCardElements = new Map(
        Array.from(tournamentList.children).map(card => {
            const slug = card.querySelector('a')?.href.split('/').filter(Boolean).pop();
            return [slug, card];
        })
    );
    
    // 1. Restore state from URL parameters on page load
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('q') || '';
    const selectedSort = urlParams.get('sort') || 'date-asc'; // Default sort

    searchInput.value = searchTerm;
    sortSelect.value = selectedSort;

    if (searchTerm) {
        updateClearButtonVisibility('search-input', 'search-clear-btn');
    }

    // 2. Create a function to update the URL with the current state
    const updateURL = () => {
        const params = new URLSearchParams();
        const currentSearchTerm = searchInput.value.trim();
        const sortBy = sortSelect.value;

        if (currentSearchTerm) {
            params.set('q', currentSearchTerm);
        }
        if (sortBy !== 'date-asc') { // Only add sort if it's not the default
            params.set('sort', sortBy);
        }

        const newUrl = params.toString() ? 
            `${window.location.pathname}?${params.toString()}` : 
            window.location.pathname;
        
        window.history.replaceState({ path: newUrl }, '', newUrl);
    };

    const updateAndRender = () => {
        const currentSearchTerm = searchInput.value.trim().toLowerCase();
        const sortBy = sortSelect.value;
        const filteredEvents = tournamentData.filter(event => {
            const searchableText = `${event.name} ${event.dates} ${event.location} ${event.game} ${event.prizes}`.toLowerCase();
            return searchableText.includes(currentSearchTerm);
        });

        filteredEvents.sort((a, b) => {
            switch (sortBy) {
                case 'prize-desc':
                    const prizeA = Number(String(a.prizes || '0').replace(/[^0-9.-]+/g, ""));
                    const prizeB = Number(String(b.prizes || '0').replace(/[^0-9.-]+/g, ""));
                    return prizeB - prizeA;
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'date-asc':
                default:
                    return new Date(a.startDate) - new Date(b.startDate);
            }
        });
        
        tournamentList.innerHTML = '';
        filteredEvents.forEach(event => {
            const card = allCardElements.get(event.slug);
            if (card) tournamentList.appendChild(card);
        });

        noResultsEl.style.display = filteredEvents.length === 0 ? 'block' : 'none';
        resultsCountEl.textContent = `Showing ${filteredEvents.length} of ${allCardElements.size} tournaments`;
        highlightTextInElement(currentSearchTerm, tournamentList);

        // 3. Call updateURL whenever the view is rendered
        updateURL();
    };

    // 4. Update the event listeners to call updateAndRender
    searchInput.addEventListener('input', debounce(() => {
        updateAndRender();
    }, 300));

    sortSelect.addEventListener('change', updateAndRender);
    
    updateAndRender(); // Initial render on page load
}

// ... (rest of main.js)

// --- TOURNAMENT ARCHIVE PAGE: FILTER, SORT & INFINITE SCROLL (REBUILT) ---
function initTournamentArchive() {
  if (!document.body.classList.contains('page-tournament-results')) return;
  if (typeof archiveData === 'undefined' || !Array.isArray(archiveData)) return;

  const allEventsData = archiveData;
  const searchInput = document.getElementById('search-input');
  const yearFilter = document.getElementById('year-filter');
  const sortSelect = document.getElementById('sort-by');
  const ratedOnlyCheckbox = document.getElementById('rated-only-filter');
  const archiveList = document.getElementById('archive-list');
  const resultsCountEl = document.getElementById('results-count');
  const noResultsEl = document.getElementById('no-results-message');
  const sentinel = document.getElementById('sentinel');

  let visibleCount = 18;
  const itemsPerLoad = 18;
  let filteredEvents = [];

  // Restore state from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const searchTerm = urlParams.get('q') || '';
  const selectedYear = urlParams.get('year') || '';
  const selectedSort = urlParams.get('sort') || 'date-desc';
  const ratedOnly = urlParams.get('rated') === 'true';

  // Set form values from URL
  if (searchTerm) {
    searchInput.value = searchTerm;
    updateClearButtonVisibility('search-input', 'search-clear-btn');
  }
  if (selectedYear) {
    yearFilter.value = selectedYear;
  }
  if (selectedSort) {
    sortSelect.value = selectedSort;
  }
  if (ratedOnly) {
    ratedOnlyCheckbox.checked = true;
  }

  // Function to update URL with current filter/sort state
  const updateURL = () => {
    const params = new URLSearchParams();
    
    if (searchInput.value.trim()) {
      params.set('q', searchInput.value.trim());
    }
    if (yearFilter.value) {
      params.set('year', yearFilter.value);
    }
    if (sortSelect.value !== 'date-desc') { // Only add if not default
      params.set('sort', sortSelect.value);
    }
    if (ratedOnlyCheckbox.checked) {
      params.set('rated', 'true');
    }

    const newUrl = params.toString() ? 
      `${window.location.pathname}?${params.toString()}` : 
      window.location.pathname;
    
    window.history.replaceState({path: newUrl}, '', newUrl);
  };

  const generateCardHTML = (event) => {
    const readableDate = new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

    const now = new Date();
    const eventDate = new Date(event.date);
    const ageInDays = (now - eventDate) / (1000 * 60 * 60 * 24);
    let tierClass = '';
    if (ageInDays <= 365 && event.Tier) {
      tierClass = `archive-item-card--${event.Tier.toLowerCase().replace('+', '-plus')}`;
    }

    return `
      <a href="/tournaments/${event.slug}/" class="archive-item-card ${tierClass}">
        <div class="event-image-container" style="--bg-image-url: url('/images/events/${event.slug}.png');">
          <img src="/images/events/${event.slug}.png" alt="${event.name}" loading="lazy" onerror="this.style.display='none';">
        </div>
        <div class="archive-item-card__content">
          <span class="archive-item-card__name">${event.name}</span>
          <span class="archive-item-card__date">${readableDate}</span>
        </div>
        <i class="fas fa-chevron-right archive-item-card__chevron"></i>
      </a>`;
  };

  const renderFilteredItems = () => {
    archiveList.innerHTML = filteredEvents.slice(0, visibleCount).map(generateCardHTML).join('');
    resultsCountEl.textContent = `Showing ${Math.min(visibleCount, filteredEvents.length)} of ${allEventsData.length} results`;
    noResultsEl.style.display = filteredEvents.length === 0 ? 'block' : 'none';
    if (sentinel) {
      sentinel.style.display = visibleCount >= filteredEvents.length ? 'none' : 'block';
    }
    highlightTextInElement(searchInput.value, archiveList);
  };

  const updateAndRender = () => {
    const currentSearchTerm = searchInput.value.trim().toLowerCase();
    const selectedYear = yearFilter.value;
    const sortBy = sortSelect.value;
    const showRatedOnly = ratedOnlyCheckbox.checked;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    filteredEvents = allEventsData.filter(event => {
      const eventDate = new Date(event.date);
      
      const yearMatch = !selectedYear || event.date.startsWith(selectedYear);
      const searchMatch = !currentSearchTerm || `${event.name} ${event.date}`.toLowerCase().includes(currentSearchTerm);
      
      const isWithinLastYear = eventDate >= oneYearAgo;
      const ratedMatch = !showRatedOnly || (showRatedOnly && isWithinLastYear);
      
      return yearMatch && searchMatch && ratedMatch;
    });

    filteredEvents.sort((a, b) => {
      if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return new Date(b.date) - new Date(a.date);
    });

    visibleCount = itemsPerLoad;
    renderFilteredItems();
    updateURL(); // Update URL whenever filters/sort change
  };

  const years = [...new Set(allEventsData.map(event => event.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  years.forEach(year => {
    if (year) yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
  });

  // Set year filter value after populating options
  if (selectedYear) {
    yearFilter.value = selectedYear;
  }

  if (sentinel) {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filteredEvents.length) {
        visibleCount += itemsPerLoad;
        renderFilteredItems();
      }
    }, { threshold: 1.0 });
    observer.observe(sentinel);
  }

  [searchInput, yearFilter, sortSelect, ratedOnlyCheckbox].forEach(el => {
    const eventType = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventType, debounce(() => {
      updateAndRender();
    }, 300));
  });

  filteredEvents = allEventsData;
  updateAndRender();
}

// --- PLAYER DIRECTORY ---
function initPlayerDirectory() {
    const searchInput = document.getElementById("player-search-input");
    const searchClearBtn = document.getElementById("player-search-clear-btn");
    const gameFilter = document.getElementById("filter-game");
    const countryFilter = document.getElementById("filter-country");
    const characterFilter = document.getElementById("filter-character");
    const sortBySelect = document.getElementById("sort-by");
    const playerGrid = document.getElementById("player-card-grid");
    const resultsCount = document.getElementById("results-count");
    const noResultsMessage = document.getElementById("no-results-message");
    const sentinel = document.getElementById("sentinel");
    const resetFiltersBtn = document.getElementById("reset-filters-btn");
    const activeFiltersContainer = document.getElementById("active-filters-container");
    const searchForm = document.getElementById("player-search-form");

    if (!playerGrid) return;
    
    if (typeof playerProfiles === 'undefined' || !Array.isArray(playerProfiles)) {
        console.error("Player profiles data not found or is not an array!");
        return;
    }

    let visibleCount = 20;
    const batchSize = 20;
    let searchTerm, sortBy, selectedGame, selectedCountry, selectedCharacter;
    let currentFilteredPlayers = [];

    const urlParams = new URLSearchParams(window.location.search);
    const initialSearchTerm = urlParams.get('q') || '';
    if (initialSearchTerm) {
      searchInput.value = initialSearchTerm;
      // Update clear button visibility after setting search value
      updateClearButtonVisibility('player-search-input', 'player-search-clear-btn');
    }

    const updateURL = () => {
        const params = new URLSearchParams();
        if (searchTerm) params.set('search', searchTerm);
        if (sortBy !== 'rank-asc') params.set('sort', sortBy);
        if (selectedGame !== 'all') params.set('game', selectedGame);
        if (selectedCountry !== 'all') params.set('country', selectedCountry);
        if (selectedCharacter !== 'all') params.set('char', selectedCharacter);

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({path: newUrl}, '', newUrl);
    };

    const restoreStateFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        searchTerm = params.get('search') || '';
        sortBy = params.get('sort') || 'rank-asc';
        selectedGame = params.get('game') || 'all';
        selectedCountry = params.get('country') || 'all';
        selectedCharacter = params.get('char') || 'all';

        searchInput.value = searchTerm;
        sortBySelect.value = sortBy;
        gameFilter.value = selectedGame;
        countryFilter.value = selectedCountry;
        characterFilter.value = selectedCharacter;
    };

    const restoreScrollPosition = () => {
        const scrollPosition = sessionStorage.getItem('playerDirectoryScroll');
        if (scrollPosition) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(scrollPosition, 10));
                sessionStorage.removeItem('playerDirectoryScroll');
            }, 100);
        }
    };
    
    const populateFilters = () => {
        const countries = new Set();
        const characters = new Set();
        playerProfiles.forEach(player => {
            if (player.country && player.country.trim().toUpperCase() !== 'N/A' && player.country.trim() !== '') {
                countries.add(player.country.trim());
            }
            if (player.mainCharacter) {
                characters.add(player.mainCharacter.trim());
            }
        });
        const sortedCountries = [...countries].sort((a, b) => a.localeCompare(b));
        sortedCountries.forEach(country => {
            countryFilter.innerHTML += `<option value="${country}">${country}</option>`;
        });
        const sortedCharacters = [...characters].sort((a, b) => a.localeCompare(b));
        sortedCharacters.forEach(character => {
            characterFilter.innerHTML += `<option value="${character}">${character}</option>`;
        });
    };

    const updateActiveFiltersUI = () => {
        activeFiltersContainer.innerHTML = '';
        const createPill = (type, value) => {
            const pill = document.createElement('div');
            pill.className = 'filter-pill';
            pill.innerHTML = `
                <span>${type}: <strong>${value}</strong></span>
                <button class="filter-pill-close" data-filter-type="${type.toLowerCase()}">&times;</button>
            `;
            activeFiltersContainer.appendChild(pill);
        };

        if (selectedGame !== 'all') {
            const gameText = gameFilter.options[gameFilter.selectedIndex].text;
            createPill('Game', gameText);
        }
        if (selectedCountry !== 'all') createPill('Country', selectedCountry);
        if (selectedCharacter !== 'all') createPill('Character', selectedCharacter);
    };
    
    const generateCardHTML = (player) => {
      const rankClass = player.rank ? (player.rank <= 4 ? `rank-${player.rank}` : (player.rank <= 40 ? 'ranked-6-40' : '')) : '';
      const hasPhoto = typeof player.photoUrl === 'string' && player.photoUrl.trim() !== '';
      const imageHtml = hasPhoto
          ? `<img src="${player.photoUrl.trim()}" alt="${player.name}" class="player-icon" loading="lazy" onerror="this.onerror=null;this.src='/images/default-avatar.png';">`
          : `<div class="player-placeholder-icon"><i class="fas fa-user"></i></div>`;
      const hasCountry = typeof player.country === 'string' && player.country.trim().toUpperCase() !== 'N/A' && player.country.trim() !== '';
      const countryText = hasCountry ? ` | ${player.country}` : '';

      return `
          <a href="/players/${player.slug}/" class="archive-item-card player-card ${rankClass}">
              <div class="player-card__image-container">${imageHtml}</div>
              
              <div class="player-card__details-wrapper">
                  <div class="player-card__text-content">
                      <span class="archive-item-card__name">${player.name}</span>
                      <span class="archive-item-card__date">
                          Rank: ${player.rank || 'N/A'}${countryText}
                      </span>
                  </div>
              </div>
              <i class="fas fa-chevron-right archive-item-card__chevron"></i>
          </a>`;
    };

    const generateSpotlightCardHTML = (player, statHTML) => {
      const rankClass = player.rank ? (player.rank <= 4 ? `rank-${player.rank}` : (player.rank <= 40 ? 'ranked-6-40' : '')) : '';
      const hasPhoto = typeof player.photoUrl === 'string' && player.photoUrl.trim() !== '';
      const imageHtml = hasPhoto
          ? `<img src="${player.photoUrl.trim()}" alt="${player.name}" class="player-icon" loading="lazy" onerror="this.onerror=null;this.src='/images/default-avatar.png';">`
          : `<div class="player-placeholder-icon"><i class="fas fa-user"></i></div>`;
      const characterIconHtml = player.mainCharacter
          ? `<img src="/images/characters/${player.mainCharacter.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}.png" class="card-character-icon" alt="${player.mainCharacter}" title="${player.mainCharacter}">`
          : '';
      const countryText = player.country ? ` | ${player.country}` : '';
      
      return `
          <a href="/players/${player.slug}/" class="archive-item-card spotlight-card--horizontal archive-item-card--s-plus ${rankClass}">
              <div class="player-card__image-container">${imageHtml}</div>
              <div class="spotlight-text-content">
                  <span class="archive-item-card__name">${player.name}</span>
                  <span class="archive-item-card__date">Rank: ${player.rank || 'N/A'}${countryText}</span>
                  ${statHTML}
              </div>
              ${characterIconHtml}
          </a>`;
    };

    const filterAndSortPlayers = () => {
        let filtered = playerProfiles;
        if (searchTerm) {
            filtered = filtered.filter((p) => p.name.toLowerCase().includes(searchTerm) || (p.mainCharacter || '').toLowerCase().includes(searchTerm) || (p.country || '').toLowerCase().includes(searchTerm));
        }
        if (selectedGame !== "all") filtered = filtered.filter(p => p.game === selectedGame);
        if (selectedCountry !== "all") filtered = filtered.filter(p => p.country === selectedCountry);
        if (selectedCharacter !== "all") filtered = filtered.filter(p => p.mainCharacter === selectedCharacter);
        filtered.sort((a, b) => {
            switch (sortBy) {
                case "rank-asc":  return (a.rank || Infinity) - (b.rank || Infinity);
                case "rank-desc": return (b.rank || 0) - (a.rank || 0);
                case "name-asc":  return a.name.localeCompare(b.name);
                case "name-desc": return b.name.localeCompare(a.name);
                default:          return 0;
            }
        });
        return filtered;
    };

    const renderFilteredItems = () => {
        currentFilteredPlayers = filterAndSortPlayers();
        updateActiveFiltersUI();
        resultsCount.textContent = `${currentFilteredPlayers.length} Players Found`;
        if (currentFilteredPlayers.length === 0) {
            playerGrid.innerHTML = "";
            noResultsMessage.style.display = "block";
            sentinel.style.display = "none";
            return;
        }
        noResultsMessage.style.display = "none";
        playerGrid.innerHTML = currentFilteredPlayers.slice(0, visibleCount).map(player => generateCardHTML(player)).join("");
        sentinel.style.display = visibleCount < currentFilteredPlayers.length ? 'block' : 'none';
        
        highlightTextInElement(searchTerm, playerGrid);

        document.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('click', () => {
                sessionStorage.setItem('playerDirectoryScroll', window.scrollY);
            });
        });
    };

    const handleFilterChange = () => {
        visibleCount = batchSize;
        renderFilteredItems();
        updateURL();
    };
    
    const displayHighestClimber = () => {
      const container = document.getElementById("spotlight-placement-target");
      if (!container) return;

      let highestClimber = null;
      let maxClimb = 0;

      playerProfiles.forEach(player => {
        if (player.historicalData && player.historicalData.length >= 2) {
          const sortedHistory = [...player.historicalData].sort((a, b) => new Date(b.date) - new Date(a.date));
          
          const currentRank = sortedHistory[0].rank;
          const previousRank = sortedHistory[1].rank;
          
          const change = previousRank - currentRank;

          if (change > maxClimb) {
            maxClimb = change;
            highestClimber = player;
          }
        }
      });

      if (highestClimber) {
        const spotlightStatHTML = `
          <span class="spotlight-stat">
            <i class="fas fa-arrow-up"></i> +${maxClimb} Ranks
          </span>
        `;
        const cardHtml = generateSpotlightCardHTML(highestClimber, spotlightStatHTML);
        
        container.innerHTML = `
          <div class="spotlight-row">
            <div class="spotlight-title-container">
              <h2 class="spotlight-heading">Player Spotlight</h2>
              <p class="spotlight-subheading">Recent Standout Performer</p>
            </div>
            <div class="spotlight-card-wrapper">
              ${cardHtml}
            </div>
          </div>
        `;
      }
    };

    const observer = new IntersectionObserver((e) => { if (e[0].isIntersecting && visibleCount < currentFilteredPlayers.length) { visibleCount += batchSize; renderFilteredItems(); } }, { threshold: 1 });
    if (sentinel) observer.observe(sentinel);

    // NEW: Listen for form submission and prevent default behavior
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        searchTerm = searchInput.value.toLowerCase();
        handleFilterChange();
      });
    }

    searchInput.addEventListener("input", debounce((e) => {
        searchTerm = e.target.value.toLowerCase();
        handleFilterChange();
    }, 300));

    searchClearBtn.addEventListener("click", () => { 
      searchInput.value = ""; 
      searchTerm = ""; 
      handleFilterChange(); 
    });
    
    sortBySelect.addEventListener("change", (e) => { sortBy = e.target.value; handleFilterChange(); });
    gameFilter.addEventListener("change", (e) => { selectedGame = e.target.value; handleFilterChange(); });
    countryFilter.addEventListener("change", (e) => { selectedCountry = e.target.value; handleFilterChange(); });
    characterFilter.addEventListener("change", (e) => { selectedCharacter = e.target.value; handleFilterChange(); });

    resetFiltersBtn.addEventListener("click", () => {
        searchInput.value = '';
        gameFilter.value = 'all';
        countryFilter.value = 'all';
        characterFilter.value = 'all';
        sortBySelect.value = 'rank-asc';
        
        searchTerm = '';
        selectedGame = 'all';
        selectedCountry = 'all';
        selectedCharacter = 'all';
        sortBy = 'rank-asc';
        
        const newUrl = window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        handleFilterChange();
    });

    activeFiltersContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-pill-close')) {
            const filterType = e.target.dataset.filterType;
            switch (filterType) {
                case 'game':      gameFilter.value = 'all';      selectedGame = 'all';      break;
                case 'country':   countryFilter.value = 'all';   selectedCountry = 'all';   break;
                case 'character': characterFilter.value = 'all'; selectedCharacter = 'all'; break;
            }
            handleFilterChange();
        }
    });

    populateFilters();
    restoreStateFromURL();
    renderFilteredItems();
    restoreScrollPosition();
    displayHighestClimber();
}

  // --- COLLAPSIBLE FILTER PANEL ---
  function initFilterToggle() {
    const controlsContainer = document.querySelector('.controls-container--archive');
    if (!controlsContainer) return;

    const toggleBtn = document.getElementById('filter-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        toggleBtn.setAttribute('aria-expanded', !isExpanded);
        controlsContainer.classList.toggle('is-open');
      });
    }
  }

  // --- PLAYER PROFILE PAGE - TOOLTIPS ---
  function initPlayerProfileTooltips() {
    if (!document.body.classList.contains('page-player-profile')) return;
    
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'profile-tooltip';
    document.body.appendChild(tooltipElement);

    document.querySelectorAll('.tooltip-icon').forEach(icon => {
      const label = icon.closest('[data-tooltip]');
      if (!label) return;
      
      const tooltipText = label.getAttribute('data-tooltip');
      if (!tooltipText) return;

      label.addEventListener('mouseover', () => {
        tooltipElement.textContent = tooltipText;
        tooltipElement.style.display = 'block';
      });

      label.addEventListener('mousemove', (e) => {
        tooltipElement.style.left = `${e.pageX + 15}px`;
        tooltipElement.style.top = `${e.pageY + 15}px`;
      });

      label.addEventListener('mouseout', () => {
        tooltipElement.style.display = 'none';
      });
    });
  }

  // --- PLAYER PROFILE PAGE - INTERACTIVE STAT MODALS ---
  function initPlayerProfileModals() {
    if (!document.body.classList.contains('page-player-profile') || typeof currentPagePlayer === 'undefined') {
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    modal.innerHTML = `
      <div class="profile-modal__overlay"></div>
      <div class="profile-modal__content">
        <button class="profile-modal__close">&times;</button>
        <h3 class="profile-modal__title"></h3>
        <div class="profile-modal__body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const modalTitle = modal.querySelector('.profile-modal__title');
    const modalBody = modal.querySelector('.profile-modal__body');
    const closeModal = () => modal.classList.remove('is-visible');

    modal.querySelector('.profile-modal__overlay').addEventListener('click', closeModal);
    modal.querySelector('.profile-modal__close').addEventListener('click', closeModal);

    document.querySelectorAll('.stat-item--clickable').forEach(stat => {
      stat.addEventListener('click', (e) => {
        e.preventDefault();
        const modalTarget = stat.dataset.modalTarget;
        const parentLabel = stat.querySelector('.stat-item__label');
        
        modalTitle.innerHTML = parentLabel.innerHTML.replace(/<i class="fas fa-info-circle.*?"><\/i>/g, '').trim();

        let resultsToShow = [];
        switch (modalTarget) {
            case 'victories':
                resultsToShow = currentPagePlayer.results_1yr.filter(r => r.placement === 1);
                break;
            case 'top3':
                resultsToShow = currentPagePlayer.results_1yr.filter(r => r.placement <= 3);
                break;
            case 'top8':
                resultsToShow = currentPagePlayer.results_1yr.filter(r => r.placement <= 8);
                break;
            case 'top16':
                resultsToShow = currentPagePlayer.results_1yr.filter(r => r.placement <= 16);
                break;
            case 'majors':
                resultsToShow = currentPagePlayer.results_1yr.filter(r => r.tier === 'S+' || r.tier === 'S');
                break;
            case 'all_tournaments':
                resultsToShow = currentPagePlayer.results_1yr.filter(r => r.entrants > 1);
                break;
        }

        if (resultsToShow.length > 0) {
          modalBody.innerHTML = `
            <ul class="results-list">
              ${resultsToShow.map(result => `
                <li class="result-row">
                  <div class="result-row__finish">
                    ${result.icon ? result.icon : '#' + result.placement}
                  </div>
                  <div class="result-row__details">
                    <span class="result-row__name">${result.tournament}</span>
                    <span class="result-row__meta">
                      ${new Date(result.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                  </div>
                </li>
              `).join('')}
            </ul>`;
        } else {
            modalBody.innerHTML = `<p>No matching tournament results found in the last 12 months.</p>`;
        }
        
        modal.classList.add('is-visible');
      });
    });
  }

  // --- PLAYER PROFILE PAGE - RANKING HISTORY CHART ---
  function initRankingChart() {
    if (!document.body.classList.contains('page-player-profile') || typeof currentPagePlayer === 'undefined' || typeof Chart === 'undefined') {
        return;
    }

    const ctx = document.getElementById('ranking-chart');
    if (!ctx) return;

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(255, 204, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 204, 0, 0)');

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const historicalData = currentPagePlayer.historicalData || [];
    const top40Data = historicalData.filter(d => {
      const entryDate = new Date(d.date);
      return d.rank > 0 && d.rank <= 40 && entryDate >= oneYearAgo;
    });

    const noDataMessage = document.querySelector('.chart-no-data');
    if (top40Data.length === 0) {
        ctx.style.display = 'none';
        if (noDataMessage) noDataMessage.style.display = 'block';
        return;
    }
    
    if (noDataMessage) noDataMessage.style.display = 'none';
    ctx.style.display = 'block';

    const sortedData = [...top40Data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const ranks = sortedData.map(d => d.rank);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ranking',
                data: ranks,
                borderColor: '#FFCC00',
                backgroundColor: gradient,
                fill: true,
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: '#FFCC00',
                pointBorderColor: '#FFF',
                pointBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                reverse: true,
                min: -1,
                max: 42,
                ticks: {
                  stepSize: 1,
                  callback: function(value) {
                    const shownTicks = [1, 10, 20, 30, 40];
                    if (shownTicks.includes(value)) {
                      return value;
                    }
                    return null;
                  },
                  color: '#9c9c9c',
                  font: { family: 'Poppins', size: 14 }
                },
                grid: {
                  color: function(context) {
                    if (context.tick.value === 8) {
                      return 'rgba(255, 94, 19, 0.5)';
                    }
                    return 'rgba(255, 255, 255, 0.1)';
                  },
                },
                title: {
                  display: true,
                  text: 'Rank',
                  color: '#eee',
                  font: { family: 'Poppins', size: 16 }
                }
              },
              x: {
                ticks: {
                  color: '#9c9c9c',
                  font: { family: 'Poppins', size: 14 }
                },
                grid: { display: false }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  titleColor: '#fff',
                  bodyColor: 'rgba(255, 255, 255, 0.8)',
                  borderColor: '#FFCC00',
                  borderWidth: 1,
                  cornerRadius: 6,
                  displayColors: false,
                  callbacks: {
                      title: (tooltipItems) => tooltipItems[0].label,
                      label: (context) => `Rank #${context.raw}`
                  }
              }
            }
        }
    });
  }

  // --- NEW: AUTO-REFRESH ON INACTIVITY ---
  function initInactivityRefresh() {
      let inactivityTimer;
      // Set timeout to 20 minutes (in milliseconds)
      const TIMEOUT_DURATION = 20 * 60 * 1000; 

      const resetTimer = () => {
          // Clear the previous timer
          clearTimeout(inactivityTimer);
          // Set a new timer
          inactivityTimer = setTimeout(() => {
              // Reload the page when the timer completes
              window.location.reload();
          }, TIMEOUT_DURATION);
      };

      // List of events that indicate user activity
      const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
      
      // Add a listener for each activity event
      activityEvents.forEach(event => {
          document.addEventListener(event, resetTimer, true);
      });

      // Start the initial timer when the page loads
      resetTimer();
  }

  // --- INITIALIZE ALL SCRIPTS ---
  initHamburgerMenu();
  initExpandableTableRows();
  initBackToTopButton();
  initRankingSystemTOC();
  initEventPageScripts();
  initRankingsTable();
  initUpcomingTournaments();
  initTournamentArchive();
  initFilterToggle();
  initPlayerDirectory();
  initPlayerProfileTooltips();
  initPlayerProfileModals();
  initRankingChart();
  // Move this to the end so search inputs are populated first
  initSearchClearButtons();
});