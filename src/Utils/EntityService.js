import { supabase } from "../lib/supabase"; 

// Base entity service
export class EntityService {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async fetchAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*');
    
    if (error) throw error;
    return data || [];
  }

  async fetchByField(field, value) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq(field, value);
    
    if (error) throw error;
    return data || [];
  }

  async update(id, updates) {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }

  async create(data) {
    const { data: newData, error } = await supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return newData;
  }
}

// Teacher-specific service with assignment methods
export class TeacherService extends EntityService {
  constructor() {
    super('teachers');
  }

  async fetchAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        created_by_user:users!teachers_created_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        ),
        updated_by_user:users!teachers_updated_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        )
      `);
    
    if (error) throw error;
    return data || [];
  }

  async update(id, updates) {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        created_by_user:users!teachers_created_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        ),
        updated_by_user:users!teachers_updated_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        )
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  // NEW: Get teacher's assigned subjects - UPDATED
  async getTeacherSubjects(teacherId) {
    const { data, error } = await supabase
      .from('teacher_subjects')
      .select(`
        subject_id,
        subject:subjects(subject_code, subject_name)
      `)
      .eq('teacher_id', teacherId);
    
    if (error) {
      console.error('Error fetching teacher subjects:', error);
      return { data: [], error };
    }
    
    return { data: data || [], error: null };
  }

  // NEW: Get teacher's assigned sections - UPDATED
  async getTeacherSections(teacherId) {
    const { data, error } = await supabase
      .from('teacher_sections')
      .select(`
        section_id,
        is_adviser,
        section:sections(
          id,
          section_name,
          grade:grades(grade_level)
        )
      `)
      .eq('teacher_id', teacherId);
    
    if (error) {
      console.error('Error fetching teacher sections:', error);
      return { data: [], error };
    }
    
    return { data: data || [], error: null };
  }

  // NEW: Get teacher's subject-section assignments - UPDATED
  async getTeacherSubjectSections(teacherId) {
    const { data, error } = await supabase
      .from('teacher_subject_sections')
      .select(`
        subject_id,
        section_id,
        subject:subjects(subject_code, subject_name),
        section:sections(
          section_name,
          grade:grades(grade_level)
        )
      `)
      .eq('teacher_id', teacherId);
    
    if (error) {
      console.error('Error fetching teacher subject-sections:', error);
      return { data: [], error };
    }
    
    return { data: data || [], error: null };
  }

  // NEW: Get teacher's complete assignments - UPDATED
  async getTeacherAssignments(teacherId) {
    try {
      const [subjectsResult, sectionsResult, assignmentsResult] = await Promise.all([
        this.getTeacherSubjects(teacherId),
        this.getTeacherSections(teacherId),
        this.getTeacherSubjectSections(teacherId)
      ]);

      console.log('📊 Teacher assignments fetched:', {
        teacherId,
        subjects: subjectsResult.data?.length || 0,
        sections: sectionsResult.data?.length || 0,
        assignments: assignmentsResult.data?.length || 0
      });

      return {
        subjects: subjectsResult.data || [],
        sections: sectionsResult.data || [],
        assignments: assignmentsResult.data || [],
        error: null
      };
    } catch (error) {
      console.error('Error fetching teacher assignments:', error);
      return {
        subjects: [],
        sections: [],
        assignments: [],
        error
      };
    }
  }

  // NEW: Update teacher assignments - FIXED to always delete first
  async updateTeacherAssignments(teacherId, assignments) {
    try {
      // ALWAYS delete existing assignments first (clears everything)
      
      // 1. Delete all subject assignments
      const { error: deleteSubjectsError } = await supabase
        .from('teacher_subjects')
        .delete()
        .eq('teacher_id', teacherId);
      
      if (deleteSubjectsError) throw deleteSubjectsError;

      // 2. Delete all section assignments
      const { error: deleteSectionsError } = await supabase
        .from('teacher_sections')
        .delete()
        .eq('teacher_id', teacherId);
      
      if (deleteSectionsError) throw deleteSectionsError;

      // 3. Delete all subject-section assignments
      const { error: deleteAssignmentsError } = await supabase
        .from('teacher_subject_sections')
        .delete()
        .eq('teacher_id', teacherId);
      
      if (deleteAssignmentsError) throw deleteAssignmentsError;

      // 4. Insert new subject assignments (if any)
      if (assignments.subjectIds && assignments.subjectIds.length > 0) {
        const subjectAssignments = assignments.subjectIds.map(subjectId => ({
          teacher_id: teacherId,
          subject_id: subjectId
        }));
        
        const { error: subjectsError } = await supabase
          .from('teacher_subjects')
          .insert(subjectAssignments);
        
        if (subjectsError) throw subjectsError;
      }

      // 5. Insert new section assignments with adviser flag (if any)
      if (assignments.sectionIds && assignments.sectionIds.length > 0) {
        const sectionAssignments = assignments.sectionIds.map(sectionId => ({
          teacher_id: teacherId,
          section_id: sectionId,
          is_adviser: assignments.adviserSectionId === sectionId
        }));
        
        const { error: sectionsError } = await supabase
          .from('teacher_sections')
          .insert(sectionAssignments);
        
        if (sectionsError) throw sectionsError;
      }

      // 6. Insert new subject-section assignments (if both exist)
      if (assignments.subjectIds?.length > 0 && assignments.sectionIds?.length > 0) {
        const teachingAssignments = [];
        
        assignments.subjectIds.forEach(subjectId => {
          assignments.sectionIds.forEach(sectionId => {
            teachingAssignments.push({
              teacher_id: teacherId,
              subject_id: subjectId,
              section_id: sectionId
            });
          });
        });
        
        const { error: assignmentsError } = await supabase
          .from('teacher_subject_sections')
          .insert(teachingAssignments);
        
        if (assignmentsError) throw assignmentsError;
      }

      return { success: true, message: 'Teacher assignments updated successfully' };
    } catch (error) {
      console.error('Error updating teacher assignments:', error);
      return { success: false, error: error.message };
    }
  }
}

// Student-specific service - UPDATED WITH PROPER SYNC BETWEEN TEXT AND FOREIGN KEYS
export class StudentService extends EntityService {
  constructor() {
    super('students');
  }

  async fetchAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        grade_info:grades!grade_id (
          id,
          grade_level
        ),
        section_info:sections!section_id (
          id,
          section_name,
          grade:grades!grade_id (
            grade_level
          )
        ),
        created_by_user:users!students_created_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        ),
        updated_by_user:users!students_updated_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        )
      `);
    
    if (error) throw error;
    
    // Transform data - prioritize text fields for display
    const transformedData = (data || []).map(student => {
      // Use text fields first (these are what Excel uploads use)
      // If text fields are empty, use the relational data
      const gradeText = student.grade || student.grade_info?.grade_level || 'N/A';
      const sectionText = student.section || student.section_info?.section_name || 'N/A';
      
      return {
        ...student,
        grade: gradeText,
        section: sectionText,
        // Keep the foreign keys
        grade_id: student.grade_id,
        section_id: student.section_id,
        // Also keep the relational data for reference
        grade_info: student.grade_info,
        section_info: student.section_info
      };
    });
    
    return transformedData;
  }

  async fetchByGrade(grade) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        grade_info:grades!grade_id (
          id,
          grade_level
        ),
        section_info:sections!section_id (
          id,
          section_name,
          grade:grades!grade_id (
            grade_level
          )
        ),
        created_by_user:users!students_created_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        ),
        updated_by_user:users!students_updated_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        )
      `)
      .eq('grade', grade); // Filter by text field
    
    if (error) throw error;
    
    // Transform data - prioritize text fields for display
    const transformedData = (data || []).map(student => {
      const gradeText = student.grade || student.grade_info?.grade_level || 'N/A';
      const sectionText = student.section || student.section_info?.section_name || 'N/A';
      
      return {
        ...student,
        grade: gradeText,
        section: sectionText,
        grade_id: student.grade_id,
        section_id: student.section_id,
        grade_info: student.grade_info,
        section_info: student.section_info
      };
    });
    
    return transformedData;
  }

  async update(id, updates) {
    console.log('🔄 StudentService.update() called with:', { id, updates });
    
    // Prepare final updates with sync between text fields and foreign keys
    let finalUpdates = { ...updates };
    
    // SYNC LOGIC: Keep text fields and foreign keys in sync
    
    // 1. If grade_id is being updated, update the text grade field too
    if (updates.grade_id !== undefined && updates.grade_id !== null) {
      console.log('🔍 Fetching grade text for grade_id:', updates.grade_id);
      const { data: grade, error: gradeError } = await supabase
        .from('grades')
        .select('grade_level')
        .eq('id', updates.grade_id)
        .single();
      
      if (gradeError) {
        console.error('❌ Error fetching grade:', gradeError);
      } else if (grade) {
        finalUpdates.grade = grade.grade_level; // Sync text field
        console.log('✅ Synced grade text to:', grade.grade_level);
      }
    } 
    // 2. If grade (text) is being updated, find the matching grade_id
    else if (updates.grade !== undefined && updates.grade !== null && updates.grade !== '') {
      console.log('🔍 Finding grade_id for grade text:', updates.grade);
      const { data: grade, error: gradeError } = await supabase
        .from('grades')
        .select('id')
        .eq('grade_level', updates.grade)
        .single();
      
      if (gradeError) {
        console.error('❌ Error finding grade:', gradeError);
      } else if (grade) {
        finalUpdates.grade_id = grade.id; // Sync foreign key
        console.log('✅ Found grade_id:', grade.id, 'for grade:', updates.grade);
      } else {
        console.error('❌ Grade not found for text:', updates.grade);
        // Keep grade text but set grade_id to null
        finalUpdates.grade_id = null;
      }
    }
    
    // 3. If section_id is being updated, update the text section field too
    if (updates.section_id !== undefined && updates.section_id !== null) {
      console.log('🔍 Fetching section text for section_id:', updates.section_id);
      const { data: section, error: sectionError } = await supabase
        .from('sections')
        .select('section_name')
        .eq('id', updates.section_id)
        .single();
      
      if (sectionError) {
        console.error('❌ Error fetching section:', sectionError);
      } else if (section) {
        finalUpdates.section = section.section_name; // Sync text field
        console.log('✅ Synced section text to:', section.section_name);
      }
    } 
    // 4. If section (text) is being updated, we need grade_id to find the correct section
    else if (updates.section !== undefined && updates.section !== null && updates.section !== '') {
      // We need grade_id to find the correct section
      const gradeId = finalUpdates.grade_id;
      
      if (gradeId) {
        console.log('🔍 Finding section_id for section text:', updates.section, 'in grade_id:', gradeId);
        const { data: section, error: sectionError } = await supabase
          .from('sections')
          .select('id')
          .eq('section_name', updates.section)
          .eq('grade_id', gradeId)
          .single();
        
        if (sectionError && sectionError.code !== 'PGRST116') {
          console.error('❌ Error finding section:', sectionError);
        } else if (section) {
          finalUpdates.section_id = section.id; // Sync foreign key
          console.log('✅ Found section_id:', section.id, 'for section:', updates.section);
        } else {
          console.error('❌ Section not found for text:', updates.section, 'in grade_id:', gradeId);
          // Keep section text but set section_id to null
          finalUpdates.section_id = null;
        }
      } else {
        console.log('⚠️ Cannot find section without grade_id');
        // Keep section text but set section_id to null
        finalUpdates.section_id = null;
      }
    }
    
    // Clean up: remove any undefined or null values that might cause errors
    Object.keys(finalUpdates).forEach(key => {
      if (finalUpdates[key] === undefined || finalUpdates[key] === '') {
        finalUpdates[key] = null;
      }
    });
    
    console.log('💾 Final updates to save:', finalUpdates);
    
    // Perform the update
    const { data, error } = await supabase
      .from(this.tableName)
      .update(finalUpdates)
      .eq('id', id)
      .select(`
        *,
        grade_info:grades!grade_id (
          id,
          grade_level
        ),
        section_info:sections!section_id (
          id,
          section_name,
          grade:grades!grade_id (
            grade_level
          )
        ),
        created_by_user:users!students_created_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        ),
        updated_by_user:users!students_updated_by_fkey(
          user_id,
          username,
          email,
          first_name,
          last_name
        )
      `)
      .single();
    
    if (error) {
      console.error('❌ Database update error:', error);
      throw error;
    }
    
    console.log('✅ Student updated successfully:', data);
    
    // Transform the single student record
    const transformedStudent = {
      ...data,
      // Use text fields for display (they should now be synced)
      grade: data.grade || data.grade_info?.grade_level || 'N/A',
      section: data.section || data.section_info?.section_name || 'N/A',
      grade_id: data.grade_id,
      section_id: data.section_id,
      grade_info: data.grade_info,
      section_info: data.section_info
    };
    
    return transformedStudent;
  }

  async generateTokenForStudent(id) {
    const token = crypto.randomUUID();
    return this.update(id, { qr_verification_token: token });
  }
  
  // NEW: Method to sync ALL students' text fields with foreign keys
  async syncAllStudentsTextFields() {
    console.log('🔄 Starting sync of all students text fields with foreign keys...');
    
    try {
      // Get all students with their current data
      const { data: students, error: fetchError } = await supabase
        .from(this.tableName)
        .select('*');
      
      if (fetchError) throw fetchError;
      
      let updatedCount = 0;
      let errorCount = 0;
      
      // Update each student
      for (const student of students) {
        try {
          const updates = {};
          let needsUpdate = false;
          
          // Sync grade text from grade_id
          if (student.grade_id) {
            const { data: grade } = await supabase
              .from('grades')
              .select('grade_level')
              .eq('id', student.grade_id)
              .single();
            
            if (grade && grade.grade_level !== student.grade) {
              updates.grade = grade.grade_level;
              needsUpdate = true;
            }
          }
          
          // Sync section text from section_id
          if (student.section_id) {
            const { data: section } = await supabase
              .from('sections')
              .select('section_name')
              .eq('id', student.section_id)
              .single();
            
            if (section && section.section_name !== student.section) {
              updates.section = section.section_name;
              needsUpdate = true;
            }
          }
          
          // Update if needed
          if (needsUpdate) {
            await supabase
              .from(this.tableName)
              .update(updates)
              .eq('id', student.id);
            
            updatedCount++;
            console.log(`✅ Synced student ${student.id}:`, updates);
          }
        } catch (err) {
          console.error(`❌ Error syncing student ${student.id}:`, err);
          errorCount++;
        }
      }
      
      console.log(`📊 Sync completed: ${updatedCount} updated, ${errorCount} errors`);
      return { success: true, updated: updatedCount, errors: errorCount };
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Guardian service - UPDATED TO USE TRANSFORMED DATA
export class GuardianService extends EntityService {
  constructor() {
    super('students'); // Still uses students table but transforms data
  }

  async fetchAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        id,
        first_name,
        last_name,
        grade,
        section,
        grade_id,
        section_id,
        guardian_first_name,
        guardian_middle_name,
        guardian_last_name,
        guardian_phone_number,
        guardian_email,
        grade_info:grades!grade_id (
          id,
          grade_level
        ),
        section_info:sections!section_id (
          id,
          section_name
        )
      `);
    
    if (error) throw error;
    
    // Transform data first, then convert to guardian format
    const transformedData = (data || []).map(student => {
      const gradeText = student.grade || student.grade_info?.grade_level || 'N/A';
      const sectionText = student.section || student.section_info?.section_name || 'N/A';
      
      return {
        ...student,
        grade: gradeText,
        section: sectionText
      };
    });
    
    return this.transformToGuardianFormat(transformedData);
  }

  async fetchByGrade(grade) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        id,
        first_name,
        last_name,
        grade,
        section,
        grade_id,
        section_id,
        guardian_first_name,
        guardian_middle_name,
        guardian_last_name,
        guardian_phone_number,
        guardian_email,
        grade_info:grades!grade_id (
          id,
          grade_level
        ),
        section_info:sections!section_id (
          id,
          section_name
        )
      `)
      .eq('grade', grade);
    
    if (error) throw error;
    
    // Transform data first, then convert to guardian format
    const transformedData = (data || []).map(student => {
      const gradeText = student.grade || student.grade_info?.grade_level || 'N/A';
      const sectionText = student.section || student.section_info?.section_name || 'N/A';
      
      return {
        ...student,
        grade: gradeText,
        section: sectionText
      };
    });
    
    return this.transformToGuardianFormat(transformedData);
  }

  async updateGuardian(studentId, guardianData) {
    const updates = {
      guardian_first_name: guardianData.first_name,
      guardian_middle_name: guardianData.middle_name,
      guardian_last_name: guardianData.last_name,
      guardian_phone_number: guardianData.phone_number,
      guardian_email: guardianData.email
    };
    
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', studentId)
      .select(`
        *,
        grade_info:grades!grade_id (
          id,
          grade_level
        ),
        section_info:sections!section_id (
          id,
          section_name
        )
      `)
      .single();
    
    if (error) throw error;
    
    // Transform the updated student
    const transformedStudent = {
      ...data,
      grade: data.grade || data.grade_info?.grade_level || 'N/A',
      section: data.section || data.section_info?.section_name || 'N/A'
    };
    
    return this.transformToGuardianFormat([transformedStudent])[0];
  }

  transformToGuardianFormat(students) {
    return students.map(student => ({
      id: student.id,
      first_name: student.guardian_first_name,
      middle_name: student.guardian_middle_name,
      last_name: student.guardian_last_name,
      phone_number: student.guardian_phone_number,
      email: student.guardian_email,
      student_id: student.id,
      guardian_of: `${student.first_name} ${student.last_name}`,
      grade: student.grade,
      section: student.section
    }));
  }
}