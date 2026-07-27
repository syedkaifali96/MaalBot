import { Storage, exportConversation } from './utils.js';
import { sendChatRequest } from './api.js';
import { UIManager } from './ui.js';
import { MODELS, DEFAULT_MODEL } from './config.js';

let apiKey = '';
let currentSessionId = '';
let sessions = []; // Array of { id: string, title: string, messages: Array }
let activeSettings = { model: DEFAULT_MODEL, temperature: '0.7' };
let ui;

document.addEventListener('DOMContentLoaded', () => {
  ui = new UIManager();
  initApp();
});

function initApp() {
  // Load configuration & user settings with fallback tolerance
  try {
    apiKey = Storage.get('groq_api_key') || '';
    
    const savedSettings = Storage.getJson('maalbot_custom_settings');
    if (savedSettings) {
      activeSettings = { ...activeSettings, ...savedSettings };
    }

    // Load theme preference
    const savedTheme = Storage.get('maalbot_theme') || 'dark';
    setTheme(savedTheme);
  } catch (err) {
    console.error('Failed to load initial configurations from storage:', err);
  }

  // Populate settings modal options
  populateSettingsOptions();

  // Load multiple chat sessions state
  loadSessionsState();

  // UI Flow Route Handler
  if (apiKey) {
    ui.apiKeyInput.value = apiKey;
    ui.showScreen('app');
    refreshChatWorkspace();
  } else {
    ui.showScreen('landing');
  }

  // Attach interactive listeners
  setupListeners();
}

/**
 * Sync active model selection dropdown with config.MODELS.
 */
function populateSettingsOptions() {
  ui.settingsModelSelect.innerHTML = '';
  MODELS.forEach(model => {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = model.name;
    if (model.id === activeSettings.model) {
      opt.selected = true;
    }
    ui.settingsModelSelect.appendChild(opt);
  });

  ui.settingsTemperature.value = activeSettings.temperature;
  updateHeaderLabel();
}

function updateHeaderLabel() {
  const modelName = MODELS.find(m => m.id === activeSettings.model)?.name || activeSettings.model;
  ui.currentModelLabel.textContent = `Model: ${modelName} · Temp: ${activeSettings.temperature}`;
}

/**
 * Load, create or parse saved sessions state from LocalStorage.
 */
function loadSessionsState() {
  try {
    sessions = Storage.getJson('maalbot_conversations') || [];
    currentSessionId = Storage.get('maalbot_active_session_id') || '';
  } catch (err) {
    console.error('Failed to parse sessions from storage:', err);
    sessions = [];
  }

  // Fallback: If no sessions exist, build a first session template
  if (sessions.length === 0) {
    createNewSession();
  } else if (!currentSessionId || !sessions.some(s => s.id === currentSessionId)) {
    currentSessionId = sessions[0].id;
    Storage.set('maalbot_active_session_id', currentSessionId);
  }

  renderSidebarSessions();
}

function createNewSession() {
  const newId = 'session_' + Date.now();
  const newSession = {
    id: newId,
    title: 'New Strategy Session 💡',
    messages: []
  };
  sessions.unshift(newSession);
  currentSessionId = newId;
  
  saveSessionsToStorage();
  Storage.set('maalbot_active_session_id', currentSessionId);
}

function saveSessionsToStorage() {
  Storage.setJson('maalbot_conversations', sessions);
}

function renderSidebarSessions() {
  ui.renderSessions(
    sessions,
    currentSessionId,
    selectActiveSession,
    deleteSession
  );
}

/**
 * Handle switching between different chat conversations.
 */
function selectActiveSession(sessionId) {
  if (sessionId === currentSessionId) return;
  currentSessionId = sessionId;
  Storage.set('maalbot_active_session_id', currentSessionId);
  
  renderSidebarSessions();
  refreshChatWorkspace();
  ui.toggleSidebar(false); // Close responsive sidebar drawers on mobile selection
}

function deleteSession(sessionId) {
  if (confirm('Kya aap is session ki chat history delete karna chahte hain?')) {
    sessions = sessions.filter(s => s.id !== sessionId);
    
    if (sessions.length === 0) {
      createNewSession();
    } else if (currentSessionId === sessionId) {
      currentSessionId = sessions[0].id;
      Storage.set('maalbot_active_session_id', currentSessionId);
    }

    saveSessionsToStorage();
    renderSidebarSessions();
    refreshChatWorkspace();
  }
}

/**
 * Clears workspace chat list and appends stored history of active session.
 */
function refreshChatWorkspace() {
  const activeSession = sessions.find(s => s.id === currentSessionId);
  if (activeSession && activeSession.messages.length > 0) {
    ui.removeWelcome();
    ui.chatArea.innerHTML = '';
    activeSession.messages.forEach(msg => {
      ui.addMessage(msg.role, msg.content);
    });
  } else {
    ui.clearChatArea();
  }
}

/**
 * Event bindings configuration.
 */
