import { supabase } from '../lib/supabase';

/**
 * Deletes the given section IDs, then deletes any grade that no longer
 * has any sections remaining after that deletion.
 * grade_schedules rows for those grades are removed automatically via
 * the grade_schedules.grade_id ON DELETE CASCADE constraint.
 *
 * @param {Array<number|string>} sectionIds
 * @returns {Promise<{ deletedGradeIds: Array<number>, gradeDeleteError?: any }>}
 */
export async function deleteSectionsWithGradeCascade(sectionIds) {
  if (!sectionIds || sectionIds.length === 0) {
    return { deletedGradeIds: [] };
  }

  // 1. Look up which grades these sections belong to, before deleting them
  const { data: sectionsToDelete, error: fetchError } = await supabase
    .from('sections')
    .select('id, grade_id')
    .in('id', sectionIds);
  if (fetchError) throw fetchError;

  const affectedGradeIds = [...new Set((sectionsToDelete || []).map(s => s.grade_id))];

  // 2. Delete the requested sections
  const { error: deleteSectionsError } = await supabase
    .from('sections')
    .delete()
    .in('id', sectionIds);
  if (deleteSectionsError) throw deleteSectionsError;

  if (affectedGradeIds.length === 0) return { deletedGradeIds: [] };

  // 3. Of the affected grades, which ones now have zero sections left?
  const { data: remainingSections, error: remainingError } = await supabase
    .from('sections')
    .select('grade_id')
    .in('grade_id', affectedGradeIds);
  if (remainingError) throw remainingError;

  const gradesStillInUse = new Set((remainingSections || []).map(s => s.grade_id));
  const gradeIdsToDelete = affectedGradeIds.filter(id => !gradesStillInUse.has(id));

  if (gradeIdsToDelete.length === 0) return { deletedGradeIds: [] };

  // 4. Delete now-empty grades (grade_schedules cascades automatically)
  const { error: deleteGradesError } = await supabase
    .from('grades')
    .delete()
    .in('id', gradeIdsToDelete);

  if (deleteGradesError) {
    console.error('Failed to delete now-empty grade(s):', deleteGradesError);
    return { deletedGradeIds: [], gradeDeleteError: deleteGradesError };
  }

  return { deletedGradeIds: gradeIdsToDelete };
}

/**
 * Given the section rows about to be deleted and the full current list of
 * sections, returns which grades would end up with zero sections left.
 * Pure/synchronous — uses already-loaded data, does not hit the DB.
 * This is a "would this happen" preview for warning copy; the actual
 * cascade delete still re-checks live data at execution time.
 */
export function computeGradesThatWouldBecomeEmpty(entitiesBeingDeleted, allSectionsData) {
  const deletingIds = new Set(entitiesBeingDeleted.map(e => String(e.id)));
  const gradeIdsBeingTouched = new Set(entitiesBeingDeleted.map(e => e.grade_id));

  const remainingCountByGrade = {};
  allSectionsData.forEach(section => {
    if (!gradeIdsBeingTouched.has(section.grade_id)) return;
    if (deletingIds.has(String(section.id))) return;
    remainingCountByGrade[section.grade_id] = (remainingCountByGrade[section.grade_id] || 0) + 1;
  });

  const emptiedGrades = [];
  gradeIdsBeingTouched.forEach(gradeId => {
    if (!remainingCountByGrade[gradeId]) {
      const example = entitiesBeingDeleted.find(e => e.grade_id === gradeId);
      emptiedGrades.push({ grade_id: gradeId, grade_level: example?.grade });
    }
  });

  return emptiedGrades;
}