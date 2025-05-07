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

# --- Sleeper API Fetch and Upload ---
SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"

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

# Ensure the data directory exists before caching players
def cache_players_locally(players):
    os.makedirs('data', exist_ok=True)  # Create the data directory if it doesn't exist
    # Ensure the correct path for cached_players.json
    with open('data/cached_players.json', 'w') as f:
        json.dump(players, f)

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

# Update main execution flow
if __name__ == "__main__":
    try:
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
