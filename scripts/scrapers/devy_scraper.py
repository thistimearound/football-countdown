import requests
import re
import os
import json
import psycopg2
from dotenv import load_dotenv # Optional: for local testing with a .env file
import math
import logging # Import the logging module
from datetime import datetime

# --- Configuration ---
# Load environment variables from a .env file for local testing
# In GitHub Actions, secrets are automatically available as environment variables
load_dotenv()

KTC_DEVY_URL = "https://keeptradecut.com/devy-rankings"
DRAFTSHARKS_DEVY_URL = "https://www.draftsharks.com/article/devy-rankings"
FANTASY_POSITIONS_DEVY = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB']

# Database credentials from environment variables (set via GitHub Secrets)
DB_HOST = os.environ.get("NEON_HOST")
DB_DATABASE = os.environ.get("NEON_DATABASE")
DB_USER = os.environ.get("NEON_USER")
DB_PASSWORD = os.environ.get("NEON_PASSWORD")
DB_PORT = os.environ.get("NEON_PORT", 5432) # Default PostgreSQL port

# --- Logging Configuration ---
# Configure basic logging
# Level can be set to logging.INFO, logging.WARNING, logging.ERROR, etc.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Function: Fetch HTML Content ---
def fetch_html_content(url, context):
    """Fetches the HTML content from a given URL."""
    logging.info(f"Fetching {context} from: {url}")
    try:
        response = requests.get(url)
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        logging.info(f"Successfully fetched {context}.")
        return response.text
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching {context}: {e}")
        return None

# --- Data Fetching/Parsing Functions ---

def get_ktc_devy():
    """Fetches KTC Devy data by parsing embedded JSON."""
    url = KTC_DEVY_URL
    ktc_data = {} # Stores { playerName: { 'value': 1234, 'position': 'QB' } }

    html = fetch_html_content(url, "KTC Devy page")
    if not html:
        return ktc_data

    logging.info("Attempting to extract and parse playersArray JSON from KTC HTML...")
    # Regex to find the playersArray JSON
    json_match = re.search(r"var\s+playersArray\s*=\s*(\[.*?\])\s*;", html, re.DOTALL)

    if json_match and json_match.group(1):
        json_string = json_match.group(1)

        try:
            players_array = json.loads(json_string)
            logging.info(f"Successfully parsed {len(players_array)} players from KTC JSON.")

            for player in players_array:
                name = player.get('playerName', '').strip()
                value = player.get('superflexValues', {}).get('value')
                position = player.get('position', '').strip()

                if name and isinstance(value, (int, float)) and position:
                    ktc_data[name] = {'value': value, 'position': position}

            if not ktc_data:
                 logging.warning("Parsed KTC JSON but extracted 0 valid players/values/positions.")
            else:
                logging.info(f"Successfully processed {len(ktc_data)} KTC Devy players.")

        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse KTC playersArray JSON: {e}")
        except Exception as e:
            logging.error(f"An unexpected error occurred during KTC JSON processing: {e}")

    else:
        logging.warning("Could not find 'var playersArray = [...]' in KTC HTML source. Structure may have changed.")

    return ktc_data

