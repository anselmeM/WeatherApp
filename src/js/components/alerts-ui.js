export function showAlertBanner(alerts) {
  const alertBanner = document.getElementById("weather-alert-banner");
  const alertText = document.getElementById("weather-alert-text");
  if (!alertBanner || !alertText) return;

  if (!alerts || alerts.length === 0) {
    alertBanner.classList.add('-translate-y-44');
    alertBanner.classList.add('hidden');
    return;
  }
  
  // Determine severity of alerts
  const fullText = alerts.map(a => (a.event + " " + a.description).toLowerCase()).join(" ");
  const isSevere = ['warning', 'severe', 'extreme', 'emergency', 'tornado', 'hurricane', 'danger'].some(word => fullText.includes(word));
  
  const iconEl = document.getElementById('weather-alert-icon');
  
  if (isSevere) {
    alertBanner.className = "fixed top-4 left-1/2 -translate-x-1/2 max-w-xl w-[90%] mx-auto bg-red-600/95 dark:bg-red-700/95 backdrop-blur-md text-white px-5 py-4 rounded-3xl shadow-2xl z-40 transform transition-all duration-500 ease-out";
    if (iconEl) iconEl.textContent = "report_problem";
  } else {
    alertBanner.className = "fixed top-4 left-1/2 -translate-x-1/2 max-w-xl w-[90%] mx-auto bg-yellow-500/95 dark:bg-yellow-600/95 backdrop-blur-md text-white px-5 py-4 rounded-3xl shadow-2xl z-40 transform transition-all duration-500 ease-out";
    if (iconEl) iconEl.textContent = "warning";
  }

  const detailsEl = document.getElementById('weather-alert-details');
  const toggleBtn = document.getElementById('toggle-alert-details');

  const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
  );

  if (alerts.length > 1) {
    alertText.textContent = `${alerts.length} Active Weather Alerts`;
    if (detailsEl) {
      detailsEl.innerHTML = alerts.map((alert, i) => 
        `<div class="border-b border-white/20 last:border-0 py-2">
          <div class="font-bold text-sm text-white">${escapeHTML(alert.event) || 'Extreme Weather'}</div>
          <div class="text-xs text-white/80 mt-1">${escapeHTML(alert.description)}</div>
         </div>`
      ).join('');
      detailsEl.classList.remove('hidden');
    }
    if (toggleBtn) toggleBtn.classList.add('hidden');
  } else {
    const alert = alerts[0];
    alertText.textContent = alert.event || 'Weather Alert';
    
    if (detailsEl && alert.description) {
      detailsEl.textContent = alert.description;
      detailsEl.classList.add('hidden');
      if (toggleBtn) {
        toggleBtn.classList.remove('hidden');
        toggleBtn.textContent = 'Read More';
        
        // Re-bind click listener cleanly by cloning button
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.replaceWith(newToggleBtn);
        newToggleBtn.addEventListener('click', () => {
          if (detailsEl.classList.contains('hidden')) {
            detailsEl.classList.remove('hidden');
            newToggleBtn.textContent = 'Show Less';
          } else {
            detailsEl.classList.add('hidden');
            newToggleBtn.textContent = 'Read More';
          }
        });
      }
    } else {
      if (detailsEl) detailsEl.classList.add('hidden');
      if (toggleBtn) toggleBtn.classList.add('hidden');
    }
  }
  
  alertBanner.classList.remove('hidden');
  void alertBanner.offsetWidth; // Trigger reflow
  alertBanner.classList.remove('-translate-y-44');
}
