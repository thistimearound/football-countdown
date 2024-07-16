# https://www.nflfastr.com/articles/nflfastR.html
# https://nflreadr.nflverse.com/index.html

# Load necessary libraries
library(tidyverse)
library(ggrepel)
library(nflreadr)
library(nflplotR)
library(lubridate)

# Load NFL schedule data
schedule_data <- load_schedules(2024)

# Handle the case where the 2024 schedule data is not available
if (is.null(schedule_data)) {
  schedule_data <- NULL  # or any other appropriate action
}

# Clean and process the data
if (!is.null(schedule_data)) {
  schedule_cleaned <- schedule_data %>%
    select(week, gameday, gametime, home_team, away_team) %>%
    mutate(
      opponent = away_team,
      home_or_away = "vs"
    ) %>%
    bind_rows(
      schedule_data %>%
        select(week, gameday, gametime, away_team, home_team) %>%
        mutate(
          opponent = home_team,
          home_or_away = "@"
        )
    )

# Sort the data by home team and away team
schedule_sorted <- schedule_cleaned %>%
  arrange(home_team, away_team)

# View the cleaned and sorted data
View(schedule_sorted)
}