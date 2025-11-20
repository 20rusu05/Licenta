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
} from "@mui/material";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import AppLayout from "../layout/AppLayout";

const API_URL = "/programari";

export default function Programari() {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return null; // blocăm render-ul dacă nu există user
  const user = JSON.parse(storedUser);


  const [programari, setProgramari] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedPacient, setSelectedPacient] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);


  const reload = async () => {
  setLoading(true);
  try {
    const res = await api.get(`${API_URL}?page=${currentPage}&limit=10`);
    console.log('Programari response:', res.data);
    setProgramari(res.data.data || []);
    setTotalPages(res.data.total_pages || 1);
  } catch (err) {
    console.error('Eroare la fetch programari:', err);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
  reload();
}, [currentPage]);


  const openCalendar = (pacient) => {
    setSelectedPacient(pacient);
    setCalendarOpen(true);
    setSelectedDate(null);
  };

  const submitProgramare = async () => {
    if (!selectedDate || !selectedPacient) return;

    try {
      await api.post(API_URL, {
        pacient_id: selectedPacient.pacient_id || selectedPacient.id,
        data_ora: selectedDate.toISOString(),
      });

      setCalendarOpen(false);
      setSelectedPacient(null);
      alert("Programare creată cu succes!");
      reload();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Eroare server");
    }
  };

 if (!user) return null;

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Programări {user.role === "doctor" ? "Doctor" : "Pacient"}
          </Typography>
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
              <TableCell>Email pacient</TableCell>
              <TableCell>Data și ora</TableCell>
              <TableCell>Acțiuni</TableCell>
            </>
          ) : (
            <>
              <TableCell>Doctor</TableCell>
              <TableCell>Email doctor</TableCell>
              <TableCell>Data și ora</TableCell>
            </>
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        {!loading && programari.length > 0 ? (
          programari.map((p) => (
            <TableRow key={p.id}>
              {user.role === "doctor" ? (
                <>
                  <TableCell>{p.pacient_nume}</TableCell>
                  <TableCell>{p.pacient_email}</TableCell>
                  <TableCell>
                    {p.data_ora
                      ? new Date(p.data_ora).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => openCalendar(p)}
                    >
                      Programează
                    </Button>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell>{p.medic_nume}</TableCell>
                  <TableCell>{p.medic_email}</TableCell>
                  <TableCell>
                    {p.data_ora
                      ? new Date(p.data_ora).toLocaleString()
                      : "-"}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))
        ) : (
          !loading && (
            <TableRow>
              <TableCell colSpan={user.role === "doctor" ? 4 : 3}>
                Nu există programări disponibile.
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

        {/* Calendar doar pentru doctor - Păstrat ca Dialog */}
        {user.role === "doctor" && (
          <Dialog open={calendarOpen} onClose={() => setCalendarOpen(false)}>
            <DialogTitle>Programează pacient</DialogTitle>
            <DialogContent>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                  label="Alege data și ora"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCalendarOpen(false)}>Anulează</Button>
              <Button onClick={submitProgramare} variant="contained">
                Programează
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Container>
    </AppLayout>
  );
}