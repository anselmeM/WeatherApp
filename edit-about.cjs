const WebSocket = require('ws');
const TAB_ID = '03D4D4B46C1F7E993A2326F9F2FF4359';
const ws = new WebSocket('ws://localhost:9222/devtools/page/' + TAB_ID);

let msgId = 1;
function send(method, params = {}) {
  ws.send(JSON.stringify({id: msgId++, method, params}));
}

const ABOUT_TEXT = 'I help founders validate and build MVPs that actually sell. Most startups fail because they build things nobody wants. At FirstMileDev, we flip that \u2014 we test market demand before writing production code.\n\nOur Validation Sprint ($3k, 2 weeks) proves whether your idea has traction before you invest in full development. If the data says go, we build a Launchpad MVP ($12k, 4-6 weeks) with auth, payments, and a real database.\n\nBased in Ottawa, Canada. Let\u2019s talk about what you\u2019re building.';

ws.on('open', () => {
  console.log('Connected!');
  send('Runtime.enable');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  const id = msg.id;
  
  if (id === 1) {
    // Find all editable elements on the page
    send('Runtime.evaluate', {
      expression: `(function() {
        var els = document.querySelectorAll('[contenteditable="true"], [role="textbox"], textarea');
        var info = [];
        els.forEach(function(el) {
          info.push(el.tagName + '#' + (el.id || '') + ' role:' + (el.getAttribute('role') || '') + ' ce:' + (el.getAttribute('contenteditable') || ''));
        });
        return JSON.stringify(info);
      })()`
    });
  } else if (id === 2) {
    console.log('Editors:', msg.result.result.value);
    
    // Focus the contenteditable div
    send('Runtime.evaluate', {
      expression: `(function() {
        var el = document.querySelector('[contenteditable="true"]');
        if (!el) el = document.querySelector('[role="textbox"]');
        if (!el) return 'No editable element found';
        el.focus();
        el.innerHTML = '';
        return 'Focused: ' + el.tagName + '#' + (el.id || '') + ' role=' + (el.getAttribute('role') || '');
      })()`
    });
  } else if (id === 3) {
    console.log(msg.result.result.value);
    
    // Use Input.insertText to type the text
    send('Input.insertText', {text: ABOUT_TEXT});
  } else if (id === 4) {
    console.log('Text inserted via Input.insertText!');
    
    // Verify
    send('Runtime.evaluate', {
      expression: `(function() {
        var el = document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]');
        if (el) return 'Verified: ' + el.innerText.substring(0, 80);
        return 'No element found';
      })()`
    });
  } else if (id === 5) {
    console.log(msg.result.result.value);
    console.log('SUCCESS! About section updated!');
    ws.close();
    setTimeout(() => process.exit(0), 500);
  }
});

ws.on('error', (err) => console.error('WS Error:', err.message));
setTimeout(() => { console.log('Timeout'); ws.close(); process.exit(); }, 15000);
