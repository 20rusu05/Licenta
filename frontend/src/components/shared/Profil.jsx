import { useState, useEffect, useRef } from 'react';
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
  Alert,
  Chip,
  Stack,
  useTheme,
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
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import { api, getBackendAssetUrl } from '../../services/api';

export default function Profil() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    nume: '',
    prenume: '',
    telefon: '',
    email: '',
  });

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setFormData({
        nume: userData.nume || '',
        prenume: userData.prenume || '',
        telefon: userData.telefon || '',
        email: userData.email || '',
      });
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
      nume: user?.nume || '',
      prenume: user?.prenume || '',
      telefon: user?.telefon || '',
      email: user?.email || '',
    });
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.put(`/pacienti/${user.id}`, formData);

      const updatedUser = { ...user, ...formData };
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
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

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      setError('Fișierul selectat trebuie să fie o imagine.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Imaginea este prea mare. Dimensiunea maximă este 5MB.');
      return;
    }

    const payload = new FormData();
    payload.append('avatar', file);

    setUploadingAvatar(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post(`/pacienti/${user.id}/avatar`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedUser = { ...user, avatar_url: response.data.avatar_url };
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      window.dispatchEvent(new Event('auth-changed'));

      setSuccess('Poza de profil a fost actualizată cu succes!');
    } catch (err) {
      console.error('Eroare la upload avatar:', err);
      setError(err.response?.data?.error || 'Eroare la încărcarea pozei de profil');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Typography>Se încarcă...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 2, md: 4 },
        background: isDark
          ? 'radial-gradient(1200px 500px at 0% -10%, rgba(37,99,235,0.15), transparent 55%), radial-gradient(900px 500px at 100% 110%, rgba(14,116,144,0.16), transparent 45%), #050c1d'
          : 'radial-gradient(900px 450px at 0% -10%, rgba(33,150,243,0.12), transparent 55%), radial-gradient(900px 500px at 100% 120%, rgba(38,166,154,0.12), transparent 45%), #f3f7ff',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ mb: 1, fontWeight: 700 }}
          >
            Înapoi la Dashboard
          </Button>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            position: 'relative',
            background: isDark
              ? 'linear-gradient(150deg, rgba(17,24,39,0.95) 0%, rgba(15,23,42,0.96) 100%)'
              : 'linear-gradient(150deg, rgba(255,255,255,0.98) 0%, rgba(247,251,255,0.98) 100%)',
            boxShadow: isDark
              ? '0 20px 50px rgba(2,6,23,0.45)'
              : '0 20px 40px rgba(15,23,42,0.10)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -70,
              right: -40,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: isDark ? 'rgba(33,150,243,0.16)' : 'rgba(33,150,243,0.12)',
              filter: 'blur(2px)',
            }}
          />

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              mb: 3,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' } }}>
                Profilul Meu
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Gestionarea informațiilor personale și a contului
              </Typography>
            </Box>

            {!editMode ? (
              <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEdit} sx={{ fontWeight: 700 }}>
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
                  sx={{ fontWeight: 700 }}
                >
                  Salvează
                </Button>
              </Box>
            )}
          </Box>

          {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, position: 'relative', zIndex: 1 }}>
            <Avatar
              src={getBackendAssetUrl(user.avatar_url)}
              sx={{
                width: 120,
                height: 120,
                fontSize: '3rem',
                bgcolor: 'primary.main',
                border: '5px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.9)',
                boxShadow: isDark ? '0 10px 30px rgba(33,150,243,0.35)' : '0 10px 25px rgba(33,150,243,0.25)',
                mb: 2,
              }}
            >
              {getInitials()}
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={<AddAPhotoIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              sx={{ mb: 1.5 }}
            >
              {uploadingAvatar ? 'Se încarcă...' : 'Schimbă poza'}
            </Button>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {user.nume} {user.prenume}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={getRoleLabel()} color="primary" variant="outlined" />
              <Chip label={user.email} variant="outlined" />
            </Stack>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <BadgeIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">Nume</Typography>
                </Box>
                {editMode ? (
                  <TextField fullWidth size="small" name="nume" value={formData.nume} onChange={handleChange} />
                ) : (
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{user.nume}</Typography>
                )}
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">Prenume</Typography>
                </Box>
                {editMode ? (
                  <TextField fullWidth size="small" name="prenume" value={formData.prenume} onChange={handleChange} />
                ) : (
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{user.prenume}</Typography>
                )}
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{user.email}</Typography>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <PhoneIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">Telefon</Typography>
                </Box>
                {editMode ? (
                  <TextField
                    fullWidth
                    size="small"
                    name="telefon"
                    value={formData.telefon}
                    onChange={handleChange}
                    placeholder="Adaugă număr de telefon"
                  />
                ) : (
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {user.telefon || 'Nu este setat'}
                  </Typography>
                )}
              </Paper>
            </Grid>

            {user.role === 'doctor' && user.specializare && (
              <Grid size={12}>
                <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                    <BadgeIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="text.secondary">Specializare</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{user.specializare}</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}
