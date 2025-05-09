// --- Configuration ---
const SLEEPER_SEASON_YEAR = '2025'; // The season the draft is FOR (e.g., 2025 for the upcoming rookie draft)

// --- Event Listener for Load Button ---
document.getElementById("loadDraft").addEventListener("click", loadDraft);

// Add event listener for player pool toggle
document.addEventListener("DOMContentLoaded", function() {
    const playerPoolToggle = document.getElementById("playerPoolToggle");
    if (playerPoolToggle) {
        playerPoolToggle.addEventListener("change", handlePlayerPoolToggle);
    }
});

// Global variable to store state needed for toggle functionality
let globalDraftState = {
    nflPlayers: null,
    draftedPlayerIds: null,
    isRookiesOnly: null,
    validPositions: null
};

// Handle toggle between rookies only and all players
function handlePlayerPoolToggle(event) {
    // Only proceed if we have the necessary data
    if (globalDraftState.nflPlayers && globalDraftState.validPositions) {
        const showAllPlayers = event.target.checked;
        // Re-render the player pool with the opposite of the current rookies only setting
        renderPlayerPool(
            globalDraftState.nflPlayers, 
            globalDraftState.draftedPlayerIds, 
            !showAllPlayers, // When toggle is checked, show all players (rookies = false)
            globalDraftState.validPositions
        );
    }
}

