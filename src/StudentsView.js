import { useEffect, useState } from 'react';
import { getStudents } from './firestoreApi';

function StudentsView() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <div className="students-grid">
        {students.map((student) => (
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
