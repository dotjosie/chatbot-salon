// ─────────────────────────────────────────────────────────────────────────────
// chatbot.js — State machine engine
// Reads flow-data.js, renders screens, handles input, tracks state, computes totals.
// All routing logic lives here. All copy and pricing lives in flow-data.js.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Session state ────────────────────────────────────────────────────────────
let session = {
  isReturning:     null,
  service:         null,  // 'color' | 'cut' | 'perm' | 'bleach' | 'treatment'
  colorType:       null,  // 'full-color' | 'balayage'
  hairLength:      null,  // 'XS' | 'S' | 'M' | 'L' | 'XL'
  naturalColor:    null,
  isPermed:        null,
  isBleached:      null,
  hasBoxDye:       null,
  treatmentAddon:  null,  // 'milbon' | 'tokio' | 'purifica' | null
  bleachRequired:  false,
  specialCondition: null  // 'box-dye-balayage' | null
};

let currentStepId = null;

// ─── Service keyword matcher ───────────────────────────────────────────────────
// Returns { service, colorType? } or null if no match.
function matchServiceText(raw) {
  const t = raw.toLowerCase();

  // Color sub-types — check these first so specifics beat generic 'color'
  const BALAYAGE_TERMS   = ['balayage', 'highlight', 'babylight', 'ombre', 'sombre', 'hand-painted', 'hand painted', 'painted', 'partial color', 'partial colour', 'dimension'];
  const FULL_COLOR_TERMS = ['full color', 'full colour', 'all-over', 'allover', 'all over', 're-dye', 'redye', 'redo my color', 'redo my colour', 'dye all', 'darker', 'permanent color', 'permanent colour'];

  if (BALAYAGE_TERMS.some(k => t.includes(k)))   return { service: 'color', colorType: 'balayage' };
  if (FULL_COLOR_TERMS.some(k => t.includes(k))) return { service: 'color', colorType: 'full-color' };

  // Perm sub-types — curl keywords resolve directly to curl perm
  const CURL_PERM_TERMS    = ['wavy', 'waves', 'curly', 'curls', 'curl', 'beach waves'];
  const STRAIGHT_PERM_TERMS = ['straight perm', 'rebond', 'relaxer'];

  if (CURL_PERM_TERMS.some(k => t.includes(k)))    return { service: 'perm', permType: 'curl' };
  if (STRAIGHT_PERM_TERMS.some(k => t.includes(k))) return { service: 'perm', permType: 'straight' };

  // Top-level services — order matters: treatment before perm (keratin lives here)
  const TREATMENT_TERMS = ['treatment', 'keratin', 'deep condition', 'dry', 'damaged', 'frizzy', 'frizz', 'smooth', 'repair', 'shiny', 'moisture', 'bond repair', 'protein', 'kerasilk', 'tokio', 'purifica', 'milbon'];
  const PERM_TERMS      = ['perm', 'volume', 'texture'];
  const CUT_TERMS       = ['cut', 'trim', 'shorter', 'haircut', 'layers', 'bangs', 'fringe', 'bob', 'length'];
  const COLOR_TERMS     = ['color', 'colour', 'blonde', 'brunette', 'dye', 'toner', 'toning', 'gloss'];
  const BLEACH_TERMS    = ['bleach', 'lighten', 'lift', 'platinum'];

  if (TREATMENT_TERMS.some(k => t.includes(k))) return { service: 'treatment' };
  if (PERM_TERMS.some(k => t.includes(k)))      return { service: 'perm' };
  if (CUT_TERMS.some(k => t.includes(k)))       return { service: 'cut' };
  if (BLEACH_TERMS.some(k => t.includes(k)))    return { service: 'bleach' };
  if (COLOR_TERMS.some(k => t.includes(k)))     return { service: 'color' };

  return null;
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const thread    = document.getElementById('chat-thread');
const tray      = document.getElementById('chat-tray');
const widget    = document.getElementById('chat-widget');
const launcher  = document.getElementById('chat-launcher');

// ─── Tray collapse ────────────────────────────────────────────────────────────
const collapseBar = document.createElement('div');
collapseBar.className = 'chat-tray__collapse-bar';
collapseBar.innerHTML = `<img src="images/icons/ArrowUp.svg" width="14" height="14" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span class="meta-text meta-text--body">Tap to Expand</span>`;
tray.appendChild(collapseBar);

function clearTray() {
  while (tray.firstChild) tray.removeChild(tray.firstChild);
  tray.appendChild(collapseBar);
}

thread.addEventListener('click', () => {
  // Only collapse if tray has actual content (more than just the collapse bar)
  if (!tray.classList.contains('chat-tray--collapsed') && tray.children.length > 1) {
    tray.classList.add('chat-tray--collapsed');
  }
});

tray.addEventListener('click', () => {
  if (tray.classList.contains('chat-tray--collapsed')) {
    tray.classList.remove('chat-tray--collapsed');
  }
});
const subtitle    = document.getElementById('chat-subtitle');
const headerTitle = document.getElementById('chat-title');
const stepCounter = document.getElementById('chat-step-counter');
const headerBack  = document.getElementById('header-back');
const chatHeader  = document.getElementById('chat-header');

// ─── Step subtitles ───────────────────────────────────────────────────────────
const STEP_SUBTITLES = {
  greeting:             '',
  main_menu:            'Main Menu',
  service_list:         'Service Menu',
  quote_service_select: 'Get a Quote',
  color_type:           'Color Quote',
  hair_length:          'Color Quote',
  natural_color:        'Color Quote',
  permed:               'Color Quote',
  bleached_history:     'Color Quote',
  box_dye:              'Color Quote',
  about:                'About Salon',
  booking_start:        '',
  booking_service:      'Book with Us',
  match_service:        'Book with Us',
  match_confirm:        'Book with Us',
  match_stylist:        'Book with Us',
  call_us:              '',
  re_engagement:          'Resume Chat',
  existing_appt:          'Your Appointment',
  appt_reschedule:        'Appointment Reschedule',
  appt_cancel_confirm:    'Cancel Appointment',
  appt_change_details:    'Change Details',
  sdq_length:             'Style Quiz',
  sdq_maintenance:        'Style Quiz',
  sdq_commitment:         'Style Quiz',
  sdq_style:            'Style Quiz',
  sdq_result:           'Style Quiz',
};

const TOP_LEVEL_STEPS = ['greeting', 'main_menu', 'booking_start', 'call_us'];

// Quiz step counter — shown during quote quiz flow
const QUIZ_STEP_COUNTER = {
  color_type:        '1/6',
  hair_length:       '2/6',
  natural_color:     '3/6',
  permed:            '4/6',
  bleached_history:  '5/6',
  box_dye:           '6/6',
  quote_result:      'Result',
  sdq_length:        '1/4',
  sdq_maintenance:   '2/4',
  sdq_commitment:    '3/4',
  sdq_style:         '4/4',
  sdq_result:        'Results',
};

// Only quiz/questionnaire flows get the WithProgress (sage) header variant
const PROGRESS_STEPS = ['quote_service_select', 'color_type', 'hair_length', 'natural_color', 'permed', 'bleached_history', 'box_dye', 'quote_result', 'sdq_length', 'sdq_maintenance', 'sdq_commitment', 'sdq_style', 'sdq_result'];

// Booking stages after stylist selection — show "< Menu" in standard (white) header
const BOOKING_MENU_STEPS = ['booking_service', 'booking_confirm', 'booking_details', 'match_service', 'match_confirm', 'match_stylist'];

// Standard screens that show a "Menu" back button (returns to main_menu) — kept for routing logic
const MENU_BACK_STEPS = ['about', 'service_list', 'stylists', 'products', 'style_quiz', 'special_occasion', 'perm_stub', 'treatment_stub', 'cut_stub'];

// Screens whose trays have no back link — header back button is shown instead
const HEADER_BACK_STEPS = ['re_engagement', 'existing_appt', 'appt_reschedule', 'appt_cancel_confirm', 'appt_change_details'];

function updateSubtitle(stepId) {
  if (!subtitle) return;
  const label = STEP_SUBTITLES[stepId] || '';
  subtitle.textContent = label;

  const backLabel = headerBack && headerBack.querySelector('.app-header-bar__back-label');
  const isProgress = PROGRESS_STEPS.includes(stepId);
  const isQuiz = stepId in QUIZ_STEP_COUNTER;

  // Title: "Quote Quiz" during color quiz, always "Chat with Rosan Hair" for SDQ
  if (headerTitle) {
    const isSDQ = stepId.startsWith('sdq_');
    headerTitle.textContent = (isQuiz && !isSDQ) ? 'Quote Quiz' : 'Chat with Rosan Hair';
  }

  // Step counter: visible only during quiz steps, hidden otherwise
  if (stepCounter) {
    if (isQuiz) {
      stepCounter.textContent = QUIZ_STEP_COUNTER[stepId];
      stepCounter.style.visibility = 'visible';
    } else {
      stepCounter.style.visibility = 'hidden';
    }
  }

  const isBookingMenu = BOOKING_MENU_STEPS.includes(stepId);

  if (headerBack) {
    if (isProgress) {
      // WithProgress state: "< Back", hidden only on result screens
      const hideBack = stepId === 'quote_result' || stepId === 'sdq_length' || stepId === 'sdq_result';
      headerBack.style.visibility = hideBack ? 'hidden' : 'visible';
      if (backLabel) backLabel.textContent = 'Back';
    } else if (isBookingMenu) {
      // Booking state: "< Menu" shown so user can pivot back to main menu
      headerBack.style.visibility = 'visible';
      if (backLabel) backLabel.textContent = 'Menu';
    } else {
      // Normal state: no left button
      headerBack.style.visibility = 'hidden';
    }
  }

  // WithProgress variant — sage bg only during quiz flows
  if (chatHeader) {
    if (isProgress) {
      chatHeader.classList.add('app-header-bar--progress');
    } else {
      chatHeader.classList.remove('app-header-bar--progress');
    }
  }
}

function updateHeaderBackAfterTray(stepId, step) {
  // Header state is fully determined by updateSubtitle — nothing to do here
}

// Quiz back-navigation map — each step knows where Back goes
const QUIZ_PREV_STEP = {
  quote_service_select: 'service_list',
  color_type:       'quote_service_select',
  hair_length:      'color_type',
  natural_color:    'hair_length',
  permed:           'natural_color',
  bleached_history: 'permed',
  box_dye:          'bleached_history',
  sdq_maintenance:  'sdq_length',
  sdq_commitment:   'sdq_maintenance',
  sdq_style:        'sdq_commitment',
};

// Thread child-count recorded just before each step renders — used to trim on Back
const quizCheckpoints = {};

if (headerBack) {
  headerBack.addEventListener('click', () => {
    const prevStep = QUIZ_PREV_STEP[currentStepId];

    if (prevStep) {
      // Remove current step's messages + the user's answer bubble, keeping prev bot question
      const base = quizCheckpoints[currentStepId] ?? quizCheckpoints[prevStep] ?? 0;
      const checkpoint = Math.max(0, base - 1); // -1 removes the user bubble too
      while (thread.children.length > checkpoint) {
        thread.removeChild(thread.lastElementChild);
      }
      clearTray();
      currentStepId = prevStep;
      updateSubtitle(prevStep);
      const prevStepData = STEPS[prevStep];
      if (prevStepData) setTimeout(() => renderTray(prevStepData), 150);
    } else if (BOOKING_MENU_STEPS.includes(currentStepId)) {
      // Booking stage "< Menu" — pivot back to main menu
      appendUserBubble('Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    }
  });
}

// ─── Open / close ─────────────────────────────────────────────────────────────
document.querySelectorAll('.js-open-chat').forEach(el =>
  el.addEventListener('click', openChat)
);
document.querySelectorAll('.js-close-chat').forEach(el =>
  el.addEventListener('click', closeChat)
);

function openChat() {
  widget.classList.add('is-open');
  widget.setAttribute('aria-hidden', 'false');
  if (launcher) launcher.classList.add('is-hidden');
  if (currentStepId === null) {
    // Spacer pushes messages to bottom on first load
    const spacer = document.createElement('div');
    spacer.className = 'chat-thread__spacer';
    thread.appendChild(spacer);
    currentStepId = 'greeting';
    renderStep('greeting');
  }
}

function closeChat() {
  widget.classList.remove('is-open');
  widget.setAttribute('aria-hidden', 'true');
  launcher.classList.remove('is-hidden');
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderServiceDetail(step, stepId) {
  let firstEl = null;

  const chain = step.sequence.reduce((p, item) => {
    return p.then(() => {
      if (item.type === 'message') {
        return showTyping(600).then(() => {
          const bubble = appendBotBubble(item.text);
          if (!firstEl) firstEl = bubble;
          scrollThread(bubble);
          return bubble;
        });
      } else if (item.type === 'cards') {
        appendServiceCardGroup(item.cards);
        if (!firstEl) firstEl = thread.lastElementChild;
        return Promise.resolve();
      } else if (item.type === 'metatext') {
        const el = document.createElement('div');
        el.className = 'service-detail-meta';
        el.innerHTML = `<span class="service-detail-meta__link">${item.label}</span>`;
        el.querySelector('.service-detail-meta__link').addEventListener('click', () => {
          if (!document.querySelector('.hair-length-card')) {
            appendHairLengthCard();
          }
        });
        thread.appendChild(el);
        return Promise.resolve();
      }
      return Promise.resolve();
    });
  }, Promise.resolve());

  chain.then(() => {
    renderTray(step);
    updateHeaderBackAfterTray(stepId, step);
    smartScrollAfterStep(firstEl, thread.lastElementChild);
  });
}

function appendServiceCardGroup(cards) {
  const group = document.createElement('div');
  group.className = 'service-card-group';
  for (const card of cards) {
    const el = document.createElement('div');
    el.className = 'service-card-component';
    if (card.sections) {
      for (const section of card.sections) {
        const cat = document.createElement('div');
        cat.className = 'service-card-component__category';
        cat.textContent = section.category;
        el.appendChild(cat);
        for (const row of section.rows) {
          const rowEl = document.createElement('div');
          rowEl.className = 'service-card-component__row';
          rowEl.innerHTML = `<div class="service-card-component__size">${row.size}</div><div class="service-card-component__price">${row.price}</div>`;
          el.appendChild(rowEl);
        }
      }
    } else {
      if (card.category) {
        const cat = document.createElement('div');
        cat.className = 'service-card-component__category';
        cat.textContent = card.category;
        el.appendChild(cat);
      }
      for (const row of card.rows) {
        const rowEl = document.createElement('div');
        rowEl.className = 'service-card-component__row';
        rowEl.innerHTML = `<div class="service-card-component__size">${row.size}</div><div class="service-card-component__price">${row.price}</div>`;
        el.appendChild(rowEl);
      }
    }
    group.appendChild(el);
  }
  thread.appendChild(group);
}

function renderStep(stepId) {
  tray.classList.remove('chat-tray--collapsed');
  currentStepId = stepId;
  updateSubtitle(stepId);
  if (stepId in QUIZ_PREV_STEP) {
    quizCheckpoints[stepId] = thread.children.length;
  }
  const step = STEPS[stepId];
  if (!step) { console.warn('[chatbot] unknown step:', stepId); return; }

  if (step.layout === 're-engagement') {
    while (thread.firstChild) thread.removeChild(thread.firstChild);
    const spacer = document.createElement('div');
    spacer.className = 'chat-thread__spacer';
    thread.appendChild(spacer);
  }

  if (step.layout === 'service-detail' && step.sequence) {
    renderServiceDetail(step, stepId);
    return;
  }

  if (step.layout === 'appt-cancelled') {
    while (thread.firstChild) thread.removeChild(thread.firstChild);

    const { lookupName, lookupPhone, selectedStylist, bookingDate, bookingTime, colorType } = session;
    const stylistNames = { michelle: 'Michelle', jenny: 'Jenny', carol: 'Carol', ruth: 'Ruth', sarah: 'Sarah', diana: 'Diana', sophie: 'Sophie', nana: 'Nana' };
    const serviceLabel = colorType === 'full-color' ? 'Full Color' : colorType === 'balayage' ? 'Balayage' : colorType === 'haircut' ? 'Haircut & Style' : 'Color';
    const dateStr = bookingDate ? bookingDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    const hero = document.createElement('div');
    hero.className = 'booking-confirmed-hero';
    hero.innerHTML = `
      <div class="booking-confirmed-hero__header">
        <div class="booking-confirmed-hero__check">
          <span class="booking-confirmed-hero__check-mark">✓</span>
        </div>
        <div class="booking-confirmed-hero__title">Successfully Cancelled</div>
      </div>
      <div class="booking-confirmed-hero__subtitle">Confirmation sent to your phone</div>
    `;
    thread.appendChild(hero);

    thread.appendChild(buildSummaryCard('Your Details', [
      { label: 'Name',  value: lookupName  || session.contactName  || '—' },
      { label: 'Phone', value: lookupPhone || session.contactPhone || '—' },
    ]));

    thread.appendChild(buildSummaryCard('Cancelled Appointment', [
      { label: 'Service', value: serviceLabel },
      { label: 'Stylist', value: stylistNames[selectedStylist] || '—' },
      { label: 'Date',    value: dateStr },
      { label: 'Time',    value: bookingTime || '—' },
    ]));

    renderTray(step);
    updateHeaderBackAfterTray(stepId, step);
    return;
  }

  if (step.layout === 'booking-success') {
    session.bookingEditMode = false;
    session.matchFlow = false;
    // Clear entire thread for end-of-journey screen
    while (thread.firstChild) thread.removeChild(thread.firstChild);

    const { contactName, contactPhone, selectedStylist, bookingDate, bookingTime, colorType } = session;
    const stylistNames = { michelle: 'Michelle', jenny: 'Jenny', carol: 'Carol', ruth: 'Ruth', sarah: 'Sarah', diana: 'Diana', sophie: 'Sophie', nana: 'Nana' };
    const serviceLabel = colorType === 'full-color' ? 'Full Color' : colorType === 'balayage' ? 'Balayage' : 'Color';
    const dateStr = bookingDate ? bookingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }) : '—';

    // Spacer (pushes content down)
    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1 1 0;min-height:1px';
    thread.appendChild(spacer);

    // Booking confirmed hero
    const hero = document.createElement('div');
    hero.className = 'booking-confirmed-hero';
    hero.innerHTML = `
      <div class="booking-confirmed-hero__header">
        <div class="booking-confirmed-hero__check">
          <span class="booking-confirmed-hero__check-mark">✓</span>
        </div>
        <div class="booking-confirmed-hero__title">You're booked!</div>
      </div>
      <div class="booking-confirmed-hero__subtitle">Confirmation sent to your phone</div>
    `;
    thread.appendChild(hero);

    // Your Details card
    thread.appendChild(buildSummaryCard('Your Details', [
      { label: 'Name',  value: contactName  || '—' },
      { label: 'Phone', value: contactPhone || '—' },
    ]));

    // Your Appointment card
    const apptCard = buildSummaryCard('Your Appointment', [
      { label: 'Service', value: serviceLabel },
      { label: 'Stylist', value: stylistNames[selectedStylist] || '—' },
      { label: 'Date',    value: dateStr },
      { label: 'Time',    value: bookingTime || '—' },
    ]);
    thread.appendChild(apptCard);

    // Salon location card
    const locCard = document.createElement('div');
    locCard.className = 'salon-location-card';
    locCard.innerHTML = `
      <div class="salon-location-card__icon">
        <img src="images/icons/MapPin.svg" width="24" height="24" alt="">
      </div>
      <div class="salon-location-card__body">
        <span class="salon-location-card__label">Rosan Hair Address</span>
        <div class="salon-location-card__row" style="cursor:pointer" onclick="navigator.clipboard.writeText('3090 Patterson Road, NY 10001')">
          <span class="salon-location-card__address">3090 Patterson Road, NY 10001</span>
          <img src="images/icons/Copy.svg" width="14" height="14" alt="Copy" style="flex-shrink:0;margin-left:4px">
        </div>
        <div class="salon-location-card__row" style="cursor:pointer" onclick="window.open('https://maps.google.com/?q=3090+Patterson+Road+NY+10001')">
          <span class="salon-location-card__maps-link">Open in Maps</span>
          <img src="images/icons/MapTrifold.svg" width="14" height="14" alt="" style="flex-shrink:0;margin-left:4px">
        </div>
      </div>
    `;
    thread.appendChild(locCard);

    renderTray(step);
    updateHeaderBackAfterTray(stepId, step);
    return;
  }

  // ── appt_cancel_confirm: dynamic bot msg with appt details ──────────────────
  if (stepId === 'appt_cancel_confirm') {
    const stylistNames = { michelle: 'Michelle', jenny: 'Jenny', carol: 'Carol', ruth: 'Ruth', sarah: 'Sarah', diana: 'Diana', sophie: 'Sophie', nana: 'Nana' };
    const timeStr = session.bookingTime || '2:00 PM';
    const dateStr = session.bookingDate
      ? session.bookingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      : 'your appointment date';
    const stylistName = stylistNames[session.selectedStylist] || 'your stylist';
    const msg = `Just to confirm, you'd like to cancel your ${timeStr} appointment on ${dateStr} with ${stylistName}?`;

    showTyping(600).then(() => {
      const b = appendBotBubble(msg);
      scrollThread(b);
      renderTray(step);
      updateHeaderBackAfterTray(stepId, step);
    });
    return;
  }

  // ── existing_appt: bot msg → booking card → second bot msg → tray ──────────
  if (stepId === 'existing_appt') {
    showTyping(600).then(() => {
      appendBotBubble(step.botMessages[0]);
      return showTyping(400);
    }).then(() => {
      appendBookingSummaryCard();
      return showTyping(500);
    }).then(() => {
      const b = appendBotBubble(step.botMessages[1]);
      scrollThread(b);
      renderTray(step);
      updateHeaderBackAfterTray(stepId, step);
    });
    return;
  }

  const raw = typeof step.botMessage === 'function'
    ? step.botMessage(session)
    : step.botMessage;

  // Mark after message is resolved so first visit still shows full intro
  if (stepId === 'main_menu') {
    session.hasVisitedMainMenu = true;
  }

  // Support single string or array of sequential bubbles
  const msgs = Array.isArray(raw) ? raw : [raw];

  // preCards: card strip shown before messages (e.g. products screen)
  let firstEl = null;
  if (step.preCards) {
    appendCardStrip(step.preCards);
    firstEl = thread.lastElementChild;
    scrollThread(firstEl);
  }

  let firstBubble = null;
  let lastBubble  = null;

  // Chain: show typing → bubble for each message, then render tray after all
  const chain = msgs.reduce((p, msg, i) => {
    return p.then(() => {
      return showTyping(600).then(() => {
        const bubble = appendBotBubble(msg);
        if (!firstBubble) firstBubble = bubble;
        lastBubble = bubble;
        scrollThread(bubble);
        return bubble;
      });
    });
  }, Promise.resolve(null));

  chain.then(() => {
    if (step.layout === 'stylists-grid') {
      const stylists = STEPS.booking_start.stylists;
      const premier = stylists.filter(s => s.tier === 'Premier');
      const refined  = stylists.filter(s => s.tier === 'Refined');

      function buildStylistGrid(list) {
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;align-self:stretch;';
        for (const s of list) {
          const card = document.createElement('div');
          card.className = 'stylist-tray-card';
          card.innerHTML = `
            <div class="stylist-tray-card__img" style="background-image:url('images/${s.image}')"></div>
            <div class="stylist-tray-card__body">
              <span class="stylist-tray-card__name">${s.name}</span>
              <span class="stylist-tray-card__spec">${s.specialties}</span>
            </div>
            <span class="stylist-tray-card__tier">${s.tier}</span>
          `;
          card.addEventListener('click', () => showStylistSheet(s, null, { hidePickAnother: true }));
          grid.appendChild(card);
        }
        return grid;
      }

      thread.appendChild(buildStylistGrid(premier));

      showTyping(500).then(() => {
        appendBotBubble('Mid-level stylists');
        thread.appendChild(buildStylistGrid(refined));
        renderTray(step);
        updateHeaderBackAfterTray(stepId, step);
        smartScrollAfterStep(null, thread.lastElementChild);
      });
      return;
    }

    if (step.layout === 'about-cards' && step.cards) {
      appendCardStrip(step.cards);
    }
    if (step.layout === 'service-list' && step.services) {
      const tierHint = document.createElement('p');
      tierHint.className = 'meta-text meta-text--caption';
      tierHint.textContent = 'Stylists levels are based in two tiers, Refined/Premier, with different pricing.';
      thread.appendChild(tierHint);
      appendServiceList(step.services);
    }
    if (stepId === 'hair_length' || stepId === 'sdq_length') {
      appendHairLengthCard();
    }
    if (step.layout === 'contact-us') {
      appendContactCard();
    }
    if (step.layout === 'booking-details') {
      appendBookingSummaryCard();
    }
    if (step.layout === 'sdq-result') {
      const matched = computeSDQResult();

      // Filter cut for short hair lengths
      const filtered = ['XS', 'S'].includes(session.sdqLength)
        ? matched.filter(r => r.svc !== 'cut')
        : matched;

      // Priority order: perm > color > cut > treatment
      const PRIORITY = { curl_perm: 0, straight_perm: 0, full_color: 1, partial_color: 1, cut: 2, treatment: 3 };

      // Fallback if nothing matched
      let displayResults = filtered.length
        ? filtered
            .slice(0, 3)
            .sort((a, b) => (PRIORITY[a.svc] ?? 2) - (PRIORITY[b.svc] ?? 2))
        : [{ label: 'Treatment', isMaybe: true }];

      const group = document.createElement('div');
      group.className = 'match-style-card-group';

      displayResults.forEach((r, i) => {
        // No badge if treatment is top result (or top after reorder) or result is a maybe
        const isBest = i === 0 && !r.isMaybe && r.svc !== 'treatment';
        const card = document.createElement('div');
        card.className = 'match-style-card' + (i > 0 ? ' match-style-card--no-title' : '') + (!isBest ? ' match-style-card--no-badge' : '');

        const content = document.createElement('div');
        content.className = 'match-style-card__content';
        if (i === 0) {
          const heading = document.createElement('div');
          heading.className = 'match-style-card__heading';
          heading.textContent = 'WORTH DISCOVERING';
          content.appendChild(heading);
        }
        const row = document.createElement('div');
        row.className = 'match-style-card__row';

        const left = document.createElement('div');
        left.className = 'match-style-card__left';
        const thumb = document.createElement('div');
        thumb.className = 'match-style-card__thumb';
        thumb.style.cssText = 'background:var(--bg-canvas);border-radius:6px;';
        left.appendChild(thumb);
        const svcName = document.createElement('span');
        svcName.className = 'match-style-card__service';
        svcName.textContent = r.label;
        left.appendChild(svcName);
        if (isBest) {
          const badge = document.createElement('div');
          badge.className = 'match-style-card__badge';
          badge.innerHTML = `<span class="match-style-card__badge-text">Best match</span><span class="match-style-card__badge-icon"><img src="images/icons/ThumbsUp.svg" width="10" height="10" alt="" style="display:block;"></span>`;
          left.appendChild(badge);
        }
        row.appendChild(left);
        content.appendChild(row);
        card.appendChild(content);

        const divider = document.createElement('div');
        divider.className = 'match-style-card__divider';
        card.appendChild(divider);
        group.appendChild(card);
      });

      thread.appendChild(group);
      scrollThread(group);

      // Photo Help Card
      const photoCard = document.createElement('div');
      photoCard.className = 'photo-help-card';
      photoCard.innerHTML = `
        <div class="photo-help-card__top">
          <div class="photo-help-card__icon">
            <img src="images/icons/Question.svg" alt="" onerror="this.parentElement.textContent='?'">
          </div>
          <div class="photo-help-card__text">
            <div class="photo-help-card__title">Not sure how to describe it?</div>
            <div class="photo-help-card__subtitle">Send us a photo and we'll help</div>
          </div>
        </div>
        <div class="photo-help-card__cta">
          <span class="photo-help-card__cta-text">Text us a photo</span>
          <span class="photo-help-card__arrow"><img src="images/icons/ArrowUpRight.svg" width="12" height="12" alt="" style="display:block;"></span>
        </div>
      `;
      photoCard.addEventListener('click', () => renderStep('call_us'));
      thread.appendChild(photoCard);
      scrollThread(photoCard);

      // "Retake Quiz" meta text in thread
      const retake = document.createElement('button');
      retake.className = 'meta-text meta-text--caption';
      retake.textContent = 'Retake Quiz';
      retake.addEventListener('click', () => {
        session.sdqLength = session.sdqColorOpen = session.sdqChemicalOpen = session.sdqStyles = null;
        session.sdqCurlOpen = session.sdqStraightOpen = session.sdqMaintenance = session.sdqSituation = null;
        renderStep('sdq_length');
      });
      thread.appendChild(retake);
      scrollThread(retake);
    }

    if (step.layout === 're-engagement') {
      const service  = session.resumeService  || 'Balayage Quote';
      const lastStep = session.resumeLastStep || 'Hair Length';
      const card = buildSummaryCard('Where You Left Off', [
        { label: 'Service',   value: service  },
        { label: 'Last Step', value: lastStep },
      ]);
      thread.appendChild(card);
      scrollThread(card);
    }
    if (step.threadNote) {
      const note = document.createElement('div');
      note.className = 'meta-text meta-text--caption';
      note.textContent = step.threadNote;
      thread.appendChild(note);
    }
    renderTray(step);
    updateHeaderBackAfterTray(stepId, step);
    smartScrollAfterStep(firstEl || firstBubble, lastBubble);
  });
}

function showTyping(ms = 700) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    thread.appendChild(el);
    scrollThread();
    setTimeout(() => { el.remove(); resolve(); }, ms);
  });
}

