import { useEffect, useState } from 'react';
import './App.css';
import logo from './logo_joviat.webp';
import HomeView from './HomeView';
import StudentsView from './StudentsView';
import ShopsMapView from './ShopsMapView';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);

      if (!isMobile) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSidebarVisible = !isMobileView || isMenuOpen;

  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (isMobileView) {
      setIsMenuOpen(false);
    }
  };

  const openStudentProfile = (studentId) => {
    setSelectedStudentId(studentId);
    handleSectionChange('students');
  };

  const openRestaurantProfile = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    handleSectionChange('shops');
  };

  return (
    <div className="App">
      <header className="top-bar">
        {isMobileView && (
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
        )}
        <img src={logo} className="top-bar-logo" alt="Logo Joviat" />
      </header>

      <aside
        id="left-sidebar-menu"
        className={`left-sidebar ${isSidebarVisible ? 'open' : ''}`}
        aria-hidden={!isSidebarVisible}
      >
        <h2 className="sidebar-title">Menú</h2>
        <nav>
          <ul className="sidebar-links">
            <li>
              <button
                type="button"
                className={`sidebar-button ${activeSection === 'home' ? 'active' : ''}`}
                onClick={() => handleSectionChange('home')}
              >
                Inicio
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar-button ${activeSection === 'students' ? 'active' : ''}`}
                onClick={() => handleSectionChange('students')}
              >
                Alumnos
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar-button ${activeSection === 'shops' ? 'active' : ''}`}
                onClick={() => handleSectionChange('shops')}
              >
                Tiendas
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        {activeSection === 'home' && <HomeView />}
        {activeSection === 'students' && (
          <StudentsView
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            onOpenRestaurant={openRestaurantProfile}
          />
        )}
        {activeSection === 'shops' && (
          <ShopsMapView
            selectedRestaurantId={selectedRestaurantId}
            onSelectRestaurant={setSelectedRestaurantId}
            onOpenStudent={openStudentProfile}
          />
        )}
      </main>
    </div>
  );
}

export default App;
