/* ==========================================================================
   auth.js - prototype login for admin + waiters (credentials live in staff.json).
   NOT SECURE: plain-text passwords and client-side checks are for the demo only.
   PRODUCTION: POST /auth/login -> hashed passwords (argon2/bcrypt) + signed JWT in
   an httpOnly cookie; enforce roles on the server for every API route.
   ========================================================================== */
import { db } from './dataService.js';
import { session, url } from './utils.js';

const key = (role) => `bbc:session:${role}`;
export function login(role, username, password) {
  const u = db.find('staff', (s) => s.role === role && s.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!u || u.password !== password) return { ok: false, error: 'INVALID' };
  if (u.active === false) return { ok: false, error: 'INACTIVE' };
  const s = { id: u.id, role: u.role, name: u.name, username: u.username, photo: u.photo, empId: u.employeeId, shift: u.shift, at: Date.now() };
  session.set(key(role), s); return { ok: true, user: s };
}
export const currentUser = (role) => session.get(key(role));
export function logout(role) { session.del(key(role)); location.href = url(`${role}/login.html`); }
/** Route guard: call at the top of every protected page. Redirects to login if no valid session. */
export function guard(role) {
  const u = currentUser(role);
  const fresh = u ? db.get('staff', u.id) : null;
  if (!u || !fresh || fresh.active === false) {
    session.del(key(role));
    location.replace(`${url(role + '/login.html')}?next=${encodeURIComponent(location.pathname.split('/').pop())}`);
    return null;
  }
  return u;
}
