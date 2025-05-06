# Load necessary libraries
library(cfbfastR)
library(cfbplotR)
library(tidyverse)
library(tidyr)
library(ggrepel)
library(lubridate)
library(jsonlite)
library(tibble)
library(dplyr)

# Load CFB schedule data for 2023
# 2024 data is not available yet 08-15-2024
schedule_data <- tryCatch(
  load_cfb_schedules(2023),
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
schedule_data <- data.frame(lapply(schedule_data, function(x) {
  gsub("Invalid Number", "NA", x)
}))

view(schedule_data)

# Define the mapping between team abbreviations and full names
# commented out for now
"
team_name_mapping <- list(
  afa = 'air-force-falcons',
  akr = 'akron-zips',
  bama = 'alabama-crimson-tide',
  app = 'appalachian-state-mountaineers',
  ariz = 'arizona-wildcats',
  asu = 'arizona-state-sun-devils',
  ark = 'arkansas-razorbacks',
  arkst = 'arkansas-state-red-wolves',
  aub = 'auburn-tigers',
  ball = 'ball-state-cardinals',
  bay = 'baylor-bears',
  boise = 'boise-state-broncos',
  bc = 'boston-college-eagles',
  bgsu = 'bowling-green-falcons',
  buff = 'buffalo-bulls',
  cmu = 'central-michigan-chippewas',
  char = 'charlotte-49ers',
  cin = 'cincinnati-bearcats',
  clem = 'clemson-tigers',
  cc = 'coastal-carolina-chanticleers',
  colo = 'colorado-buffaloes',
  csu = 'colorado-state-rams',
  duke = 'duke-blue-devils',
  emu = 'eastern-michigan-eagles',
  ecu = 'ecu-pirates',
  fau = 'fau-owls',
  fiu = 'fiu-panthers',
  uf = 'florida-gators',
  fsu = 'florida-state-seminoles',
  fres = 'fresno-state-bulldogs',
  uga = 'georgia-bulldogs',
  gaso = 'georgia-southern-eagles',
  gast = 'georgia-state-panthers',
  gt = 'georgia-tech-yellow-jackets',
  haw = 'hawaii-rainbow-warriors',
  hou = 'houston-cougars',
  idho = 'idaho-vandals',
  ill = 'illinois-fighting-illini',
  ind = 'indiana-hoosiers',
  iowa = 'iowa-hawkeyes',
  isu = 'iowa-state-cyclones',
  ku = 'kansas-jayhawks',
  ksu = 'kansas-state-wildcats',
  ksu = 'kent-state-golden-flashes',
  uk = 'kentucky-wildcats',
  lat = 'la-tech-bulldogs',
  ulm = 'louisiana-monroe-warhawks',
  ull = 'louisiana-lafayette-ragin-cajuns',
  lou = 'louisville-cardinals',
  lsu = 'lsu-tigers',
  md = 'maryland-terrapins',
  mem = 'memphis-tigers',
  mia = 'miami-hurricanes',
  moh = 'miami-oh-redhawks',
  msu = 'michigan-state-spartans',
  um = 'michigan-wolverines',
  mtsu = 'middle-tennessee-blue-raiders',
  minn = 'minnesota-golden-gophers',
  msst = 'mississippi-state-bulldogs',
  mizz = 'missouri-tigers',
  navy = 'navy-midshipmen',
  neb = 'nebraska-cornhuskers',
  nev = 'nevada-wolf-pack',
  nmsu = 'new-mexico-state-aggies',
  unm = 'new-mexico-lobos',
  unc = 'north-carolina-tar-heels',
  unt = 'north-texas-mean-green',
  nw = 'northwestern-wildcats',
  nd = 'notre-dame-fighting-irish',
  ohio = 'ohio-bobcats',
  osu = 'ohio-state-buckeyes',
  ou = 'oklahoma-sooners',
  okst = 'oklahoma-state-cowboys',
  odu = 'old-dominion-monarchs',
  miss = 'ole-miss-rebels',
  oreg = 'oregon-ducks',
  oregst = 'oregon-state-beavers',
  psu = 'penn-state-nittany-lions',
  pitt = 'pittsburgh-panthers',
  pur = 'purdue-boilermakers',
  rice = 'rice-owls',
  rut = 'rutgers-scarlet-knights',
  sdsu = 'san-diego-state-aztecs',
  sjsu = 'san-jose-state-spartans',
  smu = 'smu-mustangs',
  usa = 'south-alabama-jaguars',
  scar = 'south-carolina-gamecocks',
  usm = 'southern-miss-golden-eagles',
  stan = 'stanford-cardinal',
  syr = 'syracuse-orange',
  tcu = 'tcu-horned-frogs',
  temp = 'temple-owls',
  tenn = 'tennessee-volunteers',
  tamu = 'texas-am-aggies',
  tex = 'texas-longhorns',
  txst = 'texas-state-bobcats',
  ttu = 'texas-tech-red-raiders',
  tol = 'toledo-rockets',
  troy = 'troy-trojans',
  tul = 'tulane-green-wave',
  tulsa = 'tulsa-golden-hurricane',
  ucla = 'ucla-bruins',
  ucf = 'uca-knights',
  usc = 'usc-trojans',
  usf = 'usf-bulls',
  usu = 'utah-state-aggies',
  utah = 'utah-utes',
  utep = 'utep-miners',
  utsa = 'utsa-roadrunners',
  vandy = 'vanderbilt-commodores',
  uva = 'virginia-cavaliers',
  vt = 'virginia-tech-hokies',
  wake = 'wake-forest-demon-deacons',
  uw = 'washington-huskies',
  wsu = 'washington-state-cougars',
  wvu = 'west-virginia-mountaineers',
  wku = 'western-kentucky-hilltoppers',
  wmu = 'western-michigan-broncos',
  wisc = 'wisconsin-badgers',
  wyo = 'wyoming-cowboys',
  # Big Sky
  cp = 'cal-poly-mustangs',
  ewu = 'eastern-washington-eagles',
  idst = 'idaho-state-bengals',
  mont = 'montana-grizzlies',
  mtst = 'montana-state-bobcats',
  und = 'north-dakota-fighting-hawks',
  nau = 'northern-arizona-lumberjacks',
  unco = 'northern-colorado-bears',
  prst = 'portland-state-vikings',
  sac = 'sacramento-state-hornets',
  suu = 'southern-utah-thunderbirds',
  ucd = 'uc-davis-aggies',
  web = 'weber-state-wildcats',
  # Big South
  chso = 'charleston-southern-buccaneers',
  ccar = 'coastal-carolina-chanticleers',
  webb = 'gardner-webb-runnin-bulldogs',
  kenn = 'kennesaw-state-owls',
  lib = 'liberty-flames',
  monm = 'monmouth-hawks',
  pres = 'presbyterian-blue-hose',
  # CAA
  alby = 'albany-great-danes',
  del = 'delaware-fightin-blue-hens',
  elon = 'elon-phoenix',
  jmu = 'james-madison-dukes',
  mne = 'maine-black-bears',
  unh = 'new-hampshire-wildcats',
  uri = 'rhode-island-rams',
  rich = 'richmond-spiders',
  ston = 'stony-brook-seawolves',
  tow = 'towson-tigers',
  nova = 'villanova-wildcats',
  wmu = 'william-mary-tribe',
  # Ivy League
  brwn = 'brown-bears',
  cor = 'cornell-big-red',
  clmb = 'columbia-lions',
  dart = 'dartmouth-big-green',
  harv = 'harvard-crimson',
  penn = 'pennsylvania-quakers',
  prin = 'princeton-tigers',
  yale = 'yale-bulldogs',
  # MEAC
  cook = 'bethune-cookman-wildcats',
  dsu = 'delaware-state-hornets',
  famu = 'florida-a&m-rattlers',
  hamp = 'hampton-pirates',
  how = 'howard-bison',
  morg = 'morgan-state-bears',
  norf = 'norfolk-state-spartans',
  ncat = 'north-carolina-a&t-aggies',
  nccu = 'north-carolina-central-eagles',
  sav = 'savannah-state-tigers',
  scst = 'south-carolina-state-bulldogs',
  # Missouri Valley
  ilst = 'illinois-state-redbirds',
  inst = 'indiana-state-sycamores',
  most = 'missouri-state-bears',
  ndsu = 'north-dakota-state-bison',
  uni = 'northern-iowa-panthers',
  sdak = 'south-dakota-coyotes',
  sdsu = 'south-dakota-state-jackrabbits',
  siu = 'southern-illinois-salukis',
  wiu = 'western-illinois-leathernecks',
  ysu = 'youngstown-state-penguins',
  # Northeast
  bry = 'bryant-bulldogs',
  ccsu = 'central-connecticut-blue-devils',
  duq = 'duquesne-dukes',
  rmu = 'robert-morris-colonials',
  shu = 'sacred-heart-pioneers',
  sfu = 'st-francis-red-flash',
  wag = 'wagner-seahawks',
  # Ohio Valley
  peay = 'austin-peay-governors',
  eiu = 'eastern-illinois-panthers',
  eky = 'eastern-kentucky-colonels',
  jvst = 'jacksonville-state-gamecocks',
  murr = 'murray-state-racers',
  semo = 'southeast-missouri-state-redhawks',
  tnst = 'tennessee-state-tigers',
  tntc = 'tennessee-tech-golden-eagles',
  utm = 'tennessee-martin-skyhawks',
  # Patriot
  buck = 'bucknell-bison',
  colg = 'colgate-raiders',
  ford = 'fordham-rams', # cannot name 'for' in R
  gtwn = 'georgetown-hoyas',
  hc = 'holy-cross-crusaders',
  laf = 'lafayette-leopards',
  leh = 'lehigh-mountain-hawks',
  # Pioneer
  but = 'butler-bulldogs',
  camp = 'campbell-fighting-camels',
  dav = 'davidson-wildcats',
  day = 'dayton-flyers',
  drke = 'drake-bulldogs',
  jac = 'jacksonville-dolphins',
  mrst = 'marist-red-foxes',
  more = 'morehead-state-eagles',
  usd = 'san-diego-toreros',
  stet = 'stetson-hatters',
  valp = 'valparaiso-crusaders',
  # SoCon
  chat = 'chattanooga-mocs',
  etsu = 'etsu-buccaneers',
  fur = 'furman-paladins',
  mer = 'mercer-bears',
  sam = 'samford-bulldogs',
  cit = 'the-citadel-bulldogs',
  vmi = 'vmi-keydets',
  wcu = 'western-carolina-catamounts',
  woff = 'wofford-terriers',
  # Southland
  acu = 'abilene-christian-wildcats',
  uca = 'central-arkansas-bears',
  hbu = 'houston-baptist-huskies',
  iw = 'incarnate-word-cardinals',
  lam = 'lamar-cardinals',
  mcns = 'mcneese-state-cowboys',
  nich = 'nicholls-colonels',
  nwst = 'northwestern-state-demons',
  shsu = 'sam-houston-state-bearkats',
  sela = 'southeastern-louisiana-lions',
  sfa = 'stephen-f-austin-lumberjacks',
  # SWAC
  aamu = 'alabama-am-bulldogs',
  alst = 'alabama-state-hornets',
  alcn = 'alcorn-state-braves',
  arpb = 'arkansas-pine-bluff-golden-lions',
  gram = 'grambling-state-tigers',
  jkst = 'jackson-state-tigers',
  mvsu = 'mississippi-valley-state-delta-devils',
  pv = 'prairie-view-panthers',
  sou = 'southern-jaguars',
  txso = 'texas-southern-tigers',
  # DII Teams?
  ae = 'american-eagles', # 'amc' doesn't work in R?
  ar = 'army-west-point-black-knights',
  brad = 'bradley-braves',
  bel = 'belmont-bruins',
  boston = 'boston-university-terriers',
  cop = 'coppin-state-eagles',
  drex = 'drexel-dragons',
  evan = 'evansville-purple-aces',
  fd = 'fairleigh-dickinson-knights',
  hof = 'hofstra-pride',
  loy = 'loyola-chicago-ramblers',
  loy = 'loyola-maryland-greyhounds',
  lu = 'liu-sharks',
  mc = 'merrimack-warriors',
  msm = 'mount-st-marys-mountaineers',
  rad = 'radford-highlanders',
  siuec = 'siu-edwardsville-cougars',
  txam = 'texas-am-commerce-lions',
  ucs = 'u-st-charles-cougars',
  uncp = 'unc-pembroke-braves',
  uncw = 'unc-wilmington-seahawks',
  win = 'winthrop-eagles',
  ws = 'wichita-state-shockers',
)

# Create a reverse mapping for team names
reverse_team_name_mapping <- setNames(
  gsub('-', ' ', sapply(team_name_mapping, function(x) tools::toTitleCase(x))),
  team_name_mapping
)
"

# Clean and process the data
schedule_cleaned <- schedule_data %>%
  select(
    game_id,
    season,
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

view(schedule_cleaned)

# Create a function to format team names
"
format_team_name <- function(team) {
  team_formatted <- team_name_mapping[[tolower(team)]]
  if (is.null(team_formatted)) {
    stop(paste('Team abbreviation not found in mapping:', team))
  }
  return(team_formatted)
}
"

# Transform the data into the desired format
process_games <- function(schedule, team_col, opponent_col, score_col, is_home_game, spread_odds_col, moneyline_col, home_or_away_symbol) { # nolint: line_length_linter
  schedule %>%
    mutate(
      # replace schedule_cleaned w/ format_team_name when team_name_mapping is defined # nolint: line_length_linter
      team = sapply(!!sym(team_col), schedule_cleaned),
      opponent = sapply(!!sym(opponent_col), schedule_cleaned),
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
writeLines(paste("const cfbschedules = ", team_schedules_json, ";"), "cfb-schedules.js") # nolint: line_length_linter

# View the resulting JavaScript
cat(paste("const cfbschedules = ", team_schedules_json, ";"))