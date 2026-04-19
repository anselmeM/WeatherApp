🎯 **What:**
Fixed a Cross-Site Scripting (XSS) vulnerability in the frontend weather alert banner (`public/script.js`). The application previously injected dynamic event headlines into the DOM using `alertText.innerHTML`.

⚠️ **Risk:**
High. Weather alerts fetched from external sources are inherently untrusted. If an attacker managed to manipulate an alert response (e.g., through a Man-in-The-Middle attack on an insecure upstream API or by tampering with API responses), they could inject malicious HTML or JavaScript. This payload would execute in the user's browser, potentially allowing attackers to steal session tokens, manipulate the UI, or perform unauthorized actions on behalf of the user.

🛡️ **Solution:**
Replaced the vulnerable `innerHTML` assignment with safe DOM manipulation methods. The multi-alert UI is now constructed using `document.createElement`, with data safely injected via `textContent` and `document.createTextNode`. A `DocumentFragment` is used to batch append the elements efficiently. This ensures that any HTML entities within the alert event or headline are treated strictly as text, preventing arbitrary code execution while preserving the original styling and structure.
