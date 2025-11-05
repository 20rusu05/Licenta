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
      MuiCssBaseline: {
        styleOverrides: {
          'input:-webkit-autofill, textarea:-webkit-autofill, select:-webkit-autofill': {
            WebkitTextFillColor: isDark ? '#E5E7EB' : '#2C3E50',
            caretColor: isDark ? '#E5E7EB' : '#2C3E50',
            backgroundColor: 'transparent !important',
            WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
            boxShadow: '0 0 0 1000px transparent inset !important',
            transition: 'background-color 99999s ease-in-out 0s',
            borderRadius: 'inherit',
          },
          'input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active, textarea:-webkit-autofill:hover, textarea:-webkit-autofill:focus, select:-webkit-autofill:hover, select:-webkit-autofill:focus': {
            backgroundColor: 'transparent !important',
            WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
            boxShadow: '0 0 0 1000px transparent inset !important',
          },
          'input:-moz-autofill, textarea:-moz-autofill, select:-moz-autofill': {
            backgroundColor: 'transparent !important',
            boxShadow: '0 0 0 1000px transparent inset !important',
          },
        },
      },
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
              '&:hover fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.20)' : '#BDBDBD' },
              '&.Mui-focused fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.20)' : '#BDBDBD' },
              '& .MuiOutlinedInput-input': {
                backgroundColor: 'transparent',
              },
              '& .MuiOutlinedInput-input:focus': {
                backgroundColor: 'transparent',
              },
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            '&.Mui-focused': { color: isDark ? '#9CA3AF' : '#616161' },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(255,255,255,0.20)' : '#BDBDBD',
            },
          },
          notchedOutline: {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E0',
          },
        },
      },
    },
  });
}


