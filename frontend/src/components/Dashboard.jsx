import { Box, Typography, Container, Grid, Paper, LinearProgress, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Table, TableHead, TableRow, TableCell, TableBody, Snackbar, Alert } from '@mui/material';
import { useEffect, useState } from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AppLayout from './layout/AppLayout';
import StatCard from './dashboard/StatCard';
import { api } from '../services/api';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const isDoctor = user?.role === 'doctor';
  const [meds, setMeds] = useState([]);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newMed, setNewMed] = useState({ denumire: '', descriere: '' });
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [pendingReqs, setPendingReqs] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(false);

  useEffect(() => {
    if (!isDoctor) {
      setLoadingMeds(true);
      api.get('/medicamente')
        .then(res => setMeds(res.data || []))
        .catch(() => {})
        .finally(() => setLoadingMeds(false));
    } else {
      // doctor: fetch pending applications
      setLoadingReqs(true);
      api.get('/medicamente/aplicari', { params: { status: 'pending' }})
        .then(res => setPendingReqs(res.data || []))
        .catch(() => {})
        .finally(() => setLoadingReqs(false));
    }
  }, [isDoctor]);

  const handleAddMed = async () => {
    if (!newMed.denumire.trim()) return;
    await api.post('/medicamente', newMed);
    setAddOpen(false);
    setNewMed({ denumire: '', descriere: '' });
  };

  const handleApply = async (medicamentId) => {
    if (!user?.id) return;
    try {
      await api.post('/medicamente/apply', { pacientId: user.id, medicamentId });
      setAppliedIds(prev => new Set([...prev, medicamentId]));
      setSnack({ open: true, message: 'Cererea a fost trimisă.', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: 'Nu s-a putut trimite cererea.', severity: 'error' });
    }
  };

  const updateRequestStatus = async (id, status) => {
    try {
      await api.post(`/medicamente/aplicari/${id}/status`, { status });
      setPendingReqs(prev => prev.filter(r => r.id !== id));
      setSnack({ open: true, message: `Cerere ${status}.`, severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: 'Actualizare eșuată.', severity: 'error' });
    }
  };

  const menuItems = [
    { icon: <DashboardIcon />, title: 'Tablou de bord', description: 'Vedere de ansamblu' },
    { icon: <PeopleIcon />, title: 'Pacienți', description: 'Gestionare pacienți' },
    { icon: <CalendarMonthIcon />, title: 'Programări', description: 'Calendar și programări' },
    { icon: <HealthAndSafetyIcon />, title: 'Analize', description: 'Rezultate și istoric' },
  ];

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
          Bun venit, {user?.nume}!
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<PeopleIcon />} label="Pacienți activi" value="1,248" trend="+4.2%" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<CalendarMonthIcon />} label="Programări azi" value="32" trend="+1.1%" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<HealthAndSafetyIcon />} label="Analize în curs" value="76" trend="-0.5%" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<DashboardIcon />} label="Satisfacție" value="92%" trend="+0.9%" />
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>Activitate săptămânală</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Vizite, programări și analize</Typography>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {[60, 72, 45, 80, 55, 68, 75].map((v, i) => (
                  <Box key={i}>
                    <Typography variant="caption" color="text.secondary">Ziua {i + 1}</Typography>
                    <LinearProgress variant="determinate" value={v} sx={{ height: 8, borderRadius: 6 }} />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Acțiuni rapide</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {menuItems.map((item, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
                    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'primary.light', color: 'primary.main', display: 'inline-flex' }}>{item.icon}</Box>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.description}</Typography>
                    </Box>
                  </Paper>
                ))}
                {isDoctor ? (
                  <Button variant="contained" onClick={() => setAddOpen(true)}>Adaugă medicament</Button>
                ) : null}
              </Box>
            </Paper>
          </Grid>

          {isDoctor && (
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Cereri în așteptare</Typography>
                {loadingReqs ? (
                  <LinearProgress />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Pacient</TableCell>
                        <TableCell>Medicament</TableCell>
                        <TableCell>Data</TableCell>
                        <TableCell align="right">Acțiuni</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingReqs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.pacient_nume} ({r.pacient_email})</TableCell>
                          <TableCell>{r.medicament_denumire}</TableCell>
                          <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Button size="small" sx={{ mr: 1 }} variant="outlined" color="success" onClick={() => updateRequestStatus(r.id, 'acceptat')}>Acceptă</Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => updateRequestStatus(r.id, 'respins')}>Respinge</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
          )}

          {!isDoctor && (
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Medicamente disponibile</Typography>
                {loadingMeds ? (
                  <LinearProgress />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Denumire</TableCell>
                        <TableCell>Descriere</TableCell>
                        <TableCell align="right">Acțiuni</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {meds.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.denumire}</TableCell>
                          <TableCell>{m.descriere}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleApply(m.id)}
                              disabled={appliedIds.has(m.id)}
                            >
                              {appliedIds.has(m.id) ? 'Aplicat' : 'Aplică'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>

        <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Adaugă medicament</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Denumire"
              value={newMed.denumire}
              onChange={(e) => setNewMed({ ...newMed, denumire: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Descriere"
              multiline
              minRows={3}
              value={newMed.descriere}
              onChange={(e) => setNewMed({ ...newMed, descriere: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Anulează</Button>
            <Button variant="contained" onClick={handleAddMed}>Salvează</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack({ ...snack, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Container>
    </AppLayout>
  );
}