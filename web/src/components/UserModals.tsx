import React, { FormEvent, useCallback, useMemo, useState } from 'react'
import { GoogleReCaptcha, useGoogleReCaptcha } from "react-google-recaptcha-v3"
import { Alert, Button, Form, Modal } from 'react-bootstrap'
import { TTip } from './Tooltip'

import { UserDialogType, UserInfo } from '../models/user'
import { AlertData } from '../AppState'
import { getUserInfo, logIn, register, reset, sendReset, updateUser } from '../services'
import { useLocation } from 'react-router-dom'
import { is_success } from '../models/network'
import { FormItem } from './FormItem'


export const UserModal: React.FC<{
  showLogin: UserDialogType
  setShowLogin: (el: UserDialogType) => void
  userInfo: UserInfo
  setUserInfo: (userInfo: UserInfo) => void
  doAlert: (data: AlertData) => void
}> = ({ showLogin, setShowLogin, userInfo, setUserInfo, doAlert }) => {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const doLogIn = useCallback(async (user: string, password: string) => {
    const [status, res] = await logIn(user, password);
    if (status === 'error') {
      doAlert({ type: 'warning', text: `Login error: ${res}` });
    } else {
      doAlert({ type: 'success', text: 'Logged in successfully' });
      const [status, res] = await getUserInfo();
      if (status === 'success') {
        setUserInfo(res.user);
      }
    }
    setShowLogin(false);
  }, [doAlert, setShowLogin, setUserInfo]);

  const doRegister = useCallback(async (username: string, email: string, password: string, captchaToken: string) => {
    const res = await register({ username, email, password, token: captchaToken });
    console.log('register:', res)
    if (is_success(res)) {
      doAlert({ type: 'success', text: 'Register request sent. Please wait for a confirmation email.'});
      setShowLogin(false);
    } else {
      doAlert({ type: 'error', text: 'Error in the register form'});
      setErrors(res.response.field_errors)
    }
  }, [doAlert, setShowLogin, setErrors])

  const doSendReset = useCallback(async (email: string, captchaToken: string) => {
    const res = await sendReset({ email, token: captchaToken });
    console.log('send reset:', res)
    doAlert({ type: 'success', text: 'Reset password request sent. Please wait for an email with a link to the password reset form.'});
    setShowLogin(false);
  }, [doAlert, setShowLogin])

  const doReset = useCallback(async (password: string, password_confirm: string, key: string, captchaToken: string) => {
    const res = await reset({ password, password_confirm, key, token: captchaToken });
    console.log('reset:', res)
    doAlert({ type: 'success', text: 'Password successfully reset. You can attempt to log in now.'});
    setShowLogin(false);
  }, [doAlert, setShowLogin])

  const doEditProfile = useCallback(async (
    first_name: string, last_name: string, password: string | null, email: string, captchaToken: string
  ) => {
    const res = await updateUser({ first_name, last_name, password, email, token: captchaToken });
    console.log('update_user:', res)
    if (is_success(res)) {
      doAlert({ type: 'success', text: 'User profile updated.'});
      setShowLogin(false);
      const [status, res] = await getUserInfo();
      if (status === 'success') {
        setUserInfo(res.user);
      }
    } else {
      doAlert({ type: 'error', text: 'Error in the user profile form.'});
      setErrors(res.response.field_errors)
    }
  }, [doAlert, setShowLogin, setUserInfo])

  const loc = useLocation();
  const resetToken = useMemo(() => (loc.pathname.startsWith('/reset/') && loc.pathname.split('/')[2]) || null, [loc]);
  switch (showLogin) {
    case 'login':
      return <LoginModal setShowLogin={setShowLogin} logIn={doLogIn} />
    case 'register':
      return <RegisterModal setShowLogin={setShowLogin} registerUser={doRegister}{...{ errors, setErrors }} />
    case 'sendreset':
      return <SendResetModal setShowLogin={setShowLogin} sendResetPassword={doSendReset}{...{ errors, setErrors }} />
    case 'editProfile':
      return <UserProfileModal setShowLogin={setShowLogin} updateProfile={doEditProfile}{...{ userInfo, errors, setErrors }} />
    case 'reset':
      if (resetToken)
        return <ResetModal setShowLogin={setShowLogin} resetPassword={doReset} resetToken={resetToken} {...{ errors, setErrors }} />
      setShowLogin(false);
      return <></>
    default:
      return <></>
  }
}

