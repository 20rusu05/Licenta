import { createTheme } from '@mui/material/styles';

export function getTheme(mode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#2196F3',
        light: '#64B5F6',
        dark: '#1976D2',
        contrastText: '#fff',
      },
      secondary: {
        main: '#26A69A',
        light: '#4DB6AC',
        dark: '#00897B',
        contrastText: '#fff',
      },
      background: {
        default: isDark ? '#0B0F19' : '#F5F5F5',
        paper: isDark ? '#111827' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E5E7EB' : '#2C3E50',
        secondary: isDark ? '#9CA3AF' : '#34495E',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E0',
    },
    typography: {
      fontFamily: [
        'Inter',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: { fontSize: '2.5rem', fontWeight: 600 },
      h2: { fontSize: '2rem', fontWeight: 600 },
      h3: { fontSize: '1.75rem', fontWeight: 600 },
      body1: { fontSize: '1rem' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 10,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: '0px 2px 8px rgba(0,0,0,0.2)' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E0' },
              '&:hover fieldset': { borderColor: '#2196F3' },
            },
          },
        },
      },
    },
  });
}


