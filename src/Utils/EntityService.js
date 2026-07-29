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

  // Get teacher's assigned sections
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

  // Get teacher's complete assignments (sections only)
  async getTeacherAssignments(teacherId) {
    try {
      const sectionsResult = await this.getTeacherSections(teacherId);

      console.log('📊 Teacher assignments fetched:', {
        teacherId,
        sections: sectionsResult.data?.length || 0
      });

      return {
        sections: sectionsResult.data || [],
        assignments: sectionsResult.data || [], // For backward compatibility
        error: null
      };
    } catch (error) {
      console.error('Error fetching teacher assignments:', error);
      return {
        sections: [],
        assignments: [],
        error
      };
    }
  }

  // Update teacher assignments (sections only)
  async updateTeacherAssignments(teacherId, assignments) {
    try {
      // ALWAYS delete existing assignments first
      
      // 1. Delete all section assignments
      const { error: deleteSectionsError } = await supabase
        .from('teacher_sections')
        .delete()
        .eq('teacher_id', teacherId);
      
      if (deleteSectionsError) throw deleteSectionsError;

      // 2. Insert new section assignments with adviser flag (if any)
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

      return { success: true, message: 'Teacher assignments updated successfully' };
    } catch (error) {
      console.error('Error updating teacher assignments:', error);
      return { success: false, error: error.message };
    }
  }
}

// Student-specific service
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
      .eq('grade', grade);
    
    if (error) throw error;
    
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
    
    let finalUpdates = { ...updates };
    
    // Sync grade text with grade_id
    if (updates.grade_id !== undefined && updates.grade_id !== null) {
      const { data: grade, error: gradeError } = await supabase
        .from('grades')
        .select('grade_level')
        .eq('id', updates.grade_id)
        .single();
      
      if (gradeError) {
        console.error('❌ Error fetching grade:', gradeError);
      } else if (grade) {
        finalUpdates.grade = grade.grade_level;
      }
    } else if (updates.grade !== undefined && updates.grade !== null && updates.grade !== '') {
      const { data: grade, error: gradeError } = await supabase
        .from('grades')
        .select('id')
        .eq('grade_level', updates.grade)
        .single();
      
      if (gradeError) {
        console.error('❌ Error finding grade:', gradeError);
      } else if (grade) {
        finalUpdates.grade_id = grade.id;
      } else {
        finalUpdates.grade_id = null;
      }
    }
    
    // Sync section text with section_id
    if (updates.section_id !== undefined && updates.section_id !== null) {
      const { data: section, error: sectionError } = await supabase
        .from('sections')
        .select('section_name')
        .eq('id', updates.section_id)
        .single();
      
      if (sectionError) {
        console.error('❌ Error fetching section:', sectionError);
      } else if (section) {
        finalUpdates.section = section.section_name;
      }
    } else if (updates.section !== undefined && updates.section !== null && updates.section !== '') {
      const gradeId = finalUpdates.grade_id;
      
      if (gradeId) {
        const { data: section, error: sectionError } = await supabase
          .from('sections')
          .select('id')
          .eq('section_name', updates.section)
          .eq('grade_id', gradeId)
          .single();
        
        if (sectionError && sectionError.code !== 'PGRST116') {
          console.error('❌ Error finding section:', sectionError);
        } else if (section) {
          finalUpdates.section_id = section.id;
        } else {
          finalUpdates.section_id = null;
        }
      } else {
        finalUpdates.section_id = null;
      }
    }
    
    Object.keys(finalUpdates).forEach(key => {
      if (finalUpdates[key] === undefined || finalUpdates[key] === '') {
        finalUpdates[key] = null;
      }
    });
    
    console.log('💾 Final updates to save:', finalUpdates);
    
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
    
    return {
      ...data,
      grade: data.grade || data.grade_info?.grade_level || 'N/A',
      section: data.section || data.section_info?.section_name || 'N/A',
      grade_id: data.grade_id,
      section_id: data.section_id,
      grade_info: data.grade_info,
      section_info: data.section_info
    };
  }

  async generateTokenForStudent(id) {
    const token = crypto.randomUUID();
    return this.update(id, { qr_verification_token: token });
  }
  
  async syncAllStudentsTextFields() {
    console.log('🔄 Starting sync of all students text fields with foreign keys...');
    
    try {
      const { data: students, error: fetchError } = await supabase
        .from(this.tableName)
        .select('*');
      
      if (fetchError) throw fetchError;
      
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const student of students) {
        try {
          const updates = {};
          let needsUpdate = false;
          
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

// Guardian service
export class GuardianService extends EntityService {
  constructor() {
    super('students');
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