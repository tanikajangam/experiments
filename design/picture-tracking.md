# Picture Tracking Spec

Nov 7, 2026 · @Tanika Jangam

## Summary

For a picture-tracked habit, the photos are the log: hitting the day's photo target marks it done, with no separate Yes/No step. Photos come in from the camera, from a bulk upload, or one at a time through the day, and every photo lands on the day it was taken. A past day that already counts as a miss stays a miss even if a photo turns up for it later. Each day is shown as a collage of its photos.

Decisions already made (from the 4 questions on Nov 7):

| Question | Decision |
| --- | --- |
| What a photo means for the check-in | Photos are the log. Each habit sets a photo target per day; meeting it = done, fewer = miss. |
| Where a bulk upload lands | On the day each photo was taken, read from the image's timestamp. |
| A photo lands on a past missed day | The photo is kept with that day; the day stays a miss. |
| Which photo stands for a day | A collage of all that day's photos. |

This spec covers the prototype's next step only: taking, uploading and viewing photos. The 65-day recap video is parked at the end.

## Problem and goals

A Yes/No tap is easy to fake and tells you nothing later. A photo is proof you did the thing, and after 65 days it becomes a record you can look back on. For habits like "eat 3 meals a day", the photo is also the natural moment of logging: you are already holding the plate.

Goals:

- Logging a photo-tracked habit takes one tap from the Home row: camera opens, shutter, done.
- A day's photos are grouped under that day, so the Analysis screen shows what the day actually looked like.
- The consistency math stays exactly as it is. A photo day resolves to done or missed the same way a Yes/No day does.
- Catching up is possible (upload a week of photos at once) without making it a way to rewrite the record.

Non-goals for this round:

- No photo editing, captions on individual photos, or sharing.
- No AI reading of the photos (counting meals, checking the gym). The photo count is the signal.
- No recap video. That is parked in its own section below.
- No cloud sync or multi-device. Photos stay on the phone for now.

## How a photo becomes a log

A photo-tracked habit has a photo target per day, set on the New Experiment screen when Picture is chosen (a small stepper next to the chip, default 1). A scheduled day is done when the number of photos taken that day reaches the target.

| Scheduled day | Photos taken that day | Status |
| --- | --- | --- |
| Today, target 3 | 0 to 2 so far | Pending, with a "2/3" counter on the Home row |
| Today, target 3 | 3 or more | Done |
| Past day, target 3 | 0 to 2 | Missed (counts in the sliding average) |
| Past day, target 3 | 3 or more, taken that day | Done |
| Not a scheduled day | any | Stored with the day, not counted |

Rules that follow from the decisions:

- The day closes at midnight, phone local time. A photo taken at 11:50 pm counts for that day; one taken at 12:10 am counts for the next.
- Only photos taken on the day count toward it, so a photo from the camera roll with yesterday's timestamp goes to yesterday. If yesterday is already a miss, it stays a miss (see Edge cases for the one grey area).
- A day with more photos than the target is simply done; extras are kept and shown.
- Deleting a photo recounts the day. Deleting below the target on a past day turns it back into a miss.
- The sliding average, tiers, streaks and the trend chart do not change. They read done/missed per scheduled day, and photo days resolve to the same two states.

For habits still tracked by Check-in, nothing changes. Photos can still be attached to a Check-in day as part of the note, but they do not affect its status; the Yes/No does.

## Three ways photos get in

All three paths end in the same place: a photo stored against one habit and one day. Only the entry point and the date source differ.

| Path | Where it starts | How the day is set | What the user sees after |
| --- | --- | --- | --- |
| Take a photo | Camera button on the Home row of any photo habit due today, and on the Log screen | Today, always | Shutter, a quick thumbnail, counter ticks ("2/3"). Camera stays open for the next one. |
| Upload several | "Upload photos" on the Log screen, opens the phone's photo picker with multi-select | Each photo's taken-at timestamp | A review sheet grouped by day: "Tue Nov 3 · 3 photos · done", "Wed Nov 4 · 1 photo · stays missed". Confirm to save. |
| Add through the day | The same camera button, or the day's row on Analysis | Today | The day's strip grows; the counter updates. |

Details per path:

**Take a photo.** The Log screen for a photo habit replaces the Yes/No buttons with a big camera button and a strip of today's photos so far. The note field and mic stay underneath. There is no Submit; each photo saves itself. The Home row's "Log today" button becomes a camera icon for photo habits.

**Upload several.** The review sheet is the important part. It shows each day the photos fall on, how many, and what will happen to that day's status, so the user knows before confirming that a late photo will not rescue a missed day. Photos with no timestamp are listed under "No date" and the user picks a day for them (today by default).

**Add through the day.** Nothing new to build; it is the camera path used more than once. The only rule is that photos append, never replace, so a day can hold more than its target.

A photo belongs to exactly one habit. The user is always inside a habit when they take or upload, so there is no step to assign it.

## Where photos show up

Photos live on the Analysis screen, grouped by day, newest day first. Home and the Log screen only show today's.

