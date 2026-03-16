import { useEffect, useMemo, useState } from 'react';
import { getStudents } from './firestoreApi';

function StudentsView() {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filteredStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return students;

    return students.filter((student) => student.name.toLowerCase().includes(normalizedSearch));
  }, [students, searchTerm]);

  useEffect(() => {
    let isMounted = true;

    const loadStudents = async () => {
      try {
        const studentsFromApi = await getStudents();
        if (isMounted) {
          setStudents(studentsFromApi);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Error cargando alumnos.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStudents();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <p>Cargando alumnos...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h1>Alumnos</h1>
      <div className="search-box">
        <label htmlFor="students-search" className="search-label">Buscar alumno por nombre</label>
        <input
          id="students-search"
          type="text"
          className="search-input"
          placeholder="Ej: Jordi"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {filteredStudents.length === 0 && <p>No hay alumnos que coincidan con tu búsqueda.</p>}

      <div className="students-grid">
        {filteredStudents.map((student) => (
          <article key={student.id} className="student-card">
            {student.photoUrl ? (
              <img src={student.photoUrl} alt={student.name} className="student-photo" />
            ) : (
              <div className="student-photo student-photo-placeholder">Sin imagen</div>
            )}
            <h2>{student.name}</h2>
          </article>
        ))}
      </div>
    </section>
  );
}

export default StudentsView;
