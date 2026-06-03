import { authFetch, storeAuth } from './auth.js';

// Weather State Switching Logic for Landing Page Preview
const weatherData = {
    clear: {
        city: 'Miami',
        date: 'Tuesday, June 2',
        temp: '82°',
        icon: 'wb_sunny',
        desc: 'Sunny & Clear',
        humidity: '52%',
        wind: '9 mph',
        theme: 'theme-clear',
        alert: 'High UV index today. Remember to apply sunscreen.',
        alertIcon: 'light_mode',
        alertColor: 'text-yellow-400'
    },
    rain: {
        city: 'Seattle',
        date: 'Tuesday, June 2',
        temp: '58°',
        icon: 'thunderstorm',
        desc: 'Moderate Rain',
        humidity: '88%',
        wind: '14 mph',
        theme: 'theme-rain',
        alert: 'Precipitation active. Carry an umbrella.',
        alertIcon: 'umbrella',
        alertColor: 'text-blue-400'
    },
    snow: {
        city: 'Aspen',
        date: 'Tuesday, June 2',
        temp: '26°',
        icon: 'ac_unit',
        desc: 'Light Snow',
        humidity: '74%',
        wind: '6 mph',
        theme: 'theme-snow',
        alert: 'Sub-zero temperatures. Wear insulated clothing.',
        alertIcon: 'warning',
        alertColor: 'text-cyan-300'
    },
    storm: {
        city: 'Houston',
        date: 'Tuesday, June 2',
        temp: '76°',
        icon: 'flash_on',
        desc: 'Severe Storms',
        humidity: '94%',
        wind: '24 mph',
        theme: 'theme-storm',
        alert: 'Severe Weather Warning: Take shelter indoors.',
        alertIcon: 'gavel',
        alertColor: 'text-red-500'
    }
};

function switchWeatherState(state) {
    const data = weatherData[state];
    if (!data) return;

    // 1. Update body class for background gradient
    document.body.className = `min-h-screen ${data.theme} text-white relative`;

    // 2. Update active pill state
    document.querySelectorAll('.weather-pill').forEach(pill => pill.classList.remove('active'));
    const activePill = document.getElementById(`pill-${state}`);
    if (activePill) {
        activePill.classList.add('active');
    }

    // 3. Update widget texts & info
    const previewCity = document.getElementById('preview-city');
    const previewDate = document.getElementById('preview-date');
    const previewTemp = document.getElementById('preview-temp');
    const previewDesc = document.getElementById('preview-desc');
    const previewHumidity = document.getElementById('preview-humidity');
    const previewWind = document.getElementById('preview-wind');
    const previewAlert = document.getElementById('preview-alert');

    if (previewCity) previewCity.textContent = data.city;
    if (previewDate) previewDate.textContent = data.date;
    if (previewTemp) previewTemp.textContent = data.temp;
    if (previewDesc) previewDesc.textContent = data.desc;
    if (previewHumidity) previewHumidity.textContent = data.humidity;
    if (previewWind) previewWind.textContent = data.wind;
    if (previewAlert) previewAlert.textContent = data.alert;

    // 4. Update widget icons & styles
    const iconEl = document.getElementById('preview-icon');
    if (iconEl) {
        iconEl.textContent = data.icon;
        iconEl.className = `material-icons text-4xl ${data.alertColor}`;
    }

    const alertIconEl = document.getElementById('preview-alert-icon');
    if (alertIconEl) {
        alertIconEl.textContent = data.alertIcon;
        alertIconEl.className = `material-icons text-sm ${data.alertColor}`;
    }
}

// Modal functions
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
    toast.className = isError 
        ? 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg z-50' 
        : 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// Upgrade handler
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
            showToast('Welcome to Premium! 🎉');
            closeModals();
        } else {
            showToast(data.error || 'Upgrade failed', true);
        }
    } catch (error) {
        showToast('Upgrade failed. Please try again.', true);
    }
}

// Setup Event Listeners once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Navigation Buttons
    const navLoginBtn = document.getElementById('nav-login-btn');
    if (navLoginBtn) navLoginBtn.addEventListener('click', showLoginModal);

    const navRegisterBtn = document.getElementById('nav-register-btn');
    if (navRegisterBtn) navRegisterBtn.addEventListener('click', showRegisterModal);

    // Hero Section Buttons
    const heroRegisterBtn = document.getElementById('hero-register-btn');
    if (heroRegisterBtn) heroRegisterBtn.addEventListener('click', showRegisterModal);

    const heroPricingBtn = document.getElementById('hero-pricing-btn');
    if (heroPricingBtn) heroPricingBtn.addEventListener('click', scrollToPricing);

    // Weather Preview Pills
    ['clear', 'rain', 'snow', 'storm'].forEach(state => {
        const pill = document.getElementById(`pill-${state}`);
        if (pill) {
            pill.addEventListener('click', () => switchWeatherState(state));
        }
    });

    // Pricing Cards Buttons
    const pricingFreeBtn = document.getElementById('pricing-free-btn');
    if (pricingFreeBtn) pricingFreeBtn.addEventListener('click', showRegisterModal);

    const pricingPremiumBtn = document.getElementById('pricing-premium-btn');
    if (pricingPremiumBtn) pricingPremiumBtn.addEventListener('click', showUpgradeModal);

    // Modal Close Buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    // Switch between Modals
    const switchToRegisterBtn = document.getElementById('switch-to-register-btn');
    if (switchToRegisterBtn) switchToRegisterBtn.addEventListener('click', switchToRegister);

    const switchToLoginBtn = document.getElementById('switch-to-login-btn');
    if (switchToLoginBtn) switchToLoginBtn.addEventListener('click', switchToLogin);

    // Upgrade Confirmation
    const confirmUpgradeBtn = document.getElementById('confirm-upgrade-btn');
    if (confirmUpgradeBtn) confirmUpgradeBtn.addEventListener('click', confirmUpgrade);

    // Form Submissions
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
                    showToast('Login successful!');
                    closeModals();
                    window.location.href = '/index.html';
                } else {
                    showToast(data.error || 'Login failed', true);
                }
            } catch (error) {
                showToast('Login failed. Please try again.', true);
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
                    showToast('Account created!');
                    closeModals();
                    window.location.href = '/index.html';
                } else {
                    showToast(data.error || 'Registration failed', true);
                }
            } catch (error) {
                showToast('Registration failed. Please try again.', true);
            }
        });
    }

    // Auto check login session state
    const user = localStorage.getItem('weather_user');
    if (user) {
        console.log('User is logged in');
    }
});
