// chart.js

export function drawTempChart(hours, unit) {
    const svg = document.getElementById('temp-chart-svg');
    if (!svg) return;
    const pathLine = svg.querySelector('.temp-line');
    const pathArea = svg.querySelector('.temp-area');
    if (!pathLine || !pathArea) return;
    
    // Use a 12-hour window starting from current hour
    const currentHour = new Date().getHours();
    const displayHours = hours.filter(h => {
        const hHour = parseInt(h.datetime.substring(0, 2));
        return hHour >= currentHour;
    }).slice(0, 12);
    
    if (displayHours.length < 2) return;

    // Use viewBox for responsive scaling instead of clientWidth/Height
    const width = 1000;
    const height = 200;
    const margin = 40;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    const chartWidth = width - margin * 2;
    const chartHeight = height - margin * 2;

    const temps = displayHours.map(h => h.temp);
    const minTemp = Math.min(...temps) - 1;
    const maxTemp = Math.max(...temps) + 1;
    const tempRange = maxTemp - minTemp || 1;

    const points = displayHours.map((h, i) => {
        const x = margin + (i / (displayHours.length - 1)) * chartWidth;
        const y = margin + (1 - (h.temp - minTemp) / tempRange) * chartHeight;
        return { x, y };
    });

    // Line path
    const lineD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    pathLine.setAttribute('d', lineD);

    // Area path
    const areaD = `${lineD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    pathArea.setAttribute('d', areaD);

    // Add points
    svg.querySelectorAll('.temp-point').forEach(p => p.remove());
    points.forEach((p, i) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute('cx', p.x);
        circle.setAttribute('cy', p.y);
        circle.setAttribute('r', 6);
        circle.setAttribute('class', 'temp-point interactive-element');
        
        // Add title for hover tooltip
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${displayHours[i].datetime.substring(0, 5)}: ${displayHours[i].temp}${unit}`;
        circle.appendChild(title);
        
        svg.appendChild(circle);
    });
}
