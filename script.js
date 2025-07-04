const BASE_URL = 'https://url-tracker-worker.nelakalankage.workers.dev';

// Testing flag (true = 10 minutes, false = 100 days)
const isTesting = true;

// Function to extract URL from iframe embed code
function extractUrl(embedCode) {
    const regex = /src=["'](.*?)["']/i;
    const match = embedCode.match(regex);
    return match ? match[1] : null;
}

// Function to calculate expire date or time
function calculateExpireDateTime(inputDate) {
    const date = new Date(inputDate);
    if (isTesting) {
        // For testing: Add 10 minutes
        date.setMinutes(date.getMinutes() + 1);
        return date.toISOString();
    } else {
        // For production: Add 100 days
        date.setDate(date.getDate() + 1);
        return date.toISOString().split('T')[0];
    }
}

// Function to check if the entry is expired
function isExpired(expireDateTime) {
    const now = new Date();
    const expire = new Date(expireDateTime);
    return now >= expire;
}

// Function to clear textarea
function clearTextarea() {
    document.getElementById('embedCode').value = '';
}

// Form submission handler
document.getElementById('urlForm').addEventListener('submit', async function(event) {
    event.preventDefault(); // Prevent form from refreshing the page

    const embedCode = document.getElementById('embedCode').value;
    const url = extractUrl(embedCode);

    if (!url) {
        document.getElementById('result').innerHTML = '<div class="alert alert-danger">Invalid iframe embed code!</div>';
        return;
    }

    const inputDateTime = new Date().toISOString();
    const expireDateTime = calculateExpireDateTime(inputDateTime);
    const activeStatus = isExpired(expireDateTime) ? 0 : 1;

    // Create data object
    const data = {
        url: url,
        inputDateTime: inputDateTime,
        expireDateTime: expireDateTime,
        activeStatus: activeStatus
    };

    // Send data to backend
    try {
        const response = await fetch(`${BASE_URL}/save-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.message === 'URL exists') {
            document.getElementById('result').innerHTML = `
                <div class="alert alert-warning">
                    <h4>URL already exists!</h4>
                    <p>ID: ${result.id}</p>
                    <p>URL: ${url}</p>
                    <button class="btn btn-primary" onclick="updateData(${result.id}, '${url}', '${inputDateTime}', '${expireDateTime}')">Update</button>
                    <button class="btn btn-danger" onclick="deleteData(${result.id})">Delete</button>
                </div>
            `;
        } else {
            // Fetch updated data to display
            const dataResponse = await fetch(`${BASE_URL}/get-data`);
            const savedData = await dataResponse.json();
            const currentEntry = savedData.find(item => item.id === result.id);
            document.getElementById('result').innerHTML = `
                <div class="alert alert-success">
                    <h4>${result.message}</h4>
                    <p>ID: ${currentEntry.id}</p>
                    <p>URL: ${currentEntry.url}</p>
                    <p>Input Date/Time: ${isTesting ? currentEntry.inputDateTime : currentEntry.inputDateTime.split('T')[0]}</p>
                    <p>Expire Date/Time: ${isTesting ? currentEntry.expireDateTime : currentEntry.expireDateTime.split('T')[0]}</p>
                    <p>Active Status: ${currentEntry.activeStatus}</p>
                </div>
            `;
            clearTextarea(); // Clear textarea on success
        }
    } catch (error) {
        document.getElementById('result').innerHTML = '<div class="alert alert-danger">Error saving data!</div>';
    }
});

// Function to update data
async function updateData(id, url, inputDateTime, expireDateTime) {
    const data = {
        url: url,
        inputDateTime: inputDateTime,
        expireDateTime: expireDateTime,
        activeStatus: 1
    };

    try {
        const response = await fetch(`${BASE_URL}/update-data/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        document.getElementById('result').innerHTML = `
            <div class="alert alert-success">
                <h4>${result.message}</h4>
                <p>ID: ${id}</p>
                <p>URL: ${url}</p>
                <p>Input Date/Time: ${isTesting ? inputDateTime : inputDateTime.split('T')[0]}</p>
                <p>Expire Date/Time: ${isTesting ? expireDateTime : expireDateTime.split('T')[0]}</p>
                <p>Active Status: 1</p>
            </div>
        `;
        clearTextarea(); // Clear textarea on success
    } catch (error) {
        document.getElementById('result').innerHTML = '<div class="alert alert-danger">Error updating data!</div>';
    }
}

// Function to delete data
async function deleteData(id) {
    try {
        const response = await fetch(`${BASE_URL}/delete-data/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        document.getElementById('result').innerHTML = `
            <div class="alert alert-success">
                <h4>${result.message}</h4>
            </div>
        `;
        clearTextarea(); // Clear textarea on success
    } catch (error) {
        document.getElementById('result').innerHTML = '<div class="alert alert-danger">Error deleting data!</div>';
    }
}

// Show expired URLs
document.getElementById('showExpired').addEventListener('click', async function(event) {
    event.preventDefault(); // Prevent any form submission
    try {
        const response = await fetch(`${BASE_URL}/get-data`);
        const savedData = await response.json();
        const expiredData = savedData.filter(item => item.activeStatus === 0);

        if (expiredData.length === 0) {
            document.getElementById('expiredTable').innerHTML = '<div class="alert alert-info">No expired URLs found.</div>';
            return;
        }

        let tableHtml = `
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>URL</th>
                    </tr>
                </thead>
                <tbody>
        `;
        expiredData.forEach(item => {
            tableHtml += `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.url}</td>
                </tr>
            `;
        });
        tableHtml += '</tbody></table>';
        document.getElementById('expiredTable').innerHTML = tableHtml;
        document.getElementById('result').innerHTML = ''; // Clear result to avoid confusion
    } catch (error) {
        document.getElementById('expiredTable').innerHTML = '<div class="alert alert-danger">Error fetching expired URLs!</div>';
    }
});
