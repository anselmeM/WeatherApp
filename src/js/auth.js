import { state } from './state.js';

export const USER_KEY = 'weather_user';

let onUpgradeCallback = null;
let onDowngradeCallback = null;

export function initAuthCallbacks({ onUpgrade, onDowngrade }) {
  onUpgradeCallback = onUpgrade;
  onDowngradeCallback = onDowngrade;
}

export function getAuth() {
  try {
    const userJson = localStorage.getItem(USER_KEY);
    return userJson ? { user: JSON.parse(userJson) } : { user: null };
  } catch (e) {
    return { user: null };
  }
}

export async function storeAuth(user) {
  try {
    const oldUserJson = localStorage.getItem(USER_KEY);
    const oldUser = oldUserJson ? JSON.parse(oldUserJson) : null;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    // Clear browser service worker caches if session user or tier changes
    if (!oldUser || oldUser.email !== user.email || oldUser.tier !== user.tier) {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    }
  } catch (e) {
    console.error('Failed to store auth:', e);
  }
}

export async function clearAuth() {
  localStorage.removeItem(USER_KEY);
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  }
}

export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? match[1] : null;
}

export async function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['X-Requested-With'] = 'XMLHttpRequest';
  
  const csrfToken = getCsrfToken();
  if (csrfToken && (!options.method || !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase()))) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  return fetch(url, { ...options, headers });
}

export function updateAuthUI() {
  const { user } = getAuth();
  const userProfileBadge = document.getElementById('user-profile-badge');
  const userEmailEl = document.getElementById('user-email');
  const userTierBadge = document.getElementById('user-tier-badge');
  const inlineUpgradeBtn = document.getElementById('inline-upgrade-btn');
  const inlineDowngradeBtn = document.getElementById('inline-downgrade-btn');
  const signinButton = document.getElementById('signin-button');
  const logoutButton = document.getElementById('logout-button');
  
  if (user) {
    userProfileBadge?.classList.remove('hidden');
    logoutButton?.classList.remove('hidden');
    signinButton?.classList.add('hidden');
    
    if (userEmailEl) userEmailEl.textContent = user.email;
    
    if (user.tier === 'premium') {
      if (userTierBadge) {
        userTierBadge.textContent = 'Premium';
        userTierBadge.className = 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold px-2 py-0.5 rounded-full text-[10px] shadow-sm';
      }
      inlineUpgradeBtn?.classList.add('hidden');
      inlineDowngradeBtn?.classList.remove('hidden');
    } else {
      if (userTierBadge) {
        userTierBadge.textContent = 'Free';
        userTierBadge.className = 'bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full text-[10px]';
      }
      inlineUpgradeBtn?.classList.remove('hidden');
      inlineDowngradeBtn?.classList.add('hidden');
    }
  } else {
    userProfileBadge?.classList.add('hidden');
    logoutButton?.classList.add('hidden');
    signinButton?.classList.remove('hidden');
    inlineDowngradeBtn?.classList.add('hidden');
  }
}

export async function validateSession(onSessionValidated, onError) {
  const { user } = getAuth();
  if (!user) {
    updateAuthUI();
    return;
  }
  
  try {
    const response = await fetch('/api/auth/profile');
    if (response.ok) {
      const profileData = await response.json();
      const updatedUser = { email: profileData.email, tier: profileData.tier };
      await storeAuth(updatedUser);
      updateAuthUI();
      
      if (onSessionValidated && profileData.locations) {
        onSessionValidated(profileData.locations);
      }
    } else if (response.status === 401 || response.status === 403) {
      clearAuth();
      updateAuthUI();
      if (onError) onError('Session expired. Please log in again.');
    }
  } catch (e) {
    console.warn('Session verification failed:', e);
    updateAuthUI();
  }
}

