import { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Paper, 
  Typography, 
  Avatar, 
  Grid, 
  TextField,
  Button,
  Divider,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BadgeIcon from '@mui/icons-material/Badge';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { api } from '../../services/api';

export default function Profil() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nume: '',
    prenume: '',
    telefon: '',
    email: ''
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setFormData({
        nume: userData.nume || '',
        prenume: userData.prenume || '',
        telefon: userData.telefon || '',
        email: userData.email || ''
      });
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = () => {
    setEditMode(true);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setEditMode(false);
    setFormData({
      nume: user.nume || '',
      prenume: user.prenume || '',
      telefon: user.telefon || '',
      email: user.email || ''
    });
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.put(`/pacienti/${user.id}`, formData);

      // Actualizăm user-ul în localStorage
      const updatedUser = { ...user, ...formData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      setEditMode(false);
      setSuccess('Profilul a fost actualizat cu succes!');
    } catch (err) {
      console.error('Eroare la actualizare profil:', err);
      setError(err.response?.data?.error || 'Eroare la actualizarea profilului');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (!user) return '';
    return `${user.nume?.charAt(0) || ''}${user.prenume?.charAt(0) || ''}`.toUpperCase();
  };

  const getRoleLabel = () => {
    if (!user) return '';
    return user.role === 'doctor' ? 'Doctor' : 'Pacient';
  };

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Se încarcă...</Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ mb: 2 }}
          >
            Înapoi la Dashboard
          </Button>
        </Box>

        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Profilul Meu
            </Typography>
            {!editMode ? (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEdit}
              >
                Editează
              </Button>
            ) : (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Anulează
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={loading}
                >
                  Salvează
                </Button>
              </Box>
            )}
          </Box>

          {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {/* Avatar Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                fontSize: '3rem',
                bgcolor: 'primary.main',
                mb: 2
              }}
            >
              {getInitials()}
            </Avatar>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {user.nume} {user.prenume}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {getRoleLabel()}
            </Typography>
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* Informații profil */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BadgeIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Nume
                </Typography>
              </Box>
              {editMode ? (
                <TextField
                  fullWidth
                  name="nume"
                  value={formData.nume}
                  onChange={handleChange}
                  variant="outlined"
                />
              ) : (
                <Typography variant="body1" sx={{ pl: 4 }}>
                  {user.nume}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Prenume
                </Typography>
              </Box>
              {editMode ? (
                <TextField
                  fullWidth
                  name="prenume"
                  value={formData.prenume}
                  onChange={handleChange}
                  variant="outlined"
                />
              ) : (
                <Typography variant="body1" sx={{ pl: 4 }}>
                  {user.prenume}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Email
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ pl: 4 }}>
                {user.email}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PhoneIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Telefon
                </Typography>
              </Box>
              {editMode ? (
                <TextField
                  fullWidth
                  name="telefon"
                  value={formData.telefon}
                  onChange={handleChange}
                  variant="outlined"
                  placeholder="Adaugă număr de telefon"
                />
              ) : (
                <Typography variant="body1" sx={{ pl: 4 }}>
                  {user.telefon || 'Nu este setat'}
                </Typography>
              )}
            </Grid>

            {user.role === 'doctor' && user.specializare && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BadgeIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Specializare
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ pl: 4 }}>
                  {user.specializare}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}
