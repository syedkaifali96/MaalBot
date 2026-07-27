import { escapeHTML, parseMarkdown, copyToClipboard } from './utils.js';

export class UIManager {
  constructor() {
    // Screens
    this.landingScreen = document.getElementById('landingScreen');
    this.apiScreen = document.getElementById('apiScreen');
    this.appScreen = document.getElementById('app');

    // API Setup
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.apiError = document.getElementById('apiError');

    // Sidebar
    this.sidebar = document.getElementById('sidebar');
    this.sidebarOverlay = document.getElementById('sidebarOverlay');
    this.sessionList = document.getElementById('sessionList');

    // Workspace & Chat
    this.currentModelLabel = document.getElementById('currentModelLabel');
    this.chatArea = document.getElementById('chatArea');
    this.userInput = document.getElementById('userInput');
    this.sendBtn = document.getElementById('sendBtn');

    // Modals
    this.settingsModal = document.getElementById('settingsModal');
    this.exportModal = document.getElementById('exportModal');
    this.settingsModelSelect = document.getElementById('settingsModelSelect');
    this.settingsTemperature = document.getElementById('settingsTemperature');

    // Skeletons
    this.skeletonTemplate = document.getElementById('skeletonTemplate');

    this.welcomeHTML = `
      <div class="welcome" id="welcome">
        <span class="welcome-icon">🪙</span>
        <h2>Maal Ka Sawal?</h2>
        <p>Pakistan's premium AI financial advisor — PKR, investments, and mutual funds in Hinglish!</p>
        <div class="welcome-grid">
          <div class="welcome-card" data-query="Mera paisa kahan invest karun safely?">
            <div class="card-icon">🛡️</div><div class="card-title">Safe Invest</div><div class="card-desc">Low risk options</div>
          </div>
          <div class="welcome-card" data-query="Monthly income ke liye best options kya hain?">
            <div class="card-icon">📅</div><div class="card-title">Monthly Income</div><div class="card-desc">Regular returns</div>
          </div>
          <div class="welcome-card" data-query="Inflation se paisa kaise bachayein Pakistan mein?">
            <div class="card-icon">📉</div><div class="card-title">Inflation Hedge</div><div class="card-desc">Protect value</div>
          </div>
          <div class="welcome-card" data-query="Islamic banking investment options kya hain?">
            <div class="card-icon">🕌</div><div class="card-title">Halal Options</div><div class="card-desc">Islamic finance</div>
          </div>
        </div>
      </div>
    `;
  }

  showScreen(screenName) {
    this.landingScreen.classList.remove('active');
    this.apiScreen.classList.remove('active');
    this.appScreen.classList.remove('active');

    if (screenName === 'landing') {
      this.landingScreen.classList.add('active');
    } else if (screenName === 'api') {
      this.apiScreen.classList.add('active');
    } else if (screenName === 'app') {
      this.appScreen.classList.add('active');
    }
  }

  setAPIError(message) {
    if (message) {
      this.apiError.textContent = `❌ ${message}`;
      this.apiError.style.display = 'block';
    } else {
      this.apiError.style.display = 'none';
    }
  }

  clearChatArea() {
    this.chatArea.innerHTML = this.welcomeHTML;
  }

  removeWelcome() {
    const welcome = document.getElementById('welcome');
    if (welcome) welcome.remove();
  }

  scrollToBottom() {
    this.chatArea.scrollTop = this.chatArea.scrollHeight;
  }

  toggleSidebar(open) {
    if (open) {
      this.sidebar.classList.add('open');
      this.sidebarOverlay.classList.add('active');
    } else {
      this.sidebar.classList.remove('open');
      this.sidebarOverlay.classList.remove('active');
    }
  }

  toggleModal(modalEl, show) {
    modalEl.style.display = show ? 'flex' : 'none';
  }

  /**
   * Appends an interactive skeleton screen to represent response generation.
   * Returns the skeleton element node so it can be dynamically swapped.
   */
  showLoadingSkeleton() {
    this.removeWelcome();
    const clone = this.skeletonTemplate.content.cloneNode(true);
    const skeletonDiv = clone.querySelector('.skeleton-message');
    this.chatArea.appendChild(skeletonDiv);
    this.scrollToBottom();
    return skeletonDiv;
  }

