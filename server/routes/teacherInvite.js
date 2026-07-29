import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

router.get('/test', (req, res) => {
  console.log('✅ /api/teacher-invite/test endpoint hit!');
  res.json({
    success: true,
    message: 'Teacher invite routes are working',
    timestamp: new Date().toISOString(),
    query: req.query
  });
});

async function sendResendEmail(email, firstName, tempPassword) {
  try {
    console.log(`📤 Sending Resend email to: ${email}`);
    
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your_resend_api_key') {
      console.error('❌ Resend API key not configured');
      return { success: false, error: 'Resend API key not configured' };
    }
    
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/`;

    console.log('🔍 DEBUG - FRONTEND_URL env var is:', process.env.FRONTEND_URL);
    console.log('🔍 DEBUG - loginUrl resolved to:', loginUrl);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Stonino High School <noreply@stoninohighschool.xyz>',
        to: [email],
        subject: 'Your Teacher Account Login Details',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Teacher Account</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .credentials { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3B82F6; margin: 20px 0; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff5f5; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
              .password { font-size: 20px; font-weight: bold; color: #dc3545; background: #fff5f5; padding: 10px; border-radius: 5px; display: inline-block; margin: 5px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Welcome to Stonino High School! 🎓</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Teacher Account Invitation</p>
              </div>
              <div class="content">
                <p>Hello <strong>${firstName}</strong>,</p>
                
                <p>Your teacher account has been created successfully. Here are your login credentials:</p>
                
                <div class="credentials">
                  <h3 style="margin-top: 0; color: #3B82F6;">Your Login Details</h3>
                  <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Temporary Password:</strong></p>
                  <div class="password">${tempPassword}</div>
                </div>
                
                <p><strong>To get started:</strong></p>
                <ol>
                  <li>Click the button below to go to our Login page</li>
                  <li>Enter your email: <strong>${email}</strong></li>
                  <li>Enter the temporary password shown above</li>
                  <li>Your account will be automatically activated on first login</li>
                </ol>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" class="button">Login to Your Account</a>
                </div>
                
                <div class="footer">
                  <p><strong>Important:</strong> Keep your password secure. Contact admin if you need to reset it.</p>
                  <p>If you didn't expect this invitation, please contact the school administration.</p>
                  <p>Best regards,<br><strong>Stonino High School</strong></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Hello ${firstName},

Your teacher account has been created successfully!

LOGIN DETAILS:
Login URL: ${loginUrl}
Email: ${email}
Temporary Password: ${tempPassword}

INSTRUCTIONS:
1. Go to: ${loginUrl}
2. Enter your email: ${email}
3. Enter temporary password: ${tempPassword}
4. Your account will be automatically activated on first login

Keep your password secure. Contact admin if you need to reset it.

If you didn't expect this invitation, please contact the school administration.

Best regards,
Stonino High School`
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Resend API error:', response.status, errorText);
      return { success: false, error: `Resend API error: ${response.status}`, details: errorText };
    }
    
    const data = await response.json();
    console.log('✅ Resend email sent:', data);
    return { success: true, data: data };
    
  } catch (error) {
    console.error('❌ Resend error:', error);
    return { success: false, error: error.message };
  }
}

