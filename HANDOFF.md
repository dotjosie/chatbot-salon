# Handoff Spec: Rosan Hair Chatbot UI

## Overview

A mobile-first conversational chatbot embedded in the Rosan Hair Studio website. Users navigate a state-machine flow to discover the salon, get personalized pricing, and book appointments. Built as a standalone HTML/CSS/JS prototype at `chatbot-preview.html`, to be ported to `index.html`.

**Tech stack:** Vanilla HTML/CSS/JS · Proxima Nova via Adobe Fonts (`https://use.typekit.net/zlb4skl.css`) · No framework, no build step · Served via `npx serve`

---

## Layout

| Property | Value |
|---|---|
| Widget size | 390 × 844px (iPhone viewport) |
| Widget shape | `border-radius: 16px` |
| Widget shadow | `0 8px 48px rgba(0,0,0,0.18)` |
| Canvas background (preview) | `#D0CEC9` |
| Widget structure | Header (fixed) → Thread (flex-fill, scrollable) → Tray (hugs content, no scroll) |

**Thread anatomy:**
- First child is a `.chat-thread__spacer` (flex: 1) that pushes messages to the bottom on load
- Once thread overflows, new bot messages scroll to the top of the visible area (smart scroll, not bottom-anchor)

---

## Design Tokens

| Token | Value | Usage |
|---|---|---|
| `--text-primary` | `#2B211D` | All body text, icons |
| `--text-secondary` | `#848180` | Sublabels, placeholders |
| `--text-disabled` | `#C9C7B5` | Disabled states |
| `--fill-primary` | `#FFFFFF` | Cards, bubbles, tray bg |
| `--bg` | `#E8E6E2` | Chat thread background |
| `--btn-fill-sage` | `#C9C7B5` | Secondary button fill, user bubbles |
| `--btn-border` | `#5F5B4A` | Primary button border (olive) |
| `--border-action` | `#A8791F` | Gold border — all actionable/tappable cards |
| `--border-bubble` | `#C7C7C7` | Bot bubble border |
| `--border-tray` | `#C7C7C7` | Tray top divider |
| `--input-fill` | `#F2F1EE` | Input field background |
| `--font` | `'Proxima Nova'` | All text — no fallback |
| `--radius-btn` | `20px` | Buttons, inputs, bubbles |
| `--radius-md` | `10px` | Cards |

**Design rule:** Bordered = actionable/tappable. Unbordered = read-only. Never add borders to statement bubbles.

---

## Components

| Component | Class | Key Specs |
|---|---|---|
| App Header Bar | `.app-header-bar` | 56px tall, white bg, `#848180` bottom border 1px. Title centered, 16px/600. Progress variant adds `#C9C7B5` bg + subtitle |
| Bot Bubble | `.bubble.bubble--bot` | White fill, `#C7C7C7` border, `border-radius: 20px`, 14px/400, left-aligned. `white-space: pre-line` |
| User Bubble | `.bubble.bubble--user` | `#C9C7B5` fill, no border, right-aligned. `white-space: pre-line` for multi-line content |
| Action Tray | `.chat-tray` | White bg, 1px `#C7C7C7` top border, `padding: 0 12px 24px`, `flex-direction: column`, `gap: 12px`. Never scrolls — grows to hug content |
| Button Primary | `.btn-component.btn-component--primary` | White bg, `#5F5B4A` (olive) border, 14px/500, centered, `height: 44px`, `border-radius: 20px`, full width |
| Button Secondary | `.btn-component.btn-component--secondary` | `#C9C7B5` (sage) fill, olive border |
| Label Button (chip) | `.label-btn.label-btn--default` | Pill chip, gold border |
| Input Field | `.tray-input` | `height: 40px` (enforced with `box-sizing: border-box`), `border-radius: 20px`, `#C7C7C7` border. Focus: border-color `#848180`. Same height in both states |
| Menu Card | `.menu-card` | White bg, gold border, `border-radius: 20px`, `min-height: 96px`, icon (24×24px) above label (12px/500), centered |
| Meta-text | `.meta-text` | 14px/400, `#848180`, centered, full width, clickable |
| Description Card | `.description-card` | White bg, gold border, `border-radius: 10px`, title 16px/600, desc 12px/400 secondary |

---

## Tray Layouts

| Layout key | Class | Description |
|---|---|---|
| `'row'` | `.tray-btn-row` | Horizontal flex, equal-width buttons (e.g. greeting) |
| `'choices'` (default) | `.tray-choices` | Vertical stack, `gap: 6px` |
| `'chips'` | `.tray-chips` | Wrapping flex row of label-btn chips |
| `'menu-grid'` | `.tray-menu-grid` | 3-column CSS grid, `gap: 8px` |
| `'contact-form'` | _(inline)_ | Name input + Phone input + Continue btn + Back meta |
| `'about-cards'` | _(inline)_ | Cards appended to thread, tray gets standard options |

---

## Screens Built

| Screen | Step ID | Entry point |
|---|---|---|
| Greeting | `greeting` | Auto on load |
| Main Menu (First Time) | `main_menu` | After "First Time" |
| Returning — Contact Form | `returning_lookup` | After "I've been before" |
| Main Menu (Returning) | `main_menu` | After contact form Continue |
| About Salon | `about` | Main menu → About Us |

---

## Flows & State

Session state tracked in the `session` object (`chatbot.js`):

| Key | Values | Set when |
|---|---|---|
| `isReturning` | `true/false` | Greeting choice |
| `contactName` | string | Contact form |
| `contactPhone` | string | Contact form |
| `service` | `'color'`, `'cut'`, etc. | Service selection |
| `colorType` | `'full-color'`, `'balayage'` | Color type step |
| `hairLength` | `'XS'–'XL'` | Hair length chips |
| `naturalColor` | string | Natural color chips |
| `bleachRequired` | boolean | Computed in estimate builder |
| `treatmentAddon` | `'milbon'`, `'tokio'`, `'purifica'` | Treatment selection |

---

## Scroll Behavior

- **Thread short (fits viewport):** spacer pushes messages to bottom (iMessage-style)
- **Thread overflows:** each new bot message scrolls to the **top** of the visible area so user reads from the beginning and scrolls down at their own pace
- Implemented via `scrollThread(bubbleEl)` in `chatbot.js`

---

## Interactions

| Element | Trigger | Behavior |
|---|---|---|
| Any choice button/card | Tap | Appends user bubble, clears tray, routes to next step after 350ms delay |
| Continue (contact form) | Tap | Validates not empty, appends `Name\nPhone` user bubble, routes to `main_menu` |
| Back meta-text | Tap | Appends user bubble, routes to `main_menu` or `greeting` |
| Typing indicator | Auto | Shows 3-dot bounce animation for 600–700ms before each bot bubble |
| Multiple bot messages | Auto | Chained — each waits for typing indicator before appending |

---

## Personalization

- Returning users: greeting uses `session.contactName.trim().split(' ')[0]` (first name only)
- Bot message: *"What can we help you with today, [First Name]?"*

---

## Files

| File | Purpose |
|---|---|
| `chatbot-preview.html` | Standalone widget preview (active working file) |
| `index.html` | Full site with widget (port here last) |
| `styles.css` | All design tokens + component classes |
| `chatbot.js` | State machine, rendering, routing |
| `flow-data.js` | All copy, pricing, step definitions |
| `images/icons/` | SVG icons (all `color: var(--text-primary)`) |

---

## Still To Build

- Our Services screen
- Stylists screen
- Salon Products screen
- Color quote flow (full)
- Estimate card component
- Booking confirmation
- Contact Us screen
