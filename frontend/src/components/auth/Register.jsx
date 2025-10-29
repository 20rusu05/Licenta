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
    try {
      await api.post('/auth/register', formData);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la înregistrare');
    }
  };

  return (
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
            label="Nume complet"
            name="nume"
            autoComplete="name"
            autoFocus
            value={formData.nume}
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
  );
}