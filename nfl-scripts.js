document.addEventListener('DOMContentLoaded', () => {
    const DIVISION_NAMES = new Map([
        [0, "North"],
        [1, "East"],
        [2, "South"],
        [3, "West"]
    ]);
    
    const nflTeamsContainer = {
        "AFC": [
            [DIVISION_NAMES.get(0), [
                { name: "Baltimore Ravens", class: "baltimore-ravens" },
                { name: "Cincinnati Bengals", class: "cincinnati-bengals" },
                { name: "Cleveland Browns", class: "cleveland-browns" },
                { name: "Pittsburgh Steelers", class: "pittsburgh-steelers" }
            ]],
            [DIVISION_NAMES.get(1), [
                { name: "Buffalo Bills", class: "buffalo-bills" },
                { name: "Miami Dolphins", class: "miami-dolphins" },
                { name: "New England Patriots", class: "new-england-patriots" },
                { name: "New York Jets", class: "new-york-jets" }
            ]],
            [DIVISION_NAMES.get(2), [
                { name: "Houston Texans", class: "houston-texans" },
                { name: "Indianapolis Colts", class: "indianapolis-colts" },
                { name: "Jacksonville Jaguars", class: "jacksonville-jaguars" },
                { name: "Tennessee Titans", class: "tennessee-titans" }
            ]],
            [DIVISION_NAMES.get(3), [
                { name: "Denver Broncos", class: "denver-broncos" },
                { name: "Kansas City Chiefs", class: "kansas-city-chiefs" },
                { name: "Las Vegas Raiders", class: "las-vegas-raiders" },
                { name: "Los Angeles Chargers", class: "los-angeles-chargers" }
            ]]
        ],
        "NFC": [
            [DIVISION_NAMES.get(0), [
                { name: "Chicago Bears", class: "chicago-bears" },
                { name: "Detroit Lions", class: "detroit-lions" },
                { name: "Green Bay Packers", class: "green-bay-packers" },
                { name: "Minnesota Vikings", class: "minnesota-vikings" }
            ]],
            [DIVISION_NAMES.get(1), [
                { name: "Dallas Cowboys", class: "dallas-cowboys" },
                { name: "New York Giants", class: "new-york-giants" },
                { name: "Philadelphia Eagles", class: "philadelphia-eagles" },
                { name: "Washington Commanders", class: "washington-commanders" }
            ]],
            [DIVISION_NAMES.get(2), [
                { name: "Atlanta Falcons", class: "atlanta-falcons" },
                { name: "Carolina Panthers", class: "carolina-panthers" },
                { name: "New Orleans Saints", class: "new-orleans-saints" },
                { name: "Tampa Bay Buccaneers", class: "tampa-bay-buccaneers" }
            ]],
            [DIVISION_NAMES.get(3), [
                { name: "Arizona Cardinals", class: "arizona-cardinals" },
                { name: "Los Angeles Rams", class: "los-angeles-rams" },
                { name: "San Francisco 49ers", class: "san-francisco-49ers" },
                { name: "Seattle Seahawks", class: "seattle-seahawks" }
            ]]
        ]
    };
    
    const appendTeams = (conference, division, teams) => {
        const divisionContainer = document.getElementById(`${conference.toLowerCase()}-${division.toLowerCase()}`);
        if (!divisionContainer) {
            console.error(`Division container not found for ${conference} ${division}`);
            return;
        }
        teams.forEach(team => {
            const teamElement = document.createElement('div');
            teamElement.className = `team ${team.class}`;
            const teamLink = document.createElement('a');
            teamLink.href = `team.html?team=${encodeURIComponent(team.name)}`;
            teamLink.textContent = team.name;
            teamElement.appendChild(teamLink);

            const countdownDiv = document.createElement('div');
            countdownDiv.className = 'countdown';

            const nextGame = getNextGameDate(team.class);
            if (nextGame) {
                countdownDiv.textContent = `${getCountdown(nextGame.date)} vs ${nextGame.opponent}`;
            } else {
                countdownDiv.textContent = 'No upcoming games';
            }

            teamElement.appendChild(countdownDiv);
            divisionContainer.appendChild(teamElement);

            setInterval(() => {
                if (nextGame) {
                    countdownDiv.textContent = `${getCountdown(nextGame.date)} vs ${nextGame.opponent}`;
                } else {
                    countdownDiv.textContent = 'No upcoming games';
                }
            }, 1000);
        });
    };

    for (const [conference, divisions] of Object.entries(nflTeamsContainer)) {
        divisions.forEach(([division, teamList]) => {
            appendTeams(conference, division, teamList);
        });
    }

    function getNextGameDate(teamClass) {
        console.log(`Fetching schedule for team class: ${teamClass}`);
        const schedule = nflschedules[teamClass];

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
});
