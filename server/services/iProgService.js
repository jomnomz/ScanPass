import { supabase } from '../config/supabase.js';

export const formatPhoneForIprog = (phone) => {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return cleaned; 
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    return '0' + cleaned; 
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    return '0' + cleaned.substring(2); 
  } else if (cleaned.startsWith('+63') && cleaned.length === 13) {
    return '0' + cleaned.substring(3); 
  }
  
  console.log(`⚠️ Invalid PH number for iProg: ${phone} -> ${cleaned}`);
  return null;
};

export const getPhilippinesTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila'
  });
};

export const getPhilippinesDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila'
  });
};

async function sendViaIprog(phone, message) {
  try {
    const formattedPhone = formatPhoneForIprog(phone);
    if (!formattedPhone) {
      throw new Error('Invalid phone format for iProg');
    }
    
    console.log(`📱 [iProg] Sending to ${formattedPhone}`);
    
    const params = new URLSearchParams({
      api_token: process.env.IPROG_API_TOKEN,
      phone_number: formattedPhone,
      message: message.substring(0, 160),
      sms_provider: '0'  
    });
    
    const url = `https://www.iprogsms.com/api/v1/sms_messages?${params}`;
    
    console.log(`🔗 Calling: ${url.split('?')[0]}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    console.log('✅ iProg response:', result);
    
    if (result.status === 200 || result.message?.includes('successfully')) {
      return {
        success: true,
        provider: 'iproig',
        messageId: result.message_id,
        cost: '₱0.30',
        rawResponse: result
      };
    } else {
      throw new Error(result.error || result.message || 'iProg SMS failed');
    }
  } catch (error) {
    console.error('❌ iProg SMS error:', error.message);
    throw error;
  }
}

async function sendDemoSMS(phone, message) {
  console.log('🎓 [Demo Mode] SMS System Active');
  console.log(`📱 To: ${phone}`);
  console.log(`📱 Formatted: ${formatPhoneForIprog(phone)}`);
  console.log(`💬 Message: ${message.substring(0, 60)}...`);
  console.log(`💰 iProg Cost: ₱0.30 per SMS`);
  console.log(`⚡ Instant Delivery: No verification needed`);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    success: true,
    provider: 'iproig (demo mode)',
    demo: true,
    cost: '₱0.30',
    note: 'iProg - Configure IPROG_API_TOKEN for real SMS'
  };
}

// Check iProg balance
export const checkIprogBalance = async () => {
  try {
    if (!process.env.IPROG_API_TOKEN) {
      return {
        provider: 'iProg',
        status: 'not_configured',
        message: 'Set IPROG_API_TOKEN in .env',
        cost_per_sms: '₱0.30'
      };
    }
    
    return {
      provider: 'iProg',
      configured: true,
      sender_id: process.env.IPROG_SENDER_ID || 'STO NINO',
      cost_per_sms: '₱0.30',
      free_credits: '5 SMS credits',
      note: 'Check iProg dashboard for exact balance'
    };
  } catch (error) {
    console.error('❌ iProg balance check error:', error);
    return {
      provider: 'iProg',
      status: 'error',
      message: error.message,
      note: 'Check iProg dashboard for balance'
    };
  }
};


export const sendAttendanceSMS = async (studentId, scanType) => {
  try {
    console.log(`📱 Starting iProg SMS for student ${studentId}, scan: ${scanType}`);
    
    const { data: student, error } = await supabase
      .from('students')
      .select(`
        id, lrn, first_name, last_name,
        guardian_first_name, guardian_phone_number
      `)
      .eq('id', studentId)
      .single();
    
    if (error || !student) {
      throw new Error(`Student not found: ${error?.message}`);
    }
    
    if (!student.guardian_phone_number) {
      console.log(`⚠️ No phone for ${student.guardian_first_name}`);
      return {
        success: false,
        message: 'No guardian phone number'
      };
    }
    
    const studentName = `${student.first_name} ${student.last_name}`;
    const guardianName = student.guardian_first_name;
    const currentTime = getPhilippinesTime();
    const currentDate = getPhilippinesDate();
    
    let message;
    if (scanType === 'in') {
      message = ` Magandang araw ${guardianName}! Ang iyong anak na si ${studentName} ay nakarating na sa paaralan ngayong ${currentTime} (${currentDate}).`;
    } else if (scanType === 'out') {
      message = ` Kumusta ${guardianName}! Si ${studentName} ay umalis na sa paaralan ngayong ${currentTime} (${currentDate}). Ingat pauwi!`;
    } else {
      message = ` Hello ${guardianName}! Na-record ang attendance ni ${studentName} ngayong ${currentTime} (${currentDate}).`;
    }
    
    console.log(`📤 Preparing SMS to ${student.guardian_phone_number}`);
    
    const smsEnabled = process.env.SMS_ENABLED === 'true';
    const startHour = parseInt(process.env.SMS_BUSINESS_HOURS_START) || 6;
    const endHour = parseInt(process.env.SMS_BUSINESS_HOURS_END) || 21;
    
    if (smsEnabled) {
      const now = new Date();
      const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const currentHour = manilaTime.getHours();
      
      if (currentHour < startHour || currentHour >= endHour) {
        console.log(`🌙 Outside business hours (${startHour}:00-${endHour}:00)`);
        
        await supabase.from('sms_logs').insert({
          student_id: student.id,
          guardian_name: student.guardian_first_name,
          phone_number: student.guardian_phone_number,
          message: message,
          scan_type: scanType,
          provider: 'iproig',
          status: 'skipped',
          reason: 'outside_business_hours',
          sent_at: new Date().toISOString()
        });
        
        return {
          success: true,
          skipped: true,
          message: 'SMS skipped (outside business hours)'
        };
      }
    }
    
    // 5. RATE LIMIT CHECK
    const limitMinutes = parseInt(process.env.SMS_RATE_LIMIT_MINUTES) || 30;
    const { data: recentSMS } = await supabase
      .from('sms_logs')
      .select('sent_at')
      .eq('student_id', studentId)
      .eq('scan_type', scanType)
      .gte('sent_at', new Date(Date.now() - limitMinutes * 60000).toISOString())
      .limit(1);
    
    if (recentSMS && recentSMS.length > 0) {
      console.log(`⏸️ Rate limited (${limitMinutes} minutes)`);
      return {
        success: false,
        rateLimited: true,
        message: `Please wait ${limitMinutes} minutes`
      };
    }
    
    let result;
    
    if (process.env.IPROG_API_TOKEN) {
      try {
        result = await sendViaIprog(student.guardian_phone_number, message);
      } catch (iproigError) {
        console.log('⚠️ iProg failed, using demo mode:', iproigError.message);
        result = await sendDemoSMS(student.guardian_phone_number, message);
      }
    } else {
      result = await sendDemoSMS(student.guardian_phone_number, message);
    }
    
    const logData = {
      student_id: student.id,
      guardian_name: student.guardian_first_name,
      phone_number: student.guardian_phone_number,
      formatted_phone: formatPhoneForIprog(student.guardian_phone_number),
      message: message,
      scan_type: scanType,
      provider: result.provider,
      status: result.success ? 'sent' : 'failed',
      cost: result.cost,
      demo_mode: result.demo || false,
      message_id: result.messageId || null,
      sent_at: new Date().toISOString()
    };
    
    await supabase.from('sms_logs').insert(logData);
    
    return {
      success: result.success,
      provider: result.provider,
      cost: result.cost,
      demo: result.demo || false,
      messageId: result.messageId,
      message: 'SMS processed successfully'
    };
    
  } catch (error) {
    console.error('❌ iProg SMS Error:', error);
    
    await supabase.from('sms_errors').insert({
      student_id: studentId,
      error_message: error.message,
      scan_type: scanType,
      provider: 'iproig',
      created_at: new Date().toISOString()
    });
    
    return {
      success: false,
      message: `Failed: ${error.message}`
    };
  }
};

export const shouldSendSMS = async (studentId, scanType) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: recentSMS } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('student_id', studentId)
      .eq('scan_type', scanType)
      .gte('sent_at', `${today}T00:00:00.000Z`)
      .lte('sent_at', `${today}T23:59:59.999Z`)
      .limit(1);
    
    return !(recentSMS && recentSMS.length > 0);
  } catch (error) {
    console.error('Rate check error:', error);
    return true;
  }
};