const LoginModal: React.FC<{
  setShowLogin: (el: UserDialogType) => void
  logIn: (username: string, password: string) => void
}> = ({ setShowLogin, logIn }) => {
  const onSubmit = (ev: FormEvent<HTMLElement>) => {
    ev.preventDefault()
    const formData = new FormData(ev.target as HTMLFormElement)
    const dataObj = Object.fromEntries(formData)
    logIn(dataObj.username as string, dataObj.password as string)
  }
  return (
    <Form onSubmit={onSubmit}>
      <Modal.Header closeButton>
        <Modal.Title>Login</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <TTip
          text={
            <>
              To use a test account, enter <strong>demo</strong> as a username and leave password empty.
            </>
          }><>
          <FormItem name='username' required />
          <FormItem name='password' />
        </>
        </TTip>
        <Form.Group>
          <br/>
          <Button variant='secondary' onClick={() => setShowLogin('register')}>
            Register
          </Button>
          &nbsp;
          <Button variant='secondary' onClick={() => setShowLogin('sendreset')}>
            Reset password
          </Button>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='primary' type='submit'>
          Login
        </Button>
        <Button variant='secondary' onClick={() => setShowLogin(false)}>
          Close
        </Button>
      </Modal.Footer>
    </Form>
  )
}

export const RegisterModal: React.FC<{
  setShowLogin: (el: UserDialogType) => void;
  registerUser: (username: string, email: string, password: string, captchaToken: string) => Promise<void>;
  errors: Record<string, string[]>;
  setErrors: (el: Record<string, string[]>) => void;
}> = ({ setShowLogin, registerUser, errors, setErrors }) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, [setCaptchaToken]);

  const onSubmit = useCallback(async (ev: FormEvent<HTMLElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.target as HTMLFormElement);
    const dataObj = Object.fromEntries(formData);

    if (!captchaToken) {
      alert('Please complete the CAPTCHA to proceed.');
      return;
    }

    if (dataObj.password !== dataObj.password_confirm) {
      setErrors({ password: ['Passwords do not match'], password_confirm: ['Passwords do not match'] });
      return;
    }

    await registerUser(
      dataObj.username as string,
      dataObj.email as string,
      dataObj.password as string,
      captchaToken
    );
    if (errors && executeRecaptcha) {
      setCaptchaToken(await executeRecaptcha());
    }
  }, [captchaToken, registerUser, setErrors, errors, executeRecaptcha]);

  return (
    <Form onSubmit={onSubmit}>
      <Modal.Header closeButton>
        <Modal.Title>Register</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errors._ && <Alert variant='danger'>{errors._.join(", ")}</Alert>}
        <TTip
          text={
            <>
              Please fill in the details below to create an account. Ensure you use a valid email address.
            </>
          }
        >
          <FormItem name='username' placeholder='Choose a username' {...{ errors }} required />
        </TTip>
        <FormItem name='email' placeholder='Enter your email' {...{ errors }} required />
        <FormItem name='password' errors={errors} required />
        <FormItem name='password_confirm' label='Retype password' placeholder='Retype your password' {...{ errors }} required />
        <Form.Group>
          <div id="captcha">
            <GoogleReCaptcha onVerify={handleCaptchaChange} />
          </div>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" type="submit">
          Register
        </Button>
        <Button variant="secondary" onClick={() => setShowLogin(false)}>
          Close
        </Button>
      </Modal.Footer>
    </Form>
  );
};

export const SendResetModal: React.FC<{
  setShowLogin: (el: UserDialogType) => void;
  sendResetPassword: (email: string, captchaToken: string) => Promise<void>;
  errors: Record<string, string[]>;
  setErrors: (el: Record<string, string[]>) => void;
}> = ({ setShowLogin, sendResetPassword, errors }) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, [setCaptchaToken]);

  const onSubmit = useCallback(async (ev: FormEvent<HTMLElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.target as HTMLFormElement);
    const dataObj = Object.fromEntries(formData);

    if (!captchaToken) {
      alert('Please complete the CAPTCHA to proceed.');
      return;
    }

    await sendResetPassword(
      dataObj.email as string,
      captchaToken
    );
  }, [captchaToken, sendResetPassword]);

  return (
    <Form onSubmit={onSubmit}>
      <Modal.Header closeButton>
        <Modal.Title>Send password reset instructions</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errors._ && <Alert variant='danger'>{errors._.join(", ")}</Alert>}
        <TTip
          text={
            <>
              Please fill in the details below to receive an email with reset instructions. Ensure you use a valid email address.
            </>
          }
        >
          <FormItem name='email' required />
        </TTip>
        <Form.Group>
          <div id="captcha">
            <GoogleReCaptcha onVerify={handleCaptchaChange} />
          </div>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" type="submit">
          Recover password
        </Button>
        <Button variant="secondary" onClick={() => setShowLogin(false)}>
          Close
        </Button>
      </Modal.Footer>
    </Form>
  );
};

