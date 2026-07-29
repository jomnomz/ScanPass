import express from 'express';
import readXlsxFile from 'read-excel-file/node';
import csv from 'csv-parser';
import { excelUpload } from '../middleware/excelUpload.js';
import { supabase } from '../config/supabase.js';
import stream from 'stream';
import path from 'path';
import { validateAndNormalizeStudent } from '../../src/Utils/StudentDataValidation.js';

const router = express.Router();

const csvHeaders = {
  lrn: ['LRN', 'lrn', 'Student LRN', 'student_lrn'],
  first_name: ['First Name', 'first_name', 'First_Name', 'Given Name', 'Given_Name', 'First'],
  last_name: ['Last Name', 'last_name', 'Last_Name', 'Surname', 'Family Name', 'Family_Name', 'Last'],
  grade: ['Grade', 'grade', 'Grade Level', 'Grade_Level'],
  section: ['Section', 'section', 'Class Section', 'Class_Section'],
  email: ['Email', 'email', 'Student Email', 'Student_Email'],
  phone_number: ['Phone Number', 'phone_number', 'Phone', 'Student Phone', 'Student_Phone'],
  
  guardian_first_name: ['Guardian First Name', 'guardian_first_name', 'Parent First Name', 'Parent_First_Name'],
  guardian_last_name: ['Guardian Last Name', 'guardian_last_name', 'Parent Last Name', 'Parent_Last_Name'],
  guardian_phone_number: ['Guardian Phone Number', 'guardian_phone_number', 'Parent Phone', 'Parent_Phone', 'Guardian Phone'],
  guardian_email: ['Guardian Email', 'guardian_email', 'Parent Email', 'Parent_Email']
};

const getCsvValue = (data, keys) => {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key].toString().trim() !== '') {
      return data[key].toString().trim();
    }
  }
  return '';
};

