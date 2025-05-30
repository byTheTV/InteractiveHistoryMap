package main

import (
	"history-project-backend/config"
	"history-project-backend/database"
	"history-project-backend/handlers"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db := database.NewAPIService(cfg.SupabaseURL, cfg.SupabaseAnonKey)

	handler := handlers.NewAPIHandler(db)

	r := gin.Default()	

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})
	api := r.Group("/api")
	{
		api.GET("/world-routes", handler.GetWorldRoutes)
		api.GET("/local-routes", handler.GetLocalRoutes)
		api.GET("/poi", handler.GetPOIs)
		api.GET("/participants", handler.GetParticipants)
		api.GET("/map-config", handler.GetMapConfig)

		api.GET("/participants/:id/routes", handler.GetParticipantRoutes)
		api.GET("/participants/:id/pois", handler.GetParticipantPOIs)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
	r.HEAD("/health", func(c *gin.Context) {
		c.Status(200)
	})

	log.Printf("Server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
