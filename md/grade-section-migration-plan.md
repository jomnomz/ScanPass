# Migration Plan: Remove Redundant `grade`/`section` Text Columns

**Goal:** Eliminate `students.grade` and `students.section` (VARCHAR) in favor of
`grade_id` → `grades.grade_level` and `section_id` → `sections.section_name`
everywhere in the codebase, then drop the redundant columns.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 0 — Safety net (do this FIRST, before touching any app code)

- [ ] Add the DB trigger from the earlier message so `grade`/`section` auto-sync
      from `grade_id`/`section_id` on every write. This means that **while you're
      mid-refactor**, any code path you haven't updated yet still shows correct
      data — nothing breaks halfway through.

```sql
create or replace function sync_student_grade_section_text()
returns trigger as $$
begin
  if new.grade_id is not null then
    select grade_level into new.grade from grades where id = new.grade_id;
  end if;
  if new.section_id is not null then
    select section_name into new.section from sections where id = new.section_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_student_grade_section
before insert or update on students
for each row
execute function sync_student_grade_section_text();
```

- [ ] Confirm existing `trg_students_normalize_contact_fields` trigger doesn't
      conflict (check trigger execution order — Postgres runs triggers
      alphabetically by name for the same event, so `sync_...` may fire before
      or after `normalize_...`; verify `normalize_contact_fields` doesn't touch
      grade/section, so order shouldn't matter here).

Once this is in place, **nothing in your app can desync the two representations**
even mid-refactor. This removes the time pressure — you can genuinely go file by
file without rushing.

---

## Phase 1 — Establish the query pattern

Before editing components, decide the one canonical Supabase select shape and
use it everywhere. Based on your codebase, standardize on:

```js
supabase.from("students").select(`
    id, first_name, last_name, lrn,
    grade_id, section_id,
    grade:grades!grade_id ( grade_level ),
    section:sections!section_id ( section_name )
  `);
```

This returns `student.grade.grade_level` and `student.section.section_name` as
nested objects — matching the pattern already used correctly in places like
`useAttendance.js` and `GradeSectionTable.jsx` (`sections.grade:grades!grade_id`).

**Naming collision to resolve:** right now `student.grade` sometimes means the
text column (string) and sometimes the joined object (`{grade_level}`),
depending on which query ran. Pick ONE meaning going forward. Recommended:
after the refactor, `grade`/`section` on a fetched student object should
**always** be the joined object, never a raw string. Search-and-replace
raw-string usages first (Phase 3) to avoid this ambiguity biting you.

---

## Phase 2 — File inventory from your grep output

Group files by risk level. Do low-risk first to build momentum and validate
the pattern before touching reports/exports (highest blast radius).

### 2a. Low risk — read-only display, easy to verify visually

- [ ] `Components/Tables/GuardianTable/GuardianTable.jsx`
- [ ] `Components/Tables/MessageTable/MessageTable.jsx`
- [ ] `Components/NavBars/NavBar/NavBar.jsx`
- [ ] `Components/Modals/QRCodeModal/QRCodeModal.jsx`
- [ ] `Components/Modals/DownloadQRModal/DownloadQRModal.jsx`
- [ ] `Utils/Formatters.js` — already has the `typeof === 'object'` branch
      handling both shapes; simplify once all callers pass the joined object

### 2b. Medium risk — filtering/sorting logic (behavior bugs if done wrong)

- [ ] `Components/Tables/AttendanceTable/AttendanceTable.jsx`
      (`attendance.grade === currentClass`, `attendance.section === selectedSection`)
- [ ] `Components/Tables/StudentTable/StudentTable.jsx`
      (edit form read/write path — this one WRITES `grade`/`section`, not just reads)
- [ ] `Components/Tables/TeacherTable/TeacherTable.jsx`
      (`sectionIdMap[`${row.grade}|${row.section}`]` — string-key lookup, needs
      to become an ID-based map key)
- [ ] `Components/Tables/GradeSectionTable/GradeSectionTable.jsx`
      (writes `grade_id` via lookup already — good reference pattern to copy)
- [ ] `Pages/AdminPages/AdminStudents/AdminStudents.jsx`
- [ ] `Pages/AdminPages/AdminGuardians/AdminGuardians.jsx`
- [ ] `Utils/SortEntities.js` — `parseInt(a.grade)` assumes a string; will need
      `parseInt(a.grade?.grade_level ?? a.grade)` during transition, then
      simplify once fully migrated
- [ ] `Utils/CompareHelpers.js` — same parseInt pattern

### 2c. High risk — the "combined string" parsing logic

- [ ] `Utils/exportEntity.js` — has `className.grade`/`className.section` split
      logic in multiple places; also the export column source
- [ ] Find and audit `parseClassName` (referenced in `ClassAttendanceReportTable.jsx`,
      `TeacherAttendanceTable.jsx`, `TeacherStudentViewTable.jsx`) — this function
      splits a `"Grade X-Section Y"` string back into parts. **This needs to be
      replaced with passing `grade_id`/`section_id` directly through props/state
      instead of encoding them into a string and re-parsing.** This is the
      riskiest piece — plan to do it last, with manual testing of every screen
      that uses "current class" selection.

### 2d. Highest risk — reports & exports (silent-bug territory)

- [ ] `Utils/exportEntity.js` (CSV/export column mapping)
- [ ] `Components/Tables/ReportTable/ReportTable.jsx`
- [ ] `Components/Tables/AttendanceReportTable/AttendanceReportTable.jsx`
- [ ] `Components/Tables/ClassAttendanceReportTable/ClassAttendanceReportTable.jsx`
- [ ] `Components/Modals/ReportGenerationModal/ReportGenerationModal.jsx`
- [ ] `Components/Modals/StudentReportModal/StudentReportModal.jsx`
- [ ] `Components/Modals/ClassAttendanceReportModal/ClassAttendanceReportModal.module.css`
      (css only — check for grade/section-dependent class names, low priority)
- [ ] `Pages/AdminPages/AdminReports/AdminReports.jsx`

**Do these last, and manually diff a generated report/export before and after**
each change — these produce artifacts (PDFs, CSVs) that people may archive,
so a silent mislabel here is the worst-case outcome.

### 2e. Write paths — the ones that currently SET `.grade`/`.section`

These are the most important to get right, since a write bug corrupts data,
not just display:

- [ ] `Utils/EntityService.js` — lines ~332, 361 (`finalUpdates.grade = grade.grade_level`,
      `finalUpdates.section = section.section_name`). **Once the DB trigger from
      Phase 0 is live, these lines become redundant — you can delete them** and
      just write `grade_id`/`section_id`; the trigger keeps the text columns
      in sync automatically until you drop them entirely.
- [ ] `Components/Tables/StudentTable/StudentTable.jsx` (`updateData.grade = ...`)
- [ ] `Components/Tables/GuardianTable/GuardianTable.jsx` (`grade: updatedGuardian.grade`)
- [ ] `Components/Tables/GradeSectionTable/GradeSectionTable.jsx`

### 2f. Validation logic — needs rethinking, not just renaming

- [ ] `Utils/StudentDataValidation.js` — `student.grade?.trim()` assumes string;
      needs to become `student.grade_id != null` check
- [ ] `Utils/MasterDataValidation.js` — same pattern, plus a regex check
      (`/^\d+$/.test(data.grade.trim())`) that only makes sense for text input
      forms (this one might legitimately stay as form validation on a select
      dropdown's raw value, not the DB column — confirm before changing)

---

## Phase 3 — Suggested order of attack

1. Phase 0 (trigger) — do this today, takes 10 minutes, de-risks everything else.
2. `EntityService.js` write paths — remove the manual text-sync lines since the
   trigger now handles it. Quick, low-risk, immediately reduces duplicated logic.
3. 2a (low-risk display components) — validates your join pattern works end-to-end.
4. 2e remaining write paths.
5. 2b (filters/sorts).
6. 2f (validation).
7. 2c (`parseClassName` and combined-string logic) — hardest, do with care.
8. 2d (reports/exports) — do last, diff output carefully.
9. Re-run the consistency-check query from earlier — should still return 0 rows.
10. Grep again for `\.grade\b` and `\.section\b` in `src/` — anything left should
    only be the _joined object_ access (`.grade.grade_level`), never a bare
    string read of the old column. Any remaining bare-string reads mean a file
    was missed.
11. Only once the grep is clean: run the `NOT NULL` + `drop column` SQL from
    the original plan.

---

## Notes / things to double check as you go

- `Utils/gradeSectionCascade.js` — handles what happens when a grade is emptied
  of sections; check if it references `example?.grade` as text anywhere that
  needs updating (grep showed `grade_level: example?.grade` at line 83).
- `Components/Hooks/useEntityEdit.js` and `useEntities.js` are shared hooks used
  by multiple entity types (students, guardians?) — changes here have wider
  blast radius, test all consumers.
- Keep the Phase 0 trigger in place until Phase 2 is **fully** done and the
  final grep is clean — don't drop columns early "to force yourself" to finish;
  that risks a broken app mid-refactor.