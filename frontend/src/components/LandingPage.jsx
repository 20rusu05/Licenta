import { Box, Container, Typography, Button, Grid, Paper, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MedicationIcon from '@mui/icons-material/Medication';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import LanguageToggle from './layout/LanguageToggle';
import { useLanguage } from '../LanguageContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const isEnglish = lang === 'en';

  const features = [
    {
      icon: <CalendarMonthIcon sx={{ fontSize: 48 }} />,
      title: isEnglish ? 'Online appointments' : 'Programări Online',
      description: isEnglish ? 'Book quickly and easily with your preferred doctor, anytime and anywhere.' : 'Programează-te rapid și simplu la medicul tău preferat, oricând și de oriunde.',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      icon: <MedicationIcon sx={{ fontSize: 48 }} />,
      title: isEnglish ? 'Medication management' : 'Gestionare Medicamente',
      description: isEnglish ? 'Track your medication and receive treatment notifications.' : 'Ține evidența medicamentelor tale și primește notificări despre tratament.',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      icon: <PeopleIcon sx={{ fontSize: 48 }} />,
      title: isEnglish ? 'Medical history' : 'Istoric Medical',
      description: isEnglish ? 'Access your consultations and treatment history anytime.' : 'Accesează oricând istoricul consultațiilor și al tratamentelor tale.',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      centered: true
    },
    {
      icon: <LocalHospitalIcon sx={{ fontSize: 48 }} />,
      title: isEnglish ? 'Medical team' : 'Echipă Medicală',
      description: isEnglish ? 'Specialized doctors ready to provide the care you need.' : 'Doctori specializați gata să îți ofere îngrijirea de care ai nevoie.',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      centered: true
    }
  ];

  const benefits = [
    isEnglish ? 'Fast and simple appointments' : 'Programări rapide și simple',
    isEnglish ? '24/7 access to your medical information' : 'Acces 24/7 la informațiile tale medicale',
    isEnglish ? 'Direct communication with your doctor' : 'Comunicare directă cu medicul',
    isEnglish ? 'Automatic appointment notifications' : 'Notificări automate pentru programări',
    isEnglish ? 'Full consultation history' : 'Istoric complet al consultațiilor',
    isEnglish ? 'Maximum data security' : 'Securitate maximă a datelor'
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header/Navbar */}
      <Box 
        sx={{ 
          py: 2,
          px: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalHospitalIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
            NewMed
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LanguageToggle />
          <Button 
            variant="outlined" 
            onClick={() => navigate('/login')}
            sx={{ px: 3 }}
          >
            {isEnglish ? 'Login' : 'Autentificare'}
          </Button>
          <Button 
            variant="contained" 
            onClick={() => navigate('/register')}
            sx={{ 
              px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          >
            {isEnglish ? 'Sign Up' : 'Creează cont'}
          </Button>
        </Box>
      </Box>

      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
          py: 12,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Background decoration */}
        <Box
          sx={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            opacity: 0.1,
            filter: 'blur(80px)'
          }}
        />
        
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography 
              variant="h2" 
              sx={{ 
                fontWeight: 800, 
                mb: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              {isEnglish ? 'Your health, one click away' : 'Sănătatea ta, la un click distanță'}
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, color: 'text.secondary', lineHeight: 1.8, maxWidth: 800, mx: 'auto' }}>
              {isEnglish
                ? 'NewMed simplifies access to quality healthcare. Book appointments online, manage your medication, and stay connected with your doctor.'
                : 'NewMed este platforma care simplifică accesul la servicii medicale de calitate. Programează-te online, gestionează-ți medicamentele și păstrează legătura cu medicul tău.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                size="large"
                onClick={() => navigate('/register')}
                sx={{ 
                  py: 1.5,
                  px: 4,
                  fontSize: '1.1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
                }}
              >
                {isEnglish ? 'Get started' : 'Începe acum'}
              </Button>
              <Button 
                variant="outlined" 
                size="large"
                onClick={() => navigate('/login')}
                sx={{ py: 1.5, px: 4, fontSize: '1.1rem' }}
              >
                {isEnglish ? 'Login' : 'Autentificare'}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
  <Container maxWidth="lg" sx={{ py: 10 }}>
       <Typography variant="h3" align="center" sx={{ fontWeight: 700, mb: 2 }}>
          {isEnglish ? 'Why NewMed?' : 'De ce NewMed?'}
        </Typography>
        <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 8 }}>
          {isEnglish ? 'Everything you need for better health, all in one place.' : 'Totul ce ai nevoie pentru o sănătate perfectă, într-un singur loc.'}
        </Typography>

        <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
          {features.map((feature, index) => (
            <Grid
              size={{ xs: 12, sm: 6, md: 3 }}
              key={index}
              sx={feature.centered ? { display: 'flex', justifyContent: 'center' } : {}}
            >
              <Card
                sx={{
                  height: '100%',
                  minHeight: 280,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 8
                  }
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 3,
                      background: feature.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, fontSize: '1.1rem', minHeight: '2.2rem' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Benefits Section */}
      <Box sx={{ bgcolor: 'background.paper', py: 10 }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 3 }}>
                {isEnglish ? 'Benefits for you' : 'Beneficii pentru tine'}
              </Typography>
              <Grid container spacing={2}>
                {benefits.map((benefit, index) => (
                  <Grid size={{ xs: 12 }} key={index}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                      <Typography variant="body1">{benefit}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 6 }}>
                  <Paper
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white'
                    }}
                  >
                    <SpeedIcon sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      24/7
                    </Typography>
                    <Typography variant="body2">
                      {isEnglish ? 'Availability' : 'Disponibilitate'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Paper
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white'
                    }}
                  >
                    <SecurityIcon sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      100%
                    </Typography>
                    <Typography variant="body2">
                      {isEnglish ? 'Security' : 'Securitate'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Paper
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      color: 'white'
                    }}
                  >
                    <PeopleIcon sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      1000+
                    </Typography>
                    <Typography variant="body2">
                      {isEnglish ? 'Happy patients' : 'Pacienți mulțumiți'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Despre Noi Section */}
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Typography variant="h3" align="center" sx={{ fontWeight: 700, mb: 2 }}>
          {isEnglish ? 'About Us' : 'Despre Noi'}
        </Typography>
        <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 6 }}>
          {isEnglish ? 'Who we are and what drives us' : 'Cine suntem și ce ne motivează'}
        </Typography>

        <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              {isEnglish ? 'Our mission' : 'Misiunea noastră'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
              {isEnglish
                ? 'NewMed was created to revolutionize access to healthcare services. We believe technology can make medicine more accessible, efficient, and friendly for every patient.'
                : 'NewMed a fost creată cu scopul de a revoluționa accesul la serviciile medicale în România. Credem că tehnologia poate face medicina mai accesibilă, mai eficientă și mai prietenoasă pentru fiecare pacient.'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
              {isEnglish
                ? 'Our team is made up of medical professionals and technology experts who work together to provide the best digital healthcare solutions. We will continue to innovate and improve the platform to meet the changing needs of patients and doctors.'
                : 'Echipa noastră este formată din profesioniști medicali și experți în tehnologie care lucrează împreună pentru a oferi cele mai bune soluții digitale în domeniul sănătății. Vom continua să inovăm și să îmbunătățim platforma pentru a răspunde nevoilor în continuă schimbare ale pacienților și medicilor.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, mt: 4 }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  5+
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isEnglish ? 'Years of experience' : 'Ani experiență'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  50+
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isEnglish ? 'Partner doctors' : 'Doctori parteneri'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  24/7
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isEnglish ? 'Support available' : 'Suport disponibil'}
                </Typography>
              </Box>
            </Box>
          </Box>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          py: 10,
          color: 'white'
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" align="center" sx={{ fontWeight: 700, mb: 3 }}>
            {isEnglish ? 'Start today!' : 'Începe astăzi!'}
          </Typography>
          <Typography variant="h6" align="center" sx={{ mb: 5, opacity: 0.9 }}>
            {isEnglish
              ? 'Join the NewMed community and discover a new way to manage your health'
              : 'Alătură-te comunității NewMed și descoperă o nouă modalitate de a-ți gestiona sănătatea'}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button 
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{ 
                py: 2,
                px: 5,
                fontSize: '1.1rem',
                bgcolor: 'white',
                color: 'primary.main',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
              }}
            >
              {isEnglish ? 'Create a free account' : 'Creează cont gratuit'}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: 'background.paper', py: 4, borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" align="center" color="text.secondary">
            {isEnglish ? '© 2025 NewMed. All rights reserved.' : '© 2025 NewMed. Toate drepturile rezervate.'}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
