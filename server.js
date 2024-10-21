const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database');
const path = require('path');
const https = require('https');

// Configure an HTTPS agent to ignore SSL errors
const agent = new https.Agent({  
  rejectUnauthorized: false
});

const app = express();
const PORT = process.env.PORT || 3002;  // Use Render's provided port or default to 3002

/**
 * Fetches exchange rates from the Bank of Algeria website.
 * @returns {Promise<Array>} Array of exchange rate objects.
 */
async function fetchExchangeRates() {
    try {
        console.log('Fetching exchange rates from the website...');
        const { data } = await axios.get('https://www.bank-of-algeria.dz/taux-de-change-journalier/', { httpsAgent: agent });
        console.log('Successfully fetched data from the website.');

        const $ = cheerio.load(data);
        const rates = [];

        // Iterate through each table within the #organizTable div
        $('#organizTable > table').each((index, table) => {
            console.log(`Processing table #${index + 1}...`);

            // Extract the date from each table's header
            const dateText = $(table).find('thead th').text().trim();
            console.log(`Found date: ${dateText}`);

            // Convert the date string to a Date object to determine the day of the week
            const [day, month, year] = dateText.split('-');
            const date = new Date(`${year}-${month}-${day}`);
            const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)

            // Skip weekends (Saturday and Sunday)
            if (dayOfWeek === 6 || dayOfWeek === 0) {
                console.log(`Skipping date ${dateText} (weekend).`);
                return; // Continue to the next table
            }

            // Extract USD and EUR rates
            let usdRate = $(table).find('tbody > tr:nth-child(1) > td:nth-child(2)').text().trim();
            let eurRate = $(table).find('tbody > tr:nth-child(2) > td:nth-child(2)').text().trim();

            // If the second column is empty, fallback to the first column
            if (!usdRate) {
                usdRate = $(table).find('tbody > tr:nth-child(1) > td:nth-child(1)').text().trim();
            }
            if (!eurRate) {
                eurRate = $(table).find('tbody > tr:nth-child(2) > td:nth-child(1)').text().trim();
            }

            console.log(`USD Rate for ${dateText}: ${usdRate}`);
            console.log(`EUR Rate for ${dateText}: ${eurRate}`);

            // If both rates are present, add them to the rates array
            if (usdRate && eurRate) {
                console.log(`Adding rates for ${dateText} to the list.`);
                rates.push({
                    date: dateText,
                    USD: parseFloat(usdRate.replace(',', '.')),
                    EUR: parseFloat(eurRate.replace(',', '.'))
                });
            } else {
                console.log(`Missing USD or EUR rate for ${dateText}, skipping.`);
            }
        });

        console.log('Completed fetching exchange rates.');
        return rates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return [];
    }
}

/**
 * Checks if an exchange rate entry already exists in the database.
 * @param {string} date - The date of the exchange rate.
 * @param {string} currency - The currency code (e.g., 'USD', 'EUR').
 * @returns {Promise<boolean>} True if the rate exists, false otherwise.
 */
async function doesRateExist(date, currency) {
    try {
        console.log(`Checking if rate for ${currency} on ${date} exists in the database...`);
        const exists = await db.rateExists(date, currency);
        console.log(`Rate exists: ${exists}`);
        return exists;
    } catch (error) {
        console.error(`Error checking if rate exists for ${currency} on ${date}:`, error);
        return false;
    }
}

// Serve static files (HTML, CSS, JS, etc.) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Route to serve the default HTML page.
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

/**
 * API route to fetch and serve exchange rates.
 */
app.get('/api/rates', async (req, res) => {
    try {
        console.log('Fetching exchange rates...');
        const rates = await fetchExchangeRates();

        if (rates.length > 0) {
            for (const rate of rates) {
                console.log(`Processing rate for ${rate.date}...`);

                // Check if USD rate exists
                const usdExists = await doesRateExist(rate.date, 'USD');
                // Check if EUR rate exists
                const eurExists = await doesRateExist(rate.date, 'EUR');

                // Save USD rate if it doesn't exist
                if (!usdExists) {
                    console.log(`Saving USD rate for ${rate.date}.`);
                    await db.saveExchangeRate('USD', rate.USD, rate.date);
                } else {
                    console.log(`USD rate for ${rate.date} already exists, skipping.`);
                }

                // Save EUR rate if it doesn't exist
                if (!eurExists) {
                    console.log(`Saving EUR rate for ${rate.date}.`);
                    await db.saveExchangeRate('EUR', rate.EUR, rate.date);
                } else {
                    console.log(`EUR rate for ${rate.date} already exists, skipping.`);
                }
            }
        } else {
            console.log('No rates found.');
        }

        console.log('Fetching all rates from the database...');
        const allRates = await db.getExchangeRates();
        console.log('Successfully fetched all rates from the database.');
        res.json(allRates);
    } catch (error) {
        console.error('Error processing exchange rates:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 404 Error Handler for undefined routes.
 */
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
