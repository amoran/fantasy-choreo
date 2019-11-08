import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

export default function(agenda, db) {
  agenda.define('GetSlates', {priority: 'high', concurrency: 1}, async job => {
    const {sport} = job.attrs.data;
    console.log(`(GetSlates) Getting slates for ${sport}`);

    axios.get(`${FANDUEL_WRAPPER_HOST}/slates?sport=${sport}`)
      .then(slatesResponse => {
        const slateIds = slatesResponse.data.map(slate => slate.id);

        // Upsert slates into database
        slatesResponse.data.forEach(slate => {
          db.collection('slates').updateOne({id: slate.id}, {$set: slate}, {upsert: true}, (err, res) => {
            if (err) {
              console.error(err);
              return;
            }             
          });
        });

        slatesResponse.data.forEach(slate => {
          agenda.now('EnterContestsForSlate', {slate: slate, sport: sport});
        });

      });
  });
}