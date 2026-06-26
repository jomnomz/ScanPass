import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';
import Button from "../../UI/Buttons/Button/Button";
import Modal from "../Modal/Modal";
import styles from './QRCodeModal.module.css';

function QRCodeModal({ isOpen, onClose, student }) {
  const qrRef = useRef();

  if (!student) return null;

  const qrData = JSON.stringify({
    lrn: student.lrn,
    token: student.qr_verification_token,
    name: `${student.first_name} ${student.last_name}`,
    type: 'student_attendance'
  });

  console.log('🎯 QR CODE DATA BEING GENERATED:', qrData);

  const handleDownloadQR = () => {
    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR_${student.lrn}_${student.first_name}_${student.last_name}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Modal size="xsm" isOpen={isOpen} onClose={onClose} title="Student QR Code">
      <div className={styles.modalContainer}>
        <div className={styles.studentInfo}>
          <h3>{student.first_name} {student.last_name}</h3>
          <p>LRN: {student.lrn} | Grade {student.grade}-{student.section}</p>
        </div>
        
        <div className={styles.qrCodeContainer}>
          <QRCodeSVG
            ref={qrRef}
            value={qrData}
            size={200}
            level="H" 
            includeMargin={true}
          />
        </div>
        
        <div className={styles.qrActions}>
          <Button
            label="Download"
            height="sm"
            width="sm"
            color="ocean"
            onClick={handleDownloadQR}
          />
          <Button 
            label="Close"
            height="sm"
            width="xs"
            color="ghost"
            onClick={onClose}
          />
        </div>
      </div>
    </Modal>
  );
}

export default QRCodeModal;