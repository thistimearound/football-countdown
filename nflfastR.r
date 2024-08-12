# Load necessary libraries
library(tidyverse)
library(tidyr)
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

# Replace all instances of "Invalid Number" with "NA"
team_schedules <- data.frame(lapply(team_schedules, function(x) {
  gsub("Invalid Number", "NA", x)
}))

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
    game_id,
    season,
    game_type,
    week,
    gameday,
    weekday,
    gametime,
    away_team,
    away_score,
    home_team,
    home_score,
    location,
    result, # The number of points the home team scored minus the number of points the visiting team scored. Equals h_score - v_score. Is NA for games which haven't yet been played. Convenient for evaluating against the spread bets. # nolint: line_length_linter
    total, # The sum of each team's score in the game. Equals h_score + v_score. Is NA for games which haven't yet been played. Convenient for evaluating over/under total bets. # nolint: line_length_linter
    away_moneyline,
    home_moneyline,
    spread_line,
    away_spread_odds,
    home_spread_odds,
    total_line,
    over_odds,
    under_odds,
    roof,
    surface,
    temp,
    wind,
    stadium
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
process_games <- function(schedule, team_col, opponent_col, score_col, is_home_game, spread_odds_col, moneyline_col, home_or_away_symbol) { # nolint: line_length_linter
  schedule %>%
    mutate(
      team = sapply(!!sym(team_col), format_team_name),
      opponent = sapply(!!sym(opponent_col), format_team_name),
      score = !!sym(score_col),
      isHomeGame = is_home_game,
      home_or_away = as.character(home_or_away_symbol), # Ensure home_or_away is character # nolint: line_length_linter.
      adj_spread_odds = as.integer(!!sym(spread_odds_col)), # Ensure adj_spread_odds is integer # nolint: line_length_linter
      adj_moneyline = !!sym(moneyline_col),
      spread_line = ifelse(spread_line < 0, paste0(ifelse(is_home_game, "+", "-"), abs(spread_line)), paste0(ifelse(is_home_game, "-", "+"), abs(spread_line))), # nolint: line_length_linter
      adj_moneyline = ifelse(adj_moneyline >= 0, paste0("+", adj_moneyline), as.character(adj_moneyline)) # nolint: line_length_linter
    ) %>%
    select(team, opponent, game_id, season, week, weekday, datetime, isHomeGame, home_or_away, score, stadium, location, spread_line, adj_spread_odds, adj_moneyline, result, total, total_line, over_odds, under_odds, roof, surface, temp, wind) # nolint: line_length_linter
}

home_games <- process_games(schedule_cleaned, "home_team", "away_team", "home_score", TRUE, "home_spread_odds", "home_moneyline", "vs") # nolint: line_length_linter
away_games <- process_games(schedule_cleaned, "away_team", "home_team", "away_score", FALSE, "away_spread_odds", "away_moneyline", "@") # nolint: line_length_linter

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
    opponent = ifelse(opponent == "BYE", opponent, reverse_team_name_mapping[opponent]) # Replace BYE with "BYE" # nolint: line_length_linter
  ) %>%
  group_by(team) %>%
  summarise(
    games = list(
      tibble(
        opponent = opponent,
        date = date,
        isHomeGame = isHomeGame,
        home_or_away = home_or_away,
        stadium = stadium,
        location = as.character(location), # Ensure location is a character vector # nolint: line_length_linter
        week = week,
        weekday = weekday,
        result = result,
        score = score,
        total = total,
        spread_line = spread_line,
        adj_spread_odds = adj_spread_odds,
        adj_moneyline = adj_moneyline,
        total_line = total_line,
        over_odds = over_odds,
        under_odds = under_odds,
        roof = roof,
        surface = surface,
        temp = temp,
        wind = wind
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