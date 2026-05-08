/* ═══════════════════════════════════════════════════════════
   ClipCraft AI — App Logic
   Handles: chat, history, PPT assistant, theme, tools
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Constants ── */
const STORAGE_KEY_THEME   = 'clipcraft-theme';
const STORAGE_KEY_HISTORY = 'clipcraft-history';
const TYPING_SPEED_MS     = 18;   // ms per character for stream effect

/* ── State ── */
const state = {
  theme:       localStorage.getItem(STORAGE_KEY_THEME) || 'dark',
  activeTab:   'chat',            // 'chat' | 'ppt'
  messages:    [],                // current session messages
  history:     [],                // past sessions
  isStreaming: false,
  currentSessionId: null,
};

/* ── DOM refs ── */
const $ = id => document.getElementById(id);
const dom = {
  html:         document.documentElement,
  sidebar:      $('sidebar'),
  toggleSidebar:$('toggleSidebar'),
  sidebarOpen:  $('sidebarOpen'),
  newChat:      $('newChat'),
  historyList:  $('historyList'),
  themeToggle:  $('themeToggle'),
  chatTab:      $('chatTab'),
  pptTab:       $('pptTab'),
  chatPanel:    $('chatPanel'),
  pptPanel:     $('pptPanel'),
  welcome:      $('welcome'),
  messages:     $('messages'),
  chatInput:    $('chatInput'),
  sendBtn:      $('sendBtn'),
  toastContainer: $('toastContainer'),
  pptInput:     $('pptInput'),
  pptGenBtn:    $('pptGenBtn'),
  pptContent:   $('pptContent'),
};

/* ═══════════════════════════════════════
   THEME
═══════════════════════════════════════ */
function applyTheme(theme) {
  state.theme = theme;
  dom.html.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

/* ═══════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════ */
function toggleSidebar() {
  dom.sidebar.classList.toggle('collapsed');
  const collapsed = dom.sidebar.classList.contains('collapsed');
  dom.sidebarOpen.classList.toggle('hidden', !collapsed);
}

/* ═══════════════════════════════════════
   TABS
═══════════════════════════════════════ */
function switchTab(tab) {
  state.activeTab = tab;
  dom.chatTab.classList.toggle('active', tab === 'chat');
  dom.pptTab.classList.toggle('active',  tab === 'ppt');
  dom.chatPanel.classList.toggle('hidden', tab !== 'chat');
  dom.pptPanel.classList.toggle('hidden',  tab !== 'ppt');
}

/* ═══════════════════════════════════════
   HISTORY
═══════════════════════════════════════ */
function loadHistory() {
  try {
    state.history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || [];
  } catch { state.history = []; }
  renderHistory();
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.history));
}

function renderHistory() {
  const list = dom.historyList;
  list.innerHTML = '';
  if (!state.history.length) {
    list.innerHTML = '<li style="padding:8px 12px;color:var(--label-quaternary);font-size:12px;">No history yet</li>';
    return;
  }
  state.history.slice().reverse().forEach((session, idx) => {
    const realIdx = state.history.length - 1 - idx;
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <span title="${escHtml(session.title)}">${escHtml(session.title)}</span>
      <button class="del-btn icon-btn" data-idx="${realIdx}" aria-label="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>`;
    li.querySelector('span').addEventListener('click', () => loadSession(realIdx));
    li.querySelector('.del-btn').addEventListener('click', e => {
      e.stopPropagation();
      deleteSession(realIdx);
    });
    list.appendChild(li);
  });
}

function deleteSession(idx) {
  state.history.splice(idx, 1);
  saveHistory();
  renderHistory();
  showToast('Conversation deleted');
}

function loadSession(idx) {
  const session = state.history[idx];
  if (!session) return;
  state.messages = session.messages || [];
  state.currentSessionId = session.id;
  dom.welcome.classList.add('hidden');
  dom.messages.innerHTML = '';
  state.messages.forEach(m => appendMessageDOM(m.role, m.content, false));
  scrollToBottom();
}

