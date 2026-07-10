import Modal from '../Modal/Modal.jsx';
import styles from './QRCodeUpdateWarningModal.module.css';
import Button from '../../UI/Buttons/Button/Button.jsx';
import InfoBox from '../../UI/InfoBoxes/InfoBox/InfoBox.jsx';
import EntityList from '../../List/EntityList/EntityList.jsx';
import TitleModalLabel from '../../UI/Labels/TitleModalLabel/TitleModalLabel.jsx';
import MessageModalLabel from '../../UI/Labels/MessageModalLabel/MessageModalLabel.jsx';

function QRCodeUpdateWarningModal({ isOpen, onClose, student, onConfirm, saving = false }) {
  if (!student) return null;

  const handleConfirm = () => {
    if (saving) return; // guard against double-clicks
    onConfirm();
  };

  return (
    <Modal size="md" isOpen={isOpen} onClose={saving ? undefined : onClose}>
      <div className={styles.modalContainer}>
        <TitleModalLabel>Update Student Information</TitleModalLabel>
        
        <MessageModalLabel>
          You are about to update this student's information.
        </MessageModalLabel>
        
        <EntityList 
          entities={[student]}
          variant="single"
          title="Student to be edited"
          entityType="student"
        />

        <InfoBox type="important">
          <strong>Important:</strong> This will generate a new QR code for this student. Any previously issued QR codes will no longer work for attendance tracking.
        </InfoBox>

        <div className={styles.buttonGroup}>
          <Button
            label={saving ? 'Updating...' : 'Yes, Update Student'}
            color="warning"
            onClick={handleConfirm}
            disabled={saving}
            width="lg"
            height="sm"
          />
          <Button 
            label="Cancel"
            color="ghost"
            onClick={onClose}
            disabled={saving}
            width="sm"
            height="sm"
          />
        </div>
      </div>
    </Modal>
  );
}

export default QRCodeUpdateWarningModal;