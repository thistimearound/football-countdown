# Load necessary libraries
library(nflreadr)
library(nflplotR)
library(tidyverse)
library(dplyr)
library(lubridate)
library(jsonlite)
library(ggrepel)

# prevent scientific notation
options(scipen = 9999)

# load data from 2015 to 2023
pbp <- load_pbp(2015:2023)
pbp %>%
  group_by(play_type) %>%
  summarize(n = n())

#filter QB data for regular season games only with EPA
qbs <- pbp %>%
  filter(season_type == "REG", !is.na(epa)) %>%
  group_by(id, name) %>%
  summarize(
    epa = mean(qb_epa),
    cpoe = mean(cpoe, na.rm = TRUE),
    n_dropbacks = sum(pass),
    n_plays = n(),
    team = last(posteam)
  ) %>%
  ungroup() %>%
  filter(n_dropbacks > 100 & n_plays > 1000)

# add teams to qbs
load_teams()
qbs <- qbs %>%
  left_join(load_teams(), by = c("team" = "team_abbr"))

qbs %>%
  ggplot(aes(x = cpoe, y = epa)) +
  geom_hline(yintercept = mean(qbs$epa), color = "red", linetype = "dashed", alpha = 0.5) + #horizontal line with mean EPA # nolint: line_length_linter
  geom_vline(xintercept =  mean(qbs$cpoe), color = "red", linetype = "dashed", alpha = 0.5) + #vertical line with mean CPOE # nolint: line_length_linter

  # add points for QBs w/ team colors
  geom_point(aes(color = team_color, size = n_plays / 350), alpha = 0.6) + #alpha = 1 is normal # nolint: line_length_linter
  geom_text_repel(aes(label = name)) + # add names using ggrepel, which tries to make them not overlap # nolint: line_length_linter
  stat_smooth(geom = "line", alpha = 0.5, se = FALSE, method = "lm") + # add a smooth line fitting cpoe + epa # nolint: line_length_linter

  # titles and captions
  labs(
    x = "Completion % above expected (CPOE)",
    y = "EPA per play (passes, rushes, and penalties)",
    title = "Quarterback Efficiency, 2015 - 2023",
    caption = "Data: @nflfastR"
  ) +

  # make it look nice bw ggplot theme w/ center title & hjust = 0.5
  theme_bw() +
  theme(
    plot.title = element_text(size = 14, hjust = 0.5, face = "bold")
  ) +

  # make ticks look nice
  scale_y_continuous(breaks = scales::pretty_breaks(n = 10)) +
  scale_x_continuous(breaks = scales::pretty_breaks(n = 10))