## 2026-03-15 - Refactored geolocation button to improve keyboard accessibility focus state
 **Learning:** Using `focus-within` on a parent container paired with `focus-visible:outline-none` on children provides consistent focus indicators for compound components.
 **Action:** Always consider the focus experience of adjacent input elements to ensure they behave identically when part of the same logical component.
