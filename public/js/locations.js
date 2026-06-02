import { state } from './state.js';
import { getAuth } from './auth.js';
import { showUpgradePrompt, showRegisterPrompt, updateRecentSearchesUI, updatePinButtonUI } from './ui-render.js';
import { showError } from '../utils.js';

export async function pinLocation(city) {
  const { user } = getAuth();
  
  // Check limit
  const isPremium = user && user.tier === 'premium';
  if (!isPremium && state.recentSearches.length >= 3) {
    if (user) {
      showUpgradePrompt("Saving locations");
    } else {
      showRegisterPrompt("Saving locations");
    }
    return;
  }
  
  // Check if already in the list to avoid duplicate
  if (!state.recentSearches.some(c => c.toLowerCase() === city.toLowerCase())) {
    state.recentSearches.push(city);
    localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
    updateRecentSearchesUI();
    updatePinButtonUI();
  }
  
  if (user) {
    try {
      const response = await fetch('/api/user/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: city })
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.upgradeRequired) {
          // Rollback local change if server rejected it due to limits
          state.recentSearches = state.recentSearches.filter(c => c.toLowerCase() !== city.toLowerCase());
          localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
          updateRecentSearchesUI();
          updatePinButtonUI();
          showUpgradePrompt("Saving locations");
        } else {
          showError(errorData.error || "Failed to pin location");
        }
      }
    } catch (e) {
      console.warn('Failed to save pinned location to server:', e);
    }
  }
}

export async function deleteSavedLocation(city) {
  const { user } = getAuth();
  
  // Sync client state immediately
  state.recentSearches = state.recentSearches.filter(c => c.toLowerCase() !== city.toLowerCase());
  localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
  updateRecentSearchesUI();
  updatePinButtonUI();
  
  if (user) {
    try {
      await fetch('/api/user/locations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: city })
      });
    } catch (e) {
      console.warn('Failed to delete saved location from server:', e);
    }
  }
}
