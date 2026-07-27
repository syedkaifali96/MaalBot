/**
 * Escapes unsafe HTML characters to prevent XSS attacks.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Basic safe Markdown-to-HTML formatter.
 * Note: input must be already HTML-escaped.
 * Supports bold, bullet points, headers, paragraphs, lists, blockquotes, code-blocks, and dividers.
 * @param {string} text 
 * @returns {string}
 */
export function parseMarkdown(text) {
  if (!text) return '';
  
  // Format bold text (**text** or __text__)
  let html = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  
  // Format inline code (`code`)
  html = html.replace(/`(.*?)`/g, '<code class="code-span">$1</code>');

  // Convert double newlines to paragraph breaks, single to line breaks safely
  const lines = html.split('\n');
  let result = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlockLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    
    // Code block detection (```language)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        inCodeBlock = false;
        const codeContent = codeBlockLines.join('\n');
        result.push(`<pre class="syntax-code-block"><code>${codeContent}</code></pre>`);
        codeBlockLines = [];
      } else {
        // Start of code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Dividers
    if (trimmed === '---' || trimmed === '***') {
      result.push('<hr class="chat-divider">');
      continue;
    }

    // Check for blockquotes
    if (trimmed.startsWith('&gt;') || trimmed.startsWith('>')) {
      const quoteText = trimmed.startsWith('&gt;') ? trimmed.substring(4).trim() : trimmed.substring(1).trim();
      result.push(`<blockquote class="chat-blockquote">${quoteText}</blockquote>`);
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        result.push('<ul class="chat-list">');
        inList = true;
      }
      const itemText = trimmed.substring(2);
      result.push(`<li>${itemText}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed === '') {
        result.push('<div class="spacer"></div>');
      } else {
        result.push(`<p>${line}</p>`);
      }
    }
  }
  
  if (inCodeBlock && codeBlockLines.length > 0) {
    result.push(`<pre class="syntax-code-block"><code>${codeBlockLines.join('\n')}</code></pre>`);
  }
  if (inList) {
    result.push('</ul>');
  }

  return result.join('');
}

// Memory fallback object to prevent browser crashes in high-privacy Incognito mode
const memoryStorage = {};

/**
 * Secure local storage wrappers with high-privacy Private/Incognito memory fallback.
 */
export const Storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('LocalStorage blocked or unavailable. Falling back to memory storage.', e);
      return memoryStorage[key] || null;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      console.warn('LocalStorage write failed. Falling back to memory storage.', e);
      memoryStorage[key] = String(val);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('LocalStorage deletion failed. Falling back to memory storage.', e);
      delete memoryStorage[key];
    }
  },
  getJson(key) {
    const val = this.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch (e) {
      console.error('JSON parse failed for storage key', key, e);
      return null;
    }
  },
  setJson(key, val) {
    try {
      this.set(key, JSON.stringify(val));
    } catch (e) {
      console.error('JSON stringify failed for storage key', key, e);
    }
  }
};

/**
 * Safe utility to copy text to clipboard with feedback callback.
 * @param {string} text 
 * @param {function} successCallback 
 * @param {function} errorCallback 
 */
export function copyToClipboard(text, successCallback, errorCallback) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(successCallback)
      .catch(errorCallback);
  } else {
    // Fallback
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) successCallback();
      else errorCallback();
    } catch (err) {
      errorCallback(err);
    }
  }
}

/**
 * Formats a chat history into a downloadable file.
 * Supports txt, json, markdown (.md), and PDF printing downloads.
 * @param {Array<{role: string, content: string}>} history 
 * @param {'txt'|'json'|'md'|'pdf'} format 
 */
export function exportConversation(history, format = 'txt') {
  let content = '';
  let mimeType = 'text/plain';
  let filename = `MaalBot-chat-history.${format}`;

  if (format === 'json') {
    content = JSON.stringify(history, null, 2);
    mimeType = 'application/json';
  } else if (format === 'md') {
    content = history.map(msg => {
      const speaker = msg.role === 'user' ? '### 👤 User' : '### 💰 MaalBot';
      return `${speaker}\n\n${msg.content}\n\n---\n\n`;
    }).join('');
    mimeType = 'text/markdown';
  } else if (format === 'pdf') {
    // Beautiful, printable layout fallback using the browser print frame
    const printWindow = window.open('', '_blank');
    const escapedChat = history.map(msg => {
      const speaker = msg.role === 'user' ? 'User' : 'MaalBot';
      return `<div style="margin-bottom:24px;border-bottom:1px solid #eee;padding-bottom:16px;">
        <strong style="color:${msg.role === 'user' ? '#8a6e2f' : '#C9A84C'};font-size:16px;">${speaker}:</strong>
        <p style="font-size:14px;line-height:1.6;margin-top:6px;white-space:pre-wrap;">${escapeHTML(msg.content)}</p>
      </div>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>MaalBot Premium Strategy Export</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            h1 { font-family: Georgia, serif; color: #C9A84C; border-bottom: 2px solid #C9A84C; padding-bottom: 10px; }
            footer { margin-top: 50px; font-size: 11px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <h1>MaalBot Premium Strategy Strategy</h1>
          <p><em>Pakistan Financial Intelligence Export</em></p>
          <div style="margin-top:30px;">${escapedChat}</div>
          <footer>Generated via MaalBot Premium. All calculations are advisory estimates.</footer>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
    return;
  } else {
    content = history.map(msg => {
      const speaker = msg.role === 'user' ? 'USER' : 'MAALBOT';
      return `[${speaker}]:\n${msg.content}\n\n====================\n\n`;
    }).join('');
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Debouncing utility to limit rate of function executions.
 * @param {function} func 
 * @param {number} delay 
 * @returns {function}
 */
export function debounce(func, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Simple Toast Notification framework creator helper.
 * Generates beautiful, self-dismissing notification toasts.
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 */
export function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-text">${message}</span>
  `;
  container.appendChild(toast);

  // Self-destruct triggers
  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3500);
}
