import React, { useState, useEffect } from 'react';
import styles from './AttendanceCard.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette } from '@fortawesome/free-solid-svg-icons';
import AttendanceTableModal from '../../../Modals/AttendanceTableModal/AttendanceTableModal';

const AttendanceCard = ({ 
  className, 
  initialColor = '#FFB73B'
}) => {
  // Generate a unique key for localStorage based on class name
  const storageKey = `attendance-card-color-${className}`;
  
  // Load color from localStorage on initial render
  const [color, setColor] = useState(() => {
    const savedColor = localStorage.getItem(storageKey);
    return savedColor || initialColor;
  });
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Save color to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(storageKey, color);
  }, [color, storageKey]);

  const handleCardClick = () => {
    setShowAttendanceModal(true);
  };

  const handleCloseModal = () => {
    setShowAttendanceModal(false);
  };

  const handleColorChange = (newColor) => {
    setColor(newColor);
    setShowColorPicker(false);
  };

  // Updated color options with unique colors and no duplicates
  const colorOptions = [
    '#FFB73B', // Default orange
    '#7EC384', // Green
    '#3598DB', // Blue (original)
    '#9C27B0', // Purple
    '#F44336', // Red
    '#FF9800', // Orange (different shade)
    '#4CAF50', // Green (different shade)
    '#1565C0', // Deep Blue (replaced duplicate blue)
    '#673AB7', // Deep Purple
    '#E91E63', // Pink
    '#795548', // Brown
    '#607D8B', // Blue Grey
  ];

  return (
    <>
      <div className={styles.cardContainer}>
        <div 
          className={styles.classCard} 
          onClick={handleCardClick}
          style={{ '--card-color': color }}
        >
          <div className={styles.classCardTop}>
            <div className={styles.colorPickerWrapper}>
              <button 
                className={styles.colorPickerButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPicker(!showColorPicker);
                }}
                aria-label="Change card color"
              >
                <FontAwesomeIcon icon={faPalette} className={styles.paletteIcon} />
              </button>
            </div>
          </div>
          <div className={styles.classCardBottom}>
            <div className={styles.classInfo}>
              <div className={styles.classGrade}>{className}</div>
            </div>
          </div>
        </div>

        {/* Color Picker Popup */}
        {showColorPicker && (
          <div className={styles.colorPickerPopup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.colorPickerHeader}>
              <span>Choose a color</span>
              <button 
                className={styles.closePicker}
                onClick={() => setShowColorPicker(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.colorGrid}>
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption}
                  className={`${styles.colorOption} ${color === colorOption ? styles.selected : ''}`}
                  style={{ backgroundColor: colorOption }}
                  onClick={() => handleColorChange(colorOption)}
                  aria-label={`Select color ${colorOption}`}
                  title={colorOption}
                />
              ))}
            </div>
            <div className={styles.currentColorInfo}>
              <div 
                className={styles.currentColorPreview}
                style={{ backgroundColor: color }}
              />
              <span className={styles.currentColorText}>
                Current: {color}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Attendance Table Modal */}
      <AttendanceTableModal
        isOpen={showAttendanceModal}
        onClose={handleCloseModal}
        className={className}
      />
    </>
  );
};

export default AttendanceCard;