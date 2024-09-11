# Load necessary libraries
tryCatch({
  library(nflverse)
  library(tidyverse)
  library(dplyr)
  library(lubridate)
  library(jsonlite)
}, error = function(e) {
  stop("Failed to load required libraries: ", e$message)
})

# Prevent scientific notation
options(scipen = 9999)

# Function to log errors
log_error <- function(error_message) {
  cat(paste0("Error: ", error_message, "\n"),
      file = "error_log.txt",
      append = TRUE)
}

# Main execution block
tryCatch({
  # Get the current season year
  current_year <- as.numeric(format(Sys.Date(), "%Y"))

  # Fetch schedule data
  schedule_data <- tryCatch({
    load_schedules(seasons = 2024)
  }, error = function(e) {
    log_error(paste("Failed to load schedules:", e$message))
    stop("Failed to load schedules. Check error_log.txt for details.")
  })

  # Check if the schedule data is available and inspect the column names
  if (is.null(schedule_data) || nrow(schedule_data) == 0) {
    stop(paste("Schedule data is not available for", current_year))
  }

  # Replace all instances of "Invalid Number" with NA
  schedule_data <- tryCatch({
    schedule_data %>%
      mutate(across(everything(), ~ gsub("Invalid Number", "NA", .)))

  }, error = function(e) {
    log_error(paste("Failed to clean schedule data:", e$message))
    stop("Failed to clean schedule data. Check error_log.txt for details.")
  })

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
  }, error = function(e) {
    log_error(paste("Failed to create reverse team name mapping:", e$message))
    stop("Failed to create reverse team name mapping.
    Check error_log.txt for details.")
  })

  # Ensure numeric columns are properly converted
  schedule_data <- tryCatch({
    schedule_data %>%
      mutate(across(c(spread_line, total_line, over_odds, under_odds),
                    as.numeric))
  }, error = function(e) {
    log_error(paste("Failed to convert numeric columns:", e$message))
    stop("Failed to convert numeric columns. Check error_log.txt for details.")
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
  }, error = function(e) {
    log_error(paste("Failed to clean and process schedule data:", e$message))
    stop("Failed to clean and process schedule data.
    Check error_log.txt for details.")
  })

  # Create a function to format team names
  format_team_name <- function(team) {
    team_formatted <- team_name_mapping[[tolower(team)]]
    if (is.null(team_formatted)) {
      stop(paste("Team abbreviation not found in mapping:", team))
    }
    return(team_formatted)
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
                                 as.character(adj_moneyline))
        ) %>%
        select(team, opponent, game_id, season, week,
               weekday, datetime, isHomeGame,
               home_or_away, score, stadium, location, spread_line,
               adj_spread_odds, adj_moneyline, result, total, total_line,
               over_odds, under_odds, roof, surface, temp, wind)
    }, error = function(e) {
      log_error(paste("Failed to process games:", e$message))
      stop("Failed to process games. Check error_log.txt for details.")
    })
  }

  home_games <- tryCatch({
    process_games(schedule_cleaned, "home_team", "away_team", "home_score",
                  TRUE, "home_spread_odds", "home_moneyline", "vs") %>%
      mutate(week = as.integer(week))
  }, error = function(e) {
    log_error(paste("Failed to process home games:", e$message))
    stop("Failed to process home games. Check error_log.txt for details.")
  })

  away_games <- tryCatch({
    process_games(schedule_cleaned, "away_team", "home_team", "away_score",
                  FALSE, "away_spread_odds", "away_moneyline", "@") %>%
      mutate(week = as.integer(week))
  }, error = function(e) {
    log_error(paste("Failed to process away games:", e$message))
    stop("Failed to process away games. Check error_log.txt for details.")
  })

  # Combine home and away games
  all_games <- tryCatch({
    bind_rows(home_games, away_games) %>%
      mutate(
        spread_line = as.numeric(gsub("[^0-9.-]", "", spread_line)),
        adj_moneyline = as.numeric(gsub("[^0-9.-]", "", adj_moneyline))
      )
  }, error = function(e) {
    log_error(paste("Failed to combine and clean all games:", e$message))
    stop("Failed to combine and clean all games.
    Check error_log.txt for details.")
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
        datetime = NA,
        isHomeGame = NA,
        home_or_away = NA,
        week = bye_weeks,
        spread_line = NA,
        adj_spread_odds = NA,
        adj_moneyline = NA,
        wins = max(schedule$wins),
        losses = max(schedule$losses),
        ties = max(schedule$ties),
        result = NA,
        total = NA,
        total_line = NA,
        over_odds = NA,
        under_odds = NA,
        roof = NA,
        surface = NA,
        temp = NA,
        wind = NA,
        stadium = NA,
        location = NA
      )

      bind_rows(schedule, bye_schedule)
    }, error = function(e) {
      log_error(paste("Failed to add BYE weeks:", e$message))
      stop("Failed to add BYE weeks. Check error_log.txt for details.")
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
  }, error = function(e) {
    log_error(paste("Failed to calculate wins, losses, and ties:", e$message))
    stop("Failed to calculate wins, losses, and ties.
    Check error_log.txt for details.")
  })

  # Group by team and add BYE weeks
  all_games_with_bye <- tryCatch({
    all_games %>%
      group_by(team) %>%
      group_modify(~ add_bye_weeks(.x)) %>%
      ungroup()
  }, error = function(e) {
    log_error(paste("Failed to add BYE weeks to all games:", e$message))
    stop("Failed to add BYE weeks to all games.
    Check error_log.txt for details.")
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
            isHomeGame = isHomeGame,
            home_or_away = home_or_away,
            stadium = stadium,
            location = as.character(location),
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
        wins = sum(result > 0, na.rm = TRUE),
        losses = sum(result < 0, na.rm = TRUE),
        ties = sum(result == 0 & !is.na(result), na.rm = TRUE),
        .groups = "drop"
      ) %>%
      mutate(
        games = map2(games, wins, ~ bind_rows(.x, tibble(
          opponent = "Cumulative Record",
          date = NA,
          isHomeGame = NA,
          home_or_away = NA,
          stadium = NA,
          location = NA,
          week = NA,
          weekday = NA,
          score = NA,
          total = NA,
          spread_line = NA,
          adj_spread_odds = NA,
          adj_moneyline = NA,
          result = NA,
          total_line = NA,
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
  }, error = function(e) {
    log_error(paste("Failed to create final team schedules structure:",
                    e$message))
    stop("Failed to create final team schedules structure.
    Check error_log.txt for details.")
  })

  # Convert to JSON-like structure
  team_schedules_json <- tryCatch({
    jsonlite::toJSON(team_schedules, pretty = TRUE, auto_unbox = TRUE)
  }, error = function(e) {
    log_error(paste("Failed to convert team schedules to JSON:", e$message))
    stop("Failed to convert team schedules to JSON.
    Check error_log.txt for details.")
  })

  # Get the current date and time
  current_time <- Sys.time()

  # Write to file with timestamp
  tryCatch({
    writeLines(
      paste(
        "// Last updated:", current_time,
        "\nconst nflschedules = ", team_schedules_json, ";"
      ),
      "nfl-schedules.js"
    )
  }, error = function(e) {
    log_error(paste("Failed to write nfl-schedules.js file:", e$message))
    stop("Failed to write nfl-schedules.js file.
    Check error_log.txt for details.")
  })

  # Success message
  cat("NFL schedules successfully processed and saved to nfl-schedules.js\n")

}, error = function(e) {
  log_error(paste("Main execution failed:", e$message))
  stop("Main execution failed. Check error_log.txt for details.")
})

# View the resulting JavaScript with timestamp
# cat(
# paste(
# "// Last updated:", current_time,
# "\nconst nflschedules = ", team_schedules_json, ";"
# )
# )