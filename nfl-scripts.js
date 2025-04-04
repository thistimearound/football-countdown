function getNextGameDate(teamClass) {
    const schedule = nflschedules[teamClass];

    if (!schedule) {
        console.error(`Schedule not found for team class: ${teamClass}`);
        return { date: null, opponent: 'Unknown', home_or_away: '', spread_line: '', adj_spread_odds: '', adj_moneyline: '' };
    }

    const now = new Date();
    for (const game of schedule) {
        const gameDate = new Date(game.date);
        if (game.opponent === "BYE") {
            continue;
        }
        if (game.opponent === "Cumulative Record") {
            // Display "Cumulative Record" but do not treat it as a regular game
            continue;
        }
        if (gameDate > now) {
            const adj_spread_odds = game.adj_spread_odds;
            const spread_line = game.spread_line >= 0 ? `+${game.spread_line}` : game.spread_line;
            const adj_moneyline = game.adj_moneyline >= 0 ? `+${game.adj_moneyline}` : game.adj_moneyline;
            return { date: gameDate, opponent: game.opponent, home_or_away: game.home_or_away, spread_line: spread_line, adj_spread_odds: adj_spread_odds, adj_moneyline: adj_moneyline };
        }
    }
    // No upcoming games found
    return { date: null, opponent: 'Season completed', home_or_away: '', spread_line: '', adj_spread_odds: '', adj_moneyline: '' };
}

function getCountdown(targetDate) {
    if (!targetDate) {
        return 'Season completed';
    }

    const now = new Date();
    const diff = targetDate - now;

    // If the game has already passed, don't show a countdown
    if (diff <= 0) {
        return 'Game in progress or completed';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

document.addEventListener("DOMContentLoaded", () => {
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
            if (window.location.pathname !== '/team.html') {
                console.log(`Division container not found for ${conference} ${division}`);
            }
            return;
        }
        teams.forEach(team => {
            const teamElement = document.createElement('div');
            teamElement.className = `team ${team.class}`;
            
            const teamLink = document.createElement('a');
            teamLink.href = `team.html?team=${encodeURIComponent(team.name)}`;
            teamLink.className = 'team-link';
            teamLink.innerHTML = `<strong>${team.name}</strong>`;
    
            // Add cumulative record inside the teamLink
            const recordDiv = document.createElement('div');
            recordDiv.className = 'record';
            const cumulativeRecord = nflschedules[team.class].find(game => game.opponent === "Cumulative Record");
            if (cumulativeRecord) {
                recordDiv.textContent = `(${cumulativeRecord.wins}-${cumulativeRecord.losses}-${cumulativeRecord.ties})`;
            } else {
                recordDiv.textContent = '(0-0-0)';
            }
            teamLink.appendChild(recordDiv);
    
            teamElement.appendChild(teamLink);
    
            let countdownDiv = document.createElement('div');
            countdownDiv.className = 'countdown';
        
            const nextGame = nflschedules ? getNextGameDate(team.class) : null;
            if (nextGame && nextGame.date) {
                if (nextGame.opponent === 'BYE') {
                    countdownDiv.innerHTML = `Week ${nextGame.week}: BYE`;
                } else {
                    countdownDiv.innerHTML = `${nextGame.home_or_away} ${nextGame.opponent} <br> ${getCountdown(nextGame.date)}`;
                }
            } else {
                countdownDiv.textContent = 'Season completed';
            }
        
            teamElement.appendChild(countdownDiv);
    
            divisionContainer.appendChild(teamElement);
        });
    
        setInterval(() => {
            const countdownDivs = divisionContainer.getElementsByClassName('countdown');
            for (let i = 0; i < countdownDivs.length; i++) {
                const countdownDiv = countdownDivs[i];
                const teamClass = countdownDiv.parentNode.classList[1];
                const nextGame = nflschedules ? getNextGameDate(teamClass) : null;
                if (nextGame && nextGame.date) {
                    if (nextGame.opponent === 'BYE') {
                        countdownDiv.innerHTML = `Week ${nextGame.week}: BYE`;
                    } else {
                        countdownDiv.innerHTML = `${nextGame.home_or_away} ${nextGame.opponent} <br>${getCountdown(nextGame.date)}`;
                    }
                } else {
                    countdownDiv.textContent = 'Season completed';
                }
            }
        }, 1000);
    };

    for (const [conference, divisions] of Object.entries(nflTeamsContainer)) {
        divisions.forEach(([division, teamList]) => {
            appendTeams(conference, division, teamList);
        });
    }
});