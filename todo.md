# Todo List

## Football Countdown

### v0.9
- [O] **sort `index.html` by division standings**
- [ ] **add playoff odds, eliminated, clinched, etc.**
- [ ] **add betting data trends**
    * spread opened at X.1, has moved to X.2, X.3, X.n

#### Weather
- [ ] **investigate scraper for weather data and NFL injuries**
    * [GitHub Repository](https://github.com/sparklemotion/nokogiri)
- [ ] **input weather details into betting analysis**
    * data is feeding from `nflfastR.r` *after* the game is played and the library is updated, not in advance of games
- [ ] **add weather data as emoji/icon to weather placeholder**
- [ ] **mouse over weather data with more details**

### v1.0
- [ ] **look into affiliate links and ads**
- [ ] **add banner ads**
    * [GitHub Discussion](https://github.com/orgs/community/discussions/22016)
- [ ] **give this project a real name**
    * NextBet?
    * BetDown?
    * Countdown to Degeneracy?
    * The Other Side of the Ball?
- [ ] **setup a web domain and service**
- [ ] **new look and feel**

### v1.1
- [O] **update `cfbfastR.r` to output bye weeks**
    * output data from `cfbfastR.r`
- [ ] **scrape notable injuries and add to betting analyis placeholder**
    * data appears available via nflverse packages
- [ ] **Add preseason and playoff games to schedules**

### Project Reading
- [ ] Check out [Ruff](https://docs.astral.sh/ruff/faq/#how-does-ruff-determine-which-of-my-imports-are-first-party-third-party-etc)
- [ ] Check out [Polars](https://www.r-bloggers.com/2024/07/shockingly-fast-data-manipulation-in-r-with-polars/)

## Data Analysis
- [ ] Compare QBR adjusted for "arm punts"
    * [ ] Compare win% changes in similar situations with success of completion, fail (INT), or punt
    * [ ] e.g. 22% chance to win, goes to 27% with completion, or drops to 21% with INT, or drops to 22% with punt,
    * if true you could say the upside of completion outweighs the downside of interception, compared to "just punting"
    * [ ] Look at conditions such as 3rd or 4th down, 11+ yards to 1st down
        * and/or if the INT was ~around the same range as an expected punt (>40yds)
        * [ ] Look at current game score conditions vs. final score
- [ ] analyze injury impacts by position, snaps, etc.
- [ ] Expand Betting analysis to be dynamic and with detailed information on opponents
    * likely need to add output data in schedules that indicates opponents' odds, etc.
    * Consider things like how much specific position injuries matter, or specific players if data available
- [ ] Wins & Losses are not a QB Stat, but what about W/L when down +10?
    * aka the "Patrick Mahomes W/L" Stat
    * Compare QBs w/ high W/L ratio to rest of their stats
    * Compare to other QBs on team in-out splits
- [ ] Get w/ Wynne on Random Forest Model