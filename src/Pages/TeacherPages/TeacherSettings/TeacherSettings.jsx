// src/pages/Teacher/TeacherSettings/TeacherSettings.jsx
import { useState } from 'react';
import styles from './TeacherSettings.module.css';
import PageLabel from "../../../Components/UI/Labels/PageLabel/PageLabel.jsx";
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import ChangePasswordForm from '../../../Components/Forms/ChangePasswordForm/ChangePasswordForm.jsx';
import SettingsIcon from '@mui/icons-material/Settings';
import { supabase } from '../../../lib/supabase.js';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../../../Components/Authentication/AuthProvider/AuthProvider.jsx';
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx';
import Chatbot from '../../../Components/Forms/Chatbot/Chatbot.jsx';
import { apiClient } from '../../../config/api.js'; // Import apiClient

function TeacherSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      
      const { error } = await supabase.auth.signOut();
      
      if (error && !error.message.includes('Auth session missing')) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
      }
      
      navigate("/");   
      
    } catch (error) {
      console.error('Logout error:', error);
      navigate("/");
    }
  };

  const handlePasswordChange = async (currentPassword, newPassword) => {
    setChangingPassword(true);
    
    try {
      // Use apiClient instead of fetch
      const response = await apiClient.post('/api/teacher-invite/change-password', {
        email: user.email,
        currentPassword,
        newPassword
      });
      
      const data = response.data;
      
      if (data.success) {
        success('Password changed successfully! You can continue using your session.');
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
        return true; // Success
      } else {
        // Return error message for form display
        return { error: data.error || 'Failed to change password. Please check your current password.' };
      }
    } catch (error) {
      console.error('Password change error:', error);
      
      // Better error handling with axios error object
      if (error.response) {
        // Server responded with error status
        const errorMessage = error.response.data?.error || 'Failed to change password. Please check your current password.';
        return { error: errorMessage };
      } else if (error.request) {
        // Request made but no response received
        return { error: 'Cannot connect to server. Please check your connection.' };
      } else {
        // Something else happened
        return { error: 'Connection error. Please try again.' };
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <main className={styles.main}>
      <PageLabel 
        icon={<SettingsIcon sx={{ fontSize: 50, mb: -0.7 }}  />}  
        label="Settings"
      />
      
      <div className={styles.contentWrapper}>
        <div className={styles.settingsColumn}>
          <div className={styles.section}>
            <h3>Change Password</h3>
            <ChangePasswordForm 
              onChangePassword={handlePasswordChange}
              loading={changingPassword}
            />
          </div>  
          
          <div className={styles.section}>
            <h3>Account Actions</h3>
            <Button 
              label="Logout" 
              onClick={handleLogout}
              color="danger"
              width="100%"
            />
          </div>
        </div>
        
        <div className={styles.chatbotColumn}>
          <div className={styles.section}>
            <h3>AI Assistant</h3>
            <Chatbot />
          </div>
        </div>
      </div>
    </main>
  );
}

export default TeacherSettings;