import json
import os
import logging

# Ensure the correct data directory exists
log_dir = "/Users/christopherlemeilleur/Documents/GitHub/football-countdown/data"
os.makedirs(log_dir, exist_ok=True)

# Configure logging
logging.basicConfig(
    filename=f"{log_dir}/adp_scraper.log",
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

def calculate_adp_from_cached_data():
    """
    Calculates ADP from the cached player data in data/cached_players.json.
    """
    cached_file_path = "data/cached_players.json"
    adp_file_path = "data/adp_data.json"

    try:
        logging.info("Starting ADP calculation from cached data.")

        # Check if the cached file exists and has data
        if not os.path.exists(cached_file_path) or os.path.getsize(cached_file_path) == 0:
            logging.error(f"Cached player data file {cached_file_path} does not exist or is empty.")
            return None

        # Load cached player data
        with open(cached_file_path, "r") as file:
            player_data = json.load(file)

        # Extract ADP-related data (assuming ADP is a field in the player data)
        adp_data = {
            player_id: {
                "full_name": player.get("full_name", "Unknown Player"),
                "adp": player.get("adp", None)
            }
            for player_id, player in player_data.items() if "adp" in player
        }

        # Save the ADP data to a local JSON file
        with open(adp_file_path, "w") as file:
            json.dump(adp_data, file, indent=4)

        logging.info(f"ADP data successfully calculated and saved to {adp_file_path}.")
        return adp_data

    except Exception as e:
        logging.error(f"Error calculating ADP from cached data: {e}")
        return None

if __name__ == "__main__":
    calculate_adp_from_cached_data()