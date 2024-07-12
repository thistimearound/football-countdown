document.addEventListener('DOMContentLoaded', () => {
    const teams = [
        { name: "Arizona Cardinals", class: "arizona-cardinals" },
        { name: "Atlanta Falcons", class: "atlanta-falcons" },
        { name: "Baltimore Ravens", class: "baltimore-ravens" },
        { name: "Buffalo Bills", class: "buffalo-bills" },
        { name: "Carolina Panthers", class: "carolina-panthers" },
        { name: "Chicago Bears", class: "chicago-bears" },
        { name: "Cincinnati Bengals", class: "cincinnati-bengals" },
        { name: "Cleveland Browns", class: "cleveland-browns" },
        { name: "Dallas Cowboys", class: "dallas-cowboys" },
        { name: "Denver Broncos", class: "denver-broncos" },
        { name: "Detroit Lions", class: "detroit-lions" },
        { name: "Green Bay Packers", class: "green-bay-packers" },
        { name: "Houston Texans", class: "houston-texans" },
        { name: "Indianapolis Colts", class: "indianapolis-colts" },
        { name: "Jacksonville Jaguars", class: "jacksonville-jaguars" },
        { name: "Kansas City Chiefs", class: "kansas-city-chiefs" },
        { name: "Las Vegas Raiders", class: "las-vegas-raiders" },
        { name: "Los Angeles Chargers", class: "los-angeles-chargers" },
        { name: "Los Angeles Rams", class: "los-angeles-rams" },
        { name: "Miami Dolphins", class: "miami-dolphins" },
        { name: "Minnesota Vikings", class: "minnesota-vikings" },
        { name: "New England Patriots", class: "new-england-patriots" },
        { name: "New Orleans Saints", class: "new-orleans-saints" },
        { name: "New York Giants", class: "new-york-giants" },
        { name: "New York Jets", class: "new-york-jets" },
        { name: "Philadelphia Eagles", class: "philadelphia-eagles" },
        { name: "Pittsburgh Steelers", class: "pittsburgh-steelers" },
        { name: "San Francisco 49ers", class: "san-francisco-49ers" },
        { name: "Seattle Seahawks", class: "seattle-seahawks" },
        { name: "Tampa Bay Buccaneers", class: "tampa-bay-buccaneers" },
        { name: "Tennessee Titans", class: "tennessee-titans" },
        { name: "Washington Commanders", class: "washington-commanders" }
    ];

    const teamsContainer = document.getElementById('teams-container');

    teams.forEach(team => {
        const teamDiv = document.createElement('div');
        teamDiv.className = `team ${team.class}`;
        
        const teamLink = document.createElement('a');
        teamLink.href = `team.html?team=${encodeURIComponent(team.name)}`;
        teamLink.textContent = team.name;

        const countdownDiv = document.createElement('div');
        countdownDiv.className = 'countdown';
        // Placeholder countdown, replace with actual date
        const nextGameDate = new Date('2024-08-01T00:00:00'); 
        countdownDiv.textContent = getCountdown(nextGameDate);

        teamDiv.appendChild(teamLink);
        teamDiv.appendChild(countdownDiv);

        teamsContainer.appendChild(teamDiv);

        setInterval(() => {
            countdownDiv.textContent = getCountdown(nextGameDate);
        }, 1000);
    });

    function getCountdown(targetDate) {
        const now = new Date();
        const diff = targetDate - now;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
});
