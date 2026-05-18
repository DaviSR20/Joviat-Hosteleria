import logo from './logo_joviat.webp';

const HOME_COPY = {
  es: {
    badge: 'Joviat Hosteleria',
    title: 'Conecta talento y restaurantes en un solo lugar',
    subtitle: 'Explora alumnos y restaurantes desde una unica pantalla visual.',
    studentsCta: 'Explorar alumnos',
    shopsCta: 'Explorar restaurantes',
    studentsTitle: 'Alumnos',
    studentsBody: 'Consulta perfiles, trayectoria y relaciones laborales.',
    shopsTitle: 'Restaurantes',
    shopsBody: 'Navega por mapa o listado con filtros y fichas detalladas.',
  },
  ca: {
    badge: 'Joviat Hosteleria',
    title: 'Connecta talent i restaurants en un sol lloc',
    subtitle: 'Explora alumnes i restaurants des d una unica pantalla visual.',
    studentsCta: 'Explorar alumnes',
    shopsCta: 'Explorar restaurants',
    studentsTitle: 'Alumnes',
    studentsBody: 'Consulta perfils, trajectoria i relacions laborals.',
    shopsTitle: 'Restaurants',
    shopsBody: 'Navega per mapa o llistat amb filtres i fitxes completes.',
  },
  en: {
    badge: 'Joviat Hospitality',
    title: 'Connect talent and restaurants in one place',
    subtitle: 'Browse students and restaurants from a single visual workspace.',
    studentsCta: 'Explore students',
    shopsCta: 'Explore restaurants',
    studentsTitle: 'Students',
    studentsBody: 'Review profiles, background and work relationships.',
    shopsTitle: 'Restaurants',
    shopsBody: 'Browse map or list view with filters and rich detail cards.',
  },
};

function HomeView({
  onExploreStudents,
  onExploreShops,
  language = 'es',
}) {
  const copy = HOME_COPY[language] || HOME_COPY.es;

  return (
    <section className="home-view">
      <div
        className="home-hero home-hero-cover"
        style={{ backgroundImage: `linear-gradient(125deg, rgba(18,138,143,0.9), rgba(46,110,158,0.88)), url(${logo})` }}
      >
        <p className="home-badge">{copy.badge}</p>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
        <div className="home-hero-actions">
          <button type="button" className="home-cta" onClick={onExploreStudents}>
            {copy.studentsCta}
          </button>
          <button type="button" className="home-cta home-cta-secondary" onClick={onExploreShops}>
            {copy.shopsCta}
          </button>
        </div>
      </div>

      <div className="home-cards">
        <article className="home-card">
          <h2>{copy.studentsTitle}</h2>
          <p>{copy.studentsBody}</p>
        </article>

        <article className="home-card">
          <h2>{copy.shopsTitle}</h2>
          <p>{copy.shopsBody}</p>
        </article>
      </div>
    </section>
  );
}

export default HomeView;