// Modify loadDraft to fetch undrafted players and load them into playerPool
async function loadDraft() {
    const leagueID = document.getElementById("leagueID").value.trim();
    if (!leagueID) {
        alert("Please enter a valid League ID.");
        return;
    }

    try {
        // Show loading indicator
        document.getElementById("draftTable").innerHTML = "<p class='loading'>Loading draft data...</p>";
        document.getElementById("playerList").innerHTML = "<p class='loading'>Preparing player pool...</p>";
        
        // Fetch all necessary data from Sleeper API concurrently, except for NFL players
        const [
            usersResponse,
            rostersResponse,
            draftsResponse,
            tradedPicksResponse,
            leagueResponse // Added league settings API call
        ] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/users`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/drafts`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/traded_picks`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}`) // Get league settings
        ]);

        // Check if all responses are OK before parsing JSON
        if (!usersResponse.ok) throw new Error(`Failed to fetch users: ${usersResponse.status}`);
        if (!rostersResponse.ok) throw new Error(`Failed to fetch rosters: ${rostersResponse.status}`);
        if (!draftsResponse.ok) throw new Error(`Failed to fetch drafts: ${draftsResponse.status}`);
        if (!tradedPicksResponse.ok) throw new Error(`Failed to fetch traded picks: ${tradedPicksResponse.status}`);
        if (!leagueResponse.ok) throw new Error(`Failed to fetch league settings: ${leagueResponse.status}`);

        const users = await usersResponse.json();
        const rosters = await rostersResponse.json();
        const drafts = await draftsResponse.json();
        const tradedPicks = await tradedPicksResponse.json();
        const league = await leagueResponse.json(); // Parse league settings

        console.log("Users Response:", users);
        console.log("Rosters Response:", rosters);
        console.log("Drafts Response:", drafts);
        console.log("Traded Picks Response:", tradedPicks);
        console.log("League Settings:", league);

        if (!drafts || drafts.length === 0) {
            alert("No drafts found for this league.");
            return;
        }

        // Find a suitable draft in this order of priority:
        // 1. Any draft matching the specified season
        // 2. Most recent draft if no match for the specified season
        let selectedDraft = null;
        
        const currentSeasonDrafts = drafts.filter(d => d.season === SLEEPER_SEASON_YEAR);
        
        if (currentSeasonDrafts.length > 0) {
            // For current season, prefer rookie drafts, then others
            selectedDraft = currentSeasonDrafts.find(d => d.type === 'rookie') || currentSeasonDrafts[0];
            console.log("Found draft for current season:", selectedDraft);
        } else if (drafts.length > 0) {
            // If no draft for current season, use the most recent one
            drafts.sort((a, b) => (b.created || 0) - (a.created || 0));
            selectedDraft = drafts[0];
            console.log("No draft for current season, using most recent draft:", selectedDraft);
        }
        
        // Always fetch live player data to ensure we have the most up-to-date list
        console.log("Fetching live player data from Sleeper API...");
        const playerResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!playerResponse.ok) throw new Error(`Failed to fetch NFL player data: ${playerResponse.status}`);
        const nflPlayers = await playerResponse.json();
        console.log(`Loaded ${Object.keys(nflPlayers).length} NFL players`);

        if (!selectedDraft) {
             alert(`Could not find any valid drafts in this league.`);
             console.error(`Could not find any valid drafts. Available drafts:`, drafts);
             return;
        }

        // Extract draft information
        const draftID = selectedDraft.draft_id;
        const draftSettings = selectedDraft.settings || {};
        const numRounds = draftSettings.rounds || 4; // Default to 4 rounds if not specified
        const numTeams = draftSettings.teams || rosters.length; // Use roster count as fallback
        
        // IMPORTANT: In Sleeper API:
        // - "type" field is "snake", "linear", or "auction" (this is the draft FORMAT)
        // - "metadata.type" field is "startup" or "rookie" (this is the PLAYER POOL type)
        
        // Draft format (how picks are ordered): SNAKE, LINEAR, or AUCTION
        const draftFormat = selectedDraft.type || 'snake'; // Default to snake
        const isSnake = draftFormat === 'snake';
        
        // Draft type (which players are eligible): ROOKIE or ALL
        // First check the checkbox (user override)
        const isRookieDraftChecked = document.getElementById("isRookieDraft")?.checked || false;

        // Fetch specific draft details which might have more metadata
        const draftDetailsResponse = await fetch(`https://api.sleeper.app/v1/draft/${draftID}`);
        if (!draftDetailsResponse.ok) throw new Error(`Failed to fetch draft details: ${draftDetailsResponse.status}`);
        const draftDetails = await draftDetailsResponse.json();
        console.log("Draft Details:", draftDetails);

        // Determine if it's a rookie draft through several methods
        // Look at all available signals in the API data, ordered by reliability:
        const draftSignals = {
            // 1. User explicitly checked the "Rookie Draft" checkbox (highest priority, overrides API data)
            userChecked: isRookieDraftChecked,
            
            // 2. Draft metadata explicitly states type=rookie (very reliable)
            metadataIsRookie: (selectedDraft.metadata && selectedDraft.metadata.type === 'rookie') || 
                              (draftDetails.metadata && draftDetails.metadata.type === 'rookie'),
            
            // 3. Draft settings explicitly state draft_type=rookie
            settingsIsRookie: draftSettings.draft_type === 'rookie' || 
                              (draftDetails.settings && draftDetails.settings.draft_type === 'rookie'),
            
            // 4. Draft type field says rookie (less common but valid)
            typeIsRookie: selectedDraft.type === 'rookie',
            
            // 5. Draft name contains "rookie" (reliable if present)
            nameContainsRookie: selectedDraft.name && selectedDraft.name.toLowerCase().includes('rookie'),
            
            // 6. League name contains "rookie" or "dynasty" (strong indicator if draft is for future season)
            leagueTypeHint: league.name && 
                           (league.name.toLowerCase().includes('rookie') || 
                            league.name.toLowerCase().includes('dynasty')),
            
            // 7. Season is next year (2025) but not a startup draft
            futureSeason: SLEEPER_SEASON_YEAR === '2025' && 
                         !(selectedDraft.name && selectedDraft.name.toLowerCase().includes('startup')),
            
            // 8. Number of rounds is small (4-5), typical for rookie drafts
            fewRounds: numRounds <= 5,
            
            // 9. No previous drafts exist for this league (if this is the only draft and it's future season, likely rookie)
            onlyDraftIsFuture: drafts.length === 1 && selectedDraft.season === '2025'
        };
        
        console.log("Draft rookie signals:", draftSignals);
        
        // Calculate the likelihood this is a rookie draft based on signals
        // Stronger signals are weighted more heavily
        let rookieSignalCount = 0;
        if (draftSignals.userChecked) rookieSignalCount += 5;         // User override (strongest)
        if (draftSignals.metadataIsRookie) rookieSignalCount += 5;     // Explicit API data (strongest)
        if (draftSignals.settingsIsRookie) rookieSignalCount += 5;     // Explicit API data (strongest)
        if (draftSignals.typeIsRookie) rookieSignalCount += 4;         // Explicit but less common
        if (draftSignals.nameContainsRookie) rookieSignalCount += 4;   // Very reliable if present
        if (draftSignals.leagueTypeHint) rookieSignalCount += 2;       // Good hint
        if (draftSignals.futureSeason) rookieSignalCount += 2;         // Common pattern
        if (draftSignals.fewRounds) rookieSignalCount += 1;            // Weak signal
        if (draftSignals.onlyDraftIsFuture) rookieSignalCount += 1;    // Weak signal

        // Decision: if we have any strong signal or multiple weak signals
        const isRookiesOnly = rookieSignalCount >= 3;
        
        // Determine the reason we detected it as rookie or not
        let rookieDetectionReason = "Not enough signals to determine as rookie draft";
        if (draftSignals.userChecked) rookieDetectionReason = "User selected Rookie Draft checkbox";
        else if (draftSignals.metadataIsRookie) rookieDetectionReason = "Draft metadata indicates rookie draft";
        else if (draftSignals.settingsIsRookie) rookieDetectionReason = "Draft settings indicate rookie draft";
        else if (draftSignals.typeIsRookie) rookieDetectionReason = "Draft type indicates rookie draft";
        else if (draftSignals.nameContainsRookie) rookieDetectionReason = "Draft name contains 'rookie'";
        else if (rookieSignalCount >= 5) rookieDetectionReason = "Multiple signals indicate rookie draft";
        
        console.log(`Draft Format: ${draftFormat} (determines pick order)`);
        console.log(`Draft Season: ${selectedDraft.season}`);
        console.log(`Draft Name: ${selectedDraft.name || 'Unnamed'}`);
        console.log(`Draft ID: ${draftID}`);
        console.log(`Draft metadata:`, selectedDraft.metadata || 'None');
        console.log(`Draft settings:`, draftSettings);
        console.log(`Rookie Signal Count: ${rookieSignalCount}`);
        console.log(`Is Rookies Only: ${isRookiesOnly} (${rookieDetectionReason})`);
        console.log(`Player Pool: ${isRookiesOnly ? 'Rookies Only' : 'All Players'}`);

        // Get valid positions from league settings
        const leagueSettings = league.settings || {};
        
        // Get roster positions
        let rosterPositions = [];
        if (Array.isArray(leagueSettings.roster_positions) && leagueSettings.roster_positions.length > 0) {
            rosterPositions = leagueSettings.roster_positions;
        } else if (league.roster_positions) {
            // Try alternative field
            rosterPositions = league.roster_positions;
        } else {
            // Default roster positions for common fantasy leagues
            rosterPositions = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN", "BN", "BN", "BN", "BN"];
            console.log("Using default roster positions");
        }
        
        console.log("League Roster Positions:", rosterPositions);
        
        // Extract valid positions based on league roster settings
        const validPositions = getValidPositionsFromRoster(rosterPositions);
        console.log("Valid Positions for Player Pool:", validPositions);

        // Fetch picks made
        const picksMadeResponse = await fetch(`https://api.sleeper.app/v1/draft/${draftID}/picks`);
        if (!picksMadeResponse.ok) throw new Error(`Failed to fetch picks made: ${picksMadeResponse.status}`);
        const picksMade = await picksMadeResponse.json();

        if (!draftDetails || !draftDetails.slot_to_roster_id) {
             alert(`Could not fetch specific draft details or official draft order for draft ID ${draftID}.`);
             console.error(`Could not fetch specific draft details or slot_to_roster_id mapping for draft ${draftID}.`, draftDetails);
             return;
        }

        // --- Data Processing ---
        // Create necessary lookup maps for efficient access
        const userMap = {}; // { user_id: display_name }
        if (Array.isArray(users)) {
            users.forEach(user => {
                userMap[user.user_id] = user.display_name;
            });
        } else {
            console.error("Users data is not an array:", users);
        }
        console.log("User Map:", userMap); // Log user map for debugging

        const rosterOwnerMap = {}; // { roster_id: owner_id }
        rosters.forEach(roster => {
          if (roster.owner_id) {
              rosterOwnerMap[roster.roster_id] = roster.owner_id;
          } else {
               console.warn(`Roster ID ${roster.roster_id} has no owner_id.`); // Log rosters without owners
          }
        });
         console.log("Roster Owner Map:", rosterOwnerMap); // Log roster owner map

        const slotToRosterId = draftDetails.slot_to_roster_id; // Maps pick slot (1, 2, ...) to original roster_id
        // Convert keys in slotToRosterId to numbers as they are strings by default from JSON
        const numericSlotToRosterId = {};
        Object.keys(slotToRosterId).forEach(slot => {
            numericSlotToRosterId[parseInt(slot)] = slotToRosterId[slot];
        });
        console.log("Numeric Slot to Roster ID Map (Original Draft Order):", numericSlotToRosterId); // Log original draft order map


        // Create a map for easy lookup of traded picks: { "season_round_originalRosterId": newOwnerRosterId }
        const tradedPicksMap = {};
        tradedPicks.forEach(pick => {
          // Only map picks for the relevant season
          if (pick.season === SLEEPER_SEASON_YEAR) {
              const key = `${pick.season}_${pick.round}_${pick.roster_id}`; // Use original owner roster_id as part of the key
              tradedPicksMap[key] = pick.owner_id; // The roster_id of the current owner
          }
        });
        console.log("Traded Picks Map:", tradedPicksMap); // Log traded picks map


        // Map picks actually made: { pick_no: { pick_data } }
        const picksMadeMap = {};
        if (picksMade) {
            picksMade.forEach(pick => {
                picksMadeMap[pick.pick_no] = pick;
            });
        }
        console.log(`Fetched ${Object.keys(picksMadeMap).length} picks made.`);


        // Map NFL Players: { player_id: player_object } 
        // Note: The nflPlayers object from the API already has this structure

        // Create a set of drafted player IDs for easy lookup
        const draftedPlayerIds = new Set();
        picksMade.forEach(pick => {
            if (pick.player_id) {
                draftedPlayerIds.add(pick.player_id);
            }
        });
        console.log(`Found ${draftedPlayerIds.size} drafted players out of ${picksMade.length} picks.`);


        // Generate data for all picks (1 to total picks)
        const draftBoardData = [];
        const totalPicks = numRounds * numTeams;

        for (let pickNumber = 1; pickNumber <= totalPicks; pickNumber++) {
            const round = Math.ceil(pickNumber / numTeams);
            let pickInRound = pickNumber % numTeams;
            if (pickInRound === 0) pickInRound = numTeams; // If it's the last pick of the round

            // Determine the original owner's slot based on the draft format
            let originalOwnerSlot;
            if (isSnake) {
                // In snake drafts, even rounds go in reverse order
                originalOwnerSlot = round % 2 === 0 ? (numTeams - pickInRound + 1) : pickInRound;
            } else {
                // In linear drafts, all rounds use the same order
                originalOwnerSlot = pickInRound;
            }

            const originalOwnerRosterId = numericSlotToRosterId[originalOwnerSlot]; // Use the calculated originalOwnerSlot with numeric keys

            let originalOwnerName = "Unknown Original Owner";
            if (originalOwnerRosterId) {
                 const originalOwnerUserId = rosterOwnerMap[originalOwnerRosterId];
                 // Check if user exists for this owner_id
                 originalOwnerName = userMap[originalOwnerUserId] || `Roster ${originalOwnerRosterId} (Unknown User)`;
                 if (!userMap[originalOwnerUserId]) {
                      console.warn(`User ID ${originalOwnerUserId} not found for Roster ID ${originalOwnerRosterId} (Original Owner of Pick ${pickNumber}).`);
                 }
            } else {
                 console.warn(`Could not determine original owner roster ID for pick ${round}.${pickInRound} (Overall pick ${pickNumber}, Original Slot ${originalOwnerSlot}). slotToRosterId map:`, numericSlotToRosterId);
            }

            // Check if this pick was traded FOR THE CORRECT SEASON and original owner
            const tradeMapKey = `${SLEEPER_SEASON_YEAR}_${round}_${originalOwnerRosterId}`;
            const currentOwnerRosterId = tradedPicksMap[tradeMapKey] || originalOwnerRosterId; // Default to original owner if not traded

            // Get the user ID and display name of the current owner
            const currentOwnerUserId = rosterOwnerMap[currentOwnerRosterId];
            // Check if user exists for this owner_id
            const currentOwnerName = userMap[currentOwnerUserId] || `Roster ${currentOwnerRosterId} (Unknown User)`; // Fallback name
             if (!userMap[currentOwnerUserId]) {
                  console.warn(`User ID ${currentOwnerUserId} not found for Roster ID ${currentOwnerRosterId} (Current Owner of Pick ${pickNumber}).`);
             }

            // Determine the drafted player
            const pickData = picksMadeMap[pickNumber]; // Look up by overall pick number
            let playerName = "Not Selected"; // Default if no player picked

            if (pickData && pickData.player_id) {
                playerName = pickData.metadata?.first_name && pickData.metadata?.last_name 
                    ? `${pickData.metadata.first_name} ${pickData.metadata.last_name}` 
                    : nflPlayers[pickData.player_id]?.full_name || `Player ID ${pickData.player_id} (Unknown Name)`;
            }

            draftBoardData.push({
                pick_no: pickNumber,
                round: round,
                pick_in_round: pickInRound,
                player_id: pickData?.player_id || null, // Include player_id for mapping
                playerName: playerName,
                currentOwnerName: currentOwnerName,
                originalOwnerName: originalOwnerName
            });
        }
        // --- End Data Processing ---
        
        renderDraftBoard(draftBoardData, numTeams, nflPlayers, draftBoardData.map(pick => pick.originalOwnerName));
        renderPlayerPool(nflPlayers, draftedPlayerIds, isRookiesOnly, validPositions);

        // Show the player pool after rendering the draft board
        showPlayerPool();

        // Store state for toggle functionality
        globalDraftState.nflPlayers = nflPlayers;
        globalDraftState.draftedPlayerIds = draftedPlayerIds;
        globalDraftState.isRookiesOnly = isRookiesOnly;
        globalDraftState.validPositions = validPositions;
    } catch (error) {
        console.error("Error loading draft data:", error);
        alert(`Failed to load draft data: ${error.message}. Please check the League ID and try again.`);
    }
}

