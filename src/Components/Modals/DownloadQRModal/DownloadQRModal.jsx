// src/components/Modals/DownloadQRModal/DownloadQRModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from '../Modal/Modal.jsx';
import Button from '../../UI/Buttons/Button/Button.jsx';
import { useToast } from '../../Toast/ToastContext/ToastContext.jsx'; 
import styles from './DownloadQRModal.module.css';
import InfoBox from '../../UI/InfoBoxes/InfoBox/InfoBox.jsx';
import EntityList from '../../List/EntityList/EntityList.jsx';
import TitleModalLabel from '../../UI/Labels/TitleModalLabel/TitleModalLabel.jsx';
import MessageModalLabel from '../../UI/Labels/MessageModalLabel/MessageModalLabel.jsx';
import Tooltip from '../../UI/Tooltip/Tooltip.jsx';
import InfoIcon from '@mui/icons-material/Info';
import QRCode from 'qrcode';

function DownloadQRModal({
  isOpen,
  onClose,
  selectedStudents = [],
  studentData = [],
  currentFilter = '',
  currentSection = '',
  currentGrade = '',
  gradesData = [],
  sectionsData = []
}) {
  const { success, error } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const selectedCount = selectedStudents.length;
  
  const selectedStudentObjects = React.useMemo(() => 
    selectedStudents
      .map(studentId => {
        const student = studentData.find(s => s.id === studentId);
        if (!student) return undefined;
        
        const grade = gradesData.find(g => g.id === student.grade_id);
        const gradeName = grade ? grade.grade_level : student.grade || 'N/A';
        
        const section = sectionsData.find(s => s.id === student.section_id);
        const sectionName = section ? section.section_name : student.section || 'N/A';
        
        return {
          ...student,
          grade: gradeName,
          section: sectionName,
          grade_id: student.grade_id,
          section_id: student.section_id
        };
      })
      .filter(student => student !== undefined),
    [selectedStudents, studentData, gradesData, sectionsData]
  );

  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
    }
  }, [isOpen]);

  const getContextDescription = () => {
    if (currentSection) {
      return `from Section ${currentSection}`;
    }
    if (currentFilter) {
      return `matching "${currentFilter}"`;
    }
    return `from Grade ${currentGrade}`;
  };

  const getNotesNote = () => {
    return (
      <InfoBox type="note">
        <strong>Note:</strong> Each QR code will contain student information (Name, LRN, Grade, Section) below the scannable QR code.
      </InfoBox>
    );
  };

  // Function to generate QR code image with student info BELOW the QR code
  const generateQRCodeImage = async (student) => {
    // Use the properly formatted grade and section names
    const gradeDisplay = student.grade || 'N/A';
    const sectionDisplay = student.section || 'N/A';
    
    // Create the data object for QR code
    const qrData = JSON.stringify({
      lrn: student.lrn,
      token: student.qr_verification_token,
      name: `${student.first_name} ${student.last_name}`,
      grade: gradeDisplay,
      section: sectionDisplay,
      grade_id: student.grade_id,
      section_id: student.section_id,
      type: 'student_attendance'
    });
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 300;
    canvas.height = 400; 
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    try {
      const qrCanvas = document.createElement('canvas');
      qrCanvas.width = 250;
      qrCanvas.height = 250;
      
      await QRCode.toCanvas(qrCanvas, qrData, {
        width: 250,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      const qrX = (canvas.width - 250) / 2;
      const qrY = 20; 
      
      ctx.drawImage(qrCanvas, qrX, qrY);
      
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      
      ctx.font = 'bold 18px Arial';
      const fullName = `${student.first_name} ${student.last_name}`;
      ctx.fillText(fullName, canvas.width / 2, qrY + 280);
      
      ctx.font = '14px Arial';
      ctx.fillText(`LRN: ${student.lrn}`, canvas.width / 2, qrY + 305);
      
      ctx.fillText(`Grade ${gradeDisplay} - Section ${sectionDisplay}`, canvas.width / 2, qrY + 330);
      
      ctx.font = 'italic 12px Arial';
      ctx.fillText('Student Attendance QR Code', canvas.width / 2, qrY + 355);
      
      ctx.beginPath();
      ctx.moveTo(20, qrY + 265);
      ctx.lineTo(canvas.width - 20, qrY + 265);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png', 1.0);
      });
      
    } catch (err) {
      console.error('Error generating QR code:', err);
      throw err;
    }
  };

  const handleDownloadZIP = async () => {
    if (selectedCount === 0) {
      error('No students selected');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default;
      const zip = new JSZip();
      
      const folderName = `QR_Codes_${currentGrade || 'All'}_${currentSection || 'All'}_${new Date().toISOString().split('T')[0]}`;
      const qrFolder = zip.folder(folderName);
      
      for (const student of selectedStudentObjects) {
        try {
          const qrBlob = await generateQRCodeImage(student);
          const fileName = `QR_${student.lrn}_${student.first_name}_${student.last_name}.png`.replace(/\s+/g, '_');
          qrFolder.file(fileName, qrBlob);
        } catch (err) {
          console.error(`Failed to generate QR for ${student.lrn}:`, err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipBlob);
      downloadLink.download = `${folderName}.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      URL.revokeObjectURL(downloadLink.href);
      
      success(`Downloaded ${selectedCount} QR codes as ZIP file`);
      onClose();
      
    } catch (err) {
      console.error('Error creating ZIP:', err);
      error('Failed to create ZIP file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadIndividual = async () => {
    if (selectedCount === 0) {
      error('No students selected');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let downloadedCount = 0;
      
      for (const student of selectedStudentObjects) {
        try {
          const qrBlob = await generateQRCodeImage(student);
          const url = URL.createObjectURL(qrBlob);
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = `QR_${student.lrn}_${student.first_name}_${student.last_name}.png`.replace(/\s+/g, '_');
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          setTimeout(() => URL.revokeObjectURL(url), 100);
          downloadedCount++;
        } catch (err) {
          console.error(`Failed to generate QR for ${student.lrn}:`, err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      success(`Downloaded ${downloadedCount} QR codes`);
      onClose();
      
    } catch (err) {
      console.error('Error downloading QR codes:', err);
      error('Failed to download QR codes. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal size="md" isOpen={isOpen} onClose={onClose}>
      <div className={styles.modalContainer}>
        {/* Title row with info icon on the left */}
        <div className={styles.titleRow}>
          <Tooltip 
            content={getNotesNote()} 
            width="400px"
          >
            <InfoIcon sx={{ fontSize: 20, color: '#3F7857', cursor: 'pointer' }} />
          </Tooltip>
          <TitleModalLabel className={styles.modalTitle}>
            Download QR Codes
          </TitleModalLabel>
        </div>
        
        <MessageModalLabel>
          {selectedCount} student{selectedCount !== 1 ? 's' : ''} {getContextDescription()}
        </MessageModalLabel>
        
        <EntityList 
          entities={selectedStudentObjects}
          variant="multiple"
          title="Students to download"
          entityType="student"
        />
        
        {/* Note: InfoBox removed from here since it's now in the tooltip */}
        
        <div className={styles.buttonGroup}>
          <Button
            label="Cancel"
            color="ghost"
            onClick={onClose}
            width="xs"
            height="sm"
          />
          <Button
            label={isProcessing ? 'Processing...' : 'ZIP'}
            color="nav"
            onClick={handleDownloadZIP}
            disabled={isProcessing || selectedCount === 0}
            width="sm"
            height="sm"
          />
          <Button
            label={isProcessing ? 'Processing...' : 'Individual'}
            color="ocean"
            onClick={handleDownloadIndividual}
            disabled={isProcessing || selectedCount === 0}
            width="md"
            height="sm"
          />
        </div>
      </div>
    </Modal>
  );
}

export default DownloadQRModal;