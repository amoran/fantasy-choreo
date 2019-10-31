import Agenda from 'agenda';
import Agendash from 'agendash';
import express from 'express';
import mongodb from 'mongodb';
import { MONGO_CONN_STR } from './constants.mjs';

// JOBS
import GetSlates from './jobs/GetSlates.mjs';
import EnterContestsForSlate from './jobs/EnterContestsForSlate.mjs';
import JoinContest from './jobs/JoinContest.mjs';
import UpdateRoster from './jobs/UpdateRoster.mjs';
import UpdateRostersInSlate from './jobs/UpdateRostersInSlate.mjs';
import PullStatistics from './jobs/PullStatistics.mjs';
import PullStatisticsByEntry from './jobs/PullStatisticsByEntry.mjs';
import ReconcileSlateRosters from './jobs/ReconcileSlateRosters.mjs';

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
  
  GetSlates(agenda, client.db("fantasy"));
  EnterContestsForSlate(agenda, client.db("fantasy"));
  JoinContest(agenda, client.db("fantasy"));
  UpdateRoster(agenda, client.db("fantasy"));
  UpdateRostersInSlate(agenda, client.db("fantasy"));
  PullStatistics(agenda, client.db("fantasy"));
  PullStatisticsByEntry(agenda, client.db("fantasy"));
  ReconcileSlateRosters(agenda, client.db("fantasy"));
  
  (async function() {
    await agenda.start();
    // agenda.now('ReconcileSlateRosters', {slateId: '39695'});
    // agenda.now('ReconcileSlateRosters', {slateId: '39584'});
    // agenda.now('ReconcileSlateRosters', {slateId: '39585'});
    // agenda.now('ReconcileSlateRosters', {slateId: '39587'});
    // agenda.now('ReconcileSlateRosters', {slateId: '39586'});
    // agenda.now('ReconcileSlateRosters', {slateId: '39586'});
    // agenda.now('ReconcileSlateRosters', {slateId: '39693'});
    await agenda.every('1 day', 'GetSlates', {sport: 'nfl'});
    // await agenda.every('1 day', 'PullStatistics');
  })();
});
