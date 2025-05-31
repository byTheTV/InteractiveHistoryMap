/* global React, ReactDOM, ReactRouterDOM, L */
const { useState, useEffect, useMemo, useRef } = React;
const { BrowserRouter, Route, Switch, Link, useLocation, useHistory } = ReactRouterDOM;

// ---------------- helpers ---------------- //
const API_BASE = window.API_BASE || "/api";
const fetchJSON = (p, i) => fetch(`${API_BASE}${p}`, i).then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); });

const COLORS = { самолёт: "#ef4444", поезд: "#10b981" };
const COUNTRY_COLORS = {
    'США': '#3b82f6',
    'Великобритания': '#f12222',
    'СССР': '#f59e0b',
};
const LOCAL_AUTOMOBILE_COLORS = {
    'США': '#fb923c', // Orange shade for USA
    'Великобритания': '#f87171', // Lighter red for UK
    'СССР': '#eab308', // Yellow shade for USSR
};

const useQueryParams = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};

function useConferenceData({ isGlobal, countries, transport, poiType }) {
    const [state, set] = useState({ routes: null, pois: null, config: null, error: null });
    useEffect(() => {
        let dead = false;
        const qp = o => Object.entries(o).filter(([, v]) => v && v.length).map(([k, v]) => Array.isArray(v) ? v.map(val => `${k}=${encodeURIComponent(val)}`).join('&') : `${k}=${encodeURIComponent(v)}`).join('&');
        (async () => {
            try {
                const [routes, pois, config] = await Promise.all([
                    fetchJSON(`/api/${isGlobal ? 'world' : 'local'}-routes?${qp({ country: countries, transport })}`),
                    fetchJSON(`/api/poi?${qp({ type: poiType })}`),
                    fetchJSON('/api/map-config'),
                ]);
                if (!dead) set({ routes, pois, config, error: null });
            } catch (e) { !dead && set({ routes: null, pois: null, config: null, error: e.message }); }
        })();
        return () => (dead = true);
    }, [isGlobal, countries, transport, poiType]);
    return state;
}

// ---------------- Leaflet wrappers ---------------- //
function MapContainer({ center, zoom, children }) {
    const ref = useRef();
    const [map, setMap] = useState(null);
    const [clusterGroup, setClusterGroup] = useState(null);
    useEffect(() => {
        if (!ref.current) return;
        const m = L.map(ref.current, { zoomControl: false }).setView(center, zoom);
        L.control.zoom({ position: 'bottomright' }).addTo(m);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
        if (L.markerClusterGroup) {
            const cg = L.markerClusterGroup();
            m.addLayer(cg);
            setClusterGroup(cg);
        }
        setMap(m);
        return () => m.remove();
    }, []);
    useEffect(() => { map && map.setView(center, zoom); }, [center, zoom]);
    return React.createElement('div', { ref, className: 'h-full w-full rounded-xl overflow-hidden shadow-lg' }, map && React.Children.map(children, c => React.cloneElement(c, { map, clusterGroup })));
}
function Polyline({ map, positions, color, popupHTML }) {
    const ref = useRef();
    useEffect(() => { if (!map) return; const l = L.polyline(positions, { color, weight: 4 }).addTo(map); popupHTML && l.bindPopup(popupHTML); ref.current = l; return () => l.remove(); }, [map]);
    useEffect(() => { ref.current && ref.current.setLatLngs(positions); }, [positions]);
    return null;
}
function Marker({ map, clusterGroup, position, popupHTML }) {
    const ref = useRef();
    useEffect(() => {
        if (!map) return;
        const mk = L.marker(position);
        popupHTML && mk.bindPopup(popupHTML, { maxWidth: 260 });
        clusterGroup ? clusterGroup.addLayer(mk) : mk.addTo(map);
        ref.current = mk;
        return () => { clusterGroup ? clusterGroup.removeLayer(mk) : mk.remove(); };
    }, [map]);
    useEffect(() => { ref.current && ref.current.setLatLng(position); }, [position]);
    return null;
}

