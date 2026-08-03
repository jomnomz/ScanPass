  // MasterDataUpload.js - Complete fixed version with all validation gaps addressed

  import express from 'express';
  import readXlsxFile from 'read-excel-file/node';
  import csv from 'csv-parser';
  import { excelUpload } from '../middleware/excelUpload.js';
  import { supabase } from '../config/supabase.js';
  import stream from 'stream';
  import path from 'path';

  const router = express.Router();

  const csvHeaders = {
    grade: ['Grade', 'grade', 'Grade Level', 'Grade_Level', 'Level'],
    section: ['Section', 'section', 'Section Name', 'Section_Name', 'Class'],
    class_start: ['Class Start', 'class_start', 'Start Time', 'Start_Time', 'Start'],
    class_end: ['Class End', 'class_end', 'End Time', 'End_Time', 'End'],
    grace_period: ['Grace Period', 'grace_period', 'Grace Period (minutes)', 'Grace_Period', 'Grace Minutes']
  };

  const getCsvValue = (data, keys) => {
    for (const key of keys) {
      if (data[key] !== undefined && data[key] !== null && data[key].toString().trim() !== '') {
        return data[key].toString().trim();
      }
    }
    return '';
  };

  // BUG G FIX: Use UTC getters for Excel Date objects to avoid timezone offset corruption
  const cleanData = (data) => {
    const cleaned = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        let value = data[key];
        
        // BUG G FIX: Use UTC getters to preserve Excel time-of-day values
        if (value instanceof Date) {
          const hours = value.getUTCHours().toString().padStart(2, '0');
          const minutes = value.getUTCMinutes().toString().padStart(2, '0');
          value = `${hours}:${minutes}`;
        } else {
          value = value.toString().trim();
        }
        
        // BUG B FIX: Only strip non-digits if there's at least one digit present
        if (key === 'grade' || key === 'grade_level' || key.toLowerCase().includes('grade')) {
          const numMatch = value.match(/\d+/);
          if (numMatch) {
            // Extract just the digits (e.g., "Grade 7" -> "7")
            value = numMatch[0];
          } else {
            // No digits found - leave the raw value intact so validation can catch it
            // Do NOT strip to empty string
            // value remains as-is (e.g., "Seven")
          }
        }
        
        // BUG C FIX: Capture optional negative sign for grace period
        if ((key === 'grace_period' || key.toLowerCase().includes('grace')) && value) {
          const numMatch = value.match(/-?\d+/); // Allow optional leading minus sign
          if (numMatch) {
            value = numMatch[0];
          } else {
            // No numeric value found, keep as-is for validation
            // value remains as-is (e.g., "invalid")
          }
        }
        
        cleaned[key] = value === '' ? null : value;
      } else {
        cleaned[key] = null;
      }
    });
    return cleaned;
  };

  // BUG E FIX: Added numeric grade check to grade_schedules branch
  const validateMasterData = (type, data) => {
    const errors = {};
    
    if (type === 'grades_sections') {
      if (!data.grade) errors.grade = 'Grade is required';
      if (!data.section) errors.section = 'Section is required';
      
      if (data.grade && !data.grade.match(/^\d+$/)) {
        errors.grade = 'Grade must be a number (e.g., 7, 8, 9, 10)';
      }
      
      // Length validation
      if (data.grade && data.grade.length > 10) {
        errors.grade = 'Grade must be 10 characters or less';
      }
      if (data.section && data.section.length > 50) {
        errors.section = 'Section name must be 50 characters or less';
      }
      
    } else if (type === 'grade_schedules') {
      if (!data.grade) errors.grade = 'Grade is required';
      if (!data.class_start) errors.class_start = 'Class start time is required';
      if (!data.class_end) errors.class_end = 'Class end time is required';
      
      // BUG E FIX: Add numeric grade check for schedules
      if (data.grade && !data.grade.match(/^\d+$/)) {
        errors.grade = 'Grade must be a number (e.g., 7, 8, 9, 10)';
      }
      
      if (data.class_start && !data.class_start.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
        errors.class_start = 'Class start must be in HH:MM 24-hour format';
      }
      
      if (data.class_end && !data.class_end.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
        errors.class_end = 'Class end must be in HH:MM 24-hour format';
      }
      
      if (data.class_start && data.class_end) {
        const start = new Date(`2000-01-01T${data.class_start}`);
        const end = new Date(`2000-01-01T${data.class_end}`);
        
        if (start >= end) {
          errors.class_times = 'Class start time must be before class end time';
        }
      }
      
      if (data.grace_period) {
        const grace = parseInt(data.grace_period);
        if (isNaN(grace) || grace < 0 || grace > 120) {
          errors.grace_period = 'Grace period must be a number between 0 and 120 minutes';
        }
      }
    }
    
    return errors;
  };

  // BUG G FIX: Use UTC getters for Excel Date objects to avoid timezone offset corruption
  const processMasterDataExcel = async (buffer) => {
    try {
      const sheets = await readXlsxFile(buffer, { getSheets: true });
      
      if (!sheets || sheets.length === 0) {
        throw new Error('No sheets found in the Excel file');
      }

      console.log(`📑 Found ${sheets.length} sheet(s):`, sheets.map(s => s.name));

      const allData = {
        grades_sections: [],
        grade_schedules: []
      };

      for (const sheet of sheets) {
        console.log(`📄 Processing sheet: "${sheet.name}"`);
        const rows = await readXlsxFile(buffer, { sheet: sheet.name });
        
        if (rows.length < 2) {
          console.log(`⚠️ Sheet "${sheet.name}" has insufficient data rows (${rows.length})`);
          continue;
        }

        console.log(`📊 Sheet "${sheet.name}" has ${rows.length} rows (including header)`);

        const [headers, ...dataRows] = rows;
        console.log(`🔍 Headers in "${sheet.name}":`, headers.map(h => h?.toString()));
        
        const headerMap = {};
        
        headers.forEach((header, index) => {
          if (header) {
            const headerStr = header.toString().toLowerCase().trim();
            headerMap[headerStr] = index;
          }
        });

        // BUG G FIX: Use UTC getters inside this helper
        const getValue = (row, possibleHeaders) => {
          for (const header of possibleHeaders) {
            const headerLower = header.toLowerCase().trim();
            if (headerMap[headerLower] !== undefined) {
              const value = row[headerMap[headerLower]];
              
              if (value !== undefined && value !== null) {
                if (value instanceof Date) {
                  // Use UTC getters to preserve the actual time value without timezone offset
                  const hours = value.getUTCHours().toString().padStart(2, '0');
                  const minutes = value.getUTCMinutes().toString().padStart(2, '0');
                  return `${hours}:${minutes}`;
                }
                
                return value.toString().trim();
              }
              return '';
            }
          }
          return '';
        };

        const hasClassStart = getValue(headers, [
          'Class Start', 'Start Time', 'Start_Time', 'Start', 'class start'
        ]) !== '';
        
        const hasClassEnd = getValue(headers, [
          'Class End', 'End Time', 'End_Time', 'End', 'class end'
        ]) !== '';
        
        const hasGracePeriod = getValue(headers, [
          'Grace Period', 'Grace Period (minutes)', 'Grace_Period', 'Grace Minutes', 'grace period'
        ]) !== '';
        
        const hasGrade = getValue(headers, [
          'Grade Level', 'Grade', 'Grade_Level', 'grade level', 
          'Level', 'Class Level', 'Class'
        ]) !== '';
        
        const hasSection = getValue(headers, [
          'Section Name', 'Section', 'Section_Name', 'section name', 'Class'
        ]) !== '';

        console.log(`📋 Sheet "${sheet.name}" analysis:`);
        console.log(`   Has Grade: ${hasGrade}`);
        console.log(`   Has Section: ${hasSection}`);
        console.log(`   Has Class Start: ${hasClassStart}`);
        console.log(`   Has Class End: ${hasClassEnd}`);
        console.log(`   Has Grace Period: ${hasGracePeriod}`);

        // BUG A FIX: Determine record type by present fields, not by grade presence
        const isScheduleSheet = hasClassStart && hasClassEnd;
        const isGradeSectionSheet = hasSection && !isScheduleSheet;
        
        if (isScheduleSheet) {
          console.log(`⏰ Processing Grade Schedules from sheet: "${sheet.name}"`);
          
          let count = 0;
          dataRows.forEach((row, index) => {
            const grade = getValue(row, ['Grade Level', 'Grade', 'Grade_Level', 'grade level', 'Level', 'Class']);
            const classStart = getValue(row, ['Class Start', 'Start Time', 'Start_Time', 'Start', 'class start']);
            const classEnd = getValue(row, ['Class End', 'End Time', 'End_Time', 'End', 'class end']);
            const gracePeriod = getValue(row, ['Grace Period', 'Grace Period (minutes)', 'Grace_Period', 'Grace Minutes', 'grace period']);
            
            // BUG A FIX: Push row even if grade is empty - let validation handle it
            // Only require class_start and class_end to be present for schedule rows
            if (classStart || classEnd) {
              allData.grade_schedules.push({
                grade: grade || '', // Empty grade will be caught by validation
                class_start: classStart || '',
                class_end: classEnd || '',
                grace_period: gracePeriod || '15'
              });
              count++;
              console.log(`   Row ${index + 1}: Grade="${grade || '(empty)'}", Start="${classStart}", End="${classEnd}", Grace="${gracePeriod || '15'}"`);
            } else {
              console.log(`   ⚠️ Row ${index + 1}: No schedule data found - skipping`);
            }
          });
          
          console.log(`✅ Extracted ${count} grade schedule records from "${sheet.name}"`);
          
        } else if (isGradeSectionSheet) {
          console.log(`📊 Processing Grades & Sections from sheet: "${sheet.name}"`);
          
          let count = 0;
          dataRows.forEach((row, index) => {
            const grade = getValue(row, ['Grade Level', 'Grade', 'Grade_Level', 'grade level', 'Level', 'Class']);
            const section = getValue(row, ['Section Name', 'Section', 'Section_Name', 'section name', 'Class']);
            
            // BUG A FIX: Push row even if grade or section is empty - let validation handle it
            if (section || grade) {
              allData.grades_sections.push({
                grade: grade || '', // Empty grade will be caught by validation
                section: section || '' // Empty section will be caught by validation
              });
              count++;
              console.log(`   Row ${index + 1}: Grade="${grade || '(empty)'}", Section="${section || '(empty)'}"`);
            } else {
              console.log(`   ⚠️ Row ${index + 1}: No data found - skipping`);
            }
          });
          
          console.log(`✅ Extracted ${count} grade/section records from "${sheet.name}"`);
        } else {
          console.log(`⚠️ Sheet "${sheet.name}" has unrecognized format.`);
        }
      }

      console.log(`\n📈 Extraction Summary:`);
      console.log(`   Grades/Sections: ${allData.grades_sections.length} records`);
      console.log(`   Grade Schedules: ${allData.grade_schedules.length} records`);

      if (allData.grades_sections.length > 0) {
        console.log('\n📝 Sample Grades/Sections data (first 3):');
        allData.grades_sections.slice(0, 3).forEach((item, i) => {
          console.log(`   ${i + 1}. Grade: "${item.grade}", Section: "${item.section}"`);
        });
      }

      if (allData.grade_schedules.length > 0) {
        console.log('\n⏰ Sample Grade Schedules data (first 3):');
        allData.grade_schedules.slice(0, 3).forEach((item, i) => {
          console.log(`   ${i + 1}. Grade: "${item.grade}", Start: "${item.class_start}", End: "${item.class_end}", Grace: "${item.grace_period}"`);
        });
      }

      const hasGradesSections = allData.grades_sections.length > 0;
      const hasGradeSchedules = allData.grade_schedules.length > 0;

      const dataTypes = [];
      if (hasGradesSections) dataTypes.push('grades_sections');
      if (hasGradeSchedules) dataTypes.push('grade_schedules');

      if (dataTypes.length === 0) {
        throw new Error('No valid data found in any sheet. Please check your file format.');
      }

      return {
        type: dataTypes.length === 1 ? dataTypes[0] : 'multiple',
        ...allData
      };
      
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw new Error(`Error processing Excel file: ${error.message}`);
    }
  };

  // BUG A FIX: CSV processing now routes ALL rows to validation
  const processMasterDataCSV = async (buffer) => {
    return new Promise((resolve, reject) => {
      const gradesSections = [];
      const gradeSchedules = [];
      
      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);
      
      bufferStream
        .pipe(csv())
        .on('data', (data) => {
          const grade = getCsvValue(data, csvHeaders.grade);
          const classStart = getCsvValue(data, csvHeaders.class_start);
          const section = getCsvValue(data, csvHeaders.section);
          const classEnd = getCsvValue(data, csvHeaders.class_end);
          const gracePeriod = getCsvValue(data, csvHeaders.grace_period);
          
          // BUG A FIX: Route based on field presence, not grade presence
          // Check if this row has schedule-related fields
          const hasScheduleData = classStart || classEnd;
          
          if (hasScheduleData) {
            // This is a schedule row - push even if grade is empty
            gradeSchedules.push({
              grade: grade || '', // Empty grade will be caught by validation
              class_start: classStart || '',
              class_end: classEnd || '',
              grace_period: gracePeriod || '15'
            });
          } else if (section) {
            // This is a grade/section row - push even if grade is empty
            gradesSections.push({
              grade: grade || '', // Empty grade will be caught by validation
              section: section || '' // Empty section will be caught by validation
            });
          } else if (grade) {
            // Only grade present, but no section or schedule data - treat as grade/section with missing section
            gradesSections.push({
              grade: grade || '',
              section: '' // Missing section will be caught by validation
            });
          }
          // If no fields at all, silently skip (completely empty row)
        })
        .on('end', () => {
          console.log(`CSV Summary: Grades/Sections: ${gradesSections.length}, Grade Schedules: ${gradeSchedules.length}`);
          
          const data = {
            grades_sections: gradesSections,
            grade_schedules: gradeSchedules
          };
          
          const dataTypes = [];
          if (gradesSections.length > 0) dataTypes.push('grades_sections');
          if (gradeSchedules.length > 0) dataTypes.push('grade_schedules');
          
          if (dataTypes.length === 0) {
            resolve({ type: 'unknown', data: {} });
          } else if (dataTypes.length === 1) {
            resolve({ 
              type: dataTypes[0], 
              ...data 
            });
          } else {
            resolve({ 
              type: 'multiple', 
              ...data 
            });
          }
        })
        .on('error', reject);
    });
  };

  // BUG F FIX: Don't return early on validation errors - continue to find all errors
  const importGradesSections = async (data, sheetName = 'Grades & Sections') => {
    const results = {
      grades: { inserted: 0, skipped: 0, errors: [], details: [] },
      sections: { inserted: 0, skipped: 0, errors: [], details: [] },
      invalidRecords: []
    };
    
    try {
      console.log(`🔄 Starting import of ${data.length} grade/section records`);
      
      // BUG F FIX: First pass - validate each row but DON'T return early
      const validatedRecords = [];
      const invalidRecords = [];
      
      data.forEach((item, index) => {
        const rowNumber = index + 1;
        const cleaned = cleanData(item);
        
        const errors = validateMasterData('grades_sections', cleaned);
        
        if (Object.keys(errors).length > 0) {
          invalidRecords.push({
            row: rowNumber,
            sheet: sheetName,
            data: cleaned,
            errors: errors
          });
        } else {
          validatedRecords.push({
            row: rowNumber,
            data: cleaned
          });
        }
      });
      
      // Store first-pass validation errors
      results.invalidRecords = invalidRecords;
      
      // BUG F FIX: Don't return early - continue processing valid records
      // Only proceed if there are valid records to process
      if (validatedRecords.length === 0) {
        console.log(`ℹ️ No valid records to process, returning ${invalidRecords.length} validation errors`);
        return results;
      }
      
      // Proceed with valid records only
      const cleanedData = validatedRecords.map(r => r.data);
      
      // Step 1: Get or create grades
      const uniqueGrades = [...new Set(cleanedData.map(item => item.grade))];
      
      console.log(`📚 Unique grades:`, uniqueGrades);

      const { data: existingGrades, error: existingGradesError } = await supabase
        .from('grades')
        .select('id, grade_level')
        .in('grade_level', uniqueGrades);
      
      if (existingGradesError) {
        console.error('❌ Error checking existing grades:', existingGradesError);
        results.grades.errors.push({ error: existingGradesError.message });
        return results;
      }
      
      const existingGradeMap = {};
      const newGrades = [];
      
      existingGrades?.forEach(grade => {
        existingGradeMap[grade.grade_level] = grade.id;
      });
      
      uniqueGrades.forEach(gradeName => {
        if (!existingGradeMap[gradeName]) {
          newGrades.push(gradeName);
        }
      });
      
      console.log(`📊 Found ${existingGrades?.length || 0} existing grades, ${newGrades.length} new grades`);

      const gradeMap = { ...existingGradeMap };
      
      if (newGrades.length > 0) {
        console.log(`📤 Inserting ${newGrades.length} new grades...`);
        const { data: insertedGrades, error: insertError } = await supabase
          .from('grades')
          .insert(newGrades.map(gradeName => ({ grade_level: gradeName })))
          .select('id, grade_level');
          
        if (insertError) {
          console.error('❌ Error inserting new grades:', insertError);
          results.grades.errors.push({ error: insertError.message });
          return results;
        } else {
          insertedGrades?.forEach(grade => {
            gradeMap[grade.grade_level] = grade.id;
            results.grades.inserted++;
            results.grades.details.push({ grade: grade.grade_level, grade_id: grade.id });
          });
        }
      }
      
      results.grades.skipped = existingGrades?.length || 0;
      console.log(`✅ Grades: ${results.grades.inserted} inserted, ${results.grades.skipped} skipped`);

      // BUG F FIX: Step 2 - Check grade mapping and collect errors without returning early
      const missingGradeErrors = [];
      const validGradeRecords = [];
      
      cleanedData.forEach((item, index) => {
        const gradeId = gradeMap[item.grade];
        if (!gradeId) {
          missingGradeErrors.push({
            row: validatedRecords[index].row,
            sheet: sheetName,
            data: { grade: item.grade, section: item.section },
            errors: { grade: `Grade '${item.grade}' could not be matched or created` }
          });
        } else {
          validGradeRecords.push({
            ...item,
            gradeId: gradeId,
            row: validatedRecords[index].row
          });
        }
      });
      
      // Append missing grade errors to invalidRecords
      if (missingGradeErrors.length > 0) {
        console.log(`❌ Found ${missingGradeErrors.length} records with unmatchable grades`);
        results.invalidRecords = results.invalidRecords.concat(missingGradeErrors);
      }
      
      // BUG F FIX: If all records have grade issues, return now (nothing left to process)
      if (validGradeRecords.length === 0) {
        console.log(`ℹ️ No records with valid grades to process`);
        return results;
      }

      // BUG D FIX: Comprehensive duplicate detection - continue processing all records
      console.log('\n🔍 Step 3: Checking for duplicates (case-insensitive)...');
      
      // First, check in-file duplicates
      const seenSections = new Map(); // key: gradeId_normalizedSection -> { original, row }
      const duplicateErrors = [];
      const uniqueSectionRecords = [];
      
      validGradeRecords.forEach((item, index) => {
        const normalizedSection = item.section.trim().toLowerCase();
        const key = `${item.gradeId}_${normalizedSection}`;
        
        if (seenSections.has(key)) {
          const existing = seenSections.get(key);
          // This is a duplicate - report it
          duplicateErrors.push({
            row: item.row,
            sheet: sheetName,
            data: { grade: item.grade, section: item.section },
            errors: { 
              section: `Section "${item.section}" duplicates "${existing.original}" (case-insensitive) for grade ${item.grade}` 
            }
          });
        } else {
          seenSections.set(key, {
            original: item.section,
            row: item.row,
            gradeId: item.gradeId,
            grade: item.grade
          });
          uniqueSectionRecords.push(item);
        }
      });
      
      // Append duplicate errors to invalidRecords
      if (duplicateErrors.length > 0) {
        console.log(`❌ Found ${duplicateErrors.length} duplicate sections in the file`);
        results.invalidRecords = results.invalidRecords.concat(duplicateErrors);
      }
      
      // BUG F FIX: If we have duplicate errors but no unique records, return
      if (uniqueSectionRecords.length === 0) {
        console.log(`ℹ️ No unique sections to process`);
        return results;
      }
      
      // Now check against database with case-insensitive comparison
      const sectionsToInsert = [];
      const dbDuplicateErrors = [];
      
      // Group unique sections by grade for efficient DB checking
      const sectionsByGrade = {};
      uniqueSectionRecords.forEach(item => {
        if (!sectionsByGrade[item.gradeId]) {
          sectionsByGrade[item.gradeId] = [];
        }
        sectionsByGrade[item.gradeId].push(item);
      });
      
      // Check each grade's sections against DB
      for (const [gradeId, sections] of Object.entries(sectionsByGrade)) {
        const { data: existingSections, error: checkError } = await supabase
          .from('sections')
          .select('id, section_name')
          .eq('grade_id', parseInt(gradeId));
        
        if (checkError) {
          console.error(`❌ Error checking sections for grade ${gradeId}:`, checkError);
          results.sections.errors.push({ 
            grade_id: gradeId, 
            error: checkError.message 
          });
          continue;
        }
        
        // Check each section against existing DB sections
        for (const section of sections) {
          const normalizedNew = section.section.trim().toLowerCase();
          const existingMatch = existingSections?.find(existing => 
            existing.section_name.trim().toLowerCase() === normalizedNew
          );
          
          if (existingMatch) {
            console.log(`✅ Section "${section.section}" already exists (as "${existingMatch.section_name}")`);
            results.sections.skipped++;
            results.sections.details.push({
              grade_id: section.gradeId,
              section_name: section.section,
              existing_id: existingMatch.id,
              action: 'skipped'
            });
          } else {
            sectionsToInsert.push({
              grade_id: section.gradeId,
              section_name: section.section,
              row: section.row,
              grade: section.grade
            });
          }
        }
      }
      
      console.log(`📊 Found ${results.sections.skipped} existing sections, ${sectionsToInsert.length} new sections`);

      // BUG F FIX: If we have DB duplicate errors, append them
      if (dbDuplicateErrors.length > 0) {
        results.invalidRecords = results.invalidRecords.concat(dbDuplicateErrors);
      }

      // Step 4: Insert new sections - ONLY if no errors at all
      if (results.invalidRecords.length === 0 && sectionsToInsert.length > 0) {
        console.log('\n📋 Step 4: Processing new sections...');
        console.log(`📤 Inserting ${sectionsToInsert.length} new sections...`);
        
        const { data: insertedSections, error: insertError } = await supabase
          .from('sections')
          .insert(sectionsToInsert.map(s => ({
            grade_id: s.grade_id,
            section_name: s.section_name
          })))
          .select('id, grade_id, section_name');
          
        if (insertError) {
          console.error('❌ Error inserting new sections:', insertError);
          results.sections.errors.push({ error: insertError.message });
        } else {
          insertedSections?.forEach(section => {
            results.sections.inserted++;
            results.sections.details.push({ 
              section_id: section.id,
              grade_id: section.grade_id,
              section_name: section.section_name
            });
          });
        }
      } else if (results.invalidRecords.length > 0) {
        console.log(`⏭️ Skipping section inserts due to ${results.invalidRecords.length} validation errors`);
      }
      
      console.log(`\n📊 FINAL IMPORT SUMMARY:`);
      console.log(`   Grades: ${results.grades.inserted} inserted, ${results.grades.skipped} skipped`);
      console.log(`   Sections: ${results.sections.inserted} inserted, ${results.sections.skipped} skipped`);
      console.log(`   Total errors: ${results.invalidRecords.length}`);
      
      return results;
    } catch (error) {
      console.error('❌ Error in importGradesSections:', error);
      throw error;
    }
  };

  // BUG F FIX: Don't return early on validation errors - continue to find all errors
  const importGradeSchedules = async (data, sheetName = 'Grade Schedules') => {
    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      details: [],
      invalidRecords: []
    };
    
    try {
      console.log(`🔄 Starting import of ${data.length} grade schedule records`);
      
      // BUG F FIX: First pass - validate each row but DON'T return early
      const validatedRecords = [];
      const invalidRecords = [];
      
      data.forEach((item, index) => {
        const rowNumber = index + 1;
        const cleaned = cleanData(item);
        
        const errors = validateMasterData('grade_schedules', cleaned);
        
        if (Object.keys(errors).length > 0) {
          invalidRecords.push({
            row: rowNumber,
            sheet: sheetName,
            data: cleaned,
            errors: errors
          });
        } else {
          validatedRecords.push({
            row: rowNumber,
            data: cleaned
          });
        }
      });
      
      // Store first-pass validation errors
      results.invalidRecords = invalidRecords;
      
      // BUG F FIX: Don't return early - continue processing valid records
      // Only proceed if there are valid records to process
      if (validatedRecords.length === 0) {
        console.log(`ℹ️ No valid records to process, returning ${invalidRecords.length} validation errors`);
        return results;
      }
      
      // Deduplicate by grade (keep first occurrence)
      const scheduleMap = {};
      const uniqueSchedules = [];
      
      validatedRecords.forEach(record => {
        const key = record.data.grade;
        if (key && !scheduleMap[key]) {
          scheduleMap[key] = true;
          uniqueSchedules.push({
            ...record.data,
            row: record.row
          });
        }
      });
      
      console.log(`📊 Processing ${uniqueSchedules.length} unique grade schedules`);
      
      // BUG F FIX: Process each schedule, collecting errors without early return
      for (const item of uniqueSchedules) {
        console.log(`⏰ Processing schedule for grade "${item.grade}": ${item.class_start} - ${item.class_end} (Grace: ${item.grace_period || '15'} min)`);
        
        const { data: gradeData, error: gradeError } = await supabase
          .from('grades')
          .select('id, grade_level')
          .eq('grade_level', item.grade)
          .single();
          
        if (gradeError || !gradeData) {
          const errorMsg = `Grade "${item.grade}" not found in the system. Please import grades first.`;
          console.log(`❌ ${errorMsg}`);
          results.invalidRecords.push({
            row: item.row,
            sheet: sheetName,
            data: { grade: item.grade, class_start: item.class_start, class_end: item.class_end },
            errors: { grade: errorMsg }
          });
          continue;
        }
        
        const gradeId = gradeData.id;
        console.log(`✅ Found grade ID ${gradeId} for grade "${item.grade}"`);
        
        const { data: existingSchedule, error: checkError } = await supabase
          .from('grade_schedules')
          .select('id, class_start, class_end, grace_period_minutes')
          .eq('grade_id', gradeId)
          .maybeSingle();
          
        if (checkError && checkError.code !== 'PGRST116') {
          console.log(`❌ Error checking existing schedule:`, checkError);
          results.errors.push({ 
            data: item, 
            error: `Error checking existing schedule: ${checkError.message}` 
          });
          continue;
        }
        
        const gracePeriod = item.grace_period ? parseInt(item.grace_period) : 15;
        
        const isSameSchedule = existingSchedule && 
          existingSchedule.class_start === item.class_start && 
          existingSchedule.class_end === item.class_end && 
          existingSchedule.grace_period_minutes === gracePeriod;
        
        if (existingSchedule) {
          if (isSameSchedule) {
            console.log(`✅ Schedule for grade "${item.grade}" already exists with same data, skipping...`);
            results.skipped++;
            results.details.push({ 
              grade: item.grade, 
              grade_id: gradeId,
              schedule_id: existingSchedule.id,
              class_start: item.class_start,
              class_end: item.class_end,
              grace_period: gracePeriod,
              action: 'skipped',
              reason: 'Already exists'
            });
          } else {
            console.log(`📝 Updating existing schedule for grade ID: ${gradeId}`);
            const { data: scheduleData, error: updateError } = await supabase
              .from('grade_schedules')
              .update({
                class_start: item.class_start,
                class_end: item.class_end,
                grace_period_minutes: gracePeriod,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingSchedule.id)
              .select();
              
            if (updateError) {
              console.log(`❌ Schedule update error:`, updateError);
              results.errors.push({ 
                data: item, 
                error: updateError.message 
              });
            } else {
              console.log(`✅ Schedule updated for grade "${item.grade}" (ID: ${existingSchedule.id})`);
              results.updated++;
              results.details.push({ 
                grade: item.grade, 
                grade_id: gradeId,
                schedule_id: existingSchedule.id,
                class_start: item.class_start,
                class_end: item.class_end,
                grace_period: gracePeriod,
                action: 'updated'
              });
            }
          }
        } else {
          // BUG F FIX: Only insert if no errors exist
          if (results.invalidRecords.length === 0 && results.errors.length === 0) {
            console.log(`📤 Inserting new schedule for grade ID: ${gradeId}`);
            const { data: scheduleData, error: insertError } = await supabase
              .from('grade_schedules')
              .insert({
                grade_id: gradeId,
                class_start: item.class_start,
                class_end: item.class_end,
                grace_period_minutes: gracePeriod
              })
              .select();
              
            if (insertError) {
              console.log(`❌ Schedule insert error:`, insertError);
              results.errors.push({ 
                data: item, 
                error: insertError.message 
              });
            } else if (scheduleData && scheduleData.length > 0) {
              console.log(`✅ Schedule inserted for grade "${item.grade}" (ID: ${scheduleData[0]?.id})`);
              results.inserted++;
              results.details.push({ 
                grade: item.grade, 
                grade_id: gradeId,
                schedule_id: scheduleData[0]?.id,
                class_start: item.class_start,
                class_end: item.class_end,
                grace_period: gracePeriod,
                action: 'inserted'
              });
            }
          } else {
            console.log(`⏭️ Skipping insert for grade "${item.grade}" due to existing errors`);
          }
        }
      }
      
      console.log(`📊 Grade Schedule Import Summary: ${results.inserted} inserted, ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors, ${results.invalidRecords.length} invalid records`);
      return results;
    } catch (error) {
      console.error('❌ Error in importGradeSchedules:', error);
      throw error;
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

      console.log('\n' + '='.repeat(60));
      console.log('📁 STARTING MASTER DATA UPLOAD');
      console.log('='.repeat(60));
      console.log(`File: ${req.file.originalname}`);
      console.log(`Size: ${req.file.size} bytes`);
      console.log(`Type: ${req.file.mimetype}`);

      let processedData;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();

      if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        console.log('\n📄 Processing as Excel file...');
        processedData = await processMasterDataExcel(req.file.buffer);
      } else if (fileExtension === '.csv') {
        console.log('\n📄 Processing as CSV file...');
        processedData = await processMasterDataCSV(req.file.buffer);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv files'
        });
      }

      console.log(`\n📊 Detected data type: ${processedData.type}`);
      console.log('Starting database import...');

      let importResults = {};
      let allInvalidRecords = [];
      let responseData = {
        success: true,
        type: processedData.type,
        summary: {},
        message: '',
        warnings: [],
        invalidRecords: [],
        invalidCount: 0
      };

      const dataTypes = [];
      if (processedData.grades_sections && processedData.grades_sections.length > 0) {
        dataTypes.push('grades_sections');
      }
      if (processedData.grade_schedules && processedData.grade_schedules.length > 0) {
        dataTypes.push('grade_schedules');
      }

      for (const dataType of dataTypes) {
        if (dataType === 'grades_sections') {
          console.log('\n' + '='.repeat(60));
          console.log('📚 IMPORTING GRADES & SECTIONS');
          console.log('='.repeat(60));
          
          const results = await importGradesSections(processedData.grades_sections);
          importResults.grades_sections = results;
          
          if (results.invalidRecords && results.invalidRecords.length > 0) {
            allInvalidRecords = allInvalidRecords.concat(results.invalidRecords);
          }
          
          responseData.summary.gradesInserted = results.grades.inserted;
          responseData.summary.gradesSkipped = results.grades.skipped;
          responseData.summary.sectionsInserted = results.sections.inserted;
          responseData.summary.sectionsSkipped = results.sections.skipped;
          responseData.summary.totalGradesSectionsRecords = processedData.grades_sections.length;
          
          if (results.grades.errors.length > 0) {
            responseData.warnings.push(`Grades errors: ${results.grades.errors.length}`);
          }
          if (results.sections.errors.length > 0) {
            responseData.warnings.push(`Sections errors: ${results.sections.errors.length}`);
          }
          
        } else if (dataType === 'grade_schedules') {
          console.log('\n' + '='.repeat(60));
          console.log('⏰ IMPORTING GRADE SCHEDULES');
          console.log('='.repeat(60));
          
          const results = await importGradeSchedules(processedData.grade_schedules);
          importResults.grade_schedules = results;
          
          if (results.invalidRecords && results.invalidRecords.length > 0) {
            allInvalidRecords = allInvalidRecords.concat(results.invalidRecords);
          }
          
          responseData.summary.gradeSchedulesInserted = results.inserted;
          responseData.summary.gradeSchedulesUpdated = results.updated;
          responseData.summary.gradeSchedulesSkipped = results.skipped;
          responseData.summary.totalGradeSchedulesRecords = processedData.grade_schedules.length;
          
          if (results.errors.length > 0) {
            responseData.warnings.push(`Grade schedules errors: ${results.errors.length}`);
          }
          
          const gradeErrors = results.errors.filter(err => 
            err.error && err.error.includes('not found in database')
          );
          if (gradeErrors.length > 0) {
            responseData.warnings.push('Some grade schedules could not be imported because grades were not found. Import grades first.');
          }
        }
      }

      if (allInvalidRecords.length > 0) {
        responseData.success = false;
        responseData.invalidRecords = allInvalidRecords;
        responseData.invalidCount = allInvalidRecords.length;
        responseData.error = `Import failed — ${allInvalidRecords.length} row(s) have errors.`;
        
        const errorMessages = allInvalidRecords.map(record => 
          `Row ${record.row}: ${Object.values(record.errors).join(', ')}`
        );
        responseData.errorSummary = errorMessages.slice(0, 5);
        
        console.log(`\n❌ Found ${allInvalidRecords.length} invalid records total`);
        console.log('Error summary:', errorMessages.slice(0, 3));
        
        return res.status(400).json(responseData);
      }

      // Success path
      const messages = [];
      if (responseData.summary.gradesInserted > 0) {
        messages.push(`${responseData.summary.gradesInserted} new grades`);
      }
      if (responseData.summary.gradesSkipped > 0) {
        messages.push(`${responseData.summary.gradesSkipped} grades skipped (already exist)`);
      }
      if (responseData.summary.sectionsInserted > 0) {
        messages.push(`${responseData.summary.sectionsInserted} new sections`);
      }
      if (responseData.summary.sectionsSkipped > 0) {
        messages.push(`${responseData.summary.sectionsSkipped} sections skipped (already exist)`);
      }
      if (responseData.summary.gradeSchedulesInserted > 0) {
        messages.push(`${responseData.summary.gradeSchedulesInserted} new grade schedules`);
      }
      if (responseData.summary.gradeSchedulesUpdated > 0) {
        messages.push(`${responseData.summary.gradeSchedulesUpdated} grade schedules updated`);
      }
      if (responseData.summary.gradeSchedulesSkipped > 0) {
        messages.push(`${responseData.summary.gradeSchedulesSkipped} grade schedules skipped (already exist)`);
      }
      
      if (messages.length > 0) {
        responseData.message = `Import completed: ${messages.join(', ')}`;
      } else {
        responseData.message = 'No new data to import. All records already exist in the system.';
      }

      console.log('\n' + '='.repeat(60));
      console.log('✅ UPLOAD COMPLETE');
      console.log('='.repeat(60));
      console.log(`Message: ${responseData.message}`);
      console.log(`Summary:`, JSON.stringify(responseData.summary, null, 2));
      
      if (responseData.warnings && responseData.warnings.length > 0) {
        console.log(`Warnings:`, responseData.warnings);
      }
      
      console.log('='.repeat(60) + '\n');

      res.json(responseData);

    } catch (error) {
      console.error('\n❌ MASTER DATA UPLOAD ERROR:', error);
      console.error('Stack trace:', error.stack);
      
      res.status(500).json({
        success: false,
        error: `Upload failed: ${error.message}`,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  router.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      service: 'Master Data Upload API',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/template', (req, res) => {
    const templatePath = path.join(process.cwd(), 'templates', 'master-data-template.xlsx');
    
    res.download(templatePath, 'master-data-template.xlsx', (err) => {
      if (err) {
        console.error('Error downloading template:', err);
        res.status(500).json({
          success: false,
          error: 'Template file not found'
        });
      }
    });
  });

  export default router;