function saveCurrentSession(title) {
  if (!state.messages.length) return;
  const existing = state.history.find(s => s.id === state.currentSessionId);
  if (existing) {
    existing.messages = [...state.messages];
    existing.title = title || existing.title;
  } else {
    state.currentSessionId = Date.now().toString();
    state.history.push({
      id: state.currentSessionId,
      title: title || state.messages[0]?.content?.slice(0, 48) || 'New Chat',
      messages: [...state.messages],
    });
  }
  saveHistory();
  renderHistory();
}

/* ═══════════════════════════════════════
   NEW CHAT
═══════════════════════════════════════ */
function startNewChat() {
  state.messages = [];
  state.currentSessionId = null;
  dom.messages.innerHTML = '';
  dom.welcome.classList.remove('hidden');
  dom.chatInput.value = '';
  updateSendBtn();
}

/* ═══════════════════════════════════════
   CHAT — SEND & RENDER
═══════════════════════════════════════ */
function updateSendBtn() {
  dom.sendBtn.disabled = !dom.chatInput.value.trim() || state.isStreaming;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

async function sendMessage() {
  const text = dom.chatInput.value.trim();
  if (!text || state.isStreaming) return;

  dom.welcome.classList.add('hidden');
  dom.chatInput.value = '';
  autoResize(dom.chatInput);
  updateSendBtn();

  // Add user message
  state.messages.push({ role: 'user', content: text });
  appendMessageDOM('user', text);
  scrollToBottom();

  // Typing indicator
  const typingEl = showTyping();

  // Simulate AI response
  state.isStreaming = true;
  updateSendBtn();

  try {
    const reply = await generateReply(text);
    typingEl.remove();
    state.messages.push({ role: 'assistant', content: reply });
    await appendMessageStream('assistant', reply);
    saveCurrentSession();
  } catch (err) {
    typingEl.remove();
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    state.isStreaming = false;
    updateSendBtn();
    scrollToBottom();
  }
}

/* Simulated reply generator — replace with real API call */
async function generateReply(userText) {
  await delay(600 + Math.random() * 400);

  const lower = userText.toLowerCase();

  if (lower.includes('ppt') || lower.includes('presentation') || lower.includes('slides')) {
    return `I can help you create a presentation! You can switch to the **PPT Assistant** tab above for full slide generation.

Here's a quick outline for a presentation on your topic:

1. **Introduction** — Set the context and hook your audience
2. **Problem Statement** — Define the challenge clearly
3. **Solution Overview** — Present your approach
4. **Key Details** — Deep dive with supporting data
5. **Results / Impact** — Quantify the outcome
6. **Call to Action** — What you want the audience to do

Would you like me to expand any section, or shall we jump straight to generating the slides?`;
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return `Hello! 👋 I'm **ClipCraft AI**, your intelligent assistant. I can help you with:

- 📝 **Writing** — drafts, emails, summaries
- 💡 **Brainstorming** — ideas, outlines, strategies  
- 📊 **Presentations** — use the PPT Assistant tab
- 🔍 **Research** — explanations and analysis

What would you like to work on today?`;
  }

  if (lower.includes('code') || lower.includes('function') || lower.includes('script')) {
    return `Here's an example based on your request:

\`\`\`javascript
// ClipCraft AI — Generated Code
function processInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  return Object.entries(data)
    .filter(([key, value]) => value !== null && value !== undefined)
    .reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'string' ? value.trim() : value;
      return acc;
    }, {});
}

// Usage
const result = processInput({ name: '  ClipCraft  ', score: 99, tag: null });
console.log(result); // { name: 'ClipCraft', score: 99 }
\`\`\`

Let me know if you'd like me to adapt this, add error handling, or explain any part.`;
  }

  if (lower.includes('summarize') || lower.includes('summary')) {
    return `I'd be happy to summarize! Please paste the content you'd like me to condense — an article, document, or any text — and I'll produce a clear, concise summary covering the key points.

If you have a URL, paste it and I can work from that too.`;
  }

  // Generic thoughtful response
  const responses = [
    `That's a great question. Let me think through this carefully.\n\nBased on your input, here are the key considerations:\n\n**1. Context matters** — The best approach depends on your specific situation and goals.\n\n**2. Multiple angles** — It's worth examining this from different perspectives before settling on a direction.\n\n**3. Next steps** — Once we narrow down the approach, I can help you execute it step by step.\n\nCould you share a bit more detail so I can give you a more tailored response?`,
    `Great point. Here's my analysis:\n\nThe core issue you're describing has a few dimensions worth unpacking:\n\n- **Immediate concern** — What needs to be addressed right now\n- **Underlying cause** — The root factor driving the situation\n- **Long-term strategy** — How to prevent this from recurring\n\nI'd recommend starting with the immediate concern, then working backwards. Want me to outline a concrete action plan?`,
    `Absolutely! Here's a structured breakdown:\n\n> The key to solving this effectively lies in breaking the problem into manageable parts.\n\n**Step 1** — Define the goal clearly\n**Step 2** — Identify constraints and resources\n**Step 3** — Generate options\n**Step 4** — Evaluate and choose\n**Step 5** — Execute and iterate\n\nThis framework works across most scenarios. Which step would you like to dive into first?`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function appendMessageDOM(role, content, animate = true) {
  const group = document.createElement('div');
  group.className = 'message-group chat-inner';

  if (role === 'user') {
    group.innerHTML = `
      <div class="msg-user">
        <div class="msg-user-bubble">${escHtml(content)}</div>
      </div>`;
  } else {
    group.innerHTML = `
      <div class="msg-ai">
        <div class="msg-ai-header">
          <img class="msg-ai-avatar" src="assets/clipcraft-logo.png" alt="ClipCraft AI" />
          <span class="msg-ai-name">ClipCraft AI</span>
        </div>
        <div class="msg-ai-content">${renderMarkdown(content)}</div>
        <div class="msg-actions">
          <button class="msg-action-btn" data-action="copy" title="Copy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button class="msg-action-btn" data-action="regen" title="Regenerate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
            Retry
          </button>
        </div>
      </div>`;

    // Wire actions
    group.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
      copyToClipboard(content);
      showToast('Copied to clipboard');
    });
    group.querySelector('[data-action="regen"]')?.addEventListener('click', regenLast);

    // Code copy buttons
    group.querySelectorAll('pre').forEach(pre => {
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', () => {
        copyToClipboard(pre.querySelector('code')?.textContent || pre.textContent);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }

  if (animate) group.style.animation = 'fadeUp 0.3s ease both';
  dom.messages.appendChild(group);
  return group;
}

async function appendMessageStream(role, content) {
  const group = document.createElement('div');
  group.className = 'message-group chat-inner';
  group.style.animation = 'fadeUp 0.3s ease both';

  if (role === 'assistant') {
    group.innerHTML = `
      <div class="msg-ai">
        <div class="msg-ai-header">
          <img class="msg-ai-avatar" src="assets/clipcraft-logo.png" alt="ClipCraft AI" />
          <span class="msg-ai-name">ClipCraft AI</span>
        </div>
        <div class="msg-ai-content stream-target"></div>
        <div class="msg-actions">
          <button class="msg-action-btn" data-action="copy" title="Copy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
        </div>
      </div>`;
  }

  dom.messages.appendChild(group);
  const target = group.querySelector('.stream-target');

  // Stream render: chunk by chunk
  const chunks = content.split(' ');
  let built = '';
  for (const chunk of chunks) {
    built += (built ? ' ' : '') + chunk;
    target.innerHTML = renderMarkdown(built);
    scrollToBottom();
    await delay(TYPING_SPEED_MS);
  }

  // Final render + code copy buttons
  target.innerHTML = renderMarkdown(content);
  group.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      copyToClipboard(pre.querySelector('code')?.textContent || pre.textContent);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });

  group.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
    copyToClipboard(content);
    showToast('Copied to clipboard');
  });

  return group;
}