// ---------------- UI ---------------- //
function Filters({ countries, setCountries, transport, setTransport, poiType, setPoiType }) {
    const base = 'bg-white/70 backdrop-blur px-3 py-2 rounded-lg border outline-none w-full';
    const handleCountryChange = (e) => {
        const selected = Array.from(e.target.selectedOptions).map(option => option.value).filter(Boolean);
        setCountries(selected);
    };

    return (
        <div className="flex flex-wrap gap-3 p-4 bg-white/40 backdrop-blur-lg rounded-xl shadow-lg">
            <select multiple className={base} value={countries} onChange={handleCountryChange} size="3">
                <option value="США">США</option>
                <option value="Великобритания">Великобритания</option>
                <option value="СССР">СССР</option>
            </select>
            <select className={base} value={transport} onChange={e => setTransport(e.target.value)}>
                <option value="">Любой транспорт</option>
                <option value="самолёт">Авиация</option>
                <option value="поезд">Ж/д</option>
                <option value="автомобиль">Автодорога</option>
            </select>
            <select className={base} value={poiType} onChange={e => setPoiType(e.target.value)}>
                <option value="">Все POI</option>
                <option value="place">Место</option>
                <option value="infrastructure">Инфраструктура</option>
                <option value="event">Событие</option>
            </select>
        </div>
    );
}

