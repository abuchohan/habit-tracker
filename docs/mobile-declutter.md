GATE: FAIL 20 (round 1 of 3)

# Mobile and touch layout

Branch: `ui/mobile-declutter`.

The habit grid now sits directly below a single top bar on phones and touch devices. The large heading/date block, active/archive tabs, completion summary, month toolbar, recording hint and sync footer are removed from that layout. Add habit is the primary plus button in the top bar, alongside filters and Settings. Opening a habit replaces the app name with its name and provides a back button.

The filter sheet contains search, active/archive/all collections, sorting and the earlier/Today/later date controls with month context. Horizontal swiping continues to navigate the grid. Account and sync remain accessible through Settings, and errors still appear when an operation fails. Pointer-driven desktop layouts retain their existing workspace and context.

Compact layout follows narrow viewports or touch capability, including wide tablets and touch laptops. Native platforms always use it. Web capability changes update the layout without a reload. Controls retain 44px touch targets; the grid has equal side gutters and independently scrolls its habit list.

## Design taste application

Kind: software, an operational personal habit tracker. Preserve the existing white-mint-tiles palette, Host Grotesk and JetBrains Mono, rounded controls and unmodified motion assets. Neutral surfaces keep the history legible; mint distinguishes recorded entries and the primary action in dark mode. The working habit grid is the visual. The user's instruction to remove clutter takes precedence over adding marketing heroes, promotional sections, effects and scroll moments.

Voice: factual interface labels using the existing terms habit, entry, archive and dates. No invented facts, new brand name, photographs, client slots, stand-ins or assumed content. Existing real forms and storage remain connected; no new canonical domain or form endpoint is needed for this change.

## Verification

- Production web export, frontend lint and app/server type checks passed.
- All 18 applicable existing browser workflows passed across desktop Chrome and iPhone WebKit; four checks are deliberately limited to their relevant input platform. Updated workflows use the moved date and account controls. After the final spacing refinement, responsive and account-sync workflows passed again in both engines.
- Responsive checks cover 320x568, 390x844, 844x390, 768x1024, 1024x768 and 1440x900. They verify the grid starts within 16px of the top bar in compact mode, the list retains recording space, creation remains accessible, date reset works, archive switching works, Settings opens and the page does not overflow horizontally.
- Populated light/dark screenshots and the skill's production captures at 1440, 1024, 820, 768 and 390 were visually inspected. Skill captures are in `.taste-skill/shots/mobile-clean-*.png`; populated workflow captures are in `artifacts/`. Screenshots are ignored local artifacts.
- Existing interface-copy draft lint: zero failures and zero warnings.
- Native physical-device rendering, native keyboard/safe-area behavior and maximum Dynamic Type were not tested.

The first skill screenshot run stalled inside the Windows sandbox. Its elevated rerun and all subsequent viewport captures succeeded without changing the skill's files.

Follow-up: reverse date order now defaults to enabled, placing today at the right edge. Explicitly saved preferences are preserved. The date header is now the first sticky child of the habit-list scroll view, so the header and entries share the same width when a vertical scrollbar reserves space. Regression checks compare each date header's position and width with its entry column before and after scrolling, including a reserved scrollbar gutter, and verify that the header stays pinned.

Performance audit: zero failures, four warnings. The two viewports each warn about approximately 635.5 KiB of parsed JavaScript and a busy host CPU. Layout shift was 0.006 at desktop and 0.000 at phone width; there were no broken requests. These are local CPU measurements, not field data.

## Design gate findings

The skill's gate ran consistency checks at 1440 and 390, its layout checker and its 320px safety pass. Its 20 remaining findings describe a marketing page's structure or the preserved desktop workspace. Applying their proposed full-screen heroes, additional imagery, promotional navigation and spacious sections would conflict with the requested compact application. No waivers were added, no checker files were changed and no content was hidden from the checker. The requested interface work is complete; the marketing gate is not represented as passing.

All open findings are retained in `.taste-skill/gate.json`:

| Check | Location | Findings |
| --- | --- | ---: |
| hero-fill | Desktop toolbar appears below the heading on the first screen | 1 |
| nav | Desktop workspace lacks a marketing navigation bar | 1 |
| section-gaps | Desktop toolbar/month-row spacing | 1 |
| empty-area | Desktop and phone empty habit grids leave room for records | 2 |
| moment-none | Application has no promotional scroll moment | 1 |
| hero-screen | Desktop heading is shorter than a screen; toolbar follows it | 2 |
| section-height | Desktop month toolbar is shorter than a screen | 1 |
| section-air | Desktop toolbar/month spacing and empty-grid content density | 2 |
| one-section | Desktop heading, toolbar, month row and grid share a screen | 1 |
| container-edges | Desktop header, heading, toolbar, skip link, React root, search block and empty-state block do not use the marketing grid | 7 |
| container | React Native application does not contain a `.wrap` element | 1 |

Eight nonblocking consistency warnings remain: two `flush` warnings about adjacent desktop controls; `copy-buttons` for existing workspace/filter/Today labels; `copy-actions` for Add habit versus Add your first habit; `section-gaps` for the desktop toolbar; `stranded-action` for the empty-state button; `share-meta` for missing social share imagery; and `section-air` for the month/grid spacing. Existing labels and desktop spacing are retained because they describe functional app controls. Social share metadata is outside this mobile cleanup. The separate copy-draft lint has zero warnings.