async function regenLast() {
  const lastUser = [...state.messages].reverse().find(m => m.role === 'user');
  if (!lastUser || state.isStreaming) return;
  // Remove last assistant message from DOM
  const groups = dom.messages.querySelectorAll('.message-group');
  if (groups.length > 0) groups[groups.length - 1].remove();
  state.messages = state.messages.filter((_, i) => i < state.messages.length - 1);
  const typingEl = showTyping();
  state.isStreaming = true;
  updateSendBtn();
  try {
    const reply = await generateReply(lastUser.content);
    typingEl.remove();
    state.messages.push({ role: 'assistant', content: reply });
    await appendMessageStream('assistant', reply);
    saveCurrentSession();
  } finally {
    state.isStreaming = false;
    updateSendBtn();
    scrollToBottom();
  }
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'message-group chat-inner';
  el.innerHTML = `
    <div class="msg-ai">
      <div class="msg-ai-header">
        <img class="msg-ai-avatar" src="assets/clipcraft-logo.png" alt="ClipCraft AI"/>
        <span class="msg-ai-name">ClipCraft AI</span>
      </div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  dom.messages.appendChild(el);
  scrollToBottom();
  return el;
}

/* ═══════════════════════════════════════
   PPT ASSISTANT
═══════════════════════════════════════ */
async function generatePPT() {
  const topic = dom.pptInput.value.trim();
  if (!topic) return;

  dom.pptGenBtn.disabled = true;
  dom.pptGenBtn.innerHTML = `<div class="spinner"></div> Generating...`;

  await delay(1800 + Math.random() * 1000);

  const slides = buildPPTSlides(topic);
  renderPPTPreview(topic, slides);

  dom.pptGenBtn.disabled = false;
  dom.pptGenBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate`;
  showToast('Presentation outline ready!');
}

