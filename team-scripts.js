document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const teamName = urlParams.get('team');
    document.getElementById('team-name').textContent = teamName;

    const scheduleContainer = document.getElementById('schedule-container');

    // Example schedule data, replace with actual schedule data
    const schedule = [
        { opponent: "Opponent 1", date: new Date('2024-08-01T00:00:00') },
        { opponent: "Opponent 2", date: new Date('2024-08-08T00:00:00') },
        // Add more games here
    ];

    schedule.forEach(game => {
        const gameDiv = document.createElement('div');
        gameDiv.className = 'game';

        const opponentDiv = document.createElement('div');
        opponentDiv.textContent = game.opponent;

        const countdownDiv = document.createElement('div');
        countdownDiv.className = 'countdown';
        countdownDiv.textContent = getCountdown(game.date);

        gameDiv.appendChild(opponentDiv);
        gameDiv.appendChild(countdownDiv);

        scheduleContainer.appendChild(gameDiv);

        setInterval(() => {
            countdownDiv.textContent = getCountdown(game.date);
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