function MapView({ isGlobal }) {
    const params = useQueryParams();
    const hist = useHistory();
    const [countries, setCountries] = useState(params.getAll('country') || []);
    const [transport, setTransport] = useState(params.get('transport') || '');
    const [poiType, setPoiType] = useState(params.get('poiType') || '');

    useEffect(() => {
        const q = new URLSearchParams();
        countries.forEach(c => q.append('country', c));
        if (transport) q.set('transport', transport);
        if (poiType) q.set('poiType', poiType);
        hist.replace({ search: q.toString() });
    }, [countries, transport, poiType, hist]);

    const { routes, pois, config, error } = useConferenceData({ isGlobal, countries, transport, poiType });
    if (error) return <div className="p-6 text-red-600">{error}</div>;
    if (!routes || !pois || !config) return <div className="p-6 animate-pulse">Загрузка…</div>;

    const center = [config.center_lat, config.center_lng];
    const zoom = config.zoom;

    const normalize = str => str?.trim().toLowerCase();

    const filteredRoutes = countries.length > 0 || transport
        ? routes.filter(r => {
            const normCountry = normalize(r.country);
            const normTransport = normalize(r.transport);
            const matchesCountry = countries.length === 0 || countries.map(normalize).includes(normCountry);
            const matchesTransport = !transport || normalize(transport) === normTransport;
            return (isGlobal === (r.is_global === "TRUE" || r.is_global === true)) && matchesCountry && matchesTransport;
        })
        : routes.filter(r => isGlobal === (r.is_global === "TRUE" || r.is_global === true));

    console.log('Raw routes:', routes);
    console.log('Filtered routes:', filteredRoutes);

    const colorOf = (r, isGlobal) => {
        const normCountry = normalize(r.country);
        const normTransport = normalize(r.transport);
        const countryKey = Object.keys(COUNTRY_COLORS).find(key => normalize(key) === normCountry);

        if (isGlobal) {
            return countryKey ? COUNTRY_COLORS[countryKey] : '#64748b';
        } else {
            if (normTransport === 'автомобиль') {
                return countryKey ? LOCAL_AUTOMOBILE_COLORS[countryKey] : '#64748b';
            }
            return COLORS[normTransport] || (countryKey ? COUNTRY_COLORS[countryKey] : '#64748b');
        }
    };

    const legendItems = [];

    // Group routes by country and transport to determine legend colors
    const countryTransportMap = {};
    filteredRoutes.forEach(r => {
        const normCountry = normalize(r.country);
        const normTransport = normalize(r.transport);
        if (!normCountry) return;
        if (!countryTransportMap[normCountry]) {
            countryTransportMap[normCountry] = { country: r.country, transports: new Set() };
        }
        countryTransportMap[normCountry].transports.add(normTransport);
    });

    const transportLabels = {
        самолёт: "Авиация",
        поезд: "Ж/д",
        автомобиль: "Автодорога",
    };

    // Generate legend entries for each country and transport combination
    const countryEntries = [];
    Object.values(countryTransportMap).forEach(({ country, transports }) => {
        const normCountry = normalize(country);
        const countryKey = Object.keys(COUNTRY_COLORS).find(key => normalize(key) === normCountry);

        if (transport) {
            // Single transport filter: show one entry per country with that transport
            const normTransport = normalize(transport);
            if (transports.has(normTransport)) {
                const color = isGlobal
                    ? (countryKey ? COUNTRY_COLORS[countryKey] : '#64748b')
                    : (normTransport === 'автомобиль' ? (countryKey ? LOCAL_AUTOMOBILE_COLORS[countryKey] : '#64748b') : COLORS[normTransport] || (countryKey ? COUNTRY_COLORS[countryKey] : '#64748b'));
                countryEntries.push({
                    key: `country-${normCountry}-${normTransport}`,
                    color,
                    label: `${country} (${transportLabels[normTransport] || normTransport})`,
                });
            }
        } else {
            // No transport filter: show one entry per country, prioritizing automobile in local map
            const normTransport = !isGlobal && transports.has('автомобиль') ? 'автомобиль' : [...transports][0] || '';
            const color = isGlobal
                ? (countryKey ? COUNTRY_COLORS[countryKey] : '#64748b')
                : (normTransport === 'автомобиль' ? (countryKey ? LOCAL_AUTOMOBILE_COLORS[countryKey] : '#64748b') : COLORS[normTransport] || (countryKey ? COUNTRY_COLORS[countryKey] : '#64748b'));
            countryEntries.push({
                key: `country-${normCountry}`,
                color,
                label: !isGlobal && normTransport === 'автомобиль' ? `${country} (Автодорога)` : country,
            });
        }
    });

    if (countryEntries.length > 0) {
        legendItems.push(
            <div key="countries-header" className="font-medium mb-1">Страны</div>,
            ...countryEntries.map(({ key, color, label }) => (
                <div key={key} className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-sm" style={{ background: color }}></span>
                    {label}
                </div>
            ))
        );
    }

    const transportSet = new Set();
    const transportDisplay = [];
    filteredRoutes.forEach(r => {
        const normTransport = normalize(r.transport);
        if (normTransport && !transportSet.has(normTransport)) {
            transportSet.add(normTransport);
            transportDisplay.push(r.transport.toLowerCase());
        }
    });
    const visibleTransports = transportDisplay;

    if (visibleTransports.length > 0 && (!transport || transport !== 'автомобиль')) {
        if (legendItems.length > 0) {
            legendItems.push(<div key="separator" className="my-2 border-t border-gray-300"></div>);
        }
        legendItems.push(
            <div key="transports-header" className="font-medium mb-1">Типы транспорта</div>,
            ...visibleTransports.map(t => {
                if (t === 'автомобиль' && !isGlobal) {
                    return null; // Skip automobile in local map legend since it uses country-specific colors
                }
                return (
                    <div key={`transport-${t}`} className="flex items-center gap-2">
                        <span className="inline-block w-4 h-4 rounded-sm" style={{ background: COLORS[t] || '#64748b' }}></span>
                        {transportLabels[t] || t}
                    </div>
                );
            }).filter(Boolean)
        );
    }

    if (legendItems.length === 0) {
        legendItems.push(<div key="empty" className="text-gray-500">Нет маршрутов (фильтр)</div>);
    }

    return (
        <div className="h-[calc(100vh-64px)] relative bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="absolute z-[1031] left-6 top-6">
                <Filters {...{ countries, setCountries, transport, setTransport, poiType, setPoiType }} />
            </div>
            <div className="absolute z-[1031] left-6 bottom-6 bg-white/70 backdrop-blur-lg rounded-xl shadow px-4 py-3 text-sm space-y-2 max-w-xs">
                <div className="font-medium mb-1">Легенда</div>
                {legendItems}
            </div>
            <MapContainer center={center} zoom={zoom}>
                {filteredRoutes.map(r => (
                    <Polyline
                        key={r.id}
                        positions={r.path.map(p => [p.lat, p.lng])}
                        color={colorOf(r, isGlobal)}
                        popupHTML={`<strong>${r.name}</strong><br/>${r.transport}${r.country ? ` · ${r.country}` : ''}`}
                    />
                ))}
                {pois.map(p => (
                    <Marker
                        key={p.id}
                        position={[p.lat, p.lng]}
                        popupHTML={`<strong>${p.name}</strong><br/>${p.description}${
                            p.photos?.[0] ? `<br/><img src='${p.photos[0].url}' style='max-width:220px;border-radius:6px;margin-top:6px'/>` : ''
                        }`}
                    />
                ))}
            </MapContainer>
        </div>
    );
}

