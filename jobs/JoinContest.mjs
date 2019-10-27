import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

export default function(agenda, db) {
  agenda.define('JoinContest', {priority: 'high', concurrency: 1}, async job => {
    let {contestId, lineup} = job.attrs.data;

    console.log(`(JoinContest) Joining contest with id ${contestId}`);
       
    if (lineup.algorithm.includes('FASTDRAFT')) {

      setTimeout(() => {
        axios.post(`${FANDUEL_WRAPPER_HOST}/contests/${contestId}/entries`, lineup)
          .then(response => {

            let rosterId = (((response.data.operations || [])[0] || {}).roster || {}).id;
            let entryId = (((response.data.operations || [])[0] || {}).entry || {}).id || ((response.data.entries || [])[0] || {}).id

            if (rosterId && entryId) {
              // Save entry to db for future ops
              db.collection("entries").insertOne({
                contestId: contestId,
                players: [lineup.players],
                algorithm: lineup.algorithm,
                points: lineup.points,
                rosterId: rosterId,
                entryId: entryId,
                slateId: contestId.substring(0, 5)
              }, function(err, res) {
                if (err) {
                  console.error(`(JoinContest) failed to save entry to the db for contest ${contestId} and algorithm ${lineup.algorithm}`)
                  console.log(err);
                  return;
                }
              });
            } else {
              console.log(`ERROR entering ${contestId} with algorithm ${lineup.algorithm}`)
            }
          })
          .catch(error => {
            console.log(`(JoinContest) Failed to join contest ${contestId} for algo ${lineup.algorithm} for reason ${JSON.stringify((error.response || {}).data)}`);           
            console.log(error);
          });
        }, Math.floor(Math.random()*10 * 6000));
    }
  });
}
