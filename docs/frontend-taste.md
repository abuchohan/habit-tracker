GATE: OPEN 22 (rounds used up)

# Frontend remake on frontend-taste

The new branch starts from local main at 5205867. The previous UI is preserved at 82ecbb5 on stale/ui-overhaul. Main was not modified.

## Design and scope

Kind: software, an operational personal habit tracker. The skill dealt white-mint-tiles and Host Grotesk with JetBrains Mono; the white/grey canvas keeps the habit history legible and mint marks completion. The printed palette block is preserved in public/appearance.css. The UI uses one rounded control family, outlined surfaces, direct labels, and the skill's unmodified hover/press layer. It has a desktop workspace rail, responsive collections, search, editable date grid, details, forms, settings and account views. There are no invented records in a user's workspace.

Voice card: facts only; direct action labels; habit, entry, history and archive are used consistently. No slogans or invented proof.

The dealt collage hero is adapted to the live application. Full-screen promotional heroes, scenes, shader grounds, auto-playing mock UI and scroll moments are omitted because the request is to remake the functioning tracker. The actual grid is the product visual. Photographs, client slots, contact stand-ins, prices, testimonials and newly coined brand names are not used. Habits is the existing repository's name; no name search or assumed facts were needed. Account forms use the existing real backend and entries use the existing storage layer; there is no .example form endpoint. No canonical domain was provided. A social share image is not included.

## Verification

- Typecheck, frontend lint and production export passed.
- Core suite: 12 passed, covering domain algorithms, database round trips, import/export and account/sync isolation.
- Browser suite: 15 passed, 3 platform-specific checks skipped, 0 failures. Desktop Chromium and iPhone WebKit covered offline reloads, values and notes, backup export, themes, collection/search behavior, date gestures, responsive recording space, keyboard navigation and inline-error focus.
- Skill copy draft lint: 0 FAIL, 0 WARN.
- Skill performance audit: 0 FAIL, 2 WARN. Both warnings concern the approximately 632 KiB parsed framework/application JavaScript. Measured layout shift was 0.006 desktop and 0.000 phone; there were no broken requests. Raw results: ../.taste-skill/perf.json. These are local CPU measurements, not field data.
- Skill screenshots were captured and visually inspected at 1440x900, 1024x768, 820x1180, 768x1024 and 390x844. Files are in ignored .taste-skill/shots/. Populated light/dark views and dialogs were also exercised by the browser workflow suite.
- The full consistency audit and finish gate were run without modifying the kit or hiding content. The final gate used all three rounds. No waivers were added.
- The standalone five-size layout script crashed with "Cannot read properties of undefined (reading 'map')" on this React application. Its partial JSON reports no .wrap. It is not reported as a passing layout audit. The requested viewport captures were still produced by the skill's shoot tool.
- Native builds were not run on physical devices. Native uses the platform font; the web fonts are local and cached for offline use. Largest native Dynamic Type and native keyboard/safe-area behavior remain unverified.

## Why the marketing gate remains open

The checker treats the operational toolbar, month selector, empty log and workspace rail as marketing sections. It therefore asks for a viewport-sized hero, screen-height sections, a full-width marketing navigation bar, a dealt scroll moment and .wrap markup. Filling an empty habit log with promotional imagery or mock entries would change the requested product. The selected collection is also counted as a third button style. Those findings are retained, not suppressed. The exact remaining findings and warnings follow.

## Open FAILs

1. **hero-fill** — main#habit-content > div.css-g5y9jx:nth-of-type(2) "0 habits in your log Search habits Filte" [1440px]

   the next section shows on the first screen: it starts at 231px on a 900px screen (the hero ends at 228px)

2. **nav** — (the first screen) [1440px]

   no nav bar across the top of the first screen (a header with the brand, the section links and the main action)

3. **section-gaps** — main#habit-content > div.css-g5y9jx:nth-of-type(3) / main#habit-content > div.css-g5y9jx:nth-of-type(4) [1440, 390px]

   53px between these sections, +77% against the median 30px

