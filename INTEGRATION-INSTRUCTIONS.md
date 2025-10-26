# Header + Chatbot Integration Instructions

## Current Status

The header (`header-fixed.html`) and chatbot (`sarah-ai.html`) are in **separate files**.  
For the header buttons to trigger the chatbot, they must be on the **SAME HTML page**.

## Problem

When viewing `sarah-ai.html` directly:
- There's no header with buttons
- The toggle button should be hidden
- **But Render hasn't deployed the latest changes yet!**

## Solution Options

### Option 1: Embed Chatbot in Your Main Site (RECOMMENDED)

Add this code to your main worryfreemovers.com pages (after the header):

```html
<!-- Add to bottom of page, before </body> -->
<script src="https://worry-free-booking.onrender.com/sarah-ai.html"></script>
```

### Option 2: Create Combined Page

Merge the header HTML and chatbot HTML into a single file.

### Option 3: Use Script Tag Integration

Add the chatbot widget to existing pages:

```html
<div id="wfm-chat-container-embed"></div>
<script>
fetch('https://worry-free-booking.onrender.com/sarah-ai.html')
  .then(r => r.text())
  .then(html => {
    // Parse and inject chatbot
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const container = doc.querySelector('#wfm-chat-container');
    document.body.appendChild(container);
    // Execute chatbot scripts
    doc.querySelectorAll('script').forEach(script => {
      const s = document.createElement('script');
      s.textContent = script.textContent;
      document.body.appendChild(s);
    });
  });
</script>
```

## Deployment Status

Last pushed commits:
- Fix mobile chat display
- Hide toggle button completely
- Reduce initial delay

**Render needs to redeploy** - changes aren't live yet.

## Testing

Once Render deploys, test at:
- https://worry-free-booking.onrender.com/sarah-ai.html

Expected behavior:
- Toggle button should be completely hidden
- Chat fills entire screen on mobile
- Opens quickly (400ms delay)
