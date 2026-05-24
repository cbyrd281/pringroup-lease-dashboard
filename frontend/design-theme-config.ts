// frontend/src/config/designTheme.ts
// Design configuration for all 3 pringroup dashboard options

export type DesignOption = 'classic' | 'premium' | 'modern';

// Shared color palette (same for all options)
export const colors = {
  primary: {
    deepNavy: '#1E2F56',      // Headers, text
    darkNavy: '#0D1C38',       // Alternative header
    periwinkleBlue: '#7492BC', // Borders, accents
    slateGray: '#5A6E82',      // Secondary text
  },
  secondary: {
    gold: '#C5A84C',           // Urgency badges, accents
    goldLight: '#DFC677',      // Light accent
    slateDark: '#4E5F6F',      // Dark slate
    slateLight: '#A0B2BC',     // Light slate
  },
  neutral: {
    white: '#FFFFFF',          // Main background
    offWhite: '#E8EEF6',       // Secondary background
  },
  urgency: {
    urgent: '#DC2626',         // Red for ≤30 days
    soon: '#C5A84C',           // Gold for 31-60 days
    ok: '#22c55e',             // Green for >60 days
  },
};

// Design Theme: Option 1 - Classic
export const designOption1 = {
  name: 'Classic',
  displayName: 'Classic Header (Logo Top Right)',
  header: {
    backgroundColor: colors.primary.deepNavy,
    textColor: '#FFFFFF',
    borderColor: colors.primary.periwinkleBlue,
    borderWidth: '3px',
    borderStyle: 'solid',
  },
  logo: {
    position: 'top-right',
    backgroundColor: colors.neutral.white,
    textColor: colors.primary.deepNavy,
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '1px',
    borderRadius: '4px',
  },
  tabs: {
    backgroundColor: colors.neutral.offWhite,
    activeColor: colors.primary.deepNavy,
    borderColor: colors.primary.periwinkleBlue,
    borderWidth: '3px',
  },
  grid: {
    headerBackground: colors.neutral.offWhite,
    headerTextColor: colors.primary.deepNavy,
    rowBackground: colors.neutral.white,
    rowAltBackground: colors.neutral.offWhite,
    borderColor: colors.primary.slateGray,
    hoverBackground: '#F0F4FA',
  },
  footer: {
    backgroundColor: colors.neutral.offWhite,
    textColor: colors.primary.slateGray,
  },
};

// Design Theme: Option 2 - Premium (Gold Accent)
export const designOption2 = {
  name: 'Premium',
  displayName: 'Premium Header (Gold Accent)',
  header: {
    backgroundColor: colors.primary.deepNavy,
    textColor: colors.secondary.gold,        // Gold title text
    borderColor: colors.secondary.gold,      // Gold bottom border
    borderWidth: '4px',
    borderStyle: 'solid',
  },
  logo: {
    position: 'top-right',
    backgroundColor: colors.secondary.gold,  // Gold background
    textColor: colors.primary.deepNavy,
    padding: '8px 14px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    borderRadius: '4px',
  },
  tabs: {
    backgroundColor: colors.neutral.offWhite,
    activeColor: colors.primary.deepNavy,
    borderColor: colors.secondary.gold,
    borderWidth: '3px',
  },
  grid: {
    headerBackground: colors.neutral.offWhite,
    headerTextColor: colors.primary.deepNavy,
    rowBackground: colors.neutral.white,
    rowAltBackground: colors.neutral.offWhite,
    borderColor: colors.primary.slateGray,
    hoverBackground: '#F0F4FA',
  },
  footer: {
    backgroundColor: colors.neutral.offWhite,
    textColor: colors.primary.slateGray,
  },
};

// Design Theme: Option 3 - Modern Minimal (Badge in Header)
export const designOption3 = {
  name: 'Modern',
  displayName: 'Modern Header (Logo Badge)',
  header: {
    backgroundColor: colors.primary.darkNavy,
    textColor: colors.neutral.white,
    borderColor: colors.primary.periwinkleBlue,
    borderWidth: '2px',
    borderStyle: 'solid',
    layout: 'flex-space-between', // Logo on left, title center, actions right
  },
  logo: {
    position: 'header-badge',    // Small square badge in header
    backgroundColor: colors.secondary.gold,
    textColor: colors.primary.darkNavy,
    padding: '8px',
    size: '32px',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '4px',
    display: 'badge',            // Show "PG" initials instead of full name
  },
  tabs: {
    backgroundColor: colors.neutral.offWhite,
    activeColor: colors.primary.darkNavy,
    borderColor: colors.primary.periwinkleBlue,
    borderWidth: '2px',
  },
  grid: {
    headerBackground: colors.neutral.offWhite,
    headerTextColor: colors.primary.darkNavy,
    rowBackground: colors.neutral.white,
    rowAltBackground: colors.neutral.offWhite,
    borderColor: colors.primary.slateGray,
    hoverBackground: '#F0F4FA',
  },
  footer: {
    backgroundColor: colors.neutral.offWhite,
    textColor: colors.primary.slateGray,
  },
};

// Theme selector - set this to choose which design to use
export const selectedDesign = process.env.REACT_APP_DESIGN_OPTION || 'classic';

export const getTheme = (option: DesignOption = selectedDesign as DesignOption) => {
  switch (option) {
    case 'premium':
      return designOption2;
    case 'modern':
      return designOption3;
    case 'classic':
    default:
      return designOption1;
  }
};

export const currentTheme = getTheme();

// Tailwind config values (generated from theme)
export const tailwindConfig = {
  colors: {
    navy: {
      dark: colors.primary.deepNavy,
      darker: colors.primary.darkNavy,
      light: colors.primary.periwinkleBlue,
    },
    slate: {
      default: colors.primary.slateGray,
      dark: colors.secondary.slateDark,
      light: colors.secondary.slateLight,
    },
    gold: {
      default: colors.secondary.gold,
      light: colors.secondary.goldLight,
    },
    off: {
      white: colors.neutral.offWhite,
    },
    urgency: colors.urgency,
  },
};

// Environment setup
// Set REACT_APP_DESIGN_OPTION to one of: classic | premium | modern
// Example: REACT_APP_DESIGN_OPTION=premium npm start
