const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('.')); // Serve static files from project folder

// MongoDB connection string
const uri = 'mongodb+srv://nelakalankage:PLl4Dwu3gTM31FBV@cluster0.nght3tq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

let urlsCollection;

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        urlsCollection = client.db('urlTrackerDB').collection('urls');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}
connectToMongoDB();

// Endpoint to save or update data in MongoDB
app.post('/save-data', async (req, res) => {
    try {
        const newData = req.body;

        // Check if URL already exists
        const existingEntry = await urlsCollection.findOne({ url: newData.url });
        if (existingEntry) {
            res.status(200).send({ message: 'URL exists', id: existingEntry.id });
            return;
        }

        // Generate new ID (reuse deleted IDs)
        const usedIds = (await urlsCollection.find().toArray()).map(item => item.id).sort((a, b) => a - b);
        let newId = 1;
        for (let i = 0; i < usedIds.length; i++) {
            if (usedIds[i] !== newId) break;
            newId++;
        }
        newData.id = newId;

        await urlsCollection.insertOne(newData);
        res.status(200).send({ message: 'Data saved successfully', id: newId });
    } catch (error) {
        res.status(500).send({ message: 'Error saving data', error });
    }
});

// Endpoint to update existing data
app.post('/update-data/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const newData = req.body;

        const result = await urlsCollection.updateOne(
            { id: id },
            { $set: { ...newData, id } }
        );
        if (result.matchedCount > 0) {
            res.status(200).send({ message: 'Data updated successfully' });
        } else {
            res.status(404).send({ message: 'Data not found' });
        }
    } catch (error) {
        res.status(500).send({ message: 'Error updating data', error });
    }
});

// Endpoint to delete data
app.delete('/delete-data/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await urlsCollection.deleteOne({ id: id });
        if (result.deletedCount > 0) {
            res.status(200).send({ message: 'Data deleted successfully' });
        } else {
            res.status(404).send({ message: 'Data not found' });
        }
    } catch (error) {
        res.status(500).send({ message: 'Error deleting data', error });
    }
});

// Endpoint to get all data
app.get('/get-data', async (req, res) => {
    try {
        const savedData = await urlsCollection.find().toArray();
        res.status(200).send(savedData);
    } catch (error) {
        res.status(200).send([]); // Return empty array if error
    }
});

// Endpoint to update active status
app.post('/update-active-status', async (req, res) => {
    try {
        const savedData = req.body;
        for (const data of savedData) {
            await urlsCollection.updateOne(
                { id: data.id },
                { $set: { activeStatus: data.activeStatus } }
            );
        }
        res.status(200).send({ message: 'Active status updated' });
    } catch (error) {
        res.status(500).send({ message: 'Error updating active status', error });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});