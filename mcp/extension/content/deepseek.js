/**
 * DailyTickers MCP — DeepSeek Content Script
 *
 * Injected on chat.deepseek.com pages.
 * - Detects when on DeepSeek chat page
 * - Exposes function to inject analysis prompts into the chat input
 * - Reads responses from DeepSeek and sends back to background worker
 * - Listens for messages from background.js: { type: 'analyze', prompt: '...' }
 */

(function () {
  'use strict';

  /* ===== Constants ===== */
  const POLL_RESPONSE_INTERVAL_MS = 2000;
  const MAX_RESPONSE_WAIT_MS = 120000; // 2 minutes max wait

  /* ===== State ===== */
  let isProcessing = false;

  /* ===== Initialization ===== */
  function init() {
    console.log('[MW-MCP DeepSeek] Content script loaded');
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /* ===== Message Handler ===== */
  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === 'analyze') {
      if (isProcessing) {
        sendResponse({ ok: false, error: 'Already processing a request' });
        return true;
      }

      injectPromptAndWait(msg.prompt)
        .then(response => {
          chrome.runtime.sendMessage({
            type: 'DEEPSEEK_RESPONSE',
            data: {
              prompt: msg.prompt,
              response,
              timestamp: Date.now()
            }
          });
          sendResponse({ ok: true });
        })
        .catch(err => {
          console.error('[MW-MCP DeepSeek] Error:', err);
          sendResponse({ ok: false, error: err.message });
        });

      return true; // async sendResponse
    }

    if (msg.type === 'GET_DEEPSEEK_STATUS') {
      sendResponse({
        available: true,
        processing: isProcessing,
        chatReady: !!findChatTextarea()
      });
      return true;
    }
  }

  /* ===== Prompt Injection ===== */
  async function injectPromptAndWait(prompt) {
    isProcessing = true;

    try {
      const textarea = findChatTextarea();
      if (!textarea) {
        throw new Error('Chat textarea not found. Ensure DeepSeek chat is open.');
      }

      // Count existing messages to detect new response
      const existingMessages = countResponseMessages();

      // Set the prompt text in the textarea
      setTextareaValue(textarea, prompt);

      // Small delay to let React state update
      await sleep(300);

      // Find and click the submit button
      const submitted = clickSubmitButton();
      if (!submitted) {
        // Fallback: try pressing Enter
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      }

      // Wait for response
      const response = await waitForResponse(existingMessages);
      return response;
    } finally {
      isProcessing = false;
    }
  }

  /* ===== DOM Helpers ===== */

  /**
   * Find the chat textarea/input element.
   * DeepSeek uses a textarea or contenteditable div.
   */
  function findChatTextarea() {
    // Try common selectors for DeepSeek's chat input
    const selectors = [
      'textarea[placeholder]',
      'textarea#chat-input',
      'textarea',
      '[contenteditable="true"]',
      '.chat-input textarea',
      '#chat-input'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  /**
   * Set value in textarea, triggering React's onChange.
   */
  function setTextareaValue(textarea, value) {
    // For React-controlled inputs, we need to use the native setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, value);
    } else {
      textarea.value = value;
    }

    // Dispatch input event to trigger React state update
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    // For contenteditable elements
    if (textarea.contentEditable === 'true') {
      textarea.textContent = value;
      textarea.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value
      }));
    }
  }

  /**
   * Find and click the submit/send button.
   */
  function clickSubmitButton() {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send"]',
      'button[aria-label="send"]',
      'button.send-button',
      // Look for the send icon button (typically the last button near the textarea)
      'form button[type="submit"]',
      'button svg[data-icon="send"]'
    ];

    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && isVisible(btn) && !btn.disabled) {
        btn.click();
        return true;
      }
    }

    // Fallback: find buttons near the textarea with send-like icons
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = btn.textContent.trim().toLowerCase();
      if ((ariaLabel.includes('send') || text.includes('send')) && !btn.disabled) {
        btn.click();
        return true;
      }
    }

    return false;
  }

  /**
   * Count current response message elements.
   */
  function countResponseMessages() {
    const selectors = [
      '.markdown-body',
      '[data-testid="chat-message"]',
      '.message-content',
      '.chat-message-assistant',
      '.ds-markdown'
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) return els.length;
    }
    return 0;
  }

  /**
   * Wait for a new response to appear and complete.
   */
  function waitForResponse(previousCount) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let lastText = '';
      let stableCount = 0;

      const interval = setInterval(() => {
        // Timeout check
        if (Date.now() - startTime > MAX_RESPONSE_WAIT_MS) {
          clearInterval(interval);
          reject(new Error('Response timeout (2 min)'));
          return;
        }

        // Check for new response
        const currentCount = countResponseMessages();
        if (currentCount <= previousCount) return; // No new message yet

        // Get the latest response text
        const responseText = getLatestResponseText();
        if (!responseText) return;

        // Check if response is still streaming
        if (responseText === lastText) {
          stableCount++;
        } else {
          stableCount = 0;
          lastText = responseText;
        }

        // Consider response complete if text is stable for 3 polls (6 seconds)
        // Also check if streaming indicator has disappeared
        if (stableCount >= 3 && !isStillStreaming()) {
          clearInterval(interval);
          resolve(responseText);
        }
      }, POLL_RESPONSE_INTERVAL_MS);
    });
  }

  /**
   * Extract the text of the latest response message.
   */
  function getLatestResponseText() {
    const selectors = [
      '.markdown-body',
      '.ds-markdown',
      '[data-testid="chat-message"]:last-child',
      '.message-content:last-child',
      '.chat-message-assistant:last-child'
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        return els[els.length - 1].textContent.trim();
      }
    }
    return null;
  }

  /**
   * Check if DeepSeek is still streaming a response.
   */
  function isStillStreaming() {
    // Look for common streaming indicators
    const indicators = [
      '.loading-indicator',
      '.streaming',
      '[data-testid="stop-button"]',
      'button[aria-label="Stop"]',
      '.typing-indicator',
      '.cursor-blink'
    ];

    for (const sel of indicators) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return true;
    }
    return false;
  }

  /* ===== Utilities ===== */
  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