export async function upgradeCurrentUser(onError) {
  try {
    const response = await authFetch('/api/auth/upgrade', {
      method: 'POST'
    });
    const data = await response.json();
    
    if (response.ok) {
      await storeAuth(data.user);
      updateAuthUI();
      if (onUpgradeCallback) onUpgradeCallback(data.user);
    } else {
      throw new Error(data.error || 'Upgrade failed');
    }
  } catch (error) {
    if (onError) onError(error.message || 'Upgrade failed. Please try again.');
    throw error;
  }
}

export async function downgradeCurrentUser(onError) {
  if (!confirm('Are you sure you want to cancel your Premium subscription? Your saved locations will be truncated to 3.')) {
    return;
  }
  
  const inlineDowngradeBtn = document.getElementById('inline-downgrade-btn');
  const originalText = inlineDowngradeBtn ? inlineDowngradeBtn.innerHTML : '';
  if (inlineDowngradeBtn) {
    inlineDowngradeBtn.disabled = true;
    inlineDowngradeBtn.innerHTML = 'Cancelling...';
  }
  
  try {
    const response = await authFetch('/api/auth/downgrade', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    
    if (response.ok) {
      await storeAuth(data.user);
      updateAuthUI();
      
      if (onDowngradeCallback) onDowngradeCallback(data);
    } else {
      if (onError) onError(data.error || 'Cancellation failed');
      if (inlineDowngradeBtn) {
        inlineDowngradeBtn.disabled = false;
        inlineDowngradeBtn.innerHTML = originalText;
      }
    }
  } catch (error) {
    if (onError) onError('Cancellation failed. Please try again.');
    if (inlineDowngradeBtn) {
      inlineDowngradeBtn.disabled = false;
      inlineDowngradeBtn.innerHTML = originalText;
    }
  }
}

// Payment Modal handling functions
const paymentModal = document.getElementById('payment-modal');
const paymentForm = document.getElementById('payment-form');
const closePaymentModalBtn = document.getElementById('close-payment-modal');
const paySubmitBtn = document.getElementById('pay-submit-btn');

export function showPaymentModal() {
  paymentForm?.reset();
  paymentModal?.classList.remove('hidden');
}

export function hidePaymentModal() {
  paymentModal?.classList.add('hidden');
}

closePaymentModalBtn?.addEventListener('click', hidePaymentModal);

paymentModal?.addEventListener('click', (e) => {
  if (e.target === paymentModal) {
    hidePaymentModal();
  }
});

// Setup dynamic imports locally to prevent circular dependencies at runtime
paymentForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const originalBtnHTML = paySubmitBtn.innerHTML;
  paySubmitBtn.disabled = true;
  paySubmitBtn.innerHTML = '<span class="material-icons animate-spin text-sm mr-1">sync</span>Verifying Card...';
  
  try {
    // Dynamically import showError to show error toast if upgrade fails
    const { showError } = await import('./ui-render.js');
    setTimeout(async () => {
      try {
        await upgradeCurrentUser(msg => showError(msg, 'generic'));
        hidePaymentModal();
      } catch (err) {
        console.error(err);
      } finally {
        paySubmitBtn.disabled = false;
        paySubmitBtn.innerHTML = originalBtnHTML;
      }
    }, 1500);
  } catch (err) {
    console.error('Submit handling error:', err);
    paySubmitBtn.disabled = false;
    paySubmitBtn.innerHTML = originalBtnHTML;
  }
});

// Credit Card input formatting aids
const cardNumberInput = document.getElementById('card-number');
const cardExpiryInput = document.getElementById('card-expiry');

cardNumberInput?.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  let matches = value.match(/\d{4,16}/g);
  let match = matches && matches[0] || '';
  let parts = [];
  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }
  if (parts.length > 0) {
    e.target.value = parts.join(' ');
  } else {
    e.target.value = value;
  }
});

cardExpiryInput?.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length >= 2) {
    let month = value.substring(0, 2);
    let year = value.substring(2, 4);
    if (parseInt(month, 10) > 12) month = '12';
    if (parseInt(month, 10) === 0) month = '01';
    e.target.value = `${month}/${year}`;
  } else {
    e.target.value = value;
  }
});
