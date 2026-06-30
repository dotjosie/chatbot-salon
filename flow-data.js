// ─────────────────────────────────────────────────────────────────────────────
// flow-data.js — All copy, pricing, and step definitions
// Edit this file to update dialogue, prices, or options without touching logic.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Pricing Matrix ───────────────────────────────────────────────────────────

const PRICING = {

  color: {
    // Full single-process color (corrected v2 pricing)
    fullColor: {
      refined: { XS: 100, S: 120, M: 140, L: 160, XL: 180 },
      premier: { XS: 130, S: 150, M: 170, L: 190, XL: 210 }
    },
    // Balayage / hand-painted highlights (Premier = Refined + $30)
    balayage: {
      refined: { XS: 200, S: 230, M: 265, L: 300, XL: 360 },
      premier: { XS: 230, S: 260, M: 295, L: 330, XL: 390 }
    },
    // No-bleach color rinse — single tier
    nobleachRinse: { XS: 140, S: 150, M: 160, L: 170, XL: 180 },
    // Bleach / Decolor — same price both tiers
    bleach: { XS: 120, S: 120, M: 140, L: 140, XL: 140 },
    // Flat-rate services
    rootTouchup:       90,
    rootBleachTouchup: 140,
    toner: { XS: 50, S: 55, M: 60, L: 65, XL: 70 }
  },

  // Color + treatment bundle add-ons (price on top of color, already discounted)
  colorTreatmentAddons: {
    milbon:   { XS: 40, S: 40, M: 50,  L: 60,  XL: 70  },
    tokio:    { XS: 70, S: 70, M: 100, L: 110, XL: 120 },
    purifica: { XS: 70, S: 80, M: 100, L: 110, XL: 120 }
  },

  cut: {
    washCutBlowdry: { refined: 110, premier: 150 },
    cutOnly:        { refined: 85,  premier: 120 },
    washStyle:      { refined: 85,  premier: 85  },
    washOnly:       30,
    fringeTrim:     { refined: 20,  premier: 30  }
  },

  perm: {
    basic:   {
      refined: { XS: 190, S: 200, M: 220, L: 250, XL: 280 },
      premier: { XS: 210, S: 230, M: 250, L: 300, XL: 330 }
    },
    digital: {
      refined: { XS: 250, S: 265, M: 295, L: 330, XL: 370 },
      premier: { XS: 280, S: 295, M: 310, L: 380, XL: 400 }
    },
    straight: { XS: 190, S: 200, M: 220, L: 250, XL: 280 } // single tier
  },

  permTreatmentAddons: {
    milbon:   { XS: 40, S: 40, M: 50,  L: 60,  XL: 70  },
    tokio:    { XS: 70, S: 70, M: 100, L: 110, XL: 120 },
    purifica: { XS: 70, S: 80, M: 100, L: 110, XL: 120 }
  },

  treatmentStandalone: {
    ktKerasilk:     { S: 100, M: 115, L: 130, XL: 155 },
    tokio:          { S: 90,  M: 100, L: 110, XL: 115 },
    purifica:       { S: 85,  M: 95,  L: 110, XL: 120 },
    milbonSpectrum: { S: 75,  M: 82,  L: 90,  XL: 100 },
    milbonRepair:   { S: 38,  M: 45,  L: 52,  XL: 63  }
  },

  scalp: {
    exfoliation: 80,
    spa:         55,
    rica:        15
  }
};

// Natural hair colors that require bleach before balayage/highlights
// for accurate color payoff (anything darker than dark blonde)
const DARK_HAIR_VALUES = ['light-brown', 'medium-brown', 'dark-brown', 'black'];

// ─── Pricing Rules ────────────────────────────────────────────────────────────
// Each rule declares when it applies (match) and what it contributes (price).
// ─── Style Discovery Quiz data ────────────────────────────────────────────────

const SDQ_SERVICES = {
  cut:           { label: 'Cut',            maintenance: 'Low',  requiresColor: false, requiresCurlPerm: false, requiresStraightPerm: false },
  curl_perm:     { label: 'Curl Perm',      maintenance: 'Mid',  requiresColor: false, requiresCurlPerm: true,  requiresStraightPerm: false },
  straight_perm: { label: 'Straight Perm',  maintenance: 'Low',  requiresColor: false, requiresCurlPerm: false, requiresStraightPerm: true  },
  full_color:    { label: 'Full Color',     maintenance: 'High', requiresColor: true,  requiresCurlPerm: false, requiresStraightPerm: false },
  partial_color: { label: 'Partial Color',  maintenance: 'Mid',  requiresColor: true,  requiresCurlPerm: false, requiresStraightPerm: false },
  treatment:     { label: 'Treatment',      maintenance: 'N/A',  requiresColor: false, requiresCurlPerm: false, requiresStraightPerm: false },
};

