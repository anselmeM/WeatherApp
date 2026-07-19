// Stripe Payment Integration for WeatherApp
// Mounts Stripe Elements and handles card payment flow

let stripe = null;
let elements = null;
let cardElement = null;

export async function initStripe() {
  try {
    // Fetch Stripe config from server
    const configRes = await fetch('/api/stripe/config');
    const config = await configRes.json();

    if (!config.isConfigured || !config.publishableKey) {
      console.warn('Stripe not configured — add STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY to .env');
      return { configured: false };
    }

    // Load Stripe.js dynamically
    const { loadStripe } = await import('@stripe/stripe-js');
    stripe = await loadStripe(config.publishableKey);
    return { configured: true, stripe };
  } catch (err) {
    console.error('Failed to initialize Stripe:', err);
    return { configured: false, error: err.message };
  }
}

export function mountCardElement() {
  const cardElementContainer = document.getElementById('card-element');
  if (!cardElementContainer || !stripe) return null;

  // Create Stripe Elements instance with matching style
  elements = stripe.elements({
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#f59e0b',
        colorBackground: 'transparent',
        colorText: '#1f2937',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        borderRadius: '12px',
      },
    },
  });

  cardElement = elements.create('card', {
    hidePostalCode: true,
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': { color: '#9ca3af' },
        iconColor: '#f59e0b',
      },
    },
  });

  cardElement.mount('#card-element');
  return cardElement;
}

export function unmountCardElement() {
  if (cardElement) {
    cardElement.unmount();
    cardElement = null;
    elements = null;
  }
}

export async function handleStripePayment(onSuccess, onError) {
  if (!stripe || !cardElement) {
    if (onError) onError('Payment system not initialized');
    return;
  }

  const payBtn = document.getElementById('pay-submit-btn');
  if (!payBtn) return;

  // Disable button and show loading
  const originalHTML = payBtn.innerHTML;
  payBtn.disabled = true;
  payBtn.innerHTML = '<span class="material-icons animate-spin text-sm mr-1">sync</span>Processing...';

  try {
    // Fetch payment intent secret from server
    const intentRes = await fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const intentData = await intentRes.json();

    if (!intentRes.ok) {
      throw new Error(intentData.error || 'Failed to create payment');
    }

    // Confirm the card payment
    const { error, paymentIntent } = await stripe.confirmCardPayment(intentData.clientSecret, {
      payment_method: {
        card: cardElement,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (paymentIntent.status === 'succeeded') {
      // Payment succeeded — update local user state
      const profileRes = await fetch('/api/auth/profile');
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const { storeAuth, updateAuthUI } = await import('./auth.js');
        await storeAuth({ email: profileData.email, tier: profileData.tier });
        updateAuthUI();
      }

      if (onSuccess) onSuccess();
    }
  } catch (err) {
    console.error('Payment failed:', err);
    if (onError) onError(err.message || 'Payment failed. Please try again.');
  } finally {
    payBtn.disabled = false;
    payBtn.innerHTML = originalHTML;
  }
}

// Auto-initialize Stripe when the payment modal opens
const paymentModal = document.getElementById('payment-modal');
const paymentForm = document.getElementById('payment-form');

paymentForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await handleStripePayment(
    () => {
      // On success — close modal and show success
      document.getElementById('payment-modal')?.classList.add('hidden');
      const { showToast } = await import('./ui-render.js');
      // We'll handle success toast via the modal close + profile refresh
      window.location.reload(); // Refresh to show premium status
    },
    async (msg) => {
      const { showError } = await import('./ui-render.js');
      showError(msg, 'generic');
    }
  );
});

// Mount card element when modal opens
const observer = new MutationObserver(() => {
  if (paymentModal?.classList.contains('hidden')) {
    unmountCardElement();
  } else if (!cardElement && stripe) {
    mountCardElement();
  }
});

if (paymentModal) {
  observer.observe(paymentModal, { attributes: true, attributeFilter: ['class'] });
}

// Initialize Stripe on load
initStripe().then((result) => {
  if (result.configured && !paymentModal?.classList.contains('hidden')) {
    mountCardElement();
  }
});
