/* characterGraph.js */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('page-character-profile')) {
        return;
    }

    const radarCtx = document.getElementById('radarChart');
    if (radarCtx && typeof characterData !== 'undefined' && characterData.radar_stats) {
        const labels = ['Damage', 'Health', 'Mobility', 'Zoning', 'Mix-up'];
        const data = [
            characterData.radar_stats.Damage || 0,
            characterData.radar_stats.Health || 0,
            characterData.radar_stats.Mobility || 0,
            characterData.radar_stats.Zoning || 0,
            characterData.radar_stats['Mix-up'] || 0
        ];

        new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: characterData.name,
                    data: data,
                    fill: true,
                    backgroundColor: 'rgba(0, 150, 255, 0.4)',
                    borderColor: 'rgb(0, 150, 255)',
                    pointBackgroundColor: 'rgb(0, 150, 255)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(0, 150, 255)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allows the CSS height change to work
                layout: {
                    padding: 0 // Removes internal Chart.js whitespace
                },
                elements: { line: { borderWidth: 2 } },
                scales: {
                    r: {
                        min: 0,
                        max: 5,
                        angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        pointLabels: { 
                            color: '#f0f0f0', 
                            font: { size: 12, family: "'Oswald', sans-serif" },
                            padding: 5 // Small buffer for text
                        },
                        ticks: {
                            display: false, // Hide the numbers (1, 2, 3, 4, 5) on the web to save space
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
});