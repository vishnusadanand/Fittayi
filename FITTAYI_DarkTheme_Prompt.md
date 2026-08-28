# Antigravity Follow-Up Prompt — Dark Theme Retrofit

This is a follow-up mission for the existing FITTAYI project (not a rebuild).
Update `FITTAYI_PRD.md` in your project folder to the latest version (it now
includes Section 8.3 — Dark Theme Design System) before running this.

---

```
Goal: Retrofit the existing FITTAYI UI to the dark theme specified in
FITTAYI_PRD.md, Section 8.3.

Read Section 8.3 in the updated FITTAYI_PRD.md before doing anything else.
This is a design-system change applied across the whole existing app —
landing page, quiz flow, sample plan view, dashboard, and any modals — not a
new feature, so nothing in the underlying logic, schema, or calorie engine
should change.

Do this in order:

1. Add the color tokens from Section 8.3 as CSS variables (or Tailwind theme
   extension, matching however the project is currently set up) rather than
   hardcoding hex values into components. Every place currently using a
   hardcoded light-theme color should be converted to reference a token.

2. Apply the typography direction from Section 8.3: a characterful display
   face for headings, a humanist body face for general copy, and tabular/
   monospace figures specifically for calorie and macro numbers so they stay
   visually aligned in cards and tables.

3. Rework each screen:
   - Landing page (Plans / Method / Sample Week / Dishes sections)
   - Quiz flow
   - Sample one-day plan view
   - Signup/login
   - Dashboard (weekly plan, dish swap, meal check-in)
   Give calorie/macro numbers clear visual hierarchy on each — they're the
   core content of the product, treat them like headlines, not fine print.

4. Verify contrast: check every text/background pairing against WCAG AA
   (4.5:1 body text, 3:1 large text), with particular attention to
   --text-secondary on --bg-surface, which is the combination most likely to
   fail. Fix anything that doesn't pass rather than eyeballing it.

5. Preserve the floor-clamp warning behavior (PRD Section 6.1): when a user's
   calorie target has been safety-clamped, that message must use
   --accent-warning and remain visually distinct from normal informational
   text. Confirm this still reads clearly against the new dark surfaces —
   don't let it blend in.

6. Add/verify visible keyboard focus states across all interactive elements
   — buttons, form inputs, quiz options, dish swap controls — checked
   specifically against the dark surface colors, since low-contrast focus
   rings are a common miss on dark themes.

7. Respect prefers-reduced-motion for any existing transitions; don't add new
   decorative animation as part of this change.

8. Test mobile breakpoints specifically — confirm the palette and type scale
   still read clearly at small sizes.

After the retrofit, take screenshots of each major screen (landing, quiz,
sample plan, dashboard) and walk me through them, calling out anywhere you
had to make a judgment call not explicitly covered in Section 8.3.
```

---

### Notes before you run this

- Run this as a fresh mission on the existing project — don't feed it the original build prompt again, since that would risk Antigravity re-scaffolding things that already exist.
- If your project already has a design token system in place (Tailwind config, CSS variables, a theme file), point Antigravity to that file specifically in your first message so it edits the existing source of truth rather than introducing a second, conflicting one.
- Worth reviewing the contrast-check step's actual output rather than trusting it was done — ask it to report the specific ratios it verified if you want confidence it didn't skip that step.