// --- Rendering Function ---
/**
 * Renders the draft board data into the HTML table.
 * @param {Array<Object>} draftBoardData Array of pick objects, each with pick details, player, and owners.
 * @param {number} numTeams The number of teams in the league (used for grid layout).
 * @param {Object} nflPlayers Object containing NFL player data.
 * @param {Array<string>} originalOwners Array of original owner names.
 */
function renderDraftBoard(draftBoardData, numTeams, nflPlayers, originalOwners) {
    const draftTable = document.getElementById("draftTable");
    draftTable.innerHTML = ""; // Clear previous data

    // Create a header row for original owners
    const headerRow = document.createElement("div");
    headerRow.classList.add("draft-header-row");
    
    // Get unique owner slots
    const uniqueOwners = [...new Set(originalOwners)];
    
    for (let i = 1; i <= numTeams; i++) {
        const headerCell = document.createElement("div");
        headerCell.classList.add("draft-header-cell");
        headerCell.textContent = originalOwners[i - 1] || `Owner ${i}`; // Use original owner names if available
        headerRow.appendChild(headerCell);
    }
    draftTable.appendChild(headerRow);

    // Create the grid container for draft cards
    const gridContainer = document.createElement("div");
    gridContainer.classList.add("draft-grid");
    gridContainer.style.gridTemplateColumns = `repeat(${numTeams}, 1fr)`;

    draftBoardData.forEach(pick => {
        const card = document.createElement("div");
        card.classList.add("draft-card");
        
        // Add a class if the pick has been made
        if (pick.player_id) {
            card.classList.add("pick-made");
        }

        const pickNumber = document.createElement("div");
        pickNumber.classList.add("pick-number");
        pickNumber.textContent = `Pick ${pick.round}.${String(pick.pick_in_round).padStart(2, '0')} (${pick.pick_no})`;
        card.appendChild(pickNumber);

        const playerSelected = document.createElement("div");
        playerSelected.classList.add("player-selected");
        
        if (pick.player_id) {
            const playerData = nflPlayers[pick.player_id] || {};
            let displayText = pick.playerName;
            
            // Add position and team if available
            if (playerData.position) {
                displayText += ` (${playerData.position}`;
                if (playerData.team) {
                    displayText += ` - ${playerData.team}`;
                }
                displayText += ')';
            }
            
            playerSelected.textContent = displayText;
        } else {
            playerSelected.textContent = "Not Selected";
        }
        
        card.appendChild(playerSelected);

        const currentOwner = document.createElement("div");
        currentOwner.classList.add("pick-owner");
        currentOwner.textContent = `Owner: ${pick.currentOwnerName}`;
        card.appendChild(currentOwner);

        gridContainer.appendChild(card);
    });

    draftTable.appendChild(gridContainer);
}

