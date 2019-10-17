import Agenda from 'agenda';
import Agendash from 'agendash';
import express from 'express';
import mongodb from 'mongodb';
import { MONGO_CONN_STR } from './constants.mjs';

// JOBS
import RefreshSlates from './jobs/RefreshSlates';
import GenerateLineupForSlateAndEnterContests from './jobs/GenerateLineupForSlateAndEnterContests';
import JoinContestWithLineups from './jobs/JoinContestWithLineups';
import UpdateRoster from './jobs/UpdateRoster';
import PullStatistics from './jobs/PullStatistics';
import PullStatisticsByEntry from './jobs/PullStatisticsByEntry';

const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}
  
mongodb.MongoClient.connect(MONGO_CONN_STR, mongoOptions, function(err, client) {
  if (err) {
    console.log(err);
    return;
  }
  console.log(`Connected successfully to MongoDB: ${MONGO_CONN_STR}`);

  // Start Agenda
  let agendaDb = process.env.PORT ? "fantasy" : "tempfantasy";
  const agenda = new Agenda({mongo: client.db(agendaDb)});

  // Start agenda dashboard
  var app = express();
  const port = process.env.PORT || 80;
  app.use('/dash', Agendash(agenda, {title: 'Fantasy Job Dashboard'}));
  app.listen(port, () => console.log(`Fantasy Job Dashboard listening on port ${port}!`));  
  
  RefreshSlates(agenda);
  GenerateLineupForSlateAndEnterContests(agenda, client.db("fantasy"));
  JoinContestWithLineups(agenda, client.db("fantasy"));
  UpdateRoster(agenda, client.db("fantasy"));
  PullStatistics(agenda, client.db("fantasy"));
  PullStatisticsByEntry(agenda, client.db("fantasy"));
  
  (async function() {
    await agenda.start();
    await agenda.every('1 day', 'RefreshSlates', {sport: 'nfl'});
    await agenda.every('1 day', 'PullStatistics')
  })();
});