function appendBotBubble(text) {
  const el = document.createElement('div');
  el.className = 'bubble bubble--bot';
  el.textContent = text;
  thread.appendChild(el);
  return el;
}

function appendUserBubble(text) {
  const el = document.createElement('div');
  el.className = 'bubble bubble--user';
  el.textContent = text;
  thread.appendChild(el);
}

function appendCardStrip(cards) {
  const scroller = document.createElement('div');
  scroller.className = 'card-strip-scroller';
  const strip = document.createElement('div');
  strip.className = 'card-strip';
  for (const c of cards) {
    const card = document.createElement('div');
    card.className = 'description-card';
    card.innerHTML = `
      <div class="description-card__body">
        <div class="description-card__text">
          <div class="description-card__title-wrap">
            <div class="description-card__title">${c.title}</div>
          </div>
          <div class="description-card__desc">${c.desc}</div>
        </div>
        ${c.image ? `<img class="description-card__image" src="images/${c.image}" alt="${c.title}" />` : ''}
      </div>
    `;
    strip.appendChild(card);
  }
  scroller.appendChild(strip);
  thread.appendChild(scroller);
  // CSS can't combine overflow-x:auto + overflow-y:visible — sync height after layout
  requestAnimationFrame(() => {
    scroller.style.minHeight = strip.scrollHeight + 'px';
    scrollThread(scroller);
  });
}

