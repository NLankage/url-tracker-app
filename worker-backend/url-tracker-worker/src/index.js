import { MongoClient } from 'mongodb';

export default {
  async fetch(request, env) {
    // Common CORS headers for all responses
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const url = new URL(request.url);
    const client = new MongoClient(env.MONGODB_URI);

    try {
      // Handle CORS preflight (OPTIONS) requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Connect to MongoDB
      await client.connect();
      const db = client.db('urlTrackerDB');
      const urlsCollection = db.collection('urls');

      // Root path response
      if (url.pathname === '/' && request.method === 'GET') {
        return new Response(JSON.stringify({ message: 'URL Tracker Worker is running!' }), {
          headers: corsHeaders,
        });
      }

      // Save or check URL
      if (url.pathname === '/save-data' && request.method === 'POST') {
        const newData = await request.json();

        const existingEntry = await urlsCollection.findOne({ url: newData.url });
        if (existingEntry) {
          return new Response(JSON.stringify({ message: 'URL exists', id: existingEntry.id }), {
            headers: corsHeaders,
          });
        }

        const usedIds = (await urlsCollection.find().toArray()).map(item => item.id).sort((a, b) => a - b);
        let newId = 1;
        for (let i = 0; i < usedIds.length; i++) {
          if (usedIds[i] !== newId) break;
          newId++;
        }
        newData.id = newId;

        await urlsCollection.insertOne(newData);
        return new Response(JSON.stringify({ message: 'Data saved successfully', id: newId }), {
          headers: corsHeaders,
        });
      }

      // Update data
      if (url.pathname.startsWith('/update-data/') && request.method === 'POST') {
        const id = parseInt(url.pathname.split('/')[2]);
        const newData = await request.json();

        const result = await urlsCollection.updateOne(
          { id: id },
          { $set: { ...newData, id } }
        );
        if (result.matchedCount > 0) {
          return new Response(JSON.stringify({ message: 'Data updated successfully' }), {
            headers: corsHeaders,
          });
        }
        return new Response(JSON.stringify({ message: 'Data not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      // Delete data
      if (url.pathname.startsWith('/delete-data/') && request.method === 'DELETE') {
        const id = parseInt(url.pathname.split('/')[2]);
        const result = await urlsCollection.deleteOne({ id: id });
        if (result.deletedCount > 0) {
          return new Response(JSON.stringify({ message: 'Data deleted successfully' }), {
            headers: corsHeaders,
          });
        }
        return new Response(JSON.stringify({ message: 'Data not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      // Get all data
      if (url.pathname === '/get-data' && request.method === 'GET') {
        const savedData = await urlsCollection.find().toArray();
        return new Response(JSON.stringify(savedData), {
          headers: corsHeaders,
        });
      }

      // Update active status
      if (url.pathname === '/update-active-status' && request.method === 'POST') {
        const savedData = await request.json();
        for (const data of savedData) {
          await urlsCollection.updateOne(
            { id: data.id },
            { $set: { activeStatus: data.activeStatus } }
          );
        }
        return new Response(JSON.stringify({ message: 'Active status updated' }), {
          headers: corsHeaders,
        });
      }

      // Handle unknown routes
      return new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ message: 'Server error', error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    } finally {
      await client.close();
    }
  },

  // Scheduled task for checking expiration and sending Telegram messages
  async scheduled(event, env, ctx) {
    const client = new MongoClient(env.MONGODB_URI);
    try {
      await client.connect();
      const db = client.db('urlTrackerDB');
      const urlsCollection = db.collection('urls');

      const savedData = await urlsCollection.find().toArray();
      for (const data of savedData) {
        const now = new Date();
        const expire = new Date(data.expireDateTime);
        const newActiveStatus = now >= expire ? 0 : 1;

        if (data.activeStatus !== newActiveStatus && newActiveStatus === 0) {
          // URL just expired, send Telegram message
          const message = `මචන් URL එකක් දින 100 පැනලා Inactive වෙන්න යන්නෙ.\n\nDate: ${data.expireDateTime}\nID: ${data.id}\nURL: ${data.url}\nActiveStatus: ${newActiveStatus}`;
          const response = await fetch(
            `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                text: message
              })
            }
          );

          if (!response.ok) {
            console.error('Failed to send Telegram message:', await response.text());
          }
        }

        // Update activeStatus in MongoDB
        await urlsCollection.updateOne(
          { id: data.id },
          { $set: { activeStatus: newActiveStatus } }
        );
      }
    } catch (error) {
      console.error('Error in scheduled task:', error);
    } finally {
      await client.close();
    }
  },
};