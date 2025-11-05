import { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, LinearProgress, IconButton, Collapse, Box, Button, Chip } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
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
    await api.post(`/medicamente/aplicari/${id}/status`, { status });
    await reload();
  };

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
          Medicamente și aplicanți
        </Typography>
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
                    <>
                      <TableRow key={m.id}>
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
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Container>
    </AppLayout>
  );
}


