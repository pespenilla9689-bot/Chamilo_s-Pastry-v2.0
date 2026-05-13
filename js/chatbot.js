// chatbot.js — rule-based customer support chatbot for Chamilo's Pastry

(function () {

/* ── Knowledge base ── */
const KB = [
  {
    patterns: [/hello|hi\b|hey|good (morning|afternoon|evening)/i],
    responses: [
      "Hi there! Welcome to Chamilo's Pastry. How can I help you today?",
      "Hello! I'm Chamilo's virtual assistant. What can I help you with?",
    ],
  },
  {
    patterns: [/hour|open|close|schedule|when.*open|what time/i],
    responses: [
      "Our studio hours are:\nTue – Sun: 10AM – 10PM\nWe're closed on Mondays.",
    ],
  },
  {
    patterns: [/menu|cake|product|what.*offer|what.*sell|available|catalog/i],
    responses: [
      "Here are some of our popular cakes:\n\n• Lavender Flutter Bloom Cake — ₱1,500\n• Crimson Ribbon Delight Cake — ₱1,800\n• Midnight Teddy Celebration Cake — ₱1,450\n• Strawberry Milk Cloud Cake — ₱1,500\n• Vanilla Bean Celebration Cake — ₱1,350\n• Lavender Honey Velvet Cake — ₱1,800\n• Red Velvet Classic — ₱1,750\n\nVisit our Menu page to see the full collection!",
    ],
  },
  {
    patterns: [/price|cost|how much|rate/i],
    responses: [
      "Our cakes start at ₱1,350. Prices vary by design and size. Check our Menu page for full pricing, or add items to your cart to see the total.",
    ],
  },
  {
    patterns: [/order|how.*order|place.*order|buy|purchase/i],
    responses: [
      "Ordering is easy!\n1. Browse our Menu page.\n2. Click 'Add to Cart' on items you love.\n3. Click the cart icon and hit Checkout.\n4. Fill in your details, choose pickup or delivery.\n5. Select a payment method and confirm your order.\n\nYou'll need to be logged in to place an order. Create a free account in under a minute!",
    ],
  },
  {
    patterns: [/deliver|pickup|ship|location|address|where.*pickup/i],
    responses: [
      "We offer both Pickup and Delivery.\n\n📍 Pickup: Diamond St., Brgy. Pembo, Makati City\nArrange pickup at checkout by choosing your preferred date.\n\n🚚 Delivery: Enter your address at checkout. Delivery availability depends on your location.",
    ],
  },
  {
    patterns: [/cancel|cancell|refund|return/i],
    responses: [
      "You can cancel individual items from a pending order through the 'My Orders' section (click your profile picture → My Orders).\n\nOnce an order moves to 'Processing' status, it can no longer be cancelled.\n\nFor urgent concerns, please contact us directly.",
    ],
  },
  {
    patterns: [/payment|pay|gcash|ewallet|bank|cash|cod|credit|card/i],
    responses: [
      "We accept the following payment methods:\n• GCash / E-wallet\n• Bank Transfer\n• Cash on Pickup\n• Cash on Delivery\n• Credit / Debit Card\n\nSelect your preferred method at checkout.",
    ],
  },
  {
    patterns: [/voucher|promo|discount|deal|code|coupon/i],
    responses: [
      "We offer a 10% off voucher for your first order!\n\n• Guest? Click the purple Deal button (bottom-left) and subscribe with your name and email.\n• Logged in? Click the Deal button to instantly claim your voucher code.\n\nEnter the code in the voucher field at checkout. Valid for 30 days.",
    ],
  },
  {
    patterns: [/account|sign.?in|log.?in|register|sign.?up|create.*account/i],
    responses: [
      "To create an account, click 'Log in' in the top-right corner and select 'Sign Up'. You can also sign in with Google or Facebook!\n\nAn account lets you track orders, save addresses, and claim your first-order voucher.",
    ],
  },
  {
    patterns: [/contact|phone|email|reach|talk|speak|human|staff/i],
    responses: [
      "You can reach us at:\n📞 +63 916 490 1535\n✉️ Chamilopastry@gmail.com\n📍 Diamond St., Brgy. Pembo, Makati City\n\nOr use the Contact page to send us a message directly!",
    ],
  },
  {
    patterns: [/custom|special.*order|design|personali/i],
    responses: [
      "We love creating custom cakes! For special orders and custom designs, please visit our Contact page and fill in the enquiry form. Include the occasion, your preferred design, and any specific instructions.",
    ],
  },
  {
    patterns: [/thank|thanks|appreciate|perfect|great|awesome/i],
    responses: [
      "You're welcome! Is there anything else I can help you with?",
      "Happy to help! Let me know if you have more questions.",
    ],
  },
  {
    patterns: [/bye|goodbye|see you|that'?s all|no more/i],
    responses: [
      "Thank you for visiting Chamilo's Pastry! Hope to see you soon. Have a sweet day!",
    ],
  },
];

const FALLBACK = [
  "I'm not sure I understood that. You can ask me about our menu, hours, ordering, delivery, payments, or how to contact us.",
  "Hmm, I didn't quite catch that. Try asking about cakes, pricing, delivery, or how to place an order!",
  "I don't have an answer for that yet. For specific concerns, please contact us at Chamilopastry@gmail.com or +63 916 490 1535.",
];

const QUICK_REPLIES = [
  "Opening hours",
  "View menu",
  "How to order",
  "Delivery options",
  "Payment methods",
  "Cancel an order",
  "Get a deal",
  "Contact us",
];

let _chatOpen = false;
let _msgCount = 0;

/* ── Build DOM ── */
function buildChatWidget() {
  const widget = document.createElement('div');
  widget.id    = 'chatWidget';
  widget.innerHTML = `
    <button id="chatToggleBtn" class="chat-toggle-btn" aria-label="Open chat">
      <svg id="chatIconOpen"  class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg id="chatIconClose" class="chat-icon" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <div id="chatWindow" class="chat-window" style="display:none">
      <div class="chat-header">
        <div class="chat-header-info">
          <img src="/assets/logo.png" class="chat-header-avatar" alt="Logo" />
          <div>
            <div class="chat-header-name">Chamilo's Assistant</div>
            <div class="chat-header-status">Online</div>
          </div>
        </div>
        <button class="chat-header-close" id="chatCloseBtn">✕</button>
      </div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-quick-replies" id="chatQuickReplies">
        ${QUICK_REPLIES.map(q => `<button class="chat-qr-btn" data-qr="${q}">${q}</button>`).join('')}
      </div>
      <div class="chat-input-row">
        <input type="text" id="chatInput" class="chat-input"
               placeholder="Ask me anything…" autocomplete="off" />
        <button id="chatSendBtn" class="chat-send-btn" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  document.getElementById('chatToggleBtn').addEventListener('click', toggleChat);
  document.getElementById('chatCloseBtn').addEventListener('click', closeChat);
  document.getElementById('chatSendBtn').addEventListener('click', sendMessage);
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  document.querySelectorAll('.chat-qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleUserMessage(btn.dataset.qr);
    });
  });

  addBotMessage("Hi! I'm Chamilo's virtual assistant. Ask me anything about our cakes, hours, ordering, or delivery!");
}

function toggleChat() {
  _chatOpen ? closeChat() : openChat();
}

function openChat() {
  _chatOpen = true;
  document.getElementById('chatWindow').style.display = 'flex';
  document.getElementById('chatIconOpen').style.display  = 'none';
  document.getElementById('chatIconClose').style.display = 'block';
  setTimeout(() => document.getElementById('chatWindow').classList.add('chat-window--open'), 10);
  document.getElementById('chatInput').focus();
}

function closeChat() {
  _chatOpen = false;
  document.getElementById('chatWindow').classList.remove('chat-window--open');
  document.getElementById('chatIconOpen').style.display  = 'block';
  document.getElementById('chatIconClose').style.display = 'none';
  setTimeout(() => { document.getElementById('chatWindow').style.display = 'none'; }, 280);
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  handleUserMessage(text);
}

function handleUserMessage(text) {
  addUserMessage(text);
  const response = getResponse(text);
  setTimeout(() => addBotMessage(response), 420);
}

function getResponse(text) {
  for (const entry of KB) {
    if (entry.patterns.some(p => p.test(text))) {
      const arr = entry.responses;
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }
  return FALLBACK[_msgCount % FALLBACK.length];
}

function addUserMessage(text) {
  _msgCount++;
  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg--user';
  msg.textContent = text;
  appendMessage(msg);
}

function addBotMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg--bot';
  msg.innerHTML = text.replace(/\n/g, '<br>');
  appendMessage(msg);
}

function appendMessage(el) {
  const container = document.getElementById('chatMessages');
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

/* ── Init ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildChatWidget);
} else {
  buildChatWidget();
}

})();
