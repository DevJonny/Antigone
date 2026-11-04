# Antigone — design

A static PWA, hosted on GitHub Pages, that lists appointments from one or more Google Calendars and tracks each one through four stages.

## Stages

| Colour | Meaning |
| --- | --- |
| Red | Not started |
| Orange | Notes written |
| Yellow | Invoiced |
| Green | Rebooked |

The colour is the furthest stage reached **in order**. An entry that is rebooked but not invoiced stays orange; as soon as it is invoiced it goes straight to green.

## Storage

All state lives on the Google Calendar event, in `extendedProperties.private`. There is no backend. The only local storage is an IndexedDB cache of events and a queue of edits made while disconnected.

| Key | Value |
| --- | --- |
| `ag_notes` | `"1"` once notes are written (the notes themselves live in a separate app) |
| `ag_invoiced` | ISO timestamp when the payment link was sent |
| `ag_rebooked` | ID of the follow-up event |
| `ag_hidden` | `"1"` if dismissed from the list |
| `ag_client` | Client key (normalised event title) |
| `ag_payLink` | The client's reusable SumUp payment link |

## Clients and payment links

SumUp's API has no payment-link or invoice endpoints, and its hosted checkouts expire after 30 minutes. So each client gets a reusable payment link created in the SumUp app, pasted into Antigone once.

A client is identified by event title. When invoicing, the link is taken from the event, or from any other event with the same client key. Rebooking copies it onto the new event.

Invoicing opens the device share sheet with the link, and marks the event invoiced once shared. Payment is not tracked.

## Rebooking

Creates a new event on the same calendar with the same title and duration at a chosen date and time. The original records the new event's ID. Rebooking needs a live connection; other edits queue offline.

## Connection

Google's browser-only sign-in gives one-hour tokens with no refresh. Sign-in is a full-page redirect rather than a popup, because popups don't return reliably from iOS Home Screen apps. Targets are iPhone, iPad and laptop. A banner shows the connection state:

- **Green** — connected and live. Shown for two seconds, then it collapses away; no banner means connected. It stays up while edits are queued or after an error.
- **Amber** — offline; showing cached data, last sync time, and queued edits.
- **Red** — signed out or token expired; a Reconnect button.

Refresh lives in the app bar, beside Settings, while connected.

## Entries

All entries in the window (90 days back, 90 days ahead) from the selected calendars are shown in date order. Completed (green) entries are hidden by default, and any entry can be dismissed; a Settings toggle reveals both. Status filter chips narrow the list further. Settings also holds calendar selection.

## Look

iOS-style, since it runs on iPhone, iPad and Mac: system font, grouped grey background, tint-blue controls. Cards are neutral; each stage shows as a thick left edge in the system red, orange, yellow or green, plus a tinted label and done-step buttons. Full colour fills were tried and were too loud, especially in dark mode. Material 3 was tried too and felt out of place on Apple devices.

Light and dark follow the device, or can be forced in Settings.
