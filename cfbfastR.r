# Load necessary libraries
library(tidyverse)
library(ggrepel)
library(cfbfastR)
library(lubridate)
library(jsonlite)

# Load CFB schedule data for 2024
schedule_data <- tryCatch(
  load_cfb_schedules(2024),
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

# Define the mapping between team abbreviations and full names
team_name_mapping <- list(
  afa = "air-force-falcons",
  akr = "akron-zips",
  bama = "alabama-crimson-tide",
  app = "appalachian-state-mountaineers",
  ariz = "arizona-wildcats",
  asu = "arizona-state-sun-devils",
  ark = "arkansas-razorbacks",
  arkst = "arkansas-state-red-wolves",
  aub = "auburn-tigers",
  ball = "ball-state-cardinals",
  bay = "baylor-bears",
  boise = "boise-state-broncos",
  bc = "boston-college-eagles",
  bgsu = "bowling-green-falcons",
  buf = "buffalo-bulls",
  cmu = "central-michigan-chippewas",
  char = "charlotte-49ers",
  cincy = "cincinnati-bearcats",
  clem = "clemson-tigers",
  cc = "coastal-carolina-chanticleers",
  colo = "colorado-buffaloes",
  csu = "colorado-state-rams",
  duke = "duke-blue-devils",
  emu = "eastern-michigan-eagles",
  ecu = "ecu-pirates",
  fau = "fau-owls",
  fiu = "fiu-panthers",
  uf = "florida-gators",
  fsu = "florida-state-seminoles",
  fres = "fresno-state-bulldogs",
  uga = "georgia-bulldogs",
  gs = "georgia-southern-eagles",
  gsu = "georgia-state-panthers",
  gt = "georgia-tech-yellow-jackets",
  haw = "hawaii-rainbow-warriors",
  hou = "houston-cougars",
  ill = "illinois-fighting-illini",
  iu = "indiana-hoosiers",
  iowa = "iowa-hawkeyes",
  isu = "iowa-state-cyclones",
  ku = "kansas-jayhawks",
  ksu = "kansas-state-wildcats",
  ksu = "kent-state-golden-flashes",
  uk = "kentucky-wildcats",
  lat = "la-tech-bulldogs",
  ul = "louisiana-lafayette-ragin-cajuns",
  ulm = "louisiana-monroe-warhawks",
  lou = "louisville-cardinals",
  lsu = "lsu-tigers",
  md = "maryland-terrapins",
  mem = "memphis-tigers",
  mia = "miami-hurricanes",
  miamioh = "miami-oh-redhawks",
  msu = "michigan-state-spartans",
  um = "michigan-wolverines",
  mtsu = "middle-tennessee-blue-raiders",
  minn = "minnesota-golden-gophers",
  msst = "mississippi-state-bulldogs",
  mizz = "missouri-tigers",
  navy = "navy-midshipmen",
  neb = "nebraska-cornhuskers",
  nev = "nevada-wolf-pack",
  unm = "new-mexico-lobos",
  unc = "north-carolina-tar-heels",
  unt = "north-texas-mean-green",
  nu = "northwestern-wildcats",
  nd = "notre-dame-fighting-irish",
  ohio = "ohio-bobcats",
  osu = "ohio-state-buckeyes",
  ou = "oklahoma-sooners",
  okst = "oklahoma-state-cowboys",
  odu = "old-dominion-monarchs",
  olemiss = "ole-miss-rebels",
  oreg = "oregon-ducks",
  oregst = "oregon-state-beavers",
  psu = "penn-state-nittany-lions",
  pitt = "pittsburgh-panthers",
  pur = "purdue-boilermakers",
  rice = "rice-owls",
  rut = "rutgers-scarlet-knights",
  sdsu = "san-diego-state-aztecs",
  sjsu = "san-jose-state-spartans",
  smu = "smu-mustangs",
  usa = "south-alabama-jaguars",
  sc = "south-carolina-gamecocks",
  usm = "southern-miss-golden-eagles",
  stan = "stanford-cardinal",
  cuse = "syracuse-orange",
  tcu = "tcu-horned-frogs",
  temp = "temple-owls",
  ten = "tennessee-volunteers",
  tamu = "texas-am-aggies",
  ut = "texas-longhorns",
  txst = "texas-state-bobcats",
  ttu = "texas-tech-red-raiders",
  tol = "toledo-rockets",
  troy = "troy-trojans",
  tul = "tulane-green-wave",
  tulsa = "tulsa-golden-hurricane",
  ucla = "ucla-bruins",
  ucf = "uca-knights",
  usc = "usc-trojans",
  usf = "usf-bulls",
  usu = "utah-state-aggies",
  utah = "utah-utes",
  utep = "utep-miners",
  utsa = "utsa-roadrunners",
  vandy = "vanderbilt-commodores",
  uva = "virginia-cavaliers",
  vt = "virginia-tech-hokies",
  wake = "wake-forest-demon-deacons",
  uw = "washington-huskies",
  wsu = "washington-state-cougars",
  wvu = "west-virginia-mountaineers",
  wku = "western-kentucky-hilltoppers",
  wmu = "western-michigan-broncos",
  wisc = "wisconsin-badgers",
  wyo = "wyoming-cowboys"
)

# Check if the teams column exists in the schedule data
if ("teams" %in% colnames(schedule_data)) {

  # Replace team abbreviations with full names
  schedule_data <- schedule_data %>%
    mutate(
      home_team = map_chr(home_team, ~ team_name_mapping[[.]] %||% .),
      away_team = map_chr(away_team, ~ team_name_mapping[[.]] %||% .)
    )
} else {
  stop("The teams column is not present in the schedule data.")
}

# Save the updated schedule data to a CSV file
write.csv(schedule_data, "updated_cfb_schedule.csv", row.names = FALSE)

# Print the first few rows of the updated schedule data
print(head(schedule_data))