import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

export default function(agenda, db) {
  agenda.define('RefreshSlates', {priority: 'high', concurrency: 1}, async job => {
    const {sport} = job.attrs.data;
    console.log(`(RefreshSlates) Refreshing ${sport} slates`);

    axios.get(`${FANDUEL_WRAPPER_HOST}/slates/${sport}`)
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

        agenda.jobs({name: 'GenerateLineupForSlateAndEnterContests', nextRunAt: {$ne: null}})
        .then(jobs => {
          const slateIdsWithJobs = jobs.map(job => job.attrs.data.id);

          slatesResponse.data.forEach(slate => {
            let indexOfMatchingJob = slateIdsWithJobs.indexOf(slate.id);
            let jobExists = indexOfMatchingJob >= 0;

            if (!jobExists) {
              
              const data = {
                id: slate.id,
              };
  
              // Reserve entries to contests
              console.log(`(RefreshSlates) Scheduling NOW job for GenerateLineupForSlateAndEnterContests for slate ${slate.id}`)              
              agenda.now('GenerateLineupForSlateAndEnterContests', data);
  
              // Rerun lineup generation close to slate start to get latest projections
              console.log(`(RefreshSlates) Scheduling future job for GenerateLineupForSlateAndEnterContests for slate ${slate.id}`)              
              const fifteenMinsBeforeSlateStart = new Date(new Date(slate.start_date) - (1000 * 60 * 15));
              agenda.schedule(fifteenMinsBeforeSlateStart, 'GenerateLineupForSlateAndEnterContests', data);
            } else {
              console.log(`(RefreshSlates) Already scheduled: future job for GenerateLineupForSlateAndEnterContests for slate ${slate.id}`)
            }
          });
        });
      });
  });
}