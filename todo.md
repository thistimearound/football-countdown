# Todo List

## Football Countdown
### v0.8
- [ ] on index.html and team.html show current record
    * [X] calculate cumulative current record
    * [X] add cumulative current record to schedule data
    * [ ] show current record when 0-0
- [O] update cfbfastR.r to output bye weeks
    * output data from cfbfastR.r

### v0.9
- [ ] look into affiliate links and adds
- [ ] add banner adds: https://github.com/orgs/community/discussions/22016
- [ ] give this thing a real name: NextBet? BetDown? Countdown to Degeneracy?
   * the other side of the ball?
- [ ] setup a web domain and service

### v1.0
- [ ] investigate scraper for weather data and NFL injuries: https://github.com/sparklemotion/nokogiri
- [ ] add weather data as emoji/icon to weather place holder
- [ ] mouse over weather data w/ more details
- [ ] input weather details into betting analysis
    * data is feeding from nflfastR.r *after* the game is played and the library is updated, not in advance of games
- [ ] add playoff odds, eliminated, clinched, etc.
- [ ] scrape notable injuries and add to betting analyis placeholder
    * data appears available via nflverse packages

### Project Reading
- [ ] Check out https://docs.astral.sh/ruff/faq/#how-does-ruff-determine-which-of-my-imports-are-first-party-third-party-etc
- [ ] Check out https://www.r-bloggers.com/2024/07/shockingly-fast-data-manipulation-in-r-with-polars/

## Data Analysis
- [ ] Compare QBR adjusted for "arm punts"
- [ ] Compare win% changes in similar situations with success of completion, fail (INT), or punt
- [ ] e.g. 22% chance to win, goes to 27% with completion, or drops to 21% with INT, or drops to 22% with punt,
    * if true you could say the upside of completion outweighs the downside of interception, compared to "just punting"
- [ ] Look at conditions such as 3rd or 4th down, 11+ yards to 1st down
    * and/or if the INT was ~around the same range as an expected punt (>40yds)
- [ ] Look at current game score conditions vs. final score
- [ ] analyze injury impacts by position, snaps, etc.
- [ ] Expand Betting analysis to be dynamic and with detailed information on opponents
    * likely need to add output data in schedules that indicates opponents' odds, etc.
- [ ] Wins & Losses are not a QB Stat, but what about W/L when down +10?
    * aka the "Patrick Mahomes W/L" Stat