function appendServiceList(services) {
  const container = document.createElement('div');
  container.className = 'service-list-container';

  for (const svc of services) {
    const row = document.createElement('button');
    row.className = 'service-list-row';
    row.innerHTML = `<span class="service-list-row__name">${svc.label}</span><span class="service-list-row__price">${svc.price}</span>`;
    row.addEventListener('click', () => {
      appendUserBubble(svc.label);
      clearTray();
      setTimeout(() => renderStep(svc.value), 350);
    });
    container.appendChild(row);
  }

  // Label button CTA
  const labelBtn = document.createElement('button');
  labelBtn.className = 'label-btn label-btn--default service-list-cta';
  labelBtn.textContent = "Not sure what you'd pay? Get a personalized price";
  labelBtn.addEventListener('click', () => {
    appendUserBubble("Get a personalized quote");
    clearTray();
    setTimeout(() => renderStep('quote_service_select'), 350);
  });
  container.appendChild(labelBtn);

  // Meta-text with underlined "View Image"
  const meta = document.createElement('div');
  meta.className = 'service-list-meta';
  meta.innerHTML = `<span>Prefer our full printed menu? </span><span class="service-list-meta__link">View Image</span>`;
  meta.querySelector('.service-list-meta__link').addEventListener('click', () => {
    window.open('images/service-menu.jpg', '_blank');
  });
  container.appendChild(meta);

  thread.appendChild(container);
}

function appendHairLengthCard() {
  const card = document.createElement('div');
  card.className = 'hair-length-card';
  const rows = [
    { size: 'XS', desc: 'above ear' },
    { size: 'S',  desc: 'above shoulder' },
    { size: 'M',  desc: 'below shoulder' },
    { size: 'L',  desc: 'above chest' },
    { size: 'XL', desc: 'below chest' }
  ];
  card.innerHTML = `
    <img class="hair-length-card__image" src="images/img - Hairlength.png" alt="Hair length guide" />
    <div class="hair-length-card__labels">
      ${rows.map(r => `
        <div class="hair-length-card__row">
          <div class="hair-length-card__tick"></div>
          <div class="hair-length-card__label">${r.size} · ${r.desc}</div>
        </div>`).join('')}
    </div>
  `;
  thread.appendChild(card);
  scrollThread(card);
}

function buildSummaryCard(title, rows) {
  const card = document.createElement('div');
  card.className = 'booking-summary-card';
  card.innerHTML = `
    <div class="booking-summary-card__title">${title}</div>
    <div class="booking-summary-card__divider"></div>
    <div class="booking-summary-card__rows">
      ${rows.map(r => `
        <div class="booking-summary-card__row">
          <span class="booking-summary-card__label">${r.label}</span>
          <span class="booking-summary-card__value">${r.value}</span>
        </div>`).join('')}
    </div>
  `;
  return card;
}

function appendBookingSummaryCard() {
  const { selectedStylist, bookingDate, bookingTime, colorType, contactName, contactPhone, isReturning } = session;
  const stylistNames = { michelle: 'Michelle', jenny: 'Jenny', carol: 'Carol', ruth: 'Ruth', sarah: 'Sarah', diana: 'Diana', sophie: 'Sophie', nana: 'Nana' };
  const serviceLabel = colorType === 'full-color' ? 'Full Color' : colorType === 'balayage' ? 'Balayage' : 'Color';
  const dateStr = bookingDate ? bookingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }) : '—';

  // For returning clients, show their details card first
  if (isReturning && (contactName || contactPhone)) {
    const detailsCard = buildSummaryCard('Your Details', [
      { label: 'Name',  value: contactName  || '—' },
      { label: 'Phone', value: contactPhone || '—' },
    ]);
    thread.appendChild(detailsCard);
  }

  const apptCardTitle = (currentStepId === 'existing_appt' || currentStepId === 'appt_cancel_confirm' || currentStepId === 'appt_change_details') ? 'Your Appointment' : 'Booking Summary';
  const apptCard = buildSummaryCard(apptCardTitle, [
    { label: 'Service', value: serviceLabel },
    { label: 'Stylist', value: stylistNames[selectedStylist] || '—' },
    { label: 'Date',    value: dateStr },
    { label: 'Time',    value: bookingTime || '—' },
  ]);
  thread.appendChild(apptCard);
  scrollThread(apptCard);
}

function appendContactCard() {
  const card = document.createElement('div');
  card.className = 'contact-card';
  card.innerHTML = `
    <div class="contact-card__row">
      <div class="contact-card__icon">
        <img src="images/icons/Phone.svg" width="24" height="24" alt="">
      </div>
      <div class="contact-card__text">
        <span class="contact-card__label">(212) 658-3916</span>
        <span class="contact-card__sublabel">Mon-Sat · 11am-9pm</span>
      </div>
    </div>
    <div class="contact-card__divider"></div>
    <div class="contact-card__row">
      <div class="contact-card__icon">
        <img src="images/icons/ChatsCircle.svg" width="24" height="24" alt="">
      </div>
      <div class="contact-card__text">
        <span class="contact-card__label">Text</span>
        <span class="contact-card__sublabel">We usually reply within an hour</span>
      </div>
    </div>
    <div class="contact-card__divider"></div>
    <div class="contact-card__row">
      <div class="contact-card__icon">
        <img src="images/icons/MapPin.svg" width="24" height="24" alt="">
      </div>
      <div class="contact-card__text">
        <span class="contact-card__label">Salon Address</span>
        <span class="contact-card__sublabel" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px" onclick="navigator.clipboard.writeText('3090 Patterson Road, NY 10001')">3090 Patterson Road, NY 10001<img src="images/icons/Copy.svg" width="14" height="14" alt="Copy" style="flex-shrink:0"></span>
      </div>
    </div>
  `;
  thread.appendChild(card);
  scrollThread(card);
}

function appendEstimateCard(tags, rows, note) {
  const card = document.createElement('div');
  card.className = 'estimate-pricing-card';

  let html = '';
  if (tags && tags.length) {
    html += `<div class="estimate-pricing-card__tags">${tags.map(t => `<span class="estimate-pricing-card__tag">${t}</span>`).join('')}</div>`;
    html += `<div class="estimate-pricing-card__spacer-sm"></div>`;
  }
  html += `<div class="estimate-pricing-card__rows">`;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) html += `<div class="estimate-pricing-card__divider"></div>`;
    const row = rows[i];
    const labelClass = row.note ? 'estimate-pricing-card__note' : 'estimate-pricing-card__tier';
    html += `<div class="estimate-pricing-card__row">
      <span class="${labelClass}">${row.label}</span>
      <span class="estimate-pricing-card__price">${row.price}</span>
    </div>`;
  }
  html += `</div>`;
  if (note) {
    html += `<div style="height:6px;width:100%"></div><div class="estimate-pricing-card__note" style="color:var(--text-secondary)">${note}</div>`;
  }

  card.innerHTML = html;
  thread.appendChild(card);
  scrollThread(card);
}

function showStylistSheet(s, onBook, opts = {}) {
  const widget = document.querySelector('.chat-widget');

  const dismissImmediate = () => { dim.remove(); wrapper.remove(); };
  const dismiss = (animate = false) => {
    if (animate) {
      dim.style.transition = 'opacity 0.28s ease';
      dim.style.opacity = '0';
      wrapper.classList.add('stylist-sheet-wrapper--exit');
      wrapper.addEventListener('animationend', dismissImmediate, { once: true });
    } else {
      dismissImmediate();
    }
  };

  // dim — covers everything below the sheet
  const dim = document.createElement('div');
  dim.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.4);z-index:100;border-radius:inherit;';
  dim.addEventListener('click', () => dismiss(false));
  widget.appendChild(dim);

  // outer wrapper — animates in from top
  const wrapper = document.createElement('div');
  wrapper.className = 'stylist-sheet-wrapper';
  wrapper.style.cssText = [
    'position:absolute;top:0;left:0;right:0;z-index:101',
    'padding:42px 4px 0',
    'background:var(--fill-primary)',
    'border-bottom-left-radius:16px;border-bottom-right-radius:16px',
    'display:flex;flex-direction:column;gap:12px',
    'overflow:hidden',
  ].join(';');
  widget.appendChild(wrapper);

  // inner card
  const card = document.createElement('div');
  card.style.cssText = [
    'padding:16px',
    'background:var(--fill-primary)',
    'border-radius:10px',
    'display:flex;flex-direction:column;gap:16px',
  ].join(';');
  wrapper.appendChild(card);

  // info section — header + bio + photos
  const info = document.createElement('div');
  info.style.cssText = 'display:flex;flex-direction:column;gap:16px;align-self:stretch;';
  card.appendChild(info);

  // header row — avatar + identity
  info.innerHTML += `
    <div style="display:flex;align-items:center;gap:12px;overflow:hidden;align-self:stretch;">
      <img style="width:96px;height:96px;opacity:0.96;border-radius:9999px;object-fit:cover;flex-shrink:0;background:var(--bg-canvas);"
           src="images/${s.image}" alt="${s.name}"
           onerror="this.removeAttribute('src')">
      <div style="flex:1 1 0;overflow:hidden;display:flex;flex-direction:column;gap:4px;">
        <span style="align-self:stretch;font-family:var(--font);font-size:var(--fs-heading);font-weight:600;line-height:var(--lh-heading);color:var(--text-primary);">${s.name}</span>
        <span style="display:inline-flex;align-items:center;padding:3px 8px;background:var(--bg-canvas);border-radius:200px;font-family:var(--font);font-size:var(--fs-label);font-weight:500;line-height:var(--lh-label);color:var(--text-secondary);white-space:nowrap;">${s.badge}</span>
      </div>
    </div>
    <p style="align-self:stretch;font-family:var(--font);font-size:var(--fs-body);font-weight:var(--fw-body);line-height:var(--lh-body);color:var(--text-secondary);margin:0;">${s.bio}</p>
    <div style="align-self:stretch;display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;">
      ${(s.workImages || [s.image, s.image, s.image]).map(img => `<img style="width:140px;height:140px;border-radius:10px;object-fit:cover;flex-shrink:0;background:var(--bg-canvas);" src="images/${img}" alt="" onerror="this.removeAttribute('src')">`).join('')}
    </div>
  `;

  // actions — stacked full-width buttons
  const actions = document.createElement('div');
  actions.style.cssText = 'align-self:stretch;display:flex;flex-direction:column;gap:8px;overflow:hidden;';

  const bookBtn = document.createElement('button');
  bookBtn.className = 'stylist-dropdown-card__action-primary';
  bookBtn.textContent = `Book with ${s.name}`;
  bookBtn.addEventListener('click', () => {
    dismiss(false);
    if (onBook) {
      onBook(s);
    } else {
      session.selectedStylist = s.id;
      appendUserBubble(s.name);
      clearTray();
      const next = session.bookingEditMode ? 'booking_confirm' : 'booking_service';
      setTimeout(() => renderStep(next), 350);
    }
  });

  const pickBtn = document.createElement('button');
  pickBtn.className = 'stylist-dropdown-card__action-secondary';
  pickBtn.textContent = 'Pick another';
  pickBtn.addEventListener('click', () => dismiss(true));

  actions.appendChild(bookBtn);
  if (!opts.hidePickAnother) actions.appendChild(pickBtn);
  card.appendChild(actions);

  // handle bar at bottom — click or swipe up dismisses the sheet
  const handle = document.createElement('div');
  handle.className = 'stylist-dropdown-card__handle';
  handle.style.cursor = 'pointer';
  handle.addEventListener('click', () => dismiss(true));
  let touchStartY = 0;
  handle.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  handle.addEventListener('touchend', e => {
    if (touchStartY - e.changedTouches[0].clientY > 20) dismiss(true);
  }, { passive: true });
  card.appendChild(handle);
}

