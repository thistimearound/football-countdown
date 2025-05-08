import requests
import re
import os
import json # Import json for parsing KTC data
import psycopg2 # Assuming you are using PostgreSQL like Neon
from dotenv import load_dotenv # Optional: for local testing with a .env file
import math # Import math for isnan check
import logging # Import the logging module
from datetime import datetime # Import datetime for timestamp in cache file

# --- Configuration ---
# Load environment variables from a .env file for local testing
# In GitHub Actions, secrets are automatically available as environment variables
load_dotenv()

SEASON_YEAR = "2025"
MFL_ADP_URL = f"https://api.myfantasyleague.com/{SEASON_YEAR}/export?TYPE=adp&POSITION=ALL&ROOKIES=1&IS_PPR=1&JSON=1"
MFL_PLAYERS_URL = f"https://api.myfantasyleague.com/{SEASON_YEAR}/export?TYPE=players&ROOKIES=1&DETAILS=1&JSON=1" # Using ROOKIES=1, but will filter by draft_year
KTC_ROOKIE_URL = "https://keeptradecut.com/dynasty-rankings/rookie-rankings"
FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'] # Include DL, LB, DB for potential IDP

# Database credentials from environment variables (set via GitHub Secrets)
# Assuming these are set up in your GitHub repository secrets
DB_HOST = os.environ.get("NEON_HOST")
DB_DATABASE = os.environ.get("NEON_DATABASE")
DB_USER = os.environ.get("NEON_USER")
DB_PASSWORD = os.environ.get("NEON_PASSWORD")
DB_PORT = os.environ.get("NEON_PORT", 5432) # Default PostgreSQL port

# --- Logging Configuration ---
# Configure basic logging
# Level can be set to logging.INFO, logging.WARNING, logging.ERROR, etc.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Function: Fetch Data ---
def fetch_json_data(url, context):
    """Fetches JSON data from a given URL."""
    logging.info(f"Fetching {context} from: {url}")
    try:
        response = requests.get(url)
        response.raise_for_status()
        logging.info(f"Successfully fetched {context}.")
        return response.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching {context}: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON for {context}: {e}")
        return None

def fetch_html_content(url, context):
    """Fetches HTML content from a given URL."""
    logging.info(f"Fetching {context} from: {url}")
    try:
        response = requests.get(url)
        response.raise_for_status()
        logging.info(f"Successfully fetched {context}.")
        return response.text
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching {context}: {e}")
        return None

# --- Data Fetching/Parsing Functions ---

def get_mfl_players():
    """Fetches MFL player details and returns a map of ID to player object."""
    json_data = fetch_json_data(MFL_PLAYERS_URL, f"MFL player details for {SEASON_YEAR}")
    player_map = {} # { id: { full player object } }

    players = json_data.get('players', {}).get('player', []) if json_data else []

    if not isinstance(players, list):
         logging.warning(f"MFL 'players.player' field is not a list. Raw data snippet: {str(json_data)[:500]}")
         return player_map

    logging.info(f"MFL Players API returned {len(players)} player entries.")

    for player in players:
        player_id = player.get('id')
        if player_id:
            player_map[player_id] = player

    logging.info(f"Successfully stored full details for {len(player_map)} MFL players.")
    return player_map

def get_mfl_adp(mfl_player_map):
    """Fetches MFL ADP data and filters for rookies based on draft_year."""
    adp_data = {} # Stores { playerName: { 'adp': 1.23, 'position': 'QB' } }
    if not mfl_player_map:
        logging.warning("MFL player map is empty. Cannot process MFL ADP.")
        return adp_data

    json_data = fetch_json_data(MFL_ADP_URL, f"MFL ADP data for {SEASON_YEAR}")
    players_adp_list = json_data.get('adp', {}).get('player', []) if json_data else []

    if not isinstance(players_adp_list, list):
        logging.warning(f"MFL 'adp.player' field is not a list. Raw data snippet: {str(json_data)[:500]}")
        return adp_data

    logging.info(f"MFL ADP API returned {len(players_adp_list)} player entries.")

    manual_exclusions = ["Kyren Lacy"] # Add other names here if needed

    included_count = 0

    for player_adp_entry in players_adp_list:
        player_id = player_adp_entry.get('id')
        player_details = mfl_player_map.get(player_id)

        adp_raw_value = player_adp_entry.get('averagePick') or player_adp_entry.get('adp')
        try:
            adp = float(adp_raw_value) if adp_raw_value is not None else None
            is_adp_valid = adp is not None and not math.isnan(adp)
        except (ValueError, TypeError):
            adp = None
            is_adp_valid = False


        player_name = None
        player_position = None
        is_rookie = False

        if player_details:
            raw_name = player_details.get('name', '').strip()
            name_parts = raw_name.split(', ') if raw_name else []
            player_name = f"{name_parts[1]} {name_parts[0]}" if len(name_parts) == 2 else raw_name
            player_position = player_details.get('position', '').strip()

            draft_year = str(player_details.get('draft_year', '')).strip()
            if draft_year == SEASON_YEAR:
               is_rookie = True
            # else:
               # logging.debug(f"Skipping {player_name} (ID: {player_id}) from MFL ADP: draft_year {draft_year} != {SEASON_YEAR}") # Use debug for detailed skips


        is_name_valid = player_name and len(player_name) > 0
        is_manually_excluded = player_name in manual_exclusions

        if is_name_valid and is_adp_valid and is_rookie and not is_manually_excluded:
            adp_data[player_name] = {'adp': adp, 'position': player_position}
            included_count += 1
        # else: # Use debug for detailed skip reasons
            # if not is_name_valid: logging.debug(f"Skipping MFL ADP entry (ID: {player_id}) due to invalid name.")
            # if not is_adp_valid: logging.debug(f"Skipping {player_name} (ID: {player_id}) due to invalid ADP.")
            # if not is_rookie: logging.debug(f"Skipping {player_name} (ID: {player_id}) as not identified as rookie.")
            # if is_manually_excluded: logging.debug(f"Manually excluding {player_name} (ID: {player_id}).")


    logging.info(f"Successfully extracted ADP for {included_count} MFL players identified as rookies (draft_year === {SEASON_YEAR}) with valid ADP.")

    if included_count == 0 and players_adp_list:
      logging.warning(f"MFL ADP API returned players, but none matched rookie criteria (draft_year === {SEASON_YEAR}) or had valid data.")
    elif not players_adp_list:
        logging.warning("MFL ADP API returned 0 players.")


    return adp_data

