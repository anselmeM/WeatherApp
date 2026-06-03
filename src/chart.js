// chart.js

// ⚡ Bolt: Cache DOM elements at module scope to avoid redundant queries on resize
let svg, pathLine, pathArea;

export function drawTempChart(hours, unit) {
    if (!svg) {
        svg = document.getElementById('temp-chart-svg');
        if (svg) {
            pathLine = svg.querySelector('.temp-line');
            pathArea = svg.querySelector('.temp-area');
        }
    }

    if (!svg || !pathLine || !pathArea) return;
    
    // Use a 12-hour window starting from current hour
    const currentHour = new Date().getHours();
    const displayHours = hours.filter(h => {
        const hHour = parseInt(h.datetime.substring(0, 2));
        return hHour >= currentHour;
    }).slice(0, 12);
    
    if (displayHours.length < 2) return;

    // Use viewBox for responsive scaling instead of clientWidth/Height
    const width = 1000;
    const height = 220; // Expanded to accommodate labels comfortably
    const marginY = 50;
    const marginX = 60;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    const chartWidth = width - marginX * 2;
    const chartHeight = height - marginY * 2;

    const temps = displayHours.map(h => h.temp);
    const minTemp = Math.min(...temps) - 1;
    const maxTemp = Math.max(...temps) + 1;
    const tempRange = maxTemp - minTemp || 1;

    const points = displayHours.map((h, i) => {
        const x = marginX + (i / (displayHours.length - 1)) * chartWidth;
        const y = marginY + (1 - (h.temp - minTemp) / tempRange) * chartHeight;
        return { x, y };
    });

    // Clean old dynamic elements
    svg.querySelectorAll('.temp-point, .chart-label, .chart-gridline, .chart-guide-line').forEach(el => el.remove());

    // ⚡ Bolt: Create HTML Tooltip dynamically if it doesn't exist
    let tooltipEl = document.getElementById('chart-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chart-tooltip';
        tooltipEl.className = 'absolute bg-gray-900/90 dark:bg-gray-800/90 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-xl pointer-events-none opacity-0 transition-opacity duration-200 z-50 border border-white/10 flex flex-col gap-0.5';
        document.body.appendChild(tooltipEl);
    }

    // SVG namespace helper
    const svgNS = "http://www.w3.org/2000/svg";

    // 1. Draw horizontal gridlines for min/max/middle reference values
    const gridFragment = document.createDocumentFragment();
    const gridLevels = [0, 0.5, 1];
    gridLevels.forEach(lvl => {
        const yVal = marginY + lvl * chartHeight;
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute('x1', marginX);
        line.setAttribute('y1', yVal);
        line.setAttribute('x2', width - marginX);
        line.setAttribute('y2', yVal);
        line.setAttribute('class', 'chart-gridline stroke-gray-200/50 dark:stroke-gray-700/30');
        line.setAttribute('stroke-width', '1');
        gridFragment.appendChild(line);
    });
    svg.insertBefore(gridFragment, pathArea);

    // 2. Add guide line for interactive hover tracking
    const guideLine = document.createElementNS(svgNS, "line");
    guideLine.setAttribute('class', 'chart-guide-line stroke-blue-500/40 dark:stroke-blue-400/40');
    guideLine.setAttribute('stroke-dasharray', '4 4');
    guideLine.setAttribute('stroke-width', '1.5');
    guideLine.style.opacity = '0';
    svg.insertBefore(guideLine, pathArea);

    // 3. Update main chart line & area paths
    const lineD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    pathLine.setAttribute('d', lineD);

    const areaD = `${lineD} L ${points[points.length - 1].x} ${height - marginY + 10} L ${points[0].x} ${height - marginY + 10} Z`;
    pathArea.setAttribute('d', areaD);

    // 4. Batch labels and interactive dots
    const textAndPointsFragment = document.createDocumentFragment();

    points.forEach((p, i) => {
        const hourData = displayHours[i];
        const displayTimeStr = hourData.datetime.substring(0, 5);

        // A. Time Label (below point)
        const timeText = document.createElementNS(svgNS, "text");
        timeText.setAttribute('x', p.x);
        timeText.setAttribute('y', height - 15);
        timeText.setAttribute('class', 'chart-label text-[11px] font-semibold fill-gray-400 dark:fill-gray-500');
        timeText.setAttribute('text-anchor', 'middle');
        timeText.textContent = displayTimeStr;
        textAndPointsFragment.appendChild(timeText);

        // B. Temperature Label (directly above point)
        const tempText = document.createElementNS(svgNS, "text");
        tempText.setAttribute('x', p.x);
        tempText.setAttribute('y', p.y - 12);
        tempText.setAttribute('class', 'chart-label text-xs font-bold fill-gray-800 dark:fill-gray-200');
        tempText.setAttribute('text-anchor', 'middle');
        tempText.textContent = `${Math.round(hourData.temp)}°`;
        textAndPointsFragment.appendChild(tempText);

        // C. Circle element for interaction
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute('cx', p.x);
        circle.setAttribute('cy', p.y);
        circle.setAttribute('r', 5);
        circle.setAttribute('class', 'temp-point cursor-pointer transition-all duration-150 fill-blue-500 stroke-white dark:stroke-gray-900');
        circle.setAttribute('stroke-width', '2.5');
        
        // 🛡️ Accessibility: Add ARIA attributes and keyboard focus
        const tempStr = `${Math.round(hourData.temp)}${unit}`;
        circle.setAttribute('role', 'img');
        circle.setAttribute('aria-label', `Temperature at ${displayTimeStr} is ${tempStr}`);
        circle.setAttribute('tabindex', '0');

        // Hover events
        circle.addEventListener('mouseenter', (e) => {
            circle.setAttribute('r', '8');
            circle.setAttribute('class', 'temp-point cursor-pointer transition-all duration-150 fill-yellow-500 stroke-white dark:stroke-gray-900');
            guideLine.setAttribute('x1', p.x);
            guideLine.setAttribute('y1', marginY);
            guideLine.setAttribute('x2', p.x);
            guideLine.setAttribute('y2', height - marginY + 10);
            guideLine.style.opacity = '1';

            // Show Custom HTML Tooltip
            tooltipEl.innerHTML = `
                <div class="font-bold text-gray-300">${displayTimeStr}</div>
                <div class="text-sm font-black text-white">${Math.round(hourData.temp)}${unit}</div>
                <div class="text-[10px] text-blue-400 font-semibold flex items-center gap-0.5">
                    <span class="material-icons text-[10px]">water_drop</span> Rain: ${Math.round(hourData.precipprob || 0)}%
                </div>
            `;
            tooltipEl.style.opacity = '1';
        });

        circle.addEventListener('mousemove', (e) => {
            // Position tooltip next to the cursor
            tooltipEl.style.left = `${e.pageX + 15}px`;
            tooltipEl.style.top = `${e.pageY - 15}px`;
        });

        circle.addEventListener('mouseleave', () => {
            circle.setAttribute('r', '5');
            circle.setAttribute('class', 'temp-point cursor-pointer transition-all duration-150 fill-blue-500 stroke-white dark:stroke-gray-900');
            guideLine.style.opacity = '0';
            tooltipEl.style.opacity = '0';
        });

        textAndPointsFragment.appendChild(circle);
    });

    svg.appendChild(textAndPointsFragment);
}

