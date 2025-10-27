// Theme utility functions - Updated for Figma Design System Compliance

export const getThemeClasses = () => ({
  // Primary colors (Indigo)
  primary: 'bg-primary-600 text-white hover:bg-primary-700',
  primaryLight: 'bg-primary-50 text-primary-700 border-primary-200',
  
  // Secondary colors
  secondary: 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
  
  // Status colors
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  error: 'bg-error-50 text-error-700 border-error-200',
  info: 'bg-info-50 text-info-700 border-info-200',
  
  // Cards and surfaces
  card: 'bg-white rounded-lg border border-neutral-200 shadow-sm',
  cardHeader: 'px-6 py-4 border-b border-neutral-200',
  cardBody: 'p-6',
  
  // Buttons
  btnPrimary: 'px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors',
  btnSecondary: 'px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 transition-colors',
  
  // Forms
  input: 'w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
  
  // Text colors
  textPrimary: 'text-neutral-900',
  textSecondary: 'text-neutral-600',
  textMuted: 'text-neutral-500',
})

export const getPoolServiceTheme = () => ({
  colors: {
    primary: {
      50: '#EEF2FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      600: '#4F46E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
    },
    neutral: {
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
    }
  }
})

// Utility function to combine CSS classes
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

// Pool service specific utility classes
export const poolServiceClasses = {
  // Gradient backgrounds
  gradientPrimary: 'bg-gradient-to-r from-pool-blue-500 to-pool-blue-600',
  gradientSecondary: 'bg-gradient-to-br from-pool-blue-50 to-service-100',
  
  // Service card styles
  serviceCard: 'bg-white rounded-lg border border-service-200 shadow-sm p-6 hover:shadow-md transition-shadow',
  
  // Pool service specific badges
  poolBadge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pool-blue-100 text-pool-blue-800',
  serviceBadge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-service-100 text-service-800',
  
  // Status indicators
  statusActive: 'w-2 h-2 bg-green-500 rounded-full',
  statusInactive: 'w-2 h-2 bg-service-300 rounded-full',
  statusPending: 'w-2 h-2 bg-yellow-500 rounded-full',
}

// Additional utility styles needed by components
export const layoutStyles = {
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexCol: 'flex flex-col',
  gridCols2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  gridCols3: 'grid grid-cols-1 md:grid-cols-3 gap-6',
  gridCols4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6',
}

export const spacingStyles = {
  sectionPadding: 'p-6',
  sectionMargin: 'mb-6',
  cardPadding: 'p-4',
  tightSpacing: 'space-y-2',
  normalSpacing: 'space-y-4',
  looseSpacing: 'space-y-6',
}

export const shadowStyles = {
  soft: 'shadow-sm',
  medium: 'shadow-md',
  large: 'shadow-lg',
  hover: 'hover:shadow-lg transition-shadow duration-200',
}

export const animationStyles = {
  fadeIn: 'animate-fade-in',
  slideIn: 'animate-slide-in',
  bounce: 'animate-bounce',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
}

export const textStyles = {
  heading1: 'text-3xl font-bold text-neutral-900',
  heading2: 'text-2xl font-semibold text-neutral-900',
  heading3: 'text-xl font-medium text-neutral-900',
  heading4: 'text-lg font-medium text-neutral-800',
  h6: 'text-base font-semibold text-neutral-900',
  body: 'text-sm text-neutral-700',
  bodySmall: 'text-sm text-neutral-600',
  caption: 'text-xs text-neutral-600',
  muted: 'text-neutral-500',
  error: 'text-error-600',
  success: 'text-success-600',
  warning: 'text-warning-600',
  info: 'text-info-600',
  link: 'text-primary-600 hover:text-primary-700',
}

export const backgroundStyles = {
  primary: 'bg-primary-600',
  primaryLight: 'bg-primary-50',
  secondary: 'bg-neutral-100',
  white: 'bg-white',
  gray: 'bg-neutral-50',
  success: 'bg-success-50',
  error: 'bg-error-50',
  warning: 'bg-warning-50',
  info: 'bg-info-50',
  gradient: 'bg-gradient-to-br from-primary-50 to-neutral-100',
}

export const borderStyles = {
  default: 'border border-neutral-200',
  primary: 'border border-primary-200',
  success: 'border border-success-200',
  error: 'border border-error-200',
  warning: 'border border-warning-200',
  info: 'border border-info-200',
  light: 'border-neutral-200',
  rounded: 'rounded-lg',
  roundedFull: 'rounded-full',
  none: 'border-0',
}

export const presetStyles = {
  card: {
    default: 'bg-white rounded-lg border border-neutral-200 shadow-sm',
    interactive: 'bg-white rounded-lg border border-neutral-200 shadow-sm p-6',
  },
  cardHover: 'bg-white rounded-lg border border-neutral-200 shadow-sm hover:shadow-md transition-shadow',
  button: {
    primary: 'px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors',
    secondary: 'px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 transition-colors',
    ghost: 'px-4 py-2 bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 rounded-lg font-medium transition-colors',
  },
  input: 'w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
  badge: {
    primary: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800',
    success: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800',
    warning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800',
    error: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-error-100 text-error-800',
    info: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-100 text-info-800',
    neutral: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800',
  },
  tag: 'inline-block px-2 py-1 text-xs bg-neutral-100 text-neutral-800 rounded',
}
