import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MedicationIcon from '@mui/icons-material/Medication';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AppLayout from '../layout/AppLayout';
import { api } from '../../services/api';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState({ doctori: [], pacienti: [] });
  const [statistics, setStatistics] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null, role: null });
  const [detailsDialog, setDetailsDialog] = useState({ open: false, user: null, data: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchStatistics();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la încărcarea utilizatorilor');
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/admin/statistics');
      setStatistics(response.data);
    } catch (err) {
      console.error('Eroare la încărcarea statisticilor:', err);
    }
  };

  const handleDeleteClick = (user, role) => {
    setDeleteDialog({ open: true, user, role });
  };

  const handleDeleteConfirm = async () => {
    const { user, role } = deleteDialog;
    setLoading(true);
    setError('');

    try {
      await api.delete(`/admin/users/${role}/${user.id}`);
      setSuccess(`${role === 'doctor' ? 'Doctor' : 'Pacient'} șters cu succes!`);
      setDeleteDialog({ open: false, user: null, role: null });
      fetchUsers();
      fetchStatistics();
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la ștergerea utilizatorului');
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsClick = async (user, role) => {
    try {
      const response = await api.get(`/admin/users/${role}/${user.id}`);
      setDetailsDialog({ open: true, user: response.data.user, data: response.data.relatedData });
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la încărcarea detaliilor');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const normalizeText = (value) => {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const filterUsers = (items) => {
    const normalizedQuery = normalizeText(searchQuery).trim();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((user) => {
      const searchableText = [user.id, user.nume, user.prenume, user.email, user.telefon]
        .map(normalizeText)
        .join(' ');

      return searchableText.includes(normalizedQuery);
    });
  };

  const filteredDoctors = filterUsers(users.doctori);
  const filteredPatients = filterUsers(users.pacienti);

  const StatCard = ({ title, value, icon, color }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 600, color }}>
              {value}
            </Typography>
          </Box>
          <Box sx={{ 
            bgcolor: `${color}15`, 
            p: 1.5, 
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const UsersTable = ({ users, role }) => (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Nume</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Prenume</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Telefon</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Data creării</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Acțiuni</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">
                  {searchQuery.trim()
                    ? 'Nu s-au găsit rezultate pentru căutarea introdusă'
                    : `Nu există ${role === 'doctor' ? 'doctori' : 'pacienți'} înregistrați`}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.nume}</TableCell>
                <TableCell>{user.prenume}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.telefon}</TableCell>
                <TableCell>{formatDate(user.created_at)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Detalii">
                    <IconButton 
                      size="small" 
                      color="info"
                      onClick={() => handleDetailsClick(user, role)}
                      sx={{ mr: 1 }}
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Șterge">
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => handleDeleteClick(user, role)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <AppLayout>
      <Box>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
          Panou Administrare
        </Typography>

        <Paper sx={{ p: 2, mb: 3 }}>
          <TextField
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută după nume, prenume, email, telefon sau ID"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    aria-label="șterge căutarea"
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {statistics && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard 
                title="Total Doctori" 
                value={statistics.doctori} 
                icon={<LocalHospitalIcon sx={{ fontSize: 40, color: 'primary.main' }} />}
                color="primary.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard 
                title="Total Pacienți" 
                value={statistics.pacienti} 
                icon={<PeopleIcon sx={{ fontSize: 40, color: 'success.main' }} />}
                color="success.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard 
                title="Total Programări" 
                value={statistics.programari} 
                icon={<CalendarMonthIcon sx={{ fontSize: 40, color: 'info.main' }} />}
                color="info.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard 
                title="Total Medicamente" 
                value={statistics.medicamente} 
                icon={<MedicationIcon sx={{ fontSize: 40, color: 'warning.main' }} />}
                color="warning.main"
              />
            </Grid>
          </Grid>
        )}

        <Paper sx={{ width: '100%' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label={`Doctori (${filteredDoctors.length}/${users.doctori.length})`} />
            <Tab label={`Pacienți (${filteredPatients.length}/${users.pacienti.length})`} />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {activeTab === 0 && <UsersTable users={filteredDoctors} role="doctor" />}
            {activeTab === 1 && <UsersTable users={filteredPatients} role="pacient" />}
          </Box>
        </Paper>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, user: null, role: null })}
        >
          <DialogTitle>Confirmă Ștergerea</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Ești sigur că vrei să ștergi {deleteDialog.role === 'doctor' ? 'doctorul' : 'pacientul'}{' '}
              <strong>{deleteDialog.user?.nume} {deleteDialog.user?.prenume}</strong>?
              <br /><br />
              <Typography color="error" variant="body2">
                Atenție: Aceasta va șterge permanent:
              </Typography>
              <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
                {deleteDialog.role === 'doctor' ? (
                  <>
                    <li>Toate medicamentele create de doctor</li>
                    <li>Toate aplicările de medicamente asociate</li>
                    <li>Toate programările cu acest doctor</li>
                  </>
                ) : (
                  <>
                    <li>Toate aplicările de medicamente ale pacientului</li>
                    <li>Toate programările pacientului</li>
                  </>
                )}
              </Typography>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setDeleteDialog({ open: false, user: null, role: null })}
              disabled={loading}
            >
              Anulează
            </Button>
            <Button 
              onClick={handleDeleteConfirm} 
              color="error" 
              variant="contained"
              disabled={loading}
            >
              {loading ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Details Dialog */}
        <Dialog
          open={detailsDialog.open}
          onClose={() => setDetailsDialog({ open: false, user: null, data: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Detalii Utilizator
          </DialogTitle>
          <DialogContent>
            {detailsDialog.user && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Informații Personale
                </Typography>
                <Box sx={{ mt: 1, mb: 3 }}>
                  <Typography><strong>Nume:</strong> {detailsDialog.user.nume} {detailsDialog.user.prenume}</Typography>
                  <Typography><strong>Email:</strong> {detailsDialog.user.email}</Typography>
                  <Typography><strong>Telefon:</strong> {detailsDialog.user.telefon}</Typography>
                  <Typography><strong>Rol:</strong> <Chip label={detailsDialog.user.role} size="small" color="primary" /></Typography>
                  <Typography><strong>Data creării:</strong> {formatDate(detailsDialog.user.created_at)}</Typography>
                </Box>

                <Typography variant="subtitle2" color="text.secondary">
                  Date Asociate
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {detailsDialog.user.role === 'doctor' ? (
                    <>
                      <Typography><strong>Medicamente create:</strong> {detailsDialog.data?.medicamente || 0}</Typography>
                      <Typography><strong>Programări:</strong> {detailsDialog.data?.programari || 0}</Typography>
                    </>
                  ) : (
                    <>
                      <Typography><strong>Aplicări medicamente:</strong> {detailsDialog.data?.aplicari_medicamente || 0}</Typography>
                      <Typography><strong>Programări:</strong> {detailsDialog.data?.programari || 0}</Typography>
                    </>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsDialog({ open: false, user: null, data: null })}>
              Închide
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}