async function sendPasswordChangeEmail(email, firstName) {
  try {
    if (!RESEND_API_KEY) {
      console.log('⚠️ Resend API key not configured, skipping email');
      return { success: false, error: 'Resend not configured' };
    }
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Stonino High School <noreply@stoninohighschool.xyz>',
        to: [email],
        subject: 'Your Password Has Been Changed',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Changed</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .alert { background: #f0f9ff; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0;">Password Changed Successfully</h2>
              </div>
              <div class="content">
                <p>Hello <strong>${firstName}</strong>,</p>
                
                <div class="alert">
                  <h3 style="margin-top: 0; color: #3B82F6;">Password Update Confirmation</h3>
                  <p>Your password for Stonino High School has been successfully changed.</p>
                </div>
                
                <p><strong>Important Security Information:</strong></p>
                <ul>
                  <li>If you did not make this change, please contact the school administration immediately</li>
                  <li>Keep your new password secure and don't share it with anyone</li>
                  <li>Consider using a password manager for better security</li>
                </ul>
                
                <p>If you need to reset your password again in the future, you can do so from the Settings page after logging in.</p>
                
                <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
                  <p>Best regards,<br><strong>Stonino High School</strong></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Hello ${firstName},

Your password for Stonino High School has been successfully changed.

IMPORTANT SECURITY INFORMATION:
• If you did not make this change, please contact the school administration immediately
• Keep your new password secure and don't share it with anyone
• Consider using a password manager for better security

If you need to reset your password again in the future, you can do so from the Settings page after logging in.

This is an automated message. Please do not reply to this email.

Best regards,
Stonino High School`
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Password change email failed:', errorText);
      return { success: false, error: errorText };
    }
    
    const data = await response.json();
    console.log('✅ Password change email sent:', data);
    return { success: true, data: data };
    
  } catch (error) {
    console.error('❌ Error sending password change email:', error);
    return { success: false, error: error.message };
  }
}

async function createUserInPublicTable(authUserId, email, firstName, lastName, invitedBy) {
  try {
    const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
    
    const userData = {
      user_id: authUserId,
      username: username,
      role: 'teacher',
      email: email,
      first_name: firstName,
      last_name: lastName,
      status: 'pending',
      invited_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('👤 Creating user in public.users table:', userData);
    
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating user in public.users:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ User created in public.users:', data);
    return { success: true, data: data };
    
  } catch (error) {
    console.error('❌ Error in createUserInPublicTable:', error);
    return { success: false, error: error.message };
  }
}

router.post('/teacher-login', async (req, res) => {
  console.log('🔐 TEACHER LOGIN WITH AUTO-ACTIVATION');
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    console.log(`🔐 Login attempt for: ${email}`);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    console.log('✅ Authentication successful');
    
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id, status, first_name, last_name, email_address')
      .eq('email_address', email)
      .single();
    
    if (teacher && teacher.status === 'inactive') {
      console.log(`⛔ Login blocked: Teacher account is inactive`);
      
      await supabase.auth.signOut();
      
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact the school administration.'
      });
    }
    
    if (teacher && teacher.status === 'pending') {
      console.log(`🔄 Auto-activating teacher: ${teacher.first_name} ${teacher.last_name}`);
      
      const { error: updateTeacherError } = await supabase
        .from('teachers')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', teacher.id);
      
      if (updateTeacherError) {
        console.error('❌ Error updating teacher status:', updateTeacherError);
      } else {
        console.log('✅ Teacher status updated to active');
      }
      
      const { error: updateUserError } = await supabase
        .from('users')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('email', email);
      
      if (updateUserError) {
        console.error('⚠️ Error updating users table:', updateUserError);
      } else {
        console.log('✅ User status updated to active');
      }
    }
    
    const { data: updatedTeacher } = await supabase
      .from('teachers')
      .select('id, status, first_name, last_name, email_address')
      .eq('email_address', email)
      .single();
    
    res.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        ...authData.user,
        role: 'teacher',
        first_name: updatedTeacher?.first_name || teacher?.first_name || authData.user.user_metadata?.first_name,
        last_name: updatedTeacher?.last_name || teacher?.last_name || authData.user.user_metadata?.last_name,
        status: updatedTeacher?.status || teacher?.status || 'active'
      },
      session: authData.session
    });
    
  } catch (error) {
    console.error('❌ Error in teacher login:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
});

router.post('/invite', async (req, res) => {
  console.log('🚀 INVITE WITH RESEND');
  
  try {
    const { teacherId, invitedBy } = req.body;

    if (!teacherId || !invitedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    console.log(`👤 Teacher: ${teacher.first_name} ${teacher.last_name}`);

    if (!teacher.email_address) {
      return res.status(400).json({ success: false, error: 'No email address' });
    }

    if (teacher.status === 'active' || teacher.status === 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: `Teacher already ${teacher.status}` 
      });
    }

    const tempPassword = `teacher${Math.floor(100 + Math.random() * 900)}`;
    console.log(`🔑 Password: ${tempPassword}`);

    let authUserId = null;
    
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = allUsers.users.find(u => u.email === teacher.email_address);
    
    if (existingUser) {
      authUserId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: tempPassword,
        user_metadata: {
          ...existingUser.user_metadata,
          temp_password: tempPassword,
          first_name: teacher.first_name,
          last_name: teacher.last_name
        }
      });
      console.log('🔁 Updated existing Auth user:', authUserId);
    } else {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: teacher.email_address,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          temp_password: tempPassword,
          role: 'teacher'
        }
      });
      
      if (authError) {
        console.error('❌ Auth user creation error:', authError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to create authentication account',
          details: authError.message 
        });
      }
      
      authUserId = authUser.user.id;
      console.log('✅ Created new Auth user:', authUserId);
    }

    const userResult = await createUserInPublicTable(
      authUserId,
      teacher.email_address,
      teacher.first_name,
      teacher.last_name,
      invitedBy
    );
    
    if (!userResult.success) {
      console.error('⚠️ Failed to create user in public.users, but continuing with teacher update');
    }

    console.log(`📤 Sending email via Resend to: ${teacher.email_address}`);
    const emailResult = await sendResendEmail(
      teacher.email_address,
      teacher.first_name,
      tempPassword
    );

    const updateData = {
      status: 'pending',
      invited_at: new Date().toISOString(),
      invited_by: invitedBy,
      temp_password: tempPassword,
      auth_user_id: authUserId,
      updated_at: new Date().toISOString()
    };
    
    try {
      const { error: updateError } = await supabase
        .from('teachers')
        .update({
          ...updateData,
          email_provider: 'resend',
          email_sent: emailResult.success
        })
        .eq('id', teacherId);

      if (updateError && updateError.message.includes('email_provider')) {
        console.log('⚠️ email_provider column not found, updating without it');
        const { error: simpleUpdateError } = await supabase
          .from('teachers')
          .update(updateData)
          .eq('id', teacherId);
          
        if (simpleUpdateError) {
          console.error('❌ Error updating teacher (simple):', simpleUpdateError);
        }
      } else if (updateError) {
        console.error('❌ Error updating teacher:', updateError);
      }
    } catch (error) {
      console.error('❌ Error in update process:', error);
    }

    console.log(`✅ Teacher updated. Email sent: ${emailResult.success}`);
    
    const response = {
      success: true,
      teacherId: teacher.id,
      teacherName: `${teacher.first_name} ${teacher.last_name}`,
      email: teacher.email_address,
      tempPassword: tempPassword,
      emailSent: emailResult.success,
      emailProvider: 'Resend.com',
      accountCreated: true,
      userId: authUserId,
      status: 'pending',
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
      message: emailResult.success 
        ? '✅ EMAIL SENT SUCCESSFULLY VIA RESEND.COM! Teacher should receive it immediately.'
        : '❌ Email failed via Resend. Share credentials manually.',
      credentials: {
        email: teacher.email_address,
        password: tempPassword,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
      },
      note: 'Account will auto-activate on first login using /api/teacher/teacher-login endpoint'
    };
    
    if (!emailResult.success) {
      response.emailError = emailResult.error;
      response.fallbackInstructions = 'Share these credentials manually with the teacher:';
    }
    
    res.json(response);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    console.log('🔑 Password change request for:', email);
    
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, current password, and new password are required'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long'
      });
    }
    
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password'
      });
    }
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });
    
    if (authError) {
      console.error('❌ Current password authentication failed:', authError.message);
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (updateError) {
      console.error('❌ Password update failed:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update password. Please try again.'
      });
    }
    
    console.log(`✅ Password updated for ${email} (session preserved)`);
    
    try {
      await sendPasswordChangeEmail(email, authData.user.user_metadata?.first_name || 'User');
    } catch (emailError) {
      console.log('⚠️ Password change email not sent:', emailError.message);
    }
    
    res.json({
      success: true,
      message: 'Password updated successfully. You can continue using your current session.'
    });
    
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
});

router.post('/test-resend', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }
    
    console.log(`🧪 Testing Resend with: ${email}`);
    
    const testResult = await sendResendEmail(
      email,
      name || 'Test User',
      'test123456'
    );
    
    res.json({
      success: testResult.success,
      email: email,
      result: testResult,
      note: testResult.success 
        ? '✅ Email sent via Resend! Check inbox.'
        : '❌ Resend failed: ' + (testResult.error || 'Unknown')
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

router.get('/resend-status', (req, res) => {
  const hasApiKey = !!RESEND_API_KEY && RESEND_API_KEY !== 'your_resend_api_key';
  
  res.json({
    success: true,
    resendConfigured: hasApiKey,
    apiKeyLength: RESEND_API_KEY?.length || 0,
    note: hasApiKey 
      ? '✅ Resend API key configured'
      : '❌ Resend API key not configured in .env file',
    instructions: hasApiKey 
      ? ['Ready to send emails via Resend']
      : [
          '1. Sign up at resend.com (free)',
          '2. Get API key from dashboard',
          '3. Add to .env: RESEND_API_KEY=your_key',
          '4. Restart server'
        ]
  });
});

router.post('/resend-invitation', async (req, res) => {
  console.log('🔄 RESENDING INVITATION');
  
  try {
    const { teacherId, invitedBy } = req.body;

    if (!teacherId || !invitedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    if (!teacher.email_address) {
      return res.status(400).json({ success: false, error: 'No email address' });
    }

    console.log(`🔄 Resending invitation to: ${teacher.email_address}`);

    if (teacher.auth_user_id) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(teacher.auth_user_id);
        console.log(`🗑️ Deleted old Auth user: ${teacher.auth_user_id}`);
      } catch (authError) {
        console.error('⚠️ Error deleting old Auth user:', authError.message);
      }
    }

    if (teacher.email_address) {
      try {
        await supabase
          .from('users')
          .delete()
          .eq('email', teacher.email_address);
        console.log(`🗑️ Deleted old user from users table`);
      } catch (userError) {
        console.error('⚠️ Error deleting old user:', userError.message);
      }
    }

    const tempPassword = `teacher${Math.floor(100 + Math.random() * 900)}`;
    console.log(`🔑 New password: ${tempPassword}`);

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: teacher.email_address,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        temp_password: tempPassword,
        role: 'teacher'
      }
    });
    
    if (authError) {
      console.error('❌ Auth user creation error:', authError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create authentication account',
        details: authError.message 
      });
    }
    
    const authUserId = authUser.user.id;
    console.log('✅ Created new Auth user:', authUserId);

    const userResult = await createUserInPublicTable(
      authUserId,
      teacher.email_address,
      teacher.first_name,
      teacher.last_name,
      invitedBy
    );
    
    if (!userResult.success) {
      console.error('⚠️ Failed to create user in public.users');
    }

    console.log(`📤 Sending new invitation email to: ${teacher.email_address}`);
    const emailResult = await sendResendEmail(
      teacher.email_address,
      teacher.first_name,
      tempPassword
    );

    const updateData = {
      status: 'pending',
      invited_at: new Date().toISOString(),
      invited_by: invitedBy,
      temp_password: tempPassword,
      auth_user_id: authUserId,
      updated_at: new Date().toISOString()
    };
    
    try {
      const { error: updateError } = await supabase
        .from('teachers')
        .update({
          ...updateData,
          email_provider: 'resend',
          email_sent: emailResult.success
        })
        .eq('id', teacherId);

      if (updateError && updateError.message.includes('email_provider')) {
        console.log('⚠️ email_provider column not found, updating without it');
        const { error: simpleUpdateError } = await supabase
          .from('teachers')
          .update(updateData)
          .eq('id', teacherId);
          
        if (simpleUpdateError) {
          console.error('❌ Error updating teacher (simple):', simpleUpdateError);
        }
      } else if (updateError) {
        console.error('❌ Error updating teacher:', updateError);
      }
    } catch (error) {
      console.error('❌ Error in update process:', error);
    }

    console.log(`✅ Teacher invitation resent. Email sent: ${emailResult.success}`);
    
    const response = {
      success: true,
      teacherId: teacher.id,
      teacherName: `${teacher.first_name} ${teacher.last_name}`,
      email: teacher.email_address,
      tempPassword: tempPassword,
      emailSent: emailResult.success,
      emailProvider: 'Resend.com',
      accountCreated: true,
      userId: authUserId,
      status: 'pending',
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
      message: emailResult.success 
        ? '✅ NEW INVITATION SENT VIA RESEND.COM! Teacher should receive it immediately.'
        : '❌ Email failed via Resend. Share credentials manually.',
      credentials: {
        email: teacher.email_address,
        password: tempPassword,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
      },
      note: 'Account will auto-activate on first login using /api/teacher/teacher-login endpoint'
    };
    
    if (!emailResult.success) {
      response.emailError = emailResult.error;
      response.fallbackInstructions = 'Share these credentials manually with the teacher:';
    }
    
    res.json(response);

  } catch (error) {
    console.error('❌ Error resending invitation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/deactivate', async (req, res) => {
  console.log('⛔ DEACTIVATING TEACHER');
  
  try {
    const { teacherId, deactivatedBy } = req.body;

    if (!teacherId || !deactivatedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    console.log(`⛔ Deactivating teacher: ${teacher.first_name} ${teacher.last_name}`);

    const { error: updateError } = await supabase
      .from('teachers')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
        updated_by: deactivatedBy
      })
      .eq('id', teacherId);

    if (updateError) {
      console.error('❌ Error deactivating teacher:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to deactivate teacher',
        details: updateError.message 
      });
    }

    if (teacher.email_address) {
      try {
        await supabase
          .from('users')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString()
          })
          .eq('email', teacher.email_address);
      } catch (userError) {
        console.error('⚠️ Error updating users table:', userError.message);
      }
    }

    console.log(`✅ Teacher ${teacher.first_name} ${teacher.last_name} deactivated`);
    
    res.json({
      success: true,
      teacherId: teacher.id,
      teacherName: `${teacher.first_name} ${teacher.last_name}`,
      status: 'inactive',
      message: 'Teacher account deactivated successfully'
    });

  } catch (error) {
    console.error('❌ Error deactivating teacher:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/reactivate', async (req, res) => {
  console.log('🔓 REACTIVATING TEACHER');
  
  try {
    const { teacherId, reactivatedBy } = req.body;

    if (!teacherId || !reactivatedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    if (teacher.status !== 'inactive') {
      return res.status(400).json({ 
        success: false, 
        error: `Teacher is not inactive (current status: ${teacher.status})` 
      });
    }

    console.log(`🔓 Reactivating teacher: ${teacher.first_name} ${teacher.last_name}`);

    const { error: updateError } = await supabase
      .from('teachers')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
        updated_by: reactivatedBy
      })
      .eq('id', teacherId);

    if (updateError) {
      console.error('❌ Error reactivating teacher:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to reactivate teacher',
        details: updateError.message 
      });
    }

    if (teacher.email_address) {
      try {
        await supabase
          .from('users')
          .update({
            status: 'active', 
            updated_at: new Date().toISOString()
          })
          .eq('email', teacher.email_address);
      } catch (userError) {
        console.error('⚠️ Error updating users table:', userError.message);
      }
    }

    console.log(`✅ Teacher ${teacher.first_name} ${teacher.last_name} reactivated to active status`);
    
    res.json({
      success: true,
      teacherId: teacher.id,
      teacherName: `${teacher.first_name} ${teacher.last_name}`,
      status: 'active', 
      message: 'Teacher account reactivated successfully. They can login immediately.',
      note: 'Teacher can now login using /api/teacher/teacher-login endpoint'
    });

  } catch (error) {
    console.error('❌ Error reactivating teacher:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/delete-teacher', async (req, res) => {
  console.log('🗑️ PERMANENTLY DELETING TEACHER');
  
  try {
    const { teacherId, deletedBy } = req.body;

    if (!teacherId || !deletedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (teacherError || !teacher) {
      console.log('⚠️ Teacher not found in teachers table, might already be deleted');
    }

    console.log(`🗑️ Deleting teacher: ${teacher?.first_name || 'Unknown'} ${teacher?.last_name || 'Unknown'}`);

    const results = {
      authDeleted: false,
      userDeleted: false,
      teacherDeleted: false
    };

    let authUserId = null;
    let teacherEmail = null;

    if (teacher) {
      authUserId = teacher.auth_user_id;
      teacherEmail = teacher.email_address;
    }

    if (authUserId) {
      try {
        console.log(`🔍 Deleting from Auth: ${authUserId}`);
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
        
        if (authDeleteError) {
          console.error('⚠️ Error deleting from Auth:', authDeleteError.message);
          if (!authDeleteError.message.includes('not found')) {
            throw new Error(`Auth deletion failed: ${authDeleteError.message}`);
          }
        } else {
          results.authDeleted = true;
          console.log(`✅ Deleted from Auth table: ${authUserId}`);
        }
      } catch (authError) {
        console.error('⚠️ Auth deletion error:', authError.message);
      }
    }

    if (teacherEmail) {
      try {
        console.log(`🔍 Deleting from users table: ${teacherEmail}`);
        const { error: userDeleteError } = await supabase
          .from('users')
          .delete()
          .eq('email', teacherEmail);

        if (userDeleteError) {
          console.error('⚠️ Error deleting from users:', userDeleteError.message);
          if (!userDeleteError.message.includes('not found')) {
            console.log('⚠️ Users table deletion failed, continuing...');
          }
        } else {
          results.userDeleted = true;
          console.log(`✅ Deleted from users table: ${teacherEmail}`);
        }
      } catch (userError) {
        console.error('⚠️ Users table deletion error:', userError.message);
      }
    }

    try {
      console.log(`🔍 Deleting from teachers table: ${teacherId}`);
      const { error: teacherDeleteError } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId);

      if (teacherDeleteError) {
        console.error('❌ Error deleting from teachers table:', teacherDeleteError);
        if (teacherDeleteError.message.includes('not found') || teacherDeleteError.code === 'PGRST116') {
          console.log('⚠️ Teacher not found in table, might already be deleted');
          results.teacherDeleted = true;
        } else {
          throw new Error(`Teachers table deletion failed: ${teacherDeleteError.message}`);
        }
      } else {
        results.teacherDeleted = true;
        console.log(`✅ Deleted from teachers table: ${teacherId}`);
      }
    } catch (teacherDeleteError) {
      console.error('❌ Teachers table deletion error:', teacherDeleteError.message);
    }

    const success = results.teacherDeleted || (teacher === null && (results.authDeleted || results.userDeleted));
    
    console.log(`🗑️ Delete results:`, results);
    console.log(`✅ Delete operation ${success ? 'SUCCEEDED' : 'PARTIALLY FAILED'}`);

    const teacherName = teacher 
      ? `${teacher.first_name} ${teacher.last_name}`
      : 'Teacher (record may have been already deleted)';

    if (success) {
      res.json({
        success: true,
        teacherId: teacherId,
        teacherName: teacherName,
        results: results,
        message: 'Teacher permanently deleted from all systems'
      });
    } else {
      res.status(500).json({
        success: false,
        teacherId: teacherId,
        teacherName: teacherName,
        results: results,
        error: 'Failed to completely delete teacher from all systems'
      });
    }

  } catch (error) {
    console.error('❌ Error in delete-teacher endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/delete-teachers-bulk', async (req, res) => {
  console.log('🗑️ BULK DELETING TEACHERS');
  
  try {
    const { teacherIds, deletedBy } = req.body;

    if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0 || !deletedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields or no teachers selected'
      });
    }

    console.log(`🗑️ Deleting ${teacherIds.length} teachers`);

    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('*')
      .in('id', teacherIds);

    if (teachersError) {
      console.error('❌ Error fetching teachers:', teachersError);
    }

    const teacherMap = new Map();
    if (teachers) {
      teachers.forEach(teacher => {
        teacherMap.set(teacher.id, teacher);
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const teacherId of teacherIds) {
      try {
        console.log(`\n🔍 Processing teacher ${teacherId}...`);
        
        const teacher = teacherMap.get(teacherId);
        const teacherName = teacher 
          ? `${teacher.first_name} ${teacher.last_name}`
          : `Teacher ${teacherId}`;
        
        let authUserId = null;
        let teacherEmail = null;
        
        if (teacher) {
          authUserId = teacher.auth_user_id;
          teacherEmail = teacher.email_address;
        }

        const deleteResults = {
          authDeleted: false,
          userDeleted: false,
          teacherDeleted: false
        };

        if (authUserId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            deleteResults.authDeleted = true;
            console.log(`  ✅ Auth deleted: ${authUserId}`);
          } catch (authError) {
            console.log(`  ⚠️ Auth delete skipped: ${authError.message}`);
          }
        }

        if (teacherEmail) {
          try {
            await supabase
              .from('users')
              .delete()
              .eq('email', teacherEmail);
            deleteResults.userDeleted = true;
            console.log(`  ✅ Users table deleted: ${teacherEmail}`);
          } catch (userError) {
            console.log(`  ⚠️ Users table delete skipped: ${userError.message}`);
          }
        }

        try {
          const { error: teacherDeleteError } = await supabase
            .from('teachers')
            .delete()
            .eq('id', teacherId);

          if (teacherDeleteError) {
            if (teacherDeleteError.message.includes('not found') || teacherDeleteError.code === 'PGRST116') {
              deleteResults.teacherDeleted = true;
              console.log(`  ⚠️ Teacher not found (already deleted?): ${teacherId}`);
            } else {
              throw teacherDeleteError;
            }
          } else {
            deleteResults.teacherDeleted = true;
            console.log(`  ✅ Teachers table deleted: ${teacherId}`);
          }
        } catch (teacherDeleteError) {
          console.log(`  ⚠️ Teachers table delete error: ${teacherDeleteError.message}`);
        }

        const success = deleteResults.teacherDeleted || !teacher;
        
        if (success) {
          results.success.push({
            teacherId: teacherId,
            teacherName: teacherName,
            email: teacherEmail,
            deleteResults: deleteResults
          });
          console.log(`✅ Successfully deleted: ${teacherName}`);
        } else {
          results.failed.push({
            teacherId: teacherId,
            teacherName: teacherName,
            error: 'Failed to delete from all systems',
            deleteResults: deleteResults
          });
          console.log(`❌ Failed to delete: ${teacherName}`);
        }

      } catch (error) {
        console.error(`❌ Error deleting teacher ${teacherId}:`, error);
        const teacher = teacherMap.get(teacherId);
        results.failed.push({
          teacherId: teacherId,
          teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : `Teacher ${teacherId}`,
          error: error.message
        });
      }
    }

    console.log(`\n📊 Bulk delete complete. Success: ${results.success.length}, Failed: ${results.failed.length}`);
    
    const allSucceeded = results.failed.length === 0;
    
    res.json({
      success: allSucceeded,
      total: teacherIds.length,
      results: results,
      message: `Deleted ${results.success.length} teacher(s) successfully${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`
    });

  } catch (error) {
    console.error('❌ Error in bulk delete:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/teacher-classes/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    console.log(`📚 Fetching classes for teacher ID: ${teacherId}`);
    
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select('email_address, first_name, last_name')
      .eq('id', teacherId)
      .single();
    
    if (teacherError || !teacherData) {
      console.error('❌ Teacher not found:', teacherError);
      return res.status(404).json({
        success: false,
        error: 'Teacher not found'
      });
    }
    
    console.log(`👤 Teacher: ${teacherData.first_name} ${teacherData.last_name} (${teacherData.email_address})`);
    
    const { data: classesData, error: classesError } = await supabase
      .from('teacher_sections')
      .select(`
        id,
        is_adviser,
        section:sections(
          id,
          section_name,
          grade:grades(grade_level)
        ),
        created_at
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: true });
    
    if (classesError) {
      console.error('❌ Error fetching teacher classes:', classesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch teacher classes'
      });
    }
    
    console.log(`✅ Found ${classesData?.length || 0} classes for teacher ${teacherId}`);
    
    const formattedClasses = (classesData || []).map((item, index) => {
      const grade = item.section?.grade?.grade_level || 'Unknown';
      const sectionName = item.section?.section_name || 'Unknown';
      
      return {
        id: item.id,
        className: `${grade}-${sectionName}`,
        isAdviser: item.is_adviser,
        grade: grade,
        section: sectionName,
        initialColor: getColorForIndex(index)
      };
    });
    
    res.json({
      success: true,
      teacher: {
        id: teacherId,
        name: `${teacherData.first_name} ${teacherData.last_name}`,
        email: teacherData.email_address
      },
      classes: formattedClasses,
      count: formattedClasses.length
    });
    
  } catch (error) {
    console.error('❌ Error in teacher-classes endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
});

