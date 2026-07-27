# 🪙 MaalBot Premium — Elite AI Financial Advisor

> Pakistan's premier interactive AI financial assistant. Formulate investment strategies, estimate high-yield returns, and navigate complex Shariah-compliant mutual funds in Roman Urdu (Hinglish) and English.

### 🔴 Live Demo: [syedkaifali96.github.io/maalbot](https://syedkaifali96.github.io/maalbot/)

---

## 🌟 Key Features

1. **Ultra-Fast Stream Completions**  
   Leverages Groq's low-latency inference engine powered by the **Llama 3.3 70B** model to deliver word-by-word real-time output stream decoding over a secure `ReadableStream` connection.
   
2. **Interactive PKR Mutual Fund Savings Calculator**  
   Built-in low-risk yield calculator optimized for Pakistani money market options, estimating compound interest returns at a baseline of **18% p.a.** over selectable durations.

3. **Multi-Format Strategy Exporters**  
   Export and read your strategies offline. Fully supports exporting chat records to:
   - **Plain Text (`.txt`)**
   - **Structured Data (`.json`)**
   - **Markdown Documents (`.md`)** with code syntax boundaries
   - **Printable PDF Formats (`.pdf`)** styled perfectly for standard printers

4. **Multi-Session Chat & Search**  
   Create multiple strategy sessions and search titles instantly using our real-time fuzzy sidebar filter.

5. **A11y, Touch-Targets & Responsive Glassmorphism UI**  
   WCAG-standard elements featuring 44px touch targets, dynamic Light/Dark themes, GPU accelerated transitions, layout-safe skeletons, and keyboard-tab boundaries.

---

## 🛠️ Folder & System Architecture

```bash
├── index.html           # Highly optimized premium landing page & modal views (SEO/A11y compliant)
├── README.md            # Comprehensive project architecture guide
├── package.json         # Testing dependencies and build automation suite
├── src/
│   ├── css/
│   │   └── style.css    # Responsive styles, theme variables, and custom typography layers
│   └── js/
│       ├── api.js       # Secured client-side Groq completion fetch & AbortController stream decoding
│       ├── app.js       # Master controller managing UI routing, state updates, and session bindings
│       ├── config.js    # Decoupled system settings (LLM parameters, API endpoints, system rules)
│       ├── ui.js        # DOM manipulator coordinating workspace screens and formatting skeletons
│       └── utils.js     # Helper libraries (Safe markdown parsing, XSS-secured escaper, exporters, toasts)
└── tests/
    └── visual_verify.spec.js # Comprehensive Playwright automated visual integration test suite
```

### Flow Diagram & Stream Routing

```
[Browser UI] ──(Input Sawaal)──> [app.js / ui.js (State Check)]
                                      │
                                      ▼
                                [api.js (Aborted Stream Endpoint)]
                                      │
                                      ▼
                                [Groq Completion Endpoint]
                                      │
                            (ReadableStream Reader)
                                      │
                                      ▼
[Browser UI] <──(Toast / Chunk)─── [Stream Parser / utils.js (Secure Escape)]
```

---

## 🔒 Security Auditing

- **Zero API Key Leakage**: Keys remain strictly sandboxed inside standard browser local storage (`localStorage`) or volatile state variables, bypassing server logs.
- **Robust XSS Countermeasures**: All user prompts and chatbot responses undergo strict HTML-character replacement (`escapeHTML()`) before parsing markdown wrappers.
- **Advanced Error Shielding**: Handled under custom `APIError` classes, automatically mapping server-side exceptions (401 Bad Credentials, 429 Rate Limits, 503 Overloads) with clear self-dismissing toast notifications.

---

## 🚀 Getting Started

Simply open `index.html` directly in any web browser to explore. Alternatively, run a local development server:

```bash
# Start a local static file server
python3 -m http.server 8000
```

Now, navigate to `http://localhost:8000` in your web browser.

---

## 🧪 Testing and Quality Control

The project uses Playwright to verify UI layout responsive boundaries and functional API interactions.

```bash
# Install testing suite dependencies
npm install

# Run Playwright tests
npx playwright test
```
