import axios from 'axios';

export default function(agenda, db) {
  agenda.define('PullStatistics', {priority: 'high', concurrency: 1}, async job => {

    console.log(`(PullStatistics) Finding Entries needing stats`);

    db.collection('entries').find({
      result: {$exists: false},
      entryId: {
        $exists: true,
        $ne: null
      }
    }).toArray((err, result) => {
      if (err) throw err;

      let entryIdsWithNoStats = result.map(entry => {
        return entry.entryId;
      });

      entryIdsWithNoStats.forEach((entryId, i) => {
        agenda.schedule(`in ${i} seconds`, 'PullStatisticsByEntry', {entryId});          
      });

    })

    
  });
}