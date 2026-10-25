document.addEventListener('DOMContentLoaded', () => {
    const LOCAL_RANKINGS_URL = "/api/sf6-rankings.json";

    function initRankingsTable() {
        const rankingsTableBody = document.querySelector('#rankings-table tbody');
        if (!rankingsTableBody) return;

        // Handle mobile card expansion
        rankingsTableBody.addEventListener('click', (event) => {
            const clickedRow = event.target.closest('tr');
            if (!clickedRow || event.target.closest('a')) {
                return;
            }
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

        const createSafeSlug = (name) => {
            if (!name) return '';
            return String(name)
                .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
                .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
                .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
                .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
                .replace(/[\u{2600}-\u{26FF}]/gu, '')
                .replace(/[\u{2700}-\u{27BF}]/gu, '')
                .replace(/\uFE0F/g, '')
                .replace(/[()'"!:@*+~.]/g, '')
                .trim()
                .toLowerCase()
                .replace(/[^\x00-\x7F]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '');
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

            // 6M Rating Change formatted identically to the Change column
            const rawDelta6m = parseInt(String(player['Rating Change 6M'] || '0').replace(/[^0-9.-]+/g, ''), 10) || 0;
            let change6mClass = '';
            let change6mContent = `<i class="fas fa-minus"></i>`;
            if (rawDelta6m > 0) {
                change6mClass = 'change-up';
                change6mContent = `<i class="fas fa-arrow-up"></i> ${rawDelta6m}`;
            } else if (rawDelta6m < 0) {
                change6mClass = 'change-down';
                change6mContent = `<i class="fas fa-arrow-down"></i> ${Math.abs(rawDelta6m)}`;
            }

            const rank = parseInt(player.Rank, 10);
            const rankClass = getRankClass(rank);
            const slugSource = player['English Name'] || player.Player;
            let playerSlug = createSafeSlug(slugSource);

            if (!playerSlug || playerSlug.trim() === '') {
                const playerId = player['Player ID'] || '';
                playerSlug = playerId ? playerId : `player-${rank}`;
            }

            const characterSlug = createSafeSlug(player['Main Character']);

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
                <td data-label="6M" class="${change6mClass}">${change6mContent}</td>
            </tr>`;
        };

        const renderTable = (playersToRender) => {
            if (playersToRender.length === 0 && searchTerm) {
                rankingsTableBody.innerHTML = '<tr><td colspan="7" class="loading-row">No players found.</td></tr>';
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

            const headersMap = { 0: 'Rank', 1: 'Rank Change', 2: 'Player', 3: 'Main Character', 4: 'Country', 5: 'Rating', 6: 'Rating Change 6M' };
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
            document.querySelectorAll('#rankings-table th[data-column-index]').forEach(h => h.classList.remove('sorted', 'asc', 'desc'));
            document.querySelectorAll(`#rankings-table th[data-column-index="${currentSortColumn}"]`).forEach(h => h.classList.add('sorted', currentSortDirection));
        };

        const setupSorting = () => {
            document.querySelectorAll('#rankings-table th').forEach(header => {
                header.addEventListener('click', (e) => {
                    const colIndex = parseInt(e.currentTarget.dataset.columnIndex, 10);
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

        const setupMobileSorting = () => {
            const mobileSortSelect = document.getElementById('mobile-sort-select');
            if (!mobileSortSelect) return;

            mobileSortSelect.value = `${currentSortColumn}-${currentSortDirection}`;

            mobileSortSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const [colIndex, dir] = e.target.value.split('-');
                
                currentSortColumn = parseInt(colIndex, 10);
                currentSortDirection = dir;
                currentSortDataType = selectedOption.dataset.type || 'number';
                
                refreshTable();
                updateSortUI();
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
                <td data-label="Rank" class="rank-cell"><div class="skeleton skeleton-circle"></div></td>
                <td data-label="Change"><div class="skeleton skeleton-text skeleton-text--short"></div></td>
                <td data-label="Player" class="cell-player"><div class="skeleton skeleton-text"></div></td>
                <td data-label="Main Character" class="cell-character"><div class="skeleton skeleton-text"></div></td>
                <td data-label="Country" class="col-country"><div class="skeleton skeleton-text skeleton-text--short"></div></td>
                <td data-label="Rating"><div class="skeleton skeleton-text skeleton-text--short"></div></td>
                <td data-label="6M"><div class="skeleton skeleton-text skeleton-text--short"></div></td>
            </tr>`;
            rankingsTableBody.innerHTML = Array(10).fill(null).map(createSkeletonRow).join('');

            try {
                const baseSheetURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315';
                const dataURL = `${baseSheetURL}&range=A:H&cachebuster=${Date.now()}`;
                const colKURL = `${baseSheetURL}&range=K:K&cachebuster=${Date.now()}`;

                const [response, colKRes] = await Promise.all([
                    fetch(dataURL),
                    fetch(colKURL).catch(() => null)
                ]);

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const csvText = await response.text();
                const rawPlayers = parseCSV(csvText);

                if (colKRes && colKRes.ok) {
                    const colKText = await colKRes.text();
                    const colKRows = colKText.trim().split('\n').slice(1).map(r => r.replace(/^"|"$/g, '').trim());
                    rawPlayers.forEach((p, idx) => {
                        p['Rating Change 6M'] = colKRows[idx] || '0';
                    });
                }

                allPlayers = rawPlayers.filter(p => {
                    const rank = parseInt(p['Rank'], 10);
                    return !isNaN(rank) && rank >= 1 && rank <= maxPlayers;
                });

                refreshTable();
                updateSortUI();
                setupSorting();
                setupMobileSorting();

                if (lastUpdatedEl) {
                    const dateURL = `${baseSheetURL}&range=J1&cachebuster=${Date.now()}`;
                    fetch(dateURL).then(res => res.text()).then(text => {
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
                rankingsTableBody.innerHTML = '<tr><td colspan="7" class="loading-row error">Failed to load rankings.</td></tr>';
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