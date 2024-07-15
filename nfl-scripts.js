document.addEventListener('DOMContentLoaded', () => {
    const nflTeams = {
        "AFC": [
            ["North", [
                { name: "Baltimore Ravens", class: "baltimore-ravens" },
                { name: "Cincinnati Bengals", class: "cincinnati-bengals" },
                { name: "Cleveland Browns", class: "cleveland-browns" },
                { name: "Pittsburgh Steelers", class: "pittsburgh-steelers" }
            ]],
            ["East", [
                { name: "Buffalo Bills", class: "buffalo-bills" },
                { name: "Miami Dolphins", class: "miami-dolphins" },
                { name: "New England Patriots", class: "new-england-patriots" },
                { name: "New York Jets", class: "new-york-jets" }
            ]],
            ["South", [
                { name: "Houston Texans", class: "houston-texans" },
                { name: "Indianapolis Colts", class: "indianapolis-colts" },
                { name: "Jacksonville Jaguars", class: "jacksonville-jaguars" },
                { name: "Tennessee Titans", class: "tennessee-titans" }
            ]],
            ["West", [
                { name: "Denver Broncos", class: "denver-broncos" },
                { name: "Kansas City Chiefs", class: "kansas-city-chiefs" },
                { name: "Las Vegas Raiders", class: "las-vegas-raiders" },
                { name: "Los Angeles Chargers", class: "los-angeles-chargers" }
            ]]
        ],
        "NFC": [
            ["North", [
                { name: "Chicago Bears", class: "chicago-bears" },
                { name: "Detroit Lions", class: "detroit-lions" },
                { name: "Green Bay Packers", class: "green-bay-packers" },
                { name: "Minnesota Vikings", class: "minnesota-vikings" }
            ]],
            ["East", [
                { name: "Dallas Cowboys", class: "dallas-cowboys" },
                { name: "New York Giants", class: "new-york-giants" },
                { name: "Philadelphia Eagles", class: "philadelphia-eagles" },
                { name: "Washington Commanders", class: "washington-commanders" }
            ]],
            ["South", [
                { name: "Atlanta Falcons", class: "atlanta-falcons" },
                { name: "Carolina Panthers", class: "carolina-panthers" },
                { name: "New Orleans Saints", class: "new-orleans-saints" },
                { name: "Tampa Bay Buccaneers", class: "tampa-bay-buccaneers" }
            ]],
            ["West", [
                { name: "Arizona Cardinals", class: "arizona-cardinals" },
                { name: "Los Angeles Rams", class: "los-angeles-rams" },
                { name: "San Francisco 49ers", class: "san-francisco-49ers" },
                { name: "Seattle Seahawks", class: "seattle-seahawks" }
            ]]
        ]
    };
    
    /** Appends team elements to the division container.
     * @param {string} conference - The conference name.
     * @param {string} division - The division name.
     * @param {Array} teams - The list of teams. **/
    const appendTeams = (conference, division, teams) => {
        const divisionContainer = document.getElementById(`${conference.toLowerCase()}-${division.toLowerCase()}`);
        if (!divisionContainer) {
            console.error(`Division container not found for ${conference} ${division}`);
            return;
        }
        teams.forEach(team => {
            const teamElement = document.createElement('div');
            teamElement.className = team.class;
            teamElement.textContent = team.name;
            divisionContainer.appendChild(teamElement);
        });
    };

    /* 
    const nflTeamsContainer = document.getElementById('nfl-teams-container');

    for (const [conference, divisions] of Object.entries(teams)) {
        const conferenceDiv = document.createElement('div');
        conferenceDiv.className = 'conference';
        
        const conferenceHeader = document.createElement('h2');
        conferenceHeader.textContent = conference;
        conferenceDiv.appendChild(conferenceHeader);

        for (const [division, teamList] of Object.entries(divisions)) {
            const divisionDiv = document.createElement('div');
            divisionDiv.className = 'division';
            
            const divisionHeader = document.createElement('h3');
            divisionHeader.textContent = division;
            divisionDiv.appendChild(divisionHeader);

            const teamsDiv = document.createElement('div');
            teamsDiv.className = 'teams';

            teamList.forEach(team => {
                const teamDiv = document.createElement('div');
                teamDiv.className = `team ${team.class}`;
                
                const teamLink = document.createElement('a');
                teamLink.href = `team.html?team=${encodeURIComponent(team.name)}`;
                teamLink.textContent = team.name;

                const countdownDiv = document.createElement('div');
                countdownDiv.className = 'countdown';

                const nextGame = getNextGameDate(team.class);
                if (nextGame) {
                    countdownDiv.textContent = `${getCountdown(nextGame.date)} vs ${nextGame.opponent}`;
                } else {
                    countdownDiv.textContent = 'No upcoming games';
                }

                teamDiv.appendChild(teamLink);
                teamDiv.appendChild(countdownDiv);

                teamsDiv.appendChild(teamDiv);

                setInterval(() => {
                    if (nextGame) {
                        countdownDiv.textContent = `${getCountdown(nextGame.date)} vs ${nextGame.opponent}`;
                    } else {
                        countdownDiv.textContent = 'No upcoming games';
                    }
                }, 1000);
            });

            divisionDiv.appendChild(teamsDiv);
            conferenceDiv.appendChild(divisionDiv);
        }

        const existingConferenceDiv = document.querySelector('.conference');
        if (existingConferenceDiv) {
            existingConferenceDiv.replaceWith(conferenceDiv);
        } else {
            nflTeamsContainer.appendChild(conferenceDiv);
        }
    }

    function getNextGameDate(teamClass) {
        console.log(`Fetching schedule for team class: ${teamClass}`);
        const schedule = nflschedules[teamClass]; // nflschedules is defined and accessible via nfl-schedules.js

        if (!schedule) {
            console.error(`Schedule not found for team class: ${teamClass}`);
            return { date: null, opponent: 'Unknown' };
        }

        const now = new Date();
        for (const game of schedule) {
            const gameDate = new Date(game.date);
            if (gameDate > now) {
                return { date: gameDate, opponent: game.opponent };
            }
        }
        return { date: null, opponent: 'No upcoming games' };
    }

    function getCountdown(targetDate) {
        if (!targetDate) return 'No upcoming games';

        const now = new Date();
        const diff = targetDate - now;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    */
});