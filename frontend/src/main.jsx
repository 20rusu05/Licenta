import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import App from './App.jsx'
import { getTheme } from './theme'
import { ThemeModeProvider, ThemeModeContext } from './ThemeModeContext'

function Root() {
  return (
    <React.StrictMode>
      <ThemeModeProvider>
        <ThemeModeContext.Consumer>
          {({ mode }) => (
            <ThemeProvider theme={getTheme(mode)}>
              <CssBaseline />
              <App />
            </ThemeProvider>
          )}
        </ThemeModeContext.Consumer>
      </ThemeModeProvider>
    </React.StrictMode>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<Root />)