export const ResetModal: React.FC<{
  setShowLogin: (el: UserDialogType) => void;
  resetPassword: (password: string, password_confirm: string, key: string, captchaToken: string) => Promise<void>;
  resetToken: string;
  errors: Record<string, string[]>;
  setErrors: (el: Record<string, string[]>) => void;
}> = ({ setShowLogin, resetPassword, resetToken, errors, setErrors }) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, [setCaptchaToken]);

  const onSubmit = useCallback(async (ev: FormEvent<HTMLElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.target as HTMLFormElement);
    const dataObj = Object.fromEntries(formData);

    if (!captchaToken) {
      alert('Please complete the CAPTCHA to proceed.');
      return;
    }

    if (dataObj.password !== dataObj.password_confirm) {
      setErrors({ password: ['Passwords do not match'], password_confirm: ['Passwords do not match'] });
      return;
    }

    await resetPassword(
      dataObj.password as string,
      dataObj.password_confirm as string,
      resetToken,
      captchaToken
    );
    if (errors && executeRecaptcha) {
      setCaptchaToken(await executeRecaptcha());
    }
  }, [captchaToken, resetPassword, resetToken, setErrors, errors, executeRecaptcha]);

  return (
    <Form onSubmit={onSubmit}>
      <Modal.Header closeButton>
        <Modal.Title>Send password reset instructions</Modal.Title>
      </Modal.Header>
      <Modal.Body>
      {errors._ && <Alert variant='danger'>{errors._.join(", ")}</Alert>}
        <TTip
          text={
            <>
              Please type your new password. Repeat to make sure it's correct.
            </>
          }
        >
          <>
            <FormItem name='password' required {...{ errors }} />
            <FormItem name='password_confirm' label='Retype password' placeholder='Retype your password' required {...{ errors }} />
          </>
        </TTip>
        <Form.Group>
          <div id="captcha">
            <GoogleReCaptcha onVerify={handleCaptchaChange} />
          </div>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" type="submit">
          Reset password
        </Button>
        <Button variant="secondary" onClick={() => setShowLogin(false)}>
          Close
        </Button>
      </Modal.Footer>
    </Form>
  );
};

export const UserProfileModal: React.FC<{
  setShowLogin: (el: UserDialogType) => void;
  updateProfile: (first_name: string, last_name: string, password: string | null, email: string, captchaToken: string) => Promise<void>;
  userInfo: UserInfo;
  errors: Record<string, string[]>;
  setErrors: (el: Record<string, string[]>) => void;
}> = ({ setShowLogin, updateProfile, userInfo, errors, setErrors }) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, [setCaptchaToken]);

  const onSubmit = useCallback(async (ev: FormEvent<HTMLElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.target as HTMLFormElement);
    const dataObj = Object.fromEntries(formData);

    if (!captchaToken) {
      alert('Please complete the CAPTCHA to proceed.');
      return;
    }

    if (dataObj.password !== dataObj.password_confirm) {
      setErrors({ password: ['Passwords do not match'], password_confirm: ['Passwords do not match'] });
      return;
    }

    await updateProfile(
      dataObj.first_name as string,
      dataObj.last_name as string,
      dataObj.password ? dataObj.password as string : null,
      dataObj.email as string,
      captchaToken
    );
    if (errors && executeRecaptcha) {
      setCaptchaToken(await executeRecaptcha());
    }
  }, [captchaToken, updateProfile, setErrors, errors, executeRecaptcha]);

  return (
    <Form onSubmit={onSubmit}>
      <Modal.Header closeButton>
        <Modal.Title>Edit user profile</Modal.Title>
      </Modal.Header>
      <Modal.Body>
      {errors._ && <Alert variant='danger'>{errors._.join(", ")}</Alert>}
        <FormItem name="username" value={userInfo.username} readOnly />
        <FormItem name="first_name" defaultValue={userInfo.first_name} {...{ errors }} />
        <FormItem name="last_name" defaultValue={userInfo.last_name} {...{ errors }} />
        <FormItem name="email" defaultValue={userInfo.email} {...{ errors }} />
        <TTip text="Omit the password to keep it unchanged"><>
          <FormItem name='password' {...{ errors }} />
          <FormItem name='password_confirm' label='Retype password' placeholder='Retype your password' {...{ errors }} />
        </></TTip>
        <Form.Group>
          <div id="captcha">
            <GoogleReCaptcha onVerify={handleCaptchaChange} />
          </div>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" type="submit">
          Save Changes
        </Button>
        <Button variant="secondary" onClick={() => setShowLogin(false)}>
          Close
        </Button>
      </Modal.Footer>
    </Form>
  );
};