def get_ktc_adp():
    """Fetches KTC Rookie ADP data by parsing embedded JSON."""
    url = KTC_ROOKIE_URL
    ktc_data = {} # Stores { playerName: { 'value': 1234, 'position': 'QB' } }

    html = fetch_html_content(url, "KTC Rookie page")
    if not html:
        return ktc_data

    logging.info("Attempting to extract and parse playersArray JSON from KTC HTML...")
    json_match = re.search(r"var\s+playersArray\s*=\s*(\[.*?\])\s*;", html, re.DOTALL)

    if json_match and json_match.group(1):
        json_string = json_match.group(1)
        # logging.debug(f"Successfully extracted playersArray JSON string candidate (length: {len(json_string)}). Parsing...") # Reduced logging

        try:
            players_array = json.loads(json_string)
            logging.info(f"Successfully parsed {len(players_array)} players from KTC JSON.")

            for player in players_array:
                name = player.get('playerName', '').strip()
                # KTC rookie page uses 'superflexValues.value' for SF value
                value = player.get('superflexValues', {}).get('value')
                position = player.get('position', '').strip()

                if name and isinstance(value, (int, float)) and position:
                    ktc_data[name] = {'value': value, 'position': position}

            if not ktc_data:
                 logging.warning("Parsed KTC JSON but extracted 0 valid players/SF values/positions.")

            logging.info(f"Successfully processed {len(ktc_data)} KTC players (Superflex Value & Position).")
            return ktc_data

        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse KTC playersArray JSON: {e}")
            return ktc_data
        except Exception as e:
            logging.error(f"An unexpected error occurred during KTC JSON processing: {e}")
            return ktc_data


    else:
        logging.warning("Could not find 'var playersArray = [...]' in KTC HTML source. Structure may have changed.")
        return ktc_data

# --- Master Cleanup Function for Player Names ---
def clean_player_name_suffix(player_name):
    """Removes common suffixes (II, III, Jr.) from player names."""
    if not player_name:
        return player_name
    # Regex to remove suffixes like II, III, Jr. (case-insensitive, with optional space and period)
    suffix_regex = re.compile(r"\s+(?:II|III|Jr)\.?$", re.IGNORECASE)
    return suffix_regex.sub('', player_name).strip()

# --- Database Interaction Functions ---
def create_rookie_table(cursor):
    """Creates the rookie players table if it doesn't exist."""
    # Removed fallback_adp column from the schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rookie_players (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            position VARCHAR(50),
            mfl_adp REAL, -- Use REAL for decimal ADP from MFL
            ktc_value INTEGER, -- Use INTEGER for KTC value
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    logging.info("Ensured 'rookie_players' table exists.")

def insert_or_update_rookie_players(cursor, players_data):
    """Inserts or updates rookie player data in the database."""
    logging.info(f"Attempting to insert/update {len(players_data)} rookie players...")
    upsert_count = 0
    for player_name, data in players_data.items():
        try:
            position = data.get('position')
            mfl_adp = data.get('mfl')
            ktc_value = data.get('ktc')

            # If using primary sources, update mfl_adp, ktc_value, and position
            cursor.execute("""
                INSERT INTO rookie_players (name, position, mfl_adp, ktc_value)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (name) DO UPDATE SET
                    position = EXCLUDED.position,
                    mfl_adp = EXCLUDED.mfl_adp,
                    ktc_value = EXCLUDED.ktc_value,
                    updated_at = CURRENT_TIMESTAMP;
            """, (player_name, position, mfl_adp, ktc_value))

            upsert_count += 1
        except Exception as e:
            logging.error(f"Error inserting/updating player {player_name}: {e}")

    logging.info(f"Successfully processed {upsert_count} rookie players for database upsert.")

