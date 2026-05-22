import { AppStateProvider, useAppState } from './AppState'
import Layout from './components/Layout'
import { Navigate, Route, Routes, BrowserRouter as Router } from 'react-router-dom'
import MainPage from './pages/MainPage'
import DataSetsPage from './pages/DataFilesPage'
import InksnetPage from './pages/InksnetPage'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import { useCallback, ReactElement } from 'react'


function AllRoutes() {
  const baseUrl = '/tinker';
  const [state, ] = useAppState()
  const Auth = useCallback(({ children }: { children: ReactElement }) => {
    if (!state.userInfoReady)
      return null;
    return state.userInfo.id ? children : <Navigate to='/main' replace={true} />
  }, [state]);
  const pathname = window.location.pathname.slice(baseUrl.length);
  const resetToken = (pathname.startsWith('/reset/') && pathname.split('/')[2]) || null;

  return <Router basename={baseUrl}>
    <Layout baseUrl={baseUrl}>
      <Routes>
        <Route path='/' element={<Navigate replace={true} to='/main' />} />
        <Route path='/main' element={<MainPage baseUrl={baseUrl} />} />
        <Route path='/datasets' element={<Auth><DataSetsPage /></Auth>} />
        <Route path='/inksnet/:id' element={<Auth><InksnetPage /></Auth>} />
        {resetToken ? <Route path='/reset/*' element={<Navigate replace={true} to={`/main#reset/${resetToken}`} />} /> : ''}
        <Route path='/*' element={<h2>page not found</h2>} />
      </Routes>
    </Layout>
  </Router>
}


function App() {
  return (
    <AppStateProvider>
      <GoogleReCaptchaProvider reCaptchaKey="6LfaQZcqAAAAANlPFH4dbtj6i9t8lDsZvL0M0FIH">
        <AllRoutes/>
      </GoogleReCaptchaProvider>
    </AppStateProvider>
  )
}

export default App
