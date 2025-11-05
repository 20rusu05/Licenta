import { useEffect, useState } from 'react';
import { Container, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress } from '@mui/material';
import AppLayout from '../layout/AppLayout';
import { api } from '../../services/api';

export default function Patients() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/pacienti');
        if (mounted) setPatients(res.data || []);
      } catch (e) {
        if (mounted) setError('Nu am putut încărca lista de pacienți');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
          Pacienți
        </Typography>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
        )}
        {!loading && !error && (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nume</TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.id}</TableCell>
                    <TableCell>{p.nume}</TableCell>
                    <TableCell>{p.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </AppLayout>
  );
}


