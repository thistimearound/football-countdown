// --- Configuration ---
const SLEEPER_SEASON_YEAR = '2025'; // The season the draft is FOR (e.g., 2025 for the upcoming rookie draft)

// --- Event Listener for Load Button ---
document.getElementById("loadDraft").addEventListener("click", async () => {
    const leagueID = document.getElementById("leagueID").value.trim();
    if (!leagueID) {
        alert("Please enter a valid League ID.");
        return;
    }

    try {
        // Fetch all necessary data from Sleeper API concurrently
        const [
            usersResponse,
            rostersResponse,
            draftsResponse,
            tradedPicksResponse,
            nflPlayersResponse // Fetch NFL players once
        ] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/users`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/drafts`),
            fetch(`https://api.sleeper.app/v1/league/${leagueID}/traded_picks`),
            fetch("https://api.sleeper.app/v1/players/nfl") // Fetch NFL players
        ]);

        // Check if all responses are OK before parsing JSON
        if (!usersResponse.ok) throw new Error(`Failed to fetch users: ${usersResponse.status}`);
        if (!rostersResponse.ok) throw new Error(`Failed to fetch rosters: ${rostersResponse.status}`);
        if (!draftsResponse.ok) throw new Error(`Failed to fetch drafts: ${draftsResponse.status}`);
        if (!tradedPicksResponse.ok) throw new Error(`Failed to fetch traded picks: ${tradedPicksResponse.status}`);
        if (!nflPlayersResponse.ok) throw new Error(`Failed to fetch NFL players: ${nflPlayersResponse.status}`);


        const users = await usersResponse.json();
        const rosters = await rostersResponse.json();
        const drafts = await draftsResponse.json();
        const tradedPicks = await tradedPicksResponse.json();
        const nflPlayers = await nflPlayersResponse.json(); // NFL Players data

        if (!drafts || drafts.length === 0) {
            alert("No drafts found for this league.");
            return;
        }

        // Find the relevant rookie or linear draft for the specified season
        const rookieDraft = drafts.find(d => (d.type === 'rookie' || d.type === 'linear') && d.season === SLEEPER_SEASON_YEAR);

        if (!rookieDraft) {
             alert(`Could not find rookie or linear draft for season ${SLEEPER_SEASON_YEAR} in this league.`);
             console.error(`Could not find rookie or linear draft for season ${SLEEPER_SEASON_YEAR}. Available drafts:`, drafts);
             return;
        }

        const draftID = rookieDraft.draft_id;
        const draftSettings = rookieDraft.settings;
        const numRounds = draftSettings?.rounds || 5; // Default to 5 rounds if not specified
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
        users.forEach(user => {
          userMap[user.user_id] = user.display_name;
        });
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


        // Map NFL Players: { player_id: full_name }
        const playerMap = {};
        if (nflPlayers) {
            Object.keys(nflPlayers).forEach(playerId => {
                const player = nflPlayers[playerId];
                // Use 'full_name' or fall back to 'first_name last_name'
                playerMap[playerId] = player.full_name || (player.first_name + ' ' + player.last_name);
            });
        }
        console.log(`Mapped names for ${Object.keys(playerMap).length} NFL players.`);


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
                playerName = playerMap[pickData.player_id] || `Player ID ${pickData.player_id} (Unknown Name)`; // Fallback name if player ID not in map
            }

            draftBoardData.push({
                pick_no: pickNumber,
                round: round,
                pick_in_round: pickInRound,
                playerName: playerName,
                currentOwnerName: currentOwnerName,
                originalOwnerName: originalOwnerName
            });
        }
        // --- End Data Processing ---
        
        renderDraftBoard(draftBoardData, numTeams);

    } catch (error) {
        console.error("Error loading draft data:", error);
        alert(`Failed to load draft data: ${error.message}. Please check the League ID and try again.`);
    }
});

// --- Rendering Function ---
/**
 * Renders the draft board data into the HTML table.
 * @param {Array<Object>} draftBoardData Array of pick objects, each with pick details, player, and owners.
 * @param {number} numTeams The number of teams in the league (used for grid layout).
 */
function renderDraftBoard(draftBoardData, numTeams) {
    const draftTable = document.getElementById("draftTable");
    draftTable.innerHTML = ""; // Clear previous data

    // Create a grid container for the draft board
    const gridContainer = document.createElement("div");
    gridContainer.classList.add("draft-grid");
    // Set grid columns dynamically based on number of teams
    gridContainer.style.gridTemplateColumns = `repeat(${numTeams}, 1fr)`;


    // Iterate through processed pick data and create cards
    draftBoardData.forEach(pick => {
        const card = document.createElement("div");
        card.classList.add("draft-card");

        // Pick number
        const pickNumber = document.createElement("div");
        pickNumber.classList.add("pick-number");
        // Display pick number in Round.Pick format
        pickNumber.textContent = `Pick ${pick.round}.${String(pick.pick_in_round).padStart(2, '0')} (${pick.pick_no})`;
        card.appendChild(pickNumber);

        // Drafted Player
        const playerSelected = document.createElement("div");
        playerSelected.classList.add("player-selected");
        playerSelected.textContent = pick.playerName;
        card.appendChild(playerSelected);

        // Current Pick Owner
        const currentOwner = document.createElement("div");
        currentOwner.classList.add("pick-owner");
        currentOwner.textContent = `Owner: ${pick.currentOwnerName}`;
        card.appendChild(currentOwner);

        // Original Owner
        const originalOwner = document.createElement("div");
        originalOwner.classList.add("original-owner");
        originalOwner.textContent = `Original: ${pick.originalOwnerName}`;
        card.appendChild(originalOwner);

        gridContainer.appendChild(card);
    });

    draftTable.appendChild(gridContainer);
}
