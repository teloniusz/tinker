import { AppStateProvider } from './AppState'
import Layout from './components/Layout'
import { Navigate, Route, Routes } from 'react-router-dom'
import MainPage from './pages/MainPage'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'

function App() {
  return (
    <AppStateProvider>
      <GoogleReCaptchaProvider reCaptchaKey="6LfaQZcqAAAAANlPFH4dbtj6i9t8lDsZvL0M0FIH">
        <Layout>
          <Routes>
            <Route path='/' element={<Navigate replace={true} to='/main' />} />
            <Route path='/main' element={<MainPage />} />
            <Route path='/reset/*' element={<MainPage />} />
            <Route path='/*' element={<h2>page not found</h2>} />
          </Routes>
        </Layout>
      </GoogleReCaptchaProvider>
    </AppStateProvider>
  )
}

export default App
