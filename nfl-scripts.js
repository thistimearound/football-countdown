document.addEventListener('DOMContentLoaded', () => {
    const teams = {
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

                const nextGameDate = getNextGameDate(team.class);
                countdownDiv.textContent = getCountdown(nextGameDate);

                teamDiv.appendChild(teamLink);
                teamDiv.appendChild(countdownDiv);

                teamsDiv.appendChild(teamDiv);

                setInterval(() => {
                    countdownDiv.textContent = getCountdown(nextGameDate);
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
        const schedule = nflschedules[teamClass]; // nflschedules is defined and accessible via nfl-schedules.js
        const now = new Date();
        for (const game of schedule) {
            const gameDate = new Date(game.date);
            if (gameDate > now) {
                return gameDate;
            }
        }
        return null;
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

   
    var element = document.getElementById('yourElementId'); // Replace 'yourElementId' with the actual ID
    if (element) {
        // Safe to proceed with appendChild or other operations
        var child = document.createElement('div');
        // Configure your child element as needed
        element.appendChild(child);
    } else {
        console.error('Element not found!');
    }
});
