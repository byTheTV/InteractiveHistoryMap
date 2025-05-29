/* global React, ReactDOM, ReactRouterDOM, L */
// =============================================================================
//  Interactive map — Tailwind UI (RU labels, POI photo preview)
// =============================================================================
const { useState, useEffect, useMemo, useRef } = React;
const { BrowserRouter, Route, Switch, Link, useLocation, useHistory } = ReactRouterDOM;

// ---------------- helpers ---------------- //
const API_BASE = window.API_BASE || "http://localhost:8080";
const fetchJSON = (p, i) => fetch(`${API_BASE}${p}`, i).then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); });

// цвет линии: страна > транспорт > дефолт
const COLORS = { air: "#ef4444", sea: "#3b82f6", rail: "#10b981", road: "#f97316" };
const COUNTRY_COLORS = {
    'США': '#3b82f6',
    'Великобритания': '#ef4444',
    'СССР': '#f59e0b',
    'Франция': '#6366f1',
    'Канада': '#0ea5e9',
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
                if (!dead) set({ routes, pois, config, error: null });
            } catch (e) { !dead && set({ routes: null, pois: null, config: null, error: e.message }); }
        })();
        return () => (dead = true);
    }, [isGlobal, country, transport, poiType]);
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
                <option value="air">Авиация</option><option value="sea">Морской</option><option value="rail">Ж/д</option><option value="road">Автодорога</option>
            </select>
            <select className={base} value={poiType} onChange={e => setPoiType(e.target.value)}>
                <option value="">Все POI</option>
                <option value="place">Место</option><option value="infrastructure">Инфраструктура</option><option value="event">Событие</option>
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
    useEffect(() => { const q = new URLSearchParams(); country && q.set('country', country); transport && q.set('transport', transport); poiType && q.set('poiType', poiType); hist.replace({ search: q.toString() }); }, [country, transport, poiType]);

    const { routes, pois, config, error } = useConferenceData({ isGlobal, country, transport, poiType });
    if (error) return <div className="p-6 text-red-600">{error}</div>;
    if (!routes || !pois || !config) return <div className="p-6 animate-pulse">Загрузка…</div>;

    const center = [config.center_lat, config.center_lng];
    const zoom = config.zoom;
    const visibleCountries = Array.from(new Set(routes.map(r => r.country).filter(Boolean)));
    const colorOf = r => COUNTRY_COLORS[r.country] || COLORS[r.transport] || '#64748b';

    return (
        <div className="h-[calc(100vh-64px)] relative bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="absolute z-[1031] left-6 top-6"><Filters {...{ country, setCountry, transport, setTransport, poiType, setPoiType }} /></div>
            <div className="absolute z-[1031] left-6 bottom-6 bg-white/70 backdrop-blur-lg rounded-xl shadow px-4 py-3 text-sm space-y-2 max-w-xs">
                <div className="font-medium mb-1">Легенда</div>
                {visibleCountries.length ? visibleCountries.map(c => (<div key={c} className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded-sm" style={{ background: COUNTRY_COLORS[c] || '#64748b' }}></span>{c}</div>)) : <div className="text-gray-500">Нет маршрутов (фильтр)</div>}
            </div>

            <MapContainer center={center} zoom={zoom}>
                {routes.map(r => (
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

// ---------------- Participant list ---------------- //
function ParticipantList() {
    const params = useQueryParams();
    const hist   = useHistory();
    const [country, setCountry] = useState(params.get('country') || '');
    const [role,    setRole]    = useState(params.get('role')    || '');
    const [data, setData] = useState({ list: null, error: null });
    const [sel,  setSel]  = useState(null);

    // --- sync filters with url
    useEffect(() => { const q = new URLSearchParams(); country && q.set('country', country); role && q.set('role', role); hist.replace({ search: q.toString() }); }, [country, role]);

    // --- fetch participants
    useEffect(() => {
        let dead=false; const q=new URLSearchParams(); country&&q.set('country',country); role&&q.set('role',role);
        fetchJSON(`/api/participants?${q.toString()}`)
            .then(d=>!dead&&setData({list:d,error:null}))
            .catch(e=>!dead&&setData({list:null,error:e.message}));
        return ()=>dead=true;
    },[country,role]);

    const { list, error } = data;
    if(error) return <div className="p-6 text-red-600">{error}</div>;
    if(!list)   return <div className="p-6 animate-pulse">Загрузка…</div>;

    const countries = Array.from(new Set(list.map(p=>p.country))).sort();
    const roles     = Array.from(new Set(list.map(p=>p.role))).sort();

    // helper to split description (format: URL | текст)
    const parseDesc = (d='') => {
        const [url, ...rest] = d.split('|');
        return { url: url?.startsWith('http') ? url.trim() : null, text: rest.join('|').trim() || d };
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* sidebar */}
            <div className="w-80 flex-shrink-0 bg-white/70 backdrop-blur-md border-r border-gray-200">
                <div className="p-4 space-y-3">
                    <select value={country} onChange={e=>setCountry(e.target.value)} className="w-full p-2 rounded-lg border">
                        <option value="">Все страны</option>
                        {countries.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={role} onChange={e=>setRole(e.target.value)} className="w-full p-2 rounded-lg border">
                        <option value="">Все роли</option>
                        {roles.map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <ul className="overflow-y-auto h-[calc(100%-168px)] divide-y divide-gray-200">
                    {list.map(p=> (
                        <li key={p.id} onClick={()=>setSel(p)} className={`p-4 cursor-pointer hover:bg-indigo-50 transition ${sel?.id===p.id?'bg-indigo-100':''}`}>
                            <span className="font-medium">{p.name}</span>
                            <div className="text-xs text-gray-600">{p.role}</div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* details */}
            <div className="flex-1 p-8 overflow-y-auto">
                {sel ? (()=>{ const {url,text}=parseDesc(sel.description); return (
                    <div className="prose max-w-none bg-white/70 backdrop-blur-lg p-6 rounded-xl shadow-lg">
                        <h2>{sel.name}</h2>
                        <p className="text-sm text-gray-500 mb-4">{sel.role} · {sel.country}</p>
                        {url && <img src={url} alt={sel.name} className="mb-4 rounded shadow max-w-xs"/>}
                        <p style={{whiteSpace:'pre-wrap'}}>{text}</p>
                    </div>
                );})() : <p className="text-gray-600">Выберите участника слева…</p>}
            </div>
        </div>
    );
}

function NavLink({ to, children }) { return <Link to={to} className="px-4 py-2 hover:bg-white/20 rounded transition">{children}</Link>; }

function App(){
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
                <Route exact path="/"       render={()=> <MapView isGlobal={true}  />} />
                <Route       path="/local"  render={()=> <MapView isGlobal={false} />} />
                <Route       path="/participants" component={ParticipantList} />
            </Switch>
        </BrowserRouter>
    );
}

ReactDOM.render(<App/>, document.getElementById('root'));
(<App />, document.getElementById('root'));
