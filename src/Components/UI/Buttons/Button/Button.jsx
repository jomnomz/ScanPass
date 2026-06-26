import { useState } from 'react';
import styles from './Button.module.css';

function Button(props) {
    const { 
        label, 
        icon, 
        iconPosition = 'left', 
        type = "button",
        height = 'md', 
        width = 'full', 
        color = 'primary', 
        onClick, 
        disabled = false,
        pill = false,
        pillLeft = false,
        pillRight = false,
        tabBottom = false,
        line = false,
        active = false,
        backgroundNone = false, 
    } = props;

    const [isHovered, setIsHovered] = useState(false);

    const heightMap = {
        'exit': { fontSize: '20px', height: '20px'},
        xxss: { padding: '0px', fontSize: '25px', height: '40px' },
        xxs: { padding: '8px 16px', fontSize: '12px', height: '28px' },
        xs: { padding: '8px 16px', fontSize: '14px', height: '32px' },
        sm: { padding: '10px 20px', fontSize: '16px', height: '36px' },
        md: { padding: '12px 24px', fontSize: '18px', height: '40px' },
        lg: { padding: '14px 28px', fontSize: '20px', height: '48px' },
        xl: { padding: '16px 32px', fontSize: '22px', height: '56px' },
    };

    const widthMap = {
        auto: { width: 'auto', minWidth: 'fit-content' },
        '95': { width: '95%' },
        'modal': { width: '70px' },
        full: { width: '100%' },
        'exit': { width: '20px'},
        xxss: { width: '40px'},
        xxs: { width: '60px' },
        xs: { width: '80px' },
        'xs-sm': { width: '100px' },
        sm: { width: '120px' },
        md: { width: '160px' },
        lg: { width: '200px' },
        xl: { width: '240px' },
        xxl: { width: '350px' },
    };

    const colorMap = {
        primary: { 
            backgroundColor: '#1e293b', 
            activeBackground: '#059669',
            hoverBackground: '#334155',
            color: '#f8fafc', 
            border: '1px solid #334155',
        },
        secondary: { 
            backgroundColor: '#475569', 
            activeBackground: '#0d9488', 
            hoverBackground: '#64748b', 
            color: '#ffffff', 
            border: 'none',
        },
        tertiary: { 
            backgroundColor: '#627584', 
            activeBackground: '#4A5864', 
            hoverBackground: '#536370', 
            color: '#ffffff', 
            border: 'none',
        },
        success: { 
            backgroundColor: '#016C3F', 
            activeBackground: '#059669', 
            hoverBackground: '#075640ff', 
            color: '#ffffff', 
            border: 'none',
        },
        warning: { 
            backgroundColor: '#d97706', 
            activeBackground: '#b45309', 
            hoverBackground: '#f59e0b', 
            color: '#ffffff', 
            border: 'none',
        },
        terracotta: { 
            backgroundColor: '#A6634B', 
            activeBackground: '#854F3C', 
            hoverBackground: '#B8735C', 
            color: '#ffffff', 
            border: 'none',
        },
        coolGray: { 
            backgroundColor: '#9da4a5', 
            activeBackground: '#384244', 
            hoverBackground: '#5C6D70', 
            color: '#ffffff', 
            border: 'none',
        },
        danger: { 
            backgroundColor: '#BC4749', 
            activeBackground: '#A2393B', 
            hoverBackground: '#8C3133', 
            color: '#ffffff', 
            border: 'none',
        },
        ocean: { 
            backgroundColor: '#3E5C76', // Deep, muted slate blue
            activeBackground: '#2C4356', // Darker navy-slate for click state
            hoverBackground: '#334D63', // Subtle darkening for hover
            color: '#ffffff', 
            border: 'none',
        },
        ghost: { 
            backgroundColor: '#f8fafb', // Very light gray/white
            activeBackground: '#e2e8f0', 
            hoverBackground: '#edf2f7', 
            color: '#627584', // Slate text
            border: '1px solid #cbd5e1',
        },
        warmStone: { 
            backgroundColor: '#7A7672', 
            activeBackground: '#5E5B58', 
            hoverBackground: '#8E8A85', 
            color: '#ffffff', 
            border: 'none',
        },

        plum: { 
            backgroundColor: '#6D597A', 
            activeBackground: '#4E4058', 
            hoverBackground: '#826A91', 
            color: '#ffffff', 
            border: 'none',
        },
        nav: { 
            backgroundColor: '#1a2236', 
            activeBackground: '#12192c', 
            hoverBackground: '#475669', 
            color: '#ffffff', 
            border: 'none',
        },
        teaGreen: { 
            backgroundColor: '#AFC892', 
            activeBackground: '#a1b18e', 
            hoverBackground: '#b5c89e', 
            color: '#ffffff', 
            border: 'none',
        },
        cerulean: { 
            backgroundColor: '#0EA5E9', 
            activeBackground: '#1098d7', 
            hoverBackground: '#1098d7', 
            color: '#ffffff', 
            border: '#1098d7',
        },
    };

    const getBorderRadius = (pill, pillLeft, pillRight) => {
        if (pillLeft) return '50px 0px 0px 50px';
        if (pillRight) return '0px 50px 50px 0px';
        if (tabBottom) return '25px 25px 0px 0px';
        if (pill) return '50px';
        return '6px'; 
    };

    const heightStyle = heightMap[height] || heightMap.md;
    const widthStyle = widthMap[width] || widthMap.auto;
    const colorStyle = colorMap[color] || colorMap.primary;

    const getBackgroundColor = () => {
        if (line) {
            return 'transparent';
        }

        if (backgroundNone) {
            return 'transparent';
        }
        
        if (active) {
            return colorStyle.activeBackground || colorStyle.backgroundColor;
        }
        
        if (isHovered) {
            return colorStyle.hoverBackground || colorStyle.backgroundColor;
        }
        
        return colorStyle.backgroundColor;
    };

    const getTextColor = () => {
        if (line) {
            if (active) return '#0f6b58';
            if (isHovered) return '#0f6b58';
            return '#1f2937';
        }

        if (backgroundNone) {
            return color === 'primary' ? '#1e293b' : 
                   color === 'secondary' ? '#475569' :
                   color === 'success' ? '#065f46' :
                   color === 'warning' ? '#d97706' :
                   color === 'danger' ? '#dc2626' :
                   color === 'grades' ? '#475569' : '#1e293b';
        }
        return colorStyle.color;
    };

    const getBorder = () => {
        if (line) {
            return 'none';
        }

        if (backgroundNone) {
            return 'none';
        }
        return colorStyle.border;
    };

    const backgroundColor = getBackgroundColor();
    const textColor = getTextColor();
    const border = getBorder();
    const resolvedBorderBottom = line
        ? (active ? '2px solid #0f6b58' : (isHovered ? '2px solid rgba(15, 107, 88, 0.55)' : '2px solid transparent'))
        : (border === 'none' ? 'none' : border);

    const buttonStyle = {
        ...heightStyle,
        ...widthStyle,
        backgroundColor: backgroundColor,
        color: textColor, 
        border: border,
        borderRadius: line ? '0px' : getBorderRadius(pill, pillLeft, pillRight),
        borderBottom: resolvedBorderBottom,
        boxShadow: 'none',
        WebkitBoxShadow: 'none',
        MozBoxShadow: 'none',
        filter: 'none',
        backgroundImage: 'none',
        textShadow: 'none',
        transition: 'all 0.2s ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
    };

    const adjustedStyle = icon && !label ? {
        ...buttonStyle,
        padding: '8px', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    } : buttonStyle;

    return (
        <button 
            style={adjustedStyle} 
            type={type}
            className={`${styles.button} ${line ? styles.lineButton : ''} ${line && active ? styles.lineActive : ''}`}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={active}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <span className={`${styles.content} ${iconPosition === 'right' ? styles.reverse : ''}`}>
                {icon && <span className={styles.icon}>{icon}</span>}
                {label && <span className={styles.label}>{label}</span>}
            </span>
        </button>
    );
}

export default Button;