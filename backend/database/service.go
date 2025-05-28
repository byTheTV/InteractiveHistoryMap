package database

import (
	"encoding/json"
	"fmt"
	"history-project-backend/models"
	"strings"

	supabase "github.com/supabase-community/supabase-go"
)

type APIService struct {
	client *supabase.Client
}

func NewAPIService(supabaseURL, apiKey string) *APIService {
	client, err := supabase.NewClient(supabaseURL, apiKey, &supabase.ClientOptions{})
	if err != nil {
		panic(fmt.Sprintf("Failed to create Supabase client: %v", err))
	}

	return &APIService{
		client: client,
	}
}

func (s *APIService) GetRoutes(filter models.RouteFilter) ([]models.Route, error) {
	query := s.client.From("routes").Select("*", "", false)

	if filter.Country != nil {
		query = query.Eq("country", *filter.Country)
	}
	if filter.Transport != nil {
		query = query.Eq("transport", *filter.Transport)
	}
	if filter.IsGlobal != nil {
		query = query.Eq("is_global", fmt.Sprintf("%t", *filter.IsGlobal))
	}

	resp, _, err := query.Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch routes: %w", err)
	}

	var routes []models.Route
	if err := json.Unmarshal(resp, &routes); err != nil {
		return nil, fmt.Errorf("failed to unmarshal routes: %w", err)
	}

	for i := range routes {
		points, err := s.getRoutePoints(routes[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch route points for route %d: %w", routes[i].ID, err)
		}
		routes[i].Path = points

		participants, err := s.getRouteParticipants(routes[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch participants for route %d: %w", routes[i].ID, err)
		}
		routes[i].Participants = participants
	}

	return routes, nil
}

func (s *APIService) getRoutePoints(routeID int) ([]models.RoutePoint, error) {
	resp, _, err := s.client.From("route_points").Select("*", "", false).Eq("route_id", fmt.Sprintf("%d", routeID)).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch route points: %w", err)
	}

	var points []models.RoutePoint
	if err := json.Unmarshal(resp, &points); err != nil {
		return nil, fmt.Errorf("failed to unmarshal route points: %w", err)
	}

	return points, nil
}

func (s *APIService) GetPOIs(filter models.POIFilter) ([]models.POI, error) {
	query := s.client.From("poi").Select("*", "", false)

	if filter.Type != nil {
		query = query.Eq("type", *filter.Type)
	}

	if filter.IsLivingPlace != nil {
		query = query.Eq("is_living_place", fmt.Sprintf("%t", *filter.IsLivingPlace))
	}

	resp, _, err := query.Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch POIs: %w", err)
	}

	var pois []models.POI
	if err := json.Unmarshal(resp, &pois); err != nil {
		return nil, fmt.Errorf("failed to unmarshal POIs: %w", err)
	}

	for i := range pois {
		photos, err := s.getPOIPhotos(pois[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch photos for POI %d: %w", pois[i].ID, err)
		}
		pois[i].Photos = photos

		participants, err := s.getPOIParticipants(pois[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch participants for POI %d: %w", pois[i].ID, err)
		}
		pois[i].Participants = participants
	}

	return pois, nil
}

func (s *APIService) getPOIPhotos(poiID int) ([]models.POIPhoto, error) {
	resp, _, err := s.client.From("poi_photos").Select("*", "", false).Eq("poi_id", fmt.Sprintf("%d", poiID)).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch POI photos: %w", err)
	}

	var photos []models.POIPhoto
	if err := json.Unmarshal(resp, &photos); err != nil {
		return nil, fmt.Errorf("failed to unmarshal POI photos: %w", err)
	}

	return photos, nil
}

func (s *APIService) GetParticipants(filter models.ParticipantFilter) ([]models.Participant, error) {
	query := s.client.From("participants").Select("*", "", false)

	if filter.Country != nil {
		query = query.Eq("country", *filter.Country)
	}
	if filter.Role != nil {
		query = query.Eq("role", *filter.Role)
	}

	resp, _, err := query.Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch participants: %w", err)
	}

	var participants []models.Participant
	if err := json.Unmarshal(resp, &participants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal participants: %w", err)
	}

	return participants, nil
}

func (s *APIService) GetMapConfig() (*models.MapConfig, error) {
	resp, _, err := s.client.From("map_config").Select("*", "", false).Single().Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch map config: %w", err)
	}

	var config models.MapConfig
	if err := json.Unmarshal(resp, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal map config: %w", err)
	}

	return &config, nil
}