function buildPPTSlides(topic) {
  return [
    { title: `Introduction to ${topic}`, points: ['Background and context', 'Why this matters today', 'Scope of this presentation'] },
    { title: 'Current Landscape', points: ['Key trends shaping the space', 'Major stakeholders involved', 'Challenges and opportunities'] },
    { title: 'Core Framework', points: ['Foundational principles', 'Step-by-step approach', 'Tools and resources needed'] },
    { title: 'Case Studies', points: ['Real-world example #1', 'Real-world example #2', 'Lessons learned'] },
    { title: 'Results & Impact', points: ['Quantified outcomes', 'Qualitative improvements', 'ROI and metrics'] },
    { title: 'Next Steps', points: ['Immediate actions (0–30 days)', 'Mid-term goals (1–3 months)', 'Long-term vision'] },
  ];
}

function renderPPTPreview(topic, slides) {
  const container = dom.pptContent;
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'ppt-preview-card';
  card.style.animation = 'fadeUp 0.4s ease both';

  card.innerHTML = `
    <h3 style="font-size:15px;font-weight:600;color:var(--label-primary);margin-bottom:12px;">
      📊 "${escHtml(topic)}" — ${slides.length} Slides
    </h3>
    <div class="ppt-slide-preview">
      <div class="ppt-slide-header">${escHtml(slides[0].title)}</div>
      <div class="ppt-slide-body">
        ${slides[0].points.map(p => `<div class="ppt-slide-point">${escHtml(p)}</div>`).join('')}
      </div>
    </div>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
      ${slides.slice(1).map((s, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--r-sm);background:var(--bg-secondary);border:0.5px solid var(--sep-1);cursor:pointer;transition:background var(--t-fast);" class="ppt-slide-row">
          <span style="font-size:12px;font-weight:600;color:var(--ppt-red);width:20px;flex-shrink:0;">${i + 2}</span>
          <span style="font-size:13px;font-weight:500;color:var(--label-primary);flex:1;">${escHtml(s.title)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--label-tertiary);"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`).join('')}
    </div>
    <div class="ppt-actions-bar" style="margin-top:14px;justify-content:flex-start;">
      <button class="ppt-dl-btn" id="pptDownload">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export PPTX
      </button>
      <button class="ppt-outline-btn" id="pptCopyOutline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy Outline
      </button>
      <button class="ppt-outline-btn" id="pptToChat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Refine in Chat
      </button>
    </div>`;

  container.appendChild(card);

  // Wire buttons
  card.querySelector('#pptDownload')?.addEventListener('click', () => {
    showToast('PPTX export coming soon — connect your backend!', 'info');
  });
  card.querySelector('#pptCopyOutline')?.addEventListener('click', () => {
    const outline = slides.map((s, i) => `Slide ${i+1}: ${s.title}\n${s.points.map(p => `  • ${p}`).join('\n')}`).join('\n\n');
    copyToClipboard(outline);
    showToast('Outline copied!');
  });
  card.querySelector('#pptToChat')?.addEventListener('click', () => {
    switchTab('chat');
    dom.chatInput.value = `Please help me refine this presentation on "${topic}". Focus on making the content more compelling and data-driven.`;
    autoResize(dom.chatInput);
    updateSendBtn();
    dom.chatInput.focus();
  });

  // Hover effect on slide rows
  card.querySelectorAll('.ppt-slide-row').forEach(row => {
    row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-tertiary)');
    row.addEventListener('mouseleave', () => row.style.background = 'var(--bg-secondary)');
  });
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const icons = {
    success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>`,
  };
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icons[type] || ''}${escHtml(msg)}`;
  dom.toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 2800);
}

/* ═══════════════════════════════════════
   MARKDOWN RENDERER (lightweight)
═══════════════════════════════════════ */
function renderMarkdown(text) {
  if (!text) return '';
  let html = escHtml(text);

  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`);
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Unordered list
  html = html.replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');
  // Paragraphs (double newline)
  html = html.split(/\n{2,}/).map(block => {
    if (/^<(h[1-3]|ul|ol|pre|blockquote|hr)/.test(block.trim())) return block;
    return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
  }).join('');

  return html;
}

