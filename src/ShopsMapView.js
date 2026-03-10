import { useEffect, useRef, useState } from 'react';
import { getRestaurants } from './firestoreApi';

const BARCELONA_CENTER = [41.3874, 2.1686];

const loadLeafletAssets = async () => {
  if (window.L) return;

  if (!document.querySelector('link[data-leaflet]')) {
    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    leafletCss.setAttribute('data-leaflet', 'true');
    document.head.appendChild(leafletCss);
  }

  await new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-leaflet]');

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      if (window.L) resolve();
      return;
    }

    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.setAttribute('data-leaflet', 'true');
    leafletScript.async = true;
    leafletScript.onload = resolve;
    leafletScript.onerror = reject;
    document.body.appendChild(leafletScript);
  });
};

function ShopsMapView() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadRestaurants = async () => {
      try {
        const restaurantsFromApi = await getRestaurants();
        if (isMounted) {
          setRestaurants(restaurantsFromApi);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Error cargando tiendas.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const renderMap = async () => {
      if (!mapContainerRef.current || loading || error) return;

      try {
        await loadLeafletAssets();
        if (cancelled || !window.L || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = window.L.map(mapContainerRef.current).setView(BARCELONA_CENTER, 12);

          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapInstanceRef.current);
        }

        const map = mapInstanceRef.current;

        restaurants.forEach((restaurant) => {
          window.L.marker([restaurant.lat, restaurant.lng])
            .addTo(map)
            .bindPopup(`<strong>${restaurant.name}</strong>`);
        });
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar el mapa.');
        }
      }
    };

    renderMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [restaurants, loading, error]);

  return (
    <section>
      <h1>Tiendas</h1>
      {loading && <p>Cargando tiendas...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <>
          <div ref={mapContainerRef} className="shops-map" />
          <ul className="shops-list">
            {restaurants.map((restaurant) => (
              <li key={restaurant.id}>
                {restaurant.name}: {restaurant.lat.toFixed(5)}, {restaurant.lng.toFixed(5)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default ShopsMapView;
