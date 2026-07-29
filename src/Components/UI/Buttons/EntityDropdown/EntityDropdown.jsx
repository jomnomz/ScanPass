import { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import styles from './EntityDropdown.module.css';

function EntityDropdown({
  options = [],
  selectedValue = '',
  onSelect,
  maxHeight = 300,
  allLabel = 'All',
  buttonTitle = 'Filter',
  getOptionLabel,
  getOptionValue,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight, width: 0, direction: 'down' });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const resolveOptionLabel = (option) => {
    if (typeof getOptionLabel === 'function') {
      return getOptionLabel(option);
    }

    if (typeof option === 'object' && option !== null) {
      return option.label || option.name || option.section_name || option.status || String(option.value || '');
    }

    return String(option ?? '');
  };

  const resolveOptionValue = (option) => {
    if (typeof getOptionValue === 'function') {
      return getOptionValue(option);
    }

    if (typeof option === 'object' && option !== null) {
      return option.value ?? option.id ?? option.name ?? option.section_name ?? option.status ?? '';
    }

    return option ?? '';
  };

  const normalizedOptions = useMemo(() => {
    const mapped = (Array.isArray(options) ? options : [])
      .map((option) => {
        const label = resolveOptionLabel(option);
        const value = resolveOptionValue(option);
        return {
          label: String(label ?? '').trim(),
          value: String(value ?? '').trim(),
        };
      })
      .filter((option) => option.label !== '' && option.value !== '');

    const uniqueMap = new Map();
    mapped.forEach((option) => {
      if (!uniqueMap.has(option.value)) {
        uniqueMap.set(option.value, option);
      }
    });

    return Array.from(uniqueMap.values());
  }, [options]);

  const updatePosition = () => {
    if (!buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;

    let calculatedHeight = Math.min(maxHeight, spaceBelow - 20);

    if (spaceBelow < 200 && rect.top > 200) {
      const spaceAbove = rect.top;
      calculatedHeight = Math.min(maxHeight, spaceAbove - 20);
      setPosition({
        top: rect.top + window.scrollY - calculatedHeight,
        left: rect.left + window.scrollX,
        width: rect.width,
        maxHeight: calculatedHeight,
        direction: 'up',
      });
      return;
    }

    setPosition({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      maxHeight: calculatedHeight,
      direction: 'down',
    });
  };

  const handleSelect = (value) => {
    if (onSelect) {
      onSelect(value);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, maxHeight]);

  const selectedText = normalizedOptions.find((option) => option.value === String(selectedValue))?.label;

  return (
    <>
      <div className={styles.dropdownContainer}>
        <button
          ref={buttonRef}
          className={styles.iconButton}
          onClick={() => setIsOpen((prev) => !prev)}
          title={selectedText ? `${buttonTitle}: ${selectedText}` : buttonTitle}
          type="button"
        >
          <ExpandMoreIcon className={`${styles.expandIcon} ${isOpen ? styles.expandIconUp : ''}`} />
        </button>
      </div>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className={`${styles.dropdownMenu} ${position.direction === 'up' ? styles.dropdownMenuUp : ''}`}
          style={{
            position: 'absolute',
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            maxHeight: `${Math.max(position.maxHeight, 120)}px`,
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          <div
            className={`${styles.dropdownItem} ${selectedValue === '' ? styles.selectedItem : ''}`}
            onClick={() => handleSelect('')}
          >
            {allLabel}
          </div>

          {normalizedOptions.map((option) => (
            <div
              key={option.value}
              className={`${styles.dropdownItem} ${String(selectedValue) === option.value ? styles.selectedItem : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default EntityDropdown;
