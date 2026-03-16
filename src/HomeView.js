function HomeView() {
  return (
    <section className="home-view">
      <div className="home-hero">
        <p className="home-badge">Joviat Hostelería</p>
        <h1>Bienvenido/a al panel principal</h1>
        <p>
          Desde el menú lateral puedes consultar los alumnos y ver las tiendas en formato mapa o listado.
        </p>
      </div>

      <div className="home-cards">
        <article className="home-card">
          <h2>Alumnos</h2>
          <p>
            Explora el listado de estudiantes y utiliza el buscador para encontrar personas por nombre.
          </p>
        </article>

        <article className="home-card">
          <h2>Tiendas</h2>
          <p>
            Visualiza restaurantes en el mapa de Barcelona o en formato listado según prefieras.
          </p>
        </article>
      </div>
    </section>
  );
}

export default HomeView;
