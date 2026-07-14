---
name: vuetify-tailwind-design
description: "Use when writing or styling .vue components in this repo, or touching src/styles/*, src/plugins/vuetify.ts, tailwind.css, settings.scss, vite.config.mts's Vuetify/Fonts/Tailwind plugins. Triggers: Tailwind utility classes, Vuetify components/props (color, variant, density, rounded, elevation), theme colors, dark/light mode, breakpoints, fonts, or anything touching how Tailwind and Vuetify coexist in this codebase."
metadata:
  type: project-design
---

# Vue + Tailwind + Vuetify design (this repo)

This project layers Tailwind CSS utilities on top of Vuetify's Material Design
component library in the same app. They are wired together deliberately —
follow the existing wiring instead of reaching for generic Tailwind or
Vuetify defaults, which will silently lose to (or fight with) the other
system.

## The cascade layer order is load-bearing

`src/styles/layers.css` declares the layer order for the whole app:

```
tailwind-theme → tailwind-reset → vuetify-core → vuetify-components →
vuetify-overrides → vuetify-utilities → tailwind-utilities → vuetify-final
```

Later layers win regardless of selector specificity. Practical consequences:

- Plain Tailwind utility classes (`tailwind-utilities`) beat Vuetify's own
  component/utility layers by default — that's why utility classes on a
  `v-card` etc. generally work.
- `vuetify-overrides` (defined in `src/styles/main.scss`) intentionally uses
  `!important` on `.bg-primary`, `.text-primary`, `.bg-success`, etc., so that
  Vuetify's theme-driven meaning of those class names always wins even though
  `tailwind-utilities` comes later in the layer order. **Do not delete those
  `!important`s** and don't add new classes with the same names expecting
  Tailwind's version to apply.
- If a Tailwind utility doesn't visually win against a Vuetify component's
  own style, that's a layer-order issue, not a specificity issue — fix it by
  adding a rule inside the `@layer vuetify-overrides` block in
  `src/styles/main.scss`, or by using the component's own Vuetify prop
  instead of fighting the cascade.

## Colors: use theme tokens, never raw hex

Both theme colors and Tailwind color tokens are backed by the *same*
Vuetify CSS variables (`--v-theme-primary`, etc.), set from
`src/plugins/vuetify.ts`'s `lightBlueLightTheme` / `lightBlueDarkTheme`. The
`@theme` block in `src/styles/tailwind.css` re-exposes them as
`--color-primary`, `--color-surface`, `--color-on-surface`,
`--color-success`, `--color-info`, `--color-warning`, `--color-error`.

- On a Vuetify component, set color via the `color`/`variant` props
  (`color="primary"`, `variant="tonal"`), not a Tailwind class.
- In plain markup/Tailwind utilities, use the generated tokens
  (`bg-primary`, `text-on-surface`, etc.) or the semantic `bg-success` /
  `text-warning` style helpers from `vuetify-overrides` — never hardcode a
  hex value in a component.
- If a genuinely new semantic color is needed, add it to **both**
  `lightBlueLightTheme` and `lightBlueDarkTheme` in `vuetify.ts` (light and
  dark values), not just one, and not as a one-off Tailwind color.

## Dark/light mode: Vuetify drives it, not Tailwind's default strategy

Theme switching happens via `theme.change('lightBlueDark' | 'lightBlueLight')`
(see `AppHeader.vue`), which toggles a `.v-theme--dark` / `.v-theme--light`
class on an ancestor element — not a `.dark` class or
`prefers-color-scheme`, which is what Tailwind's built-in `dark:` variant
expects.

`tailwind.css` defines custom variants for this:

```css
@custom-variant light (&:where(.v-theme--light, .v-theme--light *));
@custom-variant dark (&:where(.v-theme--dark, .v-theme--dark *));
```

Use `light:` / `dark:` Tailwind variants for theme-conditional utilities —
they resolve correctly here. Tailwind's ordinary `dark:` behavior (class
strategy on `<html>`, or media-query strategy) is not configured and will
not track the app's actual theme state.

