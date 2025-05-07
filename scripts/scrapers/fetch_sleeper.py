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
        return response.json()
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

        # Create table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS nfl_players (
                player_id VARCHAR(255) PRIMARY KEY,
                full_name VARCHAR(255),
                position VARCHAR(50),
                team VARCHAR(50),
                adp FLOAT
            );
        """)

        # Batch insert player data
        batch_size = 100
        player_items = list(players.items())
        for i in range(0, len(player_items), batch_size):
            batch = player_items[i:i + batch_size]
            values = [
                (
                    player_id,
                    player.get('full_name', 'Unknown'),
                    player.get('position', 'Unknown'),
                    player.get('team', 'Unknown'),
                    player.get('adp', None)
                )
                for player_id, player in batch
            ]

            cur.executemany("""
                INSERT INTO nfl_players (player_id, full_name, position, team, adp)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (player_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    position = EXCLUDED.position,
                    team = EXCLUDED.team,
                    adp = EXCLUDED.adp;
            """, values)

            print(f"Uploaded {i + len(batch)} / {len(player_items)} players...")

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
    with open('data/cached_players.json', 'w') as f:
        json.dump(players, f)

if __name__ == "__main__":
    try:
        print("Fetching players from Sleeper API...")
        players = fetch_sleeper_players()

        print("Uploading players to Neon database...")
        upload_to_neon(players)

        print("Caching players locally...")
        cache_players_locally(players)

        print("Process completed successfully.")
    except Exception as e:
        print(f"Error: {e}")
