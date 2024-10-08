# Changelog
<details>
<summary>Previous Versions</summary>
v0.1 Initial Upload and preconfiguration

* Uploaded support for NFL teams with dynamic list and styling generated by chat-gpt4o.

v0.2 Enabling Github Pages
* Creating `index.html` and organizing files for GitHub Pages to load correctly

v0.3 Visual Improvement and Dataset Structuring
* Organized teams by Conference and Division
* Uploaded NFL logo banner for `index.html` header.
* Created and uploaded generic dataset for all 32 teams season-long schedule.

v0.4 Added Linter & Updated Styling
* Added `axe-linter.yml` for **VSCode** support
* Updated `index.html` and `styles.css` to better display NFL banner logo

v0.5 NFL Separation for Future Scaling
* Renamed `scripts.js` and `styles.css` to `nfl-scripts.js` and `nfl-styles.css`
* Updated `index.html` and `team.html` with corrected .js filepaths
* Corrected Team Arrays for Conference and Division
* Refined team array population

v0.6 Support for full NFL Team Schedules
* Updated `nfl-scripts.js` to show opponent next to countdown `getNextGameDate`
* Updated `team.html` to dynamically load team's full schedule from `nfl-schedules.js`
* Added script to `team.html` to dynamically change header and color based on selected team
* Populated the schedule with opponent and game times
* Aligned styling for `index.html` to center division names
* Refined array nesting for teams in divisions and conferences

v0.7 Authentic Scheduling
* Build `nflfastR.r` schedule query with home & away indicators
* Importing NFL data from `nflfastR.r` to JSON in `nfl-schedules.js`
* Align styles division centering with scripts teams classes
* Code refinement and adding color support for team schedules
* Displaying home and away for all teams
</details>

v0.8 Betting Data, Bye Weeks, and Project Support
* Massive Expanded Data for Betting Analysis and Schedule Sorting
* Populate Betting Analysis w/ general mappings
* Add + and - indicators for favorites and underdogs
* Show bye weeks in Schedule data
* Add support for College in `cfbfastR.r`, `cfb-styles.css`
* Add `static.yml` for GHA deploy config
* Add todo list for backlog
* Add updated styling on hover for `index.html`
* Updated view for mobile devices
* Add GHA job to run r-scripts on a schedule
* Importing CFB data from `cfbfastR.r` to JSON in `cfb-schedules.js`
* Calculate current cumulative season record & show `index.html` and `team.html`