## Breakpoints are duplicated in three places — keep them in sync

The same breakpoint scale (`xs:0, sm:600, md:840, lg:1145, xl:1545,
xxl:2138`) is defined independently in:

- `src/styles/settings.scss` (`$grid-breakpoints`, `$container-max-widths`, feeds Vuetify's SASS)
- `src/plugins/vuetify.ts` (`display.thresholds`, `display.mobileBreakpoint: 'md'`)
- `src/styles/tailwind.css` (`--breakpoint-*` in the `@theme` block)

If you change the breakpoint scale, update all three or Vuetify's
`useDisplay()`/grid behavior and Tailwind's `sm:`/`md:`/... variants will
disagree about where the breakpoints fall. Note "mobile" in this app means
`< 840px` (`md`), not Tailwind's usual `< 768px`.

## Bridged utilities: prefer these over ad hoc equivalents

`tailwind.css` adds custom Tailwind utilities specifically to cover Vuetify
vocabulary that Tailwind doesn't have out of the box:

- `elevation-0` … `elevation-5` — MD3 elevation shadows matching Vuetify's
  own `elevation` prop math. Use these instead of Tailwind's `shadow-*`
  scale or a hand-written `box-shadow` when you want a look consistent with
  surrounding `v-card`/`v-sheet` elevation.
- `rounded-pill`, `rounded-circle`, `rounded-shaped` — extend Tailwind's
  `rounded-*` scale with Vuetify's shape names. Prefer these over arbitrary
  values (`rounded-[999px]`) for pill/circle/MD3-shaped corners.
- `font-heading`, `font-body`, `font-mono` — map to the same
  `--font-heading`/`--font-body`/`--font-mono` variables Vuetify's
  `settings.scss` uses (backed by `@fontsource/roboto` +
  `@fontsource/roboto-mono`, loaded via `unplugin-fonts` in
  `vite.config.mts`). Don't introduce a new font family without updating the
  `Fonts()` plugin config in `vite.config.mts` *and* these variables — adding
  it in only one place gives you a font that's available in Tailwind classes
  but never actually loaded (or vice versa).

## Existing components lean on Vuetify's own utility class names — verify before copying

`settings.scss` passes `$utilities: false` to `vuetify/settings`, which
disables generation of Vuetify's own utility CSS (spacing/display/typography
helpers). Some existing components (e.g. `ProductCard.vue`, `AppHeader.vue`)
still use Vuetify-style class names like `d-flex`, `ga-3`, `pb-1`,
`flex-column`, `text-h6`, `text-body-2`, `text-medium-emphasis`,
`font-weight-bold`. Before copying one of these into new code, confirm it's
actually still doing something (Vuetify components sometimes apply
equivalent styles internally regardless of the utility CSS). For new
components, prefer Tailwind's own equivalents (`flex`, `gap-3`, `pb-1`,
`flex-col`, `font-bold`, etc.), which are guaranteed to exist via the
`tailwind-utilities` layer, and reserve Vuetify's own typography classes
(`text-h6`, `text-body-2`) for cases where you specifically want Vuetify's
Material typography scale rather than Tailwind's `text-*` sizing.

## Workflow checklist for new/changed UI

1. Reach for a Vuetify component and its own props first (`color`,
   `variant`, `density`, `rounded`, `elevation`) — this is a Material Design
   POS UI, and Vuetify's prop API is the primary styling surface.
2. Fill gaps (layout, spacing, one-off typography) with Tailwind utilities,
   preferring the bridged ones above (`elevation-*`, `rounded-pill` /
   `-circle` / `-shaped`, `font-heading` / `-body` / `-mono`) over inventing
   arbitrary values.
3. Reference colors only through theme tokens/props, never raw hex.
4. Gate any theme-conditional Tailwind utility on the custom `light:` /
   `dark:` variants, not Tailwind's default dark-mode strategy.
5. If something isn't rendering as expected, check whether it's a layer-order
   problem (see above) before adding `!important` in component-local CSS.
