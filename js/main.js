document.addEventListener('DOMContentLoaded', () => {

    /**
     * Helper function to delay execution of another function.
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Initializes the mobile hamburger menu toggle.
     */
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

    /**
     * Initializes the expandable rows for the mobile rankings table.
     */
    function initExpandableTableRows() {
        const rankingsTable = document.getElementById('rankings-table');
        if (rankingsTable && rankingsTable.querySelector('tbody')) {
            rankingsTable.querySelector('tbody').addEventListener('click', (event) => {
                if (event.target.closest('a')) return;
                const clickedRow = event.target.closest('tr');
                if (clickedRow) {
                    clickedRow.classList.toggle('is-expanded');
                }
            });
        }
    }

    /**
     * Sets up the clear button functionality for search input fields.
     */
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

    /**
     * Initializes the "Back to Top" button.
     */
    function initBackToTopButton() {
        const backToTopBtn = document.getElementById('back-to-top-btn');
        if (backToTopBtn) {
            window.addEventListener('scroll', () => {
                backToTopBtn.classList.toggle('show', window.scrollY > 400);
            });
            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    /**
     * Initializes the mobile Table of Contents toggle on the Ranking System page.
     */
    function initRankingSystemTOC() {
        if (!document.body.classList.contains('page-ranking-system')) {
            return;
        }

        const toggleBtn = document.querySelector('.toc-toggle-btn');
        const tocList = document.querySelector('.toc-list');
        const mobileHeader = document.querySelector('.mobile-header');

        if (toggleBtn && tocList) {
            toggleBtn.addEventListener('click', function() {
                const isActive = this.classList.toggle('is-active');
                tocList.classList.toggle('is-active');
                this.setAttribute('aria-expanded', isActive);
            });
        }
        
        const tocLinks = document.querySelectorAll('.page-ranking-system .toc a[href^="#"]');
        if(tocLinks.length > 0 && mobileHeader) {
            tocLinks.forEach(link => {
                link.addEventListener('click', function(event) {
                    event.preventDefault();
                    const targetElement = document.querySelector(this.getAttribute('href'));
                    if (targetElement) {
                        const headerHeight = mobileHeader.offsetHeight;
                        const offsetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                });
            });
        }
    }
    
    /**
     * Handles responsive positioning of the tournament navigation bar.
     */
    function initResponsiveTournamentNav() {
        const handleLayout = () => {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const mobileHeader = document.querySelector('.mobile-header');
            const tournamentNav = document.querySelector('.tournament-nav');
            const pageTitle = document.querySelector('.page-tournament-results h1');

            if (tournamentNav && pageTitle && mobileHeader) {
                if (isMobile) {
                    mobileHeader.after(tournamentNav);
                } else {
                    pageTitle.after(tournamentNav);
                }
            }
        };
        handleLayout();
        window.addEventListener('resize', handleLayout);
    }
    
    /**
     * Initializes all scripts specific to the individual Event page.
     */
    function initEventPageScripts() {
        if (!document.body.classList.contains('page-event')) return;

        // Blurry background for event images
        document.querySelectorAll('.event-image-container').forEach(container => {
            const img = container.querySelector('img');
            if (img && img.src) {
                container.style.setProperty('--bg-image-url', `url(${img.src})`);
            }
        });

        // Mobile-Only Shrinking Header Script
        const stickyHeader = document.querySelector('.header-sticky-container');
        if (stickyHeader) {
             const h1 = stickyHeader.querySelector('h1');
             const meta = stickyHeader.querySelector('.event-header__meta');
             const imageContainer = stickyHeader.querySelector('.event-image-container');
 
             const scrollHandler = () => {
                 const isMobile = window.matchMedia('(max-width: 768px)').matches;
                 if (!isMobile) {
                     h1.style.cssText = '';
                     imageContainer.style.cssText = '';
                     meta.style.cssText = '';
                     stickyHeader.classList.remove('is-shrunk');
                     return;
                 }
                 const transitionEnd = 150;
                 const progress = Math.min(1, window.scrollY / transitionEnd);
                 const h1Start = 2.2, h1End = 1.5;
                 const imgStart = stickyHeader.offsetWidth * 0.8, imgEnd = 70;
                 const newH1Size = h1Start - (h1Start - h1End) * progress;
                 const newImgWidth = imgStart - (imgStart - imgEnd) * progress;
 
                 h1.style.fontSize = `${newH1Size}rem`;
                 imageContainer.style.maxWidth = `${newImgWidth}px`;
                 meta.style.opacity = 1 - progress;
                 
                 stickyHeader.classList.toggle('is-shrunk', progress === 1);
             };
             
             window.addEventListener('scroll', scrollHandler, { passive: true });
             window.addEventListener('resize', scrollHandler, { passive: true });
        }
        
        const eventHeaderGroup = document.querySelector('.event-header-group');
        if (eventHeaderGroup) {
            window.addEventListener('scroll', () => {
                eventHeaderGroup.classList.toggle('is-scrolled', window.scrollY > 10);
            });
        }

        // Infinite Scroll for Event Results
        const resultsGrid = document.getElementById('results-grid');
        if (resultsGrid) {
            const sentinel = document.getElementById('sentinel');
            const resultsPerPage = 16;
            const allCards = Array.from(resultsGrid.querySelectorAll('.result-card'));
            let visibleCount = resultsPerPage;

            const updateVisibility = () => {
                allCards.forEach((card, index) => {
                    card.style.display = (index < visibleCount) ? 'flex' : 'none';
                });

                if (sentinel) {
                    sentinel.style.display = (visibleCount >= allCards.length) ? 'none' : 'block';
                }
            };

            if (allCards.length <= resultsPerPage) {
                if (sentinel) sentinel.style.display = 'none';
                return;
            }

            const observer = new IntersectionObserver(entries => {
                if (entries[0].isIntersecting && visibleCount < allCards.length) {
                    visibleCount += resultsPerPage;
                    updateVisibility();
                }
            }, { threshold: 1.0 });

            if (sentinel) {
                observer.observe(sentinel);
            }
            
            updateVisibility();
        }
    }

    /**
     * Initializes the main rankings table, fetching data from Google Sheets.
     */
    function initRankingsTable() {
        const rankingsTableBody = document.querySelector('#rankings-table tbody');
        if (!rankingsTableBody) return;

        const sheetURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315';
        const playerSearchInput = document.getElementById('player-search-input');
        const sentinel = document.getElementById('sentinel');
        let allPlayers = [], playersToShow = 10, searchTerm = '';
        const playersPerLoad = 10, maxPlayers = 40;
        let currentSortColumn = 0, currentSortDirection = 'asc', currentSortDataType = 'number';

        const refreshTable = () => {
            let filteredPlayers = searchTerm ? allPlayers.filter(p => 
                (p['Player'] || '').toLowerCase().includes(searchTerm) ||
                (p['Main Character'] || '').toLowerCase().includes(searchTerm) ||
                (p['Country'] || '').toLowerCase().includes(searchTerm)
            ) : allPlayers;
            
            const sortedPlayers = sortPlayers(filteredPlayers);
            renderTable(sortedPlayers.slice(0, playersToShow));
            if (sentinel) {
                sentinel.style.display = playersToShow < sortedPlayers.length ? 'block' : 'none';
            }
        };
        
        const debouncedSearch = debounce((e) => {
            searchTerm = e.target.value.toLowerCase();
            playersToShow = 10;
            refreshTable();
        }, 300);
        
        if (playerSearchInput) playerSearchInput.addEventListener('input', debouncedSearch);

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

            return `
                <td data-label="Rank" class="rank-cell expandable-cell">${player['Rank'] || 'N/A'}</td>
                <td data-label="Change" class="cell-hidden-mobile">${changeContent}</td>
                <td data-label="Player" class="cell-player"><div class="player-cell-content"><img src="${player['Player Icon'] || ''}" alt="${player['Player']}" class="player-icon" onerror="this.style.display='none'"><span>${highlight(player['Player'])}</span></div></td>
                <td data-label="Main Character" class="cell-character cell-hidden-mobile"><div class="player-cell-content"><img src="/images/characters/${(player['Main Character'] || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}.png" alt="${player['Main Character']}" class="character-icon" onerror="this.style.display='none'"><span>${highlight(player['Main Character'])}</span></div></td>
                <td data-label="Country" class="cell-center cell-hidden-mobile"><div class="player-cell-content"><img src="/images/flags/${(player['Country'] || '').toLowerCase()}.png" alt="${player['Country']}" class="flag-icon" onerror="this.style.display='none'"><span>${highlight(player['Country'])}</span></div></td>
                <td data-label="Rating">${player['Rating'] || '0'}</td>
            `;
        };
        
        const renderTable = (playersToRender) => {
            rankingsTableBody.innerHTML = '';
            if (playersToRender.length === 0) {
                rankingsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No players found.</td></tr>';
                return;
            }
            playersToRender.forEach(player => {
                const rank = parseInt(player['Rank'], 10);
                if (isNaN(rank)) return;
                const row = document.createElement('tr');
                if (rank <= 4) row.classList.add(`rank-${rank}`);
                else if (rank <= 40) row.classList.add('ranked-6-40');
                row.innerHTML = createRowHtml(player);
                rankingsTableBody.appendChild(row);
            });
        };

        const sortPlayers = (playersArray) => {
            const headersMap = { 0: 'Rank', 1: 'Rank Change', 2: 'Player', 3: 'Main Character', 4: 'Country', 5: 'Rating' };
            const key = headersMap[currentSortColumn];
            return [...playersArray].sort((a, b) => {
                let aVal = a[key], bVal = b[key];
                if (currentSortDataType === 'number') {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                } else {
                    aVal = String(aVal).toLowerCase();
                    bVal = String(bVal).toLowerCase();
                }
                if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        };
        
        const updateSortUI = () => {
            document.querySelectorAll('[data-column-index]').forEach(h => h.classList.remove('sorted', 'asc', 'desc'));
            document.querySelectorAll(`[data-column-index="${currentSortColumn}"]`).forEach(h => h.classList.add('sorted', currentSortDirection));
        };

        const setupSorting = () => {
            document.querySelectorAll('#rankings-table th, #rankings-mobile-sort .btn').forEach(header => {
                header.addEventListener('click', (e) => {
                    const colIndex = parseInt(e.currentTarget.getAttribute('data-column-index'));
                    if (colIndex === currentSortColumn) {
                        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSortColumn = colIndex;
                        currentSortDirection = 'asc';
                        currentSortDataType = e.currentTarget.getAttribute('data-type');
                    }
                    playersToShow = 10;
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
                allPlayers = parseCSV(csvText).filter(p => {
                    const rank = parseInt(p['Rank'], 10);
                    return !isNaN(rank) && rank >= 1 && rank <= maxPlayers;
                });
                refreshTable();
                updateSortUI();
                setupSorting();
            } catch (error) {
                console.error("Failed to fetch live rankings:", error);
                
                // --- FALLBACK LOGIC ---
                if (window.cachedRankingsData && window.cachedRankingsData.length > 0) {
                    console.log("Live fetch failed. Using cached data as a fallback.");
                    
                    // Add a warning message to the user
                    const title = document.querySelector('.page-rankings h1');
                    if(title) {
                        const warningEl = document.createElement('p');
                        warningEl.innerHTML = '⚠️ Could not load live data. Showing last saved rankings.';
                        warningEl.style.color = '#f39c12'; // A nice warning color
                        warningEl.style.textAlign = 'center';
                        warningEl.style.fontSize = '1rem';
                        warningEl.style.marginTop = '-0.5rem';
                        title.after(warningEl);
                    }
                    
                    allPlayers = window.cachedRankingsData; // Use the cached data
                    
                    // Render the table with the fallback data
                    refreshTable();
                    updateSortUI();
                    setupSorting();
                } else {
                    // Original error message if no fallback is available
                    rankingsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Failed to load data. No cache available.</td></tr>';
                }
            }
        };

        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && playersToShow < allPlayers.length) {
                playersToShow = Math.min(playersToShow + playersPerLoad, maxPlayers);
                refreshTable();
            }
        }, { threshold: 1.0 });

        if (sentinel) observer.observe(sentinel);
        fetchData();
    }
    
    /**
     * Initializes the tournament archive search with infinite scroll.
     */
    function initTournamentSearch() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;

        const resultsCountEl = document.getElementById('results-count');
        const noResultsEl = document.getElementById('no-results-message');
        const sentinel = document.querySelector('.sentinel');
        const allItems = Array.from(document.querySelectorAll('.js-load-more-item'));
        const itemsPerLoad = 18;

        const allTournamentData = allItems.map(item => ({
            element: item,
            name: item.dataset.name.toLowerCase(),
            date: item.dataset.dateReadable.toLowerCase()
        }));

        let visibleItemCount = itemsPerLoad;
        let filteredItems = allTournamentData;

        const updateVisibility = () => {
            const searchTerm = searchInput.value.trim().toLowerCase();
            noResultsEl.style.display = filteredItems.length === 0 ? 'block' : 'none';
            allItems.forEach(item => item.style.display = 'none');
            
            filteredItems.slice(0, visibleItemCount).forEach(data => {
                data.element.style.display = 'flex';
                // Highlighting
                data.element.querySelectorAll('.js-searchable-text').forEach(textNode => {
                    const originalText = textNode.textContent;
                    textNode.innerHTML = searchTerm 
                        ? originalText.replace(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), `<mark>$1</mark>`)
                        : originalText;
                });
            });

            if(resultsCountEl) {
                resultsCountEl.textContent = searchTerm
                    ? `Showing ${Math.min(visibleItemCount, filteredItems.length)} of ${filteredItems.length} results`
                    : `${allTournamentData.length} total tournaments`;
            }
        };

        const applySearch = () => {
            const searchTerm = searchInput.value.trim().toLowerCase();
            filteredItems = searchTerm
                ? allTournamentData.filter(data => data.name.includes(searchTerm) || data.date.includes(searchTerm))
                : allTournamentData;
            visibleItemCount = itemsPerLoad;
            updateVisibility();
        };

        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && visibleItemCount < filteredItems.length) {
                visibleItemCount += itemsPerLoad;
                updateVisibility();
            }
        }, { threshold: 1.0 });

        if (sentinel) observer.observe(sentinel);
        searchInput.addEventListener('input', debounce(applySearch, 300));
        updateVisibility(); // Initial call
    }

    // Initialize all site scripts
    initHamburgerMenu();
    initExpandableTableRows();
    initSearchClearButtons();
    initBackToTopButton();
    initRankingSystemTOC();
    initResponsiveTournamentNav();
    initEventPageScripts();
    
    // Initialize page-specific complex scripts
    initRankingsTable();
    initTournamentSearch();
});
