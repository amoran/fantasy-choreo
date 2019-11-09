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

  // Start express
  var app = express();
  const port = process.env.PORT || 80;

  // Start Agenda
  let agendaDb = process.env.PORT ? "fantasy" : "tempfantasy";
  let agendaDbNba = process.env.PORT ? "fantasynba" : "tempfantasynba";
  
  const agenda = new Agenda({mongo: client.db(agendaDb)});
  const agendaNba = new Agenda({mongo: client.db(agendaDbNba)});
  
  // Start agenda dashboard
  app.use('/nfl', Agendash(agenda, {title: 'NFL Jobs'}));
  app.use('/nba', Agendash(agendaNba, {title: 'NBA Jobs'}));
  
  // Create NFL Jobs
  GetSlates(agenda, client.db("fantasy"));
  EnterContestsForSlate(agenda, client.db("fantasy"));
  JoinContest(agenda, client.db("fantasy"));
  UpdateRoster(agenda, client.db("fantasy"));
  UpdateRostersInSlate(agenda, client.db("fantasy"));
  PullStatistics(agenda, client.db("fantasy"));
  PullStatisticsByEntry(agenda, client.db("fantasy"));
  ReconcileSlateRosters(agenda, client.db("fantasy"));

  // Create NBA Jobs
  GetSlates(agendaNba, client.db("fantasynba"));
  EnterContestsForSlate(agendaNba, client.db("fantasynba"));
  JoinContest(agendaNba, client.db("fantasynba"));
  UpdateRoster(agendaNba, client.db("fantasynba"));  
  UpdateRostersInSlate(agendaNba, client.db("fantasynba"));
  PullStatistics(agendaNba, client.db("fantasynba"));
  PullStatisticsByEntry(agendaNba, client.db("fantasynba"));
  
  // Start Express listening
  app.listen(port, () => console.log(`Jobs Dashboards listening on port ${port}!`));  
    
  // Start Jobs
  (async function() {
    
    // NFL
    await agenda.start();
    await agenda.every('1 day', 'GetSlates', {sport: 'nfl'});
    await agenda.every('1 day', 'PullStatistics');
    // agenda.now('ReconcileSlateRosters', {slateId: '39693'});

    // NBA
    await agendaNba.start();
    await agendaNba.every('1 day', 'GetSlates', {sport: 'nba'});
    // await agenda.every('1 day', 'PullStatistics');
    
  })();
});