/**
 * Renders the player pool, filtering undrafted players and sorting them by position and name.
 * @param {Object} players Object containing player data.
 * @param {Set} draftedPlayerIds Set of drafted player IDs.
 * @param {boolean} isRookieDraft Whether the draft is a rookie draft.
 * @param {Object} validPositions Object with valid positions as keys and true as values.
 */
function renderPlayerPool(players, draftedPlayerIds, isRookieDraft, validPositions) {
    console.log("Total Players:", Object.keys(players).length);
    console.log("Drafted Player IDs:", draftedPlayerIds.size);
    console.log("Is Rookie Draft:", isRookieDraft);
    console.log("Valid Positions:", validPositions);

    const playerList = document.getElementById("playerList");
    playerList.innerHTML = ""; // Clear previous data
    
    // Sample some players to debug rookie detection
    console.log("Sample Players for Debugging Rookie Detection:");
    const samplePlayers = Object.entries(players).slice(0, 10);
    samplePlayers.forEach(([id, player]) => {
        console.log(`Player ID: ${id}, Name: ${player.full_name || player.first_name + ' ' + player.last_name}, Years Exp: ${player.years_exp}, Rookie: ${player.rookie}, Status: ${player.status}`);
    });
    
    // Add search/filter controls to the top of the player pool
    const filterControls = document.createElement("div");
    filterControls.classList.add("player-filter-controls");
    
    // Search input
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.id = "playerSearch";
    searchInput.placeholder = "Search players...";
    searchInput.addEventListener("input", filterPlayers);
    
    // Position filter dropdown - only show valid positions
    const positionFilter = document.createElement("select");
    positionFilter.id = "positionFilter";
    positionFilter.addEventListener("change", filterPlayers);
    
    // Always add "All" option
    const allOption = document.createElement("option");
    allOption.value = "All";
    allOption.textContent = "All Positions";
    positionFilter.appendChild(allOption);
    
    // Only add positions that are valid for this league
    const positionsToShow = ["QB", "RB", "WR", "TE", "K", "DEF"].filter(pos => validPositions[pos]);
    positionsToShow.forEach(pos => {
        const option = document.createElement("option");
        option.value = pos;
        option.textContent = pos;
        positionFilter.appendChild(option);
    });
    
    filterControls.appendChild(searchInput);
    filterControls.appendChild(positionFilter);
    playerList.appendChild(filterControls);
    
    // Container for player cards
    const playerCardsContainer = document.createElement("div");
    playerCardsContainer.id = "playerCardsContainer";
    playerCardsContainer.classList.add("player-cards-container");
    playerList.appendChild(playerCardsContainer);

    // Prepare player data for filtering
    window.allPlayers = [];
    
    // Count players by bucket to debug filtering issues
    let totalPlayers = 0;
    let playersWithoutPosition = 0;
    let playersWithoutName = 0;
    let inactiveRetiredPlayers = 0;
    let nonRookiePlayers = 0;
    let invalidPositionPlayers = 0;
    let acceptedPlayers = 0;
    
    Object.entries(players).forEach(([playerId, player]) => {
        totalPlayers++;
        
        // Skip drafted players
        if (draftedPlayerIds.has(playerId)) {
            return;
        }
        
        // Fix missing data in player object
        if (!player.years_exp && player.years_exp !== 0) {
            // If years_exp is missing, try to determine rookie status from other fields
            if (player.rookie === true || player.status === "Rookie") {
                player.years_exp = 0;
            } else {
                // Default to 1 year experience if we can't determine
                player.years_exp = 1;
            }
        }
        
        // Skip players with no position or name
        if (!player.position) {
            playersWithoutPosition++;
            return;
        }
        
        if (!player.full_name && (!player.first_name || !player.last_name)) {
            playersWithoutName++;
            return;
        }
        
        // Only include active players
        if (player.status === "Retired" || player.status === "Inactive") {
            inactiveRetiredPlayers++;
            return;
        }
        
        // Check if player is a rookie
        const isRookie = player.years_exp === 0 || player.rookie === true || player.status === "Rookie";
        
        // FIXED: Only filter rookies if it's a rookie draft
        // This was causing the issue with startup drafts showing only rookies
        if (isRookieDraft && !isRookie) {
            nonRookiePlayers++;
            return; // Skip non-rookies only for rookie drafts
        }
        
        // Check if position is valid for this league
        if (!validPositions[player.position]) {
            invalidPositionPlayers++;
            return;
        }
        
        acceptedPlayers++;
        
        window.allPlayers.push({
            id: playerId,
            name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
            position: player.position || "N/A",
            team: player.team || "N/A",
            rookie: isRookie,
            adp: player.adp || Infinity,
            fantasy_points: player.fantasy_points || null,
            search_text: `${player.full_name || ''} ${player.first_name || ''} ${player.last_name || ''} ${player.team || ''} ${player.position || ''}`.toLowerCase()
        });
    });
    
    // Log filtering statistics
    console.log(`Player Pool Filtering Stats:
        Total Players: ${totalPlayers}
        Without Position: ${playersWithoutPosition}
        Without Name: ${playersWithoutName}
        Inactive/Retired: ${inactiveRetiredPlayers}
        Non-Rookies (in rookie draft): ${nonRookiePlayers}
        Invalid Position: ${invalidPositionPlayers}
        Accepted Players: ${acceptedPlayers}
        Final Player Count: ${window.allPlayers.length}`
    );
    
    // Sort undrafted players by position then by name
    window.allPlayers.sort((a, b) => {
        // First by position
        if (a.position !== b.position) {
            // Custom position order: QB, RB, WR, TE, K, DEF
            const posOrder = { "QB": 1, "RB": 2, "WR": 3, "TE": 4, "K": 5, "DEF": 6 };
            return (posOrder[a.position] || 99) - (posOrder[b.position] || 99);
        }
        
        // Then by name
        return a.name.localeCompare(b.name);
    });
    
    console.log(`Found ${window.allPlayers.length} undrafted players for the player pool`);
    
    // If we have no players but it's a rookie draft, try including non-rookies as a fallback
    if (window.allPlayers.length === 0 && isRookieDraft) {
        console.log("No rookies found, showing all valid players as fallback");
        Object.entries(players).forEach(([playerId, player]) => {
            if (!draftedPlayerIds.has(playerId) && 
                player.position && validPositions[player.position] && 
                (player.full_name || (player.first_name && player.last_name)) &&
                player.status !== "Retired" && player.status !== "Inactive") {
                
                window.allPlayers.push({
                    id: playerId,
                    name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
                    position: player.position || "N/A",
                    team: player.team || "N/A",
                    rookie: false, // Not a rookie but showing anyway
                    adp: player.adp || Infinity,
                    fantasy_points: player.fantasy_points || null,
                    search_text: `${player.full_name || ''} ${player.first_name || ''} ${player.last_name || ''} ${player.team || ''} ${player.position || ''}`.toLowerCase()
                });
            }
        });
        console.log(`Fallback: Found ${window.allPlayers.length} players`);
    }

    // Initial display of players
    filterPlayers();
    
    // Add count of undrafted players to the player pool header
    const playerPoolHeader = document.querySelector("#playerPool h2");
    if (playerPoolHeader) {
        const draftType = isRookieDraft ? "Rookie " : "";
        playerPoolHeader.textContent = `${draftType}Player Pool (${window.allPlayers.length} Undrafted Players)`;
    }
}

