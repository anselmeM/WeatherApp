const WebSocket = require('ws');
const WS = 'ws://localhost:9222/devtools/browser/7dcfed0b-f8ce-4536-b8a7-e81ba50af22e';
const ws = new WebSocket(WS);
let msgId = 100;
let sessionId = null;

function send(method, params) {
  const msg = {id: msgId++, method, params: params || {}};
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
}

ws.on('open', () => {
  console.log('Connected!');
  // Create tab with the URL directly
  send('Target.createTarget', {url: 'https://www.linkedin.com/in/jamila-ruzimetova/'});
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  
  if (msg.method === 'Target.attachedToTarget') {
    sessionId = msg.params.sessionId;
    console.log('Session:', sessionId);
    
    // Wait for page to load fully then extract
    setTimeout(() => {
      send('Runtime.evaluate', {expression: '(function() { return document.title + "\\n---\\n" + document.body.innerText.substring(0, 2000); })()'});
      console.log('Extracting after 8s...');
    }, 8000);
    return;
  }
  
  if (!msg.id) return;
  
  if (msg.id === 100) {
    const tid = msg.result?.targetId;
    console.log('Tab:', tid);
    send('Target.attachToTarget', {targetId: tid, flatten: true});
  }
  else if (msg.id === 101) {
    const val = msg.result?.result?.value;
    if (val) {
      console.log('\n=== PROFILE ===\n' + val + '\n===============');
    } else {
      console.log('Result:', JSON.stringify(msg.result).substring(0, 200));
    }
    setTimeout(() => process.exit(0), 500);
  }
});

ws.on('error', (e) => console.error('WS:', e.message));
setTimeout(() => process.exit(), 35000);
