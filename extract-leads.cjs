const WebSocket = require('ws');
const fs = require('fs');

// Use the search tab
const TAB_ID = process.argv[2] || 'BFB71E074BCD52697EA0BDD86FCA89';
const ws = new WebSocket('ws://localhost:9222/devtools/page/' + TAB_ID);

let msgId = 1;
function send(method, params = {}) {
  ws.send(JSON.stringify({id: msgId++, method, params}));
}

let leads = [];

ws.on('open', () => {
  console.log('Connected! Extracting leads...');
  send('Runtime.enable');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  const id = msg.id;
  
  if (id === 1) {
    // Extract all profile cards from search results
    send('Runtime.evaluate', {
      expression: `
        (function() {
          var items = document.querySelectorAll('li[data-urn], .reusable-search__result-container, .entity-result');
          var results = [];
          
          // Try different selectors LinkedIn uses
          var cards = document.querySelectorAll('.entity-result__item, .linked-area, .org-pile');
          
          // Main approach: get all search result items
          var allResults = document.querySelectorAll('[data-view-name="search-results"] [data-urn], .entity-result');
          
          if (allResults.length === 0) {
            // Fallback: look for any profile links
            var links = document.querySelectorAll('a[href*=\\/in\\/]');
            var seen = new Set();
            allResults = [];
            links.forEach(function(l) {
              var href = l.getAttribute('href');
              var match = href.match(/\\/in\\/([^\\/?]+)/);
              if (match && !seen.has(match[1])) {
                seen.add(match[1]);
                allResults.push(l);
              }
            });
          }
          
          return 'Found ' + allResults.length + ' results. Selector: ' + (allResults.length > 0 ? allResults[0].tagName : 'none');
        })()
      `
    });
  } else if (id === 2) {
    console.log(msg.result.result.value);
    
    // Now extract actual data
    send('Runtime.evaluate', {
      expression: `
        (function() {
          var leads = [];
          var cards = document.querySelectorAll('.entity-result');
          
          if (cards.length === 0) {
            // Try alternative selectors
            cards = document.querySelectorAll('[data-view-name="search-results"] li');
          }
          
          cards.forEach(function(card, i) {
            if (i >= 10) return; // First 10 for now
            
            var nameEl = card.querySelector('.entity-result__title-text a, .app-aware-link, a[href*=\\/in\\/]');
            var name = nameEl ? nameEl.innerText.trim() : '';
            var link = nameEl ? nameEl.getAttribute('href') || '' : '';
            
            var headlineEl = card.querySelector('.entity-result__primary-subtitle, .entity-result__summary');
            var headline = headlineEl ? headlineEl.innerText.trim() : '';
            
            var subtitleEl = card.querySelector('.entity-result__secondary-subtitle');
            var location = subtitleEl ? subtitleEl.innerText.trim() : '';
            
            var linkMatch = link.match(/\\/in\\/([^\\/?]+)/);
            var profileId = linkMatch ? linkMatch[1] : '';
            
            leads.push({
              name: name,
              profileUrl: profileId ? 'https://www.linkedin.com/in/' + profileId : link,
              headline: headline,
              location: location
            });
          });
          
          return JSON.stringify(leads);
        })()
      `
    });
  } else if (id === 3) {
    const raw = msg.result.result.value;
    try {
      leads = JSON.parse(raw);
      console.log('Extracted ' + leads.length + ' leads:');
      leads.forEach(function(l, i) {
        console.log((i+1) + '. ' + l.name + ' | ' + (l.headline || 'no headline').substring(0, 60));
      });
      
      // Save to file
      fs.writeFileSync('linkedin-leads.json', JSON.stringify(leads, null, 2));
      console.log('\nSaved to linkedin-leads.json');
    } catch(e) {
      console.log('Parse error:', e.message);
      console.log('Raw:', raw);
    }
    ws.close();
    setTimeout(() => process.exit(0), 500);
  }
});

ws.on('error', (err) => console.error('WS Error:', err.message));
setTimeout(() => { console.log('Timeout'); ws.close(); process.exit(); }, 15000);
