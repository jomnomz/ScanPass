import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './config/supabase.js';
import { sendAttendanceSMS, formatPhoneForIprog, checkIprogBalance } from './services/iProgService.js';

// IMPORT THE MASTER DATA ROUTE
import studentUploadRouter from './routes/studentUpload.js';
import teacherUploadRouter from './routes/teacherUpload.js';
import teacherInviteRouter from './routes/teacherInvite.js'; 
import masterDataUploadRouter from './routes/masterDataUpload.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// USE THE MASTER DATA ROUTE
app.use('/api/students', studentUploadRouter);
app.use('/api/teachers', teacherUploadRouter);
app.use('/api/teacher-invite', teacherInviteRouter); 
app.use('/api/master-data', masterDataUploadRouter);

app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});


app.get('/', async (req, res) => {
  const balance = await checkIprogBalance();
  
  res.json({ 
    message: 'IPROG SMS SERVER RUNNING',
    timestamp: new Date().toISOString(),
    provider: 'iProg Philippines',
    configured: !!process.env.IPROG_API_TOKEN ? '✅ Ready' : '❌ No API Token',
    cost_per_sms: '₱0.30 per SMS',
    instant: 'No verification needed for PH numbers',
    status: 'Ready for production'
  });
});

app.get('/api/health', async (req, res) => {
  const balance = await checkIprogBalance();
  
  res.json({ 
    status: '✅ Server Healthy',
    timestamp: new Date().toISOString(),
    sms: {
      provider: 'iProg Philippines',
      configured: !!process.env.IPROG_API_TOKEN,
      sender_id: process.env.IPROG_SENDER_ID || 'STO NINO',
      enabled: process.env.SMS_ENABLED === 'true',
      business_hours: `${process.env.SMS_BUSINESS_HOURS_START || 6}:00-${process.env.SMS_BUSINESS_HOURS_END || 21}:00`,
      rate_limit: `${process.env.SMS_RATE_LIMIT_MINUTES || 30} minutes`,
      cost_per_sms: '₱0.30',
      instant: 'Works instantly in Philippines',
      credits: '5 free SMS credits'
    },
    environment: process.env.NODE_ENV
  });
});

