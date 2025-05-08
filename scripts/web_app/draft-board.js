// --- Configuration ---
const SLEEPER_SEASON_YEAR = '2025'; // The season the draft is FOR (e.g., 2025 for the upcoming rookie draft)

// --- Event Listener for Load Button ---
document.getElementById("loadDraft").addEventListener("click", loadDraft);

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
            tradedPicksResponse
        ] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/users`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/drafts`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/traded_picks`)
        ]);

        // Check if all responses are OK before parsing JSON
        if (!usersResponse.ok) throw new Error(`Failed to fetch users: ${usersResponse.status}`);
        if (!rostersResponse.ok) throw new Error(`Failed to fetch rosters: ${rostersResponse.status}`);
        if (!draftsResponse.ok) throw new Error(`Failed to fetch drafts: ${draftsResponse.status}`);
        if (!tradedPicksResponse.ok) throw new Error(`Failed to fetch traded picks: ${tradedPicksResponse.status}`);

        const users = await usersResponse.json();
        const rosters = await rostersResponse.json();
        const drafts = await draftsResponse.json();
        const tradedPicks = await tradedPicksResponse.json();

        console.log("Users Response:", users);
        console.log("Rosters Response:", rosters);
        console.log("Drafts Response:", drafts);
        console.log("Traded Picks Response:", tradedPicks);

        if (!drafts || drafts.length === 0) {
            alert("No drafts found for this league.");
            return;
        }

        // Find the relevant rookie or linear draft for the specified season
        const rookieDraft = drafts.find(d => (d.type === 'rookie' || d.type === 'linear') && d.season === SLEEPER_SEASON_YEAR);

        // Always fetch live player data to ensure we have the most up-to-date list
        console.log("Fetching live player data from Sleeper API...");
        const playerResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!playerResponse.ok) throw new Error(`Failed to fetch NFL player data: ${playerResponse.status}`);
        const nflPlayers = await playerResponse.json();
        console.log(`Loaded ${Object.keys(nflPlayers).length} NFL players`);

        if (!rookieDraft) {
             alert(`Could not find rookie or linear draft for season ${SLEEPER_SEASON_YEAR} in this league.`);
             console.error(`Could not find rookie or linear draft for season ${SLEEPER_SEASON_YEAR}. Available drafts:`, drafts);
             return;
        }

        const draftID = rookieDraft.draft_id;
        const draftSettings = rookieDraft.settings;
        const numRounds = draftSettings?.rounds || 4; // Default to 4 rounds if not specified
        const numTeams = draftSettings?.teams || rosters.length; // Use roster count as fallback
        const isSnake = rookieDraft.type !== 'linear'; // Determine if it's a snake draft

        // Fetch specific draft details (for slot_to_roster_id - the official draft order) and the actual picks made
         const [
            draftDetailsResponse,
            picksMadeResponse,
         ] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/draft/${draftID}`),
            fetch(`https://api.sleeper.app/v1/draft/${draftID}/picks`),
         ]);

        if (!draftDetailsResponse.ok) throw new Error(`Failed to fetch draft details: ${draftDetailsResponse.status}`);
        if (!picksMadeResponse.ok) throw new Error(`Failed to fetch picks made: ${picksMadeResponse.status}`);

        const draftDetails = await draftDetailsResponse.json();
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

            // --- CORRECTED LOGIC for Original Owner Slot ---
            // Determine the original owner's slot based on the draft order definition (1-based slot in round)
            // This relies on slotToRosterId mapping 1-based slot (1 to numTeams) to original roster ID
            const originalOwnerSlot = (isSnake && round % 2 === 0) ? (numTeams - pickInRound + 1) : pickInRound;
            // --- END CORRECTED LOGIC ---


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
        renderPlayerPool(nflPlayers, draftedPlayerIds);

        // Show the player pool after rendering the draft board
        showPlayerPool();
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
 */
function renderPlayerPool(players, draftedPlayerIds) {
    console.log("Total Players:", Object.keys(players).length);
    console.log("Drafted Player IDs:", draftedPlayerIds.size);

    const playerList = document.getElementById("playerList");
    playerList.innerHTML = ""; // Clear previous data
    
    // Add search/filter controls to the top of the player pool
    const filterControls = document.createElement("div");
    filterControls.classList.add("player-filter-controls");
    
    // Search input
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.id = "playerSearch";
    searchInput.placeholder = "Search players...";
    searchInput.addEventListener("input", filterPlayers);
    
    // Position filter dropdown
    const positionFilter = document.createElement("select");
    positionFilter.id = "positionFilter";
    positionFilter.addEventListener("change", filterPlayers);
    
    const positions = ["All", "QB", "RB", "WR", "TE", "K", "DEF"];
    positions.forEach(pos => {
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
    Object.entries(players).forEach(([playerId, player]) => {
        if (!draftedPlayerIds.has(playerId) && isValidDraftablePlayer(player)) {
            window.allPlayers.push({
                id: playerId,
                name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
                position: player.position || "N/A",
                team: player.team || "N/A",
                rookie: player.years_exp === 0 || Boolean(player.rookie),
                adp: player.adp || Infinity,
                fantasy_points: player.fantasy_points || null,
                search_text: `${player.full_name || ''} ${player.first_name || ''} ${player.last_name || ''} ${player.team || ''} ${player.position || ''}`.toLowerCase()
            });
        }
    });
    
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
    
    console.log(`Found ${window.allPlayers.length} undrafted players`);

    // Initial display of players
    filterPlayers();
    
    // Add count of undrafted players to the player pool header
    const playerPoolHeader = document.querySelector("#playerPool h2");
    if (playerPoolHeader) {
        playerPoolHeader.textContent = `Player Pool (${window.allPlayers.length} Undrafted Players)`;
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
 * Determines if a player should be included in the undrafted player pool
 * @param {Object} player The player object to check
 * @returns {boolean} Whether the player should be included
 */
function isValidDraftablePlayer(player) {
    // Skip players with no position or name
    if (!player.position || (!player.full_name && !player.last_name)) {
        return false;
    }
    
    // Only include active players
    if (player.status === "Retired" || player.status === "Inactive") {
        return false;
    }
    
    // Include players with these positions
    const validPositions = ["QB", "RB", "WR", "TE", "K", "DEF"];
    return validPositions.includes(player.position);
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