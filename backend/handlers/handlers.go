package handlers

import (
	"history-project-backend/database"
	"history-project-backend/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type APIHandler struct {
	db *database.APIService
}

func NewAPIHandler(db *database.APIService) *APIHandler {
	return &APIHandler{db: db}
}

func (h *APIHandler) GetWorldRoutes(c *gin.Context) {
	var filter models.RouteFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid query parameters"})
		return
	}

	isGlobal := true
	filter.IsGlobal = &isGlobal

	routes, err := h.db.GetRoutes(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, routes)
}

func (h *APIHandler) GetLocalRoutes(c *gin.Context) {
	var filter models.RouteFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid query parameters"})
		return
	}

	isGlobal := false
	filter.IsGlobal = &isGlobal

	routes, err := h.db.GetRoutes(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, routes)
}

func (h *APIHandler) GetPOIs(c *gin.Context) {
	var filter models.POIFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid query parameters"})
		return
	}

	pois, err := h.db.GetPOIs(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pois)
}

func (h *APIHandler) GetParticipants(c *gin.Context) {
	var filter models.ParticipantFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid query parameters"})
		return
	}

	participants, err := h.db.GetParticipants(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, participants)
}

func (h *APIHandler) GetMapConfig(c *gin.Context) {
	config, err := h.db.GetMapConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

func (h *APIHandler) GetParticipantRoutes(c *gin.Context) {
	participantID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid participant ID"})
		return
	}

	routes, err := h.db.GetParticipantRoutes(participantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, routes)
}

func (h *APIHandler) GetParticipantPOIs(c *gin.Context) {
	participantID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid participant ID"})
		return
	}

	pois, err := h.db.GetParticipantPOIs(participantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pois)
}
