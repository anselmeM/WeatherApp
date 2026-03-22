## 2024-05-24 - Search Input Keyboard Shortcut Hints
**Learning:** Adding a keyboard shortcut like `/` is a great power-user feature, but it needs an `aria-keyshortcuts` attribute on the input itself so screen readers announce it, while the visual `<kbd>` element should be hidden from screen readers using `aria-hidden="true"` to prevent redundant/confusing announcements.
**Action:** Always pair visual keyboard shortcut indicators with `aria-keyshortcuts` on the interactive element they control.
