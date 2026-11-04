function initRankingChart() {
  if (!document.body.classList.contains('page-player-profile')) return;
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded');
    return;
  }
  if (typeof currentPagePlayer === 'undefined') {
    console.error('currentPagePlayer data not found');
    return;
  }
  const parseDateSafe = (input) => {
    if (!input) return NaN;
    const d = new Date(input);
    if (!isNaN(d)) return d;
    const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  };

  const canvas = document.getElementById('ranking-chart');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const points = (currentPagePlayer.historicalData || [])
    .map(d => ({ x: parseDateSafe(d.date), y: d.rank }))
    .filter(p => p.x instanceof Date && !isNaN(p.x) && p.y > 0 && p.y <= 40 && p.x >= oneYearAgo)
    .sort((a, b) => a.x - b.x);

  console.log('Historical data points:', points.length);

  const noData = document.querySelector('.chart-no-data');
  const chartCard = canvas.closest('.profile-section--ranking-history');
  if (!points.length) {
    if (chartCard) chartCard.style.display = 'none';
    return;
  } else {
    if (chartCard) chartCard.style.display = '';
    if (noData) noData.style.display = 'none';
    canvas.style.display = 'block';
  }

  const ctx = canvas.getContext('2d');
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Ranking',
        data: points,
        borderColor: '#0096FF',
        backgroundColor: (context) => {
          const { ctx: chartCtx, chartArea } = context.chart;
          if (!chartArea) return 'rgba(0, 150, 255, 0.2)';
          const grad = chartCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, 'rgba(0, 150, 255, 0.4)');
          grad.addColorStop(1, 'rgba(0, 150, 255, 0.0)');
          return grad;
        },
        fill: { value: 41 }, // Explicitly fills down to y = 41 (physical bottom of the reversed y-axis)
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => {
              const d = items?.[0]?.parsed?.x ? new Date(items[0].parsed.x) : null;
              return d ? d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '';
            },
            label: ctx => `Rank #${ctx.raw.y}`
          }
        }
      },
      scales: {
        y: {
          reverse: true,
          min: 0, max: 41,
          ticks: {
            stepSize: 1,
            callback: v => [1,10,20,30,40].includes(v) ? v : null,
            color: '#A0A0A0', font: { size: 14 }
          },
          grid: { color: 'rgba(255,255,255,0.1)' },
          title: { display: true, text: 'Rank', color: '#F5F5F5', font: { size: 18, family: "'Oswald', sans-serif" } }
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
  console.log('Chart initialized successfully');
}

document.addEventListener('DOMContentLoaded', initRankingChart);