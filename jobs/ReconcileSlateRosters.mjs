import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';
import {isSameLineup} from '../utils/util.mjs';

export default function(agenda, db) {
  agenda.define('ReconcileSlateRosters', {priority: 'high', concurrency: 1}, async job => {
    const slateId = job.attrs.data.slateId;
    console.log(`(ReconcileSlateRosters) Reconciling db for roster in slate ${slateId}`);

    axios.get(`${FANDUEL_WRAPPER_HOST}/my/entries?slateId=${slateId}`)
      .then(response => {
        axios.get(`${FANDUEL_WRAPPER_HOST}/slates/${slateId}/players`)
        .then(playersResponse => {
    
          // Clean up the fppg field and add the name field.
          let refPlayers = playersResponse.data.map(player => {
            return {
              ...player,
              fppg: player.fppg || 0,
              name: `${player.first_name} ${player.last_name}`
            }
          });



          let fanduelRosters = response.data.rosters.map(roster => {
            return {
              id: roster.id,
              lineup: roster.lineup.map(player => {
                let playerData = refPlayers.find(refPlayer => refPlayer.id === player.player.ids[0]);
                let position = playerData.position === 'D' ? 'DEF' : playerData.position;
                return {
                  position: position,
                  id: playerData.id,
                  name: playerData.name,
                  salary: playerData.salary
                }
              })
            }
          });

          let entryRosters = response.data.entries.map(entry => {
            return {
              rosterId: entry.roster.ids[0],
              entryId: entry.id,
              contestId: entry.contest.ids[0]
            }
          });

          entryRosters.forEach(entry => {
            db.collection('entries').findOne({entryId: entry.entryId})
              .then(data => {
                let currentLineup = data.players[data.players.length - 1];
                let fanduelLineup = fanduelRosters.find(roster => roster.id == entry.rosterId).lineup;

                let hasAllData = currentLineup.every(player => player.position && player.id && player.salary && player.name && player.position !== 'D');

                if (isSameLineup(currentLineup, fanduelLineup) && hasAllData && data.rosterId === entry.rosterId) {
                  console.log(`NO NEED to reconcile ${entry.entryId} for roster ${entry.rosterId}`);                
                } else {
                  console.log(`NEED to reconcile ${entry.entryId} for roster ${entry.rosterId}`);

                  let query = {
                    entryId: entry.entryId,
                    contestId: entry.contestId
                  }
                  let update = {
                    $push: {players: fanduelLineup},
                    $set: {
                      reconciled: true,
                      rosterId: entry.rosterId
                    }
                  }

                  db.collection("entries").updateOne(query, update, function(err, res) {
                    if (err) {
                      console.log(err);
                      return;
                    }
                  });                         
                }
              })
              .catch(error => {
                console.log(`Could not fetch entry from db with entryId ${entry.entryId}`);
              });

          });
        });
      });
  });
}