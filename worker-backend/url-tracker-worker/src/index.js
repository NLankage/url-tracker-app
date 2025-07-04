/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { MongoClient } from 'mongodb';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const client = new MongoClient(env.MONGODB_URI);

    try {
      await client.connect();
      const db = client.db('urlTrackerDB');
      const urlsCollection = db.collection('urls');

      // Root path response
      if (url.pathname === '/' && request.method === 'GET') {
        return new Response('URL Tracker Worker is running!', {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      // Save or check URL
      if (url.pathname === '/save-data' && request.method === 'POST') {
        const newData = await request.json();

        const existingEntry = await urlsCollection.findOne({ url: newData.url });
        if (existingEntry) {
          return new Response(JSON.stringify({ message: 'URL exists', id: existingEntry.id }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        return new Response(JSON.stringify({ message: 'Data not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Delete data
      if (url.pathname.startsWith('/delete-data/') && request.method === 'DELETE') {
        const id = parseInt(url.pathname.split('/')[2]);
        const result = await urlsCollection.deleteOne({ id: id });
        if (result.deletedCount > 0) {
          return new Response(JSON.stringify({ message: 'Data deleted successfully' }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        return new Response(JSON.stringify({ message: 'Data not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Get all data
      if (url.pathname === '/get-data' && request.method === 'GET') {
        const savedData = await urlsCollection.find().toArray();
        return new Response(JSON.stringify(savedData), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(JSON.stringify({ message: 'Server error', error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } finally {
      await client.close();
    }
  },
};