// constants/theme.ts
export const Theme = {
  colors: {
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    primaryDark: '#4834D4',
    primarySurface: '#F0EEFF',

    success: '#00B894',
    successSurface: '#E8F8F5',
    warning: '#FDCB6E',
    warningSurface: '#FFF9EC',
    danger: '#E17055',
    dangerSurface: '#FFF0EC',
    info: '#74B9FF',

    white: '#FFFFFF',
    black: '#000000',

    text: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',

    background: '#F8F7FF',
    surface: '#FFFFFF',
    surfaceSecondary: '#F3F4F6',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',

    tabBar: '#FFFFFF',
    tabBarBorder: '#F0F0F5',
    tabActive: '#6C5CE7',
    tabInactive: '#9CA3AF',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 999,
  },

  font: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },

  shadow: {
    sm: {
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  },
} as const;