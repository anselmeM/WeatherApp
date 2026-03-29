## 2024-05-24 - Search Input Keyboard Shortcut Hints
**Learning:** Adding a keyboard shortcut like `/` is a great power-user feature, but it needs an `aria-keyshortcuts` attribute on the input itself so screen readers announce it, while the visual `<kbd>` element should be hidden from screen readers using `aria-hidden="true"` to prevent redundant/confusing announcements.
**Action:** Always pair visual keyboard shortcut indicators with `aria-keyshortcuts` on the interactive element they control.

## 2026-03-29 - Custom Dropdown Keyboard Focus Loss
**Learning:** When making custom dropdowns accessible, just adding keyboard handlers isn't enough. Screen reader and keyboard users will tab away, and if the dropdown doesn't close on `focusin` (when focus moves outside the component), it creates a confusing and visually broken experience.
**Action:** Always pair document `click` handlers with `focusin` handlers when managing the visibility of floating UI elements like dropdowns or popovers.
