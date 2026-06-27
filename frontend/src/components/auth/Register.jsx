import { useState } from 'react';
import { TextField, Button, Box, Typography, Container, Alert, Paper, Link, Checkbox, FormControlLabel, IconButton, InputAdornment } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useLanguage } from '../../LanguageContext';

export default function Register() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const isEnglish = lang === 'en';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nume: '',
    prenume: '',
    email: '',
    parola: '',
    telefon: ''
  });
  const [confirmParola, setConfirmParola] = useState('');
  const [showParola, setShowParola] = useState(false);
  const [showConfirmParola, setShowConfirmParola] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
  const phoneRegex = /^(07\d{8}|02\d{8}|03\d{8})$/;

  // Regulile de format sunt pastrate langa componenta ca formularul sa fie usor de citit.
  // Validarile rapide din UI evita request-uri evidente invalide catre backend.
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'telefon' && !/^\d*$/.test(value)) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nume.trim() || !formData.prenume.trim() || !formData.email.trim() || !formData.parola.trim() || !formData.telefon.trim()) {
      setError(isEnglish ? 'Fill in all required fields.' : 'Completează toate câmpurile obligatorii.');
      return;
    }

    if (!confirmParola.trim()) {
      setError(isEnglish ? 'Confirm the password before creating the account.' : 'Confirmă parola înainte de a crea contul.');
      return;
    }

    if (formData.parola !== confirmParola) {
      setError(isEnglish ? 'Passwords do not match.' : 'Parolele nu coincid.');
      return;
    }

    
    if (!acceptedTerms) {
      setError(isEnglish ? 'You must accept the terms and conditions to create an account.' : "Trebuie să acceptați termenii și condițiile pentru a crea un cont.");
      return;
    }
    
    if (!emailRegex.test(formData.email)) {
      setError(isEnglish ? 'The email address is not valid. (something@something.xxx)' : "Adresa de email nu este validă. (ceva@ceva.ceva)");
      return;
    }

    if (!passwordRegex.test(formData.parola)) {
      setError(isEnglish ? 'The password must contain at least 8 characters, one uppercase letter, and one special character.' : "Parola trebuie să conțină minim 8 caractere, o literă mare și un caracter special.");
      return;
    }

    if (!phoneRegex.test(formData.telefon)) {
      setError(isEnglish ? 'The phone number must start with 07, 02, or 03 and contain exactly 10 digits.' : "Numărul de telefon trebuie să înceapă cu 07, 02 sau 03 și să aibă exact 10 cifre.");
      return;
    }

    try {
      // Dupa creare, utilizatorul se autentifica separat pe pagina de login.
      await api.post('/auth/register', formData);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la înregistrare');
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: (theme) => theme.palette.mode === 'dark'
        ? 'radial-gradient(1200px 600px at -10% -10%, rgba(33,150,243,0.15), transparent), radial-gradient(800px 500px at 110% 10%, rgba(38,166,154,0.12), transparent)'
        : 'radial-gradient(1200px 600px at -10% -10%, rgba(33,150,243,0.10), transparent), radial-gradient(800px 500px at 110% 10%, rgba(38,166,154,0.08), transparent)'
    }}>
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          pt: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography
          component="h1"
          variant="h4"
          sx={{
            mb: 4,
            color: 'primary.main',
            fontWeight: 600,
            cursor: 'pointer',
            '&:hover': { opacity: 0.8 }
          }}
          onClick={() => navigate('/')}
        >
          NewMed
        </Typography>
        
        <Paper
          elevation={0}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography
            component="h2"
            variant="h5"
            sx={{
              mb: 3,
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {isEnglish ? 'Create a new account' : 'Creare cont nou'}
          </Typography>
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                width: '100%', 
                mb: 2,
                borderRadius: 1,
              }}
            >
              {error}
            </Alert>
          )}

          <Box 
            component="form" 
            onSubmit={handleSubmit} 
            noValidate
            sx={{ mt: 1 }}
          >
          <TextField
            margin="normal"
            required
            fullWidth
            id="nume"
            label={isEnglish ? 'First name' : 'Nume'}
            name="nume"
            autoComplete="family-name"
            autoFocus
            value={formData.nume}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="prenume"
            label={isEnglish ? 'Last name' : 'Prenume'}
            name="prenume"
            autoComplete="given-name"
            value={formData.prenume}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email"
            name="email"
            autoComplete="email"
            placeholder="ceva@ceva.ceva"
            value={formData.email}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="parola"
            label={isEnglish ? 'Password' : 'Parola'}
            type={showParola ? 'text' : 'password'}
            id="parola"
            autoComplete="new-password"
            value={formData.parola}
            onChange={handleChange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showParola ? (isEnglish ? 'Hide password' : 'Ascunde parola') : (isEnglish ? 'Show password' : 'Afișează parola')}
                    onClick={() => setShowParola((prev) => !prev)}
                    edge="end"
                  >
                    {showParola ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirmParola"
            label={isEnglish ? 'Confirm password' : 'Confirmă parola'}
            type={showConfirmParola ? 'text' : 'password'}
            id="confirmParola"
            autoComplete="new-password"
            value={confirmParola}
            onChange={(e) => setConfirmParola(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showConfirmParola ? (isEnglish ? 'Hide password confirmation' : 'Ascunde confirmarea parolei') : (isEnglish ? 'Show password confirmation' : 'Afișează confirmarea parolei')}
                    onClick={() => setShowConfirmParola((prev) => !prev)}
                    edge="end"
                  >
                    {showConfirmParola ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="telefon"
            label={isEnglish ? 'Phone number' : 'Număr de telefon'}
            type="tel"
            id="telefon"
            autoComplete="tel"
            inputProps={{
              maxLength: 10,
              pattern: "[0-9]*"
            }}
            placeholder="0712345678"
            value={formData.telefon}
            onChange={handleChange}
            sx={{ mb: 3 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                {isEnglish ? 'I accept the ' : 'Accept '}
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/terms');
                  }}
                  sx={{
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  {isEnglish ? 'terms and conditions' : 'termenii și condițiile'}
                </Link>
              </Typography>
            }
            sx={{ mb: 2 }}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ 
              mt: 2,
              mb: 2,
              py: 1.5,
              fontSize: '1rem',
            }}
            disabled={loading}
          >
            {loading ? (isEnglish ? 'Loading...' : 'Se încarcă...') : (isEnglish ? 'Sign Up' : 'Creare cont')}
          </Button>
          
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate('/login')}
              sx={{
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              {isEnglish ? 'Already have an account? Login' : 'Ai deja cont? Autentifică-te'}
            </Link>
          </Box>
        </Box>
        </Paper>
      </Box>
    </Container>
    </Box>
  );
}
