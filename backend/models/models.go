package models

type Route struct {
	ID           int           `json:"id" db:"id"`
	Name         string        `json:"name" db:"name"`
	Transport    string        `json:"transport" db:"transport"`
	IsGlobal     bool          `json:"is_global" db:"is_global"`
	Country      *string       `json:"country,omitempty" db:"country"`
	Path         []RoutePoint  `json:"path" db:"-"`
	Participants []Participant `json:"participants,omitempty" db:"-"`
}

type RouteParticipant struct {
	ID            int `json:"id" db:"id"`
	RouteID       int `json:"route_id" db:"route_id"`
	ParticipantID int `json:"participant_id" db:"participant_id"`
}

type RoutePoint struct {
	ID      int     `json:"id,omitempty" db:"id"`
	RouteID int     `json:"route_id,omitempty" db:"route_id"`
	Lat     float64 `json:"lat" db:"lat"`
	Lng     float64 `json:"lng" db:"lng"`
}

type POI struct {
	ID            int           `json:"id" db:"id"`
	Name          string        `json:"name" db:"name"`
	Lat           float64       `json:"lat" db:"lat"`
	Lng           float64       `json:"lng" db:"lng"`
	Type          string        `json:"type" db:"type"`
	Description   string        `json:"description" db:"description"`
	IsLivingPlace *bool         `json:"is_living_place,omitempty" db:"is_living_place"`
	Photos        []POIPhoto    `json:"photos" db:"-"`
	Participants  []Participant `json:"participants,omitempty" db:"-"`
}

type POIParticipant struct {
	ID            int `json:"id" db:"id"`
	POIID         int `json:"poi_id" db:"poi_id"`
	ParticipantID int `json:"participant_id" db:"participant_id"`
}

type POIPhoto struct {
	ID    int    `json:"id,omitempty" db:"id"`
	POIID int    `json:"poi_id,omitempty" db:"poi_id"`
	URL   string `json:"url" db:"url"`
}

type Participant struct {
	ID          int    `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Country     string `json:"country" db:"country"`
	Role        string `json:"role" db:"role"`
	Description string `json:"description" db:"description"`
}

type MapConfig struct {
	ID        int     `json:"id" db:"id"`
	CenterLat float64 `json:"center_lat" db:"center_lat"`
	CenterLng float64 `json:"center_lng" db:"center_lng"`
	Zoom      int     `json:"zoom" db:"zoom"`
}

type RouteFilter struct {
	Country   *string `form:"country,omitempty"`
	Transport *string `form:"transport,omitempty"`
	IsGlobal  *bool   `form:"is_global,omitempty"`
}

type POIFilter struct {
	Type          *string `form:"type,omitempty"`
	IsLivingPlace *bool   `form:"is_living_place,omitempty"`
}

type ParticipantFilter struct {
	Country *string `form:"country,omitempty"`
	Role    *string `form:"role,omitempty"`
}
