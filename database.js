const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// Initialize the database by creating the exchange_rate table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS exchange_rate (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        currency TEXT NOT NULL,
        rate REAL NOT NULL,
        date TEXT NOT NULL
    )`);
});

/**
 * Checks if an exchange rate entry exists in the database.
 * @param {string} date - The date of the exchange rate.
 * @param {string} currency - The currency code (e.g., 'USD', 'EUR').
 * @returns {Promise<boolean>} True if the rate exists, false otherwise.
 */
function rateExists(date, currency) {
    return new Promise((resolve, reject) => {
        const query = `SELECT 1 FROM exchange_rate WHERE date = ? AND currency = ? LIMIT 1`;
        db.get(query, [date, currency], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(!!row);
            }
        });
    });
}

/**
 * Saves a new exchange rate entry to the database.
 * @param {string} currency - The currency code (e.g., 'USD', 'EUR').
 * @param {number} rate - The exchange rate value.
 * @param {string} date - The date of the exchange rate.
 * @returns {Promise<void>}
 */
function saveExchangeRate(currency, rate, date) {
    return new Promise((resolve, reject) => {
        const insertQuery = `INSERT INTO exchange_rate (currency, rate, date) VALUES (?, ?, ?)`;
        db.run(insertQuery, [currency, rate, date], function(err) {
            if (err) {
                reject(err);
            } else {
                console.log(`Successfully saved ${currency} rate for ${date}.`);
                resolve();
            }
        });
    });
}

/**
 * Retrieves all exchange rates from the database, ordered by date in descending order.
 * @returns {Promise<Array>} Array of exchange rate objects.
 */
function getExchangeRates() {
    return new Promise((resolve, reject) => {
        const selectQuery = `SELECT * FROM exchange_rate ORDER BY date DESC`;
        db.all(selectQuery, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Export the database functions for use in other modules
module.exports = {
    rateExists,
    saveExchangeRate,
    getExchangeRates
};