| Screen | What changes |
| --- | --- |
| Home row | For a photo habit due today: a camera icon instead of "Log today", with the counter ("2/3") next to it. Once the target is met it shows "Logged" as now. |
| Log screen | Camera button, today's photo strip, then the note field and mic. No Yes/No, no Submit. |
| Analysis, day card and consistency | Unchanged. Segments and bars read done/missed as before. |
| Analysis, new Photos section | A grid of day collages, newest first, each tile labelled with the date and its count ("Nov 6 · 3"). A missed day with photos shows the collage with an orange edge and "2/3". Tap a tile to open that day. |
| Analysis, Notes section | Becomes "Notes and photos". Each note shows its day's collage beside the text, so the note and the pictures from that day read together. |
| Day view (new) | One day of one habit: the photos full width in a swipeable strip, the note, the status, and the camera button if it is today. Long-press a photo to delete it. |

The day collage is the one visual rule to get right. It is a square tile built from that day's photos: 1 photo fills it, 2 split it vertically, 3 put one on the left and two stacked on the right, 4 or more make a 2×2 grid with "+2" on the last cell. It is the same tile everywhere a day is shown, so the user learns it once.

The Analysis header gets one line of totals: "41 photos over 14 days". Nothing else is counted.

## Edge cases

| Case | What happens | Why |
| --- | --- | --- |
| Photo taken yesterday, uploaded today, yesterday is a miss | Stored under yesterday; yesterday stays a miss. The review sheet says so before saving. | Your decision: late photos never rewrite the record. |
| Photo taken yesterday, uploaded today, yesterday was still pending | Cannot happen. A day that passes without its target is a miss at midnight. | Pending only ever means today. |
| Photo taken today in the camera app, uploaded tonight | Counts for today. | Same day, same rule as the in-app camera. |
| Timestamp missing or clearly wrong (a screenshot, a forwarded image) | Listed under "No date" on the review sheet; user picks a day, today by default. | A guessed date is worse than asking. |
| Same photo uploaded twice | Second copy is skipped (same file hash). | Otherwise one plate could be three meals. |
| Photo deleted on a past done day, count drops below target | Day becomes a miss again. | The log is the photos; remove them and the log goes with them. |
| Habit switched from Check-in to Picture mid-trial | Past days keep their Yes/No status. Only days from the switch onward use the photo target. | Rewriting history would change the sliding average for no reason. |
| Photo target changed mid-trial (3 meals to 2) | Applies from today on. Past days are judged by the target they had. | Same. |
| Photo on a day that is not scheduled (gym photo on a Tuesday) | Stored and shown under that day, not counted. | Extra effort is kept, but the schedule defines what counts. |
| Phone storage | Photos are saved at a reduced size (long edge 1600 px, about 300 KB). 65 days × 3 photos is roughly 60 MB per habit. | Full-size originals stay in the camera roll. |

## Data model changes to the prototype

Two additions to what the prototype already stores, and one rule change in how a day's status is read.

| Field | On | Type | Notes |
| --- | --- | --- | --- |
| `tracking` | experiment | `check` or `picture` | Already exists; `picture` becomes selectable. |
| `photoTarget` | experiment | integer, 1–6 | New. Only used when `tracking` is `picture`. Default 1. |
| `photos` | experiment | list of `{ id, day, takenAt, source, thumb }` | New. `day` is the local date the photo counts for; `source` is `camera` or `upload`. |

Status of a scheduled day, as the prototype computes it today versus after:

```markdown
Check-in habit (unchanged):
  logged Yes  -> done
  logged No   -> missed
  no log, past -> missed
  no log, today -> pending

Picture habit (new):
  photos that day >= photoTarget -> done
  fewer, past  -> missed
  fewer, today -> pending (counter shows n/target)
```

Everything downstream (window of the last 7 scheduled days, tiers, streaks, trend bars) takes the status and does not care how it was reached.

In the prototype, photos will be placeholder tiles rather than real camera input, since the canvas cannot open a camera. The seeded "Eat 3 meals a day" experiment switches to `picture` with a target of 3, so the Photos section and the collage tiles have something to show.

## The 65-day recap, parked

At the end of the trial, the app stitches the day collages into a short video: one tile per scheduled day in order, about half a second each, so a daily habit runs 30 seconds and a 3-day-a-week one about 14. Missed days appear as a blank tile in the orange miss colour, so the video is honest about the gaps. The last frame is the final consistency number.

This is not in scope for the next prototype round. What the design above does to make it cheap later: the day collage is already the video frame, photos are already in day order, and misses are already known per day. The recap needs only an export step and a share sheet.

Two things to decide when it comes up: whether missed days are shown or skipped (shown is more honest, skipped is more shareable), and whether the recap plays automatically on the Decision screen at day 65 or waits for a tap.

## Open questions

These decide details that are not settled yet. Everything above can go on the prototype without them; they change small things.

- [ ] Decided Nov 7: the day ends at 12 am, local time. A photo at 12:20 am counts for the next day.
- [ ] Should the photo target be editable after the experiment starts? The spec says yes, applying from today on. Locking it would be simpler and fits the "experiment" framing.
- [ ] Can a Check-in habit accept photos at all? The spec says yes as note attachments that do not affect status. Dropping that keeps the two tracking modes cleanly separate.
- [ ] Does "Logged" on the Home row need the count once the target is met ("Logged · 4") or just "Logged"?
- [ ] For the Analysis Photos grid: all days since day 1, or the last 14 with a "see all"? A 65-day daily habit is 65 tiles, which is a long scroll under the charts.
- [ ] Reduced-size copies in the app, or references to the camera roll? Copies are safe if the user deletes from the roll but use about 60 MB per daily habit.
