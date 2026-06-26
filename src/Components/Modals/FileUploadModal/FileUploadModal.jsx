import { useState, useRef, useEffect } from 'react'
import axios from "axios";
import Modal from '../Modal/Modal.jsx'
import styles from './FileUploadModal.module.css'
import Button from '../../UI/Buttons/Button/Button.jsx';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useToast } from '../../Toast/ToastContext/ToastContext.jsx';
import MessageModalLabel from '../../UI/Labels/MessageModalLabel/MessageModalLabel.jsx';
import InfoBox from '../../UI/InfoBoxes/InfoBox/InfoBox.jsx';
import UploadIcon from '@mui/icons-material/Upload';

function FileUploadModal({ 
  isOpen, 
  onClose, 
  entityType = 'student', 
  onUploadSuccess 
}) {
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);
    const { success, error, warning, info } = useToast();

    // DRAG AND DROP HANDLERS
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            handleFileSelection(droppedFiles[0]);
        }
    };

    const handleFileInputChange = (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    };

    const handleFileSelection = (selectedFile) => {
        const validFileExtensions = ['xlsx', 'xls', 'csv'];
        const extname = selectedFile.name.split('.').pop().toLowerCase();
        
        if (!validFileExtensions.includes(extname)) {
            warning('Please upload a valid Excel file (.xlsx, .xls, .csv)');
            return;
        }

        setFile(selectedFile);
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const resetFileUpload = () => {
        setFile(null);
        setIsDragOver(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Get modal title based on entity type
    const getModalTitle = () => {
        switch(entityType) {
            case 'teacher':
                return 'Upload Teacher Data';
            case 'student':
                return 'Upload Student Data';
            case 'master-data':
                return 'Upload Master Data';
            default:
                return 'Upload Data';
        }
    };

    const getDescription = () => {
        return 'Upload an Excel or CSV file with the provided template below';
    };

    const getFieldMappingLink = () => {
        switch(entityType) {
            case 'teacher':
                return '/templates/teacher-import-template.xlsx';
            case 'student':
                return '/templates/student-import-template.xlsx';
            case 'master-data':
                return '/templates/master-data-template.xlsx';
            default:
                return '#';
        }
    };

    const getImportantNote = () => {
        if (entityType === 'student') {
            return (
                <InfoBox type="important">
                    <strong>Important:</strong> All records must be valid. If any record has errors, the entire upload will be rejected.
                    <p className={styles.templateLink}>
                        <a 
                            href={getFieldMappingLink()} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.downloadLink}
                        >
                            <span><span className={styles.download}>Download:</span> {entityType} import template</span>
                        </a>
                    </p>
                </InfoBox>
            );
        } else {
            return (
                <InfoBox type="important">
                    <strong>Important:</strong> All records must be valid. If any record has errors, the entire upload will be rejected.
                    <p className={styles.templateLink}>
                        <a 
                            href={getFieldMappingLink()} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.downloadLink}
                        >
                            <span><span className={styles.download}>Download:</span> {entityType} import template</span>
                        </a>
                    </p>
                </InfoBox>
            );
        }
    };

    async function handleUpload() {
        if (!file) {
            warning('Please select a file first'); 
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            console.log(`🚀 Starting ${entityType} upload...`);
            
            let endpoint;
            switch(entityType) {
                case 'teacher':
                    endpoint = 'http://localhost:5000/api/teachers/upload';
                    break;
                case 'student':
                    endpoint = 'http://localhost:5000/api/students/upload';
                    break;
                case 'master-data':
                    endpoint = 'http://localhost:5000/api/master-data/upload';
                    break;
                default:
                    throw new Error('Invalid entity type');
            }
            
            const response = await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log('✅ Upload response:', response.data);
            
            if (response.data.success) {
                if (response.data.message) {
                    success(response.data.message);
                } else {
                    success('Upload completed successfully');
                }
                
                if (entityType === 'teacher' && response.data.summary) {
                    const summary = response.data.summary;
                    const assignmentMsg = [];
                    
                    if (summary.subjectsAssigned > 0) {
                        assignmentMsg.push(`${summary.subjectsAssigned} subjects assigned`);
                    }
                    if (summary.sectionsAssigned > 0) {
                        assignmentMsg.push(`${summary.sectionsAssigned} sections assigned`);
                    }
                    if (summary.teachingAssignmentsCreated > 0) {
                        assignmentMsg.push(`${summary.teachingAssignmentsCreated} teaching assignments created`);
                    }
                    if (summary.assignmentErrors > 0) {
                        assignmentMsg.push(`${summary.assignmentErrors} assignment errors`);
                    }
                    
                    if (assignmentMsg.length > 0) {
                        info(`Assignments: ${assignmentMsg.join(', ')}`);
                    }
                    
                    if (response.data.assignmentErrors && response.data.assignmentErrors.length > 0) {
                        console.warn('Assignment errors:', response.data.assignmentErrors);
                        response.data.assignmentErrors.forEach(err => {
                            warning(err);
                        });
                    }
                }
                
                if (onUploadSuccess) {
                    let newEntities = [];
                    if (entityType === 'teacher' && response.data.newTeachers) {
                        newEntities = response.data.newTeachers;
                    } else if (entityType === 'student' && response.data.newStudents) {
                        newEntities = response.data.newStudents;
                    } else if (entityType === 'master-data' && response.data.newData) {
                        newEntities = response.data.newData;
                    }
                    
                    if (newEntities.length > 0) {
                        onUploadSuccess(newEntities);
                    }
                }
                
                onClose();  
                resetFileUpload();
            } else {
                if (response.data.invalidRecords && response.data.invalidRecords.length > 0) {
                    const errorCount = response.data.invalidCount || response.data.invalidRecords.length;
                    error(`${errorCount} record(s) have validation errors`);
                    
                    if (response.data.errorSummary && response.data.errorSummary.length > 0) {
                        response.data.errorSummary.forEach(err => {
                            warning(err);
                        });
                    }
                    
                    if (response.data.summary) {
                        info(`${response.data.summary.validRecords} valid, ${response.data.summary.invalidRecords} invalid`);
                    }
                } else {
                    error(response.data.error || 'Upload failed');
                }
            }

        } catch (err) {
            console.error('❌ Upload failed:', err);
            
            if (err.response?.data?.error) {
                error(err.response.data.error);
                
                if (err.response.data.invalidRecords) {
                    err.response.data.invalidRecords.slice(0, 3).forEach(record => {
                        const errorMsg = Object.values(record.errors || {}).join(', ');
                        warning(`Row ${record.row}: ${errorMsg}`);
                    });
                }
                
                if (err.response.data.errorSummary) {
                    err.response.data.errorSummary.slice(0, 3).forEach(errMsg => {
                        warning(errMsg);
                    });
                }
            } else {
                error(`Upload failed. Please check the file format and try again.`);
            }
        } finally {
            setIsUploading(false);
        }
    }

    const handleClose = () => {
        resetFileUpload();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md"> 
            <div className={styles.modalContainer}>
                <h2>{getModalTitle()}</h2>
                
                <MessageModalLabel>
                    {getDescription()}
                </MessageModalLabel>

                {getImportantNote()}
                
                
                <div 
                    className={`${styles.dropArea} ${isDragOver ? styles.highlight : ''} ${file ? styles.hasFile : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className={styles.dropAreaRow}>
                        
                        <UploadIcon sx={{ fontSize: 30 }} className={styles.icon} />
                        <p>Drag and drop your file here</p>
                    </div>
                    <div>
                        <Button
                            label="Select Files" 
                            height="xs"
                            width="sm"
                            pill={true}
                            color="nav"
                            className={styles.browseBtn}
                            onClick={handleBrowseClick}
                        />
                     
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileInputChange}
                        accept=".xlsx, .xls, .csv"
                        className={styles.fileInput}
                    />
                    </div>
                </div>
                
                {file && (
                    <div className={styles.fileInfo}>
                        <p>Selected file: <strong>{file.name}</strong> ({formatFileSize(file.size)})</p>
                    </div>
                )}
                
                <div className={styles.uploadActions}>
                    <Button 
                        className={styles.cancelBtn}
                        onClick={handleClose}
                        disabled={isUploading}
                        label="Cancel"
                        color="ghost"
                    />
                    <Button 
                        className={styles.submitBtn}
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        label={isUploading ? 'Uploading...' : 'Submit'}
                        color="ocean"
                    />
                </div>
            </div>
        </Modal>
    )
}

export default FileUploadModal;