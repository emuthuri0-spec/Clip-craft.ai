# ClipCraft AI

> Intelligent writing & presentation assistant — built for GitHub

![ClipCraft AI](assets/clipcraft-logo.png)

## Features

- 💬 **AI Chat** — Streaming responses, markdown rendering, code highlighting, copy & retry
- 📊 **PPT Assistant** — Generate structured presentation outlines from a topic prompt
- 🌗 **Dark / Light theme** — Persisted across sessions
- 🕐 **Chat History** — LocalStorage-backed session memory
- 📱 **Responsive** — Works on mobile, tablet & desktop
- ♿ **Accessible** — ARIA labels, keyboard navigation, focus management

## Project Structure

```
clipcraft-ai/
├── index.html          # App shell — all panels & UI
├── css/
│   ├── tokens.css      # Design tokens (colours, spacing, shadows)
│   └── main.css        # Full component stylesheet
├── js/
│   └── app.js          # All app logic (chat, PPT, history, theme)
└── assets/
    ├── clipcraft-logo.png
    └── ppt-assistant.png
```

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/clipcraft-ai.git
cd clipcraft-ai

# Open in browser (no build step needed)
open index.html
# or serve locally:
npx serve .
```

## Connecting a Real AI Backend

In `js/app.js`, replace the `generateReply()` function with a real API call:

```javascript
async function generateReply(userText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: state.messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}
```

> ⚠️ Never expose API keys in client-side code in production. Use a backend proxy.

## Customisation

| File | What to change |
|------|---------------|
| `css/tokens.css` | Brand colours, fonts, spacing |
| `js/app.js` → `generateReply()` | Connect your AI API |
| `js/app.js` → `generatePPT()` | Hook up real PPTX generation |
| `index.html` | Add new tabs, tools, or panels |

## License

MIT — free to use, fork, and build upon.
