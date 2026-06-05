# Load required packages
library(ffscrapr)
library(dplyr)
library(jsonlite)
library(tidyr)

# Set the season and week for projections
seasonYear <- 2025  # Set to current season
week <- 0  # 0 for season-long projections

# Connect to the Sleeper API
message("Connecting to Sleeper API...")
conn <- sleeper_connect()

# Fetch player details to get Sleeper IDs
message("Fetching player details...")
playerDetails <- ff_players(conn) %>%
  select(player_id, player_name, pos, team, years_exp)

# Fetch projections
message("Fetching projections data...")
playerProjections <- try({
  ff_projections(conn, season = seasonYear, week = week)
}, silent = TRUE)

# If season-long projections failed, try getting week 1 and extrapolate
if (inherits(playerProjections, "try-error")) {
  message("Season-long projections not available. Using Week 1 projections as fallback...")
  playerProjections <- ff_projections(conn, season = seasonYear, week = 1) %>%
    mutate(points = pts_half * 17)  # Simple extrapolation
} else {
  # If we got projections, make sure we have a points column
  playerProjections <- playerProjections %>%
    mutate(points = ifelse(is.na(pts_half), pts_std, pts_half))
}

# Join projections with player details
message("Processing data...")
combinedData <- playerProjections %>%
  select(player_id, points) %>%
  right_join(playerDetails, by = "player_id") %>%
  mutate(
    rookie = years_exp == 0,
    # Ensure we have projection values for all players
    projected_points = points
  ) %>%
  # Remove NA projections or set to 0
  mutate(projected_points = ifelse(is.na(projected_points), 0, projected_points))

# Format for JSON output
playerMap <- combinedData %>%
  select(player_id, player_name, pos, team, rookie, projected_points) %>%
  # Create a nested structure with player_id as key
  nest_by(player_id) %>%
  deframe()

# Convert to proper JSON format
jsonData <- list(
  metadata = list(
    season = seasonYear,
    source = "ffscrapr",
    updated = format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  ),
  players = playerMap
)

# Create output directory if it doesn't exist
dir.create("./data", showWarnings = FALSE)

# Save as JSON file
outputFile <- paste0("./data/player_projections_", seasonYear, ".json")
write_json(jsonData, outputFile, pretty = TRUE, auto_unbox = TRUE)

message(paste("Projections saved to", outputFile))
message(paste("Total players with projections:", sum(!is.na(combinedData$projected_points))))