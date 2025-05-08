import requests
import os
import json # Import json for parsing KTC data
import psycopg2 # Assuming you are using PostgreSQL like Neon
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database credentials from environment variables (set via GitHub Secrets)
# Assuming these are set up in your GitHub repository secrets
DB_HOST = os.environ.get("NEON_HOST")
DB_DATABASE = os.environ.get("NEON_DATABASE")
DB_USER = os.environ.get("NEON_USER")
DB_PASSWORD = os.environ.get("NEON_PASSWORD")
DB_PORT = os.environ.get("NEON_PORT", 5432) # Default PostgreSQL port

# Debugging: Print connection parameters (excluding sensitive data)
print(f"Connecting to database at {DB_HOST}:{DB_PORT} with user {DB_USER}")

# --- Sleeper API URLs ---
SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"
SLEEPER_LEAGUE_URL = "https://api.sleeper.app/v1/league/{league_id}"
SLEEPER_DRAFT_URL = "https://api.sleeper.app/v1/draft/{draft_id}"
SLEEPER_DRAFT_PICKS_URL = "https://api.sleeper.app/v1/draft/{draft_id}/picks"
SLEEPER_LEAGUE_DRAFTS_URL = "https://api.sleeper.app/v1/league/{league_id}/drafts"

# --- Fetch Functions ---

# Fetch player data from Sleeper API
def fetch_sleeper_players():
    response = requests.get(SLEEPER_PLAYERS_URL)
    if response.status_code == 200:
        all_players = response.json()
        print(f"Total players fetched: {len(all_players)}")
        
        # Log a sample of the player data to inspect the structure
        sample_players = list(all_players.items())[:5]
        for player_id, player in sample_players:
            print(f"Sample player {player_id}: {player}")
        
        # Filter out retired players based on the 'status' field
        current_players = {
            player_id: player
            for player_id, player in all_players.items()
            if player.get('status') in ['Active', 'Injured Reserve']
        }
        print(f"Total current players after filtering: {len(current_players)}")
        return current_players
    else:
        raise Exception(f"Failed to fetch players: {response.status_code}")

# Fetch league data from Sleeper API
def fetch_league_data(league_id):
    response = requests.get(SLEEPER_LEAGUE_URL.format(league_id=league_id))
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to fetch league data: {response.status_code}")

# Fetch draft data from Sleeper API
def fetch_league_drafts(league_id):
    response = requests.get(SLEEPER_LEAGUE_DRAFTS_URL.format(league_id=league_id))
    if response.status_code == 200:
        drafts = response.json()
        print(f"Total drafts for league {league_id}: {len(drafts)}")
        return drafts
    else:
        raise Exception(f"Failed to fetch league drafts: {response.status_code}")

# Fetch draft picks data from Sleeper API
def fetch_draft_picks(draft_id):
    response = requests.get(SLEEPER_DRAFT_PICKS_URL.format(draft_id=draft_id))
    if response.status_code == 200:
        picks = response.json()
        print(f"Total picks for draft {draft_id}: {len(picks)}")
        return picks
    else:
        raise Exception(f"Failed to fetch draft picks: {response.status_code}")

# Get undrafted players based on a specific draft
def get_undrafted_players(draft_id, season_year='2025'):
    """
    Get a list of undrafted players for a specific draft.
    
    Args:
        draft_id (str): The Sleeper draft ID
        season_year (str): The season year to filter relevant rookies
        
    Returns:
        dict: Dictionary containing undrafted players
    """
    try:
        # Get all players
        all_players = fetch_sleeper_players()
        
        # Get draft picks
        draft_picks = fetch_draft_picks(draft_id)
        
        # Create a set of player IDs that have been drafted
        drafted_player_ids = {pick['player_id'] for pick in draft_picks if 'player_id' in pick}
        print(f"Total drafted players: {len(drafted_player_ids)}")
        
        # Filter out drafted players
        undrafted_players = {
            player_id: player
            for player_id, player in all_players.items()
            if player_id not in drafted_player_ids
        }
        
        print(f"Total undrafted players: {len(undrafted_players)}")
        return undrafted_players
    except Exception as e:
        print(f"Error getting undrafted players: {e}")
        return {}

# --- Database Functions ---

# Modify the upload_to_neon function to include progress logging and batch inserts
def upload_to_neon(players):
    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_DATABASE,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            sslmode='require'
        )
        cur = conn.cursor()

        # Dynamically create table with all fields from player data
        sample_player = next(iter(players.values()))
        columns = sample_player.keys()
        create_table_query = f"""
            CREATE TABLE IF NOT EXISTS nfl_players (
                player_id VARCHAR(255) PRIMARY KEY,
                {', '.join([f'{col} TEXT' for col in columns if col != 'player_id'])}
            );
        """
        cur.execute(create_table_query)

        # Ensure all columns exist in the table
        for col in columns:
            cur.execute(f"ALTER TABLE nfl_players ADD COLUMN IF NOT EXISTS {col} TEXT;")

        # Process players in batches of 500
        batch_size = 500
        player_items = list(players.items())
        for i in range(0, len(player_items), batch_size):
            batch = player_items[i:i + batch_size]
            print(f"Uploading batch {i // batch_size + 1} of {len(player_items) // batch_size + 1}...")

            # Prepare batch data
            for player_id, player in batch:
                columns = [col for col in player.keys() if col != 'player_id']
                values = [json.dumps(player[col]) if isinstance(player[col], dict) else player[col] for col in columns]
                insert_query = f"""
                    INSERT INTO nfl_players (player_id, {', '.join(columns)})
                    VALUES (%s, {', '.join(['%s'] * len(columns))})
                    ON CONFLICT (player_id) DO UPDATE SET
                    {', '.join([f'{col} = EXCLUDED.{col}' for col in columns])};
                """
                cur.execute(insert_query, [player_id] + values)

        conn.commit()
        cur.close()
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()

