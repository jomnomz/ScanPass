import { useState } from 'react';
import Modal from '../Modal/Modal.jsx';
import styles from './InviteModal.module.css';
import Button from '../../UI/Buttons/Button/Button.jsx';
import { useToast } from '../../Toast/ToastContext/ToastContext.jsx'; 
import InfoBox from '../../UI/InfoBoxes/InfoBox/InfoBox.jsx';
import EntityList from '../../List/EntityList/EntityList.jsx';
import TitleModalLabel from '../../UI/Labels/TitleModalLabel/TitleModalLabel.jsx';
import MessageModalLabel from '../../UI/Labels/MessageModalLabel/MessageModalLabel.jsx';

function InviteModal({ 
  isOpen, 
  onClose, 
  teacher, 
  selectedTeachers = [], 
  teacherData = [], 
  onConfirm,
  onConfirmBulk
}) {
  const { success, error, info } = useToast();
  const [loading, setLoading] = useState(false);
  
  const isBulkInvite = selectedTeachers.length > 0;
  const inviteCount = isBulkInvite ? selectedTeachers.length : 1;
  
  if (!isOpen) return null;
  if (!isBulkInvite && !teacher) return null;

  const filterEligibleTeachers = (teachers) => {
    return teachers.filter(t => {
      if (!t.email_address) return false; 
      if (t.status === 'active') return false; 
      if (t.status === 'pending') return false; 
      if (t.status === 'inactive') return false; 
      return true;
    });
  };

  const selectedTeacherObjects = isBulkInvite 
    ? selectedTeachers
        .map(teacherId => teacherData.find(t => t.id === teacherId))
        .filter(teacher => teacher !== undefined)
    : [];

  const eligibleTeachers = filterEligibleTeachers(isBulkInvite ? selectedTeacherObjects : [teacher]);
  const ineligibleCount = inviteCount - eligibleTeachers.length;

  const handleConfirm = async () => {
    setLoading(true);
    
    try {
      if (isBulkInvite) {
        if (eligibleTeachers.length === 0) {
          error('No eligible teachers to invite');
          onClose();
          return;
        }
        
        await onConfirmBulk?.(eligibleTeachers.map(t => t.id));
        success(`${eligibleTeachers.length} invitation${eligibleTeachers.length !== 1 ? 's' : ''} sent successfully`);
      } else {
        if (eligibleTeachers.length === 0) {
          error('Teacher is not eligible for invitation');
          onClose();
          return;
        }
        
        await onConfirm?.(teacher.id);
        success('Invitation sent successfully');
      }
      onClose();
    } catch (err) {
      error(err.message || 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal size="md" isOpen={isOpen} onClose={onClose}>
      <div className={styles.modalContainer}>
        <TitleModalLabel>
          {isBulkInvite ? `Send Invitations to ${eligibleTeachers.length} Teachers` : 'Send Invitation'}
        </TitleModalLabel>
        
        <MessageModalLabel>
          {isBulkInvite ? (
            `Are you sure you want to send account invitations to ${eligibleTeachers.length} teacher${eligibleTeachers.length !== 1 ? 's' : ''}.`
          ) : (
            'Are you sure you want to send an account invitation to this teacher:'
          )}
        </MessageModalLabel>
        
        {isBulkInvite ? (
          <>
            {ineligibleCount > 0 && (
              <InfoBox type="important">
                <strong>Important:</strong> {ineligibleCount} teacher{ineligibleCount !== 1 ? 's' : ''} will not receive invitations because they already have accounts or are not eligible.
              </InfoBox>
            )}

            {eligibleTeachers.length > 0 && (
              <EntityList 
                entities={eligibleTeachers}
                variant="multiple"
                title="Teachers who will receive invitations"
                entityType="teacher"
              />
            )}
          </>
        ) : (
          <EntityList 
            entities={[teacher]}
            variant="single"
            title="Teacher to invite"
            entityType="teacher"
          />
        )}

        <InfoBox type="note">
          <strong>Note:</strong> Teachers will receive an email with their account email and password. Once they accept the invite, their status will automatically change to "Active" and can now login.
        </InfoBox>

        <div className={styles.buttonGroup}>
          <Button
            label={loading ? "Sending..." : isBulkInvite ? `Send ${eligibleTeachers.length} Invitation${eligibleTeachers.length !== 1 ? 's' : ''}` : "Send Invitation"}
            color="ocean"
            onClick={handleConfirm}
            width="auto"
            height="sm"
            disabled={loading || eligibleTeachers.length === 0}
          />
          <Button 
            label="Cancel"
            color="ghost"
            onClick={onClose}
            width="sm"
            height="sm"
            disabled={loading}
          />
        </div>
      </div>
    </Modal>
  );
}

export default InviteModal;