# todo: confirm testing from neon and remove local rookie cache
# todo: or create local total cache instead?
# --- Cache Functions ---
def save_to_local_cache(data):
    """Saves the rookie data to a local JSON cache file."""
    try:
        # Create the file path in the data directory
        cache_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..", "data"))
        cache_file = os.path.join(cache_dir, "rookie_data_cache.json")
        
        # Prepare the cache data structure with metadata
        cache_data = {
            "last_updated": datetime.now().isoformat(),
            "source_note": f"Rookie rankings data from MFL and KTC (Superflex values) for {SEASON_YEAR} season",
            "format": "Superflex",
            "players": data
        }
        
        # Save to JSON file
        with open(cache_file, 'w') as f:
            json.dump(cache_data, f, indent=4)
            
        logging.info(f"Successfully cached rookie Superflex data to {cache_file}")
        return True
    except Exception as e:
        logging.error(f"Error saving to local cache: {e}")
        return False

# --- Main Execution Logic ---
if __name__ == "__main__":
    logging.info("Starting Rookie Scraper script...")

    # Fetch data from sources
    mfl_player_map = get_mfl_players()
    mfl_data = get_mfl_adp(mfl_player_map)
    ktc_data = get_ktc_adp()

    # --- Combine data from primary sources (MFL and KTC) ---
    # No fallback logic needed in this version
    all_players = set(list(mfl_data.keys()) + list(ktc_data.keys()))

    final_data = {} # Data source to use for the database

    for player in all_players:
        mfl_entry = mfl_data.get(player)
        ktc_entry = ktc_data.get(player)

        # Determine Position (prioritize sources likely to have it)
        final_position = (mfl_entry.get('position') if mfl_entry else None) or \
                         (ktc_entry.get('position') if ktc_entry else None) or "N/A"

        # Only include fantasy-relevant positions
        if final_position in FANTASY_POSITIONS:
            final_data[player] = {
                'position': final_position,
                'mfl': mfl_entry.get('adp') if mfl_entry else None,
                'ktc': ktc_entry.get('value') if ktc_entry else None # KTC live data has 'value'
            }
    logging.info(f"Using data from primary sources. Combined data for {len(final_data)} players.")

    # --- Name Correction for Cam Ward (Applied universally after data collection) ---
    # Check if "Cam Ward" exists in the data before attempting correction
    if "Cam Ward" in final_data:
        logging.info("Correcting player name from 'Cam Ward' to 'Cameron Ward'.")
        final_data["Cameron Ward"] = final_data["Cam Ward"] # Copy data
        del final_data["Cam Ward"] # Remove old key
    # --- End Name Correction ---

    # --- Apply Suffix Cleanup to all names before DB ---
    # Create a new dict with cleaned names as keys
    cleaned_final_data = {}
    for player_name, data in final_data.items():
        cleaned_name = clean_player_name_suffix(player_name)
        # If a cleaned name already exists, decide how to handle (e.g., merge data or prioritize)
        # For simplicity here, we'll assume cleaned names are unique or the last one processed wins.
        # A more robust approach might merge data points if multiple sources had different suffixes for the same player.
        cleaned_final_data[cleaned_name] = data
        cleaned_final_data[cleaned_name]['name'] = cleaned_name # Ensure the 'name' key in the dict is also the cleaned name

    logging.info(f"Applied suffix cleanup. Processed {len(cleaned_final_data)} unique cleaned names.")
    final_data_for_db = cleaned_final_data # Use the cleaned data for DB

    # --- Database Insertion/Update ---
    # Ensure all necessary database credentials are provided
    db_success = False  # Flag to track if database update was successful
    
    if not all([DB_HOST, DB_DATABASE, DB_USER, DB_PASSWORD, DB_PORT]):
        logging.error("Database credentials not fully provided. Skipping database update.")
    else:
        conn = None
        cur = None
        try:
            logging.info("Connecting to the database...")
            # Include sslmode='require' for secure connection to Neon
            conn = psycopg2.connect(
                host=DB_HOST,
                database=DB_DATABASE,
                user=DB_USER,
                password=DB_PASSWORD,
                port=DB_PORT,
                sslmode='require' # Ensure SSL is required
            )
            cur = conn.cursor()
            logging.info("Database connection successful.")

            create_rookie_table(cur) # Ensure table exists
            insert_or_update_rookie_players(cur, final_data_for_db) # Insert/update data

            conn.commit() # Commit transaction
            logging.info("Database update completed.")
            db_success = True  # Mark as successful after commit

        except psycopg2.Error as e:
            logging.error(f"Database connection or operation error: {e}")
            if conn:
                conn.rollback() # Roll back on error
        except Exception as e:
            logging.error(f"An unexpected error occurred during database operation: {e}")
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()
            logging.info("Database connection closed.")
    
    # Save to local cache if database update was successful
    if db_success:
        logging.info("Database update was successful, saving to local cache...")
        cache_success = save_to_local_cache(final_data_for_db)
        if cache_success:
            logging.info("Local cache update completed.")
        else:
            logging.warning("Failed to update local cache.")

    logging.info("Rookie Scraper script finished.")

