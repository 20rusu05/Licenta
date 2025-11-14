import React, { useEffect, useState } from "react";
import axios from "axios";
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
  MenuItem
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AppLayout from "../layout/AppLayout";

const API_URL = "http://localhost:3001/api/medicamente";

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

  const [viewFormOpen, setViewFormOpen] = useState(false);
  const [viewFormData, setViewFormData] = useState({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const isDoctor = user?.role === "doctor";
  const headers = { Authorization: `Bearer ${token}` };

  const reload = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, { headers });
      setMedicamente(res.data || []);
    } catch (err) {
      console.error("Eroare la fetch medicamente:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const toggleRow = (id) => setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));

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
    probleme_inima, // si asta e obligatoriu
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
    await axios.post(
      `${API_URL}/${selectedMedForm.id}/aplica`,
      {
        ...formData,
        observatii: formData.observatii || "", // optional
      },
      { headers }
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
    try {
      await axios.post(`${API_URL}/aplicari/${id}/status`, { status }, { headers });
      await reload();
    } catch (err) {
      console.error("Eroare la actualizare status:", err);
    }
  };

  const handleViewForm = (aplicant) => {
    setViewFormData(aplicant || {});
    setViewFormOpen(true);
  };

  const handleEdit = (med) => {
    setSelectedMed(med);
    setNewMed({ denumire: med.denumire, descriere: med.descriere });
    setEditOpen(true);
  };

  const handleDelete = (med) => {
    setSelectedMed(med);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_URL}/${selectedMed.id}`, { headers });
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
    await axios.delete(`${API_URL}/aplicare/${id}`, { withCredentials: true, headers });

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
    await axios.delete(`${API_URL}/aplicare/${renuntaId}`, { withCredentials: true, headers });
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
    try {
      await axios.post(API_URL, newMed, { headers });
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
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Medicamente disponibile</Typography>
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

      {/* Lista medicamente */}
      {loading ? <LinearProgress /> : (
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
              {medicamente.map(m => (
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
                        {m.aplicanti?.find(a => a.pacient_id === user.id) ? 
                          <StatusChip status={m.aplicanti.find(a => a.pacient_id === user.id).status} /> 
                          : "-"
                        }
                      </TableCell>
                    )}
                    <TableCell align="right">
                      {isDoctor ? (
                        <>
                          <Button size="small" variant="outlined" color="primary" startIcon={<EditIcon />} onClick={() => handleEdit(m)} sx={{ mr: 1 }}>Editează</Button>
                          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(m)} sx={{ mr: 1 }}>Șterge</Button>
                        </>
                      ) : (
<Button
  variant={m.aplicanti?.find(a => a.pacient_id === user.id) ? "outlined" : "contained"}
  color="primary"
  size="small"
  disabled={
    (() => {
      const aplicare = m.aplicanti?.find(a => a.pacient_id === user.id);
      if (!aplicare) return false; // dacă nu există → poate aplica
      return aplicare.status !== "pending"; // doar pending e activ
    })()
  }
  onClick={() => {
    const aplicare = m.aplicanti?.find(a => a.pacient_id === user.id);

    if (!aplicare) {
      openFormular(m); // dacă nu există aplicare → deschide formularul
      return;
    }

    if (aplicare.status === "pending") {
      openConfirmRenunta(aplicare.id); // dacă e pending → pop-up confirmare
      return;
    }

    setDialogMessage("Nu poti renunta daca statusul nu este pending.");
    setDialogOpen(true); // dacă status e acceptat/respins
  }}
>
  {m.aplicanti?.find(a => a.pacient_id === user.id) ? "Renunță" : "Aplică"}
</Button>


                      )}
                    </TableCell>
                  </TableRow>

                  {/* Aplicanti pentru doctor */}
                  {isDoctor && (
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                        <Collapse in={!!openRows[m.id]} timeout="auto" unmountOnExit>
                          <Box sx={{ m: 2 }}>
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
                                {(m.aplicanti || []).map(a => (
                                  <TableRow key={a.id}>
                                    <TableCell>{a.pacient_nume}</TableCell>
                                    <TableCell>{a.pacient_email}</TableCell>
                                    <TableCell><StatusChip status={a.status} /></TableCell>
                                    <TableCell align="right">
                                      <Button size="small" sx={{ mr: 1 }} variant="outlined" color="success" onClick={() => updateStatus(a.id, "acceptat")}>Acceptă</Button>
                                      <Button size="small" variant="outlined" color="error" onClick={() => updateStatus(a.id, "respins")}>Respinge</Button>
                                      <Button size="small" variant="outlined" color="info" onClick={() => handleViewForm(a)}>Vezi</Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {(m.aplicanti || []).length === 0 && <TableRow><TableCell colSpan={4}>Nu există aplicanți.</TableCell></TableRow>}
                              </TableBody>
                            </Table>
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
      )}

      {/* Formular pacient */}
      <Dialog open={formularOpen} onClose={() => setFormularOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Formular pacient</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Fumează"
            value={formData.fumeaza || ""}
            onChange={e => setFormData({ ...formData, fumeaza: e.target.value })}
            fullWidth
            margin="normal"
          >
            <MenuItem value="">--Alege--</MenuItem>
            <MenuItem value="da">Da</MenuItem>
            <MenuItem value="nu">Nu</MenuItem>
            <MenuItem value="fost">Fost</MenuItem>
            required
          </TextField>

          <TextField
            select
            label="Activitate fizică"
            value={formData.activitate_fizica || ""}
            onChange={e => setFormData({ ...formData, activitate_fizica: e.target.value })}
            fullWidth
            margin="normal"
          >
            <MenuItem value="">--Alege--</MenuItem>
            <MenuItem value="sedentar">Sedentar</MenuItem>
            <MenuItem value="usoara">Usoară</MenuItem>
            <MenuItem value="moderata">Moderată</MenuItem>
            <MenuItem value="intensa">Intensă</MenuItem>
            required
          </TextField>
<TextField
  label="Alergii"
  fullWidth
  margin="normal"
  value={formData.alergii || ""}
  onChange={e => setFormData({ ...formData, alergii: e.target.value })}
  required
/>

          <TextField
  select
  label="Probleme inimă"
  value={formData.probleme_inima === null ? "" : formData.probleme_inima.toString()}
  onChange={e => setFormData({ ...formData, probleme_inima: e.target.value === "true" ? true : false })}
  fullWidth
>
  <MenuItem value="">--Alege--</MenuItem>
  <MenuItem value="true">Da</MenuItem>
  <MenuItem value="false">Nu</MenuItem>
</TextField>

          <TextField label="Boli cronice" fullWidth margin="normal" value={formData.boli_cronice || ""} onChange={e => setFormData({...formData, boli_cronice: e.target.value})} required/>
          <TextField label="Medicamente curente" fullWidth margin="normal" value={formData.medicamente_curente || ""} onChange={e => setFormData({...formData, medicamente_curente: e.target.value})} required />
          <TextField label="Greutate" fullWidth margin="normal" value={formData.greutate || ""} onChange={e => setFormData({...formData, greutate: e.target.value})} required/>
          <TextField label="Înălțime" fullWidth margin="normal" value={formData.inaltime || ""} onChange={e => setFormData({...formData, inaltime: e.target.value})} required/>
          <TextField label="Observații" fullWidth margin="normal" value={formData.observatii || ""} onChange={e => setFormData({...formData, observatii: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormularOpen(false)}>Închide</Button>
          <Button onClick={submitFormular} variant="contained">Trimite</Button>
        </DialogActions>
      </Dialog>

      {/* Vizualizare formular */}
      <Dialog open={viewFormOpen} onClose={() => setViewFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Formular pacient</DialogTitle>
        <DialogContent>
          <Typography>Fumează: {viewFormData.fumeaza || "-"}</Typography>
          <Typography>Activitate fizică: {viewFormData.activitate_fizica || "-"}</Typography>
          <Typography>Alergii: {viewFormData.alergii || "-"}</Typography>
          <Typography>Probleme inimă: {viewFormData.probleme_inima != null ? (viewFormData.probleme_inima ? "Da" : "Nu") : "-"}</Typography>
          <Typography>Boli cronice: {viewFormData.boli_cronice || "-"}</Typography>
          <Typography>Medicamente curente: {viewFormData.medicamente_curente || "-"}</Typography>
          <Typography>Greutate: {viewFormData.greutate || "-"}</Typography>
          <Typography>Înălțime: {viewFormData.inaltime || "-"}</Typography>
          <Typography>Observații: {viewFormData.observatii || "-"}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewFormOpen(false)}>Închide</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog mesaj */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogContent>
          <Typography>{dialogMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>OK</Button>
        </DialogActions>
      </Dialog>
      {/* Dialog confirmare renuntare */}
<Dialog
  open={confirmRenuntaOpen}
  onClose={() => setConfirmRenuntaOpen(false)}
>
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

    </Container>
  </AppLayout>
);
}