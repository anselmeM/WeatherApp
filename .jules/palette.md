## 2026-07-04 - Accessible Combobox Keyboard Navigation
**Learning:** Adding `role="option"` and focus styles isn't enough for comboboxes. Without explicit keydown listeners to move focus and handle 'Enter'/'Space', screen reader and keyboard users get trapped.
**Action:** When implementing custom dropdowns or comboboxes, always add comprehensive keydown listeners (`ArrowDown`, `ArrowUp`, `Enter`, `Space`) on both the input trigger and the list items to bridge the gap left by native browser behavior.
