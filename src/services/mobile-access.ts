import type { Session } from './sitmas-api';

export class MobileAccessDeniedError extends Error {
  constructor() {
    super('Su usuario no tiene los permisos necesarios para utilizar SITMAS Móvil, comuníquese con su supervisor.');
    this.name = 'MobileAccessDeniedError';
  }
}

export function assertMobileAccess(session: Session) {
  // Cuentas verificadas en SITMAS: Juan Videla (1) y Mauro Gerosa (11).
  if (![1, 11].includes(session.idUsuario)) throw new MobileAccessDeniedError();
}
