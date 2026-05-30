import { useEffect, useState } from 'react';
import {
  API_HEALTH_URL,
  checkApiHealth,
  forgotPasswordApi,
  loginApi,
  registerClientApi,
  resetPasswordApi,
} from '../../utils/api';

const OTP_CODE = '1234';
const PHONE_STORAGE_KEY = 'pos2-client-phone';
const AUTH_STORAGE_KEY = 'pos2-client-auth';

function ClientAuth({ initialMode = 'sign-in', onAuthenticated, onBackToMenu }) {
  const [mode, setMode] = useState(initialMode === 'sign-up' ? 'register' : 'login');
  const [phone, setPhone] = useState(() => localStorage.getItem(PHONE_STORAGE_KEY) || '');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode === 'sign-up' ? 'register' : 'login');
    setOtpSent(false);
    setError('');
    setMessage('');
  }, [initialMode]);

  const rememberAuth = (auth) => {
    if (auth.role !== 'CLIENT') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      throw new Error('Ce compte existe, mais il n est pas un compte client.');
    }

    localStorage.setItem(PHONE_STORAGE_KEY, auth.phone);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    onAuthenticated?.({
      phone: auth.phone,
      name: auth.name,
      role: auth.role,
      points: auth.points,
    });
  };

  const getAuthErrorMessage = async (apiError) => {
    if (
      !apiError.message?.includes('Backend indisponible') &&
      !apiError.message?.includes('API inaccessible')
    ) {
      return apiError.message || 'Connexion impossible.';
    }

    try {
      await checkApiHealth();
      return `API active (${API_HEALTH_URL}), mais la connexion a expire. Reessayez ou verifiez la console Spring Boot.`;
    } catch {
      return `API inaccessible depuis cette interface: ${API_HEALTH_URL}. Verifiez que Spring Boot tourne et que l'adresse est joignable.`;
    }
  };

  const validatePhone = () => {
    if (!phone.trim()) {
      setError('Veuillez entrer votre numero de telephone.');
      return false;
    }
    return true;
  };

  const startOtp = () => {
    if (!validatePhone()) return;
    localStorage.setItem(PHONE_STORAGE_KEY, phone.trim());
    setOtpSent(true);
    setError('');
    setMessage(`Code envoye : ${OTP_CODE}`);
  };

  const submitRegister = async () => {
    if (!validatePhone()) return;
    if (!name.trim()) {
      setError('Veuillez entrer votre nom.');
      return;
    }
    if (otp !== OTP_CODE) {
      setError('Code OTP incorrect. Utilisez 1234.');
      return;
    }
    if (password.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const auth = await registerClientApi({
        phone: phone.trim(),
        otp,
        password,
        name: name.trim(),
      });
      rememberAuth(auth);
    } catch (apiError) {
      setError(await getAuthErrorMessage(apiError));
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async () => {
    if (!validatePhone()) return;
    if (!password) {
      setError('Veuillez entrer votre mot de passe.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const auth = await loginApi({ phone: phone.trim(), password });
      rememberAuth(auth);
    } catch (apiError) {
      setError(await getAuthErrorMessage(apiError));
    } finally {
      setLoading(false);
    }
  };

  const submitForgotPassword = async () => {
    if (!validatePhone()) return;
    setLoading(true);
    setError('');

    try {
      const response = await forgotPasswordApi({ phone: phone.trim() });
      setOtpSent(true);
      setMode('reset');
      setMessage(response.message || `Code envoye : ${OTP_CODE}`);
    } catch (apiError) {
      setError(apiError.message || 'Impossible de recuperer le compte.');
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async () => {
    if (!validatePhone()) return;
    if (otp !== OTP_CODE) {
      setError('Code OTP incorrect. Utilisez 1234.');
      return;
    }
    if (newPassword.length < 4) {
      setError('Le nouveau mot de passe doit contenir au moins 4 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPasswordApi({ phone: phone.trim(), otp, newPassword });
      setPassword(newPassword);
      setNewPassword('');
      setOtp('');
      setOtpSent(false);
      setMode('login');
      setMessage('Mot de passe modifie. Connectez-vous maintenant.');
    } catch (apiError) {
      setError(apiError.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="client-auth-card auth-flow-card">
      <div>
        <p className="eyebrow">Compte client</p>
        <h2>
          {mode === 'register' && 'Creer un compte'}
          {mode === 'login' && 'Se connecter'}
          {mode === 'forgot' && 'Mot de passe oublie'}
          {mode === 'reset' && 'Nouveau mot de passe'}
        </h2>
        <p>
          {mode === 'register'
            ? 'Verifiez votre telephone avec OTP, puis choisissez un mot de passe.'
            : 'Utilisez votre telephone et votre mot de passe pour garder vos recompenses.'}
        </p>
      </div>

      <div className="auth-mode-tabs">
        <button
          className={mode === 'login' ? 'is-active' : ''}
          type="button"
          onClick={() => {
            setMode('login');
            setOtpSent(false);
            setError('');
          }}
        >
          Connexion
        </button>
        <button
          className={mode === 'register' ? 'is-active' : ''}
          type="button"
          onClick={() => {
            setMode('register');
            setOtpSent(false);
            setError('');
          }}
        >
          Inscription
        </button>
      </div>

      <label className="field">
        Telephone
        <input
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Ex: 0612345678"
          type="tel"
          value={phone}
        />
      </label>

      {mode === 'register' && (
        <>
          <label className="field">
            Nom
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Youssef"
              type="text"
              value={name}
            />
          </label>

          {!otpSent ? (
            <button className="secondary-action" type="button" onClick={startOtp}>
              Envoyer le code OTP
            </button>
          ) : (
            <>
              <label className="field">
                Code OTP
                <input
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="1234"
                  type="text"
                  value={otp}
                />
              </label>
              <label className="field">
                Mot de passe
                <input
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Choisir un mot de passe"
                  type="password"
                  value={password}
                />
              </label>
              <button className="primary-button" disabled={loading} type="button" onClick={submitRegister}>
                Creer le compte
              </button>
            </>
          )}
        </>
      )}

      {mode === 'login' && (
        <>
          <label className="field">
            Mot de passe
            <input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Votre mot de passe"
              type="password"
              value={password}
            />
          </label>
          <button className="primary-button" disabled={loading} type="button" onClick={submitLogin}>
            Se connecter
          </button>
          <button className="auth-text-button" type="button" onClick={() => setMode('forgot')}>
            Mot de passe oublie ?
          </button>
        </>
      )}

      {mode === 'forgot' && (
        <>
          <button className="primary-button" disabled={loading} type="button" onClick={submitForgotPassword}>
            Recuperer le code OTP
          </button>
          <button className="auth-text-button" type="button" onClick={() => setMode('login')}>
            Retour connexion
          </button>
        </>
      )}

      {mode === 'reset' && (
        <>
          <label className="field">
            Code OTP
            <input
              onChange={(event) => setOtp(event.target.value)}
              placeholder="1234"
              type="text"
              value={otp}
            />
          </label>
          <label className="field">
            Nouveau mot de passe
            <input
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Nouveau mot de passe"
              type="password"
              value={newPassword}
            />
          </label>
          <button className="primary-button" disabled={loading} type="button" onClick={submitResetPassword}>
            Modifier le mot de passe
          </button>
        </>
      )}

      {message && <p className="auth-message">{message}</p>}
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-text-button" type="button" onClick={onBackToMenu}>
        Revenir au menu
      </button>
    </section>
  );
}

export default ClientAuth;
