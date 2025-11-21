import { useEffect, useState } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  LinearProgress,
  Box,
  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';
import AppLayout from '../layout/AppLayout';
import { api } from '../../services/api';

export default function Patients() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadPatients = async (page, searchTerm = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/pacienti?page=${page}&limit=10&search=${encodeURIComponent(searchTerm)}`);
      setPatients(res.data.data || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalItems(res.data.total_items || 0);
      setCurrentPage(page);
      setError('');
    } catch (e) {
      setError('Nu am putut încărca lista de pacienți');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    loadPatients(1, searchInput);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    loadPatients(currentPage);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PeopleIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Pacienții mei
            </Typography>
            {!loading && (
              <Chip label={`${totalItems} pacienți`} color="primary" />
            )}
          </Box>
          
          <TextField
            size="small"
            placeholder="Caută după nume, prenume, email sau telefon..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            sx={{ width: 400 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearch} edge="end">
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
        )}
        {!loading && !error && patients.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Nu există încă pacienți care au avut programări sau aplicări la medicamentele tale.
            </Typography>
          </Paper>
        )}
        {!loading && !error && patients.length > 0 && (
          <>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Nume complet</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Telefon</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Programări</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Aplicări</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Ultima programare</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Înregistrat la</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {p.nume} {p.prenume}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{p.email}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{p.telefon}</TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={p.total_programari || 0} 
                        size="small" 
                        color={p.total_programari > 0 ? "primary" : "default"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={p.total_aplicari || 0} 
                        size="small" 
                        color={p.total_aplicari > 0 ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      {formatDate(p.ultima_programare)}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      {new Date(p.created_at).toLocaleDateString('ro-RO')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Paginare */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
            <Button 
              variant="outlined"
              disabled={currentPage <= 1}
              onClick={() => loadPatients(currentPage - 1)}
            >
              Anterior
            </Button>

            <Typography>
              Pagina {currentPage} / {totalPages}
            </Typography>

            <Button 
              variant="outlined"
              disabled={currentPage >= totalPages}
              onClick={() => loadPatients(currentPage + 1)}
            >
              Următor
            </Button>
          </Box>
          </>
        )}
      </Container>
    </AppLayout>
  );
}