/**
 * Filters players based on search input and position filter
 */
function filterPlayers() {
    const searchTerm = document.getElementById("playerSearch").value.toLowerCase();
    const positionFilter = document.getElementById("positionFilter").value;
    const container = document.getElementById("playerCardsContainer");
    
    container.innerHTML = ""; // Clear current display
    
    let matchCount = 0;
    const MAX_DISPLAYED = 100; // Limit number of displayed cards for performance
    
    window.allPlayers.forEach(player => {
        // Check if player matches filters
        const matchesSearch = searchTerm === "" || player.search_text.includes(searchTerm);
        const matchesPosition = positionFilter === "All" || player.position === positionFilter;
        
        if (matchesSearch && matchesPosition && matchCount < MAX_DISPLAYED) {
            const playerCard = document.createElement("div");
            playerCard.classList.add("player-card");
            
            if (player.rookie) {
                playerCard.classList.add("rookie-player");
            }

            // Player Name
            const playerName = document.createElement("div");
            playerName.classList.add("player-name");
            playerName.textContent = player.name;
            playerCard.appendChild(playerName);

            // Player Details
            const playerDetails = document.createElement("div");
            playerDetails.classList.add("player-details");
            
            let detailsHtml = `
                <span class="player-position">${player.position}</span>
                <span class="player-team">${player.team}</span>
            `;
            
            if (player.rookie) {
                detailsHtml += `<span class="player-rookie">Rookie</span>`;
            }
            
            if (player.adp && player.adp !== Infinity) {
                detailsHtml += `<span class="player-adp">ADP: ${player.adp.toFixed(1)}</span>`;
            }
            
            if (player.fantasy_points) {
                detailsHtml += `<span class="player-points">Proj: ${player.fantasy_points.toFixed(1)}</span>`;
            }
            
            playerDetails.innerHTML = detailsHtml;
            playerCard.appendChild(playerDetails);

            container.appendChild(playerCard);
            matchCount++;
        }
    });
    
    // Show message if no results
    if (matchCount === 0) {
        const noResults = document.createElement("div");
        noResults.classList.add("no-results");
        noResults.textContent = "No players match your filters";
        container.appendChild(noResults);
    }
    
    // Show message if results were limited
    if (matchCount === MAX_DISPLAYED && window.allPlayers.length > MAX_DISPLAYED) {
        const limitMessage = document.createElement("div");
        limitMessage.classList.add("limit-message");
        limitMessage.textContent = `Showing ${MAX_DISPLAYED} of ${window.allPlayers.length} matching players. Please refine your search.`;
        container.appendChild(limitMessage);
    }
}

