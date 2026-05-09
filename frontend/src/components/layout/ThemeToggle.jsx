import { useContext } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { ThemeModeContext } from '../../ThemeModeContext';
import { useLanguage } from '../../LanguageContext';

export default function ThemeToggle() {
  const { mode, toggleMode } = useContext(ThemeModeContext);
  const { t } = useLanguage();

  return (
    <Tooltip title={mode === 'light' ? t('theme.dark') : t('theme.light')}>
      <IconButton color="primary" onClick={toggleMode} aria-label="toggle theme">
        {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
    </Tooltip>
  );
}