// Parse free-text perm openness → { curlOpen, straightOpen } — null means defer to button
function parseChemicalOpenness(raw) {
  const STRAIGHT_TERMS = /\b(straight perm|straightening|straighten|rebond|relax)\b/i;
  const CURL_TERMS     = /\b(curl perm|curly perm|curl|wavy|wave|beach waves?)\b/i;
  const NEG            = /\b(not|no|don'?t want|avoid|skip)\b/i;

  // negStraight: negation word within 30 chars BEFORE a straight term
  const negStraight = NEG.test(raw)
    && !!raw.match(/\b(not|no|don'?t want|avoid|skip)\b.{0,30}\b(straight perm|straightening|straighten|rebond|relax)\b/i);

  // negCurl: negation word within 30 chars before "perm/curl/wave" — but "straight" not between them
  const negCurlM = raw.match(/\b(not|no|don'?t want|avoid|skip)\b(.{0,30})\b(perm|curl|wave|wavy)\b/i);
  const negCurl  = negCurlM ? !/straight/i.test(negCurlM[2]) : false;

  // hasStraight: explicit straight term present and not negated
  const hasStraight = STRAIGHT_TERMS.test(raw) && !negStraight;

  // hasCurl: curl term OR standalone "perm" (not preceded by "straight"), not negated
  const hasCurl = (CURL_TERMS.test(raw) || /(?<!straight\s)\bperm\b/i.test(raw)) && !negCurl;

  return {
    curlOpen:     negCurl ? 'no' : hasCurl ? 'yes' : null,
    straightOpen: negStraight ? 'no' : hasStraight ? 'yes' : null,
  };
}

// Score per keyword per service: 2=Yes, 1=Maybe, 0=No
const SDQ_KEYWORD_MAP = {
  soft:      { cut: 1, curl_perm: 2, straight_perm: 0, full_color: 0, partial_color: 1, treatment: 2 },
  sharp:     { cut: 2, curl_perm: 0, straight_perm: 2, full_color: 0, partial_color: 0, treatment: 0 },
  sweet:     { cut: 1, curl_perm: 2, straight_perm: 0, full_color: 2, partial_color: 2, treatment: 0 },
  handsome:  { cut: 2, curl_perm: 0, straight_perm: 1, full_color: 2, partial_color: 1, treatment: 0 },
  colorful:  { cut: 0, curl_perm: 0, straight_perm: 0, full_color: 2, partial_color: 2, treatment: 0 },
  elegant:   { cut: 1, curl_perm: 1, straight_perm: 2, full_color: 1, partial_color: 2, treatment: 2 },
  bright:    { cut: 1, curl_perm: 0, straight_perm: 0, full_color: 2, partial_color: 2, treatment: 1 },
  bouncy:    { cut: 0, curl_perm: 2, straight_perm: 0, full_color: 0, partial_color: 0, treatment: 2 },
  volume:    { cut: 2, curl_perm: 2, straight_perm: 0, full_color: 0, partial_color: 0, treatment: 0 },
  sleek:     { cut: 1, curl_perm: 0, straight_perm: 2, full_color: 0, partial_color: 0, treatment: 2 },
  simple:    { cut: 2, curl_perm: 0, straight_perm: 1, full_color: 0, partial_color: 1, treatment: 1 },
  natural:   { cut: 2, curl_perm: 2, straight_perm: 2, full_color: 1, partial_color: 2, treatment: 2 },
  bold:      { cut: 2, curl_perm: 0, straight_perm: 0, full_color: 2, partial_color: 1, treatment: 0 },
  dramatic:  { cut: 2, curl_perm: 2, straight_perm: 0, full_color: 0, partial_color: 1, treatment: 1 },
};

// Maps free-typed words/phrases → SDQ_KEYWORD_MAP keys
// Checked in order; first match wins per word.
const SDQ_TEXT_SYNONYMS = {
  soft:      ['gentle', 'subtle', 'delicate', 'airy', 'feminine', 'romantic', 'soft'],
  bouncy:    ['bouncy', 'flowy', 'fluffy', 'springy', 'lively', 'bounce'],
  volume:    ['voluminous', 'volume', 'big hair', 'thick', 'full hair', 'poofy', 'puffy'],
  sleek:     ['sleek', 'straight', 'smooth', 'flat', 'glossy', 'silky'],
  sharp:     ['sharp', 'clean', 'precise', 'structured', 'edgy', 'angular', 'defined', 'crisp', 'tailored'],
  bold:      ['bold', 'statement', 'striking', 'fierce', 'strong'],
  dramatic:  ['dramatic', 'intense', 'daring', 'editorial', 'avant-garde', 'dark aesthetic'],
  elegant:   ['elegant', 'chic', 'graceful', 'luxe', 'luxurious', 'glam', 'glamorous', 'classy', 'timeless', 'polished'],
  bright:    ['bright hair', 'bright color', 'radiant', 'glowing hair', 'light hair', 'golden', 'blonde look'],
  colorful:  ['colorful', 'vibrant', 'vivid', 'rainbow', 'multicolor', 'fun color'],
  sweet:     ['sweet', 'cute', 'pretty', 'girly', 'adorable', 'playful'],
  handsome:  ['handsome', 'classic', 'sophisticated', 'refined', 'groomed', 'masculine'],
  natural:   ['natural', 'effortless', 'relaxed', 'easy', 'low-key', 'understated'],
  simple:    ['simple', 'minimal', 'minimalist', 'fuss-free', 'easy look'],
};

// Returns array of matching SDQ keyword map keys from free-typed text
function matchSDQText(raw) {
  const t = raw.toLowerCase();
  const matched = new Set();
  for (const [key, terms] of Object.entries(SDQ_TEXT_SYNONYMS)) {
    if (terms.some(term => t.includes(term))) matched.add(key);
  }
  return [...matched];
}

// Rules with tiered:true produce separate Refined/Premier totals.
// Rules without tiered produce a flat modifier added to both tiers.
// Rules with warning contribute a caution message, not a price.
// computeEstimate() in chatbot.js evaluates all matching rules to build the card.

const PRICING_RULES = [

  // ══ COLOR — base service prices ════════════════════════════════════════════
  {
    id: 'full-color-base',
    label: 'Full Color',
    tiered: true,
    match: s => s.service === 'color' && s.colorType === 'full-color',
    price: s => ({ refined: PRICING.color.fullColor.refined[s.hairLength], premier: PRICING.color.fullColor.premier[s.hairLength] })
  },
  {
    id: 'balayage-base',
    label: 'Balayage',
    tiered: true,
    match: s => s.service === 'color' && s.colorType === 'balayage',
    price: s => ({ refined: PRICING.color.balayage.refined[s.hairLength], premier: PRICING.color.balayage.premier[s.hairLength] })
  },
  // Any natural color above light-blonde requires bleach for color services
  {
    id: 'bleach-required-color',
    label: 'Bleach / Decolor',
    tiered: false,
    match: s => s.service === 'color' && ['dark-blonde', 'light-brown', 'medium-brown', 'dark-brown', 'black'].includes(s.naturalColor),
    price: s => ({ flat: PRICING.color.bleach[s.hairLength] })
  },
  // Color treatment add-ons (post-estimate upsell)
  {
    id: 'treatment-milbon',
    label: 'Milbon Repair',
    tiered: false,
    match: s => s.treatmentAddon === 'milbon',
    price: s => ({ flat: PRICING.colorTreatmentAddons.milbon[s.hairLength] })
  },
  {
    id: 'treatment-tokio',
    label: 'Tokio Inkarami',
    tiered: false,
    match: s => s.treatmentAddon === 'tokio',
    price: s => ({ flat: PRICING.colorTreatmentAddons.tokio[s.hairLength] })
  },
  {
    id: 'treatment-purifica',
    label: 'Purifica Pro',
    tiered: false,
    match: s => s.treatmentAddon === 'purifica',
    price: s => ({ flat: PRICING.colorTreatmentAddons.purifica[s.hairLength] })
  },

  // ══ PERM — base service prices ═════════════════════════════════════════════
  {
    id: 'curl-perm-base',
    label: 'Curl Perm',
    tiered: true,
    match: s => s.service === 'perm' && s.permType === 'curl',
    price: s => ({ refined: PRICING.perm.basic.refined[s.hairLength], premier: PRICING.perm.basic.premier[s.hairLength] })
  },
  {
    id: 'straight-perm-base',
    label: 'Straight Perm',
    tiered: false,
    match: s => s.service === 'perm' && s.permType === 'straight',
    price: s => ({ flat: PRICING.perm.straight[s.hairLength] })
  },

  // ══ BLEACH — base service prices ═══════════════════════════════════════════
  {
    id: 'bleach-full-partial-base',
    label: 'Full / Partial Bleach',
    tiered: false,
    match: s => s.service === 'bleach' && s.bleachType === 'full-partial',
    price: s => ({ flat: PRICING.color.bleach[s.hairLength] })
  },
  {
    id: 'bleach-root-touchup-base',
    label: 'Root Touch-Up',
    tiered: false,
    match: s => s.service === 'bleach' && s.bleachType === 'root-touchup',
    price: () => ({ flat: PRICING.color.rootTouchup })
  },

  // ══ WARNINGS — chemical history ════════════════════════════════════════════
  // Perm or chemical treatment within 3 weeks → warn any service
  {
    id: 'warn-perm-recent',
    match: s => s.permTiming === 'under-3w',
    warning: "Your hair was recently permed or chemically treated. Applying another chemical service this soon may cause damage — your stylist will assess on the day."
  },
  // Perm 3 weeks–6 months ago and getting another perm → reminder
  {
    id: 'remind-perm-2-6m',
    match: s => s.service === 'perm' && s.permTiming === '3w-6m',
    reminder: "Your perm was done between 3 weeks and 6 months ago. Your hair may still be settling — your stylist will check condition before proceeding."
  },
  // Bleach within last year + color service → warn
  {
    id: 'warn-bleach-recent-color',
    match: s => s.service === 'color' && (s.bleachTiming === 'under-3w' || s.bleachTiming === '3w-1y'),
    warning: "Your hair was bleached within the last year, which can affect how color takes. Our stylist will check hair integrity before starting."
  },
  // Bleach within 3 weeks + perm → serious warning
  {
    id: 'warn-bleach-recent-perm',
    match: s => s.service === 'perm' && s.bleachTiming === 'under-3w',
    warning: "Your hair was bleached very recently. Perming so soon after bleaching poses a high breakage risk — a consultation is strongly recommended first."
  },
  // At-home dye + bleach service → warn
  {
    id: 'warn-home-dye-bleach',
    match: s => s.service === 'bleach' && s.hasBoxDye,
    warning: "At-home dye can react unpredictably with bleach. A patch test or in-person consultation is strongly recommended before your appointment."
  },
  // At-home dye recently + colored darker + perm → fade warning
  {
    id: 'warn-home-dye-perm-fade',
    match: s => s.service === 'perm' && s.hasBoxDye && s.dyedDarkerRecently,
    warning: "Hot perms involve heat which can cause darker at-home color to fade. We'll factor this in, but results may vary."
  },
  // Hair is colored + treatment → remind about heat/rinse color loss
  {
    id: 'remind-treatment-colored',
    match: s => s.service === 'treatment' && s.treatmentColored,
    reminder: "Some treatments use heat and rinsing, which may cause minor color loss. Your stylist will recommend the safest treatment for your hair."
  },

  // ══ CONSULTATION REQUIRED — overrides estimate display ═════════════════════
  // At-home dye + darker coloring + color service → no estimate, consult only
  {
    id: 'consult-box-dye-darker',
    match: s => s.service === 'color' && s.hasBoxDye && s.dyedDarkerRecently,
    consultRequired: true
  }
];

const NATURAL_COLOR_LABELS = {
  'light-blonde':       'light-blonde',
  'dark-blonde':  'dark blonde',
  'light-brown':  'light brown',
  'medium-brown': 'medium brown',
  'dark-brown':   'dark brown',
  'black':        'black'
};

// ─── Step Definitions ─────────────────────────────────────────────────────────
// botMessage: string | function(session) → string
// options:    array | function(session) → array
// Each option: { label, value, style: 'choice' | 'neutral' }

// ─── Shared add-on cards (Curl Perm + Straight Perm) ──────────────────────────
const PERM_ADDON_CARDS = [
  {
    category: 'Milbon Q',
    rows: [
      { size: 'XS', price: '+$40' }, { size: 'S', price: '+$40' },
      { size: 'M',  price: '+$50' }, { size: 'L', price: '+$60' },
      { size: 'XL', price: '+$70' }
    ]
  },
  {
    category: 'Tokio Inkarami',
    rows: [
      { size: 'XS', price: '+$40' }, { size: 'S', price: '+$40' },
      { size: 'M',  price: '+$50' }, { size: 'L', price: '+$60' },
      { size: 'XL', price: '+$70' }
    ]
  },
  {
    category: 'Purifica Pro',
    rows: [
      { size: 'XS', price: '+$40' }, { size: 'S', price: '+$40' },
      { size: 'M',  price: '+$50' }, { size: 'L', price: '+$60' },
      { size: 'XL', price: '+$70' }
    ]
  }
];

const STEPS = {

  greeting: {
    botMessage: [
      "Hi, we're Rosan Hair!\nNavigate this chatbot to discover our salon, uncover pricing and find the right service to suit your needs.",
      "To start things off, have you visited us before?"
    ],
    layout: 'row',
    options: [
      { label: "First Time",       value: 'new',       style: 'choice' },
      { label: "I've been before", value: 'returning',  style: 'choice' }
    ]
  },

  re_engagement: {
    botMessage: "Welcome back! Want to pick up where you left off?",
    layout: 're-engagement',
  },

  returning_lookup: {
    botMessage: [
      "Welcome back! Ready to feel fresh again?",
      "Let's pull up your info. What's your name and phone number?"
    ],
    layout: 'contact-form',
    options: []
  },

  main_menu: {
    botMessage: (s) => {
      if (s.hasVisitedMainMenu) return "Let's find the right service for you:";
      if (s.isReturning) return `What can we help you with today${s.contactName ? ', ' + s.contactName.trim().split(' ')[0] : ''}?`;
      return [
        "Happy to meet you! We're a boutique salon located in downtown NY that is obsessed with luscious hair texture and making you feel confident.",
        "How can we help you today?"
      ];
    },
    layout: 'menu-grid',
    options: [
      { label: "Our Services",   value: 'service_list',         icon: 'service menu.svg'  },
      { label: "Stylists",       value: 'stylists',             icon: 'stylists.svg'       },
      { label: "About Us",       value: 'about',                icon: 'about.svg'          },
      { label: "Salon Products", value: 'products',             icon: 'salon products.svg' },
      { label: "Book with Us",   value: 'booking_start',        icon: 'Booking.svg'        },
      { label: "Contact Us",     value: 'call_us',              icon: 'contact.svg'        },
      { label: "Not sure? Try our style discovery quiz to figure out your needs!", userLabel: "Style Discovery Quiz", value: 'sdq_length', style: 'metatext' }
    ]
  },

  service_list: {
    botMessage: "Here's what we offer:\nTap any service for more details.",
    layout: 'service-list',
    services: [
      { label: "Cut",                   value: 'cut_services',      price: 'from $30'  },
      { label: "Color",                 value: 'color_services',    price: 'from $130' },
      { label: "Balayage / Highlights", value: 'balayage_services', price: 'from $200' },
      { label: "Curl Perm",              value: 'perm_services',          price: 'from $190' },
      { label: "Straight Perm",         value: 'straight_perm_services', price: 'from $190' },
      { label: "Treatment",             value: 'treatment_services',     price: 'from $38'  },
      { label: "Scalp",                 value: 'scalp_services',         price: 'from $15'  }
    ],
    options: [
      { label: "Back to Main Menu", value: 'main_menu', style: 'choice' }
    ]
  },

  cut_services: {
    layout: 'service-detail',
    sequence: [
      { type: 'message', text: 'Price can depend on length and stylist tier.' },
      { type: 'cards', cards: [
        {
          category: 'REFINED (Mid-level Stylists)',
          rows: [
            { size: 'Wash + Cut + Blowdry', price: '$110 UP' },
            { size: 'Cut only',             price: '$85 UP'  },
            { size: 'Wash + Style',         price: '$65 UP'  },
            { size: 'Wash Only',            price: '$30 UP'  },
            { size: 'Fringe Trim',          price: '$20 UP'  }
          ]
        },
        {
          category: 'PREMIER (Senior-level Stylists)',
          rows: [
            { size: 'Wash + Cut + Blowdry', price: '$150 UP' },
            { size: 'Cut only',             price: '$120 UP' },
            { size: 'Wash + Style',         price: '$85 UP'  },
            { size: 'Wash Only',            price: '$30 UP'  },
            { size: 'Fringe Trim',          price: '$30 UP'  }
          ]
        }
      ]},
      { type: 'metatext', label: 'View Hair Length Chart', image: 'hair-length-1.jpg' }
    ],
    options: [{ label: 'Back', value: 'service_list', style: 'choice' }]
  },

  color_services: {
    layout: 'service-detail',
    sequence: [
      { type: 'message', text: 'Price can depend on length and stylist tier.' },
      { type: 'message', text: 'Full Color:' },
      { type: 'cards', cards: [
        {
          category: 'REFINED (Mid-level Stylists)',
          rows: [
            { size: 'XS', price: '$130–150' },
            { size: 'S',  price: '$160–175' },
            { size: 'M',  price: '$200 UP'  },
            { size: 'L',  price: '$200 UP'  },
            { size: 'XL', price: '$200 UP'  }
          ]
        },
        {
          category: 'PREMIER (Senior-level Stylists)',
          rows: [
            { size: 'XS', price: '$160–180' },
            { size: 'S',  price: '$190–200' },
            { size: 'M',  price: '$250 UP'  },
            { size: 'L',  price: '$280 UP'  },
            { size: 'XL', price: '$300 UP'  }
          ]
        }
      ]},
      { type: 'message', text: 'Bleach / Decolor:' },
      { type: 'cards', cards: [
        {
          category: 'All Tiers:',
          rows: [
            { size: 'XS',     price: '$120 UP' },
            { size: 'M – XL', price: '$140 UP' }
          ]
        }
      ]},
      { type: 'message', text: 'Root Touch-Up:' },
      { type: 'cards', cards: [
        {
          sections: [
            { category: 'Up to 5cm - full head', rows: [{ size: 'All Lengths', price: '$140 UP' }] },
            { category: 'Returning Client',      rows: [{ size: 'All Lengths', price: '$90 UP'  }] }
          ]
        }
      ]},
      { type: 'message', text: 'Toner/Gloss Add On:' },
      { type: 'cards', cards: [
        {
          category: 'All Tiers:',
          rows: [
            { size: 'XS', price: '$50 UP' },
            { size: 'S',  price: '$55 UP' },
            { size: 'M',  price: '$60 UP' },
            { size: 'L',  price: '$65 UP' },
            { size: 'XL', price: '$70 UP' }
          ]
        }
      ]},
      { type: 'metatext', label: 'View Hair Length Chart', image: 'hair-length-2.jpg' }
    ],
    options: [{ label: 'Back', value: 'service_list', style: 'choice' }]
  },

  balayage_services: {
    layout: 'service-detail',
    sequence: [
      { type: 'message', text: 'Price can depend on length and stylist tier.' },
      { type: 'message', text: 'Balayage / Hand-painted Highlights:' },
      { type: 'cards', cards: [
        {
          category: 'REFINED (Mid-level Stylists)',
          rows: [
            { size: 'XS', price: '$200 UP' },
            { size: 'S',  price: '$230 UP' },
            { size: 'M',  price: '$265 UP' },
            { size: 'L',  price: '$300 UP' },
            { size: 'XL', price: '$360 UP' }
          ]
        },
        {
          category: 'PREMIER (Senior-level Stylists)',
          rows: [
            { size: 'XS', price: '$230 UP' },
            { size: 'S',  price: '$260 UP' },
            { size: 'M',  price: '$290 UP' },
            { size: 'L',  price: '$310 UP' },
            { size: 'XL', price: '$340 UP' }
          ]
        }
      ]},
      { type: 'message', text: 'No-Bleach Color Rinse:' },
      { type: 'cards', cards: [
        {
          category: 'All Tiers:',
          rows: [
            { size: 'XS', price: '$140 UP' },
            { size: 'S',  price: '$150 UP' },
            { size: 'M',  price: '$160 UP' },
            { size: 'L',  price: '$170 UP' },
            { size: 'XL', price: '$180 UP' }
          ]
        }
      ]},
      { type: 'metatext', label: 'View Hair Length Chart', image: 'hair-length-3.jpg' }
    ],
    options: [{ label: 'Back', value: 'service_list', style: 'choice' }]
  },

  perm_services: {
    layout: 'service-detail',
    sequence: [
      { type: 'message', text: 'Price can depend on length and stylist tier.' },
      { type: 'message', text: 'Basic Curl Perm (cold perm):' },
      { type: 'cards', cards: [
        {
          category: 'REFINED (Mid-level Stylists)',
          rows: [
            { size: 'XS', price: '$200 UP' }, { size: 'S', price: '$230 UP' },
            { size: 'M',  price: '$265 UP' }, { size: 'L', price: '$300 UP' },
            { size: 'XL', price: '$360 UP' }
          ]
        },
        {
          category: 'PREMIER (Senior-level Stylists)',
          rows: [
            { size: 'XS', price: '$230 UP' }, { size: 'S', price: '$260 UP' },
            { size: 'M',  price: '$290 UP' }, { size: 'L', price: '$310 UP' },
            { size: 'XL', price: '$340 UP' }
          ]
        }
      ]},
      { type: 'message', text: 'Digital Curl Perm (heat set):' },
      { type: 'cards', cards: [
        {
          category: 'REFINED (Mid-level Stylists)',
          rows: [
            { size: 'XS', price: '$250 UP' }, { size: 'S', price: '$265 UP' },
            { size: 'M',  price: '$295 UP' }, { size: 'L', price: '$330 UP' },
            { size: 'XL', price: '$370 UP' }
          ]
        },
        {
          category: 'PREMIER (Senior-level Stylists)',
          rows: [
            { size: 'XS', price: '$280 UP' }, { size: 'S', price: '$295 UP' },
            { size: 'M',  price: '$310 UP' }, { size: 'L', price: '$380 UP' },
            { size: 'XL', price: '$400 UP' }
          ]
        }
      ]},
      { type: 'message', text: 'Treatment Add-on:' },
      { type: 'cards', cards: PERM_ADDON_CARDS },
      { type: 'metatext', label: 'View Hair Length Chart', image: 'hair-length-1.jpg' }
    ],
    options: [{ label: 'Back', value: 'service_list', style: 'choice' }]
  },

  straight_perm_services: {
    layout: 'service-detail',
    sequence: [
      { type: 'message', text: 'Price can depend on length and stylist tier.' },
      { type: 'message', text: 'Straighten Perm:' },
      { type: 'cards', cards: [
        {
          category: 'All Tiers:',
          rows: [
            { size: 'XS', price: '$190 UP' }, { size: 'S', price: '$200 UP' },
            { size: 'M',  price: '$220 UP' }, { size: 'L', price: '$250 UP' },
            { size: 'XL', price: '$280 UP' }
          ]
        }
      ]},
      { type: 'message', text: 'Treatment Add-on:' },
      { type: 'cards', cards: PERM_ADDON_CARDS },
      { type: 'metatext', label: 'View Hair Length Chart', image: 'hair-length-2.jpg' }
    ],
    options: [{ label: 'Back', value: 'service_list', style: 'choice' }]
  },

  treatment_services: {
    layout: 'service-detail',
    sequence: [
      { type: 'message', text: 'Price can depend on length and stylist tier.' },
      { type: 'message', text: 'Standalone Hair Treatment Prices:' },
      { type: 'cards', cards: [
        {
          category: 'KT Kerasilk',
          rows: [
            { size: 'S',  price: '+$100' }, { size: 'M',  price: '+$115' },
            { size: 'L',  price: '+$130' }, { size: 'XL', price: '+$155' }
          ]
        },
        {
          category: 'Tokio Inkarami',
          rows: [
            { size: 'S',  price: '+$90'  }, { size: 'M',  price: '+$100' },
            { size: 'L',  price: '+$110' }, { size: 'XL', price: '+$115' }
          ]
        },
        {
          category: 'Purifica Pro',
          rows: [
            { size: 'S',  price: '+$85'  }, { size: 'M',  price: '+$95'  },
            { size: 'L',  price: '+$110' }, { size: 'XL', price: '+$120' }
          ]
        },
        {
          category: 'Milbon Spectrum',
          rows: [
            { size: 'S',  price: '+$75'  }, { size: 'M',  price: '+$82'  },
            { size: 'L',  price: '+$90'  }, { size: 'XL', price: '+$100' }
          ]
        },
        {
          category: 'Milbon Repair',
          rows: [
            { size: 'S',  price: '+$38'  }, { size: 'M',  price: '+$45'  },
            { size: 'L',  price: '+$52'  }, { size: 'XL', price: '+$63'  }
          ]
        }
      ]},
      { type: 'metatext', label: 'View Hair Length Chart', image: 'hair-length-3.jpg' }
    ],
    options: [{ label: 'Back', value: 'service_list', style: 'choice' }]
  },

  scalp_services: {
    layout: 'service-detail',
    sequence: [
      { type: 'message', text: 'Price can depend on length and stylist tier.' },
      { type: 'cards', cards: [
        {
          category: 'Scalp Exfoliation',
          rows: [
            { size: 'Refined', price: '$80 UP' },
            { size: 'Premier', price: '$80 UP' }
          ]
        },
        {
          category: 'Scalp SPA',
          rows: [
            { size: 'Refined', price: '$55 UP' },
            { size: 'Premier', price: '$55 UP' }
          ]
        },
        {
          category: 'RICA Light Treatment',
          rows: [
            { size: 'Refined', price: '$15 UP' },
            { size: 'Premier', price: '$15 UP' }
          ]
        }
      ]},
      { type: 'metatext', label: 'View Hair Length Chart', image: 'hair-length-4.jpg' }
    ],
    options: [{ label: 'Back', value: 'service_list', style: 'choice' }]
  },

  quote_service_select: {
    botMessage: "What are you interested in?",
    layout: 'service-select',
    options: [
      { label: "Cut",       value: 'cut',       style: 'choice' },
      { label: "Color",     value: 'color',     style: 'choice' },
      { label: "Perm",      value: 'perm',      style: 'choice' },
      { label: "Bleach",    value: 'bleach',    style: 'choice' },
      { label: "Treatment", value: 'treatment', style: 'choice' }
    ]
  },

  color_type: {
    botMessage: "What kind of color service are you thinking?",
    layout: 'service-select-cards',
    cards: [
      { title: 'Full Color',           desc: 'All-over color change',            image: 'img - full dyed hair.png', value: 'full-color' },
      { title: 'Balayage / Highlights', desc: 'Partial Coloring & Hand-Painted', image: 'img - highlights.png',     value: 'balayage' }
    ],
    options: [
      { label: 'Full Color',            value: 'full-color', style: 'choice' },
      { label: 'Balayage / Highlights', value: 'balayage',   style: 'choice' }
    ]
  },

  hair_length: {
    botMessage: "How long is your hair right now?",
    layout: 'length-chips',
    options: [
      { label: 'XS', userLabel: 'XS · above ear',       value: 'XS', style: 'choice' },
      { label: 'S',  userLabel: 'S · above shoulder',   value: 'S',  style: 'choice' },
      { label: 'M',  userLabel: 'M · below shoulder',   value: 'M',  style: 'choice' },
      { label: 'L',  userLabel: 'L · above chest',      value: 'L',  style: 'choice' },
      { label: 'XL', userLabel: 'XL · below chest',     value: 'XL', style: 'choice' }
    ]
  },

  natural_color: {
    botMessage: "What's your current hair color?",
    layout: 'color-swatches',
    swatches: [
      { label: 'Black',        value: 'black',        image: 'img - black hair.png' },
      { label: 'Dark Brown',   value: 'dark-brown',   image: 'img - dark brown hair.png' },
      { label: 'Medium Brown', value: 'medium-brown', image: 'img - medium brown hair.png' },
      { label: 'Light Brown',  value: 'light-brown',  image: 'img - light brown.png' },
      { label: 'Dark Blonde',  value: 'dark-blonde',  image: 'img - dark blonde.png' },
      { label: 'Light Blonde', value: 'light-blonde', image: 'img - light blonde.png' }
    ],
    options: [
      { label: 'Black',        value: 'black',        style: 'choice' },
      { label: 'Dark Brown',   value: 'dark-brown',   style: 'choice' },
      { label: 'Medium Brown', value: 'medium-brown', style: 'choice' },
      { label: 'Light Brown',  value: 'light-brown',  style: 'choice' },
      { label: 'Dark Blonde',  value: 'dark-blonde',  style: 'choice' },
      { label: 'Light Blonde', value: 'light-blonde', style: 'choice' }
    ]
  },

  permed: {
    botMessage: "Is your hair currently permed or chemically straightened?",
    layout: 'permed-expand',
    options: [
      { label: 'Yes', value: 'yes', style: 'choice' },
      { label: 'No',  value: 'no',  style: 'choice' }
    ],
    permAgeOptions: [
      { label: 'Within 3 weeks',          value: 'under-3w', style: 'choice' },
      { label: '3 weeks – 6 months ago',  value: '3w-6m',    style: 'choice' },
      { label: 'More than 6 months ago',  value: 'over-6m',  style: 'choice' }
    ]
  },

  bleached_history: {
    botMessage: "Have you had your hair bleached before?",
    layout: 'bleach-expand',
    options: [
      { label: 'Yes', value: 'yes', style: 'choice' },
      { label: 'No',  value: 'no',  style: 'choice' }
    ],
    bleachAgeOptions: [
      { label: 'Within 3 weeks',         value: 'under-3w', style: 'choice' },
      { label: '3 weeks – 1 year ago',   value: '3w-1y',    style: 'choice' },
      { label: '1–4 years ago',          value: '1-4y',     style: 'choice' },
      { label: 'More than 4 years ago',  value: 'over-4y',  style: 'choice' }
    ]
  },

  box_dye: {
    botMessage: "Have you used any at-home box dye or color kits on your hair?",
    threadNote: "Box dye can affect color results depending on the desired color.",
    layout: 'yes-no-row',
    options: [
      { label: 'Yes', value: 'yes', style: 'choice' },
      { label: 'No',  value: 'no',  style: 'choice' }
    ]
  },

  // Follow-up: did they dye darker? (color + perm flows)
  box_dye_darker: {
    botMessage: "Did you color your hair darker?",
    layout: 'yes-no-row',
    options: [
      { label: 'Yes, darker',              value: 'yes', style: 'choice' },
      { label: 'No, lighter/similar shade', value: 'no',  style: 'choice' }
    ]
  },

  // Perm: when did they use at-home dye?
  perm_home_dye_when: {
    botMessage: "When did you last use the at-home dye?",
    layout: 'yes-no-row',
    options: [
      { label: 'Within the last 6 months', value: 'under-6m', style: 'choice' },
      { label: 'More than 6 months ago',   value: 'over-6m',  style: 'choice' }
    ]
  },

  // Perm: service type select
  perm_type: {
    botMessage: "What kind of perm are you thinking?",
    layout: 'service-select-cards',
    cards: [
      { title: 'Curl Perm',     desc: 'Cold perm or digital heat-set',        image: 'img- curl perm.png',     value: 'curl'     },
      { title: 'Straight Perm', desc: 'Rebonding / chemical straightening',   image: 'img- straight perm.png', value: 'straight' }
    ],
    options: [
      { label: 'Curl Perm',     value: 'curl',     style: 'choice' },
      { label: 'Straight Perm', value: 'straight', style: 'choice' }
    ]
  },

  // Cut: service type select
  cut_type: {
    botMessage: "What kind of cut service are you looking for?",
    layout: 'service-select-cards',
    cards: [
      { title: 'Wash + Cut + Blowdry', desc: 'Full service from wash to style',  image: 'img- cut + blow+style.png', value: 'wash-cut-blowdry' },
      { title: 'Cut Only',             desc: 'Dry cut, no wash or blowdry',       image: 'img-cut only.png',          value: 'cut-only'        },
      { title: 'Wash + Style',         desc: 'Wash and blowdry/style only',       image: 'img- wash + style.png',     value: 'wash-style'      },
      { title: 'Wash Only',            desc: 'Shampoo and conditioning rinse',     image: 'img-wash.png',              value: 'wash-only'       },
      { title: 'Fringe Trim',          desc: 'Quick fringe/bang trim only',        image: 'img-fringe trim.png',       value: 'fringe-trim'     }
    ],
    options: [
      { label: 'Wash + Cut + Blowdry', value: 'wash-cut-blowdry', style: 'choice' },
      { label: 'Cut Only',             value: 'cut-only',          style: 'choice' },
      { label: 'Wash + Style',         value: 'wash-style',        style: 'choice' },
      { label: 'Wash Only',            value: 'wash-only',         style: 'choice' },
      { label: 'Fringe Trim',          value: 'fringe-trim',       style: 'choice' }
    ]
  },

  // Bleach: service type select
  bleach_type: {
    botMessage: "What kind of bleach service are you after?",
    layout: 'service-select-cards',
    cards: [
      { title: 'Full / Partial Bleach', desc: 'All-over or targeted lightening', image: 'img- bleach hair.png', value: 'full-partial'  },
      { title: 'Root Touch-Up',         desc: 'Refresh and lighten your roots',  image: 'img-bleach root.png',  value: 'root-touchup'  }
    ],
    options: [
      { label: 'Full / Partial Bleach', value: 'full-partial', style: 'choice' },
      { label: 'Root Touch-Up',         value: 'root-touchup', style: 'choice' }
    ]
  },

  // Treatment: hair care vs scalp care
  treatment_care_type: {
    botMessage: "What kind of treatment are you looking for?",
    layout: 'service-select-cards',
    cards: [
      { title: 'Hair Care',   desc: 'Nourishing treatments for your strands', image: 'img-hair care.png',  value: 'hair-care'   },
      { title: 'Scalp Care',  desc: 'Scalp exfoliation, spa & more',          image: 'img-scalp care.png', value: 'scalp-care'  }
    ],
    options: [
      { label: 'Hair Care',  value: 'hair-care',  style: 'choice' },
      { label: 'Scalp Care', value: 'scalp-care', style: 'choice' }
    ]
  },

  // Treatment: is hair colored?
  treatment_colored: {
    botMessage: "Is your hair currently colored or color-treated?",
    layout: 'yes-no-row',
    options: [
      { label: 'Yes', value: 'yes', style: 'choice' },
      { label: 'No',  value: 'no',  style: 'choice' }
    ]
  },

  booking_start: {
    botMessage: (session) => session.bookingEditMode
      ? "Do you have a stylist in mind? Or would you'd like us to match you?"
      : ["We're excited to see you! Let's get you booked.", "Do you have a stylist in mind? Or would you'd like us to match you?"],
    layout: 'stylist-select',
    stylists: [
      { id: 'michelle', name: 'Michelle', tier: 'Premier', badge: 'Premier · 5+ years experience', specialties: 'Color · Balayage', bio: 'Specialises in color correction, balayage, and keratin treatments. Known for her calm chair-side manner.', image: 'img-michelle.avif', workImages: ['img- michelle work 1.jpg', 'img- michelle work 2.jpg', 'img- michelle work 3.jpg'] },
      { id: 'jenny',    name: 'Jenny',    tier: 'Premier', badge: 'Premier · 3+ years experience', specialties: 'Cut · Perm',       bio: 'Expert in precision cuts and nourishing treatments. Loves creating effortless, lived-in looks.',            image: 'img-jenny.jpg',    workImages: ['jenny - work 1.jpg', 'jenny - work 2.jpg', 'jenny - work 3.jpg'] },
      { id: 'carol',    name: 'Carol',    tier: 'Refined', badge: 'Refined · 4+ years experience', specialties: 'Color · Cut',       bio: 'Specialises in textured cuts and scalp treatments. Known for her attention to detail.',                      image: 'img-carol.jpg',    workImages: ['carol - work 1.jpg', 'carol - work 2.jpg', 'carol - work 3.jpg'] },
      { id: 'ruth',     name: 'Ruth',     tier: 'Premier', badge: 'Premier · 3+ years experience', specialties: 'Perm · Cut',       bio: 'Passionate about healthy hair. Offers restorative treatments alongside clean, modern cuts.',                  image: 'img-ruth.jpg',     workImages: ['ruth - work 1.jpg', 'ruth -work 2.jpg', 'ruth- work 3.jpg'] },
      { id: 'sarah',    name: 'Sarah',    tier: 'Refined', badge: 'Refined · 4+ years experience', specialties: 'Perm · Cut',       bio: 'Loves blending seamless color with flattering cuts. Great with fine and medium hair types.',                  image: 'img-sarah.jpg',    workImages: ['sarah - work 1.jpg', 'sarah - work 2.jpg', 'sarah - work 3.jpg'] },
      { id: 'diana',    name: 'Diana',    tier: 'Premier', badge: 'Premier · 6+ years experience', specialties: 'Perm · Color',     bio: 'Expert in complex color transformations and lightening. Known for bright, healthy results.',                   image: 'img-Diana.jpg',    workImages: ['diana - work 1.jpg', 'diana - work 2.jpg', 'Diana - work 3.jpg'] },
      { id: 'sophie',   name: 'Sophie',   tier: 'Refined', badge: 'Refined · 2+ years experience', specialties: 'Color · Perm',     bio: 'Specialises in toning, gloss treatments, and everyday color maintenance.',                                    image: 'img-Sophie.jpg',   workImages: ['sophie - work 1.jpg', 'sophie - work 2.jpg', 'sophie - work 3.jpg'] },
      { id: 'nana',     name: 'Nana',     tier: 'Refined', badge: 'Refined · 3+ years experience', specialties: 'Cut · Balayage',   bio: 'Brings a fresh perspective to cuts and color. Particularly skilled with curly and coily hair.',                image: 'img-Nana.jpg',     workImages: ['nana - work 1.jpg', 'nana - work 2.jpg', 'nana - work 3.jpg'] },
    ]
  },

  booking_service: {
    botMessage: "What's the primary service you are booking for?",
    layout: 'booking-service',
    options: [
      { label: 'Cut',          value: 'cut' },
      { label: 'Color',        value: 'color' },
      { label: 'Perm',         value: 'perm' },
      { label: 'Bleach',       value: 'bleach' },
      { label: 'Treatment',    value: 'treatment' },
      { label: 'Consultation', value: 'consultation' }
    ]
  },

  booking_confirm: {
    botMessage: "When works for you?",
    layout: 'booking-confirm',
    options: [
      { label: 'None of these times work', value: 'no_times', style: 'metatext' }
    ]
  },

  match_service: {
    botMessage: "What service are you booking for?",
    layout: 'booking-service',
    options: [
      { label: 'Cut',          value: 'cut' },
      { label: 'Color',        value: 'color' },
      { label: 'Perm',         value: 'perm' },
      { label: 'Bleach',       value: 'bleach' },
      { label: 'Treatment',    value: 'treatment' },
      { label: 'Consultation', value: 'consultation' }
    ]
  },

  match_confirm: {
    botMessage: "When works for you?",
    layout: 'booking-confirm',
    options: [
      { label: 'None of these times work', value: 'no_times', style: 'metatext' }
    ]
  },

  match_stylist: {
    botMessage: "Great! Here's who's available for you:",
    layout: 'match-stylist',
  },

  booking_details: {
    botMessage: "Almost there! Let's grab your details to confirm:",
    layout: 'booking-details'
  },

  booking_success: {
    layout: 'booking-success'
  },

  // ─── Stubs for services not yet built ───────────────────────────────────────

  cut_stub: {
    botMessage: "Cut pricing and booking is coming in the next build phase. Give us a call and we'll walk you through everything.\n\n✂ Wash + Cut + Blowdry from $110 · Cut only from $85 · Fringe trim from $20",
    options: [
      { label: "Call us",       value: 'call_us',   style: 'neutral' },
      { label: "← Main menu",  value: 'main_menu', style: 'neutral' }
    ]
  },

  about: {
    botMessage: "Here's a bit about who we are:",
    layout: 'about-cards',
    cards: [
      {
        title: 'Our Belief',
        desc: "We're a boutique salon prioritizing on low-ammonia bleaches to maintain hair quality but not lose effectiveness. We're determined to get the results your looking for without sacrificing the quality. While we do with creative cuts, we're obsessed with creating elegant effortless looks.",
        image: 'salon-img.jpg'
      },
      {
        title: 'Our Founder',
        desc: "Sierra's been working in the industry for over 10 years. After receiving basic hair training in the New York, she ventured to Japan to learn the newest techniques in Asia. She returned and established Rosan Hair in 2017 in hope to bring the specialize techniques to the States.",
        image: 'founder-img.jpg'
      }
    ],
    options: [
      { label: "Discover Our Stylists", value: 'stylists',     style: 'choice' },
      { label: "View Our Services",     value: 'service_list', style: 'choice' }
    ]
  },

  perm_stub: {
    botMessage: "Curl perm quoting is coming in the next build phase. Give us a call and we'll get you sorted.\n\n🌀 Basic curl perm from $190 · Digital curl perm from $250",
    options: [
      { label: "Call us",       value: 'call_us',   style: 'neutral' },
      { label: "← Main menu",  value: 'main_menu', style: 'neutral' }
    ]
  },

  treatment_stub: {
    botMessage: "Treatment quoting is coming soon. Give us a call and we'll recommend the right one for your hair.\n\n💆 Treatments from $38",
    options: [
      { label: "Call us",       value: 'call_us',   style: 'neutral' },
      { label: "← Main menu",  value: 'main_menu', style: 'neutral' }
    ]
  },

  ready_to_book: {
    botMessage: "Great — booking flow is coming in the next build phase. Call or text us and we'll get you in.",
    options: [
      { label: "Call us",       value: 'call_us',   style: 'neutral' },
      { label: "← Main menu",  value: 'main_menu', style: 'neutral' }
    ]
  },

  stylists: {
    layout: 'stylists-grid',
    botMessage: "Senior stylists with over 5yrs experience",
    options: [
      { label: "Discover Salon Products", value: 'products',      style: 'primary'   },
      { label: "View Our Services",       value: 'service_list',  style: 'secondary' }
    ]
  },

  products: {
    preCards: [
      {
        title: 'Botanical Bevive Shampoo',
        desc: 'A luxurious formula that cleanses and nourishes every strand. Infused with argan oil for silky, frizz-free hair.',
        image: 'Shampoo.png'
      },
      {
        title: 'Botanical Bevive Conditioner',
        desc: 'A rich, hydrating conditioner that restores softness and shine. Pairs perfectly with the Botanical Bevive Shampoo.',
        image: 'Conditioner.png'
      },
      {
        title: 'Hair Oil',
        desc: 'A luxurious blend of fine fragrance and nourishing oils that leaves hair silky, scented, and effortlessly radiant.',
        image: 'Hairoil.png'
      }
    ],
    botMessage: "If you'd like to know more or purchase any products from us, please contact us directly.",
    options: [
      { label: "View Our Services", value: 'service_list', style: 'primary'   },
      { label: "Contact Us",        value: 'contact_us',   style: 'secondary' }
    ]
  },

  style_quiz: {
    botMessage: "Our style quiz is being built — check back soon! In the meantime, tell me what service you're thinking and I'll walk you through pricing.",
    options: [
      { label: "Get a color quote", value: 'color', style: 'choice' },
      { label: "← Main menu",      value: 'main_menu', style: 'neutral' }
    ]
  },

  sdq_length: {
    botMessage: ["Let's gather some info to figure out what may interest you", "Firstly, how long is your current hair?"],
    layout: 'sdq-length',
  },

  sdq_maintenance: {
    botMessage: "What's your commitment level to hair maintenance?",
    layout: 'sdq-maintenance',
  },

  sdq_commitment: {
    botMessage: "Are you open to coloring your hair? Or chemical treatments like a perm or straightening?",
    layout: 'sdq-commitment',
  },

  sdq_style: {
    botMessage: "What style are you going for? Pick up to 3.",
    layout: 'sdq-style',
  },

  sdq_result: {
    botMessage: "Here's some options you can consider:",
    layout: 'sdq-result',
  },

  special_occasion: {
    botMessage: "For special occasions we'd love to chat through the details directly — it helps us make sure everything's perfect on the day.",
    options: [
      { label: "Call us",      value: 'call_us',   style: 'neutral' },
      { label: "← Main menu", value: 'main_menu', style: 'neutral' }
    ]
  },

  no_times: {
    botMessage: "Would you like to call us instead for other openings? Or see who else is available?",
    layout: 'no-times'
  },

  call_us: {
    botMessage: "Happy to chat! Give us a call or text and we'll help you from there.",
    layout: 'contact-us'
  },

  appt_lookup: {
    botMessage: "Let's pull up your info. What's your name and phone number?",
    layout: 'appt-lookup',
  },

  existing_appt: {
    botMessages: [
      "You have an existing appointment with us:",
      "Would you like to change it?"
    ],
    layout: 'existing-appt',
  },

  appt_reschedule: {
    botMessage: "Pick a new time below:",
    layout: 'appt-reschedule',
  },

  appt_cancel_confirm: {
    botMessages: null, // built dynamically in renderStep
    layout: 'appt-cancel-confirm',
  },

  appt_change_details: {
    botMessage: "Please select what you'd like to change:",
    layout: 'appt-change-details',
  },

  appt_cancelled: {
    layout: 'appt-cancelled',
  }

};

// Patch steps that reference other steps' data
STEPS.see_other_stylists = {
  botMessage: "Check out our other stylists, or have us match you with one.",
  layout: 'stylist-select',
  stylists: STEPS.booking_start.stylists,
};
