import { useState } from 'react';
import './App.css';
import logo from './logo_joviat.webp';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="App">
      <header className="top-bar">
        <button
          className="menu-toggle"
          type="button"
          onClick={() => setIsMenuOpen((currentState) => !currentState)}
          aria-label="Abrir o cerrar menú lateral"
          aria-expanded={isMenuOpen}
          aria-controls="left-sidebar-menu"
        >
          ☰
        </button>
        <img src={logo} className="top-bar-logo" alt="Logo Joviat" />
      </header>

      <aside
        id="left-sidebar-menu"
        className={`left-sidebar ${isMenuOpen ? 'open' : ''}`}
        aria-hidden={!isMenuOpen}
      >
        <h2 className="sidebar-title">Menú</h2>
        <nav>
          <ul className="sidebar-links">
            <li><a href="#inicio">Inicio</a></li>
            <li><a href="#reservas">Reservas</a></li>
            <li><a href="#habitaciones">Habitaciones</a></li>
            <li><a href="#contacto">Contacto</a></li>
          </ul>
        </nav>
      </aside>
    </div>
  );
}

export default App;
