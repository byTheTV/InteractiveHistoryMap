const { useState, useEffect } = React;
const { BrowserRouter, Route, Switch, Link } = ReactRouterDOM;
const { MapContainer, TileLayer, Polyline, Marker, Popup } = ReactLeaflet;

const MapView = ({ isGlobal }) => {
    const [routes, setRoutes] = useState([]);
    const [pois, setPois] = useState([]);
    const [filter, setFilter] = useState({});

    useEffect(() => {
        setRoutes([
            { id: 1, name: "Маршрут Рузвельта", path: [[44.5, 34.1], [44.6, 34.2]], participant_name: "Рузвельт", country: "США" },
            { id: 2, name: "Маршрут Черчилля", path: [[44.4, 34.0], [44.5, 34.1]], participant_name: "Черчилль", country: "Великобритания" }
        ]);
        setPois([
            { id: 1, name: "Ливадийский дворец", lat: 44.5, lng: 34.1, description: "Место встречи", resident_name: "Рузвельт" },
            { id: 2, name: "Юсуповский дворец", lat: 44.6, lng: 34.2, description: "Резиденция" }
        ]);
    }, [filter]);

    return (
        <div style={{ height: 'calc(100vh - 64px)', width: '100%' }}>
            <MapContainer center={[44.5, 34.1]} zoom={10} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {routes.map(route => (
                    <Polyline key={route.id} positions={route.path}>
                        <Popup>
                            <h3>{route.name}</h3>
                            <p>Участник: {route.participant_name}</p>
                            <p>Страна: {route.country}</p>
                        </Popup>
                    </Polyline>
                ))}
                {pois.map(poi => (
                    <Marker key={poi.id} position={[poi.lat, poi.lng]}>
                        <Popup>
                            <h3>{poi.name}</h3>
                            <p>{poi.description}</p>
                            {poi.resident_name && <p>Житель: {poi.resident_name}</p>}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

const ParticipantList = () => {
    const [participants, setParticipants] = useState([]);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        setParticipants([
            { id: 1, name: "Ф. Рузвельт", role: "Президент США", description: "Руководил делегацией США" },
            { id: 2, name: "У. Черчилль", role: "Премьер-министр Великобритании", description: "Представлял Великобританию" }
        ]);
    }, []);

    return (
        <div className="p-4">
            <h2 className="text-2xl mb-4">Участники</h2>
            <ul className="space-y-2">
                {participants.map(p => (
                    <li
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="cursor-pointer p-2 hover:bg-gray-100"
                    >
                        {p.name} - {p.role}
                    </li>
                ))}
            </ul>
            {selected && (
                <div className="mt-4 p-4 bg-gray-100 rounded">
                    <h3 className="text-xl">{selected.name}</h3>
                    <p>{selected.description}</p>
                </div>
            )}
        </div>
    );
};

const App = () => (
    <BrowserRouter>
        <nav className="p-4 bg-blue-600 text-white flex gap-4">
            <Link to="/">Мировая карта</Link>
            <Link to="/local">Локальная карта</Link>
            <Link to="/participants">Участники</Link>
        </nav>
        <Switch>
            <Route path="/" exact render={() => <MapView isGlobal={true} />} />
            <Route path="/local" render={() => <MapView isGlobal={false} />} />
            <Route path="/participants" component={ParticipantList} />
        </Switch>
    </BrowserRouter>
);

ReactDOM.render(<App />, document.getElementById('root'));