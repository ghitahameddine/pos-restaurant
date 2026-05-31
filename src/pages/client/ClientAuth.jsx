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
const MODE_COPY = {
  login: {
    title: 'Se connecter',
    description: 'Connectez-vous avec votre telephone et votre mot de passe pour garder vos points.',
  },
  register: {
    title: 'Creer un compte',
    description: 'Verifiez votre telephone avec le code OTP, puis choisissez un mot de passe.',
  },
  forgot: {
    title: 'Reinitialiser le mot de passe',
    description: 'Entrez votre telephone. Le systeme envoie un code OTP simule pour proteger le compte.',
  },
  reset: {
    title: 'Nouveau mot de passe',
    description: 'Saisissez le code OTP recu, puis choisissez un nouveau mot de passe.',
  },
};

function ClientAuth({ initialMode = 'sign-in', onAuthenticated, onBackToMenu }) {
  const getInitialAuthMode = (value) => {
    if (value === 'sign-up') return 'register';
    if (value === 'reset-password') return 'forgot';
    return 'login';
  };

  const [mode, setMode] = useState(() => getInitialAuthMode(initialMode));
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
    setMode(getInitialAuthMode(initialMode));
    setOtpSent(false);
    setError('');
    setMessage('');
  }, [initialMode]);

  const goToMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setMessage('');

    if (nextMode === 'login') {
      setOtpSent(false);
      setOtp('');
      setNewPassword('');
    }

    if (nextMode === 'register') {
      setOtpSent(false);
      setOtp('');
      setPassword('');
      setNewPassword('');
    }
  };

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
      setOtp('');
      setNewPassword('');
      setMessage(response.message || `Code envoye : ${OTP_CODE}`);
    } catch (apiError) {
      setError(await getAuthErrorMessage(apiError));
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
        <h2>{MODE_COPY[mode].title}</h2>
        <p>{MODE_COPY[mode].description}</p>
      </div>

      <div className="auth-mode-tabs">
        <button
          className={mode === 'login' ? 'is-active' : ''}
          type="button"
          onClick={() => goToMode('login')}
        >
          Connexion
        </button>
        <button
          className={mode === 'register' ? 'is-active' : ''}
          type="button"
          onClick={() => goToMode('register')}
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
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          <button className="auth-text-button" type="button" onClick={() => goToMode('forgot')}>
            Reinitialiser mon mot de passe
          </button>
        </>
      )}

      {mode === 'forgot' && (
        <>
          <p className="auth-helper">
            Le code de test est toujours 1234. Aucun SMS reel n est envoye pour le moment.
          </p>
          <button className="primary-button" disabled={loading} type="button" onClick={submitForgotPassword}>
            {loading ? 'Envoi...' : 'Envoyer le code OTP'}
          </button>
          <button className="auth-text-button" type="button" onClick={() => goToMode('login')}>
            Retour a la connexion
          </button>
        </>
      )}

      {mode === 'reset' && (
        <>
          <p className="auth-helper">Code envoye : 1234</p>
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
            {loading ? 'Modification...' : 'Valider le nouveau mot de passe'}
          </button>
          <button className="auth-text-button" disabled={loading} type="button" onClick={submitForgotPassword}>
            Renvoyer le code OTP
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
