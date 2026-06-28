import { useState } from 'react';
import styles from './ChangePasswordForm.module.css';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';

function ChangePasswordForm({ onChangePassword, loading = false }) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }
    
    if (onChangePassword) {
      try {
        const result = await onChangePassword(currentPassword, newPassword, confirmPassword);
        
        if (result && result.error) {
          setError(result.error);
          return;
        }
        
        if (result === false) {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        console.error('Password change error:', err);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formGroup}>
        <label>Current Password</label>
        <div className={styles.passwordContainer}>
          <input
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className={styles.input}
            required
          />
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
          >
            <FontAwesomeIcon icon={showCurrentPassword ? faEyeSlash : faEye} />
          </button>
        </div>
      </div>
      
      <div className={styles.formGroup}>
        <label>New Password</label>
        <div className={styles.passwordContainer}>
          <input
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password (min. 8 characters)"
            className={styles.input}
            required
          />
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowNewPassword(!showNewPassword)}
          >
            <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} />
          </button>
        </div>
      </div>
      
      <div className={styles.formGroup}>
        <label>Confirm New Password</label>
        <div className={styles.passwordContainer}>
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={styles.input}
            required
          />
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
          </button>
        </div>
      </div>
      
      {error && (
        <div className={styles.error}>
          <ReportGmailerrorredIcon/> {error}
        </div>
      )}
      
      <Button
        type="submit"
        label={loading ? "Changing Password..." : "Change Password"}
        color="ocean"
        disabled={loading}
        width="100%"
      />
    </form>
  );
}

export default ChangePasswordForm;