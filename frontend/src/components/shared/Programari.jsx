import React, { useEffect, useState, useRef, useCallback } from "react";
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
import EventIcon from '@mui/icons-material/Event';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import FilterListIcon from '@mui/icons-material/FilterList';
import AppLayout from "../layout/AppLayout";
import { useLanguage } from '../../LanguageContext';

const API_URL = "/programari";

export default function Programari() {
  const { lang, locale } = useLanguage();
  const isEnglish = lang === 'en';
  const storedUser = sessionStorage.getItem("user");
  if (!storedUser) return null;
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
  const [filter, setFilter] = useState('toate');
  const [counts, setCounts] = useState({ toate: 0, viitoare: 0, trecute: 0, completate: 0 });
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef(null);


  const reload = useCallback(async (pageNum = 1, searchTerm = '') => {
  setLoading(true);
  try {
    const encodedSearch = encodeURIComponent(searchTerm.trim());
    const res = await api.get(`${API_URL}?page=${pageNum}&limit=10&filter=${filter}&search=${encodedSearch}`);
    setProgramari(res.data.data || []);
    setTotalPages(res.data.total_pages || 1);
    setCounts(res.data.counts || { toate: 0, viitoare: 0, trecute: 0, completate: 0 });
    setCurrentPage(pageNum);
  } catch (err) {
    console.error('Eroare la fetch programari:', err);
  } finally {
    setLoading(false);
  }
}, [filter]);


  // Search-ul este reincarcat separat prin debounce.
  useEffect(() => {
    reload(currentPage, searchInput);
  }, [currentPage, filter, reload]);


  const openCalendar = (programare) => {
    setSelectedProgramare(programare);
    setCalendarOpen(true);
    if (programare.data_programare) {
      const date = new Date(programare.data_programare);
      const formattedDate = date.toISOString().slice(0, 16);
      setSelectedDate(formattedDate);
    } else {
      setSelectedDate('');
    }
  };

  const submitProgramare = async () => {
    if (!selectedDate || !selectedProgramare) return;

    try {
      // Acelasi dialog acopera atat creare, cat si reprogramare.
      const isoDate = new Date(selectedDate).toISOString();
      
      if (selectedProgramare.id) {
        await api.put(`${API_URL}/${selectedProgramare.id}`, {
          data_programare: isoDate,
          resetStatus: selectedProgramare.status === 'completata'
        });
      } else {
        await api.post(API_URL, {
          pacient_id: selectedProgramare.pacient_id || selectedProgramare.id,
          data_programare: isoDate,
        });
      }

      setCalendarOpen(false);
      setSelectedProgramare(null);
      setSnackbar({
        open: true,
        message: selectedProgramare.id ? (isEnglish ? 'Appointment rescheduled successfully!' : 'Programare reprogramată cu succes!') : (isEnglish ? 'Appointment created successfully!' : 'Programare creată cu succes!'),
        severity: 'success'
      });
      reload();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || (isEnglish ? 'Error while saving the appointment' : "Eroare la salvarea programării"),
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
        message: isEnglish ? 'Appointment cancelled successfully!' : 'Programare anulată cu succes!',
        severity: 'success'
      });
      reload();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || (isEnglish ? 'Error while cancelling the appointment' : "Eroare la anularea programării"),
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
        message: programare.status === 'completata' ? (isEnglish ? 'Appointment reset to scheduled!' : 'Programare resetată la status programată!') : (isEnglish ? 'Appointment marked as completed!' : 'Programare marcată ca completată!'),
        severity: 'success'
      });
      reload();
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || (isEnglish ? 'Error while updating the appointment' : "Eroare la actualizarea programării"),
        severity: 'error'
      });
    }
  };

  const handleFilterChange = (e, newFilter) => {
    if (newFilter) {
      setFilter(newFilter);
      setCurrentPage(1);
    }
  };

  const handleSearchInputChange = (e) => {
    setSearchInput(e.target.value);
  };

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      reload(1, searchInput);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchInput, reload]);

  const getStatusChip = (dataOra, status) => {
    // Statusul vizual combina starea salvata cu data programarii.
    if (status === 'completata') {
      return <Chip size="small" label={isEnglish ? 'Completed' : 'Completată'} color="info" />;
    }
    
    if (!dataOra) return <Chip size="small" label={isEnglish ? 'Not scheduled' : 'Neprogramat'} color="default" />;
    
    const programareDate = new Date(dataOra);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const programareDay = new Date(programareDate.getFullYear(), programareDate.getMonth(), programareDate.getDate());
    
    if (programareDay.getTime() === today.getTime()) {
      return <Chip size="small" label={isEnglish ? 'Today' : 'Astăzi'} color="warning" />;
    } else if (programareDate > now) {
      return <Chip size="small" label={isEnglish ? 'Scheduled' : 'Programată'} color="success" />;
    } else {
      return <Chip size="small" label={isEnglish ? 'Past' : 'Trecută'} color="error" />;
    }
  };

 if (!user) return null;

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EventIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {isEnglish ? 'My appointments' : 'Programările mele'}
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder={user.role === 'doctor' ? (isEnglish ? 'Search by patient, email, or date...' : 'Caută după pacient, email sau dată...') : (isEnglish ? 'Search by doctor, email, or date...' : 'Caută după doctor, email sau dată...')}
            value={searchInput}
            onChange={handleSearchInputChange}
            sx={{ width: { xs: '100%', md: 420 } }}
          />

          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={handleFilterChange}
            size="small"
          >
            <ToggleButton value="toate">
              <FilterListIcon sx={{ mr: 0.5 }} fontSize="small" />
              {isEnglish ? 'All' : 'Toate'}
              <Chip label={counts.toate} size="small" sx={{ ml: 1 }} />
            </ToggleButton>
            <ToggleButton value="viitoare">
              {isEnglish ? 'Upcoming' : 'Viitoare'}
              <Chip label={counts.viitoare} size="small" color="success" sx={{ ml: 1 }} />
            </ToggleButton>
            <ToggleButton value="trecute">
              {isEnglish ? 'Past' : 'Trecute'}
              <Chip label={counts.trecute} size="small" color="error" sx={{ ml: 1 }} />
            </ToggleButton>
            <ToggleButton value="completate">
              {isEnglish ? 'Completed' : 'Completate'}
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
              <TableCell>{isEnglish ? 'Patient' : 'Pacient'}</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>{isEnglish ? 'Date and time' : 'Data și ora'}</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">{isEnglish ? 'Actions' : 'Acțiuni'}</TableCell>
            </>
          ) : (
            <>
              <TableCell>{isEnglish ? 'Doctor' : 'Doctor'}</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>{isEnglish ? 'Date and time' : 'Data și ora'}</TableCell>
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
                    {p.data_programare ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EventIcon fontSize="small" color="action" />
                        {new Date(p.data_programare).toLocaleString(locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">{isEnglish ? 'Not scheduled' : 'Neprogramat'}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{getStatusChip(p.data_programare, p.status)}</TableCell>
                  <TableCell align="right">
                    {p.data_programare && (
                      <Tooltip title={p.data_programare ? (isEnglish ? 'Reschedule' : 'Reprogramează') : (isEnglish ? 'Schedule' : 'Programează')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openCalendar(p)}
                        >
                          <EditCalendarIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {p.data_programare && p.status !== 'completata' && (
                      <Tooltip title={isEnglish ? 'Mark as completed' : 'Marchează ca completată'}>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleCompleteProgramare(p)}
                        >
                          <EventIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {p.data_programare && p.status !== 'completata' && (
                      <Tooltip title={isEnglish ? 'Cancel appointment' : 'Anulează programarea'}>
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
                    {p.data_programare ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EventIcon fontSize="small" color="action" />
                        {new Date(p.data_programare).toLocaleString(locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">{isEnglish ? 'Pending' : 'În așteptare'}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{getStatusChip(p.data_programare, p.status)}</TableCell>
                </>
              )}
            </TableRow>
          ))
        ) : (
          !loading && (
            <TableRow>
              <TableCell colSpan={user.role === "doctor" ? 5 : 4} align="center" sx={{ py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {filter === 'viitoare' ? (isEnglish ? 'No upcoming appointments.' : 'Nu există programări viitoare.') :
                   filter === 'trecute' ? (isEnglish ? 'No past appointments.' : 'Nu există programări trecute.') :
                   filter === 'completate' ? (isEnglish ? 'No completed appointments.' : 'Nu există programări completate.') :
                   (isEnglish ? 'No appointments available.' : 'Nu există programări disponibile.')}
                </Typography>
              </TableCell>
            </TableRow>
          )
        )}
      </TableBody>
    </Table>
  </Paper>
)}
        {!loading && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
            <Button 
              variant="outlined"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              {isEnglish ? 'Previous' : 'Anterior'}
            </Button>

            <Typography>
              {isEnglish ? 'Page' : 'Pagina'} {currentPage} / {totalPages}
            </Typography>

            <Button 
              variant="outlined"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              {isEnglish ? 'Next' : 'Următor'}
            </Button>
          </Box>
        )}

        {user.role === "doctor" && (
          <Dialog open={calendarOpen} onClose={() => setCalendarOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {selectedProgramare?.data_programare ? (isEnglish ? 'Reschedule consultation' : 'Reprogramează consultație') : (isEnglish ? 'Schedule consultation' : 'Programează consultație')}
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {isEnglish ? 'Patient:' : 'Pacient:'} <strong>{selectedProgramare?.pacient_nume}</strong>
              </Typography>
              <TextField
                type="datetime-local"
                label={isEnglish ? 'Select date and time' : 'Selectează data și ora'}
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
              <Button onClick={() => setCalendarOpen(false)}>{isEnglish ? 'Cancel' : 'Anulează'}</Button>
              <Button 
                onClick={submitProgramare} 
                variant="contained"
                disabled={!selectedDate}
              >
                {selectedProgramare?.data_programare ? (isEnglish ? 'Reschedule' : 'Reprogramează') : (isEnglish ? 'Schedule' : 'Programează')}
              </Button>
            </DialogActions>
          </Dialog>
        )}

        <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
          <DialogTitle>{isEnglish ? 'Confirm cancellation' : 'Confirmă anularea'}</DialogTitle>
          <DialogContent>
            <Typography>
              {isEnglish ? 'Are you sure you want to cancel the appointment with' : 'Sigur vrei să anulezi programarea cu'} <strong>{programareToDelete?.pacient_nume}</strong>?
            </Typography>
            {programareToDelete?.data_programare && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {isEnglish ? 'Date:' : 'Data:'} {new Date(programareToDelete.data_programare).toLocaleString(locale)}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDeleteOpen(false)}>{isEnglish ? 'Dismiss' : 'Renunță'}</Button>
            <Button onClick={handleDeleteProgramare} variant="contained" color="error">
              {isEnglish ? 'Cancel appointment' : 'Anulează programarea'}
            </Button>
          </DialogActions>
        </Dialog>

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