app.get('/api/iproig/balance', async (req, res) => {
  try {
    const balance = await checkIprogBalance();
    
    if (!balance) {
      return res.status(400).json({
        success: false,
        error: 'iProg not configured'
      });
    }
    
    res.json({
      success: true,
      provider: 'iproig',
      balance: balance.balance,
      cost_per_sms: balance.cost_per_sms,
      note: balance.note || 'Check iProg dashboard for exact balance'
    });
  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/attendance/sms', async (req, res) => {
  try {
    const { studentId, scanType } = req.body;
    
    if (!studentId || !scanType) {
      return res.status(400).json({
        success: false,
        error: 'Missing studentId or scanType'
      });
    }
    
    if (!['in', 'out'].includes(scanType)) {
      return res.status(400).json({
        success: false,
        error: 'Scan type must be "in" or "out"'
      });
    }
    
    console.log(`📨 iProg SMS request: student ${studentId}, ${scanType}`);
    
    const result = await sendAttendanceSMS(studentId, scanType);
    
    res.json({
      success: result.success,
      provider: result.provider,
      cost: result.cost,
      demo: result.demo || false,
      skipped: result.skipped || false,
      message: result.message,
      messageId: result.messageId
    });
    
  } catch (error) {
    console.error('❌ SMS endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/test-iproig-sms', async (req, res) => {
  try {
    const { phone, studentId } = req.body;
    let testPhone = phone;
    let studentName = 'Test Student';
    let guardianName = 'Test Guardian';
    
    if (studentId && !phone) {
      const { data: student } = await supabase
        .from('students')
        .select('guardian_phone_number, first_name, last_name, guardian_first_name')
        .eq('id', studentId)
        .single();
      
      if (student) {
        testPhone = student.guardian_phone_number;
        studentName = `${student.first_name} ${student.last_name}`;
        guardianName = student.guardian_first_name;
      }
    }
    
    if (!testPhone) {
      return res.status(400).json({ 
        success: false,
        error: 'No phone number provided',
        example: '09171234567'
      });
    }
    
    const now = new Date();
    const phTime = now.toLocaleTimeString('en-PH', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true,
      timeZone: 'Asia/Manila'
    });
    
    const phDate = now.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    });
    
    const message = `📱 [IPROG TEST] Magandang araw ${guardianName}! Ito ay test message mula sa iProg SMS. Oras: ${phTime}, Petsa: ${phDate}.`;
    
    let result;
    if (process.env.IPROG_API_TOKEN) {
      try {
        const { sendViaIprog } = await import('./services/iProgService.js');
        result = await sendViaIprog(testPhone, message);
      } catch (error) {
        console.log('⚠️ iProg failed, using demo mode:', error.message);
        result = {
          success: true,
          provider: 'iproig (demo)',
          messageId: `demo-${Date.now()}`,
          cost: '₱0.30',
          note: 'iProg demo - add API token for real SMS'
        };
      }
    } else {
      result = {
        success: true,
        provider: 'iproig (demo)',
        messageId: `demo-${Date.now()}`,
        cost: '₱0.30',
        note: 'Set IPROG_API_TOKEN in .env for real SMS'
      };
    }
    
    res.json({
      success: true,
      phone: testPhone,
      formatted: formatPhoneForIprog(testPhone),
      studentName,
      guardianName,
      provider: result.provider,
      messageId: result.messageId,
      cost: result.cost,
      status: result.status || 'simulated',
      message_preview: message.substring(0, 80) + (message.length > 80 ? '...' : ''),
      note: result.note || 'SMS sent successfully'
    });
    
  } catch (error) {
    console.error('❌ Test SMS error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/chatbot', async (req, res) => {
  try {
    const { userMessage, recentMessages = [] } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Groq API is not configured on the server'
      });
    }

    if (!userMessage || !userMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing user message'
      });
    }

    const systemPrompt = `You are an AI assistant for a QR Code Attendance Tracking System used in educational institutions.

IMPORTANT SYSTEM CONTEXT:
1. SYSTEM NAME: QR Code Attendance Tracking System
2. USER ROLES: Admin, Teacher, Student
3. KEY FEATURES:
   - QR Code generation for classes/sessions
   - Real-time attendance tracking
   - Student check-in via QR code scanning
   - Attendance reports and analytics
   - Admin dashboard for management
   - Teacher portal for class management

4. COMMON ADMIN TASKS:
   - Generate QR codes for classes
   - Manage user accounts (teachers only)
   - Reset passwords
   - Create and upload Students/Teacher/MasterData excel files

5. COMMON TEACHER TASKS:
   - View student attendance that they hold
   - View stats and trends of students that they hold

6. FREQUENTLY ASKED QUESTIONS:
   Q: How do I add teachers, students, or masterdata into the website?
   A: Go to their respective page and use the add student/teacher/masterdata flow to upload an Excel or CSV file.

   Q: How do students check-in?
   A: Students use their QR code and scan it for automatic check-in or check-out.

   Q: What if a student forgets to scan?
   A: Teachers can manually edit attendance in the class attendance section and wait for admin approval.

   Q: How many times can you scan a student's QR code?
   A: Only 2 per day.

RESPONSE GUIDELINES:
- Be specific to THIS attendance tracking system
- Provide step-by-step instructions when asked
- If unsure about a feature, say "I'm not sure about that specific feature"
- Refer to actual tabs or sections in the system
- Keep answers concise but helpful
- Don't make up features that don't exist

Current user is likely an administrator or teacher in the Settings section.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: "Understood. I'm the AI assistant for the QR Code Attendance Tracking System. I'll provide accurate information about QR code generation, attendance tracking, user management, reports, and all system features. I'll refer to the actual interface tabs and functionalities." }]
      },
      ...recentMessages,
      {
        role: 'user',
        parts: [{ text: userMessage.trim() }]
      }
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800
          }
        })
      }
    );

    console.log('Using key:', process.env.GEMINI_API_KEY?.substring(0, 10) + '...');

    const groqResponse = await fetch(
  'https://api.groq.com/openai/v1/chat/completions',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentMessages.map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.parts[0].text
        })),
        { role: 'user', content: userMessage.trim() }
      ],
      temperature: 0.3,
      max_tokens: 800
    })
  }
);

const groqData = await groqResponse.json();

if (!groqResponse.ok) {
  return res.status(groqResponse.status).json({
    success: false,
    error: groqData?.error?.message || 'Groq request failed'
  });
}

const message = groqData?.choices?.[0]?.message?.content;

if (!message) {
  return res.status(502).json({
    success: false,
    error: 'Groq returned an empty response'
  });
}

res.json({ success: true, message });
  } catch (error) {
    console.error('❌ Chatbot endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Chatbot request failed'
    });
  }
});

app.post('/api/webhooks/attendance', async (req, res) => {
  try {
    const { student_id, scan_type } = req.body;
    
    if (student_id && scan_type) {
      console.log(`🤖 Auto-SMS triggered for student ${student_id}, ${scan_type}`);
      
      sendAttendanceSMS(student_id, scan_type)
        .then(result => {
          console.log(`🤖 Auto-SMS result: ${result.success ? '✅' : '❌'} (Provider: ${result.provider})`);
        })
        .catch(err => {
          console.error('🤖 Auto-SMS error:', err);
        });
    }
    
    res.json({ received: true, status: 'processing' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Student sync endpoint (for manual triggering if needed)
app.post('/api/admin/sync-students', async (req, res) => {
  try {
    console.log('🔄 Manual student sync triggered via API');
    
    // We'll create a simple sync function here instead of importing from frontend
    const syncResult = await syncStudentTextFields();
    
    res.json({
      success: syncResult.success,
      message: syncResult.success 
        ? `Synced ${syncResult.updated || 0} students` 
        : 'Sync failed',
      updated: syncResult.updated || 0,
      errors: syncResult.errors || 0,
      error: syncResult.error
    });
    
  } catch (error) {
    console.error('❌ Sync API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/debug/teacher/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      return res.status(404).json({ error: error.message });
    }
    
    res.json({ teacher: data });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/find-teacher', async (req, res) => {
  try {
    const { authUserId, email, employeeId } = req.query;
    
    let query = supabase.from('teachers').select('*');
    
    if (authUserId) {
      query = query.eq('auth_user_id', authUserId);
    } else if (email) {
      query = query.eq('email_address', email);
    } else if (employeeId) {
      query = query.eq('employee_id', employeeId);
    } else {
      return res.status(400).json({ error: 'Provide authUserId, email, or employeeId' });
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      return res.status(404).json({ 
        error: 'Teacher not found',
        details: error.message 
      });
    }
    
    res.json({ found: true, teacher: data });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Student sync function - defined directly in server
const syncStudentTextFields = async () => {
  console.log('🔄 Starting student data sync...');
  
  try {
    // Get all students with their current data
    const { data: students, error: fetchError } = await supabase
      .from('students')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching students:', fetchError);
      return { success: false, error: fetchError.message };
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Update each student
    for (const student of students) {
      try {
        const updates = {};
        let needsUpdate = false;
        
        // Sync grade text from grade_id
        if (student.grade_id) {
          const { data: grade, error: gradeError } = await supabase
            .from('grades')
            .select('grade_level')
            .eq('id', student.grade_id)
            .single();
          
          if (!gradeError && grade && grade.grade_level !== student.grade) {
            updates.grade = grade.grade_level;
            needsUpdate = true;
            console.log(`📝 Student ${student.id}: Syncing grade "${student.grade}" → "${grade.grade_level}"`);
          }
        }
        
        // Sync section text from section_id
        if (student.section_id) {
          const { data: section, error: sectionError } = await supabase
            .from('sections')
            .select('section_name')
            .eq('id', student.section_id)
            .single();
          
          if (!sectionError && section && section.section_name !== student.section) {
            updates.section = section.section_name;
            needsUpdate = true;
            console.log(`📝 Student ${student.id}: Syncing section "${student.section}" → "${section.section_name}"`);
          }
        }
        
        // Update if needed
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('students')
            .update(updates)
            .eq('id', student.id);
          
          if (updateError) {
            console.error(`❌ Error updating student ${student.id}:`, updateError);
            errorCount++;
          } else {
            updatedCount++;
            console.log(`✅ Student ${student.id} synced successfully`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing student ${student.id}:`, err);
        errorCount++;
      }
    }
    
    console.log(`📊 Sync completed: ${updatedCount} students updated, ${errorCount} errors`);
    return { 
      success: true, 
      updated: updatedCount, 
      errors: errorCount 
    };
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return { success: false, error: error.message };
  }
};

