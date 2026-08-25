const africastalking = require('africastalking');

const username = process.env.AT_USERNAME;
const apiKey = process.env.AT_API_KEY;

if (!username || !apiKey) {
  throw new Error('Missing AT_USERNAME or AT_API_KEY environment variables.');
}

const client = africastalking({
  username,
  apiKey
});

export const sms = client.SMS;
