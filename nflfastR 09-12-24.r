# Load necessary libraries
library(dplyr)
library(jsonlite)
library(lubridate)
library(nflverse)
library(tidyverse)

# Prevent scientific notation
options(scipen = 9999)

# Function to calculate absolute result
calculate_absolute_result <- function(home_score, away_score) {
  abs(home_score - away_score)
}

# Function to log errors
log_error <- function(error_message) {
  writeLines(paste0("Error: ", error_message, "\n"),
             con = "error_log.txt")
}

# Main execution block
tryCatch({
  # Get the current season year
  current_year <- as.numeric(format(Sys.Date(), "%Y"))

  # Fetch schedule data
  schedule_data <- tryCatch({
    load_schedules(seasons = 2024)
  })

  # Check if the schedule data is available and inspect the column names
  #if (is.null(schedule_data) || nrow(schedule_data) == 0) {
  #  stop(paste("Schedule data is not available for", current_year))
  #}

  # Ensure schedule_data is not NULL and has rows
  if (!is.null(schedule_data) && nrow(schedule_data) > 0) {
    # Convert all columns to character if necessary
    schedule_data <- schedule_data %>%
      mutate(across(everything(), as.character))

    # Replace "Invalid Number" with NA
    schedule_data <- schedule_data %>%
      mutate(across(everything(), ~ ifelse(. == "Invalid Number", NA, .)))
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
  reverse_team_name_mapping <- tryCatch({
    setNames(
      gsub("-", " ", sapply(team_name_mapping,
                            function(x) tools::toTitleCase(x))),
      team_name_mapping
    )
  })

  # Ensure numeric columns are properly converted
  schedule_data <- tryCatch({
    schedule_data %>%
      mutate(across(c(spread_line, total_line, over_odds, under_odds),
                    ~ suppressWarnings(as.numeric(.))))
  })

  # Clean and process the data
  schedule_cleaned <- tryCatch({
    schedule_data %>%
      select(
        game_id, season, game_type, week, gameday, weekday, gametime,
        away_team, away_score, home_team, home_score, location,
        result, total, away_moneyline, home_moneyline, spread_line,
        away_spread_odds, home_spread_odds, total_line, over_odds,
        under_odds, roof, surface, temp, wind, stadium
      ) %>%
      mutate(
        home_or_away = "vs",
        matchup = paste(home_team, "vs", away_team),
        datetime = ymd_hm(paste(gameday, gametime), tz = "UTC")
      ) %>%
      select(-gameday, -gametime)
  })

  # Create a function to format team names
  format_team_name <- function(team) {
    team_formatted <- team_name_mapping[[tolower(team)]]
    if (is.null(team_formatted)) {
      stop(paste("Team abbreviation not found in mapping:", team))
    }
    team_formatted
  }

  # Transform the data into the desired format
  process_games <- function(schedule, team_col, opponent_col, score_col,
                            is_home_game, spread_odds_col, moneyline_col,
                            home_or_away_symbol) {
    tryCatch({
      schedule %>%
        mutate(
          team = sapply(!!sym(team_col), format_team_name),
          opponent = sapply(!!sym(opponent_col), format_team_name),
          score = !!sym(score_col),
          isHomeGame = is_home_game,
          home_or_away = as.character(home_or_away_symbol),
          adj_spread_odds = as.integer(!!sym(spread_odds_col)),
          adj_moneyline = !!sym(moneyline_col),
          spread_line = ifelse(spread_line < 0,
                               paste0(ifelse(is_home_game, "+", "-"),
                                      abs(spread_line)),
                               paste0(ifelse(is_home_game, "-", "+"),
                                      abs(spread_line))),
          adj_moneyline = ifelse(adj_moneyline >= 0,
                                 paste0("+", adj_moneyline),
                                 as.character(adj_moneyline)),
          result = home_score - away_score,
          absolute_result = calculate_absolute_result(home_score, away_score)
        ) %>%
        select(team, opponent, game_id, season, week, weekday, datetime,
               game_type, away_team, away_score, away_moneyline,
               home_team, home_score, home_moneyline, spread_line,
               away_spread_odds, home_spread_odds, score, total_line,
               isHomeGame, home_or_away, stadium, location, adj_spread_odds,
               adj_moneyline, result, absolute_result, total, total_line,
               over_odds, under_odds, roof, surface, temp, wind)
    })
  }

  home_games <- tryCatch({
    process_games(schedule_cleaned, "home_team", "away_team", "home_score",
                  TRUE, "home_spread_odds", "home_moneyline", "vs") %>%
      mutate(week = as.integer(week))
  })

  away_games <- tryCatch({
    process_games(schedule_cleaned, "away_team", "home_team", "away_score",
                  FALSE, "away_spread_odds", "away_moneyline", "@") %>%
      mutate(week = as.integer(week))
  })

  # Combine home and away games
  all_games <- tryCatch({
    bind_rows(home_games, away_games) %>%
      mutate(
        spread_line = as.numeric(gsub("[^0-9.-]", "", spread_line)),
        adj_moneyline = as.numeric(gsub("[^0-9.-]", "", adj_moneyline))
      )
  })

  # Function to add BYE weeks
  add_bye_weeks <- function(schedule) {
    tryCatch({
      all_weeks <- 1:18
      played_weeks <- as.integer(schedule$week)
      bye_weeks <- setdiff(all_weeks, played_weeks)

      bye_schedule <- tibble(
        team = unique(schedule$team),
        opponent = "BYE",
        game_id = NA,
        season = NA,
        week = bye_weeks,
        weekday = NA,
        datetime = NA,
        game_type = NA,
        away_team = NA,
        away_score = NA,
        away_moneyline = NA,
        home_team = NA,
        home_score = NA,
        home_moneyline = NA,
        spread_line = NA,
        away_spread_odds = NA,
        home_spread_odds = NA,
        score = NA,
        isHomeGame = NA,
        home_or_away = NA,
        stadium = NA,
        location = NA,
        adj_spread_odds = NA,
        adj_moneyline = NA,
        wins = max(schedule$wins, na.rm = TRUE),
        losses = max(schedule$losses, na.rm = TRUE),
        ties = max(schedule$ties, na.rm = TRUE),
        result = NA,
        total = NA,
        total_line = NA,
        over_odds = NA,
        under_odds = NA,
        roof = NA,
        surface = NA,
        temp = NA,        wind = NA
      )

      bind_rows(schedule, bye_schedule)
    })
  }

  # Modify add_bye_weeks Function to Handle Wins, Losses, Ties
  all_games <- tryCatch({
    all_games %>%
      group_by(team) %>%
      mutate(
        wins = sum(ifelse(result > 0, 1, 0), na.rm = TRUE),
        losses = sum(ifelse(result < 0, 1, 0), na.rm = TRUE),
        ties = sum(ifelse(result == 0 & !is.na(result), 1, 0), na.rm = TRUE)
      ) %>%
      ungroup()
  })

  # Group by team and add BYE weeks
  all_games_with_bye <- tryCatch({
    all_games %>%
      group_by(team) %>%
      group_modify(~ add_bye_weeks(.x)) %>%
      ungroup()
  })

  # Group by team and create the final structure
  team_schedules <- tryCatch({
    all_games_with_bye %>%
      arrange(week) %>%
      mutate(
        date = format(datetime, "%Y-%m-%dT%H:%M:%SZ"),
        opponent = ifelse(opponent == "BYE", opponent,
                          reverse_team_name_mapping[opponent])
      ) %>%
      group_by(team) %>%
      summarise(
        games = list(
          tibble(
            opponent = opponent,
            date = date,
            game_id = game_id,
            season = season,
            week = week,
            weekday = weekday,
            datetime = datetime,
            game_type = game_type,
            away_team = away_team,
            away_score = away_score,
            away_moneyline = away_moneyline,
            home_team = home_team,
            home_score = home_score,
            home_moneyline = home_moneyline,
            spread_line = spread_line,
            away_spread_odds = away_spread_odds,
            home_spread_odds = home_spread_odds,
            isHomeGame = isHomeGame,
            home_or_away = home_or_away,
            stadium = stadium,
            adj_spread_odds = adj_spread_odds,
            adj_moneyline = adj_moneyline,
            location = as.character(location),
            result = as.integer(result),
            absolute_result = as.integer(absolute_result),
            score = as.integer(score),
            total = as.integer(total),
            total_line = total_line,
            over_odds = over_odds,
            under_odds = under_odds,
            roof = roof,
            surface = surface,
            temp = temp,
            wind = wind
          )
        ),
        wins = sum(as.integer(result) > 0, na.rm = TRUE),
        losses = sum(as.integer(result) < 0, na.rm = TRUE),
        ties = sum(as.integer(result) == 0 & !is.na(result), na.rm = TRUE),
        .groups = "drop"
      ) %>%
      mutate(
        games = map2(games, wins, ~ bind_rows(.x, tibble(
          team = NA,
          opponent = "Cumulative Record",
          date = NA,
          game_id = NA,
          season = NA,
          week = NA,
          weekday = NA,
          datetime = NA,
          game_type = NA,
          away_team = NA,
          away_score = NA,
          away_moneyline = NA,
          home_team = NA,
          home_score = NA,
          home_moneyline = NA,
          spread_line = NA,
          away_spread_odds = NA,
          home_spread_odds = NA,
          score = NA,
          total_line = NA,
          isHomeGame = NA,
          home_or_away = NA,
          stadium = NA,
          location = NA,
          adj_spread_odds = NA,
          adj_moneyline = NA,
          result = NA,
          absolute_result = NA,
          total = NA,
          over_odds = NA,
          under_odds = NA,
          roof = NA,
          surface = NA,
          temp = NA,
          wind = NA,
          wins = .y,
          losses = losses[1],
          ties = ties[1]
        )))
      ) %>%
      deframe()
  })

  # Convert to JSON-like structure
  team_schedules_json <- tryCatch({
    jsonlite::toJSON(team_schedules, pretty = TRUE, auto_unbox = TRUE)
  })

  # Get the current date and time
  current_time <- Sys.time()

  # Write to file with timestamp
  tryCatch({
    writeLines(
      paste(
        "// Last updated:", current_time,
        "\nconst nflschedules2 = ", team_schedules_json, ";"
      ),
      "nfl-schedules2.js"
    )
  })

  # Success message
  cat("NFL schedules successfully processed and saved to nfl-schedules2.js\n")

})