// ---------------- Participant list ---------------- //
function ParticipantList() {
    const params = useQueryParams();
    const hist = useHistory();
    const [countries, setCountries] = useState(params.getAll('country') || []);
    const [role, setRole] = useState(params.get('role') || '');
    const [data, setData] = useState({ list: null, error: null });
    const [sel, setSel] = useState(null);

    useEffect(() => {
        const q = new URLSearchParams();
        countries.forEach(c => q.append('country', c));
        if (role) q.set('role', role);
        hist.replace({ search: q.toString() });
    }, [countries, role]);

    useEffect(() => {
        let dead = false;
        const q = new URLSearchParams();
        countries.forEach(c => q.append('country', c));
        if (role) q.set('role', role);
        fetchJSON(`/api/participants?${q.toString()}`)
            .then(d => !dead && setData({ list: d, error: null }))
            .catch(e => !dead && setData({ list: null, error: e.message }));
        return () => dead = true;
    }, [countries, role]);

    const { list, error } = data;
    if (error) return <div className="p-6 text-red-600">{error}</div>;
    if (!list) return <div className="p-6 animate-pulse">Загрузка…</div>;

    const uniqueCountries = Array.from(new Set(list.map(p => p.country))).sort();
    const roles = Array.from(new Set(list.map(p => p.role))).sort();

    const parseDesc = (d = '') => {
        const [url, ...rest] = d.split('|');
        return { url: url?.startsWith('http') ? url.trim() : null, text: rest.join('|').trim() || d };
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="w-80 flex-shrink-0 bg-white/70 backdrop-blur-md border-r border-gray-200">
                <div className="p-4 space-y-3">
                    <select multiple className="w-full p-2 rounded-lg border" value={countries} onChange={e => setCountries(Array.from(e.target.selectedOptions).map(o => o.value))}>
                        {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="w-full p-2 rounded-lg border" value={role} onChange={e => setRole(e.target.value)}>
                        <option value="">Все роли</option>
                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <ul className="overflow-y-auto h-[calc(100%-168px)] divide-y divide-gray-200">
                    {list.map(p => (
                        <li key={p.id} onClick={() => setSel(p)} className={`p-4 cursor-pointer hover:bg-indigo-50 transition ${sel?.id === p.id ? 'bg-indigo-100' : ''}`}>
                            <span className="font-medium">{p.name}</span>
                            <div className="text-xs text-gray-600">{p.role}</div>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
                {sel ? (() => {
                    const { url, text } = parseDesc(sel.description);
                    return (
                        <div className="prose max-w-none bg-white/70 backdrop-blur-lg p-6 rounded-xl shadow-lg">
                            <h2>{sel.name}</h2>
                            <p className="text-sm text-gray-500 mb-4">{sel.role} · {sel.country}</p>
                            {url && <img src={url} alt={sel.name} className="mb-4 rounded shadow max-w-xs" />}
                            <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
                        </div>
                    );
                })() : <p className="text-gray-600">Выберите участника слева…</p>}
            </div>
        </div>
    );
}

function NavLink({ to, children }) {
    return <Link to={to} className="px-4 py-2 hover:bg-white/20 rounded transition">{children}</Link>;
}

function App() {
    return (
        <BrowserRouter>
            <header className="h-16 flex items-center px-6 bg-indigo-600 text-white shadow-lg sticky top-0 z-40">
                <nav className="flex gap-2 text-sm font-medium">
                    <NavLink to="/">Мировая карта</NavLink>
                    <NavLink to="/local">Локальная карта</NavLink>
                    <NavLink to="/participants">Участники</NavLink>
                </nav>
            </header>
            <Switch>
                <Route exact path="/" render={() => <MapView isGlobal={true} />} />
                <Route path="/local" render={() => <MapView isGlobal={false} />} />
                <Route path="/participants" component={ParticipantList} />
            </Switch>
        </BrowserRouter>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));