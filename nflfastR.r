# https://www.nflfastr.com/articles/nflfastR.html
# https://nflreadr.nflverse.com/index.html

# Load necessary libraries
library(tidyverse)
library(ggrepel)
library(nflreadr)
library(nflplotR)
library(dplyr)
library(lubridate)

# Load NFL schedule data
schedule_data <- load_schedules(2024)

# Clean and process the data
schedule_cleaned <- schedule_data %>%
  dplyr::select(week, gameday, gametime, home_team, away_team) %>%
  dplyr::mutate(
    opponent = away_team,
    home_or_away = "vs"
  ) %>%
  dplyr::bind_rows(
    schedule_data %>%
      dplyr::select(week, gameday, gametime, away_team, home_team) %>%
      dplyr::mutate(
        opponent = home_team,
        home_or_away = "@"
      )
  )

# Sort the data by home team and away team
schedule_sorted <- schedule_cleaned %>%
  dplyr::arrange(home_team, away_team)

# View the cleaned and sorted data
View(schedule_sorted)