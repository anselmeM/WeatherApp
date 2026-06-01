## 2024-05-24 - Search Input Keyboard Shortcut Hints
**Learning:** Adding a keyboard shortcut like `/` is a great power-user feature, but it needs an `aria-keyshortcuts` attribute on the input itself so screen readers announce it, while the visual `<kbd>` element should be hidden from screen readers using `aria-hidden="true"` to prevent redundant/confusing announcements.
**Action:** Always pair visual keyboard shortcut indicators with `aria-keyshortcuts` on the interactive element they control.

## 2024-05-24 - Icon Button Context & Dynamic Page Titles
**Learning:** `aria-label` makes icon-only buttons accessible to screen readers, but sighted users still need context for what the button does. Additionally, static page titles reduce usability for users with multiple tabs open.
**Action:** Always pair `aria-label` with a native `title` attribute on icon-only interactive elements to provide hover tooltips for sighted users. Ensure the `document.title` is updated dynamically with critical context to improve tab glanceability.

## 2024-05-24 - Dropdown Focus Loss
**Learning:** Floating UI elements (like autocomplete dropdowns) must close not just on external clicks, but also when keyboard focus moves away (e.g., via Tab key). Otherwise, keyboard users leave lingering elements that obscure the page.
**Action:** When implementing custom floating UI elements, always pair document `click` handlers with document `focusin` handlers to ensure the element correctly closes when keyboard users tab away from it.
## 2024-05-24 - Dynamic Image Alt Text Context
**Learning:** Using a static `alt` text (like "City skyline") for dynamically loaded images (like a city location image) creates a poor screen reader experience when the context changes.
**Action:** When element attributes like images depend on dynamically loaded state or context (e.g., location changes), ensure properties like `alt` text are dynamically updated to reflect the new context rather than relying on a static placeholder.
