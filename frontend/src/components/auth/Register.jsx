import { useState } from 'react';
import { TextField, Button, Box, Typography, Container, Alert, Paper, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nume: '',
    prenume: '',
    email: '',
    parola: '',
    telefon: ''
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
  const phoneRegex = /^(07\d{8}|02\d{8}|03\d{8})$/;

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
    if (!emailRegex.test(formData.email)) {
      setError("Adresa de email nu este validă. (ceva@ceva.ceva)");
      return;
    }

    if (!passwordRegex.test(formData.parola)) {
      setError("Parola trebuie să conțină minim 8 caractere, o literă mare și un caracter special.");
      return;
    }

    if (!phoneRegex.test(formData.telefon)) {
      setError("Numărul de telefon trebuie să înceapă cu 07, 02 sau 03 și să aibă exact 10 cifre.");
      return;
    }

    try {
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
          marginTop: 8,
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
          }}
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
            Creare cont nou
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
            sx={{ mt: 1 }}
          >
          <TextField
            margin="normal"
            required
            fullWidth
            id="nume"
            label="Nume"
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
            label="Prenume"
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
            label="Parola"
            type="password"
            id="parola"
            autoComplete="new-password"
            value={formData.parola}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="telefon"
            label="Număr de telefon"
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
            {loading ? 'Se încarcă...' : 'Creare cont'}
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
              Ai deja cont? Autentifică-te
            </Link>
          </Box>
        </Box>
        </Paper>
      </Box>
    </Container>
    </Box>
  );
}