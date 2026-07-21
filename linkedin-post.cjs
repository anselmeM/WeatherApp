const WebSocket = require('ws');
const http = require('http');

http.get('http://localhost:9222/json/version', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    main(JSON.parse(data).webSocketDebuggerUrl);
  });
});

function main(WS) {
  const ws = new WebSocket(WS);
  let m = 100, sessionId = null;
  function send(method, params) {
    const msg = {id: m++, method, params: params || {}};
    if (sessionId) msg.sessionId = sessionId;
    ws.send(JSON.stringify(msg));
  }

  const POST_TEXT = `One question I hear often: "How do I show customer validation when I only have an MVP and enterprise prospects won't talk without a finished product?"

The answer isn't a better demo. It's a better question. Ask them: "What have you tried to solve this already?" If they've been piecing together duct-tape solutions, you've got validation. If they haven't... you've got your answer.

Most founders skip the pain test. Don't be most founders.

#MVP #Validation #StartupAdvice #FirstMileDev`;

  let stage = 0;

  ws.on('open', () => {
    console.log('Connected!');
    // Create new tab
    send('Target.createTarget', {url: 'about:blank'});
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Target.attachedToTarget') {
      sessionId = msg.params.sessionId;
      return;
    }
    if (!msg.id) return;

    if (msg.id === 100) {
      console.log('Tab:', msg.result?.targetId?.substring(0, 20));
      send('Target.attachToTarget', {targetId: msg.result.targetId, flatten: true});
    }
    else if (msg.id === 101) {
      // Navigate directly to the feed
      send('Page.navigate', {url: 'https://www.linkedin.com/feed/?startPost=true'});
      console.log('Navigating to feed with post param...');
    }
    else if (msg.id === 102) {
      console.log('Navigated. Waiting for modal...');
      setTimeout(() => {
        stage = 1;
        // Check for the post composer
        send('Runtime.evaluate', {expression: `
          JSON.stringify({
            title: document.title,
            url: location.href,
            editors: document.querySelectorAll('[contenteditable="true"], [role="textbox"]').length,
            shareBox: !!document.querySelector('.share-box__open, .share-creation-state'),
            buttons: Array.from(document.querySelectorAll('button')).map(function(b) {
              return (b.innerText || '').trim().substring(0, 40);
            }).filter(function(t) { return t.length > 0; }).slice(0, 10)
          })
        `});
      }, 8000);
    }
    else if (msg.id === 103 && stage === 1) {
      try {
        const info = JSON.parse(msg.result?.result?.value || '{}');
        console.log('Feed info:', JSON.stringify(info, null, 2));
      } catch(e) {
        console.log('Raw:', msg.result?.result?.value);
      }
      
      stage = 2;
      // Try to find the post composer via URL
      // Use LinkedIn's direct share URL
      send('Page.navigate', {url: 'https://www.linkedin.com/feed/?startPost=true'});
      setTimeout(() => {
        stage = 3;
        // Try clicking via query selector
        send('Runtime.evaluate', {expression: `
          (function() {
            // Try various selectors LinkedIn might use
            var selectors = [
              '.share-box__open',
              '.share-creation-state',
              '[data-control-name="create_post"]',
              '.artdeco-button--tertiary',
              'button[aria-label*="Start"]',
              '.feed-shared-article__trigger'
            ];
            for(var s of selectors) {
              var el = document.querySelector(s);
              if(el) {
                if(el.tagName === 'BUTTON') el.click();
                else {
                  var btn = el.querySelector('button') || el.closest('button');
                  if(btn) btn.click();
                }
                return 'Found via: ' + s + ' tag=' + el.tagName;
              }
            }
            return 'No selector matched';
          })()
        `});
      }, 3000);
    }
    else if (msg.id === 104) {
      console.log('Click:', msg.result?.result?.value);
      
      stage = 4;
      setTimeout(() => {
        // Check for editors
        send('Runtime.evaluate', {expression: `
          JSON.stringify({
            editors: Array.from(document.querySelectorAll('[contenteditable="true"]')).map(function(e) {
              return e.tagName + ' h=' + e.offsetHeight + ' inner=' + e.innerHTML.substring(0, 50);
            }),
            textboxes: Array.from(document.querySelectorAll('[role="textbox"]')).map(function(e) {
              return e.tagName + ' h=' + e.offsetHeight;
            })
          })
        `});
      }, 4000);
    }
    else if (msg.id === 105 && stage === 4) {
      console.log('Editors:', msg.result?.result?.value);
      
      stage = 5;
      // Try to focus any editor
      send('Runtime.evaluate', {expression: `
        (function() {
          var el = document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]');
          if(el) {
            el.focus();
            return 'Focused: ' + el.tagName;
          }
          return 'Still no editor';
        })()
      `});
    }
    else if (msg.id === 106 && stage === 5) {
      console.log('Focus:', msg.result?.result?.value);
      
      stage = 6;
      send('Input.insertText', {text: POST_TEXT});
      console.log('Text sent!');
    }
    else if (msg.id === 107 && stage === 6) {
      console.log('Insert result, looking for Post button...');
      
      stage = 7;
      setTimeout(() => {
        send('Runtime.evaluate', {expression: `
          (function() {
            var editor = document.querySelector('[contenteditable="true"]');
            if(editor) {
              // Click Post
              var btns = document.querySelectorAll('button');
              for(var b of btns) {
                if(b.innerText.trim() === 'Post') return 'POSTED! Text len: ' + editor.innerText.length;
              }
              return 'Text in editor: ' + editor.innerText.substring(0, 50) + '... but no Post button';
            }
            // Try the share box URL approach
            return 'No editor. Trying alternate approach... try linkedin.com/post/new';
          })()
        `});
      }, 3000);
    }
    else if (msg.id === 108 && stage === 7) {
      console.log('Result:', msg.result?.result?.value);
      
      if ((msg.result?.result?.value || '').includes('POSTED')) {
        console.log('\\n✅ POST SUCCESSFUL!');
      } else {
        console.log('\\nPost failed. Trying URL approach...');
        stage = 8;
        send('Page.navigate', {url: 'https://www.linkedin.com/post/new/'});
        setTimeout(() => {
          send('Runtime.evaluate', {expression: 'document.title + " | " + location.href'});
        }, 8000);
      }
      setTimeout(() => process.exit(0), 3000);
    }
  });

  ws.on('error', (e) => console.error('WS:', e.message));
  setTimeout(() => process.exit(), 60000);
}
