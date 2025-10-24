// Theme utility functions for pool service styling

export const getThemeClasses = () => ({
  // Primary colors
  primary: 'bg-pool-blue-600 text-white hover:bg-pool-blue-700',
  primaryLight: 'bg-pool-blue-50 text-pool-blue-700 border-pool-blue-200',
  
  // Secondary colors
  secondary: 'bg-service-100 text-service-700 hover:bg-service-200',
  
  // Status colors
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  
  // Cards and surfaces
  card: 'bg-white rounded-lg border border-service-200 shadow-sm',
  cardHeader: 'px-6 py-4 border-b border-service-200',
  cardBody: 'p-6',
  
  // Buttons
  btnPrimary: 'px-4 py-2 bg-pool-blue-600 text-white rounded-lg hover:bg-pool-blue-700 focus:ring-2 focus:ring-pool-blue-500 focus:ring-offset-2 transition-colors',
  btnSecondary: 'px-4 py-2 bg-service-100 text-service-700 rounded-lg hover:bg-service-200 focus:ring-2 focus:ring-service-500 focus:ring-offset-2 transition-colors',
  
  // Forms
  input: 'w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent',
  
  // Text colors
  textPrimary: 'text-service-900',
  textSecondary: 'text-service-600',
  textMuted: 'text-service-500',
})

export const getPoolServiceTheme = () => ({
  colors: {
    poolBlue: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    service: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
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
  heading1: 'text-3xl font-bold text-service-900',
  heading2: 'text-2xl font-semibold text-service-900',
  heading3: 'text-xl font-medium text-service-900',
  heading4: 'text-lg font-medium text-service-800',
  body: 'text-sm text-service-700',
  caption: 'text-xs text-service-600',
  muted: 'text-service-500',
  error: 'text-red-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
}

export const backgroundStyles = {
  primary: 'bg-pool-blue-600',
  primaryLight: 'bg-pool-blue-50',
  secondary: 'bg-service-100',
  white: 'bg-white',
  gray: 'bg-service-50',
  success: 'bg-green-50',
  error: 'bg-red-50',
  warning: 'bg-yellow-50',
  info: 'bg-blue-50',
  gradient: 'bg-gradient-to-br from-pool-blue-50 to-service-100',
}

export const borderStyles = {
  default: 'border border-service-200',
  primary: 'border border-pool-blue-200',
  success: 'border border-green-200',
  error: 'border border-red-200',
  warning: 'border border-yellow-200',
  info: 'border border-blue-200',
  rounded: 'rounded-lg',
  roundedFull: 'rounded-full',
  none: 'border-0',
}

export const presetStyles = {
  card: 'bg-white rounded-lg border border-service-200 shadow-sm',
  cardHover: 'bg-white rounded-lg border border-service-200 shadow-sm hover:shadow-md transition-shadow',
  button: 'px-4 py-2 rounded-lg font-medium transition-colors',
  buttonPrimary: 'px-4 py-2 bg-pool-blue-600 text-white rounded-lg font-medium hover:bg-pool-blue-700 transition-colors',
  buttonSecondary: 'px-4 py-2 bg-service-100 text-service-700 rounded-lg font-medium hover:bg-service-200 transition-colors',
  input: 'w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent',
  badge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  tag: 'inline-block px-2 py-1 text-xs bg-service-100 text-service-800 rounded',
}