const cleanStudentData = (student) => {
  const cleaned = {};
  const optionalFields = ['email', 'phone_number', 'guardian_first_name', 
                         'guardian_last_name', 'guardian_phone_number', 'guardian_email'];
  
  Object.keys(student).forEach(key => {
    if (student[key] !== undefined && student[key] !== null) {
      const value = student[key].toString().trim();
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

const findGradeAndSectionIds = async (gradeText, sectionText) => {
  try {
    let gradeLevel = gradeText.toString().trim();
    const numMatch = gradeLevel.match(/\d+/);
    if (numMatch) {
      gradeLevel = numMatch[0]; 
    } else {
      gradeLevel = gradeLevel.replace(/\D/g, ''); 
    }
    
    if (!gradeLevel) {
      return { error: `Invalid grade: "${gradeText}"` };
    }

    console.log(`🔍 Looking for grade: "${gradeLevel}" and section: "${sectionText}"`);
    
    const { data: gradeData, error: gradeError } = await supabase
      .from('grades')
      .select('id, grade_level')
      .eq('grade_level', gradeLevel)
      .single();

    if (gradeError || !gradeData) {
      return { error: `Grade "${gradeText}" (as "${gradeLevel}") not found in database.` };
    }

    const gradeId = gradeData.id;
    const gradeDisplay = gradeData.grade_level; 

    const { data: sectionData, error: sectionError } = await supabase
      .from('sections')
      .select('id, section_name')
      .eq('grade_id', gradeId)
      .eq('section_name', sectionText.toString().trim())
      .single();

    if (sectionError || !sectionData) {
      return { error: `Section "${sectionText}" not found for grade "${gradeLevel}".` };
    }

    const sectionId = sectionData.id;
    const sectionDisplay = sectionData.section_name;

    return { 
      gradeId, 
      sectionId, 
      gradeDisplay, 
      sectionDisplay, 
      error: null 
    };
  } catch (error) {
    return { error: `Error finding grade/section: ${error.message}` };
  }
};

router.post('/upload', excelUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded or invalid file type'
      });
    }

    console.log('📁 Processing student file:', req.file.originalname);

    let rawStudentData = [];
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
      
      rawStudentData = dataRows.map((row, index) => {
        const headerMap = {};
        headers.forEach((header, idx) => {
          if (header) {
            const headerLower = header.toString().toLowerCase().trim();
            headerMap[headerLower] = idx;
          }
        });
        
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
        
        const student = {
          lrn: getValue(['LRN', 'lrn', 'Student LRN', 'student_lrn']),
          first_name: getValue(['First Name', 'first_name', 'First Name', 'First_Name']),
          last_name: getValue(['Last Name', 'last_name', 'Last Name', 'Last_Name']),
          grade: getValue(['Grade', 'grade', 'Grade Level', 'Grade_Level']),
          section: getValue(['Section', 'section', 'Class Section', 'Class_Section']),
          email: getValue(['Email', 'email', 'Student Email', 'Student_Email']),
          phone_number: getValue(['Phone Number', 'phone_number', 'Phone', 'Student Phone', 'Student_Phone']),
          guardian_first_name: getValue(['Guardian First Name', 'guardian_first_name', 'Parent First Name', 'Parent_First_Name']),
          guardian_last_name: getValue(['Guardian Last Name', 'guardian_last_name', 'Parent Last Name', 'Parent_Last_Name']),
          guardian_phone_number: getValue(['Guardian Phone Number', 'guardian_phone_number', 'Parent Phone', 'Parent_Phone', 'Guardian Phone']),
          guardian_email: getValue(['Guardian Email', 'guardian_email', 'Parent Email', 'Parent_Email'])
        };
        
        return student;
      });

    } else if (fileExtension === '.csv') {
      rawStudentData = await new Promise((resolve, reject) => {
        const results = [];
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);
        
        bufferStream
          .pipe(csv())
          .on('data', (data) => {
            const student = {
              lrn: getCsvValue(data, csvHeaders.lrn),
              first_name: getCsvValue(data, csvHeaders.first_name),
              last_name: getCsvValue(data, csvHeaders.last_name),
              grade: getCsvValue(data, csvHeaders.grade),
              section: getCsvValue(data, csvHeaders.section),
              email: getCsvValue(data, csvHeaders.email),
              phone_number: getCsvValue(data, csvHeaders.phone_number),
              guardian_first_name: getCsvValue(data, csvHeaders.guardian_first_name),
              guardian_last_name: getCsvValue(data, csvHeaders.guardian_last_name),
              guardian_phone_number: getCsvValue(data, csvHeaders.guardian_phone_number),
              guardian_email: getCsvValue(data, csvHeaders.guardian_email)
            };
            results.push(student);
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

    console.log(`📊 Found ${rawStudentData.length} raw student records`);
    
    if (rawStudentData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'File contains no data rows'
      });
    }

    const validationResults = [];
    const duplicateLRNs = new Set();
    const lrnSet = new Set();
    const duplicateEmails = new Set();
    const emailSet = new Set();

    rawStudentData.forEach((student, index) => {
      const rowNumber = index + 2;

      const cleanedStudent = cleanStudentData(student);
      const { student: formattedStudent, errors: validationErrors } = validateAndNormalizeStudent(cleanedStudent);

      if (formattedStudent.lrn) {
        if (lrnSet.has(formattedStudent.lrn)) {
          validationErrors.lrn = `LRN ${formattedStudent.lrn} is duplicated in the file`;
          duplicateLRNs.add(formattedStudent.lrn);
        } else {
          lrnSet.add(formattedStudent.lrn);
        }
      }

      // in-file duplicate email check (separate from the DB-level check done
      // later, which catches an email already belonging to a DIFFERENT
      // existing student)
      if (formattedStudent.email) {
        if (emailSet.has(formattedStudent.email)) {
          validationErrors.email = `Email ${formattedStudent.email} is duplicated in the file`;
          duplicateEmails.add(formattedStudent.email);
        } else {
          emailSet.add(formattedStudent.email);
        }
      }

      validationResults.push({
        row: rowNumber,
        student: formattedStudent,
        errors: validationErrors,
        isValid: Object.keys(validationErrors).length === 0
      });
    });

    const invalidRecords = validationResults.filter(r => !r.isValid);
    const validRecords = validationResults.filter(r => r.isValid);
    
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
          data: record.student,
          errors: record.errors
        })),
        errorSummary: errorMessages.slice(0, 5),
        summary: {
          totalRecords: rawStudentData.length,
          validRecords: validRecords.length,
          invalidRecords: invalidRecords.length,
          duplicateLRNs: Array.from(duplicateLRNs),
          duplicateEmails: Array.from(duplicateEmails)
        }
      });
    }

    console.log('🔍 Finding grade and section IDs for each student...');
    const studentsWithIds = [];
    const gradeSectionErrors = [];

    for (const record of validRecords) {
      const { student } = record;
      
      const result = await findGradeAndSectionIds(student.grade, student.section);
      
      if (result.error) {
        gradeSectionErrors.push({
          row: record.row,
          student: student,
          error: result.error
        });
      } else {
        studentsWithIds.push({
          ...student,
          grade_id: result.gradeId,
          section_id: result.sectionId,
          grade: result.gradeDisplay || student.grade,
          section: result.sectionDisplay || student.section,
          // Row number kept only for error reporting below — stripped before insert.
          _row: record.row
        });
      }
    }

    if (gradeSectionErrors.length > 0) {
      console.log(`❌ ${gradeSectionErrors.length} students have invalid grade/section references`);
      
      return res.status(400).json({
        success: false,
        error: 'Some students reference non-existent grades or sections.',
        gradeSectionErrors: gradeSectionErrors.slice(0, 10).map(err => ({
          row: err.row,
          lrn: err.student.lrn,
          grade: err.student.grade,
          section: err.student.section,
          error: err.error
        })),
        summary: {
          totalRecords: rawStudentData.length,
          validData: studentsWithIds.length,
          invalidReferences: gradeSectionErrors.length
        }
      });
    }

    // ------------------------------------------------------------------
    // DB-level email conflict check: does this email already belong to a
    // DIFFERENT student already in the database? (Not the LRN duplicate
    // case — that's handled separately below and is allowed to "skip".)
    //
    // Without this check, a single insert() with N rows would fail
    // ENTIRELY if even one row collided on the unique email constraint,
    // with no indication of which row caused it. This catches it early
    // and reports it the same way the initial validation pass does.
    // ------------------------------------------------------------------
    const emailsToCheck = studentsWithIds
      .map(s => s.email)
      .filter(email => email);

    const existingEmailToLrn = new Map();

    if (emailsToCheck.length > 0) {
      const { data: existingEmailRows, error: emailFetchError } = await supabase
        .from('students')
        .select('lrn, email')
        .in('email', emailsToCheck);

      if (emailFetchError) {
        console.error('Error checking existing emails:', emailFetchError);
        throw new Error(`Database error: ${emailFetchError.message}`);
      }

      if (existingEmailRows && existingEmailRows.length > 0) {
        existingEmailRows.forEach(row => {
          existingEmailToLrn.set(row.email, row.lrn);
        });
      }
    }

    // A conflict only counts if the existing row's LRN is DIFFERENT from
    // this row's LRN — if they match, this is just a legitimate re-upload
    // of the same student (handled by the existingLRNs skip-logic below),
    // not a genuine email collision.
    const emailConflicts = studentsWithIds.filter(s => {
      const existingLrnForEmail = existingEmailToLrn.get(s.email);
      return existingLrnForEmail && existingLrnForEmail !== s.lrn;
    });

    if (emailConflicts.length > 0) {
      console.log(`❌ ${emailConflicts.length} students have emails already belonging to other students in the database`);

      const emailConflictInvalidRecords = emailConflicts.map(s => ({
        row: s._row,
        data: s,
        errors: {
          email: `Email ${s.email} already belongs to another student (LRN ${existingEmailToLrn.get(s.email)}) in the database`
        }
      }));

      const errorMessages = emailConflictInvalidRecords.map(record =>
        `Row ${record.row}: ${Object.values(record.errors).join(', ')}`
      );

      return res.status(400).json({
        success: false,
        error: 'One or more emails already belong to other students in the database.',
        invalidCount: emailConflictInvalidRecords.length,
        invalidRecords: emailConflictInvalidRecords.slice(0, 10),
        errorSummary: errorMessages.slice(0, 5),
        summary: {
          totalRecords: rawStudentData.length,
          validRecords: studentsWithIds.length - emailConflicts.length,
          invalidRecords: emailConflicts.length,
          duplicateLRNs: [],
          duplicateEmails: emailConflicts.map(s => s.email)
        }
      });
    }

    const lrns = studentsWithIds.map(s => s.lrn).filter(lrn => lrn);
    const existingLRNs = [];
    
    if (lrns.length > 0) {
      const { data: existingStudents, error: fetchError } = await supabase
        .from('students')
        .select('lrn')
        .in('lrn', lrns);
      
      if (fetchError) {
        console.error('Error checking existing LRNs:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      } else if (existingStudents && existingStudents.length > 0) {
        existingLRNs.push(...existingStudents.map(s => s.lrn));
        console.log(`⚠️ Found ${existingLRNs.length} existing LRNs in database`);
      }
    }

    // Strip the internal _row field before these objects touch the DB —
    // it's not a real column and Supabase would reject the insert otherwise.
    const stripRowMeta = (student) => {
      const { _row, ...rest } = student;
      return rest;
    };

    const newStudents = studentsWithIds
      .filter(student => !existingLRNs.includes(student.lrn))
      .map(stripRowMeta);

    const existingStudents = studentsWithIds
      .filter(student => existingLRNs.includes(student.lrn))
      .map(stripRowMeta);

    console.log(`📝 Found ${newStudents.length} new students and ${existingStudents.length} existing students`);

    let uploadedData = [];

    if (newStudents.length > 0) {
      console.log(`📝 Adding ${newStudents.length} new students to database...`);
      
      const { data: insertedData, error: insertError } = await supabase
        .from('students')
        .insert(newStudents)
        .select();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }
      
      uploadedData = insertedData || [];
      console.log(`✅ Successfully added ${uploadedData.length} new students`);
    } else {
      console.log('ℹ️ No new students to add');
    }

    if (existingStudents.length > 0) {
      console.log(`ℹ️ Skipping ${existingStudents.length} existing students (not updated)`);
    }

    const newRecordsCreated = uploadedData.length;
    const existingRecordsSkipped = existingStudents.length;

    const response = {
      success: true,
      message: '',
      importedCount: newRecordsCreated,
      summary: {
        totalRecords: rawStudentData.length,
        newRecordsCreated: newRecordsCreated,
        existingRecordsSkipped: existingRecordsSkipped,
        processedRecords: newRecordsCreated,
        gradeSectionErrors: gradeSectionErrors.length
      },
      newStudents: uploadedData || []
    };

    if (gradeSectionErrors.length > 0) {
      response.message = `Added ${newRecordsCreated} students but ${gradeSectionErrors.length} had invalid grade/section references.`;
    } else if (newRecordsCreated === 0) {
      response.message = `No new students added. ${existingRecordsSkipped > 0 ? `All ${rawStudentData.length} students already exist in the system.` : 'File contained no valid data.'}`;
    } else if (existingRecordsSkipped === 0) {
      response.message = `Successfully added ${newRecordsCreated} new student(s)`;
    } else {
      response.message = `Successfully added ${newRecordsCreated} new student(s). ${existingRecordsSkipped} existing student(s) were not modified.`;
    }
    
    console.log(`📱 Phone numbers formatted for Twilio E.164 compatibility`);
    console.log(`📧 Emails normalized and validated`);
    
    res.json(response);

  } catch (error) {
    console.error('❌ Student upload error:', error);
    
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.message.includes('invalid input syntax')) {
      errorMessage = 'Invalid data format in file. Please check your data.';
      statusCode = 400;
    } else if (error.message.includes('duplicate key')) {
      if (error.message.includes('students_email_unique')) {
        errorMessage = 'One or more emails already exist in the database.';
      } else if (error.message.includes('students_student_id_key')) {
        errorMessage = 'Duplicate LRN found in database.';
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

router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Student Upload API',
    timestamp: new Date().toISOString()
  });
});

export default router;