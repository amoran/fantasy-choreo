import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

export default function(agenda, db) {
  agenda.define('UpdateRoster', {priority: 'high', concurrency: 1}, async job => {
    let {rosterId, lineup} = job.attrs.data;

    console.log(`(UpdateRoster) Updating Roster ${rosterId} for algo ${lineup.algorithm}`)

      
    setTimeout(() => {
        axios.post(`${FANDUEL_WRAPPER_HOST}/rosters/${rosterId}`, lineup)
        .then(response => {

          let newRosterId = (((response.data.operations || [])[0] || {}).roster || {}).id;
          if (newRosterId) {
            console.log(`(UpdateRoster) Updated roster ${rosterId} for algo ${lineup.algorithm} for lineup ${JSON.stringify(lineup)}`)            
            
            let query = {rosterId: rosterId};
            let update = {
              $push: {players: lineup.players},
              $set: {rosterId: newRosterId}
            };
  
            db.collection("entries2").updateMany(query, update, function(err, res) {
              if (err) {
                console.log(err);
                return;
              }
            });
          }
          else if (response.data.entries) {
            console.log('AHHHH OLD CODE WHY');
            console.log(`(UpdateRoster) Updated roster ${rosterId} for algo ${lineup.algorithm} for lineup ${JSON.stringify(lineup)}`)            
            
            let updatedEntryIds = response.data.entries.map(entry => entry.id);
            
            let query = {entryId: {$in: updatedEntryIds}};
            let update = {
              $push: {players: lineup.players},
              $set: {rosterId: rosterId}
            };
  
            db.collection("entries2").updateMany(query, update, function(err, res) {
              if (err) {
                console.log(err);
                return;
              }
            });
          } else {
            console.log('AHHHH OLD CODE WHY 2');
            console.log(`(UpdateRoster) Updated roster ${rosterId} for algo ${lineup.algorithm} for lineup ${JSON.stringify(lineup)}`)            
            
            let query = {rosterId: rosterId};
            let update = {
              $push: {players: lineup.players},
            };
  
            db.collection("entries2").updateMany(query, update, function(err, res) {
              if (err) {
                console.log(err);
                return;
              }
            });
          }
         

        })
        .catch(error => {
          console.log(`(UpdateRoster) Failed to update roster ${rosterId} for algo ${lineup.algorithm} for reason ${JSON.stringify((error.response || {}).data)}`)            
          console.error(`${FANDUEL_WRAPPER_HOST}/rosters/${rosterId}`);
          console.error(JSON.stringify(error.response.data));
          console.error(error.response.status);
          console.error(error.response.headers);
          console.error(JSON.stringify(lineup));
        });
      }, Math.floor(Math.random()*10 * 6000));
  })
};