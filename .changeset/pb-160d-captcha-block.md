---
"@next-buildr/components": minor
"@next-buildr/editor": patch
---

Register the Captcha form verification block in the default registry and gallery, export its definition, and include its styles. Add Polish editor labels and the shield-check palette icon.

The `buildr/form` element now carries `data-buildr-form` (the form node id) and dispatches a bubbling `buildr-form:settled` event after every submission. A function-valued form action (for example a server action) is now called by the form enhancer itself, with `preventDefault()` and inside `startTransition`, instead of by React's native form-action handling; hosts that pass a server action as `formAction` get this path.
