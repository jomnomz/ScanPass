import express from 'express';
import readXlsxFile from 'read-excel-file/node';
import csv from 'csv-parser';
import { excelUpload } from '../middleware/excelUpload.js';
import { supabase } from '../config/supabase.js';
import stream from 'stream';
import path from 'path';
import { validateAndNormalizeTeacher } from '../../src/Utils/TeacherDataValidation.js';

const router = express.Router();

const csvHeaders = {
  employee_id: ['Employee ID', 'employee_id', 'Employee_ID', 'ID Number', 'ID_Number', 'ID'],
  first_name: ['First Name', 'first_name', 'First_Name', 'Given Name', 'Given_Name', 'First'],
  last_name: ['Last Name', 'last_name', 'Last_Name', 'Surname', 'Family Name', 'Family_Name', 'Last'],
  middle_name: ['Middle Name', 'middle_name', 'Middle_Name', 'Middle Initial', 'Middle_Initial', 'Middle', 'MI'],
  email_address: ['Email', 'Email Address', 'email_address', 'Email_Address', 'email', 'E-mail'],
  phone_no: ['Phone', 'Phone Number', 'phone_no', 'Phone_Number', 'Contact Number', 'Contact_Number', 'Mobile', 'Cell', 'Cellphone'],
  subjects: ['Subjects', 'subjects', 'Subject Codes', 'Subject_Codes'],
  grade_sections_teaching: ['Grade-Sections (Teaching)', 'grade_sections_teaching', 'Grade-Sections', 'Teaching Assignments', 'Grade-Sections (Teaching)'],
  adviser_grade_section: ['Adviser Grade-Section', 'adviser_grade_section', 'Advisory Class', 'Adviser Grade-Section']
};

const getCsvValue = (data, keys) => {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key].toString().trim() !== '') {
      return data[key].toString().trim();
    }
  }
  return '';
};

const cleanTeacherData = (teacher) => {
  const cleaned = {};
  const optionalFields = ['email_address', 'phone_no', 'middle_name', 'subjects', 'grade_sections_teaching', 'adviser_grade_section'];
  
  Object.keys(teacher).forEach(key => {
    if (teacher[key] !== undefined && teacher[key] !== null) {
      const value = teacher[key].toString().trim();
      if (optionalFields.includes(key) && value === '') {
        cleaned[key] = null;
      } else {
        cleaned[key] = value;
      }
    } else {
      cleaned[key] = null;
    }
  });
  
  return cleaned;
};

const parseCommaSeparated = (str) => {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(s => s);
};

const parseGradeSection = (gradeSectionStr) => {
  if (!gradeSectionStr) return null;
  
  const trimmed = gradeSectionStr.trim();
  
  const match1 = trimmed.match(/^(\d+)\s*-\s*(.+)$/);
  if (match1) {
    return {
      grade: match1[1],
      sectionName: match1[2].trim(),
      display: trimmed
    };
  }
  
  const match2 = trimmed.match(/^(\d+)\s+(.+)$/);
  if (match2) {
    return {
      grade: match2[1],
      sectionName: match2[2].trim(),
      display: trimmed
    };
  }
  
  const match3 = trimmed.match(/^(\d+)-(\d+)$/);
  if (match3) {
    return {
      grade: match3[1],
      sectionName: match3[2],
      display: trimmed
    };
  }
  
  console.warn(`⚠️ Could not parse grade-section: "${trimmed}"`);
  return null;
};

const findSubjectIds = async (subjectCodes) => {
  if (!subjectCodes || subjectCodes.length === 0) return [];
  
  console.log(`🔍 Looking for subjects:`, subjectCodes);
  
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('id, subject_code, subject_name')
    .in('subject_code', subjectCodes);
    
  if (error) {
    console.error('Error finding subjects:', error);
    return [];
  }
  
  const subjectMap = {};
  subjects?.forEach(subject => {
    subjectMap[subject.subject_code] = subject.id;
  });
  
  console.log(`✅ Found ${subjects?.length || 0} subjects`);
  
  return { subjectMap, foundSubjects: subjects || [] };
};