/* ═══════════════════════════════════════
   UTILITIES
═══════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function scrollToBottom() {
  const area = document.querySelector('.chat-area');
  if (area) area.scrollTop = area.scrollHeight;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
function init() {
  // Theme
  applyTheme(state.theme);

  // Load history
  loadHistory();

  // Sidebar toggle
  dom.toggleSidebar?.addEventListener('click', toggleSidebar);
  dom.sidebarOpen?.addEventListener('click', toggleSidebar);

  // New chat
  dom.newChat?.addEventListener('click', startNewChat);

  // Theme toggle
  dom.themeToggle?.addEventListener('click', toggleTheme);

  // Tab switching
  dom.chatTab?.addEventListener('click', () => switchTab('chat'));
  dom.pptTab?.addEventListener('click',  () => switchTab('ppt'));

  // Chat input
  dom.chatInput?.addEventListener('input', () => {
    autoResize(dom.chatInput);
    updateSendBtn();
  });
  dom.chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  dom.sendBtn?.addEventListener('click', sendMessage);

  // Suggestion cards
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      dom.chatInput.value = card.dataset.prompt;
      autoResize(dom.chatInput);
      updateSendBtn();
      dom.chatInput.focus();
    });
  });

  // PPT input
  dom.pptInput?.addEventListener('input', () => {
    dom.pptGenBtn.disabled = !dom.pptInput.value.trim();
  });
  dom.pptInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generatePPT(); }
  });
  dom.pptGenBtn?.addEventListener('click', generatePPT);

  // PPT option cards
  document.querySelectorAll('.ppt-option-card').forEach(card => {
    card.addEventListener('click', () => {
      dom.pptInput.value = card.dataset.prompt || '';
      dom.pptGenBtn.disabled = !dom.pptInput.value.trim();
      dom.pptInput.focus();
    });
  });

  // Model selector
  document.querySelector('.model-selector')?.addEventListener('click', () => {
    showToast('Model switching — connect your API!', 'info');
  });

  updateSendBtn();
}

document.addEventListener('DOMContentLoaded', init);
