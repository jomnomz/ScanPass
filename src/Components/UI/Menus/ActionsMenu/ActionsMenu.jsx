import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import styles from './ActionsMenu.module.css';

/**
 * actions: Array<{
 *   label: string,
 *   icon?: IconDefinition,
 *   onClick: (e) => void,
 *   variant?: 'default' | 'danger',
 *   disabled?: boolean,
 * }>
 */
const ActionsMenu = ({ actions = [], triggerIcon = faEllipsisVertical, ariaLabel = 'Open actions menu' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState(null); // { top, left, openUpward }
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 180; // keep in sync with CSS min-width
    const menuHeightEstimate = actions.length * 36 + 8;

    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const openUpward = spaceBelow < menuHeightEstimate && triggerRect.top > menuHeightEstimate;

    let left = triggerRect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    const top = openUpward
      ? triggerRect.top - menuHeightEstimate - 4
      : triggerRect.bottom + 4;

    setCoords({ top, left, openUpward });
  }, [actions.length]);

  const openMenu = (e) => {
    e.stopPropagation();
    computePosition();
    setIsOpen((prev) => !prev);
  };

  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      closeMenu();
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') closeMenu();
    };

    const handleReposition = () => computePosition();

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, closeMenu, computePosition]);

  const handleActionClick = (action) => (e) => {
    e.stopPropagation();
    if (action.disabled) return;
    action.onClick(e);
    closeMenu();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <FontAwesomeIcon icon={triggerIcon} />
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ top: coords.top, left: coords.left }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`${styles.menuItem} ${action.variant === 'danger' ? styles.danger : ''}`}
              onClick={handleActionClick(action)}
              disabled={action.disabled}
            >
              {action.icon && <FontAwesomeIcon icon={action.icon} className={styles.menuItemIcon} />}
              <span>{action.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default ActionsMenu;