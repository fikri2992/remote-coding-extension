/**
 * MessageInput Component - Rich text input for sending messages
 */

import { Component } from './base/Component.js';

export class MessageInput extends Component {
  constructor(options) {
    super(options);

    this.stateManager = options.stateManager;
    this.webSocketClient = options.webSocketClient;

    // Input state
    this.inputValue = '';
    this.isComposing = false;
    this.isSending = false;
    this.maxLength = 10000;

    // Rich text features
    this.supportedFormats = ['bold', 'italic', 'code', 'link'];
    this.shortcuts = new Map([
      ['Enter', 'send'],
      ['Shift+Enter', 'newline'],
      ['Ctrl+B', 'bold'],
      ['Ctrl+I', 'italic'],
      ['Ctrl+K', 'link'],
      ['Ctrl+`', 'code']
    ]);

    // History for input navigation
    this.inputHistory = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
  }

  async initialize() {
    await super.initialize();
    this.render();
    this.setupEventListeners();
    this.loadInputHistory();
  }

  render() {
    this.element = this.createElement('div', {}, ['message-input']);

    this.element.innerHTML = `
            <div class="input-toolbar" id="inputToolbar">
                <div class="format-buttons">
                    <button class="btn btn-icon format-btn" id="boldBtn" title="Bold (Ctrl+B)" data-format="bold">
                        <span class="icon">B</span>
                    </button>
                    <button class="btn btn-icon format-btn" id="italicBtn" title="Italic (Ctrl+I)" data-format="italic">
                        <span class="icon">I</span>
                    </button>
                    <button class="btn btn-icon format-btn" id="codeBtn" title="Code (Ctrl+\`)" data-format="code">
                        <span class="icon">\`</span>
                    </button>
                    <button class="btn btn-icon format-btn" id="linkBtn" title="Link (Ctrl+K)" data-format="link">
                        <span class="icon">🔗</span>
                    </button>
                </div>
                <div class="input-actions">
                    <button class="btn btn-icon" id="attachBtn" title="Attach File">
                        <span class="icon">📎</span>
                    </button>
                    <button class="btn btn-icon" id="historyBtn" title="Input History">
                        <span class="icon">📜</span>
                    </button>
                </div>
            </div>
            <div class="input-container">
                <div class="input-wrapper">
                    <textarea 
                        class="input textarea message-textarea" 
                        id="messageTextarea"
                        placeholder="Type your message here... (Shift+Enter for new line, Enter to send)"
                        rows="3"
                        maxlength="${this.maxLength}"></textarea>
                    <div class="input-overlay" id="inputOverlay">
                        <!-- Rich text preview overlay -->
                    </div>
                </div>
                <div class="input-footer">
                    <div class="input-info">
                        <span class="character-count" id="characterCount">0/${this.maxLength}</span>
                        <span class="input-status" id="inputStatus"></span>
                    </div>
                    <div class="input-buttons">
                        <button class="btn btn-secondary" id="clearBtn" title="Clear Input">
                            Clear
                        </button>
                        <button class="btn btn-primary" id="sendBtn" title="Send Message (Enter)">
                            <span class="btn-text">Send</span>
                            <span class="spinner hidden" id="sendSpinner"></span>
                        </button>
                    </div>
                </div>
            </div>
        `;

    this.container.appendChild(this.element);

    // Get references
    this.inputToolbar = this.querySelector('#inputToolbar');
    this.messageTextarea = this.querySelector('#messageTextarea');
    this.inputOverlay = this.querySelector('#inputOverlay');
    this.characterCount = this.querySelector('#characterCount');
    this.inputStatus = this.querySelector('#inputStatus');
    this.clearBtn = this.querySelector('#clearBtn');
    this.sendBtn = this.querySelector('#sendBtn');
    this.sendSpinner = this.querySelector('#sendSpinner');

    // Format buttons
    this.formatButtons = this.querySelectorAll('.format-btn');
    this.boldBtn = this.querySelector('#boldBtn');
    this.italicBtn = this.querySelector('#italicBtn');
    this.codeBtn = this.querySelector('#codeBtn');
    this.linkBtn = this.querySelector('#linkBtn');

    // Action buttons
    this.attachBtn = this.querySelector('#attachBtn');
    this.historyBtn = this.querySelector('#historyBtn');
  }

