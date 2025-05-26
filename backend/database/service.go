package database

import (
	"encoding/json"
	"fmt"
	"history-project-backend/models"

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
