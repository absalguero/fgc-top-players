document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const googleSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQBIqTU9Vjqm4lAYt4gGj4QMaxG4eXSsgbDzi2GVHVvrZX0Dba6b1_SlyrVI9ARnlG-xc_b0NVq5lmU/pub?gid=332201631&single=true&output=csv";
    const googleRankingsURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQBIqTU9Vjqm4lAYt4gGj4QMaxG4eXSsgbDzi2GVHVvrZX0Dba6b1_SlyrVI9ARnlG-xc_b0NVq5lmU/pub?gid=1862929315&single=true&output=csv";

    // --- DOM ELEMENTS ---
    const tableBody = document.getElementById('table-body');
    const searchInput = document.getElementById('search-input');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    // --- STATE MANAGEMENT ---
    let allData = [];
    let groupedDataByEvent = {};
    let uniqueEvents = [];
    let currentEventIndex = 0;
    let searchTerm = '';
    let sortedColumn = 'Finish'; // Default sort on page load
    let sortDirection = 'asc';
    let rankingsMap = {};
    let playerIconMap = {};

    // --- DATA FETCHING & PARSING ---
    async function fetchData() {
        try {
            await fetchRankings(); // Load player rankings first
            const response = await fetch(googleSheetURL);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const text = await response.text();
            allData = parseCSV(text);
            groupDataByEvent(allData);
            renderAll();
        } catch (error) {
            console.error("Error fetching data:", error);
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Failed to load data. Please try again later.</td></tr>';
        }
    }

    async function fetchRankings() {
        try {
            const response = await fetch(googleRankingsURL);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const text = await response.text();
            const lines = text.trim().split('\n');
            if (lines.length <= 1) return;

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const rankingsData = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((h, i) => row[h] = values[i]);
                return row;
            });

            rankingsData.forEach(row => {
                const playerName = row['Player'];
                if (playerName) {
                    rankingsMap[playerName] = parseInt(row['Rank'], 10);
                    playerIconMap[playerName] = row['Player Icon'];
                }
            });
        } catch (error) {
            console.error("Error fetching rankings data:", error);
        }
    }

    function parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length <= 1) return [];
        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
        return lines.slice(1).map(line => {
            const values = line.split(',').map(value => value.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, i) => {
                row[header] = values[i];
            });
            return row;
        }).filter(row => row.Player && row.Player !== '');
    }

    function groupDataByEvent(data) {
        const eventDates = {};
        groupedDataByEvent = data.reduce((acc, row) => {
            const eventName = row.Event;
            if (eventName) {
                if (!acc[eventName]) {
                    acc[eventName] = [];
                    eventDates[eventName] = new Date(row.Date);
                }
                acc[eventName].push(row);
            }
            return acc;
        }, {});
        uniqueEvents = Object.keys(groupedDataByEvent).sort((a, b) => eventDates[b] - eventDates[a]);
    }


    // --- SORTING ---
    function sortData(data, column, type, direction) {
        if (!data || !column) return data;
        const order = direction === 'asc' ? 1 : -1;

        return data.sort((a, b) => {
            const valA = a[column];
            const valB = b[column];

            if (type === 'finish') {
                const numA = parseFloat(String(valA).replace(/st|nd|rd|th/g, ''));
                const numB = parseFloat(String(valB).replace(/st|nd|rd|th/g, ''));
                return (numA - numB) * order;
            } else if (type === 'number') {
                return (parseFloat(valA) - parseFloat(valB)) * order;
            }

            return String(valA).localeCompare(String(valB)) * order;
        });
    }

    // --- RENDERING ---
    function renderAll() {
        let dataToRender = [];

        if (searchTerm) {
            dataToRender = allData.filter(item => {
                const eventName = (item.Event || '').toLowerCase();
                const playerName = (item.Player || '').toLowerCase();
                return eventName.includes(searchTerm) || playerName.includes(searchTerm);
            });
        } else {
            const currentEventName = uniqueEvents[currentEventIndex];
            dataToRender = [...(groupedDataByEvent[currentEventName] || [])];
        }
        
        const sortTrigger = document.querySelector(`[data-column-name="${sortedColumn}"]`);
        const sortType = sortTrigger ? sortTrigger.getAttribute('data-type') : 'string';
        dataToRender = sortData(dataToRender, sortedColumn, sortType, sortDirection);

        renderTable(dataToRender);
        updatePaginationControls(dataToRender.length);
        updateHeaderIcons();
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No results found.</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            const playerText = item.Player || '';
            const playerRank = rankingsMap[playerText];
            const playerPhotoUrl = playerIconMap[playerText];
            const shouldShowRankAndPhoto = playerRank >= 1 && playerRank <= 40;

            if (shouldShowRankAndPhoto) {
                if (playerRank <= 5) row.classList.add(`rank-${playerRank}`);
                else row.classList.add('ranked-6-40');
            }

            const playerPhotoHtml = (shouldShowRankAndPhoto && playerPhotoUrl) ?
                `<img src="${playerPhotoUrl}" alt="${item.Player}" class="player-photo">` : '';

            const playerContent = `
                <div class="player-info">
                    ${playerPhotoHtml}
                    <span>${item.Player || ''} ${shouldShowRankAndPhoto ? `(#${playerRank})` : ''}</span>
                </div>`;
            
            // Mobile-first rendering with expandable rows
            row.innerHTML = `
                <td data-label="Event" class="event-cell primary-info-cell">${item.Event || ''}</td>
                <td data-label="Player" class="player-cell primary-info-cell">${playerContent}</td>
                <td data-label="Finish" class="finish-cell primary-info-cell">${item.Finish || ''}</td>
                <td data-label="Date" class="date-cell secondary-info-cell">${formatDate(item.Date)}</td>
                <td data-label="Entrants" class="entrants-cell secondary-info-cell">${item.Entrants || ''}</td>
            `;

            row.addEventListener('click', (e) => {
                // Prevent toggle if a link inside the row is clicked
                if (e.target.tagName !== 'A') {
                    row.classList.toggle('expanded');
                }
            });

            tableBody.appendChild(row);
        });
    }

    function updateHeaderIcons() {
        const headers = document.querySelectorAll('#tournament-results-table thead th, .mobile-sort-btn');
        headers.forEach(header => {
            const columnName = header.getAttribute('data-column-name');
            header.classList.remove('sorted', 'asc', 'desc');
            if (columnName === sortedColumn) {
                header.classList.add('sorted', sortDirection);
            }
        });
    }

    function updatePaginationControls(filteredCount) {
        if (searchTerm) {
            pageInfo.textContent = `Showing ${filteredCount} results`;
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            const totalEvents = uniqueEvents.length;
            prevBtn.style.display = 'inline-block';
            nextBtn.style.display = 'inline-block';
            if (totalEvents > 0) {
                pageInfo.textContent = `Event: ${uniqueEvents[currentEventIndex]} (${currentEventIndex + 1} of ${totalEvents})`;
            } else {
                pageInfo.textContent = '';
            }
            prevBtn.disabled = currentEventIndex === 0;
            nextBtn.disabled = currentEventIndex === totalEvents - 1 || totalEvents === 0;
        }
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // --- EVENT LISTENERS ---
    
    // Combined listener for both desktop headers and mobile buttons
    const sortTriggers = document.querySelectorAll('#tournament-results-table th, .mobile-sort-btn');
    sortTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const columnName = trigger.getAttribute('data-column-name');
            if (sortedColumn === columnName) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortedColumn = columnName;
                sortDirection = (columnName === 'Date' || columnName === 'Entrants') ? 'desc' : 'asc';
            }
            renderAll();
        });
    });

    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderAll();
    });

    prevBtn.addEventListener('click', () => {
        if (currentEventIndex > 0) {
            currentEventIndex--;
            renderAll();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentEventIndex < uniqueEvents.length - 1) {
            currentEventIndex++;
            renderAll();
        }
    });

    // --- INITIALIZATION ---
    fetchData();
});