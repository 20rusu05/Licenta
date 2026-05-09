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
  LinearProgress,
  IconButton,
  Collapse,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  Tooltip
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import AppLayout from "../layout/AppLayout";
import { useLanguage } from '../../LanguageContext';

const API_URL = "/medicamente";

function StatusChip({ status, isEnglish }) {
  if (!status) return <Chip size="small" label="-" color="default" />;
  let label = status.charAt(0).toUpperCase() + status.slice(1);
  if (status === "pending") label = isEnglish ? 'Pending' : 'În așteptare';
  if (status === "acceptat") label = isEnglish ? 'Accepted' : 'Acceptat';
  if (status === "respins") label = isEnglish ? 'Rejected' : 'Respins';
  let color = "default";
  if (status === "pending") color = "warning";
  if (status === "acceptat") color = "success";
  if (status === "respins") color = "error";
  return <Chip size="small" label={label} color={color} />;
}

export default function Medicamente() {
  const { lang, locale } = useLanguage();
  const isEnglish = lang === 'en';
  const [loading, setLoading] = useState(true);
  const [medicamente, setMedicamente] = useState([]);
  const [openRows, setOpenRows] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [newMed, setNewMed] = useState({ denumire: "", descriere: "" });
  const [confirmRenuntaOpen, setConfirmRenuntaOpen] = useState(false);
  const [renuntaId, setRenuntaId] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [formularOpen, setFormularOpen] = useState(false);
  const [selectedMedForm, setSelectedMedForm] = useState(null);
  const [formData, setFormData] = useState({
    fumeaza: "",
    activitate_fizica: "",
    probleme_inima: false,
    alergii: "",
    boli_cronice: "",
    medicamente_curente: "",
    greutate: "",
    inaltime: "",
    observatii: "",
  });
  const [openProgramareDialog, setOpenProgramareDialog] = useState(false);
  const [dataProgramare, setDataProgramare] = useState("");
  const [aplicareSelectata, setAplicareSelectata] = useState(null);
  const [medicamentCurent, setMedicamentCurent] = useState(null);

  const [viewFormOpen, setViewFormOpen] = useState(false);
  const [viewFormData, setViewFormData] = useState({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [aplicantiPages, setAplicantiPages] = useState({});

  const user = JSON.parse(sessionStorage.getItem("user") || 'null');
  const isDoctor = user?.role === "doctor";
  // `api` will attach Authorization header automatically via interceptor
  const token = sessionStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

const reload = async (specificMedicamentId = null, customAplicantiPage = null) => {
  if (!specificMedicamentId) {
    setLoading(true);
  }
  
  try {
    let url = `${API_URL}?page=${page}&limit=${limit}`;
    
    if (specificMedicamentId) {
      const aplicantiPage = customAplicantiPage || aplicantiPages[specificMedicamentId] || 1;
      url += `&medicamentId=${specificMedicamentId}&aplicantiPage=${aplicantiPage}&aplicantiLimit=5`;
    }
    
    const res = await api.get(url);
    if (specificMedicamentId && res.data.medicament) {
      setMedicamente(prevMeds => 
        prevMeds.map(m => 
          m.id === specificMedicamentId ? res.data.medicament : m
        )
      );
    } else {
      setMedicamente(res.data.medicamente || []);
      setTotal(res.data.total || 0);
    }
  } catch (err) {
    console.error("Eroare la fetch medicamente:", err);
  } finally {
    if (!specificMedicamentId) {
      setLoading(false);
    }
  }
};

useEffect(() => { 
  reload(); 
}, [page]);

  const toggleRow = async (id) => {
    const isOpening = !openRows[id];
    setOpenRows(prev => ({ ...prev, [id]: isOpening }));
    
    if (isOpening) {
      if (!aplicantiPages[id]) {
        setAplicantiPages(prev => ({ ...prev, [id]: 1 }));
      }
      await reload(id);
    }
  };

  const changeAplicantiPage = async (medicamentId, newPage) => {
    setAplicantiPages(prev => ({ ...prev, [medicamentId]: newPage }));
    await reload(medicamentId, newPage);
  };

  const openFormular = (med) => {
    setSelectedMedForm(med);
    setFormData({
      fumeaza: "",
      activitate_fizica: "",
      probleme_inima: false,
      alergii: "",
      boli_cronice: "",
      medicamente_curente: "",
      greutate: "",
      inaltime: "",
      observatii: "",
    });
    setFormularOpen(true);
  };

  const submitFormular = async () => {
  const {
    fumeaza,
    activitate_fizica,
    alergii,
    boli_cronice,
    medicamente_curente,
    greutate,
    inaltime,
    probleme_inima,
  } = formData;

  if (
    !fumeaza ||
    !activitate_fizica ||
    !alergii ||
    !boli_cronice ||
    !medicamente_curente ||
    !greutate ||
    !inaltime ||
    probleme_inima === undefined ||
    probleme_inima === null ||
    probleme_inima === ""
  ) {
    setDialogMessage("Te rugăm să completezi toate câmpurile obligatorii.");
    setDialogOpen(true);
    return;
  }

  try {
    await api.post(
      `${API_URL}/${selectedMedForm.id}/aplica`,
      {
        ...formData,
        observatii: formData.observatii || "", // optional
      }
    );

    setFormularOpen(false);
    setDialogMessage("Cererea a fost trimisă și este în așteptare.");
    setDialogOpen(true);
    await reload();
  } catch (err) {
    console.error(err);
    setDialogMessage(err.response?.data?.error || "Eroare la aplicare");
    setDialogOpen(true);
  }
};


  const updateStatus = async (id, status, medicamentId) => {
    console.log('updateStatus called:', id, status, 'medicamentId:', medicamentId);
    try {
      await api.post(`${API_URL}/aplicari/${id}/status`, { status });
      if (medicamentId) {
        await reload(medicamentId);
      } else {
        await reload();
      }
    } catch (err) {
      console.error("Eroare la actualizare status:", err);
    }
  };

  const handleAcceptWithProgramare = async (id, medicamentId) => {
  console.log('handleAcceptWithProgramare called:', id, 'medicamentId:', medicamentId);
  setAplicareSelectata(id);
  setMedicamentCurent(medicamentId);
  setOpenProgramareDialog(true);
};

  const creeazaProgramare = async () => {
  console.log('creeazaProgramare called:', aplicareSelectata, dataProgramare, 'medicamentCurent:', medicamentCurent);
  try {
      if (!aplicareSelectata) throw new Error('Aplicare selectata invalida');
      await api.post(
        `${API_URL}/aplicari/${aplicareSelectata}/programare`,
        { dataProgramare: dataProgramare }
      );

    setOpenProgramareDialog(false);
    setDataProgramare("");
    setAplicareSelectata(null);
    setSnackbar({
      open: true,
      message: 'Programare creată cu succes!',
      severity: 'success'
    });
    if (medicamentCurent) {
      await reload(medicamentCurent);
    } else {
      await reload();
    }
    setMedicamentCurent(null);
  } catch (err) {
    console.error("Eroare creare programare:", err);
    setSnackbar({
      open: true,
      message: err.response?.data?.error || "Eroare la crearea programării",
      severity: 'error'
    });
  }
};

  const closeProgramareDialog = () => {
    setOpenProgramareDialog(false);
    setDataProgramare("");
    setAplicareSelectata(null);
    setMedicamentCurent(null);
  };


  const handleViewForm = (aplicant) => {
    setViewFormData(aplicant || {});
    setViewFormOpen(true);
  };

  const handleEdit = (med) => {
    console.log('handleEdit called:', med);
    setSelectedMed(med);
    setNewMed({ denumire: med.denumire, descriere: med.descriere });
    setEditOpen(true);
  };

  const handleDelete = (med) => {
    console.log('handleDelete called:', med);
    setSelectedMed(med);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    console.log('confirmDelete called:', selectedMed);
    try {
      await api.delete(`${API_URL}/${selectedMed.id}`);
      setConfirmOpen(false);
      setSelectedMed(null);
      await reload();
    } catch (err) {
      console.error("Eroare la ștergere:", err);
    }
  };

const handleRenunta = async (id) => {
  const confirmRenuntare = window.confirm("Ești sigur că vrei să renunți la această aplicare?");
  if (!confirmRenuntare) return;

  try {
    await api.delete(`${API_URL}/aplicare/${id}`);
    await reload();
  } catch (err) {
    console.error("Eroare renuntare:", err);
    setDialogMessage(err.response?.data?.error || "Eroare server");
    setDialogOpen(true);
  }
};


const openConfirmRenunta = (id) => {
  setRenuntaId(id);
  setConfirmRenuntaOpen(true);
};

const handleConfirmRenunta = async () => {
  try {
    await api.delete(`${API_URL}/aplicare/${renuntaId}`);
    setConfirmRenuntaOpen(false);
    setRenuntaId(null);
    await reload();
  } catch (err) {
    console.error("Eroare renuntare:", err);
    setDialogMessage(err.response?.data?.error || "Eroare server");
    setDialogOpen(true);
    setConfirmRenuntaOpen(false);
  }
};


  const addMedicament = async () => {
    console.log('addMedicament called:', newMed);
    try {
      await api.post(API_URL, newMed);
      setAddOpen(false);
      setNewMed({ denumire: "", descriere: "" });
      await reload();
    } catch (err) {
      console.error("Eroare la adaugare medicament:", err);
    }
  };

    
 return (
  <AppLayout>
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {isEnglish ? 'Available medications' : 'Medicamente disponibile'}
        </Typography>
        {isDoctor && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              console.log('CLICK ADAUGA MEDICAMENT DETECTED!');
              setAddOpen(true);
            }}
          >
            {isEnglish ? 'Add medication' : 'Adaugă medicament'}
          </Button>
        )}
      </Box>

      {loading ? (
        <LinearProgress />
      ) : (
        <>
          <Paper variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  {isDoctor && <TableCell />}
                  <TableCell>{isEnglish ? 'Name' : 'Denumire'}</TableCell>
                  <TableCell>{isEnglish ? 'Description' : 'Descriere'}</TableCell>
                  {!isDoctor && <TableCell>{isEnglish ? 'Doctor' : 'Doctor'}</TableCell>}
                  {!isDoctor && <TableCell>{isEnglish ? 'Status' : 'Stare'}</TableCell>}
                  <TableCell align="right">{isDoctor ? (isEnglish ? 'Actions' : 'Acțiuni') : (isEnglish ? 'Option' : 'Opțiune')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {medicamente.map((m) => (
                  <React.Fragment key={m.id}>
                    <TableRow>
                      {isDoctor && (
                        <TableCell width={56}>
                          <IconButton size="small" onClick={() => toggleRow(m.id)}>
                            {openRows[m.id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                      )}
                      <TableCell>{m.denumire}</TableCell>
                      <TableCell>{m.descriere}</TableCell>
                      {!isDoctor && (
                        <TableCell>
                          Dr. {m.doctor_nume} {m.doctor_prenume}
                        </TableCell>
                      )}
                      {!isDoctor && (
                        <TableCell>
                          {m.aplicanti?.find((a) => a.pacient_id === user.id) ? (
                            <StatusChip
                              status={m.aplicanti.find((a) => a.pacient_id === user.id).status}
                              isEnglish={isEnglish}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {isDoctor ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Tooltip title={isEnglish ? 'Edit' : 'Editează'}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  console.log('CLICK EDITEAZA DETECTED!', m.id);
                                  handleEdit(m);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={isEnglish ? 'Delete' : 'Șterge'}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  console.log('CLICK STERGE DETECTED!', m.id);
                                  handleDelete(m);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={m.complet ? (isEnglish ? 'Reopen for applications' : 'Redeschide pentru aplicări') : (isEnglish ? 'Mark as completed' : 'Marchează ca complet')}>
                              <IconButton
                                size="small"
                                color={m.complet ? "warning" : "success"}
                                onClick={async () => {
                                  console.log('CLICK COMPLETEAZA MEDICAMENT!', m.id);
                                  try {
                                    await api.patch(`${API_URL}/${m.id}/completeaza`);
                                    setSnackbar({
                                      open: true,
                                      message: m.complet ? (isEnglish ? 'Medication reopened for applications!' : 'Medicament redeschis pentru aplicări!') : (isEnglish ? 'Medication marked as completed!' : 'Medicament marcat ca complet!'),
                                      severity: 'success'
                                    });
                                    await reload();
                                  } catch (err) {
                                    console.error(err);
                                    setSnackbar({
                                      open: true,
                                      message: err.response?.data?.error || (isEnglish ? 'Update error' : 'Eroare la actualizare'),
                                      severity: 'error'
                                    });
                                  }
                                }}
                              >
                                {m.complet ? <LockOpenIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Button
                            variant={
                              m.aplicanti?.find((a) => a.pacient_id === user.id)
                                ? "outlined"
                                : "contained"
                            }
                            color="primary"
                            size="small"
                            disabled={
                              (() => {
                                const aplicare = m.aplicanti?.find(
                                  (a) => a.pacient_id === user.id
                                );
                                // Dacă medicamentul e complet și nu există aplicare, disable
                                if (!aplicare && m.complet) return true;
                                if (!aplicare) return false;
                                return aplicare.status !== "pending";
                              })()
                            }
                            onClick={() => {
                              const aplicare = m.aplicanti?.find(
                                (a) => a.pacient_id === user.id
                              );

                              if (!aplicare) {
                                if (m.complet) {
                                  setDialogMessage(isEnglish ? 'This medication no longer accepts new applications.' : 'Acest medicament nu mai acceptă aplicări noi.');
                                  setDialogOpen(true);
                                  return;
                                }
                                openFormular(m);
                                return;
                              }

                              if (aplicare.status === "pending") {
                                openConfirmRenunta(aplicare.id);
                                return;
                              }

                                setDialogMessage(isEnglish ? 'You cannot withdraw if the status is not pending.' : 'Nu poti renunta daca statusul nu este pending.');
                              setDialogOpen(true);
                            }}
                          >
                            {m.aplicanti?.find((a) => a.pacient_id === user.id)
                              ? (isEnglish ? 'Withdraw' : 'Renunță')
                              : m.complet ? (isEnglish ? 'Completed' : 'Complet') : (isEnglish ? 'Apply' : 'Aplică')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Colaps aplicanți doctor */}
                    {isDoctor && (
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                          <Collapse in={!!openRows[m.id]} timeout="auto" unmountOnExit>
                            <Box sx={{ m: 2 }}>
                              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                {isEnglish ? 'Applicants' : 'Aplicanți'} ({m.aplicantiTotal || 0})
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>{isEnglish ? 'Patient' : 'Pacient'}</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>{isEnglish ? 'Status' : 'Status'}</TableCell>
                                    <TableCell align="right">{isEnglish ? 'Actions' : 'Acțiuni'}</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(m.aplicanti || []).map((a) => (
                                    <TableRow key={a.id}>
                                      <TableCell>{a.pacient_nume}</TableCell>
                                      <TableCell>{a.pacient_email}</TableCell>
                                      <TableCell>
                                        <StatusChip status={a.status} isEnglish={isEnglish} />
                                      </TableCell>
                                      <TableCell align="right">
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                          <Tooltip title={isEnglish ? 'Accept' : 'Acceptă'}>
                                            <IconButton
                                              size="small"
                                              color="success"
                                              onClick={() => {
                                                console.log('CLICK ACCEPTA DETECTED!', a.id, 'medicament:', m.id);
                                                handleAcceptWithProgramare(a.id, m.id);
                                              }}
                                            >
                                              <CheckCircleIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                          <Tooltip title={isEnglish ? 'Reject' : 'Respinge'}>
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => {
                                                console.log('CLICK RESPINGE DETECTED!', a.id, 'medicament:', m.id);
                                                updateStatus(a.id, "respins", m.id);
                                              }}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                          <Tooltip title={isEnglish ? 'View form' : 'Vezi formular'}>
                                            <IconButton
                                              size="small"
                                              color="info"
                                              onClick={() => handleViewForm(a)}
                                            >
                                              <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {(m.aplicanti || []).length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4}>{isEnglish ? 'No applicants.' : 'Nu există aplicanți.'}</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                              {m.aplicantiTotal > 5 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={m.aplicantiPage <= 1}
                                    onClick={() => changeAplicantiPage(m.id, m.aplicantiPage - 1)}
                                  >
                                    {isEnglish ? 'Previous' : 'Anterior'}
                                  </Button>
                                  <Typography variant="body2">
                                    {isEnglish ? 'Page' : 'Pagina'} {m.aplicantiPage} / {Math.ceil(m.aplicantiTotal / m.aplicantiLimit)}
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={m.aplicantiPage >= Math.ceil(m.aplicantiTotal / m.aplicantiLimit)}
                                    onClick={() => changeAplicantiPage(m.id, m.aplicantiPage + 1)}
                                  >
                                    {isEnglish ? 'Next' : 'Următor'}
                                  </Button>
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
            <Button
              variant="outlined"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {isEnglish ? 'Previous' : 'Anterior'}
            </Button>
            <Typography>
              {isEnglish ? 'Page' : 'Pagina'} {page} / {Math.ceil(total / limit)}
            </Typography>
            <Button
              variant="outlined"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(page + 1)}
            >
              {isEnglish ? 'Next' : 'Următor'}
            </Button>
          </Box>
        </>
      )}

      <Dialog open={formularOpen} onClose={() => setFormularOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEnglish ? 'Patient form' : 'Formular pacient'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            select
            fullWidth
            label={isEnglish ? 'Do you smoke?' : 'Fumezi?'}
            value={formData.fumeaza}
            onChange={(e) => setFormData({ ...formData, fumeaza: e.target.value })}
            sx={{ mb: 2 }}
            required
          >
            <MenuItem value="da">{isEnglish ? 'Yes' : 'Da'}</MenuItem>
            <MenuItem value="nu">{isEnglish ? 'No' : 'Nu'}</MenuItem>
            <MenuItem value="fost">{isEnglish ? 'Former smoker' : 'Am fost fumător'}</MenuItem>
          </TextField>
          <TextField
            select
            fullWidth
            label={isEnglish ? 'Physical activity' : 'Activitate fizică'}
            value={formData.activitate_fizica}
            onChange={(e) => setFormData({ ...formData, activitate_fizica: e.target.value })}
            sx={{ mb: 2 }}
            required
          >
            <MenuItem value="sedentar">{isEnglish ? 'Sedentary' : 'Sedentar'}</MenuItem>
            <MenuItem value="usoara">{isEnglish ? 'Light' : 'Ușoară'}</MenuItem>
            <MenuItem value="moderata">{isEnglish ? 'Moderate' : 'Moderată'}</MenuItem>
            <MenuItem value="intensa">{isEnglish ? 'Intense' : 'Intensă'}</MenuItem>
          </TextField>
          <TextField
            select
            fullWidth
            label={isEnglish ? 'Heart problems?' : 'Probleme de inimă?'}
            value={formData.probleme_inima}
            onChange={(e) => setFormData({ ...formData, probleme_inima: e.target.value === 'true' })}
            sx={{ mb: 2 }}
            required
          >
            <MenuItem value="false">{isEnglish ? 'No' : 'Nu'}</MenuItem>
            <MenuItem value="true">{isEnglish ? 'Yes' : 'Da'}</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label={isEnglish ? 'Allergies' : 'Alergii'}
            value={formData.alergii}
            onChange={(e) => setFormData({ ...formData, alergii: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label={isEnglish ? 'Chronic conditions' : 'Boli cronice'}
            value={formData.boli_cronice}
            onChange={(e) => setFormData({ ...formData, boli_cronice: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label={isEnglish ? 'Current medications' : 'Medicamente curente'}
            value={formData.medicamente_curente}
            onChange={(e) => setFormData({ ...formData, medicamente_curente: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label={isEnglish ? 'Weight (kg)' : 'Greutate (kg)'}
            type="number"
            value={formData.greutate}
            onChange={(e) => setFormData({ ...formData, greutate: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label={isEnglish ? 'Height (cm)' : 'Înălțime (cm)'}
            type="number"
            value={formData.inaltime}
            onChange={(e) => setFormData({ ...formData, inaltime: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label={isEnglish ? 'Notes (optional)' : 'Observații (opțional)'}
            multiline
            minRows={2}
            value={formData.observatii}
            onChange={(e) => setFormData({ ...formData, observatii: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormularOpen(false)}>{isEnglish ? 'Close' : 'Închide'}</Button>
          <Button onClick={submitFormular} variant="contained">{isEnglish ? 'Send' : 'Trimite'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewFormOpen} onClose={() => setViewFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEnglish ? 'Patient form - ' : 'Formular pacient - '}{viewFormData.pacient_nume}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Smoker:' : 'Fumător:'}</strong> {viewFormData.fumeaza || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Physical activity:' : 'Activitate fizică:'}</strong> {viewFormData.activitate_fizica || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Heart problems:' : 'Probleme inimă:'}</strong> {viewFormData.probleme_inima ? (isEnglish ? 'Yes' : 'Da') : (isEnglish ? 'No' : 'Nu')}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Allergies:' : 'Alergii:'}</strong> {viewFormData.alergii || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Chronic conditions:' : 'Boli cronice:'}</strong> {viewFormData.boli_cronice || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Current medications:' : 'Medicamente curente:'}</strong> {viewFormData.medicamente_curente || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Weight:' : 'Greutate:'}</strong> {viewFormData.greutate || '-'} kg</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Height:' : 'Înălțime:'}</strong> {viewFormData.inaltime || '-'} cm</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>{isEnglish ? 'Notes:' : 'Observații:'}</strong> {viewFormData.observatii || '-'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewFormOpen(false)}>{isEnglish ? 'Close' : 'Închide'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogContent>
          <Typography>{dialogMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>OK</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmRenuntaOpen} onClose={() => setConfirmRenuntaOpen(false)}>
        <DialogTitle>{isEnglish ? 'Confirm withdrawal' : 'Confirmare renunțare'}</DialogTitle>
        <DialogContent>
          <Typography>{isEnglish ? 'Are you sure you want to withdraw this application?' : 'Sigur vrei să renunți la această aplicare?'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRenuntaOpen(false)}>{isEnglish ? 'Cancel' : 'Anulează'}</Button>
          <Button onClick={handleConfirmRenunta} variant="contained" color="error">
            {isEnglish ? 'Yes, withdraw' : 'Da, renunță'}
          </Button>
        </DialogActions>
      </Dialog>
        <Dialog open={openProgramareDialog} onClose={closeProgramareDialog}>
  <DialogTitle>{isEnglish ? 'Select appointment date' : 'Selecteaza data programarii'}</DialogTitle>
  <DialogContent>
    <TextField
      type="datetime-local"
      value={dataProgramare}
      onChange={(e) => setDataProgramare(e.target.value)}
      fullWidth
      sx={{ mt: 1 }}
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={closeProgramareDialog}>{isEnglish ? 'Cancel' : 'Renunta'}</Button>
    <Button onClick={creeazaProgramare} variant="contained" color="primary">
      {isEnglish ? 'Create' : 'Creeaza'}
    </Button>
  </DialogActions>
</Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEnglish ? 'Add medication' : 'Adaugă medicament'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label={isEnglish ? 'Name' : 'Denumire'}
            value={newMed.denumire}
            onChange={(e) => setNewMed({ ...newMed, denumire: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label={isEnglish ? 'Description' : 'Descriere'}
            multiline
            minRows={3}
            value={newMed.descriere}
            onChange={(e) => setNewMed({ ...newMed, descriere: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>{isEnglish ? 'Cancel' : 'Anulează'}</Button>
          <Button onClick={addMedicament} variant="contained">
            {isEnglish ? 'Save' : 'Salvează'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEnglish ? 'Edit medication' : 'Editează medicament'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label={isEnglish ? 'Name' : 'Denumire'}
            value={newMed.denumire}
            onChange={(e) => setNewMed({ ...newMed, denumire: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label={isEnglish ? 'Description' : 'Descriere'}
            multiline
            minRows={3}
            value={newMed.descriere}
            onChange={(e) => setNewMed({ ...newMed, descriere: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{isEnglish ? 'Cancel' : 'Anulează'}</Button>
          <Button 
            onClick={async () => {
              console.log('Salvare editare:', selectedMed, newMed);
              try {
                await api.put(`${API_URL}/${selectedMed.id}`, newMed);
                setEditOpen(false);
                await reload();
              } catch (err) {
                console.error('Eroare editare:', err);
              }
            }} 
            variant="contained"
          >
            {isEnglish ? 'Save' : 'Salvează'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{isEnglish ? 'Confirm delete' : 'Confirmare ștergere'}</DialogTitle>
        <DialogContent>
          <Typography>
            {isEnglish ? 'Are you sure you want to delete the medication' : 'Sigur vrei să ștergi medicamentul'} "{selectedMed?.denumire}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{isEnglish ? 'Cancel' : 'Anulează'}</Button>
          <Button onClick={confirmDelete} variant="contained" color="error">
            {isEnglish ? 'Delete' : 'Șterge'}
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