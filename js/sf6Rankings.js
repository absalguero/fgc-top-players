document.addEventListener('DOMContentLoaded', () => {
    const LOCAL_RANKINGS_URL = "/api/sf6-rankings.json";

    function initRankingsTable() {
        const rankingsTableBody = document.querySelector('#rankings-table tbody');
        if (!rankingsTableBody) return;

        // Handle mobile card expansion
        rankingsTableBody.addEventListener('click', (event) => {
            const clickedRow = event.target.closest('tr');

            // If no row was clicked, or the click was on a link, do nothing
            if (!clickedRow || event.target.closest('a')) {
                return;
            }

            // Otherwise, toggle the card open/closed
            clickedRow.classList.toggle('is-open');
        });

        const playerSearchInput = document.getElementById('player-search-input');
        const lastUpdatedEl = document.getElementById('last-updated');

        let allPlayers = [];
        const maxPlayers = 40;
        let currentSortColumn = 0, currentSortDirection = 'asc', currentSortDataType = 'number';

        const urlParams = new URLSearchParams(window.location.search);
        let searchTerm = urlParams.get('q') || '';
        if (searchTerm && playerSearchInput) {
            playerSearchInput.value = searchTerm;
            if (typeof updateClearButtonVisibility === 'function') {
                updateClearButtonVisibility('player-search-input', 'player-search-clear-btn');
            }
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

        const getRankClass = (rank) => {
            if (rank >= 1 && rank <= 5) return `rank-${rank}`;
            if (rank >= 6 && rank <= 20) return 'ranked-6-20';
            return '';
        };

        // Match server-side slugify behavior (uses slugify npm with locale: 'en')
        const createSafeSlug = (name) => {
            if (!name) return '';
            return String(name)
                // Remove emoji
                .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
                .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
                .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
                .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
                .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
                .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
                .replace(/\uFE0F/g, '') // Variation selectors
                // Remove parentheses and special chars
                .replace(/[()'"!:@*+~.]/g, '')
                .trim()
                .toLowerCase()
                // Remove non-ASCII characters (matches slugify with locale: 'en')
                .replace(/[^\x00-\x7F]/g, '')
                // Replace spaces and multiple hyphens
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, ''); // Trim hyphens from ends
        };

        const createRowHtml = (player) => {
            const change = player['Rank Change'] || '';
            let changeClass = '';
            let changeContent = `<i class="fas fa-minus"></i>`;

            if (change === 'New') {
                changeClass = 'change-new';
                changeContent = `<i class="fas fa-star"></i> New`;
            } else if (change.startsWith('+')) {
                changeClass = 'change-up';
                changeContent = `<i class="fas fa-arrow-up"></i> ${change.substring(1)}`;
            } else if (change.startsWith('-')) {
                changeClass = 'change-down';
                changeContent = `<i class="fas fa-arrow-down"></i> ${change.substring(1)}`;
            }

            const rank = parseInt(player.Rank, 10);
            const rankClass = getRankClass(rank);
            // Use English name for slug generation if available
            const slugSource = player['English Name'] || player.Player;
            let playerSlug = createSafeSlug(slugSource);

            // Fallback if slug is empty (CJK-only name with no English translation)
            if (!playerSlug || playerSlug.trim() === '') {
                const playerId = player['Player ID'] || '';
                playerSlug = playerId ? playerId : `player-${rank}`;
            }

            const characterSlug = createSafeSlug(player['Main Character']);

            // Trophy/medal icons for top 4
            let rankIcon = '';
            if (rank === 1) {
                rankIcon = '<i class="fas fa-trophy trophy-1" aria-label="1st"></i>';
            } else if (rank === 2) {
                rankIcon = '<i class="fas fa-trophy trophy-2" aria-label="2nd"></i>';
            } else if (rank === 3) {
                rankIcon = '<i class="fas fa-trophy trophy-3" aria-label="3rd"></i>';
            } else if (rank === 4) {
                rankIcon = '<i class="fas fa-medal medal-4" aria-label="4th"></i>';
            }

            // Format player name with English name in parentheses if available
            const playerDisplayName = player['English Name']
                ? `${player.Player} (${player['English Name']})`
                : player.Player;

            return `
            <tr class="${rankClass}">
                <td data-label="Rank" class="rank-cell expandable-cell">${rankIcon}${player.Rank || 'N/A'}</td>
                <td data-label="Change" class="${changeClass}">${changeContent}</td>
                <td data-label="Player" class="cell-player">
                    <a href="/players/${playerSlug}/">
                        ${playerDisplayName}
                    </a>
                </td>
                <td data-label="Main Character" class="cell-character">
                    <a href="/characters/${characterSlug}/">
                        ${player['Main Character']}
                    </a>
                </td>
                <td data-label="Country" class="col-country">
                    <a href="/player-profiles/?country=${(player.Country || '').toLowerCase()}" class="country-link">
                        <img src="/images/flags/${(player.Country || '').toLowerCase()}.png" alt="${player.Country}" class="country-flag ${rankClass}">
                        <span>${player.Country}</span>
                    </a>
                </td>
                <td data-label="Rating" class="${rankClass}">${player.Rating || '0'}</td>
            </tr>`;
        };

        const renderTable = (playersToRender) => {
            if (playersToRender.length === 0 && searchTerm) {
                rankingsTableBody.innerHTML = '<tr><td colspan="6" class="loading-row">No players found.</td></tr>';
            } else {
                rankingsTableBody.innerHTML = playersToRender.map(createRowHtml).join('');
            }
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
                    aVal = parseFloat(String(aVal).replace(/[^0-9.-]+/g, "")) || 0;
                    bVal = parseFloat(String(bVal).replace(/[^0-9.-]+/g, "")) || 0;
                } else {
                    aVal = String(aVal).toLowerCase();
                    bVal = String(bVal).toLowerCase();
                }
                if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
                return 0;
            });

            renderTable(filteredPlayers);
        };

        const updateSortUI = () => {
            // Only update desktop headers
            document.querySelectorAll('#rankings-table th[data-column-index]').forEach(h => h.classList.remove('sorted', 'asc', 'desc'));
            document.querySelectorAll(`#rankings-table th[data-column-index="${currentSortColumn}"]`).forEach(h => h.classList.add('sorted', currentSortDirection));
        };

        const setupSorting = () => {
            // --- CHANGE 1: Removed '#rankings-mobile-sort .btn' from selector
            document.querySelectorAll('#rankings-table th').forEach(header => {
                header.addEventListener('click', (e) => {
                    const colIndex = parseInt(e.currentTarget.dataset.columnIndex);
                    if (colIndex === currentSortColumn) {
                        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSortColumn = colIndex;
                        currentSortDirection = e.currentTarget.dataset.defaultSort || 'asc';
                        currentSortDataType = e.currentTarget.dataset.type;
                    }
                    refreshTable();
                    updateSortUI();
                });
            });
        };

        // --- CHANGE 2: Added this new function ---
        const setupMobileSorting = () => {
            const mobileSortSelect = document.getElementById('mobile-sort-select');
            if (!mobileSortSelect) return;

            // Set initial value to match the default sort
            mobileSortSelect.value = `${currentSortColumn}-${currentSortDirection}`;

            mobileSortSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const [colIndex, dir] = e.target.value.split('-');
                
                currentSortColumn = parseInt(colIndex, 10);
                currentSortDirection = dir;
                currentSortDataType = selectedOption.dataset.type || 'number';
                
                refreshTable();
                updateSortUI(); // Update desktop headers to stay in sync
            });
        };

        const fetchLocalRankings = async () => {
            const response = await fetch(LOCAL_RANKINGS_URL, { cache: "no-store" });
            if (!response.ok) throw new Error(`Local rankings fetch failed: ${response.status}`);
            const payload = await response.json();
            if (Array.isArray(payload?.players)) {
                if (lastUpdatedEl && payload.lastUpdated) {
                    lastUpdatedEl.textContent = `Last Updated: ${payload.lastUpdated}`;
                }
                return payload.players;
            }
            if (Array.isArray(payload)) return payload;
            return [];
        };

        const fetchData = async () => {
            const createSkeletonRow = () => `<tr class="skeleton-row">
                <td data-label="Rank" class="rank-cell">
                    <div class="skeleton skeleton-circle"></div>
                </td>
                <td data-label="Change">
                    <div class="skeleton skeleton-text skeleton-text--short"></div>
                </td>
                <td data-label="Player" class="cell-player">
                    <div class="skeleton skeleton-text"></div>
                </td>
                <td data-label="Main Character" class="cell-character">
                    <div class="skeleton skeleton-text"></div>
                </td>
                <td data-label="Country" class="col-country">
                    <div class="skeleton skeleton-text skeleton-text--short"></div>
                </td>
                <td data-label="Rating">
                    <div class="skeleton skeleton-text skeleton-text--short"></div>
                </td>
            </tr>`;
            rankingsTableBody.innerHTML = Array(10).fill(null).map(createSkeletonRow).join('');

            try {
                const dataURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315&range=A:H';
                const response = await fetch(`${dataURL}&cachebuster=${Date.now()}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const csvText = await response.text();
                const rawPlayers = parseCSV(csvText);
                allPlayers = rawPlayers.filter(p => {
                    const rank = parseInt(p['Rank'], 10);
                    return !isNaN(rank) && rank >= 1 && rank <= maxPlayers;
                });
                refreshTable();
                updateSortUI();
                setupSorting();
                setupMobileSorting(); // --- CHANGE 3: Call the new function

                if (lastUpdatedEl) {
                    const dateURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315&range=J1';
                    fetch(`${dateURL}&cachebuster=${Date.now()}`).then(res => res.text()).then(text => {
                        lastUpdatedEl.textContent = `Last Updated: ${text.replace(/"/g, '').trim()}`;
                    }).catch(console.error);
                }
            } catch (error) {
                console.error("Failed to fetch live rankings:", error);
                try {
                    const fallbackPlayers = await fetchLocalRankings();
                    if (fallbackPlayers.length > 0) {
                        allPlayers = fallbackPlayers;
                        refreshTable();
                        updateSortUI();
                        setupSorting();
                        setupMobileSorting();
                        return;
                    }
                } catch (localError) {
                    console.error("Failed to load fallback rankings data:", localError);
                }
                rankingsTableBody.innerHTML = '<tr><td colspan="6" class="loading-row error">Failed to load rankings.</td></tr>';
            }
        };

        if (playerSearchInput) {
            if (typeof debounce === 'function') {
                playerSearchInput.addEventListener('input', debounce((e) => {
                    const currentSearchTerm = e.target.value;
                    const newUrl = currentSearchTerm ? `${window.location.pathname}?q=${encodeURIComponent(currentSearchTerm)}` : window.location.pathname;
                    window.history.replaceState({ path: newUrl }, '', newUrl);
                    searchTerm = currentSearchTerm.toLowerCase();
                    refreshTable();
                }, 300));
            }
        }

        fetchData();
    }

    initRankingsTable();
});
