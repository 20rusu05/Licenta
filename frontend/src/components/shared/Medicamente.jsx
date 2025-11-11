import React, { useEffect, useState } from "react";
import {
  Container, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, LinearProgress, IconButton, Collapse, Box, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AppLayout from "../layout/AppLayout";
import { api } from "../../services/api";

function StatusChip({ status }) {
  if (!status) return <Chip size="small" label="-" color="default" />;

  const normalized = status.toLowerCase();
  let label = "";
  let color = "default";

  switch (normalized) {
    case "pending":
      label = "In asteptare";
      color = "warning";
      break;
    case "acceptat":
      label = "Acceptat";
      color = "success";
      break;
    case "respins":
      label = "Respins";
      color = "error";
      break;
    default:
      label = status.charAt(0).toUpperCase() + status.slice(1);
      color = "default";
  }

  return <Chip size="small" color={color} label={label} />;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const isDoctor = user?.role === "doctor";

  const reload = async () => {
    setLoading(true);
    try {
      const res = await api.get("/medicamente", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMedicamente(res.data || []);
    } catch (err) {
      console.error("Eroare la fetch medicamente:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const toggleRow = (id) => setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const applyMedicament = async (med) => {
  try {
    const aplicare = med.aplicanti?.find(a => a.pacient_id === user.id);

    if (aplicare) {
      // daca exista aplicare -> stergem (renuntare)
      await api.delete(`/medicamente/aplicari/${aplicare.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDialogMessage('Ai renunțat la cererea ta.');
    } else {
      // daca nu exista -> cream aplicarea
      await api.post(`/medicamente/${med.id}/aplica`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDialogMessage('Cererea a fost trimisă și este în așteptare.');
    }

    setDialogOpen(true);
    await reload();
  } catch (err) {
    console.error('Eroare la aplicare/renuntare:', err);
    setDialogMessage(err.response?.data?.error || 'Eroare la trimiterea cererii');
    setDialogOpen(true);
  }
};


  const updateStatus = async (id, status) => {
    try {
      await api.post(
        `/medicamente/aplicari/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await reload();
    } catch (err) {
      console.error("Eroare la actualizarea statusului:", err);
    }
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
      await api.delete(`/medicamente/${selectedMed.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfirmOpen(false);
      setSelectedMed(null);
      await reload();
    } catch (err) {
      console.error("Eroare la ștergere:", err);
    }
  };

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
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
                              status={
                                m.aplicanti.find((a) => a.pacient_id === user.id).status
                              }
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
                              onClick={() => handleEdit(m)}
                              sx={{ mr: 1 }}
                            >
                              Editează
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => handleDelete(m)}
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
                            onClick={() => applyMedicament(m)}
                            disabled={
                              m.aplicanti?.find((a) => a.pacient_id === user.id)?.status ===
                              "acceptat"
                            }
                          >
                            {m.aplicanti?.find((a) => a.pacient_id === user.id)
                              ? "Renunță"
                              : "Aplică"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {isDoctor && (
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                          <Collapse in={!!openRows[m.id]} timeout="auto" unmountOnExit>
                            <Box sx={{ m: 2 }}>
                              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                Aplicanți
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
                                          onClick={() => updateStatus(a.id, "acceptat")}
                                        >
                                          Acceptă
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="error"
                                          onClick={() => updateStatus(a.id, "respins")}
                                        >
                                          Respinge
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {(m.aplicanti || []).length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4}>
                                        Nu există aplicanți.
                                      </TableCell>
                                    </TableRow>
                                  )}
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

        {/* Confirmare stergere */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirmă ștergerea</DialogTitle>
          <DialogContent>
            <Typography>
              Sigur dorești să ștergi medicamentul „{selectedMed?.denumire}”? Această acțiune
              este ireversibilă.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Anulează</Button>
            <Button color="error" variant="contained" onClick={confirmDelete}>
              Șterge
            </Button>
          </DialogActions>
        </Dialog>

        {/* Editare medicament */}
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
              variant="contained"
              onClick={async () => {
                try {
                  await api.put(
                    `/medicamente/${selectedMed.id}`,
                    newMed,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  setEditOpen(false);
                  await reload();
                } catch (err) {
                  console.error("Eroare la editare:", err);
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