  setupEventListeners() {
    // Textarea events
    if (this.messageTextarea) {
      this.addEventListener(this.messageTextarea, 'input', this.handleInput);
      this.addEventListener(this.messageTextarea, 'keydown', this.handleKeyDown);
      this.addEventListener(this.messageTextarea, 'keyup', this.handleKeyUp);
      this.addEventListener(this.messageTextarea, 'paste', this.handlePaste);
      this.addEventListener(this.messageTextarea, 'focus', this.handleFocus);
      this.addEventListener(this.messageTextarea, 'blur', this.handleBlur);
    }

    // Button events
    if (this.sendBtn) {
      this.addEventListener(this.sendBtn, 'click', this.handleSend);
    }

    if (this.clearBtn) {
      this.addEventListener(this.clearBtn, 'click', this.handleClear);
    }

    // Format button events
    this.formatButtons.forEach(button => {
      this.addEventListener(button, 'click', (event) => {
        const format = button.dataset.format;
        this.applyFormat(format);
      });
    });

    // Action button events
    if (this.attachBtn) {
      this.addEventListener(this.attachBtn, 'click', this.handleAttach);
    }

    if (this.historyBtn) {
      this.addEventListener(this.historyBtn, 'click', this.handleHistory);
    }
  }

  handleInput(event) {
    this.inputValue = event.target.value;
    this.updateCharacterCount();
    this.updateSendButtonState();
    this.updateInputOverlay();

    // Reset history index when user types
    this.historyIndex = -1;

    // Send typing indicator if connected
    if (this.webSocketClient && this.webSocketClient.isConnected && this.inputValue.trim()) {
      this.webSocketClient.sendTypingIndicator(true, 'chat');
    }
  }

  handleKeyDown(event) {
    const key = this.getKeyCombo(event);

    // Handle keyboard shortcuts
    if (this.shortcuts.has(key)) {
      const action = this.shortcuts.get(key);

      switch (action) {
        case 'send':
          if (!event.shiftKey && !this.isComposing) {
            event.preventDefault();
            this.handleSend();
          }
          break;
        case 'newline':
          // Allow default behavior for Shift+Enter
          break;
        case 'bold':
          event.preventDefault();
          this.applyFormat('bold');
          break;
        case 'italic':
          event.preventDefault();
          this.applyFormat('italic');
          break;
        case 'code':
          event.preventDefault();
          this.applyFormat('code');
          break;
        case 'link':
          event.preventDefault();
          this.applyFormat('link');
          break;
      }
    }

    // Handle history navigation
    if (key === 'ArrowUp' && this.inputValue === '' && this.inputHistory.length > 0) {
      event.preventDefault();
      this.navigateHistory('up');
    } else if (key === 'ArrowDown' && this.historyIndex >= 0) {
      event.preventDefault();
      this.navigateHistory('down');
    }

    // Handle tab completion (future feature)
    if (key === 'Tab') {
      // Tab completion logic would go here
    }
  }

  handleKeyUp(event) {
    // Update composition state for IME input
    this.isComposing = event.isComposing || false;
  }

  handlePaste(event) {
    // Handle rich text paste
    const clipboardData = event.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData('text/plain');

    // Process pasted content
    if (pastedData) {
      // Check if pasting would exceed max length
      const currentLength = this.inputValue.length;
      const selectionLength = this.getSelectionLength();
      const newLength = currentLength - selectionLength + pastedData.length;

      if (newLength > this.maxLength) {
        event.preventDefault();
        this.showInputStatus('Paste would exceed maximum length', 'error');
        return;
      }
    }
  }

  handleFocus() {
    this.element.classList.add('focused');
    this.updateInputStatus('');
  }

