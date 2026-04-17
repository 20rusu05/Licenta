import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import MessageIcon from '@mui/icons-material/Message';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AppLayout from '../layout/AppLayout';
import { api, getBackendAssetUrl } from '../../services/api';

const REFRESH_INTERVAL_MS = 5000;

const getStoredUser = () => {
  try {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getDisplayName = (person) => {
  if (!person) return '';
  return `${person.counterpart_nume || person.nume || ''} ${person.counterpart_prenume || person.prenume || ''}`.trim();
};

const formatConversationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function Mesaje() {
  const user = useMemo(() => getStoredUser(), []);
  const isDoctor = user?.role === 'doctor';
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactsQuery, setContactsQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const messagesEndRef = useRef(null);

  const selectedCounterpartName = selectedConversation ? getDisplayName(selectedConversation) : '';

  const loadConversations = useCallback(async () => {
    const response = await api.get('/messages/conversations');
    return response.data?.conversations || [];
  }, []);

  const loadContacts = useCallback(async (search = '') => {
    const response = await api.get('/messages/contacts', {
      params: search ? { search } : {},
    });
    return response.data?.contacts || [];
  }, []);

  const loadMessages = useCallback(async (conversationId, options = {}) => {
    const { silent = false } = options;

    if (!conversationId) {
      setMessages([]);
      return [];
    }

    if (!silent) {
      setLoadingMessages(true);
    }

    try {
      const response = await api.get(`/messages/conversations/${conversationId}/messages`);
      const rows = response.data?.messages || [];
      setMessages(rows);
      return rows;
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  }, []);

  const resolveSelectedConversation = useCallback((list, id) => {
    if (!id) return null;
    return list.find((c) => Number(c.id) === Number(id)) || null;
  }, []);

  const refreshAll = useCallback(async (options = {}) => {
    const { silent = false } = options;

    try {
      const [conversationRows, contactRows] = await Promise.all([
        loadConversations(),
        loadContacts(contactsQuery),
      ]);
      setConversations(conversationRows);
      setContacts(contactRows);
      setError('');

      if (conversationRows.length === 0) {
        setSelectedConversationId(null);
        setSelectedConversation(null);
        setMessages([]);
        return;
      }

      const activeId = selectedConversationId || conversationRows[0].id;
      setSelectedConversationId(activeId);
      const selected = resolveSelectedConversation(conversationRows, activeId);
      setSelectedConversation(selected);
      await loadMessages(activeId, { silent });
    } catch (err) {
      setError(err.response?.data?.error || 'Nu am putut încărca mesageria');
    } finally {
      setLoadingInitial(false);
    }
  }, [contactsQuery, loadContacts, loadConversations, loadMessages, resolveSelectedConversation, selectedConversationId]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await refreshAll({ silent: true });
    };

    refreshAll({ silent: false });

    const intervalId = setInterval(() => {
      run();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [refreshAll]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const rows = await loadContacts(searchInput);
        setContacts(rows);
        setContactsQuery(searchInput);
      } catch {
        // Keep existing contacts if search fails.
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [loadContacts, searchInput]);

  const handleSelectConversation = async (conversation) => {
    setSelectedConversationId(conversation.id);
    setSelectedConversation(conversation);
    setError('');

    try {
      await loadMessages(conversation.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Nu am putut încărca mesajele conversației');
    }
  };

  const handleStartConversation = async (contact) => {
    try {
      const response = await api.post('/messages/conversations', {
        counterpartId: contact.id,
      });

      const conversationId = response.data?.conversationId;
      const conversationRows = await loadConversations();
      setConversations(conversationRows);

      const selected = resolveSelectedConversation(conversationRows, conversationId) || {
        id: conversationId,
        counterpart_id: contact.id,
        counterpart_nume: contact.nume,
        counterpart_prenume: contact.prenume,
        counterpart_avatar: contact.avatar_url,
        last_message: null,
        last_message_at: null,
        unread_count: 0,
      };

      setSelectedConversationId(conversationId);
      setSelectedConversation(selected);
      setError('');
      await loadMessages(conversationId);
    } catch (err) {
      setError(err.response?.data?.error || 'Nu am putut porni conversația');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversationId || !messageInput.trim() || sending) return;

    setSending(true);
    try {
      const response = await api.post(`/messages/conversations/${selectedConversationId}/messages`, {
        content: messageInput.trim(),
      });

      setMessages((prev) => [...prev, response.data.message]);
      setMessageInput('');

      const conversationRows = await loadConversations();
      setConversations(conversationRows);
      const selected = resolveSelectedConversation(conversationRows, selectedConversationId);
      setSelectedConversation(selected);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Nu am putut trimite mesajul');
    } finally {
      setSending(false);
    }
  };

  const openDeleteDialog = (conversationId = selectedConversationId) => {
    if (!conversationId || deletingConversation) return;
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deletingConversation) return;
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const handleDeleteConversation = async () => {
    const conversationId = conversationToDelete;
    if (!conversationId || deletingConversation) return;

    setDeleteDialogOpen(false);
    setConversationToDelete(null);

    setDeletingConversation(true);
    try {
      await api.delete(`/messages/conversations/${conversationId}`);

      const conversationRows = await loadConversations();
      setConversations(conversationRows);

      if (conversationRows.length === 0) {
        setSelectedConversationId(null);
        setSelectedConversation(null);
        setMessages([]);
        setError('');
        return;
      }

      const previousSelectedId = Number(selectedConversationId);
      const deletedId = Number(conversationId);
      const keepSelected = previousSelectedId && previousSelectedId !== deletedId
        ? resolveSelectedConversation(conversationRows, previousSelectedId)
        : null;

      const nextId = keepSelected?.id || conversationRows[0].id;
      const selected = resolveSelectedConversation(conversationRows, nextId);
      setSelectedConversationId(nextId);
      setSelectedConversation(selected);
      await loadMessages(nextId);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Nu am putut șterge conversația');
    } finally {
      setDeletingConversation(false);
    }
  };

  const handleSendOnEnter = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (!user || (user.role !== 'doctor' && user.role !== 'pacient')) {
    return (
      <AppLayout>
        <Container maxWidth="md" sx={{ mt: 3 }}>
          <Alert severity="warning">Mesageria este disponibilă doar pentru doctori și pacienți.</Alert>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container maxWidth={false} disableGutters sx={{ p: { xs: 1.5, md: 2.5 }, height: 'calc(100vh - 64px)' }}>
        <Paper variant="outlined" sx={{ height: '100%', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', height: '100%' }}>
            <Box sx={{ width: { xs: '100%', md: 360 }, borderRight: { md: '1px solid' }, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, pb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <MessageIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Mesaje</Typography>
                </Stack>

                <TextField
                  fullWidth
                  size="small"
                  placeholder={isDoctor ? 'Caută pacient...' : 'Caută doctor...'}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Divider />

              <Box sx={{ p: 1.5, pb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  CONVERSAȚII
                </Typography>
              </Box>

              <List dense sx={{ px: 1, overflowY: 'auto', maxHeight: { xs: 220, md: '40%' } }}>
                {loadingInitial && conversations.length === 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}

                {!loadingInitial && conversations.length === 0 && (
                  <Box sx={{ px: 1.5, py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Nu ai încă nicio conversație.
                    </Typography>
                  </Box>
                )}

                {conversations.map((conversation) => {
                  const isSelected = Number(selectedConversationId) === Number(conversation.id);
                  const lastText = conversation.last_message || 'Conversație fără mesaje';

                  return (
                    <ListItemButton
                      key={conversation.id}
                      selected={isSelected}
                      onClick={() => handleSelectConversation(conversation)}
                      sx={{ mb: 0.5, borderRadius: 1.5 }}
                    >
                      <Avatar src={getBackendAssetUrl(conversation.counterpart_avatar)} sx={{ width: 34, height: 34, mr: 1.2 }}>
                        {getDisplayName(conversation)?.[0]?.toUpperCase()}
                      </Avatar>
                      <ListItemText
                        secondaryTypographyProps={{ component: 'div' }}
                        primary={
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                              {getDisplayName(conversation)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatConversationTime(conversation.last_message_at || conversation.updated_at)}
                            </Typography>
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 170 }}>
                              {lastText}
                            </Typography>
                            {Number(conversation.unread_count) > 0 && (
                              <Chip
                                size="small"
                                color="primary"
                                label={conversation.unread_count}
                                sx={{ height: 20, minWidth: 20 }}
                              />
                            )}
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>

              <Divider sx={{ mt: 0.5 }} />

              <Box sx={{ p: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <PersonSearchIcon fontSize="small" color="primary" />
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  {isDoctor ? 'PACIENȚI DISPONIBILI' : 'DOCTORI DISPONIBILI'}
                </Typography>
              </Box>

              <List dense sx={{ px: 1, overflowY: 'auto', flex: 1 }}>
                {contacts.map((contact) => {
                  const displayName = getDisplayName(contact);
                  return (
                    <ListItemButton
                      key={contact.id}
                      onClick={() => handleStartConversation(contact)}
                      sx={{ mb: 0.5, borderRadius: 1.5 }}
                    >
                      <Avatar src={getBackendAssetUrl(contact.avatar_url)} sx={{ width: 32, height: 32, mr: 1.2 }}>
                        {displayName?.[0]?.toUpperCase()}
                      </Avatar>
                      <ListItemText
                        secondaryTypographyProps={{ component: 'div' }}
                        primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{displayName}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{contact.email}</Typography>}
                      />
                    </ListItemButton>
                  );
                })}

                {contacts.length === 0 && (
                  <Box sx={{ px: 1.5, py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {isDoctor
                        ? 'Nu există pacienți disponibili pentru mesagerie.'
                        : 'Nu există doctori disponibili pentru mesagerie.'}
                    </Typography>
                  </Box>
                )}
              </List>
            </Box>

            <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', minWidth: 0 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                {selectedConversation ? (
                  <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Avatar src={getBackendAssetUrl(selectedConversation.counterpart_avatar)}>
                        {selectedCounterpartName?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {selectedCounterpartName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Conversație salvată permanent
                        </Typography>
                      </Box>
                    </Stack>
                    <IconButton
                      color="error"
                      onClick={() => openDeleteDialog(selectedConversation.id)}
                      disabled={deletingConversation}
                      aria-label="șterge conversația"
                    >
                      {deletingConversation ? <CircularProgress size={18} /> : <DeleteOutlineIcon />}
                    </IconButton>
                  </Stack>
                ) : (
                  <Typography variant="subtitle1" color="text.secondary">
                    Selectează o conversație pentru a vedea mesajele
                  </Typography>
                )}
              </Box>

              <Box sx={{ flex: 1, overflowY: 'auto', p: 2, backgroundColor: 'background.default' }}>
                {loadingMessages && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}

                {!loadingMessages && selectedConversation && messages.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
                    Încă nu există mesaje. Scrie primul mesaj.
                  </Typography>
                )}

                {!loadingMessages && messages.map((msg) => {
                  const mine = msg.sender_role === user.role && Number(msg.sender_id) === Number(user.id);
                  return (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        mb: 1.2,
                      }}
                    >
                      <Paper
                        sx={{
                          maxWidth: '72%',
                          px: 1.3,
                          py: 0.9,
                          borderRadius: 2,
                          backgroundColor: mine ? 'primary.main' : 'background.paper',
                          color: mine ? 'primary.contrastText' : 'text.primary',
                          border: mine ? 'none' : '1px solid',
                          borderColor: 'divider',
                        }}
                        elevation={mine ? 0 : 1}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {msg.continut}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            textAlign: 'right',
                            mt: 0.5,
                            opacity: mine ? 0.85 : 0.6,
                          }}
                        >
                          {new Date(msg.created_at).toLocaleString('ro-RO', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Paper>
                    </Box>
                  );
                })}
                <Box ref={messagesEndRef} />
              </Box>

              <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth
                    placeholder={selectedConversation ? 'Scrie mesajul...' : 'Selectează o conversație'}
                    multiline
                    maxRows={4}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleSendOnEnter}
                    disabled={!selectedConversation || sending}
                  />
                  <IconButton
                    color="primary"
                    onClick={handleSendMessage}
                    disabled={!selectedConversation || !messageInput.trim() || sending}
                  >
                    {sending ? <CircularProgress size={20} /> : <SendIcon />}
                  </IconButton>
                </Stack>
              </Box>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 1 }}>
          <Alert severity="info">
            Pentru experiență completă de chat, deschide pagina pe ecran mediu sau mare.
          </Alert>
          {selectedConversationId && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button variant="outlined" fullWidth startIcon={<SendIcon />}>
                Conversație selectată
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => openDeleteDialog(selectedConversationId)}
                disabled={deletingConversation}
                startIcon={deletingConversation ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
              >
                Șterge
              </Button>
            </Stack>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <Dialog
          open={deleteDialogOpen}
          onClose={closeDeleteDialog}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Ștergere conversație</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Sigur vrei să ștergi această conversație? Toate mesajele se vor pierde.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog} disabled={deletingConversation}>
              Anulează
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={handleDeleteConversation}
              disabled={deletingConversation}
            >
              {deletingConversation ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </AppLayout>
  );
}
