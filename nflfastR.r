# Load necessary libraries
library(tidyverse)
library(ggrepel)
library(nflreadr)
library(nflplotR)
library(lubridate)
library(jsonlite)
library(tibble)
library(dplyr)

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

# Define the mapping between team abbreviations and full names
team_name_mapping <- list(
  ari = "arizona-cardinals",
  atl = "atlanta-falcons",
  bal = "baltimore-ravens",
  buf = "buffalo-bills",
  car = "carolina-panthers",
  chi = "chicago-bears",
  cin = "cincinnati-bengals",
  cle = "cleveland-browns",
  dal = "dallas-cowboys",
  den = "denver-broncos",
  det = "detroit-lions",
  gb = "green-bay-packers",
  hou = "houston-texans",
  ind = "indianapolis-colts",
  jax = "jacksonville-jaguars",
  kc = "kansas-city-chiefs",
  lv = "las-vegas-raiders",
  lac = "los-angeles-chargers",
  la = "los-angeles-rams",
  mia = "miami-dolphins",
  min = "minnesota-vikings",
  ne = "new-england-patriots",
  no = "new-orleans-saints",
  nyg = "new-york-giants",
  nyj = "new-york-jets",
  phi = "philadelphia-eagles",
  pit = "pittsburgh-steelers",
  sf = "san-francisco-49ers",
  sea = "seattle-seahawks",
  tb = "tampa-bay-buccaneers",
  ten = "tennessee-titans",
  was = "washington-commanders"
)

# Create a reverse mapping for team names
reverse_team_name_mapping <- setNames(
  gsub("-", " ", sapply(team_name_mapping, function(x) tools::toTitleCase(x))),
  team_name_mapping
)

# Clean and process the data
schedule_cleaned <- schedule_data %>%
  select(
    week,
    gameday,
    gametime,
    home_team,
    away_team,
    location,
    spread_line,
    home_spread_odds,
    away_spread_odds,
    away_moneyline,
    home_moneyline,
    total_line # not doing anything with this column as of 08-03-2024
  ) %>%
  mutate(
    home_or_away = "vs",
    matchup = paste(home_team, "vs", away_team),
    datetime = paste(gameday, gametime) %>% ymd_hm(tz = "UTC")
  ) %>%
  select(-gameday, -gametime) # Remove gameday and gametime columns

# Create a function to format team names
format_team_name <- function(team) {
  team_formatted <- team_name_mapping[[tolower(team)]]
  if (is.null(team_formatted)) {
    stop(paste("Team abbreviation not found in mapping:", team))
  }
  return(team_formatted)
}

# Transform the data into the desired format
home_games <- schedule_cleaned %>%
  mutate(
    team = sapply(home_team, format_team_name),
    opponent = sapply(away_team, format_team_name),
    isHomeGame = TRUE,
    home_or_away = "vs",
    adj_spread_odds = home_spread_odds,
    adj_moneyline = home_moneyline,
    spread_line = ifelse(spread_line >= 0, paste0("+", spread_line), as.character(spread_line)), # nolint: line_length_linter
    adj_spread_odds = ifelse(adj_spread_odds >= 0, paste0("+", adj_spread_odds), as.character(adj_spread_odds)), # nolint: line_length_linter
    adj_moneyline = ifelse(adj_moneyline >= 0, paste0("+", adj_moneyline), as.character(adj_moneyline)) # nolint: line_length_linter
  ) %>%
  select(team, opponent, datetime, isHomeGame, home_or_away, week, spread_line, adj_spread_odds, adj_moneyline) # nolint: line_length_linter

away_games <- schedule_cleaned %>%
  mutate(
    team = sapply(away_team, format_team_name),
    opponent = sapply(home_team, format_team_name),
    isHomeGame = FALSE,
    home_or_away = "@",
    adj_spread_odds = away_spread_odds,
    adj_moneyline = away_moneyline,
    spread_line = ifelse(spread_line >= 0, paste0("+", spread_line), as.character(spread_line)), # nolint: line_length_linter
    adj_spread_odds = ifelse(adj_spread_odds >= 0, paste0("+", adj_spread_odds), as.character(adj_spread_odds)), # nolint: line_length_linter
    adj_moneyline = ifelse(adj_moneyline >= 0, paste0("+", adj_moneyline), as.character(adj_moneyline)) # nolint: line_length_linter
  ) %>%
  select(team, opponent, datetime, isHomeGame, home_or_away, week, spread_line, adj_spread_odds, adj_moneyline) # nolint: line_length_linter

# Combine home and away games
all_games <- bind_rows(home_games, away_games)

# Function to add BYE weeks
add_bye_weeks <- function(schedule) {
  all_weeks <- 1:18
  played_weeks <- schedule$week
  bye_weeks <- setdiff(all_weeks, played_weeks)

  bye_schedule <- tibble(
    team = unique(schedule$team),
    opponent = "BYE",
    datetime = NA,
    isHomeGame = NA,
    home_or_away = NA,
    week = bye_weeks,
    spread_line = NA,
    adj_spread_odds = NA,
    adj_moneyline = NA
  )

  bind_rows(schedule, bye_schedule)
}

# Group by team and add BYE weeks
all_games_with_bye <- all_games %>%
  group_by(team) %>%
  group_modify(~ add_bye_weeks(.x)) %>%
  ungroup()

# Group by team and create the final structure
team_schedules <- all_games_with_bye %>%
  arrange(week) %>%
  mutate(
    date = format(datetime, "%Y-%m-%dT%H:%M:%SZ"),
    opponent = ifelse(opponent == "BYE", opponent, reverse_team_name_mapping[opponent]) # Replace BYE with "BYE" # nolint: line_length_linter.
  ) %>%
  group_by(team) %>%
  summarise(
    games = list(
      tibble(
        opponent = opponent,
        date = date,
        isHomeGame = isHomeGame,
        home_or_away = home_or_away,
        week = week,
        spread_line = spread_line,
        adj_spread_odds = adj_spread_odds,
        adj_moneyline = adj_moneyline
      )
    ),
    .groups = "drop"
  ) %>%
  deframe()

# View the resulting structure
view(team_schedules)

# Convert to JSON-like structure
team_schedules_json <- jsonlite::toJSON(team_schedules, pretty = TRUE, auto_unbox = TRUE) # nolint: line_length_linter

# Write to file
writeLines(paste("const nflschedules = ", team_schedules_json, ";"), "nfl-schedules.js") # nolint: line_length_linter

# View the resulting JavaScript
cat(paste("const nflschedules = ", team_schedules_json, ";"))