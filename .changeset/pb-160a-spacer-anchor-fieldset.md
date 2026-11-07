---
"@next-buildr/components": minor
"@next-buildr/editor": patch
---

PB-160a: three new blocks. `buildr/spacer` (vertical or horizontal gap, theme space tokens, hidden
from assistive technology), `buildr/anchor` (an empty `<span id>` link target; the name must match
`^[a-z][a-z0-9-]{0,63}$` and may not start with `bc-`, an invalid name renders nothing on the site,
the first of duplicate ids wins) and `buildr/fieldset` (`<fieldset><legend>`, only inside a form).
All three start at version 1, so no migration is needed. The editor knows their Polish labels and
icons, and the Formularze section of the Blocks tab lists Fieldset in place of the old "Etykieta"
slot.
