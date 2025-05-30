const { useState, useEffect, useMemo, useRef } = React;
const { BrowserRouter, Route, Switch, Link, useLocation, useHistory } = ReactRouterDOM;

const API_BASE = window.API_BASE || "http://localhost:8080";
const fetchJSON = (p, i) => fetch(`${API_BASE}${p}`, i).then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); });

const COUNTRY_COLORS = {
    'США': '#3b82f6',           // Синий
    'Великобритания': '#ef4444', // Красный
    'СССР': '#f59e0b',          // Оранжевый
};

const COLORS = {
    air: "#ef4444",  // Авиация — красный
    rail: "#10b981", // Ж/д — зеленый
    road: "#f97316"  // Автомобиль — оранжевый
};

const useQueryParams = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};

function useConferenceData({ isGlobal, country, transport, poiType }) {
    const [state, set] = useState({ routes: null, pois: null, config: null, error: null });
    useEffect(() => {
        let dead = false;
        const qp = o => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        (async () => {
            try {
                const [routes, pois, config] = await Promise.all([
                    fetchJSON(`/api/${isGlobal ? 'world' : 'local'}-routes?${qp({ country, transport })}`),
                    fetchJSON(`/api/poi?${qp({ type: poiType })}`),
                    fetchJSON('/api/map-config'),
                ]);
                if (!dead) {
                    console.log(`Routes for ${isGlobal ? 'world' : 'local'}:`, routes); // Отладка
                    set({ routes, pois, config, error: null });
                }
            } catch (e) {
                if (!dead) set({ routes: null, pois: null, config: null, error: e.message });
            }
        })();
        return () => (dead = true);
    }, [isGlobal, country, transport, poiType]);
    return state;
}

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
    useEffect(() => { map && map.setView(center, zoom); }, [center, zoom, map]);
    return React.createElement('div', { ref, className: 'h-full w-full rounded-xl overflow-hidden shadow-lg' }, map && React.Children.map(children, c => React.cloneElement(c, { map, clusterGroup })));
}

function Polyline({ map, positions, color, popupHTML }) {
    const ref = useRef();
    useEffect(() => {
        if (!map) return;
        const l = L.polyline(positions, { color, weight: 4 }).addTo(map);
        popupHTML && l.bindPopup(popupHTML);
        ref.current = l;
        return () => l.remove();
    }, [map, color, popupHTML, positions]);
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
    }, [map, clusterGroup, popupHTML, position]);
    useEffect(() => { ref.current && ref.current.setLatLng(position); }, [position]);
    return null;
}