  /**
   * Adds a user or bot message card to the workspace viewport.
   * Automatically escaped and formatted via our secure parseMarkdown framework.
   */
  addMessage(role, text) {
    this.removeWelcome();
    
    const isUser = role === 'user';
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'usr' : 'bot'}`;
    avatar.textContent = isUser ? '👤' : '💰';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    const escaped = escapeHTML(text);
    bubble.innerHTML = parseMarkdown(escaped);
    
    if (!isUser) {
      this.appendCopyButton(bubble, text);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    this.chatArea.appendChild(messageDiv);
    this.scrollToBottom();
    return messageDiv;
  }

  /**
   * Helper to append a Copy button to bot bubble content.
   */
  appendCopyButton(bubble, text) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-msg-btn';
    copyBtn.innerHTML = '📋 Copy';
    copyBtn.setAttribute('title', 'Copy response to clipboard');
    copyBtn.addEventListener('click', () => {
      copyToClipboard(text, () => {
        copyBtn.innerHTML = '✅ Copied!';
        setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
      }, () => {
        copyBtn.innerHTML = '❌ Failed';
        setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
      });
    });
    bubble.appendChild(copyBtn);
  }

  /**
   * Appends a message container whose bot response will be dynamically filled.
   * Returns a function `appendChunk(chunkText)` and `finalize(fullText)` to handle streaming.
   */
  createStreamingMessage() {
    this.removeWelcome();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar bot';
    avatar.textContent = '💰';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Add streaming text placeholder
    const textSpan = document.createElement('span');
    bubble.appendChild(textSpan);
    
    // Typing animation dots inside streaming block
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.display = 'inline-flex';
    typingIndicator.style.marginLeft = '8px';
    typingIndicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    bubble.appendChild(typingIndicator);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    this.chatArea.appendChild(messageDiv);
    this.scrollToBottom();

    let fullText = '';

    return {
      appendChunk: (chunk) => {
        fullText += chunk;
        const escaped = escapeHTML(fullText);
        textSpan.innerHTML = parseMarkdown(escaped);
        this.scrollToBottom();
      },
      finalize: (finalText) => {
        typingIndicator.remove();
        textSpan.innerHTML = parseMarkdown(escapeHTML(finalText));
        this.appendCopyButton(bubble, finalText);
        this.scrollToBottom();
      }
    };
  }

  setLoading(isLoading) {
    this.userInput.disabled = isLoading;
    this.sendBtn.disabled = isLoading;
    if (!isLoading) {
      this.userInput.focus();
    }
  }

  /**
   * Dynamically renders active chat session navigation buttons in the sidebar.
   */
  renderSessions(sessions, activeId, onSelect, onDelete) {
    this.sessionList.innerHTML = '';
    
    if (sessions.length === 0) {
      this.sessionList.innerHTML = '<p class="disclaimer" style="margin-top:20px;">No saved sessions.</p>';
      return;
    }

    sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = `session-item ${session.id === activeId ? 'active' : ''}`;
      
      const meta = document.createElement('div');
      meta.className = 'session-meta';
      meta.addEventListener('click', () => onSelect(session.id));

      const title = document.createElement('div');
      title.className = 'session-title';
      // Use the first prompt, or default
      title.textContent = session.title || 'Untitled Strategy';
      
      const subtitle = document.createElement('div');
      subtitle.className = 'session-subtitle';
      subtitle.textContent = `${session.messages.length} messages`;

      meta.appendChild(title);
      meta.appendChild(subtitle);

      const delBtn = document.createElement('button');
      delBtn.className = 'session-del-btn';
      delBtn.textContent = '✕';
      delBtn.setAttribute('title', 'Delete Session');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete(session.id);
      });

      item.appendChild(meta);
      item.appendChild(delBtn);
      this.sessionList.appendChild(item);
    });
  }

  /**
   * Custom mutual fund calculator handler.
   */
  runSavingsCalculator() {
    const amountInput = document.getElementById('calcAmount');
    const yearsSelect = document.getElementById('calcYears');
    const resultBox = document.getElementById('calcResult');

    const principal = parseFloat(amountInput.value);
    const years = parseInt(yearsSelect.value);

    if (isNaN(principal) || principal <= 0) {
      alert('Valid amount daalo calculator shuru karne ke liye.');
      return;
    }

    // Assumed compound interest rate in Pakistan money market funds (18%)
    const rate = 0.18;
    const finalAmount = principal * Math.pow(1 + rate, years);
    const profit = finalAmount - principal;

    resultBox.innerHTML = `
      <div class="calc-res-title">Estimated Yield after ${years} Year(s) (18% p.a.)</div>
      <div class="calc-res-value">Rs. ${Math.round(finalAmount).toLocaleString()}</div>
      <div class="calc-res-desc">
        Principal investment Rs. ${Math.round(principal).toLocaleString()} generates an estimated net profit of 
        <strong>Rs. ${Math.round(profit).toLocaleString()}</strong> compound interest.
      </div>
    `;
    resultBox.style.display = 'block';
  }
}
