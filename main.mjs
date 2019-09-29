import Agenda from 'agenda';
import Agendash from 'agendash';

import mongodbmock from 'mongodb-memory-server';
import express from 'express';
var app = express();
const port = process.env.PORT || 80;
// JOBS
import slateRefresh from './jobs/slateRefresh';


// LOCAL DEV HANDLING
if (process.env.MONGODB_URI) {
  start(process.env.MONGODB_URI);
} else {
  // Locally
  console.log('USING LOCAL IN-MEMORY MONGO');

  let MongoMemoryServer = mongodbmock.MongoMemoryServer;
  const mongod = new MongoMemoryServer();
  mongod.getConnectionString().then((mongoUri) => {
    start(mongoUri);    
  });
}

// STARTUP
const start = (mongoUri) => {
  // Start Agenda
  const agenda = new Agenda({db: {address: mongoUri}});
  
  // Start agenda dashboard
  app.use('/dash', Agendash(agenda, {title: 'Fantasy Job Dashboard'}));
  app.listen(port, () => console.log(`Job Dashboard listening on port ${port}!`));  

  slateRefresh(agenda);
  
  (async function() {
    await agenda.start();
    await agenda.every('10 seconds', 'slate refresh', {sport: 'nfl'});
  })();
}
