import { authFetch, storeAuth } from './auth.js';

// Cosmic Weather Journal State Configuration
const weatherJournalData = {
    clear: {
        city: 'Miami',
        region: 'Subtropical Atlantic Basin',
        temp: '82°F',
        tempC: '28°C',
        barometer: '1024 hPa',
        baroVal: 1024,
        desc: 'Solaris / Clear & Unobstructed',
        humidity: '52%',
        wind: '09 mph / NE',
        alert: 'High solar radiation detected. UV index is critical.',
        gageAccent: '#b89047', // Brass / Gold
        ambientGlow: 'rgba(184, 144, 71, 0.05)'
    },
    rain: {
        city: 'Seattle',
        region: 'Pacific Northwest Rainforest',
        temp: '58°F',
        tempC: '14°C',
        barometer: '1008 hPa',
        baroVal: 1008,
        desc: 'Imber / Moderate Precipitation',
        humidity: '88%',
        wind: '14 mph / SSW',
        alert: 'Steady precipitation active. High humidity saturating topsoils.',
        gageAccent: '#5a7b8c', // Muted Blue
        ambientGlow: 'rgba(90, 123, 140, 0.06)'
    },
    snow: {
        city: 'Aspen',
        region: 'Rocky Mountain Range',
        temp: '26°F',
        tempC: '-3°C',
        barometer: '1018 hPa',
        baroVal: 1018,
        desc: 'Nivalis / Light Cryospheric Fall',
        humidity: '74%',
        wind: '06 mph / W',
        alert: 'Sub-zero temperatures. Frost formation on exposed surfaces.',
        gageAccent: '#8fa9c4', // Muted Ice Blue
        ambientGlow: 'rgba(143, 169, 196, 0.05)'
    },
    storm: {
        city: 'Houston',
        region: 'Gulf Coast Meteorology',
        temp: '76°F',
        tempC: '24°C',
        barometer: '985 hPa',
        baroVal: 985,
        desc: 'Procella / Severe Cyclonic Disturbances',
        humidity: '94%',
        wind: '28 mph / ENE',
        alert: 'Severe cyclonic warning. Rapidly falling pressure. Shelter indoors.',
        gageAccent: '#7c5c96', // Slate Violet
        ambientGlow: 'rgba(124, 92, 150, 0.06)'
    }
};

let activeState = 'clear';

// --- CANVAS METEOROLOGICAL GAGE IMPLEMENTATION ---
class MeteorologicalGage {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Interaction state
        this.mouseX = this.width / 2;
        this.mouseY = this.height / 2;
        this.targetMouseX = this.width / 2;
        this.targetMouseY = this.height / 2;
        this.isHovered = false;
        this.mouseSpeed = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Needle physics
        this.currentBaroVal = weatherJournalData.clear.baroVal;
        this.targetBaroVal = weatherJournalData.clear.baroVal;
        this.needleAngle = 0;
        this.targetNeedleAngle = 0;
        this.needleVelocity = 0;
        this.springTension = 0.035;
        this.damping = 0.85;

        // Wind stream particles
        this.particles = [];
        this.maxParticles = 35;

