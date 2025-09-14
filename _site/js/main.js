document.addEventListener('DOMContentLoaded', () => {

  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
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
        input.addEventListener('input', () => {
          clearBtn.classList.toggle('visible', input.value.length > 0);
        });
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
    if (backToTopBtn) {
      window.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('show', window.scrollY > 200);
      });
      backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // --- RANKING SYSTEM PAGE: TABLE OF CONTENTS & SCROLL-SPY ---
function initRankingSystemTOC() {
  if (!document.body.classList.contains('page-ranking-system')) return;
  
  const tocWrapper = document.querySelector('.page-ranking-system__toc-wrapper');
  const tocToggleBtn = document.querySelector('.toc-toggle-btn');
  const tocLinks = document.querySelectorAll('.toc-list ul li a');
  const isMobile = window.innerWidth < 769;

  // ✅ FIX: Dynamically get the mobile header height instead of using a fixed number.
  // We use a safe fallback of 60px if the header isn't found.
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
          // ✅ FIX: Use the dynamic header height and add a small padding (e.g., 20px).
          const topOffset = isMobile ? mobileHeaderHeight + 20 : 30;
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - topOffset;

          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => { isClickScrolling = false; }, 1000);
        };

        if (isMobile && tocWrapper.classList.contains('is-open')) {
          tocToggleBtn.click();
          setTimeout(calculateAndScroll, 450); // Wait for TOC to close before scrolling
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
    let allPlayers = [], playersToShow = 25, searchTerm = '';
    const playersPerLoad = 25, maxPlayers = 40;
    let currentSortColumn = 0, currentSortDirection = 'asc', currentSortDataType = 'number';

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
            rankingsTableBody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading Rankings...</td></tr>';
            const response = await fetch(`${sheetURL}&cachebuster=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvText = await response.text();
            
            const rawPlayers = parseCSV(csvText);
            
            // ✅ FIX: Extract the last updated date from the first row of data
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
            searchTerm = e.target.value.toLowerCase();
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
    
    const updateAndRender = () => {
      const searchTerm = searchInput.value.trim().toLowerCase();
      const sortBy = sortSelect.value;

      let filteredEvents = tournamentData.filter(event => {
        const searchableText = `${event.name} ${event.dates} ${event.location} ${event.game} ${event.prizes}`.toLowerCase();
        return searchableText.includes(searchTerm);
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
    };

    searchInput.addEventListener('input', debounce(updateAndRender, 300));
    sortSelect.addEventListener('change', updateAndRender);
    updateAndRender();
  }

  // --- TOURNAMENT ARCHIVE PAGE: FILTER, SORT & INFINITE SCROLL ---
function initTournamentArchive() {
    if (!document.body.classList.contains('page-tournament-results')) return;
    if (typeof archiveData === 'undefined' || !Array.isArray(archiveData)) return;

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
        resultsCountEl.textContent = `Showing ${Math.min(visibleCount, filteredEvents.length)} of ${filteredEvents.length} results`;
        noResultsEl.style.display = filteredEvents.length === 0 ? 'block' : 'none';
        if (sentinel) {
            sentinel.style.display = visibleCount >= filteredEvents.length ? 'none' : 'block';
        }
    };

    const updateAndRender = () => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const selectedYear = yearFilter.value;
        const sortBy = sortSelect.value;
        const showRatedOnly = ratedOnlyCheckbox.checked;

        // ✅ FIX: Get the date one year ago.
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        filteredEvents = archiveData.filter(event => {
            const eventDate = new Date(event.date);
            
            const yearMatch = !selectedYear || event.date.startsWith(selectedYear);
            const searchMatch = !searchTerm || `${event.name} ${event.date}`.toLowerCase().includes(searchTerm);
            
            // ✅ FIX: This condition now correctly filters out events older than a year if the checkbox is checked.
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
    };

    const years = [...new Set(archiveData.map(event => event.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
    years.forEach(year => {
        if (year) yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
    });

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
        el.addEventListener(eventType, debounce(updateAndRender, 300));
    });

    updateAndRender();
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

  // --- INITIALIZE ALL SCRIPTS ---
  initHamburgerMenu();
  initExpandableTableRows();
  initSearchClearButtons();
  initBackToTopButton();
  initRankingSystemTOC();
  initEventPageScripts();
  initRankingsTable();
  initUpcomingTournaments();
  initTournamentArchive();
  initFilterToggle();
});