import axios from 'axios';
import {FANDUEL_WRAPPER_HOST} from '../constants.mjs';

export default function(agenda) {
  agenda.define('RefreshSlates', {priority: 'high', concurrency: 1}, async job => {
    const {sport} = job.attrs.data;
    console.log(`(RefreshSlates) Refreshing ${sport} slates`);

    axios.get(`${FANDUEL_WRAPPER_HOST}/slates/${sport}`)
      .then(slatesResponse => {
        const slateIds = slatesResponse.data.map(slate => slate.id);

        agenda.jobs({name: 'GenerateLineupForSlateAndEnterContests'})
        .then(jobs => {
          const slateIdsWithJobs = jobs.map(job => job.attrs.data.id);

          slatesResponse.data.forEach(slate => {
            if (slateIdsWithJobs.indexOf(slate.id) < 0) {
  
              const data = {
                contestsUrl: slate.contests,
                id: slate.id,
                label: slate.label,
                playersUrl: slate.players,
                salaryCap: slate.salaryCap,
                startDate: slate.startDate
              };
  
              // Reserve entries to contests
              console.log(`(RefreshSlates) Scheduling NOW job for GenerateLineupForSlateAndEnterContests for slate ${slate.id}`)              
              agenda.now('GenerateLineupForSlateAndEnterContests', data);
  
              // Rerun lineup generation close to slate start to get latest projections
              console.log(`(RefreshSlates) Scheduling future job for GenerateLineupForSlateAndEnterContests for slate ${slate.id}`)              
              const fifteenMinsBeforeSlateStart = new Date(new Date(slate.startDate) - (1000 * 60 * 15));
              agenda.schedule(fifteenMinsBeforeSlateStart, 'GenerateLineupForSlateAndEnterContests', data);
            } else {
              console.log(`(RefreshSlates) Already scheduled: future job for GenerateLineupForSlateAndEnterContests for slate ${slate.id}`)
            }
          });
        });
      });
  });
}