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
  email_address: ['Email', 'Email Address', 'email_address', 'Email_Address', 'email', 'E-mail'],
  phone_no: ['Phone', 'Phone Number', 'phone_no', 'Phone_Number', 'Contact Number', 'Contact_Number', 'Mobile', 'Cell', 'Cellphone'],
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
  const optionalFields = ['email_address', 'phone_no', 'grade_sections_teaching', 'adviser_grade_section'];
  
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

const resolveSectionId = (gradeSectionMap, gradeSectionStr) => {
  if (!gradeSectionStr) return null;
  for (const [sectionId, gsStr] of Object.entries(gradeSectionMap)) {
    if (gsStr === gradeSectionStr) {
      return parseInt(sectionId);
    }
  }
  return null;
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
          email_address: getValue(csvHeaders.email_address),
          phone_no: getValue(csvHeaders.phone_no),
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
              email_address: getCsvValue(data, csvHeaders.email_address),
              phone_no: getCsvValue(data, csvHeaders.phone_no),
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

    const allTeachers = validationResults.map(r => ({ ...r.teacher, _row: r.row }));

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
      sectionsAssigned: 0,
      assignmentErrors: []
    };

    console.log('\n🔍 Pre-fetching all grade-sections...');
    
    const allGradeSections = [...new Set(newTeachers.flatMap(t => {
      const teaching = parseCommaSeparated(t.grade_sections_teaching);
      const adviser = t.adviser_grade_section ? [t.adviser_grade_section] : [];
      return [...teaching, ...adviser].filter(gs => gs);
    }))];
    
    console.log(`🏫 Unique grade-sections to find: ${allGradeSections.length}`, allGradeSections);

    const { sectionIds: allSectionIds, gradeSectionMap } = await findGradeSectionIds(allGradeSections);

    console.log(`✅ Found ${allSectionIds?.length || 0} grade-sections in database`);

    // ---------------------------------------------------------------------
    // Adviser-conflict check: a grade-section can only have ONE adviser.
    // (a) file row vs file row, (b) file row vs existing DB adviser rows.
    // Only applies to newTeachers — existingTeachers are skipped/untouched
    // by this route, so their adviser status can't change here.
    // ---------------------------------------------------------------------
    const adviserClaims = [];

    newTeachers.forEach((teacher) => {
      if (!teacher.adviser_grade_section) return;
      const sectionId = resolveSectionId(gradeSectionMap, teacher.adviser_grade_section);
      if (!sectionId) return; // unresolved grade-section already surfaces via assignmentErrors
      adviserClaims.push({
        row: teacher._row,
        employee_id: teacher.employee_id,
        name: `${teacher.first_name} ${teacher.last_name}`,
        sectionId,
        displayStr: teacher.adviser_grade_section
      });
    });

    const adviserConflictRecords = [];

    if (adviserClaims.length > 0) {
      // (a) File-to-file: first claim per section holds it, later claims conflict
      const sectionHolder = new Map();
      adviserClaims.forEach((claim) => {
        const holder = sectionHolder.get(claim.sectionId);
        if (!holder) {
          sectionHolder.set(claim.sectionId, claim);
        } else {
          adviserConflictRecords.push({
            row: claim.row,
            data: { employee_id: claim.employee_id, name: claim.name },
            errors: {
              adviser_grade_section: `${claim.displayStr} is already claimed as adviser section by ${holder.name} (Employee ID ${holder.employee_id}) in this file`
            }
          });
        }
      });

      // (b) File vs DB: an existing adviser on that section conflicts with
      // every file claim for it, since these teachers are all new inserts.
      const candidateSectionIds = [...new Set(adviserClaims.map((c) => c.sectionId))];

      const { data: existingAdviserRows, error: adviserFetchError } = await supabase
        .from('teacher_sections')
        .select('section_id, teacher_id, teachers(employee_id, first_name, last_name)')
        .in('section_id', candidateSectionIds)
        .eq('is_adviser', true);

      if (adviserFetchError) {
        console.error('Error checking existing advisers:', adviserFetchError);
        throw new Error(`Database error: ${adviserFetchError.message}`);
      }

      const dbAdviserBySectionId = new Map();
      (existingAdviserRows || []).forEach((row) => {
        dbAdviserBySectionId.set(row.section_id, row.teachers);
      });

      adviserClaims.forEach((claim) => {
        const existingAdviser = dbAdviserBySectionId.get(claim.sectionId);
        if (existingAdviser) {
          adviserConflictRecords.push({
            row: claim.row,
            data: { employee_id: claim.employee_id, name: claim.name },
            errors: {
              adviser_grade_section: `${claim.displayStr} already has an adviser (${existingAdviser.first_name} ${existingAdviser.last_name}, Employee ID ${existingAdviser.employee_id}) in the database`
            }
          });
        }
      });
    }

    if (adviserConflictRecords.length > 0) {
      const errorMessages = adviserConflictRecords.map((record) =>
        `Row ${record.row}: ${Object.values(record.errors).join(', ')}`
      );

      return res.status(400).json({
        success: false,
        error: 'One or more adviser grade-sections are already assigned to another teacher.',
        invalidCount: adviserConflictRecords.length,
        invalidRecords: adviserConflictRecords.slice(0, 10),
        errorSummary: errorMessages.slice(0, 5),
        summary: {
          totalRecords: rawTeacherData.length,
          validRecords: allTeachers.length - adviserConflictRecords.length,
          invalidRecords: adviserConflictRecords.length,
          duplicateEmployeeIds: [],
          duplicateEmails: []
        }
      });
    }

    if (newTeachers.length > 0) {
      console.log(`\n💾 Adding ${newTeachers.length} new teachers to database...`);
      
      const teachersToInsert = newTeachers.map(teacher => {
        const { grade_sections_teaching, adviser_grade_section, ...teacherData } = teacher;
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
        
        const teachingGradeSections = parseCommaSeparated(originalTeacher.grade_sections_teaching);
        const adviserGradeSection = originalTeacher.adviser_grade_section;
        
        console.log(`   Teaching: ${teachingGradeSections.join(', ') || 'None'}`);
        console.log(`   Adviser: ${adviserGradeSection || 'None'}`);
        
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
        sectionsAssigned: assignmentSummary.sectionsAssigned,
        assignmentErrors: assignmentSummary.assignmentErrors.length
      },
      newTeachers: uploadedData || []
    };

    const messageParts = [];
    
    if (newRecordsCreated > 0) {
      messageParts.push(`Added ${newRecordsCreated} new teacher(s)`);
    }
    
    if (assignmentSummary.sectionsAssigned > 0) {
      messageParts.push(`assigned ${assignmentSummary.sectionsAssigned} section(s)`);
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
      } else if (error.message.includes('teacher_sections_one_adviser_per_section')) {
        errorMessage = 'One or more grade-sections in this file already have an adviser assigned in the database.';
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