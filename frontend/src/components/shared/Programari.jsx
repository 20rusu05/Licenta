import React, { useEffect, useState } from "react";
import { api } from '../../services/api';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Box,
  Chip,
  IconButton,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";
// Comentat pentru a evita eroarea de hook
// import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers";
// import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import EventIcon from '@mui/icons-material/Event';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import FilterListIcon from '@mui/icons-material/FilterList';
import AppLayout from "../layout/AppLayout";

const API_URL = "/programari";

export default function Programari() {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return null; // blocăm render-ul dacă nu există user
  const user = JSON.parse(storedUser);


  const [programari, setProgramari] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedProgramare, setSelectedProgramare] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [programareToDelete, setProgramareToDelete] = useState(null);
  const [filter, setFilter] = useState('toate'); // toate, viitoare, trecute, completate
  const [counts, setCounts] = useState({ toate: 0, viitoare: 0, trecute: 0, completate: 0 });


  const reload = async () => {
  setLoading(true);
  try {
    const res = await api.get(`${API_URL}?page=${currentPage}&limit=10&filter=${filter}`);
    console.log('Programari response:', res.data);
    setProgramari(res.data.data || []);
    setTotalPages(res.data.total_pages || 1);
    setCounts(res.data.counts || { toate: 0, viitoare: 0, trecute: 0, completate: 0 });
  } catch (err) {
    console.error('Eroare la fetch programari:', err);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
  reload();
}, [currentPage, filter]);


  const openCalendar = (programare) => {
    setSelectedProgramare(programare);
    setCalendarOpen(true);
    // Daca programarea are deja o data, o setam in calendar pentru reprogramare
    // Convertim la format datetime-local (YYYY-MM-DDTHH:mm)
    if (programare.data_ora) {
      const date = new Date(programare.data_ora);
      const formattedDate = date.toISOString().slice(0, 16);
      setSelectedDate(formattedDate);
    } else {
      setSelectedDate('');
    }
  };

  const submitProgramare = async () => {
    if (!selectedDate || !selectedProgramare) return;

    try {
      // Convertim data din datetime-local la ISO string
      const isoDate = new Date(selectedDate).toISOString();
      
      // Dacă programarea are deja un ID, folosim PUT pentru reprogramare
      // Altfel, folosim POST pentru programare nouă
      if (selectedProgramare.id) {
        await api.put(`${API_URL}/${selectedProgramare.id}`, {
          data_ora: isoDate,
          // Dacă programarea era completată, o resetăm automat la programată
          resetStatus: selectedProgramare.status === 'completata'
        });
      } else {
        await api.post(API_URL, {
          pacient_id: selectedProgramare.pacient_id || selectedProgramare.id,
          data_ora: isoDate,
        });
      }

      setCalendarOpen(false);
      setSelectedProgramare(null);
      setSnackbar({
        open: true,
        message: selectedProgramare.id ? 'Programare reprogramată cu succes!' : 'Programare creată cu succes!',
        severity: 'success'
      });
      reload();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || "Eroare la salvarea programării",
        severity: 'error'
      });
    }
  };

  const handleDeleteProgramare = async () => {
    if (!programareToDelete) return;

    try {
      await api.delete(`${API_URL}/${programareToDelete.id}`);
      setConfirmDeleteOpen(false);
      setProgramareToDelete(null);
      setSnackbar({
        open: true,
        message: 'Programare anulată cu succes!',
        severity: 'success'
      });
      reload();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || "Eroare la anularea programării",
        severity: 'error'
      });
    }
  };

  const openDeleteConfirm = (programare) => {
    setProgramareToDelete(programare);
    setConfirmDeleteOpen(true);
  };

  const handleCompleteProgramare = async (programare) => {
    try {
      await api.patch(`${API_URL}/${programare.id}/completeaza`);
      setSnackbar({
        open: true,
        message: programare.status === 'completata' ? 'Programare resetată la status programată!' : 'Programare marcată ca completată!',
        severity: 'success'
      });
      reload();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || "Eroare la actualizarea programării",
        severity: 'error'
      });
    }
  };

  const handleFilterChange = (e, newFilter) => {
    if (newFilter) {
      setFilter(newFilter);
      setCurrentPage(1); // Reset la prima pagină când schimbăm filtrul
    }
  };

  const getStatusChip = (dataOra, status) => {
    // Daca programarea e completata
    if (status === 'completata') {
      return <Chip size="small" label="Completată" color="info" />;
    }
    
    if (!dataOra) return <Chip size="small" label="Neprogramat" color="default" />;
    
    const programareDate = new Date(dataOra);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const programareDay = new Date(programareDate.getFullYear(), programareDate.getMonth(), programareDate.getDate());
    
    if (programareDay.getTime() === today.getTime()) {
      return <Chip size="small" label="Astăzi" color="warning" />;
    } else if (programareDate > now) {
      return <Chip size="small" label="Programată" color="success" />;
    } else {
      return <Chip size="small" label="Trecută" color="error" />;
    }
  };

 if (!user) return null;

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EventIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Programările mele
            </Typography>
          </Box>
          
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={handleFilterChange}
            size="small"
          >
            <ToggleButton value="toate">
              <FilterListIcon sx={{ mr: 0.5 }} fontSize="small" />
              Toate
              <Chip label={counts.toate} size="small" sx={{ ml: 1 }} />
            </ToggleButton>
            <ToggleButton value="viitoare">
              Viitoare
              <Chip label={counts.viitoare} size="small" color="success" sx={{ ml: 1 }} />
            </ToggleButton>
            <ToggleButton value="trecute">
              Trecute
              <Chip label={counts.trecute} size="small" color="error" sx={{ ml: 1 }} />
            </ToggleButton>
            <ToggleButton value="completate">
              Completate
              <Chip label={counts.completate} size="small" color="info" sx={{ ml: 1 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
       {loading ? (
  <LinearProgress sx={{ mb: 2 }} />
) : (
  <Paper variant="outlined">
    <Table>
      <TableHead>
        <TableRow>
          {user.role === "doctor" ? (
            <>
              <TableCell>Pacient</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Data și ora</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Acțiuni</TableCell>
            </>
          ) : (
            <>
              <TableCell>Doctor</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Data și ora</TableCell>
              <TableCell>Status</TableCell>
            </>
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        {!loading && programari.length > 0 ? (
          programari.map((p) => (
            <TableRow key={p.id} hover>
              {user.role === "doctor" ? (
                <>
                  <TableCell sx={{ fontWeight: 500 }}>{p.pacient_nume}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{p.pacient_email}</TableCell>
                  <TableCell>
                    {p.data_ora ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EventIcon fontSize="small" color="action" />
                        {new Date(p.data_ora).toLocaleString('ro-RO', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Neprogramat</Typography>
                    )}
                  </TableCell>
                  <TableCell>{getStatusChip(p.data_ora, p.status)}</TableCell>
                  <TableCell align="right">
                    {p.data_ora && (
                      <Tooltip title={p.data_ora ? "Reprogramează" : "Programează"}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openCalendar(p)}
                        >
                          <EditCalendarIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {p.data_ora && p.status !== 'completata' && (
                      <Tooltip title="Marchează ca completată">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleCompleteProgramare(p)}
                        >
                          <EventIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {p.data_ora && p.status !== 'completata' && (
                      <Tooltip title="Anulează programarea">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => openDeleteConfirm(p)}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell sx={{ fontWeight: 500 }}>{p.medic_nume}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{p.medic_email}</TableCell>
                  <TableCell>
                    {p.data_ora ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EventIcon fontSize="small" color="action" />
                        {new Date(p.data_ora).toLocaleString('ro-RO', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">În așteptare</Typography>
                    )}
                  </TableCell>
                  <TableCell>{getStatusChip(p.data_ora, p.status)}</TableCell>
                </>
              )}
            </TableRow>
          ))
        ) : (
          !loading && (
            <TableRow>
              <TableCell colSpan={user.role === "doctor" ? 5 : 4} align="center" sx={{ py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {filter === 'viitoare' ? 'Nu există programări viitoare.' :
                   filter === 'trecute' ? 'Nu există programări trecute.' :
                   filter === 'completate' ? 'Nu există programări completate.' :
                   'Nu există programări disponibile.'}
                </Typography>
              </TableCell>
            </TableRow>
          )
        )}
      </TableBody>
    </Table>
  </Paper>
)}
        {/* Paginare */}
        {!loading && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
            <Button 
              variant="outlined"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Anterior
            </Button>

            <Typography>
              Pagina {currentPage} / {totalPages}
            </Typography>

            <Button 
              variant="outlined"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Următor
            </Button>
          </Box>
        )}

        {/* Calendar pentru doctor */}
        {user.role === "doctor" && (
          <Dialog open={calendarOpen} onClose={() => setCalendarOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {selectedProgramare?.data_ora ? 'Reprogramează consultație' : 'Programează consultație'}
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Pacient: <strong>{selectedProgramare?.pacient_nume}</strong>
              </Typography>
              <TextField
                type="datetime-local"
                label="Selectează data și ora"
                fullWidth
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  min: new Date().toISOString().slice(0, 16)
                }}
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCalendarOpen(false)}>Anulează</Button>
              <Button 
                onClick={submitProgramare} 
                variant="contained"
                disabled={!selectedDate}
              >
                {selectedProgramare?.data_ora ? 'Reprogramează' : 'Programează'}
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {/* Dialog confirmare anulare */}
        <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
          <DialogTitle>Confirmă anularea</DialogTitle>
          <DialogContent>
            <Typography>
              Sigur vrei să anulezi programarea cu <strong>{programareToDelete?.pacient_nume}</strong>?
            </Typography>
            {programareToDelete?.data_ora && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Data: {new Date(programareToDelete.data_ora).toLocaleString('ro-RO')}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDeleteOpen(false)}>Renunță</Button>
            <Button onClick={handleDeleteProgramare} variant="contained" color="error">
              Anulează programarea
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar pentru notificări */}
        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={4000} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </AppLayout>
  );
}