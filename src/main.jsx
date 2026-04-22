import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { DataProvider } from './contexts/DataContext'
import { ThemeProvider, THEME_STORAGE_KEY } from './contexts/ThemeContext'
import './index.css'

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <DataProvider>
              <App />
            </DataProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
