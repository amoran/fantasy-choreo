import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

export default function(agenda, db) {
  agenda.define('PullStatisticsByEntry', {priority: 'high', concurrency: 1}, async job => {
    const {entryId} = job.attrs.data;
    
    console.log(`(PullStatisticsByEntry) Pulling statistics for entryId ${entryId}`);

    axios.get(`${FANDUEL_WRAPPER_HOST}/entries/${entryId}`)
      .then(entryResponse => {

        if (!entryResponse.data.contests) {
          // Bad entry
          db.collection('entries2').updateOne({entryId}, {$set: {legacy: true}}, (err, res) => {
            if (err) throw err;
  
            console.log(`(PullStatisticsByEntry) Updated statistics for entryId ${entryId}`);
          })
        }

        if (!entryResponse.data.contests[0].final) {
          // Contest is not over yet, don't save result.
          return;
        }

        let result = {
          rank: entryResponse.data.entries[0].rank,
          size: entryResponse.data.contests[0].size.max,
          won: entryResponse.data.entries[0].prizes.total,
          entryFee: entryResponse.data.contests[0].entry_fee,
          score: entryResponse.data.rosters[0].score,
          startDate: entryResponse.data.contests[0].start_date
        };

        //Put the data in the db.
        db.collection('entries2').updateOne({entryId}, {$set: {result}}, (err, res) => {
          if (err) throw err;

          console.log(`(PullStatisticsByEntry) Updated statistics for entryId ${entryId}`);
        })
      })
      .catch(error => {
        console.error(error);
      });
  });
}