function setupListeners() {
  // Landing page launch/planning buttons
  document.getElementById('landingCtaLaunch').addEventListener('click', () => {
    ui.showScreen(apiKey ? 'app' : 'api');
  });

  document.getElementById('heroStartBtn').addEventListener('click', () => {
    ui.showScreen(apiKey ? 'app' : 'api');
  });

  document.getElementById('apiBackBtn').addEventListener('click', () => {
    ui.showScreen('landing');
  });

  // Theme Toggles
  document.getElementById('landingThemeToggle').addEventListener('click', toggleThemeFlow);
  document.getElementById('appThemeToggle').addEventListener('click', toggleThemeFlow);

  // ROI Calculator
  document.getElementById('runCalcBtn').addEventListener('click', () => ui.runSavingsCalculator());

  // API Screen Submit
  document.getElementById('startBtn').addEventListener('click', handleApiSubmit);
  ui.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleApiSubmit();
  });

  // Sidebar Controls
  document.getElementById('newChatBtn').addEventListener('click', () => {
    createNewSession();
    renderSidebarSessions();
    refreshChatWorkspace();
    ui.toggleSidebar(false);
  });

  document.getElementById('sidebarOpenBtn').addEventListener('click', () => ui.toggleSidebar(true));
  document.getElementById('sidebarCloseBtn').addEventListener('click', () => ui.toggleSidebar(false));
  ui.sidebarOverlay.addEventListener('click', () => ui.toggleSidebar(false));

  // Modal Open triggers
  document.getElementById('settingsOpenBtn').addEventListener('click', () => {
    ui.toggleModal(ui.settingsModal, true);
  });

  document.getElementById('exportChatBtn').addEventListener('click', () => {
    ui.toggleModal(ui.exportModal, true);
  });

  // Modal Dismiss triggers
  document.getElementById('settingsCloseBtn').addEventListener('click', () => {
    ui.toggleModal(ui.settingsModal, false);
  });

  document.getElementById('exportCloseBtn').addEventListener('click', () => {
    ui.toggleModal(ui.exportModal, false);
  });

  // Dismiss modal by clicking backdrop overlay
  ui.settingsModal.addEventListener('click', (e) => {
    if (e.target === ui.settingsModal) ui.toggleModal(ui.settingsModal, false);
  });
  ui.exportModal.addEventListener('click', (e) => {
    if (e.target === ui.exportModal) ui.toggleModal(ui.exportModal, false);
  });

  // A11y: Escape key to dismiss active modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ui.toggleModal(ui.settingsModal, false);
      ui.toggleModal(ui.exportModal, false);
      ui.toggleSidebar(false);
    }
  });

  // Settings Save
  document.getElementById('settingsSaveBtn').addEventListener('click', () => {
    activeSettings.model = ui.settingsModelSelect.value;
    activeSettings.temperature = ui.settingsTemperature.value;
    Storage.setJson('maalbot_custom_settings', activeSettings);
    
    updateHeaderLabel();
    ui.toggleModal(ui.settingsModal, false);
  });

  // Optional google-auth mock click handler
  const googleBtn = document.getElementById('googleAuthBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      import('./utils.js').then(({ showToast }) => {
        showToast('Google Sign-In simulation complete! Session cached securely.', 'success');
      });
    });
  }

  // Live sidebar session search functionality
  const chatSearch = document.getElementById('chatSearchInput');
  if (chatSearch) {
    chatSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const items = ui.sessionList.querySelectorAll('.session-item');
      items.forEach(item => {
        const titleEl = item.querySelector('.session-title');
        if (titleEl) {
          const match = titleEl.textContent.toLowerCase().includes(query);
          item.style.display = match ? 'flex' : 'none';
        }
      });
    });
  }

  // Export File handlers
  document.getElementById('exportTxtBtn').addEventListener('click', () => {
    const active = sessions.find(s => s.id === currentSessionId);
    if (active) exportConversation(active.messages, 'txt');
    ui.toggleModal(ui.exportModal, false);
  });

  document.getElementById('exportJsonBtn').addEventListener('click', () => {
    const active = sessions.find(s => s.id === currentSessionId);
    if (active) exportConversation(active.messages, 'json');
    ui.toggleModal(ui.exportModal, false);
  });

  document.getElementById('exportMdBtn').addEventListener('click', () => {
    const active = sessions.find(s => s.id === currentSessionId);
    if (active) exportConversation(active.messages, 'md');
    ui.toggleModal(ui.exportModal, false);
  });

  document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const active = sessions.find(s => s.id === currentSessionId);
    if (active) exportConversation(active.messages, 'pdf');
    ui.toggleModal(ui.exportModal, false);
  });

  // Main chat workspace text input keyboard handler
  ui.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageFlow();
    }
  });

  // Send click
  ui.sendBtn.addEventListener('click', sendMessageFlow);

  // Voice input (Web Speech API) — not supported in all browsers (e.g. Firefox desktop)
  setupVoiceInput();

  // Global delegate selector for chips & cards
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const query = chip.getAttribute('data-query');
      if (query) {
        ui.userInput.value = query;
        sendMessageFlow();
      }
    }

    const welcomeCard = e.target.closest('.welcome-card');
    if (welcomeCard) {
      const query = welcomeCard.getAttribute('data-query');
      if (query) {
        ui.userInput.value = query;
        sendMessageFlow();
      }
    }
  });

  // Workspace Main Logout click
  document.getElementById('logoutBtn').addEventListener('click', logoutFlow);
}

