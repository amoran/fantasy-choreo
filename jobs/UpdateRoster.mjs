import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

function getRandomDelay() {
  min = Math.ceil(1000);
  max = Math.floor(10000);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

export default function(agenda, db) {
  agenda.define('UpdateRoster', {priority: 'high', concurrency: 1}, async job => {
    let rosterId = job.attrs.data.roster;
    let lineup = job.attrs.data.lineup;

    console.log(`(UpdateRoster) Updating Roster ${rosterId} for algo ${lineup.algorithm}`)

    setTimeout(() => {
      
      axios.post(`${FANDUEL_WRAPPER_HOST}/rosters/${rosterId}`, lineup)
        .then(response => {
          console.log(`(UpdateRoster) Updated roster ${rosterId} for algo ${lineup.algorithm} for lineup ${JSON.stringify(lineup)}`)            
          console.log(JSON.stringify(response.data));

          let updatedEntryIds = response.data.entries.map(entry => entry.id);
          
          let query = {entryId: {$in: updatedEntryIds}};
          let update = {
            $push: {players: lineup.players},
            $set: {rosterId: rosterId}
        };

          db.collection("entries").updateMany(query, update, function(err, res) {
            if (err) {
              console.log(err);
              return;
            }
          });
  
        })
        .catch(error => {
          console.log(`(UpdateRoster) Failed to join contest ${rosterId} for algo ${lineup.algorithm} for reason ${JSON.stringify((error.response || {}).data)}`)            
          console.log(error);
        });
    }, Math.floor(Math.random() * 1000));
  })
};