// Student sync function
const runStudentSync = async () => {
  try {
    console.log('🔄 Starting student data sync on server startup...');
    const result = await syncStudentTextFields();
    
    if (result.success) {
      console.log(`✅ Student sync completed: ${result.updated || 0} students updated`);
      if (result.errors > 0) {
        console.log(`⚠️ ${result.errors} errors occurred during sync`);
      }
    } else {
      console.error('❌ Student sync failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during student sync:', error);
  }
};

// Start server with sync
app.listen(port, '0.0.0.0', async () => {
  console.log(`
  ============================================
  TEACHER MANAGEMENT SERVER STARTED ON PORT ${port}
  ============================================
  `);
  
  // Run student sync on startup
  await runStudentSync();
  
  console.log(`
  AVAILABLE ENDPOINTS:
  
  TEACHER UPLOAD:
  POST /api/teachers/upload               - Upload teacher data
  
  STUDENT UPLOAD:
  POST /api/students/upload               - Upload student data
  
  MASTER DATA UPLOAD:
  POST /api/master-data/upload            - Upload master data (grades, sections)
  GET  /api/master-data/template          - Download master data template
  GET  /api/master-data/health            - Health check
  
  TEACHER ACCOUNT MANAGEMENT (TEACHER-INVITE):
  POST /api/teacher-invite/invite         - Invite teacher with Resend email
  POST /api/teacher-invite/deactivate     - Deactivate teacher account
  POST /api/teacher-invite/reactivate     - Reactivate teacher account
  POST /api/teacher-invite/resend-invitation - Resend invitation
  POST /api/teacher-invite/delete-teacher - Delete teacher (INACTIVE only)
  GET  /api/teacher-invite/test           - Test endpoint
  GET  /api/teacher-invite/resend-status  - Check Resend configuration
  
  TEACHER ATTENDANCE:
  GET  /api/teacher-invite/get-teacher-id-by-auth
  GET  /api/teacher-invite/get-teacher-id-by-email
  GET  /api/teacher-invite/teacher-classes/:teacherId
  
  IPROG SMS:
  GET  /                         - Server status
  GET  /api/health              - Health check
  GET  /api/iproig/balance      - Check iProg info
  POST /api/attendance/sms      - Send attendance SMS
  POST /api/test-iproig-sms     - Test SMS
  
  ADMIN:
  POST /api/admin/sync-students - Sync student text fields with foreign keys
  
  DEBUG:
  GET  /api/debug/teacher/:id   - Check teacher by ID
  GET  /api/debug/find-teacher  - Find teacher by criteria
  
  📱 IPROG SMS FEATURES:
  • Instant SMS delivery in Philippines
  • Sender Name: ${process.env.IPROG_SENDER_ID || 'STO NINO'}
  • Cost: ₱0.30 per SMS
  • No verification needed for PH numbers
  
  ============================================
  `);
  
  // Configuration check
  console.log('🔧 Current Configuration:');
  console.log('IPROG_API_TOKEN:', process.env.IPROG_API_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('IPROG_SENDER_ID:', process.env.IPROG_SENDER_ID || 'STONINO (default)');
  console.log('SMS_ENABLED:', process.env.SMS_ENABLED === 'true' ? '✅ Yes' : '❌ No');
  console.log('Business Hours:', `${process.env.SMS_BUSINESS_HOURS_START || 6}:00-${process.env.SMS_BUSINESS_HOURS_END || 21}:00`);
  console.log('Rate Limit:', `${process.env.SMS_RATE_LIMIT_MINUTES || 30} minutes`);
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('');
  console.log('💡 Quick Test Teacher Upload:');
  console.log('curl -X POST http://localhost:5000/api/teachers/upload \\');
  console.log('  -F "file=@teachers.xlsx"');
  console.log('');
  console.log('💡 Quick Test Student Upload:');
  console.log('curl -X POST http://localhost:5000/api/students/upload \\');
  console.log('  -F "file=@students.xlsx"');
  console.log('');
  console.log('💡 Quick Test Master Data Upload:');
  console.log('curl -X POST http://localhost:5000/api/master-data/upload \\');
  console.log('  -F "file=@master-data.xlsx"');
  console.log('');
  console.log('💡 Manual Student Sync (if needed):');
  console.log('curl -X POST http://localhost:5000/api/admin/sync-students');
  console.log('');
  console.log('🚀 Server is ready to accept connections!');
});