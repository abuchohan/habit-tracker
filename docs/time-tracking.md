# Time-of-day habits

Create or edit a habit, select **Time of day**, then select **24-hour** or **12-hour (AM/PM)**. Tap a day to enter the time or select **Use current time**, then save. Opening an entry does not automatically mark it done. Done entries require a valid time; Missed, Skip and Clear remove the saved time. Notes remain available.

The grid shows the recorded time, with AM/PM on a separate line in 12-hour mode. Details show today's recorded time and the most recent 30 recorded times; the calendar can open older entries. Time-based habits are available in the tracking-type filter. Existing yes/no habits can be changed to Time of day; old completions are retained without inventing timestamps.

Times are local clock values stored as `HH:mm`, independent of the per-habit display format. Switching format preserves the recorded time, including midnight and noon. Completion, frequency and streak calculations follow the existing yes/no rules. Changing the date in the entry editor loads that day's existing entry rather than copying the previous day's time.

Existing records remain valid. JSON backups, sync and the app's SQLite backup metadata preserve the tracking type, format and recorded time. CSV includes a `Time (24h)` column. Loop's native tables represent time-based habits as yes/no completions with the recorded time included in entry notes; the app's embedded backup restores the original records exactly. No database migration is needed because sync stores validated JSON records. The updated server must accompany clients that use the new tracking type.

Validation: production export, lint and app/server type checks passed. All 19 core tests and 22 applicable browser workflows passed (four platform-specific browser checks skipped). Tests cover invalid times, midnight/noon, both display formats, manual/current-time entry, editing, reload persistence, switching dates, Missed/Skip/Clear, scoring, backup round trips and API sync. Populated desktop and iPhone screenshots are in ignored `artifacts/*-time-habit.png`. Native physical-device testing was not performed.

The existing mobile design system is retained: no additional main-screen controls, one compact time display per entry, the existing scrollable editor and 44px controls.
