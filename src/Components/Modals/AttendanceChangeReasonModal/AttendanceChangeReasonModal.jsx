import React, { useState } from 'react';
import styles from './AttendanceChangeReasonModal.module.css';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/ToastContext/ToastContext';

const AttendanceChangeReasonModal = ({
  isOpen,
  onClose,
  attendanceData,
  onRequestSubmitted
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { success, error: toastError } = useToast();

  if (!isOpen || !attendanceData) return null;

  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return 'N/A';
    
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      return timeString;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      toastError('Please provide a reason for the change');
      return;
    }

    setSubmitting(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('attendance_change_requests')
        .insert({
          attendance_id: attendanceData.id,
          student_id: attendanceData.student_id,
          date: attendanceData.date,
          
          original_time_in: attendanceData.time_in,
          original_time_out: attendanceData.time_out,
          original_status: attendanceData.status,
          
          requested_time_in: attendanceData.time_in,
          requested_time_out: attendanceData.time_out,
          requested_status: attendanceData.status,
          
          reason: reason.trim(),
          requested_by: user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      success('Change request submitted successfully! Waiting for admin approval.');
      
      if (onRequestSubmitted) {
        onRequestSubmitted(data);
      }
      
      onClose();
      setReason('');
      
    } catch (error) {
      console.error('Error submitting change request:', error);
      toastError(`Failed to submit request: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Request Attendance Change</h3>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            disabled={submitting}
          >
            ×
          </button>
        </div>
        
        <div className={styles.studentInfo}>
          <p><strong>Student:</strong> {attendanceData.first_name} {attendanceData.last_name}</p>
          <p><strong>LRN:</strong> {attendanceData.lrn}</p>
          <p><strong>Date:</strong> {new Date(attendanceData.date).toLocaleDateString('en-PH')}</p>
          <p><strong>Current Time In:</strong> {formatTimeForDisplay(attendanceData.time_in)}</p>
          <p><strong>Current Time Out:</strong> {formatTimeForDisplay(attendanceData.time_out)}</p>
          <p><strong>Current Status:</strong> 
            <span className={`${styles.statusBadge} ${styles[attendanceData.status]}`}>
              {attendanceData.status}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="reason" className={styles.label}>
              Reason for Change *
            </label>
            <textarea
              id="reason"
              className={styles.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you need to change this attendance record..."
              rows={5}
              disabled={submitting}
              required
            />
            <p className={styles.helperText}>
              This request will be sent to administrators for review.
            </p>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={submitting || !reason.trim()}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AttendanceChangeReasonModal;