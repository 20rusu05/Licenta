import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Box, Typography, TextField, Button, Alert, Paper } from '@mui/material';
import { api } from '../../services/api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || !confirm.trim()) {
      setError('Completează ambele câmpuri pentru parolă.');
      return;
    }

    if (password !== confirm) {
      setError('Parolele nu coincid.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/reset-password', { token, newPassword: password });
      setMessage(res.data.message || 'Parola a fost resetată cu succes.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la resetarea parolei.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
      py: 4,
      background: (theme) => theme.palette.mode === 'dark'
        ? 'radial-gradient(1200px 600px at -10% -10%, rgba(33,150,243,0.15), transparent), radial-gradient(800px 500px at 110% 10%, rgba(38,166,154,0.12), transparent)'
        : 'radial-gradient(1200px 600px at -10% -10%, rgba(33,150,243,0.10), transparent), radial-gradient(800px 500px at 110% 10%, rgba(38,166,154,0.08), transparent)'
    }}>
    <Container component="main" maxWidth="xs" sx={{ m: 0 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <Typography component="h1" variant="h4" sx={{ mb: 3, color: 'primary.main', fontWeight: 600, textAlign: 'center' }}>
          Resetare parola
        </Typography>

        <Paper elevation={0} sx={{ p: 4, width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 20px 50px rgba(2,6,23,0.35)' : '0 20px 40px rgba(15,23,42,0.10)' }}>
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Parola nouă"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Confirmă parola"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            <Button type="submit" fullWidth variant="contained" sx={{ mt: 3 }} disabled={loading}>
              {loading ? 'Se resetează...' : 'Resetează parola'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
    </Box>
  );
}