/**
 * Wires the mic button to browser speech recognition (Hinglish/Urdu-friendly:
 * falls back to English recognition since ur-PK support varies by browser).
 * Silently no-ops (hides the button) if the API isn't available.
 */
function setupVoiceInput() {
  const micBtn = document.getElementById('micBtn');
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  recognition.addEventListener('result', (e) => {
    const transcript = e.results?.[0]?.[0]?.transcript;
    if (transcript) {
      ui.userInput.value = transcript;
      ui.userInput.focus();
    }
  });

  recognition.addEventListener('end', () => {
    listening = false;
    micBtn.classList.remove('mic-active');
  });

  recognition.addEventListener('error', (e) => {
    listening = false;
    micBtn.classList.remove('mic-active');
    console.warn('Speech recognition error:', e.error);
  });

  micBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      listening = true;
      micBtn.classList.add('mic-active');
    } catch (err) {
      console.warn('Could not start speech recognition:', err);
    }
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'light') {
    document.body.className = 'light-theme';
  } else {
    document.body.className = 'dark-theme';
  }
  Storage.set('maalbot_theme', theme);
}

function toggleThemeFlow() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
}

function handleApiSubmit() {
  const inputKey = ui.apiKeyInput.value.trim();
  if (!inputKey) {
    ui.setAPIError('Groq API Key daalo shuru karne ke liye.');
    return;
  }
  if (!inputKey.startsWith('gsk_')) {
    ui.setAPIError('Valid Groq API key daalo! (gsk_ se shuru honi chahiye)');
    return;
  }

  apiKey = inputKey;
  Storage.set('groq_api_key', apiKey);
  ui.setAPIError(null);
  
  // Refresh layout
  ui.showScreen('app');
  refreshChatWorkspace();
}

function logoutFlow() {
  if (confirm('Kya aap logout karna chahte hain? (Aapka local configuration clear ho jayega)')) {
    apiKey = '';
    sessions = [];
    currentSessionId = '';
    
    Storage.remove('groq_api_key');
    Storage.remove('maalbot_conversations');
    Storage.remove('maalbot_active_session_id');

    ui.apiKeyInput.value = '';
    
    // Reset back to base setup
    loadSessionsState();
    ui.showScreen('landing');
  }
}

/**
 * Full message orchestration flow with real-time response streaming.
 */
async function sendMessageFlow() {
  const queryText = ui.userInput.value.trim();
  if (!queryText) return;

  // Clear prompt text & lock chat submission buttons
  ui.userInput.value = '';
  ui.setLoading(true);

  // Retrieve active conversation session
  const activeSession = sessions.find(s => s.id === currentSessionId);
  if (!activeSession) return;

  // Append user message to view, model, and persistent Storage
  ui.addMessage('user', queryText);
  activeSession.messages.push({ role: 'user', content: queryText });
  
  // Set first prompt as conversation title if untitle default
  if (activeSession.title.startsWith('New Strategy')) {
    activeSession.title = queryText.slice(0, 32) + (queryText.length > 32 ? '...' : '');
    renderSidebarSessions();
  }

  saveSessionsToStorage();

  // Create loading skeletons as visual indicator before tokens arrive
  const skeletonNode = ui.showLoadingSkeleton();

  try {
    // Initialise streaming text handler inside the layout viewport
    let streamingHandler = null;

    const fullBotResponse = await sendChatRequest(
      apiKey,
      activeSession.messages,
      activeSettings,
      (textChunk) => {
        // Callback chunk arrived!
        // Swap skeleton with actual message bubble on first token chunk
        if (skeletonNode) {
          skeletonNode.remove();
        }
        if (!streamingHandler) {
          streamingHandler = ui.createStreamingMessage();
        }
        streamingHandler.appendChunk(textChunk);
      }
    );

    // Stream finished! Record answer inside state and storage
    if (skeletonNode) {
      skeletonNode.remove();
    }
    if (streamingHandler) {
      streamingHandler.finalize(fullBotResponse);
    } else {
      // Fallback if no callbacks were triggered
      ui.addMessage('assistant', fullBotResponse);
    }

    activeSession.messages.push({ role: 'assistant', content: fullBotResponse });
    saveSessionsToStorage();
    renderSidebarSessions();

  } catch (err) {
    if (skeletonNode) {
      skeletonNode.remove();
    }
    ui.addMessage('assistant', `❌ Error: ${err.message}`);
    console.error('Chat error:', err);
  } finally {
    ui.setLoading(false);
  }
}