# --- Caching Functions ---

# Ensure the data directory exists before caching players
def cache_players_locally(players, file_name='cached_players.json'):
    os.makedirs('data', exist_ok=True)  # Create the data directory if it doesn't exist
    # Ensure the correct path for cached_players.json
    with open(f'data/{file_name}', 'w') as f:
        json.dump(players, f)
        print(f"Player data cached to data/{file_name}")

# Cache undrafted players for quick access
def cache_undrafted_players(undrafted_players, draft_id):
    file_name = f'undrafted_players_{draft_id}.json'
    cache_players_locally(undrafted_players, file_name)

# --- Verification Functions ---

def verify_nfl_players_table():
    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_DATABASE,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            sslmode='require'
        )
        cur = conn.cursor()

        # Check if the table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'nfl_players'
            );
        """)
        table_exists = cur.fetchone()[0]
        if not table_exists:
            print("Table 'nfl_players' does not exist. Proceeding with full upload.")
            return False

        # Check column consistency
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'nfl_players';
        """)
        existing_columns = {row[0] for row in cur.fetchall()}

        # Fetch a sample player to compare columns
        sample_player = next(iter(fetch_sleeper_players().values()))
        expected_columns = set(sample_player.keys())
        expected_columns.add('player_id')  # Ensure primary key is included

        if not expected_columns.issubset(existing_columns):
            print("Table 'nfl_players' schema is inconsistent. Proceeding with full upload.")
            return False

        # Check row count
        cur.execute("SELECT COUNT(*) FROM nfl_players;")
        row_count = cur.fetchone()[0]
        if row_count == 0:
            print("Table 'nfl_players' is empty. Proceeding with full upload.")
            return False

        # Perform a sample query
        cur.execute("SELECT * FROM nfl_players LIMIT 5;")
        sample_rows = cur.fetchall()
        print("Sample rows from 'nfl_players':", sample_rows)

        print("Verification successful. Table 'nfl_players' is ready.")
        return True
    except Exception as e:
        print(f"Error during verification: {e}")
        return False
    finally:
        if conn:
            conn.close()

# --- API Routes for Web Use ---

# This function could be wrapped in a Flask or FastAPI endpoint
def api_get_undrafted_players(league_id, draft_id=None, season_year='2025'):
    """
    API endpoint to get undrafted players.
    
    Args:
        league_id (str): Sleeper league ID
        draft_id (str, optional): Specific draft ID. If None, will use the most recent draft.
        season_year (str): The season year to filter for
        
    Returns:
        dict: Dictionary containing undrafted players
    """
    try:
        # If no draft ID provided, get the most recent draft for the league
        if not draft_id:
            drafts = fetch_league_drafts(league_id)
            # Find the most recent draft for the specified season
            relevant_drafts = [d for d in drafts if d.get('season') == season_year]
            if not relevant_drafts:
                return {"error": f"No drafts found for season {season_year}"}
            
            # Sort by created timestamp (descending)
            relevant_drafts.sort(key=lambda x: x.get('created', 0), reverse=True)
            draft_id = relevant_drafts[0]['draft_id']
        
        # Get undrafted players
        undrafted_players = get_undrafted_players(draft_id, season_year)
        
        # Return only the relevant fields for each player
        simplified_players = {}
        for player_id, player in undrafted_players.items():
            simplified_players[player_id] = {
                "player_id": player_id,
                "full_name": player.get('full_name') or f"{player.get('first_name', '')} {player.get('last_name', '')}",
                "first_name": player.get('first_name'),
                "last_name": player.get('last_name'),
                "position": player.get('position'),
                "team": player.get('team'),
                "years_exp": player.get('years_exp'),
                "status": player.get('status'),
                "college": player.get('college'),
                "number": player.get('number'),
                "rookie": True if player.get('years_exp') == 0 else False
            }
        
        return {"undrafted_players": simplified_players}
    except Exception as e:
        print(f"API error: {e}")
        return {"error": str(e)}

# Update main execution flow
if __name__ == "__main__":
    try:
        print("Starting Sleeper API data fetch process...")
        
        # Check if we're being called with specific parameters
        import sys
        if len(sys.argv) > 1:
            if sys.argv[1] == "undrafted":
                if len(sys.argv) >= 3:
                    league_id = sys.argv[2]
                    draft_id = sys.argv[3] if len(sys.argv) >= 4 else None
                    season_year = sys.argv[4] if len(sys.argv) >= 5 else '2025'
                    
                    print(f"Fetching undrafted players for league {league_id}, draft {draft_id}, season {season_year}")
                    result = api_get_undrafted_players(league_id, draft_id, season_year)
                    
                    if "error" not in result:
                        print(f"Found {len(result['undrafted_players'])} undrafted players")
                        cache_file = f"undrafted_league_{league_id}.json"
                        cache_players_locally(result['undrafted_players'], cache_file)
                    else:
                        print(f"Error: {result['error']}")
                else:
                    print("Usage: python fetch_sleeper.py undrafted <league_id> [draft_id] [season_year]")
            else:
                print("Unknown command. Available commands: undrafted")
        else:
            print("Verifying 'nfl_players' table...")
            if verify_nfl_players_table():
                print("Skipping full upload as verification passed.")
            else:
                print("Fetching players from Sleeper API...")
                players = fetch_sleeper_players()

                print("Uploading players to Neon database...")
                upload_to_neon(players)

                print("Caching players locally...")
                cache_players_locally(players)

        print("Process completed successfully.")
    except Exception as e:
        print(f"Error: {e}")
