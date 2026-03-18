import { useEffect, useMemo, useState } from 'react';
import { getRestAlum, getRestaurants, getStudents } from './firestoreApi';

function StudentsView({ selectedStudentId: controlledStudentId, onSelectStudent, onOpenRestaurant }) {
  const [students, setStudents] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [restAlum, setRestAlum] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [internalSelectedStudentId, setInternalSelectedStudentId] = useState(null);

  const isControlled = controlledStudentId !== undefined;
  const selectedStudentId = isControlled ? controlledStudentId : internalSelectedStudentId;
  const setSelectedStudentId = isControlled ? (onSelectStudent || (() => {})) : setInternalSelectedStudentId;

  const filteredStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return students;

    return students.filter((student) => student.name.toLowerCase().includes(normalizedSearch));
  }, [students, searchTerm]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const selectedStudentMatchIds = useMemo(() => {
    if (!selectedStudent) return new Set();
    const details = selectedStudent.details || {};
    const candidates = [
      selectedStudent.id,
      details.id,
      details.Id,
      details.ID,
      details.id_alumni,
      details.idAlumni,
      details.alumniId,
      details.uid,
      details.uid_alumni,
      details.uidAlumni,
    ];
    return new Set(candidates.filter((value) => value !== null && value !== undefined && `${value}`.trim()));
  }, [selectedStudent]);

  const restaurantLookup = useMemo(() => {
    const map = new Map();
    restaurants.forEach((restaurant) => {
      const details = restaurant.details || {};
      const candidates = [
        restaurant.id,
        details.id,
        details.Id,
        details.ID,
        details.id_restaurant,
        details.idRestaurant,
        details.restaurantId,
        details.uid,
        details.uid_restaurant,
        details.uidRestaurant,
      ];
      candidates
        .filter((value) => value !== null && value !== undefined && `${value}`.trim())
        .forEach((value) => map.set(`${value}`.trim(), restaurant));
    });
    return map;
  }, [restaurants]);

  const relatedRestaurants = useMemo(() => {
    if (!selectedStudentId) return [];
    return restAlum
      .filter((relation) => selectedStudentMatchIds.has(relation.alumniId))
      .map((relation) => ({
        ...relation,
        restaurant: restaurantLookup.get(relation.restaurantId) || null,
      }));
  }, [restAlum, restaurantLookup, selectedStudentId, selectedStudentMatchIds]);

  useEffect(() => {
    if (!selectedStudentId) return;
    const stillVisible = filteredStudents.some((student) => student.id === selectedStudentId);
    if (!stillVisible) {
      setSelectedStudentId(null);
    }
  }, [filteredStudents, selectedStudentId]);

  useEffect(() => {
    let isMounted = true;

    const loadStudents = async () => {
      try {
        const [studentsFromApi, restaurantsFromApi, restAlumFromApi] = await Promise.all([
          getStudents(),
          getRestaurants(),
          getRestAlum(),
        ]);
        if (isMounted) {
          setStudents(studentsFromApi);
          setRestaurants(restaurantsFromApi);
          setRestAlum(restAlumFromApi);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Error cargando datos.');
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

  const formatDetailValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    if (typeof value === 'object') {
      if (value.latitude !== undefined && value.longitude !== undefined) {
        return `${value.latitude}, ${value.longitude}`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const detailEntries = useMemo(() => {
    if (!selectedStudent?.details) return [];
    const details = selectedStudent.details;
    const usedKeys = new Set();

    const orderedFields = [
      { label: 'Nombre', keys: ['Name', 'name'] },
      { label: 'Telefono', keys: ['Telf', 'Tel', 'Phone', 'phone'] },
      { label: 'Email', keys: ['Email', 'email', 'Mail', 'mail'] },
      { label: 'Alumni', keys: ['Alumni', 'alumni'] },
    ];
    const hiddenKeys = new Set(['PhotoURL', 'PhotoUrl', 'photoUrl']);

    const orderedEntries = orderedFields
      .map((field) => {
        const matchKey = field.keys.find((key) => Object.prototype.hasOwnProperty.call(details, key));
        if (!matchKey) return null;
        usedKeys.add(matchKey);
        return [field.label, details[matchKey]];
      })
      .filter(Boolean);

    const remainingEntries = Object.entries(details)
      .filter(([key]) => !usedKeys.has(key) && !hiddenKeys.has(key))
      .sort(([a], [b]) => a.localeCompare(b));

    return [...orderedEntries, ...remainingEntries];
  }, [selectedStudent]);

  if (loading) return <p>Cargando alumnos...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section className="students-view">
      <h1>Alumnos</h1>
      {selectedStudent ? (
        <div className="student-details-page" aria-live="polite">
          <div className="student-details-actions">
            <button
              type="button"
              className="student-back-button"
              onClick={() => setSelectedStudentId(null)}
            >
              Volver
            </button>
          </div>
          <h2>Detalle del alumno</h2>
          <div className="student-details-header">
            {selectedStudent.photoUrl ? (
              <img
                src={selectedStudent.photoUrl}
                alt={selectedStudent.name}
                className="student-details-photo"
              />
            ) : (
              <div className="student-details-photo student-photo-placeholder">
                Sin imagen
              </div>
            )}
            <div>
              <p className="student-details-name">{selectedStudent.name}</p>
            </div>
          </div>
          {detailEntries.length > 0 ? (
            <dl className="student-details-list">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="student-details-row">
                  <dt>{key}</dt>
                  <dd>{formatDetailValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>No hay detalles disponibles.</p>
          )}
          <div className="related-section">
            <h3>Restaurantes</h3>
            {relatedRestaurants.length > 0 ? (
              <ul className="related-list">
                {relatedRestaurants.map((relation) => {
                  const targetId = relation.restaurant?.id || relation.restaurantId;
                  const canOpen = Boolean(targetId && onOpenRestaurant);

                  return (
                    <li key={relation.id}>
                      <button
                        type="button"
                        className="related-card related-card-button"
                        onClick={() => {
                          if (canOpen) {
                            onOpenRestaurant(targetId);
                          }
                        }}
                        disabled={!canOpen}
                      >
                        <p className="related-title">
                          {relation.restaurant?.name || 'Nombre no disponible'}
                        </p>
                        <p className="related-meta">Rol: {relation.role || '-'}</p>
                        <p className="related-meta">
                          Actual: {formatDetailValue(relation.currentJob)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No hay restaurantes asociados.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="search-box">
            <label htmlFor="students-search" className="search-label">Buscar alumno por nombre</label>
            <div className="search-row">
              <input
                id="students-search"
                type="text"
                className="search-input"
                placeholder="Ej: Jordi"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar busqueda"
                disabled={!searchTerm}
              >
                x
              </button>
            </div>
          </div>

          {filteredStudents.length === 0 && <p>No hay alumnos que coincidan con tu busqueda.</p>}

          <div className="students-grid">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                type="button"
                className="student-card"
                onClick={() => setSelectedStudentId(student.id)}
              >
                {student.photoUrl ? (
                  <img src={student.photoUrl} alt={student.name} className="student-photo" />
                ) : (
                  <div className="student-photo student-photo-placeholder">Sin imagen</div>
                )}
                <h2>{student.name}</h2>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default StudentsView;
