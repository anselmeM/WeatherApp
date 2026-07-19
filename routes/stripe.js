import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../src/middleware.js';
import { getUser, updateUser } from '../src/db.js';

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const PREMIUM_PRICE_CENTS = 499; // $4.99 in cents

router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ 
      error: 'Payment not configured',
      message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env to enable payments.'
    });
  }

  try {
    const { email } = req.user;
    const user = await getUser(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.tier === 'premium') {
      return res.status(400).json({ error: 'Already a premium subscriber' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: PREMIUM_PRICE_CENTS,
      currency: 'usd',
      metadata: {
        email: email,
      },
      // Store the email so the webhook can identify the user
      description: 'WeatherApp Premium Subscription',
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: PREMIUM_PRICE_CENTS,
    });
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Webhook to handle successful payments
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Without webhook secret, parse raw (development only)
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const email = paymentIntent.metadata?.email;

    if (email && paymentIntent.amount === PREMIUM_PRICE_CENTS) {
      try {
        await updateUser(email, { tier: 'premium' });
        console.log(`User ${email} upgraded to premium via Stripe payment`);
      } catch (err) {
        console.error(`Failed to upgrade user ${email}:`, err);
      }
    }
  }

  res.json({ received: true });
});

// Stripe publishable key endpoint (so frontend doesn't need it hardcoded)
router.get('/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    isConfigured: !!stripe,
  });
});

export default router;
