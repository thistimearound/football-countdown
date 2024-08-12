# tests/testthat/test_nflfastR.R
library(testthat)
source("../nflfastR.r")

test_that("spread_line is correctly assigned", {
  expect_equal(spread_line, expected_value) # Replace expected_value with the actual expected value
})

test_that("adj_spread_odds is correctly assigned", {
  expect_equal(adj_spread_odds, expected_value) # Replace expected_value with the actual expected value
})