  handleBlur() {
    this.element.classList.remove('focused');
    
    // Stop typing indicator when input loses focus
    if (this.webSocketClient && this.webSocketClient.isConnected) {
      this.webSocketClient.sendTypingIndicator(false, 'chat');
    }
  }

  handleSend() {
    if (this.isSending || !this.canSend()) {
      return;
    }

    const content = this.inputValue.trim();
    if (!content) {
      this.showInputStatus('Please enter a message', 'warning');
      return;
    }

    this.setSendingState(true);

    // Add to history
    this.addToHistory(content);

    // Create message metadata
    const metadata = {
      timestamp: new Date(),
      length: content.length,
      hasFormatting: this.hasRichTextFormatting(content)
    };

    // Emit message sent event
    this.emit('message-sent', {
      content: content,
      metadata: metadata
    });

    // Clear input
    this.clearInput();

    // Reset sending state after a short delay
    setTimeout(() => {
      this.setSendingState(false);
    }, 500);
  }

  handleClear() {
    if (this.inputValue) {
      if (confirm('Clear the current message?')) {
        this.clearInput();
      }
    }
  }

  handleAttach() {
    // File attachment functionality (future feature)
    this.showInputStatus('File attachment coming soon', 'info');
  }

  handleHistory() {
    // Show input history dropdown (future feature)
    this.showInputStatus('Input history coming soon', 'info');
  }

  applyFormat(format) {
    const textarea = this.messageTextarea;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);

    let formattedText = '';
    let newCursorPos = start;

    switch (format) {
      case 'bold':
        if (selectedText) {
          formattedText = `**${selectedText}**`;
          newCursorPos = start + formattedText.length;
        } else {
          formattedText = '****';
          newCursorPos = start + 2;
        }
        break;
      case 'italic':
        if (selectedText) {
          formattedText = `*${selectedText}*`;
          newCursorPos = start + formattedText.length;
        } else {
          formattedText = '**';
          newCursorPos = start + 1;
        }
        break;
      case 'code':
        if (selectedText) {
          if (selectedText.includes('\n')) {
            formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
          } else {
            formattedText = `\`${selectedText}\``;
          }
          newCursorPos = start + formattedText.length;
        } else {
          formattedText = '``';
          newCursorPos = start + 1;
        }
        break;
      case 'link':
        const url = selectedText.startsWith('http') ? selectedText : '';
        const linkText = url ? 'Link Text' : selectedText || 'Link Text';
        formattedText = `[${linkText}](${url || 'https://example.com'})`;
        newCursorPos = start + formattedText.length;
        break;
    }

    // Update textarea value
    const newValue = beforeText + formattedText + afterText;
    if (newValue.length <= this.maxLength) {
      textarea.value = newValue;
      this.inputValue = newValue;

      // Set cursor position
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);

