// src/components/Modals/FileUploadModal/FileUploadModal.jsx
import { useState, useRef, useEffect } from 'react'
import Modal from '../Modal/Modal.jsx'
import styles from './FileUploadModal.module.css'
import Button from '../../UI/Buttons/Button/Button.jsx';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useToast } from '../../Toast/ToastContext/ToastContext.jsx';
import MessageModalLabel from '../../UI/Labels/MessageModalLabel/MessageModalLabel.jsx';
import InfoBox from '../../UI/InfoBoxes/InfoBox/InfoBox.jsx';
import Tooltip from '../../UI/Tooltip/Tooltip.jsx';
import UploadIcon from '@mui/icons-material/Upload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ListAltIcon from '@mui/icons-material/ListAlt';
import InfoIcon from '@mui/icons-material/Info';
import EntityList from '../../List/EntityList/EntityList.jsx';
import { apiClient } from '../../../config/api.js';

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

    const [validationErrors, setValidationErrors] = useState(null);
    const [viewMode, setViewMode] = useState('drop');

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
        setValidationErrors(null);
        setViewMode('drop');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const toggleErrorView = () => {
        setViewMode(prev => (prev === 'errors' ? 'drop' : 'errors'));
    };

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

    const getNotesNote = () => {
        return (
            <InfoBox type="note">
                <strong>Note:</strong> All records must be valid for the upload to succeed. If any rows have errors, we'll show you exactly which ones so you can fix and re-upload.
            </InfoBox>
        );
    };

    const buildValidationErrorEntities = (invalidRecords) => {
        return invalidRecords.map(record => {
            // Build error message from all field errors
            const errorMessages = Object.values(record.errors || {}).join(', ');
            
            // Create a display label that includes sheet/record type if available
            let displayLabel = `Row ${record.row}`;
            if (record.sheet) {
                displayLabel = `${record.sheet} — Row ${record.row}`;
            }
            
            return {
                row: record.row,
                sheet: record.sheet,
                message: errorMessages,
                displayLabel: displayLabel,
                // Keep original data for potential debugging
                data: record.data || {}
            };
        });
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
                    endpoint = '/api/teachers/upload';
                    break;
                case 'student':
                    endpoint = '/api/students/upload';
                    break;
                case 'master-data':
                    endpoint = '/api/master-data/upload';
                    break;
                default:
                    throw new Error('Invalid entity type');
            }
            
            const response = await apiClient.post(endpoint, formData, {
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
                    
                    if (summary.sectionsAssigned > 0) {
                        assignmentMsg.push(`${summary.sectionsAssigned} sections assigned`);
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
                
                // ===== FIX: Call onUploadSuccess unconditionally on success =====
                // Previously gated behind newEntities.length > 0, which broke master-data
                // since it doesn't return a newData field in the response.
                if (onUploadSuccess) {
                    // Build newEntities for consumers that care about the data
                    let newEntities = [];
                    if (entityType === 'teacher' && response.data.newTeachers) {
                        newEntities = response.data.newTeachers;
                    } else if (entityType === 'student' && response.data.newStudents) {
                        newEntities = response.data.newStudents;
                    } else if (entityType === 'master-data' && response.data.newData) {
                        newEntities = response.data.newData;
                    }
                    
                    // Always call onUploadSuccess — consumers that don't care about the
                    // argument (like AdminMasterData) ignore it, and consumers that do
                    // care handle empty arrays gracefully.
                    onUploadSuccess(newEntities);
                }
                
                onClose();  
                resetFileUpload();
            } else {
                if (response.data.invalidRecords && response.data.invalidRecords.length > 0) {
                    const errorCount = response.data.invalidCount || response.data.invalidRecords.length;

                    error(`Import failed — ${errorCount} row(s) have errors.`);

                    setValidationErrors(buildValidationErrorEntities(response.data.invalidRecords));
                    setViewMode('errors');
                } else {
                    error(response.data.error || 'Upload failed');
                }
            }

        } catch (err) {
            console.error('❌ Upload failed:', err);
            
            if (err.response) {
                const errorData = err.response.data;

                if (errorData.invalidRecords && errorData.invalidRecords.length > 0) {
                    const errorCount = errorData.invalidCount || errorData.invalidRecords.length;

                    error(`Import failed — ${errorCount} row(s) have errors.`);

                    setValidationErrors(buildValidationErrorEntities(errorData.invalidRecords));
                    setViewMode('errors');
                } else if (errorData.error) {
                    error(errorData.error);
                } else {
                    error('Upload failed. Please check the file format and try again.');
                }
            } else if (err.request) {
                error('Cannot connect to server. Please check your connection.');
            } else {
                error('Upload failed. Please try again.');
            }
        } finally {
            setIsUploading(false);
        }
    }

    const handleClose = () => {
        resetFileUpload();
        onClose();
    };

    const hasValidationErrors = validationErrors && validationErrors.length > 0;
    const showErrorList = hasValidationErrors && viewMode === 'errors';

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md"> 
            <div className={styles.modalContainer}>
                {/* Title row with info icon on the left */}
                <div className={styles.titleRow}>
                    <Tooltip content={getNotesNote()} width="400px" >
                        <InfoIcon sx={{ fontSize: 20, color: '#3F7857', cursor: 'pointer' }} />
                    </Tooltip>
                    <h2 className={styles.modalTitle}>{getModalTitle()}</h2>
                </div>

                {/* Description */}
                <div className={styles.descriptionRow}>
                    <MessageModalLabel>
                        {getDescription()}
                    </MessageModalLabel>
                </div>

                {/* Download link */}
                <div className={styles.templateLinkWrapper}>
                    <a 
                        href={getFieldMappingLink()} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.downloadLink}
                    >
                        <span><span className={styles.download}>Download:</span> {entityType} import template</span>
                    </a>
                </div>

                {/* Toggle button using Button component with teaGreen color */}
                {hasValidationErrors && (
                    <div className={styles.viewToggleRow}>
                        <Button
                            label={showErrorList ? 'Select new file' : 'View errors'}
                            icon={showErrorList ? <UploadFileIcon sx={{ fontSize: 18 }} /> : <ListAltIcon sx={{ fontSize: 18 }} />}
                            iconPosition="left"
                            height="xs"
                            width="auto"
                            color="teaGreen"
                            pill={true}
                            onClick={toggleErrorView}
                            title={showErrorList ? 'Select a different file' : 'View error details'}
                        />
                    </div>
                )}

                {showErrorList ? (
                    <EntityList
                        entities={validationErrors}
                        entityType="validationError"
                        title="Rows with errors"
                    />
                ) : (
                    <>
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
                    </>
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
                        disabled={!file || isUploading || showErrorList}
                        label={isUploading ? 'Uploading...' : 'Submit'}
                        color="ocean"
                    />
                </div>
            </div>
        </Modal>
    )
}

export default FileUploadModal;