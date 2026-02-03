import { Box, Container, Typography, Paper, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <Box sx={{
      minHeight: '100vh',
      background: (theme) => theme.palette.mode === 'dark'
        ? 'radial-gradient(1200px 600px at -10% -10%, rgba(33,150,243,0.15), transparent), radial-gradient(800px 500px at 110% 10%, rgba(38,166,154,0.12), transparent)'
        : 'radial-gradient(1200px 600px at -10% -10%, rgba(33,150,243,0.10), transparent), radial-gradient(800px 500px at 110% 10%, rgba(38,166,154,0.08), transparent)',
      py: 4
    }}>
      <Container maxWidth="md">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 3 }}
        >
          Înapoi
        </Button>
        
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography
            component="h1"
            variant="h4"
            sx={{
              mb: 3,
              color: 'primary.main',
              fontWeight: 600,
              textAlign: 'center'
            }}
          >
            Termeni și Condiții
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            Ultima actualizare: 3 februarie 2026
          </Typography>

          <Box sx={{ '& > *': { mb: 3 } }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                1. Acceptarea Termenilor
              </Typography>
              <Typography variant="body1" paragraph>
                Prin accesarea și utilizarea platformei NewMed, acceptați să respectați și să fiți obligat de acești termeni și condiții. Dacă nu sunteți de acord cu oricare dintre acești termeni, vă rugăm să nu utilizați platforma noastră.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                2. Descrierea Serviciilor
              </Typography>
              <Typography variant="body1" paragraph>
                NewMed este o platformă digitală destinată facilitării comunicării între medici și pacienți, gestionării programărilor medicale, vizualizării medicamentelor și accesării informațiilor medicale. Platforma permite legarea directă a medicilor de pacienții lor pentru o urmărire medicală eficientă și continuă.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                3. Contul de Utilizator
              </Typography>
              <Typography variant="body1" paragraph>
                Pentru a utiliza serviciile noastre, trebuie să vă creați un cont. Sunteți responsabil pentru:
              </Typography>
              <Typography variant="body1" component="ul" sx={{ pl: 3 }}>
                <li>Menținerea confidențialității parolei dumneavoastră</li>
                <li>Furnizarea de informații exacte și actualizate</li>
                <li>Toate activitățile care au loc sub contul dumneavoastră</li>
                <li>Notificarea imediată a oricărei utilizări neautorizate a contului</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                4. Protecția Datelor și Confidențialitate
              </Typography>
              <Typography variant="body1" paragraph>
                Ne angajăm să protejăm datele dumneavoastră personale și medicale în conformitate cu GDPR și legislația română privind protecția datelor. Datele dumneavoastră vor fi:
              </Typography>
              <Typography variant="body1" component="ul" sx={{ pl: 3 }}>
                <li>Stocate în mod securizat pe servere protejate</li>
                <li>Utilizate exclusiv pentru furnizarea serviciilor medicale</li>
                <li>Partajate doar cu personalul medical autorizat</li>
                <li>Nu vor fi vândute sau distribuite către terțe părți fără consimțământul dumneavoastră</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                5. Utilizarea Acceptabilă
              </Typography>
              <Typography variant="body1" paragraph>
                Vă obligați să nu:
              </Typography>
              <Typography variant="body1" component="ul" sx={{ pl: 3 }}>
                <li>Utilizați platforma în scopuri ilegale sau neautorizate</li>
                <li>Încercați să accesați sisteme sau date restricționate</li>
                <li>Transmiteți viruși sau cod malițios</li>
                <li>Interferați cu funcționarea normală a platformei</li>
                <li>Furnizați informații false sau înșelătoare</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                6. Programări și Consultații
              </Typography>
              <Typography variant="body1" paragraph>
                Programările făcute prin platformă sunt supuse confirmării de către cabinetul medical. NewMed nu garantează disponibilitatea imediată a serviciilor medicale și nu este responsabil pentru modificările sau anulările făcute de către furnizorii de servicii medicale.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                7. Proprietate Intelectuală
              </Typography>
              <Typography variant="body1" paragraph>
                Toate drepturile de proprietate intelectuală asupra platformei NewMed, inclusiv design, logo, conținut și funcționalități, aparțin NewMed. Nu aveți dreptul de a copia, modifica sau distribui conținutul platformei fără permisiunea noastră expresă.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                8. Limitarea Răspunderii
              </Typography>
              <Typography variant="body1" paragraph>
                NewMed nu poate fi tras la răspundere pentru:
              </Typography>
              <Typography variant="body1" component="ul" sx={{ pl: 3 }}>
                <li>Pierderi sau daune rezultate din utilizarea platformei</li>
                <li>Întreruperi ale serviciului sau erori tehnice</li>
                <li>Acțiunile sau omisiunile furnizorilor de servicii medicale</li>
                <li>Pierderea sau compromiterea datelor din cauze în afara controlului nostru</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                9. Modificări ale Termenilor
              </Typography>
              <Typography variant="body1" paragraph>
                Ne rezervăm dreptul de a modifica acești termeni în orice moment. Veți fi notificat cu privire la modificările semnificative prin email sau prin intermediul platformei. Utilizarea continuă a serviciilor după modificări constituie acceptarea noilor termeni.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                10. Rezilierea Contului
              </Typography>
              <Typography variant="body1" paragraph>
                Ne rezervăm dreptul de a suspenda sau închide contul dumneavoastră în cazul în care încălcați acești termeni și condiții. Aveți dreptul de a solicita ștergerea contului și a datelor dumneavoastră în orice moment, contactându-ne la adresa de email furnizată.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                11. Legea Aplicabilă
              </Typography>
              <Typography variant="body1" paragraph>
                Acești termeni și condiții sunt guvernați de legile României. Orice dispută legată de acești termeni va fi soluționată de instanțele competente din România.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                12. Contact
              </Typography>
              <Typography variant="body1" paragraph>
                Pentru întrebări sau nelămuriri legate de acești termeni și condiții, ne puteți contacta la:
              </Typography>
              <Typography variant="body1" component="ul" sx={{ pl: 3 }}>
                <li>Email: contact@newmed.ro</li>
                <li>Telefon: 0712 345 678</li>
                <li>Adresa: Str. Medicală Nr. 1, București, România</li>
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Prin crearea unui cont pe platforma NewMed, confirmați că ați citit, înțeles și acceptat acești termeni și condiții.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