4. **empty-area** — main#habit-content > div.css-g5y9jx:nth-of-type(4) "No habits yet. Track a yes/no habit or a" [1440px]

   89% of the section is empty: 240px under its last (button.css-g5y9jx.r-1loqt21), 44% beside content that covers under half the container, in its 516px of rows (WARN over 35%, FAIL over 50%)

5. **moment-none** — (the page) [1440px]

   a software page (--type) deals no moment: every kind carries one, two on a long page (moments.md)

6. **hero-screen** — main#habit-content > div.css-g5y9jx:nth-of-type(1) "Habit logTuesday, 10 November 2026Add ha" [1440px]

   the hero ends at 228px on a 900px screen, 672px above the fold: it ends at the fold, 1px either way (SR-1)

7. **hero-screen** — main#habit-content > div.css-g5y9jx:nth-of-type(2) "0 habits in your logSearch habitsFilter " [1440px]

   672px of the next section shows on the first screen (from 228px on a 900px screen): nothing below the hero shows at load (SR-1)

8. **section-height** — main#habit-content > div.css-g5y9jx:nth-of-type(3) "November 2026Today" [1440px]

   the section is 60px tall (0.1 screens), 840px short of one screen (900px): every section after the hero is one screen or two, 2px either way (SR-2)

9. **section-air** — main#habit-content > div.css-g5y9jx:nth-of-type(2) / main#habit-content > div.css-g5y9jx:nth-of-type(3) [1440px]

   16px of air between the content of these two sections: 128-480px (64-600px WARN) (every gap out of the band at 1440px, top to bottom: 16px after "0 habits in your log", 116px after "November 2026Today") (SR-3)

10. **section-air** — main#habit-content > div.css-g5y9jx:nth-of-type(4) "No habits yet.Track a yes/no habit or a " [1440px]

   the content fills 30.4% of the section's height (157 of 516px): 55% or more (40% WARN) (SR-3)

11. **one-section** — main#habit-content > div.css-g5y9jx:nth-of-type(1) > div.css-g5y9jx > h1.css-146c3p1 "Habit log" [1440px]

   the screen at scroll 0px (stride 0) shows 156px of section 1 and the heading of section 1 whole and the content of 4 sections, over 24px each beside section 4: a screen shows one section (another may peek 8px, 24px WARN) (SR-4)

12. **container-edges** — div#root > div.css-g5y9jx > div.css-g5y9jx > header.css-g5y9jx "Personal workspace/Habit logSaved on thi" [1440px]

   the nav's content runs 264px from the left and 48px from the right (read from its outermost blocks: no .wrap): 264 and 48px are not one margin; the margin is 64-120px at 1440px (one container, equal margins, 2px either way) (SR-6)

13. **container-edges** — main#habit-content > div.css-g5y9jx:nth-of-type(1) "Habit logTuesday, 10 November 2026Add ha" [1440px]

   the content of section 1 runs 264px from the left and 48px from the right (read from its outermost blocks: no .wrap): 264 and 48px are not one margin; the margin is 64-120px at 1440px (one container, equal margins, 2px either way) (SR-6)

14. **container-edges** — main#habit-content > div.css-g5y9jx:nth-of-type(2) "0 habits in your logSearch habitsFilter " [1440px]

   the content of section 2 runs 264px from the left and 48px from the right (read from its outermost blocks: no .wrap): 264 and 48px are not one margin; the margin is 64-120px at 1440px (one container, equal margins, 2px either way) (and 2 more like it: "November 2026Today", "No habits yet.Track a ye") (SR-6)

15. **container-edges** — a.skip-link "Skip to habit log" [1440px]

   a <a> at the top of the page, outside header.nav, main, footer.closing and nav.actionbar (SR-6)

16. **container-edges** — div#root "HabitsHabit log0Archived habits0Settings" [1440px]

   a <div> at the top of the page, outside header.nav, main, footer.closing and nav.actionbar (SR-6)