function renderTray(step) {
  clearTray();

  // Divider always sits flush at top of tray
  const divider = document.createElement('div');
  divider.className = 'chat-tray__divider';
  tray.appendChild(divider);

  // ── Contact form layout — name + phone inputs, continue button, back link ──
  if (step.layout === 'contact-form') {
    const nameRow = document.createElement('div');
    nameRow.className = 'tray-input-row';
    const nameInput = document.createElement('input');
    nameInput.className = 'tray-input';
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameRow.appendChild(nameInput);
    tray.appendChild(nameRow);

    const phoneRow = document.createElement('div');
    phoneRow.className = 'tray-input-row';
    const phoneInput = document.createElement('input');
    phoneInput.className = 'tray-input';
    phoneInput.type = 'tel';
    phoneInput.placeholder = 'Phone Number';
    phoneRow.appendChild(phoneInput);
    tray.appendChild(phoneRow);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-component btn-component--primary';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => {
      const name  = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      if (!name && !phone) return;
      const display = [name, phone].filter(Boolean).join('\n');
      appendUserBubble(display);
      session.contactName  = name;
      session.contactPhone = phone;
      clearTray();
      setTimeout(() => renderStep('main_menu'), 350);
    });
    tray.appendChild(continueBtn);

    const back = document.createElement('button');
    back.className = 'meta-text meta-text--body';
    back.textContent = 'Back';
    back.addEventListener('click', () => {
      appendUserBubble('Back');
      clearTray();
      setTimeout(() => renderStep('greeting'), 300);
    });
    tray.appendChild(back);
    return;
  }

  // ── Booking-success layout — end-of-journey tray ─────────────────────────────
  if (step.layout === 'booking-success') {
    session.bookingEditMode = false;
    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn-component btn-component--primary';
    changeBtn.textContent = 'Need to change something?';
    changeBtn.addEventListener('click', () => {
      clearTray();
      renderBookingChangeTray();
    });
    tray.appendChild(changeBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-component btn-component--primary';
    closeBtn.textContent = 'Close Chat';
    closeBtn.addEventListener('click', () => closeChat());
    tray.appendChild(closeBtn);

    const back = document.createElement('button');
    back.className = 'meta-text meta-text--body';
    back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
    back.addEventListener('click', () => {
      appendUserBubble('Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(back);
    return;
  }

  // ── Booking-details layout — name/phone inputs + confirm/change/cancel ───────
  if (step.layout === 'booking-details') {
    if (!session.isReturning && !session.contactName) {
      const nameRow = document.createElement('div');
      nameRow.className = 'tray-input-row';
      const nameInput = document.createElement('input');
      nameInput.className = 'tray-input';
      nameInput.type = 'text';
      nameInput.placeholder = 'Name';
      nameRow.appendChild(nameInput);
      tray.appendChild(nameRow);

      const phoneRow = document.createElement('div');
      phoneRow.className = 'tray-input-row';
      const phoneInput = document.createElement('input');
      phoneInput.className = 'tray-input';
      phoneInput.type = 'tel';
      phoneInput.placeholder = 'Phone Number';
      phoneRow.appendChild(phoneInput);
      tray.appendChild(phoneRow);

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn-component btn-component--action';
      confirmBtn.textContent = 'Confirm Booking';
      confirmBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        if (!name || !phone) return;
        session.contactName = name;
        session.contactPhone = phone;
        clearTray();
        setTimeout(() => renderStep('booking_success'), 350);
      });
      tray.appendChild(confirmBtn);
    } else {
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn-component btn-component--action';
      confirmBtn.textContent = 'Confirm Booking';
      confirmBtn.addEventListener('click', () => {
        clearTray();
        setTimeout(() => renderStep('booking_success'), 350);
      });
      tray.appendChild(confirmBtn);
    }

    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn-component btn-component--primary';
    changeBtn.textContent = 'Change Details';
    changeBtn.addEventListener('click', () => {
      appendUserBubble('Change Details');
      clearTray();
      renderBookingChangeTray();
    });
    tray.appendChild(changeBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-component btn-component--primary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      appendUserBubble('Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(cancelBtn);

    return;
  }

  // ── SDQ Length layout — hair length chips ─────────────────────────────────────
  if (step.layout === 'sdq-length') {
    const sizes = ['XS', 'S', 'M', 'L', 'XL'];
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;';
    sizes.forEach(size => {
      const btn = document.createElement('button');
      btn.className = 'label-btn label-btn--default';
      btn.style.width = '100%';
      btn.textContent = size;
      btn.addEventListener('click', () => {
        session.sdqLength = size;
        btn.classList.add('label-btn--focused');
        appendUserBubble(size);
        clearTray();
        setTimeout(() => renderStep('sdq_maintenance'), 350);
      });
      grid.appendChild(btn);
    });
    tray.appendChild(grid);

    const hint = document.createElement('div');
    hint.className = 'meta-text meta-text--body';
    hint.style.textAlign = 'center';
    hint.textContent = 'Not sure? Pick the closest one.';
    tray.appendChild(hint);

    return;
  }

  // ── SDQ Maintenance layout — commitment level ──────────────────────────────────
  if (step.layout === 'sdq-maintenance') {
    const note = document.createElement('div');
    note.className = 'meta-text meta-text--caption';
    note.style.padding = '0 4px';
    note.textContent = 'Maintenance means day-to-day care your hair needs after you leave the salon.';
    thread.appendChild(note);

    const options = [
      { label: "High — I'm all-in & consistent",       value: 'high' },
      { label: "Mid — I have good days & bad days",     value: 'mid'  },
      { label: "Low — I keep it short & simple",        value: 'low'  },
    ];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'label-btn label-btn--default';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        session.sdqMaintenance = opt.value;
        appendUserBubble(opt.label);
        clearTray();
        setTimeout(() => renderStep('sdq_commitment'), 350);
      });
      tray.appendChild(btn);
    });
    return;
  }

  // ── SDQ Commitment layout — color + chemical openness ─────────────────────────
  if (step.layout === 'sdq-commitment') {
    function makeYMNRow(label, sessionKey) {
      const caption = document.createElement('div');
      caption.className = 'meta-text meta-text--body';
      caption.style.cssText = 'text-align:center;cursor:default;pointer-events:none;';
      caption.textContent = label;
      tray.appendChild(caption);

      const row = document.createElement('div');
      row.className = 'tray-btn-row';
      ['Yes', 'Maybe', 'No'].forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'label-btn label-btn--default';
        // Restore selected state if session already has a value (retry scenario)
        if (session[sessionKey] === val) btn.classList.add('label-btn--focused');
        btn.textContent = val;
        btn.addEventListener('click', () => {
          if (btn.classList.contains('label-btn--focused')) {
            btn.classList.remove('label-btn--focused');
            session[sessionKey] = null;
          } else {
            row.querySelectorAll('.label-btn').forEach(b => b.classList.remove('label-btn--focused'));
            btn.classList.add('label-btn--focused');
            session[sessionKey] = val;
          }
        });
        row.appendChild(btn);
      });
      tray.appendChild(row);
    }

    function buildCommitmentNext(showInput) {
      if (showInput) {
        const inputRow = document.createElement('div');
        inputRow.className = 'tray-input-row';
        const input = document.createElement('input');
        input.className = 'tray-input';
        input.type = 'text';
        input.placeholder = 'Describe your situation...';
        inputRow.appendChild(input);
        tray.appendChild(inputRow);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-component btn-component--primary';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => onCommitmentNext(input.value.trim()));
        tray.appendChild(nextBtn);
      } else {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-component btn-component--primary';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => onCommitmentNext(''));
        tray.appendChild(nextBtn);
      }

      const skip = document.createElement('button');
      skip.className = 'meta-text meta-text--caption';
      skip.style.cssText = 'cursor:pointer;background:none;border:none;padding:0;';
      skip.textContent = 'Skip Question';
      skip.addEventListener('click', () => {
        appendUserBubble('Skip');
        clearTray();
        setTimeout(() => renderStep('main_menu'), 350);
      });
      tray.appendChild(skip);
    }

    function onCommitmentNext(typedText) {
      const colorOk = !!session.sdqColorOpen;
      // Text that resolves perm openness counts as a valid chemical treatment answer
      const textResolvesChemical = typedText
        ? Object.values(parseChemicalOpenness(typedText)).some(v => v !== null)
        : false;
      const chemOk = !!session.sdqChemicalOpen || textResolvesChemical;

      if (!colorOk || !chemOk) {
        // Validation: missing at least one selection
        clearTray();
        const divider = document.createElement('div');
        divider.className = 'chat-tray__divider';
        tray.appendChild(divider);

        showTyping(600).then(() => {
          appendBotBubble("We didn't catch your opinions on hair coloring or chemical treatments. Please let us know your selection:");
          makeYMNRow('Hair Coloring', 'sdqColorOpen');
          makeYMNRow('Chemical treatments (perm/straightening)', 'sdqChemicalOpen');
          buildCommitmentNext(false);
        });
        return;
      }

      // Build user bubble
      const lines = [`${session.sdqColorOpen} to coloring`];
      if (session.sdqChemicalOpen) lines.push(`${session.sdqChemicalOpen} to chemical treatments`);
      if (typedText) lines.push(typedText);
      appendUserBubble(lines.join(';\n'));

      session.sdqSituation = typedText;
      if (typedText) {
        const { curlOpen, straightOpen } = parseChemicalOpenness(typedText);
        if (curlOpen)     session.sdqCurlOpen     = curlOpen;
        if (straightOpen) session.sdqStraightOpen  = straightOpen;
      }
      clearTray();
      setTimeout(() => renderStep('sdq_style'), 350);
    }

    makeYMNRow('Hair Coloring', 'sdqColorOpen');
    makeYMNRow('Chemical treatments (perm/straightening)', 'sdqChemicalOpen');
    buildCommitmentNext(true);

    return;
  }

  // ── SDQ Result layout — Book With Us + Back to Menu ──────────────────────────
  if (step.layout === 'sdq-result') {
    const bookBtn = document.createElement('button');
    bookBtn.className = 'btn-component btn-component--primary';
    bookBtn.textContent = 'Book With Us';
    bookBtn.addEventListener('click', () => {
      appendUserBubble('Book With Us');
      clearTray();
      setTimeout(() => renderStep('booking_start'), 300);
    });
    tray.appendChild(bookBtn);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn-component btn-component--primary';
    menuBtn.textContent = 'Back to Menu';
    menuBtn.addEventListener('click', () => {
      appendUserBubble('Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(menuBtn);

    return;
  }

  // ── SDQ Style layout — style chip grid, up to 3 selections ───────────────────
  if (step.layout === 'sdq-style') {
    const STYLES = ['Soft', 'Sharp', 'Sweet', 'Handsome', 'Colorful', 'Elegant', 'Bright', 'Bouncy', 'Volume', 'Sleek', 'Bold', 'Dramatic'];
    const MAX = 3;
    const selected = new Set();

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;';

    STYLES.forEach(style => {
      const chip = document.createElement('button');
      chip.className = 'selection-chip selection-chip--default';
      chip.textContent = style;
      chip.addEventListener('click', () => {
        if (selected.has(style)) {
          selected.delete(style);
          chip.classList.remove('selection-chip--selected');
          chip.classList.add('selection-chip--default');
          // Re-enable all disabled chips
          grid.querySelectorAll('.selection-chip--disabled').forEach(c => {
            c.classList.remove('selection-chip--disabled');
            c.classList.add('selection-chip--default');
            c.disabled = false;
          });
        } else if (selected.size < MAX) {
          selected.add(style);
          chip.classList.remove('selection-chip--default');
          chip.classList.add('selection-chip--selected');
          // Disable unselected chips when at max
          if (selected.size === MAX) {
            grid.querySelectorAll('.selection-chip--default').forEach(c => {
              c.classList.remove('selection-chip--default');
              c.classList.add('selection-chip--disabled');
              c.disabled = true;
            });
          }
        }
      });
      grid.appendChild(chip);
    });
    tray.appendChild(grid);

    const inputRow = document.createElement('div');
    inputRow.className = 'tray-input-row';
    const input = document.createElement('input');
    input.className = 'tray-input';
    input.type = 'text';
    input.placeholder = 'Something else...';
    inputRow.appendChild(input);
    tray.appendChild(inputRow);

    const seeBtn = document.createElement('button');
    seeBtn.className = 'btn-component btn-component--action';
    seeBtn.textContent = 'See What Fits';
    seeBtn.addEventListener('click', () => {
      const choices = [...selected];
      const typed = input.value.trim();
      if (typed) {
        const resolved = matchSDQText(typed);
        // Store resolved keywords for scoring; fall back to raw text if nothing matched
        if (resolved.length) resolved.forEach(k => { if (!choices.includes(k)) choices.push(k); });
        else choices.push(typed);
      }
      // User bubble shows chip labels + raw typed text (not resolved keyword names)
      const bubbleParts = [...selected];
      if (typed) bubbleParts.push(typed);
      const bubble = bubbleParts.length ? bubbleParts.join(', ') : 'See What Fits';
      session.sdqStyles = choices;
      appendUserBubble(bubble);
      clearTray();
      setTimeout(() => renderStep('sdq_result'), 350);
    });
    tray.appendChild(seeBtn);

    const skip = document.createElement('button');
    skip.className = 'meta-text meta-text--caption';
    skip.style.cssText = 'cursor:pointer;background:none;border:none;padding:0;';
    skip.textContent = 'Skip Question';
    skip.addEventListener('click', () => {
      appendUserBubble('Skip');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 350);
    });
    tray.appendChild(skip);

    return;
  }

  // ── Re-engagement layout — Continue / Start Fresh ─────────────────────────────
  if (step.layout === 're-engagement') {
    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-component btn-component--action';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => {
      appendUserBubble('Continue');
      clearTray();
      const resumeStep = session.resumeStep || 'main_menu';
      setTimeout(() => renderStep(resumeStep), 300);
    });
    tray.appendChild(continueBtn);

    const freshBtn = document.createElement('button');
    freshBtn.className = 'btn-component btn-component--primary';
    freshBtn.textContent = 'Start Fresh';
    freshBtn.addEventListener('click', () => {
      appendUserBubble('Start Fresh');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(freshBtn);

    return;
  }

  // ── No-times layout — See Other Stylists / Call Us / back to calendar ────────
  // ── Appt-lookup layout — name + phone inputs + continue + back meta ──────────
  if (step.layout === 'appt-lookup') {
    const nameRow = document.createElement('div');
    nameRow.className = 'tray-input-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Your Name';
    nameInput.className = 'tray-input';
    nameRow.appendChild(nameInput);
    tray.appendChild(nameRow);

    const phoneRow = document.createElement('div');
    phoneRow.className = 'tray-input-row';
    const phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.placeholder = 'Phone Number';
    phoneInput.className = 'tray-input';
    phoneRow.appendChild(phoneInput);
    tray.appendChild(phoneRow);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-component btn-component--primary';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      if (!name || !phone) return;
      session.lookupName = name;
      session.lookupPhone = phone;
      appendUserBubble(`${name}, ${phone}`);
      clearTray();
      setTimeout(() => renderStep('existing_appt'), 300);
    });
    tray.appendChild(continueBtn);

    const backMeta = document.createElement('button');
    backMeta.className = 'meta-text meta-text--caption';
    backMeta.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back</span></span>';
    backMeta.addEventListener('click', () => {
      clearTray();
      setTimeout(() => renderStep('booking_start'), 300);
    });
    tray.appendChild(backMeta);

    // Focus state
    [nameRow, phoneRow].forEach(row => {
      row.querySelector('input').addEventListener('focus', () => row.classList.add('tray-input-row--focused'));
      row.querySelector('input').addEventListener('blur', () => row.classList.remove('tray-input-row--focused'));
    });

    return;
  }

  // ── Existing-appt layout — reschedule / change / cancel / call ───────────────
  if (step.layout === 'existing-appt') {
    const rescheduleBtn = document.createElement('button');
    rescheduleBtn.className = 'btn-component btn-component--primary';
    rescheduleBtn.textContent = 'Reschedule';
    rescheduleBtn.addEventListener('click', () => {
      appendUserBubble('Reschedule');
      clearTray();
      setTimeout(() => renderStep('appt_reschedule'), 300);
    });
    tray.appendChild(rescheduleBtn);

    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn-component btn-component--primary';
    changeBtn.textContent = 'Change Details';
    changeBtn.addEventListener('click', () => {
      appendUserBubble('Change Details');
      clearTray();
      setTimeout(() => renderStep('appt_change_details'), 300);
    });
    tray.appendChild(changeBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-component btn-component--primary';
    cancelBtn.textContent = 'Cancel Appointment';
    cancelBtn.addEventListener('click', () => {
      appendUserBubble('Cancel Appointment');
      clearTray();
      setTimeout(() => renderStep('appt_cancel_confirm'), 300);
    });
    tray.appendChild(cancelBtn);

    const callMeta = document.createElement('button');
    callMeta.className = 'meta-text meta-text--caption';
    callMeta.textContent = 'Something else? Call us';
    callMeta.addEventListener('click', () => {
      appendUserBubble('Call Us');
      clearTray();
      setTimeout(() => renderStep('call_us'), 300);
    });
    tray.appendChild(callMeta);

    return;
  }

  // ── Appt-cancelled layout — back to menu + close ─────────────────────────────
  if (step.layout === 'appt-cancelled') {
    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn-component btn-component--primary';
    menuBtn.textContent = 'Back to Main Menu';
    menuBtn.addEventListener('click', () => {
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(menuBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-component btn-component--primary';
    closeBtn.textContent = 'Close Chat';
    closeBtn.addEventListener('click', () => {
      const widget = document.querySelector('.chat-widget');
      if (widget) widget.style.display = 'none';
    });
    tray.appendChild(closeBtn);

    return;
  }

  // ── Appt-reschedule layout — same calendar/time picker as booking-confirm ─────
  if (step.layout === 'appt-reschedule') {
    const TIME_SLOTS = ['10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
    let selectedDate = null;
    let selectedTime = null;

    const calCard = buildCalendarCard((date) => {
      selectedDate = date;
      updateTimesLabel();
      updateConfirmBtn();
    });
    tray.appendChild(calCard);

    const timesLabel = document.createElement('div');
    timesLabel.className = 'meta-text meta-text--caption';
    timesLabel.textContent = 'Select a date to see available times';
    tray.appendChild(timesLabel);

    const chipGrid = document.createElement('div');
    chipGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%';
    tray.appendChild(chipGrid);

    const chips = TIME_SLOTS.map(slot => {
      const chip = document.createElement('button');
      chip.className = 'selection-chip selection-chip--default';
      chip.textContent = slot;
      chip.style.width = '100%';
      chip.style.justifyContent = 'center';
      chip.addEventListener('click', () => {
        chips.forEach(c => c.className = 'selection-chip selection-chip--default');
        chip.className = 'selection-chip selection-chip--selected';
        selectedTime = slot;
        updateConfirmBtn();
      });
      chipGrid.appendChild(chip);
      return chip;
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-component btn-component--disabled';
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Select a date and time';
    confirmBtn.addEventListener('click', () => {
      const label = `Confirm ${formatDateR(selectedDate)} at ${selectedTime}`;
      appendUserBubble(label);
      clearTray();
      session.bookingDate = selectedDate;
      session.bookingTime = selectedTime;
      const next = session.matchFlow ? 'match_stylist' : 'booking_details';
      setTimeout(() => renderStep(next), 350);
    });
    tray.appendChild(confirmBtn);

    const noneBtn = document.createElement('button');
    noneBtn.className = 'meta-text meta-text--caption';
    noneBtn.textContent = 'None of these times work';
    noneBtn.addEventListener('click', () => {
      appendUserBubble('None of these times work');
      clearTray();
      setTimeout(() => renderStep('no_times'), 300);
    });
    tray.appendChild(noneBtn);

    function formatDateR(d) {
      if (!d) return '';
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }
    function updateTimesLabel() {
      timesLabel.textContent = selectedDate
        ? `Available times on ${formatDateR(selectedDate)}`
        : 'Select a date to see available times';
    }
    function updateConfirmBtn() {
      if (selectedDate && selectedTime) {
        confirmBtn.className = 'btn-component btn-component--action';
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm ${formatDateR(selectedDate)} at ${selectedTime}`;
      } else {
        confirmBtn.className = 'btn-component btn-component--disabled';
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Select a date and time';
      }
    }

    return;
  }

  // ── Appt-cancel-confirm layout — confirm cancel or keep ──────────────────────
  if (step.layout === 'appt-cancel-confirm') {
    const cancelConfirmBtn = document.createElement('button');
    cancelConfirmBtn.className = 'btn-component btn-component--action';
    cancelConfirmBtn.textContent = 'Cancel Appointment';
    cancelConfirmBtn.addEventListener('click', () => {
      appendUserBubble('Cancel Appointment');
      clearTray();
      setTimeout(() => renderStep('appt_cancelled'), 300);
    });
    tray.appendChild(cancelConfirmBtn);

    const keepBtn = document.createElement('button');
    keepBtn.className = 'btn-component btn-component--primary';
    keepBtn.textContent = 'Keep Appointment';
    keepBtn.addEventListener('click', () => {
      appendUserBubble('Keep Appointment');
      clearTray();
      setTimeout(() => renderStep('existing_appt'), 300);
    });
    tray.appendChild(keepBtn);

    const callMeta = document.createElement('button');
    callMeta.className = 'meta-text meta-text--caption';
    callMeta.textContent = 'Something else? Call Us';
    callMeta.addEventListener('click', () => {
      appendUserBubble('Call Us');
      clearTray();
      setTimeout(() => renderStep('call_us'), 300);
    });
    tray.appendChild(callMeta);

    return;
  }

  // ── Appt-change-details layout — 4 label buttons for what to change ──────────
  if (step.layout === 'appt-change-details') {
    const changeOptions = [
      { label: 'Service Type',     step: 'booking_start' },
      { label: 'Stylist',          step: 'booking_start' },
      { label: 'Date & Time',      step: 'appt_reschedule' },
      { label: 'Contact Details',  step: 'call_us' },
    ];

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%';
    changeOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'label-btn label-btn--default';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        appendUserBubble(opt.label);
        clearTray();
        setTimeout(() => renderStep(opt.step), 300);
      });
      grid.appendChild(btn);
    });
    tray.appendChild(grid);

    const callMeta = document.createElement('button');
    callMeta.className = 'meta-text meta-text--caption';
    callMeta.textContent = 'Something else? Call Us';
    callMeta.addEventListener('click', () => {
      appendUserBubble('Call Us');
      clearTray();
      setTimeout(() => renderStep('call_us'), 300);
    });
    tray.appendChild(callMeta);

    return;
  }

  if (step.layout === 'no-times') {
    const stylistName = (STEPS.booking_start.stylists || []).find(s => s.id === session.selectedStylist)?.name || 'your stylist';

    const seeOthersBtn = document.createElement('button');
    seeOthersBtn.className = 'btn-component btn-component--primary';
    seeOthersBtn.textContent = 'See Other Stylists';
    seeOthersBtn.addEventListener('click', () => {
      appendUserBubble('See Other Stylists');
      clearTray();
      setTimeout(() => renderStep('see_other_stylists'), 300);
    });
    tray.appendChild(seeOthersBtn);

    const callUsBtn = document.createElement('button');
    callUsBtn.className = 'btn-component btn-component--primary';
    callUsBtn.textContent = 'Call Us';
    callUsBtn.addEventListener('click', () => {
      appendUserBubble('Call Us');
      clearTray();
      setTimeout(() => renderStep('call_us'), 300);
    });
    tray.appendChild(callUsBtn);

    const backLink = document.createElement('button');
    backLink.className = 'meta-text meta-text--caption';
    backLink.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>View ${stylistName}'s Calendar again</span></span>`;
    backLink.addEventListener('click', () => {
      clearTray();
      setTimeout(() => renderStep('booking_confirm'), 300);
    });
    tray.appendChild(backLink);

    return;
  }

  // ── Booking-service layout — service type chip selection ─────────────────────
  if (step.layout === 'booking-service') {
    let selectedService = session.bookingService || null;

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;';

    const chips = (step.options || []).map(opt => {
      const btn = document.createElement('button');
      btn.className = 'label-btn ' + (selectedService === opt.value ? 'label-btn--focused' : 'label-btn--default');
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        if (selectedService === opt.value) {
          selectedService = null;
          btn.className = 'label-btn label-btn--default';
        } else {
          selectedService = opt.value;
          grid.querySelectorAll('.label-btn').forEach(b => b.className = 'label-btn label-btn--default');
          btn.className = 'label-btn label-btn--focused';
        }
      });
      grid.appendChild(btn);
      return btn;
    });

    tray.appendChild(grid);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn-component btn-component--primary';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => {
      if (!selectedService) return;
      session.bookingService = selectedService;
      const label = (step.options || []).find(o => o.value === selectedService)?.label || selectedService;
      appendUserBubble(label);
      clearTray();
      const next = session.bookingEditMode ? 'booking_details'
                 : session.matchFlow       ? 'match_confirm'
                 : 'booking_confirm';
      setTimeout(() => renderStep(next), 350);
    });
    tray.appendChild(continueBtn);

    const callUs = document.createElement('button');
    callUs.className = 'meta-text meta-text--caption';
    callUs.textContent = 'Call us instead';
    callUs.addEventListener('click', () => {
      appendUserBubble('Call us instead');
      clearTray();
      setTimeout(() => renderStep('call_us'), 350);
    });
    tray.appendChild(callUs);
    return;
  }

  // ── Booking-confirm layout — calendar + time chips + confirm button ──────────
  if (step.layout === 'booking-confirm') {
    const TIME_SLOTS = ['10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
    let selectedDate = null;
    let selectedTime = null;

    // Calendar card
    const calCard = buildCalendarCard((date) => {
      selectedDate = date;
      updateTimesLabel();
      updateConfirmBtn();
    });
    tray.appendChild(calCard);

    // "Available times on …" meta label
    const timesLabel = document.createElement('div');
    timesLabel.className = 'meta-text meta-text--caption';
    timesLabel.textContent = 'Select a date to see available times';
    tray.appendChild(timesLabel);

    // 3×2 chip grid
    const chipGrid = document.createElement('div');
    chipGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%';
    tray.appendChild(chipGrid);

    const chips = TIME_SLOTS.map(slot => {
      const chip = document.createElement('button');
      chip.className = 'selection-chip selection-chip--default';
      chip.textContent = slot;
      chip.style.width = '100%';
      chip.style.justifyContent = 'center';
      chip.addEventListener('click', () => {
        chips.forEach(c => c.className = 'selection-chip selection-chip--default');
        chip.className = 'selection-chip selection-chip--selected';
        selectedTime = slot;
        updateConfirmBtn();
      });
      chipGrid.appendChild(chip);
      return chip;
    });

    // Confirm button (disabled until date + time chosen)
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-component btn-component--disabled';
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Select a date and time';
    confirmBtn.addEventListener('click', () => {
      const label = `${formatDate(selectedDate)} at ${selectedTime}`;
      appendUserBubble(label);
      clearTray();
      session.bookingDate = selectedDate;
      session.bookingTime = selectedTime;
      const next = session.matchFlow ? 'match_stylist' : 'booking_details';
      setTimeout(() => renderStep(next), 350);
    });
    tray.appendChild(confirmBtn);

    // "None of these times work" meta-text
    const noneBtn = document.createElement('button');
    noneBtn.className = 'meta-text meta-text--caption';
    noneBtn.textContent = 'None of these times work';
    noneBtn.addEventListener('click', () => {
      appendUserBubble('None of these times work');
      clearTray();
      setTimeout(() => renderStep('no_times'), 300);
    });
    tray.appendChild(noneBtn);

    function formatDate(d) {
      if (!d) return '';
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }

    function updateTimesLabel() {
      timesLabel.textContent = selectedDate
        ? `Available times on ${formatDate(selectedDate)}`
        : 'Select a date to see available times';
    }

    function updateConfirmBtn() {
      if (selectedDate && selectedTime) {
        confirmBtn.className = 'btn-component btn-component--action';
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm ${formatDate(selectedDate)} at ${selectedTime}`;
      } else {
        confirmBtn.className = 'btn-component btn-component--disabled';
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Select a date and time';
      }
    }

    return;
  }

  // ── Match-stylist layout — same card grid as stylist-select, book → booking_details
  if (step.layout === 'match-stylist') {
    const caption = document.createElement('div');
    caption.className = 'meta-text meta-text--caption';
    caption.textContent = 'Swipe cards right for more stylists';
    tray.appendChild(caption);

    const grid = document.createElement('div');
    grid.className = 'stylist-tray-grid';

    for (const s of STEPS.booking_start.stylists) {
      const card = document.createElement('div');
      card.className = 'stylist-tray-card';
      card.innerHTML = `
        <div class="stylist-tray-card__img" style="background-image:url('images/${s.image}')"></div>
        <div class="stylist-tray-card__body">
          <span class="stylist-tray-card__name">${s.name}</span>
          <span class="stylist-tray-card__spec">${s.specialties}</span>
        </div>
        <span class="stylist-tray-card__tier">${s.tier}</span>
      `;
      card.addEventListener('click', () => showStylistSheet(s, (stylist) => {
        session.selectedStylist = stylist.id;
        session.matchFlow = false;
        appendUserBubble(`Book with ${stylist.name}`);
        clearTray();
        setTimeout(() => renderStep('booking_details'), 350);
      }));
      grid.appendChild(card);
    }

    grid.appendChild(document.createElement('div'));
    grid.appendChild(document.createElement('div'));
    tray.appendChild(grid);
    return;
  }

  // ── Contact-us layout — Call Now + Text Us buttons + back link ──────────────
  if (step.layout === 'contact-us') {
    const callBtn = document.createElement('button');
    callBtn.className = 'label-btn label-btn--default';
    callBtn.textContent = 'Call Now';
    callBtn.addEventListener('click', () => { window.location.href = 'tel:+12126583916'; });
    tray.appendChild(callBtn);

    const textBtn = document.createElement('button');
    textBtn.className = 'label-btn label-btn--default';
    textBtn.textContent = 'Text Us';
    textBtn.addEventListener('click', () => { window.location.href = 'sms:+12126583916'; });
    tray.appendChild(textBtn);

    const back = document.createElement('button');
    back.className = 'meta-text meta-text--body';
    back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
    back.addEventListener('click', () => {
      appendUserBubble('Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(back);
    return;
  }

  // ── Stylist-select layout — scrollable 2-row card grid ──────────────────────
  if (step.layout === 'stylist-select' && step.stylists) {
    const caption = document.createElement('div');
    caption.className = 'meta-text meta-text--caption';
    caption.textContent = 'Swipe cards right for more stylists';
    tray.appendChild(caption);

    const grid = document.createElement('div');
    grid.className = 'stylist-tray-grid';

    const matchCard = document.createElement('div');
    matchCard.className = 'stylist-tray-card stylist-tray-card--match';
    matchCard.innerHTML = `<span class="stylist-tray-card__match-label">Match me with someone available</span>`;
    matchCard.addEventListener('click', () => {
      appendUserBubble('Match me with someone available');
      clearTray();
      session.matchFlow = true;
      setTimeout(() => renderStep('match_service'), 350);
    });
    grid.appendChild(matchCard);

    for (const s of step.stylists) {
      const card = document.createElement('div');
      card.className = 'stylist-tray-card';
      card.innerHTML = `
        <div class="stylist-tray-card__img" style="background-image:url('images/${s.image}')"></div>
        <div class="stylist-tray-card__body">
          <span class="stylist-tray-card__name">${s.name}</span>
          <span class="stylist-tray-card__spec">${s.specialties}</span>
        </div>
        <span class="stylist-tray-card__tier">${s.tier}</span>
      `;
      card.addEventListener('click', () => showStylistSheet(s));
      grid.appendChild(card);
    }

    // Two empty spacer cells so the last snap position is reachable
    grid.appendChild(document.createElement('div'));
    grid.appendChild(document.createElement('div'));

    tray.appendChild(grid);

    const apptLink = document.createElement('button');
    apptLink.className = 'meta-text meta-text--caption';
    apptLink.innerHTML = '<span style="text-decoration:underline;">Have an existing appointment? Tap Here</span>';
    apptLink.addEventListener('click', () => {
      clearTray();
      setTimeout(() => renderStep('appt_lookup'), 300);
    });
    tray.appendChild(apptLink);

    const back = document.createElement('button');
    back.className = 'meta-text meta-text--body';
    back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
    back.addEventListener('click', () => {
      appendUserBubble('Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(back);
    return;
  }

  const options = typeof step.options === 'function'
    ? step.options(session)
    : step.options;
  if (!options || !options.length) return;

  // ── Menu grid layout — 2-column card grid + optional metatext options ──
  if (step.layout === 'menu-grid') {
    const cardOpts = options.filter(o => o.style !== 'metatext');
    const metaOpts = options.filter(o => o.style === 'metatext');

    const grid = document.createElement('div');
    grid.className = 'tray-menu-grid';
    for (const opt of cardOpts) {
      const card = document.createElement('button');
      card.className = 'menu-card';
      card.innerHTML = opt.icon
        ? `<div class="menu-card__icon"><img src="images/icons/${opt.icon}" alt=""></div><div class="menu-card__label">${opt.label}</div>`
        : `<div class="menu-card__label">${opt.label}</div>`;
      card.addEventListener('click', () => handleChoice(opt));
      grid.appendChild(card);
    }
    tray.appendChild(grid);

    for (const opt of metaOpts) {
      const meta = document.createElement('button');
      meta.className = 'tray-quiz-prompt';
      meta.innerHTML = `
        <span class="tray-quiz-prompt__icon"><img src="images/icons/Sparkle.svg" alt=""></span>
        <span>Not sure? Try our <span class="tray-quiz-prompt__underline">style discovery quiz</span></span>
      `;
      meta.addEventListener('click', () => handleChoice(opt));
      tray.appendChild(meta);
    }
    return;
  }

  // ── Bleach-expand layout — Yes/No row, Yes expands timing sub-question ──
  if (step.layout === 'bleach-expand') {
    const row = document.createElement('div');
    row.className = 'tray-btn-row';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'label-btn label-btn--default';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', () => {
      const expanded = tray.querySelector('.bleach-age-expansion');
      if (expanded) {
        tray.querySelectorAll('.bleach-age-expansion').forEach(el => el.remove());
        yesBtn.className = 'label-btn label-btn--default';
        return;
      }
      yesBtn.className = 'label-btn label-btn--focused';

      const hint = document.createElement('div');
      hint.className = 'meta-text meta-text--body bleach-age-expansion';
      hint.textContent = 'If yes, how long ago was that?';
      tray.appendChild(hint);

      for (const opt of (step.bleachAgeOptions || [])) {
        const btn = document.createElement('button');
        btn.className = 'label-btn label-btn--default bleach-age-expansion';
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
          if (btn.classList.contains('label-btn--focused')) {
            btn.className = 'label-btn label-btn--default bleach-age-expansion';
            return;
          }
          tray.querySelectorAll('.bleach-age-expansion.label-btn').forEach(b => b.className = 'label-btn label-btn--default bleach-age-expansion');
          btn.className = 'label-btn label-btn--focused bleach-age-expansion';
          session.isBleached = true;
          session.bleachAge = opt.value;
          session.bleachTiming = opt.value;
          appendUserBubble(opt.label);
          clearTray();
          if (session.service === 'color' && (opt.value === 'under-3w' || opt.value === '3w-1y')) {
            appendInlineNote("Healthy hair is essential for achieving the best results. Please make sure your hair is healthy enough before your next appointment.");
          } else if (session.service === 'perm' && opt.value === 'under-3w') {
            appendInlineNote("Please note that frequent treatments may weaken your hair. We recommend waiting 2–3 weeks before your next treatment to help maintain its health and integrity.");
          }
          setTimeout(() => renderStep('box_dye'), 350);
        });
        tray.appendChild(btn);
      }
      requestAnimationFrame(() => scrollThread());
    });

    const noBtn = document.createElement('button');
    noBtn.className = 'label-btn label-btn--default';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', () => handleChoice({ label: 'No', value: 'no' }));

    row.appendChild(yesBtn);
    row.appendChild(noBtn);
    tray.appendChild(row);
    return;
  }

  // ── Yes-no-row layout — simple Yes/No label-btn row, no metatext ──
  if (step.layout === 'yes-no-row') {
    const row = document.createElement('div');
    row.className = 'tray-btn-row';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'label-btn label-btn--default';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => handleChoice(opt));
      row.appendChild(btn);
    }
    tray.appendChild(row);
    return;
  }

  // ── Color-swatches layout — 3-col swatch grid + input field ──
  if (step.layout === 'color-swatches') {
    const swatches = step.swatches || [];
    const grid = document.createElement('div');
    grid.className = 'tray-color-swatch-grid';
    for (const swatch of swatches) {
      const card = document.createElement('button');
      card.className = 'color-swatch-card';
      card.innerHTML = `
        <img class="color-swatch-card__image" src="images/${swatch.image}" alt="${swatch.label}">
        <div class="color-swatch-card__label">${swatch.label}</div>
      `;
      card.addEventListener('click', () => {
        const opt = (step.options || []).find(o => o.value === swatch.value) || { label: swatch.label, value: swatch.value };
        handleChoice(opt);
      });
      grid.appendChild(card);
    }
    tray.appendChild(grid);

    const inputRow = document.createElement('div');
    inputRow.className = 'tray-input-row';
    inputRow.innerHTML = `<input type="text" class="tray-input" placeholder="Describe your hair color..."><button class="tray-send" aria-label="Send"><img src="images/icons/ArrowUp.svg" width="12" height="12" alt=""></button>`;
    const colorInput = inputRow.querySelector('.tray-input');
    const colorSend = inputRow.querySelector('.tray-send');
    const NO_BLEACH_TERMS = ['white', 'platinum blonde', 'platinum', 'light blonde', 'strawberry blonde', 'silver', 'gray', 'grey'];
    const submitColorText = () => {
      const raw = colorInput.value.trim().toLowerCase();
      if (!raw) return;
      const isLight = NO_BLEACH_TERMS.some(term => raw.includes(term));
      const resolvedValue = isLight ? 'light-blonde' : 'dark-brown';
      appendUserBubble(colorInput.value.trim());
      clearTray();
      setTimeout(() => {
        const nextStep = route('natural_color', resolvedValue);
        if (nextStep) renderStep(nextStep);
      }, 350);
    };
    colorSend.addEventListener('click', submitColorText);
    colorInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitColorText(); });
    tray.appendChild(inputRow);
    return;
  }

  // ── Permed-expand layout — Yes/No row, Yes expands to show timing sub-question ──
  if (step.layout === 'permed-expand') {
    const row = document.createElement('div');
    row.className = 'tray-btn-row';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'label-btn label-btn--default';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', () => {
      const expanded = tray.querySelector('.perm-age-expansion');
      if (expanded) {
        // Deselect — collapse expansion and unfocus Yes
        tray.querySelectorAll('.perm-age-expansion').forEach(el => el.remove());
        yesBtn.className = 'label-btn label-btn--default';
        return;
      }
      yesBtn.className = 'label-btn label-btn--focused';

      const hint = document.createElement('div');
      hint.className = 'meta-text meta-text--body perm-age-expansion';
      hint.textContent = 'If yes, when was your last perm or chemical treatment?';
      tray.appendChild(hint);

      for (const opt of (step.permAgeOptions || [])) {
        const btn = document.createElement('button');
        btn.className = 'label-btn label-btn--default perm-age-expansion';
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
          if (btn.classList.contains('label-btn--focused')) {
            btn.className = 'label-btn label-btn--default perm-age-expansion';
            return;
          }
          tray.querySelectorAll('.perm-age-expansion.label-btn').forEach(b => b.className = 'label-btn label-btn--default perm-age-expansion');
          btn.className = 'label-btn label-btn--focused perm-age-expansion';
          session.isPermed = true;
          session.permAge = opt.value;
          session.permTiming = opt.value;
          appendUserBubble(opt.userLabel || opt.label);
          clearTray();
          if (opt.value === 'under-3w') {
            appendInlineNote("Please note that frequent treatments may weaken your hair. We recommend waiting 2–3 weeks before your next treatment to help maintain its health and integrity.");
          } else if (session.service === 'perm' && opt.value === '3w-6m') {
            appendInlineNote("Conditioning your hair before your appointment helps keep it healthy and prepared for your service.");
          }
          setTimeout(() => renderStep('bleached_history'), 350);
        });
        tray.appendChild(btn);
      }
    });

    const noBtn = document.createElement('button');
    noBtn.className = 'label-btn label-btn--default';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', () => handleChoice({ label: 'No', value: 'no' }));

    row.appendChild(yesBtn);
    row.appendChild(noBtn);
    tray.appendChild(row);
    return;
  }

  // ── Length-chips layout — 3-col label-btn grid + metatext ──
  if (step.layout === 'length-chips') {
    const grid = document.createElement('div');
    grid.className = 'tray-service-select-grid';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'label-btn label-btn--default';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => handleChoice(opt));
      grid.appendChild(btn);
    }
    tray.appendChild(grid);

    const meta = document.createElement('div');
    meta.className = 'meta-text meta-text--body';
    meta.style.textAlign = 'center';
    meta.textContent = 'Not sure? Pick the closest one.';
    tray.appendChild(meta);
    return;
  }

  // ── Service-select-cards layout — image cards stacked + input field + Back button ──
  if (step.layout === 'service-select-cards') {
    const cards = step.cards || [];
    for (const card of cards) {
      const el = document.createElement('button');
      el.className = 'service-select-card';
      el.innerHTML = `
        <div class="service-select-card__text">
          <div class="service-select-card__title">${card.title}</div>
          <div class="service-select-card__desc">${card.desc}</div>
        </div>
        <img class="service-select-card__image" src="images/${card.image}" alt="${card.title}">
      `;
      el.addEventListener('click', () => {
        const opt = (step.options || []).find(o => o.value === card.value) || { label: card.title, value: card.value };
        handleChoice(opt);
      });
      tray.appendChild(el);
    }

    const inputField = document.createElement('div');
    inputField.className = 'tray-input-row';
    inputField.innerHTML = `<input type="text" class="tray-input" placeholder="Or describe what you're after..."><button class="tray-send" aria-label="Send"><img src="images/icons/ArrowUp.svg" width="12" height="12" alt=""></button>`;
    tray.appendChild(inputField);

    const cardInput = inputField.querySelector('.tray-input');
    const cardSend  = inputField.querySelector('.tray-send');

    // Sub-type keyword maps for each service-select-cards step
    const SUBTYPE_KEYWORDS = {
      color_type: {
        'balayage':   ['balayage', 'highlight', 'babylight', 'ombre', 'sombre', 'dimension', 'partial color', 'painted'],
        'full-color': ['full color', 'all-over', 'allover', 'all over', 'dye', 'darker', 're-dye', 'permanent'],
      },
      bleach_type: {
        'full-partial': ['partial', 'full', 'highlight', 'section', 'lighten', 'strip'],
        'root-touchup': ['root', 'touch-up', 'touchup', 'regrowth', 'grow out'],
      },
      perm_type: {
        'curl':     ['curl', 'curly', 'wavy', 'wave', 'waves', 'beach waves'],
        'straight': ['straight', 'rebond', 'relax', 'smooth'],
      },
      treatment_care_type: {
        'hair-care':  ['hair', 'moisture', 'condition', 'repair', 'strand', 'bond', 'frizz', 'damage'],
        'scalp-care': ['scalp', 'exfoliat'],
      },
    };

    const submitCardText = () => {
      const raw = cardInput.value.trim();
      if (!raw) return;
      const t = raw.toLowerCase();
      const stepKeywords = SUBTYPE_KEYWORDS[currentStepId] || {};
      let resolvedValue = null;
      for (const [val, keywords] of Object.entries(stepKeywords)) {
        if (keywords.some(k => t.includes(k))) { resolvedValue = val; break; }
      }
      appendUserBubble(raw);
      clearTray();
      setTimeout(() => {
        if (resolvedValue) {
          const opt = (step.options || []).find(o => o.value === resolvedValue) || { value: resolvedValue };
          handleChoice(opt);
        } else {
          // No sub-type detected — skip sub-type step and go to hair_length
          renderStep('hair_length');
        }
      }, 350);
    };
    cardSend.addEventListener('click', submitCardText);
    cardInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitCardText(); });
    return;
  }

  // ── Service-select layout — 3-col chip grid + input field + Back button ──
  if (step.layout === 'service-select') {
    const grid = document.createElement('div');
    grid.className = 'tray-service-select-grid';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'label-btn label-btn--default';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => handleChoice(opt));
      grid.appendChild(btn);
    }
    tray.appendChild(grid);

    const inputField = document.createElement('div');
    inputField.className = 'tray-input-row';
    inputField.innerHTML = `<input type="text" class="tray-input" placeholder="Or describe what you're after..."><button class="tray-send" aria-label="Send"><img src="images/icons/ArrowUp.svg" width="12" height="12" alt=""></button>`;
    tray.appendChild(inputField);

    const svcInput = inputField.querySelector('.tray-input');
    const svcSend  = inputField.querySelector('.tray-send');
    const submitSvcText = () => {
      const raw = svcInput.value.trim();
      if (!raw) return;
      const match = matchServiceText(raw);
      appendUserBubble(raw);
      clearTray();
      shownNotes.clear();
      setTimeout(() => {
        if (!match) { showError(); return; }
        session.service = match.service;
        if (match.service === 'color' && match.colorType) {
          session.colorType = match.colorType;
          renderStep('hair_length');
        } else if (match.service === 'perm' && match.permType) {
          session.permType = match.permType;
          renderStep('hair_length');
        } else {
          const nextStep = route('quote_service_select', match.service);
          if (nextStep) renderStep(nextStep);
        }
      }, 350);
    };
    svcSend.addEventListener('click', submitSvcText);
    svcInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitSvcText(); });

    if (!PROGRESS_STEPS.includes(currentStepId)) {
      const backBtn = document.createElement('button');
      backBtn.className = 'meta-text meta-text--body';
      backBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Menu</span></span>';
      backBtn.addEventListener('click', () => {
        appendUserBubble('Back');
        clearTray();
        setTimeout(() => renderStep('service_list'), 300);
      });
      tray.appendChild(backBtn);
    }
    return;
  }

  // ── Standard layouts ──
  const useChips = step.layout === 'chips';
  const useRow   = step.layout === 'row';
  const wrap = document.createElement('div');
  wrap.className = useChips ? 'tray-chips' : useRow ? 'tray-btn-row' : 'tray-choices';

  for (const opt of options) {
    const btn = document.createElement('button');
    if (useChips) {
      btn.className = 'label-btn label-btn--default';
    } else {
      btn.className = `btn-component btn-component--${opt.style === 'action' ? 'action' : 'primary'}`;
    }
    if (!useChips && opt.sublabel) {
      btn.innerHTML = `<span>${opt.label}</span><span class="btn-sublabel">${opt.sublabel}</span>`;
    } else {
      btn.textContent = opt.label;
    }
    btn.addEventListener('click', () => handleChoice(opt));
    wrap.appendChild(btn);
  }
  tray.appendChild(wrap);

  // Back link — not shown on top-level screens or layouts that provide their own nav
  const topLevel = ['greeting', 'main_menu', 'booking_start', 'call_us'];
  if (!topLevel.includes(currentStepId) && !PROGRESS_STEPS.includes(currentStepId) && step.layout !== 'service-list' && step.layout !== 'service-detail' && step.layout !== 'service-select' && step.layout !== 'service-select-cards') {
    const back = document.createElement('button');
    back.className = 'meta-text meta-text--body';
    back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
    back.addEventListener('click', () => {
      appendUserBubble('Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 300);
    });
    tray.appendChild(back);
  }
}

// If thread content overflows its viewport, scroll so targetEl is at the top
// so users can read from the first new message and scroll at their own pace.
// If content fits, keep bottom-anchor behaviour (spacer does the work).
const scrollHint = (() => {
  const el = document.createElement('div');
  el.className = 'scroll-hint';
  el.textContent = '↓ Scroll for more';
  el.style.display = 'none';
  document.querySelector('.chat-widget')?.appendChild(el);
  thread.addEventListener('scroll', () => {
    const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 40;
    if (nearBottom) hideScrollHint();
  });
  return el;
})();

function showScrollHint() {
  scrollHint.style.display = 'block';
}
function hideScrollHint() {
  scrollHint.style.display = 'none';
}

function smartScrollAfterStep(firstBubble, lastBubble) {
  if (!firstBubble) return;
  // Use two rAFs so cards + tray are fully laid out before measuring
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const threadVisible = thread.clientHeight;
    const firstTop = firstBubble.offsetTop - thread.offsetTop;
    // Measure from firstBubble to the full bottom of thread content
    const contentBelow = thread.scrollHeight - firstTop;

    if (contentBelow > threadVisible) {
      // Too tall — scroll to first bubble, show hint
      thread.scrollTop = firstTop - 16;
      showScrollHint();
    } else {
      // All fits — scroll last bubble into view
      scrollThread(lastBubble);
      hideScrollHint();
    }
  }));
}

function scrollThread(targetEl) {
  if (targetEl && thread.scrollHeight > thread.clientHeight) {
    thread.scrollTop = targetEl.offsetTop - thread.offsetTop - 16;
  } else {
    thread.scrollTop = thread.scrollHeight;
  }
}

// ─── Inline warning note ──────────────────────────────────────────────────────

const shownNotes = new Set();

function appendInlineNote(text) {
  if (shownNotes.has(text)) return;
  shownNotes.add(text);
  const el = document.createElement('div');
  el.className = 'meta-text meta-text--caption';
  el.style.padding = '0 4px';
  el.textContent = text;
  thread.appendChild(el);
}

// ─── Choice handler ───────────────────────────────────────────────────────────

function handleChoice(opt) {
  appendUserBubble(opt.userLabel || opt.label);
  clearTray();
  scrollThread();

  const nextStepId = route(currentStepId, opt.value);
  // null means the route triggered an async inline flow (estimate display)
  if (nextStepId !== null) {
    setTimeout(() => renderStep(nextStepId), 350);
  }
}

// ─── Routing ──────────────────────────────────────────────────────────────────

function route(from, value) {
  switch (from) {

    case 'greeting':
      session.isReturning = (value === 'returning');
      return value === 'returning' ? 'returning_lookup' : 'main_menu';

    case 'main_menu':
      // Route 'color' shortcut from style_quiz stub
      if (value === 'color') { session.service = 'color'; return 'color_type'; }
      return value; // passes through step IDs directly

    case 'service_list':
    case 'quote_service_select':
      if (value === 'main_menu') return 'main_menu';
      shownNotes.clear();
      if (value === 'color')     { session.service = 'color';     return 'color_type'; }
      if (value === 'balayage')  { session.service = 'color'; session.colorType = 'balayage'; return 'hair_length'; }
      if (value === 'cut')       { session.service = 'cut';       return 'cut_type'; }
      if (value === 'perm')      { session.service = 'perm';      return 'perm_type'; }
      if (value === 'bleach')    { session.service = 'bleach';    return 'bleach_type'; }
      if (value === 'treatment') { session.service = 'treatment'; return 'treatment_care_type'; }
      return 'call_us';

    case 'color_type':
      session.colorType = value;
      return 'hair_length';

    case 'cut_type':
      session.cutType = value;
      buildAndShowCutPrices();
      return null;

    case 'perm_type':
      session.permType = value; // 'curl' | 'straight'
      return 'hair_length';

    case 'bleach_type':
      session.bleachType = value; // 'full-partial' | 'root-touchup'
      return 'hair_length';

    case 'treatment_care_type':
      session.treatmentCareType = value;
      if (value === 'scalp-care') { buildAndShowScalpPrices(); return null; }
      return 'hair_length';

    case 'hair_length':
      session.hairLength = value;
      if (session.service === 'color')     return 'natural_color';
      if (session.service === 'treatment') return 'treatment_colored';
      return 'permed'; // perm + bleach: go to perm history check

    case 'natural_color':
      session.naturalColor = value;
      return 'permed';

    case 'permed':
      // value is 'no' or a timing value (under-3w / 3w-6m / over-6m)
      session.permTiming = value;
      if (value === 'under-3w') {
        appendInlineNote("Please note that frequent treatments may weaken your hair. We recommend waiting 2–3 weeks before your next treatment to help maintain its health and integrity.");
      } else if (session.service === 'perm' && value === '3w-6m') {
        appendInlineNote("Conditioning your hair before your appointment helps keep it healthy and prepared for your service.");
      }
      return 'bleached_history';

    case 'bleached_history':
      // value is 'no' or a timing value (under-3w / 3w-1y / 1-4y / over-4y)
      session.bleachTiming = value;
      if (session.service === 'color' && (value === 'under-3w' || value === '3w-1y')) {
        appendInlineNote("Healthy hair is essential for achieving the best results. Please make sure your hair is healthy enough before your next appointment.");
      } else if (session.service === 'perm' && value === 'under-3w') {
        appendInlineNote("Please note that frequent treatments may weaken your hair. We recommend waiting 2–3 weeks before your next treatment to help maintain its health and integrity.");
      }
      return 'box_dye';

    case 'treatment_colored':
      session.treatmentColored = (value === 'yes');
      if (value === 'yes') {
        appendInlineNote("Please note that some treatments include heat/water rinse which can result in minor color loss.");
      }
      buildAndShowTreatmentPrices();
      return null;

    case 'box_dye':
      session.hasBoxDye = (value === 'yes');
      if (!session.hasBoxDye) { buildAndShowEstimate(); return null; }
      if (session.service === 'bleach') {
        appendInlineNote("We noticed you are trying to go lighter, please note that results may vary and can possibly take a few sessions.");
        buildAndShowEstimate();
        return null;
      }
      // Color: ask if they dyed darker (may require consult)
      if (session.service === 'color') return 'box_dye_darker';
      // Perm: ask timing of home dye (may warn about fade)
      if (session.service === 'perm') return 'perm_home_dye_when';
      buildAndShowEstimate();
      return null;

    case 'perm_home_dye_when':
      session.homeDyeWhen = value; // 'under-6m' | 'over-6m'
      if (value === 'under-6m') return 'box_dye_darker'; // need to know if darker
      buildAndShowEstimate();
      return null;

    case 'box_dye_darker':
      session.dyedDarkerRecently = (value === 'yes');
      if (value === 'yes' && session.service === 'perm') {
        appendInlineNote("Please note that certain perm services require high heat and can reduce the longevity and vibrancy of your hair color.");
      }
      buildAndShowEstimate();
      return null;

    default:
      // Any step that passes a step ID as value (stubs, back links, etc.)
      if (STEPS[value]) return value;
      return 'main_menu';
  }
}

// ─── Rule-based estimate engine ───────────────────────────────────────────────

const HAIR_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

// Used on service cards only — flat prices display as "$X UP"
function cardPrice(n) { return `$${n} UP`; }

// ─── Style Discovery Quiz matcher ────────────────────────────────────────────
// Returns ranked array of { svc, label, score, isMaybe } for sdq_result

function computeSDQResult() {
  const keywords  = (session.sdqStyles || []).map(k => k.toLowerCase());
  const colorOpen    = (session.sdqColorOpen    || 'no').toLowerCase();
  const chemOpen     = (session.sdqChemicalOpen || 'no').toLowerCase();
  // Per-perm-type overrides from free text; fall back to button selection
  const curlOpen     = (session.sdqCurlOpen     || chemOpen).toLowerCase();
  const straightOpen = (session.sdqStraightOpen  || chemOpen).toLowerCase();

  const results = [];

  for (const [svc, meta] of Object.entries(SDQ_SERVICES)) {
    // Filter by what user is open to
    if (meta.requiresColor       && colorOpen    === 'no') continue;
    if (meta.requiresCurlPerm    && curlOpen     === 'no') continue;
    if (meta.requiresStraightPerm && straightOpen === 'no') continue;

    // Score from keyword matches
    let score = 0;
    let hasYes = false;
    for (const kw of keywords) {
      const map = SDQ_KEYWORD_MAP[kw];
      if (!map) continue;
      score += map[svc];
      if (map[svc] === 2) hasYes = true;
    }
    if (score === 0) continue;

    // "Maybe" if no strong Yes keyword hit, or relevant openness is Maybe
    const opennessIsMaybe = (meta.requiresColor        && colorOpen    === 'maybe') ||
                            (meta.requiresCurlPerm     && curlOpen     === 'maybe') ||
                            (meta.requiresStraightPerm && straightOpen === 'maybe');
    const isMaybe = !hasYes || opennessIsMaybe;

    results.push({ svc, label: meta.label, score, isMaybe });
  }

  return results.sort((a, b) => b.score - a.score);
}

// Evaluate PRICING_RULES against current session
// Returns { rows, tags, warnings, reminders, consultRequired }
function computeEstimate(s) {
  const matched = PRICING_RULES.filter(r => r.match(s));

  const consultRequired = matched.some(r => r.consultRequired);
  const warnings   = matched.filter(r => r.warning).map(r => r.warning);
  const reminders  = matched.filter(r => r.reminder).map(r => r.reminder);
  const components = matched.filter(r => r.price);

  let refinedTotal = 0, premierTotal = 0, flatTotal = 0;
  let hasTiers = false;
  const addonLabels = [];
  let bleachAddon = null; // shown as separate "+ $X" row

  for (const rule of components) {
    const p = rule.price(s);
    if (rule.tiered) {
      refinedTotal += p.refined;
      premierTotal += p.premier;
      hasTiers = true;
    } else if (rule.id === 'bleach-required-color') {
      bleachAddon = { label: 'Bleaching', price: `+ $${p.flat}` };
    } else {
      flatTotal += p.flat;
      if (rule.id.startsWith('treatment-')) addonLabels.push(rule.label);
    }
  }

  const baseRule = components.find(r => r.id.endsWith('-base'));
  const tags = baseRule ? [baseRule.label, s.hairLength, ...addonLabels] : [s.hairLength, ...addonLabels];

  const rows = hasTiers
    ? [
        { label: addonLabels.length ? 'Refined w/ treatment' : 'Refined', price: `$${refinedTotal + flatTotal}↑` },
        { label: addonLabels.length ? 'Premier w/ treatment' : 'Premier', price: `$${premierTotal + flatTotal}↑` },
        ...(bleachAddon ? [bleachAddon] : [])
      ]
    : [{ label: 'Total', price: `$${flatTotal}↑` }];

  const zeroTotal = !consultRequired && (refinedTotal + premierTotal + flatTotal === 0);

  return { rows, tags, warnings, reminders, consultRequired, zeroTotal };
}

// Single unified renderer for all service estimates
function buildAndShowEstimate({ typing = 700, afterTray = renderPostEstimateTray, isUpdate = false } = {}) {
  const { rows, tags, warnings, reminders, consultRequired, zeroTotal } = computeEstimate(session);

  // Zero total — couldn't calculate
  if (zeroTotal && !isUpdate) {
    showError();
    return;
  }

  // Consultation required — no price shown
  if (consultRequired && !isUpdate) {
    showTyping(typing).then(() => {
      currentStepId = 'quote_result';
      updateSubtitle('quote_result');
      const bubble = appendBotBubble(
        "Thank you for going through the quiz with us. With your special case we cannot advise an estimate with ease. Please book a consultation or reach out in person instead."
      );
      scrollThread(bubble);
      setTimeout(renderConsultTray, 400);
    });
    return;
  }

  const CONSULT_SERVICES = ['color', 'perm', 'bleach'];
  const note = CONSULT_SERVICES.includes(session.service)
    ? "Prices shown are before tax. Final pricing depend on hair's condition and is confirmed in person. We'd recommend booking a consultation for the most accurate pricing."
    : "Prices shown are before tax. Final pricing depend on hair's condition and is confirmed in person.";
  const allNotes = [note, ...reminders].join('\n\n');

  let botMsg;
  if (isUpdate) {
    const treatmentNames = { milbon: 'Milbon Repair', tokio: 'Tokio Inkarami', purifica: 'Purifica Pro' };
    botMsg = `Here's your updated total with ${treatmentNames[session.treatmentAddon]} included:`;
  } else if (warnings.length) {
    botMsg = "Your estimate is based on the information you've shared. If your hair requires additional treatments or a modified service to maintain its health and integrity, your stylist will discuss any changes with you before proceeding.";
  } else {
    botMsg = "Let's walk you through how your situation is priced. No surprises!\nHere's your estimate:";
  }

  showTyping(typing).then(() => {
    if (!isUpdate) {
      currentStepId = 'quote_result';
      updateSubtitle('quote_result');
    }
    const bubble = appendBotBubble(botMsg);
    appendEstimateCard(tags, rows, allNotes);
    scrollThread(bubble);
    setTimeout(afterTray, isUpdate ? 700 : 400);
  });
}

// ─── Booking change selector ──────────────────────────────────────────────────
function renderBookingChangeTray() {
  showTyping(400).then(() => {
    const bubble = appendBotBubble("Please select what you'd like to change:");
    scrollThread(bubble);
    clearTray();

    const grid = document.createElement('div');
    grid.className = 'tray-service-select-grid';

    const options = [
      { label: 'Service Type',    step: 'booking_service' },
      { label: 'Stylist',         step: 'booking_start'   },
      { label: 'Date & Time',     step: 'booking_confirm' },
      { label: 'Contact Details', step: 'booking_details' },
    ];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'label-btn label-btn--default';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        appendUserBubble(opt.label);
        clearTray();
        session.bookingEditMode = true;
        showTyping(400).then(() => {
          appendBotBubble("Let's update your appointment.");
          setTimeout(() => renderStep(opt.step), 350);
        });
      });
      grid.appendChild(btn);
    });
    tray.appendChild(grid);

    const callMeta = document.createElement('button');
    callMeta.className = 'meta-text meta-text--caption';
    callMeta.textContent = 'Something else? Call Us';
    callMeta.addEventListener('click', () => {
      appendUserBubble('Call Us');
      clearTray();
      setTimeout(() => renderStep('call_us'), 350);
    });
    tray.appendChild(callMeta);
  });
}

// ─── Generic error state ──────────────────────────────────────────────────────
function showError() {
  showTyping(400).then(() => {
    const bubble = appendBotBubble("We are unable to process your request at this time. Please try again or reach out to us directly.");
    scrollThread(bubble);
    clearTray();
    const divider = document.createElement('div');
    divider.className = 'chat-tray__divider';
    tray.appendChild(divider);
    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn-component btn-component--primary';
    menuBtn.textContent = 'Back to Main Menu';
    menuBtn.addEventListener('click', () => {
      appendUserBubble('Back to Main Menu');
      clearTray();
      setTimeout(() => renderStep('main_menu'), 350);
    });
    const contactBtn = document.createElement('button');
    contactBtn.className = 'btn-component btn-component--primary';
    contactBtn.textContent = 'Contact Us';
    contactBtn.addEventListener('click', () => {
      appendUserBubble('Contact Us');
      clearTray();
      setTimeout(() => renderStep('call_us'), 350);
    });
    tray.appendChild(menuBtn);
    tray.appendChild(contactBtn);
  });
}

// Tray for consultation-required outcome
function renderConsultTray() {
  clearTray();
  const divider = document.createElement('div');
  divider.className = 'chat-tray__divider';
  tray.appendChild(divider);

  const bookBtn = document.createElement('button');
  bookBtn.className = 'btn-component btn-component--primary';
  bookBtn.textContent = 'Continue to Booking';
  bookBtn.addEventListener('click', () => {
    appendUserBubble('Book a Consultation');
    clearTray();
    setTimeout(() => renderStep('booking_start'), 350);
  });
  tray.appendChild(bookBtn);

  const contactBtn = document.createElement('button');
  contactBtn.className = 'btn-component btn-component--primary';
  contactBtn.textContent = 'Contact Us';
  contactBtn.addEventListener('click', () => {
    appendUserBubble('Contact Us');
    clearTray();
    setTimeout(() => renderStep('call_us'), 350);
  });
  tray.appendChild(contactBtn);

  const back = document.createElement('button');
  back.className = 'meta-text meta-text--body';
  back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
  back.addEventListener('click', () => {
    appendUserBubble('Main Menu');
    clearTray();
    setTimeout(() => renderStep('main_menu'), 300);
  });
  tray.appendChild(back);
}

// ─── Cut — show tiered price for selected cut service ─────────────────────────
function buildAndShowCutPrices() {
  const CUT_PRICES = {
    'wash-cut-blowdry': { label: 'Wash + Cut + Blowdry', rows: [{ label: 'Refined', price: `$${PRICING.cut.washCutBlowdry.refined}↑` }, { label: 'Premier', price: `$${PRICING.cut.washCutBlowdry.premier}↑` }] },
    'cut-only':         { label: 'Cut Only',             rows: [{ label: 'Refined', price: `$${PRICING.cut.cutOnly.refined}↑` }, { label: 'Premier', price: `$${PRICING.cut.cutOnly.premier}↑` }] },
    'wash-style':       { label: 'Wash + Style',         rows: [{ label: 'All Tiers', price: `$${PRICING.cut.washStyle.refined}↑` }] },
    'wash-only':        { label: 'Wash Only',            rows: [{ label: 'All Tiers', price: `$${PRICING.cut.washOnly}` }] },
    'fringe-trim':      { label: 'Fringe Trim',          rows: [{ label: 'Refined', price: `$${PRICING.cut.fringeTrim.refined}↑` }, { label: 'Premier', price: `$${PRICING.cut.fringeTrim.premier}↑` }] }
  };

  const entry = CUT_PRICES[session.cutType];
  if (!entry) return;

  showTyping(600).then(() => {
    currentStepId = 'quote_result';
    updateSubtitle('quote_result');
    const bubble = appendBotBubble(`Here's the pricing for ${entry.label}:`);
    appendEstimateCard(
      ['Cut', entry.label],
      entry.rows,
      "Prices shown are before tax. Final pricing depend on hair's condition and is confirmed in person."
    );
    scrollThread(bubble);
    setTimeout(renderCutTray, 400);
  });
}

function renderCutTray() {
  clearTray();
  const divider = document.createElement('div');
  divider.className = 'chat-tray__divider';
  tray.appendChild(divider);

  const bookBtn = document.createElement('button');
  bookBtn.className = 'btn-component btn-component--primary';
  bookBtn.textContent = 'Continue to Booking';
  bookBtn.addEventListener('click', () => {
    appendUserBubble('Book a Cut');
    clearTray();
    setTimeout(() => renderStep('booking_start'), 350);
  });
  tray.appendChild(bookBtn);

  const back = document.createElement('button');
  back.className = 'meta-text meta-text--body';
  back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
  back.addEventListener('click', () => {
    appendUserBubble('Main Menu');
    clearTray();
    setTimeout(() => renderStep('main_menu'), 300);
  });
  tray.appendChild(back);
}

// ─── Treatment (hair care) — show all treatment options at chosen length ───────
function buildAndShowTreatmentPrices() {
  const l = session.hairLength;
  const p = PRICING.treatmentStandalone;
  const { reminders } = computeEstimate(session);

  showTyping(600).then(() => {
    currentStepId = 'quote_result';
    updateSubtitle('quote_result');

    let botMsg = "Here are our standalone treatment prices for your hair length:";
    if (reminders.length) botMsg += `\n\n💡 ${reminders[0]}`;

    const bubble = appendBotBubble(botMsg);
    appendEstimateCard(
      ['Hair Treatment', l],
      [
        { label: 'KT Kerasilk',     price: `$${p.ktKerasilk[l] ?? '—'}` },
        { label: 'Tokio Inkarami',  price: `$${p.tokio[l] ?? '—'}` },
        { label: 'Purifica Pro',    price: `$${p.purifica[l] ?? '—'}` },
        { label: 'Milbon Spectrum', price: `$${p.milbonSpectrum[l] ?? '—'}` },
        { label: 'Milbon Repair',   price: `$${p.milbonRepair[l] ?? '—'}` }
      ],
      "Prices shown are before tax. Final pricing depend on hair's condition and is confirmed in person."
    );
    scrollThread(bubble);
    setTimeout(renderTreatmentTray, 400);
  });
}

function renderTreatmentTray() {
  clearTray();
  const divider = document.createElement('div');
  divider.className = 'chat-tray__divider';
  tray.appendChild(divider);

  const bookBtn = document.createElement('button');
  bookBtn.className = 'btn-component btn-component--primary';
  bookBtn.textContent = 'Continue to Booking';
  bookBtn.addEventListener('click', () => {
    appendUserBubble('Book a Treatment');
    clearTray();
    setTimeout(() => renderStep('booking_start'), 350);
  });
  tray.appendChild(bookBtn);

  const back = document.createElement('button');
  back.className = 'meta-text meta-text--body';
  back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
  back.addEventListener('click', () => {
    appendUserBubble('Main Menu');
    clearTray();
    setTimeout(() => renderStep('main_menu'), 300);
  });
  tray.appendChild(back);
}

// ─── Scalp care — flat prices, no quiz needed ─────────────────────────────────
function buildAndShowScalpPrices() {
  showTyping(500).then(() => {
    currentStepId = 'quote_result';
    updateSubtitle('quote_result');
    const bubble = appendBotBubble("Here are our scalp care prices:");
    appendEstimateCard(
      ['Scalp Care'],
      [
        { label: 'Scalp Exfoliation',    price: `$${PRICING.scalp.exfoliation}` },
        { label: 'Scalp SPA',            price: `$${PRICING.scalp.spa}` },
        { label: 'RICA Light Treatment', price: `$${PRICING.scalp.rica}` }
      ],
      "Prices shown are before tax. Final pricing depend on hair's condition and is confirmed in person."
    );
    scrollThread(bubble);
    setTimeout(renderTreatmentTray, 400);
  });
}

// Post-estimate tray — same layout for all estimate paths (normal, bleach-required, special condition)
function renderPostEstimateTray() {
  clearTray();

  const divider = document.createElement('div');
  divider.className = 'chat-tray__divider';
  tray.appendChild(divider);

  const continueBtn = document.createElement('button');
  continueBtn.className = 'btn-component btn-component--primary';
  continueBtn.textContent = 'Continue to Booking';
  continueBtn.addEventListener('click', () => {
    appendUserBubble('Continue to Booking');
    clearTray();
    setTimeout(() => renderStep('booking_start'), 350);
  });
  tray.appendChild(continueBtn);

  const treatBtn = document.createElement('button');
  treatBtn.className = 'label-btn label-btn--default';
  treatBtn.textContent = 'Add a Treatment';
  treatBtn.addEventListener('click', () => {
    appendUserBubble('Add a Treatment');
    clearTray();
    setTimeout(showTreatmentFlow, 350);
  });
  tray.appendChild(treatBtn);

  const back = document.createElement('button');
  back.className = 'meta-text meta-text--body';
  back.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px"><img src="images/icons/ArrowLeft.svg" width="12" height="12" alt="" style="filter:brightness(0) saturate(100%) invert(52%) sepia(6%) saturate(524%) hue-rotate(13deg) brightness(96%) contrast(85%);flex-shrink:0"><span>Back to Main Menu</span></span>';
  back.addEventListener('click', () => {
    appendUserBubble('Main Menu');
    clearTray();
    setTimeout(() => renderStep('main_menu'), 300);
  });
  tray.appendChild(back);
}

function buildCalendarCard(onDateSelect) {
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();

  const card = document.createElement('div');
  card.className = 'calendar-card';

  function render() {
    card.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'calendar-card__header';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'cal-nav-btn';
    prevBtn.innerHTML = '<img src="images/icons/CaretLeft.svg" width="20" height="20" alt="Previous">';
    prevBtn.addEventListener('click', () => {
      viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
    });

    const monthLabel = document.createElement('div');
    monthLabel.className = 'calendar-card__month';
    monthLabel.textContent = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'cal-nav-btn';
    nextBtn.innerHTML = '<img src="images/icons/CaretRight.svg" width="20" height="20" alt="Next">';
    nextBtn.addEventListener('click', () => {
      viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      render();
    });

    header.appendChild(prevBtn);
    header.appendChild(monthLabel);
    header.appendChild(nextBtn);
    card.appendChild(header);

    card.appendChild(Object.assign(document.createElement('div'), { className: 'calendar-card__divider' }));

    // Weekday labels
    const weekdays = document.createElement('div');
    weekdays.className = 'calendar-card__weekdays';
    ['S','M','T','W','T','F','S'].forEach(d => {
      const wd = document.createElement('div');
      wd.className = 'calendar-card__weekday';
      wd.textContent = d;
      weekdays.appendChild(wd);
    });
    card.appendChild(weekdays);

    // Date grid
    const grid = document.createElement('div');
    grid.className = 'calendar-card__grid';

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    let cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    for (let w = 0; w < cells.length / 7; w++) {
      const week = document.createElement('div');
      week.className = 'calendar-card__week';
      for (let d = 0; d < 7; d++) {
        const day = cells[w * 7 + d];
        const cell = document.createElement('button');
        cell.className = 'day-cell';
        if (!day) {
          cell.classList.add('day-cell--empty');
        } else {
          const cellDate = new Date(viewYear, viewMonth, day);
          const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (isPast) {
            cell.classList.add('day-cell--unavailable');
          } else if (
            card._selected &&
            card._selected.getFullYear() === viewYear &&
            card._selected.getMonth() === viewMonth &&
            card._selected.getDate() === day
          ) {
            cell.classList.add('day-cell--selected');
          } else if (
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear()
          ) {
            cell.classList.add('day-cell--today');
          } else {
            cell.classList.add('day-cell--default');
          }
          cell.textContent = day;
          cell.addEventListener('click', () => {
            card._selected = new Date(viewYear, viewMonth, day);
            onDateSelect(card._selected);
            render();
          });
        }
        week.appendChild(cell);
      }
      grid.appendChild(week);
    }
    card.appendChild(grid);
  }

  render();
  return card;
}

function renderPostTreatmentTray() {
  clearTray();

  const divider = document.createElement('div');
  divider.className = 'chat-tray__divider';
  tray.appendChild(divider);

  const continueBtn = document.createElement('button');
  continueBtn.className = 'btn-component btn-component--primary';
  continueBtn.textContent = 'Continue to Booking';
  continueBtn.addEventListener('click', () => {
    appendUserBubble('Continue to Booking');
    clearTray();
    setTimeout(() => renderStep('booking_start'), 350);
  });
  tray.appendChild(continueBtn);

  const backBtn = document.createElement('button');
  backBtn.className = 'label-btn label-btn--default';
  backBtn.textContent = 'Back to Main Menu';
  backBtn.addEventListener('click', () => {
    appendUserBubble('Main Menu');
    clearTray();
    setTimeout(() => renderStep('main_menu'), 300);
  });
  tray.appendChild(backBtn);

  const callUs = document.createElement('button');
  callUs.className = 'meta-text meta-text--caption';
  callUs.textContent = 'Something else? Call Us';
  callUs.addEventListener('click', () => {
    appendUserBubble('Something else? Call Us');
    clearTray();
    setTimeout(() => renderStep('call_us'), 300);
  });
  tray.appendChild(callUs);
}

// Treatment flow — cards rendered in thread, not tray buttons
function showTreatmentFlow() {
  const { hairLength: l } = session;
  const p = PRICING.colorTreatmentAddons;

  const treatments = [
    { id: 'milbon',   name: 'Milbon Repair',   bundle: 'Bundle: Milbon Color Package',       desc: 'Protein restoration · shine + frizz',        price: p.milbon[l]   },
    { id: 'tokio',    name: 'Tokio Inkarami',  bundle: 'Bundle: Tokio Inkarami Color Package', desc: 'Bond repair · fine/damaged hair',            price: p.tokio[l]    },
    { id: 'purifica', name: 'Purifica Pro',    bundle: 'Bundle: Purifica Pro Color Package',   desc: 'Coarse/curly/heat-damaged repair',           price: p.purifica[l] }
  ];

  showTyping(600).then(() => {
    const bubble = appendBotBubble("Adding a treatment combines your color service into a bundle, with a discount applied to the treatment:");
    scrollThread(bubble);

    clearTray();

    const divider = document.createElement('div');
    divider.className = 'chat-tray__divider';
    tray.appendChild(divider);

    for (const t of treatments) {
      const card = document.createElement('div');
      card.className = 'addon-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="addon-card__top">
          <div class="addon-card__header">
            <span class="addon-card__name">${t.name}</span>
            <div class="addon-card__price-group">
              <img class="addon-card__plus" src="images/icons/Plus.svg" alt="+" width="16" height="16">
              <span class="addon-card__price">$${t.price}</span>
            </div>
          </div>
          <div class="addon-card__bundle">${t.bundle}</div>
        </div>
        <div class="addon-card__tags">${t.desc}</div>
      `;
      card.addEventListener('click', () => {
        session.treatmentAddon = t.id;
        appendUserBubble(t.name);
        clearTray();
        buildAndShowEstimate({ typing: 600, afterTray: renderPostTreatmentTray, isUpdate: true });
      });
      tray.appendChild(card);
    }

    const decideLater = document.createElement('button');
    decideLater.className = 'meta-text meta-text--caption';
    decideLater.textContent = 'Decide Later Instead';
    decideLater.addEventListener('click', () => {
      appendUserBubble('Decide later');
      clearTray();
      setTimeout(renderPostTreatmentTray, 350);
    });
    tray.appendChild(decideLater);
  });
}

// ─── Running total builder ────────────────────────────────────────────────────

