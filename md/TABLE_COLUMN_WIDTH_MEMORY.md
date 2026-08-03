# Table Column Width Memory (Reusable Process)

Use this whenever a table using the shared Table component has spacing/alignment issues (especially select icon columns looking too far from nearby columns).

## Goal

Make each table's percent widths predictable so the browser does not dump leftover width into one column.

## Why this happens

When total column percentages are less than 100% (for example 75% or 90%), the remaining width is distributed by layout rules. In auto layout, this can make the first/select/icon column look visually too wide or oddly spaced.

## Standard fix used

1. Keep icon/select/edit/delete columns at their intended narrow widths.
2. Increase one or more content columns so the table percentages total exactly 100%.
3. Prefer expanding the most flexible text column (for example name/section/email/description), not action columns.
4. Do not change TeacherTable unless explicitly requested.

## Process checklist

1. Find the table component file under src/Components/Tables/<TableName>/<TableName>.jsx.
2. Locate columns array and all withColumnWidth('<percent>%', minWidth) entries.
3. Add all percentages.
4. If total < 100:
   - Compute gap = 100 - total.
   - Add the gap to one flexible content column.
5. If total is already >= 100:
   - Usually do nothing for this specific issue.
6. Keep existing minWidth values unless there is truncation.
7. Re-check that final percentages sum to 100%.
8. Build/run and visually confirm row/header alignment.

## Formula

- gap = 100 - currentTotal
- newFlexibleColumn = oldFlexibleColumn + gap

## Last applied examples

- GradeSectionTable: grade 15% -> 25%, section 35% -> 50% (total 100%)
- GradeSchedulesTable: grace_period 20% -> 30% (total 100%)
- StudentTable: first_name 15% -> 22% (total 100%)
- SubjectTable: subject_name 45% -> 55% (total 100%)
- TeacherStudentViewTable: email 25% -> 35% (total 100%)

## Rules of thumb

- Do not widen select/action columns to solve this.
- Prefer one clean adjustment over many tiny tweaks.
- Keep behavior consistent across tables that share the base Table component.
