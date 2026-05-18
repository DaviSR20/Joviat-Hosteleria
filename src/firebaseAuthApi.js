import { firebaseConfig } from './firebaseConfig';

const AUTH_URI_ENDPOINT = `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${firebaseConfig.apiKey}`;
const SIGN_IN_ENDPOINT = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
const SIGN_UP_ENDPOINT = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
const UPDATE_ACCOUNT_ENDPOINT = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`;

export const checkEmailRegistered = async (email, continueUri = window.location.origin) => {
  const response = await fetch(AUTH_URI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: email,
      continueUri,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'No se pudo comprobar el correo.';
    throw new Error(message);
  }

  return Boolean(data.registered);
};

const parseAuthError = (data) => {
  const code = data?.error?.message || '';
  switch (code) {
    case 'EMAIL_NOT_FOUND':
      return 'El correo no existe.';
    case 'INVALID_EMAIL':
    case 'MISSING_EMAIL':
      return 'Inserta un correo valido.';
    case 'INVALID_PASSWORD':
      return 'Contrasena incorrecta.';
    case 'USER_DISABLED':
      return 'El usuario esta deshabilitado.';
    case 'INVALID_ID_TOKEN':
      return 'La sesion no es valida. Inicia sesion de nuevo.';
    case 'TOKEN_EXPIRED':
      return 'La sesion ha caducado. Inicia sesion de nuevo.';
    case 'EMAIL_EXISTS':
      return 'El correo ya esta registrado.';
    case 'WEAK_PASSWORD : Password should be at least 6 characters':
    case 'WEAK_PASSWORD':
      return 'La contrasena es demasiado corta (minimo 6).';
    default:
      return 'No se pudo autenticar.';
  }
};

export const signInWithEmailPassword = async (email, password) => {
  const response = await fetch(SIGN_IN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseAuthError(data));
  }

  return data;
};

export const registerWithEmailPassword = async (email, password) => {
  const response = await fetch(SIGN_UP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseAuthError(data));
  }

  return data;
};

export const updatePasswordWithIdToken = async (idToken, password) => {
  if (!idToken) {
    throw new Error('Tu sesion no es valida. Inicia sesion de nuevo.');
  }

  const response = await fetch(UPDATE_ACCOUNT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken,
      password,
      returnSecureToken: true,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseAuthError(data));
  }

  return data;
};