/**
 * Extract valid positions from roster settings
 * @param {Array} rosterPositions Array of roster position slots from league settings
 * @returns {Object} Object with valid positions as keys and true as values
 */
function getValidPositionsFromRoster(rosterPositions) {
    const validPositions = {
        "QB": false,
        "RB": false,
        "WR": false,
        "TE": false,
        "K": false,
        "DEF": false
    };
    
    // Map Sleeper position codes to our simplified position codes
    const positionMapping = {
        "QB": "QB",
        "RB": "RB",
        "WR": "WR",
        "TE": "TE",
        "K": "K", 
        "DEF": "DEF",
        "FLEX": ["RB", "WR", "TE"], // FLEX includes RB/WR/TE
        "SUPER_FLEX": ["QB", "RB", "WR", "TE"], // SUPER_FLEX includes QB/RB/WR/TE
        "REC_FLEX": ["WR", "TE"], // Receiver FLEX includes WR/TE
        "WRRB_FLEX": ["RB", "WR"], // RB/WR FLEX
        "IDP_FLEX": [], // Ignore IDP positions
        "DL": [],
        "LB": [],
        "DB": [],
        "IDP": []
    };
    
    console.log("Processing roster positions:", rosterPositions);
    
    // Process each position in the roster settings
    rosterPositions.forEach(posCode => {
        // If it's a direct position, mark it as valid
        if (positionMapping[posCode] && typeof positionMapping[posCode] === 'string') {
            validPositions[positionMapping[posCode]] = true;
            console.log(`Direct position match: ${posCode} -> ${positionMapping[posCode]}`);
        } 
        // If it's a flex position, mark all included positions as valid
        else if (positionMapping[posCode] && Array.isArray(positionMapping[posCode])) {
            positionMapping[posCode].forEach(flexPos => {
                validPositions[flexPos] = true;
                console.log(`Flex position match: ${posCode} includes ${flexPos}`);
            });
        }
    });
    
    // If we didn't find any valid positions (possible parsing error), default to common positions
    if (!Object.values(validPositions).some(Boolean)) {
        console.warn("No valid positions found, using default positions");
        validPositions.QB = true;
        validPositions.RB = true;
        validPositions.WR = true;
        validPositions.TE = true;
    }
    
    return validPositions;
}

// Show the player pool only after the draft board is successfully loaded
function showPlayerPool() {
    const playerPoolSection = document.getElementById("playerPool");
    if (playerPoolSection) {
        playerPoolSection.style.display = "block"; // Make the player pool visible
    }
}

function setDraftGridColumns(numTeams) {
    const root = document.documentElement;
    root.style.setProperty('--num-teams', numTeams);
}

// Example usage: Call this function after determining the number of teams in the league
setDraftGridColumns(12); // Default to 12 teams, will be updated dynamically