const findGradeSectionIds = async (gradeSectionStrings) => {
  if (!gradeSectionStrings || gradeSectionStrings.length === 0) return [];
  
  console.log(`🔍 Looking for grade-sections:`, gradeSectionStrings);
  
  const parsedSections = [];
  const gradeSectionMap = {};
  
  gradeSectionStrings.forEach(gradeSectionStr => {
    const parsed = parseGradeSection(gradeSectionStr);
    if (parsed) {
      parsedSections.push(parsed);
      gradeSectionMap[gradeSectionStr] = parsed;
    } else {
      console.warn(`⚠️ Invalid grade-section format: "${gradeSectionStr}"`);
    }
  });
  
  if (parsedSections.length === 0) {
    console.log('No valid grade-sections found');
    return { sectionIds: [], gradeSectionMap: {}, parsedSections: [] };
  }
  
  const gradeLevels = [...new Set(parsedSections.map(s => s.grade))];
  console.log(`Looking for grades: ${gradeLevels.join(', ')}`);
  
  const { data: grades, error: gradeError } = await supabase
    .from('grades')
    .select('id, grade_level')
    .in('grade_level', gradeLevels);
    
  if (gradeError) {
    console.error('Error finding grades:', gradeError);
    return { sectionIds: [], gradeSectionMap: {}, parsedSections: [] };
  }
  
  const gradeMap = {};
  grades?.forEach(grade => {
    gradeMap[grade.grade_level] = grade.id;
  });
  
  console.log('📋 Fetching all sections for grades:', gradeLevels);
  
  const { data: allSections, error: sectionsError } = await supabase
    .from('sections')
    .select('id, section_name, grade_id, grade:grades(grade_level)')
    .in('grade_id', Object.values(gradeMap));
    
  if (sectionsError) {
    console.error('Error fetching sections:', sectionsError);
    return { sectionIds: [], gradeSectionMap: {}, parsedSections: [] };
  }
  
  console.log(`📊 Found ${allSections?.length || 0} total sections`);
  
  const sectionLookupMap = {};
  const displayNameToSectionMap = {};
  
  allSections?.forEach(section => {
    const key = `${section.grade.grade_level}-${section.section_name}`;
    sectionLookupMap[key] = section.id;
    
    const displayKey = `${section.grade.grade_level} - ${section.section_name}`;
    displayNameToSectionMap[displayKey.toLowerCase()] = section.id;
  });
  
  console.log('Available section keys:', Object.keys(sectionLookupMap));
  
  const nameToNumberMap = {
    'andres bonifacio': '1',
    'antonio luna': '2', 
    'apolinario mabini': '3',
    'ati-atihan': '1',
    'dinagyang': '2',
    'disiplina': '1',
    'pagkakaisa': '2',
    'sipag at tiyaga': '3',
    'taal': '1',
    'vigan': '2'
  };
  
  const sectionIds = [];
  const sectionToGradeSectionMap = {};
  
  for (const gradeSectionStr in gradeSectionMap) {
    const parsed = gradeSectionMap[gradeSectionStr];
    const gradeId = gradeMap[parsed.grade];
    
    if (!gradeId) {
      console.warn(`Grade ${parsed.grade} not found for ${gradeSectionStr}`);
      continue;
    }
    
    let sectionId = null;
    
    const searchKey = gradeSectionStr.toLowerCase();
    if (displayNameToSectionMap[searchKey]) {
      sectionId = displayNameToSectionMap[searchKey];
      console.log(`✅ Direct match found: ${gradeSectionStr} -> ID: ${sectionId}`);
    } else {
      const sectionNameLower = parsed.sectionName.toLowerCase();
      let sectionNumber = nameToNumberMap[sectionNameLower];
      
      if (!sectionNumber && /^\d+$/.test(parsed.sectionName)) {
        sectionNumber = parsed.sectionName;
      }
      
      if (sectionNumber) {
        const key = `${parsed.grade}-${sectionNumber}`;
        sectionId = sectionLookupMap[key];
        
        if (sectionId) {
          console.log(`✅ Mapped "${gradeSectionStr}" to "${key}" -> ID: ${sectionId}`);
        } else {
          console.log(`❌ Section not found: ${gradeSectionStr} (tried: ${key})`);
        }
      } else {
        console.log(`❌ No mapping for: ${gradeSectionStr}`);
      }
    }
    
    if (sectionId) {
      sectionIds.push(sectionId);
      sectionToGradeSectionMap[sectionId] = gradeSectionStr;
    }
  }
  
  console.log(`✅ Found ${sectionIds.length} sections`);
  
  return { 
    sectionIds, 
    gradeSectionMap: sectionToGradeSectionMap,
    gradeMap,
    parsedSections 
  };
};

