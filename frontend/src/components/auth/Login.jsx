import { useState } from 'react';
import { TextField, Button, Box, Typography, Container, Alert, Paper, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    parola: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // apel backend login
      const response = await api.post('/auth/login', formData);

      // salvăm user și token în localStorage
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('token', response.data.token);

      console.log('Token salvat:', response.data.token);
      console.log('User salvat:', response.data.user);

      // emitem eveniment storage pentru a notifica componentele
      window.dispatchEvent(new Event('storage'));

      // redirect către dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('Eroare la autentificare:', err);
      setError(err.response?.data?.error || 'Eroare la autentificare');
    } finally {
      setLoading(false);
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
        <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h4" sx={{ mb: 4, color: 'primary.main', fontWeight: 600 }}>
            NewMed
          </Typography>

          <Paper elevation={0} sx={{ p: 4, width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography component="h2" variant="h5" sx={{ mb: 3, textAlign: 'center', fontWeight: 500 }}>
              Autentificare
            </Typography>

            {error && <Alert severity="error" sx={{ width: '100%', mb: 2, borderRadius: 1 }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email"
                name="email"
                autoComplete="email"
                autoFocus
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
                autoComplete="current-password"
                value={formData.parola}
                onChange={handleChange}
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 2, mb: 2, py: 1.5, fontSize: '1rem' }}
                disabled={loading}
              >
                {loading ? 'Se încarcă...' : 'Autentificare'}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link component="button" type="button" variant="body2" onClick={() => navigate('/forgot-password')} sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  Ai uitat parola?
                </Link>
              </Box>
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link component="button" type="button" variant="body2" onClick={() => navigate('/register')} sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  Nu ai cont? Înregistrează-te
                </Link>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
