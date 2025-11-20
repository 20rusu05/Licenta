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
  Alert
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AppLayout from "../layout/AppLayout";

const API_URL = "/medicamente";

function StatusChip({ status }) {
  if (!status) return <Chip size="small" label="-" color="default" />;
  let label = status.charAt(0).toUpperCase() + status.slice(1);
  let color = "default";
  if (status === "pending") color = "warning";
  if (status === "acceptat") color = "success";
  if (status === "respins") color = "error";
  return <Chip size="small" label={label} color={color} />;
}

export default function Medicamente() {
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

  // Paginare aplicanti
  const [aplicantiPages, setAplicantiPages] = useState({});

  const user = JSON.parse(localStorage.getItem("user"));
  const isDoctor = user?.role === "doctor";
  console.log('Medicamente component loaded. User:', user, 'isDoctor:', isDoctor);
  // `api` will attach Authorization header automatically via interceptor
  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  console.log('Token present:', !!token);

const reload = async (specificMedicamentId = null, customAplicantiPage = null) => {
  console.log('reload() called, page:', page, 'specificMedicamentId:', specificMedicamentId, 'customAplicantiPage:', customAplicantiPage);
  
  // Daca se reincarca un medicament specific, nu afisam loading global
  if (!specificMedicamentId) {
    setLoading(true);
  }
  
  try {
    let url = `${API_URL}?page=${page}&limit=${limit}`;
    
    // Daca e specificat un medicament, adauga paginarea pentru aplicantii lui
    if (specificMedicamentId) {
      const aplicantiPage = customAplicantiPage || aplicantiPages[specificMedicamentId] || 1;
      url += `&medicamentId=${specificMedicamentId}&aplicantiPage=${aplicantiPage}&aplicantiLimit=5`;
    }
    
    const res = await api.get(url);
    console.log('Medicamente loaded:', res.data);
    
    // Daca am relodat un medicament specific, updatez doar acel medicament
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
  console.log('useEffect triggered, calling reload()');
  reload(); 
}, [page]);

  const toggleRow = async (id) => {
    const isOpening = !openRows[id];
    setOpenRows(prev => ({ ...prev, [id]: isOpening }));
    
    // Daca deschidem randul, incarcam aplicantii
    if (isOpening) {
      // Initializeaza pagina aplicanti pentru acest medicament daca nu exista
      if (!aplicantiPages[id]) {
        setAplicantiPages(prev => ({ ...prev, [id]: 1 }));
      }
      // Reincarca datele pentru acest medicament specific cu aplicantii paginati
      await reload(id);
    }
  };

  const changeAplicantiPage = async (medicamentId, newPage) => {
    setAplicantiPages(prev => ({ ...prev, [medicamentId]: newPage }));
    // Trimite direct pagina noua la reload
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

  // validare pentru toate campurile obligatorii (observatii e exclus)
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


  const updateStatus = async (id, status) => {
    console.log('updateStatus called:', id, status);
    try {
      await api.post(`${API_URL}/aplicari/${id}/status`, { status });
      await reload();
    } catch (err) {
      console.error("Eroare la actualizare status:", err);
    }
  };

  const handleAcceptWithProgramare = async (id, medicamentId) => {
  console.log('handleAcceptWithProgramare called:', id, 'medicamentId:', medicamentId);
  try {
    await api.post(`${API_URL}/aplicari/${id}/status`, { status: "acceptat" });
    setAplicareSelectata(id);
    setMedicamentCurent(medicamentId);
    setOpenProgramareDialog(true);
  } catch (err) {
    console.error("Eroare la acceptare:", err);
  }
};

  const creeazaProgramare = async () => {
  console.log('creeazaProgramare called:', aplicareSelectata, dataProgramare, 'medicamentCurent:', medicamentCurent);
  try {
      // backend expects POST /api/medicamente/aplicari/:id/programare with { dataProgramare }
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
    // Reincarca medicamentul specific pentru a actualiza lista de aplicanti
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
  // Pop-up de confirmare
  const confirmRenuntare = window.confirm("Ești sigur că vrei să renunți la această aplicare?");
  if (!confirmRenuntare) return; // dacă utilizatorul apasă "Anulează", nu se face nimic

  try {
    // Șterge aplicația
    await api.delete(`${API_URL}/aplicare/${id}`);

    // Reîncarcă lista de medicamente/aplicări
    await reload();
  } catch (err) {
    console.error("Eroare renuntare:", err);
    // Afișează mesaj doar în caz de eroare
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
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Medicamente disponibile
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
            Adaugă medicament
          </Button>
        )}
      </Box>

      {/* Lista medicamente cu loading */}
      {loading ? (
        <LinearProgress />
      ) : (
        <>
          <Paper variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  {isDoctor && <TableCell />}
                  <TableCell>Denumire</TableCell>
                  <TableCell>Descriere</TableCell>
                  {!isDoctor && <TableCell>Stare</TableCell>}
                  <TableCell align="right">{isDoctor ? "Acțiuni" : "Opțiune"}</TableCell>
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
                          {m.aplicanti?.find((a) => a.pacient_id === user.id) ? (
                            <StatusChip
                              status={m.aplicanti.find((a) => a.pacient_id === user.id).status}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {isDoctor ? (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={<EditIcon />}
                              onClick={() => {
                                console.log('CLICK EDITEAZA DETECTED!', m.id);
                                handleEdit(m);
                              }}
                              sx={{ mr: 1 }}
                            >
                              Editează
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => {
                                console.log('CLICK STERGE DETECTED!', m.id);
                                handleDelete(m);
                              }}
                            >
                              Șterge
                            </Button>
                          </>
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
                                if (!aplicare) return false;
                                return aplicare.status !== "pending";
                              })()
                            }
                            onClick={() => {
                              const aplicare = m.aplicanti?.find(
                                (a) => a.pacient_id === user.id
                              );

                              if (!aplicare) {
                                openFormular(m);
                                return;
                              }

                              if (aplicare.status === "pending") {
                                openConfirmRenunta(aplicare.id);
                                return;
                              }

                              setDialogMessage(
                                "Nu poti renunta daca statusul nu este pending."
                              );
                              setDialogOpen(true);
                            }}
                          >
                            {m.aplicanti?.find((a) => a.pacient_id === user.id)
                              ? "Renunță"
                              : "Aplică"}
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
                                Aplicanți ({m.aplicantiTotal || 0})
                              </Typography>
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
                                  {(m.aplicanti || []).map((a) => (
                                    <TableRow key={a.id}>
                                      <TableCell>{a.pacient_nume}</TableCell>
                                      <TableCell>{a.pacient_email}</TableCell>
                                      <TableCell>
                                        <StatusChip status={a.status} />
                                      </TableCell>
                                      <TableCell align="right">
                                        <Button
                                          size="small"
                                          sx={{ mr: 1 }}
                                          variant="outlined"
                                          color="success"
                                          onClick={() => {
                                            console.log('CLICK ACCEPTA DETECTED!', a.id, 'medicament:', m.id);
                                            handleAcceptWithProgramare(a.id, m.id);
                                          }}
                                        >
                                          Acceptă
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="error"
                                          onClick={() => {
                                            console.log('CLICK RESPINGE DETECTED!', a.id);
                                            updateStatus(a.id, "respins");
                                          }}
                                        >
                                          Respinge
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="info"
                                          onClick={() => handleViewForm(a)}
                                        >
                                          Vezi
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {(m.aplicanti || []).length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4}>Nu există aplicanți.</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                              {/* Paginare aplicanti */}
                              {m.aplicantiTotal > 5 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={m.aplicantiPage <= 1}
                                    onClick={() => changeAplicantiPage(m.id, m.aplicantiPage - 1)}
                                  >
                                    Anterior
                                  </Button>
                                  <Typography variant="body2">
                                    Pagina {m.aplicantiPage} / {Math.ceil(m.aplicantiTotal / m.aplicantiLimit)}
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={m.aplicantiPage >= Math.ceil(m.aplicantiTotal / m.aplicantiLimit)}
                                    onClick={() => changeAplicantiPage(m.id, m.aplicantiPage + 1)}
                                  >
                                    Următor
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

          {/* Paginare */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
            <Button
              variant="outlined"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Typography>
              Pagina {page} / {Math.ceil(total / limit)}
            </Typography>
            <Button
              variant="outlined"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(page + 1)}
            >
              Următor
            </Button>
          </Box>
        </>
      )}

      {/* Formulare și dialoguri */}
      {/** Formular pacient */}
      <Dialog open={formularOpen} onClose={() => setFormularOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Formular pacient</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            select
            fullWidth
            label="Fumezi?"
            value={formData.fumeaza}
            onChange={(e) => setFormData({ ...formData, fumeaza: e.target.value })}
            sx={{ mb: 2 }}
            required
          >
            <MenuItem value="da">Da</MenuItem>
            <MenuItem value="nu">Nu</MenuItem>
            <MenuItem value="fost">Am fost fumător</MenuItem>
          </TextField>
          <TextField
            select
            fullWidth
            label="Activitate fizică"
            value={formData.activitate_fizica}
            onChange={(e) => setFormData({ ...formData, activitate_fizica: e.target.value })}
            sx={{ mb: 2 }}
            required
          >
            <MenuItem value="sedentar">Sedentar</MenuItem>
            <MenuItem value="usoara">Ușoară</MenuItem>
            <MenuItem value="moderata">Moderată</MenuItem>
            <MenuItem value="intensa">Intensă</MenuItem>
          </TextField>
          <TextField
            select
            fullWidth
            label="Probleme de inimă?"
            value={formData.probleme_inima}
            onChange={(e) => setFormData({ ...formData, probleme_inima: e.target.value === 'true' })}
            sx={{ mb: 2 }}
            required
          >
            <MenuItem value="false">Nu</MenuItem>
            <MenuItem value="true">Da</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label="Alergii"
            value={formData.alergii}
            onChange={(e) => setFormData({ ...formData, alergii: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Boli cronice"
            value={formData.boli_cronice}
            onChange={(e) => setFormData({ ...formData, boli_cronice: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Medicamente curente"
            value={formData.medicamente_curente}
            onChange={(e) => setFormData({ ...formData, medicamente_curente: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Greutate (kg)"
            type="number"
            value={formData.greutate}
            onChange={(e) => setFormData({ ...formData, greutate: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Înălțime (cm)"
            type="number"
            value={formData.inaltime}
            onChange={(e) => setFormData({ ...formData, inaltime: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Observații (opțional)"
            multiline
            minRows={2}
            value={formData.observatii}
            onChange={(e) => setFormData({ ...formData, observatii: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormularOpen(false)}>Închide</Button>
          <Button onClick={submitFormular} variant="contained">Trimite</Button>
        </DialogActions>
      </Dialog>

      {/** Vizualizare formular */}
      <Dialog open={viewFormOpen} onClose={() => setViewFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Formular pacient - {viewFormData.pacient_nume}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Fumător:</strong> {viewFormData.fumeaza || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Activitate fizică:</strong> {viewFormData.activitate_fizica || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Probleme inimă:</strong> {viewFormData.probleme_inima ? 'Da' : 'Nu'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Alergii:</strong> {viewFormData.alergii || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Boli cronice:</strong> {viewFormData.boli_cronice || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Medicamente curente:</strong> {viewFormData.medicamente_curente || '-'}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Greutate:</strong> {viewFormData.greutate || '-'} kg</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Înălțime:</strong> {viewFormData.inaltime || '-'} cm</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}><strong>Observații:</strong> {viewFormData.observatii || '-'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewFormOpen(false)}>Închide</Button>
        </DialogActions>
      </Dialog>

      {/** Dialog simplu */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogContent>
          <Typography>{dialogMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>OK</Button>
        </DialogActions>
      </Dialog>

      {/** Dialog confirmare renunțare */}
      <Dialog open={confirmRenuntaOpen} onClose={() => setConfirmRenuntaOpen(false)}>
        <DialogTitle>Confirmare renunțare</DialogTitle>
        <DialogContent>
          <Typography>Sigur vrei să renunți la această aplicare?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRenuntaOpen(false)}>Anulează</Button>
          <Button onClick={handleConfirmRenunta} variant="contained" color="error">
            Da, renunță
          </Button>
        </DialogActions>
      </Dialog>
      {/** Dialog programare */}
<Dialog open={openProgramareDialog} onClose={() => setOpenProgramareDialog(false)}>
  <DialogTitle>Selecteaza data programarii</DialogTitle>
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
    <Button onClick={() => setOpenProgramareDialog(false)}>Renunta</Button>
    <Button onClick={creeazaProgramare} variant="contained" color="primary">
      Creeaza
    </Button>
  </DialogActions>
</Dialog>

      {/** Dialog adaugare medicament */}
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
          <Button onClick={addMedicament} variant="contained">
            Salvează
          </Button>
        </DialogActions>
      </Dialog>

      {/** Dialog editare medicament */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editează medicament</DialogTitle>
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
          <Button onClick={() => setEditOpen(false)}>Anulează</Button>
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
            Salvează
          </Button>
        </DialogActions>
      </Dialog>

      {/** Dialog confirmare stergere */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmare ștergere</DialogTitle>
        <DialogContent>
          <Typography>
            Sigur vrei să ștergi medicamentul "{selectedMed?.denumire}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Anulează</Button>
          <Button onClick={confirmDelete} variant="contained" color="error">
            Șterge
          </Button>
        </DialogActions>
      </Dialog>

      {/** Snackbar pentru notificări */}
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