const assignTeacherSubjects = async (teacherId, subjectIds) => {
  if (!subjectIds || subjectIds.length === 0) return { assigned: 0, errors: [] };
  
  const assignments = subjectIds.map(subjectId => ({
    teacher_id: teacherId,
    subject_id: subjectId
  }));
  
  const { error } = await supabase
    .from('teacher_subjects')
    .upsert(assignments, { onConflict: 'teacher_id,subject_id' })
    .select();
    
  if (error) {
    console.error('Error assigning subjects to teacher:', error);
    return { assigned: 0, errors: [error.message] };
  }
  
  return { assigned: subjectIds.length, errors: [] };
};

const assignTeacherSections = async (teacherId, sectionIds, adviserSectionId = null) => {
  if (!sectionIds || sectionIds.length === 0) return { assigned: 0, errors: [] };
  
  const assignments = sectionIds.map(sectionId => ({
    teacher_id: teacherId,
    section_id: sectionId,
    is_adviser: adviserSectionId === sectionId
  }));
  
  const { error } = await supabase
    .from('teacher_sections')
    .upsert(assignments, { onConflict: 'teacher_id,section_id' })
    .select();
    
  if (error) {
    console.error('Error assigning sections to teacher:', error);
    return { assigned: 0, errors: [error.message] };
  }
  
  return { assigned: sectionIds.length, errors: [] };
};

const assignTeacherSubjectSections = async (teacherId, subjectIds, sectionIds) => {
  if (!subjectIds || !sectionIds || subjectIds.length === 0 || sectionIds.length === 0) {
    return { assigned: 0, errors: [] };
  }
  
  const assignments = [];
  
  for (const subjectId of subjectIds) {
    for (const sectionId of sectionIds) {
      assignments.push({
        teacher_id: teacherId,
        subject_id: subjectId,
        section_id: sectionId
      });
    }
  }
  
  if (assignments.length === 0) return { assigned: 0, errors: [] };
  
  const { error } = await supabase
    .from('teacher_subject_sections')
    .upsert(assignments, { onConflict: 'teacher_id,subject_id,section_id' })
    .select();
    
  if (error) {
    console.error('Error assigning teacher-subject-sections:', error);
    return { assigned: 0, errors: [error.message] };
  }
  
  return { assigned: assignments.length, errors: [] };
};