        this.init();
    }

    init() {
        // Track mouse position over the canvas parent card
        const card = this.canvas.closest('.gage-card');
        if (card) {
            card.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                this.targetMouseX = e.clientX - rect.left;
                this.targetMouseY = e.clientY - rect.top;
                
                // Calculate cursor movement velocity
                const dx = this.targetMouseX - this.lastMouseX;
                const dy = this.targetMouseY - this.lastMouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                this.mouseSpeed = Math.min(dist, 40); // Cap speed
                
                this.lastMouseX = this.targetMouseX;
                this.lastMouseY = this.targetMouseY;
                this.isHovered = true;
            });

            card.addEventListener('mouseenter', () => {
                this.isHovered = true;
            });

            card.addEventListener('mouseleave', () => {
                this.isHovered = false;
                this.mouseSpeed = 0;
                this.targetMouseX = this.width / 2;
                this.targetMouseY = this.height / 2;
            });
        }

        // Initialize particles
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle(true));
        }

        // Start render loop
        this.tick = this.tick.bind(this);
        requestAnimationFrame(this.tick);
    }

    createParticle(randomStart = false) {
        const angle = Math.random() * Math.PI * 2;
        const radius = randomStart ? Math.random() * (this.width / 2) : (this.width / 2) + 20;
        return {
            x: (this.width / 2) + Math.cos(angle) * radius,
            y: (this.height / 2) + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
            life: Math.random() * 0.8 + 0.2,
            maxLife: 1.0,
            speed: Math.random() * 1.5 + 0.5,
            size: Math.random() * 1.2 + 0.5
        };
    }

    update(stateData) {
        this.targetBaroVal = stateData.baroVal;
    }

    tick(timestamp) {
        if (!this.canvas) return;

        // Resize support if needed
        const currentWidth = this.canvas.clientWidth;
        if (currentWidth !== this.width && currentWidth > 0) {
            this.canvas.width = currentWidth;
            this.canvas.height = currentWidth; // keep square
            this.width = currentWidth;
            this.height = currentWidth;
        }

        this.ctx.clearRect(0, 0, this.width, this.height);

        // Smooth mouse positions
        this.mouseX += (this.targetMouseX - this.mouseX) * 0.12;
        this.mouseY += (this.targetMouseY - this.mouseY) * 0.12;

        const stateData = weatherJournalData[activeState];
        const accentColor = stateData.gageAccent;

        // Draw structural elements
        this.drawOuterRing();
        this.drawAtmosphericGrid();
        this.drawWindParticles(accentColor);
        this.drawBarometerDial(accentColor);
        this.drawNeedlePhysics(stateData, timestamp);
        this.drawCentralPivot(accentColor);

        requestAnimationFrame(this.tick);
    }

    drawOuterRing() {
        const center = this.width / 2;
        const radius = (this.width / 2) - 20;

        // Outer clean circle
        this.ctx.beginPath();
        this.ctx.arc(center, center, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Inner nested sub-ring
        this.ctx.beginPath();
        this.ctx.arc(center, center, radius - 8, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.04)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    drawAtmosphericGrid() {
        const center = this.width / 2;
        const radius = (this.width / 2) - 28;

        // Micro concentric rings (isobars)
        for (let r = 0.2; r < 1.0; r += 0.2) {
            this.ctx.beginPath();
            this.ctx.arc(center, center, radius * r, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.03)';
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
        }

        // Draw compass crosshairs
        this.ctx.beginPath();
        this.ctx.moveTo(center - radius, center);
        this.ctx.lineTo(center + radius, center);
        this.ctx.moveTo(center, center - radius);
        this.ctx.lineTo(center, center + radius);
        this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.02)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    drawBarometerDial(accentColor) {
        const center = this.width / 2;
        const radius = (this.width / 2) - 28;

        // Pressure ranges: 970 hPa to 1050 hPa
        // Arc spans from -135deg to +135deg (facing upwards)
        const startAngle = -Math.PI * 1.25;
        const endAngle = Math.PI * 0.25;
        const totalAngle = endAngle - startAngle;

        this.ctx.save();
        this.ctx.translate(center, center);

        // Draw ticks
        const totalTicks = 80; // Every 1 hPa
        for (let i = 0; i <= totalTicks; i++) {
            const tickAngle = startAngle + (totalAngle * (i / totalTicks));
            const isMajor = i % 10 === 0;
            const isMedium = i % 5 === 0 && !isMajor;

            let length = 4;
            let alpha = 0.15;
            if (isMajor) {
                length = 10;
                alpha = 0.45;
            } else if (isMedium) {
                length = 7;
                alpha = 0.25;
            }

            const xStart = Math.cos(tickAngle) * radius;
            const yStart = Math.sin(tickAngle) * radius;
            const xEnd = Math.cos(tickAngle) * (radius - length);
            const yEnd = Math.sin(tickAngle) * (radius - length);

            this.ctx.beginPath();
            this.ctx.moveTo(xStart, yStart);
            this.ctx.lineTo(xEnd, yEnd);
            this.ctx.strokeStyle = isMajor ? `rgba(15, 23, 42, ${alpha})` : `rgba(15, 23, 42, ${alpha})`;
            this.ctx.lineWidth = isMajor ? 1.5 : 1;
            this.ctx.stroke();

            // Label major values (970, 980, ..., 1050)
            if (isMajor) {
                const labelVal = Math.round(970 + (i / totalTicks) * 80);
                const labelRadius = radius - 20;
                const xLabel = Math.cos(tickAngle) * labelRadius;
                const yLabel = Math.sin(tickAngle) * labelRadius;

                this.ctx.font = '500 8px "Plus Jakarta Sans"';
                this.ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(labelVal.toString(), xLabel, yLabel);
            }
        }

        // Draw Dial Title
        this.ctx.font = '600 6px "Plus Jakarta Sans"';
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
        this.ctx.letterSpacing = '1px';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BAROMETRIC PRESSURE', 0, radius * 0.4);

        this.ctx.font = 'italic 500 8px "Cormorant Garamond"';
        this.ctx.fillStyle = accentColor;
        this.ctx.fillText('Cosmic Weather Journal', 0, radius * 0.52);

        this.ctx.restore();
    }

    drawNeedlePhysics(stateData, timestamp) {
        const center = this.width / 2;
        const radius = (this.width / 2) - 28;

        // 1. Calculate Target Pressure Angle
        const startAngle = -Math.PI * 1.25;
        const endAngle = Math.PI * 0.25;
        const totalAngle = endAngle - startAngle;

        // Map pressure value (970 - 1050) to the angle range
        const mappedAngle = startAngle + totalAngle * ((this.targetBaroVal - 970) / 80);
        this.targetNeedleAngle = mappedAngle;

        // 2. Add kinetic deflection from mouse speed
        if (this.isHovered && this.mouseSpeed > 0.5) {
            const oscillation = Math.sin(timestamp * 0.015) * (this.mouseSpeed * 0.003);
            this.targetNeedleAngle += oscillation;
        }

        // 3. Smooth Needle movement via Spring Physics
        const angleDiff = this.targetNeedleAngle - this.needleAngle;
        const springForce = angleDiff * this.springTension;
        this.needleVelocity += springForce;
        this.needleVelocity *= this.damping;
        this.needleAngle += this.needleVelocity;

        // 4. Draw Needle line
        this.ctx.save();
        this.ctx.translate(center, center);
        this.ctx.rotate(this.needleAngle);

        this.ctx.beginPath();
        this.ctx.moveTo(0, 5); // tiny tail
        this.ctx.lineTo(0, -radius + 8); // pointy tip
        this.ctx.strokeStyle = '#0f172a';
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();

        // Tip arrow/accent
        this.ctx.beginPath();
        this.ctx.moveTo(-3, -radius + 15);
        this.ctx.lineTo(0, -radius + 8);
        this.ctx.lineTo(3, -radius + 15);
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fill();

        this.ctx.restore();
    }

    drawCentralPivot(accentColor) {
        const center = this.width / 2;

        // Base disk
        this.ctx.beginPath();
        this.ctx.arc(center, center, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fill();

        // Outer brass ring
        this.ctx.beginPath();
        this.ctx.arc(center, center, 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = accentColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Center dot
        this.ctx.beginPath();
        this.ctx.arc(center, center, 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#faf9f6';
        this.ctx.fill();
    }

    drawWindParticles(accentColor) {
        const center = this.width / 2;
        const radius = (this.width / 2) - 20;

        this.particles.forEach((p, idx) => {
            let targetX = this.mouseX;
            let targetY = this.mouseY;

            // If mouse is not hovered, drift gently in orbit
            if (!this.isHovered) {
                const angleOffset = (timestamp) => (timestamp * 0.0002 + idx * 0.15);
                const t = performance.now();
                targetX = center + Math.cos(angleOffset(t)) * (radius * 0.6);
                targetY = center + Math.sin(angleOffset(t)) * (radius * 0.6);
            }

            // Head towards target
            const dx = targetX - p.x;
            const dy = targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
                // Respawn particle
                this.particles[idx] = this.createParticle(false);
                return;
            }

            p.vx += (dx / dist) * p.speed * 0.15;
            p.vy += (dy / dist) * p.speed * 0.15;

            // Damping velocity
            p.vx *= 0.92;
            p.vy *= 0.92;

            p.x += p.vx;
            p.y += p.vy;

            // Draw fading path line
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5);
            this.ctx.strokeStyle = `rgba(15, 23, 42, ${p.life * 0.15})`;
            this.ctx.lineWidth = p.size;
            this.ctx.stroke();

            // Draw glowing head dot
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
            this.ctx.fillStyle = accentColor;
            this.ctx.fill();
        });
    }
}

// --- STATE MANAGEMENT AND INTERACTIVE BINDINGS ---

let gageInstance = null;

function switchWeatherState(state) {
    const data = weatherJournalData[state];
    if (!data) return;

    activeState = state;

    // 1. Update body class and styling variables
    document.body.className = `min-h-screen theme-${state} text-slate-900 relative`;
    document.documentElement.style.setProperty('--accent-color', data.gageAccent);
    document.documentElement.style.setProperty('--glow-color', data.ambientGlow);

    // Update ambient card glow backgrounds
    const journalCard = document.getElementById('journal-card');
    if (journalCard) {
        journalCard.style.boxShadow = `0 24px 60px -15px ${data.ambientGlow}, 0 0 1px 1px rgba(15, 23, 42, 0.05)`;
        journalCard.style.borderColor = `rgba(15, 23, 42, 0.08)`;
    }

    // 2. Toggle active pill class states
    document.querySelectorAll('.weather-pill').forEach(pill => {
        pill.classList.remove('active');
        pill.style.borderColor = 'rgba(15, 23, 42, 0.1)';
        pill.style.color = 'rgba(15, 23, 42, 0.6)';
    });

    const activePill = document.getElementById(`pill-${state}`);
    if (activePill) {
        activePill.classList.add('active');
        activePill.style.borderColor = data.gageAccent;
        activePill.style.color = '#0f172a';
    }

    // 3. Update gage configuration targets
    if (gageInstance) {
        gageInstance.update(data);
    }

    // 4. Update digital text readouts
    const cityEl = document.getElementById('preview-city');
    const regionEl = document.getElementById('preview-region');
    const tempEl = document.getElementById('preview-temp');
    const baroTextEl = document.getElementById('preview-barometer');
    const descEl = document.getElementById('preview-desc');
    const humidityEl = document.getElementById('preview-humidity');
    const windEl = document.getElementById('preview-wind');
    const alertTextEl = document.getElementById('preview-alert');

    if (cityEl) cityEl.textContent = data.city;
    if (regionEl) regionEl.textContent = data.region;
    if (tempEl) tempEl.textContent = data.temp;
    if (baroTextEl) baroTextEl.textContent = data.barometer;
    if (descEl) descEl.textContent = data.desc;
    if (humidityEl) humidityEl.textContent = data.humidity;
    if (windEl) windEl.textContent = data.wind;
    if (alertTextEl) alertTextEl.textContent = data.alert;

    // Trigger minor opacity blink to simulate ink drawing updates
    const journalContent = document.getElementById('journal-dynamic-content');
    if (journalContent) {
        journalContent.style.opacity = '0.3';
        setTimeout(() => {
            journalContent.style.opacity = '1.0';
        }, 120);
    }
}

// Modal Toggle Mechanics
function showLoginModal() {
    closeModals();
    document.getElementById('login-modal')?.classList.remove('hidden');
}

function showRegisterModal() {
    closeModals();
    document.getElementById('register-modal')?.classList.remove('hidden');
}

function showUpgradeModal() {
    closeModals();
    document.getElementById('upgrade-modal')?.classList.remove('hidden');
}

function closeModals() {
    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('register-modal')?.classList.add('hidden');
    document.getElementById('upgrade-modal')?.classList.add('hidden');
}

function switchToRegister() {
    closeModals();
    showRegisterModal();
}

function switchToLogin() {
    closeModals();
    showLoginModal();
}

function scrollToPricing() {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    
    // Modern editorial toast styling
    toast.className = isError 
        ? 'fixed bottom-4 right-4 bg-red-950 border border-red-800 text-red-200 px-6 py-3 rounded-md shadow-2xl z-50 font-medium text-xs tracking-wider uppercase transition-all duration-300' 
        : 'fixed bottom-4 right-4 bg-slate-950 border border-slate-800 text-slate-200 px-6 py-3 rounded-md shadow-2xl z-50 font-medium text-xs tracking-wider uppercase transition-all duration-300';
        
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// Upgrade Action Request
async function confirmUpgrade() {
    const user = localStorage.getItem('weather_user');
    if (!user) {
        showToast('Please login first', true);
        closeModals();
        showLoginModal();
        return;
    }
    
    try {
        const response = await authFetch('/api/auth/upgrade', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        
        if (response.ok) {
            await storeAuth(data.user);
            showToast('Upgrade successful: Welcome to Premium');
            closeModals();
        } else {
            showToast(data.error || 'Upgrade process failed', true);
        }
    } catch (error) {
        showToast('Upgrade request timed out. Try again.', true);
    }
}

async function ensureCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
    if (!match) {
        try {
            await fetch('/api/auth/csrf');
        } catch (e) {
            console.warn('CSRF initialization failed:', e);
        }
    }
}

// Global binding once DOM is parsed
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure CSRF token cookie exists
    await ensureCsrfToken();

    // 1. Instantiate the Canvas gage
    gageInstance = new MeteorologicalGage('meteorological-gage');

    // 2. Navigation Actions
    const navLoginBtn = document.getElementById('nav-login-btn');
    if (navLoginBtn) navLoginBtn.addEventListener('click', showLoginModal);

    const navRegisterBtn = document.getElementById('nav-register-btn');
    if (navRegisterBtn) navRegisterBtn.addEventListener('click', showRegisterModal);

    // 3. Hero CTA
    const heroRegisterBtn = document.getElementById('hero-register-btn');
    if (heroRegisterBtn) heroRegisterBtn.addEventListener('click', showRegisterModal);

    const heroPricingBtn = document.getElementById('hero-pricing-btn');
    if (heroPricingBtn) heroPricingBtn.addEventListener('click', scrollToPricing);

    // 4. Weather Pills Clicking
    ['clear', 'rain', 'snow', 'storm'].forEach(state => {
        const pill = document.getElementById(`pill-${state}`);
        if (pill) {
            pill.addEventListener('click', () => switchWeatherState(state));
        }
    });

    // 5. Pricing card flows
    const pricingFreeBtn = document.getElementById('pricing-free-btn');
    if (pricingFreeBtn) pricingFreeBtn.addEventListener('click', showRegisterModal);

    const pricingPremiumBtn = document.getElementById('pricing-premium-btn');
    if (pricingPremiumBtn) pricingPremiumBtn.addEventListener('click', showUpgradeModal);

    // 6. Modal controllers
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    const switchToRegisterBtn = document.getElementById('switch-to-register-btn');
    if (switchToRegisterBtn) switchToRegisterBtn.addEventListener('click', switchToRegister);

    const switchToLoginBtn = document.getElementById('switch-to-login-btn');
    if (switchToLoginBtn) switchToLoginBtn.addEventListener('click', switchToLogin);

    const confirmUpgradeBtn = document.getElementById('confirm-upgrade-btn');
    if (confirmUpgradeBtn) confirmUpgradeBtn.addEventListener('click', confirmUpgrade);

    // 7. Form submission pipelines
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email')?.value;
            const password = document.getElementById('login-password')?.value;
            
            try {
                const response = await authFetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                
                if (response.ok) {
                    await storeAuth(data.user);
                    showToast('Access granted');
                    closeModals();
                    window.location.href = '/index.html';
                } else {
                    showToast(data.error || 'Credentials rejected', true);
                }
            } catch (error) {
                showToast('Authentication connection failure', true);
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('register-email')?.value;
            const password = document.getElementById('register-password')?.value;
            try {
                const response = await authFetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                
                if (response.ok) {
                    await storeAuth(data.user);
                    showToast('Journal Account Activated');
                    closeModals();
                    window.location.href = '/index.html';
                } else {
                    showToast(data.error || 'Activation failed', true);
                }
            } catch (error) {
                showToast('Connection failed. Re-attempt registration.', true);
            }
        });
    }

    // Initialize with clear state variables
    switchWeatherState('clear');
});
