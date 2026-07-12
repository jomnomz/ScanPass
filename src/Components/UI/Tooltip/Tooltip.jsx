// src/components/UI/Tooltip/Tooltip.jsx
import { useState, useRef, useEffect } from 'react';
import styles from './Tooltip.module.css';

/**
 * Click-to-toggle popover tooltip.
 *
 * Uses click instead of hover deliberately — hover has no equivalent on
 * touch devices, so a hover-only tooltip is effectively broken on mobile.
 * Click-to-toggle works identically on desktop and mobile without needing
 * separate interaction paths.
 *
 * `children` is the trigger element (e.g. an info icon).
 * `content` is whatever should appear inside the popover — can be plain
 * text, JSX, or a component like <InfoBox>.
 * `width` allows you to override the default max-width (optional).
 */
function Tooltip({ 
  children, 
  content, 
  position = 'bottom', 
  align = 'left',
  width = '320px' // New prop with default value
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const toggle = (e) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  return (
    <span className={styles.tooltipWrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.tooltipTrigger}
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label="More information"
      >
        {children}
      </button>

      {isOpen && (
        <div
          className={`${styles.tooltipPopover} ${styles[position] || ''} ${styles[align] || ''}`}
          role="tooltip"
          style={{ maxWidth: width }} // Apply custom width
        >
          {content}
        </div>
      )}
    </span>
  );
}

export default Tooltip;