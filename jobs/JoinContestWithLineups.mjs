import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

function getRandomDelay() {
  min = Math.ceil(1000);
  max = Math.floor(10000);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function enterContest(lineup, contestId, i, db) {
  // console.log(`entering ${contestId} for algo ${lineup.algorithm}`);
  
  setTimeout(() => {
    
    axios.post(`${FANDUEL_WRAPPER_HOST}/contests/${contestId}/entries`, lineup)
      .then(response => {
        console.log(`(JoinContestWithLineups) Joined contest ${contestId} for lineup ${JSON.stringify(lineup)}`)            
        console.log(JSON.stringify(response.data));
        
        db.collection("entries").insertOne({
          contestId: contestId,
          players: [lineup.players],
          algorithm: lineup.algorithm,
          points: lineup.points,
          rosterId: (((response.data.operations || [])[0] || {}).roster || {}).id,
          entryId: (((response.data.operations || [])[0] || {}).entry || {}).id || ((response.data.entries || [])[0] || {}).id
        }, function(err, res) {
          if (err) {
            console.log(err);
            return;
          }
        });

      })
      .catch(error => {
        console.log(`(JoinContestWithLineups) Failed to join contest ${contestId} for algo ${lineup.algorithm} for reason ${JSON.stringify((error.response || {}).data)}`)            
        console.log(error);
      });
  }, 5000*i);
}

export default function(agenda, db) {
  agenda.define('JoinContestWithLineups', {priority: 'high', concurrency: 1}, async job => {
    let contestId = job.attrs.data.contest;
    console.log(`(JoinContestWithLineups) Attempting to join contest ${contestId} for ${job.attrs.data.lineups.length} lineups`)
    
    let lineups = job.attrs.data.lineups;

    for (let i = 0; i < lineups.length; i++) {
      let lineup = lineups[i];        
      if (lineup.algorithm.includes('FASTDRAFT')) {
        enterContest(lineup, contestId, i, db);
      }
    }
  });
}
