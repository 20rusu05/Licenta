import { Button, ButtonGroup, Tooltip } from '@mui/material';
import { useLanguage } from '../../LanguageContext';

// Toggle-ul foloseste contextul global de limba.
export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  // Tooltipul arata mereu actiunea urmatoare, nu limba curenta.
  return (
    <Tooltip title={lang === 'ro' ? 'Switch to English' : 'Schimbă în română'}>
      <ButtonGroup size="small" variant="outlined" aria-label="language switch">
        {/* Varianta contained marcheaza limba selectata. */}
        <Button onClick={() => setLang('en')} variant={lang === 'en' ? 'contained' : 'outlined'} sx={{ minWidth: 44, px: 1.2 }}>
          EN
        </Button>
        <Button onClick={() => setLang('ro')} variant={lang === 'ro' ? 'contained' : 'outlined'} sx={{ minWidth: 44, px: 1.2 }}>
          RO
        </Button>
      </ButtonGroup>
    </Tooltip>
  );
}
