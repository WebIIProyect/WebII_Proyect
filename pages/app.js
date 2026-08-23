// Script compartido: mantiene el botón de sesión del header consistente
// entre páginas. Si hay una sesión activa (guardada por login.html en
// localStorage), cambia "Iniciar Sesión" por un acceso directo a "Mi
// Cuenta" en vez de seguir ofreciendo iniciar sesión de nuevo.
(function () {
  function actualizarBotonSesion() {
    const boton = document.querySelector('.btn-auth-pill');
    if (!boton) return;
    // No tocar botones con otro propósito ("← Regresar", "Cerrar Sesión").
    if (boton.textContent.trim() !== 'Iniciar Sesión') return;

    const contribuyenteRaw = localStorage.getItem('contribuyente');
    if (!contribuyenteRaw) return;

    let contribuyente;
    try {
      contribuyente = JSON.parse(contribuyenteRaw);
    } catch {
      return;
    }

    const primerNombre = (contribuyente.nombre_razon_social || '').split(' ')[0];
    boton.textContent = primerNombre ? `Mi Cuenta (${primerNombre})` : 'Mi Cuenta';
    boton.onclick = () => {
      window.location.href = 'user_account.html';
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', actualizarBotonSesion);
  } else {
    actualizarBotonSesion();
  }
})();
