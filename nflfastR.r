# https://www.nflfastr.com/articles/nflfastR.html
# https://nflreadr.nflverse.com/index.html

# Load necessary libraries
library(tidyverse)
library(ggrepel)
library(nflreadr)
library(nflplotR)
library(lubridate)

# Load NFL schedule data for 2024
schedule_data <- tryCatch(
  load_schedules(2024),
  error = function(e) {
    message("Failed to load schedule data: ", e)
    NULL
  }
)

# Check if the schedule data is available and inspect the column names
if (!is.null(schedule_data)) {
  print(colnames(schedule_data))
} else {
  stop("Schedule data is not available for 2024.")
}

# Proceed with data cleaning and processing
schedule_cleaned <- schedule_data %>%
  select(
    week,
    gameday,   # Correct column for game day
    gametime,  # Correct column for game time
    home_team,
    away_team,
    location,
    spread_line
  ) %>%
  mutate(
    home_or_away = "vs",
    matchup = paste(home_team, "vs", away_team),
    datetime = paste(gameday, gametime) %>% ymd_hm(tz = "UTC")  # Correctly parse date and time
  ) %>%
  select(-gameday, -gametime) %>%  # Remove gameday and gametime columns
  bind_rows(
    schedule_data %>%
      select(
        week,
        gameday,
        gametime,
        home_team,
        away_team,
        location,
        spread_line
      ) %>%
      mutate(
        home_or_away = "@",
        matchup = paste(away_team, "@", home_team),
        datetime = paste(gameday, gametime) %>% ymd_hm(tz = "UTC")  # Correctly parse date and time
      ) %>%
      select(-gameday, -gametime) %>%  # Remove gameday and gametime columns
      rename(
        home_team = away_team,
        away_team = home_team
      )
  )

# Sort the data
schedule_sorted <- schedule_cleaned %>%
  arrange(week, datetime, home_team, location, away_team, spread_line)

# View the cleaned and sorted data
View(schedule_sorted)