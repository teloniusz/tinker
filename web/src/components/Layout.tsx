import React, { Fragment, ReactNode } from 'react'
import Container from 'react-bootstrap/Container'
import { NavbarSection } from './NavBar'
import classes from './Layout.module.css'
import Footer from './Footer'

const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <Container fluid className='m-3 mx-auto shadow' style={{ paddingBottom: '20px' }}>
      <Fragment>
        <NavbarSection />
        <main className={classes.main}>{children}</main>
        <Footer />
      </Fragment>
    </Container>
  )
}
export default Layout
