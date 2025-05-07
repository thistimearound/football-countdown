import json
import os
import time
import logging
import csv
import io
import requests
from datetime import datetime

script_dir = os.path.dirname(os.path.abspath(__file__))
log_dir = os.path.normpath(os.path.join(script_dir, "../../data"))
os.makedirs(log_dir, exist_ok=True)

# Configure logging
logging.basicConfig(
    filename=f"{log_dir}/beatadp_scraper.log",
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

def download_and_process_rankings():
    """
    Downloads the latest rankings directly from BeatADP's website and processes them.
    Returns the processed rankings dictionary.
    """
    # List of URLs to try for downloading the rankings
    urls_to_try = [
        "https://www.beatadp.com/api/rankings/download",
        "https://www.beatadp.com/rankings/download",
        "https://www.beatadp.com/free-rankings-dashboard/download"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    rankings = {}
    download_time = None
    
    # Try each URL until we get a successful download
    for url in urls_to_try:
        try:
            logging.info(f"Attempting to download BeatADP rankings from: {url}")
            
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                # Check if it looks like a CSV
                if 'text/csv' in response.headers.get('Content-Type', '') or 'application/csv' in response.headers.get('Content-Type', '') or response.text.startswith('Name,'):
                    csv_content = response.text
                    download_time = datetime.now()
                    
                    # Process the CSV content directly
                    csv_reader = csv.DictReader(io.StringIO(csv_content))
                    
                    for row in csv_reader:
                        name = row.get('Name', '').strip('"')
                        
                        if not name:
                            continue
                            
                        player_data = {
                            "full_name": name,
                            "rank": int(row.get('Overall Rank', '999').strip('"')),
                            "position": row.get('Position', 'Unknown').strip('"'),
                            "team": "Unknown"  # CSV doesn't contain team info
                        }
                        
                        # Add additional info if available
                        if 'Positional Rank' in row:
                            pos_rank = row.get('Positional Rank', '').strip('"')
                            if pos_rank:
                                player_data["positional_rank"] = pos_rank
                                
                        if 'Tier' in row:
                            tier = row.get('Tier', '').strip('"')
                            if tier:
                                player_data["tier"] = tier
                        
                        if 'Auction Value' in row:
                            value = row.get('Auction Value', '').strip('"')
                            if value:
                                player_data["auction_value"] = value
                        
                        rankings[name] = player_data
                    
                    logging.info(f"Successfully downloaded and processed {len(rankings)} player rankings")
                    print(f"Downloaded and processed rankings for {len(rankings)} players")
                    
                    # If we successfully processed rankings, break out of the URL loop
                    if rankings:
                        break
                else:
                    logging.warning(f"Response from {url} does not appear to be a CSV file")
            else:
                logging.error(f"Failed to download from {url}. Status code: {response.status_code}")
        except Exception as e:
            logging.error(f"Error downloading rankings from {url}: {e}")
    
    if not rankings:
        logging.error("Failed to download rankings from any of the available URLs")
        
        # Fall back to local CSV file if download fails
        csv_file_path = os.path.normpath(os.path.join(script_dir, "../../data/beat_adp_free_rankings.csv"))
        if os.path.exists(csv_file_path):
            logging.info(f"Falling back to local CSV file: {csv_file_path}")
            print("Download failed. Using existing local CSV file instead.")
            
            # Get the file modification time
            mod_time = os.path.getmtime(csv_file_path)
            file_date = datetime.fromtimestamp(mod_time)
            
            try:
                with open(csv_file_path, 'r') as csvfile:
                    csv_reader = csv.DictReader(csvfile)
                    
                    for row in csv_reader:
                        name = row.get('Name', '').strip('"')
                        
                        if not name:
                            continue
                            
                        player_data = {
                            "full_name": name,
                            "rank": int(row.get('Overall Rank', '999').strip('"')),
                            "position": row.get('Position', 'Unknown').strip('"'),
                            "team": "Unknown"  # CSV doesn't contain team info
                        }
                        
                        # Add additional info if available
                        if 'Positional Rank' in row:
                            pos_rank = row.get('Positional Rank', '').strip('"')
                            if pos_rank:
                                player_data["positional_rank"] = pos_rank
                                
                        if 'Tier' in row:
                            tier = row.get('Tier', '').strip('"')
                            if tier:
                                player_data["tier"] = tier
                        
                        if 'Auction Value' in row:
                            value = row.get('Auction Value', '').strip('"')
                            if value:
                                player_data["auction_value"] = value
                        
                        rankings[name] = player_data
                    
                logging.info(f"Successfully loaded {len(rankings)} player rankings from local CSV")
                print(f"Loaded rankings for {len(rankings)} players from local CSV (last updated: {file_date.strftime('%Y-%m-%d')})")
                download_time = file_date
            except Exception as e:
                logging.error(f"Error loading rankings from local CSV: {e}")
    
    return rankings, download_time

def calculate_adp_from_cached_data():
    """
    Downloads the latest ADP from BeatADP and saves it to adp_data.json.
    """
    cached_file_path = os.path.normpath(os.path.join(script_dir, "../../data/cached_players.json"))
    adp_file_path = os.path.normpath(os.path.join(script_dir, "../../data/adp_data.json"))

    try:
        logging.info("Starting ADP calculation from BeatADP rankings.")

        # Check if the cached file exists and has data
        if not os.path.exists(cached_file_path) or os.path.getsize(cached_file_path) == 0:
            logging.error(f"Cached player data file {cached_file_path} does not exist or is empty.")
            return None

        # Load cached player data for context
        with open(cached_file_path, "r") as file:
            player_data = json.load(file)

        print(f"Loaded {len(player_data)} players from cache")
        
        print("Downloading and processing rankings from BeatADP...")
        adp_data, download_time = download_and_process_rankings()

        if not adp_data:
            logging.warning("No ADP data retrieved. Aborting.")
            print("Failed to retrieve rankings data. Please check the logs for more information.")
            return None

        # Format date for the last_updated field
        last_updated = download_time.strftime("%Y-%m-%d") if download_time else datetime.now().strftime("%Y-%m-%d")

        output_data = {
            "source_note": "Rankings based off of redraft, half-ppr, 1QB from BeatADP.com",
            "last_updated": last_updated,
            "players": adp_data
        }

        print(f"Processed rankings for {len(adp_data)} players")
        if adp_data:
            print("First entry sample:", json.dumps(list(adp_data.items())[0], indent=2))

        # Save to file
        with open(adp_file_path, "w") as file:
            json.dump(output_data, file, indent=4)

        print(f"ADP data written to: {adp_file_path}")
        print(f"File size: {os.path.getsize(adp_file_path)} bytes")

        logging.info(f"ADP data successfully saved to {adp_file_path}.")
        return adp_data

    except Exception as e:
        logging.error(f"Error calculating ADP from BeatADP rankings: {e}")
        return None

if __name__ == "__main__":
    calculate_adp_from_cached_data()