      // Update UI
      this.updateCharacterCount();
      this.updateInputOverlay();
      this.updateSendButtonState();
    } else {
      this.showInputStatus('Formatting would exceed maximum length', 'error');
    }
  }

  navigateHistory(direction) {
    if (this.inputHistory.length === 0) return;

    if (direction === 'up') {
      if (this.historyIndex < this.inputHistory.length - 1) {
        this.historyIndex++;
      }
    } else if (direction === 'down') {
      if (this.historyIndex > 0) {
        this.historyIndex--;
      } else {
        this.historyIndex = -1;
        this.clearInput();
        return;
      }
    }

    const historyItem = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
    if (historyItem) {
      this.setInputValue(historyItem);
    }
  }

  addToHistory(content) {
    // Don't add empty or duplicate entries
    if (!content || content === this.inputHistory[this.inputHistory.length - 1]) {
      return;
    }

    this.inputHistory.push(content);

    // Limit history size
    if (this.inputHistory.length > this.maxHistorySize) {
      this.inputHistory.shift();
    }

    // Save to state manager
    this.saveInputHistory();
    this.historyIndex = -1;
  }

  loadInputHistory() {
    const savedHistory = this.stateManager?.getState('messageInput.history') || [];
    this.inputHistory = savedHistory.slice(-this.maxHistorySize);
  }

  saveInputHistory() {
    this.stateManager?.setState('messageInput.history', this.inputHistory);
  }

  updateCharacterCount() {
    if (this.characterCount) {
      const count = this.inputValue.length;
      this.characterCount.textContent = `${count}/${this.maxLength}`;

      // Add warning class if approaching limit
      if (count > this.maxLength * 0.9) {
        this.characterCount.classList.add('warning');
      } else {
        this.characterCount.classList.remove('warning');
      }
    }
  }

  updateSendButtonState() {
    if (this.sendBtn) {
      const canSend = this.canSend();
      this.sendBtn.disabled = !canSend;

      if (canSend) {
        this.sendBtn.classList.remove('disabled');
      } else {
        this.sendBtn.classList.add('disabled');
      }
    }
  }

  updateInputOverlay() {
    // Rich text preview overlay (future enhancement)
    // This would show a preview of formatted text
  }

  setSendingState(sending) {
    this.isSending = sending;

    if (this.sendBtn && this.sendSpinner) {
      if (sending) {
        this.sendBtn.disabled = true;
        this.sendSpinner.classList.remove('hidden');
        this.sendBtn.querySelector('.btn-text').textContent = 'Sending...';
      } else {
        this.sendBtn.disabled = !this.canSend();
        this.sendSpinner.classList.add('hidden');
        this.sendBtn.querySelector('.btn-text').textContent = 'Send';
      }
    }
  }

  showInputStatus(message, type = 'info') {
    if (this.inputStatus) {
      this.inputStatus.textContent = message;
      this.inputStatus.className = `input-status ${type}`;

      // Clear status after delay
      setTimeout(() => {
        this.updateInputStatus('');
      }, 3000);
    }
  }

  updateInputStatus(message) {
    if (this.inputStatus) {
      this.inputStatus.textContent = message;
      this.inputStatus.className = 'input-status';
    }
  }

  clearInput() {
    if (this.messageTextarea) {
      this.messageTextarea.value = '';
      this.inputValue = '';
      this.updateCharacterCount();
      this.updateSendButtonState();
      this.updateInputOverlay();
      this.messageTextarea.focus();
    }
  }

  setInputValue(value) {
    if (this.messageTextarea) {
      this.messageTextarea.value = value;
      this.inputValue = value;
      this.updateCharacterCount();
      this.updateSendButtonState();
      this.updateInputOverlay();
    }
  }

  canSend() {
    return !this.isSending &&
      this.inputValue.trim().length > 0 &&
      this.inputValue.length <= this.maxLength;
  }

  hasRichTextFormatting(text) {
    // Check for markdown-style formatting
    const formatPatterns = [
      /\*\*.*?\*\*/,  // Bold
      /\*.*?\*/,      // Italic
      /`.*?`/,        // Inline code
      /```[\s\S]*?```/, // Code block
      /\[.*?\]\(.*?\)/ // Links
    ];

    return formatPatterns.some(pattern => pattern.test(text));
  }

  getKeyCombo(event) {
    const parts = [];

    if (event.ctrlKey) parts.push('Ctrl');
    if (event.shiftKey) parts.push('Shift');
    if (event.altKey) parts.push('Alt');
    if (event.metaKey) parts.push('Meta');

    parts.push(event.key);

    return parts.join('+');
  }

  getSelectionLength() {
    if (this.messageTextarea) {
      return this.messageTextarea.selectionEnd - this.messageTextarea.selectionStart;
    }
    return 0;
  }

  focus() {
    if (this.messageTextarea) {
      this.messageTextarea.focus();
    }
  }

  blur() {
    if (this.messageTextarea) {
      this.messageTextarea.blur();
    }
  }

  getValue() {
    return this.inputValue;
  }

  setValue(value) {
    this.setInputValue(value);
  }

  getHistory() {
    return [...this.inputHistory];
  }

  clearHistory() {
    this.inputHistory = [];
    this.historyIndex = -1;
    this.saveInputHistory();
  }

  destroy() {
    // Save current input history before destroying
    this.saveInputHistory();

    super.destroy();
  }
}