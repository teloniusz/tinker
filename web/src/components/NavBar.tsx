import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Modal, Nav, Navbar, NavDropdown } from 'react-bootstrap'
import { AlertData, setAlert, useAppState } from '../AppState'
import { useLocation, useNavigate } from 'react-router-dom'

import { checkReset, getSocket, getUserInfo, logOut } from '../services'
import { UserInfo, UserDialogType } from '../models/user'
import { UserModal } from './UserModals'
import { NavLink } from 'react-router-dom'
import Container from 'react-bootstrap/Container'
import "bootstrap-icons/font/bootstrap-icons.css"


export const NavbarSection: React.FC = () => {
  const [state, dispatchState] = useAppState()
  const [showLogin, setShowLogin] = useState<UserDialogType>(false)
  const navigate = useNavigate()

  const setIsConnected = useCallback(
    (isConnected: boolean) => dispatchState({ type: 'CONNECTED', isConnected }),
    [dispatchState]
  )
  const setUserInfo = useCallback(
    (userInfo: UserInfo) => dispatchState({ type: 'USER_INFO', userInfo }),
    [dispatchState]
  )
  const doAlert = useCallback(
    (data: AlertData) => setAlert(dispatchState, data),
    [dispatchState]
  )
  const locData = useLocation()

  useEffect(() => {
    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)
    const socket = getSocket()
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    let match;
    if (locData.hash === '#confirmed') {
      doAlert({ type: 'success', text: 'Email confirmed' });
      window.location.hash = '';
      //setTimeout(() => setShowLogin('login'), 3000);
    } else if (locData.hash === '#reset') {
      doAlert({ type: 'success', text: 'Password successfully reset' });
      window.location.hash = '';
      setTimeout(() => setShowLogin('login'), 3000);
    } else if ((match = locData.pathname.match(/^\/reset\/(.+)/)) != null) {
      checkReset(match[1]).then(res => {
        if ('error' in res) {
          window.location.pathname = '/main';
          return;
        }
        setShowLogin('reset')
      });
    }
    getUserInfo().then(([status, res]) => status === 'success' && setUserInfo(res.user))

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [dispatchState, setIsConnected, setUserInfo, setShowLogin, doAlert, locData.hash, locData.pathname])

  const doLogOut = useCallback(async () => {
    await logOut();
    const [status, res] = await getUserInfo();
    if (status === 'success') {
      setUserInfo(res.user);
      doAlert({ type: 'success', text: 'Logged out successfully' });
    } else {
      doAlert({ type: 'warning', text: `Error trying to update user info: ${res}`})
    }
    navigate('/')
  }, [setUserInfo, doAlert, navigate])

  const UserDot = useCallback(
    () => {
      const info = state.userInfo;
      const showUser = `${info.first_name} ${info.last_name} (${info.id})`;
      const userMenu = <><i className="bi bi-people"></i>&nbsp;{info.id ? showUser : ''}</>;
      return <>
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
          <Navbar.Toggle aria-controls='user-menu' />
          <Navbar.Collapse id='user-menu'>
            <Nav>
              <NavDropdown title={userMenu}>
          {info.id ? <>
              {info.username !== 'demo' &&
                <NavDropdown.Item onClick={() => setShowLogin('editProfile')}>Edit Profile</NavDropdown.Item>
              }
              <NavDropdown.Item onClick={() => doLogOut()}>Log out</NavDropdown.Item>
          </> : <>
              <NavDropdown.Item onClick={() => setShowLogin('login')}>Log In</NavDropdown.Item>
              <NavDropdown.Item onClick={() => setShowLogin('register')}>Register</NavDropdown.Item>
              <NavDropdown.Item onClick={() => setShowLogin('sendreset')}>Reset Password</NavDropdown.Item>
          </>}
                  </NavDropdown>
                </Nav>
              </Navbar.Collapse>
          <div
            style={{
              background: state.isConnected ? 'green' : 'red',
              borderRadius: '10px',
              width: '20px',
              height: '20px',
              margin: '7px',
            }}></div>
        </div>
      </>
    },
    [state, doLogOut]
  )
  return (
    <>
      <Alert
        show={!!state.alert}
        variant={state.alert?.type || 'info'}
        dismissible
        transition={false}
        onClose={() => setAlert(dispatchState, null)}>
        {state.alert?.text}
      </Alert>
      <Navbar bg='light' expand={'md'}>
        <Modal show={!!showLogin} onHide={() => setShowLogin(false)}>
          <UserModal showLogin={showLogin} setShowLogin={setShowLogin} userInfo={state.userInfo} setUserInfo={setUserInfo} doAlert={doAlert} />
        </Modal>
        <Container>
          <Navbar.Brand as={NavLink} to='/'>
            <img alt='Logo UW' src='/orzelek60.png' />
            <img alt='Logo MIM' src='/mim75x60.png' />
            <img alt='Logo tINKer' src='/logo60.png' />
            &nbsp;&nbsp;tINKer
          </Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse className='justify-content-start'>
            <Nav className='m-auto'>
              <Nav.Link as={NavLink} to='/'>
                Home
              </Nav.Link>
              {state.userInfo.id ? <Nav.Link as={NavLink} to='/datafiles'>Data Files</Nav.Link> : <></>}
            </Nav>
            <UserDot />
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </>
  )
}
