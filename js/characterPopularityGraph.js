(function() {
  function initPopularityChart() {
    const canvas = document.getElementById("popularity-chart");
    if (!canvas || typeof chartData === 'undefined' || !chartData.popularityHistory) return;

    const history = chartData.popularityHistory;
    if (!history.length) return;

    // Nothing to draw if the character has no usage in any month
    if (!history.some(item => item.value !== null && item.value !== undefined)) return;

    if (typeof Chart === 'undefined') {
      console.error("Chart.js is not loaded.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (canvas._chartInstance) canvas._chartInstance.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(0, 150, 255, 0.4)");
    gradient.addColorStop(1, "rgba(0, 150, 255, 0)");

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [{
          label: "Popularity",
          // Noon local time avoids UTC-midnight parsing shifting points into the previous month.
          data: history.map(item => ({ x: item.date + "T12:00:00", y: item.value })),
          borderColor: "#0096FF",
          backgroundColor: gradient,
          fill: true,
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: (context) => context.raw.y === null ? 0 : 6,
          spanGaps: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (tooltipItem) => tooltipItem.raw.y !== null,
            callbacks: {
              title: (items) => {
                const d = items?.[0]?.parsed?.x ? new Date(items[0].parsed.x) : null;
                return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '';
              },
              label: (ctx) => `TP: ${ctx.raw.y}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              precision: 0,
              color: '#A0A0A0',
              font: { size: 14 }
            },
            grid: { color: 'rgba(255,255,255,0.1)' },
            title: {
              display: true,
              text: 'Popularity',
              color: '#F5F5F5',
              font: { size: 18, family: "'Oswald', sans-serif" }
            }
          },
          x: {
            type: 'time',
            time: { unit: 'month', displayFormats: { month: 'MMM' } },
            ticks: { maxTicksLimit: 8, color: '#A0A0A0', font: { size: 12 }, maxRotation: 0 },
            grid: { display: false }
          }
        }
      }
    });

    canvas._chartInstance = chart;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopularityChart);
  } else {
    initPopularityChart();
  }
})();