function Filters({ country, setCountry, transport, setTransport, poiType, setPoiType }) {
    const base = 'bg-white/70 backdrop-blur px-3 py-2 rounded-lg border outline-none';
    return (
        <div className="flex flex-wrap gap-3 p-4 bg-white/40 backdrop-blur-lg rounded-xl shadow-lg">
            <select className={base} value={country} onChange={e => setCountry(e.target.value)}>
                <option value="">Все страны</option>
                <option value="США">США</option>
                <option value="Великобритания">Великобритания</option>
                <option value="СССР">СССР</option>
            </select>
            <select className={base} value={transport} onChange={e => setTransport(e.target.value)}>
                <option value="">Любой транспорт</option>
                <option value="air">Авиация</option>
                <option value="sea">Морской</option>
                <option value="rail">Ж/д</option>
                <option value="road">Автомобиль</option>
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
    const [country, setCountry] = useState(params.get('country') || '');
    const [transport, setTransport] = useState(params.get('transport') || '');
    const [poiType, setPoiType] = useState(params.get('poiType') || '');

    useEffect(() => {
        const q = new URLSearchParams();
        if (country) q.set('country', country);
        if (transport) q.set('transport', transport);
        if (poiType) q.set('poiType', poiType);
        hist.replace({ search: q.toString() });
    }, [country, transport, poiType, hist]);

    const { routes, pois, config, error } = useConferenceData({ isGlobal, country, transport, poiType });
    if (error) return <div className="p-6 text-red-600">{error}</div>;
    if (!routes || !pois || !config) return <div className="p-6 animate-pulse">Загрузка…</div>;

    const center = [config.center_lat, config.center_lng];
    const zoom = config.zoom;

    const normalize = str => str?.trim().toLowerCase();

    const filteredRoutes = country || transport
        ? routes.filter(r => {
            const normCountry = normalize(r.country);
            const normTransport = normalize(r.transport);
            const matchesCountry = !country || normalize(country) === normCountry;
            const matchesTransport = !transport || normalize(transport) === normTransport;
            return (isGlobal === (r.is_global === "TRUE" || r.is_global === true)) && matchesCountry && matchesTransport;
        })
        : routes.filter(r => isGlobal === (r.is_global === "TRUE" || r.is_global === true));

    console.log('Raw routes:', routes);
    console.log('Filtered routes:', filteredRoutes);

    const countrySet = new Set();
    const countryDisplay = [];
    filteredRoutes.forEach(r => {
        const normCountry = normalize(r.country);
        if (normCountry && !countrySet.has(normCountry)) {
            countrySet.add(normCountry);
            countryDisplay.push(r.country);
        }
    });
    const visibleCountries = countryDisplay;

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

    const colorOf = r => {
        const normCountry = normalize(r.country);
        const countryKey = Object.keys(COUNTRY_COLORS).find(key => normalize(key) === normCountry);
        if (countryKey) return COUNTRY_COLORS[countryKey];
        const normTransport = normalize(r.transport);
        return COLORS[normTransport] || '#64748b';
    };

    const legendItems = [];

    if (visibleCountries.length > 0) {
        legendItems.push(
            <div key="countries-header" className="font-medium mb-1">Страны</div>,
            ...visibleCountries.map(c => (
                <div key={`country-${normalize(c)}`} className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-sm" style={{ background: COUNTRY_COLORS[c] || '#64748b' }}></span>
                    {c}
                </div>
            ))
        );
    }

    if (visibleTransports.length > 0) {
        if (legendItems.length > 0) {
            legendItems.push(<div key="separator" className="my-2 border-t border-gray-300"></div>);
        }
        const transportLabels = {
            air: "Авиация",
            sea: "Морской",
            rail: "Ж/д",
            road: "Автомобиль",
        };
        legendItems.push(
            <div key="transports-header" className="font-medium mb-1">Типы транспорта</div>,
            ...visibleTransports.map(t => (
                <div key={`transport-${t}`} className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-sm" style={{ background: COLORS[t] || '#64748b' }}></span>
                    {transportLabels[t] || t}
                </div>
            ))
        );
    }

    if (legendItems.length === 0) {
        legendItems.push(<div key="empty" className="text-gray-500">Нет маршрутов (фильтр)</div>);
    }

    return (
        <div className="h-[calc(100vh-64px)] relative bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="absolute z-[1031] left-6 top-6">
                <Filters {...{ country, setCountry, transport, setTransport, poiType, setPoiType }} />
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
                        color={colorOf(r)}
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

function ParticipantList() {
    const params = useQueryParams();
    const hist = useHistory();
    const [country, setCountry] = useState(params.get('country') || '');
    const [role, setRole] = useState(params.get('role') || '');
    const [data, setData] = useState({ list: null, error: null });
    const [sel, setSel] = useState(null);

    useEffect(() => {
        const q = new URLSearchParams();
        if (country) q.set('country', country);
        if (role) q.set('role', role);
        hist.replace({ search: q.toString() });
    }, [country, role, hist]);

    useEffect(() => {
        let dead = false;
        const q = new URLSearchParams();
        if (country) q.set('country', country);
        if (role) q.set('role', role);

        (async () => {
            try {
                const response = await fetchJSON(`/api/participants?${q.toString()}`);
                if (!dead) {
                    console.log('Participants data:', response);
                    setData({ list: response, error: null });
                }
            } catch (e) {
                if (!dead) {
                    console.error('Error fetching participants:', e.message);
                    setData({ list: null, error: e.message });
                }
            }
        })();

        return () => (dead = true);
    }, [country, role]);

    const { list, error } = data;
    if (error) return <div className="p-6 text-red-600">Ошибка: {error}</div>;
    if (!list) return <div className="p-6 animate-pulse">Загрузка…</div>;

    const countries = Array.from(new Set(list.map(p => p.country))).sort();
    const roles = Array.from(new Set(list.map(p => p.role))).sort();

    const parseDesc = (d = '') => {
        const [url, ...rest] = d.split('|');
        return { url: url?.startsWith('http') ? url.trim() : null, text: rest.join('|').trim() || d };
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="w-80 flex-shrink-0 bg-white/70 backdrop-blur-md border-r border-gray-200">
                <div className="p-4 space-y-3">
                    <select value={country} onChange={e => setCountry(e.target.value)} className="w-full p-2 rounded-lg border">
                        <option value="">Все страны</option>
                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 rounded-lg border">
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
                            {url && <img src={url} alt={sel.name} className="mb-4 rounded shadow max-w-xs"/>}
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