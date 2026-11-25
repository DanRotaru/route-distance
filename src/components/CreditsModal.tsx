import type { MapImagery } from '../settings';
import { Modal, useModalClose } from './Modal';

interface Credit {
  what: string;
  by: { text: string; href?: string }[];
  /** Only shown as "in use" with this imagery. */
  imagery?: MapImagery;
}

const CREDITS: { title?: string; items: Credit[] }[] = [
  {
    title: 'Map imagery',
    items: [
      { what: 'Street map & satellite', imagery: 'google', by: [{ text: 'Map data © Google', href: 'https://www.google.com/intl/en/help/terms_maps/' }] },
      {
        what: 'Street map',
        imagery: 'default',
        by: [{ text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' }],
      },
      {
        what: 'Satellite',
        imagery: 'default',
        by: [{ text: 'Imagery © Esri, Maxar, Earthstar Geographics', href: 'https://www.esri.com/' }],
      },
    ],
  },
  {
    title: 'Data & services',
    items: [
      {
        what: 'Routing',
        by: [
          { text: 'FOSSGIS OSRM', href: 'https://routing.openstreetmap.de' },
          { text: 'data © OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
        ],
      },
      {
        what: 'Address search',
        by: [
          { text: 'Photon by komoot', href: 'https://photon.komoot.io' },
          { text: 'data © OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
        ],
      },
      {
        what: 'Places on the map',
        by: [
          { text: 'OpenFreeMap', href: 'https://openfreemap.org' },
          { text: '© OpenMapTiles', href: 'https://www.openmaptiles.org/' },
          { text: 'data © OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
        ],
      },
      {
        what: 'Place details',
        by: [{ text: 'Nominatim', href: 'https://nominatim.org' }, { text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' }],
      },
    ],
  },
  {
    items: [
      {
        what: 'Analytics',
        by: [
          { text: 'Google Analytics', href: 'https://policies.google.com/privacy' },
          { text: 'Microsoft Clarity', href: 'https://privacy.microsoft.com/privacystatement' },
        ],
      },
    ],
  },
  {
    title: 'Software',
    items: [
      { what: 'Map library', by: [{ text: 'Leaflet', href: 'https://leafletjs.com' }] },
    ],
  },
];

/** Every attribution (the map itself shows none, to keep it clean). */
export function CreditsModal({ imagery, onClose }: { imagery: MapImagery; onClose(): void }) {
  const { closing, close } = useModalClose(onClose);

  return (
    <Modal id="credits-title" title="Credits" closing={closing} onClose={() => close()}>
      <section className="privacy">
        <h3>Privacy</h3>
        <p>
          <b>Everything stays on your device.</b> Your saved locations, settings and speeds are stored only in this
          browser. There are no accounts, and this app has no server of its own that collects your data.
        </p>
        <p>
          To improve the app, anonymous usage is measured with Microsoft Clarity and Google Analytics (pages and
          clicks, device and browser type). Addresses, routes, the map and your saved locations are hidden from them.
        </p>
        <p>
          To show maps, find addresses and calculate routes, the points you search for or pick are sent directly to
          the services listed below, only when needed. Your list of saved locations is never uploaded anywhere.
        </p>
      </section>
      {CREDITS.filter((g) => g.items.length).map((group) => (
        <section key={group.title ?? group.items[0].what}>
          {group.title && <h3>{group.title}</h3>}
          <ul className="credit-list">
            {group.items.map((c) => (
              <li key={`${c.what}-${c.imagery ?? ''}`}>
                <b>
                  {c.what}
                  {c.imagery && c.imagery === imagery && <span className="credit-tag">In use</span>}
                </b>
                <span>
                  {c.by.map((b, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      {b.href ? (
                        <a href={b.href} target="_blank" rel="noopener noreferrer">
                          {b.text}
                        </a>
                      ) : (
                        b.text
                      )}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}
