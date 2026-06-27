import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import App from './App.jsx'
import { getTheme } from './theme'
import { ThemeModeProvider, ThemeModeContext } from './ThemeModeContext'
import { LanguageProvider } from './LanguageContext'

// Root grupeaza provider-ele globale folosite de toate paginile.
function Root() {
  return (
    <React.StrictMode>
      <LanguageProvider>
        <ThemeModeProvider>
          {/* Tema MUI se reconstruieste cand contextul dark/light se schimba. */}
          <ThemeModeContext.Consumer>
            {({ mode }) => (
              <ThemeProvider theme={getTheme(mode)}>
                <CssBaseline />
                <App />
              </ThemeProvider>
            )}
          </ThemeModeContext.Consumer>
        </ThemeModeProvider>
      </LanguageProvider>
    </React.StrictMode>
  )
}

// React monteaza aplicatia in containerul definit de Vite in index.html.
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<Root />)