def parse_draft_sharks_devy(html_content):
    """Parses Draft Sharks Devy rankings HTML."""
    devy_data = {} # Stores { playerName: { 'rank': 1, 'position': 'QB', 'team': 'Team', 'year': '2027' } }

    if not html_content:
        logging.warning("No HTML content provided for Draft Sharks parsing.")
        return devy_data

    logging.info("Parsing Draft Sharks Devy HTML...")

    # Regex: Look for the core pattern "Rank. Name, Position, Team (Year)"
    # This regex is designed to be robust by looking for the number followed by a period,
    # then capturing the segments separated by commas and the year in parentheses.
    # It uses non-greedy matching and is less dependent on specific surrounding tags.
    player_regex = re.compile(r"(\d+)\.\s*([^,]+?),\s*([^,]+?),\s*([^\\(]+?)\s*\(((\d{4})|College)\)", re.DOTALL | re.IGNORECASE)

    included_count = 0

    for match in player_regex.finditer(html_content):
        try:
            rank = int(match.group(1).strip())
            name = match.group(2).strip()
            position = match.group(3).strip()
            team = match.group(4).strip()
            year = match.group(5).strip()

            # --- Clean up the captured text ---
            # Remove HTML tags
            tag_regex = re.compile(r"<[^>]*>")
            name = tag_regex.sub('', name).strip()
            position = tag_regex.sub('', position).strip()
            team = tag_regex.sub('', team).strip()
            year = tag_regex.sub('', year).strip()

            # Replace common HTML entities
            entity_regex = re.compile(r"&nbsp;|&#xA0;|&amp;")
            name = entity_regex.sub(' ', name).strip()
            position = entity_regex.sub(' ', position).strip()
            team = entity_regex.sub(' ', team).strip()
            year = entity_regex.sub(' ', year).strip()
            # --- End Clean up ---

            # Check if rank is a valid number before proceeding
            if not math.isnan(rank) and name and position and team and year:
                devy_data[name] = {'rank': rank, 'position': position, 'team': team, 'year': year}
                included_count += 1
            else:
                 # Log if data is incomplete or rank is not a number
                 if math.isnan(rank):
                     logging.warning(f"Skipping Draft Sharks match due to invalid rank: {match.group(0)}")
                 else:
                     logging.warning(f"Skipping Draft Sharks match due to missing data fields: {match.group(0)}")

        except Exception as e:
             logging.error(f"Error processing Draft Sharks match: {match.group(0)} - {e}")


    logging.info(f"Finished parsing Draft Sharks. Found {included_count} valid player entries.")

    if included_count == 0:
        logging.warning("No player data was extracted from Draft Sharks. The parsing logic may need adjustment.")

    return devy_data

# --- Master Cleanup Function for Player Names ---
def clean_player_name_suffix(player_name):
    """Removes common suffixes (II, III, Jr.) from player names."""
    if not player_name:
        return player_name
    # Regex to remove suffixes like II, III, Jr. (case-insensitive, with optional space and period)
    suffix_regex = re.compile(r"\s+(?:II|III|Jr)\.?$", re.IGNORECASE)
    return suffix_regex.sub('', player_name).strip()

