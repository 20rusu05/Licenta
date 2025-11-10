import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Paper, Table, Fade, TableHead, TableRow, TableCell, TableBody, LinearProgress, IconButton, Collapse, Box, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AddIcon from '@mui/icons-material/Add';
import AppLayout from '../layout/AppLayout';
import { api } from '../../services/api';

function StatusChip({ status }) {
  const color = status === 'acceptat' ? 'success' : status === 'respins' ? 'error' : 'warning';
  return <Chip size="small" color={color} label={status} />;
}

export default function Medicamente() {
  const [loading, setLoading] = useState(true);
  const [medicamente, setMedicamente] = useState([]);
  const [aplicari, setAplicari] = useState([]);
  const [openRows, setOpenRows] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [newMed, setNewMed] = useState({ denumire: '', descriere: '' });
  const [error, setError] = useState('');

  // Citim userul și rolul din localStorage
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const isDoctor = user?.role === 'doctor';

  const reload = async () => {
    setLoading(true);
    try {
      const [mRes, aRes] = await Promise.all([
        api.get('/medicamente'),
        api.get('/medicamente/aplicari'),
      ]);
      setMedicamente(mRes.data || []);
      setAplicari(aRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const aplicariByMed = useMemo(() => {
    const map = {};
    for (const a of aplicari) {
      if (!map[a.medicament_id]) map[a.medicament_id] = [];
      map[a.medicament_id].push(a);
    }
    return map;
  }, [aplicari]);

  const toggleRow = (id) => setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));

  const updateStatus = async (id, status) => {
    try {
      await api.post(`/medicamente/aplicari/${id}/status`, { status });
      await reload();
    } catch (e) {
      console.error('Eroare la update status:', e);
    }
  };

  return (
  <AppLayout>
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Medicamente disponibile
        </Typography>
        {isDoctor && (
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            Adaugă medicament
          </Button>
        )}
      </Box>
      {loading ? (
        <LinearProgress />
      ) : (
        <Paper variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Denumire</TableCell>
                <TableCell>Descriere</TableCell>
                <TableCell align="right">Aplicanți</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {medicamente.map((m) => {
                const list = aplicariByMed[m.id] || [];
                return (
                  <React.Fragment key={m.id}>
                    <TableRow>
                      <TableCell width={56}>
                        <IconButton size="small" onClick={() => toggleRow(m.id)}>
                          {openRows[m.id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>{m.denumire}</TableCell>
                      <TableCell>{m.descriere}</TableCell>
                      <TableCell align="right">{list.length}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
                        <Collapse in={!!openRows[m.id]} timeout="auto" unmountOnExit>
  <Box sx={{ m: 2 }}>
    {isDoctor ? (
      <>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Aplicanți</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Pacient</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Acțiuni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.pacient_nume}</TableCell>
                <TableCell>{a.pacient_email}</TableCell>
                <TableCell><StatusChip status={a.status} /></TableCell>
                <TableCell align="right">
                  <Button size="small" sx={{ mr: 1 }} variant="outlined" color="success" onClick={() => updateStatus(a.id, 'acceptat')}>Acceptă</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => updateStatus(a.id, 'respins')}>Respinge</Button>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>Nu există aplicanți.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </>
    ) : (
      <Button
        variant="contained"
        onClick={async () => {
          try {
            await api.post(`/medicamente/${m.id}/aplica`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
            alert("Cerere trimisă!");
            await reload();
          } catch (e) {
            console.error('Eroare la aplicare:', e);
            alert(e.response?.data?.error || 'Eroare la trimiterea cererii');
          }
        }}
      >
        Aplică
      </Button>
    )}
  </Box>
</Collapse>

                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm" TransitionComponent={Fade} transitionDuration={500}>
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
          {error && <Typography color="error" variant="body2" sx={{ mt: 2 }}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Anulează</Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              setError('');
              if (!newMed.denumire.trim()) {
                setError('Introduceți denumirea medicamentului');
                return;
              }
              try {
                await api.post('/medicamente', { 
                  denumire: newMed.denumire.trim(),
                  descriere: newMed.descriere.trim()
                }, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                setAddOpen(false);
                setNewMed({ denumire: '', descriere: '' });
                await reload();
              } catch (e) {
                console.error('Eroare la adăugare:', e);
                setError(e.response?.data?.error || 'Eroare la adăugarea medicamentului');
              }
            }}
          >
            Salvează
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  </AppLayout>
);
}