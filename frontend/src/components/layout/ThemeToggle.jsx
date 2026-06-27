import { useContext } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { ThemeModeContext } from '../../ThemeModeContext';
import { useLanguage } from '../../LanguageContext';

// Butonul citeste tema din contextul global, nu din local state.
export default function ThemeToggle() {
  const { mode, toggleMode } = useContext(ThemeModeContext);
  const { t } = useLanguage();

  // Eticheta este localizata prin dictionarul comun.
  return (
    <Tooltip title={mode === 'light' ? t('theme.dark') : t('theme.light')}>
      <IconButton color="primary" onClick={toggleMode} aria-label="toggle theme">
        {/* Iconita indica tema catre care se face comutarea. */}
        {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
    </Tooltip>
  );
}