# --- Database Interaction Functions ---
def create_devy_table(cursor):
    """Creates the devy players table if it doesn't exist."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS devy_players (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            position VARCHAR(50),
            ktc_value INTEGER,
            ds_rank INTEGER,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    logging.info("Ensured 'devy_players' table exists.")

def insert_or_update_devy_players(cursor, players_data):
    """Inserts or updates devy player data in the database."""
    logging.info(f"Attempting to insert/update {len(players_data)} devy players...")
    upsert_count = 0
    for player_name, data in players_data.items():
        try:
            # Use None for missing values to correctly insert NULL into the database
            ktc_value = data.get('ktc_value')
            ds_rank = data.get('ds_rank')
            position = data.get('position')

            cursor.execute("""
                INSERT INTO devy_players (name, position, ktc_value, ds_rank)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (name) DO UPDATE SET
                    position = EXCLUDED.position,
                    ktc_value = EXCLUDED.ktc_value,
                    ds_rank = EXCLUDED.ds_rank,
                    updated_at = CURRENT_TIMESTAMP;
            """, (player_name, position, ktc_value, ds_rank))
            upsert_count += 1
        except Exception as e:
            logging.error(f"Error inserting/updating player {player_name}: {e}")

    logging.info(f"Successfully processed {upsert_count} devy players for database upsert.")

def save_to_local_cache(data):
    """Saves the devy data to a local JSON cache file."""
    try:
        # Create the file path in the data directory
        cache_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..", "data"))
        cache_file = os.path.join(cache_dir, "devy_data_cache.json")
        
        # Prepare the cache data structure with metadata
        cache_data = {
            "last_updated": datetime.now().isoformat(),
            "source_note": f"Devy rankings data from KTC (Superflex values) for {datetime.now().year} season",
            "format": "Superflex",
            "players": data
        }
        
        # Save to JSON file
        with open(cache_file, 'w') as f:
            json.dump(cache_data, f, indent=4)
            
        logging.info(f"Successfully cached devy Superflex data to {cache_file}")
        return True
    except Exception as e:
        logging.error(f"Error saving to local cache: {e}")
        return False

# --- Main Execution Logic ---
if __name__ == "__main__":
    logging.info("Starting Devy Scraper script...")

    # Fetch data from sources
    ktc_devy_data = get_ktc_devy()
    ds_html_content = fetch_html_content(DRAFTSHARKS_DEVY_URL, "Draft Sharks Devy Rankings Page")
    draft_sharks_data = parse_draft_sharks_devy(ds_html_content) if ds_html_content else {}

    # --- Manual Check and Add for Jeremiah Smith (if needed) ---
    jeremiah_smith_name = "Jeremiah Smith"
    # Check if Jeremiah Smith is in the raw scraped data before cleanup/corrections
    found_smith = any(jeremiah_smith_name.lower() in name.lower() for name in draft_sharks_data)

    if not found_smith:
        logging.info(f"{jeremiah_smith_name} not found by Draft Sharks scrape. Manually adding data.")
        # Add him to draft_sharks_data using his standard name
        draft_sharks_data[jeremiah_smith_name] = {
            'rank': 1,
            'position': 'WR',
            'team': 'Ohio State', # Team and year might not be needed in final DB schema
            'year': '2027'
        }
    else:
        logging.info(f"{jeremiah_smith_name} found by Draft Sharks scrape.")
    # --- End Manual Check ---

    # Combine player names from all sources
    all_devy_players = set(list(ktc_devy_data.keys()) + list(draft_sharks_data.keys()))

    # Apply Suffix Cleanup and Manual Name Corrections, and Prepare Data for DB
    processed_players_data = {} # Stores { finalCorrectedName: { 'position', 'ktc_value', 'ds_rank' } }

    # --- Manual Name Corrections Mapping ---
    corrections = {
        "Bryan Wesco": "Bryant Wesco",     # Draft Sharks misspelling
        "TJ Moore": "T.J. Moore",         # Draft Sharks format
        "KC Concepcion": "Kevin Concepcion" # KTC format
        # Add more corrections here as needed
    }
    # --- End Manual Name Corrections Mapping ---


    for player in all_devy_players:
        cleaned_name = clean_player_name_suffix(player)
        final_name = corrections.get(cleaned_name, cleaned_name) # Apply manual correction if exists

        ktc_entry = ktc_devy_data.get(player) # Look up using original name
        ds_entry = draft_sharks_data.get(player) # Look up using original name

        # Determine Position (prioritize sources likely to have it)
        final_position = (ktc_entry.get('position') if ktc_entry else None) or \
                         (ds_entry.get('position') if ds_entry else None) or "N/A"

        # Only include fantasy-relevant positions
        if final_position in FANTASY_POSITIONS_DEVY:
            processed_players_data[final_name] = {
                'position': final_position,
                'ktc_value': ktc_entry.get('value') if ktc_entry else None, # Use None for missing data
                'ds_rank': ds_entry.get('rank') if ds_entry else None # Use None for missing data
            }

    logging.info(f"Prepared data for {len(processed_players_data)} players after cleanup and corrections.")

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

            create_devy_table(cur) # Ensure table exists
            insert_or_update_devy_players(cur, processed_players_data) # Insert/update data

            conn.commit() # Commit transaction
            logging.info("Database update completed.")
            db_success = True  # Mark database update as successful

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
        cache_success = save_to_local_cache(processed_players_data)
        if cache_success:
            logging.info("Local cache update completed.")
        else:
            logging.warning("Failed to update local cache.")
    
    # If we have data but database update failed, still try to save locally
    elif processed_players_data:
        logging.info("Database update failed but we have data, attempting to save to local cache...")
        cache_success = save_to_local_cache(processed_players_data)
        if cache_success:
            logging.info("Local cache update completed despite database failure.")
        else:
            logging.warning("Failed to update local cache.")

    logging.info("Devy Scraper script finished.")