router.get('/get-teacher-id-by-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    console.log(`🔍 Looking up teacher ID for email: ${email}`);
    
    const { data: teacher, error } = await supabase
      .from('teachers')
      .select('id, first_name, last_name, status')
      .eq('email_address', email)
      .single();
    
    if (error || !teacher) {
      console.error('❌ Teacher not found for email:', email);
      return res.status(404).json({
        success: false,
        error: 'Teacher not found'
      });
    }
    
    console.log(`✅ Found teacher: ${teacher.first_name} ${teacher.last_name} (ID: ${teacher.id})`);
    
    res.json({
      success: true,
      teacherId: teacher.id,
      teacherName: `${teacher.first_name} ${teacher.last_name}`,
      status: teacher.status
    });
    
  } catch (error) {
    console.error('❌ Error getting teacher ID by email:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
});

function getColorForIndex(index) {
  const colors = [
    '#FFB73B', 
    '#7EC384', 
    '#3598DB', 
    '#9C27B0', 
    '#F44336', 
    '#FF9800', 
    '#4CAF50', 
    '#2196F3', 
    '#673AB7', 
    '#E91E63', 
    '#795548', 
    '#607D8B', 
  ];
  return colors[index % colors.length];
}

router.get('/get-teacher-id-by-auth', async (req, res) => {
  try {
    const { authUserId } = req.query;
    
    if (!authUserId) {
      return res.status(400).json({
        success: false,
        error: 'Auth User ID is required'
      });
    }
    
    console.log(`🔍 Looking up teacher by auth user ID: ${authUserId}`);
    
    const { data: teacher, error } = await supabase
      .from('teachers')
      .select('id, first_name, last_name, email_address, status')
      .eq('auth_user_id', authUserId)
      .single();
    
    if (error || !teacher) {
      console.error('❌ Teacher not found for auth user ID:', authUserId);
      return res.status(404).json({
        success: false,
        error: 'Teacher not found'
      });
    }
    
    console.log(`✅ Found teacher: ${teacher.first_name} ${teacher.last_name} (ID: ${teacher.id})`);
    
    res.json({
      success: true,
      teacherId: teacher.id,
      teacherName: `${teacher.first_name} ${teacher.last_name}`,
      email: teacher.email_address,
      status: teacher.status
    });
    
  } catch (error) {
    console.error('❌ Error getting teacher by auth ID:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
});

export default router;