17. **container-edges** — div.css-g5y9jx:nth-of-type(2) > div.css-g5y9jx:nth-of-type(2) > div.css-g5y9jx > div.css-146c3p1 "Search habits" [1440px]

   1 text block starts on a left line at x 1027, 763px from the container's left: text starts on the container's left, or on one split line (x 744, 840, 936) (SR-6)

18. **container-edges** — div.css-g5y9jx.r-150rngu > div.css-g5y9jx > div.css-g5y9jx > div.css-146c3p1:nth-of-type(2) "No habits yet." [1440px]

   1 text block starts on a left line at x 731, 467px from the container's left: text starts on the container's left, or on one split line (x 744, 840, 936) (and 1 more like it: x 677) (SR-6)

19. **hero-fill** — main#habit-content > div.css-g5y9jx:nth-of-type(2) "Active Archived" [390px]

   the next section shows on the first screen: it starts at 188px on a 844px screen (the hero ends at 188px)

20. **button-styles** — (one screen) [390px]

   3 button styles on one screen: soft, fill #a1ffcb, outline #a1ffcb ("Add habit"); soft, fill #232323, outline #3c3c3c ("Active"); soft, outline #3c3c3c ("Today"); the odd one out: "Today"

21. **button-styles** — (the page) [390px]

   3 button styles on the page: soft, fill #a1ffcb, outline #a1ffcb x2 ("Add habit"); soft, fill #232323, outline #3c3c3c x1 ("Active"); soft, outline #3c3c3c x1 ("Today")

22. **container** — page [1440, 390px]

   no .wrap

## Retained WARNs


- **flush** — div.css-g5y9jx:nth-of-type(2) > div.css-g5y9jx:nth-of-type(2) > div.css-g5y9jx > input.css-11aywtz.r-6taxm2: div.css-g5y9jx:nth-of-type(2) and div.css-g5y9jx:nth-of-type(3) run together: 16px between their content, on one ground

- **flush** — main#habit-content > div.css-g5y9jx:nth-of-type(3) > button.css-g5y9jx.r-1loqt21: its button sits 16px above the rule on top of div.css-g5y9jx:nth-of-type(4)

- **copy-buttons** — div#root > div.css-g5y9jx > nav.css-g5y9jx > button.css-g5y9jx.r-1loqt21:nth-of-type(2) "Local workspace Connect sync": "Local workspace Connect sync" does not start with a verb (book, buy, try, start, get, see...) (and 2 more like it: "Filter & sort", "Today")

- **copy-actions** — (the page): the main action "Add habit" does not read word for word the same in the closing section

- **section-gaps** — main#habit-content > div.css-g5y9jx:nth-of-type(2) / main#habit-content > div.css-g5y9jx:nth-of-type(3): 16px between these sections, -47% against the median 30px

- **stranded-action** — div.css-g5y9jx.r-150rngu > div.css-g5y9jx > div.css-g5y9jx > button.css-g5y9jx.r-1loqt21 "Add your first habit": stands 289px down from the nearest text of its block ("")

- **share-meta** — head: the head lacks og:image, twitter:card: a shared link shows no picture or title of its own

- **section-air** — main#habit-content > div.css-g5y9jx:nth-of-type(3) / main#habit-content > div.css-g5y9jx:nth-of-type(4): 116px of air between the content of these two sections: 128-480px (64-600px WARN) (SR-3)

- **flush** — main#habit-content > div.css-g5y9jx:nth-of-type(2) > div.css-g5y9jx > button.css-g5y9jx.r-1loqt21:nth-of-type(1) "Active": div.css-g5y9jx:nth-of-type(2) and div.css-g5y9jx:nth-of-type(3) run together: 16px between their content, on one ground

- **empty-area** — main#habit-content > div.css-g5y9jx:nth-of-type(4) "No habits yet. Track a yes/no habit or a": 43% of the section is empty: 208px under its last (button.css-g5y9jx.r-1loqt21), in its 467px of rows (WARN over 35%, FAIL over 50%)

These warning labels refer to the app toolbar/collection layout and empty-state spacing. The share-meta warning remains because there is no static social share image. Familiar operational labels such as Today and Filter & sort are retained. No copy-lint WARN was kept.