func (s *APIService) getRouteParticipants(routeID int) ([]models.Participant, error) {
	resp, _, err := s.client.From("route_participants").Select("participant_id", "", false).Eq("route_id", fmt.Sprintf("%d", routeID)).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch route_participants: %w", err)
	}

	var routeParticipants []struct {
		ParticipantID int `json:"participant_id"`
	}
	if err := json.Unmarshal(resp, &routeParticipants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal route_participants: %w", err)
	}

	if len(routeParticipants) == 0 {
		return []models.Participant{}, nil
	}
	participantIDs := make([]string, len(routeParticipants))
	for i, rp := range routeParticipants {
		participantIDs[i] = fmt.Sprintf("%d", rp.ParticipantID)
	}

	query := s.client.From("participants").Select("*", "", false).Filter("id", "in", fmt.Sprintf("(%s)", strings.Join(participantIDs, ",")))

	resp, _, err = query.Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch participants: %w", err)
	}

	var participants []models.Participant
	if err := json.Unmarshal(resp, &participants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal participants: %w", err)
	}

	return participants, nil
}

func (s *APIService) getPOIParticipants(poiID int) ([]models.Participant, error) {
	resp, _, err := s.client.From("poi_residents").Select("participant_id", "", false).Eq("poi_id", fmt.Sprintf("%d", poiID)).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch poi_residents: %w", err)
	}

	var poiParticipants []struct {
		ParticipantID int `json:"participant_id"`
	}
	if err := json.Unmarshal(resp, &poiParticipants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal poi_participants: %w", err)
	}

	if len(poiParticipants) == 0 {
		return []models.Participant{}, nil
	}
	participantIDs := make([]string, len(poiParticipants))
	for i, pp := range poiParticipants {
		participantIDs[i] = fmt.Sprintf("%d", pp.ParticipantID)
	}

	query := s.client.From("participants").Select("*", "", false).Filter("id", "in", fmt.Sprintf("(%s)", strings.Join(participantIDs, ",")))

	resp, _, err = query.Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch participants: %w", err)
	}

	var participants []models.Participant
	if err := json.Unmarshal(resp, &participants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal participants: %w", err)
	}

	return participants, nil
}

func (s *APIService) GetParticipantRoutes(participantID int) ([]models.Route, error) {
	resp, _, err := s.client.From("route_participants").Select("route_id", "", false).Eq("participant_id", fmt.Sprintf("%d", participantID)).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch route_participants: %w", err)
	}

	var routeParticipants []struct {
		RouteID int `json:"route_id"`
	}
	if err := json.Unmarshal(resp, &routeParticipants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal route_participants: %w", err)
	}

	if len(routeParticipants) == 0 {
		return []models.Route{}, nil
	}

	routeIDs := make([]string, len(routeParticipants))
	for i, rp := range routeParticipants {
		routeIDs[i] = fmt.Sprintf("%d", rp.RouteID)
	}

	query := s.client.From("routes").Select("*", "", false).Filter("id", "in", fmt.Sprintf("(%s)", strings.Join(routeIDs, ",")))

	resp, _, err = query.Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch routes: %w", err)
	}

	var routes []models.Route
	if err := json.Unmarshal(resp, &routes); err != nil {
		return nil, fmt.Errorf("failed to unmarshal routes: %w", err)
	}

	for i := range routes {
		points, err := s.getRoutePoints(routes[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch route points for route %d: %w", routes[i].ID, err)
		}
		routes[i].Path = points
	}

	return routes, nil
}

func (s *APIService) GetParticipantPOIs(participantID int) ([]models.POI, error) {
	resp, _, err := s.client.From("poi_residents").Select("poi_id", "", false).Eq("participant_id", fmt.Sprintf("%d", participantID)).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch poi_residents: %w", err)
	}

	var poiParticipants []struct {
		POIID int `json:"poi_id"`
	}
	if err := json.Unmarshal(resp, &poiParticipants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal poi_residents: %w", err)
	}

	if len(poiParticipants) == 0 {
		return []models.POI{}, nil
	}

	poiIDs := make([]string, len(poiParticipants))
	for i, pp := range poiParticipants {
		poiIDs[i] = fmt.Sprintf("%d", pp.POIID)
	}

	query := s.client.From("poi").Select("*", "", false).Filter("id", "in", fmt.Sprintf("(%s)", strings.Join(poiIDs, ",")))

	resp, _, err = query.Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch POIs: %w", err)
	}

	var pois []models.POI
	if err := json.Unmarshal(resp, &pois); err != nil {
		return nil, fmt.Errorf("failed to unmarshal POIs: %w", err)
	}

	for i := range pois {
		photos, err := s.getPOIPhotos(pois[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch photos for POI %d: %w", pois[i].ID, err)
		}
		pois[i].Photos = photos
	}

	return pois, nil
}
