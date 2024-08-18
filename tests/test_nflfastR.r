library(testthat)
source("../nflfastR.r")

test_that("spread_line is correctly assigned", {
  expect_equal(spread_line, expected_value) #Replace expected_value w/ actual
})

test_that("adj_spread_odds is correctly assigned", {
  expect_equal(adj_spread_odds, expected_value) #Replace expected_value : actual
})

test_that("load_schedules loads data correctly for 2024", {
  schedule_data <- tryCatch(
    load_schedules(2024),
    error = function(e) {
      NULL
    }
  )
  expect_false(is.null(schedule_data))
  expect_true("game_id" %in% colnames(schedule_data))
})

test_that("format_team_name maps abbreviations correctly", {
  expect_equal(format_team_name("ari"), "arizona-cardinals")
  expect_equal(format_team_name("ne"), "new-england-patriots")
  expect_error(format_team_name("xyz"),
               "Team abbreviation not found in mapping: xyz")
})

test_that("process_games transforms schedule data correctly", {
  sample_data <- tibble(
    home_team = "ari",
    away_team = "ne",
    home_score = 24,
    away_score = 20,
    spread_line = -3.5,
    home_spread_odds = -110,
    home_moneyline = -150,
    game_id = 1,
    season = 2024,
    week = 1,
    weekday = "Sunday",
    datetime = "2024-09-08 13:00:00",
    stadium = "Stadium",
    location = "Location"
  )

  result <- process_games(sample_data, "home_team", "away_team", "home_score",
                          TRUE, "home_spread_odds", "home_moneyline", "vs")

  expect_equal(result$team[1], "arizona-cardinals")
  expect_equal(result$opponent[1], "new-england-patriots")
  expect_equal(result$spread_line[1], "+3.5")
  expect_equal(result$adj_spread_odds[1], -110)
  expect_equal(result$adj_moneyline[1], "-150")
})

test_that("add_bye_weeks adds BYE weeks correctly", {
  sample_data <- tibble(
    team = "arizona-cardinals",
    week = c(1, 2, 4, 5)
  )

  result <- add_bye_weeks(sample_data)

  expect_true(3 %in% result$week)
  expect_true(6 %in% result$week)
  expect_equal(result$opponent[result$week == 3], "BYE")
})

test_that("team_schedules structure is correct", {
  expect_true(is.list(team_schedules))
  expect_true("arizona-cardinals" %in% names(team_schedules))
  expect_true("games" %in% names(team_schedules[["arizona-cardinals"]]))
  expect_true("opponent" %in%
                colnames(team_schedules[["arizona-cardinals"]]$games))
})

test_that("JSON conversion is correct", {
  json_output <- jsonlite::toJSON(team_schedules,
                                  pretty = TRUE, auto_unbox = TRUE)
  expect_true(grepl("\"arizona-cardinals\"", json_output))
  expect_true(grepl("\"games\"", json_output))
})