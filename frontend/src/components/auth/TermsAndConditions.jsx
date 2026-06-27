import { Box, Container, Typography, Paper, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useLanguage } from '../../LanguageContext';

export default function TermsAndConditions() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const isEnglish = lang === 'en';
  // Stilul comun pastreaza listele legale curate in ambele limbi.
  const listSx = { pl: 0, listStyle: 'none' };

  // Continutul legal este randat bilingv in aceeasi componenta.
  // Navigarea inapoi pastreaza contextul din care utilizatorul a deschis pagina.
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
          {isEnglish ? 'Back' : 'Înapoi'}
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
            {isEnglish ? 'Terms and Conditions' : 'Termeni și Condiții'}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            {isEnglish ? 'Last updated: February 3, 2026' : 'Ultima actualizare: 3 februarie 2026'}
          </Typography>

          <Box sx={{ '& > *': { mb: 3 } }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '1. Acceptance of Terms' : '1. Acceptarea Termenilor'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'By accessing and using the NewMed platform, you agree to comply with and be bound by these terms and conditions. If you do not agree with any of these terms, please do not use our platform.'
                  : 'Prin accesarea și utilizarea platformei NewMed, acceptați să respectați și să fiți obligat de acești termeni și condiții. Dacă nu sunteți de acord cu oricare dintre acești termeni, vă rugăm să nu utilizați platforma noastră.'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '2. Service Description' : '2. Descrierea Serviciilor'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'NewMed is a digital platform designed to facilitate communication between doctors and patients, manage medical appointments, view medications, and access medical information. The platform allows doctors to be directly connected with their patients for efficient and continuous medical follow-up.'
                  : 'NewMed este o platformă digitală destinată facilitării comunicării între medici și pacienți, gestionării programărilor medicale, vizualizării medicamentelor și accesării informațiilor medicale. Platforma permite legarea directă a medicilor de pacienții lor pentru o urmărire medicală eficientă și continuă.'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '3. User Account' : '3. Contul de Utilizator'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'To use our services, you must create an account. You are responsible for:'
                  : 'Pentru a utiliza serviciile noastre, trebuie să vă creați un cont. Sunteți responsabil pentru:'}
              </Typography>
              <Typography variant="body1" component="ul" sx={listSx}>
                <li>{isEnglish ? 'Maintaining the confidentiality of your password' : 'Menținerea confidențialității parolei dumneavoastră'}</li>
                <li>{isEnglish ? 'Providing accurate and up-to-date information' : 'Furnizarea de informații exacte și actualizate'}</li>
                <li>{isEnglish ? 'All activities that occur under your account' : 'Toate activitățile care au loc sub contul dumneavoastră'}</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '4. Data Protection and Privacy' : '4. Protecția Datelor și Confidențialitate'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'We are committed to protecting your personal and medical data in accordance with GDPR and Romanian data protection law. Your data will be:'
                  : 'Ne angajăm să protejăm datele dumneavoastră personale și medicale în conformitate cu GDPR și legislația română privind protecția datelor. Datele dumneavoastră vor fi:'}
              </Typography>
              <Typography variant="body1" component="ul" sx={listSx}>
                <li>{isEnglish ? 'Stored securely on protected servers' : 'Stocate în mod securizat pe servere protejate'}</li>
                <li>{isEnglish ? 'Used exclusively to provide medical services' : 'Utilizate exclusiv pentru furnizarea serviciilor medicale'}</li>
                <li>{isEnglish ? 'Shared only with authorized medical staff' : 'Partajate doar cu personalul medical autorizat'}</li>
                <li>{isEnglish ? 'Not sold or distributed to third parties without your consent' : 'Nu vor fi vândute sau distribuite către terțe părți fără consimțământul dumneavoastră'}</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '5. Acceptable Use' : '5. Utilizarea Acceptabilă'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish ? 'You agree not to:' : 'Vă obligați să nu:'}
              </Typography>
              <Typography variant="body1" component="ul" sx={listSx}>
                <li>{isEnglish ? 'Use the platform for illegal or unauthorized purposes' : 'Utilizați platforma în scopuri ilegale sau neautorizate'}</li>
                <li>{isEnglish ? 'Attempt to access restricted systems or data' : 'Încercați să accesați sisteme sau date restricționate'}</li>
                <li>{isEnglish ? 'Transmit viruses or malicious code' : 'Transmiteți viruși sau cod malițios'}</li>
                <li>{isEnglish ? 'Interfere with the normal operation of the platform' : 'Interferați cu funcționarea normală a platformei'}</li>
                <li>{isEnglish ? 'Provide false or misleading information' : 'Furnizați informații false sau înșelătoare'}</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '6. Appointments and Consultations' : '6. Programări și Consultații'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'Appointments made through the platform are subject to confirmation by the medical office. NewMed does not guarantee immediate availability of medical services and is not responsible for changes or cancellations made by healthcare providers.'
                  : 'Programările făcute prin platformă sunt supuse confirmării de către cabinetul medical. NewMed nu garantează disponibilitatea imediată a serviciilor medicale și nu este responsabil pentru modificările sau anulările făcute de către furnizorii de servicii medicale.'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '7. Intellectual Property' : '7. Proprietate Intelectuală'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'All intellectual property rights regarding the NewMed platform, including design, logo, content, and functionality, belong to NewMed. You may not copy, modify, or distribute platform content without our explicit permission.'
                  : 'Toate drepturile de proprietate intelectuală asupra platformei NewMed, inclusiv design, logo, conținut și funcționalități, aparțin NewMed. Nu aveți dreptul de a copia, modifica sau distribui conținutul platformei fără permisiunea noastră expresă.'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '8. Limitation of Liability' : '8. Limitarea Răspunderii'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish ? 'NewMed cannot be held liable for:' : 'NewMed nu poate fi tras la răspundere pentru:'}
              </Typography>
              <Typography variant="body1" component="ul" sx={listSx}>
                <li>{isEnglish ? 'Losses or damages resulting from the use of the platform' : 'Pierderi sau daune rezultate din utilizarea platformei'}</li>
                <li>{isEnglish ? 'Service interruptions or technical errors' : 'Întreruperi ale serviciului sau erori tehnice'}</li>
                <li>{isEnglish ? 'Actions or omissions of healthcare providers' : 'Acțiunile sau omisiunile furnizorilor de servicii medicale'}</li>
                <li>{isEnglish ? 'Loss or compromise of data due to causes beyond our control' : 'Pierderea sau compromiterea datelor din cauze în afara controlului nostru'}</li>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '9. Changes to Terms' : '9. Modificări ale Termenilor'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'We reserve the right to modify these terms at any time. You will be notified about significant changes by email or through the platform. Continued use of the services after changes constitutes acceptance of the new terms.'
                  : 'Ne rezervăm dreptul de a modifica acești termeni în orice moment. Veți fi notificat cu privire la modificările semnificative prin email sau prin intermediul platformei. Utilizarea continuă a serviciilor după modificări constituie acceptarea noilor termeni.'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '10. Account Termination' : '10. Rezilierea Contului'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'We reserve the right to suspend or close your account if you violate these terms and conditions. You have the right to request deletion of your account and your data at any time by contacting us at the provided email address.'
                  : 'Ne rezervăm dreptul de a suspenda sau închide contul dumneavoastră în cazul în care încălcați acești termeni și condiții. Aveți dreptul de a solicita ștergerea contului și a datelor dumneavoastră în orice moment, contactându-ne la adresa de email furnizată.'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '11. Governing Law' : '11. Legea Aplicabilă'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'These terms and conditions are governed by the laws of Romania. Any dispute related to these terms will be resolved by the competent courts in Romania.'
                  : 'Acești termeni și condiții sunt guvernați de legile României. Orice dispută legată de acești termeni va fi soluționată de instanțele competente din România.'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {isEnglish ? '12. Contact' : '12. Contact'}
              </Typography>
              <Typography variant="body1" paragraph>
                {isEnglish
                  ? 'For questions or concerns regarding these terms and conditions, you can contact us at:'
                  : 'Pentru întrebări sau nelămuriri legate de acești termeni și condiții, ne puteți contacta la:'}
              </Typography>
              <Typography variant="body1" component="ul" sx={listSx}>
                <li>Email: contact@newmed.ro</li>
                <li>{isEnglish ? 'Phone' : 'Telefon'}: 0723501698</li>
                <li>{isEnglish ? 'Address' : 'Adresa'}: Bulevardul Take Ionescu, Timișoara</li>
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              {isEnglish
                ? 'By creating an account on the NewMed platform, you confirm that you have read, understood, and accepted these terms and conditions.'
                : 'Prin crearea unui cont pe platforma NewMed, confirmați că ați citit, înțeles și acceptat acești termeni și condiții.'}
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