router.post('/upload', excelUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded or invalid file type'
      });
    }

    console.log('\n📁 Processing teacher file:', req.file.originalname);

    let rawTeacherData = [];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      const rows = await readXlsxFile(req.file.buffer);
      console.log(`📊 Excel file has ${rows.length} rows`);
      
      if (rows.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'File is empty or has no data rows'
        });
      }
      
      const [headers, ...dataRows] = rows;
      console.log('📋 Excel headers:', headers);
      
      const headerMap = {};
      headers.forEach((header, index) => {
        if (header) {
          const headerLower = header.toString().toLowerCase().trim();
          headerMap[headerLower] = index;
        }
      });
      
      console.log('🔍 Header mapping (lowercase):', Object.keys(headerMap));
      
      rawTeacherData = dataRows.map((row, index) => {
        const getValue = (possibleHeaders) => {
          for (const header of possibleHeaders) {
            const headerLower = header.toLowerCase().trim();
            if (headerMap[headerLower] !== undefined) {
              const value = row[headerMap[headerLower]];
              return value !== undefined && value !== null ? value.toString().trim() : '';
            }
          }
          return '';
        };
        
        const teacher = {
          employee_id: getValue(csvHeaders.employee_id),
          first_name: getValue(csvHeaders.first_name),
          last_name: getValue(csvHeaders.last_name),
          middle_name: getValue(csvHeaders.middle_name),
          email_address: getValue(csvHeaders.email_address),
          phone_no: getValue(csvHeaders.phone_no),
          subjects: getValue(csvHeaders.subjects),
          grade_sections_teaching: getValue(csvHeaders.grade_sections_teaching),
          adviser_grade_section: getValue(csvHeaders.adviser_grade_section)
        };
        
        return teacher;
      });

    } else if (fileExtension === '.csv') {
      rawTeacherData = await new Promise((resolve, reject) => {
        const results = [];
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);
        
        bufferStream
          .pipe(csv())
          .on('data', (data) => {
            const teacher = {
              employee_id: getCsvValue(data, csvHeaders.employee_id),
              first_name: getCsvValue(data, csvHeaders.first_name),
              last_name: getCsvValue(data, csvHeaders.last_name),
              middle_name: getCsvValue(data, csvHeaders.middle_name),
              email_address: getCsvValue(data, csvHeaders.email_address),
              phone_no: getCsvValue(data, csvHeaders.phone_no),
              subjects: getCsvValue(data, csvHeaders.subjects),
              grade_sections_teaching: getCsvValue(data, csvHeaders.grade_sections_teaching),
              adviser_grade_section: getCsvValue(data, csvHeaders.adviser_grade_section)
            };
            results.push(teacher);
          })
          .on('end', () => {
            console.log(`📊 CSV file has ${results.length} rows`);
            resolve(results);
          })
          .on('error', reject);
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv files'
      });
    }

    console.log(`📊 Found ${rawTeacherData.length} raw teacher records`);
    
    if (rawTeacherData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'File contains no data rows'
      });
    }

    console.log('\n🔍 Sample data (first 2 rows):');
    rawTeacherData.slice(0, 2).forEach((teacher, index) => {
      console.log(`Row ${index + 2}:`, {
        employee_id: teacher.employee_id,
        name: `${teacher.first_name} ${teacher.last_name}`,
        subjects: teacher.subjects,
        grade_sections_teaching: teacher.grade_sections_teaching,
        adviser_grade_section: teacher.adviser_grade_section
      });
    });

    const validationResults = [];
    const duplicateEmployeeIds = new Set();
    const employeeIdSet = new Set();
    const duplicateEmails = new Set();
    const emailSet = new Set();
    
    console.log('\n🔍 Validating all records...');
    rawTeacherData.forEach((teacher, index) => {
      const rowNumber = index + 2;
      
      const cleanedTeacher = cleanTeacherData(teacher);
      
      const { teacher: normalizedTeacher, errors: validationErrors } = validateAndNormalizeTeacher(cleanedTeacher);
      
      if (normalizedTeacher.employee_id) {
        if (employeeIdSet.has(normalizedTeacher.employee_id)) {
          validationErrors.employee_id = `Employee ID ${normalizedTeacher.employee_id} is duplicated in the file`;
          duplicateEmployeeIds.add(normalizedTeacher.employee_id);
        } else {
          employeeIdSet.add(normalizedTeacher.employee_id);
        }
      }
      
      if (normalizedTeacher.email_address) {
        if (emailSet.has(normalizedTeacher.email_address)) {
          validationErrors.email_address = `Email ${normalizedTeacher.email_address} is duplicated in the file`;
          duplicateEmails.add(normalizedTeacher.email_address);
        } else {
          emailSet.add(normalizedTeacher.email_address);
        }
      }
      
      validationResults.push({
        row: rowNumber,
        teacher: normalizedTeacher,
        errors: validationErrors,
        isValid: Object.keys(validationErrors).length === 0
      });
    });

    const invalidRecords = validationResults.filter(r => !r.isValid);
    const validRecords = validationResults.filter(r => r.isValid);
    
    console.log(`\n📊 Validation Summary:`);
    console.log(`✅ Valid records: ${validRecords.length}`);
    console.log(`❌ Invalid records: ${invalidRecords.length}`);
    
    if (invalidRecords.length > 0) {
      const errorMessages = invalidRecords.map(record => 
        `Row ${record.row}: ${Object.values(record.errors).join(', ')}`
      );
      
      return res.status(400).json({
        success: false,
        error: 'File contains invalid data. Please fix all errors and try again.',
        invalidCount: invalidRecords.length,
        invalidRecords: invalidRecords.slice(0, 10).map(record => ({
          row: record.row,
          data: {
            employee_id: record.teacher.employee_id,
            name: `${record.teacher.first_name} ${record.teacher.last_name}`
          },
          errors: record.errors
        })),
        errorSummary: errorMessages.slice(0, 5),
        summary: {
          totalRecords: rawTeacherData.length,
          validRecords: validRecords.length,
          invalidRecords: invalidRecords.length,
          duplicateEmployeeIds: Array.from(duplicateEmployeeIds),
          duplicateEmails: Array.from(duplicateEmails)
        }
      });
    }

    // Row number kept only for error reporting below — stripped before insert.
    const allTeachers = validationResults.map(r => ({ ...r.teacher, _row: r.row }));

    // ------------------------------------------------------------------
    // DB-level email conflict check: does this email already belong to a
    // DIFFERENT teacher already in the database? Mirrors the same check
    // added to the student upload route. Without this, a single insert()
    // with N rows fails ENTIRELY if even one row collides with an existing
    // teacher's email, with no indication of which row caused it.
    // ------------------------------------------------------------------
    const teacherEmailsToCheck = allTeachers
      .map(t => t.email_address)
      .filter(email => email);

    const existingEmailToEmployeeId = new Map();

    if (teacherEmailsToCheck.length > 0) {
      const { data: existingEmailRows, error: emailFetchError } = await supabase
        .from('teachers')
        .select('employee_id, email_address')
        .in('email_address', teacherEmailsToCheck);

      if (emailFetchError) {
        console.error('Error checking existing teacher emails:', emailFetchError);
        throw new Error(`Database error: ${emailFetchError.message}`);
      }

      if (existingEmailRows && existingEmailRows.length > 0) {
        existingEmailRows.forEach(row => {
          existingEmailToEmployeeId.set(row.email_address, row.employee_id);
        });
      }
    }

    // A conflict only counts if the existing row's employee_id is DIFFERENT
    // from this row's employee_id — if they match, this is just a
    // legitimate re-upload of the same teacher (handled by the
    // existingEmployeeIds skip-logic below), not a genuine email collision.
    const teacherEmailConflicts = allTeachers.filter(t => {
      const existingEmployeeIdForEmail = existingEmailToEmployeeId.get(t.email_address);
      return existingEmployeeIdForEmail && existingEmployeeIdForEmail !== t.employee_id;
    });

    if (teacherEmailConflicts.length > 0) {
      console.log(`❌ ${teacherEmailConflicts.length} teachers have emails already belonging to other teachers in the database`);

      const emailConflictInvalidRecords = teacherEmailConflicts.map(t => ({
        row: t._row,
        data: {
          employee_id: t.employee_id,
          name: `${t.first_name} ${t.last_name}`
        },
        errors: {
          email_address: `Email ${t.email_address} already belongs to another teacher (Employee ID ${existingEmailToEmployeeId.get(t.email_address)}) in the database`
        }
      }));

      const errorMessages = emailConflictInvalidRecords.map(record =>
        `Row ${record.row}: ${Object.values(record.errors).join(', ')}`
      );

      return res.status(400).json({
        success: false,
        error: 'One or more emails already belong to other teachers in the database.',
        invalidCount: emailConflictInvalidRecords.length,
        invalidRecords: emailConflictInvalidRecords.slice(0, 10),
        errorSummary: errorMessages.slice(0, 5),
        summary: {
          totalRecords: rawTeacherData.length,
          validRecords: allTeachers.length - teacherEmailConflicts.length,
          invalidRecords: teacherEmailConflicts.length,
          duplicateEmployeeIds: [],
          duplicateEmails: teacherEmailConflicts.map(t => t.email_address)
        }
      });
    }
    
    const employeeIds = allTeachers.map(t => t.employee_id);
    
    const existingEmployeeIds = [];
    
    if (employeeIds.length > 0) {
      console.log(`\n🔍 Checking for existing teachers in database...`);
      const { data: existingTeachersById, error: fetchErrorId } = await supabase
        .from('teachers')
        .select('id, employee_id')
        .in('employee_id', employeeIds);
      
      if (fetchErrorId) {
        console.error('Error checking existing Employee IDs:', fetchErrorId);
        throw new Error(`Database error: ${fetchErrorId.message}`);
      } else if (existingTeachersById && existingTeachersById.length > 0) {
        existingEmployeeIds.push(...existingTeachersById.map(t => t.employee_id));
        console.log(`⚠️ Found ${existingEmployeeIds.length} existing Employee IDs in database`);
      }
    }

    // Strip the internal _row field before these objects touch the DB —
    // it's not a real column and Supabase would reject the insert otherwise.
    const stripRowMeta = (teacher) => {
      const { _row, ...rest } = teacher;
      return rest;
    };
    
    const newTeachers = allTeachers
      .filter(teacher => !existingEmployeeIds.includes(teacher.employee_id))
      .map(stripRowMeta);
    const existingTeachers = allTeachers
      .filter(teacher => existingEmployeeIds.includes(teacher.employee_id))
      .map(stripRowMeta);

    console.log(`\n📝 Database Summary:`);
    console.log(`📋 New teachers to insert: ${newTeachers.length}`);
    console.log(`📋 Existing teachers (skipped): ${existingTeachers.length}`);

    let uploadedData = [];
    let assignmentSummary = {
      subjectsAssigned: 0,
      sectionsAssigned: 0,
      teachingAssignmentsCreated: 0,
      assignmentErrors: []
    };

    console.log('\n🔍 Pre-fetching all subjects and grade-sections...');
    
    const allSubjectCodes = [...new Set(newTeachers.flatMap(t => 
      parseCommaSeparated(t.subjects)
    ).filter(code => code))];
    
    const allGradeSections = [...new Set(newTeachers.flatMap(t => {
      const teaching = parseCommaSeparated(t.grade_sections_teaching);
      const adviser = t.adviser_grade_section ? [t.adviser_grade_section] : [];
      return [...teaching, ...adviser].filter(gs => gs);
    }))];
    
    console.log(`📚 Unique subject codes to find: ${allSubjectCodes.length}`, allSubjectCodes);
    console.log(`🏫 Unique grade-sections to find: ${allGradeSections.length}`, allGradeSections);

    const { subjectMap, foundSubjects } = await findSubjectIds(allSubjectCodes);
    const { sectionIds: allSectionIds, gradeSectionMap } = await findGradeSectionIds(allGradeSections);

    console.log(`✅ Found ${foundSubjects?.length || 0} subjects in database`);
    console.log(`✅ Found ${allSectionIds?.length || 0} grade-sections in database`);

    if (newTeachers.length > 0) {
      console.log(`\n💾 Adding ${newTeachers.length} new teachers to database...`);
      
      const teachersToInsert = newTeachers.map(teacher => {
        const { subjects, grade_sections_teaching, adviser_grade_section, ...teacherData } = teacher;
        return teacherData;
      });
      
      const { data: insertedData, error: insertError } = await supabase
        .from('teachers')
        .insert(teachersToInsert)
        .select('id, employee_id, first_name, last_name, email_address, status');

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }
      
      uploadedData = insertedData || [];
      console.log(`✅ Successfully added ${uploadedData.length} new teachers`);
      
      console.log('\n📚 Processing teacher assignments...');
      
      for (let i = 0; i < uploadedData.length; i++) {
        const teacher = uploadedData[i];
        const originalTeacher = newTeachers[i];
        
        console.log(`\n👨‍🏫 Teacher ${teacher.employee_id}: ${teacher.first_name} ${teacher.last_name}`);
        
        const subjectCodes = parseCommaSeparated(originalTeacher.subjects);
        const teachingGradeSections = parseCommaSeparated(originalTeacher.grade_sections_teaching);
        const adviserGradeSection = originalTeacher.adviser_grade_section;
        
        console.log(`   Subjects: ${subjectCodes.join(', ') || 'None'}`);
        console.log(`   Teaching: ${teachingGradeSections.join(', ') || 'None'}`);
        console.log(`   Adviser: ${adviserGradeSection || 'None'}`);
        
        const subjectIds = subjectCodes.map(code => subjectMap[code]).filter(id => id);
        const missingSubjects = subjectCodes.filter(code => !subjectMap[code]);
        
        if (missingSubjects.length > 0) {
          console.log(`   ⚠️ Subjects not found: ${missingSubjects.join(', ')}`);
          assignmentSummary.assignmentErrors.push(
            `Teacher ${teacher.employee_id}: Subjects not found - ${missingSubjects.join(', ')}`
          );
        }
        
        if (subjectIds.length > 0) {
          const result = await assignTeacherSubjects(teacher.id, subjectIds);
          assignmentSummary.subjectsAssigned += result.assigned;
          console.log(`   ✅ Assigned ${result.assigned} subjects`);
        }
        
        const teachingSectionIds = teachingGradeSections
          .map(gradeSectionStr => {
            for (const [sectionId, gsStr] of Object.entries(gradeSectionMap)) {
              if (gsStr === gradeSectionStr) {
                return parseInt(sectionId);
              }
            }
            return null;
          })
          .filter(id => id);
        
        let adviserSectionId = null;
        if (adviserGradeSection) {
          for (const [sectionId, gsStr] of Object.entries(gradeSectionMap)) {
            if (gsStr === adviserGradeSection) {
              adviserSectionId = parseInt(sectionId);
              break;
            }
          }
          if (!adviserSectionId) {
            console.log(`   ⚠️ Adviser grade-section not found: ${adviserGradeSection}`);
            assignmentSummary.assignmentErrors.push(
              `Teacher ${teacher.employee_id}: Adviser grade-section not found - ${adviserGradeSection}`
            );
          }
        }
        
        const allSectionIdsForTeacher = [...new Set(teachingSectionIds)];
        if (adviserSectionId && !allSectionIdsForTeacher.includes(adviserSectionId)) {
          allSectionIdsForTeacher.push(adviserSectionId);
        }
        
        if (allSectionIdsForTeacher.length > 0) {
          const result = await assignTeacherSections(
            teacher.id, 
            allSectionIdsForTeacher,
            adviserSectionId
          );
          assignmentSummary.sectionsAssigned += result.assigned;
          console.log(`   ✅ Assigned ${result.assigned} sections (Adviser: ${adviserSectionId ? 'Yes' : 'No'})`);
        } else {
          console.log(`   ℹ️ No sections assigned (none found in database)`);
        }
        
        if (subjectIds.length > 0 && teachingSectionIds.length > 0) {
          const result = await assignTeacherSubjectSections(
            teacher.id,
            subjectIds,
            teachingSectionIds
          );
          assignmentSummary.teachingAssignmentsCreated += result.assigned;
          console.log(`   ✅ Created ${result.assigned} teaching assignments`);
        }
      }
    } else {
      console.log('ℹ️ No new teachers to add');
    }

    if (existingTeachers.length > 0) {
      console.log(`ℹ️ Skipping ${existingTeachers.length} existing teachers (not updated)`);
    }

    const newRecordsCreated = uploadedData.length;
    const existingRecordsSkipped = existingTeachers.length;

    const response = {
      success: true,
      hasNewRecords: newRecordsCreated > 0,
      message: '',
      importedCount: newRecordsCreated,
      summary: {
        totalRecords: rawTeacherData.length,
        newRecordsCreated: newRecordsCreated,
        existingRecordsSkipped: existingRecordsSkipped,
        subjectsAssigned: assignmentSummary.subjectsAssigned,
        sectionsAssigned: assignmentSummary.sectionsAssigned,
        teachingAssignmentsCreated: assignmentSummary.teachingAssignmentsCreated,
        assignmentErrors: assignmentSummary.assignmentErrors.length
      },
      newTeachers: uploadedData || []
    };

    const messageParts = [];
    
    if (newRecordsCreated > 0) {
      messageParts.push(`Added ${newRecordsCreated} new teacher(s)`);
    }
    
    if (assignmentSummary.subjectsAssigned > 0) {
      messageParts.push(`assigned ${assignmentSummary.subjectsAssigned} subject(s)`);
    }
    
    if (assignmentSummary.sectionsAssigned > 0) {
      messageParts.push(`assigned ${assignmentSummary.sectionsAssigned} section(s)`);
    }
    
    if (assignmentSummary.teachingAssignmentsCreated > 0) {
      messageParts.push(`created ${assignmentSummary.teachingAssignmentsCreated} teaching assignment(s)`);
    }
    
    if (existingRecordsSkipped > 0) {
      messageParts.push(`${existingRecordsSkipped} existing teacher(s) skipped`);
    }
    
    if (assignmentSummary.assignmentErrors.length > 0) {
      messageParts.push(`${assignmentSummary.assignmentErrors.length} assignment error(s)`);
    }
    
    if (newRecordsCreated === 0) {
      response.message = `No new teachers added. ${existingRecordsSkipped > 0 ? `All ${rawTeacherData.length} teachers already exist.` : 'No valid data found.'}`;
    } else {
      response.message = messageParts.join(', ') + '.';
    }
    
    if (assignmentSummary.assignmentErrors.length > 0) {
      response.assignmentErrors = assignmentSummary.assignmentErrors.slice(0, 3);
    }

    console.log(`\n🎉 Upload completed successfully!`);
    console.log(`📋 Summary: ${response.message}`);
    
    res.json(response);

  } catch (error) {
    console.error('\n❌ Teacher upload error:', error);
    
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.message.includes('invalid input syntax')) {
      errorMessage = 'Invalid data format in file. Please check your data.';
      statusCode = 400;
    } else if (error.message.includes('duplicate key')) {
      if (error.message.includes('teachers_email_address_key')) {
        errorMessage = 'One or more emails already exist in the database.';
      } else if (error.message.includes('teachers_employee_id_key')) {
        errorMessage = 'Duplicate Employee ID found in database.';
      } else {
        errorMessage = 'A duplicate value was found in the database.';
      }
      statusCode = 409;
    } else if (error.message.includes('permission denied')) {
      errorMessage = 'Permission denied. Please check your database credentials.';
      statusCode = 403;
    } else if (error.message.includes('File contains invalid data')) {
      errorMessage = error.message;
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;