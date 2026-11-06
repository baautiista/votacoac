'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useApp } from './app-provider';
import { ApiError } from '@/lib/api';
import { Eye, EyeOff, ArrowRight, KeyRound } from 'lucide-react';
export function AuthDialog() {
  const { authMode, openAuth, closeAuth, mutate } = useApp();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [owner, setOwner] = useState(false); const [show, setShow] = useState(false); const [recovery, setRecovery] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => { setError(''); setOwner(false); setShow(false); setRecovery(''); }, [authMode]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true); setError(''); setOwner(false);
    try {
      const result = await mutate<{ recoveryCode?: string }>(`/api/auth/${authMode}`, 'POST', data);
      if (result.recoveryCode) setRecovery(result.recoveryCode); else closeAuth();
    } catch (err) { setError((err as Error).message); setOwner(err instanceof ApiError && err.code === 'admin_owner_verification'); }
    finally { setBusy(false); }
  };
  const title = recovery ? 'Guarda tu código' : authMode === 'register' ? 'Tu sitio en el carnaval.' : authMode === 'recover' ? 'Recupera tu cuenta' : 'Qué bueno verte de nuevo.';
  return <Dialog open={authMode !== null} onOpenChange={open => { if (!open && !busy) closeAuth(); }}><DialogContent className="auth-modal"><DialogHeader><span className="mini-label">votaCOAC · COAC 2027</span><DialogTitle className="auth-title">{title}</DialogTitle><DialogDescription>{recovery ? 'Este código permite recuperar tu cuenta si olvidas la contraseña. Cópialo y guárdalo en un lugar seguro.' : authMode === 'recover' ? 'Usa el código que recibiste al crear tu cuenta para elegir una contraseña nueva.' : 'Vota, guarda tus favoritas y prepara tu quiniela.'}</DialogDescription></DialogHeader>
    {recovery ? <div className="recovery-panel"><KeyRound size={30} /><code>{recovery}</code><button className="action-button action-blue" onClick={async () => { try { await navigator.clipboard.writeText(recovery); setCopied(true); } catch { setError('Selecciona y copia el código manualmente.'); } }}>{copied ? 'Código copiado' : 'Copiar código'}</button><p className="small-note">El código se muestra una sola vez. No lo compartas. Puedes generar uno nuevo en Mi Carnaval.</p><button className="action-button action-navy" onClick={closeAuth}>Ya lo he guardado <ArrowRight size={16} /></button>{error && <p role="alert" className="form-error">{error}</p>}</div> : <>
      <form className="form-stack" onSubmit={submit} key={authMode}>
        {authMode === 'register' && <label>Tu nombre<input name="name" required minLength={2} maxLength={60} autoComplete="nickname" placeholder="Cómo quieres que te llamemos" /></label>}
        <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('admin') ? 'carnavalinense@gmail.com' : ''} placeholder="tu@email.com" /></label>
        {authMode === 'recover' && <label>Código de recuperación<input name="code" required autoComplete="off" spellCheck={false} /></label>}
        <label>{authMode === 'recover' ? 'Nueva contraseña' : 'Contraseña'}<span className="password-input"><input name="password" type={show ? 'text' : 'password'} required minLength={authMode === 'login' ? 1 : 10} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder={authMode === 'login' ? 'Tu contraseña' : 'Al menos 10 caracteres'} /><button type="button" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {owner && <a className="owner-link" target="_top" href="/signin-with-chatgpt?return_to=%2F%3Fadmin%3D1">Verificar propietario y activar administración →</a>}
        <button className="action-button action-blue w-full" disabled={busy}>{busy ? 'Un momento…' : authMode === 'register' ? 'Crear mi cuenta' : authMode === 'recover' ? 'Guardar nueva contraseña' : 'Entrar'}<ArrowRight size={17} /></button>
      </form>
      <div className="auth-links">{authMode === 'login' ? <><button onClick={() => openAuth('recover')}>He olvidado mi contraseña</button><p>¿Primera vez? <button onClick={() => openAuth('register')}>Crea tu cuenta</button></p></> : <p>¿Ya tienes cuenta? <button onClick={() => openAuth('login')}>Inicia sesión</button></p>}</div>
      {authMode === 'register' && <p className="small-note">Al crear tu cuenta recibirás un código personal de recuperación. Guárdalo en un lugar seguro.</p>}
    </>}
  </DialogContent></Dialog>;
}
