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

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
    gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [{
          label: "Popularity",
          // Noon local time avoids UTC-midnight parsing shifting points into the previous month.
          data: history.map(item => ({ x: item.date + "T12:00:00", y: item.value })),
          borderColor: "#3b82f6",
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          // Hide points and hover rings during null/pre-release months
          pointRadius: (context) => context.raw.y === null ? 0 : 3,
          pointHoverRadius: (context) => context.raw.y === null ? 0 : 6,
          spanGaps: false,
          clip: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, bottom: 4, right: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                const date = new Date(context[0].parsed.x);
                return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              },
              label: (context) => `TP: ${context.parsed.y}`
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'month', displayFormats: { month: 'MMM' } },
            ticks: { maxTicksLimit: 8, color: '#A0A0A0', font: { size: 12 }, maxRotation: 0 },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 20, precision: 0, color: '#A0A0A0', font: { size: 12 } },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
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