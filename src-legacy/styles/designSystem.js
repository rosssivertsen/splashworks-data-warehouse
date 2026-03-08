/**
 * Design System - Centralized Design Tokens
 * Based on Figma Layout Specifications
 * 
 * This file serves as the single source of truth for all design values
 * including colors, typography, spacing, shadows, and other visual tokens.
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  // Primary Colors (Indigo)
  primary: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1', // Main Primary
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
  },

  // Secondary Colors (Sky Blue)
  secondary: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9', // Main Secondary
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
  },

  // Success Colors
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981', // Main Success
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Warning Colors
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B', // Main Warning
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Error Colors
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444', // Main Error
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  // Info Colors
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6', // Main Info
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Neutral Colors
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },

  // Background & Interactive Colors
  background: {
    main: '#F8FAFC',
    card: '#FFFFFF',
    overlay: 'rgba(17, 24, 39, 0.8)',
    border: '#E5E7EB',
    hover: '#F3F4F6',
    active: '#E5E7EB',
  },
}

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  fontFamily: {
    primary: '"Inter", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "Courier New", monospace',
  },

  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
}

// ============================================================================
// SPACING SYSTEM
// ============================================================================

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
}

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
}

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
}

// ============================================================================
// TRANSITIONS
// ============================================================================

export const transitions = {
  fast: '0.1s ease-in',
  normal: '0.2s ease-out',
  slow: '0.3s ease-out',
}

// ============================================================================
// COMPONENT DIMENSIONS
// ============================================================================

export const dimensions = {
  header: {
    desktop: '80px',
    tablet: '64px',
    mobile: '56px',
  },
  tabNavigation: {
    desktop: '64px',
    tablet: '56px',
    mobile: '56px',
  },
  container: {
    maxWidth: '1400px',
    margin: {
      desktop: '32px',
      tablet: '16px',
      mobile: '12px',
    },
  },
  content: {
    minHeight: '600px',
    padding: {
      desktop: '24px',
      tablet: '16px',
      mobile: '12px',
    },
  },
}

// ============================================================================
// COMPONENT STYLES - Pre-built component variants
// ============================================================================

export const components = {
  button: {
    primary: {
      backgroundColor: colors.primary[600],
      color: colors.neutral[0],
      padding: `${spacing[3]} ${spacing[6]}`,
      borderRadius: borderRadius.md,
      fontWeight: typography.fontWeight.medium,
      transition: transitions.normal,
      hover: {
        backgroundColor: colors.primary[700],
      },
    },
    secondary: {
      backgroundColor: colors.neutral[500],
      color: colors.neutral[0],
      padding: `${spacing[3]} ${spacing[6]}`,
      borderRadius: borderRadius.md,
      fontWeight: typography.fontWeight.medium,
      transition: transitions.normal,
      hover: {
        backgroundColor: colors.neutral[600],
      },
    },
    outline: {
      backgroundColor: 'transparent',
      color: colors.neutral[600],
      border: `1px solid ${colors.neutral[300]}`,
      padding: `${spacing[2]} ${spacing[4]}`,
      borderRadius: borderRadius.sm,
      fontWeight: typography.fontWeight.medium,
      transition: transitions.normal,
      hover: {
        color: colors.neutral[800],
      },
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.neutral[600],
      padding: `${spacing[2]} ${spacing[4]}`,
      borderRadius: borderRadius.sm,
      transition: transitions.normal,
      hover: {
        color: colors.neutral[800],
        backgroundColor: colors.background.hover,
      },
    },
  },

  card: {
    default: {
      backgroundColor: colors.background.card,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: borderRadius.lg,
      boxShadow: shadows.sm,
    },
    elevated: {
      backgroundColor: colors.background.card,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: borderRadius.lg,
      boxShadow: shadows.md,
    },
    interactive: {
      backgroundColor: colors.background.card,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: borderRadius.lg,
      boxShadow: shadows.sm,
      transition: transitions.normal,
      hover: {
        boxShadow: shadows.md,
        transform: 'scale(1.01)',
      },
    },
  },

  input: {
    default: {
      height: '40px',
      border: `1px solid ${colors.neutral[300]}`,
      borderRadius: borderRadius.sm,
      padding: `0 ${spacing[3]}`,
      fontSize: typography.fontSize.base,
      transition: transitions.normal,
      focus: {
        borderColor: colors.primary[500],
        boxShadow: `0 0 0 3px ${colors.primary[100]}`,
      },
    },
  },

  badge: {
    success: {
      backgroundColor: colors.success[100],
      color: colors.success[800],
      padding: `${spacing[1]} ${spacing[2]}`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    warning: {
      backgroundColor: colors.warning[100],
      color: colors.warning[800],
      padding: `${spacing[1]} ${spacing[2]}`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    error: {
      backgroundColor: colors.error[100],
      color: colors.error[800],
      padding: `${spacing[1]} ${spacing[2]}`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    info: {
      backgroundColor: colors.info[100],
      color: colors.info[800],
      padding: `${spacing[1]} ${spacing[2]}`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    primary: {
      backgroundColor: colors.primary[100],
      color: colors.primary[800],
      padding: `${spacing[1]} ${spacing[2]}`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
  },

  status: {
    success: {
      backgroundColor: colors.success[50],
      color: colors.success[700],
      border: `1px solid ${colors.success[200]}`,
    },
    warning: {
      backgroundColor: colors.warning[50],
      color: colors.warning[700],
      border: `1px solid ${colors.warning[200]}`,
    },
    error: {
      backgroundColor: colors.error[50],
      color: colors.error[700],
      border: `1px solid ${colors.error[200]}`,
    },
    info: {
      backgroundColor: colors.info[50],
      color: colors.info[700],
      border: `1px solid ${colors.info[200]}`,
    },
  },
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a color value from the design system
 * @param {string} path - Dot notation path (e.g., 'primary.500', 'neutral.800')
 * @returns {string} Color value
 */
export const getColor = (path) => {
  const parts = path.split('.')
  let value = colors
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part]
    } else {
      console.warn(`Color path "${path}" not found in design system`)
      return null
    }
  }
  
  return value
}

/**
 * Get a spacing value from the design system
 * @param {number} size - Spacing size (1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20)
 * @returns {string} Spacing value
 */
export const getSpacing = (size) => {
  return spacing[size] || spacing[4]
}

/**
 * Combine multiple class names
 * @param {...string} classes - Class names to combine
 * @returns {string} Combined class names
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

/**
 * Generate CSS-in-JS style object from design tokens
 */
export const styleHelpers = {
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
}

// Export default object with all tokens
export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  dimensions,
  components,
  getColor,
  getSpacing,
  cn,
  styleHelpers,
}
